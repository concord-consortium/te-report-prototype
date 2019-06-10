import * as fs from "fs";
import * as _ from "lodash";
import { thisExpression } from "@babel/types";
import { listenerCount } from "cluster";
import templateBuilder from "@babel/template";

// Prototype for Teacher Edition research report.
//
// The real-time data feeds, from the log-puller and LARA, are simulated by a
// set of JSON files in the ./input-data directory.
//
// The term "module" is used for a learning-thing that might be either an
// activity or a sequence. Another word, sometime used for this, concept is
// "resource". I've tried to use "module" consistently throughout this prototype.
//
// Notes of things to do:
//   * Sanitize CSV output so special characters, like ", won't break the csv.
//   * csv npm module.
//   * Refactor after all reports can be generated.
//   * Convert time/data displays to the preferred format.
//   * Make a pass to verify exact labels of columns.
//   * Sanity check the dates of the multi session launch times. Doesn't look
//     right when there are more than 1 sessions in the reportableSessions lists.
//   * Fetch LARA data from an actual service.
//           authoring.staging.concord.com/[activitys|sequences]/45678/export => JSON response.
//   * Fetch user data from an actual service.
//   * Hook up to the launch button.
//   * Remove all the debugging/console log messages.
//   * Verify each reportable event-type generated in plug-in.

//   * testing w/ large data (get several people to pound on it) and get a big
//     log. (What's typical big log -- 1,000,000 events?)
//   * testing


// Interfaces
// ==========
//
// For the moment, all data structures are defined as interfaces, to make it
// easier for the time when this file is decomposed into separate code-modules.

interface IEvent {
  // Events are sanitized version of the raw events we get from the log-puller.
  // Sanitized means that only the pertinent information has been extracted from
  // the raw log events and copied into the IEvent.
  //
  // Please note that a copy of the original raw event is saved for debugging
  // purposes and the initial development process -- it's turned out to be
  // very handy. This copy is in a field called the "dirtBag". Once the code
  // has become a bit more stable, it should be removed.
  session: ISession;            // The session this event belongs too.
  teacher: ITeacher;            // The teacher-user that caused this event.
  isTEMode: boolean;            // True means this is an event from a running
                                // . teacher-edition mode; false means a preview.
  eventDate: Date;              // The date-time stamp for this event.
  eventType: string;            // Something like "submit question", "focus in", etc.
  module: IModule;              // The module this event references.
  dirtBag: any;                 // The original raw event from the log puller.
}

interface ITeacher {
  usernameFromEvent: string;    // The username field from the log-puller event.
  id: string;                   // User ID number, as returned by Portal.
  name: string;                 // User name, As returned by Portal.
  events: IEvent[],             // All events in the log, caused by this user.
  modules: IModule[],           // All the modules associated with this user's events.
  sessions: ISession[]          // All the sessions associated with this user's events.
}

interface IModule {
  externalID: string,           // The "activity" field from the log event that
                                // . identifies the module fo fetch from LARA.
  name: string,                 // The module's name (for in the reports).
  isTEModule: boolean,          // Is true if module uses the TE plugin.
  activities: IActivity[],      // One or more activity structures of the module.
  countWindowShades: number,
  countQuestionWrappers: number,
  dirtBag: any                  // The actual thing we got back from LARA.
}

interface IActivity {
  name: string;                 // The name of a particular activity.
  dirtBag: any;                 // The original activity structure from LARA.
}

interface ISession {
  sessionToken: string;         // The "session" token from the events.
  events: IEvent[];             // All the events associated with this session.
  modules: IModule[];           // All the modules associated with this session.
  teachers: ITeacher[];         // All the teachers associated with this session.
}

// Globals
// =======
//
// These lists are eventually populated with all the source data we need for
// producing the reports.

let events: IEvent[] = [];
let teachers: ITeacher[] = [];
let modules: IModule[] = [];
let sessions: ISession[] = [];

// Prepare Source Data
// ===================
//
// Builds up all the data we need for the various reports, in the global data
// structures defined above.

