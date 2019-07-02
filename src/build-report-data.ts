import * as _ from 'lodash';
import { ILogPullerEvent } from './log-puller';
import { fetchUserFromPortal } from './fetch-user-from-portal';
import { fetchModuleFromLara } from './fetch-module-from-lara';
import { eventDateCompare, asyncForEach, isBlank } from './utilities';

// Takes a log, as provided by the log-puller, and builds a report-data object
// which can then be used to generate the various teacher-edition reports.

export interface IReportData {
  events: IEvent[];
  teachers: ITeacher[];
  modules: IModule[];
  sessions: ISession[];
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
  activityID: string;           // Indicates the activity/sequence related to this event.
}

export enum TEMode {
  TeacherEditionMode = 'Teacher Edition',
  PreviewMode = 'Preview'
}

export interface ITeacher {
  id: string;                   // The username field from the log-puller event.
  name: string;                 // User name, As returned by Portal.
  events?: IEvent[];            // All events in the log, caused by this user.
  modules?: IModule[];          // All the modules associated with this user's events.
  sessions?: ISession[]         // All the sessions associated with this user's events.
}

export interface IModule {
  externalID: string;           // The "activity" field from the log event.
  name: string;                 // The module's name, to display in the reports.
  isTEModule: boolean;          // True, if module uses one or more TE plugins.
  activities: IActivity[];      // One or more activity structures of the module.
}

export interface ISession {
  sessionToken: string;         // The "session" token from the events.
  events?: IEvent[];            // All the events associated with this session.
  modules?: IModule[];          // All the modules associated with this session.
  teachers?: ITeacher[];        // All the teachers associated with this session.
  firstDate?: Date;             // Date of first event related to this session.
  lastDate?: Date;              // Date of last event related to this session.
}

export interface IActivity {
  name: string;                 // The name of a particular activity.
  plugins: IPlugin[];           // List of all TE plugins in this activity.
}

export enum PluginType {
  QuestionWrapper = 'Question Wrapper',
  WindowShade = 'Window Shade',
  SideTip = 'Side Tip'
}

export enum QuestionWrapperType {
  CorrectExplanation,
  DistractorsExplanation,
  Exemplar,
  TeacherTip
}

export enum WindowShadeType {
  TeacherTip = 'Teacher Tip',
  TheoryAndBackground = 'Theory & Background',
  DiscussionPoints = 'Discussion Points',
  DiggingDeeper = 'Digging Deeper'
}

export enum SideTipType {
  Default = 'Default Side Tip'
}

export interface IPlugin {
  pluginType: PluginType;
  pluginSubType: QuestionWrapperType | WindowShadeType | SideTipType;
}

function fetchSession(sessions: ISession[], sessionToken: string): ISession {
  // If a session is defined, return it; otherwise, create a new one.
  let session = sessions.find(s => s.sessionToken === sessionToken);
  if (session === undefined) {
    session = {
      sessionToken: sessionToken
    }
    sessions.push(session);
  }
  return session;
}

function fetchTeacher(teachers: ITeacher[], id: string): ITeacher {
  // If this user has already been fetched from the Portal, just return it;
  // otherwise, create a new one.
  let teacher = teachers.find(t => t.id === id);
  if (teacher === undefined) {
    teacher = {
      id: id,
      name: fetchUserFromPortal(id)
    };
    teachers.push(teacher);
  }
  return teacher;
}

