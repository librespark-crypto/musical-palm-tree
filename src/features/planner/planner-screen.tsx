'use client';

/**
 * Planner - day view, week view and the backlog, all driven by the same stored
 * tasks. Estimated vs actual duration is visible per task, and a heavy day is
 * flagged when the plan exceeds 140% of the daily target (the legacy rule).
 */
import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Layers,
  ListTodo,
  Play,
  Plus,
  Repeat,
  Scissors,
  Trash2,
} from 'lucide-react';
import type { ISODate, StudyTask } from '@/lib/types';
import { PRIORITY_LABELS } from '@/lib/constants';
import { useActions, useDerivedIndex, useSnapshot, useTracker } from '@/lib/store/tracker-store';
import { backlogSnapshot } from '@/lib/calculations/backlog';
import { revisionBuckets } from '@/lib/calculations/revision';
import { addDays, dayHeading, formatDate, formatMinutes, todayISO, weekdayShort } from '@/lib/date';
import { Badge, Button, Card, CardContent, EmptyState, ProgressBar, Segmented, Stat } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/ui/status';
import { QuickAdd } from '@/features/forms/quick-add';
import { TaskDialog } from '@/features/forms/action-forms';
import { useExamScope } from '@/lib/hooks/use-exam-scope';
import { cn } from '@/lib/utils';

type View = 'day' | 'week' | 'backlog';

