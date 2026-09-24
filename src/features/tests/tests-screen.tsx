'use client';

/**
 * Mock tests - scores, subject split, accuracy and the trend between tests.
 *
 * Totals are entered per subject and summed by the form, so nothing is guessed;
 * percentile and rank stay empty unless the student enters them.
 */
import * as React from 'react';
import Link from 'next/link';
import { ChevronRight, Gauge, Pencil, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react';
import type { ExamScope, SubjectCode } from '@/lib/types';
import { SUBJECT_LABELS } from '@/lib/constants';
import { useActions, useDerivedIndex, useSnapshot, useTracker } from '@/lib/store/tracker-store';
import { analyseTest, marksLostBySubject, testOverview, testTrendPoints } from '@/lib/calculations/tests';
import { formatDate, formatMinutes, relativeDay } from '@/lib/date';
import { Badge, Button, Card, CardContent, EmptyState, ProgressBar, Segmented, Stat, TableWrap, Td, Th } from '@/components/ui/primitives';
import { BarSeries, ChartFrame, HorizontalBars, LineSeries, CHART_PALETTE } from '@/components/ui/charts';
import { TestDialog } from '@/features/forms/action-forms';
import { useExamScope } from '@/lib/hooks/use-exam-scope';
import { cn } from '@/lib/utils';

export function TestsScreen(): React.JSX.Element {
  const snapshot = useSnapshot();
  const index = useDerivedIndex();
  const actions = useActions();
  const { notify } = useTracker();
  const [exam, setExam] = useExamScope('jm');
  const [adding, setAdding] = React.useState(false);
  const [editing, setEditing] = React.useState<string | null>(null);
  const [openTest, setOpenTest] = React.useState<string | null>(null);

  const overview = React.useMemo(() => testOverview(index, exam), [index, exam]);
  const trend = React.useMemo(() => testTrendPoints(index, exam), [index, exam]);
  const marksLost = React.useMemo(() => marksLostBySubject(index, exam), [index, exam]);
  const otherOverview = React.useMemo(() => testOverview(index, exam === 'jm' ? 'ja' : 'jm'), [index, exam]);
  const tests = overview.tests.slice().sort((a, b) => b.test.date.localeCompare(a.test.date));

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Mock tests</h1>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {overview.count === 0
              ? 'No tests recorded yet. Add the next test and the trend, subject split and accuracy build up automatically.'
              : `${overview.count} tests · average ${overview.averagePct}% · latest ${overview.latest?.test.name ?? '-'}`}
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
            Record test
          </Button>
        </div>
      </header>

      <section aria-label="Test summary" className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Tests" value={overview.count} hint={`${overview.withPercentile} with percentile data`} icon={<Gauge />} />
        <Stat label="Average score" value={overview.count ? `${overview.averagePct}%` : '-'} hint={overview.bestTest ? `Best ${overview.bestTest.pct}% on ${formatDate(overview.bestTest.test.date, 'short')}` : 'No tests yet'} />
        <Stat
          label="Latest"
          value={overview.latest ? `${overview.latest.pct}%` : '-'}
          hint={
            overview.latestDelta === null
              ? overview.latest?.test.name ?? 'No tests yet'
              : `${overview.latestDelta >= 0 ? '+' : ''}${overview.latestDelta} pts vs previous`
          }
          tone={overview.latestDelta === null ? 'default' : overview.latestDelta >= 0 ? 'success' : 'danger'}
        />
        <Stat
          label="Overall accuracy"
          value={overview.accuracy ? `${overview.accuracy}%` : '-'}
          hint={`${overview.attempts.correct} correct · ${overview.attempts.wrong} wrong · ${overview.attempts.unattempted} blank`}
        />
      </section>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartFrame
          title="Score trend"
          description="Percentage per test, oldest to newest."
          table={{ headers: ['Test', 'Score %'], rows: trend.map((point) => [point.name, point.pct]) }}
        >
          <BarSeries points={trend.map((point) => ({ label: point.date.slice(5), value: point.pct }))} unit="%" yDomain={[0, 100]} height={200} />
        </ChartFrame>
        <ChartFrame
          title="Accuracy against score"
          description="Where marks were lost: accuracy is right answers over attempted."
          table={{ headers: ['Test', 'Score %', 'Accuracy %'], rows: trend.map((point) => [point.name, point.pct, point.accuracy]) }}
        >
          <LineSeries
            points={trend.map((point) => ({ label: point.date.slice(5), value: point.pct, secondary: point.accuracy }))}
            unit="%"
            yDomain={[0, 100]}
            secondaryLabel="Accuracy"
            height={200}
          />
        </ChartFrame>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-[15px] font-semibold">History</h2>
            {tests.length === 0 ? (
              <EmptyState
                icon={<Gauge />}
                title="No tests recorded"
                description="Record a test right after you finish it - the numbers are far more useful while they are fresh."
                action={
                  <Button size="sm" variant="primary" onClick={() => setAdding(true)}>
                    Record a test
                  </Button>
                }
              />
            ) : (
              <ul className="space-y-2">
                {tests.map((summary) => {
                  const test = summary.test;
                  const open = openTest === test.id;
                  const analysis = analyseTest(index, test.id);
                  return (
                    <li key={test.id} className={cn('rounded-[10px] border', open ? 'border-brand/40' : 'border-line')}>
                      <div className="flex flex-col gap-2 p-2.5 sm:flex-row sm:items-center">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-1.5">
                            <span className="truncate text-[13.5px] font-medium">{test.name}</span>
                            <Badge tone={test.exam}>{test.exam.toUpperCase()}</Badge>
                            {test.percentile !== null ? <Badge tone="neutral">{test.percentile}%ile</Badge> : null}
                            {test.rank !== null ? <Badge tone="neutral">AIR {test.rank}</Badge> : null}
                            {summary.delta !== null ? (
                              <span className={cn('inline-flex items-center gap-1 text-[11.5px] font-medium', summary.delta >= 0 ? 'text-success' : 'text-danger')}>
                                {summary.delta >= 0 ? <TrendingUp aria-hidden className="size-3" /> : <TrendingDown aria-hidden className="size-3" />}
                                {summary.delta >= 0 ? '+' : ''}
                                {summary.delta}
                              </span>
                            ) : null}
                          </p>
                          <p className="mt-0.5 text-[11.5px] text-ink-muted">
                            {formatDate(test.date)} ({relativeDay(test.date)}) · {test.score}/{test.maxMarks} marks · {formatMinutes(test.durationMin)} ·{' '}
                            {summary.accuracy}% accuracy
                          </p>
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            {(['phy', 'chem', 'math'] as SubjectCode[]).map((code) => (
                              <span key={code} className="flex items-center gap-1.5 text-[11.5px]">
                                <span className="text-ink-muted">{SUBJECT_LABELS[code]}</span>
                                <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-2">
                                  <span
                                    className="block h-full rounded-full"
                                    style={{ width: `${summary.subjectPct[code]}%`, background: code === 'phy' ? CHART_PALETTE.phy : code === 'chem' ? CHART_PALETTE.chem : CHART_PALETTE.math }}
                                  />
                                </span>
                                <span className="tabular">{summary.subjectPct[code]}%</span>
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-wrap items-center gap-1">
                          <Button size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpenTest(open ? null : test.id)}>
                            <ChevronRight aria-hidden className={cn('size-3.5 transition-transform', open && 'rotate-90')} />
                            {open ? 'Hide' : 'Analyse'}
                          </Button>
                          <Button size="icon-sm" variant="ghost" aria-label={`Edit ${test.name}`} onClick={() => setEditing(test.id)}>
                            <Pencil />
                          </Button>
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label={`Delete ${test.name}`}
                            onClick={() => {
                              actions.deleteTest(test.id);
                              notify('Test deleted');
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>

                      {open && analysis ? (
                        <div className="space-y-3 border-t border-line p-2.5">
                          <div className="grid gap-2 sm:grid-cols-3">
                            <div className="rounded-[10px] border border-line p-2">
                              <p className="text-[11px] uppercase tracking-wide text-ink-subtle">Strongest</p>
                              <p className="text-[13px] font-semibold">{analysis.strongest?.label ?? '-'}</p>
                            </div>
                            <div className="rounded-[10px] border border-line p-2">
                              <p className="text-[11px] uppercase tracking-wide text-ink-subtle">Weakest</p>
                              <p className="text-[13px] font-semibold">{analysis.weakest?.label ?? '-'}</p>
                            </div>
                            <div className="rounded-[10px] border border-line p-2">
                              <p className="text-[11px] uppercase tracking-wide text-ink-subtle">Spread &amp; trend</p>
                              <p className="text-[13px] font-semibold">
                                {analysis.spread} pts · {analysis.trendPerTest >= 0 ? '+' : ''}
                                {analysis.trendPerTest}/test
                              </p>
                            </div>
                          </div>
                          <TableWrap>
                            <caption className="sr-only">Subject breakdown for {test.name}</caption>
                            <thead>
                              <tr>
                                <Th>Subject</Th>
                                <Th className="text-right">Marks</Th>
                                <Th className="text-right">%</Th>
                                <Th className="text-right">Attempted</Th>
                                <Th className="text-right">Correct</Th>
                                <Th className="text-right">Wrong</Th>
                                <Th className="text-right">Accuracy</Th>
                              </tr>
                            </thead>
                            <tbody>
                              {analysis.bySubject.map((row) => (
                                <tr key={row.code}>
                                  <Td>{row.label}</Td>
                                  <Td className="text-right tabular">
                                    {row.score}/{row.max}
                                  </Td>
                                  <Td className="text-right tabular">{row.pct}%</Td>
                                  <Td className="text-right tabular">{row.attempted}</Td>
                                  <Td className="text-right tabular">{test.subjects[row.code]?.correct ?? 0}</Td>
                                  <Td className="text-right tabular">{test.subjects[row.code]?.wrong ?? 0}</Td>
                                  <Td className="text-right tabular">{row.accuracy}%</Td>
                                </tr>
                              ))}
                            </tbody>
                          </TableWrap>
                          {test.notes ? <p className="text-[12.5px] text-ink-muted">Notes: {test.notes}</p> : null}
                          <div className="flex flex-wrap items-center gap-2">
                            <Link href="/mistakes" className="text-[12.5px] font-medium text-brand hover:underline">
                              Log the mistakes you made in this test
                            </Link>
                            <Link href="/coach" className="text-[12.5px] font-medium text-brand hover:underline">
                              Ask the coach about this paper
                            </Link>
                          </div>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-[15px] font-semibold">Subject averages</h2>
              {overview.subjectAverages.every((row) => row.tests === 0) ? (
                <p className="text-[12.5px] text-ink-muted">No subject marks recorded yet.</p>
              ) : (
                <ul className="space-y-2.5">
                  {overview.subjectAverages.map((row) => (
                    <li key={row.code}>
                      <div className="flex items-center justify-between text-[12.5px]">
                        <span className="font-medium">{row.label}</span>
                        <span className="tabular text-ink-muted">
                          {row.pct}% · {row.score}/{row.max} across {row.tests} test{row.tests === 1 ? '' : 's'}
                        </span>
                      </div>
                      <ProgressBar
                        className="mt-1"
                        value={row.pct}
                        tone={row.code === 'phy' ? 'phy' : row.code === 'chem' ? 'chem' : 'math'}
                        label={`${row.label} average`}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-[15px] font-semibold">Marks lost by subject</h2>
              {marksLost.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">Record a test to see where marks were lost.</p>
              ) : (
                <HorizontalBars
                  rows={marksLost.map((row) => ({
                    label: row.label,
                    value: row.lost,
                    valueText: `${row.lost} marks`,

                    color: CHART_PALETTE.danger,
                  }))}
                />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-[15px] font-semibold">Both exam scopes</h2>
              <p className="text-[12.5px] text-ink-muted">
                {snapshot.tests.length} tests recorded in total. Main and Advanced papers are tracked separately so the
                trends are not mixed.
              </p>
              <ul className="space-y-2 text-[12.5px]">
                <li className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Badge tone="jm">JEE Main</Badge>
                    <span className="text-ink-muted">
                      {overview.count} test{overview.count === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="tabular font-medium">{overview.count ? `${overview.averagePct}% avg` : '-'}</span>
                </li>
                <li className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5">
                    <Badge tone="ja">JEE Advanced</Badge>
                    <span className="text-ink-muted">
                      {otherOverview.count} test{otherOverview.count === 1 ? '' : 's'}
                    </span>
                  </span>
                  <span className="tabular font-medium">{otherOverview.count ? `${otherOverview.averagePct}% avg` : '-'}</span>
                </li>
              </ul>
              <p className="text-[11.5px] text-ink-subtle">
                Percentile and rank are only shown when you entered them for a test - the app never estimates them.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {adding ? <TestDialog onClose={() => setAdding(false)} exam={exam} /> : null}
      {editing ? (
        <TestDialog
          onClose={() => setEditing(null)}
          edit={snapshot.tests.find((test) => test.id === editing) ?? undefined}
        />
      ) : null}
    </div>
  );
}
