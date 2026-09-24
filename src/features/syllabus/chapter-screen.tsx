'use client';

/**
 * Chapter screen: every topic in the chapter with its five-dimension grid, the
 * chapter's revision queue, and chapter-scoped quick actions.
 */
import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, BookOpen, FileWarning, NotebookPen, Repeat } from 'lucide-react';
import { useDerivedIndex } from '@/lib/store/tracker-store';
import { aggregateNode, aggregateStatus } from '@/lib/calculations/progress';
import { nodeById } from '@/lib/syllabus';
import { formatDate, formatMinutes, relativeDay } from '@/lib/date';
import { Badge, Button, Card, CardContent, EmptyState, ProgressBar, Stat } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/ui/status';
import { ExamBadges, SubtopicGrid, TopicRow } from '@/features/syllabus/syllabus-tree';
import { useExamScope } from '@/lib/hooks/use-exam-scope';
import { QuickAdd } from '@/features/forms/quick-add';
import { LectureDialog, QuestionDialog, RevisionDialog } from '@/features/forms/action-forms';

export function ChapterScreen({ chapterId }: { chapterId: string }): React.JSX.Element {
  const node = nodeById(chapterId);
  const index = useDerivedIndex();
  const [exam, setExam] = useExamScope(node?.jm ? 'jm' : 'ja');
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [dialog, setDialog] = React.useState<'lecture' | 'question' | 'revision' | null>(null);

  if (!node || !node.chapter) {
    return (
      <EmptyState
        title="Chapter not found"
        description={`No chapter in the stored syllabus has the id "${chapterId}".`}
        action={
          <Link href="/syllabus" className="inline-flex h-8 items-center rounded-[10px] bg-brand px-2.5 text-[13px] font-medium text-brand-ink">
            Back to the syllabus
          </Link>
        }
      />
    );
  }

  const chapter = node.chapter;
  const scopeExam = chapter[exam] ? exam : chapter.jm ? 'jm' : 'ja';
  const aggregate = aggregateNode(index, chapter.id, scopeExam);
  const topics = chapter.topics.filter((topic) => topic[scopeExam]);
  const revisions = (index.revisionsByNode.get(chapter.id) ?? []).concat(
    chapter.topics.flatMap((topic) => index.revisionsByNode.get(topic.id) ?? []),
    chapter.topics.flatMap((topic) => topic.subs.flatMap((sub) => index.revisionsByNode.get(sub.id) ?? [])),
  );
  const openRevisions = revisions.filter((revision) => !revision.completedAt);
  const selection = { subject: node.subject.code, chapterId: chapter.id, topicId: null, subtopicId: null };

  return (
    <div className="space-y-4">
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] text-ink-muted">
        <Link href="/syllabus" className="hover:underline">
          Syllabus
        </Link>
        <span aria-hidden>/</span>
        <Link href={`/subject/${node.subject.code}`} className="hover:underline">
          {node.subject.name}
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink">{chapter.name}</span>
      </nav>

      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <h1 className="text-xl font-semibold tracking-tight">{chapter.name}</h1>
            <ExamBadges jm={chapter.jm} ja={chapter.ja} />
            <StatusBadge status={aggregateStatus(aggregate)} />
          </div>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {node.subject.name}
            {chapter.unit ? ` · ${chapter.unit}` : ''} · {topics.length} topics · {aggregate.total} subtopics in{' '}
            {scopeExam === 'jm' ? 'JEE Main' : 'JEE Advanced'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" onClick={() => setExam(scopeExam === 'jm' ? 'ja' : 'jm')}>
            <ArrowLeft aria-hidden className="size-4" />
            Switch to {scopeExam === 'jm' ? 'JEE Advanced' : 'JEE Main'}
          </Button>
          <QuickAdd exam={scopeExam} subject={node.subject.code} node={selection} label="Add to this chapter" />
        </div>
      </header>

      <section aria-label="Chapter summary" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Completion" value={`${aggregate.pct}%`} hint={`${aggregate.completed}/${aggregate.total} subtopics`} icon={<BookOpen />} />
        <Stat label="Weak subtopics" value={aggregate.weak} tone={aggregate.weak ? 'danger' : 'default'} hint={`Coverage ${aggregate.coverage}% · mastery ${aggregate.mastery}%`} />
        <Stat
          label="Revisions open"
          value={openRevisions.length}
          tone={openRevisions.length ? 'warn' : 'default'}
          hint={openRevisions.length ? `Next due ${formatDate(openRevisions[0]?.scheduledFor ?? null)}` : 'Nothing scheduled'}
          icon={<Repeat />}
        />
        <Stat
          label="Accuracy"
          value={aggregate.questions.attempted ? `${aggregate.questions.accuracy}%` : '-'}
          hint={aggregate.questions.attempted ? `${aggregate.questions.correct}/${aggregate.questions.attempted} correct · ${formatMinutes(aggregate.timeMin)} studied` : 'No questions logged'}
          icon={<NotebookPen />}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-[15px] font-semibold">Topics</h2>
            <ul className="space-y-1">
              {topics.map((topic) => {
                const topicAggregate = aggregateNode(index, topic.id, scopeExam);
                const open = expanded === topic.id;
                return (
                  <li key={topic.id} className="rounded-[10px] border border-line">
                    <div className="flex items-start gap-2 p-1">
                      <div className="min-w-0 flex-1">
                        <TopicRow topic={topic} exam={scopeExam} index={index} />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-expanded={open}
                        onClick={() => setExpanded(open ? null : topic.id)}
                        className="mt-1.5 shrink-0"
                      >
                        {open ? 'Hide grid' : 'Show grid'}
                      </Button>
                    </div>
                    {open ? (
                      <div className="border-t border-line p-2">
                        <div className="mb-2 flex flex-wrap items-center gap-2 text-[11.5px] text-ink-muted">
                          <Badge tone="neutral">{topicAggregate.pct}% complete</Badge>
                          <Badge tone="neutral">{topicAggregate.questions.attempted} questions</Badge>
                          {topicAggregate.revisionDue > 0 ? <Badge tone="warn">{topicAggregate.revisionDue} revisions due</Badge> : null}
                        </div>
                        <SubtopicGrid topic={topic} exam={scopeExam} index={index} />
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2 border-t border-line pt-3">
              <Button size="sm" variant="secondary" onClick={() => setDialog('lecture')}>
                <BookOpen aria-hidden className="size-3.5" />
                Add lecture
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDialog('question')}>
                <NotebookPen aria-hidden className="size-3.5" />
                Log questions
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setDialog('revision')}>
                <Repeat aria-hidden className="size-3.5" />
                Schedule revision
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-[15px] font-semibold">Revision queue</h2>
              {openRevisions.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">
                  No open revisions in this chapter. Completing a topic schedules the first revision automatically when auto-scheduling is on.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {openRevisions
                    .slice()
                    .sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor))
                    .slice(0, 8)
                    .map((revision) => (
                      <li key={revision.id} className="flex items-center justify-between gap-2 rounded-[10px] border border-line px-2.5 py-2 text-[12.5px]">
                        <span className="min-w-0">
                          <span className="block truncate font-medium">{revision.topicName}</span>
                          <span className="text-[11.5px] text-ink-muted">
                            R{revision.index} · due {relativeDay(revision.scheduledFor)}
                          </span>
                        </span>
                        <Link
                          href={`/topic/${revision.nodeId}?exam=${revision.exam}`}
                          className="shrink-0 rounded-[8px] px-2 py-1 text-[12.5px] font-medium text-brand hover:bg-surface-2"
                        >
                          Open
                        </Link>
                      </li>
                    ))}
                </ul>
              )}
              <Link href="/revision" className="inline-flex text-[12.5px] font-medium text-brand hover:underline">
                Go to the revision queue
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-[15px] font-semibold">Progress by dimension</h2>
              <ul className="space-y-2">
                {(['theory', 'lecture', 'dpp', 'pyq', 'practice'] as const).map((key) => {
                  const bucket = aggregate.dimensions[key];
                  const total = bucket.done + bucket.partial + bucket.none;
                  const value = total ? Math.round(((bucket.done + bucket.partial * 0.5) / total) * 100) : 0;
                  return (
                    <li key={key}>
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="capitalize">{key}</span>
                        <span className="tabular text-ink-muted">
                          {bucket.done} done · {bucket.partial} partial · {bucket.none} left
                        </span>
                      </div>
                      <ProgressBar className="mt-1" value={value} label={`${key} coverage`} />
                    </li>
                  );
                })}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-[15px] font-semibold">Mistakes in this chapter</h2>
              {(() => {
                const mistakes = (index.mistakesByNode.get(chapter.id) ?? []).concat(
                  chapter.topics.flatMap((topic) => index.mistakesByNode.get(topic.id) ?? []),
                  chapter.topics.flatMap((topic) => topic.subs.flatMap((sub) => index.mistakesByNode.get(sub.id) ?? [])),
                );
                if (!mistakes.length) return <p className="text-[12.5px] text-ink-muted">No mistakes logged here yet.</p>;
                return (
                  <ul className="space-y-1.5 text-[12.5px]">
                    {mistakes.slice(0, 6).map((mistake) => (
                      <li key={mistake.id} className="flex items-start justify-between gap-2">
                        <span className="min-w-0 truncate">{mistake.questionText}</span>
                        <Badge tone={mistake.status === 'mastered' ? 'success' : mistake.status === 'revised' ? 'warn' : 'danger'}>
                          {mistake.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                );
              })()}
              <Link href="/mistakes" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-brand hover:underline">
                <FileWarning aria-hidden className="size-3.5" />
                Mistake book
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {dialog === 'lecture' ? <LectureDialog onClose={() => setDialog(null)} node={selection} exam={scopeExam} /> : null}
      {dialog === 'question' ? <QuestionDialog onClose={() => setDialog(null)} node={selection} exam={scopeExam} /> : null}
      {dialog === 'revision' ? <RevisionDialog onClose={() => setDialog(null)} nodeId={chapter.id} exam={scopeExam} /> : null}
    </div>
  );
}
