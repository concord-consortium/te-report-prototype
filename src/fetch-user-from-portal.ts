import * as superagent from 'superagent';
import { parseString } from 'xml2js';

import { portalServer } from './globals';
import { warn, announce } from './utilities';

// Fetches a user name from the Portal given an id-string, as supplied in a
// log event.

const notAllowedUserName = 'Not allowed';

export function fetchUserFromPortal(portalToken: string, id: string): Promise<string> {
  const userId = /(^.+)@/.exec(id);
  if (userId === null || userId === undefined) {
    return Promise.resolve('');  // Unrecognized user-id format? Return empty string.
  }
  return new Promise<string>((resolve, reject) => {
    const url = `https://${portalServer}/users/${userId[1]}.xml`;
    getPortalUser(portalToken, url)
      .then((userXML) => {
        resolve(parseName(userXML));
      })
      .catch((err) => {
        warn(`Error from getPortal User: ${JSON.stringify(err)}`);
        Promise.resolve(notAllowedUserName);
      });
  });
}

function getPortalUser(portalToken: string, url: string): Promise<any> {
  return new Promise<string>((resolve, reject) => {
    announce(`getPortalUser: GET ${url}`)
    superagent
      .get(url)
      .set("Authorization", `Bearer/JWT ${portalToken}`)
      .then((response) => {
        announce(`getPortalUser: GOT ${url} (status: ${response.status})`)
        if (response.status === 200) {
          const xml = (response.body as Buffer).toString();
          resolve(xml)
        } else {
          reject(new Error(`Unable to get portal user: GET ${url} returned ${response.status}`));
        }
      })
      .catch((err) => {
        warn(`Error from getPortalUser, err: ${JSON.stringify(err)}`);
        reject(err);
      });
  });
}

function parseName(xml): string {
  var userName = '';
  parseString(xml, (err, res) => {
    if (err !== null) {
      // Here, if we had a problem parsing the XML. Let's issue a warning to
      // the console, but we will carry on as if the user didn't have permission
      // to see the name.
      warn(`Error parsing XML for user, not allowed returned. err = ${err}`)
      userName = notAllowedUserName;
    } else {
      userName = `${res.user['first-name'][0]} ${res.user['last-name'][0]}`;
    }
  });
  return userName;
}
