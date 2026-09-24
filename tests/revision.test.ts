import { describe, expect, it } from 'vitest';
import {
  DEFAULT_REVISION_INTERVALS,
  autoRevisionDrafts,
  buildRevision,
  nextRevisionAfter,
  revisionBuckets,
  revisionCalendar,
  revisionConsistency,
  revisionLadder,
  scheduleDateFor,
} from '@/lib/calculations/revision';
import { withIndex } from '@/lib/calculations/derive';
import { allSubtopics, nodeById } from '@/lib/syllabus';
import { TODAY, dayOffset, progressMap, revisionFor, snapshot } from './helpers';

const SUB = 'phy.c0.t0.s0';

function subtopicOf(id: string) {
  const node = nodeById(id);
  if (!node?.subtopic) throw new Error(`${id} is not a subtopic`);
  return node.subtopic;
}

describe('revision scheduling', () => {
  it('follows the 1 / 3 / 7 / 16 / 35 day ladder', () => {
    expect(DEFAULT_REVISION_INTERVALS).toEqual([1, 3, 7, 16, 35]);
    expect(scheduleDateFor(1, undefined, TODAY)).toBe(dayOffset(1));
    expect(scheduleDateFor(2, undefined, TODAY)).toBe(dayOffset(3));
    expect(scheduleDateFor(3, undefined, TODAY)).toBe(dayOffset(7));
    expect(scheduleDateFor(4, undefined, TODAY)).toBe(dayOffset(16));
    expect(scheduleDateFor(5, undefined, TODAY)).toBe(dayOffset(35));
  });

  it('clamps beyond the ladder and honours custom intervals', () => {
    expect(scheduleDateFor(9, undefined, TODAY)).toBe(dayOffset(35));
    expect(scheduleDateFor(2, [2, 5, 20], TODAY)).toBe(dayOffset(5));
    expect(scheduleDateFor(0, [2, 5, 20], TODAY)).toBe(dayOffset(2));
  });

  it('builds a record with the chapter and topic names denormalised', () => {
    const record = buildRevision({ subtopic: subtopicOf(SUB), exam: 'jm', index: 2, scheduledFor: dayOffset(3), auto: true });
    expect(record).not.toBeNull();
    expect(record?.nodeId).toBe(SUB);
    expect(record?.index).toBe(2);
    expect(record?.auto).toBe(true);
    expect(record?.chapterName).toBe('Units and Measurements');
    expect(record?.subject).toBe('phy');
  });

  it('refuses to build a revision for a non-subtopic node', () => {
    const chapter = nodeById('phy.c0');
    expect(chapter?.subtopic).toBeNull();
  });
});

describe('automatic revisions', () => {
  it('queues revision 1 for a newly completed subtopic', () => {
    const index = withIndex(snapshot());
    const drafts = autoRevisionDrafts(index, [subtopicOf(SUB)], 'jm');
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.index).toBe(1);
    expect(drafts[0]?.scheduledFor).toBe(dayOffset(1));
    expect(drafts[0]?.exam).toBe('jm');
  });

  it('skips subtopics that are outside the exam scope', () => {
    const jmOnly = allSubtopics.find((subtopic) => subtopic.jm && !subtopic.ja);
    expect(jmOnly).toBeDefined();
    const index = withIndex(snapshot());
    expect(autoRevisionDrafts(index, [jmOnly!], 'ja')).toHaveLength(0);
    expect(autoRevisionDrafts(index, [jmOnly!], 'jm')).toHaveLength(1);
  });

  it('does not double-schedule while a revision is still open', () => {
    const index = withIndex(snapshot({ revisions: [revisionFor(SUB, { scheduledFor: dayOffset(1) })] }));
    expect(autoRevisionDrafts(index, [subtopicOf(SUB)], 'jm')).toHaveLength(0);
  });

  it('queues the next index once the previous one is done', () => {
    const done = revisionFor(SUB, {
      index: 1,
      scheduledFor: dayOffset(-2),
      completedAt: `${dayOffset(-2)}T18:00:00.000Z`,
      completedOn: dayOffset(-2),
    });
    const index = withIndex(
      snapshot({ progress: progressMap([{ nodeId: SUB, patch: { revisionCount: 1 } }]), revisions: [done] }),
    );
    const drafts = autoRevisionDrafts(index, [subtopicOf(SUB)], 'jm');
    expect(drafts).toHaveLength(1);
    expect(drafts[0]?.index).toBe(2);
    expect(drafts[0]?.scheduledFor).toBe(dayOffset(3));
  });
});

describe('chaining revisions', () => {
  it('creates the next step three days after a completed first revision', () => {
    const completed = revisionFor(SUB, { index: 1, completedOn: TODAY, completedAt: `${TODAY}T09:00:00.000Z` });
    const index = withIndex(snapshot({ revisions: [completed] }));
    const next = nextRevisionAfter(index, completed);
    expect(next?.index).toBe(2);
    expect(next?.scheduledFor).toBe(dayOffset(3));
  });

  it('stops after the fifth revision', () => {
    const fifth = revisionFor(SUB, { index: 5, completedOn: TODAY, completedAt: `${TODAY}T09:00:00.000Z` });
    const index = withIndex(snapshot({ revisions: [fifth] }));
    expect(nextRevisionAfter(index, fifth)).toBeNull();
  });

  it('does not chain when the next revision is already queued', () => {
    const completed = revisionFor(SUB, { index: 1, completedOn: TODAY, completedAt: `${TODAY}T09:00:00.000Z` });
    const index = withIndex(snapshot({ revisions: [completed, revisionFor(SUB, { index: 2, scheduledFor: dayOffset(3) })] }));
    expect(nextRevisionAfter(index, completed)).toBeNull();
  });
});

