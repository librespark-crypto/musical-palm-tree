/**
 * Shared fixtures for the unit tests.
 *
 * Records are built relative to the real "today" so behaviour that depends on
 * due dates (revision buckets, backlog sweep, streaks) is exercised the way the
 * app experiences it, without freezing the clock.
 */
import { defaultMeta, defaultSettings, defaultTimer } from '@/lib/db/defaults';
import { emptyProgress } from '@/lib/calculations/progress';
import { nodeById, subjects, syllabusMeta } from '@/lib/syllabus';
import { addDays, todayISO } from '@/lib/date';
import type {
  ExamScope,
  Lecture,
  Mistake,
  QuestionLog,
  RevisionRecord,
  StudySession,
  StudyTask,
  SubjectCode,
  TestAttempt,
  TestRecord,
  TestSubjects,
  TopicProgress,
  TrackerSnapshot,
} from '@/lib/types';

export const TODAY = todayISO();
export const dayOffset = (days: number): string => addDays(TODAY, days);
export const at = (date: string, time = '10:00'): string => `${date}T${time}:00.000Z`;

let counter = 0;
export function nextId(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}`;
}

export function snapshot(overrides: Partial<TrackerSnapshot> = {}): TrackerSnapshot {
  return {
    subjects,
    syllabusMeta,
    progress: {},
    tasks: [],
    lectures: [],
    sessions: [],
    revisions: [],
    questions: [],
    mistakes: [],
    tests: [],
    chats: [],
    activeChatId: null,
    lastPlan: null,
    settings: defaultSettings(),
    timer: defaultTimer(),
    meta: defaultMeta(),
    ...overrides,
  };
}

/** Ancestor ids for a syllabus node - the shape stored records carry. */
export function nodePath(nodeId: string): {
  chapterId: string | null;
  topicId: string | null;
  subtopicId: string | null;
  subject: SubjectCode;
} {
  const node = nodeById(nodeId);
  if (!node) return { chapterId: null, topicId: null, subtopicId: null, subject: 'phy' };
  return {
    chapterId: node.chapter?.id ?? null,
    topicId: node.topic?.id ?? null,
    subtopicId: node.subtopic?.id ?? null,
    subject: node.subject.code,
  };
}

export function progressRow(patch: Partial<TopicProgress> = {}): TopicProgress {
  return { ...emptyProgress(), ...patch };
}

export function task(patch: Partial<StudyTask> = {}): StudyTask {
  const now = new Date().toISOString();
  return {
    id: nextId('task'),
    title: 'Task',
    type: 'Theory',
    link: 'custom',
    status: 'pending',
    priority: 'medium',
    exam: 'jm',
    subject: null,
    chapterId: null,
    topicId: null,
    subtopicId: null,
    plannedFor: TODAY,
    deadline: null,
    estMin: 60,
    actualMin: 0,
    notes: '',
    inBacklog: false,
    backlogSince: null,
    origin: 'manual',
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    ...patch,
  };
}

export function session(patch: Partial<StudySession> = {}): StudySession {
  const start = patch.start ?? at(TODAY);
  return {
    id: nextId('ses'),
    start,
    end: `${start.slice(0, 10)}T${start.slice(11, 13) === '10' ? '11' : '11'}:00:00.000Z`,
    minutes: 60,
    mode: 'Theory',
    subject: 'phy',
    exam: 'jm',
    chapterId: null,
    topicId: null,
    subtopicId: null,
    taskId: null,
    origin: 'manual',
    notes: '',
    createdAt: new Date().toISOString(),
    ...patch,
  };
}

export function questionLog(patch: Partial<QuestionLog> = {}): QuestionLog {
  const attempted = patch.attempted ?? 20;
  const correct = patch.correct ?? 15;
  return {
    id: nextId('q'),
    date: TODAY,
    source: 'DPP',
    subject: 'phy',
    chapterId: null,
    topicId: null,
    subtopicId: null,
    nodeId: null,
    exam: 'jm',
    difficulty: 'moderate',
    attempted,
    correct,
    wrong: patch.wrong ?? attempted - correct,
    unattempted: patch.unattempted ?? 0,
    timeMin: 45,
    accuracy: Math.round((correct / Math.max(1, attempted)) * 100),
    notes: '',
    createdAt: new Date().toISOString(),
    ...patch,
  };
}

export function mistake(patch: Partial<Mistake> = {}): Mistake {
  return {
    id: nextId('mis'),
    date: TODAY,
    subject: 'phy',
    chapterId: null,
    topicId: null,
    subtopicId: null,
    nodeId: null,
    exam: 'jm',
    source: 'DPP',
    questionText: 'A block slides down a rough incline…',
    mistakeType: 'Conceptual',
    whatWentWrong: 'Missed the friction direction.',
    correctConcept: 'Friction opposes relative motion, not gravity.',
    status: 'open',
    revisions: 0,
    lastRevised: null,
    image: null,
    voiceNote: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...patch,
  };
}

/** A revision record for a real syllabus subtopic. Throws on non-subtopics. */
export function revisionFor(nodeId: string, patch: Partial<RevisionRecord> = {}): RevisionRecord {
  const node = nodeById(nodeId);
  if (!node?.chapter || !node.topic || !node.subtopic) throw new Error(`revisionFor: ${nodeId} is not a subtopic`);
  return {
    id: nextId('rev'),
    nodeId: node.subtopic.id,
    chapterId: node.chapter.id,
    topicId: node.topic.id,
    subtopicId: node.subtopic.id,
    chapterName: node.chapter.name,
    topicName: node.topic.name,
    subject: node.subject.code,
    exam: 'jm',
    index: 1,
    scheduledFor: TODAY,
    completedAt: null,
    completedOn: null,
    confidence: null,
    note: '',
    auto: true,
    createdAt: new Date().toISOString(),
    ...patch,
  };
}

export function lecture(patch: Partial<Lecture> = {}): Lecture {
  const now = new Date().toISOString();
  return {
    id: nextId('lec'),
    title: 'Lecture 1',
    subject: 'phy',
    chapterId: null,
    topicId: null,
    exam: 'jm',
    number: 1,
    durationMin: 75,
    watchedMin: 0,
    status: 'not_started',
    source: 'Online',
    date: null,
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

export function attempt(patch: Partial<TestAttempt> = {}): TestAttempt {
  const attempted = patch.attempted ?? 25;
  const correct = patch.correct ?? 20;
  return {
    score: 80,
    max: 100,
    attempted,
    correct,
    wrong: patch.wrong ?? attempted - correct,
    unattempted: patch.unattempted ?? 0,
    accuracy: Math.round((correct / Math.max(1, attempted)) * 100),
    ...patch,
  };
}

export function testSubjects(patch: Partial<Record<'phy' | 'chem' | 'math', Partial<TestAttempt>>> = {}): TestSubjects {
  return {
    phy: attempt(patch.phy),
    chem: attempt(patch.chem),
    math: attempt(patch.math),
  };
}

export function testRecord(patch: Partial<TestRecord> = {}): TestRecord {
  const now = new Date().toISOString();
  const subjectsPatch = patch.subjects ?? testSubjects();
  const attempted = patch.attempted ?? subjectsPatch.phy.attempted + subjectsPatch.chem.attempted + subjectsPatch.math.attempted;
  const correct = patch.correct ?? subjectsPatch.phy.correct + subjectsPatch.chem.correct + subjectsPatch.math.correct;
  const wrong = patch.wrong ?? subjectsPatch.phy.wrong + subjectsPatch.chem.wrong + subjectsPatch.math.wrong;
  return {
    id: nextId('test'),
    name: 'Mock Test',
    date: TODAY,
    exam: 'jm',
    durationMin: 180,
    score: patch.score ?? subjectsPatch.phy.score + subjectsPatch.chem.score + subjectsPatch.math.score,
    maxMarks: patch.maxMarks ?? subjectsPatch.phy.max + subjectsPatch.chem.max + subjectsPatch.math.max,
    attempted,
    correct,
    wrong,
    unattempted: patch.unattempted ?? 0,
    accuracy: patch.accuracy ?? Math.round((correct / Math.max(1, attempted)) * 100),
    percentile: null,
    rank: null,
    subjects: subjectsPatch,
    notes: '',
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

export function progressMap(
  entries: { nodeId: string; exam?: ExamScope; patch?: Partial<TopicProgress> }[],
): TrackerSnapshot['progress'] {
  const out: TrackerSnapshot['progress'] = {};
  for (const entry of entries) {
    const exam = entry.exam ?? 'jm';
    out[entry.nodeId] = { ...(out[entry.nodeId] ?? {}), [exam]: progressRow(entry.patch) };
  }
  return out;
}
