import * as _ from 'lodash';
import { convertArrayToCSV } from 'convert-array-to-csv';
import { TimeSpan } from 'timespan';

import { eventDateCompare, sessionFirstDateCompare } from './utilities';
import { IReportData, IEvent, IModule, ITeacher, TEMode, ISession,
  IActivity, IPlugin } from './build-report-data';
import { access } from 'fs';

const columnNames: string[] = [
  "User ID",
  "Teacher Name",
  "TE Module Name",
  "Mode - TE or Preview",
  "Sessions Launched",
  "Time of First Launch",
  "Time of Last Launch",
  "Number of Activities Used",
  "Total Duration for Module"
];

interface IColumnDef {
  title: string,
  tipType: string,
  tipSubType: string,
  eventMatcher: RegExp
}

const columnDefs: IColumnDef[] = [
  {
    title: "Question Wrapper - Correct Tab",
    tipType: "questionWrapper",
    tipSubType: "correctExplanation",
    eventMatcher: /TeacherEdition-windowShade-questionWrapper Tab(Opened|Closed)/
  },
  {
    title: "Question Wrapper - Distractors Tab",
    tipType: "questionWrapper",
    tipSubType: "distractorsExplanation",
    eventMatcher: /TeacherEdition-windowShade-questionWrapper Tab(Opened|Closed)/
  },
  {
    title: "Question Wrapper - Teacher Tip Tab",
    tipType: "questionWrapper",
    tipSubType: "teacherTip",
    eventMatcher: /TeacherEdition-windowShade-questionWrapper Tab(Opened|Closed)/
  },
  {
    title: "Question Wrapper - Exemplar Tab",
    tipType: "questionWrapper",
    tipSubType: "exemplar",
    eventMatcher: /TeacherEdition-windowShade-questionWrapper Tab(Opened|Closed)/
  },
  {
    title: "Window Shade - Teacher Tip",
    tipType: "windowShade",
    tipSubType: "teacherTip",
    eventMatcher: /TeacherEdition-windowShade-TeacherTip Tab(Opened|Closed)/
  },
  {
    title: "Window Shade - Theory & Background",
    tipType: "windowShade",
    tipSubType: "theoryAndBackground",
    eventMatcher: /TeacherEdition-windowShade-TheoryAndBackground Tab(Opened|Closed)/
  },
  {
    title: "Window Shade - Discussion Points",
    tipType: "windowShade",
    tipSubType: "discussionPoints",
    eventMatcher: /TeacherEdition-windowShade-DiscussionPoints Tab(Opened|Closed)/
  },
  {
    title: "Window Shade - Digging Deeper",
    tipType: "windowShade",
    tipSubType: "diggingDeeper",
    eventMatcher: /TeacherEdition-windowShade-DiggingDeeper Tab(Opened|Closed)/
  },
  {
    title: "Side Tip",
    tipType: "sideTip",
    tipSubType: "",
    eventMatcher: /TeacherEdition-windowShade-DiggingDeeper Tab(Opened|Closed)/
  }
];

const subColumns: string[] = [
  "Number of Tabs",                // "Total number of tabs in module",
  "Times a Tab was Toggled",       // "Number of times a tab was toggled",
  "Number of Tabs Once Toggled",   // "How many tabs toggled at least once",
  "% of Tabs Once Toggled"         // "Percent of tabs toggled at least once"
];

function buildColumnNames(): string[] {
  let names: string[] = columnNames;
  columnDefs.forEach( (column) => {
    subColumns.forEach( (subColumn) => {
      names.push(`${column.title}:${subColumn}`);
    });
  });
  return names;
}

function getReportableEvents(teacher: ITeacher, module: IModule, mode: TEMode): IEvent[] {
  // Returns a list of only those events pertaining to a particular teacher,
  // module, and mode (teacher-edition or preview).
  return teacher.events.filter( e => (e.module === module) && (e.teMode === mode));
}

