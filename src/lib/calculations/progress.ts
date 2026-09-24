/**
 * Progress maths: dimension coverage, mastery and node aggregation.
 *
 * The model (documented in the UI as well):
 *   coverage = weighted mean of theory/lecture/DPP/PYQ/practice, plus up to 12%
 *              for completed spaced revisions
 *   mastery  = coverage x accuracy factor, where the accuracy factor only
 *              applies once 5+ questions are logged for that node
 *   A node flagged "weak" can never exceed 45% mastery, and a completed node
 *   with >75% coverage is floored at 70% so the number matches reality.
 */
import { DIMENSION_KEYS, DIMENSION_WEIGHTS, REVISION_TARGET_COUNT, REVISION_WEIGHT } from '@/lib/constants';
import { clamp, percent, round1 } from '@/lib/utils';
import type { Confidence, DimensionKey, DimensionStatus, ExamScope, StudyStatus, Subtopic, TopicProgress, TrackerSnapshot } from '@/lib/types';
import { withIndex, type DerivedIndex } from '@/lib/calculations/derive';
import { leavesOf, nodeById, subtreeNodeIds } from '@/lib/syllabus';

export function emptyProgress(): TopicProgress {
  return {
    status: 'not_started',
    weak: false,
    theory: 'none',
    lecture: 'none',
    dpp: 'none',
    pyq: 'none',
    practice: 'none',
    revisionCount: 0,
    confidence: null,
    difficulty: null,
    lastStudied: null,
    lastRevision: null,
    nextRevision: null,
    timeMin: 0,
    note: '',
  };
}

/** Always returns a complete record; never mutates the snapshot. */
export function progressOf(index: DerivedIndex, nodeId: string, exam: ExamScope): TopicProgress {
  const stored = index.progress.get(nodeId)?.[exam];
  if (!stored) return emptyProgress();
  return { ...emptyProgress(), ...stored };
}

export function progressFor(snapshot: TrackerSnapshot, nodeId: string, exam: ExamScope): TopicProgress {
  return progressOf(withIndex(snapshot), nodeId, exam);
}

const DIMENSION_VALUE: Record<DimensionStatus, number> = { none: 0, partial: 0.5, done: 1 };

/** 0..1 weighted coverage of a single subtopic. */
export function coverageOf(progress: TopicProgress): number {
  let weighted = 0;
  for (const key of DIMENSION_KEYS) {
    weighted += DIMENSION_VALUE[progress[key]] * DIMENSION_WEIGHTS[key];
  }
  const revisionBonus = clamp(progress.revisionCount / REVISION_TARGET_COUNT, 0, 1) * REVISION_WEIGHT;
  return clamp(weighted * (1 - REVISION_WEIGHT) + revisionBonus, 0, 1);
}

export interface AccuracySummary {
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  timeMin: number;
  logs: number;
  accuracy: number;
  minutesPerQuestion: number;
}

export function emptyAccuracy(): AccuracySummary {
  return { attempted: 0, correct: 0, wrong: 0, unattempted: 0, timeMin: 0, logs: 0, accuracy: 0, minutesPerQuestion: 0 };
}

export function questionStats(index: DerivedIndex, nodeId: string, exam?: ExamScope | null): AccuracySummary {
  let attempted = 0;
  let correct = 0;
  let wrong = 0;
  let unattempted = 0;
  let timeMin = 0;
  let entries = 0;
  // Questions logged against any descendant count towards the node aggregate,
  // so "questions solved in this chapter" is the real number.
  const counted = new Set<string>();
  for (const id of subtreeNodeIds(nodeId)) {
    for (const log of index.questionsByNode.get(id) ?? []) {
      if (counted.has(log.id)) continue;
      if (exam && log.exam !== exam) continue;
      counted.add(log.id);
      attempted += log.attempted;
      correct += log.correct;
      wrong += log.wrong;
      unattempted += log.unattempted;
      timeMin += log.timeMin;
      entries += 1;
    }
  }
  return {
    attempted,
    correct,
    wrong,
    unattempted,
    timeMin,
    logs: entries,
    accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
    minutesPerQuestion: attempted ? round1(timeMin / attempted) : 0,
  };
}

