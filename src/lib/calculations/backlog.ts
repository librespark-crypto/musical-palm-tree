/**
 * Backlog maths.
 *
 * A task joins the backlog in exactly two ways:
 *   1. the daily sweep at app start moves unfinished tasks from previous days,
 *   2. the user explicitly reschedules/keeps it.
 * Nothing is ever deleted implicitly.
 */
import type { ISODate, Lecture, Priority, StudyTask, TaskStatus, SubjectCode, TrackerSnapshot } from '@/lib/types';
import { addDays, daysFromToday, eachDay, todayISO } from '@/lib/date';
import { percent, sum } from '@/lib/utils';
import { PRIORITY_RANK } from '@/lib/constants';
import { withIndex, type DerivedIndex } from '@/lib/calculations/derive';
import { nodeById } from '@/lib/syllabus';
import { aggregateNode } from '@/lib/calculations/progress';

export const OPEN_TASK_STATUSES: readonly TaskStatus[] = ['pending', 'in_progress'];

export function isOpen(task: StudyTask): boolean {
  return task.status === 'pending' || task.status === 'in_progress';
}

export function isOverdue(task: StudyTask, today: ISODate = todayISO()): boolean {
  return isOpen(task) && task.plannedFor < today;
}

export function isBacklog(task: StudyTask, today: ISODate = todayISO()): boolean {
  return isOpen(task) && (task.inBacklog || task.plannedFor < today);
}

export interface BacklogSnapshot {
  today: StudyTask[];
  tomorrow: StudyTask[];
  upcoming: StudyTask[];
  backlog: StudyTask[];
  overdue: StudyTask[];
  completedToday: StudyTask[];
  skipped: StudyTask[];
  counts: {
    today: number;
    backlog: number;
    overdue: number;
    upcoming: number;
    completedToday: number;
  };
  minutes: {
    todayPlanned: number;
    todayDone: number;
    backlog: number;
    week: number;
  };
  /** Planned minutes for each of the next 7 days. */
  weekPlan: { date: ISODate; planned: number; done: number; count: number }[];
  /** Oldest backlog item age in days. */
  oldestBacklogDays: number;
}

export function backlogSnapshot(index: DerivedIndex, today: ISODate = todayISO()): BacklogSnapshot {
  const tasks = index.snapshot.tasks;
  const todayTasks = tasks.filter((t) => t.plannedFor === today && !t.inBacklog);
  const backlog = tasks.filter((t) => isBacklog(t, today)).sort(sortForBacklog);
  const completedToday = tasks.filter((t) => t.status === 'completed' && t.completedAt?.slice(0, 10) === today);
  const weekPlan = eachDay(today, addDays(today, 6)).map((date) => {
    const dayTasks = tasks.filter((t) => t.plannedFor === date && !t.inBacklog);
    return {
      date,
      planned: sum(dayTasks.filter(isOpen), (t) => t.estMin),
      done: sum(dayTasks.filter((t) => t.status === 'completed'), (t) => t.actualMin || t.estMin),
      count: dayTasks.length,
    };
  });

  return {
    today: tasks.filter((t) => t.plannedFor === today),
    tomorrow: tasks.filter((t) => t.plannedFor === addDays(today, 1)),
    upcoming: tasks.filter((t) => t.plannedFor > today).sort((a, b) => (a.plannedFor < b.plannedFor ? -1 : 1)),
    backlog,
    overdue: backlog.filter((t) => t.inBacklog || isOverdue(t, today)),
    completedToday,
    skipped: tasks.filter((t) => t.status === 'skipped'),
    counts: {
      today: todayTasks.length,
      backlog: backlog.length,
      overdue: backlog.filter((t) => isOverdue(t, today)).length,
      upcoming: tasks.filter((t) => isOpen(t) && t.plannedFor > today).length,
      completedToday: completedToday.length,
    },
    minutes: {
      todayPlanned: sum(todayTasks.filter(isOpen), (t) => t.estMin),
      todayDone: sum(completedToday, (t) => t.actualMin || t.estMin),
      backlog: sum(backlog, (t) => t.estMin),
      week: sum(weekPlan, (d) => d.planned),
    },
    weekPlan,
    oldestBacklogDays: backlog.length ? Math.max(...backlog.map((t) => Math.abs(daysFromToday(t.plannedFor)))) : 0,
  };
}

function sortForBacklog(a: StudyTask, b: StudyTask): number {
  if (a.plannedFor !== b.plannedFor) return a.plannedFor < b.plannedFor ? -1 : 1;
  return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
}

/**
 * Items that should sit in the backlog: unfinished tasks from earlier days plus
 * the lecture/chapter/topic work an aggressive study plan always accumulates.
 */
