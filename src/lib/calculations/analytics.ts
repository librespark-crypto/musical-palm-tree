/**
 * Analytics aggregations.
 *
 * Everything here is computed from stored records: an empty tracker yields
 * zeros and empty chart series rather than decorative placeholder numbers.
 * Results are memoised per derived index, and the derived index is memoised per
 * snapshot, so a screen render never recomputes these numbers twice.
 */
import type {
  AnalyticsRecord,
  ExamScope,
  ISODate,
  Mistake,
  MistakeType,
  QuestionLog,
  SubjectCode,
  TrackerSnapshot,
} from '@/lib/types';
import { addDays, eachDay, lastNDays, todayISO } from '@/lib/date';
import { percent, round1, sum, unique } from '@/lib/utils';
import { SUBJECT_LABELS } from '@/lib/constants';
import { nodeById, subtreeNodeIds } from '@/lib/syllabus';
import { withIndex, type DerivedIndex } from '@/lib/calculations/derive';
import {
  aggregateNode,
  isWeak,
  progressOf,
  scopeProgress,
  subjectProgress,
  type AccuracySummary,
  type ScopeProgress,
  type SubjectProgressSummary,
} from '@/lib/calculations/progress';
import { revisionBuckets, revisionConsistency, type RevisionBuckets, type RevisionConsistency } from '@/lib/calculations/revision';
import { testOverview, type TestOverview } from '@/lib/calculations/tests';
import { backlogSnapshot, type BacklogSnapshot } from '@/lib/calculations/backlog';

/* -------------------------------------------------------------------------- */
/* Daily activity                                                              */
/* -------------------------------------------------------------------------- */

function emptyRecord(date: ISODate): AnalyticsRecord {
  return {
    date,
    minutes: 0,
    questions: 0,
    correct: 0,
    tasksPlanned: 0,
    tasksCompleted: 0,
    revisionsScheduled: 0,
    revisionsCompleted: 0,
    mistakesLogged: 0,
    testsTaken: 0,
    activities: 0,
    minutesBySubject: {},
  };
}

