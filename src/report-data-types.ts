// An IReportData object encapsulates the useful information extracted from an
// event-log and module data.

export interface IReportData {
  events: IEvent[];
  teachers: ITeacher[];
  modules: IModule[];
  sessions: ISession[];
}

export interface IEvent {
  // Events are built from a raw event, as supplied by the log-puller, with
  // additional information extracted from the module definitions as supplied
  // by LARA and user identity as supplied by Portal.
  session: ISession;            // The session associated with this event.
  teacher: ITeacher;            // The user that caused this event.
  teMode: TEMode;               // Either "previewMode" or "teacherEditionMode".
  eventDate: Date;              // The date-time stamp for this event.
  eventType: string;            // Something like "TeacherEdition-questionWrapper-TeacherTip TabOpened", etc.
  eventSubType: EventSubType;   // Used to resolve QuestionWrapper events for type, like "Distractors"
  module: IModule;              // The module, i.e., the sequence or activity.
  activityID: string;           // The unique id tag for the related module.
  plugin: IPlugin;              // Undefined if not a TE event or not a TE plugin.
}


export enum TEMode {            // Determined by the mode query parameter at the
  TeacherEditionMode = 'Teacher Edition', // end of this event's URL.
  PreviewMode = 'Preview'
}

export enum EventSubType {
  CorrectExplanation,
  DistractorsExplanation,
  Exemplar,
  TeacherTip
}

export interface ITeacher {
  id: string;                   // The username field from the log-puller event.
  name: string;                 // User name, as returned by Portal.
  events?: IEvent[];            // All events in the log, caused by this user.
  modules?: IModule[];          // All the modules associated with this user's events.
  sessions?: ISession[]         // All the sessions associated with this user's events.
}

export interface IModule {
  externalID: string;           // The "activity" field from the raw log event.
  name: string;                 // The module's name, to display in the reports.
  isTEModule: boolean;          // True, if module uses one or more TE plugins.
  activities: IActivity[];      // List of the activities in this module.
}

export interface ISession {
  sessionToken: string;         // The "session" token from the raw log events.
  events?: IEvent[];            // All the events associated with this session.
  modules?: IModule[];          // All the modules associated with this session.
  teachers?: ITeacher[];        // All the teachers associated with this session.
  // TODO: Decide if we need to keep these around, now. Used to use them in the
  // usage report, but may be that useful.
  firstDate?: Date;             // ??  Date of first event related to this session.
  lastDate?: Date;              // ??  Date of last event related to this session.
}

export interface IActivity {
  name: string;                 // The name of a particular activity.
  plugins: IPlugin[];           // List of all TE plugins in this activity.
}

export enum PluginType {
  QuestionWrapper = 'Question Wrapper',
  WindowShade = 'Window Shade',
  SideTip = 'Side Tip'
}

export enum WindowShadeType {
  TeacherTip = 'Teacher Tip',
  TheoryAndBackground = 'Theory & Background',
  DiscussionPoints = 'Discussion Points',
  DiggingDeeper = 'Digging Deeper'
}

export interface IPlugin {
  refID: string,                // The refID comes from LARA activity, e.g., "729-Embeddable::EmbeddablePlugin".
  pluginType: PluginType,
  pluginDef?: IQuestionWrapper | WindowShadeType
}

export interface IQuestionWrapper {
  isCorrectExplanation: boolean,
  isDistractorsExplanation: boolean,
  isExemplar: boolean,
  isTeacherTip: boolean
}
