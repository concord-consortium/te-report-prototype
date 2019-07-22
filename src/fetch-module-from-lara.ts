import * as superagent from "superagent";

import { laraServer, apiToken } from './globals';
import { warn } from './utilities';

// Fetches a module (either a sequence or an activity) from Lara, based on the
// "activity ID" found in a log event.

export function fetchModuleFromLara(activityType: string, activityID: string): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    if (apiToken === undefined) {
      warn('AUTHORING_API_KEY undefined - perhaps a server configuration issue?');
    }
    const typeString = (activityType == 'sequence') ? 'sequences' : 'activities';
    const url = `https://${laraServer}/${typeString}/${activityID}/export.json`;
    getLaraModule(url, apiToken)
      .then((module) => {
        resolve(module);
      }, reject)
  })
}

function getLaraModule(url: string, apiToken: string): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    superagent
      .get(url)
      .set('Authorization', 'Bearer ' + apiToken)
      .then((response) => {
        resolve(response.body)
      }, reject)
  });
}
