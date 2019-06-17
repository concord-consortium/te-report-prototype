import express from 'express';
import bodyParser from 'body-parser';
import { getCSVString } from './main';

const PORT = process.env.PORT || 3000;
const app = express();

app.use(bodyParser.urlencoded({extended: true, limit: "50mb", parameterLimit:50000}));
app.use(bodyParser.json({limit: "50mb"}));

app.get('/', (req, res) => {
  res.send('Teacher Edition Report -- test 1');
});

app.post('/', (req, res) => {
  // res.send(`<html><body><div>POST params:</div><div><pre>${JSON.stringify(req.body, null, 2)}</pre></div></body></html>`);

  // Might make sense to look at req.body.format === "csv" to see what format
  // we want, but for now, we won't grab that from the form, for right now, and
  // just assume it's a csv output.

  if (req.query.report === 'no such thing') {
    res.setHeader('Content-disposition', 'attachment; filename="te-usage-report-' + Date.now() + '.csv');
    res.send("Column-Header\nNo Such Report");
  } else if (req.query.report === 'usageReport') {
    res.setHeader('Content-disposition', 'attachment; filename="te-usage-report-' + Date.now() + '.csv');
    res.send(getCSVString());
  } else if (req.query.report === 'sessionReport') {
    res.setHeader('Content-disposition', 'attachment; filename="te-session-report-' + Date.now() + '.csv');
    res.send("place-holder:\n\"session report\"");
  } else if (req.query.report === 'drillDownReport') {
    res.setHeader('Content-disposition', 'attachment; filename="te-drill-down-report-' + Date.now() + '.csv');
    res.send("place-holder:\n\"drill down report\"");
  } else if (req.query.report === 'moduleReport') {
    res.setHeader('Content-disposition', 'attachment; filename="te-module-report-' + Date.now() + '.csv');
    res.send("place-holder:\n\"module report\"");
  } else {
    console.log(`Teacher Edition Report unrecognized query parameter for report type ${req.query.report}.`)
  }

});

app.listen(PORT, () => {
  console.log(`Teacher Edition Report server listening on port ${PORT}.`)
});