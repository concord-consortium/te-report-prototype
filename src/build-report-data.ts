import * as _ from 'lodash';
import { ILogPullerEvent } from './log-puller';
import { fetchUserFromPortal } from './fetch-user-from-portal';
import { fetchModuleFromLara } from './fetch-module-from-lara';
import { eventDateCompare, asyncForEach, isBlank, warn } from './utilities';

import { IReportData, IEvent, ISession, ITeacher, IPlugin, IQuestionWrapper,
         EventSubType, IModule, PluginType, WindowShadeType, TEMode } from './report-data-types';

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

async function fetchTeacher(portalToken: string, teachers: ITeacher[], id: string) {
  // If this user has already been fetched from the Portal, just return it;
  // otherwise, create a new one.
  let teacher = teachers.find(t => t.id === id);
  if (teacher === undefined) {
    const teacherName = await fetchUserFromPortal(portalToken, id);
    teacher = {
      id: id,
      name: teacherName
    };
    teachers.push(teacher);
  }
  return teacher;
}

function extractTeacherEditionPlugins(rawActivity: any): IPlugin[] {
  let plugins: IPlugin[] = [];          // Return list.

  if (rawActivity === undefined || rawActivity.pages === undefined) {
    // There are situations, particularly on staging, where the the activity
    // is empty or has no array of pages. In this case, since there can not be
    // any plugins defined, we simply return an empty list.
    return [];
  }

  const rawTeEmbeddables =
    // Find all the embeddable objects that have a teacher edition plugin.
    _.flatten(rawActivity.pages.map( page => page.embeddables ))
      .filter( (e:any) => (
        e.embeddable.plugin !== undefined &&
        e.embeddable.plugin.approved_script_label === 'teacherEditionTips')
      )
      .map( (e: any) => e.embeddable);
  rawTeEmbeddables.forEach( (re:any) => {
    // For each teacher-edition embeddable, construct an IPlugin object.
    const authorData = JSON.parse(re.plugin.author_data);
    const pluginType = resolvePluginType(authorData.tipType);
    const pluginDef = resolvePluginDef(pluginType, authorData);
    const plugin: IPlugin = {
      refID: re.ref_id,
      pluginType: pluginType,
      pluginDef: pluginDef,
    }
    plugins.push(plugin);
  })
  return plugins;
}

function isSignificant(s: string): boolean {
  // Significant means, s is defined and contains some non-whitespace characters.
  return ((s !== undefined) && ! /^\s*$/.test(s))
}

function resolvePluginDef(pluginType: PluginType, authorData: any): IQuestionWrapper | WindowShadeType {
  switch(pluginType) {
    case PluginType.QuestionWrapper:
      const qw = authorData.questionWrapper;
      return {
        isCorrectExplanation: isSignificant(qw.correctExplanation),
        isDistractorsExplanation: isSignificant(qw.distractorsExplanation),
        isExemplar: isSignificant(qw.exemplar),
        isTeacherTip: isSignificant(qw.teacherTip)
      };
    case PluginType.WindowShade:
      switch(authorData.windowShade.windowShadeType) {
        case 'teacherTip':
          return WindowShadeType.TeacherTip;
        case 'theoryAndBackground':
          return WindowShadeType.TheoryAndBackground;
        case 'discussionPoints':
          return WindowShadeType.DiscussionPoints;
        case 'diggingDeeper':
          return WindowShadeType.DiggingDeeper;
        default:
          warn(`Unrecognized windowShadeType ${authorData.windowShade.windowShadeType}`);
          return undefined;
      }
    case PluginType.SideTip:
      return undefined;  // This doesn't make sense for a SideTip, so it's undefined.
   }
}

function resolvePluginType(tipType: string): PluginType {
  switch(tipType) {
    case 'questionWrapper':
      return PluginType.QuestionWrapper;
    case 'windowShade':
      return PluginType.WindowShade;
    case 'sideTip':
      return PluginType.SideTip;
    default:
      warn(`Unrecognized tipType ${tipType}`);
      return undefined;
  }
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
            }
          }) :
          [ // If not a sequence, then make it an array of 1 activity.
            {
              name: rawModule.name,
              plugins: extractTeacherEditionPlugins(rawModule.activity),
            }
          ]
      }
      modules.push(module);
      return module;
    }
  }
}

