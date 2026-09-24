'use client';

/**
 * Chart components.
 *
 * Every chart is responsive, theme-aware (colours come from CSS custom
 * properties so dark mode works without re-rendering), and ships an accessible
 * alternative: the same numbers are available in a data table behind a
 * disclosure, which screen readers and keyboard users can reach.
 */
import * as React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartColumn, Table2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/primitives';

const AXIS_PROPS = {
  stroke: 'var(--c-ink-subtle)',
  tick: { fill: 'var(--c-ink-muted)', fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

const GRID_PROPS = { stroke: 'var(--c-line)', strokeDasharray: '3 3', vertical: false } as const;

export interface ChartFrameProps {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  /** Numeric fallback table rendered behind an accessible disclosure. */
  table?: { headers: string[]; rows: (string | number)[][] };
  className?: string;
  height?: number;
}

export function ChartFrame({ title, description, action, children, table, className, height = 220 }: ChartFrameProps): React.JSX.Element {
  return (
    <section
      className={cn('rounded-[var(--radius-card)] border border-line bg-surface p-4 shadow-card', className)}
      aria-label={title}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 text-[14px] font-semibold leading-tight">
            <ChartColumn aria-hidden className="size-4 text-ink-subtle" />
            {title}
          </h3>
          {description ? <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">{description}</p> : null}
        </div>
        {action}
      </div>
      <div className="mt-3" style={{ minHeight: height }}>
        {children}
      </div>
      {table ? (
        <details className="mt-3 group">
          <summary className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-medium text-ink-muted hover:text-ink">
            <Table2 aria-hidden className="size-3.5" />
            View data table
          </summary>
          <div className="scroll-x mt-2">
            <table className="w-full min-w-[320px] border-collapse text-[12.5px]">
              <thead>
                <tr>
                  {table.headers.map((header) => (
                    <th key={header} scope="col" className="border-b border-line px-2 py-1.5 text-left font-semibold text-ink-subtle">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, index) => (
                  <tr key={index}>
                    {row.map((cell, cellIndex) => (
                      <td key={cellIndex} className="border-b border-line/60 px-2 py-1.5 tabular">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}

export interface SeriesPoint {
  label: string;
  value: number;
  secondary?: number;
}

function hasData(points: SeriesPoint[]): boolean {
  return points.some((point) => point.value !== 0 || (point.secondary ?? 0) !== 0);
}

export function BarSeries({
  points,
  color = 'var(--chart-accent)',
  secondaryColor = 'var(--chart-phy)',
  height = 200,
  unit = '',
  yDomain,
}: {
  points: SeriesPoint[];
  color?: string;
  secondaryColor?: string;
  height?: number;
  unit?: string;
  yDomain?: [number, number];
}): React.JSX.Element {
  if (!points.length) return <EmptyState title="No data yet" description="Log activity and this chart fills in." />;
  const dual = points.some((point) => point.secondary !== undefined);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={points} margin={{ top: 4, right: 6, bottom: 0, left: -18 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" />
        <YAxis {...AXIS_PROPS} width={42} domain={yDomain} />
        <Tooltip
          formatter={(value, name) => [`${Math.round(Number(value))}${unit}`, name === 'secondary' ? 'Completed' : 'Total']}
          labelStyle={{ color: 'var(--c-ink)', fontWeight: 600 }}
        />
        <Bar dataKey="value" name="value" fill={color} radius={[3, 3, 0, 0]} maxBarSize={34} />
        {dual ? <Bar dataKey="secondary" name="secondary" fill={secondaryColor} radius={[3, 3, 0, 0]} maxBarSize={34} /> : null}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LineSeries({
  points,
  color = 'var(--chart-accent)',
  height = 200,
  unit = '',
  yDomain,
  secondaryLabel,
}: {
  points: SeriesPoint[];
  color?: string;
  height?: number;
  unit?: string;
  yDomain?: [number, number];
  secondaryLabel?: string;
}): React.JSX.Element {
  if (!points.length || !hasData(points)) {
    return <EmptyState title="No data yet" description="This trend appears once you have logged a few entries." />;
  }
  const dual = points.some((point) => point.secondary !== undefined);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...AXIS_PROPS} width={42} domain={yDomain} />
        <Tooltip
          formatter={(value, name) => [
            `${Math.round(Number(value))}${unit}`,
            name === 'secondary' ? (secondaryLabel ?? 'Secondary') : 'Value',
          ]}
        />
        <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2.2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
        {dual ? (
          <Line
            type="monotone"
            dataKey="secondary"
            stroke="var(--chart-phy)"
            strokeWidth={1.8}
            strokeDasharray="4 3"
            dot={false}
          />
        ) : null}
      </LineChart>
    </ResponsiveContainer>
  );
}

export function AreaSeries({
  points,
  color = 'var(--chart-accent)',
  height = 200,
  unit = '',
}: {
  points: SeriesPoint[];
  color?: string;
  height?: number;
  unit?: string;
}): React.JSX.Element {
  if (!points.length || !hasData(points)) {
    return <EmptyState title="No data yet" description="Start logging study time to see this trend." />;
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 4, right: 8, bottom: 0, left: -18 }}>
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...GRID_PROPS} />
        <XAxis dataKey="label" {...AXIS_PROPS} interval="preserveStartEnd" minTickGap={16} />
        <YAxis {...AXIS_PROPS} width={42} />
        <Tooltip formatter={(value) => [`${Math.round(Number(value))}${unit}`, 'Logged']} />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill="url(#area-fill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({
  slices,
  height = 210,
  centerLabel,
}: {
  slices: DonutSlice[];
  height?: number;
  centerLabel?: string;
}): React.JSX.Element {
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);
  if (!total) return <EmptyState title="No data yet" description="Nothing logged in this period." />;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={slices} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="84%" paddingAngle={2} stroke="none">
          {slices.map((slice) => (
            <Cell key={slice.label} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value, name) => [`${Math.round(Number(value))}`, String(name)]} />
        <Legend
          verticalAlign="bottom"
          height={28}
          formatter={(value: string) => {
            const slice = slices.find((entry) => entry.label === value);
            const pct = slice ? Math.round((slice.value / total) * 100) : 0;
            return `${value} · ${pct}%`;
          }}
        />
        {centerLabel ? (
          <text x="50%" y="46%" textAnchor="middle" className="fill-[var(--c-ink)] text-[13px] font-semibold">
            {centerLabel}
          </text>
        ) : null}
      </PieChart>
    </ResponsiveContainer>
  );
}

/** Progress-style horizontal bars, the workhorse for "progress per X" lists. */
export function HorizontalBars({
  rows,
  className,
}: {
  rows: { label: string; value: number; valueText?: string; color?: string; hint?: string }[];
  className?: string;
}): React.JSX.Element {
  if (!rows.length) return <EmptyState title="Nothing to compare yet" />;
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <ul className={cn('space-y-2.5', className)}>
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate text-[13px] font-medium">{row.label}</span>
            <span className="shrink-0 text-[12.5px] font-semibold tabular text-ink-muted">{row.valueText ?? row.value}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
            <span
              className="block h-full rounded-full"
              style={{ width: `${Math.max(1, (row.value / max) * 100)}%`, background: row.color ?? 'var(--chart-accent)' }}
            />
          </div>
          {row.hint ? <p className="mt-0.5 text-[11.5px] text-ink-subtle">{row.hint}</p> : null}
        </li>
      ))}
    </ul>
  );
}

/** 12-week activity heatmap (CSS grid, not SVG: crisper on small screens). */
export function Heatmap({
  days,
  weeks = 13,
}: {
  days: { date: string; activities: number; minutes: number }[];
  weeks?: number;
}): React.JSX.Element {
  const levels = (activities: number) => (activities >= 4 ? 4 : activities >= 2.5 ? 3 : activities >= 1 ? 2 : activities > 0 ? 1 : 0);
  const background: Record<number, string> = {
    0: 'var(--c-surface-2)',
    1: 'color-mix(in oklab, var(--c-brand) 25%, transparent)',
    2: 'color-mix(in oklab, var(--c-brand) 45%, transparent)',
    3: 'color-mix(in oklab, var(--c-brand) 70%, transparent)',
    4: 'var(--c-brand)',
  };
  const visible = days.slice(-(weeks * 7));
  if (!visible.some((day) => day.activities > 0)) {
    return <EmptyState title="No activity recorded yet" description="Each square is one day of tracked work." />;
  }
  return (
    <div className="scroll-x">
      <div className="grid grid-flow-col grid-rows-7 gap-[3px]" role="img" aria-label={`Activity heatmap for the last ${weeks} weeks`}>
        {visible.map((day) => (
          <span
            key={day.date}
            title={`${day.date}: ${day.activities.toFixed(1)} tracked actions, ${Math.round(day.minutes)} min`}
            className="size-4 rounded-[3px] border border-line/50"
            style={{ background: background[levels(day.activities)] }}
          />
        ))}
      </div>
    </div>
  );
}

export const CHART_PALETTE = {
  phy: 'var(--chart-phy)',
  chem: 'var(--chart-chem)',
  math: 'var(--chart-math)',
  accent: 'var(--chart-accent)',
  warn: 'var(--chart-warn)',
  danger: 'var(--chart-danger)',
  muted: 'var(--chart-muted)',
};
