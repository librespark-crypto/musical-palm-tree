'use client';

/**
 * Chapter / topic / subtopic screen - where the tracker is actually edited.
 *
 * Everything shown is read from the derived index (so it matches analytics), and
 * every control writes through the store (so it persists to IndexedDB and rolls
 * up into the subject totals).
 */
import * as React from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  FileWarning,
  NotebookPen,
  Pencil,
  Repeat,
  Timer,
  Trash2,
} from 'lucide-react';
import type { Confidence, DimensionKey, DimensionStatus, ExamScope, StudyDifficulty, StudyStatus } from '@/lib/types';
import { DIMENSION_KEYS } from '@/lib/constants';
import { useActions, useDerivedIndex, useSnapshot, useTracker } from '@/lib/store/tracker-store';
import { aggregateNode, aggregateStatus, coverageOf, progressOf } from '@/lib/calculations/progress';
import { nodeById, siblingLeaves } from '@/lib/syllabus';
import { addDays, formatDate, formatMinutes, relativeDay, todayISO } from '@/lib/date';
import { Badge, Button, Card, CardContent, EmptyState, Field, ProgressBar, Select, Textarea } from '@/components/ui/primitives';
import { ConfidenceDots, DifficultyBadge, StatusBadge, StatusDot } from '@/components/ui/status';
import { ExamBadges, SubtopicGrid } from '@/features/syllabus/syllabus-tree';
import { useExamScope } from '@/lib/hooks/use-exam-scope';
import { QuickAdd } from '@/features/forms/quick-add';
import {
  LectureDialog,
  MistakeDialog,
  QuestionDialog,
  RevisionDialog,
  SessionDialog,
} from '@/features/forms/action-forms';
import { cn } from '@/lib/utils';

const DIMENSION_OPTIONS: { value: DimensionStatus; label: string }[] = [
  { value: 'none', label: 'Not started' },
  { value: 'partial', label: 'Partial' },
  { value: 'done', label: 'Done' },
];

const STATUS_OPTIONS: { value: StudyStatus; label: string }[] = [
  { value: 'not_started', label: 'Not started' },
  { value: 'learning', label: 'Learning' },
  { value: 'completed', label: 'Completed' },
  { value: 'weak', label: 'Weak' },
  { value: 'revision_due', label: 'Revision due' },
];

export function TopicScreen({ nodeId }: { nodeId: string }): React.JSX.Element {
  const node = nodeById(nodeId);
  if (!node) return <MissingNode nodeId={nodeId} />;
  return <TopicBody nodeId={nodeId} />;
}

function MissingNode({ nodeId }: { nodeId: string }): React.JSX.Element {
  return (
    <EmptyState
      title="That syllabus node does not exist"
      description={`Nothing in the stored syllabus has the id "${nodeId}". It may belong to an older syllabus revision.`}
      action={
        <Link href="/syllabus" className="inline-flex h-8 items-center rounded-[10px] bg-brand px-2.5 text-[13px] font-medium text-brand-ink">
          Back to the syllabus
        </Link>
      }
    />
  );
}

