import express from 'express';
import bodyParser from 'body-parser';

import { serverName, serverShortName, port } from './globals';
import { announce } from './utilities';

import { getLog } from './log-puller';
import { buildReportData } from './build-report-data';
import { queryStringToReportType, getReport } from './report-dispatcher';

// The server application listens for a POST request for a particular report;
// fetches the indicated log-puller supplied event-log from the log-puller; uses
// this fetched data to build the report objects; and, returns the resulting
// report as a CSV formatted response.

const app = express();

app.use(bodyParser.urlencoded({ extended: true, limit: "50mb", parameterLimit: 50000 }));
app.use(bodyParser.json({ limit: "50mb" }));

app.listen(port, () => {
  announce(`listening on port ${port}`);
});

app.get('/', (req, res) => {
  res.send(serverName);
});

app.post('/', (req, res) => {

  if (!req.body.json || !req.body.signature || !req.body.portal_token) {
    // Ensure json and signature exist in req.body.
    res.status(400);
    const errMessage: string = 'Server - Missing json, signature, or token';
    res.send(errMessage);
    return;
  }

  getLog(req.body.json, req.body.signature)
    .then((log) => {
      const reportType = queryStringToReportType(req.query.report);
      if (reportType === undefined) {
        throw `${serverShortName} ERROR - Undefined query parameter for reportType ${req.query.report}.`;
      } else {
        setHeader(res, reportType.toString());
        buildReportData(req.body.portal_token, log)
          .then((reportData) => {
            res.send(getReport(reportType, reportData));
          })
      }
    })
    .catch((err) => {
      res.status(500);
      res.send(err.toString())
    });

});

function setHeader(res: any, fileName: string) {
  // Always respond with a csv file.
  res.setHeader('Content-disposition', 'attachment; filename=te-' +
    fileName.toLowerCase() + '-' + Date.now() + '.csv');
};
