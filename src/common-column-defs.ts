import { PluginType, IQuestionWrapper, WindowShadeType, EventSubType } from './report-data-types';

export interface IColumnName {
    title: string,
    shortTitle: string
  }

export interface IColumnDef {
  title: string,
  shortTitle: string,            // Could be removed when no longer debugging.
  pluginType: PluginType,
  pluginSubType: IQuestionWrapper | WindowShadeType | QuestionWrapperDiscriminator,
  eventMatcher: RegExp,
  eventSubType: EventSubType
}

export enum QuestionWrapperDiscriminator {
  correctExplanation,
  distractorsExplanation,
  exemplar,
  teacherTip
}

export const columnDefs: IColumnDef[] = [
  {
    title: "Question Wrapper - Correct Tab",
    shortTitle: "QW-C",
    pluginType: PluginType.QuestionWrapper,
    pluginSubType: QuestionWrapperDiscriminator.correctExplanation,
    eventMatcher: /TeacherEdition-questionWrapper-TeacherTip Tab(Opened|Closed)/,
    eventSubType: EventSubType.CorrectExplanation
  },
  {
    title: "Question Wrapper - Distractors Tab",
    shortTitle: "QW-D",
    pluginType: PluginType.QuestionWrapper,
    pluginSubType: QuestionWrapperDiscriminator.distractorsExplanation,
    eventMatcher: /TeacherEdition-questionWrapper-TeacherTip Tab(Opened|Closed)/,
    eventSubType: EventSubType.DistractorsExplanation
  },
  {
    title: "Question Wrapper - Teacher Tip Tab",
    shortTitle: "QW-T",
    pluginType: PluginType.QuestionWrapper,
    pluginSubType: QuestionWrapperDiscriminator.teacherTip,
    eventMatcher: /TeacherEdition-questionWrapper-TeacherTip Tab(Opened|Closed)/,
    eventSubType: EventSubType.TeacherTip
  },
  {
    title: "Question Wrapper - Exemplar Tab",
    shortTitle: "QW-E",
    pluginType: PluginType.QuestionWrapper,
    pluginSubType: QuestionWrapperDiscriminator.exemplar,
    eventMatcher: /TeacherEdition-questionWrapper-TeacherTip Tab(Opened|Closed)/,
    eventSubType: EventSubType.Exemplar
  },
  {
    title: "Window Shade - Teacher Tip",
    shortTitle: "WS-TT",
    pluginType: PluginType.WindowShade,
    pluginSubType: WindowShadeType.TeacherTip,
    eventMatcher: /TeacherEdition-windowShade-TeacherTip Tab(Opened|Closed)/,
    eventSubType: undefined
  },
  {
    title: "Window Shade - Theory & Background",
    shortTitle: "WS-TB",
    pluginType: PluginType.WindowShade,
    pluginSubType: WindowShadeType.TheoryAndBackground,
    eventMatcher: /TeacherEdition-windowShade-TheoryAndBackground Tab(Opened|Closed)/,
    eventSubType: undefined
  },
  {
    title: "Window Shade - Discussion Points",
    shortTitle: "WS-DP",
    pluginType: PluginType.WindowShade,
    pluginSubType: WindowShadeType.DiscussionPoints,
    eventMatcher: /TeacherEdition-windowShade-DiscussionPoints Tab(Opened|Closed)/,
    eventSubType: undefined
  },
  {
    title: "Window Shade - Digging Deeper",
    shortTitle: "WS-DD",
    pluginType: PluginType.WindowShade,
    pluginSubType: WindowShadeType.DiggingDeeper,
    eventMatcher: /TeacherEdition-windowShade-DiggingDeeper Tab(Opened|Closed)/,
    eventSubType: undefined
  },
  {
    title: "Side Tip",
    shortTitle: "ST",
    pluginType: PluginType.SideTip,
    pluginSubType: null,
    eventMatcher: /TeacherEdition-sideTip-TeacherTip Tab(Opened|Closed)/,
    eventSubType: undefined
  }
];

export const subColumns: IColumnName[] = [
  {
    title: "Number of Tabs in Module",
    shortTitle: "Tabs",
  },
  {
    title: "Total Number of Toggles",
    shortTitle: "Toggles",
  },
  {
    title: "Number of Tabs Toggled at Least Once",
    shortTitle: "Toggled",
  },
  {
    title: "% of Tabs Toggled at least Once",
    shortTitle: "%"
  },
];
