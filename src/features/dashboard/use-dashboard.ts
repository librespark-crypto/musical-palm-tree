'use client';

/**
 * Data layer for the dashboard.
 *
 * Everything here is *derived from stored records* - there is no placeholder
 * number anywhere. The model is built once per snapshot in a memo, so the screen
 * re-renders only when the underlying data actually changes.
 */
import * as React from 'react';
import type {
  ExamScope,
  StudyTask,
  Priority,
  StudyStatus,
  SubjectCode,
  TaskStatus,
} from '@/lib/types';
import { useActions, useDerivedIndex, useSnapshot } from '@/lib/store/tracker-store';
import { overallFor, activityByDay } from '@/lib/calculations/analytics';
import { buildInsights, type Insight } from '@/lib/calculations/insights';
import { dueRevisionGroups, revisionBuckets, type DueRevisionGroup } from '@/lib/calculations/revision';
import { backlogSnapshot, type BacklogSnapshot } from '@/lib/calculations/backlog';
import { scopeProgress, type ScopeProgress, type SubjectProgressSummary } from '@/lib/calculations/progress';
import { nodeById } from '@/lib/syllabus';
import { todayISO } from '@/lib/date';

export interface PlanItem {
  id: string;
  kind: 'task' | 'revision';
  title: string;
  subtitle: string;
  minutes: number;
  priority: Priority;
  exam: ExamScope;
  status: TaskStatus | null;
  done: boolean;
  overdueDays: number;
  /** Revision ids that this row completes (grouped rows carry several). */
  revisionIds: string[];
  nodeId: string | null;
  href: string;
}

export interface SubjectCard {
  code: SubjectCode;
  name: string;
  jmPct: number;
  jaPct: number;
  completion: number;
  mastery: number;
  completed: number;
  leaves: number;
  lecturesDone: number;
  lecturesTotal: number;
  accuracy: number;
  attempted: number;
  revisionDue: number;
  minutes: number;
}