/** Mastery of one subtopic, 0..100. */
export function masteryOf(index: DerivedIndex, nodeId: string, exam: ExamScope): number {
  const progress = progressOf(index, nodeId, exam);
  const coverage = coverageOf(progress);
  const stats = questionStats(index, nodeId, exam);

  let factor = 1;
  if (stats.attempted >= 5) {
    factor = clamp(0.55 + (stats.accuracy / 100 - 0.4) * 0.75, 0.45, 1.05);
  }

  let mastery = coverage * factor * 100;
  if (progress.status === 'weak' || (progress.weak && progress.status !== 'completed')) {
    mastery = Math.min(mastery, 45);
  }
  if (progress.status === 'completed' && coverage > 0.75) mastery = Math.max(mastery, 70);
  return clamp(Math.round(mastery), 0, 100);
}

export function isWeak(progress: TopicProgress): boolean {
  return progress.weak || progress.status === 'weak';
}

export interface NodeAggregate {
  nodeId: string;
  exam: ExamScope;
  leaves: Subtopic[];
  total: number;
  completed: number;
  learning: number;
  weak: number;
  notStarted: number;
  revisionDue: number;
  coverage: number;
  mastery: number;
  pct: number;
  questions: AccuracySummary;
  dimensions: Record<DimensionKey, { done: number; partial: number; none: number }>;
  revisionCount: number;
  timeMin: number;
}

export function aggregateNode(index: DerivedIndex, nodeId: string, exam: ExamScope): NodeAggregate {
  const leaves = leavesOf(nodeId, exam);

  const dimensions = DIMENSION_KEYS.reduce(
    (acc, key) => {
      acc[key] = { done: 0, partial: 0, none: 0 };
      return acc;
    },
    {} as NodeAggregate['dimensions'],
  );

  let completed = 0;
  let learning = 0;
  let weak = 0;
  let notStarted = 0;
  let revisionDue = 0;
  let coverageSum = 0;
  let masterySum = 0;
  let revisionCount = 0;
  let timeMin = 0;

  for (const leaf of leaves) {
    const progress = progressOf(index, leaf.id, exam);
    if (progress.status === 'completed') completed += 1;
    else if (progress.status === 'learning') learning += 1;
    else notStarted += 1;
    if (isWeak(progress)) weak += 1;

    for (const key of DIMENSION_KEYS) {
      const value = progress[key];
      dimensions[key][value === 'done' ? 'done' : value === 'partial' ? 'partial' : 'none'] += 1;
    }

    const revision = index.revisionState.get(`${leaf.id}|${exam}`);
    if (revision && revision.dueToday + revision.overdue > 0) revisionDue += 1;

    coverageSum += coverageOf(progress);
    masterySum += masteryOf(index, leaf.id, exam);
    revisionCount += progress.revisionCount;
    timeMin += progress.timeMin;
  }

  const total = leaves.length;
  const coverage = total ? coverageSum / total : 0;

  return {
    nodeId,
    exam,
    leaves,
    total,
    completed,
    learning,
    weak,
    notStarted,
    revisionDue,
    coverage: Math.round(coverage * 100),
    mastery: total ? Math.round(masterySum / total) : 0,
    pct: percent(completed, total),
    questions: questionStats(index, nodeId, exam),
    dimensions,
    revisionCount,
    timeMin,
  };
}

/**
 * Aggregate status used for list rows where the node may be a chapter or topic.
 *
 * A due revision is surfaced before "completed": finishing the syllabus is not
 * the same as remembering it, and the tree is the main reminder surface.
 */
export function aggregateStatus(aggregate: NodeAggregate): StudyStatus {
  if (!aggregate.total) return 'not_started';
  if (aggregate.revisionDue > 0) return 'revision_due';
  if (aggregate.completed === aggregate.total) return 'completed';
  if (aggregate.weak > 0 && aggregate.completed + aggregate.weak >= aggregate.total * 0.5) return 'weak';
  if (aggregate.completed + aggregate.learning + aggregate.weak === 0) return 'not_started';
  return 'learning';
}

