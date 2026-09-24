'use client';

/**
 * Global search - one box across the syllabus and everything you have tracked.
 *
 * The syllabus half searches the official documents; the personal half searches
 * your own records (tasks, lectures, revisions, questions, mistakes, tests,
 * sessions and topic notes) and every result links to the screen that owns it.
 */
import * as React from 'react';
import Link from 'next/link';
import { BookOpen, CalendarDays, FileWarning, FlaskConical, Gauge, ListChecks, Repeat, Search as SearchIcon, Timer } from 'lucide-react';
import type { ExamScope, SubjectCode } from '@/lib/types';
import { SUBJECT_LABELS } from '@/lib/constants';
import { useDerivedIndex, useSnapshot } from '@/lib/store/tracker-store';
import { nodeById, searchSyllabus } from '@/lib/syllabus';
import { progressOf } from '@/lib/calculations/progress';
import { formatDate, formatMinutes, relativeDay } from '@/lib/date';
import { Badge, Card, CardContent, EmptyState, Input } from '@/components/ui/primitives';
import { Segmented } from '@/components/ui/primitives';
import { StatusDot } from '@/components/ui/status';
import { useExamScope } from '@/lib/hooks/use-exam-scope';

interface Result {
  id: string;
  title: string;
  detail: string;
  href: string;
  kind: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const MIN_QUERY = 2;

export function SearchScreen({ initialQuery = '' }: { initialQuery?: string }): React.JSX.Element {
  const snapshot = useSnapshot();
  const index = useDerivedIndex();
  const [exam, setExam] = useExamScope('jm');
  const [query, setQuery] = React.useState(initialQuery);

  const needle = query.trim().toLowerCase();
  const active = needle.length >= MIN_QUERY;

  const results = React.useMemo<Result[]>(() => {
    if (!active) return [];
    const hits: Result[] = [];
    const matched = (haystack?: string | null): boolean => (haystack ? haystack.toLowerCase().includes(needle) : false);

    /* Syllabus documents */
    const syllabus = searchSyllabus(needle, 12);
    for (const row of syllabus.chapters) {
      hits.push({
        id: `chapter-${row.id}`,
        title: row.name,
        detail: `${row.subject} · chapter`,
        href: `/chapter/${row.id}?exam=${exam}`,
        kind: 'Syllabus',
        icon: BookOpen,
      });
    }
    for (const row of syllabus.topics) {
      hits.push({
        id: `topic-${row.id}`,
        title: row.name,
        detail: `${row.chapter} · ${row.subject}`,
        href: `/topic/${row.id}?exam=${exam}`,
        kind: 'Syllabus',
        icon: BookOpen,
      });
    }
    for (const row of syllabus.subtopics) {
      hits.push({
        id: `subtopic-${row.id}`,
        title: row.name,
        detail: `${row.topic} · ${row.chapter} · ${row.subject}`,
        href: `/topic/${row.id}?exam=${exam}`,
        kind: 'Syllabus',
        icon: BookOpen,
      });
    }

    /* Personal records */
    for (const task of snapshot.tasks) {
      if (!matched(task.title) && !matched(task.notes)) continue;
      hits.push({
        id: `task-${task.id}`,
        title: task.title,
        detail: `${task.type} · planned ${formatDate(task.plannedFor, 'short')} · ${formatMinutes(task.estMin)}`,
        href: `/planner?exam=${task.exam}`,
        kind: 'Task',
        icon: CalendarDays,
        badge: task.status,
      });
    }

    for (const lecture of snapshot.lectures) {
      if (!matched(lecture.title) && !matched(lecture.source) && !matched(lecture.notes)) continue;
      hits.push({
        id: `lecture-${lecture.id}`,
        title: lecture.title,
        detail: `${SUBJECT_LABELS[lecture.subject]} · ${lecture.source || 'no source'} · ${formatMinutes(lecture.watchedMin)} watched`,
        href: `/lectures?q=${encodeURIComponent(lecture.title)}`,
        kind: 'Lecture',
        icon: ListChecks,
        badge: lecture.status,
      });
    }

    for (const revision of snapshot.revisions) {
      const node = nodeById(revision.nodeId);
      if (!matched(node?.name) && !matched(revision.note)) continue;
      hits.push({
        id: `revision-${revision.id}`,
        title: node?.name ?? 'Revision',
        detail: `Revision ${revision.index} · due ${formatDate(revision.scheduledFor, 'short')} (${relativeDay(revision.scheduledFor)})`,
        href: `/topic/${revision.nodeId}?exam=${revision.exam}`,
        kind: 'Revision',
        icon: Repeat,
        badge: revision.completedAt ? 'done' : revision.scheduledFor < new Date().toISOString().slice(0, 10) ? 'overdue' : 'queued',
      });
    }

    for (const log of snapshot.questions) {
      const node = nodeById(log.nodeId ?? log.subtopicId ?? log.topicId ?? log.chapterId);
      if (!matched(log.notes) && !matched(node?.name)) continue;
      hits.push({
        id: `question-${log.id}`,
        title: node?.name ?? 'Question log',
        detail: `${log.source} · ${log.attempted} attempted · ${log.accuracy}% accuracy · ${formatDate(log.date, 'short')}`,
        href: `/questions?exam=${log.exam}`,
        kind: 'Questions',
        icon: FlaskConical,
      });
    }

    for (const mistake of snapshot.mistakes) {
      if (!matched(mistake.questionText) && !matched(mistake.whatWentWrong) && !matched(mistake.correctConcept)) continue;
      hits.push({
        id: `mistake-${mistake.id}`,
        title: mistake.questionText.slice(0, 90) || 'Mistake entry',
        detail: `${mistake.mistakeType} · ${formatDate(mistake.date, 'short')} · ${mistake.status}`,
        href: `/mistakes?exam=${mistake.exam}`,
        kind: 'Mistake',
        icon: FileWarning,
      });
    }

    for (const test of snapshot.tests) {
      if (!matched(test.name) && !matched(test.notes)) continue;
      hits.push({
        id: `test-${test.id}`,
        title: test.name,
        detail: `${formatDate(test.date, 'long')} · ${test.score}/${test.maxMarks} marks · ${test.accuracy}% accuracy`,
        href: `/tests?exam=${test.exam}`,
        kind: 'Test',
        icon: Gauge,
      });
    }

    for (const session of snapshot.sessions) {
      const node = nodeById(session.subtopicId ?? session.topicId ?? session.chapterId);
      if (!matched(session.notes) && !matched(node?.name)) continue;
      hits.push({
        id: `session-${session.id}`,
        title: node?.name ?? `${session.mode} session`,
        detail: `${session.mode} · ${formatMinutes(session.minutes)} · ${formatDate(session.start.slice(0, 10), 'short')}`,
        href: `/timer?exam=${session.exam}`,
        kind: 'Study time',
        icon: Timer,
      });
    }

    for (const [nodeId, rows] of Object.entries(snapshot.progress)) {
      for (const [scope, row] of Object.entries(rows)) {
        if (!row || !matched(row.note)) continue;
        const node = nodeById(nodeId);
        hits.push({
          id: `note-${nodeId}-${scope}`,
          title: node?.name ?? nodeId,
          detail: `Note: ${row.note ?? ''}`,
          href: `/topic/${nodeId}?exam=${scope}`,
          kind: 'Notes',
          icon: BookOpen,
        });
      }
    }

    return hits;
  }, [active, needle, snapshot, exam]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Result[]>();
    for (const result of results) {
      const list = map.get(result.kind);
      if (list) list.push(result);
      else map.set(result.kind, [result]);
    }
    return [...map.entries()];
  }, [results]);

