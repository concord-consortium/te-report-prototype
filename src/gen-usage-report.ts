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
