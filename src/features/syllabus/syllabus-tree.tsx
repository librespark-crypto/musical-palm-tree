'use client';

/**
 * Syllabus tree pieces, shared by the syllabus, subject, chapter and topic
 * screens. Everything is rendered from the stored syllabus plus the derived
 * index, so the numbers shown here are the same ones the analytics screen uses.
 *
 * The chapter list uses native <details>/<summary>: it is keyboard accessible
 * and printable without any JavaScript state.
 */
import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, Repeat } from 'lucide-react';
import type { Chapter, ExamScope, SubjectCode, Subtopic, Topic } from '@/lib/types';
import type { DerivedIndex } from '@/lib/calculations/derive';
import { aggregateNode, aggregateStatus } from '@/lib/calculations/progress';
import { progressOf } from '@/lib/calculations/progress';
import { Badge, ProgressBar } from '@/components/ui/primitives';
import { StatusBadge } from '@/components/ui/status';
import { formatMinutes } from '@/lib/date';
import { cn } from '@/lib/utils';

export function ExamBadges({ jm, ja }: { jm: boolean; ja: boolean }): React.JSX.Element {
  return (
    <span className="inline-flex shrink-0 gap-1">
      {jm ? <Badge tone="jm">Main</Badge> : null}
      {ja ? <Badge tone="ja">Adv</Badge> : null}
    </span>
  );
}

export interface TopicRowProps {
  topic: Topic;
  exam: ExamScope;
  index: DerivedIndex;
}

export function TopicRow({ topic, exam, index }: TopicRowProps): React.JSX.Element {
  const aggregate = aggregateNode(index, topic.id, exam);
  const href = `/topic/${topic.id}?exam=${exam}`;
  return (
    <li>
      <Link
        href={href}
        className="flex flex-col gap-2 rounded-[10px] border border-transparent px-2.5 py-2 transition-colors hover:border-line hover:bg-surface-2/60 sm:flex-row sm:items-center sm:gap-3"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <span className="truncate text-[13.5px] font-medium">{topic.name}</span>
            <ExamBadges jm={topic.jm} ja={topic.ja} />
            {aggregate.weak > 0 ? <Badge tone="danger">{aggregate.weak} weak</Badge> : null}
            {aggregate.revisionDue > 0 ? (
              <Badge tone="warn" title="Revisions due">
                <Repeat aria-hidden className="size-3" />
                {aggregate.revisionDue}
              </Badge>
            ) : null}
          </span>
          <span className="mt-0.5 block text-[11.5px] text-ink-muted">
            {aggregate.completed}/{aggregate.total} subtopics
            {aggregate.questions.attempted > 0 ? ` · ${aggregate.questions.attempted} q @ ${aggregate.questions.accuracy}%` : ' · no questions logged'}
            {aggregate.timeMin > 0 ? ` · ${formatMinutes(aggregate.timeMin)}` : ''}
          </span>
        </span>
        <span className="flex items-center gap-2.5 sm:w-56">
          <ProgressBar
            className="flex-1"
            value={aggregate.pct}
            label={`${topic.name} completion`}
            tone={aggregate.pct >= 100 ? 'success' : 'brand'}
          />
          <span className="w-9 shrink-0 text-right text-[12px] font-semibold tabular">{aggregate.pct}%</span>
          <StatusBadge status={aggregateStatus(aggregate)} className="hidden shrink-0 sm:inline-flex" />
          <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-subtle" />
        </span>
      </Link>
    </li>
  );
}

export interface SubtopicGridProps {
  topic: Topic;
  exam: ExamScope;
  index: DerivedIndex;
}

