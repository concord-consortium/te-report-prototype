import * as fs from "fs";
import * as _ from "lodash";
import { convertArrayToCSV } from "convert-array-to-csv";

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
//  [x] Find a CSV npm module.
//  [ ] Sanitize all CSV output to handle special characters.
//  [ ] Refactor common logic between TE-mode & preview mode.
//  [ ] Refactor everything after all reports can be generated.
//  [ ] Convert time/data displays to the preferred format.
//  [ ] Make a pass to verify exact labels of columns.
//  [ ] Sanity check the dates of the multi session launch times. Doesn't look
//      right when there are more than 1 sessions in the reportableSessions lists.
//  [ ] Fetch LARA data from an actual service -- something like:
//      authoring.staging.concord.com/[activities|sequences]/45678/export => JSON response.
//  [ ] Fetch user data from an actual service.
//  [ ] Hook up to the launch button.
//  [ ] Remove all the debugging/console log messages.
//  [ ] Verify each reportable event-type generated in plug-in.
//  [ ] Testing w/ large data (get several people to pound on it) and get a big
//      log. (What's typical big log -- 1,000,000 events?)
//  [ ] Unit or integration tests?


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
  events: IEvent[];             // All events in the log, caused by this user.
  modules: IModule[];           // All the modules associated with this user's events.
  sessions: ISession[]          // All the sessions associated with this user's events.
}

interface IModule {
  externalID: string;           // The "activity" field from the log event that
                                // . identifies the module fo fetch from LARA.
  name: string;                 // The module's name (for in the reports).
  isTEModule: boolean;          // Is true if module uses the TE plugin.
  activities: IActivity[];      // One or more activity structures of the module.
  dirtBag: any                  // The actual thing we got back from LARA.
}

interface IActivity {
  name: string;                 // The name of a particular activity.
  plugins: IPlugin[];           // List of all TE plugins in this sequence's
                                //  . activities, pages, and embeddables.
  dirtBag: any;                 // The original activity structure from LARA.
}

interface IPlugin {
  tipType: string;
  dirtBag: any;
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

