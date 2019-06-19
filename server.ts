import express from 'express';
import bodyParser from 'body-parser';
import { ReportType, getCSVString, getLogs } from './main';

const PORT = process.env.PORT || 3000;
const app = express();

app.use(bodyParser.urlencoded({extended: true, limit: "50mb", parameterLimit:50000}));
app.use(bodyParser.json({limit: "50mb"}));

app.get('/', (req, res) => {
  res.send('Teacher Edition Report -- test 3');
});

app.post('/', (req, res) => {
  // res.send(`<html><body><div>POST params:</div><div><pre>${JSON.stringify(req.body, null, 2)}</pre></div></body></html>`);

  const setHeader = (fileName: string): void => {
  // Might make sense to look at req.body.format === "csv" to see what format
  // was requested, but for now, we won't grab that from the form (since it
  // isn't IN the form, just yet). So, for right now, we just assume it's a csv.
  res.setHeader('Content-disposition', 'attachment; filename=te-' +
    fileName.toLowerCase() + '-' + Date.now() + '.csv');
  }

  const mapQueryToReportType = (queryString: string): ReportType => {
    switch (queryString) {
      case 'usageReport': return ReportType.usageReport;
      case 'sessionReport': return ReportType.sessionReport;
      case 'drillDownReport': return ReportType.drillDownReport;
      case 'moduleReport': return ReportType.moduleReport;
      default: return undefined;
    }
  }

  // ensure json and signature exist in req.body
  if (!req.body.json || !req.body.signature) {
    res.status(400);
    res.send("Missing json or signature parameter!");
    return;
  }

  getLogs(req.body.json, req.body.signature)
    .then((logs) => {
      // TODO: do something with the logs...
      console.log("Got logs:");
      console.log(logs);

      const reportType = mapQueryToReportType(req.query.report);

      if (reportType !== undefined) {
        setHeader(reportType.toString());
        res.send(getCSVString(reportType));
      } else {
        throw `Teacher Edition Report: Unrecognized query parameter for report type ${req.query.report}.`
      }

    })
    .catch((err) => {
      res.status(500);
      res.send(err.toString())
    })
});

app.listen(PORT, () => {
  console.log(`Teacher Edition Report server listening on port ${PORT}.`)
});