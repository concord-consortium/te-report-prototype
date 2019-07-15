import * as _ from 'lodash';
import { convertArrayToCSV } from 'convert-array-to-csv';
import { TimeSpan } from 'timespan';

import { eventDateCompare } from './utilities';

import {
  IReportData,
  IEvent,
  IModule,
  ITeacher,
  TEMode,
  ISession,
  IQuestionWrapper,
  PluginType
} from './report-data-types';

import {IColumnName, columnDefs, subColumns, QuestionWrapperDiscriminator } from './common-column-defs';

const columnNames: IColumnName[] = [
  {
    title: "User ID",
    shortTitle: "ID"
  },
  {
    title: "Teacher Name",
    shortTitle: "Name"
  },
  {
    title: "TE Module Name",
    shortTitle: "Module"
  },
  {
    title: "Mode - TE or Preview",
    shortTitle: "Mode"
  },
  {
    title: "Number of Sessions Launched",
    shortTitle: "Sessions"
  },
  {
    title: "Time of First Session's Launch",
    shortTitle: "First Launch"
  },
  {
    title: "Time of Last Session's Launch",
    shortTitle: "Last Launch"
  },
  {
    title: "Number of Activities Used",
    shortTitle: "Activities"
  },
  {
    title: "Total Duration for Module (d:h:m:s)",
    shortTitle: "Duration"
  }
];

function buildColumnNames(): string[] {
  let names: string[] = columnNames.map(colName => colName.title);
  columnDefs.forEach( (column) => {
    subColumns.forEach( (subColumn) => {
      names.push(`${column.title}: ${subColumn.title}`);
    });
  });
  return names;
}

interface IRowDataModuleReport {
  teacher: ITeacher,
  module: IModule,
  teMode: TEMode,
  events: IEvent[]
} 

function extractModuleReportData(data: IReportData): IRowDataModuleReport[] {
  let rows: IRowDataModuleReport[] = [];
  data.teachers.forEach( (teacher) => {
    teacher.modules.forEach( (module) => {
      [ TEMode.TeacherEditionMode, TEMode.PreviewMode ].forEach ( (mode) => {
        const rowData: IRowDataModuleReport = {
          teacher: teacher,
          module: module,
          teMode: mode,
          events: _.uniq(data.events.filter( e =>
            e.teacher === teacher &&
            e.module === module &&
            e.teMode == mode)
          )
        };
        if (rowData.events.length > 0) {
          rows.push(rowData);
        }
      });
    });
  });
  return rows;
}

function countActivitiesUsed(sessions: ISession[]): number {
  // The easiest way to count the number of activities in a list of sessions
  // is to count the number of unique activity ID's.
  const activityIDs: string[] =
    _.uniq(_.flatten(sessions.map( s => s.events)).map( e => e.activityID));
  return activityIDs.length;
}

function totalDuration(sessions: ISession[]): string {
  // The total duration is the span between the earliest and latest events of
  // all the sessions.
  const events = _.flatten(sessions.map( s => s.events )).sort(eventDateCompare);
  const ts = new TimeSpan(eventDateCompare(events[events.length - 1], events[0]));
  return `${ts.days}:${ts.hours}:${ts.minutes}:${ts.seconds}`;
}