/** The five-dimension grid: one row per subtopic, one dot per study dimension. */
export function SubtopicGrid({ topic, exam, index }: SubtopicGridProps): React.JSX.Element {
  const leaves = topic.subs.filter((sub) => sub[exam]);
  if (!leaves.length) {
    return <p className="px-2.5 py-2 text-[12.5px] text-ink-muted">This topic is not in the {exam === 'jm' ? 'JEE Main' : 'JEE Advanced'} syllabus.</p>;
  }
  return (
    <div className="scroll-x">
      <table className="w-full min-w-[520px] border-collapse text-[12.5px]">
        <caption className="sr-only">Subtopic completion by study dimension</caption>
        <thead>
          <tr className="text-[10.5px] uppercase tracking-wide text-ink-subtle">
            <th scope="col" className="px-2 py-1.5 text-left font-semibold">
              Subtopic
            </th>
            {(['theory', 'lecture', 'dpp', 'pyq', 'practice'] as const).map((key) => (
              <th key={key} scope="col" className="w-16 px-1 py-1.5 text-center font-semibold">
                {key === 'theory' ? 'Theory' : key === 'lecture' ? 'Lec' : key.toUpperCase()}
              </th>
            ))}
            <th scope="col" className="w-24 px-2 py-1.5 text-left font-semibold">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {leaves.map((leaf) => {
            const progress = progressOf(index, leaf.id, exam);
            return (
              <tr key={leaf.id} className="border-t border-line/70">
                <td className="px-2 py-1.5">
                  <Link href={`/topic/${leaf.id}?exam=${exam}`} className="hover:underline">
                    {leaf.name}
                  </Link>
                </td>
                {(['theory', 'lecture', 'dpp', 'pyq', 'practice'] as const).map((key) => (
                  <td key={key} className="px-1 py-1.5 text-center">
                    <span
                      aria-label={`${key}: ${progress[key]}`}
                      className={cn(
                        'mx-auto block size-2.5 rounded-full',
                        progress[key] === 'done' && 'bg-success',
                        progress[key] === 'partial' && 'bg-warn',
                        progress[key] === 'none' && 'bg-line-strong',
                      )}
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  <StatusBadge status={progress.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export interface ChapterBlockProps {
  chapter: Chapter;
  exam: ExamScope;
  index: DerivedIndex;
  defaultOpen?: boolean;
  /** Chapters inside a subject page show the subtopic grid straight away. */
  showGrid?: boolean;
}

export function ChapterBlock({ chapter, exam, index, defaultOpen = false, showGrid = false }: ChapterBlockProps): React.JSX.Element {
  const aggregate = aggregateNode(index, chapter.id, exam);
  const inScope = chapter[exam];
  return (
    <details
      open={defaultOpen}
      className="group rounded-[var(--radius-card)] border border-line bg-surface shadow-card open:shadow-card"
      data-in-scope={inScope}
    >
      <summary className="flex cursor-pointer list-none flex-col gap-2 p-3 marker:hidden sm:flex-row sm:items-center sm:gap-3">
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-1.5">
            <ChevronRight aria-hidden className="size-4 shrink-0 text-ink-subtle transition-transform group-open:rotate-90" />
            <span className="text-[13.5px] font-semibold">{chapter.name}</span>
            <ExamBadges jm={chapter.jm} ja={chapter.ja} />
            {!inScope ? <Badge tone="outline">not in this scope</Badge> : null}
          </span>
          <span className="mt-0.5 block pl-5.5 text-[11.5px] text-ink-muted">
            {chapter.unit ? `${chapter.unit} · ` : ''}
            {chapter.topics.length} topics · {aggregate.completed}/{aggregate.total} subtopics
            {aggregate.weak > 0 ? ` · ${aggregate.weak} weak` : ''}
            {aggregate.revisionDue > 0 ? ` · ${aggregate.revisionDue} revisions due` : ''}
            {aggregate.questions.attempted > 0 ? ` · ${aggregate.questions.accuracy}% accuracy` : ''}
          </span>
        </span>
        <span className="flex items-center gap-2.5 sm:w-52">
          <ProgressBar className="flex-1" value={aggregate.pct} label={`${chapter.name} completion`} tone={aggregate.pct >= 100 ? 'success' : 'brand'} />
          <span className="w-9 text-right text-[12px] font-semibold tabular">{aggregate.pct}%</span>
        </span>
      </summary>
      <div className="border-t border-line px-2 py-2">
        <ul className="space-y-0.5">
          {chapter.topics
            .filter((topic) => topic[exam])
            .map((topic) => (
              <TopicRow key={topic.id} topic={topic} exam={exam} index={index} />
            ))}
        </ul>
        {showGrid
          ? chapter.topics
              .filter((topic) => topic[exam])
              .map((topic) => (
                <div key={topic.id} className="mt-2 rounded-[10px] border border-line/70 p-2">
                  <p className="mb-1 text-[12px] font-semibold">{topic.name}</p>
                  <SubtopicGrid topic={topic} exam={exam} index={index} />
                </div>
              ))
          : null}
        <div className="mt-2 flex flex-wrap items-center gap-3 px-2.5 pb-1 pt-2 text-[12px]">
          <Link href={`/chapter/${chapter.id}?exam=${exam}`} className="font-medium text-brand hover:underline">
            Open chapter
          </Link>
          <Link href={`/planner?chapter=${chapter.id}`} className="font-medium text-brand hover:underline">
            Plan work for this chapter
          </Link>
          {chapter.note ? <span className="text-ink-muted">{chapter.note}</span> : null}
        </div>
      </div>
    </details>
  );
}

export interface SubtopicChipProps {
  subtopic: Subtopic;
  exam: ExamScope;
  index: DerivedIndex;
}

export function SubtopicChip({ subtopic, exam, index }: SubtopicChipProps): React.JSX.Element {
  const progress = progressOf(index, subtopic.id, exam);
  const tone =
    progress.status === 'completed'
      ? 'border-success/40 bg-success/10'
      : progress.status === 'weak'
        ? 'border-danger/40 bg-danger/10'
        : progress.status === 'learning'
          ? 'border-info/40 bg-info/10'
          : progress.status === 'revision_due'
            ? 'border-warn/40 bg-warn/10'
            : 'border-line bg-surface-2';
  return (
    <Link
      href={`/topic/${subtopic.id}?exam=${exam}`}
      title={`${subtopic.name} · ${progress.status.replace('_', ' ')}`}
      className={cn('flex items-center gap-1.5 rounded-[9px] border px-2 py-1.5 text-[12px] transition-colors hover:border-line-strong', tone)}
    >
      <span className="truncate">{subtopic.name}</span>
      {progress.revisionCount > 0 ? <span className="shrink-0 text-[10.5px] text-ink-muted">R{progress.revisionCount}</span> : null}
    </Link>
  );
}

export function SubjectTabs({
  subjects,
  active,
  onChange,
}: {
  subjects: { code: SubjectCode; name: string }[];
  active: SubjectCode | 'all';
  onChange(next: SubjectCode | 'all'): void;
}): React.JSX.Element {
  const options: { value: SubjectCode | 'all'; label: string }[] = [
    { value: 'all', label: 'All subjects' },
    ...subjects.map((subject) => ({ value: subject.code, label: subject.name })),
  ];
  return (
    <div role="tablist" aria-label="Subject" className="scroll-x flex gap-1 border-b border-line">
      {options.map((option) => {
        const selected = option.value === active;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              '-mb-px shrink-0 border-b-2 px-3 py-2 text-[13px] font-medium transition-colors',
              selected ? 'border-brand text-brand' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
