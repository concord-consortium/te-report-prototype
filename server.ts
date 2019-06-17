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

  // Might make sense to look at req.body.format === "csv" to see what format we want, but for now, we won't grab that
  // from the form, for right now, and just assume it's a csv output.
  res.setHeader('Content-disposition', 'attachment; filename="te-usage-report-' + Date.now() + '.csv');

  if (req.query.report === 'no such thing') {
    res.send("A,B\n1,2");
  } else if (req.query.report === 'usageReport') {
    res.send(getCSVString());
  } else if (req.query.report === 'sessionReport') {
    res.send("s1,t2,u3\nzyzzy,42,inconceivable");
  } else {
    console.log(`Teacher Edition Report unrecognized query parameter for report type ${req.query.report}.`)
  }

});

app.listen(PORT, () => {
  console.log(`Teacher Edition Report server listening on port ${PORT}.`)
});