function getEventLog() {

  // Looks at each rawEvent and translates it into an IEvent object. As this
  // is done, other objects are fetched, like user information (from Portal)
  // and module definitions (from LARA). It may well be better to gang all
  // the requests to other services into some sort of single ping of the Portal
  // or LARA to speed up the processing -- worry about that later.

  function fetchRawEvents(): any[] {
    // Fetches the raw events from the log-puller, in this prototype's case, we
    // just read from disk.
    const fileName = './input-data/log-data/portal-report-1559068754567.json';
    return JSON.parse(fs.readFileSync(fileName, "utf8"));
  }

  function fetchTeacher(username): ITeacher {
    // If this user has already been fetched from the Portal, just return it.
    // Otherwise we create a new one.
    let teacher = teachers.find( t => t.usernameFromEvent === username );
    if (teacher === undefined) {
      const fileName = `./input-data/portal-data/user_${username}.json`;
      const rawTeacher = JSON.parse(fs.readFileSync(fileName, "utf8"));
      teacher = {
        usernameFromEvent: username,
        id: rawTeacher.id,
        name: rawTeacher.username,
        events: [],                   // These 3 lists to be Filled in later.
        modules: [],
        sessions: []
      };
      teachers.push(teacher);
    }
    return teacher;
  } 

  function fetchModule(externalID: string): IModule {
    // If this module has already been fetched from LARA, just return it. Else,
    // we fetch it.
    let module = modules.find( m => m.externalID === externalID );
    if (module === undefined) {
      const [_, activityType, activityID] = /(.+): (.+)/.exec(externalID);
      const fileName = `./input-data/lara-data/${activityType}_${activityID}.json`;
      const rawModuleJSON = fs.readFileSync(fileName, "utf8");
      const rawModule = JSON.parse(rawModuleJSON);
      const isSequence = /sequence.*/.exec(externalID) !== null;
      const re = /"approved_script_label": "teacherEditionTips"/;
      const containsAtLeastOneTEScript = (re.exec(rawModuleJSON) !== null);
      module = {
        externalID: externalID,
        name: (isSequence) ? rawModule.display_title : rawModule.name,
        isTEModule: containsAtLeastOneTEScript,
        countWindowShades: 12, 
        //
        //
        //  If we resolve "activites" first, then it's a simpler flat array to handel.
        //  rawModule.pages[all].embeddables[all].embeddable.plugin.author_data.tipType == "WindowShade"
        //  and ...windowShadeType == "theoryAndBackground" or "diggingDeeper"...and the new one.
        //
        //
        countQuestionWrappers: 43, // tbd: placeholder for other TE types.
        activities: (isSequence) ?
          rawModule.activities.map((a) => { return { name: a.name, dirtBag: a} } ) :
          [ { name: rawModule.name, dirtBag: rawModule } ],
        dirtBag: rawModule
      }
      modules.push(module);
    }
    return module;
  }

  function fetchSession(sessionToken: string) : ISession {
    // If a session is defined, return it; otherwise, create a new one.
    let session = sessions.find( s => s.sessionToken === sessionToken);
    if (session === undefined) {
      session = {
        sessionToken: sessionToken,
        events: [],                   // To be filled in, later.
        modules: [],
        teachers: []
      }
      sessions.push(session);
    }
    return session;
  }

  // Here's the main loop used for data prep, driven by an iteration over the
  // raw events supplied by the log-puller.

  events = fetchRawEvents().map( (rawEvent) => {
    return {
      session: fetchSession(rawEvent.session),
      teacher: fetchTeacher(rawEvent.username),
      isTEMode: /.*\?.*mode=teacher-edition/.exec(rawEvent.extras.url) !== null,
      eventDate: new Date(rawEvent.time),
      eventType: rawEvent.event,
      module: fetchModule(rawEvent.activity),
      dirtBag: rawEvent
    }
  });
  console.log(`getEventLog() - number of events processed from log: ${events.length}`);
  // console.log(`getEventLog() - event ids:\n  ${events.map(e => e.dirtBag.id).join("\n  ")}`);
  console.log(`getEventLog() - teachers (${teachers.length}):\n  ${teachers.map(t => t.name).join("\n  ")}`);
  console.log(`getEventLog() - TE Mode events (isTEMode == true): ${events.filter(t => t.isTEMode).length}`);
  console.log(`getEventLog() - Preview events (isTEMode == false): ${events.filter(t => ! t.isTEMode).length}`);
  // console.log(`getEventLog() - event dates:\n  ${events.map(e => e.eventDate.toString()).join("\n  ")}`);
  console.log(`getEventLog() - event types:\n  ${_.uniq(events.map(e => e.eventType)).join("\n  ")}`);
  console.log(`getEventLog() - number modules fetched: ${modules.length}`);
  // console.log(`getEventLog() - modules:\n  ${modules.map(m => m.externalID).join("\n  ")}`);
}

