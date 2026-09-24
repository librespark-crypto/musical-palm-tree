/**
 * Factual insights.
 *
 * Every sentence is derived from stored records and quotes the real numbers.
 * With an empty tracker the list is empty - there is nothing to say yet.
 */
import type { ExamScope, TrackerSnapshot } from '@/lib/types';
import { withIndex, type DerivedIndex } from '@/lib/calculations/derive';
import {
  activityByDay,
  chapterRows,
  mistakePatterns,
  overallAnalytics,
  studyTimeSummary,
} from '@/lib/calculations/analytics';
import { dimensionCoverage, scopeProgress } from '@/lib/calculations/progress';
import { revisionBuckets, revisionConsistency } from '@/lib/calculations/revision';
import { backlogSnapshot } from '@/lib/calculations/backlog';
import { formatMinutes, relativeDay, todayISO } from '@/lib/date';
import { SUBJECT_LABELS } from '@/lib/constants';

export type InsightTone = 'neutral' | 'warn' | 'good';

export interface Insight {
  id: string;
  text: string;
  tone: InsightTone;
  topicId?: string;
}

export function buildInsights(index: DerivedIndex, limit = 12): Insight[] {
  const out: Insight[] = [];
  const push = (id: string, text: string, tone: InsightTone = 'neutral', topicId?: string) => {
    out.push({ id, text, tone, ...(topicId ? { topicId } : {}) });
  };

  const today = todayISO();
  const jm = scopeProgress(index, 'jm');
  const ja = scopeProgress(index, 'ja');
  const overall = overallAnalytics(index);

  // ---- syllabus coverage
  if (jm.leaves > 0) {
    push(
      'jm-coverage',
      jm.remaining > 0
        ? `${jm.remaining} subtopics of the JEE Main syllabus are still incomplete (${jm.pct}% done, ${jm.completed}/${jm.leaves}).`
        : `JEE Main syllabus complete: ${jm.completed}/${jm.leaves} subtopics marked done.`,
      jm.remaining > 0 ? 'neutral' : 'good',
    );
  }
  if (ja.remaining > 0) {
    push('ja-coverage', `${ja.remaining} subtopics of the JEE Advanced scope are still pending (${ja.pct}% done).`);
  }

  // ---- revisions
  const buckets = revisionBuckets(index);
  if (buckets.overdue.length) {
    push('rev-overdue', `${buckets.overdue.length} revision${buckets.overdue.length > 1 ? 's are' : ' is'} overdue - the oldest was due ${relativeDay(buckets.overdue[0]!.scheduledFor)}.`, 'warn');
  }
  if (buckets.dueToday.length) {
    push('rev-today', `${buckets.dueToday.length} revision${buckets.dueToday.length > 1 ? 's are' : ' is'} scheduled for today.`);
  }
  const consistency = revisionConsistency(index);
  if (consistency.scheduled >= 5) {
    push(
      'rev-consistency',
      `Revision consistency over the last ${consistency.windowDays} days: ${consistency.rate}% (${consistency.completed}/${consistency.scheduled} completed${consistency.completedLate ? `, ${consistency.completedLate} late` : ''}).`,
      consistency.rate < 60 ? 'warn' : 'good',
    );
  }

  // ---- backlog
  const backlog = backlogSnapshot(index);
  if (backlog.counts.backlog) {
    push(
      'backlog',
      `${backlog.counts.backlog} task${backlog.counts.backlog > 1 ? 's' : ''} sit in the backlog (${formatMinutes(backlog.minutes.backlog)} of planned work${backlog.oldestBacklogDays ? `, oldest ${backlog.oldestBacklogDays} days old` : ''}).`,
      'warn',
    );
  }

  // ---- practice vs lectures
  const coverage = dimensionCoverage(index, 'jm');
  if (coverage.lecture >= 40 && coverage.lecture - coverage.practice >= 20) {
    push(
      'lecture-gap',
      `Lecture coverage (${coverage.lecture}%) is ${coverage.lecture - coverage.practice} points ahead of practice coverage (${coverage.practice}%) - watching is outrunning solving.`,
      'warn',
    );
  }

  // ---- questions
  const questions = overall.questions;
  if (questions.attempted > 0) {
    push(
      'questions',
      `${questions.attempted} questions attempted with ${questions.accuracy}% accuracy (${questions.minutesPerQuestion} min per question).`,
      questions.accuracy >= 65 ? 'good' : 'neutral',
    );
  }
  const perSubject = questions.bySubject;
  for (const entry of perSubject) {
    if (entry.attempted >= 40) {
      push(
        `acc-${entry.code}`,
        `${SUBJECT_LABELS[entry.code]} accuracy: ${entry.accuracy}% across ${entry.attempted} questions.`,
        entry.accuracy < 55 ? 'warn' : 'neutral',
      );
    }
  }

  // ---- weak topics
  if (overall.weakTopics.length) {
    const weakest = overall.weakTopics[0]!;
    push(
      'weak-topic',
      `Weakest area by mastery: ${weakest.name} (${weakest.chapter}, ${SUBJECT_LABELS[weakest.subject]}) - ${weakest.mastery}% mastery, ${weakest.reason.toLowerCase()}.`,
      'warn',
      weakest.id,
    );
  }
  if (overall.practiceGaps.length) {
    const gap = overall.practiceGaps[0]!;
    push('practice-gap', `Covered but rarely practised: ${gap.name} - ${gap.reason.toLowerCase()}.`, 'warn', gap.id);
  }

  // ---- mistakes
  const patterns = mistakePatterns(index);
  if (patterns.repeatedTopics.length) {
    const repeat = patterns.repeatedTopics[0]!;
    push('mistake-repeat', `Repeated mistakes: ${repeat.count} entries in ${repeat.name} (${repeat.types.join(', ')}).`, 'warn', repeat.nodeId);
  }
  if (patterns.byType.length && patterns.total >= 5) {
    const top = patterns.byType[0]!;
    push('mistake-type', `Most common mistake type: ${top.type} (${top.count} of ${patterns.total} logged entries).`);
  }
  if (patterns.open > 0 && patterns.total > 0) {
    push('mistake-open', `${patterns.open} mistake-book entr${patterns.open > 1 ? 'ies are' : 'y is'} still open.`, patterns.open > patterns.total / 2 ? 'warn' : 'neutral');
  }

  // ---- tests
  const tests = overall.tests;
  if (tests.count > 0 && tests.latest) {
    push(
      'test-latest',
      `Latest test: ${tests.latest.test.name} scored ${tests.latest.pct}% (${tests.latest.test.score}/${tests.latest.test.maxMarks})${tests.latest.delta !== null ? `, ${tests.latest.delta >= 0 ? 'up' : 'down'} ${Math.abs(tests.latest.delta)} points vs the previous test` : ''}.`,
      tests.latest.delta !== null && tests.latest.delta < 0 ? 'warn' : 'neutral',
    );
  }
  if (tests.subjectAverages.length >= 2) {
    const ranked = [...tests.subjectAverages].sort((a, b) => a.pct - b.pct);
    const weakest = ranked[0]!;
    const gap = ranked[ranked.length - 1]!.pct - weakest.pct;
    if (gap >= 8) {
      push('test-spread', `Subject gap across mocks: ${weakest.label} averages ${weakest.pct}% - ${gap} points behind your best subject.`, 'warn');
    }
  }

  // ---- time + consistency
  const time = studyTimeSummary(index);
  if (time.today > 0 || time.week > 0) {
    push('time', `Logged ${formatMinutes(time.today)} today and ${formatMinutes(time.week)} over the last 7 days.`);
  }
  if (overall.streak.current >= 2) {
    push('streak', `Current streak: ${overall.streak.current} day${overall.streak.current > 1 ? 's' : ''} (best ${overall.streak.best}).`, 'good');
  }
  const last14 = activityByDay(index, 14).filter((day) => day.activities >= 1).length;
  if (time.total > 0) {
    push('consistency', `${last14}/14 of the last days had tracked activity; ${overall.consistency30}/30 in the last month.`, last14 <= 7 ? 'warn' : 'good');
  }

  // ---- chapters worth attention
  if (jm.leaves > 0) {
    const chapters = chapterRows(index, 'jm')
      .filter((row) => row.leaves > 0 && row.pct < 100)
      .sort((a, b) => b.leaves * (100 - b.pct) - a.leaves * (100 - a.pct));
    const heaviest = chapters[0];
    if (heaviest) {
      push(
        'chapter-heavy',
        `${heaviest.name} (${SUBJECT_LABELS[heaviest.subject]}) has the most remaining work: ${heaviest.completed}/${heaviest.leaves} subtopics done.`,
        'neutral',
        heaviest.id,
      );
    }
  }

  void today;
  return out.slice(0, limit);
}

export function buildInsightsFor(snapshot: TrackerSnapshot, exam: ExamScope = 'jm', limit = 12): Insight[] {
  void exam;
  return buildInsights(withIndex(snapshot), limit);
}
