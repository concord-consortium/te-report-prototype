import express from 'express';
import bodyParser from 'body-parser';
import { getLog } from './log-puller';
import { buildReportData } from './build-report-data';
import { queryStringToReportType, getReport } from './report-dispatcher';

// This server application listens for a POST request for a particular report;
// fetches the indicated log-puller supplied event-log from the log-puller; and
// sends the resulting report as a CSV formatted response.

const PORT = process.env.PORT || 3000;
const app = express();

app.use(bodyParser.urlencoded({extended: true, limit: "50mb", parameterLimit:50000}));
app.use(bodyParser.json({limit: "50mb"}));

app.listen(PORT, () => {
  console.log(`Server - listening on port ${PORT}.`)
});

app.get('/', (req, res) => {
  res.send('Teacher Edition Report Server');
});

app.post('/', (req, res) => {

  if (!req.body.json || !req.body.signature) {
    // Ensure json and signature exist in req.body.
    res.status(400);
    const errMessage: string = 'Server - Missing json or signature parameter';
    res.send(errMessage);
    return;
  }

  getLog(req.body.json, req.body.signature)
    .then((log) => {
      console.log(`Server - ${log.length} events fetched from log-puller`)
      const reportType = queryStringToReportType(req.query.report);
      if (reportType === undefined) {
        throw `Server ERROR - Undefined query parameter for reportType ${req.query.report}.`;
      } else {
        console.log(`Server - ${reportType.toString()} report requested`);
        setHeader(res, reportType.toString());
        buildReportData(log)
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

function setHeader(res:any, fileName: string) {
  // Always respond with a csv file.
  res.setHeader('Content-disposition', 'attachment; filename=te-' +
    fileName.toLowerCase() + '-' + Date.now() + '.csv');
};
