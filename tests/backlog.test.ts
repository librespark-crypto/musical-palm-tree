import { describe, expect, it } from 'vitest';
import {
  backlogSnapshot,
  backlogSuggestions,
  backlogSummary,
  isBacklog,
  isOpen,
  isOverdue,
  sweepBacklog,
} from '@/lib/calculations/backlog';
import { withIndex } from '@/lib/calculations/derive';
import { at, dayOffset, lecture, progressMap, snapshot, task, TODAY } from './helpers';

const done = { theory: 'done', lecture: 'done', dpp: 'done', pyq: 'done', practice: 'done' } as const;

describe('task predicates', () => {
  it('treats pending and in-progress as open', () => {
    expect(isOpen(task({ status: 'pending' }))).toBe(true);
    expect(isOpen(task({ status: 'in_progress' }))).toBe(true);
    expect(isOpen(task({ status: 'completed' }))).toBe(false);
    expect(isOpen(task({ status: 'skipped' }))).toBe(false);
  });

  it('only calls past-day open work overdue', () => {
    expect(isOverdue(task({ plannedFor: dayOffset(-1) }))).toBe(true);
    expect(isOverdue(task({ plannedFor: TODAY }))).toBe(false);
    expect(isOverdue(task({ plannedFor: dayOffset(-1), status: 'completed' }))).toBe(false);
  });

  it('counts past-day or explicitly carried-over work as backlog', () => {
    expect(isBacklog(task({ plannedFor: TODAY }))).toBe(false);
    expect(isBacklog(task({ plannedFor: TODAY, inBacklog: true }))).toBe(true);
    expect(isBacklog(task({ plannedFor: dayOffset(-3) }))).toBe(true);
    expect(isBacklog(task({ plannedFor: dayOffset(-3), status: 'completed' }))).toBe(false);
  });
});

describe('backlog snapshot', () => {
  const tasks = [
    task({ title: 'Today A', plannedFor: TODAY, estMin: 60 }),
    task({ title: 'Today B', plannedFor: TODAY, estMin: 90, status: 'completed', actualMin: 45, completedAt: `${TODAY}T18:00:00.000Z` }),
    task({ title: 'Tomorrow', plannedFor: dayOffset(1), estMin: 30 }),
    task({ title: 'Later', plannedFor: dayOffset(3), estMin: 120 }),
    task({ title: 'Missed 2 days ago', plannedFor: dayOffset(-2), estMin: 45 }),
    task({ title: 'Carried', plannedFor: dayOffset(-5), estMin: 25, inBacklog: true, backlogSince: dayOffset(-2) }),
    task({ title: 'Skipped', plannedFor: dayOffset(-1), estMin: 20, status: 'skipped' }),
  ];
  const index = withIndex(snapshot({ tasks }));

  it('buckets the plan by day', () => {
    const buckets = backlogSnapshot(index, TODAY);
    expect(buckets.today).toHaveLength(2);
    expect(buckets.tomorrow).toHaveLength(1);
    expect(buckets.upcoming).toHaveLength(2);
    expect(buckets.completedToday).toHaveLength(1);
    expect(buckets.skipped).toHaveLength(1);
  });

  it('counts the backlog and how much of it is overdue', () => {
    const buckets = backlogSnapshot(index, TODAY);
    // "today" counts everything planned for today (done or not).
    expect(buckets.counts.today).toBe(2);
    expect(buckets.counts.backlog).toBe(2);
    expect(buckets.counts.overdue).toBe(2);
    expect(buckets.counts.upcoming).toBe(2);
    expect(buckets.counts.completedToday).toBe(1);
  });

  it('adds up the planned minutes', () => {
    const buckets = backlogSnapshot(index, TODAY);
    expect(buckets.minutes.todayPlanned).toBe(60);
    expect(buckets.minutes.todayDone).toBe(45);
    expect(buckets.minutes.backlog).toBe(70);
    expect(buckets.minutes.week).toBe(60 + 30 + 120);
  });

  it('lays out the next seven days and reports the oldest backlog age', () => {
    const buckets = backlogSnapshot(index, TODAY);
    expect(buckets.weekPlan).toHaveLength(7);
    expect(buckets.weekPlan[0]?.date).toBe(TODAY);
    expect(buckets.weekPlan[0]?.planned).toBe(60);
    expect(buckets.weekPlan[0]?.done).toBe(45);
    expect(buckets.oldestBacklogDays).toBe(5);
  });
});

