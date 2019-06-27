import * as fs from 'fs';
import * as _ from 'lodash';
import { ILogPullerEvent } from './log-puller';
import { fetchUserFromPortal } from './fetch-user-from-portal';
import { fetchModuleFromLara } from './fetch-module-from-lara';
import { eventDateCompare } from './utilities';

// Takes a log, as provided by the log-puller, and builds a report-data object
// which can then be used to generate the various teacher-edition reports.

// Note: In several of these objects, a copy of the original, source object is
// kept in a thing called a "dirtBag". This turns out to be pretty handy during
// initial development for hacking in a new feature, or even just debugging
// where it can be handy to have the original source object for reference.
// Once the code has become stable, these may be removed to reduce memory usage.

export interface IReportData {
  events: IEvent[];
  teachers: ITeacher[];
  modules: IModule[];
  sessions: ISession[];
  dirtBags: ILogPullerEvent[];
}

export interface IEvent {
  // Events are sanitized version of the raw events we get from the log-puller;
  // only the pertinent information is extracted from the raw log event and
  // saved in the IEvent.
  session: ISession;            // The session this event belongs too.
  teacher: ITeacher;            // The teacher that caused this event.
  teMode: TEMode;               // Either in "previewMode" or "teacherEditionMode".
  eventDate: Date;              // The date-time stamp for this event.
  eventType: string;            // Something like "submit question", "focus in", etc.
  module: IModule;              // The module this event references.
  activityID: string;           // Indicates the activity related to this event.
  dirtBag: any;                 // The original raw event from the log puller.
}

export enum TEMode {
  teacherEditionMode = 'Teacher Edition',
  previewMode = 'Preview',
  unknownMode = 'UnknownMode'
}

export interface ITeacher {
  id: string;                   // The username field from the log-puller event.
  name: string;                 // User name, As returned by Portal.
  events: IEvent[];             // All events in the log, caused by this user.
  modules: IModule[];           // All the modules associated with this user's events.
  sessions: ISession[]          // All the sessions associated with this user's events.
}

export interface IModule {
  externalID: string;           // The "activity" field from the log event.
  name: string;                 // The module's name (for in the reports).
  isTEModule: boolean;          // Is true if module uses one or more TE plugins.
  activities: IActivity[];      // One or more activity structures of the module.
  dirtBag: any                  // The actual thing we got back from LARA.
}

export interface IActivity {
  name: string;                 // The name of a particular activity.
  plugins: IPlugin[];           // List of all TE plugins in this.
  dirtBag: any;                 // The original activity structure from LARA.
}

export interface IPlugin {
  tipType: string;              // Can be "questionWrapper", "windowShade", or "sideTip"
  windowShade?: IWindowShade;
  questionWrapper?: IQuestionWrapper;
  dirtBag: any;
}

export interface ISession {
  sessionToken: string;         // The "session" token from the events.
  events: IEvent[];             // All the events associated with this session.
  modules: IModule[];           // All the modules associated with this session.
  teachers: ITeacher[];         // All the teachers associated with this session.
  firstDate: Date;              // Date of first event related to this session.
  lastDate: Date;               // Date of last event related to this session.
}

interface IWindowShade {
  windowShadeType: string;
}

interface IQuestionWrapper {
  correctExplanation?: string;
  distractorsExplanation?: string;
  exemplar?: string;
  teacherTip?: string;
}

function fetchSession(sessions: ISession[], sessionToken: string): ISession {
  // If a session is defined, return it; otherwise, create a new one.
  let session = sessions.find(s => s.sessionToken === sessionToken);
  if (session === undefined) {
    session = {
      sessionToken: sessionToken,
      events: [],                   // To be filled in, later.
      modules: [],
      teachers: [],
      firstDate: null,
      lastDate: null
    }
    sessions.push(session);
  }
  return session;
}

function fetchTeacher(teachers: ITeacher[], id: string): ITeacher {
  // If this user has already been fetched from the Portal, just return it.
  // Otherwise we create a new one.
  let teacher = teachers.find(t => t.id === id);
  if (teacher === undefined) {
    teacher = {
      id: id,
      name: fetchUserFromPortal(id),
      events: [],                   // These 3 lists to be Filled in later.
      modules: [],
      sessions: []
    };
    teachers.push(teacher);
  }
  return teacher;
}

