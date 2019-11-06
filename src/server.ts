import express from 'express';
import bodyParser from 'body-parser';

import { serverName, serverShortName, port } from './globals';
import { announce } from './utilities';

import { getLog } from './log-puller';
import { buildReportData } from './build-report-data';
import { queryStringToReportType, sendReport, getCVSHeader } from './report-dispatcher';

// The server application listens for a POST request for a particular report;
// fetches the indicated log-puller supplied event-log from the log-puller; uses
// this fetched data to build the report objects; and, returns the resulting
// report as a CSV formatted response.

const app = express();

app.use(bodyParser.urlencoded({ extended: true, limit: "50mb", parameterLimit: 50000 }));
app.use(bodyParser.json({ limit: "50mb" }));


// allow routes at both the root and /te-report levels for generic Fargate app deployment
const route = (path) => {
  return [path, `/te-report${path}`];
}

app.get(route('/'), (req, res) => {
  res.send(serverName);
});

app.post(route('/'), (req, res) => {

  if (!req.body.json || !req.body.signature || !req.body.portal_token) {
    // Ensure json and signature exist in req.body.
    res.status(400);
    const errMessage: string = 'Server - Missing json, signature, or token';
    res.send(errMessage);
    return;
  }

  // immediately write the headers and flush them so that Chrome starts receiving data
  const reportType = queryStringToReportType(req.query.report);
  const filename = `te-${reportType.toString().toLowerCase()}-${Date.now()}.csv`;
  res.setHeader('Content-disposition', `attachment; filename=${filename}`);
  res.flushHeaders();

  // dribble out the csv header so that Chrome doesn't timeout the download for long running queries
  const csvHeaderChars = getCVSHeader(reportType).split("");
  const dribbleCsvHeaderInterval = setInterval(() => {
    res.write(csvHeaderChars.shift() || " ");
  }, 5000);

  getLog(req.body.json, req.body.signature)
    .then((log) => {
      if (reportType === undefined) {
        throw `${serverShortName} ERROR - Undefined query parameter for reportType ${req.query.report}.`;
      } else {
        buildReportData(req.body.portal_token, log)
          .then((reportData) => {
            // write out the remaining parts of the csv header
            clearInterval(dribbleCsvHeaderInterval);
            res.write(csvHeaderChars.join("") + "\n");
            sendReport(res, reportType, reportData);
          })
      }
    })
    .catch((err) => {
      // can't set error code since we've flushed the headers already
      res.write(`\n\nERROR: ${err.toString()}`)
      res.end();
    });
});

app.listen(port, () => {
  announce(`listening on port ${port}`);
});
