import { describe, expect, it } from 'vitest';
import {
  accuracyOf,
  analyseTest,
  emptyTestSubjects,
  marksLostBySubject,
  normaliseTestInput,
  summariseTest,
  testAttemptPercent,
  testOverview,
  testPercent,
  testScoreVsAccuracyData,
  testSubjectRows,
  testTrendPoints,
  unansweredCount,
} from '@/lib/calculations/tests';
import { withIndex } from '@/lib/calculations/derive';
import { attempt, dayOffset, snapshot, testRecord, testSubjects } from './helpers';

describe('accuracy', () => {
  it('rounds to whole percent and guards against zero attempts', () => {
    expect(accuracyOf(20, 15)).toBe(75);
    expect(accuracyOf(3, 1)).toBe(33);
    expect(accuracyOf(0, 0)).toBe(0);
    expect(accuracyOf(-5, 2)).toBe(0);
  });

  it('derives unanswered questions from the attempt counts', () => {
    expect(unansweredCount({ attempted: 20, correct: 15, wrong: 2 })).toBe(3);
    expect(unansweredCount({ attempted: 10, correct: 10, wrong: 0 })).toBe(0);
  });
});

describe('test percent', () => {
  it('scores a paper out of its total marks', () => {
    expect(testPercent({ score: 150, maxMarks: 300 })).toBe(50);
    expect(testPercent({ score: 0, maxMarks: 300 })).toBe(0);
    expect(testPercent({ score: 250, maxMarks: 0 })).toBe(0);
  });

  it('scores a subject attempt out of its subject maximum', () => {
    expect(testAttemptPercent({ score: 30, max: 100 })).toBe(30);
    expect(testAttemptPercent({ score: 100, max: 100 })).toBe(100);
  });
});

describe('test summary', () => {
  it('reports totals, accuracy and per-subject percentages', () => {
    const test = testRecord({
      subjects: testSubjects({
        phy: { score: 40, max: 100, attempted: 25, correct: 20, wrong: 5 },
        chem: { score: 60, max: 100, attempted: 25, correct: 22, wrong: 3 },
        math: { score: 80, max: 100, attempted: 25, correct: 24, wrong: 1 },
      }),
      score: 180,
      maxMarks: 300,
    });
    const summary = summariseTest(test);

    expect(summary.pct).toBe(60);
    expect(summary.accuracy).toBe(88);
    expect(summary.subjectPct).toEqual({ phy: 40, chem: 60, math: 80 });
    expect(summary.delta).toBeNull();
  });

  it('computes the delta against the previous test of the same exam', () => {
    const older = testRecord({ name: 'Test 1', score: 150, maxMarks: 300 });
    const newer = testRecord({ name: 'Test 2', score: 180, maxMarks: 300 });
    expect(summariseTest(newer, older).delta).toBe(10);
    expect(summariseTest(older, newer).delta).toBe(-10);
  });
});

describe('normaliseTestInput', () => {
  it('fills the subjects that were left out and recomputes accuracy', () => {
    const input = normaliseTestInput({
      name: '  Mock Test 4  ',
      date: dayOffset(-3),
      exam: 'ja',
      durationMin: 180,
      score: 120,
      maxMarks: 300,
      attempted: 30,
      correct: 24,
      wrong: 6,
      unattempted: 6,
      percentile: 91.2,
      rank: 4200,
      subjects: {
        phy: { ...attempt({ attempted: 10, correct: 8, wrong: 2, score: 40, max: 100 }) },
        chem: { score: 40, max: 100, attempted: 10, correct: 8, wrong: 2, unattempted: 2, accuracy: 0 },
        math: { score: 40, max: 100, attempted: 10, correct: 8, wrong: 2, unattempted: 2, accuracy: 0 },
      },
      notes: 'Silly errors again',
    });

    expect(input.name).toBe('Mock Test 4');
    expect(input.accuracy).toBe(80);
    expect(input.percentile).toBe(91.2);
    expect(input.rank).toBe(4200);
    expect(input.subjects.chem.accuracy).toBe(80);
    expect(input.subjects.math.accuracy).toBe(80);
  });

  it('keeps the empty subject template complete', () => {
    const subjects = emptyTestSubjects();
    expect(Object.keys(subjects).sort()).toEqual(['chem', 'math', 'phy']);
    expect(subjects.phy.attempted).toBe(0);
  });
});

