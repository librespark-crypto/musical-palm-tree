'use client';

/**
 * Questions - every DPP, PYQ, practice set and mock section you logged, with the
 * accuracy numbers that feed mastery. Nothing is estimated: an empty tracker
 * shows zeros and an explanation, not fabricated percentages.
 */
import * as React from 'react';
import Link from 'next/link';
import { NotebookPen, Plus, Trash2 } from 'lucide-react';
import type { ExamScope, QuestionSource, SubjectCode } from '@/lib/types';
import { QUESTION_SOURCE_LIST, SUBJECT_LABELS } from '@/lib/constants';
import { useActions, useDerivedIndex, useSnapshot, useTracker } from '@/lib/store/tracker-store';
import { accuracyTrend, questionOverview } from '@/lib/calculations/analytics';
import { addDays, formatDate, formatMinutes, relativeDay, todayISO } from '@/lib/date';
import { nodeById } from '@/lib/syllabus';
import { Badge, Button, Card, CardContent, EmptyState, Select, Segmented, Stat, TableWrap, Td, Th } from '@/components/ui/primitives';
import { ChartFrame, LineSeries, HorizontalBars, CHART_PALETTE } from '@/components/ui/charts';
import { QuestionDialog } from '@/features/forms/action-forms';
import { useExamScope } from '@/lib/hooks/use-exam-scope';

type Window = '7' | '30' | '0';

