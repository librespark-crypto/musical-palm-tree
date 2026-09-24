'use client';

/**
 * Lectures - the watch list with real progress.
 *
 * Marking a lecture complete forces its watched duration to the full length
 * (the legacy rule), and watching time is credited to the linked chapter/topic.
 */
import * as React from 'react';
import Link from 'next/link';
import { BookOpen, CheckCircle2, Plus, Trash2 } from 'lucide-react';
import type { Lecture, LectureStatus, SubjectCode } from '@/lib/types';
import { SUBJECT_LABELS } from '@/lib/constants';
import { useActions, useDerivedIndex, useSnapshot, useTracker } from '@/lib/store/tracker-store';
import { lectureStats } from '@/lib/calculations/analytics';
import { formatDate, formatMinutes } from '@/lib/date';
import { nodeById } from '@/lib/syllabus';
import { Badge, Button, Card, CardContent, EmptyState, ProgressBar, Select, Stat } from '@/components/ui/primitives';
import { HorizontalBars, CHART_PALETTE } from '@/components/ui/charts';
import { StatusBadge, StatusDot } from '@/components/ui/status';
import { LectureDialog } from '@/features/forms/action-forms';
import { cn } from '@/lib/utils';

const STATUS_ORDER: LectureStatus[] = ['not_started', 'in_progress', 'completed'];