  function extractTEPlugins(rawActivity: any): IPlugin[] {
    let plugins: IPlugin[] = [];
    if (rawActivity !== undefined && rawActivity.pages !== undefined) {
      rawActivity.pages.forEach( (page) => {
        if (page.embeddables !== undefined) {
          page.embeddables.forEach ( (embeddable) => {
              if (embeddable.embeddable !== undefined && embeddable.embeddable.plugin !== undefined) {
                const plugin = embeddable.embeddable.plugin;
                if (plugin.approved_script_label === "teacherEditionTips") {
                  const authorData = JSON.parse(plugin.author_data);
                  if (authorData.tipType === undefined) {
                    console.warn("no tipType found in author data for plugin. Old version, maybe?")
                  } else {
                    plugins.push({
                      tipType: authorData.tipType,
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
        activities: (isSequence) ?
          rawModule.activities.map((activity) => {
            return {
              name: activity.name,
              plugins: extractTEPlugins(activity),
              dirtBag: activity
            }}) :
          [ // If this isn't a sequence, then it's just a single activity in
            // the array of activities.
            {
              name: rawModule.name,
              plugins: extractTEPlugins(rawModule.activity),
              dirtBag: rawModule 
            }
          ],
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
  // console.log(`getEventLog() - number of events processed from log: ${events.length}`);
  // console.log(`getEventLog() - event ids:\n  ${events.map(e => e.dirtBag.id).join("\n  ")}`);
  // console.log(`getEventLog() - teachers (${teachers.length}):\n  ${teachers.map(t => t.name).join("\n  ")}`);
  // console.log(`getEventLog() - TE Mode events (isTEMode == true): ${events.filter(t => t.isTEMode).length}`);
  // console.log(`getEventLog() - Preview events (isTEMode == false): ${events.filter(t => ! t.isTEMode).length}`);
  // console.log(`getEventLog() - event dates:\n  ${events.map(e => e.eventDate.toString()).join("\n  ")}`);
  // console.log(`getEventLog() - event types:\n  ${_.uniq(events.map(e => e.eventType)).join("\n  ")}`);
  // console.log(`getEventLog() - number modules fetched: ${modules.length}`);
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
  // console.log(`prepReportSourceData() - number of TE only events: ${events.length}`);

  // We can now use, what's left, in the events list to trim down the modules
  // that are associated with our events.
    
  modules = _.uniq(events.map( e => e.module ));
  // console.log(`prepReportSourceData() - number of TE modules: ${modules.length}`);
  // console.log(`prepReportSourceData() - TE modules externalID's:\n  ${modules.map(m => m.externalID).join("\n  ")}`);

  // At this point, we might now have some teachers that have no events
  // associated with Teacher Edition modules. So we make a pass over all the
  // remaining (that is, TE related) events to reconstruct the teachers list.

  // console.log(`prepReportSourceData() - number of unfiltered teachers: ${teachers.length}`);
  teachers = _.uniq(events.map(e => e.teacher))
  // console.log(`prepReportSourceData() - number of remaining teachers: ${teachers.length}`);

  // It is also possible, that now our unwanted events, modules, and teachers
  // are removed, that some of our sessions can be removed. Use the same idea
  // to regenerate our sessions list based on what's left in the events.

  // console.log(`prepReportSourceData() - unfiltered sessions (${sessions.length}):\n  ${sessions.map(s=>s.sessionToken).join("\n  ")}`);
  sessions = _.uniq(events.map( e => e.session ));  
  // console.log(`prepReportSourceData() - remaining sessions (${sessions.length}):\n  ${sessions.map(s=>s.sessionToken).join("\n  ")}`);

  // At this point, the teachers need to have their events, modules, and sessions
  // lists filled-in, based on what's left in the events list.

  teachers.forEach( (teacher) => {
    // console.log(`Full Teacher (${teacher.name}): `);
    teacher.events = _.uniq( events.filter( e => e.teacher===teacher ));
    // console.log(`  Events (${teacher.events.length}) types:\n    ${_.uniq(teacher.events.map(e=>e.eventType)).join("\n    ")}`);
    teacher.modules = _.uniq( teacher.events.map( e => e.module ));
    // console.log(`  Modules (${teacher.modules.length}):\n    ${(teacher.modules.map(m=>m.name)).join("\n    ")}`);
    teacher.sessions = _.uniq( teacher.events.map( e => e.session ));

  });

}

// Generate CSV Reports
// ====================

function eventDateCompare(e1: IEvent, e2: IEvent): number {
  // Returns the difference in two event's dates, in milliseconds.
  return (e1.eventDate.getTime() - e2.eventDate.getTime());
}

function genUsageReport(fileName: string) {

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

  interface columnDef {
    shortTitle: string,
    longTitle: string,
    tipType: string
  }

  const columnDefs: columnDef[] = [
    // {
    //   shortTitle: "QW-Correct",    
    //   longTitle: "Question Wrapper - Correct Tab",
    //   tipType: "windowShade"
    // },
    // {
    //   shortTitle: "QW-Distractors",
    //   longTitle: "Question Wrapper - Distractors Tab",
    //   tipType: "windowShade"
    // },
    // {
    //   shortTitle: "QW-Tip",        
    //   longTitle: "Question Wrapper - Teacher Tip Tab",
    //   tipType: "windowShade"
    // },
    // {
    //   shortTitle: "QW-Exemplar",   
    //   longTitle: "Question Wrapper - Exemplar Tab",
    //   tipType: "windowShade"
    // },
    {
      shortTitle: "WS-Tip",        
      longTitle: "Window Shade - Teacher Tip",
      tipType: "windowShade"
    },
    // {
    //   shortTitle: "WS-Theory",     
    //   longTitle: "Window Shade - Theory & Background",
    //   tipType: "windowShade"
    // },
    // {
    //   shortTitle: "WS-Discussion", 
    //   longTitle: "Window Shade - Discussion Points",
    //   tipType: "windowShade"
    // },
    // {
    //   shortTitle: "WS-Deeper",     
    //   longTitle: "Window Shade - Digging Deeper",
    //   tipType: "windowShade"
    // },
    // {
    //   shortTitle: "ST",            
    //   longTitle: "Side Tip",
    //   tipType: "windowShade"
    // }
  ];

  const subColumns: string[] = [
    "Tabs",                // "Total number of tabs in module",
    "Toggled",             // "Number of times tab toggled",
    "Once Toggled",        // "How many tabs toggled at least once",
    "% Once Toggled"       // "Percent of tabs toggled at least once"
  ];

  function buildColumnNames(): string[] {
    let names: string[] = columnNames;
    columnDefs.forEach( (column) => {
      subColumns.forEach( (subColumn) => {
        names.push(`${column.shortTitle}:${subColumn}`);
      });
    });
    return names;
  }

  // Each row of this report represents data for an ordered-triple:
  //
  //   * Teacher (Which is a combination of the user ID and the Teacher Name).
  //   * TE Module (Which are module names like "GEODE: Module 1", or something).
  //   * Mode (Which is either "Teacher Edition" or "Preview").
  //
  // If the mode is "Teacher Edition" there are many columns specific to the
  // details of various TE widget types, "WindowShade", "QuestionWrapper", etc.
  // In the case of "Preview" mode, these columns are blank.
  
  function getReportableEvents(teacher: ITeacher, module: IModule, mode: boolean): IEvent[] {
    // Returns a list of only those events pertaining to a particular teacher,
    // module, and mode (teacher-edition or preview).
    return teacher.events.filter( e => (e.module === module) && (e.isTEMode === mode));
  }

  function getReportableSessions(teacher: ITeacher, module: IModule, events: IEvent[]): ISession[] {
    // Returns a list of sessions where each sessions are referenced by the
    // list of events. The list is sorted by time of the event.
    const candidateSessions: ISession[] = _.uniq(events.map( e => e.session ));
    const newSessions: ISession[] = candidateSessions.map( (candidateSession) => {
      return {
        sessionToken: candidateSession.sessionToken,
        events: events.sort((a, b) => eventDateCompare(a, b)),
        modules: [ module ],
        teachers: [ teacher ]
      };
    });
    return newSessions.filter( session => session.events.length > 0 )
      .sort( (s1, s2) => eventDateCompare(s1.events[0], s2.events[0]));
  }

  function countActivities(sessions: ISession[]): number {
    const modules: IModule[] = _.uniq(_.flatten(sessions.map( s => s.modules )));
    const activities: IActivity[] = _.uniq(_.flatten(modules.map( m => m.activities)));
    return activities.length;
  }

  function durationOfModule(sessions: ISession[]): number {
    // Returns the difference between the earliest event found in all the
    // sessions, and the latest.
    const allEvents = _.flatten(sessions.map( s => s.events )).sort( (a, b) => eventDateCompare(a, b));
    console.log(`dates: ${allEvents.map( e => e.eventDate.toString()).join("\n")}`)
    return eventDateCompare(allEvents[0], allEvents[allEvents.length - 1]);
  }

  const columnHeader = buildColumnNames();
  const modes: boolean[] = [ true, false ];
  let report: string[][] = [];

  teachers.forEach( (teacher) => {
    teacher.modules.forEach( (module) => {
      modes.forEach( (mode) => {
        const events: IEvent[] = getReportableEvents(teacher, module, mode);
        if (events.length > 0) {
          const sessions: ISession[] = getReportableSessions(teacher, module, events);
          if (sessions.length > 0) {
            var row: string[] = [ teacher.id, teacher.name, module.name ];
            row.push(mode ? "Teacher Edition" : "Preview");
            row.push(sessions.length.toString());
            row.push(sessions[0].events[0].eventDate.toString());
            row.push(sessions.length <= 1 ? "" :
                     sessions[sessions.length - 1].events[0].eventDate.toString());
            row.push(countActivities(sessions).toString());
            row.push(durationOfModule(sessions).toString());
            report.push(row);
          }
        }
      });
    });
  });

  // teachers.forEach((teacher) => {
  //   teacher.modules.forEach((module) => {

  //     // Find all the TE (non-preview) events for this particular teacher/module
  //     // combination and use that to extract just the sessions that are pertinent.

  //     let eventsTE = getReportableEvents(teacher, module, true);
  //     let sessionsTE = getReportableSessions(teacher, module, eventsTE);

  //     // Figure out the events & sessions for the preview 
  //     const eventsPreview = getReportableEvents(teacher, module, false);
  //     const sessionsPreview = getReportableSessions(teacher, module, eventsPreview);

  //     function countActivities(sessions: ISession[]): number {
  //       const modules: IModule[] = _.uniq(_.flatten(sessions.map( s => s.modules )));
  //       const activities: IActivity[] = _.uniq(_.flatten(modules.map( m => m.activities)));
  //       return activities.length;
  //     }

  //     report.push({
  //       "Activities Used": string;
  //       "Total Duration for Module": string;
  //     });


  //     // console.log(`gen: ${teacher.name} ${module.name} ${tEModeEvents.length} ${previewEvents.length}`)
  //     if (reportableSessions.length > 0) { // look a this event list or the special one?
  //       // console.log(`row: ${teacher.id},${teacher.name},${module.name},Teacher Edition`);
  //       report.push(`${teacher.id},${teacher.name},${module.name}` +
  //         `,Teacher Edition,${tEModeSessions.length}` + 
  //         `,${reportableSessions[0].events[0].eventDate}` +
  //         `,${reportableSessions[reportableSessions.length - 1].events[0].eventDate}` +
  //         `,${countActivities(reportableSessions)}` +
  //         `,${-1 * (reportableSessions[reportableSessions.length - 1].events[
  //           reportableSessions[reportableSessions.length - 1].events.length - 1
  //         ].eventDate.valueOf() - 
  //           reportableSessions[0].events[0].eventDate.valueOf()) / 60000}`
  //       );
        
  //     // Let's do window-shade-teacher-tip, first.
  //       report[report.length - 1] = report[report.length - 1].concat(
  //         `${module.activities.map( a => 
  //           a.plugins.filter( p => p.tipType === "windowShade" ).length)``
  //         })}`            // ${module.countWindowShades}`
  //       );
  //     }
  //     if (reportablePreviewSessions.length > 0) {
  //       // console.log(`row: ${teacher.id},${teacher.name},${module.name},Preview`);
  //       report.push(`${teacher.id},${teacher.name},${module.name},` +
  //         `Preview,${previewSessions.length}` + 
  //         `,${reportablePreviewSessions[0].events[0].eventDate}` +
  //         `,${reportablePreviewSessions[reportablePreviewSessions.length - 1].events[0].eventDate}` +
  //         `,${countActivities(reportablePreviewSessions)}` +
  //         `,${-1 * (reportablePreviewSessions[reportablePreviewSessions.length - 1].events[
  //           reportablePreviewSessions[reportablePreviewSessions.length - 1].events.length - 1
  //         ].eventDate.valueOf() - 
  //           reportablePreviewSessions[0].events[0].eventDate.valueOf()) / 60000}`
  //       );
  //     }
  //   });
  // });

  const csv = convertArrayToCSV(report, {
      header: columnHeader,
      separator: ','
     });
  fs.writeFileSync(fileName, csv);
}

// main()
// ======

const outputPath = "./output-data"

function main(): void {
  prepReportSourceData();
  genUsageReport(`${outputPath}/TE-Usage-Report.csv`);
}

main();