export function genUsageReport(reportData: IReportData): string {

  let report: string[][] = [];
  const rowData = extractModuleReportData(reportData);

  rowData.forEach( (rd) => {

    let row: string[] = [];

    // Add the row's identification.
    row.push(...[ rd.teacher.id, rd.teacher.name, rd.module.name, rd.teMode ]);

    // Get a list of the sessions in this row and the session time data.
    const thisRowsSessions = _.uniq(rd.events.map( e => e.session))
      .sort((s1, s2) => eventDateCompare(s1.events[0], s2.events[0]));
    const numSessions = thisRowsSessions.length;
    const firstLaunch = thisRowsSessions[0].firstDate;
    const lastLaunch = (numSessions <= 1) ? "" : thisRowsSessions[numSessions - 1].firstDate;
    const activitiesUsed = countActivitiesUsed(thisRowsSessions);
    const duration = totalDuration(thisRowsSessions);
    const sessionData = [ numSessions, firstLaunch, lastLaunch, activitiesUsed, duration ];
    row.push(...sessionData.map(d => d.toString()));

    // Skip remaining columns, if this is a preview.
    if (rd.teMode === TEMode.TeacherEditionMode) {

      // The rest of the row are in groups of 4 columns, based on each type of
      // teacher-edition plugin. A columnDef defines the kinds of events that we
      // are to be treated in these 4 columns.

      columnDefs.forEach( (columnDef) => {
        // Extract events related to this row and this set of 4 columns.
        let colEvents = rd.events.filter( e => columnDef.eventMatcher.test(e.eventType) );
        if (columnDef.eventSubType !== undefined) {
          colEvents = colEvents.filter( e => e.eventSubType === columnDef.eventSubType);
        }

        // Make a list of TE plugins are available in this module and that match
        // the kind of plug-in for these 4 columns.
        const tePluginsInModule =
          _.uniq(_.flatten(rd.module.activities.map(a => a.plugins)))
          .filter( (p) => {
            if (p.pluginType !== columnDef.pluginType) {
              return false;
            }
            
            switch (columnDef.pluginType) {
              case PluginType.QuestionWrapper:
                if (p.pluginDef === undefined) {
                  return false;
                }
                switch (columnDef.pluginSubType) {
                  case QuestionWrapperDiscriminator.correctExplanation:
                    return ((p.pluginDef as IQuestionWrapper).isCorrectExplanation);
                  case QuestionWrapperDiscriminator.distractorsExplanation:
                    return ((p.pluginDef as IQuestionWrapper).isDistractorsExplanation);
                  case QuestionWrapperDiscriminator.exemplar:
                    return ((p.pluginDef as IQuestionWrapper).isExemplar);
                  case QuestionWrapperDiscriminator.teacherTip:
                    return ((p.pluginDef as IQuestionWrapper).isTeacherTip);
                  default:
                    // Probably should throw an exception.
                    return false;
                }
              case PluginType.WindowShade:
                return ((p.pluginDef !== undefined) && (p.pluginDef === columnDef.pluginSubType));
              case PluginType.SideTip:
                return (p.pluginDef === undefined);  // Yes, it ought to be undefined!
              default:
                return false;
            }
        });

        if (tePluginsInModule.length === 0) {
          row.push(...["0", "", "", ""]);  // Nothing to report in this column.
        } else {
          // The first sub-column is the number of te-plugins of this column's type.
          row.push(tePluginsInModule.length.toString());
          // Next, is the total number of toggle events.
          row.push(colEvents.length.toString());
          // Next is the number of our plugins that were toggled. One way to
          // compute this is to look for all the column events and only map out
          // the plugin that caused it. Then reduce that to the unique number.
          const pluginsToggled = _.uniq(colEvents.map(e=>e.plugin));
          row.push(pluginsToggled.length.toString());
          // And... the same as the last value, but expressed as a percentage of
          // all the tabs.
          const percent = Math.round((pluginsToggled.length / tePluginsInModule.length) * 100);
          row.push(percent.toString());
        }
       });
      }
    report.push(row);
  });

  return convertArrayToCSV(report, {header: buildColumnNames(), separator: ','});
}















// import * as _ from 'lodash';
// import { convertArrayToCSV } from 'convert-array-to-csv';
// import { TimeSpan } from 'timespan';

// import { eventDateCompare, sessionFirstDateCompare } from './utilities';
// import {
//   IReportData,
//   IEvent,
//   IModule,
//   ITeacher,
//   TEMode,
//   ISession,
//   IActivity,
//   IPlugin,
//   PluginType,
//   QuestionWrapperType,
//   WindowShadeType,
//   SideTipType
// } from './build-report-data';