  /** With no query, offer real starting points from the user's own data. */
  const suggestions = React.useMemo(() => {
    return snapshot.tasks
      .filter((task) => task.status === 'pending' && task.exam === exam)
      .sort((a, b) => a.plannedFor.localeCompare(b.plannedFor))
      .slice(0, 5)
      .map((task) => ({ id: task.id, title: task.title, plannedFor: task.plannedFor, type: task.type }));
  }, [snapshot.tasks, exam]);

  const notes = React.useMemo(() => {
    return Object.entries(snapshot.progress)
      .flatMap(([nodeId, rows]) =>
        Object.entries(rows).map(([scope, row]) => ({ nodeId, scope: scope as ExamScope, note: row?.note ?? '' })),
      )
      .filter((row) => row.note.trim().length > 0)
      .slice(0, 6);
  }, [snapshot.progress]);

  return (
    <div className="space-y-4">
      <header className="space-y-2">
        <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
          <SearchIcon aria-hidden className="size-5 text-ink-subtle" />
          Search
        </h1>
        <p className="text-[12.5px] text-ink-muted">
          Searches the official syllabus plus your tasks, lectures, revisions, question logs, mistakes, tests, sessions
          and notes.
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <SearchIcon aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
          <Input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Photosynthesis, rotational motion, DPP 14…"
            aria-label="Search everything"
            className="h-10 pl-8 text-[14px]"
          />
        </div>
        <Segmented<ExamScope>
          ariaLabel="Exam scope for syllabus links"
          value={exam}
          onChange={setExam}
          options={[
            { value: 'jm', label: 'JEE Main' },
            { value: 'ja', label: 'JEE Advanced' },
          ]}
        />
      </div>

      {!active ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-[15px] font-semibold">Next up in your plan</h2>
              {suggestions.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">
                  No pending tasks in {exam === 'jm' ? 'JEE Main' : 'JEE Advanced'}. Add one from the planner.
                </p>
              ) : (
                <ul className="space-y-1.5">
                  {suggestions.map((task) => (
                    <li key={task.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                      <Link href={`/planner?exam=${exam}`} className="min-w-0 truncate hover:underline">
                        {task.title}
                      </Link>
                      <span className="shrink-0 text-[11.5px] text-ink-muted">
                        {task.type} · {relativeDay(task.plannedFor)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-[15px] font-semibold">Recent notes</h2>
              {notes.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">No topic notes yet. Notes you write on a topic become searchable here.</p>
              ) : (
                <ul className="space-y-2">
                  {notes.map((row) => {
                    const node = nodeById(row.nodeId);
                    const state = progressOf(index, row.nodeId, row.scope);
                    return (
                      <li key={`${row.nodeId}-${row.scope}`} className="text-[12.5px]">
                        <Link href={`/topic/${row.nodeId}?exam=${row.scope}`} className="font-medium hover:underline">
                          {node?.name ?? row.nodeId}
                        </Link>
                        <span className="ml-1.5 inline-flex items-center gap-1 align-middle">
                          <StatusDot status={state.status} />
                          <Badge tone={row.scope === 'jm' ? 'jm' : 'ja'}>{row.scope.toUpperCase()}</Badge>
                        </span>
                        <span className="block truncate text-ink-muted">{row.note}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={<SearchIcon />}
          title={`No matches for “${query.trim()}”`}
          description="Search checks chapter, topic and subtopic names in the official syllabus as well as the text of your own records. Two characters is the minimum."
        />
      ) : (
        <div className="space-y-4">
          <p className="text-[12.5px] text-ink-muted">
            {results.length} result{results.length === 1 ? '' : 's'} for “{query.trim()}”
          </p>
          {grouped.map(([kind, rows]) => {
            const Icon = rows[0]?.icon ?? SearchIcon;
            return (
              <Card key={kind}>
                <CardContent className="space-y-1.5">
                  <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-wide text-ink-subtle">
                    <Icon className="size-4" />
                    {kind}
                    <span className="font-normal">({rows.length})</span>
                  </h2>
                  <ul className="divide-y divide-line">
                    {rows.map((row) => (
                      <li key={row.id}>
                        <Link href={row.href} className="flex items-start justify-between gap-3 py-2 transition-colors hover:bg-surface-2/60">
                          <span className="min-w-0">
                            <span className="block truncate text-[13px] font-medium">{row.title}</span>
                            <span className="block truncate text-[11.5px] text-ink-muted">{row.detail}</span>
                          </span>
                          {row.badge ? <Badge tone="neutral">{row.badge}</Badge> : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-[11.5px] text-ink-subtle">
        Tip: the exam scope above only affects where syllabus links take you ({exam === 'jm' ? 'JEE Main' : 'JEE Advanced'}).
        Your records are searched across both scopes.
      </p>
      {Object.keys(snapshot.progress).length === 0 && snapshot.tasks.length === 0 ? (
        <p className="text-[11.5px] text-ink-subtle">
          Nothing personal is tracked yet, so only syllabus results will appear. Subject quick links:{' '}
          {(['phy', 'chem', 'math'] as SubjectCode[]).map((code, position) => (
            <React.Fragment key={code}>
              {position > 0 ? ' · ' : ''}
              <Link href={`/subject/${code}`} className="text-brand hover:underline">
                {SUBJECT_LABELS[code]}
              </Link>
            </React.Fragment>
          ))}
        </p>
      ) : null}
    </div>
  );
}