function getRelatedSessions(events: IEvent[]): ISession[] {
  // Returns a list of sessions where each sessions are referenced by the
  // list of events. The list is sorted by time of the event.
  const sessions: ISession[] = _.uniq(events.map( e => e.session ));
  return sessions.sort( (s1, s2) => eventDateCompare(s1.events[0], s2.events[0]));
}

function countActivitiesUsed(sessions: ISession[]): number {
  const activityIDs: string[] =
    _.uniq(_.flatten(sessions.map( s => s.events)).map( e => e.activityID));
  return activityIDs.length;
}

function totalDuration(sessions: ISession[]): string {
  const events = _.flatten(sessions.map( s => s.events )).sort(eventDateCompare);
  const ts = new TimeSpan(eventDateCompare(events[events.length - 1], events[0]));
  return `${ts.days}:${ts.hours}:${ts.minutes}:${ts.seconds}`;
}

function getQuestionWrapperPlugins(activities: IActivity[], columnDef: IColumnDef): IPlugin[] {
  const isBlank = (s: string): boolean => { return (s === undefined || s === '')};
  const plugins: IPlugin[] = _.flatten(activities.map(a => a.plugins))
    .filter(p => (p.tipType === columnDef.tipSubType) && p.questionWrapper !== undefined);
  console.log(`getQWPs() plugins.length: ${plugins.length}`)
  switch (columnDef.tipSubType) {
    case "correctExplanation":
      return plugins.filter( p => ! isBlank(p.questionWrapper.correctExplanation));
    case "distractorsExplanation":
      return plugins.filter( p => p.questionWrapper.distractorsExplanation !== undefined &&
        p.questionWrapper.distractorsExplanation !== "");
    case "exemplar":
      return plugins.filter( p => p.questionWrapper.exemplar !== undefined &&
        p.questionWrapper.exemplar !== "");
    case "teacherTip":
      return plugins.filter( p => p.questionWrapper.teacherTip !== undefined &&
        p.questionWrapper.teacherTip !== "");
    default:
      console.warn(`WARNING: unrecognized columnDef.tipSubType of ${columnDef.tipSubType}`);
      return [];

  }
}

