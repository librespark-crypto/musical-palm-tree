'use client';

/**
 * Analytics - nine views over the stored records.
 *
 * Every chart is paired with a data table (behind a disclosure) and describes
 * only what is in the database. Where there is no data, the chart says so
 * instead of drawing a decorative shape.
 */
import * as React from 'react';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import type { ExamScope, SubjectCode } from '@/lib/types';
import { SUBJECT_LABELS } from '@/lib/constants';
import { useDerivedIndex, useSnapshot } from '@/lib/store/tracker-store';
import {
  activityByDay,
  minutesBySubject,
  chapterRows,
  dailyAccuracy,
  mistakePatterns,
  overallFor,
  practiceGaps,
  questionOverview,
  sessionModeBreakdown,
  studyTimeSummary,
  strongTopics,
  weakTopics,
} from '@/lib/calculations/analytics';
import { revisionConsistency, revisionLadder } from '@/lib/calculations/revision';
import { marksLostBySubject, testTrendPoints } from '@/lib/calculations/tests';
import { formatDate, formatMinutes, todayISO, weekdayShort } from '@/lib/date';
import { Badge, Card, CardContent, EmptyState, ProgressBar, Segmented, Stat, TableWrap, Td, Th } from '@/components/ui/primitives';
import { AreaSeries, BarSeries, ChartFrame, DonutChart, Heatmap, HorizontalBars, LineSeries, CHART_PALETTE } from '@/components/ui/charts';
import { StatusDistribution } from '@/components/ui/status';
import { useExamScope } from '@/lib/hooks/use-exam-scope';

type Tab = 'overview' | 'subjects' | 'chapters' | 'time' | 'questions' | 'revision' | 'tests' | 'mistakes' | 'lectures';

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'subjects', label: 'Subjects' },
  { value: 'chapters', label: 'Chapters' },
  { value: 'time', label: 'Time' },
  { value: 'questions', label: 'Questions' },
  { value: 'revision', label: 'Revision' },
  { value: 'tests', label: 'Tests' },
  { value: 'mistakes', label: 'Mistakes' },
  { value: 'lectures', label: 'Lectures' },
];

const SUBJECT_TONE: Record<SubjectCode, 'phy' | 'chem' | 'math'> = { phy: 'phy', chem: 'chem', math: 'math' };
const SUBJECT_COLOR: Record<SubjectCode, string> = { phy: CHART_PALETTE.phy, chem: CHART_PALETTE.chem, math: CHART_PALETTE.math };