/** The status a row should display, factoring in pending revisions. */
export function displayStatus(index: DerivedIndex, nodeId: string, exam: ExamScope): StudyStatus {
  const node = nodeById(nodeId);
  if (node && node.kind !== 'subtopic') return aggregateStatus(aggregateNode(index, nodeId, exam));
  const progress = progressOf(index, nodeId, exam);
  const revision = index.revisionState.get(`${nodeId}|${exam}`);
  if (progress.status !== 'not_started' && revision && revision.dueToday + revision.overdue > 0) return 'revision_due';
  if (isWeak(progress)) return 'weak';
  return progress.status;
}

export interface SubjectProgressSummary {
  code: string;
  name: string;
  chapters: number;
  topics: number;
  leaves: number;
  completed: number;
  learning: number;
  weak: number;
  notStarted: number;
  pct: number;
  mastery: number;
  coverage: number;
  revisionDue: number;
  timeMin: number;
  questions: AccuracySummary;
  lectures: { total: number; completed: number; watchedMin: number; durationMin: number };
  jm: { leaves: number; completed: number; pct: number };
  ja: { leaves: number; completed: number; pct: number };
}

export function subjectProgress(index: DerivedIndex, code: string, exam: ExamScope): SubjectProgressSummary {
  const subject = index.subjects.find((s) => s.code === code);
  if (!subject) {
    return {
      code,
      name: code,
      chapters: 0,
      topics: 0,
      leaves: 0,
      completed: 0,
      learning: 0,
      weak: 0,
      notStarted: 0,
      pct: 0,
      mastery: 0,
      coverage: 0,
      revisionDue: 0,
      timeMin: 0,
      questions: emptyAccuracy(),
      lectures: { total: 0, completed: 0, watchedMin: 0, durationMin: 0 },
      jm: { leaves: 0, completed: 0, pct: 0 },
      ja: { leaves: 0, completed: 0, pct: 0 },
    };
  }

  const scope = (scopeExam: ExamScope) => {
    let leaves = 0;
    let completed = 0;
    for (const chapter of subject.chapters) {
      for (const topic of chapter.topics) {
        for (const sub of topic.subs) {
          if (!sub[scopeExam]) continue;
          leaves += 1;
          if (progressOf(index, sub.id, scopeExam).status === 'completed') completed += 1;
        }
      }
    }
    return { leaves, completed, pct: percent(completed, leaves) };
  };

  let leaves = 0;
  let completed = 0;
  let learning = 0;
  let weak = 0;
  let notStarted = 0;
  let revisionDue = 0;
  let coverageSum = 0;
  let masterySum = 0;
  let timeMin = 0;
  let topics = 0;

  for (const chapter of subject.chapters) {
    for (const topic of chapter.topics) {
      topics += 1;
      for (const sub of topic.subs) {
        if (!sub[exam]) continue;
        leaves += 1;
        const progress = progressOf(index, sub.id, exam);
        if (progress.status === 'completed') completed += 1;
        else if (progress.status === 'learning') learning += 1;
        else notStarted += 1;
        if (isWeak(progress)) weak += 1;
        const revision = index.revisionState.get(`${sub.id}|${exam}`);
        if (revision && revision.dueToday + revision.overdue > 0) revisionDue += 1;
        coverageSum += coverageOf(progress);
        masterySum += masteryOf(index, sub.id, exam);
        timeMin += progress.timeMin;
      }
    }
  }

  const lectures = (index.lecturesBySubject.get(code) ?? []).filter((l) => l.exam === 'both' || l.exam === exam);
  const allLectures = index.lecturesBySubject.get(code) ?? [];

  return {
    code,
    name: subject.name,
    chapters: subject.chapters.length,
    topics,
    leaves,
    completed,
    learning,
    weak,
    notStarted,
    pct: percent(completed, leaves),
    mastery: leaves ? Math.round(masterySum / leaves) : 0,
    coverage: leaves ? Math.round((coverageSum / leaves) * 100) : 0,
    revisionDue,
    timeMin,
    questions: subjectQuestions(index, code, exam),
    lectures: {
      total: lectures.length,
      completed: lectures.filter((l) => l.status === 'completed').length,
      watchedMin: lectures.reduce((a, l) => a + (l.status === 'completed' ? l.durationMin : l.watchedMin), 0),
      durationMin: allLectures.reduce((a, l) => a + l.durationMin, 0),
    },
    jm: scope('jm'),
    ja: scope('ja'),
  };
}

