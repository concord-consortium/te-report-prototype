import { warn } from './utilities';

import { IReportData } from './report-data-types';
import { genUsageReport } from './gen-usage-report';
import { genSessionReport } from './gen-session-report';

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

export function getReport(reportType: ReportType, reportData: IReportData): string {
  switch (reportType) {
    case ReportType.UsageReport:
      return genUsageReport(reportData);
    case ReportType.SessionReport:
      return genSessionReport(reportData);
    default:
      throw `"Teacher Edition Report Error"\n"Unrecognized report type"`;
    }
}
