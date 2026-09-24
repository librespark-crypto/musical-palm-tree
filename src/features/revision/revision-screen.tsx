'use client';

/**
 * Revision - the spaced-revision queue.
 *
 * Buckets (overdue / today / upcoming / done) come from the stored revision
 * records; the ladder, consistency rate and calendar are computed from the same
 * records, so the numbers here always match the analytics screen.
 */
import * as React from 'react';
import Link from 'next/link';
import { CalendarCheck, CheckCircle2, Clock, Repeat, Trash2 } from 'lucide-react';
import type { Confidence, ExamScope, RevisionRecord } from '@/lib/types';
import { useActions, useDerivedIndex, useSnapshot, useTracker } from '@/lib/store/tracker-store';
import { revisionBuckets, revisionCalendar, revisionConsistency, revisionLadder } from '@/lib/calculations/revision';
import { addDays, daysFromToday, formatDate, relativeDay, todayISO, weekdayShort } from '@/lib/date';
import { Badge, Button, Card, CardContent, EmptyState, ProgressBar, Segmented, Stat, Switch } from '@/components/ui/primitives';
import { ConfidenceDots } from '@/components/ui/status';
import { QuickAdd } from '@/features/forms/quick-add';
import { RevisionDialog } from '@/features/forms/action-forms';
import { useExamScope } from '@/lib/hooks/use-exam-scope';
import { cn } from '@/lib/utils';