export interface BacklogSuggestion {
  kind: 'lecture' | 'topic' | 'chapter';
  id: string;
  title: string;
  subtitle: string;
  subject: SubjectCode | null;
  exam: 'jm' | 'ja';
  estMin: number;
  priority: Priority;
  reason: string;
}

export function backlogSuggestions(index: DerivedIndex, exam: 'jm' | 'ja' = 'jm', limit = 40): BacklogSuggestion[] {
  const suggestions: BacklogSuggestion[] = [];
  const plannedTaskNodes = new Set(
    index.snapshot.tasks.filter((t) => isOpen(t) && t.topicId).map((t) => t.topicId as string),
  );
  const unplannedLectures = new Set(
    index.snapshot.tasks.filter((t) => isOpen(t) && t.notes.startsWith('lecture:')).map((t) => t.notes.slice(8)),
  );

  for (const lecture of index.snapshot.lectures.slice().sort((a, b) => b.durationMin - a.durationMin)) {
    if (lecture.status === 'completed') continue;
    if (lecture.exam !== 'both' && lecture.exam !== exam) continue;
    if (unplannedLectures.has(lecture.id)) continue;
    if (suggestions.length >= limit) break;
    suggestions.push({
      kind: 'lecture',
      id: lecture.id,
      title: lecture.title || `Lecture ${lecture.number}`,
      subtitle: lectureNodeLabel(index, lecture),
      subject: lecture.subject,
      exam,
      estMin: Math.max(30, lecture.durationMin - lecture.watchedMin || lecture.durationMin),
      priority: lecture.status === 'in_progress' ? 'high' : 'medium',
      reason: lecture.status === 'in_progress' ? `Partially watched (${lecture.watchedMin}/${lecture.durationMin} min)` : 'Not started',
    });
  }

  for (const subject of index.subjects) {
    for (const chapter of subject.chapters) {
      for (const topic of chapter.topics) {
        const aggregate = aggregateNode(index, topic.id, exam);
        if (!aggregate.total) continue;
        if (plannedTaskNodes.has(topic.id)) continue;
        if (aggregate.completed === aggregate.total) continue;
        if (aggregate.notStarted === aggregate.total) continue; // untouched topics stay out of the backlog
        if (aggregate.mastery >= 70) continue;
        if (suggestions.length >= limit * 2) break;
        suggestions.push({
          kind: 'topic',
          id: topic.id,
          title: topic.name,
          subtitle: `${chapter.name} · ${subject.name}`,
          subject: subject.code,
          exam,
          estMin: aggregate.notStarted > 0 ? 60 : 40,
          priority: aggregate.mastery < 40 ? 'high' : 'medium',
          reason: `${aggregate.completed}/${aggregate.total} subtopics complete · mastery ${aggregate.mastery}%`,
        });
      }
    }
  }

  return suggestions.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]);
}

function lectureNodeLabel(index: DerivedIndex, lecture: Lecture): string {
  const node = nodeById(lecture.topicId ?? lecture.chapterId);
  if (!node) return lecture.source || 'Unassigned';
  return `${node.chapter?.name ?? ''}${node.topic ? ` · ${node.topic.name}` : ''}`.replace(/^ · /, '');
}

/**
 * The daily sweep: unfinished tasks from previous days move into the backlog
 * with a marker so the UI can show how long they have been waiting.
 */
export function sweepBacklog(snapshot: TrackerSnapshot, today: ISODate = todayISO()): { updates: StudyTask[]; moved: number } {
  const updates: StudyTask[] = [];
  for (const task of snapshot.tasks) {
    if (!isOpen(task)) continue;
    if (task.inBacklog) continue;
    if (task.plannedFor >= today) continue;
    updates.push({ ...task, inBacklog: true, backlogSince: today, updatedAt: new Date().toISOString() });
  }
  return { updates, moved: updates.length };
}

export interface BacklogSummary {
  openCount: number;
  backlogCount: number;
  overdueCount: number;
  minutes: number;
  completionRate7d: number;
}

export function backlogSummary(snapshot: TrackerSnapshot): BacklogSummary {
  const index = withIndex(snapshot);
  const today = todayISO();
  const snapshotBuckets = backlogSnapshot(index, today);
  const weekStart = addDays(today, -6);
  const weekTasks = snapshot.tasks.filter((t) => t.plannedFor >= weekStart && t.plannedFor <= today);
  return {
    openCount: snapshot.tasks.filter(isOpen).length,
    backlogCount: snapshotBuckets.counts.backlog,
    overdueCount: snapshotBuckets.counts.overdue,
    minutes: snapshotBuckets.minutes.backlog,
    completionRate7d: percent(weekTasks.filter((t) => t.status === 'completed').length, weekTasks.length),
  };
}
