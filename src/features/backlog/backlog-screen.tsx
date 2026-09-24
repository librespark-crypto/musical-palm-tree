'use client';

/**
 * Backlog - everything that slipped plus the work that is still ahead of you.
 *
 * The suggestion list is generated from stored data only: unfinished lectures,
 * untouched chapters and topics with no practice. "Add" turns a suggestion into a
 * real task, so nothing here is a dead end.
 */
import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, BookOpen, CalendarDays, CheckCircle2, Layers, Sparkles } from 'lucide-react';
import type { ExamScope, SubjectCode } from '@/lib/types';
import { SUBJECT_LABELS } from '@/lib/constants';
import { useActions, useDerivedIndex, useSnapshot, useTracker } from '@/lib/store/tracker-store';
import { backlogSnapshot, backlogSuggestions, backlogSummary } from '@/lib/calculations/backlog';
import { addDays, formatDate, formatMinutes, relativeDay, todayISO } from '@/lib/date';
import { Badge, Button, Card, CardContent, EmptyState, ProgressBar, Segmented, Stat } from '@/components/ui/primitives';
import { StatusDot } from '@/components/ui/status';
import { QuickAdd } from '@/features/forms/quick-add';
import { useExamScope } from '@/lib/hooks/use-exam-scope';
import { cn } from '@/lib/utils';

type View = 'backlog' | 'suggestions';

