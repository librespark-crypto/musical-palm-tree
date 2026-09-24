/**
 * Migration from the original single-file tracker.
 *
 * The legacy app kept everything in `localStorage` under `jee-tracker-v1`
 * (plus up to three `jee-tracker-backup-N` slots) with string statuses such as
 * "Completed" and subject *names* instead of codes. This module converts that
 * payload into the typed v2 model. It is a pure function of the input so the
 * conversion is covered by unit tests, and it never deletes the legacy key - a
 * user can always go back to the old file with their data intact.
 *
 * SECURITY: the legacy Gemini API key lived in localStorage. It is deliberately
 * NOT migrated: the new app talks to Gemini through a server route that reads
 * an environment variable. The fact that a key was dropped is reported to the
 * user instead of being silently swallowed.
 */
import { MISTAKE_TYPES } from '@/lib/types';
import { QUESTION_SOURCE_LIST, SCHEMA_VERSION, TASK_TYPE_LIST, subjectCodeFromName } from '@/lib/constants';
import { toISODate, todayISO } from '@/lib/date';
import { uid } from '@/lib/utils';
import type {
  Confidence,
  DimensionStatus,
  ExamScope,
  Lecture,
  LectureStatus,
  Mistake,
  MistakeStatus,
  MistakeType,
  Priority,
  QuestionLog,
  QuestionSource,
  RevisionRecord,
  SessionMode,
  StudyDifficulty,
  StudySession,
  StudyStatus,
  StudyTask,
  SubjectCode,
  TaskStatus,
  TaskType,
  TestRecord,
  TestSubjects,
  TimerState,
  TopicProgress,
  UserSettings,
} from '@/lib/types';
export interface LegacyMigrationResult {
  progress: Record<string, { jm?: TopicProgress; ja?: TopicProgress }>;
  tasks: StudyTask[];
  lectures: Lecture[];
  sessions: StudySession[];
  revisions: RevisionRecord[];
  questions: QuestionLog[];
  mistakes: Mistake[];
  tests: TestRecord[];
  settings: Partial<UserSettings>;
  timer: Partial<TimerState>;
  chats: { id: string; title: string; createdAt: string; updatedAt: string; messages: { id: string; role: 'user' | 'model'; text: string; ts: string }[] }[];
  counts: Record<string, number>;
  skipped: string[];
  notes: string[];
  /** True when the payload contained a Gemini API key (which is not migrated). */
  legacyApiKeyFound: boolean;
  found: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function isoDate(value: unknown, fallback = todayISO()): string {
  const text = str(value);
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  return fallback;
}

function isoTime(value: unknown): string | null {
  const text = str(value);
  if (!text) return null;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * Legacy values are capitalised words ("In Progress", "Not Started"), the new
 * model uses snake_case tokens - so every enum is normalised before matching.
 */
function token(value: unknown): string {
  return str(value).trim().toLowerCase().replace(/[\s-]+/g, '_');
}

function dimension(value: unknown): DimensionStatus {
  const text = token(value);
  if (text === 'done' || text === 'complete' || text === 'completed') return 'done';
  if (text === 'partial' || text === 'partially_done') return 'partial';
  return 'none';
}

function studyStatus(value: unknown, weak: boolean): StudyStatus {
  const text = token(value);
  if (text === 'completed' || text === 'done') return 'completed';
  if (text === 'learning' || text === 'in_progress') return 'learning';
  if (text === 'revision_due') return 'revision_due';
  if (text === 'weak') return 'weak';
  return weak ? 'weak' : 'not_started';
}

function confidence(value: unknown): Confidence | null {
  const n = num(value, 0);
  if (n >= 1 && n <= 5) return n as Confidence;
  return null;
}

function difficultyOf(value: unknown): StudyDifficulty {
  const text = str(value).toLowerCase();
  if (text === 'easy' || text === 'moderate' || text === 'hard') return text;
  return 'moderate';
}

function lectureStatus(value: unknown): LectureStatus {
  const text = token(value);
  if (text === 'completed' || text === 'done') return 'completed';
  if (text === 'in_progress' || text === 'started') return 'in_progress';
  return 'not_started';
}

function taskStatus(value: unknown): TaskStatus {
  const text = token(value);
  if (text === 'completed' || text === 'done') return 'completed';
  if (text === 'in_progress' || text === 'started') return 'in_progress';
  if (text === 'skipped') return 'skipped';
  return 'pending';
}

function priorityOf(value: unknown): Priority {
  const text = token(value);
  if (text === 'high' || text === 'medium' || text === 'low') return text;
  return 'medium';
}

function mistakeTypeOf(value: unknown): MistakeType {
  const text = str(value);
  const match = MISTAKE_TYPES.find((type) => type.toLowerCase() === text.toLowerCase());
  return match ?? 'Conceptual';
}

function mistakeStatusOf(value: unknown): MistakeStatus {
  const text = token(value);
  if (text === 'revised' || text === 'mastered' || text === 'open') return text;
  return 'open';
}

function modeOf(value: unknown): SessionMode {
  const text = str(value);
  const modes: SessionMode[] = ['Lecture', 'Theory', 'Practice', 'DPP', 'PYQ', 'Revision', 'Mock Test', 'Other'];
  const match = modes.find((mode) => mode.toLowerCase() === text.toLowerCase());
  return match ?? 'Other';
}

function examOf(value: unknown, fallback: ExamScope = 'jm'): ExamScope {
  const text = str(value, fallback);
  return text === 'ja' ? 'ja' : text === 'jm' ? 'jm' : fallback;
}

function taskTypeOf(value: unknown): TaskType {
  const text = str(value);
  const match = TASK_TYPE_LIST.find((type) => type.toLowerCase() === text.toLowerCase());
  return match ?? 'Custom';
}

export function emptyMigration(): LegacyMigrationResult {
  return {
    progress: {},
    tasks: [],
    lectures: [],
    sessions: [],
    revisions: [],
    questions: [],
    mistakes: [],
    tests: [],
    settings: {},
    timer: {},
    chats: [],
    counts: {},
    skipped: [],
    notes: ['No legacy tracker data was found in this browser; starting with an empty tracker.'],
    legacyApiKeyFound: false,
    found: false,
  };
}

/**
 * Converts the legacy `jee-tracker-v1` state object.
 * Unknown or malformed records are skipped and reported, never guessed at.
 */
export function migrateLegacyState(input: unknown): LegacyMigrationResult {
  const notes: string[] = [];
  const skipped: string[] = [];

  if (!isRecord(input)) {
    return { ...emptyMigration(), found: false };
  }

  const progress: LegacyMigrationResult['progress'] = {};
  for (const [nodeId, raw] of Object.entries(isRecord(input.progress) ? input.progress : {})) {
    if (!isRecord(raw)) continue;
    const entry: { jm?: TopicProgress; ja?: TopicProgress } = {};
    for (const exam of ['jm', 'ja'] as const) {
      const legacy = raw[exam];
      if (!isRecord(legacy)) continue;
      const weak = bool(legacy.weak);
      entry[exam] = {
        status: studyStatus(legacy.status, weak),
        weak,
        theory: dimension(legacy.theory),
        lecture: dimension(legacy.lecture),
        dpp: dimension(legacy.dpp),
        pyq: dimension(legacy.pyq),
        practice: dimension(legacy.practice),
        revisionCount: num(legacy.revisionCount),
        confidence: confidence(legacy.confidence),
        difficulty: null,
        lastStudied: legacy.lastStudied ? isoDate(legacy.lastStudied) : null,
        lastRevision: legacy.lastRevision ? isoDate(legacy.lastRevision) : null,
        nextRevision: null,
        timeMin: num(legacy.timeMin),
        note: str(legacy.note),
      };
    }
    if (entry.jm || entry.ja) progress[nodeId] = entry;
  }

  const tasks: StudyTask[] = [];
  for (const raw of arr(input.tasks)) {
    if (!isRecord(raw)) continue;
    const title = str(raw.title).trim();
    if (!title) {
      skipped.push('task without a title');
      continue;
    }
    const subject = subjectCodeFromName(str(raw.subject));
    tasks.push({
      id: str(raw.id) || uid('task'),
      title,
      type: taskTypeOf(raw.type),
      link: raw.subtopicId || raw.nodeId ? 'subtopic' : raw.topicId ? 'topic' : raw.chapterId ? 'chapter' : 'custom',
      status: taskStatus(raw.status),
      priority: priorityOf(raw.priority),
      exam: examOf(raw.exam),
      subject,
      chapterId: str(raw.chapterId) || null,
      topicId: str(raw.topicId) || null,
      subtopicId: str(raw.nodeId) || str(raw.subtopicId) || null,
      plannedFor: isoDate(raw.plannedFor ?? raw.date),
      deadline: raw.deadline ? isoDate(raw.deadline) : null,
      estMin: num(raw.estMin, 45),
      actualMin: num(raw.actualMin),
      notes: str(raw.notes),
      inBacklog: bool(raw.inBacklog),
      backlogSince: raw.backlogSince ? isoDate(raw.backlogSince) : null,
      origin: 'migration',
      createdAt: isoTime(raw.createdAt) ?? new Date().toISOString(),
      updatedAt: isoTime(raw.updatedAt ?? raw.createdAt) ?? new Date().toISOString(),
      completedAt: isoTime(raw.completedAt),
    });
  }

  const lectures: Lecture[] = [];
  for (const raw of arr(input.lectures)) {
    if (!isRecord(raw)) continue;
    const subject = subjectCodeFromName(str(raw.subject));
    const title = str(raw.title).trim();
    if (!title || !subject) {
      skipped.push('lecture without a title or subject');
      continue;
    }
    const status = lectureStatus(raw.status);
    const durationMin = num(raw.duration);
    lectures.push({
      id: str(raw.id) || uid('lec'),
      title,
      subject,
      chapterId: str(raw.chapterId) || null,
      topicId: str(raw.topicId) || null,
      exam: str(raw.exam) === 'both' ? 'both' : examOf(raw.exam),
      number: num(raw.number, 1),
      durationMin,
      watchedMin: status === 'completed' ? durationMin : num(raw.watchedMin),
      status,
      source: str(raw.source),
      date: raw.date ? isoDate(raw.date) : null,
      notes: str(raw.notes),
      createdAt: isoTime(raw.createdAt) ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const sessions: StudySession[] = [];
  for (const raw of arr(input.sessions)) {
    if (!isRecord(raw)) continue;
    const subject = subjectCodeFromName(str(raw.subject));
    const start = isoTime(raw.start);
    if (!subject || !start) {
      skipped.push('session without a subject or start time');
      continue;
    }
    sessions.push({
      id: str(raw.id) || uid('ses'),
      start,
      end: isoTime(raw.end),
      minutes: num(raw.minutes),
      mode: modeOf(raw.mode),
      subject,
      exam: examOf(raw.exam),
      chapterId: str(raw.chapterId) || null,
      topicId: str(raw.topicId) || null,
      subtopicId: str(raw.subtopicId) || null,
      taskId: str(raw.taskId) || null,
      origin: 'migration',
      notes: str(raw.notes),
      createdAt: isoTime(raw.createdAt) ?? start,
    });
  }

  const revisions: RevisionRecord[] = [];
  for (const raw of arr(input.revisions)) {
    if (!isRecord(raw)) continue;
    const nodeId = str(raw.nodeId);
    const subject = subjectCodeFromName(str(raw.subject));
    if (!nodeId || !subject) {
      skipped.push('revision without a topic');
      continue;
    }
    const completedAt = isoTime(raw.completedAt);
    revisions.push({
      id: str(raw.id) || uid('rev'),
      nodeId,
      chapterId: str(raw.chapterId),
      topicId: str(raw.topicId) || null,
      subtopicId: str(raw.subtopicId) || (nodeId.split('.').length === 4 ? nodeId : null),
      chapterName: str(raw.chapterName),
      topicName: str(raw.topicName),
      subject,
      exam: examOf(raw.exam),
      index: Math.max(1, num(raw.index, 1)),
      scheduledFor: isoDate(raw.scheduledFor),
      completedAt,
      completedOn: completedAt ? toISODate(new Date(completedAt)) : null,
      confidence: confidence(raw.confidence),
      note: str(raw.note),
      auto: bool(raw.auto),
      createdAt: isoTime(raw.createdAt) ?? new Date().toISOString(),
    });
  }

  const questions: QuestionLog[] = [];
  for (const raw of arr(input.questions)) {
    if (!isRecord(raw)) continue;
    const subject = subjectCodeFromName(str(raw.subject));
    if (!subject) {
      skipped.push('question log without a subject');
      continue;
    }
    const attempted = num(raw.attempted);
    const correct = num(raw.correct);
    questions.push({
      id: str(raw.id) || uid('q'),
      date: isoDate(raw.date),
      source: (QUESTION_SOURCE_LIST as readonly string[]).includes(str(raw.source))
        ? (str(raw.source) as QuestionSource)
        : 'Practice',
      subject,
      chapterId: str(raw.chapterId) || null,
      topicId: str(raw.topicId) || null,
      subtopicId: str(raw.subtopicId) || null,
      nodeId: str(raw.nodeId) || str(raw.topicId) || str(raw.chapterId) || null,
      exam: examOf(raw.exam),
      difficulty: difficultyOf(raw.difficulty),
      attempted,
      correct,
      wrong: num(raw.wrong),
      unattempted: num(raw.unattempted),
      timeMin: num(raw.timeMin),
      accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
      notes: str(raw.note ?? raw.notes),
      createdAt: isoTime(raw.ts ?? raw.createdAt) ?? new Date().toISOString(),
    });
  }

  const mistakes: Mistake[] = [];
  for (const raw of arr(input.errors)) {
    if (!isRecord(raw)) continue;
    const subject = subjectCodeFromName(str(raw.subject));
    if (!subject) {
      skipped.push('mistake entry without a subject');
      continue;
    }
    mistakes.push({
      id: str(raw.id) || uid('err'),
      date: isoDate(raw.date),
      subject,
      chapterId: str(raw.chapterId) || null,
      topicId: str(raw.topicId) || null,
      subtopicId: str(raw.subtopicId) || null,
      nodeId: str(raw.nodeId) || str(raw.topicId) || str(raw.chapterId) || null,
      exam: examOf(raw.exam),
      source: str(raw.source) || 'Practice',
      questionText: str(raw.questionText),
      mistakeType: mistakeTypeOf(raw.mistakeType),
      whatWentWrong: str(raw.note),
      correctConcept: str(raw.correctConcept),
      status: mistakeStatusOf(raw.status),
      revisions: num(raw.revisions),
      lastRevised: raw.lastRevised ? isoDate(raw.lastRevised) : null,
      image: str(raw.image) || null,
      voiceNote: str(raw.voiceNote) || null,
      createdAt: isoTime(raw.createdAt) ?? new Date().toISOString(),
      updatedAt: isoTime(raw.updatedAt ?? raw.createdAt) ?? new Date().toISOString(),
    });
  }

  const tests: TestRecord[] = [];
  for (const raw of arr(input.tests)) {
    if (!isRecord(raw)) continue;
    const name = str(raw.name).trim();
    if (!name) {
      skipped.push('test without a name');
      continue;
    }
    const subjectsRaw = isRecord(raw.subjects) ? raw.subjects : {};
    const subjectAttempt = (code: SubjectCode, fallbackMax: number) => {
      const entry = isRecord(subjectsRaw[code]) ? subjectsRaw[code] : {};
      const attempted = num(entry.attempted);
      const correct = num(entry.correct);
      return {
        score: num(entry.score),
        max: num(entry.max, fallbackMax),
        attempted,
        correct,
        wrong: num(entry.wrong),
        unattempted: num(entry.unattempted),
        accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
      };
    };
    const subjects: TestSubjects = {
      phy: subjectAttempt('phy', 100),
      chem: subjectAttempt('chem', 100),
      math: subjectAttempt('math', 100),
    };
    const attempted = num(raw.attempted);
    const correct = num(raw.correct);
    tests.push({
      id: str(raw.id) || uid('test'),
      name,
      date: isoDate(raw.date),
      exam: examOf(raw.exam),
      durationMin: num(raw.timeMin ?? raw.durationMin, 180),
      score: num(raw.score),
      maxMarks: num(raw.maxMarks, 300),
      attempted,
      correct,
      wrong: num(raw.wrong),
      unattempted: num(raw.unattempted),
      accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
      percentile: raw.percentile === null || raw.percentile === undefined ? null : num(raw.percentile, 0),
      rank: raw.rank === null || raw.rank === undefined ? null : num(raw.rank, 0),
      subjects,
      notes: str(raw.notes),
      createdAt: isoTime(raw.createdAt) ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }

  const settings: Partial<UserSettings> = {};
  if (isRecord(input.profile) || isRecord(input.settings)) {
    const profile = isRecord(input.profile) ? input.profile : {};
    const legacySettings = isRecord(input.settings) ? input.settings : {};
    settings.profile = {
      name: str(profile.name),
      examLabel: str(profile.examLabel, 'JEE 2027'),
      mainDate: isoDate(profile.mainDate),
      advancedDate: isoDate(profile.advancedDate),
      dailyTargetMin: num(profile.dailyTargetMin, 420),
    };
    settings.revision = { autoSchedule: legacySettings.autoRevision !== false, intervals: [1, 3, 7, 16, 35] };
    settings.ai = {
      serverKeyAvailable: false,
      model: str(legacySettings.model, 'gemini-2.5-flash'),
      lastCheckedAt: null,
      legacyKeyRemoved: str(legacySettings.apiKey).length > 0,
    };
  }

  const legacyApiKeyFound = isRecord(input.settings) && str(input.settings.apiKey).length > 0;
  if (legacyApiKeyFound) {
    notes.push(
      'A Gemini API key was found in the old browser storage. It was NOT copied into the new tracker: the app now calls Gemini through a server route that reads GEMINI_API_KEY from the environment.',
    );
  }

  const timer: Partial<TimerState> = {};
  if (isRecord(input.timer)) {
    const legacyTimer = input.timer;
    const subject = subjectCodeFromName(str(legacyTimer.subject));
    timer.exam = examOf(legacyTimer.exam);
    timer.running = false; // a running legacy timer is stopped: its elapsed time is unknown after a reload
    timer.startedAt = null;
    timer.mode = modeOf(legacyTimer.mode);
    if (subject) timer.subject = subject;
    timer.chapterId = str(legacyTimer.chapterId) || null;
    timer.topicId = str(legacyTimer.topicId) || null;
  }

  const chats: LegacyMigrationResult['chats'] = [];
  const ai = isRecord(input.ai) ? input.ai : {};
  for (const raw of arr(ai.chats)) {
    if (!isRecord(raw)) continue;
    const messages = arr(raw.messages)
      .filter(isRecord)
      .map((message) => ({
        id: uid('msg'),
        role: message.role === 'model' ? ('model' as const) : ('user' as const),
        text: str(message.text),
        ts: isoTime(message.ts) ?? new Date().toISOString(),
      }))
      .filter((message) => message.text.trim().length > 0);
    if (!messages.length) continue;
    const created = isoTime(raw.created) ?? messages[0]!.ts;
    chats.push({
      id: str(raw.id) || uid('chat'),
      title: str(raw.title, 'Imported chat'),
      createdAt: created,
      updatedAt: messages[messages.length - 1]!.ts,
      messages,
    });
  }

  const counts = {
    progressNodes: Object.keys(progress).length,
    tasks: tasks.length,
    lectures: lectures.length,
    sessions: sessions.length,
    revisions: revisions.length,
    questions: questions.length,
    mistakes: mistakes.length,
    tests: tests.length,
    chats: chats.length,
  };

  if (skipped.length) {
    notes.push(`${skipped.length} legacy record(s) could not be converted and were left out: ${skipped.slice(0, 5).join('; ')}.`);
  }

  return {
    progress,
    tasks,
    lectures,
    sessions,
    revisions,
    questions,
    mistakes,
    tests,
    settings,
    timer,
    chats,
    counts,
    skipped,
    notes,
    legacyApiKeyFound,
    found: true,
  };
}

export const LEGACY_STORAGE_KEY = 'jee-tracker-v1';
export const LEGACY_BACKUP_PREFIX = 'jee-tracker-backup-';
export const LEGACY_BACKUP_SLOTS = [1, 2, 3] as const;

export interface LegacyScan {
  primary: unknown | null;
  backups: { slot: number; at: string | null; state: unknown }[];
}

/** Reads the legacy keys without mutating them. Safe when storage is blocked. */
export function scanLegacyStorage(storage: Storage | undefined = typeof localStorage === 'undefined' ? undefined : localStorage): LegacyScan {
  const scan: LegacyScan = { primary: null, backups: [] };
  if (!storage) return scan;
  try {
    const raw = storage.getItem(LEGACY_STORAGE_KEY);
    if (raw) scan.primary = JSON.parse(raw) as unknown;
  } catch {
    scan.primary = null;
  }
  for (const slot of LEGACY_BACKUP_SLOTS) {
    try {
      const raw = storage.getItem(`${LEGACY_BACKUP_PREFIX}${slot}`);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as unknown;
      if (isRecord(parsed)) {
        scan.backups.push({ slot, at: str(parsed.at) || null, state: parsed.state ?? null });
      }
    } catch {
      // ignore broken slots
    }
  }
  return scan;
}

export function schemaVersionOf(payload: unknown): number {
  if (isRecord(payload) && typeof payload.schemaVersion === 'number') return payload.schemaVersion;
  return 0;
}

export { SCHEMA_VERSION };
