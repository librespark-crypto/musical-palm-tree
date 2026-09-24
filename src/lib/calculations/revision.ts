/**
 * Spaced-revision logic.
 *
 * Default interval ladder: 1 / 3 / 7 / 16 / 35 days. Completing revision N
 * schedules revision N+1, and finishing a subtopic auto-schedules revision 1.
 * Every date stays user-editable in the UI.
 */
import { EXAM_SCOPES } from '@/lib/types';
import type { Confidence, ExamScope, ISODate, RevisionRecord, Subtopic, StudyStatus, TrackerSnapshot } from '@/lib/types';
import { addDays, daysFromToday, todayISO, toISODate } from '@/lib/date';
import { percent, uid } from '@/lib/utils';
import { withIndex, type DerivedIndex } from '@/lib/calculations/derive';
import { nodeById } from '@/lib/syllabus';

export const DEFAULT_REVISION_INTERVALS = [1, 3, 7, 16, 35];
export const MAX_REVISION_INDEX = 5;

export interface RevisionBuckets {
  dueToday: RevisionRecord[];
  overdue: RevisionRecord[];
  upcoming: RevisionRecord[];
  completed: RevisionRecord[];
  total: number;
}

export function revisionBuckets(index: DerivedIndex, exam?: ExamScope | null): RevisionBuckets {
  const buckets: RevisionBuckets = { dueToday: [], overdue: [], upcoming: [], completed: [], total: 0 };
  for (const revision of index.snapshot.revisions) {
    if (exam && revision.exam !== exam) continue;
    buckets.total += 1;
    if (revision.completedAt) {
      buckets.completed.push(revision);
      continue;
    }
    const delta = daysFromToday(revision.scheduledFor);
    if (delta < 0) buckets.overdue.push(revision);
    else if (delta === 0) buckets.dueToday.push(revision);
    else buckets.upcoming.push(revision);
  }
  const byDate = (a: RevisionRecord, b: RevisionRecord) => (a.scheduledFor < b.scheduledFor ? -1 : a.scheduledFor > b.scheduledFor ? 1 : 0);
  buckets.dueToday.sort(byDate);
  buckets.overdue.sort(byDate);
  buckets.upcoming.sort(byDate);
  buckets.completed.sort((a, b) => ((a.completedAt ?? '') < (b.completedAt ?? '') ? 1 : -1));
  return buckets;
}

export interface RevisionConsistency {
  windowDays: number;
  scheduled: number;
  completed: number;
  completedLate: number;
  overdue: number;
  rate: number;
  /** Average delay in days for revisions completed after their due date. */
  averageDelayDays: number;
}

export function revisionConsistency(index: DerivedIndex, windowDays = 28): RevisionConsistency {
  const from = addDays(todayISO(), -(windowDays - 1));
  const today = todayISO();
  const inWindow = index.snapshot.revisions.filter((r) => r.scheduledFor >= from);
  const completed = inWindow.filter((r) => r.completedAt);
  const late = completed.filter((r) => (r.completedOn ?? toISODate(new Date(r.completedAt as string))) > r.scheduledFor);
  const overdue = inWindow.filter((r) => !r.completedAt && r.scheduledFor < today);
  const delays = late.map((r) => (r.completedOn ? daysFromToday(r.completedOn) - daysFromToday(r.scheduledFor) : 0));
  return {
    windowDays,
    scheduled: inWindow.length,
    completed: completed.length,
    completedLate: late.length,
    overdue: overdue.length,
    rate: percent(completed.length, inWindow.length),
    averageDelayDays: delays.length ? Math.round((delays.reduce((a, b) => a + b, 0) / delays.length) * 10) / 10 : 0,
  };
}

/** When should revision `nextIndex` (1-based) fall due? */
export function scheduleDateFor(nextIndex: number, intervals: readonly number[] = DEFAULT_REVISION_INTERVALS, from: ISODate = todayISO()): ISODate {
  const ladder = intervals.length ? intervals : DEFAULT_REVISION_INTERVALS;
  const clamped = Math.min(Math.max(nextIndex, 1), ladder.length);
  const gap = ladder[clamped - 1] ?? ladder[ladder.length - 1] ?? 1;
  return addDays(from, gap);
}

export interface RevisionDraftInput {
  subtopic: Subtopic;
  exam: ExamScope;
  index: number;
  scheduledFor: ISODate;
  auto: boolean;
}