// type ColumnName  = {
//   title: string,
//   shortTitle: string
// }

// const columnNames: ColumnName[] = [
//   {
//     title: "User ID",
//     shortTitle: "ID"
//   },
//   {
//     title: "Teacher Name",
//     shortTitle: "Name"
//   },
//   {
//     title: "TE Module Name",
//     shortTitle: "Module"
//   },
//   {
//     title: "Mode - TE or Preview",
//     shortTitle: "Mode"
//   },
//   {
//     title: "Number of Sessions Launched",
//     shortTitle: "Sessions"
//   },
//   {
//     title: "Time of First Session's Launch",
//     shortTitle: "First Launch"
//   },
//   {
//     title: "Time of Last Session's Launch",
//     shortTitle: "Last Launch"
//   },
//   {
//     title: "Number of Activities Used",
//     shortTitle: "Activities"
//   },
//   {
//     title: "Total Duration for Module (d:h:m:s)",
//     shortTitle: "Duration"
//   },
// ];

// interface IColumnDef {
//   title: string,
//   shortTitle: string,
//   pluginType: PluginType,
//   pluginSubType: QuestionWrapperType | WindowShadeType | SideTipType,
//   eventMatcher: RegExp
// }

// const columnDefs: IColumnDef[] = [
//   {
//     title: "Question Wrapper - Correct Tab",
//     shortTitle: "QW-C",
//     pluginType: PluginType.QuestionWrapper,
//     pluginSubType: QuestionWrapperType.CorrectExplanation,
//     eventMatcher: /TeacherEdition-windowShade-questionWrapper Tab(Opened|Closed)/
//   },
//   {
//     title: "Question Wrapper - Distractors Tab",
//     shortTitle: "QW-D",
//     pluginType: PluginType.QuestionWrapper,
//     pluginSubType: QuestionWrapperType.DistractorsExplanation,
//     eventMatcher: /TeacherEdition-windowShade-questionWrapper Tab(Opened|Closed)/
//   },
//   {
//     title: "Question Wrapper - Teacher Tip Tab",
//     shortTitle: "QW-T",
//     pluginType: PluginType.QuestionWrapper,
//     pluginSubType: QuestionWrapperType.TeacherTip,
//     eventMatcher: /TeacherEdition-windowShade-questionWrapper Tab(Opened|Closed)/
//   },
//   {
//     title: "Question Wrapper - Exemplar Tab",
//     shortTitle: "QW-E",
//     pluginType: PluginType.QuestionWrapper,
//     pluginSubType: QuestionWrapperType.Exemplar,
//     eventMatcher: /TeacherEdition-windowShade-questionWrapper Tab(Opened|Closed)/
//   },
//   {
//     title: "Window Shade - Teacher Tip",
//     shortTitle: "WS-TT",
//     pluginType: PluginType.WindowShade,
//     pluginSubType: WindowShadeType.TeacherTip,
//     eventMatcher: /TeacherEdition-windowShade-TeacherTip Tab(Opened|Closed)/
//   },
//   {
//     title: "Window Shade - Theory & Background",
//     shortTitle: "WS-TB",
//     pluginType: PluginType.WindowShade,
//     pluginSubType: WindowShadeType.TheoryAndBackground,
//     eventMatcher: /TeacherEdition-windowShade-TheoryAndBackground Tab(Opened|Closed)/
//   },
//   {
//     title: "Window Shade - Discussion Points",
//     shortTitle: "WS-DP",
//     pluginType: PluginType.WindowShade,
//     pluginSubType: WindowShadeType.DiscussionPoints,
//     eventMatcher: /TeacherEdition-windowShade-DiscussionPoints Tab(Opened|Closed)/
//   },
//   {
//     title: "Window Shade - Digging Deeper",
//     shortTitle: "WS-DD",
//     pluginType: PluginType.WindowShade,
//     pluginSubType: WindowShadeType.DiggingDeeper,
//     eventMatcher: /TeacherEdition-windowShade-DiggingDeeper Tab(Opened|Closed)/
//   },
//   {
//     title: "Side Tip",
//     shortTitle: "ST",
//     pluginType: PluginType.SideTip,
//     pluginSubType: SideTipType.Default,
//     eventMatcher: /TeacherEdition-windowShade-DiggingDeeper Tab(Opened|Closed)/
//   }
// ];

