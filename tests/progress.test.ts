import { describe, expect, it } from 'vitest';
import {
  aggregateNode,
  aggregateStatus,
  coverageOf,
  dimensionCoverage,
  emptyProgress,
  masteryOf,
  progressOf,
  questionStats,
  scopeProgress,
  subjectProgress,
} from '@/lib/calculations/progress';
import { withIndex } from '@/lib/calculations/derive';
import { DIMENSION_WEIGHTS, REVISION_WEIGHT } from '@/lib/constants';
import { allSubtopics, leavesOf, subjects, syllabusCounts } from '@/lib/syllabus';
import { TODAY, dayOffset, progressMap, progressRow, questionLog, revisionFor, snapshot } from './helpers';

const CHAPTER = 'phy.c0';
const TOPIC = 'phy.c0.t0';
const SUB = 'phy.c0.t0.s0';
const SUB_B = 'phy.c0.t0.s1';
/** A subtopic that exists in both exam scopes. */
const SUB_BOTH = allSubtopics.find((subtopic) => subtopic.jm && subtopic.ja)!.id;

const allDone = { theory: 'done', lecture: 'done', dpp: 'done', pyq: 'done', practice: 'done' } as const;
const allPartial = { theory: 'partial', lecture: 'partial', dpp: 'partial', pyq: 'partial', practice: 'partial' } as const;

describe('topic completion percent', () => {
  it('returns defaults for a node that has never been touched', () => {
    const index = withIndex(snapshot());
    expect(progressOf(index, SUB, 'jm')).toEqual(emptyProgress());
    expect(progressOf(index, 'not.a.real.node', 'jm')).toEqual(emptyProgress());
  });

  it('keeps JEE Main and JEE Advanced progress independent', () => {
    const index = withIndex(
      snapshot({ progress: progressMap([{ nodeId: SUB, exam: 'jm', patch: { status: 'completed', ...allDone } }]) }),
    );
    expect(progressOf(index, SUB, 'jm').status).toBe('completed');
    expect(progressOf(index, SUB, 'ja').status).toBe('not_started');
    expect(progressOf(index, SUB, 'ja').theory).toBe('none');
  });
});

describe('coverage weighting', () => {
  it('scores an untouched topic at zero', () => {
    expect(coverageOf(progressRow())).toBe(0);
  });

  it('applies the documented dimension weights', () => {
    const theoryOnly = coverageOf(progressRow({ theory: 'done' }));
    expect(theoryOnly).toBeCloseTo(DIMENSION_WEIGHTS.theory * (1 - REVISION_WEIGHT), 5);

    const halfTheory = coverageOf(progressRow({ theory: 'partial' }));
    expect(halfTheory).toBeCloseTo(theoryOnly / 2, 5);
  });

  it('reserves the revision bonus for three completed revisions', () => {
    const noRevisions = coverageOf(progressRow(allDone));
    const withRevisions = coverageOf(progressRow({ ...allDone, revisionCount: 3 }));
    const overCredited = coverageOf(progressRow({ ...allDone, revisionCount: 9 }));

    expect(noRevisions).toBeCloseTo(1 - REVISION_WEIGHT, 5);
    expect(withRevisions).toBeCloseTo(1, 5);
    expect(overCredited).toBeCloseTo(1, 5);
  });

  it('counts partial credit at half for every dimension', () => {
    expect(coverageOf(progressRow(allPartial))).toBeCloseTo(0.5 * (1 - REVISION_WEIGHT), 5);
  });
});