/** One record per day over the requested window, oldest first. */
export function activityByDay(index: DerivedIndex, days: number, endISO: ISODate = todayISO()): AnalyticsRecord[] {
  const { from, to } = lastNDays(days, endISO);
  const map = new Map<string, AnalyticsRecord>();
  for (const date of eachDay(from, to)) map.set(date, emptyRecord(date));
  const pick = (date: string): AnalyticsRecord | null => map.get(date) ?? null;

  for (const session of index.snapshot.sessions) {
    const record = pick(session.start.slice(0, 10));
    if (!record) continue;
    record.minutes += session.minutes;
    record.minutesBySubject[session.subject] = (record.minutesBySubject[session.subject] ?? 0) + session.minutes;
    record.activities += 1;
  }

  for (const log of index.snapshot.questions) {
    const record = pick(log.date);
    if (!record) continue;
    record.questions += log.attempted;
    record.correct += log.correct;
    record.activities += 1;
  }

  for (const task of index.snapshot.tasks) {
    const planned = pick(task.plannedFor);
    if (planned) planned.tasksPlanned += 1;
    if (task.completedAt) {
      const completed = pick(task.completedAt.slice(0, 10));
      if (completed) {
        completed.tasksCompleted += 1;
        completed.activities += 1;
      }
    }
  }

  for (const revision of index.snapshot.revisions) {
    const scheduled = pick(revision.scheduledFor);
    if (scheduled) scheduled.revisionsScheduled += 1;
    if (revision.completedOn) {
      const done = pick(revision.completedOn);
      if (done) {
        done.revisionsCompleted += 1;
        done.activities += 1;
      }
    }
  }

  for (const mistake of index.snapshot.mistakes) {
    const record = pick(mistake.date);
    if (!record) continue;
    record.mistakesLogged += 1;
    record.activities += 0.5;
  }

  for (const test of index.snapshot.tests) {
    const record = pick(test.date);
    if (!record) continue;
    record.testsTaken += 1;
    record.activities += 1;
  }

  return [...map.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

export interface StreakInfo {
  current: number;
  best: number;
  activeDays: number;
}

export function streakInfo(index: DerivedIndex, today: ISODate = todayISO()): StreakInfo {
  const days = activityByDay(index, 365, today);
  let best = 0;
  let run = 0;
  for (const day of days) {
    if (day.activities >= 1) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  let current = 0;
  for (let i = days.length - 1; i >= 0; i -= 1) {
    const day = days[i];
    if (day && day.activities >= 1) current += 1;
    else break;
  }
  return { current, best: Math.max(best, current), activeDays: days.filter((d) => d.activities >= 1).length };
}

/* -------------------------------------------------------------------------- */
/* Study time                                                                  */
/* -------------------------------------------------------------------------- */

export interface StudyTimeSummary {
  today: number;
  yesterday: number;
  week: number;
  month: number;
  total: number;
  dailyAverage: number;
  bestDayMin: number;
  bestDayDate: ISODate | null;
}

export function minutesBetween(index: DerivedIndex, from: ISODate, to: ISODate): number {
  let total = 0;
  for (const session of index.snapshot.sessions) {
    const date = session.start.slice(0, 10);
    if (date >= from && date <= to) total += session.minutes;
  }
  return total;
}

export function studyTimeSummary(index: DerivedIndex, today: ISODate = todayISO()): StudyTimeSummary {
  const sessions = index.snapshot.sessions;
  const byDay = new Map<string, number>();
  for (const session of sessions) {
    const date = session.start.slice(0, 10);
    byDay.set(date, (byDay.get(date) ?? 0) + session.minutes);
  }
  let bestDayDate: ISODate | null = null;
  let bestDayMin = 0;
  for (const [date, minutes] of byDay) {
    if (minutes > bestDayMin) {
      bestDayMin = minutes;
      bestDayDate = date;
    }
  }
  const trackedDays = byDay.size || 1;
  return {
    today: minutesBetween(index, today, today),
    yesterday: minutesBetween(index, addDays(today, -1), addDays(today, -1)),
    week: minutesBetween(index, addDays(today, -6), today),
    month: minutesBetween(index, addDays(today, -29), today),
    total: sum(sessions, (s) => s.minutes),
    dailyAverage: Math.round(sum(sessions, (s) => s.minutes) / trackedDays),
    bestDayMin,
    bestDayDate,
  };
}

export function minutesBySubject(index: DerivedIndex, days?: number): Record<string, number> {
  const from = days ? addDays(todayISO(), -(days - 1)) : null;
  const out: Record<string, number> = {};
  for (const session of index.snapshot.sessions) {
    if (from && session.start.slice(0, 10) < from) continue;
    out[session.subject] = (out[session.subject] ?? 0) + session.minutes;
  }
  return out;
}

export function sessionModeBreakdown(index: DerivedIndex, days?: number): { mode: string; minutes: number }[] {
  const from = days ? addDays(todayISO(), -(days - 1)) : null;
  const map = new Map<string, number>();
  for (const session of index.snapshot.sessions) {
    if (from && session.start.slice(0, 10) < from) continue;
    map.set(session.mode, (map.get(session.mode) ?? 0) + session.minutes);
  }
  return [...map.entries()].map(([mode, minutes]) => ({ mode, minutes })).sort((a, b) => b.minutes - a.minutes);
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                   */
/* -------------------------------------------------------------------------- */

export interface QuestionOverview extends AccuracySummary {
  bySource: { source: string; attempted: number; correct: number; accuracy: number }[];
  byDifficulty: { difficulty: string; attempted: number; correct: number; accuracy: number }[];
  bySubject: { code: SubjectCode; label: string; attempted: number; correct: number; accuracy: number }[];
  days: number;
}

export function questionOverview(
  index: DerivedIndex,
  options: { exam?: ExamScope | null; days?: number; subject?: SubjectCode | null } = {},
): QuestionOverview {
  const { exam = null, days = 0, subject = null } = options;
  const from = days ? addDays(todayISO(), -(days - 1)) : null;
  const logs = index.snapshot.questions.filter(
    (log) => (!exam || log.exam === exam) && (!subject || log.subject === subject) && (!from || log.date >= from),
  );

  const totals = logs.reduce(
    (acc, log) => {
      acc.attempted += log.attempted;
      acc.correct += log.correct;
      acc.wrong += log.wrong;
      acc.unattempted += log.unattempted;
      acc.timeMin += log.timeMin;
      return acc;
    },
    { attempted: 0, correct: 0, wrong: 0, unattempted: 0, timeMin: 0 },
  );

  const group = (key: (log: QuestionLog) => string) => {
    const map = new Map<string, { attempted: number; correct: number }>();
    for (const log of logs) {
      const k = key(log);
      const entry = map.get(k) ?? { attempted: 0, correct: 0 };
      entry.attempted += log.attempted;
      entry.correct += log.correct;
      map.set(k, entry);
    }
    return [...map.entries()].map(([k, value]) => ({
      key: k,
      attempted: value.attempted,
      correct: value.correct,
      accuracy: value.attempted ? Math.round((value.correct / value.attempted) * 100) : 0,
    }));
  };

  return {
    attempted: totals.attempted,
    correct: totals.correct,
    wrong: totals.wrong,
    unattempted: totals.unattempted,
    timeMin: totals.timeMin,
    logs: logs.length,
    accuracy: totals.attempted ? Math.round((totals.correct / totals.attempted) * 100) : 0,
    minutesPerQuestion: totals.attempted ? round1(totals.timeMin / totals.attempted) : 0,
    bySource: group((log) => log.source).map((row) => ({ source: row.key, ...row })),
    byDifficulty: group((log) => log.difficulty).map((row) => ({ difficulty: row.key, ...row })),
    bySubject: group((log) => log.subject).map((row) => ({
      code: row.key as SubjectCode,
      label: SUBJECT_LABELS[row.key as SubjectCode] ?? row.key,
      attempted: row.attempted,
      correct: row.correct,
      accuracy: row.accuracy,
    })),
    days,
  };
}

export interface AccuracyPoint {
  date: ISODate;
  accuracy: number;
  attempted: number;
}

export function accuracyTrend(index: DerivedIndex, limit = 15): AccuracyPoint[] {
  const logs = [...index.snapshot.questions].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-limit);
  return logs.map((log) => ({
    date: log.date,
    attempted: log.attempted,
    accuracy: log.attempted ? Math.round((log.correct / log.attempted) * 100) : 0,
  }));
}

export function dailyAccuracy(index: DerivedIndex, days = 30): AccuracyPoint[] {
  return activityByDay(index, days)
    .filter((record) => record.questions > 0)
    .map((record) => ({
      date: record.date,
      accuracy: Math.round((record.correct / record.questions) * 100),
      attempted: record.questions,
    }));
}

/* -------------------------------------------------------------------------- */
/* Topic quality lists                                                         */
/* -------------------------------------------------------------------------- */

export interface TopicQualityRow {
  id: string;
  name: string;
  chapter: string;
  chapterId: string;
  subject: SubjectCode;
  subjectName: string;
  exam: ExamScope;
  mastery: number;
  coverage: number;
  accuracy: number;
  attempted: number;
  completed: number;
  total: number;
  weak: boolean;
  revisionDue: number;
  reason: string;
  score: number;
}

interface TopicQualityOptions {
  exam?: ExamScope;
  subject?: SubjectCode | null;
  limit?: number;
}

function collectTopicRows(index: DerivedIndex, exam: ExamScope, subject?: SubjectCode | null): TopicQualityRow[] {
  const rows: TopicQualityRow[] = [];
  for (const node of index.subjects) {
    if (subject && node.code !== subject) continue;
    for (const chapter of node.chapters) {
      for (const topic of chapter.topics) {
        const leaves = topic.subs.filter((sub) => sub[exam]);
        if (!leaves.length) continue;
        const aggregate = aggregateNode(index, topic.id, exam);
        const progress = progressOf(index, topic.id, exam);
        rows.push({
          id: topic.id,
          name: topic.name,
          chapter: chapter.name,
          chapterId: chapter.id,
          subject: node.code,
          subjectName: node.name,
          exam,
          mastery: aggregate.mastery,
          coverage: aggregate.coverage,
          accuracy: aggregate.questions.accuracy,
          attempted: aggregate.questions.attempted,
          completed: aggregate.completed,
          total: aggregate.total,
          weak: isWeak(progress) || aggregate.weak > 0,
          revisionDue: aggregate.revisionDue,
          reason: '',
          score: 0,
        });
      }
    }
  }
  return rows;
}

export function weakTopics(index: DerivedIndex, options: TopicQualityOptions = {}): TopicQualityRow[] {
  const { exam = 'jm', subject = null, limit = 10 } = options;
  const rows = collectTopicRows(index, exam, subject).map((row) => {
    const lowAccuracy = row.attempted >= 8 && row.accuracy < 60;
    const lowMastery = row.mastery < 45 && (row.completed > 0 || row.coverage > 0);
    const reason = row.weak
      ? 'Flagged weak'
      : lowAccuracy
        ? `Low accuracy (${row.accuracy}% over ${row.attempted} questions)`
        : row.revisionDue > 0
          ? `${row.revisionDue} revision${row.revisionDue > 1 ? 's' : ''} pending`
          : lowMastery
            ? `Low mastery (${row.mastery}%)`
            : 'Partially covered';
    const penalty = (row.weak ? 25 : 0) + (lowAccuracy ? 20 : 0) + row.revisionDue * 5;
    return { ...row, reason, score: row.mastery - penalty };
  });
  const candidates = rows.filter(
    (row) => row.weak || (row.attempted >= 8 && row.accuracy < 60) || (row.mastery < 45 && row.coverage > 0) || row.revisionDue > 0,
  );
  return candidates.sort((a, b) => a.score - b.score).slice(0, limit);
}

export function strongTopics(index: DerivedIndex, options: TopicQualityOptions = {}): TopicQualityRow[] {
  const { exam = 'jm', subject = null, limit = 8 } = options;
  return collectTopicRows(index, exam, subject)
    .filter((row) => row.attempted >= 10 && row.accuracy >= 65)
    .sort((a, b) => b.accuracy - a.accuracy || b.mastery - a.mastery)
    .slice(0, limit)
    .map((row) => ({ ...row, reason: `${row.accuracy}% accuracy over ${row.attempted} questions` }));
}

/** Topics that are covered but never practised - the classic JEE trap. */
export function practiceGaps(index: DerivedIndex, exam: ExamScope, limit = 12): TopicQualityRow[] {
  return collectTopicRows(index, exam)
    .filter((row) => row.coverage >= 40 && row.attempted < 5)
    .sort((a, b) => b.coverage - a.coverage)
    .slice(0, limit)
    .map((row) => ({ ...row, reason: `${row.coverage}% coverage but only ${row.attempted} questions logged` }));
}

export interface ChapterRow {
  id: string;
  name: string;
  unit: string;
  subject: SubjectCode;
  subjectName: string;
  jm: boolean;
  ja: boolean;
  pct: number;
  mastery: number;
  coverage: number;
  topics: number;
  leaves: number;
  completed: number;
  weak: number;
  revisionDue: number;
  questions: AccuracySummary;
  mistakes: number;
  timeMin: number;
  lectures: number;
  lecturesCompleted: number;
}

export function chapterRows(index: DerivedIndex, exam: ExamScope, subject?: SubjectCode | null): ChapterRow[] {
  const rows: ChapterRow[] = [];
  for (const node of index.subjects) {
    if (subject && node.code !== subject) continue;
    for (const chapter of node.chapters) {
      const aggregate = aggregateNode(index, chapter.id, exam);
      const scoped = (index.lecturesByChapter.get(chapter.id) ?? []).filter((l) => l.exam === 'both' || l.exam === exam);
      const mistakes = subtreeNodeIds(chapter.id).reduce(
        (total, id) => total + (index.mistakesByNode.get(id) ?? []).length,
        0,
      );
      rows.push({
        id: chapter.id,
        name: chapter.name,
        unit: chapter.unit ?? '',
        subject: node.code,
        subjectName: node.name,
        jm: chapter.jm,
        ja: chapter.ja,
        pct: aggregate.pct,
        mastery: aggregate.mastery,
        coverage: aggregate.coverage,
        topics: chapter.topics.length,
        leaves: aggregate.total,
        completed: aggregate.completed,
        weak: aggregate.weak,
        revisionDue: aggregate.revisionDue,
        questions: aggregate.questions,
        mistakes,
        timeMin: aggregate.timeMin,
        lectures: scoped.length,
        lecturesCompleted: scoped.filter((l) => l.status === 'completed').length,
      });
    }
  }
  return rows;
}

/* -------------------------------------------------------------------------- */
/* Mistakes                                                                    */
/* -------------------------------------------------------------------------- */

export interface MistakePatterns {
  total: number;
  open: number;
  byType: { type: MistakeType | 'Unspecified'; count: number }[];
  bySubject: { code: SubjectCode; label: string; count: number }[];
  bySource: { source: string; count: number }[];
  repeatedTopics: { nodeId: string; name: string; subject: string; count: number; types: string[] }[];
  revisedThisWeek: number;
}

export function mistakePatterns(index: DerivedIndex): MistakePatterns {
  const mistakes = index.snapshot.mistakes;
  const typeMap = new Map<string, number>();
  const subjectMap = new Map<string, number>();
  const sourceMap = new Map<string, number>();
  const nodeMap = new Map<string, Mistake[]>();

  for (const mistake of mistakes) {
    typeMap.set(mistake.mistakeType, (typeMap.get(mistake.mistakeType) ?? 0) + 1);
    subjectMap.set(mistake.subject, (subjectMap.get(mistake.subject) ?? 0) + 1);
    const source = mistake.source || 'Unspecified';
    sourceMap.set(source, (sourceMap.get(source) ?? 0) + 1);
    if (mistake.nodeId) {
      const list = nodeMap.get(mistake.nodeId);
      if (list) list.push(mistake);
      else nodeMap.set(mistake.nodeId, [mistake]);
    }
  }

  const weekAgo = addDays(todayISO(), -6);

  return {
    total: mistakes.length,
    open: mistakes.filter((m) => m.status === 'open').length,
    byType: [...typeMap.entries()]
      .map(([type, count]) => ({ type: type as MistakeType | 'Unspecified', count }))
      .sort((a, b) => b.count - a.count),
    bySubject: [...subjectMap.entries()].map(([code, count]) => ({
      code: code as SubjectCode,
      label: SUBJECT_LABELS[code as SubjectCode] ?? code,
      count,
    })),
    bySource: [...sourceMap.entries()].map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count),
    repeatedTopics: [...nodeMap.entries()]
      .filter(([, list]) => list.length >= 2)
      .map(([nodeId, list]) => ({
        nodeId,
        name: nodeById(nodeId)?.name ?? nodeId,
        subject: SUBJECT_LABELS[list[0]!.subject] ?? list[0]!.subject,
        count: list.length,
        types: unique(list.map((m) => m.mistakeType)),
      }))
      .sort((a, b) => b.count - a.count),
    revisedThisWeek: mistakes.filter((m) => m.lastRevised && m.lastRevised >= weekAgo).length,
  };
}

/* -------------------------------------------------------------------------- */
/* Lectures                                                                    */
/* -------------------------------------------------------------------------- */

export interface LectureStats {
  total: number;
  completed: number;
  inProgress: number;
  notStarted: number;
  durationMin: number;
  watchedMin: number;
  bySubject: { code: SubjectCode; label: string; total: number; completed: number; durationMin: number; watchedMin: number }[];
}

export function lectureStats(index: DerivedIndex, exam?: ExamScope | null): LectureStats {
  const lectures = index.snapshot.lectures.filter((l) => !exam || l.exam === 'both' || l.exam === exam);
  const map = new Map<SubjectCode, LectureStats['bySubject'][number]>();
  for (const lecture of lectures) {
    const entry =
      map.get(lecture.subject) ??
      ({ code: lecture.subject, label: SUBJECT_LABELS[lecture.subject], total: 0, completed: 0, durationMin: 0, watchedMin: 0 } as LectureStats['bySubject'][number]);
    entry.total += 1;
    entry.durationMin += lecture.durationMin;
    entry.watchedMin += lecture.status === 'completed' ? lecture.durationMin : lecture.watchedMin;
    if (lecture.status === 'completed') entry.completed += 1;
    map.set(lecture.subject, entry);
  }
  return {
    total: lectures.length,
    completed: lectures.filter((l) => l.status === 'completed').length,
    inProgress: lectures.filter((l) => l.status === 'in_progress').length,
    notStarted: lectures.filter((l) => l.status === 'not_started').length,
    durationMin: sum(lectures, (l) => l.durationMin),
    watchedMin: sum(lectures, (l) => (l.status === 'completed' ? l.durationMin : l.watchedMin)),
    bySubject: [...map.values()].sort((a, b) => b.total - a.total),
  };
}

/* -------------------------------------------------------------------------- */
/* Overall                                                                     */
/* -------------------------------------------------------------------------- */

export interface OverallAnalytics {
  generatedAt: string;
  jm: ScopeProgress;
  ja: ScopeProgress;
  subjects: SubjectProgressSummary[];
  studyTime: StudyTimeSummary;
  streak: StreakInfo;
  questions: QuestionOverview;
  lectures: LectureStats;
  revision: RevisionBuckets;
  revisionConsistency: RevisionConsistency;
  tests: TestOverview;
  backlog: BacklogSnapshot;
  mistakes: MistakePatterns;
  weakTopics: TopicQualityRow[];
  strongTopics: TopicQualityRow[];
  practiceGaps: TopicQualityRow[];
  consistency30: number;
}

const overviewCache = new WeakMap<DerivedIndex, OverallAnalytics>();

export function overallAnalytics(index: DerivedIndex): OverallAnalytics {
  const cached = overviewCache.get(index);
  if (cached) return cached;

  const result: OverallAnalytics = {
    generatedAt: new Date().toISOString(),
    jm: scopeProgress(index, 'jm'),
    ja: scopeProgress(index, 'ja'),
    subjects: index.subjects.map((subject) => subjectProgress(index, subject.code, 'jm')),
    studyTime: studyTimeSummary(index),
    streak: streakInfo(index),
    questions: questionOverview(index),
    lectures: lectureStats(index),
    revision: revisionBuckets(index),
    revisionConsistency: revisionConsistency(index),
    tests: testOverview(index),
    backlog: backlogSnapshot(index),
    mistakes: mistakePatterns(index),
    weakTopics: weakTopics(index, { exam: 'jm', limit: 12 }),
    strongTopics: strongTopics(index, { exam: 'jm', limit: 10 }),
    practiceGaps: practiceGaps(index, 'jm', 8),
    consistency30: activityByDay(index, 30).filter((day) => day.activities >= 1).length,
  };

  overviewCache.set(index, result);
  return result;
}

export function overallFor(snapshot: TrackerSnapshot): OverallAnalytics {
  return overallAnalytics(withIndex(snapshot));
}

/** Activity heatmap levels (0-4) used by the calendar strip. */
export function heatLevel(activities: number): 0 | 1 | 2 | 3 | 4 {
  if (activities >= 4) return 4;
  if (activities >= 2.5) return 3;
  if (activities >= 1) return 2;
  if (activities > 0) return 1;
  return 0;
}

export { percent };
