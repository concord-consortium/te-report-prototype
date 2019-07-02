// This is a temporary mock service that simulates fetching the user name info
// from the portal, given a particular user identifier, as provided by an event
// from the log-puller. What we do here is simply map the incoming ID to a user
// name and return it. If we don't recognize the input, we return a string of
// "Not available" as the user's name.
//
// This will be replaced with a function fetches the user information with
// something like: "learn.staging.concord.org/users/${id}.xml", with the
// appropriate credentials, of course.

interface IName {
  id: string,
  name: string
}

const map: IName[] = [
  { id: "28@learn.staging.concord.org",   name: "Michigan J. Frog" },
  { id: "29@learn.staging.concord.org",   name: "Betty Rubble" },
  { id: "272@learn.staging.concord.org",  name: "Scott Teacher" },
  { id: "anonymous",                      name: "Anonymous" },
  { id: "217@learn.staging.concord.org",  name: "Martha P. LeStatosphere" },
  { id: "337@learn.staging.concord.org",  name: "Martin Martian"},
  { id: "4792@learn.staging.concord.org", name: "Dave Love (DLoveT)"}
];

export function fetchUserFromPortal(id: string) {
  const mapResult: IName = map.find( name => name.id === id );
  return (mapResult ? mapResult.name : 'hidden');
}
