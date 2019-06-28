import { IReportData } from './build-report-data';
import { genUsageReport } from './gen-usage-report';

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
      console.warn(`Warning: unrecognized query string parameter "${queryString}"`)
      return undefined;
  }
}

export function getReport(reportType: ReportType, reportData: IReportData): string {
  switch (reportType) {
    case ReportType.UsageReport:
      return genUsageReport(reportData);
    case ReportType.SessionReport:
      return `"Report Placeholder"\n"TE Session Report"`; // genSessionReport(reportData);
    default:
      return `"Teacher Edition Report Error"\n"Unrecognized report type"`;
    }
}
