import { describe, expect, it } from 'vitest';
import {
  activityByDay,
  chapterRows,
  heatLevel,
  lectureStats,
  minutesBySubject,
  mistakePatterns,
  overallAnalytics,
  overallFor,
  practiceGaps,
  questionOverview,
  sessionModeBreakdown,
  streakInfo,
  strongTopics,
  studyTimeSummary,
  weakTopics,
} from '@/lib/calculations/analytics';
import { withIndex } from '@/lib/calculations/derive';
import { allChapters, leavesOf } from '@/lib/syllabus';
import { at, dayOffset, lecture, mistake, nodePath, progressMap, questionLog, session, snapshot, TODAY, testRecord } from './helpers';

const SUB = 'phy.c0.t0.s0';
const done = { theory: 'done', lecture: 'done', dpp: 'done', pyq: 'done', practice: 'done' } as const;

describe('study time aggregation', () => {
  const sessions = [
    session({ start: at(TODAY, '09:00'), minutes: 60, subject: 'phy', mode: 'Theory' }),
    session({ start: at(TODAY, '14:00'), minutes: 30, subject: 'chem', mode: 'DPP' }),
    session({ start: at(dayOffset(-1), '09:00'), minutes: 45, subject: 'phy', mode: 'Theory' }),
    session({ start: at(dayOffset(-10), '09:00'), minutes: 120, subject: 'math', mode: 'Mock Test' }),
    session({ start: at(dayOffset(-40), '09:00'), minutes: 15, subject: 'phy', mode: 'Revision' }),
  ];
  const index = withIndex(snapshot({ sessions }));

  it('splits today, yesterday, week and month correctly', () => {
    const summary = studyTimeSummary(index);
    expect(summary.today).toBe(90);
    expect(summary.yesterday).toBe(45);
    expect(summary.week).toBe(135);
    expect(summary.month).toBe(255);
    expect(summary.total).toBe(270);
  });

  it('reports the best day and the average per tracked day', () => {
    const summary = studyTimeSummary(index, TODAY);
    expect(summary.bestDayMin).toBe(120);
    expect(summary.bestDayDate).toBe(dayOffset(-10));
    expect(summary.dailyAverage).toBe(Math.round(270 / 4));
  });

  it('builds a per-day activity series with minutes and question totals', () => {
    const days = activityByDay(index, 7, TODAY);
    expect(days).toHaveLength(7);
    expect(days[days.length - 1]?.date).toBe(TODAY);
    expect(days[days.length - 1]?.minutes).toBe(90);
    expect(days[days.length - 1]?.minutesBySubject.phy).toBe(60);
    expect(days[days.length - 1]?.activities).toBe(2);
  });

  it('groups minutes by subject and by session mode', () => {
    expect(minutesBySubject(index).phy).toBe(120);
    expect(minutesBySubject(index, 30).math).toBe(120);
    const modes = sessionModeBreakdown(index, 30);
    expect(modes.find((row) => row.mode === 'Theory')?.minutes).toBe(105);
    expect(modes[0]?.minutes).toBeGreaterThanOrEqual(modes[modes.length - 1]?.minutes ?? 0);
  });
});

describe('streaks', () => {
  it('counts consecutive active days up to today', () => {
    const index = withIndex(
      snapshot({
        sessions: [
          session({ start: at(TODAY, '09:00') }),
          session({ start: at(dayOffset(-1), '09:00') }),
          session({ start: at(dayOffset(-2), '09:00') }),
          session({ start: at(dayOffset(-5), '09:00') }),
        ],
      }),
    );
    const streak = streakInfo(index);
    expect(streak.current).toBe(3);
    expect(streak.activeDays).toBe(4);
    expect(streak.best).toBeGreaterThanOrEqual(3);
  });

  it('breaks the current streak when today has no activity', () => {
    const index = withIndex(snapshot({ sessions: [session({ start: at(dayOffset(-1), '09:00') })] }));
    expect(streakInfo(index).current).toBe(0);
  });

  it('counts questions and revisions as activity too', () => {
    const index = withIndex(snapshot({ questions: [questionLog({ date: TODAY })] }));
    expect(streakInfo(index).current).toBe(1);
  });
});

