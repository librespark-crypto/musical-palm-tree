'use client';

/**
 * Mistake book - errors worth never repeating, with a revision workflow.
 *
 * The lifecycle is open → revised → mastered, and the counts match the
 * analytics screen because both read the same stored records.
 */
import * as React from 'react';
import Link from 'next/link';
import { FileWarning, Pencil, Plus, RotateCcw, Trash2 } from 'lucide-react';
import type { ExamScope, Mistake, MistakeStatus, MistakeType, SubjectCode } from '@/lib/types';
import { MISTAKE_TYPES } from '@/lib/types';
import { SUBJECT_LABELS } from '@/lib/constants';
import { useActions, useDerivedIndex, useSnapshot, useTracker } from '@/lib/store/tracker-store';
import { mistakePatterns } from '@/lib/calculations/analytics';
import { formatDate, relativeDay } from '@/lib/date';
import { nodeById } from '@/lib/syllabus';
import { Badge, Button, Card, CardContent, EmptyState, Input, Select, Segmented, Stat } from '@/components/ui/primitives';
import { HorizontalBars, CHART_PALETTE } from '@/components/ui/charts';
import { MistakeDialog } from '@/features/forms/action-forms';
import { useExamScope } from '@/lib/hooks/use-exam-scope';
import { cn } from '@/lib/utils';

type StatusFilter = MistakeStatus | 'all';