export interface DashboardModel {
  today: string;
  countdown: { label: string; mainInDays: number; advancedInDays: number; mainDate: string; advancedDate: string };
  scope: ScopeProgress;
  otherScope: ScopeProgress;
  time: { today: number; week: number; month: number; target: number };
  streak: { current: number; best: number; activeDays: number };
  timetable: { rows: PlanItem[]; plannedMinutes: number; doneMinutes: number; remainingMinutes: number };
  pending: { count: number; minutes: number; overdue: number };
  backlog: BacklogSnapshot;
  revisions: { dueToday: number; overdue: number; upcoming: number; groups: DueRevisionGroup[] };
  questions: { attempted: number; correct: number; accuracy: number; todayAttempted: number };
  lectures: { total: number; completed: number; inProgress: number; watchedHours: number; remainingHours: number };
  tests: {
    count: number;
    averagePct: number;
    latestName: string | null;
    latestPct: number | null;
    latestDelta: number | null;
    latestDate: string | null;
    accuracy: number;
  };
  subjects: SubjectCard[];
  insights: Insight[];
  weakTopics: { id: string; name: string; chapter: string; subject: SubjectCode; mastery: number; exam: ExamScope }[];
  activity: { date: string; activities: number; minutes: number }[];
  statusMix: { status: StudyStatus; count: number }[];
  focusTopic: { id: string; name: string; chapter: string; subject: SubjectCode; reason: string } | null;
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

function todayMinutes(index: ReturnType<typeof useDerivedIndex>): number {
  const today = todayISO();
  return index.snapshot.sessions
    .filter((session) => session.start.slice(0, 10) === today)
    .reduce((total, session) => total + session.minutes, 0);
}

function todayQuestions(index: ReturnType<typeof useDerivedIndex>): number {
  const today = todayISO();
  return index.snapshot.questions.filter((log) => log.date === today).reduce((total, log) => total + log.attempted, 0);
}

export function useDashboard(exam: ExamScope): DashboardModel {
  const snapshot = useSnapshot();
  const index = useDerivedIndex();
  const today = todayISO();

  return React.useMemo<DashboardModel>(() => {
    const overall = overallFor(snapshot);
    const backlog = backlogSnapshot(index, today);
    const buckets = revisionBuckets(index, exam);
    const groups = dueRevisionGroups(index, exam);
    const scope = scopeProgress(index, exam);
    const otherScope = scopeProgress(index, exam === 'jm' ? 'ja' : 'jm');

    const revisionRows: PlanItem[] = groups.map((group) => ({
      id: `revision-${group.nodeId}-${group.exam}`,
      kind: 'revision',
      title: `Revise: ${group.topicName}`,
      subtitle: `${group.chapterName} · revision ${group.revisions.map((record) => record.index).join(', ')}`,
      minutes: 20,
      priority: group.worstOverdueDays > 3 ? 'high' : 'medium',
      exam: group.exam,
      status: null,
      done: false,
      overdueDays: group.worstOverdueDays,
      revisionIds: group.revisions.map((record) => record.id),
      nodeId: group.nodeId,
      href: `/revision`,
    }));

    const taskRows: PlanItem[] = backlog.today.map((task) => ({
      id: `task-${task.id}`,
      kind: 'task',
      title: task.title,
      subtitle: task.notes || (task.chapterId ? '' : 'Custom task'),
      minutes: task.estMin,
      priority: task.priority,
      exam: task.exam,
      status: task.status,
      done: task.status === 'completed',
      overdueDays: 0,
      revisionIds: [],
      nodeId: task.subtopicId ?? task.topicId ?? task.chapterId,
      href: taskHref(task),
    }));

    const rows = [...taskRows, ...revisionRows]
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        const priority = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
        if (priority !== 0) return priority;
        return b.overdueDays - a.overdueDays;
      })
      .slice(0, 12);

    const plannedMinutes = rows.reduce((total, row) => total + row.minutes, 0);
    const doneMinutes = rows.filter((row) => row.done).reduce((total, row) => total + row.minutes, 0);

    const statusCounts = new Map<StudyStatus, number>([
      ['completed', scope.completed],
      ['learning', scope.learning],
      ['weak', scope.weak],
      ['not_started', scope.notStarted],
    ]);

    const primary = overall.weakTopics[0] ?? overall.practiceGaps[0] ?? null;

    return {
      today,
      countdown: {
        label: snapshot.settings.profile.examLabel,
        mainDate: snapshot.settings.profile.mainDate,
        advancedDate: snapshot.settings.profile.advancedDate,
        mainInDays: daysUntil(snapshot.settings.profile.mainDate, today),
        advancedInDays: daysUntil(snapshot.settings.profile.advancedDate, today),
      },
      scope,
      otherScope,
      time: {
        today: todayMinutes(index),
        week: overall.studyTime.week,
        month: overall.studyTime.month,
        target: snapshot.settings.profile.dailyTargetMin,
      },
      streak: { current: overall.streak.current, best: overall.streak.best, activeDays: overall.streak.activeDays },
      timetable: { rows, plannedMinutes, doneMinutes, remainingMinutes: Math.max(0, plannedMinutes - doneMinutes) },
      pending: {
        count: backlog.counts.today + backlog.counts.overdue,
        minutes: backlog.minutes.todayPlanned,
        overdue: backlog.counts.overdue,
      },
      backlog,
      revisions: { dueToday: buckets.dueToday.length, overdue: buckets.overdue.length, upcoming: buckets.upcoming.length, groups },
      questions: {
        attempted: overall.questions.attempted,
        correct: overall.questions.correct,
        accuracy: overall.questions.accuracy,
        todayAttempted: todayQuestions(index),
      },
      lectures: {
        total: overall.lectures.total,
        completed: overall.lectures.completed,
        inProgress: overall.lectures.inProgress,
        watchedHours: Math.round((overall.lectures.watchedMin / 60) * 10) / 10,
        remainingHours: Math.round((Math.max(0, overall.lectures.durationMin - overall.lectures.watchedMin) / 60) * 10) / 10,
      },
      tests: {
        count: overall.tests.count,
        averagePct: overall.tests.averagePct,
        latestName: overall.tests.latest?.test.name ?? null,
        latestPct: overall.tests.latest?.pct ?? null,
        latestDelta: overall.tests.latestDelta,
        latestDate: overall.tests.latest?.test.date ?? null,
        accuracy: overall.tests.accuracy,
      },
      subjects: overall.subjects.map((summary) => toSubjectCard(summary)),
      insights: buildInsights(index, 5),
      weakTopics: overall.weakTopics.slice(0, 4).map((row) => ({
        id: row.id,
        name: row.name,
        chapter: row.chapter,
        subject: row.subject,
        mastery: row.mastery,
        exam: row.exam,
      })),
      activity: activityByDay(index, 91, today).map((day) => ({ date: day.date, activities: day.activities, minutes: day.minutes })),
      statusMix: [...statusCounts.entries()]
        .filter(([, count]) => count > 0)
        .map(([status, count]) => ({ status, count })),
      focusTopic: primary
        ? { id: primary.id, name: primary.name, chapter: primary.chapter, subject: primary.subject, reason: primary.reason }
        : null,
    } satisfies DashboardModel;
  }, [snapshot, index, exam, today]);
}