function extractTEPlugins(rawActivity: any): IPlugin[] {
  let plugins: IPlugin[] = [];
  if (rawActivity !== undefined && rawActivity.pages !== undefined) {
    rawActivity.pages.forEach((page) => {
      if (page.embeddables !== undefined) {
        page.embeddables.forEach((embeddable) => {
          if (embeddable.embeddable !== undefined && embeddable.embeddable.plugin !== undefined) {
            const plugin = embeddable.embeddable.plugin;
            if (plugin.approved_script_label === "teacherEditionTips") {
              const authorData = JSON.parse(plugin.author_data);
              if (authorData.tipType === undefined) {
                console.warn("no tipType found in author data for plugin. Old version, maybe?");
              } else {
                plugins.push({
                  tipType: authorData.tipType,
                  windowShade: ((authorData.tipType !== "windowShade") ?
                    null :
                    {
                      // There are some situations where we find the type of the
                      // window-shade specified in "windowShadeType", and other
                      // situations where "type" seems to be the field name. To
                      // handle this gracefully, if there isn't a field with the
                      // name "windowShadeType", the "type" field is checked.
                      windowShadeType: authorData.windowShade.windowShadeType ?
                        authorData.windowShade.windowShadeType :
                        authorData.windowShade.type
                    }),
                  questionWrapper: authorData.questionWrapper,
                  dirtBag: authorData
                });
              }
            };
          };
        });
      };
    });
  };
  return plugins;
}

function isSequence(externalID: string): boolean {
  return (/sequence.*/.exec(externalID) !== null);
}

function isTEModule(rawModule: any): boolean {
  const re = /"approved_script_label":.*"teacherEditionTips"/;
  return (re.exec(JSON.stringify(rawModule)) !== null);
}

async function fetchModule(modules: IModule[], externalID: string) {
  // If this module has been fetched from LARA, just return it. Else, fetch it.
  let module = modules.find(m => m.externalID === externalID);
  if (module !== undefined) {
    // console.log(`  fetchModule() found existing ${externalID}`);
    return module;
  } else {
    console.log(`  fetchModule() ${externalID} not found; fetch it from LARA.`);
    const [_, activityType, activityID] = /(.+): (.+)/.exec(externalID);
    const rawModule = await fetchModuleFromLara(activityType, activityID);
    if (rawModule === null || rawModule === undefined) {
      return null;
    } else {
      module = {              // We did fetch the module, so build our object.
        externalID: externalID,
        name: (isSequence(externalID)) ? rawModule.display_title : rawModule.name,
        isTEModule: isTEModule(rawModule),
        activities: (isSequence(externalID) && rawModule.activities) ?
          rawModule.activities.map((activity) => {
            return {
              name: activity.name,
              plugins: extractTEPlugins(activity),
              dirtBag: activity
            }
          }) :
          [ // If not a sequence, then make it an array of 1 activity.
            {
              name: rawModule.name,
              plugins: extractTEPlugins(rawModule.activity),
              dirtBag: rawModule
            }
          ],
        dirtBag: rawModule
      }
      modules.push(module);
      console.log(`  fetchModule() newly fetched module ${externalID} saved in module list.`)
      return module;
    }
  }
}

function teMode(rawEvent: ILogPullerEvent): TEMode {
  if (rawEvent.extras === undefined || rawEvent.extras.url === undefined) {
    return TEMode.unknownMode;
  } else {
    return (/.*\?.*mode=teacher-edition/.exec(rawEvent.extras.url) !== null) ?
      TEMode.teacherEditionMode : TEMode.previewMode;
  }
}

function activityID(rawEvent: ILogPullerEvent): string {
  if (rawEvent.extras === undefined || rawEvent.extras.activity_id === undefined) {
    return '0';
  } else {
    return rawEvent.extras.activity_id;
  }

}