export function MistakesScreen(): React.JSX.Element {
  const snapshot = useSnapshot();
  const index = useDerivedIndex();
  const actions = useActions();
  const { notify } = useTracker();
  const [exam, setExam] = useExamScope('jm');
  const [status, setStatus] = React.useState<StatusFilter>('open');
  const [subject, setSubject] = React.useState<SubjectCode | 'all'>('all');
  const [type, setType] = React.useState<MistakeType | 'all'>('all');
  const [query, setQuery] = React.useState('');
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<Mistake | null>(null);

  const patterns = React.useMemo(() => mistakePatterns(index), [index]);
  const mistakes = snapshot.mistakes
    .filter((mistake) => mistake.exam === exam)
    .filter((mistake) => status === 'all' || mistake.status === status)
    .filter((mistake) => subject === 'all' || mistake.subject === subject)
    .filter((mistake) => type === 'all' || mistake.mistakeType === type)
    .filter((mistake) =>
      query.trim().length < 2
        ? true
        : `${mistake.questionText} ${mistake.whatWentWrong} ${mistake.correctConcept}`.toLowerCase().includes(query.trim().toLowerCase()),
    )
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  const openCount = snapshot.mistakes.filter((mistake) => mistake.exam === exam && mistake.status === 'open').length;
  const revisedCount = snapshot.mistakes.filter((mistake) => mistake.exam === exam && mistake.status === 'revised').length;
  const masteredCount = snapshot.mistakes.filter((mistake) => mistake.exam === exam && mistake.status === 'mastered').length;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Mistake book</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {snapshot.mistakes.length === 0
              ? 'Each mistake you log here is a question you should never get wrong again.'
              : `${openCount} open · ${revisedCount} revised · ${masteredCount} mastered in ${exam === 'jm' ? 'JEE Main' : 'JEE Advanced'}`}
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
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus aria-hidden className="size-4" />
            Add mistake
          </Button>
        </div>
      </header>

      <section aria-label="Mistake summary" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Open" value={openCount} tone={openCount ? 'danger' : 'default'} hint="Not yet revised" icon={<FileWarning />} />
        <Stat label="Revised" value={revisedCount} tone={revisedCount ? 'warn' : 'default'} hint="Revised once, still worth watching" />
        <Stat label="Mastered" value={masteredCount} tone={masteredCount ? 'success' : 'default'} hint="You can solve these now" />
        <Stat
          label="Revised this week"
          value={patterns.revisedThisWeek}
          hint={patterns.byType[0] ? `Most common: ${String(patterns.byType[0].type)} (${patterns.byType[0].count})` : 'No patterns yet'}
        />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Segmented<StatusFilter>
          ariaLabel="Status filter"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'revised', label: 'Revised' },
            { value: 'mastered', label: 'Mastered' },
          ]}
        />
        <Select aria-label="Filter by subject" className="h-9 w-40" value={subject} onChange={(event) => setSubject(event.target.value as SubjectCode | 'all')}>
          <option value="all">All subjects</option>
          {(['phy', 'chem', 'math'] as SubjectCode[]).map((code) => (
            <option key={code} value={code}>
              {SUBJECT_LABELS[code]}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by mistake type" className="h-9 w-48" value={type} onChange={(event) => setType(event.target.value as MistakeType | 'all')}>
          <option value="all">Any mistake type</option>
          {MISTAKE_TYPES.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </Select>
        <Input
          className="h-9 w-56"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the text of a mistake"
          aria-label="Search mistakes"
        />
        <span className="text-[11.5px] text-ink-muted">{mistakes.length} shown</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {mistakes.length === 0 ? (
            <EmptyState
              icon={<FileWarning />}
              title={snapshot.mistakes.length ? 'Nothing matches these filters' : 'The mistake book is empty'}
              description={
                snapshot.mistakes.length
                  ? 'Try a different status, subject or mistake type.'
                  : 'Log the next question you get wrong: what went wrong, and what the correct approach is. That is what makes the difference between practice and progress.'
              }
              action={
                <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
                  Add a mistake
                </Button>
              }
            />
          ) : (
            mistakes.map((mistake) => {
              const nodeId = mistake.subtopicId ?? mistake.topicId ?? mistake.chapterId;
              const node = nodeId ? nodeById(nodeId) : null;
              return (
                <article key={mistake.id} className={cn('rounded-[var(--radius-card)] border bg-surface p-3 shadow-card', mistake.status === 'open' ? 'border-danger/30' : 'border-line')}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium leading-snug">{mistake.questionText}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11.5px] text-ink-muted">
                        <Badge tone={mistake.mistakeType === 'Conceptual' ? 'danger' : 'neutral'}>{mistake.mistakeType}</Badge>
                        <span>{SUBJECT_LABELS[mistake.subject]}</span>
                        {node ? (
                          <>
                            <span aria-hidden>·</span>
                            <Link href={`/topic/${node.id}?exam=${mistake.exam}`} className="hover:underline">
                              {node.name}
                            </Link>
                          </>
                        ) : null}
                        <span aria-hidden>·</span>
                        <span>{formatDate(mistake.date, 'short')}</span>
                        <span>({relativeDay(mistake.date)})</span>
                        {mistake.source ? <span>· {mistake.source}</span> : null}
                        {mistake.revisions > 0 ? <span>· revised {mistake.revisions}×</span> : null}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <Badge tone={mistake.status === 'mastered' ? 'success' : mistake.status === 'revised' ? 'warn' : 'danger'}>{mistake.status}</Badge>
                      {mistake.status !== 'revised' ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            actions.setMistakeStatus(mistake.id, 'revised');
                            notify('Marked as revised', 'success');
                          }}
                        >
                          Revised
                        </Button>
                      ) : null}
                      {mistake.status !== 'mastered' ? (
                        <Button size="sm" variant="ghost" onClick={() => actions.setMistakeStatus(mistake.id, 'mastered')}>
                          Mastered
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost" onClick={() => actions.setMistakeStatus(mistake.id, 'open')}>
                          <RotateCcw aria-hidden className="size-3.5" />
                          Reopen
                        </Button>
                      )}
                      <Button size="icon-sm" variant="ghost" aria-label="Edit mistake" onClick={() => setEditing(mistake)}>
                        <Pencil />
                      </Button>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Delete mistake"
                        onClick={() => {
                          actions.deleteMistake(mistake.id);
                          notify('Mistake deleted');
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                  {mistake.whatWentWrong || mistake.correctConcept ? (
                    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                      {mistake.whatWentWrong ? (
                        <div className="rounded-[10px] border border-line bg-surface-2 p-2">
                          <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-subtle">What went wrong</dt>
                          <dd className="text-[12.5px] leading-snug">{mistake.whatWentWrong}</dd>
                        </div>
                      ) : null}
                      {mistake.correctConcept ? (
                        <div className="rounded-[10px] border border-line bg-surface-2 p-2">
                          <dt className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-subtle">Correct concept</dt>
                          <dd className="text-[12.5px] leading-snug">{mistake.correctConcept}</dd>
                        </div>
                      ) : null}
                    </dl>
                  ) : null}
                </article>
              );
            })
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-[15px] font-semibold">Mistake types</h2>
              {patterns.byType.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">Log a mistake to see which failure mode dominates.</p>
              ) : (
                <HorizontalBars
                  rows={patterns.byType.slice(0, 8).map((row) => ({
                    label: String(row.type),
                    value: row.count,
                    valueText: `${row.count}`,
                    color: CHART_PALETTE.warn,
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-[15px] font-semibold">Repeated topics</h2>
              {patterns.repeatedTopics.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">No topic has more than one mistake logged.</p>
              ) : (
                <ul className="space-y-2">
                  {patterns.repeatedTopics.map((row) => (
                    <li key={row.nodeId} className="flex items-start justify-between gap-2 text-[12.5px]">
                      <span className="min-w-0">
                        <Link href={`/topic/${row.nodeId}?exam=${exam}`} className="block truncate font-medium hover:underline">
                          {row.name}
                        </Link>
                        <span className="block truncate text-[11.5px] text-ink-muted">{row.types.join(', ')}</span>
                      </span>
                      <Badge tone={row.count >= 3 ? 'danger' : 'warn'}>{row.count}×</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-[15px] font-semibold">By subject</h2>
              {patterns.bySubject.every((row) => row.count === 0) ? (
                <p className="text-[12.5px] text-ink-muted">No mistakes logged yet.</p>
              ) : (
                <ul className="space-y-1.5 text-[12.5px]">
                  {patterns.bySubject.map((row) => (
                    <li key={row.code} className="flex items-center justify-between gap-2">
                      <span>{row.label}</span>
                      <span className="tabular text-ink-muted">{row.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {adding ? <MistakeDialog onClose={() => setAdding(false)} exam={exam} /> : null}
      {editing ? <MistakeDialog onClose={() => setEditing(null)} exam={editing.exam} edit={editing} /> : null}
    </div>
  );
}