describe('question analytics', () => {
  const questions = [
    questionLog({ date: TODAY, subject: 'phy', source: 'DPP', attempted: 20, correct: 15, wrong: 5, timeMin: 40 }),
    questionLog({ date: TODAY, subject: 'chem', source: 'PYQ', attempted: 10, correct: 9, wrong: 1, timeMin: 20, exam: 'ja' }),
    questionLog({ date: dayOffset(-2), subject: 'phy', source: 'Practice', attempted: 10, correct: 4, wrong: 6, timeMin: 30 }),
  ];
  const index = withIndex(snapshot({ questions }));

  it('totals attempts and accuracy across the scope', () => {
    const jm = questionOverview(index, { exam: 'jm' });
    expect(jm.attempted).toBe(30);
    expect(jm.correct).toBe(19);
    expect(jm.accuracy).toBe(63);
    expect(jm.minutesPerQuestion).toBe(Math.round((70 / 30) * 10) / 10);
    expect(jm.logs).toBe(2);
  });

  it('groups by subject and by source', () => {
    const jm = questionOverview(index, { exam: 'jm', days: 0 });
    const phy = jm.bySubject.find((row) => row.code === 'phy');
    expect(phy?.attempted).toBe(30);
    expect(phy?.accuracy).toBe(63);
    expect(jm.bySource.map((row) => row.source).sort()).toEqual(['DPP', 'Practice']);
    expect(jm.byDifficulty[0]?.difficulty).toBe('moderate');
  });
});

describe('subject analytics', () => {
  const index = withIndex(
    snapshot({
      progress: progressMap([
        { nodeId: SUB, patch: { status: 'completed', ...done, timeMin: 90 } },
        { nodeId: 'phy.c0.t0.s1', patch: { status: 'weak', weak: true, theory: 'done' } },
      ]),
      questions: [questionLog({ nodeId: SUB, ...nodePath(SUB), attempted: 20, correct: 17, wrong: 3, timeMin: 50 })],
      sessions: [session({ ...nodePath(SUB), minutes: 90 })],
      mistakes: [
        mistake({ nodeId: SUB, ...nodePath(SUB) }),
        mistake({ nodeId: SUB, ...nodePath(SUB), mistakeType: 'Silly mistake' }),
      ],
      lectures: [
        lecture({ chapterId: 'phy.c0', durationMin: 80, watchedMin: 80, status: 'completed' }),
        lecture({ chapterId: 'phy.c0', durationMin: 60, watchedMin: 15, status: 'in_progress' }),
      ],
      tests: [testRecord({ date: TODAY })],
    }),
  );

  it('collects per-chapter rows for the exam scope', () => {
    const rows = chapterRows(index, 'jm');
    // Every chapter is listed once, carrying its own scope flags.
    expect(rows).toHaveLength(allChapters.length);
    const units = rows.find((row) => row.id === 'phy.c0');
    expect(units?.subject).toBe('phy');
    expect(units?.subjectName).toBe('Physics');
    expect(units?.leaves).toBe(leavesOf('phy.c0', 'jm').length);
    expect(units?.completed).toBe(1);
    expect(units?.weak).toBe(1);
    expect(units?.questions.attempted).toBe(20);
    expect(units?.mistakes).toBe(2);
    expect(units?.timeMin).toBe(90);
    expect(units?.lectures).toBe(2);
    expect(units?.lecturesCompleted).toBe(1);
  });

  it('never reports a percentage outside 0..100', () => {
    for (const row of chapterRows(index, 'jm')) {
      expect(row.pct).toBeGreaterThanOrEqual(0);
      expect(row.pct).toBeLessThanOrEqual(100);
      expect(row.mastery).toBeGreaterThanOrEqual(0);
      expect(row.mastery).toBeLessThanOrEqual(100);
    }
  });

  it('flags weak topics and practice gaps from real evidence', () => {
    const weak = weakTopics(index, { exam: 'jm', limit: 5 });
    expect(weak.length).toBeGreaterThan(0);
    expect(weak[0]?.reason).toBeTruthy();
    expect(weak.some((row) => row.weak)).toBe(true);

    const gaps = practiceGaps(index, 'jm', 5);
    expect(gaps.length).toBeGreaterThanOrEqual(0);
    for (const gap of gaps) {
      expect(gap.attempted).toBeLessThan(5);
      expect(gap.coverage).toBeGreaterThanOrEqual(40);
    }
  });

  it('ranks strong topics by logged accuracy', () => {
    const strong = withIndex(
      snapshot({
        progress: progressMap([{ nodeId: SUB, patch: { status: 'completed', ...done } }]),
        questions: [questionLog({ nodeId: SUB, ...nodePath(SUB), attempted: 12, correct: 11, wrong: 1 })],
      }),
    ).snapshot;
    const rows = strongTopics(withIndex(strong), { exam: 'jm', limit: 5 });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]?.accuracy).toBeGreaterThanOrEqual(65);
    expect(rows[0]?.reason).toContain('accuracy');
  });

  it('summarises lectures and their watch progress', () => {
    const stats = lectureStats(index);
    expect(stats.total).toBe(2);
    expect(stats.completed).toBe(1);
    expect(stats.inProgress).toBe(1);
    expect(stats.durationMin).toBe(140);
    expect(stats.watchedMin).toBe(95);
    const phy = stats.bySubject.find((row) => row.code === 'phy');
    expect(phy?.total).toBe(2);
    expect(phy?.label).toBe('Physics');
  });
});