export function QuestionsScreen(): React.JSX.Element {
  const snapshot = useSnapshot();
  const index = useDerivedIndex();
  const actions = useActions();
  const { notify } = useTracker();
  const [exam, setExam] = useExamScope('jm');
  const [days, setDays] = React.useState<Window>('30');
  const [source, setSource] = React.useState<QuestionSource | 'all'>('all');
  const [subject, setSubject] = React.useState<SubjectCode | 'all'>('all');
  const [adding, setAdding] = React.useState(false);

  const windowDays = Number(days);
  const overview = React.useMemo(() => questionOverview(index, { exam, days: windowDays, subject: subject === 'all' ? null : subject }), [index, exam, windowDays, subject]);
  const trend = React.useMemo(() => accuracyTrend(index, 20), [index]);
  const logs = snapshot.questions
    .filter((log) => log.exam === exam)
    .filter((log) => source === 'all' || log.source === source)
    .filter((log) => subject === 'all' || log.subject === subject)
    .filter((log) => (windowDays === 0 ? true : log.date >= addDays(todayISO(), -windowDays)))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Questions</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {snapshot.questions.length === 0
              ? 'No question logs yet - log a DPP or a PYQ set and accuracy starts tracking.'
              : `${snapshot.questions.length} logs recorded · ${overview.attempted} questions attempted in this view`}
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
            Log questions
          </Button>
        </div>
      </header>

      <section aria-label="Question summary" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Attempted" value={overview.attempted} hint={`${overview.logs} logs in this window`} icon={<NotebookPen />} />
        <Stat
          label="Accuracy"
          value={overview.attempted ? `${overview.accuracy}%` : '-'}
          tone={overview.accuracy >= 60 ? 'success' : overview.attempted ? 'warn' : 'default'}
          hint={`${overview.correct} correct · ${overview.wrong} wrong · ${overview.unattempted} blank`}
        />
        <Stat label="Time per question" value={overview.attempted ? `${overview.minutesPerQuestion} min` : '-'} hint={`${formatMinutes(overview.timeMin)} logged`} />
        <Stat
          label="Weak signal"
          value={overview.accuracy > 0 && overview.accuracy < 45 ? 'Under 45%' : overview.accuracy >= 60 ? 'Healthy' : 'Watch'}
          tone={overview.accuracy > 0 && overview.accuracy < 45 ? 'danger' : 'default'}
          hint="Topics fall below 45% accuracy are flagged weak automatically"
        />
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label="Time window" className="h-9 w-36" value={days} onChange={(event) => setDays(event.target.value as Window)}>
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="0">All time</option>
        </Select>
        <Select aria-label="Filter by source" className="h-9 w-40" value={source} onChange={(event) => setSource(event.target.value as QuestionSource | 'all')}>
          <option value="all">Any source</option>
          {QUESTION_SOURCE_LIST.map((entry) => (
            <option key={entry} value={entry}>
              {entry}
            </option>
          ))}
        </Select>
        <Select aria-label="Filter by subject" className="h-9 w-40" value={subject} onChange={(event) => setSubject(event.target.value as SubjectCode | 'all')}>
          <option value="all">All subjects</option>
          {(['phy', 'chem', 'math'] as SubjectCode[]).map((code) => (
            <option key={code} value={code}>
              {SUBJECT_LABELS[code]}
            </option>
          ))}
        </Select>
        <span className="text-[11.5px] text-ink-muted">{logs.length} logs</span>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardContent>
            {logs.length === 0 ? (
              <EmptyState
                title="No logs match these filters"
                description="Widen the window or clear the filters. Every log you add is stored locally and used by the analytics and AI coach."
                action={
                  <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
                    Log questions
                  </Button>
                }
              />
            ) : (
              <TableWrap>
                <caption className="sr-only">Question logs</caption>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Source</Th>
                    <Th>Node</Th>
                    <Th className="text-right">Att.</Th>
                    <Th className="text-right">Correct</Th>
                    <Th className="text-right">Wrong</Th>
                    <Th className="text-right">Blank</Th>
                    <Th className="text-right">Accuracy</Th>
                    <Th>Diff.</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {logs.slice(0, 200).map((log) => {
                    const nodeId = log.subtopicId ?? log.topicId ?? log.chapterId;
                    const node = nodeId ? nodeById(nodeId) : null;
                    return (
                      <tr key={log.id}>
                        <Td className="whitespace-nowrap">{formatDate(log.date, 'short')}</Td>
                        <Td>
                          <Badge tone="neutral">{log.source}</Badge>
                        </Td>
                        <Td className="max-w-56">
                          {node ? (
                            <Link href={`/topic/${node.id}?exam=${log.exam}`} className="hover:underline">
                              {node.name}
                            </Link>
                          ) : (
                            <span className="text-ink-subtle">-</span>
                          )}
                        </Td>
                        <Td className="text-right tabular">{log.attempted}</Td>
                        <Td className="text-right tabular">{log.correct}</Td>
                        <Td className="text-right tabular">{log.wrong}</Td>
                        <Td className="text-right tabular">{log.unattempted}</Td>
                        <Td className="text-right tabular">
                          <Badge tone={log.accuracy >= 60 ? 'success' : log.accuracy >= 45 ? 'warn' : 'danger'}>{log.accuracy}%</Badge>
                        </Td>
                        <Td>{log.difficulty}</Td>
                        <Td>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Delete question log from ${formatDate(log.date, 'short')}`}
                            onClick={() => {
                              actions.deleteQuestion(log.id);
                              notify('Question log deleted');
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <ChartFrame
            title="Accuracy trend"
            description="Per logged session, oldest to newest."
            table={{
              headers: ['Date', 'Accuracy %', 'Attempted'],
              rows: trend.map((point) => [formatDate(point.date, 'short'), point.accuracy, point.attempted]),
            }}
          >
            <LineSeries
              points={trend.map((point) => ({ label: formatDate(point.date, 'short'), value: point.accuracy }))}
              unit="%"
              yDomain={[0, 100]}
              height={190}
            />
          </ChartFrame>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-[15px] font-semibold">By source</h2>
              {overview.bySource.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">No logs in this window.</p>
              ) : (
                <HorizontalBars
                  rows={overview.bySource.map((row) => ({
                    label: row.source,
                    value: row.accuracy,
                    valueText: `${row.accuracy}% · ${row.attempted} q`,
                    color: row.accuracy >= 60 ? CHART_PALETTE.chem : row.accuracy >= 45 ? CHART_PALETTE.math : CHART_PALETTE.danger,
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-[15px] font-semibold">By difficulty</h2>
              {overview.byDifficulty.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">No logs in this window.</p>
              ) : (
                <ul className="space-y-2 text-[12.5px]">
                  {overview.byDifficulty.map((row) => (
                    <li key={row.difficulty} className="flex items-center justify-between gap-2">
                      <span className="capitalize">{row.difficulty}</span>
                      <span className="tabular text-ink-muted">
                        {row.correct}/{row.attempted} · {row.accuracy}%
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-[15px] font-semibold">Latest logs</h2>
              {snapshot.questions.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">Nothing logged yet.</p>
              ) : (
                <ul className="space-y-1.5 text-[12.5px]">
                  {snapshot.questions
                    .slice()
                    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                    .slice(0, 5)
                    .map((log) => (
                      <li key={log.id} className="flex items-center justify-between gap-2">
                        <span className="truncate">
                          {log.source} · {SUBJECT_LABELS[log.subject]}
                        </span>
                        <span className="shrink-0 text-ink-muted">{relativeDay(log.date)}</span>
                      </li>
                    ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {adding ? <QuestionDialog onClose={() => setAdding(false)} exam={exam} /> : null}
    </div>
  );
}
