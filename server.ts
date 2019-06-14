import express from 'express';
import bodyParser from 'body-parser';

const PORT = process.env.PORT || 3000;
const app = express();

app.use(bodyParser.urlencoded({extended: true, limit: "50mb", parameterLimit:50000}));
app.use(bodyParser.json({limit: "50mb"}));

app.get('/', (req, res) => {
  res.send('Teacher Edition Report');
});

app.post('/', (req, res) => {
  // DAVE TODO: import report from main module and pass request parameters to it along with response (so you can stream the output)
  // for now just output the post parameters to ensure you are getting them from the user report
  res.send(`<html><body><div>POST params:</div><div><pre>${JSON.stringify(req.body, null, 2)}</pre></div></body></html>`);
});

app.listen(PORT, () => {
  console.log(`Teacher Edition Report server listening on port ${PORT}.`)
});