function subjectQuestions(index: DerivedIndex, code: string, exam: ExamScope): AccuracySummary {
  const logs = (index.questionsBySubject.get(code) ?? []).filter((q) => q.exam === exam);
  let attempted = 0;
  let correct = 0;
  let wrong = 0;
  let unattempted = 0;
  let timeMin = 0;
  for (const log of logs) {
    attempted += log.attempted;
    correct += log.correct;
    wrong += log.wrong;
    unattempted += log.unattempted;
    timeMin += log.timeMin;
  }
  return {
    attempted,
    correct,
    wrong,
    unattempted,
    timeMin,
    logs: logs.length,
    accuracy: attempted ? Math.round((correct / attempted) * 100) : 0,
    minutesPerQuestion: attempted ? round1(timeMin / attempted) : 0,
  };
}

export interface ScopeProgress {
  exam: ExamScope;
  leaves: number;
  completed: number;
  learning: number;
  weak: number;
  notStarted: number;
  remaining: number;
  pct: number;
  mastery: number;
  coverage: number;
  revisionDue: number;
}

export function scopeProgress(index: DerivedIndex, exam: ExamScope): ScopeProgress {
  let leaves = 0;
  let completed = 0;
  let learning = 0;
  let weak = 0;
  let notStarted = 0;
  let revisionDue = 0;
  let masterySum = 0;
  let coverageSum = 0;

  for (const subject of index.subjects) {
    for (const chapter of subject.chapters) {
      for (const topic of chapter.topics) {
        for (const sub of topic.subs) {
          if (!sub[exam]) continue;
          leaves += 1;
          const progress = progressOf(index, sub.id, exam);
          if (progress.status === 'completed') completed += 1;
          else if (progress.status === 'learning') learning += 1;
          else notStarted += 1;
          if (isWeak(progress)) weak += 1;
          const revision = index.revisionState.get(`${sub.id}|${exam}`);
          if (revision && revision.dueToday + revision.overdue > 0) revisionDue += 1;
          masterySum += masteryOf(index, sub.id, exam);
          coverageSum += coverageOf(progress);
        }
      }
    }
  }

  return {
    exam,
    leaves,
    completed,
    learning,
    weak,
    notStarted,
    remaining: leaves - completed,
    pct: percent(completed, leaves),
    mastery: leaves ? Math.round(masterySum / leaves) : 0,
    coverage: leaves ? Math.round((coverageSum / leaves) * 100) : 0,
    revisionDue,
  };
}

const DIMENSION_VALUE_TOTAL: Record<DimensionStatus, number> = { none: 0, partial: 0.5, done: 1 };

/** Weighted dimension coverage across a scope (used by analytics). */
export function dimensionCoverage(index: DerivedIndex, exam: ExamScope): Record<DimensionKey, number> {
  const totals: Record<DimensionKey, number> = { theory: 0, lecture: 0, dpp: 0, pyq: 0, practice: 0 };
  let leaves = 0;
  for (const subject of index.subjects) {
    for (const chapter of subject.chapters) {
      for (const topic of chapter.topics) {
        for (const sub of topic.subs) {
          if (!sub[exam]) continue;
          leaves += 1;
          const progress = progressOf(index, sub.id, exam);
          for (const key of DIMENSION_KEYS) totals[key] += DIMENSION_VALUE_TOTAL[progress[key]];
        }
      }
    }
  }
  return {
    theory: leaves ? Math.round((totals.theory / leaves) * 100) : 0,
    lecture: leaves ? Math.round((totals.lecture / leaves) * 100) : 0,
    dpp: leaves ? Math.round((totals.dpp / leaves) * 100) : 0,
    pyq: leaves ? Math.round((totals.pyq / leaves) * 100) : 0,
    practice: leaves ? Math.round((totals.practice / leaves) * 100) : 0,
  };
}

export function confidenceLabel(confidence: Confidence | null): string {
  if (!confidence) return 'Not rated';
  return ['', 'Very low', 'Low', 'Medium', 'High', 'Very high'][confidence] ?? 'Not rated';
}
