import * as superagent from "superagent";

// Fetches a module (either a sequence or an activity) from Lara, based on the
// "activity ID" found in a log event.
//
// At the moment, this has a hard-coded URL for the server AND a hard-coded
// api-token. This information should be moved out of the code base and into
// the server's environment. Not much of a problem right now, as we are only
// hitting staging, and the api-token is only valid on staging. But this really
// needs to be addressed before running against production.

export function fetchModuleFromLara(activityType: string, activityID: string): Promise<any> {
  return new Promise<any>((resolve, reject) => {
    const typeString = (activityType == 'sequence') ? 'sequences' : 'activities';
    const url = `https://authoring.staging.concord.org/${typeString}/${activityID}/export.json`;
    const apiToken = 'fa6112ea-a728-4677-ae46-23aa3c78a032';
    // console.log(`    fetchModuleFromLara(${activityType}:${activityID})`)
    getLaraModule(url, apiToken)
      .then( (module) => {
        resolve(module);
      }, reject)
  })
}

function getLaraModule(url: string, apiToken: string): Promise<any> {
  // console.log(`      getLaraModule() - url: ${url}`);
  return new Promise<any>((resolve, reject) => {
    superagent
      .get(url)
      .set('Authorization', 'Bearer ' + apiToken)
      .then((response) => {
        resolve(response.body)
        }, reject)
  });
}
