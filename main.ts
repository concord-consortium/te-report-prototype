import * as fs from "fs";
import * as _ from "lodash";

// Prototype for Teacher Edition research report.
//
// The real-time data feeds, from the log-puller and LARA, are simulated by a
// set of JSON files in the ./input-data directory.
//
// The term "module" is used for a learning-thing that might be either an
// activity or a sequence. Another word sometime used for this is "resource".
// I've tried to use "module" consistently throughout this prototype.

interface IEvent {
  //
  // A sanitized event we've read from the log-puller. By sanitized, we mean
  // we've only extracted the information we want for reporting purposes.
  // 
  // Until we're sure we're done extracting all we want out of the rawEvent
  // data, a copy of it is kept in the "originalData" member.
  //
  id: string;                // This event's ID, e.g. "789374"
  session: string;           // Session ID, eg,  "e894bfb004f0f3bb4aa58c59ddfc9247"
  userEMail: string;         // Teacher's email identity, eg, "28@learn.staging.concord.org"
  teacherID: string;         // Teacher's portal, as resolved by the Portal
  teacherName: string;       // Teacher's real-world name, fetched from Portal
  moduleType: string;        // Either "activity" or "sequence"
  moduleID: string;          // ID in LARA for this activity or sequence
  moduleTypeID: string;      // For convenience, moduleType & moduleID combined.
  eventType: string;         // Something like "submit question", "focus in", etc.
  eventTime: string;         // Time string for event "2015-04-03T11:28:19.190Z"
  isDisplayMode: boolean;    // True if "mode=teacher-edition" is present in URL
  originalData: any;         // Original data structure fetched from the log puller
}

function fetchLogPullerEvents() {
  //
  // Simulate the fetching of a data stream from the log-puller.
  //
  const fileName = './input-data/log-data/portal-report-1559068754567.json';
  const rawEvents: any[] = JSON.parse(fs.readFileSync(fileName, "utf8"));
  // Now that we have the raw events, map them into "our" events by extracting
  // just what we want to use.
  return rawEvents.map((rawEvent): IEvent => {
    const [_, activityType, activityID] = /(.+): (.+)/.exec(rawEvent.activity);
    const modeString = /.*\?.*mode=teacher-edition/.exec(rawEvent.extras.url);
    const resolvedUser = resolveTeacherIdentifyFromPortal(rawEvent.username);
    return {
      id: rawEvent.id.toString(),
      session: rawEvent.session,
      userEMail: rawEvent.username,  // Used to resolve Teacher's ID & real name.
      teacherID: resolvedUser.id,
      teacherName: resolvedUser.teacherName,
      moduleType: activityType,
      moduleID: activityID,
      moduleTypeID: `${activityType}_${activityID}`,
      eventType: rawEvent.event,
      eventTime: rawEvent.time,
      isDisplayMode: modeString !== null,
      originalData: rawEvent
    }
  });
}

interface IModule {
  externalID: string,         // The ID used to fetch this from LARA.
  name: string,               // The module's name (for the reports).
  isSequence: boolean,        // True, if this is a sequence.
  activities: IActivity[],    // One or more activity structures.
  originalData: any           // The actual thing we got back from LARA.
}

interface IActivity {
  name: string;
  originalData: any;
}


function fetchRawModuleFromLara(moduleTypeID) : IModule {
  const fileName = './input-data/lara-data/' + moduleTypeID + ".json";
  const rawModule = JSON.parse(fs.readFileSync(fileName, "utf8"));
  const isSequence = /sequence.*/.exec(moduleTypeID) !== null;
  if (isSequence) {
    return {
      externalID: moduleTypeID,  // The string we used to fetch module from LARA.
      name: rawModule.display_title,
      isSequence: isSequence,
      activities:
        rawModule.activities.map((act) => {
          return {
            name: act.name,
            originalData: act
          }
        }),
      originalData: rawModule
      }
  } else { // Just a lone activity...
    return {
      externalID: moduleTypeID,  // The string we used to fetch module from LARA.
      name: rawModule.name,
      isSequence: isSequence,
      activities: [
        {
          name: rawModule.name,
          originalData: rawModule
        }
      ],
      originalData: rawModule
      }
    }

}