export function genUsageReport(reportData: IReportData): string {

  // function getWindowShadeTabPlugins(activities: IActivity[], columnDef: IColumnDef): IPlugin[] {
  //   const plugins: IPlugin[] = _.flatten(activities.map( a => a.plugins ))
  //   const pertinentPlugins: IPlugin[] = plugins.filter( p => (p.tipType === columnDef.tipType) && (p.windowShade !== undefined) &&
  //   p.windowShade.windowShadeType === columnDef.tipSubType);
  //   return pertinentPlugins;
  // }

  // function getQuestionWrapperTabPlugins(activities: IActivity[], columnDef: IColumnDef): IPlugin[] {
  //   const plugins: IPlugin[] = _.flatten(activities.map( a => a.plugins ))
  //   const pertinentPlugins: IPlugin[] = plugins.filter( p => (p.tipType === columnDef.tipType) && (p.questionWrapper !== undefined));
  //   switch (columnDef.tipSubType) {
  //     case "correctExplanation":
  //       return pertinentPlugins.filter( p => p.questionWrapper.correctExplanation !== undefined &&
  //         p.questionWrapper.correctExplanation !== "");
  //     case "distractorsExplanation":
  //       return pertinentPlugins.filter( p => p.questionWrapper.distractorsExplanation !== undefined &&
  //         p.questionWrapper.distractorsExplanation !== "");
  //     case "exemplar":
  //       return pertinentPlugins.filter( p => p.questionWrapper.exemplar !== undefined &&
  //         p.questionWrapper.exemplar !== "");
  //     case "teacherTip":
  //       return pertinentPlugins.filter( p => p.questionWrapper.teacherTip !== undefined &&
  //         p.questionWrapper.teacherTip !== "");
  //     default:
  //       console.warn(`WARNING: columnDef.tipSubType of ${columnDef.tipSubType}`);
  //       return [];
  //   }
  // }

  // function countTabsWithAToggleEvent(tabs: IPlugin[], events: IEvent[]): number {
  //   // console.log(`countTabsWithAToggleEvent() tabs(${tabs.length}): ${tabs.map(t=>t.tipType).join(", ")}`)
  //   // console.log(`countTabsWithAToggleEvent() events(${events.length}): ${events.map(e=>e.eventType).join(", ")}`)

  //   const activities: IActivity[] = _.uniq(_.flatten(events.map( e => e.module.activities )));
  //   // console.log(`countTabsWithAToggleEvent() activity count: ${activities.length}`)

  //   const eventPlugins: IPlugin[] = _.uniq(_.flatten(activities.map( a => a.plugins )));
  //   // console.log(`countTabsWithAToggleEvent() eventPlugins count: ${eventPlugins.length}`)

  //   let count = 0;
  //   tabs.forEach( (tab) => {
  //     // For each tab, see if it's referenced by at least one event.
  //     if (eventPlugins.find( p => (p === tab))) {
  //       count += 1;
  //     }
  //   });
  //   return count;
  // }


  // Build up the report as an array of rows where each row is an array of cells.
  let report: string[][] = [];

  // Each row of this report represents data for an ordered-triple of (teacher,
  // module, mode). For each such triple, fetch the reportable events associated
  // with that triple.
  reportData.teachers.forEach( (teacher) => {
    teacher.modules.forEach( (module) => {
      [TEMode.teacherEditionMode, TEMode.previewMode].forEach( (mode) => {
        const reportableEvents: IEvent[] = getReportableEvents(teacher, module, mode);
        // console.log(`${teacher.id}:${module.name}:${mode} event count: ${reportableEvents.length}`)
        if (reportableEvents.length > 0) {  // Include this row, only if there are events.

          // First, add the cells that identify this row: teacher (id & name),
          // module name, and the mode (either "Preview" or "Teacher Edition").
          let row: string[] = [ teacher.id, teacher.name, module.name, mode ];

          // Next is the session data. For this we need a list of the sessions
          // that are associated with this triple. For this we want the number
          // of sessions, the start-time of the earliest launched session, the
          // start-time of the most recent started session, and the total duration
          // of the module.
          //
          // The times of the first and last launches are pretty easy; but, the
          // third is a little tricker. The total duration is the span between
          // the very first event of all the sessions and the very last event of
          // all the sessions.
          const relatedSessions: ISession[] = getRelatedSessions(reportableEvents)
            .sort(sessionFirstDateCompare); 
          row.push(relatedSessions.length.toString());
          row.push(relatedSessions[0].firstDate.toString());
          if (relatedSessions.length <= 1) {
            row.push('');
          } else {
            row.push(relatedSessions[relatedSessions.length - 1].firstDate.toString());
          }
          row.push(countActivitiesUsed(relatedSessions).toString());
          row.push(totalDuration(relatedSessions));

          // The remaining columns of this report are only present when the
          // events are TeacherEdition events.
          if (mode === TEMode.teacherEditionMode) {
            columnDefs.forEach( (columnDef) => {
              switch (columnDef.tipType) {

                case 'questionWrapper':

 console.log(`>> ${teacher.id}:${module.name}:${mode} event count: ${reportableEvents.length}`)

                  console.log(`te-mode -- questionWrapper columnDef: ${JSON.stringify(columnDef,null," ")}`)

    console.log(`>>> activies:\n${JSON.stringify(module.activities,["name"],"   ")}`)

                  const tabs = getQuestionWrapperPlugins(module.activities, columnDef)

                  console.log(`genUsageReport() question wrapper tabs (${tabs.length}):\n  ${tabs.map(p=>(p.tipType + ":" + columnDef.tipSubType)).join("\n  ")}\n`)
  //                 row.push(tabs.length.toString());

  //                 if (tabs.length <= 0) {
  //                   row.push("");
  //                   row.push("");
  //                   row.push("");
  //                 } else {

  //                  // How many toggle events occurred in ths module.
  //                 const tabToggleEvents = events.filter( e => columnDef.eventMatcher.test(e.eventType));
  //                 row.push(tabToggleEvents.length.toString());

  //                 const tabsToggledAtLeastOnce = countTabsWithAToggleEvent(tabs, events);
  //                 row.push(tabsToggledAtLeastOnce.toString());

  //                 // % of tabs that were toggled at least once
  //                 row.push(((tabsToggledAtLeastOnce / tabs.length) * 100.0).toFixed(2));
  //                 }
                  break;

                // case 'windowShade':
                //   break;
                // case 'sideTip':
                //   break;
                default:
                  console.warn(`Unknown columnDef.tipType "${columnDef.tipType}"`);
                  break;
                }
            });
          }

          // All done with this row; add it to the report.
          report.push(row);
        }
      });
    });
  });


  //           // The remaining columns of this report are only present when the
  //           // events are TeacherEdition events. (That is, the mode is true.)
  //           if (mode) {
  //             columnDefs.forEach( (columnDef) => {

  //               if (columnDef.tipType === "questionWrapper") {
  //                 const tabs = getQuestionWrapperTabPlugins(module.activities, columnDef)
  //                 // console.log(`genUsageReport() question wrapper tabs (${tabs.length}):\n  ${tabs.map(p=>(p.tipType + ":" + columnDef.tipSubType)).join("\n  ")}\n`)
  //                 row.push(tabs.length.toString());

  //                 if (tabs.length <= 0) {
  //                   row.push("");
  //                   row.push("");
  //                   row.push("");
  //                 } else {

  //                  // How many toggle events occurred in ths module.
  //                 const tabToggleEvents = events.filter( e => columnDef.eventMatcher.test(e.eventType));
  //                 row.push(tabToggleEvents.length.toString());

  //                 const tabsToggledAtLeastOnce = countTabsWithAToggleEvent(tabs, events);
  //                 row.push(tabsToggledAtLeastOnce.toString());

  //                 // % of tabs that were toggled at least once
  //                 row.push(((tabsToggledAtLeastOnce / tabs.length) * 100.0).toFixed(2));
  //                 }

  //               } else if (columnDef.tipType === "windowShade") {
  //                 const tabs = getWindowShadeTabPlugins(module.activities, columnDef)
  //                 // console.log(`genUsageReport() window shade tabs (${tabs.length}):\n  ${tabs.map(p=>(p.tipType + ":" + p.windowShade.windowShadeType)).join("\n  ")}\n`)

  //                 // Total number of tabs in this module.
  //                 row.push(tabs.length.toString());

  //                 if (tabs.length === 0) {
  //                   row.push("");   // Since, no tabs, leave the next 3 columns,
  //                   row.push("");   //  . number-of-toggle, number-of-tabs-toggled-
  //                   row.push("");   //  . at-least-once, and %-of-tabs-toggled-at-
  //                 } else {          //  . least-once, all blank.

  //                 // How many toggle events occurred in ths module.
  //                 const tabToggleEvents = events.filter( e => columnDef.eventMatcher.test(e.eventType));
  //                 row.push(tabToggleEvents.length.toString());

  //                 const tabsToggledAtLeastOnce = countTabsWithAToggleEvent(tabs, events);
  //                 row.push(tabsToggledAtLeastOnce.toString());

  //                 // % of tabs that were toggled at least once
  //                 row.push(((tabsToggledAtLeastOnce / tabs.length) * 100.0).toFixed(2));
  //                 }
  //               } else if (columnDef.tipType === "sideTip") {
  //                 // Stub out actual report column until we have an example in a event log stream.
  //                 row.push("0");
  //                 row.push("");   // Since, no tabs, leave the next 3 columns,
  //                 row.push("");   //  . number-of-toggle, number-of-tabs-toggled-
  //                 row.push("");   //  . at-least-once, and %-of-tabs-toggled-at-
  //               }
  //             });
  //           }

  return convertArrayToCSV(report, {header: buildColumnNames(), separator: ','});
}