function prepReportSourceData(): void {

  // We start by fetching the event log from the log-puller. As a side effect of
  // calling getEventLog(), not only is the event[] populated with all those
  // events in the log, all modules that are referenced by those events are
  // fetched from LARA, and all the teacher's identities are resolved from the
  // Portal.

  getEventLog();

  // The list of events, at this point is potentially huge, but we can trim that
  // down by eliminating events that do not reference a module with a Teacher
  // Edition plug-in.

  events = events.filter( e => e.module.isTEModule );
  console.log(`prepReportSourceData() - number of TE only events: ${events.length}`);

  // We can now use, what's left, in the events list to trim down the modules
  // that are associated with our events.
    
  modules = _.uniq(events.map( e => e.module ));
  console.log(`prepReportSourceData() - number of TE modules: ${modules.length}`);
  console.log(`prepReportSourceData() - TE modules externalID's:\n  ${modules.map(m => m.externalID).join("\n  ")}`);

  // At this point, we might now have some teachers that have no events
  // associated with Teacher Edition modules. So we make a pass over all the
  // remaining (that is, TE related) events to reconstruct the teachers list.

  console.log(`prepReportSourceData() - number of unfiltered teachers: ${teachers.length}`);
  teachers = _.uniq(events.map(e => e.teacher))
  console.log(`prepReportSourceData() - number of remaining teachers: ${teachers.length}`);

  // It is also possible, that now our unwanted events, modules, and teachers
  // are removed, that some of our sessions can be removed. Use the same idea
  // to regenerate our sessions list based on what's left in the events.

  console.log(`prepReportSourceData() - unfiltered sessions (${sessions.length}):\n  ${sessions.map(s=>s.sessionToken).join("\n  ")}`);
  sessions = _.uniq(events.map( e => e.session ));  
  console.log(`prepReportSourceData() - remaining sessions (${sessions.length}):\n  ${sessions.map(s=>s.sessionToken).join("\n  ")}`);

  // At this point, the teachers need to have their events, modules, and sessions
  // lists filled-in, based on what's left in the events list.

  teachers.forEach( (teacher) => {
    console.log(`Full Teacher (${teacher.name}): `);
    teacher.events = _.uniq( events.filter( e => e.teacher===teacher ));
    console.log(`  Events (${teacher.events.length}) types:\n    ${_.uniq(teacher.events.map(e=>e.eventType)).join("\n    ")}`);
    teacher.modules = _.uniq( teacher.events.map( e => e.module ));
    console.log(`  Modules (${teacher.modules.length}):\n    ${(teacher.modules.map(m=>m.name)).join("\n    ")}`);
    teacher.sessions = _.uniq( teacher.events.map( e => e.session ));

  });

}

// Generate CSV Reports
// ====================


  const columnNames: string[] = [
    "User ID",
    "Teacher Name",
    "TE Module Name",
    "Mode - TE or Preview",
    "Sessions Launched",
    "First Launch",
    "Last Launch",
    "Activities Used",
    "Total Duration for Module"
  ];

  const teacherEditionPluginTypes: string[] = [
    // "QW-Correct",          // "Question Wrapper - Correct Tab",
    // "QW-Distractors",      // "Question Wrapper - Distractors Tab",
    "QW-Tip",              // "Question Wrapper - Teacher Tip Tab",
    // "QW-Exemplar",         // "Question Wrapper - Exemplar Tab",
    // "WS-Tip",              // "Window Shade - Teacher Tip",
    // "WS-Theory",           // "Window Shade - Theory & Background",
    // "WS-Discussion",       // "Window Shade - Discussion Points",
    // "WS-Deeper",           // "Window Shade - Digging Deeper",
    // "ST",                  // "Side Tip"
  ];

  const eventDescriptions: string[] = [
    "Tabs",                // "Total number of tabs in module",
    "Toggled",             // "Number of times tab toggled",
    "Once Toggled",        // "How many tabs toggled at least once",
    "% Once Toggled"       // "Percent of tabs toggled at least once"
  ];

  function buildColumnNames(): string[] {
    let allColumnNames: string[] = columnNames;
    teacherEditionPluginTypes.forEach((t) => {
      eventDescriptions.forEach((d) => {
        allColumnNames.push(t + ":" + d);
      });
    });
    return allColumnNames;
  }


