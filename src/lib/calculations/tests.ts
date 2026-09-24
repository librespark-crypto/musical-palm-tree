/**
 * Test scoring + analysis.
 *
 * Marks, accuracy, per-subject attempts and (optional, user-entered) percentile
 * and rank. Nothing is estimated: when a field was not entered it stays null so
 * the UI can show "not recorded" instead of a fabricated number.
 */
import type { ExamScope, SubjectCode, TestAttempt, TestRecord, TestSubjects } from '@/lib/types';
import { emptyAccuracy } from '@/lib/calculations/progress';
import { percent, round1, sortBy } from '@/lib/utils';
import { SUBJECT_LABELS } from '@/lib/constants';
import type { DerivedIndex } from '@/lib/calculations/derive';

export function emptyAttempt(): TestAttempt {
  return { score: 0, max: 0, attempted: 0, correct: 0, wrong: 0, unattempted: 0, accuracy: 0 };
}

export function emptyTestSubjects(): TestSubjects {
  return { phy: emptyAttempt(), chem: emptyAttempt(), math: emptyAttempt() };
}

export function accuracyOf(attempted: number, correct: number): number {
  if (attempted <= 0) return 0;
  return Math.round((correct / attempted) * 100);
}

export function testPercent(test: Pick<TestRecord, 'score' | 'maxMarks'>): number {
  return percent(test.score, test.maxMarks);
}

export function testAttemptPercent(attempt: Pick<TestAttempt, 'score' | 'max'>): number {
  return percent(attempt.score, attempt.max);
}

/** Marks-per-question sanity helper used in the test form hint. */
export function unansweredCount(test: Pick<TestRecord, 'attempted' | 'correct' | 'wrong'>): number {
  return Math.max(0, test.attempted - test.correct - test.wrong);
}

export interface TestSummary {
  test: TestRecord;
  pct: number;
  accuracy: number;
  subjectPct: Record<SubjectCode, number>;
  /** Percentage-point change against the previous test of the same exam. */
  delta: number | null;
}

export function summariseTest(test: TestRecord, previous?: TestRecord): TestSummary {
  const pct = testPercent(test);
  return {
    test,
    pct,
    accuracy: test.accuracy || accuracyOf(test.attempted, test.correct),
    subjectPct: {
      phy: testAttemptPercent(test.subjects.phy),
      chem: testAttemptPercent(test.subjects.chem),
      math: testAttemptPercent(test.subjects.math),
    },
    delta: previous ? pct - testPercent(previous) : null,
  };
}

export interface TestAnalysis {
  summary: TestSummary;
  bySubject: { code: SubjectCode; label: string; pct: number; score: number; max: number; accuracy: number; attempted: number }[];
  strongest: { code: SubjectCode; label: string } | null;
  weakest: { code: SubjectCode; label: string } | null;
  /** Percentage-point gap between best and worst subject. */
  spread: number;
  history: TestSummary[];
  averagePct: number;
  bestPct: number;
  /** Linear trend of the last six tests, percentage points per test. */
  trendPerTest: number;
}

export function analyseTest(index: DerivedIndex, testId: string): TestAnalysis | null {
  const tests = sortBy(index.snapshot.tests, (t) => t.date, 'asc');
  const target = tests.find((t) => t.id === testId);
  if (!target) return null;
  const sameExam = tests.filter((t) => t.exam === target.exam);
  const position = sameExam.findIndex((t) => t.id === target.id);
  const previous = position > 0 ? sameExam[position - 1] : undefined;
  const summary = summariseTest(target, previous);

  const bySubject = (Object.keys(target.subjects) as SubjectCode[]).map((code) => {
    const attempt = target.subjects[code];
    return {
      code,
      label: SUBJECT_LABELS[code],
      pct: testAttemptPercent(attempt),
      score: attempt.score,
      max: attempt.max,
      accuracy: attempt.accuracy || accuracyOf(attempt.attempted, attempt.correct),
      attempted: attempt.attempted,
    };
  });

  const ranked = [...bySubject].sort((a, b) => b.pct - a.pct);
  const strongest = ranked[0] ? { code: ranked[0].code, label: ranked[0].label } : null;
  const weakestRaw = ranked[ranked.length - 1];
  const weakest = weakestRaw ? { code: weakestRaw.code, label: weakestRaw.label } : null;

  const history = sameExam.map((t, i) => summariseTest(t, i > 0 ? sameExam[i - 1] : undefined));
  const pcts = history.map((h) => h.pct);
  const tail = pcts.slice(-6);
  const trendPerTest = tail.length >= 2 ? round1((tail[tail.length - 1]! - tail[0]!) / (tail.length - 1)) : 0;

  return {
    summary,
    bySubject,
    strongest,
    weakest,
    spread: ranked.length >= 2 ? ranked[0]!.pct - ranked[ranked.length - 1]!.pct : 0,
    history,
    averagePct: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0,
    bestPct: pcts.length ? Math.max(...pcts) : 0,
    trendPerTest,
  };
}

export interface TestOverview {
  tests: TestSummary[];
  count: number;
  averagePct: number;
  bestTest: TestSummary | null;
  latest: TestSummary | null;
  /** Change vs the previous test, in percentage points. */
  latestDelta: number | null;
  subjectAverages: { code: SubjectCode; label: string; pct: number; tests: number; score: number; max: number }[];
  accuracy: number;
  attempts: { attempted: number; correct: number; wrong: number; unattempted: number };
  withPercentile: number;
}