describe('backlog sweep', () => {
  it('moves past-day open tasks into the backlog once', () => {
    const before = snapshot({
      tasks: [
        task({ title: 'Yesterday', plannedFor: dayOffset(-1) }),
        task({ title: 'Today', plannedFor: TODAY }),
        task({ title: 'Finished late', plannedFor: dayOffset(-2), status: 'completed' }),
        task({ title: 'Already carried', plannedFor: dayOffset(-4), inBacklog: true }),
      ],
    });

    const { updates, moved } = sweepBacklog(before, TODAY);
    expect(moved).toBe(1);
    expect(updates[0]?.title).toBe('Yesterday');
    expect(updates[0]?.inBacklog).toBe(true);
    expect(updates[0]?.backlogSince).toBe(TODAY);
  });

  it('is a no-op when nothing has slipped', () => {
    const clean = snapshot({ tasks: [task({ plannedFor: TODAY }), task({ plannedFor: dayOffset(2) })] });
    expect(sweepBacklog(clean, TODAY).moved).toBe(0);
  });

  it('produces a summary the backlog header can use', () => {
    const summary = backlogSummary(
      snapshot({
        tasks: [
          task({ plannedFor: dayOffset(-1), estMin: 45 }),
          task({ plannedFor: TODAY, estMin: 60 }),
          task({ plannedFor: dayOffset(-1), status: 'completed', completedAt: `${TODAY}T10:00:00.000Z` }),
        ],
      }),
    );
    expect(summary.openCount).toBe(2);
    expect(summary.backlogCount).toBe(1);
    expect(summary.overdueCount).toBe(1);
    expect(summary.minutes).toBe(45);
    expect(summary.completionRate7d).toBe(33);
  });
});

describe('backlog suggestions', () => {
  it('suggests unwatched lectures and unfinished topics with real numbers', () => {
    const index = withIndex(
      snapshot({
        lectures: [
          lecture({ title: 'Rotational Motion 1', chapterId: 'phy.c0', durationMin: 90, watchedMin: 30, status: 'in_progress' }),
          lecture({ title: 'Finished', chapterId: 'phy.c0', durationMin: 60, watchedMin: 60, status: 'completed' }),
        ],
        progress: progressMap([
          { nodeId: 'phy.c0.t0.s0', patch: { status: 'completed', ...done } },
          { nodeId: 'phy.c0.t0.s1', patch: { status: 'learning', theory: 'done' } },
        ]),
      }),
    );

    const suggestions = backlogSuggestions(index, 'jm', 10);
    const lectureSuggestion = suggestions.find((row) => row.kind === 'lecture');
    expect(lectureSuggestion?.title).toBe('Rotational Motion 1');
    expect(lectureSuggestion?.priority).toBe('high');
    expect(lectureSuggestion?.estMin).toBe(60);
    expect(suggestions.find((row) => row.title === 'Finished')).toBeUndefined();

    const topicSuggestion = suggestions.find((row) => row.id === 'phy.c0.t0');
    expect(topicSuggestion?.reason).toMatch(/subtopics complete/);
  });

  it('respects the requested limit and never suggests untouched topics', () => {
    const index = withIndex(
      snapshot({
        progress: progressMap([{ nodeId: 'phy.c0.t0.s1', patch: { status: 'learning', theory: 'done' } }]),
      }),
    );
    const suggestions = backlogSuggestions(index, 'jm', 1);
    expect(suggestions.length).toBeLessThanOrEqual(2);
    const untouched = suggestions.filter((row) => row.kind !== 'lecture');
    expect(untouched.every((row) => row.id !== 'chem.c0.t0')).toBe(true);
  });
});

describe('backlog ids survive a sweep', () => {
  it('keeps the original task id, exam and subject', () => {
    const original = task({ plannedFor: dayOffset(-3), exam: 'ja', subject: 'chem', estMin: 30 });
    const { updates } = sweepBacklog(snapshot({ tasks: [original] }), TODAY);
    expect(updates[0]?.id).toBe(original.id);
    expect(updates[0]?.exam).toBe('ja');
    expect(updates[0]?.subject).toBe('chem');
    expect(at(TODAY).startsWith(TODAY)).toBe(true);
  });
});
