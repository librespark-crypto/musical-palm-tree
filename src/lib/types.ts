/**
 * Domain model for the JEE Command Center.
 *
 * Every persisted entity is strongly typed here. The types are deliberately
 * independent from the storage layer: the IndexedDB repositories, the pure
 * calculation modules and the React store all share these shapes, which is what
 * makes the analytics unit-testable without a browser.
 */

/** Calendar day in `YYYY-MM-DD` form (local time, never UTC-shifted). */
export type ISODate = string;
/** Full timestamp, as produced by `Date.prototype.toISOString()`. */
export type ISODateTime = string;

export type SubjectCode = 'phy' | 'chem' | 'math';

/** `jm` = JEE Main, `ja` = JEE Advanced. Progress is stored separately per exam. */
export type ExamScope = 'jm' | 'ja';

export const EXAM_SCOPES: readonly ExamScope[] = ['jm', 'ja'];

/* -------------------------------------------------------------------------- */
/* Syllabus                                                                    */
/* -------------------------------------------------------------------------- */

export interface Subtopic {
  id: string;
  name: string;
  slug: string;
  jm: boolean;
  ja: boolean;
}

export interface Topic {
  id: string;
  name: string;
  slug: string;
  jm: boolean;
  ja: boolean;
  note?: string;
  subs: Subtopic[];
}

export interface Chapter {
  id: string;
  name: string;
  slug: string;
  unit?: string;
  jm: boolean;
  ja: boolean;
  srcJM?: string;
  srcJA?: string;
  note?: string;
  topics: Topic[];
}

export interface Subject {
  name: string;
  code: SubjectCode;
  chapters: Chapter[];
}

export interface SyllabusMeta {
  mainYear: number;
  advancedYear: number;
  mainSource: string;
  mainUrl: string;
  advancedSource: string;
  advancedUrl: string;
  retrieved: string;
  note: string;
}

export interface Syllabus {
  meta: SyllabusMeta;
  subjects: Subject[];
}

/** A chapter, topic or subtopic resolved together with its ancestors. */
export type SyllabusNodeKind = 'subject' | 'chapter' | 'topic' | 'subtopic';

export interface SyllabusNode {
  id: string;
  kind: SyllabusNodeKind;
  name: string;
  slug: string;
  jm: boolean;
  ja: boolean;
  subject: Subject;
  chapter: Chapter | null;
  topic: Topic | null;
  subtopic: Subtopic | null;
}

/* -------------------------------------------------------------------------- */
/* Progress                                                                    */
/* -------------------------------------------------------------------------- */

export type DimensionStatus = 'none' | 'partial' | 'done';
export type DimensionKey = 'theory' | 'lecture' | 'dpp' | 'pyq' | 'practice';

export type StudyStatus =
  | 'not_started'
  | 'learning'
  | 'completed'
  | 'weak'
  | 'revision_due';

export type StudyDifficulty = 'easy' | 'moderate' | 'hard';

/** Confidence is a 1-5 self rating; `null` means "not rated yet". */
export type Confidence = 1 | 2 | 3 | 4 | 5;

export interface TopicProgress {
  status: StudyStatus;
  weak: boolean;
  theory: DimensionStatus;
  lecture: DimensionStatus;
  dpp: DimensionStatus;
  pyq: DimensionStatus;
  practice: DimensionStatus;
  /** How many spaced revisions of this node have been completed. */
  revisionCount: number;
  confidence: Confidence | null;
  difficulty: StudyDifficulty | null;
  lastStudied: ISODate | null;
  lastRevision: ISODate | null;
  /** Mirrors the earliest open revision so lists can sort without a join. */
  nextRevision: ISODate | null;
  /** Study minutes attributed to this node (timer, manual log, lecture watch). */
  timeMin: number;
  note: string;
}

/** `progress[nodeId][exam]` - both exams are tracked independently. */
export type ProgressMap = Record<string, Partial<Record<ExamScope, TopicProgress>>>;

/* -------------------------------------------------------------------------- */
/* Planner / backlog                                                           */
/* -------------------------------------------------------------------------- */

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped';

export type Priority = 'high' | 'medium' | 'low';

export const TASK_TYPES = [
  'Lecture',
  'Theory',
  'Topic study',
  'DPP',
  'PYQ',
  'Practice',
  'Revision',
  'Mock test',
  'Mistake revision',
  'Custom',
] as const;

export type TaskType = (typeof TASK_TYPES)[number];

/** What the task points at inside the syllabus (or nothing at all). */
export type TaskLink = 'lecture' | 'chapter' | 'topic' | 'subtopic' | 'test' | 'custom';