export function LecturesScreen(): React.JSX.Element {
  const snapshot = useSnapshot();
  const index = useDerivedIndex();
  const actions = useActions();
  const { notify } = useTracker();
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Lecture | null>(null);
  const [subject, setSubject] = React.useState<SubjectCode | 'all'>('all');
  const [status, setStatus] = React.useState<LectureStatus | 'all'>('all');

  const stats = React.useMemo(() => lectureStats(index), [index]);
  const lectures = snapshot.lectures
    .filter((lecture) => subject === 'all' || lecture.subject === subject)
    .filter((lecture) => status === 'all' || lecture.status === status)
    .slice()
    .sort((a, b) => a.subject.localeCompare(b.subject) || a.number - b.number);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Lecture[]>();
    for (const lecture of lectures) {
      const key = lecture.chapterId ?? `${lecture.subject}-unsorted`;
      const list = map.get(key) ?? [];
      list.push(lecture);
      map.set(key, list);
    }
    return [...map.entries()];
  }, [lectures]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Lectures</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {stats.total === 0
              ? 'No lectures tracked yet. Add the ones your batch covers and watch the hours add up.'
              : `${stats.completed}/${stats.total} complete · ${Math.round(stats.watchedMin / 60)}h watched of ${Math.round(stats.durationMin / 60)}h`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select aria-label="Filter by subject" className="h-9 w-40" value={subject} onChange={(event) => setSubject(event.target.value as SubjectCode | 'all')}>
            <option value="all">All subjects</option>
            {(['phy', 'chem', 'math'] as SubjectCode[]).map((code) => (
              <option key={code} value={code}>
                {SUBJECT_LABELS[code]}
              </option>
            ))}
          </Select>
          <Select aria-label="Filter by status" className="h-9 w-36" value={status} onChange={(event) => setStatus(event.target.value as LectureStatus | 'all')}>
            <option value="all">Any status</option>
            <option value="not_started">Not started</option>
            <option value="in_progress">In progress</option>
            <option value="completed">Completed</option>
          </Select>
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-4" />
            Add lecture
          </Button>
        </div>
      </header>

      <section aria-label="Lecture summary" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Library" value={stats.total} hint={`${stats.completed} complete · ${stats.inProgress} in progress`} icon={<BookOpen />} />
        <Stat label="Watched" value={`${Math.round(stats.watchedMin / 60)}h`} hint={`${Math.round((stats.durationMin - stats.watchedMin) / 60)}h remaining`} />
        <Stat
          label="Completion"
          value={`${stats.total ? Math.round((stats.completed / stats.total) * 100) : 0}%`}
          hint={`${stats.notStarted} not started`}
          tone={stats.total && stats.completed === stats.total ? 'success' : 'default'}
        />
        <Stat label="Average length" value={stats.total ? formatMinutes(Math.round(stats.durationMin / stats.total)) : '-'} hint="Per lecture, from your entries" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-3">
            {lectures.length === 0 ? (
              <EmptyState
                icon={<BookOpen />}
                title={snapshot.lectures.length ? 'No lectures match these filters' : 'No lectures yet'}
                description={
                  snapshot.lectures.length
                    ? 'Clear the filters to see the rest of your library.'
                    : 'Add lectures chapter by chapter. Each one can be linked to a syllabus topic so watched time counts towards progress.'
                }
                action={
                  <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
                    Add the first lecture
                  </Button>
                }
              />
            ) : (
              grouped.map(([chapterId, chapterLectures]) => {
                const chapter = nodeById(chapterId)?.chapter ?? null;
                return (
                  <section key={chapterId} className="rounded-[10px] border border-line">
                    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold">{chapter?.name ?? 'Unassigned lectures'}</p>
                        <p className="text-[11.5px] text-ink-muted">
                          {chapterLectures.filter((lecture) => lecture.status === 'completed').length}/{chapterLectures.length} complete
                        </p>
                      </div>
                      {chapter ? (
                        <Link href={`/chapter/${chapter.id}`} className="text-[12px] font-medium text-brand hover:underline">
                          Open chapter
                        </Link>
                      ) : null}
                    </header>
                    <ul className="divide-y divide-line">
                      {chapterLectures.map((lecture) => (
                        <li key={lecture.id} className="flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1.5">
                              <StatusDot status={lecture.status === 'completed' ? 'completed' : lecture.status === 'in_progress' ? 'learning' : 'not_started'} />
                              <span className="truncate text-[13.5px] font-medium">
                                {lecture.number ? `${lecture.number}. ` : ''}
                                {lecture.title}
                              </span>
                              <Badge tone={lecture.exam === 'ja' ? 'ja' : lecture.exam === 'both' ? 'neutral' : 'jm'}>
                                {lecture.exam === 'both' ? 'JM+JA' : lecture.exam.toUpperCase()}
                              </Badge>
                            </p>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11.5px] text-ink-muted">
                              <span>
                                {formatMinutes(lecture.watchedMin)} / {formatMinutes(lecture.durationMin)}
                              </span>
                              {lecture.date ? <span>watched {formatDate(lecture.date, 'short')}</span> : null}
                              {lecture.source ? <span>{lecture.source}</span> : null}
                              {lecture.topicId ? <span>{nodeById(lecture.topicId)?.name}</span> : null}
                            </p>
                            <ProgressBar
                              className="mt-1.5 max-w-64"
                              value={lecture.durationMin ? (lecture.watchedMin / lecture.durationMin) * 100 : 0}
                              tone={lecture.status === 'completed' ? 'success' : 'brand'}
                              label={`${lecture.title} watched`}
                            />
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center gap-1">
                            {STATUS_ORDER.map((next) => (
                              <button
                                key={next}
                                type="button"
                                aria-pressed={lecture.status === next}
                                onClick={() => actions.setLectureStatus(lecture.id, next)}
                                className={cn(
                                  'rounded-full border px-2 py-0.5 text-[11.5px] font-medium transition-colors',
                                  lecture.status === next ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink-muted hover:text-ink',
                                )}
                              >
                                {next === 'not_started' ? 'Not started' : next === 'in_progress' ? 'Watching' : 'Done'}
                              </button>
                            ))}
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => actions.updateLecture(lecture.id, { watchedMin: Math.min(lecture.durationMin, lecture.watchedMin + 15) })}
                            >
                              +15 min
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditing(lecture)}>
                              Edit
                            </Button>
                            <Button size="icon-sm" variant="ghost" aria-label={`Delete ${lecture.title}`} onClick={() => {
                              actions.deleteLecture(lecture.id);
                              notify('Lecture deleted');
                            }}>
                              <Trash2 />
                            </Button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-[15px] font-semibold">By subject</h2>
              {stats.bySubject.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">Add lectures to see the split.</p>
              ) : (
                <ul className="space-y-2.5">
                  {stats.bySubject.map((row) => (
                    <li key={row.code}>
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="font-medium">{row.label}</span>
                        <span className="tabular text-ink-muted">
                          {row.completed}/{row.total} · {Math.round(row.watchedMin / 60)}h
                        </span>
                      </div>
                      <ProgressBar
                        className="mt-1"
                        value={row.total ? (row.completed / row.total) * 100 : 0}
                        tone={row.code === 'phy' ? 'phy' : row.code === 'chem' ? 'chem' : 'math'}
                        label={`${row.label} lectures complete`}
                      />
                    </li>
                  ))}
                </ul>
              )}
              <HorizontalBars
                rows={stats.bySubject.map((row) => ({
                  label: row.label,
                  value: Math.round(row.durationMin - row.watchedMin),
                  valueText: `${Math.round((row.durationMin - row.watchedMin) / 60)}h left`,
                  color: row.code === 'phy' ? CHART_PALETTE.phy : row.code === 'chem' ? CHART_PALETTE.chem : CHART_PALETTE.math,
                }))}
              />
              <p className="text-[11.5px] text-ink-subtle">Bars show remaining lecture hours per subject.</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-[15px] font-semibold">Recently completed</h2>
              {snapshot.lectures.filter((lecture) => lecture.status === 'completed' && lecture.date).length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">Nothing completed yet.</p>
              ) : (
                <ul className="space-y-1.5 text-[12.5px]">
                  {snapshot.lectures
                    .filter((lecture) => lecture.status === 'completed' && lecture.date)
                    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))
                    .slice(0, 6)
                    .map((lecture) => (
                      <li key={lecture.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate">
                          <CheckCircle2 aria-hidden className="mr-1 inline size-3.5 text-success" />
                          {lecture.title}
                        </span>
                        <span className="shrink-0 text-ink-muted">{formatDate(lecture.date, 'short')}</span>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-[15px] font-semibold">Lecture progress statuses</h2>
              <ul className="space-y-1.5 text-[12.5px]">
                <li className="flex items-center justify-between">
                  <StatusBadge status="completed" />
                  <span className="tabular">{stats.completed}</span>
                </li>
                <li className="flex items-center justify-between">
                  <StatusBadge status="learning" />
                  <span className="tabular">{stats.inProgress}</span>
                </li>
                <li className="flex items-center justify-between">
                  <StatusBadge status="not_started" />
                  <span className="tabular">{stats.notStarted}</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      {adding ? <LectureDialog onClose={() => setAdding(false)} /> : null}
      {editing ? <LectureDialog onClose={() => setEditing(null)} defaults={editing} /> : null}
    </div>
  );
}
