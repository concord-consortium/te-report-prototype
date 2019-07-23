# Teacher Edition Report Generation

Note: When this repository was originally created, it was a prototype for the
the Teacher Edition (TE) reporting service. It has since been extended to use the
LogPuller, LARA, and Portal services for fetching data, and is currently deployed
as a Heroku server. The word "prototype" can be ignored.

## Purpose

This service accepts a report-request from buttons on the "User Reports" page
and sends back a response of a CSV representation of a report. This processing
is specific to Teacher Edition usage and the report columns are specific to
the types of TeacherEdition Plugins that may be used in TE sequences and
activities. (In other words, if an activity has no TE plugins, no rows for that
activity will be included in a report from this service.)

At a high-level, this is the processing:

1. A report request is received. This request contains the specific filtering
criteria used to build the report -- just like other researcher reports.

1. This server builds a request for the LogPuller, passing the filtering
criteria and waits for a response. This response is a (potentially large)
list of events that satisfy the filter data.

1. Each event is checked to see if it is a TE event and, if so, the
sequence/activity definition is fetched from LARA. For each activity, data
about each TE plugin is extracted. The sequence/activity data is cached for the
duration of each report request.

1. Similarly to fetching the sequence/activity data from LARA, for each event,
the user name (or teacher name, in much of the code) is fetched from the Portal
based on the user-id supplied by the LogPuller event data. Also, like the
information fetched from LARA, the user data is cached for the duration of the
report request.

1. With all the data fetched, it is sliced-and-diced based on the needs of the
particular report, grouped into appropriate rows and columns, and a response
is returned.

## Structure

The source code of this server is fairly simple in structure; all source
files are in the `./scr` directory.

Perhaps, the best way to become familiar with the code is to begin with
`./src/server.ts` for the two http handlers. One for a GET request and one for
a POST request. The actual reporting request is the POST.

The POST handler uses the `getLog()` method (see `./src/log-puller.ts`) to
fetch the log data from the LogPuller. Once the events are returned, the
`buildReportData()` method handles all the rest of the fetching of data from
LARA and Portal based on specific data in each log event. Eventually, the
`getReport()` method uses the report data to actually create a particular
CSV-formatted response.

## Deployment

### Auto Deployment

This server is deployed to Heroku and is auto-deployed whenever a PR is merged
into **`master`**. In addition to moving the code into the Heroku hosting
environment, a few other steps are required.

In particular, the configuration (or environment variables) must be set to
identify the URLs for the Portal and LARA. In addition, an API token must be
established for fetching data from LARA.

### URL Parameters

A single URL query parameter, `report`, is used by the server, which may have
one of two values, `usageReport` or `sessionReport`. See the section
**Adding Buttons for the New External Reports**, below, for how this parameter
is supplied by an External Report's settings.

### Configuration/Environment Variables

There are 3 primary environment variables:

| Variable           | Default                         | Comment                   |
|:-------------------|:--------------------------------|:--------------------------|
| `AUTHORING_SERVER` | `authoring.staging.concord.org` | Portal's url              |
| `LEARN_SERVER`     | `learn.staging.concord.org`     | LARA's url                |
| `API_TOKEN`        | `undefined`                     | From LARA user management |

The unusual one is the `API_TOKEN`. This value must be present for fetching
data from an authoring server. It is generated from within LARA by the following
procedure.

1. Log into authoring as admin.
1. Go to the User Admin page.
1. Select (or create) a user account.
1. Check "Allowed to export activities and sequences?"
1. Check "Allow API Access (for GET requests)?"
1. Copy the generated API KEY and use that to set the value of `API_TOKEN`.

## Adding Buttons for the New External Reports

### Staging and Production

In the Portal, navigate to `Admin -> External Reports` and create a new External
Report that has something like the following data:

| Field | Example Value |
|:---|:---|
| Name: | `Teacher Edition Usage Report` |
| URL: | `https://teacher-edition-report.herokuapp.com/?report=usageReport` |
| Launch Text: | `Teacher Edition Usage Report` |
| Client: | `localhost` |
| Report Type: | researcher |
| Allowed for Students: | unchecked (false) |

This example shows example for a `usageReport`. For the `sessionReport`, or any
future reports, the data would change as is appropriate.

### Running a Report Against a Local Server

For development purposes, it is very handy to run this server locally. After
setting up a dev environment, see below, a temporary external report can be
created (in staging, obviously) that is very much like the external report
shown above, but with the URL pointing to your local server. It might look
something like this:

| Field | Example Value |
|:---|:---|
| Name: | `T.E. Localhost Usage` |
| URL: | `http://localhost:5000/?report=usageReport` |
| Launch Text: | `T.E. Localhost Usage` |
| Client: | `localhost` |
| Report Type: | researcher |
| Allowed for Students: | unchecked (false) |

Obviously, the port needs to be the port your local server is using.

Once development is completed, this temporary external report should be deleted.

## Development

### Getting Started

This repository follows the typical workflow.

1. Clone the repository to your local development area.

1. `npm install` to fetch the package dependencies.

1. Setup the environment. The environment variables for the URLs should default
to staging environments, but the API_TOKEN must be explicitly set to the value
generated by creating the token, as described in the section, above,
**Configuration/Environment Variables**.

1. `npm run build` to compile.

1. `npm start` to launch the server.

For example (the token, in this case is of the correct format, but is not valid
for security concerns).

```bash
te-reporting$ npm install
...
te-reporting$ export API_TOKEN=aa6112ea-a728-4677-ab46-23aa3c78a032
te-reporting$ npm start
...
^C          -- to stop the server
... make code changes
te-reporting$ npm run build
...
te-reporting$ npm start
... and around we go!
```

### Running Tests

Although there aren't any tests at present, Jest is setup in this repository.
To run the tests, simply use

``` bash
te-reporting$ npm test
```

The test files are intended to be parallel to the file they are testing, in the
`./src` directory. For Jest to find and run them, they must have file names
ending with `.test.ts`.