// const subColumns: ColumnName[] = [
//   {
//     title: "Number of Tabs in Module",
//     shortTitle: "Tabs",
//   },
//   {
//     title: "Total Number of Toggles",
//     shortTitle: "Toggles",
//   },
//   {
//     title: "Number of Tabs Toggled at Least Once",
//     shortTitle: "Toggled",
//   },
//   {
//     title: "% of Tabs Toggled at least Once",
//     shortTitle: "%"
//   },
// ];

// function buildColumnNames(): string[] {
//   let names: string[] = columnNames.map(colName => colName.title);
//   columnDefs.forEach( (column) => {
//     subColumns.forEach( (subColumn) => {
//       names.push(`${column.shortTitle}: ${subColumn.title}`);
//     });
//   });
//   return names;
// }

// function getReportableEvents(teacher: ITeacher, module: IModule, mode: TEMode): IEvent[] {
//   // Returns a list of only those events pertaining to a particular teacher,
//   // module, and mode (teacher-edition or preview). The events are ordered by
//   // their dates.
//   const events = teacher
//     .events.filter( e => (e.module === module) && (e.teMode === mode))
//     .sort(eventDateCompare);
//   console.log(`      reportableEvents: ${events.length}`);
//   return events;
// }


// function getReportableSessions(events: IEvent[]): ISession[] {
//   // Returns a list of sessions where each sessions are referenced by the
//   // given list of events. The sessions are ordered by the date of their
//   // first associated event.
//   const sessions = _.uniq(events.map( e => e.session ))
//     .sort( (s1, s2) => eventDateCompare(s1.events[0], s2.events[0]));
//   console.log(`      reportableSessions: ${sessions.length}`);
//   return sessions;
// }

// function countActivitiesUsed(sessions: ISession[]): number {
//   // The easiest way to count the number of activities in a list of sessions
//   // is to count the number of unique activity ID's.
//   const activityIDs: string[] =
//     _.uniq(_.flatten(sessions.map( s => s.events)).map( e => e.activityID));
//   return activityIDs.length;
// }

// function totalDuration(sessions: ISession[]): string {
//   // The total duration is the span between the earliest and latest events of
//   // all the sessions.
//   const events = _.flatten(sessions.map( s => s.events )).sort(eventDateCompare);
//   const ts = new TimeSpan(eventDateCompare(events[events.length - 1], events[0]));
//   return `${ts.days}:${ts.hours}:${ts.minutes}:${ts.seconds}`;
// }

// function getReportablePlugins(events: IEvent[]): IPlugin[] {
//   // Given a list of events, return a list of all the plugins referenced by all
//   // the activities referenced by those events.
//   const activities = _.flatten(events.map(e => e.module.activities));
//   const plugins = _.uniq(_.flatten(activities.map(a => a.plugins)));
//   return plugins; 
// }

// function selectTabs(plugins: IPlugin[], colDef: IColumnDef): IPlugin[] {
//   // Given a list of tab/plugins and a colDef that specifies a plugin's type
//   // and sub-type, return only those tabs that match.
//   const tabs = plugins.filter(p => p.pluginType === colDef.pluginType &&
//     p.pluginSubType === colDef.pluginSubType);
//   return tabs;
// }

// function getTabToggleEvents(events: IEvent[], matcher: RegExp): IEvent[] {
//   const toggles = events.filter( e => matcher.test(e.eventType))
//   return toggles;
// }

