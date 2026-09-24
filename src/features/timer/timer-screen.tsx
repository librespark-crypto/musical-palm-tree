'use client';

/**
 * Study timer - start, pause, resume and stop, with the resulting session
 * recorded against the syllabus node and (optionally) a planned task.
 *
 * Elapsed time is derived from `startedAt`/`pausedMs`/`pausedAt` in the stored
 * timer state, so a reload or a phone lock cannot lose or inflate the count.
 */
import * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, Pause, Play, RotateCcw, Square, Timer as TimerIcon, Trash2, X } from 'lucide-react';
import type { ExamScope, SessionMode, SubjectCode } from '@/lib/types';
import { SESSION_MODES, SUBJECT_LABELS } from '@/lib/constants';
import { useActions, useDerivedIndex, useSnapshot, useTracker } from '@/lib/store/tracker-store';
import { minutesBySubject, studyTimeSummary } from '@/lib/calculations/analytics';
import { formatClock, formatDate, formatMinutes, todayISO, weekdayShort } from '@/lib/date';
import { Badge, Button, Card, CardContent, EmptyState, Field, ProgressBar, Select, Stat, Textarea } from '@/components/ui/primitives';
import { DonutChart, CHART_PALETTE } from '@/components/ui/charts';
import { NodePicker, type NodeSelection } from '@/features/forms/node-picker';
import { SessionDialog } from '@/features/forms/action-forms';
import { nodeById } from '@/lib/syllabus';
import { cn } from '@/lib/utils';

const SUBJECT_COLOR: Record<SubjectCode, string> = {
  phy: CHART_PALETTE.phy,
  chem: CHART_PALETTE.chem,
  math: CHART_PALETTE.math,
};

