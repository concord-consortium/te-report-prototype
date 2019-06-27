import { IReportData } from './build-report-data';
import { genUsageReport } from './gen-usage-report';

enum ReportType {
  usageReport = 'usageReport',
  sessionReport = 'sessionReport'
  // Additional report types may be added here...
}

export function queryStringToReportType(queryString: string): ReportType {
  // Explicitly maps a query string to a enum value. There is a more elegant
  // way to do this with enums, but this was easier for debugging purposes.
  switch (queryString) {
    case 'usageReport':
      return ReportType.usageReport;
    case 'sessionReport':
      return ReportType.sessionReport;
    // Additional report types may be added here...
    default:
      return undefined;
  }
}

export function getReport(reportType: ReportType, reportData: IReportData): string {
  switch (reportType) {
    case ReportType.usageReport: return genUsageReport(reportData);
    case ReportType.sessionReport: return `"Report Placeholder"\n"TE Session Report"`; // genSessionReport(reportData);
    // Additional report types may be added here...
    default: return `"Teacher Edition Report Error"\n"Unrecognized report type"`;
    }
}