export function buildReportData(rawEvents: ILogPullerEvent[]): Promise<IReportData> {

  return new Promise<IReportData>((resolve, reject) => {

  let events: IEvent[] = [];
  let teachers: ITeacher[] = [];
  let modules: IModule[] = [];
  let sessions: ISession[] = [];

  // 1. Fetch all the events, sessions, and the associated teachers, and the
  // associated modules from the raw log-puller event data.

  async function asyncForEach(array, callback) {
    for (let index = 0; index < array.length; index++) {
      await callback(array[index], index, array);
    }
  }

  const getEvents = async () => {
    await asyncForEach(rawEvents, async (rawEvent) => {
      // console.log(`buildReportData() processing event: ${rawEvent.event}`);
      events.push({
        session: fetchSession(sessions, rawEvent.session),
        teacher: fetchTeacher(teachers, rawEvent.username),
        teMode: teMode(rawEvent),
        eventDate: new Date(rawEvent.time),
        eventType: rawEvent.event,
        module: await fetchModule(modules, rawEvent.activity),
        activityID: activityID(rawEvent),
        dirtBag: rawEvent
      });
    });
  }

  getEvents().then( () => {
    console.log(`>>>> Events resolved with modules: events ${events.length}, modules: ${modules.length}`);
  // 2. Filter down the results to only those associated with teacher-edition.
  //
  // First, just eliminate all the modules that don't contain at least one
  // teacher-edition plugin script. Then remove all the events that do not
  // have a module in the new, restricted, list of modules. Finally, apply
  // one more filter to remove events where the teacher-edition mode could not
  // be identified. With the list of events filtered down, use it to rebuild
  // the teachers & sessions for only those that are associated with teacher-
  // edition events.

  modules = modules.filter( m => m.isTEModule );
  events = events.filter( e => modules.find( m => m === e.module) !== undefined)
    .filter( e => e.teMode !== TEMode.unknownMode)
    .sort(eventDateCompare);
  teachers = _.uniq(events.map(e => e.teacher));
  sessions = _.uniq(events.map(e => e.session));

  // 3. Complete the cross referencing in teachers & sessions.

  sessions.forEach((session) => {
    session.events = _.uniq(events.filter(e => e.session == session));
    session.modules = _.uniq(session.events.map(e => e.module));
    session.teachers = _.uniq(session.events.map(e => e.teacher));
    session.firstDate = session.events[0].eventDate;
    session.lastDate = session.events[session.events.length - 1].eventDate;
  });
  teachers.forEach((teacher) => {
    teacher.events = _.uniq(events.filter(e => e.teacher === teacher));
    teacher.modules = _.uniq(teacher.events.map(e => e.module));
    teacher.sessions = _.uniq(teacher.events.map(e => e.session));
  });

  // 4. Package all this up into a single data structure to pass around.

  resolve( {
    events: events,
    sessions: sessions,
    modules: modules,
    teachers: teachers,
    dirtBags: rawEvents
  })
  });

    // 4. Package all this up into a single data structure to pass around.

    // return {
    //   events: events,
    //   sessions: sessions,
    //   modules: modules,
    //   teachers: teachers,
    //   dirtBags: rawEvents
    // }
  //)

  // // 2. Filter down the results to only those associated with teacher-edition.
  // //
  // // First, just eliminate all the modules that don't contain at least one
  // // teacher-edition plugin script. Then remove all the events that do not
  // // have a module in the new, restricted, list of modules. Finally, apply
  // // one more filter to remove events where the teacher-edition mode could not
  // // be identified. With the list of events filtered down, use it to rebuild
  // // the teachers & sessions for only those that are associated with teacher-
  // // edition events.

  // modules = modules.filter( m => m.isTEModule );
  // events = events.filter( e => modules.find( m => m === e.module) !== undefined)
  //   .filter( e => e.teMode !== TEMode.unknownMode)
  //   .sort(eventDateCompare);
  // teachers = _.uniq(events.map(e => e.teacher));
  // sessions = _.uniq(events.map(e => e.session));

  // // 3. Complete the cross referencing in teachers & sessions.

  // sessions.forEach((session) => {
  //   session.events = _.uniq(events.filter(e => e.session == session));
  //   session.modules = _.uniq(session.events.map(e => e.module));
  //   session.teachers = _.uniq(session.events.map(e => e.teacher));
  //   session.firstDate = session.events[0].eventDate;
  //   session.lastDate = session.events[session.events.length - 1].eventDate;
  // });
  // teachers.forEach((teacher) => {
  //   teacher.events = _.uniq(events.filter(e => e.teacher === teacher));
  //   teacher.modules = _.uniq(teacher.events.map(e => e.module));
  //   teacher.sessions = _.uniq(teacher.events.map(e => e.session));
  // });

  // // 4. Package all this up into a single data structure to pass around.

  // return {
  //   events: events,
  //   sessions: sessions,
  //   modules: modules,
  //   teachers: teachers,
  //   dirtBags: rawEvents
  // }
  });
}