export function AnalyticsScreen(): React.JSX.Element {
  const snapshot = useSnapshot();
  const index = useDerivedIndex();
  const [exam, setExam] = useExamScope('jm');
  const [tab, setTab] = React.useState<Tab>('overview');

  const overall = React.useMemo(() => overallFor(snapshot), [snapshot]);
  const activity = React.useMemo(() => activityByDay(index, 91, todayISO()), [index]);
  const chapters = React.useMemo(() => chapterRows(index, exam), [index, exam]);

  const empty =
    snapshot.sessions.length === 0 &&
    snapshot.questions.length === 0 &&
    snapshot.tests.length === 0 &&
    snapshot.revisions.length === 0 &&
    Object.keys(snapshot.progress).length === 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
            <BarChart3 aria-hidden className="size-5 text-ink-subtle" />
            Analytics
          </h1>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            {empty
              ? 'Nothing recorded yet - charts appear as soon as you log work.'
              : `${formatMinutes(overall.studyTime.total)} studied in total · ${overall.questions.attempted} questions attempted · ${overall.tests.count} tests`}
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

      <div className="scroll-x">
        <Segmented<Tab> ariaLabel="Analytics view" value={tab} onChange={setTab} options={TABS} />
      </div>

      {empty ? (
        <EmptyState
          icon={<BarChart3 />}
          title="No data to analyse yet"
          description="Log a study session, a question set or a test. Every chart on this screen is computed from your own records, so it stays empty until there is something real to show."
          action={
            <Link href="/syllabus" className="inline-flex h-8 items-center rounded-[10px] bg-brand px-2.5 text-[13px] font-medium text-brand-ink">
              Start in the syllabus
            </Link>
          }
        />
      ) : null}

      {tab === 'overview' ? (
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Stat label="Syllabus complete" value={`${overall.jm.completed}/${overall.jm.leaves}`} hint={`JEE Main · mastery ${overall.jm.mastery}%`} />
            <Stat label="Advanced complete" value={`${overall.ja.completed}/${overall.ja.leaves}`} hint={`JEE Advanced · mastery ${overall.ja.mastery}%`} />
            <Stat label="Streak" value={`${overall.streak.current} days`} hint={`Best ${overall.streak.best} · ${overall.streak.activeDays} active days`} tone={overall.streak.current > 0 ? 'success' : 'default'} />
            <Stat
              label="Revision on time"
              value={`${overall.revisionConsistency.rate}%`}
              hint={`${overall.revisionConsistency.completed}/${overall.revisionConsistency.scheduled} in the last 28 days`}
            />
          </section>

          <div className="grid gap-4 xl:grid-cols-2">
            <ChartFrame
              title="Study activity (13 weeks)"
              description="Each square is a day; darker means more tracked actions that day."
            >
              <Heatmap days={activity} />
            </ChartFrame>
            <ChartFrame
              title="Study minutes per day"
              description="Last 30 days of logged study time."
              table={{
                headers: ['Date', 'Minutes'],
                rows: activity.slice(-30).map((day) => [day.date, Math.round(day.minutes)]),
              }}
            >
              <AreaSeries
                points={activity.slice(-30).map((day) => ({ label: formatDate(day.date, 'short'), value: Math.round(day.minutes) }))}
                unit=" min"
                height={200}
              />
            </ChartFrame>
          </div>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-[15px] font-semibold">Subject completion</h2>
              <ul className="space-y-3">
                {overall.subjects.map((subject) => (
                  <li key={subject.code}>
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[12.5px]">
                      <span className="font-medium">{subject.name}</span>
                      <span className="tabular text-ink-muted">
                        {subject.completed}/{subject.leaves} subtopics · {subject.jm.pct}% Main · {subject.ja.pct}% Advanced ·{' '}
                        {subject.questions.attempted ? `${subject.questions.accuracy}% accuracy` : 'no questions logged'}
                      </span>
                    </div>
                    <ProgressBar className="mt-1" value={subject.pct} tone={SUBJECT_TONE[subject.code as SubjectCode]} label={`${subject.name} completion`} />
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'subjects' ? (
        <div className="space-y-4">
          <ChartFrame
            title="Time by subject"
            description="All logged study time, split by subject."
            table={{
              headers: ['Subject', 'Minutes'],
              rows: overall.subjects.map((subject) => [subject.name, Math.round(subject.timeMin)]),
            }}
          >
            <DonutChart
              slices={overall.subjects
                .filter((subject) => subject.timeMin > 0)
                .map((subject) => ({ label: subject.name, value: Math.round(subject.timeMin), color: SUBJECT_COLOR[subject.code as SubjectCode] }))}
              centerLabel={formatMinutes(overall.subjects.reduce((total, subject) => total + subject.timeMin, 0))}
            />
          </ChartFrame>

          <Card>
            <CardContent>
              <h2 className="mb-3 text-[15px] font-semibold">Subject detail</h2>
              <TableWrap>
                <caption className="sr-only">Progress, mastery and accuracy by subject</caption>
                <thead>
                  <tr>
                    <Th>Subject</Th>
                    <Th className="text-right">Complete</Th>
                    <Th className="text-right">Mastery</Th>
                    <Th className="text-right">Weak</Th>
                    <Th className="text-right">Accuracy</Th>
                    <Th className="text-right">Time</Th>
                    <Th>Status mix</Th>
                  </tr>
                </thead>
                <tbody>
                  {overall.subjects.map((subject) => (
                    <tr key={subject.code}>
                      <Td>
                        <Link href={`/subject/${subject.code}`} className="font-medium hover:underline">
                          {subject.name}
                        </Link>
                      </Td>
                      <Td className="text-right tabular">
                        {subject.completed}/{subject.leaves} ({subject.pct}%)
                      </Td>
                      <Td className="text-right tabular">{subject.mastery}%</Td>
                      <Td className="text-right tabular">{subject.weak}</Td>
                      <Td className="text-right tabular">{subject.questions.attempted ? `${subject.questions.accuracy}%` : '-'}</Td>
                      <Td className="text-right tabular">{formatMinutes(subject.timeMin)}</Td>
                      <Td>
                        <StatusDistribution
                          parts={[
                            { status: 'completed', count: subject.completed },
                            { status: 'learning', count: subject.learning },
                            { status: 'weak', count: subject.weak },
                            { status: 'not_started', count: subject.notStarted },
                          ]}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </CardContent>
          </Card>

          <div className="grid gap-4 xl:grid-cols-2">
            <TopicList title="Weakest topics" rows={weakTopics(index, { exam, limit: 8 })} exam={exam} />
            <TopicList title="Strongest topics" rows={strongTopics(index, { exam, limit: 8 })} exam={exam} tone="success" />
          </div>
        </div>
      ) : null}

      {tab === 'chapters' ? (
        <Card>
          <CardContent>
            <h2 className="mb-3 text-[15px] font-semibold">
              Chapter progress - {exam === 'jm' ? 'JEE Main' : 'JEE Advanced'}
            </h2>
            <TableWrap>
              <caption className="sr-only">Chapter level progress</caption>
              <thead>
                <tr>
                  <Th>Chapter</Th>
                  <Th>Subject</Th>
                  <Th className="text-right">Complete</Th>
                  <Th className="text-right">Mastery</Th>
                  <Th className="text-right">Weak</Th>
                  <Th className="text-right">Due</Th>
                  <Th className="text-right">Questions</Th>
                  <Th className="text-right">Mistakes</Th>
                  <Th className="text-right">Time</Th>
                </tr>
              </thead>
              <tbody>
                {chapters.map((row) => (
                  <tr key={row.id}>
                    <Td>
                      <Link href={`/chapter/${row.id}?exam=${exam}`} className="font-medium hover:underline">
                        {row.name}
                      </Link>
                      {row.unit ? <span className="block text-[11px] text-ink-subtle">{row.unit}</span> : null}
                    </Td>
                    <Td>
                      <Badge tone={SUBJECT_TONE[row.subject]}>{SUBJECT_LABELS[row.subject]}</Badge>
                    </Td>
                    <Td className="text-right tabular">
                      {row.completed}/{row.leaves} ({row.pct}%)
                    </Td>
                    <Td className="text-right tabular">{row.mastery}%</Td>
                    <Td className="text-right tabular">{row.weak}</Td>
                    <Td className="text-right tabular">{row.revisionDue}</Td>
                    <Td className="text-right tabular">{row.questions.attempted ? `${row.questions.attempted} @ ${row.questions.accuracy}%` : '-'}</Td>
                    <Td className="text-right tabular">{row.mistakes}</Td>
                    <Td className="text-right tabular">{formatMinutes(row.timeMin)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          </CardContent>
        </Card>
      ) : null}

      {tab === 'time' ? <TimeTab /> : null}
      {tab === 'questions' ? <QuestionsTab exam={exam} /> : null}

      {tab === 'revision' ? (
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Stat label="Completed (28 d)" value={overall.revisionConsistency.completed} hint={`${overall.revisionConsistency.completedLate} were late`} />
            <Stat label="On-time rate" value={`${overall.revisionConsistency.rate}%`} tone={overall.revisionConsistency.rate >= 75 ? 'success' : 'warn'} hint={`Average delay ${overall.revisionConsistency.averageDelayDays} days`} />
            <Stat
              label="Open now"
              value={overall.revision.dueToday.length + overall.revision.overdue.length}
              hint={`${overall.revision.dueToday.length} due today · ${overall.revision.overdue.length} overdue · ${overall.revision.upcoming.length} upcoming`}
            />
            <Stat label="Scheduled" value={overall.revision.total} hint="All revisions on record" />
          </section>

          <Card>
            <CardContent className="space-y-3">
              <h2 className="text-[15px] font-semibold">Revision ladder</h2>
              <ul className="space-y-3">
                {revisionLadder(index, exam).map((step) => (
                  <li key={step.index}>
                    <div className="flex items-center justify-between text-[12.5px]">
                      <span className="font-medium">Revision {step.index}</span>
                      <span className="tabular text-ink-muted">
                        {step.completed} done · {step.open} open{step.overdue ? ` · ${step.overdue} overdue` : ''}
                      </span>
                    </div>
                    <ProgressBar
                      className="mt-1"
                      value={step.completed + step.open ? (step.completed / (step.completed + step.open)) * 100 : 0}
                      tone={step.overdue ? 'warn' : 'brand'}
                      label={`Revision ${step.index} completion`}
                    />
                  </li>
                ))}
              </ul>
              <p className="text-[11.5px] text-ink-subtle">
                On-time rate uses a 28-day window: {revisionConsistency(index, 28).scheduled} revisions were scheduled and{' '}
                {revisionConsistency(index, 28).completed} completed.
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {tab === 'tests' ? (
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Stat label="Tests" value={overall.tests.count} hint={exam === 'jm' ? 'JEE Main papers' : 'JEE Advanced papers'} />
            <Stat label="Average" value={overall.tests.count ? `${overall.tests.averagePct}%` : '-'} hint={overall.tests.bestTest ? `Best ${overall.tests.bestTest.pct}%` : 'No tests'} />
            <Stat label="Accuracy" value={overall.tests.accuracy ? `${overall.tests.accuracy}%` : '-'} hint={`${overall.tests.attempts.correct} correct of ${overall.tests.attempts.attempted} attempted`} />
            <Stat label="Blanks" value={overall.tests.attempts.unattempted} hint="Questions left unattempted across all tests" />
          </section>

          <ChartFrame
            title="Score trend"
            description="Every recorded test in this scope, oldest to newest."
            table={{ headers: ['Test', 'Score %', 'Accuracy %'], rows: testTrendPoints(index, exam).map((point) => [point.name, point.pct, point.accuracy]) }}
          >
            <BarSeries points={testTrendPoints(index, exam).map((point) => ({ label: point.date.slice(5), value: point.pct }))} unit="%" yDomain={[0, 100]} />
          </ChartFrame>

          <ChartFrame
            title="Marks lost by subject"
            description="Wrong answers converted to marks, summed across tests in this scope."
          >
            <HorizontalBars
              rows={marksLostBySubject(index, exam).map((row) => ({ label: row.label, value: row.lost, valueText: `${row.lost} marks`, color: CHART_PALETTE.danger }))}
            />
          </ChartFrame>
        </div>
      ) : null}

      {tab === 'mistakes' ? (
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Stat label="Total" value={overall.mistakes.total} hint={`${overall.mistakes.open} still open`} />
            <Stat label="Revised this week" value={overall.mistakes.revisedThisWeek} tone={overall.mistakes.revisedThisWeek ? 'success' : 'default'} hint="Mistakes touched in the last 7 days" />
            <Stat label="Repeated topics" value={overall.mistakes.repeatedTopics.length} tone={overall.mistakes.repeatedTopics.length ? 'warn' : 'default'} hint="Topics with more than one logged mistake" />
            <Stat label="Most common type" value={String(overall.mistakes.byType[0]?.type ?? '-')} hint={overall.mistakes.byType[0] ? `${overall.mistakes.byType[0].count} logged` : 'No mistakes yet'} />
          </section>

          <ChartFrame title="Failure modes" description="Mistakes by type - the pattern tells you what to fix first.">
            <HorizontalBars
              rows={overall.mistakes.byType.slice(0, 8).map((row) => ({ label: String(row.type), value: row.count, valueText: `${row.count}`, color: CHART_PALETTE.warn }))}
            />
          </ChartFrame>

          <Card>
            <CardContent className="space-y-2">
              <h2 className="text-[15px] font-semibold">Repeated topics</h2>
              {mistakePatterns(index).repeatedTopics.length === 0 ? (
                <p className="text-[12.5px] text-ink-muted">No topic has more than one mistake.</p>
              ) : (
                <ul className="space-y-2">
                  {mistakePatterns(index).repeatedTopics.map((row) => (
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
        </div>
      ) : null}

      {tab === 'lectures' ? (
        <div className="space-y-4">
          <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            <Stat label="Lectures" value={overall.lectures.total} hint={`${overall.lectures.completed} complete · ${overall.lectures.inProgress} in progress`} />
            <Stat label="Watch progress" value={`${Math.round((overall.lectures.watchedMin / 60) * 10) / 10}h`} hint={`of ${Math.round((overall.lectures.durationMin / 60) * 10) / 10}h planned`} />
            <Stat label="Not started" value={overall.lectures.notStarted} tone={overall.lectures.notStarted ? 'warn' : 'default'} hint="Lectures with no watch time" />
            <Stat
              label="Completion"
              value={overall.lectures.total ? `${Math.round((overall.lectures.completed / overall.lectures.total) * 100)}%` : '-'}
              hint="Completed lectures over the library"
            />
          </section>

          <ChartFrame title="Lecture hours by subject" description="Watched against planned hours.">
            <HorizontalBars
              rows={overall.lectures.bySubject.map((row) => ({
                label: row.label,
                value: Math.round((row.durationMin - row.watchedMin) / 60),
                valueText: `${Math.round(row.watchedMin / 60)}h / ${Math.round(row.durationMin / 60)}h`,
                color: row.code === 'phy' ? CHART_PALETTE.phy : row.code === 'chem' ? CHART_PALETTE.chem : CHART_PALETTE.math,
              }))}
            />
          </ChartFrame>
        </div>
      ) : null}
    </div>
  );
}

function TimeTab(): React.JSX.Element {
  const index = useDerivedIndex();
  const snapshot = useSnapshot();
  const activity = React.useMemo(() => activityByDay(index, 60, todayISO()), [index]);
  const time = React.useMemo(() => studyTimeSummary(index), [index]);
  const modes = React.useMemo(() => sessionModeBreakdown(index, 30), [index]);
  const bySubject = React.useMemo(() => minutesBySubject(index, 30), [index]);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Today" value={formatMinutes(time.today)} hint={snapshot.settings.profile.dailyTargetMin ? `Target ${formatMinutes(snapshot.settings.profile.dailyTargetMin)}` : 'No target set'} />
        <Stat label="This week" value={formatMinutes(time.week)} hint={`${formatMinutes(time.month)} this month`} />
        <Stat label="Daily average" value={formatMinutes(time.dailyAverage)} hint="Across active days only" />
        <Stat label="Best day" value={formatMinutes(time.bestDayMin)} hint={time.bestDayDate ? formatDate(time.bestDayDate, 'long') : 'No sessions yet'} />
      </section>

      <ChartFrame
        title="Daily study minutes"
        description="Last 60 days."
        table={{ headers: ['Date', 'Minutes', 'Actions'], rows: activity.map((day) => [day.date, Math.round(day.minutes), day.activities]) }}
      >
        <AreaSeries points={activity.map((day) => ({ label: formatDate(day.date, 'short'), value: Math.round(day.minutes) }))} unit=" min" height={220} />
      </ChartFrame>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartFrame title="Minutes by subject (30 days)" description="Where your hours actually went.">
          <DonutChart
            slices={(['phy', 'chem', 'math'] as SubjectCode[])
              .map((code) => ({ label: SUBJECT_LABELS[code], value: Math.round(bySubject[code] ?? 0), color: SUBJECT_COLOR[code] }))
              .filter((slice) => slice.value > 0)}
            centerLabel={formatMinutes((bySubject.phy ?? 0) + (bySubject.chem ?? 0) + (bySubject.math ?? 0))}
          />
        </ChartFrame>

        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-[15px] font-semibold">How the time was spent (30 days)</h2>
            {modes.length === 0 ? (
              <p className="text-[12.5px] text-ink-muted">No sessions in the last 30 days.</p>
            ) : (
              <HorizontalBars
                rows={modes.map((row) => ({
                  label: row.mode,
                  value: row.minutes,
                  valueText: formatMinutes(row.minutes),
                  color: row.mode === 'Revision' ? CHART_PALETTE.warn : CHART_PALETTE.accent,
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="space-y-2">
          <h2 className="text-[15px] font-semibold">Sessions per weekday (last 12 weeks)</h2>
          <WeekdayProfile />
        </CardContent>
      </Card>
    </div>
  );
}

function WeekdayProfile(): React.JSX.Element {
  const index = useDerivedIndex();
  const days = React.useMemo(() => activityByDay(index, 84, todayISO()), [index]);
  const totals = React.useMemo(() => {
    const buckets = new Map<string, number>();
    for (const day of days) {
      const key = weekdayShort(day.date);
      buckets.set(key, (buckets.get(key) ?? 0) + day.minutes);
    }
    return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label) => ({ label, value: Math.round(buckets.get(label) ?? 0) }));
  }, [days]);

  return (
    <BarSeries
      points={totals}
      unit=" min"
      height={190}
    />
  );
}

function QuestionsTab({ exam }: { exam: ExamScope }): React.JSX.Element {
  const index = useDerivedIndex();
  const overview = React.useMemo(() => questionOverview(index, { exam, days: 0 }), [index, exam]);
  const trend = React.useMemo(() => dailyAccuracy(index, 30), [index]);
  const gaps = React.useMemo(() => practiceGaps(index, exam, 8), [index, exam]);

  return (
    <div className="space-y-4">
      <section className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Attempted" value={overview.attempted} hint={`${overview.logs} logs`} />
        <Stat label="Accuracy" value={overview.attempted ? `${overview.accuracy}%` : '-'} tone={overview.accuracy >= 60 ? 'success' : 'warn'} hint={`${overview.correct} correct · ${overview.wrong} wrong`} />
        <Stat label="Minutes per question" value={overview.attempted ? `${overview.minutesPerQuestion}` : '-'} hint={`${formatMinutes(overview.timeMin)} logged`} />
        <Stat label="Blank" value={overview.unattempted} hint="Questions left unattempted" />
      </section>

      <ChartFrame
        title="Daily accuracy"
        description="Accuracy per day over the last 30 days; days with no logs are skipped."
        table={{ headers: ['Date', 'Accuracy %', 'Attempted'], rows: trend.map((point) => [point.date, point.accuracy, point.attempted]) }}
      >
        <LineSeries points={trend.map((point) => ({ label: formatDate(point.date, 'short'), value: point.accuracy }))} unit="%" yDomain={[0, 100]} height={210} />
      </ChartFrame>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardContent className="space-y-3">
            <h2 className="text-[15px] font-semibold">Accuracy by subject</h2>
            <HorizontalBars
              rows={overview.bySubject.map((row) => ({
                label: row.label,
                value: row.accuracy,
                valueText: `${row.accuracy}% · ${row.attempted} q`,
                color: SUBJECT_COLOR[row.code],
              }))}
            />
          </CardContent>
        </Card>
        <TopicList title="Insufficient practice" rows={gaps} exam={exam} tone="warn" />
      </div>
    </div>
  );
}

function TopicList({
  title,
  rows,
  exam,
  tone = 'warn',
}: {
  title: string;
  rows: { id: string; name: string; chapter: string; subject: SubjectCode; mastered?: number; mastery: number; accuracy: number; attempted: number; reason: string; exam: ExamScope }[];
  exam: ExamScope;
  tone?: 'warn' | 'success';
}): React.JSX.Element {
  return (
    <Card>
      <CardContent className="space-y-2">
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {rows.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted">
            {tone === 'success' ? 'No topic has enough evidence to be called strong yet.' : 'Nothing flagged in this scope.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={`${row.id}-${row.exam}`} className="rounded-[10px] border border-line p-2.5">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/topic/${row.id}?exam=${row.exam}`} className="min-w-0 truncate text-[13px] font-medium hover:underline">
                    {row.name}
                  </Link>
                  <Badge tone={tone === 'success' ? 'success' : row.mastery < 45 ? 'danger' : 'warn'}>{row.mastery}% mastery</Badge>
                </div>
                <p className="mt-0.5 text-[11.5px] text-ink-muted">
                  {row.chapter} · {SUBJECT_LABELS[row.subject]}
                  {row.attempted ? ` · ${row.attempted} q @ ${row.accuracy}%` : ' · no questions logged'}
                </p>
                <p className="mt-1 text-[11.5px] text-ink-muted">{row.reason}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="text-[11.5px] text-ink-subtle">
          Scope: {exam === 'jm' ? 'JEE Main' : 'JEE Advanced'}.
        </p>
      </CardContent>
    </Card>
  );
}
