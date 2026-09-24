'use client';

/**
 * Syllabus screen - the whole JEE Main + Advanced tree with per-topic progress.
 *
 * Two entry points share it: the global syllabus (all subjects, with search and
 * filters) and the subject view (`subjectCode` locks the tabs to one subject).
 */
import * as React from 'react';
import Link from 'next/link';
import { BookOpen, Filter, Repeat, Search, X } from 'lucide-react';
import type { Chapter, ExamScope, SubjectCode } from '@/lib/types';
import { useDerivedIndex, useSnapshot } from '@/lib/store/tracker-store';
import { chapterRows, overallFor, weakTopics } from '@/lib/calculations/analytics';
import { scopeProgress, subjectProgress } from '@/lib/calculations/progress';
import { nodeById, searchSyllabus } from '@/lib/syllabus';
import { Badge, Card, CardContent, Button, EmptyState, Input, ProgressBar, Segmented, Stat } from '@/components/ui/primitives';
import { ChapterBlock, SubjectTabs } from '@/features/syllabus/syllabus-tree';
import { useExamScope } from '@/lib/hooks/use-exam-scope';
import { SUBJECT_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';

type Filter = 'all' | 'incomplete' | 'weak' | 'due';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All chapters' },
  { value: 'incomplete', label: 'Not finished' },
  { value: 'weak', label: 'Weak' },
  { value: 'due', label: 'Revision due' },
];

export interface SyllabusScreenProps {
  subjectCode?: SubjectCode;
  /** Chapters opened by default (used by the chapter deep link). */
  openChapterId?: string;
  showGrid?: boolean;
}