function daysUntil(dateISO: string, fromISO: string): number {
  const target = new Date(`${dateISO}T00:00:00`);
  const from = new Date(`${fromISO}T00:00:00`);
  return Math.round((target.getTime() - from.getTime()) / 86_400_000);
}

function toSubjectCard(summary: SubjectProgressSummary): SubjectCard {
  return {
    code: summary.code as SubjectCode,
    name: summary.name,
    jmPct: summary.jm.pct,
    jaPct: summary.ja.pct,
    completion: summary.pct,
    mastery: summary.mastery,
    completed: summary.completed,
    leaves: summary.leaves,
    lecturesDone: summary.lectures.completed,
    lecturesTotal: summary.lectures.total,
    accuracy: summary.questions.accuracy,
    attempted: summary.questions.attempted,
    revisionDue: summary.revisionDue,
    minutes: summary.timeMin,
  };
}

/** Where a task's own link should take the user. */
function taskHref(task: StudyTask): string {
  switch (task.link) {
    case 'lecture':
      return '/lectures';
    case 'test':
      return '/tests';
    case 'chapter':
      return task.chapterId ? `/chapter/${task.chapterId}` : '/syllabus';
    case 'topic':
      return task.topicId ? `/topic/${task.topicId}?exam=${task.exam}` : '/syllabus';
    case 'subtopic':
      return task.subtopicId ? `/topic/${task.subtopicId}?exam=${task.exam}` : '/syllabus';
    default:
      return '/planner';
  }
}

/** Convenience hook bundle used by the dashboard screen. */
export function useDashboardScreen(exam: ExamScope) {
  const model = useDashboard(exam);
  const actions = useActions();
  const snapshot = useSnapshot();

  const completeItem = React.useCallback(
    (item: PlanItem) => {
      if (item.kind === 'revision') {
        for (const id of item.revisionIds) actions.completeRevision(id);
        return;
      }
      actions.setTaskStatus(item.id.replace(/^task-/, ''), 'completed');
    },
    [actions],
  );

  const snoozeItem = React.useCallback(
    (item: PlanItem, date: string) => {
      if (item.kind === 'revision') {
        for (const id of item.revisionIds) actions.rescheduleRevision(id, date);
        return;
      }
      actions.rescheduleTask(item.id.replace(/^task-/, ''), date);
    },
    [actions],
  );

  const startTimerFor = React.useCallback(
    (item: PlanItem) => {
      actions.startTimer({
        mode: item.kind === 'revision' ? 'Revision' : 'Theory',
        exam: item.exam,
        taskId: item.kind === 'task' ? item.id.replace(/^task-/, '') : null,
        ...(item.nodeId ? nodeScopeFor(item.nodeId) : {}),
      });
    },
    [actions],
  );

  return { model, snapshot, actions, completeItem, snoozeItem, startTimerFor };
}

/** Resolves chapter/topic/subtopic ids for a node so the timer attributes time correctly. */
function nodeScopeFor(nodeId: string): { chapterId: string | null; topicId: string | null; subtopicId: string | null; subject: SubjectCode } {
  const node = nodeById(nodeId);
  if (!node) return { chapterId: null, topicId: null, subtopicId: null, subject: 'phy' };
  return {
    chapterId: node.chapter?.id ?? null,
    topicId: node.topic?.id ?? null,
    subtopicId: node.kind === 'subtopic' ? node.id : null,
    subject: node.subject.code,
  };
}