describe('test overview', () => {
  const jmNew = testRecord({
    name: 'Main Full 3',
    date: dayOffset(-1),
    exam: 'jm',
    score: 210,
    maxMarks: 300,
    subjects: testSubjects({
      phy: { score: 60, max: 100, attempted: 25, correct: 21, wrong: 4 },
      chem: { score: 70, max: 100, attempted: 25, correct: 23, wrong: 2 },
      math: { score: 80, max: 100, attempted: 25, correct: 24, wrong: 1 },
    }),
    percentile: 99.1,
  });
  const jmOld = testRecord({
    name: 'Main Full 2',
    date: dayOffset(-20),
    exam: 'jm',
    score: 150,
    maxMarks: 300,
    subjects: testSubjects({
      phy: { score: 40, max: 100, attempted: 24, correct: 16, wrong: 8 },
      chem: { score: 50, max: 100, attempted: 24, correct: 18, wrong: 6 },
      math: { score: 60, max: 100, attempted: 24, correct: 20, wrong: 4 },
    }),
  });
  const jaTest = testRecord({ name: 'Advanced Paper 1', date: dayOffset(-5), exam: 'ja', score: 120, maxMarks: 180 });
  const index = withIndex(snapshot({ tests: [jmOld, jmNew, jaTest] }));

  it('separates the two exam scopes', () => {
    expect(testOverview(index, 'jm').count).toBe(2);
    expect(testOverview(index, 'ja').count).toBe(1);
    expect(testOverview(index, null).count).toBe(3);
  });

  it('reports averages, best test and the latest delta', () => {
    const overview = testOverview(index, 'jm');
    expect(overview.averagePct).toBe(60);
    expect(overview.bestTest?.test.name).toBe('Main Full 3');
    expect(overview.latest?.test.name).toBe('Main Full 3');
    expect(overview.latestDelta).toBe(20);
    expect(overview.withPercentile).toBe(1);
  });

  it('totals attempts across tests of the scope only', () => {
    const overview = testOverview(index, 'jm');
    expect(overview.attempts.attempted).toBe(147);
    expect(overview.attempts.correct).toBe(122);
    expect(overview.attempts.wrong).toBe(25);
    expect(overview.accuracy).toBe(83);
  });

  it('averages subject percentages across the scope', () => {
    const rows = testOverview(index, 'jm').subjectAverages;
    expect(rows.map((row) => row.code)).toEqual(['phy', 'chem', 'math']);
    expect(rows[0]?.pct).toBe(50);
    expect(rows[0]?.score).toBe(100);
    expect(rows[0]?.max).toBe(200);
  });

  it('draws the trend in chronological order', () => {
    const points = testTrendPoints(index, 'jm');
    expect(points.map((point) => point.name)).toEqual(['Main Full 2', 'Main Full 3']);
    expect(points[0]?.pct).toBe(50);
    expect(points[1]?.pct).toBe(70);
    expect(points[0]?.accuracy).toBe(75);
  });
});

