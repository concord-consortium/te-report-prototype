export enum TeacherTipType {
  QuestionWrapper = "questionWrapper",
  WindowShade = "windowShade",
  SideTip = "sideTip"
}

export interface IAuthoredState {
  tipType: TeacherTipType;
  windowShade?: IWindowShade;
  questionWrapper?: IAuthoredQuestionWrapper;
  sideTip?: ISideTip;
}

export enum WindowShadeType {
  TheoryAndBackground = "theoryAndBackground",
  TeacherTip = "teacherTip",
  DiscussionPoints = "discussionPoints",
  DiggingDeeper = "diggingDeeper",
  HowToUse = "howToUse"
}

export enum MediaType {
  None = "none",
  Image = "image",
  Video = "video"
}

export enum Layout {
  MediaLeft = "mediaLeft",
  MediaCenter = "mediaCenter"
}

export enum QuestionWrapperLocation {
  Bottom = "bottom",
  StickyNote = "stickyNote",
  Top = "top"
}

export interface IWindowShade {
  windowShadeType: WindowShadeType;
  initialOpenState?: boolean;
  content: string;
  content2?: string;
  layout?: Layout;
  tabNameOverride?: string;
  mediaType?: MediaType;
  mediaURL?: string;
  mediaCaption?: string;
}

export interface ISideTip {
  content: string;
  layout?: Layout;
  mediaType?: MediaType;
  mediaURL?: string;
  mediaCaption?: string;
}

export interface IAuthoredQuestionWrapper {
  correctExplanation?: string;
  distractorsExplanation?: string;
  teacherTip?: string;
  teacherTipImageOverlay?: string;
  exemplar?: string;
  location?: QuestionWrapperLocation;
}