function genUsageReport(fileName) {

  // Each row of this report represents data for a triple:
  //
  //   * Teacher (Which is a combination of the user ID and the Teacher Name).
  //   * TE Module (Which are module names like "GEODE: Module 1", or something).
  //   * Mode (Which is either "TeacherEdition" or "Preview").
  //
  // If the mode is "TeacherEdition" there are many columns specific to the
  // details of various TE widget types, "WindowShade", "QuestionWrapper", etc.
  // In the case of "Preview" mode, these columns are blank.
  
  let report: string[] = [];

  teachers.forEach((teacher) => {
    teacher.modules.forEach((module) => {
      // Find all the TE (non-preview) events for this particular teacher/module
      // combination and use that to extract just the sessions that are pertinent.
      const tEModeEvents: IEvent[] = teacher.events.filter(e => (e.module === module) && e.isTEMode)
      const tEModeSessions: ISession[] = _.uniq(tEModeEvents.map(e => e.session));

      // From those TE sessions, we construct a local list of sessions, where
      // each is populated with just the events associated with this teacher/module.
      // These events are sorted by date-time-stamp. If, there are no remaining
      // events in the session, we filter this session out of our list. And
      // finally, the session list, itself is sorted by comparing the time-date-
      // stamps of the **earliest** event contained in each.
      const reportableSessions: ISession[] =
        tEModeSessions.map( (session) : ISession => {
          return ({
            sessionToken: session.sessionToken,
            events: tEModeEvents.sort((a, b) =>   // Filter this by session.
              { return (b.eventDate.valueOf() - a.eventDate.valueOf()) }),
            modules: [ module ],
            teachers: [ teacher ]
          })
        }).filter(session => session.events.length > 0)
          .sort( (s1, s2) => { return (
              s2.events[0].eventDate.valueOf() - s1.events[0].eventDate.valueOf()
            )
          });

      // Figure out the events & sessions for the preview 
      const previewEvents = teacher.events.filter(e => (e.module === module) && ! e.isTEMode)
      const previewSessions = _.uniq(previewEvents.map(e => e.session));

      // Do the same thing we did for TE sessions, but for preview sessions.
      // And obvious refactoring will be to fold this into a common function; but,
      // I'm not 100% sure it's correct, yet. Should refactor once the
      // behavior is verified.
      const reportablePreviewSessions: ISession[] =
        previewSessions.map( (session) : ISession => {
          return ({
            sessionToken: session.sessionToken,
            events: previewEvents.sort((a, b) =>
              { return (b.eventDate.valueOf() - a.eventDate.valueOf()) }),
            modules: [ module ],
            teachers: [ teacher ]
          })
        }).filter(session => session.events.length > 0)
          .sort( (s1, s2) => { return (
              s2.events[0].eventDate.valueOf() - s1.events[0].eventDate.valueOf()
            )
          });

      function countActivities(sessions: ISession[]): number {
        const modules: IModule[] = _.uniq(_.flatten(sessions.map( s => s.modules )));
        const activities: IActivity[] = _.uniq(_.flatten(modules.map( m => m.activities)));
        return activities.length;
      }

      // console.log(`gen: ${teacher.name} ${module.name} ${tEModeEvents.length} ${previewEvents.length}`)
      if (reportableSessions.length > 0) { // look a this event list or the special one?
        // console.log(`row: ${teacher.id},${teacher.name},${module.name},Teacher Edition`);
        report.push(`${teacher.id},${teacher.name},${module.name}` +
          `,Teacher Edition,${tEModeSessions.length}` + 
          `,${reportableSessions[0].events[0].eventDate}` +
          `,${reportableSessions[reportableSessions.length - 1].events[0].eventDate}` +
          `,${countActivities(reportableSessions)}` +
          `,${-1 * (reportableSessions[reportableSessions.length - 1].events[
            reportableSessions[reportableSessions.length - 1].events.length - 1
          ].eventDate.valueOf() - 
            reportableSessions[0].events[0].eventDate.valueOf()) / 60000}`
        );
        
      // Let's do window-shade-teacher-tip, first.
        report[report.length - 1] = report[report.length - 1].concat(
          `,${module.countWindowShades}`
        );
      }
      if (reportablePreviewSessions.length > 0) {
        // console.log(`row: ${teacher.id},${teacher.name},${module.name},Preview`);
        report.push(`${teacher.id},${teacher.name},${module.name},` +
          `Preview,${previewSessions.length}` + 
          `,${reportablePreviewSessions[0].events[0].eventDate}` +
          `,${reportablePreviewSessions[reportablePreviewSessions.length - 1].events[0].eventDate}` +
          `,${countActivities(reportablePreviewSessions)}` +
          `,${-1 * (reportablePreviewSessions[reportablePreviewSessions.length - 1].events[
            reportablePreviewSessions[reportablePreviewSessions.length - 1].events.length - 1
          ].eventDate.valueOf() - 
            reportablePreviewSessions[0].events[0].eventDate.valueOf()) / 60000}`
        );
      }
    });
  });

  fs.writeFileSync(
    fileName,
    "\"" + (buildColumnNames().join("\",\"")) + "\"" + // Column names.
    "\n" +
    report.join("\n") +
    "\n"
  );

}

// main()
// ======

const outputPath = "./output-data/"

function main(): void {
  prepReportSourceData();
  genUsageReport(`${outputPath}TE-Usage-Report.csv`);
}

main();