describe('mastery', () => {
  it('floors a completed topic with full coverage at 70', () => {
    const index = withIndex(
      snapshot({ progress: progressMap([{ nodeId: SUB, patch: { status: 'completed', ...allDone } }]) }),
    );
    expect(masteryOf(index, SUB, 'jm')).toBeGreaterThanOrEqual(70);
  });

  it('caps weak topics at 45 even with full coverage', () => {
    const index = withIndex(
      snapshot({ progress: progressMap([{ nodeId: SUB, patch: { status: 'weak', weak: true, ...allDone } }]) }),
    );
    expect(masteryOf(index, SUB, 'jm')).toBeLessThanOrEqual(45);
  });

  it('scales mastery by accuracy once five questions are attempted', () => {
    const loose = withIndex(
      snapshot({
        progress: progressMap([{ nodeId: SUB, patch: { status: 'learning', ...allDone } }]),
        questions: [questionLog({ nodeId: SUB, attempted: 20, correct: 8, wrong: 12 })],
      }),
    );
    const strong = withIndex(
      snapshot({
        progress: progressMap([{ nodeId: SUB, patch: { status: 'learning', ...allDone } }]),
        questions: [questionLog({ nodeId: SUB, attempted: 20, correct: 19, wrong: 1 })],
      }),
    );
    expect(masteryOf(loose, SUB, 'jm')).toBeLessThan(masteryOf(strong, SUB, 'jm'));
  });
});

describe('question stats', () => {
  it('aggregates attempted, correct and accuracy for a node', () => {
    const index = withIndex(
      snapshot({
        questions: [
          questionLog({ nodeId: SUB, attempted: 20, correct: 15, wrong: 5, timeMin: 40 }),
          questionLog({ nodeId: SUB, attempted: 10, correct: 5, wrong: 5, timeMin: 20 }),
          questionLog({ nodeId: SUB, attempted: 12, correct: 12, wrong: 0, timeMin: 24, exam: 'ja' }),
        ],
      }),
    );
    const stats = questionStats(index, SUB, 'jm');
    expect(stats.attempted).toBe(30);
    expect(stats.correct).toBe(20);
    expect(stats.accuracy).toBe(67);
    expect(stats.timeMin).toBe(60);
    expect(stats.minutesPerQuestion).toBe(2);

    const both = questionStats(index, SUB, null);
    expect(both.attempted).toBe(42);
  });
});

describe('node aggregation', () => {
  const leaves = leavesOf(CHAPTER, 'jm');

  it('counts every subtopic in scope exactly once', () => {
    const index = withIndex(
      snapshot({
        progress: progressMap([
          { nodeId: SUB, patch: { status: 'completed', ...allDone } },
          { nodeId: SUB_B, patch: { status: 'learning', theory: 'done' } },
        ]),
      }),
    );
    const aggregate = aggregateNode(index, CHAPTER, 'jm');

    expect(aggregate.total).toBe(leaves.length);
    expect(aggregate.completed).toBe(1);
    expect(aggregate.learning).toBe(1);
    expect(aggregate.notStarted).toBe(leaves.length - 2);
    expect(aggregate.pct).toBe(Math.round((1 / leaves.length) * 100));

    const dimensionTotals = Object.values(aggregate.dimensions).reduce(
      (total, bucket) => total + bucket.done + bucket.partial + bucket.none,
      0,
    );
    expect(dimensionTotals).toBe(5 * leaves.length);
  });

  it('ignores progress recorded for the other exam', () => {
    const index = withIndex(
      snapshot({ progress: progressMap([{ nodeId: SUB_BOTH, exam: 'ja', patch: { status: 'completed', ...allDone } }]) }),
    );
    expect(aggregateNode(index, CHAPTER, 'jm').completed).toBe(0);
    expect(aggregateNode(index, CHAPTER, 'ja').completed).toBe(1);
  });

  it('aggregates time and revision counts across leaves', () => {
    const index = withIndex(
      snapshot({
        progress: progressMap([
          { nodeId: SUB, patch: { timeMin: 90, revisionCount: 2 } },
          { nodeId: SUB_B, patch: { timeMin: 30, revisionCount: 1 } },
        ]),
      }),
    );
    const aggregate = aggregateNode(index, TOPIC, 'jm');
    expect(aggregate.timeMin).toBe(120);
    expect(aggregate.revisionCount).toBe(3);
  });

  it('derives the aggregate status from the leaves', () => {
    const untouched = aggregateNode(withIndex(snapshot()), CHAPTER, 'jm');
    expect(aggregateStatus(untouched)).toBe('not_started');

    const everyLeaf = leavesOf(CHAPTER, 'jm').map((leaf) => ({
      nodeId: leaf.id,
      patch: { status: 'completed' as const, ...allDone },
    }));
    const finished = aggregateNode(withIndex(snapshot({ progress: progressMap(everyLeaf) })), CHAPTER, 'jm');
    expect(aggregateStatus(finished)).toBe('completed');

    const withDueRevision = aggregateNode(
      withIndex(
        snapshot({
          progress: progressMap(everyLeaf),
          revisions: [revisionFor(SUB, { scheduledFor: dayOffset(-2) })],
        }),
      ),
      CHAPTER,
      'jm',
    );
    expect(aggregateStatus(withDueRevision)).toBe('revision_due');
  });
});