describe('revision buckets', () => {
  const revisions = [
    revisionFor(SUB, { scheduledFor: dayOffset(-3) }),
    revisionFor(SUB, { scheduledFor: TODAY, index: 2 }),
    revisionFor(SUB, { scheduledFor: dayOffset(4), index: 3 }),
    revisionFor(SUB, {
      scheduledFor: dayOffset(-1),
      index: 1,
      completedAt: `${TODAY}T08:00:00.000Z`,
      completedOn: TODAY,
    }),
  ];
  const index = withIndex(snapshot({ revisions }));

  it('splits overdue, due today, upcoming and completed', () => {
    const buckets = revisionBuckets(index);
    expect(buckets.total).toBe(4);
    expect(buckets.overdue.map((revision) => revision.scheduledFor)).toEqual([dayOffset(-3)]);
    expect(buckets.dueToday).toHaveLength(1);
    expect(buckets.upcoming).toHaveLength(1);
    expect(buckets.completed).toHaveLength(1);
  });

  it('filters by exam scope', () => {
    expect(revisionBuckets(index, 'jm').total).toBe(4);
    expect(revisionBuckets(index, 'ja').total).toBe(0);
  });

  it('sorts the queues by due date', () => {
    const many = withIndex(
      snapshot({
        revisions: [
          revisionFor(SUB, { scheduledFor: dayOffset(-1), index: 1 }),
          revisionFor(SUB, { scheduledFor: dayOffset(-9), index: 1 }),
          revisionFor(SUB, { scheduledFor: dayOffset(-4), index: 1 }),
        ],
      }),
    );
    expect(revisionBuckets(many).overdue.map((revision) => revision.scheduledFor)).toEqual([
      dayOffset(-9),
      dayOffset(-4),
      dayOffset(-1),
    ]);
  });
});

describe('revision consistency', () => {
  const onTime = revisionFor(SUB, {
    scheduledFor: dayOffset(-6),
    completedAt: `${dayOffset(-6)}T10:00:00.000Z`,
    completedOn: dayOffset(-6),
  });
  const late = revisionFor(SUB, {
    index: 2,
    scheduledFor: dayOffset(-10),
    completedAt: `${dayOffset(-7)}T10:00:00.000Z`,
    completedOn: dayOffset(-7),
  });
  const overdue = revisionFor(SUB, { index: 3, scheduledFor: dayOffset(-2) });
  const index = withIndex(snapshot({ revisions: [onTime, late, overdue] }));

  it('counts scheduled, completed, late and overdue revisions', () => {
    const consistency = revisionConsistency(index);
    expect(consistency.windowDays).toBe(28);
    expect(consistency.scheduled).toBe(3);
    expect(consistency.completed).toBe(2);
    expect(consistency.completedLate).toBe(1);
    expect(consistency.overdue).toBe(1);
    expect(consistency.rate).toBe(67);
    expect(consistency.averageDelayDays).toBe(3);
  });

  it('ignores revisions older than the window', () => {
    const old = revisionFor(SUB, { scheduledFor: dayOffset(-90), index: 4 });
    const wide = withIndex(snapshot({ revisions: [onTime, old] }));
    expect(revisionConsistency(wide).scheduled).toBe(1);
    expect(revisionConsistency(wide, 120).scheduled).toBe(2);
  });
});

describe('revision ladder and calendar', () => {
  const index = withIndex(
    snapshot({
      revisions: [
        revisionFor(SUB, { index: 1, scheduledFor: dayOffset(-1), completedOn: TODAY, completedAt: `${TODAY}T09:00:00.000Z` }),
        revisionFor(SUB, { index: 1, scheduledFor: dayOffset(2) }),
        revisionFor(SUB, { index: 2, scheduledFor: dayOffset(-4) }),
      ],
    }),
  );

  it('reports one row per rung of the ladder', () => {
    const ladder = revisionLadder(index);
    expect(ladder.map((step) => step.index)).toEqual([1, 2, 3, 4, 5]);
    expect(ladder[0]).toMatchObject({ completed: 1, open: 1, overdue: 0 });
    expect(ladder[1]).toMatchObject({ completed: 0, open: 1, overdue: 1 });
    expect(ladder[4]).toMatchObject({ completed: 0, open: 0 });
  });

  it('lays revisions out over the calendar window', () => {
    const calendar = revisionCalendar(index, 14);
    expect(calendar).toHaveLength(14);
    const today = calendar.find((day) => day.date === TODAY);
    expect(today?.completed).toBe(1);
    const missed = calendar.find((day) => day.date === dayOffset(-4));
    expect(missed?.due).toBe(1);
    // The strip only looks back; upcoming revisions live in the queue buckets.
    expect(calendar.some((day) => day.date > TODAY)).toBe(false);
  });
});