// function getTabsToggledAtLeastOnce(tabs: IPlugin[], events: IEvent[]): IPlugin[] {
//   // Given a list of tabs (that have been toggled), and a list events (that are
//   // reportable), return a list of just those tabs that were referenced in the
//   // reportable events.
//   const activities: IActivity[] = _.uniq(_.flatten(events.map( e => e.module.activities )));
//   const eventPlugins: IPlugin[] = _.uniq(_.flatten(activities.map( a => a.plugins )));
//   const eventTabs = tabs.filter( t => eventPlugins.find(p => p === t));
//   return _.uniq(eventTabs);
// }


// export function genUsageReport(reportData: IReportData): string {

//   // Build up the report as an array of rows where each row is an array of cells.
//   let report: string[][] = [];

//   // Each row of this report represents data for an ordered-triple of (teacher,
//   // module, mode).
//   reportData.teachers.forEach( (teacher) => {
//     console.log(`teacher: ${teacher.name} (${teacher.id})`);
//     teacher.modules.forEach( (module) => {
//       console.log(`  module: ${module.name} (${module.externalID})`);
//       [TEMode.TeacherEditionMode, TEMode.PreviewMode].forEach( (mode) => {
//         console.log(`    mode: ${mode.toString()}`);

//         // For each (teacher, module, mode) triple, fetch the reportable events
//         // associated with only that triple.
//         const reportableEvents = getReportableEvents(teacher, module, mode);

//         // Only add a row to the report, if we have some events to report on.
//         if (reportableEvents.length > 0) {
//           let row: string[] = [];

//           // Identify this row.
//           row.push(...[ teacher.id, teacher.name, module.name, mode ]);
//           console.log(`        row id: "${row.join('", "')}"`);

//           // Add session oriented data.
//           const reportableSessions = getReportableSessions(reportableEvents);

//           const numSessions = reportableSessions.length;
//           const firstLaunch = reportableSessions[0].firstDate;
//           const lastLaunch = (numSessions <= 1) ? "" : reportableSessions[numSessions - 1].firstDate;
//           const activitiesUsed = countActivitiesUsed(reportableSessions);
//           const duration = totalDuration(reportableSessions);
//           const sessionData = [ numSessions, firstLaunch, lastLaunch, activitiesUsed, duration ];
//           row.push(...sessionData.map(d => d.toString()));
//           console.log(`        sessionData: "${sessionData.join('", "')}"`);

//           // If the mode is "preview", the row is done; however, if this is a
//           // "teacher edition" mode, we have a bunch more columns to add to the
//           // report.
//           if (mode === TEMode.TeacherEditionMode) {

//             // Build a list of all the plug-ins (where each is called a tab in
//             // in the report) related to the events in this row.
//             const plugins = getReportablePlugins(reportableEvents);
//             console.log(`      reportablePlugins: ${plugins.length}`);

//             // From this point on, a set of 4 columns is reported for each type
//             // of tab/plugin.
//             columnDefs.forEach( (columnDef) => {

//               const tabs = selectTabs(plugins, columnDef);
//               const tabToggleEvents = getTabToggleEvents(reportableEvents, columnDef.eventMatcher);

//               const numTabs = tabs.length;
//               const numToggles = tabToggleEvents.length;
//               const numTabsToggled = getTabsToggledAtLeastOnce(tabs, tabToggleEvents).length;
//               const percentToggled = (numTabs <= 0) ? 0 : ((numTabsToggled / numTabs) * 100);

//               const tabData = [
//                 numTabs,
//                 (numTabs <= 0) ? "" : numToggles,
//                 (numToggles <= 0) ? "" : numTabsToggled,
//                 (numToggles <= 0) ? "" : percentToggled
//               ];
//               row.push(...tabData.map(d => d.toString()));
//               console.log(`        tabData ${columnDef.shortTitle}: "${tabData.join('", "')}"`);

//             });
//           }

//           report.push(row);
//         }
//       });
//     });
//   });

//   return convertArrayToCSV(report, {header: buildColumnNames(), separator: ','});
// }
