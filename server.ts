import express from 'express';
import bodyParser from 'body-parser';

const PORT = process.env.PORT || 3000;
const app = express();

app.use(bodyParser.urlencoded({extended: true, limit: "50mb", parameterLimit:50000}));
app.use(bodyParser.json({limit: "50mb"}));

app.get('/', (req, res) => {
  res.send('Teacher Edition Report -- test 1');
});

app.post('/', (req, res) => {
  // DAVE TODO: import report from main module and pass request parameters to it along with response (so you can stream the output)
  // for now just output the post parameters to ensure you are getting them from the user report
  // Might make sense to look at req.body.format === "csv" to see what format we want, but for now, we won't grab that
  // from the form and just assume it's a csv output.
  res.setHeader('Content-disposition', 'attachment; filename="portal-report-' + Date.now() + '.csv');
  res.sent("col1,col2\n43,1234");
  // res.send(`<html><body><div>POST params:</div><div><pre>${JSON.stringify(req.body, null, 2)}</pre></div></body></html>`);
});

app.listen(PORT, () => {
  console.log(`Teacher Edition Report server listening on port ${PORT}.`)
});