describe('mistake patterns', () => {
  const index = withIndex(
    snapshot({
      mistakes: [
        mistake({ nodeId: SUB, mistakeType: 'Conceptual', date: TODAY }),
        mistake({ nodeId: SUB, mistakeType: 'Calculation', date: dayOffset(-1), status: 'revised' }),
        mistake({ nodeId: 'phy.c0.t0.s1', mistakeType: 'Conceptual', date: dayOffset(-40), status: 'mastered' }),
      ],
    }),
  );

  it('counts mistakes by type, subject and repeated topic', () => {
    const patterns = mistakePatterns(index);
    expect(patterns.total).toBe(3);
    expect(patterns.open).toBe(1);
    expect(patterns.byType[0]).toEqual({ type: 'Conceptual', count: 2 });
    expect(patterns.bySubject.find((row) => row.code === 'phy')?.count).toBe(3);
    const repeated = patterns.repeatedTopics.find((row) => row.nodeId === SUB);
    expect(repeated?.count).toBe(2);
    expect(repeated?.types.sort()).toEqual(['Calculation', 'Conceptual']);
  });

  it('counts only revisions from the last seven days', () => {
    const patterns = mistakePatterns(
      withIndex(
        snapshot({
          mistakes: [
            mistake({ lastRevised: TODAY, status: 'revised' }),
            mistake({ lastRevised: dayOffset(-2), status: 'revised' }),
            mistake({ lastRevised: dayOffset(-30), status: 'mastered' }),
          ],
        }),
      ),
    );
    expect(patterns.revisedThisWeek).toBe(2);
  });
});

describe('overall analytics', () => {
  const index = withIndex(
    snapshot({
      progress: progressMap([{ nodeId: SUB, patch: { status: 'completed', ...done } }]),
      sessions: [session({ minutes: 120 })],
      questions: [questionLog({ attempted: 20, correct: 15 })],
      tests: [testRecord({ score: 180, maxMarks: 300 })],
    }),
  );

  it('bundles every analytics view', () => {
    const overall = overallAnalytics(index);
    expect(overall.generatedAt).toBeTruthy();
    expect(overall.subjects).toHaveLength(3);
    expect(overall.studyTime.total).toBe(120);
    expect(overall.questions.attempted).toBe(20);
    expect(overall.tests.count).toBe(1);
    expect(overall.backlog.counts.backlog).toBe(0);
    expect(overall.consistency30).toBeGreaterThanOrEqual(1);
  });

  it('memoises per snapshot index', () => {
    expect(overallAnalytics(index)).toBe(overallAnalytics(index));
    expect(overallFor(index.snapshot).studyTime.total).toBe(120);
  });
});

describe('activity heat levels', () => {
  it('maps daily activity onto heat buckets', () => {
    expect(heatLevel(0)).toBe(0);
    expect(heatLevel(0.5)).toBe(1);
    expect(heatLevel(1)).toBe(2);
    expect(heatLevel(3)).toBe(3);
    expect(heatLevel(20)).toBe(4);
  });
});