interface IUser {
  email: string;               // As found in the log-puller event.
  id: string;                  // As returned by Portal.
  teacherName: string;         // As returned by Portal.
  modules: IModule[];          // Filled in, as we go.
  events: IEvent[];            // Filled in, as we go.
}

function resolveTeacherIdentifyFromPortal(email: string): IUser {
  if (email == "28@learn.staging.concord.org") {
    return {
      email: email,
      id: "653",
      teacherName: "Fred Flintstone",
      modules: [],
      events: []
    }
  } else if (email == "29@learn.staging.concord.org") {
    return {
      email: email,
      id: "343",
      teacherName: "Betty Rubble",
      modules: [],
      events: []
    }
  } else {
    return {
      email: email,
      id: "0",
      teacherName: "Teacher name unknown",
      modules: [],
      events: []
    }
  }
}

function main() {

  // We are interested in reports about teachers using Teacher Edition modules.
  // However, the events from the log-puller are not just for modules that use
  // the TE plug-in, so the first step is to filter that down to just the events
  // of interest. To do this, the sequence/activity data in LARA is fetched, for
  // every module listed in the events. Each of those is then investigated for
  // usage of the TE plug-in. The event list is then purged for only those
  // events that are related to the modules with the plug-in present.

  // First, we get the log puller events. From all those events, extract a list
  // of all the modules referenced.
  const rawEvents = fetchLogPullerEvents();
  // console.log(`Number of raw events in the log: ${rawEvents.length}`);
  const modulesList = _.uniq(rawEvents.map( event => event.moduleTypeID ));
  // console.log(`Modules referenced in events (${modulesList.length})):\n  ` +
  //   modulesList.join("\n  "));

  // Fetch each module's description from LARA. Keep only those found to be
  // using the teacher-edition plug-in.
  const teacherEditionRawModules: any[] = [];
  const reForPlugin = /"approved_script_label":"teacherEditionTips"/
  modulesList.forEach((module) => {
    const moduleFromLara = fetchRawModuleFromLara(module);
    if (reForPlugin.exec(JSON.stringify(moduleFromLara)) !== null) {
      teacherEditionRawModules.push(moduleFromLara);
    }
  });
  // console.log(`TeacherEdition Raw Modules (${teacherEditionRawModules.length}):\n  ` +
  //   teacherEditionRawModules.map( module => `${module.externalID}`).join("\n  "));

  // Now that we know which modules are TE modules, filter down the events from
  // the log-puller for only those events referring to TE modules.
  const events = rawEvents.filter( (event) => {
    return (teacherEditionRawModules.find( (rawModule) => {
      return rawModule.externalID === event.moduleTypeID
    }) !== undefined)
  });
  // console.log(`Number of Teacher Edition events in the log: ${events.length}`);

// Generate the "TE Usage Report".
//
// Each row of this report represents data for a unique triple:
//
//   * User (Which is a combination of the user ID and the Teacher Name).
//   * TE Module (Which are module names like "GEODE: Module 1", or something).
//   * Mode (Which is either "TeacherEdition" or "Preview").

// So first, let's get the list of teachers, in this report.

const teachers: IUser[] = _.uniqWith(events.map((e) => {
  return {
    email: e.userEMail,
    id: e.teacherID,
    teacherName: e.teacherName,
    modules: [],
    events: []
  }
}), _.isEqual);
// console.log(`Teachers (${teachers.length}):\n  ` +
//   teachers.map( t => `${t.teacherName}`).join("\n  "));

// Now we fill out the teachers list with the events for a particular teacher...
teachers.forEach((teacher) => {
  teacher.events = _.uniq(events.filter(e => e.teacherID === teacher.id));
});

// ... and, similarly, fill out the teachers list with the modules referred to
// by the events for each teacher.
teachers.forEach((teacher) => {
  const relevantModuleTypeIDs = _.uniq(teacher.events.map(e => e.moduleTypeID));
  teacher.modules = _.uniq(relevantModuleTypeIDs.map((typeID) => {
    return teacherEditionRawModules.find( module => module.externalID == typeID);
  }));
});




  // Report Generation

  const columnNames: string[] = [
    "User ID",
    "Teacher Name",
    "TE Module Name",
    "Mode - TE or Preview",
    "Sessions Launches",
    "Last Launch",
    "Activities Used",
    "Total Duration for Module"
  ];

  const teacherEditionPluginTypes: string[] = [
    "QW-Correct",          // "Question Wrapper - Correct Tab",
    "QW-Distractors",      // "Question Wrapper - Distractors Tab",
    "QW-Tip",              // "Question Wrapper - Teacher Tip Tab",
    "QW-Exemplar",         // "Question Wrapper - Exemplar Tab",
    "WS-Tip",              // "Window Shade - Teacher Tip",
    "WS-Theory",           // "Window Shade - Theory & Background",
    "WS-Discussion",       // "Window Shade - Discussion Points",
    "WS-Deeper",           // "Window Shade - Digging Deeper",
    "ST",                  // "Side Tip"
  ];

  const eventDescriptions: string[] = [
    "Toggled",             // "Number of times tab toggled",
    "Tabs",                // "Total number of tabs in module",
    "Once Toggled",        // "How many tabs toggled at least once",
    "% Once Toggled"       // "Percent of tabs toggled at least once"
  ];

  let allColumnNames: string[] = columnNames;
  teacherEditionPluginTypes.forEach( (t) => {
    eventDescriptions.forEach ( (d) => {
      allColumnNames.push(t + ":" + d);        
    });
  });

  // allColumnNames.forEach((n)=>{
  //   console.log(`ColumenName: ${n}`)
  // })

  let report: string[] = [];
  teachers.forEach((teacher) => {
    teacher.modules.forEach((module) => {
      // need to escape special chars.
      const line = `"${teacher.id}","${teacher.teacherName}","${module.name}"`;
      // Look only at the events for this module...
      let teacherEditionSessions = [];
      let previewSessions = [];
      let earliestTeacherEditionSessionEvent = "";
      let earliestPreviewSessionEvent = "";
      let activitiesUsedTeacherEdition = [];
      let activitiesUsedPreview = [];
      const relevantEvents = teacher.events.filter(e => e.moduleTypeID === module.externalID);
      relevantEvents.forEach((event) => {
        if (event.isDisplayMode) {
          previewSessions.push(event.session);
          // Should compare, but for now, just grab latest.
          earliestPreviewSessionEvent = event.eventTime;
          activitiesUsedPreview.push(event.moduleTypeID);
        } else {
          teacherEditionSessions.push(event.session);
          // Should compare, but for now, just grab latest.
          earliestTeacherEditionSessionEvent = event.eventTime;
          activitiesUsedTeacherEdition.push(event.moduleTypeID);
        }
      });
      activitiesUsedPreview = _.uniq(activitiesUsedPreview);
      activitiesUsedTeacherEdition = _.uniq(activitiesUsedTeacherEdition);
      if (_.uniq(previewSessions).length > 0)
        report.push(line + ",\"Preview\"" +
         `,"${_.uniq(previewSessions).length.toString()}"` +
         `,"${earliestPreviewSessionEvent}"` +
         `,"${activitiesUsedPreview.length.toString()}"` +
         `,"tbd"`
         );
      if (_.uniq(teacherEditionSessions).length > 0)
        report.push(line + ",\"TeacherEdition\"" +
         `,"${_.uniq(teacherEditionSessions).length.toString()}"` +
         `,"${earliestTeacherEditionSessionEvent}"` +
         `,"${activitiesUsedTeacherEdition.length.toString()}"` +
         `,"tbd"`
         );
    });
  });

  // Output the report.
  const outPathName = "./output-data/report.csv";
  fs.writeFileSync(
    outPathName,
    "\"" + (allColumnNames.join("\",\"")) + "\"" + // Column names.
      "\n" +
      report.join("\n") +
      "\n"
  );


}

main();
