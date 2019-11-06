import express from 'express';
import { warn } from './utilities';

import { IReportData } from './report-data-types';
import { sendUsageReport, usageReportColumnNames } from './gen-usage-report';
import { sendSessionReport, sessionReportColumnNames } from './gen-session-report';
import { unparse } from 'papaparse';

enum ReportType {
  UsageReport = 'usageReport',
  SessionReport = 'sessionReport'
}

export function queryStringToReportType(queryString: string): ReportType {
  // Explicitly maps a query string to a enum value. There is a more elegant
  // way to do this with enums, but this was easier for debugging purposes.
  switch (queryString) {
    case 'usageReport':
      return ReportType.UsageReport;
    case 'sessionReport':
      return ReportType.SessionReport;
    default:
      warn(`Unrecognized query string parameter "${queryString}"`)
      return undefined;
  }
}

export function sendReport(res: express.Response, reportType: ReportType, reportData: IReportData) {
  switch (reportType) {
    case ReportType.UsageReport:
      return sendUsageReport(res, reportData);
    case ReportType.SessionReport:
      return sendSessionReport(res, reportData);
    default:
      throw `"Teacher Edition Report Error"\n"Unrecognized report type"`;
    }
}

export function getCVSHeader(reportType: ReportType) {
  let columnNames: string[] = [];
  switch (reportType) {
    case ReportType.UsageReport:
      columnNames = usageReportColumnNames();
      break;
    case ReportType.SessionReport:
      columnNames = sessionReportColumnNames();
      break;
    default:
      throw `"Teacher Edition Report Error"\n"Unrecognized report type"`;
  }
  return unparse({fields: columnNames, data: []}).replace("\n", "");
}