describe('test analysis', () => {
  const tests = [
    testRecord({
      name: 'Main Full 1',
      date: dayOffset(-40),
      exam: 'jm',
      score: 120,
      maxMarks: 300,
      subjects: testSubjects({
        phy: { score: 20, max: 100, attempted: 24, correct: 12, wrong: 12 },
        chem: { score: 40, max: 100, attempted: 24, correct: 18, wrong: 6 },
        math: { score: 60, max: 100, attempted: 24, correct: 21, wrong: 3 },
      }),
    }),
    testRecord({
      name: 'Main Full 2',
      date: dayOffset(-20),
      exam: 'jm',
      score: 150,
      maxMarks: 300,
      subjects: testSubjects({
        phy: { score: 30, max: 100, attempted: 24, correct: 14, wrong: 10 },
        chem: { score: 50, max: 100, attempted: 24, correct: 19, wrong: 5 },
        math: { score: 70, max: 100, attempted: 24, correct: 22, wrong: 2 },
      }),
    }),
    testRecord({
      name: 'Main Full 3',
      date: dayOffset(-2),
      exam: 'jm',
      score: 180,
      maxMarks: 300,
      subjects: testSubjects({
        phy: { score: 40, max: 100, attempted: 24, correct: 16, wrong: 8 },
        chem: { score: 60, max: 100, attempted: 24, correct: 20, wrong: 4 },
        math: { score: 80, max: 100, attempted: 24, correct: 23, wrong: 1 },
      }),
    }),
  ];
  const index = withIndex(snapshot({ tests }));

  it('returns null for an unknown test', () => {
    expect(analyseTest(index, 'nope')).toBeNull();
  });

  it('ranks subjects, reporting strongest and weakest', () => {
    const target = tests[2];
    const analysis = analyseTest(index, target ? target.id : '');
    expect(analysis).not.toBeNull();
    expect(analysis?.strongest?.code).toBe('math');
    expect(analysis?.weakest?.code).toBe('phy');
    expect(analysis?.spread).toBe(40);
    expect(analysis?.bySubject.find((row) => row.code === 'phy')?.accuracy).toBe(67);
  });

  it('tracks the trend across tests of the same exam', () => {
    const target = tests[2];
    const analysis = analyseTest(index, target ? target.id : '');
    expect(analysis?.history).toHaveLength(3);
    expect(analysis?.averagePct).toBe(50);
    expect(analysis?.bestPct).toBe(60);
    expect(analysis?.trendPerTest).toBe(10);
  });

  it('produces score vs accuracy points for the chart', () => {
    const points = testScoreVsAccuracyData(index, 'jm');
    expect(points).toHaveLength(3);
    expect(points[0]?.accuracy).toBeGreaterThan(0);
  });
});

describe('marks lost', () => {
  it('sums the marks a subject gave away, worst first', () => {
    const index = withIndex(
      snapshot({
        tests: [
          testRecord({
            exam: 'jm',
            subjects: testSubjects({
              phy: { score: 30, max: 100, attempted: 25, correct: 15, wrong: 10 },
              chem: { score: 80, max: 100, attempted: 25, correct: 23, wrong: 2 },
              math: { score: 60, max: 100, attempted: 25, correct: 20, wrong: 5 },
            }),
          }),
          testRecord({
            exam: 'ja',
            subjects: testSubjects({
              phy: { score: 20, max: 60, attempted: 25, correct: 10, wrong: 15 },
              chem: { score: 50, max: 60, attempted: 25, correct: 22, wrong: 3 },
              math: { score: 40, max: 60, attempted: 25, correct: 18, wrong: 7 },
            }),
          }),
        ],
      }),
    );

    const jmOnly = marksLostBySubject(index, 'jm');
    expect(jmOnly.map((row) => row.code)).toEqual(['phy', 'math', 'chem']);
    expect(jmOnly[0]?.lost).toBe(70);
    expect(jmOnly[0]?.label).toBe('Physics');

    const both = marksLostBySubject(index, null);
    expect(both[0]?.lost).toBe(110);
  });
});

describe('subject rows', () => {
  it('always returns three rows in physics/chemistry/maths order', () => {
    const rows = testSubjectRows(testRecord());
    expect(rows.map((row) => row.code)).toEqual(['phy', 'chem', 'math']);
    expect(rows.map((row) => row.label)).toEqual(['Physics', 'Chemistry', 'Mathematics']);
  });
});