export function TimerScreen(): React.JSX.Element {
  const snapshot = useSnapshot();
  const index = useDerivedIndex();
  const actions = useActions();
  const { clock, notify } = useTracker();
  const [manualOpen, setManualOpen] = React.useState(false);
  const [notes, setNotes] = React.useState('');

  const timer = snapshot.timer;
  const task = timer.taskId ? snapshot.tasks.find((entry) => entry.id === timer.taskId) ?? null : null;
  const selection: NodeSelection = {
    subject: timer.subject,
    chapterId: timer.chapterId,
    topicId: timer.topicId,
    subtopicId: timer.subtopicId,
  };
  const node = timer.subtopicId ?? timer.topicId ?? timer.chapterId ? nodeById(timer.subtopicId ?? timer.topicId ?? timer.chapterId) : null;

  const elapsedMs = React.useMemo(() => {
    if (!timer.running || !timer.startedAt) return 0;
    const endMs = timer.pausedAt ? new Date(timer.pausedAt).getTime() : clock;
    return Math.max(0, endMs - new Date(timer.startedAt).getTime() - timer.pausedMs);
  }, [timer, clock]);

  const time = React.useMemo(() => studyTimeSummary(index, todayISO()), [index]);
  const bySubject = React.useMemo(() => minutesBySubject(index, 7), [index]);
  const sessions = React.useMemo(
    () => snapshot.sessions.slice().sort((a, b) => b.start.localeCompare(a.start)).slice(0, 12),
    [snapshot.sessions],
  );
  const todaySessions = sessions.filter((session) => session.start.slice(0, 10) === todayISO());
  const dailyTarget = snapshot.settings.profile.dailyTargetMin;
  const todayPct = dailyTarget ? (time.today / dailyTarget) * 100 : 0;

  const start = () => {
    // startTimer snapshots the current mode/subject/topic selection and resets
    // the pause bookkeeping, so a fresh session always begins cleanly.
    actions.startTimer({
      mode: timer.mode,
      subject: timer.subject,
      exam: timer.exam,
      chapterId: timer.chapterId,
      topicId: timer.topicId,
      subtopicId: timer.subtopicId,
      taskId: timer.taskId,
    });
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Study timer</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            Time is credited to the day it started and rolls up into the subject, chapter and topic totals.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" onClick={() => setManualOpen(true)}>
            <TimerIcon aria-hidden className="size-4" />
            Log time manually
          </Button>
          <Link
            href="/planner"
            className="inline-flex h-9.5 items-center rounded-[10px] border border-line bg-surface-2 px-3.5 text-sm font-medium"
          >
            Pick a task
          </Link>
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-4">
            <div className="flex flex-col items-center gap-3 rounded-[12px] border border-line bg-surface-2 px-4 py-6">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
                {timer.running ? (timer.pausedAt ? 'Paused' : 'Recording') : 'Ready'}
              </p>
              <p className={cn('text-5xl font-semibold tabular leading-none sm:text-6xl', timer.running && !timer.pausedAt && 'text-brand')}>
                {formatClock(elapsedMs)}
              </p>
              <p className="text-center text-[12.5px] text-ink-muted">
                {node ? `${node.name} · ${SUBJECT_LABELS[selection.subject]}` : 'No topic selected - time will still be logged against the subject'}
                {task ? ` · task: ${task.title}` : ''}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                {!timer.running ? (
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => {
                      start();
                      notify('Timer started', 'success');
                    }}
                  >
                    <Play aria-hidden className="size-4" />
                    Start
                  </Button>
                ) : timer.pausedAt ? (
                  <Button variant="primary" size="lg" onClick={() => actions.resumeTimer()}>
                    <Play aria-hidden className="size-4" />
                    Resume
                  </Button>
                ) : (
                  <Button variant="secondary" size="lg" onClick={() => actions.pauseTimer()}>
                    <Pause aria-hidden className="size-4" />
                    Pause
                  </Button>
                )}
                {timer.running ? (
                  <>
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={() => {
                        actions.stopTimer({ notes });
                        setNotes('');
                        notify('Session saved', 'success');
                      }}
                    >
                      <Square aria-hidden className="size-4" />
                      Stop &amp; save
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => {
                        actions.cancelTimer();
                        notify('Session discarded');
                      }}
                    >
                      <X aria-hidden className="size-4" />
                      Discard
                    </Button>
                  </>
                ) : (
                  <Button variant="ghost" onClick={() => actions.updateTimer({ chapterId: null, topicId: null, subtopicId: null, taskId: null })}>
                    <RotateCcw aria-hidden className="size-4" />
                    Clear selection
                  </Button>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Mode" htmlFor="timer-mode">
                <Select
                  id="timer-mode"
                  value={timer.mode}
                  onChange={(event) => actions.updateTimer({ mode: event.target.value as SessionMode })}
                >
                  {SESSION_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Exam scope" htmlFor="timer-exam">
                <Select id="timer-exam" value={timer.exam} onChange={(event) => actions.updateTimer({ exam: event.target.value as ExamScope })}>
                  <option value="jm">JEE Main</option>
                  <option value="ja">JEE Advanced</option>
                </Select>
              </Field>
              <Field label="Subject" htmlFor="timer-subject">
                <Select
                  id="timer-subject"
                  value={timer.subject}
                  onChange={(event) => actions.updateTimer({ subject: event.target.value as SubjectCode, chapterId: null, topicId: null, subtopicId: null })}
                >
                  {(['phy', 'chem', 'math'] as SubjectCode[]).map((code) => (
                    <option key={code} value={code}>
                      {SUBJECT_LABELS[code]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>

            <NodePicker
              value={selection}
              onChange={(next) => actions.updateTimer({ ...next })}
              exam={timer.exam}
              idPrefix="timer"
            />

            <Field label="Task (optional)" htmlFor="timer-task" hint="Attaching a task also adds the time to that task's actual duration.">
              <Select id="timer-task" value={timer.taskId ?? ''} onChange={(event) => actions.updateTimer({ taskId: event.target.value || null })}>
                <option value="">No task</option>
                {snapshot.tasks
                  .filter((entry) => entry.status !== 'completed')
                  .slice(0, 40)
                  .map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.title} · {entry.plannedFor}
                    </option>
                  ))}
              </Select>
            </Field>

            <Field label="Session notes" htmlFor="timer-notes">
              <Textarea id="timer-notes" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="What did you cover?" />
            </Field>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <section aria-label="Today's time" className="grid grid-cols-2 gap-2.5">
            <Stat label="Today" value={formatMinutes(time.today)} hint={`${todaySessions.length} sessions`} />
            <Stat label="This week" value={formatMinutes(time.week)} hint={`${formatMinutes(time.month)} this month`} />
            <Stat label="Daily target" value={formatMinutes(dailyTarget)} hint={`${Math.round(todayPct)}% reached today`} />
            <Stat label="Daily average" value={formatMinutes(time.dailyAverage)} hint={time.bestDayDate ? `Best day ${formatDate(time.bestDayDate, 'short')} (${formatMinutes(time.bestDayMin)})` : 'No data yet'} />
          </section>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-[15px] font-semibold">Progress against today&apos;s plan</h2>
              <ProgressBar value={todayPct} tone={todayPct >= 100 ? 'success' : 'brand'} label="Today's study time against the daily target" />
              <p className="text-[12.5px] text-ink-muted">
                {time.today >= dailyTarget
                  ? `Target reached with ${formatMinutes(time.today)}. Best day so far: ${formatMinutes(time.bestDayMin)}.`
                  : `${formatMinutes(Math.max(0, dailyTarget - time.today))} left to hit today's goal.`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-[15px] font-semibold">Last 7 days by subject</h2>
              <DonutChart
                slices={(['phy', 'chem', 'math'] as SubjectCode[])
                  .map((code) => ({ label: SUBJECT_LABELS[code], value: bySubject[code] ?? 0, color: SUBJECT_COLOR[code] }))
                  .filter((slice) => slice.value > 0)}
                centerLabel={formatMinutes((bySubject.phy ?? 0) + (bySubject.chem ?? 0) + (bySubject.math ?? 0))}
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold">Recent sessions</h2>
                <span className="text-[11.5px] text-ink-muted">{snapshot.sessions.length} total</span>
              </div>
              {sessions.length === 0 ? (
                <EmptyState title="No sessions yet" description="Start the timer or log time manually - both write the same kind of record." />
              ) : (
                <ul className="divide-y divide-line">
                  {sessions.map((session) => (
                    <li key={session.id} className="flex items-center justify-between gap-2 py-2 text-[12.5px]">
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5">
                          <Badge tone={session.mode === 'Revision' ? 'warn' : 'neutral'}>{session.mode}</Badge>
                          <span className="truncate font-medium">{SUBJECT_LABELS[session.subject]}</span>
                          {session.origin === 'timer' ? <CheckCircle2 aria-hidden className="size-3 text-ink-subtle" /> : null}
                        </span>
                        <span className="mt-0.5 block truncate text-[11.5px] text-ink-muted">
                          {weekdayShort(session.start.slice(0, 10))} {formatDate(session.start.slice(0, 10), 'short')} ·{' '}
                          {session.subtopicId
                            ? nodeById(session.subtopicId)?.name ?? 'topic'
                            : session.topicId
                              ? nodeById(session.topicId)?.name ?? 'topic'
                              : 'no topic'}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <span className="font-semibold tabular">{formatMinutes(session.minutes)}</span>
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete session of ${session.minutes} minutes`}
                          onClick={() => {
                            actions.deleteSession(session.id);
                            notify('Session deleted');
                          }}
                        >
                          <Trash2 />
                        </Button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {manualOpen ? <SessionDialog onClose={() => setManualOpen(false)} node={selection} exam={timer.exam} /> : null}
    </div>
  );
}