function TopicBody({ nodeId }: { nodeId: string }): React.JSX.Element {
  const node = nodeById(nodeId);
  const snapshot = useSnapshot();
  const index = useDerivedIndex();
  const actions = useActions();
  const { notify } = useTracker();
  const [exam, setExam] = useExamScope(node?.jm ? 'jm' : 'ja');
  const [dialog, setDialog] = React.useState<'session' | 'question' | 'lecture' | 'mistake' | 'revision' | null>(null);
  const [noteDraft, setNoteDraft] = React.useState<string | null>(null);

  if (!node) return <MissingNode nodeId={nodeId} />;

  const scopeExam: ExamScope = node[exam] ? exam : node.jm ? 'jm' : 'ja';
  const progress = progressOf(index, node.id, scopeExam);
  const aggregate = aggregateNode(index, node.id, scopeExam);
  const leaves = node.kind === 'subtopic' ? [] : aggregate.leaves;
  const leafStatus = aggregateStatus(aggregate);
  const revisions = (index.revisionsByNode.get(node.id) ?? []).slice().sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const openRevisions = revisions.filter((revision) => !revision.completedAt);
  const questions = index.questionsByNode.get(node.id) ?? [];
  const lectures = node.topic ? (index.lecturesByTopic.get(node.topic.id) ?? []) : (index.lecturesByChapter.get(node.id) ?? []);
  const mistakes = index.mistakesByNode.get(node.id) ?? [];
  const sessions = snapshot.sessions.filter(
    (session) => session.subtopicId === node.id || session.topicId === node.id || session.chapterId === node.id,
  );
  const siblings = node.topic ? siblingLeaves(node.id, scopeExam) : [];
  const position = siblings.findIndex((entry) => entry.id === node.id);

  const nodeSelection = {
    subject: node.subject.code,
    chapterId: node.chapter?.id ?? null,
    topicId: node.topic?.id ?? null,
    subtopicId: node.kind === 'subtopic' ? node.id : null,
  };

  const setDimension = (key: DimensionKey, status: DimensionStatus) => {
    if (node.kind === 'subtopic') {
      actions.setProgress(node.id, scopeExam, { [key]: status });
      return;
    }
    actions.bulkSetProgress(
      leaves.map((leaf) => leaf.id),
      scopeExam,
      { [key]: status },
    );
    notify(`${key} set to ${status} for ${leaves.length} subtopic(s)`);
  };

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-[12px] text-ink-muted">
        <Link href="/syllabus" className="hover:underline">
          Syllabus
        </Link>
        <span aria-hidden>/</span>
        {node.chapter ? (
          <>
            <Link href={`/subject/${node.subject.code}`} className="hover:underline">
              {node.subject.name}
            </Link>
            <span aria-hidden>/</span>
            <Link href={`/chapter/${node.chapter.id}?exam=${scopeExam}`} className="hover:underline">
              {node.chapter.name}
            </Link>
          </>
        ) : (
          <span>{node.subject.name}</span>
        )}
        <span aria-hidden>/</span>
        <span className="font-medium text-ink">{node.name}</span>
      </nav>

      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight">{node.name}</h1>
            <ExamBadges jm={node.jm} ja={node.ja} />
            <StatusBadge status={leafStatus} />
          </div>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {node.chapter?.name ?? node.subject.name}
            {node.chapter?.unit ? ` · ${node.chapter.unit}` : ''} · {aggregate.completed}/{aggregate.total} subtopics in{' '}
            {scopeExam === 'jm' ? 'JEE Main' : 'JEE Advanced'}
            {aggregate.timeMin > 0 ? ` · ${formatMinutes(aggregate.timeMin)} studied` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            aria-label="Exam scope for this topic"
            className="h-9 w-36"
            value={scopeExam}
            onChange={(event) => setExam(event.target.value as ExamScope)}
          >
            <option value="jm">JEE Main</option>
            <option value="ja">JEE Advanced</option>
          </Select>
          <Button variant="secondary" onClick={() => setDialog('session')}>
            <Timer aria-hidden className="size-4" />
            Log time
          </Button>
          <QuickAdd exam={scopeExam} subject={node.subject.code} node={nodeSelection} label="Add" />
        </div>
      </header>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          {/* ------------------------------------------------------- dimensions */}
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[15px] font-semibold">Study dimensions</h2>
                  <p className="text-[12px] text-ink-muted">
                    Coverage {aggregate.coverage}% · mastery {aggregate.mastery}% ·{' '}
                    {node.kind === 'subtopic' ? 'this subtopic' : `applies to all ${leaves.length} subtopics below`}
                  </p>
                </div>
                <ProgressBar className="w-36" value={aggregate.pct} tone={aggregate.pct >= 100 ? 'success' : 'brand'} label="Completion" />
              </div>
              <div className="space-y-2">
                {DIMENSION_KEYS.map((key) => {
                  const current: DimensionStatus = node.kind === 'subtopic' ? progress[key] : aggregate.dimensions[key].done > 0 ? 'done' : aggregate.dimensions[key].partial > 0 ? 'partial' : 'none';
                  return (
                    <div key={key} className="flex flex-wrap items-center gap-2">
                      <span className="w-20 text-[12.5px] font-medium capitalize">{key}</span>
                      <div role="radiogroup" aria-label={key} className="inline-flex rounded-[10px] border border-line bg-surface-2 p-0.5">
                        {DIMENSION_OPTIONS.map((option) => (
                          <button
                            key={option.value}
                            type="button"
                            role="radio"
                            aria-checked={current === option.value}
                            onClick={() => setDimension(key, option.value)}
                            className={cn(
                              'rounded-[8px] px-2.5 py-1 text-[12px] font-medium transition-colors',
                              current === option.value ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
                            )}
                          >
                            {option.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-3">
                <Field label="Status" htmlFor="topic-status">
                  <Select
                    id="topic-status"
                    value={progress.status}
                    onChange={(event) =>
                      actions.quickStatus(
                        node.id,
                        scopeExam,
                        event.target.value as StudyStatus,
                        leaves.length ? leaves.map((leaf) => leaf.id) : [node.id],
                      )
                    }
                  >
                    {STATUS_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Confidence" htmlFor="topic-confidence">
                  <div id="topic-confidence" className="flex h-9 items-center gap-2">
                    <ConfidenceDots
                      value={progress.confidence}
                      onChange={(value: Confidence) =>
                        node.kind === 'subtopic'
                          ? actions.setProgress(node.id, scopeExam, { confidence: value })
                          : actions.bulkSetProgress(leaves.map((leaf) => leaf.id), scopeExam, { confidence: value })
                      }
                    />
                    <span className="text-[11.5px] text-ink-muted">{progress.confidence ? `${progress.confidence}/5` : 'not rated'}</span>
                  </div>
                </Field>
                <Field label="Difficulty" htmlFor="topic-difficulty">
                  <Select
                    id="topic-difficulty"
                    value={progress.difficulty ?? ''}
                    onChange={(event) =>
                      actions.setProgress(node.id, scopeExam, {
                        difficulty: event.target.value === '' ? null : (event.target.value as StudyDifficulty),
                      })
                    }
                  >
                    <option value="">Not rated</option>
                    <option value="easy">Easy</option>
                    <option value="moderate">Moderate</option>
                    <option value="hard">Hard</option>
                  </Select>
                </Field>
              </div>
              <div className="flex flex-wrap items-center gap-4 text-[11.5px] text-ink-muted">
                <span>Difficulty: <DifficultyBadge difficulty={progress.difficulty} /></span>
                <span>Coverage: {coverageOf(progress)}%</span>
                <span>Revisions completed: {progress.revisionCount}</span>
                <span>Last studied: {progress.lastStudied ? relativeDay(progress.lastStudied) : 'never'}</span>
                <span>Next revision: {progress.nextRevision ? formatDate(progress.nextRevision) : 'not scheduled'}</span>
              </div>
            </CardContent>
          </Card>

          {/* ---------------------------------------------------------- subtopics */}
          {node.kind !== 'subtopic' && node.topic ? (
            <Card>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[15px] font-semibold">Subtopic progress</h2>
                  <Button size="sm" variant="secondary" onClick={() => setDialog('revision')}>
                    <Repeat aria-hidden className="size-3.5" />
                    Schedule revision
                  </Button>
                </div>
                <SubtopicGrid topic={node.topic} exam={scopeExam} index={index} />
              </CardContent>
            </Card>
          ) : null}

          {/* ---------------------------------------------------------- questions */}
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[15px] font-semibold">Question practice</h2>
                  <p className="text-[12px] text-ink-muted">
                    {aggregate.questions.attempted} attempted · {aggregate.questions.accuracy}% accuracy
                    {aggregate.questions.timeMin > 0 ? ` · ${formatMinutes(aggregate.questions.timeMin)}` : ''}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setDialog('question')}>
                  <NotebookPen aria-hidden className="size-3.5" />
                  Log questions
                </Button>
              </div>
              {questions.length === 0 ? (
                <EmptyState title="No question logs for this node yet" description="Log DPP, PYQ or practice sets here and the accuracy feeds mastery." />
              ) : (
                <ul className="divide-y divide-line">
                  {questions
                    .slice()
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .slice(0, 8)
                    .map((log) => (
                      <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12.5px]">
                        <span className="flex items-center gap-2">
                          <Badge tone="neutral">{log.source}</Badge>
                          <span>{formatDate(log.date)}</span>
                          <Badge tone={log.accuracy >= 60 ? 'success' : 'warn'}>{log.accuracy}%</Badge>
                          <span className="text-ink-muted">
                            {log.correct}/{log.attempted} correct{log.unattempted ? ` · ${log.unattempted} blank` : ''}
                          </span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="text-ink-subtle">{log.difficulty}</span>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Delete question log from ${formatDate(log.date)}`}
                            onClick={() => {
                              actions.deleteQuestion(log.id);
                              notify('Question log deleted');
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

          {/* --------------------------------------------------------- lectures */}
          <Card>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[15px] font-semibold">Lectures</h2>
                  <p className="text-[12px] text-ink-muted">
                    {lectures.length
                      ? `${lectures.filter((lecture) => lecture.status === 'completed').length}/${lectures.length} complete · ${Math.round(lectures.reduce((sum, lecture) => sum + lecture.watchedMin, 0) / 60)}h watched`
                      : 'No lectures linked yet'}
                  </p>
                </div>
                <Button size="sm" variant="secondary" onClick={() => setDialog('lecture')}>
                  <BookOpen aria-hidden className="size-3.5" />
                  Add lecture
                </Button>
              </div>
              {lectures.length ? (
                <ul className="divide-y divide-line">
                  {lectures.map((lecture) => (
                    <li key={lecture.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[12.5px]">
                      <span className="flex min-w-0 items-center gap-2">
                        <StatusDot status={lecture.status === 'completed' ? 'completed' : lecture.status === 'in_progress' ? 'learning' : 'not_started'} />
                        <span className="truncate font-medium">{lecture.title}</span>
                        {lecture.number ? <span className="text-ink-subtle">#{lecture.number}</span> : null}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-ink-muted">
                          {lecture.watchedMin}/{lecture.durationMin} min
                        </span>
                        {lecture.status !== 'completed' ? (
                          <Button size="sm" variant="ghost" onClick={() => actions.setLectureStatus(lecture.id, 'completed')}>
                            <CheckCircle2 aria-hidden className="size-3.5" />
                            Mark complete
                          </Button>
                        ) : null}
                        <Link href="/lectures" className="text-[12px] font-medium text-brand hover:underline">
                          Manage
                        </Link>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* --------------------------------------------------------- revision */}
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold">Revision</h2>
                <Button size="sm" variant="secondary" onClick={() => setDialog('revision')}>
                  Schedule
                </Button>
              </div>
              <p className="text-[12px] text-ink-muted">
                {progress.revisionCount} completed · next {progress.nextRevision ? relativeDay(progress.nextRevision) : 'not scheduled'}
              </p>
              {openRevisions.length === 0 && revisions.length === 0 ? (
                <p className="rounded-[10px] border border-dashed border-line px-3 py-2 text-[12.5px] text-ink-muted">
                  Completing this topic in the syllabus can schedule the first revision automatically.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {revisions.map((revision) => (
                    <li key={revision.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] border border-line px-2.5 py-2 text-[12.5px]">
                      <span className="flex items-center gap-2">
                        <Badge tone={revision.completedAt ? 'success' : revision.scheduledFor < todayISO() ? 'danger' : 'neutral'}>
                          R{revision.index}
                        </Badge>
                        <span>{revision.completedAt ? `done ${formatDate(revision.completedOn)}` : `due ${formatDate(revision.scheduledFor)}`}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        {!revision.completedAt ? (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => actions.completeRevision(revision.id)}>
                              Done
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => actions.rescheduleRevision(revision.id, addDays(todayISO(), 1))}
                            >
                              Tomorrow
                            </Button>
                          </>
                        ) : null}
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          aria-label={`Delete revision ${revision.index}`}
                          onClick={() => actions.deleteRevision(revision.id)}
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

          {/* ------------------------------------------------------------ notes */}
          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-[15px] font-semibold">Notes</h2>
              <Textarea
                aria-label="Topic notes"
                rows={4}
                value={noteDraft ?? progress.note}
                onChange={(event) => setNoteDraft(event.target.value)}
                placeholder="Formula to remember, a trap you keep falling for, page numbers…"
              />
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11.5px] text-ink-muted">
                  {progress.lastStudied ? `Last studied ${relativeDay(progress.lastStudied)}` : 'Not studied yet'}
                </span>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={noteDraft === null || noteDraft === progress.note}
                  onClick={() => {
                    actions.setProgress(node.id, scopeExam, { note: noteDraft ?? '' });
                    setNoteDraft(null);
                    notify('Note saved', 'success');
                  }}
                >
                  <Pencil aria-hidden className="size-3.5" />
                  Save note
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ---------------------------------------------------------- mistakes */}
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-[15px] font-semibold">
                  <FileWarning aria-hidden className="size-4 text-ink-subtle" />
                  Mistakes
                </h2>
                <Button size="sm" variant="secondary" onClick={() => setDialog('mistake')}>
                  Add
                </Button>
              </div>
              {mistakes.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">No mistakes recorded for this node.</p>
              ) : (
                <ul className="space-y-1.5">
                  {mistakes.slice(0, 5).map((mistake) => (
                    <li key={mistake.id} className="rounded-[10px] border border-line px-2.5 py-2 text-[12.5px]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{mistake.questionText.slice(0, 60)}</span>
                        <Badge tone={mistake.status === 'mastered' ? 'success' : mistake.status === 'revised' ? 'warn' : 'danger'}>
                          {mistake.status}
                        </Badge>
                      </div>
                      <p className="text-[11.5px] text-ink-muted">
                        {mistake.mistakeType} · {formatDate(mistake.date)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/mistakes" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
                Open the mistake book <ArrowRight aria-hidden className="size-3.5" />
              </Link>
            </CardContent>
          </Card>

          {/* -------------------------------------------------------------- time */}
          <Card>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-semibold">Time on this node</h2>
                <span className="text-[13px] font-semibold tabular">{formatMinutes(aggregate.timeMin)}</span>
              </div>
              {sessions.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">No sessions recorded against this node yet.</p>
              ) : (
                <ul className="space-y-1 text-[12.5px]">
                  {sessions
                    .slice()
                    .sort((a, b) => b.start.localeCompare(a.start))
                    .slice(0, 6)
                    .map((session) => (
                      <li key={session.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {formatDate(session.start.slice(0, 10))} · {session.mode}
                        </span>
                        <span className="shrink-0 text-ink-muted">{formatMinutes(session.minutes)}</span>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {node.topic && siblings.length > 1 && position >= 0 ? (
            <nav aria-label="Subtopic navigation" className="flex items-center justify-between gap-2 text-[12.5px]">
              {position > 0 ? (
                <Link href={`/topic/${siblings[position - 1]?.id}?exam=${scopeExam}`} className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
                  <ArrowLeft aria-hidden className="size-3.5" />
                  {siblings[position - 1]?.name}
                </Link>
              ) : (
                <span />
              )}
              {position < siblings.length - 1 ? (
                <Link href={`/topic/${siblings[position + 1]?.id}?exam=${scopeExam}`} className="inline-flex items-center gap-1 text-right font-medium text-brand hover:underline">
                  {siblings[position + 1]?.name}
                  <ArrowRight aria-hidden className="size-3.5" />
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </div>
      </div>

      {dialog === 'session' ? <SessionDialog onClose={() => setDialog(null)} node={nodeSelection} exam={scopeExam} /> : null}
      {dialog === 'question' ? <QuestionDialog onClose={() => setDialog(null)} node={nodeSelection} exam={scopeExam} /> : null}
      {dialog === 'lecture' ? <LectureDialog onClose={() => setDialog(null)} node={nodeSelection} exam={scopeExam} /> : null}
      {dialog === 'mistake' ? <MistakeDialog onClose={() => setDialog(null)} node={nodeSelection} exam={scopeExam} /> : null}
      {dialog === 'revision' ? <RevisionDialog onClose={() => setDialog(null)} nodeId={node.id} exam={scopeExam} /> : null}
    </div>
  );
}