export interface StudyTask {
  id: string;
  title: string;
  type: TaskType;
  link: TaskLink;
  status: TaskStatus;
  priority: Priority;
  exam: ExamScope;
  subject: SubjectCode | null;
  chapterId: string | null;
  topicId: string | null;
  subtopicId: string | null;
  plannedFor: ISODate;
  deadline: ISODate | null;
  estMin: number;
  actualMin: number;
  notes: string;
  /** Set when the task slipped past its planned day and joined the backlog. */
  inBacklog: boolean;
  backlogSince: ISODate | null;
  origin: 'manual' | 'ai' | 'template' | 'migration';
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  completedAt: ISODateTime | null;
}

/* -------------------------------------------------------------------------- */
/* Lectures                                                                    */
/* -------------------------------------------------------------------------- */

export type LectureStatus = 'not_started' | 'in_progress' | 'completed';

export interface Lecture {
  id: string;
  title: string;
  subject: SubjectCode;
  chapterId: string | null;
  topicId: string | null;
  exam: ExamScope | 'both';
  number: number;
  durationMin: number;
  watchedMin: number;
  status: LectureStatus;
  source: string;
  date: ISODate | null;
  notes: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* -------------------------------------------------------------------------- */
/* Study sessions + timer                                                      */
/* -------------------------------------------------------------------------- */

export type SessionMode =
  | 'Lecture'
  | 'Theory'
  | 'Practice'
  | 'DPP'
  | 'PYQ'
  | 'Revision'
  | 'Mock Test'
  | 'Other';

export interface StudySession {
  id: string;
  /** ISO timestamp; the session credit belongs to the start day. */
  start: ISODateTime;
  end: ISODateTime | null;
  minutes: number;
  mode: SessionMode;
  subject: SubjectCode;
  /** Which exam scope the time counts towards. */
  exam: ExamScope;
  chapterId: string | null;
  topicId: string | null;
  subtopicId: string | null;
  taskId: string | null;
  origin: 'timer' | 'manual' | 'lecture' | 'migration';
  notes: string;
  createdAt: ISODateTime;
}

export interface TimerState {
  running: boolean;
  startedAt: ISODateTime | null;
  /** Accumulated milliseconds spent paused, so a paused timer stays accurate. */
  pausedMs: number;
  /** Timestamp of the current pause, or null while the timer is running. */
  pausedAt?: ISODateTime | null;
  mode: SessionMode;
  subject: SubjectCode;
  exam: ExamScope;
  chapterId: string | null;
  topicId: string | null;
  subtopicId: string | null;
  taskId: string | null;
}

/* -------------------------------------------------------------------------- */
/* Revision                                                                    */
/* -------------------------------------------------------------------------- */

/** Revision index 1..5 maps onto `RevisionIntervals`. */
export interface RevisionRecord {
  id: string;
  nodeId: string;
  chapterId: string;
  topicId: string | null;
  subtopicId: string | null;
  chapterName: string;
  topicName: string;
  subject: SubjectCode;
  exam: ExamScope;
  index: number;
  scheduledFor: ISODate;
  completedAt: ISODateTime | null;
  completedOn: ISODate | null;
  confidence: Confidence | null;
  note: string;
  auto: boolean;
  createdAt: ISODateTime;
}

/* -------------------------------------------------------------------------- */
/* Tests                                                                       */
/* -------------------------------------------------------------------------- */

export interface TestAttempt {
  /** Marks scored in the subject. */
  score: number;
  max: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  /** Accuracy in percent, 0-100. */
  accuracy: number;
}

export type TestSubjects = Record<SubjectCode, TestAttempt>;

export interface TestRecord {
  id: string;
  name: string;
  date: ISODate;
  exam: ExamScope;
  durationMin: number;
  score: number;
  maxMarks: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  accuracy: number;
  percentile: number | null;
  rank: number | null;
  subjects: TestSubjects;
  notes: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* -------------------------------------------------------------------------- */
/* Mistake book                                                                */
/* -------------------------------------------------------------------------- */

export const MISTAKE_TYPES = [
  'Conceptual',
  'Calculation',
  'Formula',
  'Silly mistake',
  'Misread question',
  'Wrong approach',
  'Time pressure',
  'Guess',
  'Incomplete knowledge',
] as const;

export type MistakeType = (typeof MISTAKE_TYPES)[number];

export type MistakeStatus = 'open' | 'revised' | 'mastered';

export interface Mistake {
  id: string;
  date: ISODate;
  subject: SubjectCode;
  chapterId: string | null;
  topicId: string | null;
  subtopicId: string | null;
  nodeId: string | null;
  exam: ExamScope;
  source: string;
  questionText: string;
  mistakeType: MistakeType;
  whatWentWrong: string;
  correctConcept: string;
  status: MistakeStatus;
  revisions: number;
  lastRevised: ISODate | null;
  /** Optional data-URL attachment captured on the device. */
  image: string | null;
  voiceNote: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/* -------------------------------------------------------------------------- */
/* Question logs                                                               */
/* -------------------------------------------------------------------------- */

export const QUESTION_SOURCES = ['DPP', 'PYQ', 'Practice', 'Mock Test'] as const;
export type QuestionSource = (typeof QUESTION_SOURCES)[number];

export interface QuestionLog {
  id: string;
  date: ISODate;
  source: QuestionSource;
  subject: SubjectCode;
  chapterId: string | null;
  topicId: string | null;
  subtopicId: string | null;
  nodeId: string | null;
  exam: ExamScope;
  difficulty: StudyDifficulty;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  timeMin: number;
  accuracy: number;
  notes: string;
  createdAt: ISODateTime;
}

/* -------------------------------------------------------------------------- */
/* Analytics                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * One day of activity, derived (never stored) from the raw records so the
 * numbers can never drift from the underlying data.
 */
export interface AnalyticsRecord {
  date: ISODate;
  minutes: number;
  questions: number;
  correct: number;
  tasksPlanned: number;
  tasksCompleted: number;
  revisionsScheduled: number;
  revisionsCompleted: number;
  mistakesLogged: number;
  testsTaken: number;
  /** Any tracked action, used for streaks and the heatmap. */
  activities: number;
  minutesBySubject: Partial<Record<SubjectCode, number>>;
}

/* -------------------------------------------------------------------------- */
/* AI coach                                                                    */
/* -------------------------------------------------------------------------- */

export interface AiMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  ts: ISODateTime;
}

export interface AiChat {
  id: string;
  title: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  messages: AiMessage[];
}

export interface AiPlanItem {
  title: string;
  type: TaskType;
  subject: SubjectCode | null;
  topicId: string | null;
  exam: ExamScope;
  estMin: number;
  priority: Priority;
  reason: string;
}

export interface AiPlan {
  source: 'gemini' | 'rules';
  createdAt: ISODateTime;
  availableMinutes: number;
  usedMinutes: number;
  summary: string;
  items: AiPlanItem[];
}

/* -------------------------------------------------------------------------- */
/* Settings + meta                                                             */
/* -------------------------------------------------------------------------- */

export interface UserProfile {
  name: string;
  examLabel: string;
  mainDate: ISODate;
  advancedDate: ISODate;
  dailyTargetMin: number;
}

export interface RevisionSettings {
  autoSchedule: boolean;
  /** Days between revision 1..5. */
  intervals: number[];
}

export interface AiSettings {
  /** Server-side key configured? Reported by /api/ai/status. */
  serverKeyAvailable: boolean;
  model: string;
  lastCheckedAt: ISODateTime | null;
  /** True when a legacy in-browser key was removed during migration. */
  legacyKeyRemoved: boolean;
}

export type ThemePreference = 'light' | 'dark' | 'system';

export interface UserSettings {
  profile: UserProfile;
  revision: RevisionSettings;
  ai: AiSettings;
  theme: ThemePreference;
  /** Show the "facts from your data" insight list on the dashboard. */
  showInsights: boolean;
  /** Compact tables/cards. */
  compact: boolean;
  /** Weekly study-time goal in minutes, used by the analytics header. */
  weeklyTargetMin: number;
}

export interface BackupSlotInfo {
  slot: number;
  createdAt: ISODateTime | null;
  bytes: number;
  records: number;
}

export interface AppMeta {
  schemaVersion: number;
  installedAt: ISODateTime;
  updatedAt: ISODateTime;
  lastBacklogSweep: ISODate | null;
  onboarded: boolean;
  sampleDataLoaded: boolean;
  migration: MigrationReport | null;
}

export interface MigrationReport {
  ranAt: ISODateTime;
  source: 'localStorage-legacy' | 'import';
  found: boolean;
  counts: Record<string, number>;
  skipped: string[];
  notes: string[];
}

/* -------------------------------------------------------------------------- */
/* Snapshot + backup envelopes                                                 */
/* -------------------------------------------------------------------------- */

/** The complete in-memory dataset. Pure calculation modules take this shape. */
export interface TrackerSnapshot {
  subjects: Subject[];
  syllabusMeta: SyllabusMeta;
  progress: ProgressMap;
  tasks: StudyTask[];
  lectures: Lecture[];
  sessions: StudySession[];
  revisions: RevisionRecord[];
  questions: QuestionLog[];
  mistakes: Mistake[];
  tests: TestRecord[];
  chats: AiChat[];
  activeChatId: string | null;
  lastPlan: AiPlan | null;
  settings: UserSettings;
  timer: TimerState;
  meta: AppMeta;
}

export type ExportKind = 'backup' | 'legacy';

export interface ExportEnvelope {
  app: 'jee-command-center';
  schemaVersion: number;
  exportedAt: ISODateTime;
  data: TrackerSnapshot;
}

export interface LegacyExportEnvelope {
  app: 'jee-pcm-tracker';
  exportedAt?: string;
  state: Record<string, unknown>;
}
