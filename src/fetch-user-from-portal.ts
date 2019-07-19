// This is a temporary mock service that simulates fetching the user name info
// from the portal, given a particular user identifier, as provided by an event
// from the log-puller. What we do here is simply map the incoming ID to a user
// name and return it. If we don't recognize the input, we return a string of
// "Not available" as the user's name.
//
// This will be replaced with a function that fetches the user information with
// something like: "learn.staging.concord.org/users/${id}.xml", with the
// appropriate credentials, of course.

interface IName {
  id: string,
  name: string
}

const sampleUserXML =
'<user> \
  <asked-age type="boolean">false</asked-age> \
  <created-at type="datetime">2018-12-03T18:08:18Z</created-at> \
  <default-user type="boolean">false</default-user> \
  <deleted-at type="datetime" nil="true"/> \
  <email>dlove@concord.org</email> \
  <email-subscribed type="boolean">true</email-subscribed> \
  <external-id nil="true"/> \
  <first-name>Dave</first-name> \
  <have-consent type="boolean">false</have-consent> \
  <id type="integer">4792</id> \
  <last-name>Love</last-name> \
  <login>DLoveT</login> \
  <of-consenting-age type="boolean">false</of-consenting-age> \
  <require-password-reset type="boolean">false</require-password-reset> \
  <require-portal-user-type type="boolean">true</require-portal-user-type> \
  <sign-up-path>/</sign-up-path> \
  <site-admin type="boolean">false</site-admin> \
  <state>active</state> \
  <updated-at type="datetime">2019-07-19T14:31:55Z</updated-at> \
  <uuid>69337d92-f726-11e8-9e0e-0242ac110003</uuid> \
</user>';

const map: IName[] = [
  { id: "28@learn.staging.concord.org",   name: "Michigan J. Frog" },
  { id: "29@learn.staging.concord.org",   name: "Betty Rubble" },
  { id: "272@learn.staging.concord.org",  name: "Scott Teacher" },
  { id: "anonymous",                      name: "Anonymous" },
  { id: "217@learn.staging.concord.org",  name: "Martha P. LeStrand" },
  { id: "337@learn.staging.concord.org",  name: "Martin Martian"},
  { id: "4792@learn.staging.concord.org", name: "Dave Love (DLoveT)"}
];

export function fetchUserFromPortal(id: string) {
  const mapResult: IName = map.find( name => name.id === id );
  return (mapResult ? mapResult.name : 'hidden');
}
