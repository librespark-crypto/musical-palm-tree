/**
 * Deterministic, rule-based coach.
 *
 * This is the fallback whenever Gemini is unavailable (no API key, offline,
 * quota, network error) and it is also the source of the "why" behind every
 * recommendation. Each item cites the stored number that produced it - nothing
 * is invented, and with an empty tracker it says so instead of guessing.
 */
import type { AiPlan, AiPlanItem, ExamScope, Priority, SubjectCode, TrackerSnapshot } from '@/lib/types';
import { withIndex, type DerivedIndex } from '@/lib/calculations/derive';
import { overallAnalytics } from '@/lib/calculations/analytics';
import { revisionBuckets } from '@/lib/calculations/revision';
import { backlogSnapshot } from '@/lib/calculations/backlog';
import { formatMinutes, relativeDay, todayISO } from '@/lib/date';
import { SUBJECT_LABELS } from '@/lib/constants';
import { nodeById } from '@/lib/syllabus';
import { aggregateNode } from '@/lib/calculations/progress';

interface Candidate {
  item: AiPlanItem;
  score: number;
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function candidate(item: AiPlanItem, score: number): Candidate {
  return { item, score };
}

export interface RulePlanOptions {
  availableMinutes?: number;
  exam?: ExamScope;
}

export function buildRulePlan(snapshot: TrackerSnapshot, options: RulePlanOptions = {}): AiPlan {
  const index = withIndex(snapshot);
  const overall = overallAnalytics(index);
  const exam = options.exam ?? 'jm';
  const budget = Math.max(30, options.availableMinutes ?? snapshot.settings.profile.dailyTargetMin ?? 420);
  const candidates: Candidate[] = [];
  const plannedTopics = new Set(
    snapshot.tasks.filter((task) => (task.status === 'pending' || task.status === 'in_progress') && task.topicId).map((task) => task.topicId as string),
  );

  /* 1. Overdue revisions - the highest-value fix in any JEE plan. */
  const buckets = revisionBuckets(index, exam);
  for (const revision of buckets.overdue.slice(0, 3)) {
    const overdueDays = Math.abs(
      Math.round((new Date(todayISO()).getTime() - new Date(revision.scheduledFor).getTime()) / 86_400_000),
    );
    candidates.push(
      candidate(
        {
          title: `Revise ${revision.topicName}`,
          type: 'Revision',
          subject: revision.subject,
          topicId: revision.nodeId,
          exam: revision.exam,
          estMin: 30,
          priority: 'high',
          reason: `Revision ${revision.index} was due ${revision.scheduledFor} (${overdueDays} days overdue).`,
        },
        100 + overdueDays,
      ),
    );
  }
  for (const revision of buckets.dueToday.slice(0, 2)) {
    candidates.push(
      candidate(
        {
          title: `Revise ${revision.topicName}`,
          type: 'Revision',
          subject: revision.subject,
          topicId: revision.nodeId,
          exam: revision.exam,
          estMin: 30,
          priority: 'high',
          reason: `Spaced revision ${revision.index} is scheduled for today.`,
        },
        95,
      ),
    );
  }

  /* 2. Tasks already planned for today. */
  const backlog = backlogSnapshot(index);
  for (const task of backlog.today.filter((entry) => entry.status !== 'completed' && entry.status !== 'skipped').slice(0, 3)) {
    candidates.push(
      candidate(
        {
          title: task.title,
          type: task.type,
          subject: task.subject,
          topicId: task.topicId,
          exam: task.exam,
          estMin: task.estMin,
          priority: task.priority,
          reason: `Already on today's plan (${task.type}${task.subject ? `, ${SUBJECT_LABELS[task.subject]}` : ''}).`,
        },
        80 - PRIORITY_RANK[task.priority] * 5,
      ),
    );
  }

  /* 3. Backlog debt that has been waiting longest. */
  for (const task of backlog.backlog.slice(0, 2)) {
    const age = task.backlogSince ? relativeDay(task.backlogSince) : relativeDay(task.plannedFor);
    candidates.push(
      candidate(
        {
          title: task.title,
          type: task.type,
          subject: task.subject,
          topicId: task.topicId,
          exam: task.exam,
          estMin: Math.min(task.estMin, 60),
          priority: 'high',
          reason: `Waiting in the backlog (planned ${age}).`,
        },
        85,
      ),
    );
  }

  /* 4. Weak topics with real evidence. */
  for (const row of overall.weakTopics.slice(0, 4)) {
    if (plannedTopics.has(row.id)) continue;
    candidates.push(
      candidate(
        {
          title: `Fix ${row.name}`,
          type: 'Practice',
          subject: row.subject,
          topicId: row.id,
          exam: row.exam,
          estMin: 50,
          priority: row.mastery < 35 ? 'high' : 'medium',
          reason: `${row.reason} - mastery ${row.mastery}%${row.attempted ? `, accuracy ${row.accuracy}% over ${row.attempted} questions` : ''}.`,
        },
        70 - row.mastery / 5,
      ),
    );
  }

  /* 5. Covered but unpractised topics. */
  for (const row of overall.practiceGaps.slice(0, 3)) {
    if (plannedTopics.has(row.id)) continue;
    candidates.push(
      candidate(
        {
          title: `Solve problems in ${row.name}`,
          type: 'DPP',
          subject: row.subject,
          topicId: row.id,
          exam: row.exam,
          estMin: 45,
          priority: 'medium',
          reason: `${row.reason.toLowerCase()}.`,
        },
        60,
      ),
    );
  }

  /* 6. Unfinished lectures. */
  for (const lecture of snapshot.lectures.filter((entry) => entry.status !== 'completed').slice(0, 3)) {
    candidates.push(
      candidate(
        {
          title: lecture.title,
          type: 'Lecture',
          subject: lecture.subject,
          topicId: lecture.topicId ?? lecture.chapterId,
          exam: lecture.exam === 'ja' ? 'ja' : 'jm',
          estMin: Math.max(30, lecture.durationMin - lecture.watchedMin || lecture.durationMin),
          priority: lecture.status === 'in_progress' ? 'high' : 'medium',
          reason:
            lecture.status === 'in_progress'
              ? `Partially watched (${lecture.watchedMin}/${lecture.durationMin} min).`
              : 'Lecture still not started.',
        },
        55,
      ),
    );
  }

  /* 7. Continue the least-covered subject with in-progress work. */
  const weakestSubject = [...overall.subjects].sort((a, b) => a.pct - b.pct)[0];
  if (weakestSubject && weakestSubject.leaves > 0) {
    const subject = index.subjects.find((entry) => entry.code === weakestSubject.code);
    let picked: { topicId: string; title: string; reason: string } | null = null;
    for (const chapter of subject?.chapters ?? []) {
      for (const topic of chapter.topics) {
        const aggregate = aggregateNode(index, topic.id, exam);
        if (!aggregate.total || aggregate.completed === aggregate.total) continue;
        if (aggregate.learning > 0 && !plannedTopics.has(topic.id)) {
          picked = {
            topicId: topic.id,
            title: `Continue ${topic.name}`,
            reason: `${SUBJECT_LABELS[weakestSubject.code as SubjectCode] ?? weakestSubject.name} is your least-covered subject (${weakestSubject.pct}%) and this topic has ${aggregate.learning} subtopic(s) in progress.`,
          };
          break;
        }
      }
      if (picked) break;
    }
    if (picked) {
      candidates.push(
        candidate(
          {
            title: picked.title,
            type: 'Topic study',
            subject: weakestSubject.code === 'phy' || weakestSubject.code === 'chem' || weakestSubject.code === 'math' ? weakestSubject.code : null,
            topicId: picked.topicId,
            exam,
            estMin: 50,
            priority: 'medium',
            reason: picked.reason,
          },
          50,
        ),
      );
    }
  }

  /* 8. Mistake book revision. */
  const openMistakes = snapshot.mistakes.filter((mistake) => mistake.status === 'open');
  if (openMistakes.length >= 5) {
    candidates.push(
      candidate(
        {
          title: 'Revise the mistake book',
          type: 'Mistake revision',
          subject: openMistakes[0]!.subject,
          topicId: openMistakes[0]!.nodeId,
          exam: openMistakes[0]!.exam,
          estMin: 30,
          priority: 'medium',
          reason: `${openMistakes.length} mistake entries are still open.`,
        },
        45,
      ),
    );
  }

  /* 9. Nothing tracked yet. */
  if (!candidates.length) {
    const firstTopic = index.subjects[0]?.chapters[0]?.topics[0];
    if (firstTopic) {
      candidates.push(
        candidate(
          {
            title: `Start ${firstTopic.name}`,
            type: 'Topic study',
            subject: index.subjects[0]!.code,
            topicId: firstTopic.id,
            exam,
            estMin: 45,
            priority: 'medium',
            reason: 'No tracked activity yet - nothing can be prioritised from data, so start anywhere and log it.',
          },
          10,
        ),
      );
    }
  }

  /* Budget the day: keep the highest scoring items that fit. */
  const ranked = candidates.sort((a, b) => b.score - a.score);
  const fitted: AiPlanItem[] = [];
  const seen = new Set<string>();
  let used = 0;
  for (const entry of ranked) {
    const key = `${entry.item.title}|${entry.item.type}`;
    if (seen.has(key)) continue;
    if (fitted.length && used + entry.item.estMin > budget) continue;
    seen.add(key);
    fitted.push(entry.item);
    used += entry.item.estMin;
    if (fitted.length >= 7) break;
  }

  const summary = fitted.length
    ? `${fitted.length} prioritised item${fitted.length > 1 ? 's' : ''} (${formatMinutes(used)} of work) built from your backlog, due revisions, weak topics and accuracy data.`
    : 'Nothing to prioritise yet - log a study session, a task or a revision and the coach will build a plan from it.';

  return {
    source: 'rules',
    createdAt: new Date().toISOString(),
    availableMinutes: budget,
    usedMinutes: used,
    summary,
    items: fitted,
  };
}

/** Quick, deterministic summary used by the coach header. */
export function rulePlanHeadline(index: DerivedIndex): string {
  const overall = overallAnalytics(index);
  const parts: string[] = [];
  if (overall.revision.overdue.length) parts.push(`${overall.revision.overdue.length} overdue revision(s)`);
  if (overall.backlog.counts.backlog) parts.push(`${overall.backlog.counts.backlog} backlog task(s)`);
  if (overall.weakTopics.length) parts.push(`${overall.weakTopics.length} weak topic(s)`);
  if (overall.studyTime.week) parts.push(`${formatMinutes(overall.studyTime.week)} logged this week`);
  if (!parts.length) return 'Log your first session and the coach will start prioritising from real data.';
  return parts.join(' · ');
}

export function planItemNodeLabel(item: AiPlanItem): string {
  const node = nodeById(item.topicId);
  if (!node) return '';
  return node.chapter ? `${node.chapter.name}${node.topic ? ` › ${node.topic.name}` : ''}` : node.name;
}
