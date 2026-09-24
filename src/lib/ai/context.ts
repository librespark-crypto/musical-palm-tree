/**
 * Builds the data packet the AI sees.
 *
 * Only stored tracker data goes in, and it is deliberately summarised (not the
 * raw record dump) so the model can reason about it without burning the whole
 * context window. The same packet is used by the rule-based coach, which is why
 * both produce recommendations that match the numbers on screen.
 */
import type { ExamScope, TrackerSnapshot } from '@/lib/types';
import { withIndex } from '@/lib/calculations/derive';
import { overallAnalytics, questionOverview, studyTimeSummary } from '@/lib/calculations/analytics';
import { aggregateNode, dimensionCoverage, scopeProgress } from '@/lib/calculations/progress';
import { revisionBuckets, revisionConsistency } from '@/lib/calculations/revision';
import { backlogSnapshot } from '@/lib/calculations/backlog';
import { testOverview } from '@/lib/calculations/tests';
import { formatMinutes, todayISO } from '@/lib/date';
import { nodeById, syllabusCounts, syllabusMeta } from '@/lib/syllabus';
import { SUBJECT_LABELS } from '@/lib/constants';

export interface AiContext {
  generatedAt: string;
  today: string;
  countdown: { label: string; mainInDays: number; mainDate: string; advancedInDays: number; advancedDate: string };
  syllabusSource: { main: string; advanced: string; retrieved: string; counts: typeof syllabusCounts };
  scope: {
    jm: { leaves: number; completed: number; pct: number; mastery: number; weak: number; revisionsDue: number };
    ja: { leaves: number; completed: number; pct: number; mastery: number; weak: number; revisionsDue: number };
  };
  coverage: Record<string, number>;
  subjects: { subject: string; jmPct: number; jaPct: number; mastery: number; lecturesDone: string; questions: number; accuracy: number }[];
  studyTime: { today: number; week: number; month: number; total: number; streak: number; bestStreak: number };
  backlog: { open: number; overdue: number; minutes: number; oldestDays: number };
  revisions: { dueToday: number; overdue: number; upcoming: number; completed: number; consistency28d: number; ladder: { index: number; completed: number; open: number; overdue: number }[] };
  questions: { attempted: number; correct: number; accuracy: number; minutesPerQuestion: number; bySubject: { subject: string; attempted: number; accuracy: number }[]; bySource: { source: string; attempted: number; accuracy: number }[] };
  lectures: { total: number; completed: number; inProgress: number; watchedHours: number; remainingHours: number };
  tests: { count: number; averagePct: number; latest: { name: string; date: string; pct: number; accuracy: number } | null; trendPerTest: number; subjects: { subject: string; pct: number }[] };
  mistakes: { total: number; open: number; byType: { type: string; count: number }[]; repeatedTopics: { name: string; count: number; types: string[] }[] };
  weakTopics: { name: string; chapter: string; subject: string; exam: string; mastery: number; accuracy: number; attempted: number; reason: string }[];
  strongTopics: { name: string; chapter: string; subject: string; accuracy: number; attempted: number }[];
  practiceGaps: { name: string; chapter: string; subject: string; coverage: number; attempted: number }[];
  notes: string[];
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildAiContext(snapshot: TrackerSnapshot, exam: ExamScope = 'jm'): AiContext {
  const index = withIndex(snapshot);
  const overall = overallAnalytics(index);
  const time = studyTimeSummary(index);
  const buckets = revisionBuckets(index);
  const backlog = backlogSnapshot(index);
  const tests = testOverview(index);
  const questions = questionOverview(index);
  const coverage = dimensionCoverage(index, exam);
  const today = todayISO();
  const mainInDays = Math.round(
    (new Date(snapshot.settings.profile.mainDate).getTime() - new Date(today).getTime()) / 86_400_000,
  );
  const advancedInDays = Math.round(
    (new Date(snapshot.settings.profile.advancedDate).getTime() - new Date(today).getTime()) / 86_400_000,
  );

  return {
    generatedAt: new Date().toISOString(),
    today,
    countdown: {
      label: snapshot.settings.profile.examLabel,
      mainInDays,
      mainDate: snapshot.settings.profile.mainDate,
      advancedInDays,
      advancedDate: snapshot.settings.profile.advancedDate,
    },
    syllabusSource: {
      main: syllabusMeta.mainSource,
      advanced: syllabusMeta.advancedSource,
      retrieved: syllabusMeta.retrieved,
      counts: syllabusCounts,
    },
    scope: {
      jm: scopeSummary(index, 'jm'),
      ja: scopeSummary(index, 'ja'),
    },
    coverage,
    subjects: overall.subjects.map((subject) => ({
      subject: subject.name,
      jmPct: subject.jm.pct,
      jaPct: subject.ja.pct,
      mastery: subject.mastery,
      lecturesDone: `${subject.lectures.completed}/${subject.lectures.total}`,
      questions: subject.questions.attempted,
      accuracy: subject.questions.accuracy,
    })),
    studyTime: {
      today: time.today,
      week: time.week,
      month: time.month,
      total: time.total,
      streak: overall.streak.current,
      bestStreak: overall.streak.best,
    },
    backlog: {
      open: backlog.counts.backlog,
      overdue: backlog.counts.overdue,
      minutes: backlog.minutes.backlog,
      oldestDays: backlog.oldestBacklogDays,
    },
    revisions: {
      dueToday: buckets.dueToday.length,
      overdue: buckets.overdue.length,
      upcoming: buckets.upcoming.length,
      completed: buckets.completed.length,
      consistency28d: revisionConsistency(index).rate,
      ladder: ladderOf(index),
    },
    questions: {
      attempted: questions.attempted,
      correct: questions.correct,
      accuracy: questions.accuracy,
      minutesPerQuestion: questions.minutesPerQuestion,
      bySubject: questions.bySubject.map((row) => ({ subject: row.label, attempted: row.attempted, accuracy: row.accuracy })),
      bySource: questions.bySource.map((row) => ({ source: row.source, attempted: row.attempted, accuracy: row.accuracy })),
    },
    lectures: {
      total: overall.lectures.total,
      completed: overall.lectures.completed,
      inProgress: overall.lectures.inProgress,
      watchedHours: round(overall.lectures.watchedMin / 60),
      remainingHours: round(Math.max(0, overall.lectures.durationMin - overall.lectures.watchedMin) / 60),
    },
    tests: {
      count: tests.count,
      averagePct: tests.averagePct,
      latest: tests.latest
        ? { name: tests.latest.test.name, date: tests.latest.test.date, pct: tests.latest.pct, accuracy: tests.latest.accuracy }
        : null,
      trendPerTest: trendOf(tests.tests.map((summary) => summary.pct)),
      subjects: tests.subjectAverages.map((row) => ({ subject: row.label, pct: row.pct })),
    },
    mistakes: {
      total: overall.mistakes.total,
      open: overall.mistakes.open,
      byType: overall.mistakes.byType.map((row) => ({ type: String(row.type), count: row.count })),
      repeatedTopics: overall.mistakes.repeatedTopics.slice(0, 6).map((row) => ({ name: row.name, count: row.count, types: row.types })),
    },
    weakTopics: overall.weakTopics.slice(0, 10).map((row) => ({
      name: row.name,
      chapter: row.chapter,
      subject: SUBJECT_LABELS[row.subject] ?? row.subject,
      exam: row.exam,
      mastery: row.mastery,
      accuracy: row.accuracy,
      attempted: row.attempted,
      reason: row.reason,
    })),
    strongTopics: overall.strongTopics.slice(0, 6).map((row) => ({
      name: row.name,
      chapter: row.chapter,
      subject: SUBJECT_LABELS[row.subject] ?? row.subject,
      accuracy: row.accuracy,
      attempted: row.attempted,
    })),
    practiceGaps: overall.practiceGaps.slice(0, 6).map((row) => ({
      name: row.name,
      chapter: row.chapter,
      subject: SUBJECT_LABELS[row.subject] ?? row.subject,
      coverage: row.coverage,
      attempted: row.attempted,
    })),
    notes: [
      questions.attempted === 0 ? 'No questions have been logged yet.' : '',
      time.total === 0 ? 'No study time has been logged yet.' : '',
      tests.count === 0 ? 'No mock tests have been recorded yet.' : '',
      `Study-time goal: ${formatMinutes(snapshot.settings.profile.dailyTargetMin)} per day.`,
    ].filter(Boolean),
  };
}

/** Least-squares slope of the last few test percentages (points per test). */
function trendOf(percentages: number[]): number {
  const points = percentages.slice(-6);
  if (points.length < 2) return 0;
  const n = points.length;
  const meanX = (n - 1) / 2;
  const meanY = points.reduce((total, value) => total + value, 0) / n;
  let numerator = 0;
  let denominator = 0;
  points.forEach((value, index) => {
    numerator += (index - meanX) * (value - meanY);
    denominator += (index - meanX) ** 2;
  });
  if (!denominator) return 0;
  return round(numerator / denominator);
}

function scopeSummary(index: ReturnType<typeof withIndex>, exam: ExamScope) {
  const progress = scopeProgress(index, exam);
  return {
    leaves: progress.leaves,
    completed: progress.completed,
    pct: progress.pct,
    mastery: progress.mastery,
    weak: progress.weak,
    revisionsDue: progress.revisionDue,
  };
}

function ladderOf(index: ReturnType<typeof withIndex>) {
  const out: { index: number; completed: number; open: number; overdue: number }[] = [];
  for (let step = 1; step <= 5; step += 1) {
    const rows = index.snapshot.revisions.filter((revision) => revision.index === step);
    out.push({
      index: step,
      completed: rows.filter((revision) => revision.completedAt).length,
      open: rows.filter((revision) => !revision.completedAt).length,
      overdue: rows.filter((revision) => !revision.completedAt && revision.scheduledFor < todayISO()).length,
    });
  }
  return out;
}

/** Compact "what the user is looking at" hint attached to a specific topic. */
export function nodeContextFor(snapshot: TrackerSnapshot, nodeId: string | null): string | null {
  if (!nodeId) return null;
  const node = nodeById(nodeId);
  if (!node) return null;
  const index = withIndex(snapshot);
  const lines = [`Node: ${node.name} (${node.kind})`, `Subject: ${node.subject.name}`];
  if (node.chapter) lines.push(`Chapter: ${node.chapter.name}${node.chapter.unit ? ` (${node.chapter.unit})` : ''}`);
  if (node.topic && node.topic.id !== node.id) lines.push(`Topic: ${node.topic.name}`);
  lines.push(`Syllabus scope: ${node.jm ? 'JEE Main' : ''}${node.jm && node.ja ? ' + ' : ''}${node.ja ? 'JEE Advanced' : ''}`);
  for (const exam of ['jm', 'ja'] as ExamScope[]) {
    const aggregate = aggregateNode(index, node.id, exam);
    if (!aggregate.total) continue;
    lines.push(
      `${exam.toUpperCase()}: ${aggregate.completed}/${aggregate.total} complete, coverage ${aggregate.coverage}%, mastery ${aggregate.mastery}%, questions ${aggregate.questions.attempted} @ ${aggregate.questions.accuracy}% accuracy, revisions due ${aggregate.revisionDue}`,
    );
  }
  return lines.join('\n');
}