/** Builds a revision record for a subtopic without touching storage. */
export function buildRevision(input: RevisionDraftInput): RevisionRecord | null {
  const node = nodeById(input.subtopic.id);
  if (!node || !node.chapter || !node.topic) return null;
  return {
    id: uid('rev'),
    nodeId: input.subtopic.id,
    chapterId: node.chapter.id,
    topicId: node.topic.id,
    subtopicId: node.subtopic?.id ?? input.subtopic.id,
    chapterName: node.chapter.name,
    topicName: node.topic.name,
    subject: node.subject.code,
    exam: input.exam,
    index: input.index,
    scheduledFor: input.scheduledFor,
    completedAt: null,
    completedOn: null,
    confidence: null,
    note: '',
    auto: input.auto,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Revisions that should exist after a batch of subtopics was marked complete.
 * Only schedules revision 1 when the subtopic has no open revision and no
 * completed revision at that index yet.
 */
export function autoRevisionDrafts(
  index: DerivedIndex,
  subtopics: readonly Subtopic[],
  exam: ExamScope,
  intervals: readonly number[] = DEFAULT_REVISION_INTERVALS,
): RevisionRecord[] {
  const drafts: RevisionRecord[] = [];
  for (const subtopic of subtopics) {
    if (!subtopic[exam]) continue;
    const existing = index.revisionsByNode.get(subtopic.id)?.filter((r) => r.exam === exam) ?? [];
    const hasOpen = existing.some((r) => !r.completedAt);
    if (hasOpen) continue;
    const completedCount = existing.filter((r) => r.completedAt).length;
    const progress = index.progress.get(subtopic.id)?.[exam];
    if (progress && progress.revisionCount > completedCount) continue;
    const draft = buildRevision({
      subtopic,
      exam,
      index: completedCount + 1,
      scheduledFor: scheduleDateFor(completedCount + 1, intervals),
      auto: true,
    });
    if (draft) drafts.push(draft);
  }
  return drafts;
}

/** Next revision record to create when revision `completed` is finished. */
export function nextRevisionAfter(index: DerivedIndex, completed: RevisionRecord, intervals: readonly number[] = DEFAULT_REVISION_INTERVALS): RevisionRecord | null {
  if (completed.index >= (intervals.length || MAX_REVISION_INDEX)) return null;
  const subtopicId = completed.subtopicId ?? completed.nodeId;
  const node = nodeById(subtopicId);
  if (!node) return null;
  const subtopic = node.subtopic;
  if (!subtopic) return null;
  const alreadyOpen = (index.revisionsByNode.get(subtopic.id) ?? []).some(
    (r) => r.exam === completed.exam && !r.completedAt && r.id !== completed.id,
  );
  if (alreadyOpen) return null;
  const draft = buildRevision({
    subtopic,
    exam: completed.exam,
    index: completed.index + 1,
    scheduledFor: scheduleDateFor(completed.index + 1, intervals, todayISO()),
    auto: true,
  });
  return draft;
}

export interface RevisionCalendarDay {
  date: ISODate;
  due: number;
  completed: number;
}

/** Load per day for the revision calendar strip. */
export function revisionCalendar(index: DerivedIndex, days = 28, exam?: ExamScope | null): RevisionCalendarDay[] {
  const out: RevisionCalendarDay[] = [];
  const today = todayISO();
  const from = addDays(today, -(days - 1));
  const map = new Map<string, RevisionCalendarDay>();
  for (const revision of index.snapshot.revisions) {
    if (exam && revision.exam !== exam) continue;
    const key = revision.completedOn ?? revision.scheduledFor;
    if (key < from || key > today) continue;
    const entry = map.get(key) ?? { date: key, due: 0, completed: 0 };
    if (revision.completedAt) entry.completed += 1;
    else entry.due += 1;
    map.set(key, entry);
  }
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = addDays(today, -i);
    out.push(map.get(date) ?? { date, due: 0, completed: 0 });
  }
  return out;
}

/** Revision counts by ladder step, used by the analytics screen. */
export function revisionLadder(index: DerivedIndex, exam?: ExamScope | null): { index: number; completed: number; open: number; overdue: number }[] {
  const out: { index: number; completed: number; open: number; overdue: number }[] = [];
  for (let i = 1; i <= MAX_REVISION_INDEX; i += 1) {
    const rows = index.snapshot.revisions.filter((r) => r.index === i && (!exam || r.exam === exam));
    out.push({
      index: i,
      completed: rows.filter((r) => r.completedAt).length,
      open: rows.filter((r) => !r.completedAt).length,
      overdue: rows.filter((r) => !r.completedAt && r.scheduledFor < todayISO()).length,
    });
  }
  return out;
}

/** Topics whose revisions are pending today or overdue, grouped by node. */
export interface DueRevisionGroup {
  nodeId: string;
  topicName: string;
  chapterName: string;
  subject: string;
  exam: ExamScope;
  revisions: RevisionRecord[];
  worstOverdueDays: number;
}

export function dueRevisionGroups(index: DerivedIndex, exam?: ExamScope | null): DueRevisionGroup[] {
  const buckets = revisionBuckets(index, exam);
  const relevant = [...buckets.overdue, ...buckets.dueToday];
  const groups = new Map<string, DueRevisionGroup>();
  for (const revision of relevant) {
    const key = `${revision.nodeId}|${revision.exam}`;
    const overdueDays = Math.max(0, -daysFromToday(revision.scheduledFor));
    const group = groups.get(key);
    if (group) {
      group.revisions.push(revision);
      group.worstOverdueDays = Math.max(group.worstOverdueDays, overdueDays);
    } else {
      groups.set(key, {
        nodeId: revision.nodeId,
        topicName: revision.topicName,
        chapterName: revision.chapterName,
        subject: revision.subject,
        exam: revision.exam,
        revisions: [revision],
        worstOverdueDays: overdueDays,
      });
    }
  }
  return [...groups.values()].sort((a, b) => b.worstOverdueDays - a.worstOverdueDays);
}

export function revisionStatusOf(progressRevisionCount: number, openIndexes: readonly number[]): StudyStatus | null {
  if (!openIndexes.length) return null;
  if (progressRevisionCount === 0) return 'revision_due';
  return 'revision_due';
}

export function confidenceDelta(before: Confidence | null, after: Confidence | null): number | null {
  if (!before || !after) return null;
  return after - before;
}

/** Convenience: how many revisions are scheduled per exam scope. */
export function revisionCountsByExam(snapshot: TrackerSnapshot): Record<ExamScope, number> {
  const index = withIndex(snapshot);
  const counts = { jm: 0, ja: 0 } as Record<ExamScope, number>;
  for (const scope of EXAM_SCOPES) {
    counts[scope] = index.snapshot.revisions.filter((r) => r.exam === scope && !r.completedAt).length;
  }
  return counts;
}
