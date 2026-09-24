/**
 * Derived indexes.
 *
 * Analytics needs per-node lookups (questions, revisions, lectures, sessions)
 * for ~850 subtopics. Re-scanning the raw arrays for every node would be
 * O(nodes x records); instead every computation goes through one memoised index
 * that is built once per snapshot revision (the store hands out a new snapshot
 * object whenever data changes, so a WeakMap cache is exact and cheap).
 */
import type {
  ExamScope,
  Lecture,
  Mistake,
  QuestionLog,
  RevisionRecord,
  StudySession,
  StudyTask,
  Subject,
  Subtopic,
  TestRecord,
  TrackerSnapshot,
} from '@/lib/types';
import { allSubtopics } from '@/lib/syllabus';
import { daysFromToday } from '@/lib/date';

export interface RevisionState {
  dueToday: number;
  overdue: number;
  upcoming: number;
  completed: number;
  next: RevisionRecord | null;
  openIndexes: number[];
}

const EMPTY_REVISION_STATE: RevisionState = {
  dueToday: 0,
  overdue: 0,
  upcoming: 0,
  completed: 0,
  next: null,
  openIndexes: [],
};

export interface DerivedIndex {
  snapshot: TrackerSnapshot;
  subjects: Subject[];
  subtopics: Subtopic[];
  progress: Map<string, Partial<Record<ExamScope, import('@/lib/types').TopicProgress>>>;
  questionsByNode: Map<string, QuestionLog[]>;
  questionsByTopic: Map<string, QuestionLog[]>;
  questionsByChapter: Map<string, QuestionLog[]>;
  questionsBySubject: Map<string, QuestionLog[]>;
  revisionsByNode: Map<string, RevisionRecord[]>;
  revisionState: Map<string, RevisionState>;
  openRevisions: RevisionRecord[];
  lecturesByTopic: Map<string, Lecture[]>;
  lecturesByChapter: Map<string, Lecture[]>;
  lecturesBySubject: Map<string, Lecture[]>;
  sessionsByDay: Map<string, StudySession[]>;
  sessionsBySubject: Map<string, StudySession[]>;
  questionsByDay: Map<string, QuestionLog[]>;
  mistakesByNode: Map<string, Mistake[]>;
  mistakesByDay: Map<string, Mistake[]>;
  testsByDate: Map<string, TestRecord[]>;
  tasksByDay: Map<string, StudyTask[]>;
}

function push<K, V>(map: Map<K, V[]>, key: K | null | undefined, value: V): void {
  if (!key) return;
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

export function emptyIndex(snapshot: TrackerSnapshot): DerivedIndex {
  return {
    snapshot,
    subjects: snapshot.subjects,
    subtopics: [...allSubtopics],
    progress: new Map(),
    questionsByNode: new Map(),
    questionsByTopic: new Map(),
    questionsByChapter: new Map(),
    questionsBySubject: new Map(),
    revisionsByNode: new Map(),
    revisionState: new Map(),
    openRevisions: [],
    lecturesByTopic: new Map(),
    lecturesByChapter: new Map(),
    lecturesBySubject: new Map(),
    sessionsByDay: new Map(),
    sessionsBySubject: new Map(),
    questionsByDay: new Map(),
    mistakesByNode: new Map(),
    mistakesByDay: new Map(),
    testsByDate: new Map(),
    tasksByDay: new Map(),
  };
}

function build(snapshot: TrackerSnapshot): DerivedIndex {
  const index = emptyIndex(snapshot);

  for (const [nodeId, byExam] of Object.entries(snapshot.progress)) index.progress.set(nodeId, byExam);

  for (const log of snapshot.questions) {
    if (log.nodeId) push(index.questionsByNode, log.nodeId, log);
    push(index.questionsByTopic, log.topicId, log);
    push(index.questionsByChapter, log.chapterId, log);
    push(index.questionsBySubject, log.subject, log);
    push(index.questionsByDay, log.date, log);
  }

  for (const revision of snapshot.revisions) {
    push(index.revisionsByNode, revision.nodeId, revision);
    if (!revision.completedAt) index.openRevisions.push(revision);
  }

  for (const [nodeId, revisions] of index.revisionsByNode) {
    for (const exam of ['jm', 'ja'] as const) {
      const scoped = revisions.filter((r) => r.exam === exam);
      if (!scoped.length) continue;
      const state: RevisionState = { ...EMPTY_REVISION_STATE, openIndexes: [] };
      let next: RevisionRecord | null = null;
      for (const revision of scoped) {
        if (revision.completedAt) {
          state.completed += 1;
          continue;
        }
        state.openIndexes.push(revision.index);
        const delta = daysFromToday(revision.scheduledFor);
        if (delta < 0) state.overdue += 1;
        else if (delta === 0) state.dueToday += 1;
        else state.upcoming += 1;
        if (!next || revision.scheduledFor < next.scheduledFor) next = revision;
      }
      state.next = next;
      index.revisionState.set(`${nodeId}|${exam}`, state);
    }
  }
  index.openRevisions.sort((a, b) => (a.scheduledFor < b.scheduledFor ? -1 : 1));

  for (const lecture of snapshot.lectures) {
    push(index.lecturesByTopic, lecture.topicId, lecture);
    push(index.lecturesByChapter, lecture.chapterId, lecture);
    push(index.lecturesBySubject, lecture.subject, lecture);
  }

  for (const session of snapshot.sessions) {
    push(index.sessionsByDay, session.start.slice(0, 10), session);
    push(index.sessionsBySubject, session.subject, session);
  }

  for (const mistake of snapshot.mistakes) {
    push(index.mistakesByNode, mistake.nodeId, mistake);
    push(index.mistakesByDay, mistake.date, mistake);
  }

  for (const test of snapshot.tests) push(index.testsByDate, test.date, test);
  for (const task of snapshot.tasks) push(index.tasksByDay, task.plannedFor, task);

  return index;
}

const cache = new WeakMap<TrackerSnapshot, DerivedIndex>();

export function withIndex(snapshot: TrackerSnapshot): DerivedIndex {
  const cached = cache.get(snapshot);
  if (cached) return cached;
  const built = build(snapshot);
  cache.set(snapshot, built);
  return built;
}

export function revisionStateFor(index: DerivedIndex, nodeId: string, exam: ExamScope): RevisionState {
  return index.revisionState.get(`${nodeId}|${exam}`) ?? EMPTY_REVISION_STATE;
}
