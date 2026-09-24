'use client';

/**
 * Dashboard - "what do I do right now?"
 *
 * Layout logic: on desktop the command strip, today's plan and the analytics
 * blocks sit side by side; on a phone everything collapses to a single column
 * with the plan first, because that is the only part a student needs at 7am.
 */
import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Flame,
  Gauge,
  Layers,
  ListTodo,
  Play,
  Repeat,
  Sparkles,
  Timer,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { ExamScope, StudyStatus, SubjectCode } from '@/lib/types';
import { Badge, Button, Card, CardContent, CheckButton, EmptyState, ProgressBar, Segmented, Stat } from '@/components/ui/primitives';
import { Heatmap } from '@/components/ui/charts';
import { SUBJECT_LABELS } from '@/lib/constants';
import { addDays, formatDate, formatMinutes, relativeDay, weekdayShort } from '@/lib/date';
import { cn } from '@/lib/utils';
import { useDashboardScreen, type PlanItem, type SubjectCard } from '@/features/dashboard/use-dashboard';

const SUBJECT_TONE: Record<SubjectCode, 'phy' | 'chem' | 'math'> = { phy: 'phy', chem: 'chem', math: 'math' };
const SUBJECT_BAR: Record<SubjectCode, string> = { phy: 'var(--chart-phy)', chem: 'var(--chart-chem)', math: 'var(--chart-math)' };