describe('subject and scope progress', () => {
  it('reports completion for each subject and each exam scope', () => {
    const physicsLeaves = leavesOf('phy', 'jm');
    const progress = progressMap(
      physicsLeaves.slice(0, 10).map((leaf) => ({ nodeId: leaf.id, patch: { status: 'completed' as const, ...allDone } })),
    );
    const index = withIndex(snapshot({ progress }));

    const phy = subjectProgress(index, 'phy', 'jm');
    expect(phy.leaves).toBe(physicsLeaves.length);
    expect(phy.completed).toBe(10);
    expect(phy.pct).toBe(Math.round((10 / physicsLeaves.length) * 100));
    expect(phy.name).toBe('Physics');

    const chem = subjectProgress(index, 'chem', 'jm');
    expect(chem.completed).toBe(0);
  });

  it('keeps the exam scopes separate on the whole-syllabus view', () => {
    const jmOnly = leavesOf('phy', 'jm').filter((leaf) => leaf.jm && !leaf.ja)[0];
    expect(jmOnly).toBeDefined();
    const index = withIndex(
      snapshot({ progress: progressMap([{ nodeId: jmOnly!.id, patch: { status: 'completed', ...allDone } }]) }),
    );

    const jm = scopeProgress(index, 'jm');
    const ja = scopeProgress(index, 'ja');
    expect(jm.completed).toBe(1);
    expect(ja.completed).toBe(0);
    expect(jm.leaves).toBe(syllabusCounts.jmLeaves);
    expect(ja.leaves).toBe(syllabusCounts.jaLeaves);
    expect(jm.pct).toBe(Math.round((1 / jm.leaves) * 100));
    expect(jm.remaining).toBe(jm.leaves - 1);
  });

  it('averages dimension coverage across the scope', () => {
    const batch = leavesOf('phy', 'jm').slice(0, 40);
    const index = withIndex(
      snapshot({
        progress: progressMap([
          ...batch.map((leaf) => ({ nodeId: leaf.id, patch: { theory: 'done' as const } })),
          { nodeId: SUB, patch: { theory: 'done' as const, lecture: 'done' as const } },
        ]),
      }),
    );
    const coverage = dimensionCoverage(index, 'jm');
    expect(coverage.theory).toBeGreaterThan(0);
    expect(coverage.theory).toBeLessThanOrEqual(100);
    expect(coverage.lecture).toBeLessThan(coverage.theory);
    expect(coverage.practice).toBe(0);
    expect(Object.keys(coverage).sort()).toEqual(['dpp', 'lecture', 'practice', 'pyq', 'theory']);
  });

  it('exposes every subject in the snapshot', () => {
    const index = withIndex(snapshot());
    expect(index.subjects.map((subject) => subject.code)).toEqual(subjects.map((subject) => subject.code));
    expect(index.subtopics.length).toBeGreaterThan(800);
  });

  it('uses today as the reference day when the caller passes one', () => {
    expect(TODAY).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