export function BacklogScreen(): React.JSX.Element {
  const snapshot = useSnapshot();
  const index = useDerivedIndex();
  const actions = useActions();
  const { notify } = useTracker();
  const [exam, setExam] = useExamScope('jm');
  const [view, setView] = React.useState<View>('backlog');
  const [subjectFilter, setSubjectFilter] = React.useState<SubjectCode | 'all'>('all');

  const backlog = React.useMemo(() => backlogSnapshot(index, todayISO()), [index]);
  const summary = React.useMemo(() => backlogSummary(snapshot), [snapshot]);
  const suggestions = React.useMemo(() => backlogSuggestions(index, exam, 24), [index, exam]);

  const items = [...backlog.overdue, ...backlog.backlog]
    .filter((task, position, all) => all.findIndex((entry) => entry.id === task.id) === position)
    .filter((task) => subjectFilter === 'all' || task.subject === subjectFilter);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Backlog</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            Carried-over work, overdue tasks and the biggest gaps left in the syllabus.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented<ExamScope>
            ariaLabel="Exam scope"
            value={exam}
            onChange={setExam}
            options={[
              { value: 'jm', label: 'JEE Main' },
              { value: 'ja', label: 'JEE Advanced' },
            ]}
          />
          <Segmented<View>
            ariaLabel="Backlog view"
            value={view}
            onChange={setView}
            options={[
              { value: 'backlog', label: 'Carried over' },
              { value: 'suggestions', label: 'Needs attention' },
            ]}
          />
          <QuickAdd exam={exam} label="Add" />
        </div>
      </header>

      <section aria-label="Backlog summary" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Open tasks" value={summary.openCount} hint={`${summary.backlogCount} in the backlog · ${summary.overdueCount} overdue`} icon={<Layers />} />
        <Stat
          label="Debt"
          value={formatMinutes(summary.minutes)}
          tone={summary.minutes > 600 ? 'danger' : summary.minutes > 0 ? 'warn' : 'default'}
          hint={backlog.oldestBacklogDays ? `Oldest item ${backlog.oldestBacklogDays} days old` : 'Nothing carried over'}
        />
        <Stat
          label="7-day completion"
          value={`${summary.completionRate7d}%`}
          tone={summary.completionRate7d >= 70 ? 'success' : summary.completionRate7d > 0 ? 'warn' : 'default'}
          hint="Tasks completed against tasks planned this week"
          icon={<CheckCircle2 />}
        />
        <Stat
          label="Due today"
          value={backlog.counts.today + backlog.counts.completedToday}
          hint={`${backlog.counts.completedToday} already done · ${formatMinutes(backlog.minutes.todayPlanned)} planned`}
          icon={<CalendarDays />}
        />
      </section>

      {view === 'backlog' ? (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-[15px] font-semibold">Carried over &amp; overdue</h2>
              <div className="flex flex-wrap items-center gap-1.5">
                {(['all', 'phy', 'chem', 'math'] as const).map((code) => (
                  <button
                    key={code}
                    type="button"
                    aria-pressed={subjectFilter === code}
                    onClick={() => setSubjectFilter(code)}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors',
                      subjectFilter === code ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink-muted hover:text-ink',
                    )}
                  >
                    {code === 'all' ? 'All subjects' : SUBJECT_LABELS[code]}
                  </button>
                ))}
              </div>
            </div>

            {items.length === 0 ? (
              <EmptyState
                title="Nothing carried over"
                description="Every task is either scheduled for today or already done. The daily sweep moves unfinished work here automatically."
                action={
                  <Button size="sm" variant="secondary" onClick={() => actions.sweepBacklogNow()}>
                    Run the sweep now
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-1.5">
                {items.map((task) => (
                  <li key={task.id} className="flex flex-col gap-2 rounded-[10px] border border-line px-2.5 py-2 sm:flex-row sm:items-center">
                    <StatusDot status={task.status === 'in_progress' ? 'learning' : 'not_started'} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13.5px] font-medium">{task.title}</p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-muted">
                        <Badge tone="outline">{task.type}</Badge>
                        <Badge tone={task.exam}>{task.exam.toUpperCase()}</Badge>
                        <Badge tone={task.priority === 'high' ? 'danger' : task.priority === 'medium' ? 'warn' : 'neutral'}>{task.priority}</Badge>
                        <span>{formatMinutes(task.estMin)}</span>
                        <span>planned {formatDate(task.plannedFor, 'short')} ({relativeDay(task.plannedFor)})</span>
                        {task.backlogSince ? <span className="text-warn">carried since {formatDate(task.backlogSince, 'short')}</span> : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1">
                      <Button size="sm" variant="secondary" onClick={() => actions.restoreTaskFromBacklog(task.id, todayISO())}>
                        Today
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => actions.restoreTaskFromBacklog(task.id, addDays(todayISO(), 1))}>
                        Tomorrow
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          actions.updateTask(task.id, { priority: 'high' });
                          notify('Priority raised to high', 'success');
                        }}
                      >
                        Raise priority
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => actions.setTaskStatus(task.id, 'skipped')}>
                        Skip
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                  <Sparkles aria-hidden className="size-4 text-ink-subtle" />
                  Needs attention
                </h2>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">
                  Generated from your stored records: unfinished lectures, untouched chapters and topics with no practice.
                </p>
              </div>
              <Badge tone="neutral">{exam === 'jm' ? 'JEE Main' : 'JEE Advanced'} scope</Badge>
            </div>

            {suggestions.length === 0 ? (
              <EmptyState
                icon={<BookOpen />}
                title="Nothing outstanding in this scope"
                description="Every chapter in this exam scope has at least some coverage. Switch scope or log more work."
              />
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {suggestions.map((suggestion) => (
                  <li key={`${suggestion.kind}-${suggestion.id}`} className="flex flex-col gap-2 rounded-[10px] border border-line p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium">{suggestion.title}</p>
                        <p className="truncate text-[11.5px] text-ink-muted">{suggestion.subtitle}</p>
                      </div>
                      <Badge tone={suggestion.priority === 'high' ? 'danger' : suggestion.priority === 'medium' ? 'warn' : 'neutral'}>
                        {suggestion.priority}
                      </Badge>
                    </div>
                    <p className="text-[11.5px] text-ink-muted">{suggestion.reason}</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          actions.addTask({
                            title: suggestion.title,
                            type: suggestion.kind === 'lecture' ? 'Lecture' : 'Topic study',
                            exam: suggestion.exam,
                            priority: suggestion.priority,
                            subject: suggestion.subject,
                            chapterId: suggestion.kind === 'chapter' ? suggestion.id : null,
                            topicId: suggestion.kind === 'topic' ? suggestion.id : null,
                            estMin: suggestion.estMin,
                            link: suggestion.kind === 'chapter' ? 'chapter' : 'topic',
                          });
                          notify('Added to today\'s plan', 'success');
                        }}
                      >
                        Add to today
                      </Button>
                      <Link
                        href={suggestion.kind === 'lecture' ? '/lectures' : `/topic/${suggestion.id}?exam=${suggestion.exam}`}
                        className="text-[12.5px] font-medium text-brand hover:underline"
                      >
                        Open
                      </Link>
                      <span className="text-[11.5px] text-ink-subtle">{formatMinutes(suggestion.estMin)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {summary.minutes > 0 ? (
        <Card>
          <CardContent className="space-y-2">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <AlertTriangle aria-hidden className="size-4 text-warn" />
              Backlog health
            </h2>
            <p className="text-[12.5px] text-ink-muted">
              {summary.minutes > 0
                ? `${formatMinutes(summary.minutes)} of work is waiting. At ${formatMinutes(Math.max(30, snapshot.settings.profile.dailyTargetMin * 0.2))} a day of backlog clearance it would take ${Math.ceil(
                    summary.minutes / Math.max(30, snapshot.settings.profile.dailyTargetMin * 0.2),
                  )} days to clear.`
                : 'Nothing in the backlog.'}
            </p>
            <ProgressBar
              value={summary.openCount ? (summary.backlogCount / summary.openCount) * 100 : 0}
              tone="warn"
              label="Share of open tasks that are backlog"
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