function decodeTeMode(rawEvent: ILogPullerEvent): TEMode {
  if (rawEvent.extras === undefined || rawEvent.extras.url === undefined) {
    return undefined; // If rawEvent doesn't have a url, return undefined.
  } else {
    return (/.*\?.*mode=teacher-edition/.exec(rawEvent.extras.url) !== null) ?
      TEMode.TeacherEditionMode : TEMode.PreviewMode;
  }
}

function decodeActivityID(rawEvent: ILogPullerEvent): string {
  if (rawEvent.extras === undefined || rawEvent.extras.activity_id === undefined) {
    return undefined;
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
    .filter(m => m.isTEModule);

  // Next, we use use this list of modules to restrict the events to only those
  // events related to teacher-edition modules.
  reportData.events = reportData.events
    .filter(e => reportData.modules.find(m => m === e.module) !== undefined)
    .filter(e => e.teMode !== undefined)
    .filter(e => e.activityID !== undefined)
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

function findEventPlugin(module: IModule, pluginId: string): IPlugin {
  const allPlugins: IPlugin[] = _.flatten(module.activities.map(a => a.plugins));
  const plugin: IPlugin = allPlugins.find((p) => {
    return (`${pluginId}-Embeddable::EmbeddablePlugin` === p.refID);
  });
  return plugin;
}

function decodeEventSubType(rawEvent: ILogPullerEvent): EventSubType {
  const val = rawEvent.event_value;
  if (isBlank(val)) {
    return undefined;
  } else if (val === 'Correct') {
    return EventSubType.CorrectExplanation;
  } else if (val === 'Distractors') {
    return EventSubType.DistractorsExplanation;
  } else if (val === 'Exemplar') {
    return EventSubType.Exemplar;
  } else if (val === 'TeacherTip') {
    return EventSubType.TeacherTip;
  } else if (val === 'theoryAndBackground') {
    return EventSubType.WindowShadeTheoryAndBackground;
  } else if (val === 'teacherTip') {
    return EventSubType.WindowShadeTeacherTip;
  } else if (val === 'discussionPoints') {
    return EventSubType.WindowShadeDiscussionPoints;
  } else if (val === 'diggingDeeper') {
    return EventSubType.WindowShadeDiggingDeeper;
  } else if (val === 'howToUse') {
    return EventSubType.WindowShadeHowToUse;
  } else {
    return undefined;
  }
}

export function buildReportData(portalToken: string, rawEvents: ILogPullerEvent[]): Promise<IReportData> {
  return new Promise<IReportData>( (resolve) => {
    let reportData: IReportData = { events: [], teachers: [], modules: [], sessions: [] };
    const getEvents = async () => {
      await asyncForEach(rawEvents, async (rawEvent) => {
        const module = await fetchModule(reportData.modules, rawEvent.activity);
        const plugin = (!module.isTEModule || rawEvent.extras.embeddable_plugin_id === undefined) ?
          undefined :
          findEventPlugin(module, rawEvent.extras.embeddable_plugin_id);
        const newEvent: IEvent = {
          session: fetchSession(reportData.sessions, rawEvent.session),
          teacher: await fetchTeacher(portalToken, reportData.teachers, rawEvent.username),
          teMode: decodeTeMode(rawEvent),
          eventDate: new Date(rawEvent.time),
          eventType: rawEvent.event,
          eventSubType: decodeEventSubType(rawEvent),
          module: module,
          activityID: decodeActivityID(rawEvent),
          plugin: plugin
        };
        reportData.events.push(newEvent);
      });
    }
    getEvents().then(() => {
      removeAllNonTeacherEditionData(reportData);
      resolveCrossReferences(reportData);
      resolve(reportData);
    });
  });
}