export function DashboardScreen({ userName }: { userName?: string }): React.JSX.Element {
  const [exam, setExam] = React.useState<ExamScope>('jm');
  const { model, actions, completeItem, snoozeItem, startTimerFor } = useDashboardScreen(exam);

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  const timePct = model.time.target > 0 ? (model.time.today / model.time.target) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* ---------------------------------------------------------------- header */}
      <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-[12px] font-medium uppercase tracking-wide text-ink-subtle">
            {weekdayShort(model.today)}, {formatDate(model.today, 'long')}
          </p>
          <h1 className="mt-0.5 text-xl font-semibold tracking-tight sm:text-2xl">
            {greeting}
            {userName ? `, ${userName}` : ''}
          </h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarClock aria-hidden className="size-3.5" />
              {model.countdown.label || 'JEE'} Main in{' '}
              <strong className="font-semibold text-ink">{Math.max(0, model.countdown.mainInDays)} days</strong>
            </span>
            <span className="inline-flex items-center gap-1.5">
              Advanced in <strong className="font-semibold text-ink">{Math.max(0, model.countdown.advancedInDays)} days</strong>
            </span>
            {model.streak.current > 0 ? (
              <span className="inline-flex items-center gap-1.5 text-warn">
                <Flame aria-hidden className="size-3.5" />
                {model.streak.current}-day streak
              </span>
            ) : null}
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
          <Link
            href="/timer"
            className="inline-flex h-9.5 items-center gap-2 rounded-[10px] bg-brand px-3.5 text-sm font-medium text-brand-ink shadow-card transition-colors hover:bg-brand-strong"
          >
            <Timer aria-hidden className="size-4" />
            Study timer
          </Link>
        </div>
      </header>

      {/* ------------------------------------------------------------ focus KPIs */}
      <section aria-label="Today at a glance" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Card className="col-span-2 p-3.5 lg:col-span-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Study time today</p>
              <p className="mt-1 text-[22px] font-semibold leading-none tabular">{formatMinutes(model.time.today)}</p>
            </div>
            <StatPill label="Target" value={formatMinutes(model.time.target)} />
          </div>
          <ProgressBar className="mt-2.5" value={timePct} label="Study time against today's target" tone={timePct >= 100 ? 'success' : 'brand'} />
          <p className="mt-1.5 text-[11.5px] text-ink-muted">
            {model.time.today >= model.time.target
              ? `Target met - ${model.time.week > 0 ? `${formatMinutes(model.time.week)} this week` : 'keep going'}`
              : `${formatMinutes(Math.max(0, model.time.target - model.time.today))} left of today's goal`}
          </p>
        </Card>
        <Stat
          label="Today's plan"
          value={`${model.timetable.rows.filter((row) => !row.done).length} left`}
          hint={`${formatMinutes(model.timetable.remainingMinutes)} planned · ${model.timetable.doneMinutes > 0 ? `${formatMinutes(model.timetable.doneMinutes)} done` : 'nothing completed yet'}`}
          icon={<ClipboardList />}
        />
        <Stat
          label="Revisions due"
          value={model.revisions.dueToday + model.revisions.overdue}
          tone={model.revisions.overdue > 0 ? 'danger' : 'default'}
          hint={`${model.revisions.dueToday} today · ${model.revisions.overdue} overdue · ${model.revisions.upcoming} upcoming`}
          icon={<Repeat />}
        />
        <Stat
          label={`${exam === 'jm' ? 'Main' : 'Advanced'} syllabus`}
          value={`${model.scope.pct}%`}
          hint={`${model.scope.completed}/${model.scope.leaves} subtopics · mastery ${model.scope.mastery}%`}
          icon={<BookOpen />}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* ------------------------------------------------------- today's plan */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-2 p-4 pb-0">
              <div>
                <h2 className="text-[15px] font-semibold leading-tight">Today&apos;s plan</h2>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">
                  {model.timetable.rows.length
                    ? `${formatMinutes(model.timetable.plannedMinutes)} planned across ${model.timetable.rows.length} item${model.timetable.rows.length === 1 ? '' : 's'}`
                    : 'Nothing scheduled yet for today'}
                </p>
              </div>
              <Link href="/planner" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
                Open planner <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
            <CardContent className="pt-3">
              {model.timetable.rows.length === 0 ? (
                <EmptyState
                  icon={<ListTodo />}
                  title="No tasks or revisions for today"
                  description="Add tasks in the planner, set revisions from a syllabus topic, or generate a plan with the AI coach."
                  action={
                    <div className="flex flex-wrap justify-center gap-2">
                      <Link
                        href="/planner"
                        className="inline-flex h-8 items-center rounded-[10px] bg-brand px-2.5 text-[13px] font-medium text-brand-ink"
                      >
                        Plan today
                      </Link>
                      <Link
                        href="/syllabus"
                        className="inline-flex h-8 items-center rounded-[10px] border border-line bg-surface-2 px-2.5 text-[13px] font-medium"
                      >
                        Set revisions from the syllabus
                      </Link>
                    </div>
                  }
                />
              ) : (
                <ul className="space-y-1.5">
                  {model.timetable.rows.map((row) => (
                    <PlanRow
                      key={row.id}
                      row={row}
                      onComplete={() => completeItem(row)}
                      onSnooze={() => snoozeItem(row, addDays(model.today, 1))}
                      onStart={() => startTimerFor(row)}
                    />
                  ))}
                </ul>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-line pt-3 text-[12px] text-ink-muted">
                <Link href="/planner" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                  Plan the day
                </Link>
                <span aria-hidden>·</span>
                <Link href="/backlog" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                  {model.backlog.counts.backlog} in backlog
                </Link>
                <span aria-hidden>·</span>
                <button
                  type="button"
                  className="font-medium text-brand hover:underline"
                  onClick={() => actions.sweepBacklogNow()}
                >
                  Sweep unfinished work to backlog
                </button>
              </div>
            </CardContent>
          </Card>

          {/* -------------------------------------------------------- subject grid */}
          <section aria-label="Subject progress" className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Subject progress</h2>
              <Link href="/syllabus" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
                Full syllabus <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {model.subjects.map((subject) => (
                <SubjectTile key={subject.code} subject={subject} activeExam={exam} />
              ))}
            </div>
          </section>

          {/* ------------------------------------------------------------ backlog */}
          <Card>
            <div className="flex flex-wrap items-start justify-between gap-2 p-4 pb-0">
              <div>
                <h2 className="flex items-center gap-2 text-[15px] font-semibold leading-tight">
                  <Layers aria-hidden className="size-4 text-ink-subtle" />
                  Lecture backlog &amp; carried-over work
                </h2>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">
                  {model.lectures.total === 0
                    ? 'No lectures tracked yet'
                    : `${model.lectures.completed}/${model.lectures.total} lectures complete · ${model.lectures.watchedHours}h watched of ${model.lectures.watchedHours + model.lectures.remainingHours}h`}
                </p>
              </div>
              <Link href="/backlog" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
                Backlog <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </div>
            <CardContent className="grid gap-3 pt-3 sm:grid-cols-2">
              <div className="space-y-2.5">
                <MiniBar
                  label="Backlog items"
                  value={model.backlog.counts.backlog}
                  hint={`${formatMinutes(model.backlog.minutes.backlog)} of work carried over`}
                  tone={model.backlog.counts.backlog > 0 ? 'warn' : 'brand'}
                />
                <MiniBar
                  label="Overdue"
                  value={model.backlog.counts.overdue}
                  hint={model.backlog.oldestBacklogDays > 0 ? `Oldest item ${model.backlog.oldestBacklogDays} days old` : 'Nothing overdue'}
                  tone={model.backlog.counts.overdue > 0 ? 'danger' : 'brand'}
                />
                <MiniBar
                  label="Lectures in progress"
                  value={model.lectures.inProgress}
                  hint={model.lectures.remainingHours > 0 ? `${model.lectures.remainingHours}h of lectures remaining` : 'No lecture hours remaining'}
                  tone="brand"
                />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">Next 7 days</p>
                <ul className="mt-2 space-y-1.5">
                  {model.backlog.weekPlan.map((day) => (
                    <li key={day.date} className="flex items-center gap-2 text-[12.5px]">
                      <span className="w-10 shrink-0 text-ink-muted">{weekdayShort(day.date)}</span>
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className="block h-full rounded-full bg-brand"
                          style={{ width: `${Math.min(100, day.planned ? (day.done / day.planned) * 100 : 0)}%` }}
                        />
                      </span>
                      <span className="w-24 shrink-0 text-right tabular text-ink-muted">
                        {day.count ? `${day.count} · ${formatMinutes(day.planned)}` : 'free'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ----------------------------------------------------------- side column */}
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold">
              <Sparkles aria-hidden className="size-4 text-ink-subtle" />
              Facts from your data
            </h2>
            {model.insights.length === 0 ? (
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
                Nothing to flag yet - log a study session, a revision or a test and this list will reflect it.
              </p>
            ) : (
              <ul className="mt-2.5 space-y-2">
                {model.insights.map((insight) => (
                  <li key={insight.id} className="flex gap-2 text-[12.5px] leading-relaxed">
                    <span
                      aria-hidden
                      className={cn(
                        'mt-1.5 size-1.5 shrink-0 rounded-full',
                        insight.tone === 'warn' && 'bg-warn',
                        insight.tone === 'good' && 'bg-success',
                      )}
                    />
                    <span className="text-ink-muted">{insight.text}</span>
                  </li>
                ))}
              </ul>
            )}
            <Link
              href="/coach"
              className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline"
            >
              Ask the coach for a plan <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold">Questions &amp; accuracy</h2>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">
                  {model.questions.attempted} attempted · {model.questions.accuracy}% accuracy
                </p>
              </div>
              <Badge tone={model.questions.accuracy >= 60 ? 'success' : model.questions.accuracy > 0 ? 'warn' : 'neutral'}>
                {model.questions.accuracy > 0 ? `${model.questions.correct} correct` : 'No logs yet'}
              </Badge>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2.5">
              <MiniStat label="Today" value={`${model.questions.todayAttempted} q`} />
              <MiniStat label="Lectures" value={`${model.lectures.completed}/${model.lectures.total}`} />
              <MiniStat label="Tests taken" value={`${model.tests.count}`} />
              <MiniStat
                label="Last test"
                value={model.tests.latestPct === null ? '-' : `${model.tests.latestPct}%`}
                hint={model.tests.latestName ? relativeDay(model.tests.latestDate) : 'No tests recorded'}
              />
            </dl>
            <Link href="/analytics" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
              Full analytics <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </Card>

          <Card className="p-4">
            <div className="flex items-start justify-between gap-2">
              <h2 className="text-[15px] font-semibold">Test performance</h2>
              <Gauge aria-hidden className="size-4 text-ink-subtle" />
            </div>
            {model.tests.count === 0 ? (
              <p className="mt-2 text-[12.5px] leading-relaxed text-ink-muted">
                No mock tests recorded. Add one after your next test and the score, accuracy and subject split will be tracked here.
              </p>
            ) : (
              <>
                <p className="mt-2 text-[12.5px] text-ink-muted">
                  Average <strong className="text-ink">{model.tests.averagePct}%</strong> across {model.tests.count} test
                  {model.tests.count === 1 ? '' : 's'} · overall accuracy {model.tests.accuracy}%
                </p>
                {model.tests.latestDelta !== null ? (
                  <p
                    className={cn(
                      'mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium',
                      model.tests.latestDelta >= 0 ? 'text-success' : 'text-danger',
                    )}
                  >
                    {model.tests.latestDelta >= 0 ? <TrendingUp aria-hidden className="size-3.5" /> : <TrendingDown aria-hidden className="size-3.5" />}
                    {model.tests.latestDelta >= 0 ? '+' : ''}
                    {model.tests.latestDelta} pts vs the previous test
                  </p>
                ) : null}
              </>
            )}
            <Link href="/tests" className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
              Test history <ArrowRight aria-hidden className="size-3.5" />
            </Link>
          </Card>

          <Card className="p-4">
            <h2 className="text-[15px] font-semibold">Study consistency</h2>
            <p className="mt-0.5 text-[12.5px] text-ink-muted">
              Current streak <strong className="text-ink">{model.streak.current} days</strong> · best {model.streak.best} ·{' '}
              {model.streak.activeDays} active days in the last year
            </p>
            <div className="mt-3">
              <Heatmap days={model.activity} />
            </div>
          </Card>

          {model.weakTopics.length > 0 ? (
            <Card className="p-4">
              <h2 className="text-[15px] font-semibold">Needs attention</h2>
              <ul className="mt-2.5 space-y-2">
                {model.weakTopics.map((topic) => (
                  <li key={`${topic.id}-${topic.exam}`} className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <Link href={`/topic/${topic.id}?exam=${topic.exam}`} className="block truncate text-[13px] font-medium hover:underline">
                        {topic.name}
                      </Link>
                      <p className="truncate text-[11.5px] text-ink-muted">
                        {topic.chapter} · {SUBJECT_LABELS[topic.subject]}
                      </p>
                    </div>
                    <Badge tone={topic.mastery < 45 ? 'danger' : 'warn'}>{topic.mastery}% mastery</Badge>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function PlanRow({
  row,
  onComplete,
  onSnooze,
  onStart,
}: {
  row: PlanItem;
  onComplete(): void;
  onSnooze(): void;
  onStart(): void;
}): React.JSX.Element {
  return (
    <li className="group flex items-start gap-2.5 rounded-[10px] border border-transparent px-2 py-2 transition-colors hover:border-line hover:bg-surface-2/60">
      <CheckButton checked={row.done} onToggle={onComplete} label={`Mark ${row.title} complete`} />
      <div className="min-w-0 flex-1">
        <p className={cn('truncate text-[13.5px] font-medium', row.done && 'text-ink-muted line-through')}>{row.title}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-muted">
          {row.subtitle ? <span className="truncate">{row.subtitle}</span> : null}
          <span>{formatMinutes(row.minutes)}</span>
          {row.overdueDays > 0 ? <span className="font-medium text-danger">{row.overdueDays}d overdue</span> : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Badge tone={row.priority === 'high' ? 'danger' : row.priority === 'medium' ? 'warn' : 'neutral'}>{row.priority}</Badge>
        <Badge tone={row.exam}>{row.exam.toUpperCase()}</Badge>
        {!row.done ? (
          <>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Start a timed session for ${row.title}`}
              title="Start timer for this item"
              onClick={onStart}
            >
              <Play />
            </Button>
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Move ${row.title} to tomorrow`}
              title="Move to tomorrow"
              onClick={onSnooze}
            >
              <CalendarClock />
            </Button>
          </>
        ) : (
          <span className="pr-1 text-success">
            <CheckCircle2 aria-hidden className="size-4" />
          </span>
        )}
      </div>
    </li>
  );
}

function StatPill({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-[9px] border border-line px-2 py-1 text-right">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="text-[12.5px] font-semibold tabular">{value}</p>
    </div>
  );
}

function MiniStat({ label, value, hint }: { label: string; value: string; hint?: string }): React.JSX.Element {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{label}</dt>
      <dd className="text-[15px] font-semibold tabular">{value}</dd>
      {hint ? <dd className="text-[11px] text-ink-muted">{hint}</dd> : null}
    </div>
  );
}

function MiniBar({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: number;
  hint: string;
  tone: 'brand' | 'warn' | 'danger';
}): React.JSX.Element {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12.5px] font-medium">{label}</span>
        <span className={cn('text-[13px] font-semibold tabular', tone === 'warn' && 'text-warn', tone === 'danger' && 'text-danger')}>
          {value}
        </span>
      </div>
      <p className="text-[11.5px] text-ink-muted">{hint}</p>
    </div>
  );
}

function SubjectTile({ subject, activeExam }: { subject: SubjectCard; activeExam: ExamScope }): React.JSX.Element {
  const active = activeExam === 'jm' ? subject.jmPct : subject.jaPct;
  return (
    <Link
      href={`/subject/${subject.code}`}
      className="block rounded-[var(--radius-card)] border border-line bg-surface p-3.5 shadow-card transition-colors hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[13.5px] font-semibold">{subject.name}</p>
          <p className="text-[11.5px] text-ink-muted">
            {subject.completed}/{subject.leaves} subtopics
          </p>
        </div>
        <Badge tone={SUBJECT_TONE[subject.code]}>{active}%</Badge>
      </div>
      <div className="mt-2.5 space-y-1.5">
        <div className="flex items-center gap-2">
          <span className="w-6 text-[10px] font-semibold uppercase text-ink-subtle">JM</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full" style={{ width: `${subject.jmPct}%`, background: SUBJECT_BAR[subject.code] }} />
          </span>
          <span className="w-9 text-right text-[11px] tabular text-ink-muted">{subject.jmPct}%</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-6 text-[10px] font-semibold uppercase text-ink-subtle">JA</span>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full" style={{ width: `${subject.jaPct}%`, background: SUBJECT_BAR[subject.code] }} />
          </span>
          <span className="w-9 text-right text-[11px] tabular text-ink-muted">{subject.jaPct}%</span>
        </div>
      </div>
      <dl className="mt-2.5 grid grid-cols-3 gap-1.5 border-t border-line pt-2 text-[11px]">
        <div>
          <dt className="text-ink-subtle">Mastery</dt>
          <dd className="font-semibold tabular">{subject.mastery}%</dd>
        </div>
        <div>
          <dt className="text-ink-subtle">Attendance</dt>
          <dd className="font-semibold tabular">
            {subject.lecturesTotal ? `${subject.lecturesDone}/${subject.lecturesTotal}` : '-'}
          </dd>
        </div>
        <div>
          <dt className="text-ink-subtle">Accuracy</dt>
          <dd className="font-semibold tabular">{subject.attempted ? `${subject.accuracy}%` : '-'}</dd>
        </div>
      </dl>
      {subject.revisionDue > 0 ? (
        <p className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-warn">
          <Repeat aria-hidden className="size-3" />
          {subject.revisionDue} revision{subject.revisionDue === 1 ? '' : 's'} due
        </p>
      ) : null}
    </Link>
  );
}

const STATUS_LABEL: Record<StudyStatus, string> = {
  completed: 'Complete',
  learning: 'In progress',
  weak: 'Weak',
  revision_due: 'Revision due',
  not_started: 'Not started',
};

export function StatusLegend({ statusMix }: { statusMix: { status: StudyStatus; count: number }[] }): React.JSX.Element {
  return (
    <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink-muted">
      {statusMix.map((entry) => (
        <li key={entry.status} className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className={cn(
              'size-2 rounded-full',
              entry.status === 'completed' && 'bg-success',
              entry.status === 'learning' && 'bg-info',
              entry.status === 'weak' && 'bg-danger',
              entry.status === 'revision_due' && 'bg-warn',
              entry.status === 'not_started' && 'bg-ink-subtle',
            )}
          />
          {STATUS_LABEL[entry.status]} · {entry.count}
        </li>
      ))}
    </ul>
  );
}

