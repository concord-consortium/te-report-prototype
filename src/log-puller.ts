import * as superagent from "superagent";

export interface ILogPullerEvent {
  id: number;
  session: string;
  username: string;
  application: string;
  activity: string;
  event: string;
  time: string;
  parameters: object;
  extras: any;
  event_value: string|null;
  run_remote_endpoint: string|null;
}

interface ILogPullerUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
}

interface ILogPullerRunnable {
  id: number;
  url: string;
  browse_url: string;
  name: string;
  source_type: string;
}

interface ILogPullerJSON {
  type: "users";
  version: "1.0";
  domain: string; // eg learn.staging.concord.org
  users: ILogPullerUser[];
  runnables: ILogPullerRunnable[],
  start_date: string; // eg 06/01/2019
  end_date: string; // eg 06/07/2019
}

export function getLog(requestJSON: string, signature: string): Promise<ILogPullerEvent[]> {
  return new Promise<ILogPullerEvent[]>((resolve, reject) => {
    try {
      // Use log-puller staging for everything except requests from learn production.
      const parsedJSON = JSON.parse(requestJSON) as ILogPullerJSON;
      const viaProduction = ["learn.concord.org", "learn-report.concord.org"].indexOf(parsedJSON.domain) !== -1;
      const url = `https://${viaProduction ? "log-puller" : "log-puller-staging"}.herokuapp.com/portal-report`;
      superagent
        .post(url)
        .type('form')
        .send({json: requestJSON})
        .send({signature})
        .send({format: 'json'})
        .send({explode: 'no'})
        .send({download: 'Download Logs'})
        .then((response) => {
          resolve(response.body)
        }, reject);
    }
    catch (e) {
      reject(e);
    }
  });
}