export function testOverview(index: DerivedIndex, exam?: ExamScope | null): TestOverview {
  const filtered = sortBy(
    index.snapshot.tests.filter((t) => !exam || t.exam === exam),
    (t) => `${t.date}|${t.createdAt}`,
    'asc',
  );
  const summaries = filtered.map((t, i) => summariseTest(t, i > 0 ? filtered[i - 1] : undefined));
  const pcts = summaries.map((s) => s.pct);

  const subjectTotals = new Map<SubjectCode, { score: number; max: number; tests: number }>();
  for (const test of filtered) {
    for (const code of Object.keys(test.subjects) as SubjectCode[]) {
      const attempt = test.subjects[code];
      if (!attempt.max) continue;
      const entry = subjectTotals.get(code) ?? { score: 0, max: 0, tests: 0 };
      entry.score += attempt.score;
      entry.max += attempt.max;
      entry.tests += 1;
      subjectTotals.set(code, entry);
    }
  }

  const totals = filtered.reduce(
    (acc, t) => {
      acc.attempted += t.attempted;
      acc.correct += t.correct;
      acc.wrong += t.wrong;
      acc.unattempted += t.unattempted;
      return acc;
    },
    { attempted: 0, correct: 0, wrong: 0, unattempted: 0 },
  );

  const latest = summaries[summaries.length - 1] ?? null;

  return {
    tests: summaries,
    count: summaries.length,
    averagePct: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0,
    bestTest: sortBy(summaries, (s) => s.pct, 'desc')[0] ?? null,
    latest,
    latestDelta: latest?.delta ?? null,
    subjectAverages: [...subjectTotals.entries()].map(([code, value]) => ({
      code,
      label: SUBJECT_LABELS[code],
      pct: percent(value.score, value.max),
      tests: value.tests,
      score: value.score,
      max: value.max,
    })),
    accuracy: accuracyOf(totals.attempted, totals.correct),
    attempts: totals,
    withPercentile: filtered.filter((t) => t.percentile !== null).length,
  };
}

/** Average marks lost per subject across all tests - a concrete revision driver. */
export function marksLostBySubject(index: DerivedIndex, exam?: ExamScope | null): { code: SubjectCode; label: string; lost: number }[] {
  const tests = index.snapshot.tests.filter((t) => !exam || t.exam === exam);
  const map = new Map<SubjectCode, number>();
  for (const test of tests) {
    for (const code of Object.keys(test.subjects) as SubjectCode[]) {
      const attempt = test.subjects[code];
      const lost = Math.max(0, attempt.max - attempt.score);
      map.set(code, (map.get(code) ?? 0) + lost);
    }
  }
  return [...map.entries()]
    .map(([code, lost]) => ({ code, label: SUBJECT_LABELS[code], lost }))
    .sort((a, b) => b.lost - a.lost);
}

export function testTrendPoints(index: DerivedIndex, exam?: ExamScope | null): { date: string; pct: number; name: string; accuracy: number }[] {
  return sortBy(
    index.snapshot.tests.filter((t) => !exam || t.exam === exam),
    (t) => t.date,
    'asc',
  ).map((t) => ({ date: t.date, pct: testPercent(t), name: t.name, accuracy: accuracyOf(t.attempted, t.correct) }));
}

/** Convert a raw form payload into a normalised TestRecord (pure, testable). */
export interface TestInput {
  name: string;
  date: string;
  exam: ExamScope;
  durationMin: number;
  score: number;
  maxMarks: number;
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  percentile: number | null;
  rank: number | null;
  subjects: TestSubjects;
  notes: string;
}

export function normaliseTestInput(input: TestInput): Omit<TestRecord, 'id' | 'createdAt' | 'updatedAt'> {
  const subjects = { ...emptyTestSubjects(), ...input.subjects };
  for (const code of Object.keys(subjects) as SubjectCode[]) {
    const attempt = subjects[code];
    attempt.accuracy = accuracyOf(attempt.attempted, attempt.correct);
  }
  const attempted = input.attempted || 0;
  const correct = input.correct || 0;
  return {
    name: input.name.trim(),
    date: input.date,
    exam: input.exam,
    durationMin: input.durationMin || 0,
    score: input.score || 0,
    maxMarks: input.maxMarks || 0,
    attempted,
    correct,
    wrong: input.wrong || 0,
    unattempted: input.unattempted || 0,
    accuracy: accuracyOf(attempted, correct),
    percentile: input.percentile,
    rank: input.rank,
    subjects,
    notes: input.notes,
  };
}

export function testSubjectRows(test: TestRecord): { code: SubjectCode; label: string; attempt: TestAttempt; pct: number; accuracy: number }[] {
  return (['phy', 'chem', 'math'] as SubjectCode[]).map((code) => {
    const attempt = test.subjects[code] ?? emptyAttempt();
    return {
      code,
      label: SUBJECT_LABELS[code],
      attempt,
      pct: testAttemptPercent(attempt),
      accuracy: attempt.accuracy || accuracyOf(attempt.attempted, attempt.correct),
    };
  });
}

export function testScoreVsAccuracyData(index: DerivedIndex, exam?: ExamScope | null) {
  return testTrendPoints(index, exam).map((point) => ({ ...point }));
}

export { emptyAccuracy };
