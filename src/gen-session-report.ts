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
    title: "First Session Event",
    shortTitle: "First"
  },
  {
    title: "Last Session Event",
    shortTitle: "Last"
  },
  {
    title: "Total Duration for Session (d:h:m:s)",
    shortTitle: "Duration"
  },
  {
    title: "Number of Activities Used",
    shortTitle: "Activities"
  },
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

interface IRowDataSessionReport {
  teacher: ITeacher,
  module: IModule,
  teMode: TEMode,
  session: ISession,
  events: IEvent[]
} 

function extractSessionReportData(data: IReportData): IRowDataSessionReport[] {
  let rows: IRowDataSessionReport[] = [];
  data.sessions.forEach( (session) => {
    session.teachers.forEach( (teacher) => {
      session.modules.forEach( (module) => {
        [ TEMode.TeacherEditionMode, TEMode.PreviewMode ].forEach ( (mode) => {
          const rowData: IRowDataSessionReport = {
            teacher: teacher,
            module: module,
            teMode: mode,
            session: session,
            events: _.uniq(data.events.filter( e =>
              e.teacher === teacher &&
              e.module === module &&
              e.teMode == mode &&
              e.session == session).sort(eventDateCompare))
          };
          if (rowData.events.length > 0) {
            rows.push(rowData);
          }
        });
      });
    });
  });
  return rows;
}

export function genSessionReport(reportData: IReportData): string {

  let report: string[][] = [];
  const rowData = extractSessionReportData(reportData);

  rowData.forEach( (rd) => {

    let row: string[] = [];

    // Add the row's identification.
    row.push(...[ rd.teacher.id, rd.teacher.name, rd.module.name, rd.teMode ]);

    // Add the row's session information.
    const first = rd.events[0];
    const last = rd.events[rd.events.length - 1];
    const ts  = new TimeSpan(eventDateCompare(last, first)); 
    const sessionTimes = [
      first.eventDate.toString(),
      last.eventDate.toString(),
      `${ts.days}:${ts.hours}:${ts.minutes}:${ts.seconds}`
    ]
    row.push(...sessionTimes);

    // Add the activity count by counting unique activity ID's.
    const activityIDs = _.uniq(rd.events.map( e => e.activityID) );
    row.push(activityIDs.length.toString());

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