function extractTeacherEditionPlugins(rawActivity: any): IPlugin[] {

  // This particular bit of ugly logic descends through the rawActivity data
  // structure (as fetched from LARA) and returns an array of IPlugin objects.
  //
  // This descent into madness begins with an activity, which contains an array
  // of pages which contain... well, something like this:
  // 
  //    activity
  //     .pages[]                   -- iterate over each page to...
  //     .embeddables[]             -- iterate over each embeddable tp...
  //     .embeddable                -- find an actual embeddable...
  //     .embeddable                -- (yes, 2 levels named embeddable) till...
  //     .plugin                    -- eureka, a actual plugin.
  //
  // If that last thing is a plugin with
  //
  //     plugin.approved_script_label === "teacherEditionTips"
  //
  // then the plugin.authorData ought to be a JSON string. This JSON is parsed
  // and the resulting teacher-edition-plugin specific definition is inspected
  // and used to create an IPlugin with the appropriate plugin type and sub-type.
  //
  // All such IPlugin objects from the activity are collected together returned
  // as an array.
  
  let plugins: IPlugin[] = [];

  const createPlugin = (rawPlugin): void => {

    const lookupQuestionWrapperType = (rawQuestionWrapper): QuestionWrapperType => {
      if (rawQuestionWrapper !== undefined) {
        if (! isBlank(rawQuestionWrapper.correctExplanation)) {
          return QuestionWrapperType.CorrectExplanation;
        } else if (! isBlank(rawQuestionWrapper.distractorsExplanation)) {
          return QuestionWrapperType.DistractorsExplanation;
        } else if (! isBlank(rawQuestionWrapper.exemplar)) {
          return QuestionWrapperType.Exemplar;
        } else if (! isBlank(rawQuestionWrapper.teacherTip)) {
          return QuestionWrapperType.TeacherTip;
        }
      }
      console.warn(`Warning: unknown or missing question wrapper definition`);
      return undefined;
    }

    const lookupWindowShadeType = (rawWindowShade): WindowShadeType => {
      if (rawWindowShade !== undefined) {
        switch (rawWindowShade.windowShadeType) {
          case 'teacherTip':
            return WindowShadeType.TeacherTip;
          case 'theoryAndBackground':
            return WindowShadeType.TheoryAndBackground;
          case 'discussionPoints':
            return WindowShadeType.DiscussionPoints;
          case 'diggingDeeper':
            return WindowShadeType.DiggingDeeper;
          default:
            console.warn(`Warning: unknown or missing window shade type "${rawWindowShade.windowShadeType}"`);
            return undefined;
        }
      }
    }

    if (rawPlugin.approved_script_label === "teacherEditionTips") {
      const authorData = JSON.parse(rawPlugin.author_data); // try/catch?
      let p;
      switch (authorData.tipType) {
        case 'questionWrapper':
          p = {
            pluginType: PluginType.QuestionWrapper,
            pluginSubType: lookupQuestionWrapperType(authorData.questionWrapper),
          };
          break;
        case 'windowShade':
          p = {
            pluginType: PluginType.WindowShade,
            pluginSubType: lookupWindowShadeType(authorData.windowShade)
          };
          break;
        case 'sideTip':
          p = {
            pluginType: PluginType.WindowShade,
            pluginSubType: SideTipType.Default
          };
          break;
        case undefined:          
        default:
            console.warn("Warning: no tipType found in author data for plugin. Old version, maybe?");
            console.log(`Start of authorData: ${JSON.stringify(authorData,null,' ')}\nEnd of author Data`);
            break;
      }
      if (p !== undefined) {
        plugins.push(p);
      }
    }
  }

  const extractPluginsFromEmbeddable = (embeddable) : void => {
    if (embeddable.embeddable !== undefined && embeddable.embeddable.plugin !== undefined) {
      createPlugin(embeddable.embeddable.plugin);
    }
  }

  const extractPluginsFromPage = (page) : void => {
    if (page.embeddables !== undefined) {
      page.embeddables.forEach((embeddable) => {
        extractPluginsFromEmbeddable(embeddable);
      });
    }
  }

  if (rawActivity !== undefined && rawActivity.pages !== undefined) {
    rawActivity.pages.forEach((page) => {
      extractPluginsFromPage(page);
    });
  }
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
    return module;
  } else {
    const [_, activityType, activityID] = /(.+): (.+)/.exec(externalID);
    const rawModule = await fetchModuleFromLara(activityType, activityID);
    if (rawModule === undefined) {
      return undefined;
    } else {
      module = {              // We did fetch the module, so build our object.
        externalID: externalID,
        name: (isSequence(externalID)) ? rawModule.display_title : rawModule.name,
        isTEModule: isTEModule(rawModule),
        activities: (isSequence(externalID) && rawModule.activities) ?
          rawModule.activities.map((activity) => {
            return {
              name: activity.name,
              plugins: extractTeacherEditionPlugins(activity),
              dirtBag: activity
            }
          }) :
          [ // If not a sequence, then make it an array of 1 activity.
            {
              name: rawModule.name,
              plugins: extractTeacherEditionPlugins(rawModule.activity),
              dirtBag: rawModule
            }
          ]
      }
      modules.push(module);
      return module;
    }
  }
}