export function PlannerScreen(): React.JSX.Element {
  const snapshot = useSnapshot();
  const index = useDerivedIndex();
  const actions = useActions();
  const { notify } = useTracker();
  const [exam] = useExamScope('jm');
  const [view, setView] = React.useState<View>('day');
  const [selected, setSelected] = React.useState<ISODate>(todayISO());
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<StudyTask | null>(null);

  const day = React.useMemo(() => backlogSnapshot(index, selected), [index, selected]);
  const week = React.useMemo(() => backlogSnapshot(index, todayISO()), [index]);
  const revisions = React.useMemo(() => revisionBuckets(index, null), [index]);

  const target = snapshot.settings.profile.dailyTargetMin;
  const planned = day.minutes.todayPlanned;
  const heavy = target > 0 && planned > target * 1.4;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Planner</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {day.today.length + day.completedToday.length + day.upcoming.length + day.backlog.length + day.overdue.length}{' '}
            tasks tracked · {formatMinutes(week.minutes.todayPlanned)} planned today ·{' '}
            {snapshot.settings.profile.dailyTargetMin ? `${formatMinutes(target)} daily target` : 'no daily target set'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<View>
            ariaLabel="Planner view"
            value={view}
            onChange={setView}
            options={[
              { value: 'day', label: 'Day', icon: <CalendarDays aria-hidden className="size-3.5" /> },
              { value: 'week', label: 'Week', icon: <ListTodo aria-hidden className="size-3.5" /> },
              { value: 'backlog', label: 'Backlog', icon: <Layers aria-hidden className="size-3.5" /> },
            ]}
          />
          <Button variant="secondary" size="md" onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-4" />
            Task
          </Button>
          <QuickAdd exam={exam} label="Quick add" />
        </div>
      </header>

      {heavy ? (
        <div role="status" className="flex items-start gap-2 rounded-[12px] border border-warn/40 bg-warn/10 px-3 py-2 text-[12.5px] text-warn">
          <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
          <p>
            {formatMinutes(planned)} is planned for {formatDate(selected)} - that is {Math.round((planned / target) * 100)}% of your{' '}
            {formatMinutes(target)} target. Consider moving something to tomorrow or into the backlog.
          </p>
        </div>
      ) : null}

      <section aria-label="Plan summary" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat
          label="Planned"
          value={formatMinutes(planned)}
          hint={`${day.counts.today + day.counts.completedToday} tasks · ${day.counts.completedToday} done`}
          icon={<Clock />}
        />
        <Stat label="Overdue" value={day.counts.overdue} tone={day.counts.overdue ? 'danger' : 'default'} hint="Past their planned day" />
        <Stat label="Backlog" value={day.counts.backlog} tone={day.counts.backlog ? 'warn' : 'default'} hint={`${formatMinutes(day.minutes.backlog)} of carried-over work`} icon={<Layers />} />
        <Stat
          label="Revisions due"
          value={revisions.overdue.length + revisions.dueToday.length}
          tone={revisions.overdue.length ? 'warn' : 'default'}
          hint={`${revisions.dueToday.length} today · ${revisions.overdue.length} overdue`}
          icon={<Repeat />}
        />
      </section>

      {view === 'day' ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button size="icon-sm" variant="ghost" aria-label="Previous day" onClick={() => setSelected(addDays(selected, -1))}>
                  <ChevronLeft />
                </Button>
                <div className="min-w-40 text-center">
                  <p className="text-[13.5px] font-semibold">{dayHeading(selected)}</p>
                  <button
                    type="button"
                    onClick={() => setSelected(todayISO())}
                    className="text-[11.5px] font-medium text-brand hover:underline"
                  >
                    {selected === todayISO() ? 'Today' : 'Jump to today'}
                  </button>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label="Next day" onClick={() => setSelected(addDays(selected, 1))}>
                  <ChevronRight />
                </Button>
              </div>
              <div className="flex items-center gap-2 text-[12px] text-ink-muted">
                <span>
                  {day.counts.completedToday} of {day.counts.today + day.counts.completedToday} complete
                </span>
                <ProgressBar
                  className="w-28"
                  value={day.counts.today + day.counts.completedToday ? (day.counts.completedToday / (day.counts.today + day.counts.completedToday)) * 100 : 0}
                  label="Completion for the selected day"
                />
              </div>
            </div>

            {day.today.length + day.completedToday.length + day.overdue.length === 0 ? (
              <EmptyState
                icon={<ListTodo />}
                title={selected === todayISO() ? 'Nothing planned for today' : `Nothing planned for ${formatDate(selected)}`}
                description="Add a task, or generate a prioritised plan from your data with the AI coach."
                action={
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
                      Add a task
                    </Button>
                    <Link href="/coach" className="inline-flex h-8 items-center rounded-[10px] border border-line bg-surface-2 px-2.5 text-[13px] font-medium">
                      Plan with the coach
                    </Link>
                  </div>
                }
              />
            ) : (
              <ul className="space-y-1.5">
                {[...day.overdue, ...day.today, ...day.completedToday]
                  .filter((task, position, all) => all.findIndex((entry) => entry.id === task.id) === position)
                  .map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      onToggle={() => actions.setTaskStatus(task.id, task.status === 'completed' ? 'pending' : 'completed')}
                      onStart={() =>
                        actions.startTimer({
                          mode: 'Theory',
                          exam: task.exam,
                          taskId: task.id,
                          subject: task.subject ?? 'phy',
                          chapterId: task.chapterId,
                          topicId: task.topicId,
                          subtopicId: task.subtopicId,
                        })
                      }
                      onTomorrow={() => actions.rescheduleTask(task.id, addDays(selected, 1))}
                      onBacklog={() => {
                        actions.moveTaskToBacklog(task.id);
                        notify('Moved to the backlog');
                      }}
                      onSplit={() => {
                        actions.splitTask(task.id, 2, selected);
                        notify('Task split into two halves');
                      }}
                      onEdit={() => setEditing(task)}
                      onDelete={() => {
                        actions.deleteTask(task.id);
                        notify('Task deleted');
                      }}
                    />
                  ))}
              </ul>
            )}

            {day.upcoming.length ? (
              <div className="border-t border-line pt-3">
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">Later this week</h3>
                <ul className="mt-1.5 space-y-1 text-[12.5px]">
                  {day.upcoming.slice(0, 6).map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate">
                        <button type="button" className="hover:underline" onClick={() => setSelected(task.plannedFor)}>
                          {weekdayShort(task.plannedFor)} {formatDate(task.plannedFor, 'short')}
                        </button>{' '}
                        · {task.title}
                      </span>
                      <span className="shrink-0 text-ink-muted">{formatMinutes(task.estMin)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}

      {view === 'week' ? (
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-[15px] font-semibold">Next seven days</h2>
            <div className="scroll-x">
              <div className="grid min-w-[720px] grid-cols-7 gap-2">
                {week.weekPlan.map((entry) => {
                  const tasks = index.tasksByDay.get(entry.date) ?? [];
                  const overTarget = target > 0 && entry.planned > target * 1.4;
                  return (
                    <div
                      key={entry.date}
                      className={cn(
                        'flex min-h-40 flex-col rounded-[10px] border p-2',
                        entry.date === todayISO() ? 'border-brand bg-brand-soft/40' : 'border-line',
                        overTarget && 'border-warn',
                      )}
                    >
                      <button type="button" className="text-left" onClick={() => setSelected(entry.date)}>
                        <p className="text-[12px] font-semibold">{weekdayShort(entry.date)}</p>
                        <p className="text-[11px] text-ink-muted">{formatDate(entry.date, 'short')}</p>
                      </button>
                      <p className="mt-1 text-[11.5px] font-medium tabular">
                        {entry.count ? `${formatMinutes(entry.planned)} planned` : 'free'}
                      </p>
                      <ProgressBar
                        className="mt-1"
                        value={entry.planned ? (entry.done / entry.planned) * 100 : 0}
                        tone={overTarget ? 'warn' : 'brand'}
                        label={`${formatDate(entry.date)} completion`}
                      />
                      <ul className="mt-1.5 space-y-1">
                        {tasks.slice(0, 4).map((task) => (
                          <li key={task.id} className="truncate text-[11px] text-ink-muted">
                            {task.status === 'completed' ? '✓ ' : ''}
                            {task.title}
                          </li>
                        ))}
                        {tasks.length > 4 ? <li className="text-[11px] text-ink-subtle">+{tasks.length - 4} more</li> : null}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {view === 'backlog' ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">Backlog</h2>
              <Button size="sm" variant="secondary" onClick={() => actions.sweepBacklogNow()}>
                Sweep unfinished work now
              </Button>
            </div>
            {week.backlog.length === 0 ? (
              <EmptyState title="Backlog is empty" description="Unfinished tasks are swept here automatically each day." />
            ) : (
              <ul className="space-y-1.5">
                {week.backlog.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggle={() => actions.setTaskStatus(task.id, 'completed')}
                    onStart={() => actions.startTimer({ mode: 'Theory', exam: task.exam, taskId: task.id, subject: task.subject ?? 'phy', chapterId: task.chapterId, topicId: task.topicId, subtopicId: task.subtopicId })}
                    onTomorrow={() => actions.restoreTaskFromBacklog(task.id, addDays(todayISO(), 1))}
                    onBacklog={() => undefined}
                    onSplit={() => actions.splitTask(task.id, 2, todayISO())}
                    onEdit={() => setEditing(task)}
                    onDelete={() => actions.deleteTask(task.id)}
                    backlogAge={task.backlogSince}
                  />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      {adding ? <TaskDialog onClose={() => setAdding(false)} exam={exam} defaults={{ plannedFor: selected }} /> : null}
      {editing ? (
        <TaskDialog
          onClose={() => setEditing(null)}
          exam={editing.exam}
          defaults={editing}
        />
      ) : null}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onStart,
  onTomorrow,
  onBacklog,
  onSplit,
  onEdit,
  onDelete,
  backlogAge,
}: {
  task: StudyTask;
  onToggle(): void;
  onStart(): void;
  onTomorrow(): void;
  onBacklog(): void;
  onSplit(): void;
  onEdit(): void;
  onDelete(): void;
  backlogAge?: ISODate | null;
}): React.JSX.Element {
  const done = task.status === 'completed';
  const overdue = !done && task.plannedFor < todayISO() && !task.inBacklog;
  const linked = task.subtopicId ?? task.topicId ?? task.chapterId;
  return (
    <li className={cn('flex flex-col gap-2 rounded-[10px] border px-2.5 py-2 sm:flex-row sm:items-center', overdue ? 'border-danger/40 bg-danger/5' : 'border-line')}>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={`Mark ${task.title} complete`}
        onClick={onToggle}
        className={cn(
          'flex size-5 shrink-0 items-center justify-center rounded-full border',
          done ? 'border-success bg-success text-white' : 'border-line-strong hover:border-brand',
        )}
      >
        {done ? <CheckCircle2 aria-hidden className="size-3.5" /> : null}
      </button>
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[13.5px] font-medium', done && 'text-ink-muted line-through')}>{task.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-muted">
          <Badge tone="outline">{task.type}</Badge>
          <Badge tone={task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warn' : 'neutral'}>
            {PRIORITY_LABELS[task.priority]}
          </Badge>
          <Badge tone={task.exam}>{task.exam.toUpperCase()}</Badge>
          <span>
            {formatMinutes(task.estMin)} est
            {task.actualMin > 0 ? ` · ${formatMinutes(task.actualMin)} actual` : ''}
          </span>
          {linked ? (
            <Link href={`/topic/${linked}?exam=${task.exam}`} className="font-medium text-brand hover:underline">
              open topic
            </Link>
          ) : null}
          {backlogAge ? <span className="text-warn">in backlog since {formatDate(backlogAge, 'short')}</span> : null}
          {overdue ? <span className="font-medium text-danger">overdue · planned {formatDate(task.plannedFor, 'short')}</span> : null}
          {task.deadline ? <span>deadline {formatDate(task.deadline, 'short')}</span> : null}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <StatusBadge status={task.status === 'completed' ? 'completed' : task.status === 'in_progress' ? 'learning' : task.status === 'skipped' ? 'not_started' : 'not_started'} />
        {!done ? (
          <Button size="icon-sm" variant="ghost" aria-label={`Start a timer for ${task.title}`} title="Start timer" onClick={onStart}>
            <Play />
          </Button>
        ) : null}
        <Button size="icon-sm" variant="ghost" aria-label={`Move ${task.title} to tomorrow`} title="Move to tomorrow" onClick={onTomorrow}>
          <CalendarDays />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label={`Move ${task.title} to the backlog`} title="Move to backlog" onClick={onBacklog}>
          <Layers />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label={`Split ${task.title} into two sessions`} title="Split in two" onClick={onSplit}>
          <Scissors />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label={`Edit ${task.title}`} title="Edit" onClick={onEdit}>
          <ListTodo />
        </Button>
        <Button size="icon-sm" variant="ghost" aria-label={`Delete ${task.title}`} title="Delete" onClick={onDelete}>
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}