export function RevisionScreen(): React.JSX.Element {
  const snapshot = useSnapshot();
  const index = useDerivedIndex();
  const actions = useActions();
  const { notify } = useTracker();
  const [exam, setExam] = useExamScope('jm');
  const [scheduling, setScheduling] = React.useState(false);

  const buckets = React.useMemo(() => revisionBuckets(index, exam), [index, exam]);
  const consistency = React.useMemo(() => revisionConsistency(index, 28), [index]);
  const ladder = React.useMemo(() => revisionLadder(index, exam), [index, exam]);
  const calendar = React.useMemo(() => revisionCalendar(index, 35, exam), [index, exam]);
  const intervals = snapshot.settings.revision.intervals;

  const upcoming = buckets.upcoming.filter((revision) => revision.scheduledFor <= addDays(todayISO(), 14));

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Revision</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            Spaced revisions run at {intervals.join(' / ')} days after the previous pass. Completing a topic can schedule
            the first one automatically.
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
          <Button variant="secondary" onClick={() => setScheduling(true)}>
            <Repeat aria-hidden className="size-4" />
            Schedule
          </Button>
          <QuickAdd exam={exam} label="Quick add" />
        </div>
      </header>

      <section aria-label="Revision summary" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat
          label="Overdue"
          value={buckets.overdue.length}
          tone={buckets.overdue.length ? 'danger' : 'default'}
          hint={buckets.overdue.length ? `Oldest ${relativeDay(buckets.overdue[0]?.scheduledFor ?? null)}` : 'Nothing overdue'}
          icon={<Clock />}
        />
        <Stat label="Due today" value={buckets.dueToday.length} tone={buckets.dueToday.length ? 'warn' : 'default'} hint="Scheduled for today" />
        <Stat label="Upcoming" value={buckets.upcoming.length} hint="Scheduled later" icon={<CalendarCheck />} />
        <Stat
          label="On-time (28 d)"
          value={`${consistency.rate}%`}
          tone={consistency.rate >= 75 ? 'success' : consistency.rate > 0 ? 'warn' : 'default'}
          hint={`${consistency.completed} done · ${consistency.completedLate} late · avg delay ${consistency.averageDelayDays}d`}
          icon={<CheckCircle2 />}
        />
      </section>

      <Card>
        <CardContent className="space-y-3">
          <Switch
            checked={snapshot.settings.revision.autoSchedule}
            onCheckedChange={(checked) => {
              actions.updateSettings({ revision: { autoSchedule: checked } });
              notify(checked ? 'Revisions will be scheduled automatically' : 'Automatic scheduling turned off');
            }}
            label="Schedule revisions automatically"
            description="When a topic is marked completed, the first revision is queued for the next interval, and completing a revision queues the next one."
          />
          <div className="grid gap-2 sm:grid-cols-5">
            {ladder.map((step) => (
              <div key={step.index} className="rounded-[10px] border border-line p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Revision {step.index}</p>
                <p className="mt-0.5 text-[15px] font-semibold tabular">
                  {step.completed}
                  <span className="text-[11.5px] font-normal text-ink-muted"> done</span>
                </p>
                <p className="text-[11.5px] text-ink-muted">
                  {step.open} open{step.overdue ? ` · ${step.overdue} overdue` : ''}
                </p>
                <ProgressBar
                  className="mt-1.5"
                  value={step.completed + step.open ? (step.completed / (step.completed + step.open)) * 100 : 0}
                  tone={step.overdue ? 'warn' : 'brand'}
                  label={`Revision ${step.index} completion`}
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {buckets.overdue.length + buckets.dueToday.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 />}
          title="Nothing to revise right now"
          description={
            buckets.upcoming.length
              ? `The next revision is scheduled for ${formatDate(buckets.upcoming[0]?.scheduledFor ?? null)} (${relativeDay(buckets.upcoming[0]?.scheduledFor ?? null)}).`
              : 'Complete a topic in the syllabus and the first revision will be queued here.'
          }
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button size="sm" variant="primary" onClick={() => setScheduling(true)}>
                Schedule a revision
              </Button>
              <Link href="/syllabus" className="inline-flex h-8 items-center rounded-[10px] border border-line bg-surface-2 px-2.5 text-[13px] font-medium">
                Open the syllabus
              </Link>
            </div>
          }
        />
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {buckets.overdue.length ? (
            <RevisionList
              title="Overdue"
              tone="danger"
              revisions={buckets.overdue}
              exam={exam}
              onComplete={(id, confidence) => actions.completeRevision(id, confidence)}
              onTomorrow={(id) => actions.rescheduleRevision(id, addDays(todayISO(), 1))}
              onLater={(id) => actions.rescheduleRevision(id, addDays(todayISO(), 3))}
              onDelete={(id) => actions.deleteRevision(id)}
            />
          ) : null}
          {buckets.dueToday.length ? (
            <RevisionList
              title="Due today"
              tone="warn"
              revisions={buckets.dueToday}
              exam={exam}
              onComplete={(id, confidence) => actions.completeRevision(id, confidence)}
              onTomorrow={(id) => actions.rescheduleRevision(id, addDays(todayISO(), 1))}
              onLater={(id) => actions.rescheduleRevision(id, addDays(todayISO(), 3))}
              onDelete={(id) => actions.deleteRevision(id)}
            />
          ) : null}
          {upcoming.length ? (
            <RevisionList
              title="Next two weeks"
              tone="neutral"
              revisions={upcoming}
              exam={exam}
              onComplete={(id, confidence) => actions.completeRevision(id, confidence)}
              onTomorrow={(id) => actions.rescheduleRevision(id, addDays(todayISO(), 1))}
              onLater={(id) => actions.rescheduleRevision(id, addDays(todayISO(), 3))}
              onDelete={(id) => actions.deleteRevision(id)}
            />
          ) : null}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-[15px] font-semibold">Next 35 days</h2>
              <p className="text-[12px] text-ink-muted">Revisions scheduled per day, with the ones already completed.</p>
              <ul className="space-y-1">
                {calendar
                  .filter((day) => day.due > 0 || day.completed > 0)
                  .slice(0, 21)
                  .map((day) => (
                    <li key={day.date} className="flex items-center gap-2 text-[12.5px]">
                      <span className="w-16 shrink-0 text-ink-muted">{weekdayShort(day.date)}</span>
                      <span className="w-20 shrink-0">{formatDate(day.date, 'short')}</span>
                      <span className="flex-1">
                        <ProgressBar
                          value={day.due ? (day.completed / day.due) * 100 : day.completed ? 100 : 0}
                          tone={day.date < todayISO() && day.completed < day.due ? 'danger' : 'brand'}
                          label={`${formatDate(day.date)} revisions`}
                        />
                      </span>
                      <span className="w-16 shrink-0 text-right tabular text-ink-muted">
                        {day.completed}/{day.due}
                      </span>
                    </li>
                  ))}
                {calendar.every((day) => day.due === 0 && day.completed === 0) ? (
                  <li className="text-[12.5px] text-ink-muted">Nothing scheduled in this window.</li>
                ) : null}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-[15px] font-semibold">Recently completed</h2>
              {buckets.completed.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">No revisions completed yet.</p>
              ) : (
                <ul className="space-y-1.5">
                  {buckets.completed
                    .slice()
                    .sort((a, b) => (b.completedOn ?? '').localeCompare(a.completedOn ?? ''))
                    .slice(0, 8)
                    .map((revision) => (
                      <li key={revision.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                        <Link href={`/topic/${revision.nodeId}?exam=${revision.exam}`} className="min-w-0 truncate hover:underline">
                          {revision.topicName}
                        </Link>
                        <span className="flex shrink-0 items-center gap-2">
                          <Badge tone="success">R{revision.index}</Badge>
                          <span className="text-ink-muted">
                            {revision.completedOn ? formatDate(revision.completedOn, 'short') : ''}
                            {revision.completedOn && revision.completedOn > revision.scheduledFor
                              ? ` (+${daysFromToday(revision.scheduledFor) < 0 ? Math.abs(daysFromToday(revision.scheduledFor)) : 0}d)`
                              : ''}
                          </span>
                          <ConfidenceDots value={revision.confidence} />
                        </span>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {scheduling ? <RevisionDialog onClose={() => setScheduling(false)} exam={exam} /> : null}
    </div>
  );
}

function RevisionList({
  title,
  revisions,
  exam,
  tone,
  onComplete,
  onTomorrow,
  onLater,
  onDelete,
}: {
  title: string;
  revisions: RevisionRecord[];
  exam: ExamScope;
  tone: 'danger' | 'warn' | 'neutral';
  onComplete(id: string, confidence?: Confidence): void;
  onTomorrow(id: string): void;
  onLater(id: string): void;
  onDelete(id: string): void;
}): React.JSX.Element {
  const { notify } = useTracker();
  const sorted = revisions.slice().sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor) || a.index - b.index);
  return (
    <Card className={cn(tone === 'danger' && 'border-danger/40')}>
      <CardContent className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <Badge tone={tone === 'danger' ? 'danger' : tone === 'warn' ? 'warn' : 'neutral'}>{sorted.length}</Badge>
        </div>
        <ul className="space-y-1.5">
          {sorted.map((revision) => (
            <li
              key={revision.id}
              className={cn(
                'flex flex-col gap-2 rounded-[10px] border px-2.5 py-2 sm:flex-row sm:items-center',
                tone === 'danger' ? 'border-danger/30 bg-danger/5' : 'border-line',
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone="neutral">R{revision.index}</Badge>
                  <Link href={`/topic/${revision.nodeId}?exam=${revision.exam}`} className="truncate text-[13.5px] font-medium hover:underline">
                    {revision.topicName}
                  </Link>
                  <Badge tone={revision.exam}>{revision.exam.toUpperCase()}</Badge>
                </div>
                <p className="mt-0.5 text-[11.5px] text-ink-muted">
                  {revision.chapterName} · due {formatDate(revision.scheduledFor, 'short')} ({relativeDay(revision.scheduledFor)})
                  {revision.auto ? ' · auto-scheduled' : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="flex items-center gap-1.5">
                  <ConfidenceDots
                    value={null}
                    onChange={(confidence) => {
                      onComplete(revision.id, confidence);
                      notify('Revision completed', 'success');
                    }}
                  />
                  <span className="text-[11px] text-ink-subtle">confidence</span>
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    onComplete(revision.id);
                    notify('Revision completed', 'success');
                  }}
                >
                  Done
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onTomorrow(revision.id)}>
                  Tomorrow
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onLater(revision.id)}>
                  +3 days
                </Button>
                <Button size="icon-sm" variant="ghost" aria-label={`Delete revision ${revision.index} of ${revision.topicName}`} onClick={() => onDelete(revision.id)}>
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[11.5px] text-ink-subtle">
          Scope: {exam === 'jm' ? 'JEE Main' : 'JEE Advanced'} only. Switch the scope above to see the other exam&apos;s queue.
        </p>
      </CardContent>
    </Card>
  );
}