export function SyllabusScreen({ subjectCode, openChapterId, showGrid = false }: SyllabusScreenProps): React.JSX.Element {
  const snapshot = useSnapshot();
  const index = useDerivedIndex();
  const [exam, setExam] = useExamScope('jm');
  const [query, setQuery] = React.useState('');
  const [filter, setFilter] = React.useState<Filter>('all');
  const [activeSubject, setActiveSubject] = React.useState<SubjectCode | 'all'>(subjectCode ?? 'all');

  const scope = React.useMemo(() => scopeProgress(index, exam), [index, exam]);
  const rows = React.useMemo(
    () => chapterRows(index, exam, activeSubject === 'all' ? null : activeSubject),
    [index, exam, activeSubject],
  );
  const overall = React.useMemo(() => overallFor(snapshot), [snapshot]);
  const weakest = React.useMemo(() => weakTopics(index, { exam, limit: 5 }), [index, exam]);

  const searching = query.trim().length >= 2;

  const visible = rows.filter((row) => {
    if (filter === 'incomplete') return row.pct < 100;
    if (filter === 'weak') return row.weak > 0;
    if (filter === 'due') return row.revisionDue > 0;
    return true;
  });

  const subjectSummary = subjectCode ? subjectProgress(index, subjectCode, exam) : null;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            {subjectCode ? `${SUBJECT_LABELS[subjectCode]} syllabus` : 'Syllabus'}
          </h1>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {snapshot.syllabusMeta.mainSource} ({snapshot.syllabusMeta.mainYear}) and {snapshot.syllabusMeta.advancedSource} (
            {snapshot.syllabusMeta.advancedYear}) - {snapshot.subjects.reduce((total, subject) => total + subject.chapters.length, 0)}{' '}
            chapters, {snapshot.subjects.reduce((total, subject) => total + subject.chapters.reduce((sum, chapter) => sum + chapter.topics.length, 0), 0)} topics.
          </p>
        </div>
        <Segmented<ExamScope>
          ariaLabel="Exam scope"
          value={exam}
          onChange={setExam}
          options={[
            { value: 'jm', label: 'JEE Main' },
            { value: 'ja', label: 'JEE Advanced' },
          ]}
        />
      </header>

      <section aria-label="Scope summary" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat
          label={`${exam === 'jm' ? 'Main' : 'Advanced'} completion`}
          value={`${scope.pct}%`}
          hint={`${scope.completed}/${scope.leaves} subtopics · ${scope.learning} in progress`}
          icon={<BookOpen />}
        />
        <Stat label="Weak subtopics" value={scope.weak} tone={scope.weak > 0 ? 'danger' : 'default'} hint="Flagged weak or under 45% mastery" />
        <Stat
          label="Revisions due"
          value={scope.revisionDue}
          tone={scope.revisionDue > 0 ? 'warn' : 'default'}
          hint={overall.revisionConsistency.windowDays ? `${overall.revisionConsistency.rate}% completed on time (28 days)` : 'No revisions scheduled yet'}
          icon={<Repeat />}
        />
        <Stat
          label="Mastery"
          value={`${scope.mastery}%`}
          hint={subjectSummary ? `${subjectSummary.completed}/${subjectSummary.leaves} subtopics in ${SUBJECT_LABELS[subjectCode as SubjectCode]}` : 'Coverage weighted by question accuracy'}
        />
      </section>

      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search chapters, topics and subtopics"
                aria-label="Search the syllabus"
                className="pl-8"
              />
              {query ? (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Clear search"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setQuery('')}
                >
                  <X />
                </Button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Filter aria-hidden className="size-3.5 shrink-0 text-ink-subtle" />
              <div className="scroll-x flex gap-1">
                {FILTERS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={filter === option.value}
                    onClick={() => setFilter(option.value)}
                    className={cn(
                      'shrink-0 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors',
                      filter === option.value ? 'border-brand bg-brand-soft text-brand' : 'border-line text-ink-muted hover:text-ink',
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {searching ? (
            <SearchResults query={query} exam={exam} />
          ) : (
            <>
              {!subjectCode ? (
                <SubjectTabs
                  subjects={snapshot.subjects.map((subject) => ({ code: subject.code, name: subject.name }))}
                  active={activeSubject}
                  onChange={setActiveSubject}
                />
              ) : null}

              <div className="flex flex-wrap items-center gap-3 text-[11.5px] text-ink-muted">
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full bg-success" /> done
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full bg-warn" /> partial
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span aria-hidden className="size-2 rounded-full bg-line-strong" /> not started
                </span>
                <span>Showing {visible.length} of {rows.length} chapters</span>
              </div>

              {visible.length === 0 ? (
                <EmptyState
                  title="No chapters match this filter"
                  description={
                    filter === 'all'
                      ? 'This subject has no chapters in the selected exam scope.'
                      : 'Try a different filter or switch the exam scope.'
                  }
                  action={
                    <Button size="sm" onClick={() => setFilter('all')}>
                      Show all chapters
                    </Button>
                  }
                />
              ) : (
                <div className="space-y-2">
                  {visible.map((row) => {
                    const chapter = findByChapterId(row.id);
                    if (!chapter) return null;
                    return (
                      <ChapterBlock
                        key={row.id}
                        chapter={chapter}
                        exam={exam}
                        index={index}
                        defaultOpen={row.id === openChapterId}
                        showGrid={showGrid}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {weakest.length > 0 && filter !== 'weak' ? (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-[14px] font-semibold">Weakest topics in this scope</h2>
              <Button size="sm" variant="ghost" onClick={() => setFilter('weak')}>
                Only weak
              </Button>
            </div>
            <ul className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {weakest.map((topic) => (
                <li key={`${topic.id}-${topic.exam}`} className="rounded-[10px] border border-line p-2.5">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/topic/${topic.id}?exam=${topic.exam}`} className="text-[13px] font-medium hover:underline">
                      {topic.name}
                    </Link>
                    <Badge tone={topic.mastery < 45 ? 'danger' : 'warn'}>{topic.mastery}% mastery</Badge>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-ink-muted">
                    {topic.chapter} · {SUBJECT_LABELS[topic.subject]}
                  </p>
                  <p className="mt-1 text-[11.5px] text-ink-muted">{topic.reason}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <ProgressBar value={topic.mastery} tone={topic.mastery < 45 ? 'danger' : 'warn'} className="flex-1" />
                    <span className="text-[11px] tabular text-ink-muted">{topic.completed}/{topic.total}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function SearchResults({ query, exam }: { query: string; exam: ExamScope }): React.JSX.Element {
  const results = searchSyllabus(query, 24);
  const total = results.chapters.length + results.topics.length + results.subtopics.length;
  if (!total) {
    return <EmptyState icon={<Search />} title={`No matches for "${query}"`} description="Check the spelling or search for a chapter name such as Rotational Motion." />;
  }
  return (
    <div className="space-y-3">
      {results.chapters.length ? (
        <section>
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">Chapters</h2>
          <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {results.chapters.map((chapter) => (
              <li key={chapter.id}>
                <Link href={`/chapter/${chapter.id}?exam=${exam}`} className="flex items-center justify-between rounded-[10px] border border-line px-2.5 py-2 text-[13px] hover:bg-surface-2">
                  <span className="truncate">{chapter.name}</span>
                  <Badge tone={chapter.code === 'phy' ? 'phy' : chapter.code === 'chem' ? 'chem' : 'math'}>{chapter.subject}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {results.topics.length ? (
        <section>
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">Topics</h2>
          <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {results.topics.map((topic) => (
              <li key={topic.id}>
                <Link href={`/topic/${topic.id}?exam=${exam}`} className="block rounded-[10px] border border-line px-2.5 py-2 text-[13px] hover:bg-surface-2">
                  <span className="block truncate font-medium">{topic.name}</span>
                  <span className="block truncate text-[11.5px] text-ink-muted">{topic.chapter}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {results.subtopics.length ? (
        <section>
          <h2 className="text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">Subtopics</h2>
          <ul className="mt-1.5 grid gap-1.5 sm:grid-cols-2">
            {results.subtopics.map((subtopic) => (
              <li key={subtopic.id}>
                <Link href={`/topic/${subtopic.id}?exam=${exam}`} className="block rounded-[10px] border border-line px-2.5 py-2 text-[13px] hover:bg-surface-2">
                  <span className="block truncate font-medium">{subtopic.name}</span>
                  <span className="block truncate text-[11.5px] text-ink-muted">
                    {subtopic.topic} · {subtopic.chapter}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Chapters are looked up through the syllabus module, not re-derived here. */
function findByChapterId(id: string): Chapter | null {
  return nodeById(id)?.chapter ?? null;
}