function teMode(rawEvent: ILogPullerEvent): TEMode {
  if (rawEvent.extras === undefined || rawEvent.extras.url === undefined) {
    console.warn(`Server -- rawEvent does not define a url, undefined returned`)
    return undefined;
  } else {
    return (/.*\?.*mode=teacher-edition/.exec(rawEvent.extras.url) !== null) ?
      TEMode.TeacherEditionMode : TEMode.PreviewMode;
  }
}

function activityID(rawEvent: ILogPullerEvent): string {
  if (rawEvent.extras === undefined || rawEvent.extras.activity_id === undefined) {
    return '0';
  } else {
    return rawEvent.extras.activity_id;
  }
}

function removeAllNonTeacherEditionData(reportData: IReportData) {
  // Filter down the results to only those data associated with teacher-edition.
  //
  // First, eliminate all modules that do not contain, at least one, teacher-
  // edition plugin script.
  reportData.modules = reportData.modules
    .filter( m => m.isTEModule );

  // Next, we use use this list of modules to restrict the events to only those
  // events related to teacher-edition modules.
  reportData.events = reportData.events
    .filter( e => reportData.modules.find( m => m === e.module) !== undefined)
    .filter( e => e.teMode !== undefined)
    .sort(eventDateCompare);

  // Finally, use the newly restricted list of events to regenerate the lists of
  // referenced teachers and sessions.
  reportData.teachers = _.uniq(reportData.events.map(e => e.teacher));
  reportData.sessions = _.uniq(reportData.events.map(e => e.session));
}

function resolveCrossReferences(reportData: IReportData) {
  // Do all the cross-referencing and special processing for all the fields in
  // teachers & sessions that weren't supplied when the objects were created.
  reportData.sessions.forEach((session) => {
    session.events = _.uniq(reportData.events.filter(e => e.session == session))
      .sort(eventDateCompare);
    session.modules = _.uniq(session.events.map(e => e.module));
    session.teachers = _.uniq(session.events.map(e => e.teacher));
    session.firstDate = session.events[0].eventDate;
    session.lastDate = session.events[session.events.length - 1].eventDate;
  });
  reportData.teachers.forEach((teacher) => {
    teacher.events = _.uniq(reportData.events.filter(e => e.teacher === teacher))
      .sort(eventDateCompare);
    teacher.modules = _.uniq(teacher.events.map(e => e.module));
    teacher.sessions = _.uniq(teacher.events.map(e => e.session));
  });
}

export function buildReportData(rawEvents: ILogPullerEvent[]): Promise<IReportData> {

  return new Promise<IReportData>((resolve, reject) => {

    let reportData: IReportData = {events: [], teachers: [], modules: [], sessions: [] };

    // Fetch all the events, sessions, and the associated teachers, and the
    // associated modules from the raw log-puller event data.
    const getEvents = async () => {
      await asyncForEach(rawEvents, async (rawEvent) => {
        reportData.events.push({
          session: fetchSession(reportData.sessions, rawEvent.session),
          teacher: fetchTeacher(reportData.teachers, rawEvent.username),
          teMode: teMode(rawEvent),
          eventDate: new Date(rawEvent.time),
          eventType: rawEvent.event,
          module: await fetchModule(reportData.modules, rawEvent.activity),
          activityID: activityID(rawEvent)
        });
      });
    }

    getEvents().then( () => {
      console.log(`Server::buildReportData() - ${reportData.events.length} event(s) resolved with references to ${reportData.modules.length} module(s)`);
      removeAllNonTeacherEditionData(reportData);
      console.log(`Server::buildReportData() - ${reportData.events.length} event(s) and ${reportData.modules.length} module(s) remain after filtering`);
      resolveCrossReferences(reportData);
      resolve(reportData);
    });
  });
}
