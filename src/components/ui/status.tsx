'use client';

/**
 * Status vocabulary used across the tracker.
 *
 * One place decides what "weak" or "partial" looks like, so the syllabus tree,
 * the planner, the mistake book and the analytics screens can never disagree.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { DIMENSION_LABELS, STUDY_STATUS_LABELS } from '@/lib/constants';
import type { Confidence, DimensionKey, DimensionStatus, StudyDifficulty, StudyStatus } from '@/lib/types';
import { Badge } from '@/components/ui/primitives';

type Tone = 'neutral' | 'warn' | 'danger' | 'success' | 'brand';

export function statusTone(status: StudyStatus): Tone {
  switch (status) {
    case 'completed':
      return 'success';
    case 'learning':
      return 'brand';
    case 'weak':
      return 'danger';
    case 'revision_due':
      return 'warn';
    default:
      return 'neutral';
  }
}

export function StatusBadge({ status, className }: { status: StudyStatus; className?: string }): React.JSX.Element {
  return (
    <Badge tone={statusTone(status)} className={className}>
      {STUDY_STATUS_LABELS[status]}
    </Badge>
  );
}

export function StatusDot({ status, className }: { status: StudyStatus; className?: string }): React.JSX.Element {
  return (
    <span
      aria-hidden
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        status === 'completed' && 'bg-success',
        status === 'learning' && 'bg-info',
        status === 'weak' && 'bg-danger',
        status === 'revision_due' && 'bg-warn',
        status === 'not_started' && 'bg-line-strong',
        className,
      )}
    />
  );
}

const DIMENSION_TONE: Record<DimensionStatus, { className: string; label: string }> = {
  done: { className: 'border-transparent bg-success/15 text-success', label: 'Done' },
  partial: { className: 'border-transparent bg-warn/15 text-warn', label: 'Partial' },
  none: { className: 'border-line bg-surface-2 text-ink-subtle', label: 'Not started' },
};

export function dimensionLabel(key: DimensionKey): string {
  return DIMENSION_LABELS[key];
}

export function DimensionChip({ dimension, status }: { dimension: DimensionKey; status: DimensionStatus }): React.JSX.Element {
  const tone = DIMENSION_TONE[status];
  return (
    <span
      title={`${DIMENSION_LABELS[dimension]}: ${tone.label}`}
      className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', tone.className)}
    >
      <span className="font-semibold">{DIMENSION_LABELS[dimension]}</span>
      <span className="opacity-80">{status === 'done' ? '✓' : status === 'partial' ? '~' : '·'}</span>
    </span>
  );
}

export function DimensionRow({ labels, statuses }: { labels: DimensionKey[]; statuses: Record<DimensionKey, DimensionStatus> }): React.JSX.Element {
  return (
    <div className="flex flex-wrap gap-1">
      {labels.map((key) => (
        <DimensionChip key={key} dimension={key} status={statuses[key]} />
      ))}
    </div>
  );
}

export function ConfidenceDots({
  value,
  onChange,
  label = 'Confidence',
}: {
  value: Confidence | null;
  onChange?(next: Confidence): void;
  label?: string;
}): React.JSX.Element {
  const interactive = Boolean(onChange);
  return (
    <span className="inline-flex items-center gap-1" role={interactive ? 'radiogroup' : undefined} aria-label={label}>
      {[1, 2, 3, 4, 5].map((level) => {
        const filled = value !== null && level <= value;
        const dot = (
          <span
            aria-hidden
            className={cn('block size-2.5 rounded-full border', filled ? 'border-brand bg-brand' : 'border-line-strong bg-transparent')}
          />
        );
        return interactive ? (
          <button
            key={level}
            type="button"
            role="radio"
            aria-checked={value === level}
            aria-label={`${label} ${level} of 5`}
            onClick={() => onChange?.(level as Confidence)}
            className="rounded-full p-0.5 hover:bg-surface-2"
          >
            {dot}
          </button>
        ) : (
          <span key={level}>{dot}</span>
        );
      })}
    </span>
  );
}

export function DifficultyBadge({ difficulty }: { difficulty: StudyDifficulty | null }): React.JSX.Element {
  if (!difficulty) return <span className="text-[11.5px] text-ink-subtle">-</span>;
  const tone = difficulty === 'hard' ? 'danger' : difficulty === 'moderate' ? 'warn' : 'success';
  return <Badge tone={tone}>{difficulty}</Badge>;
}

/** Small inline distribution bar used for status mixes in analytics tables. */
export function StatusDistribution({
  parts,
}: {
  parts: { status: StudyStatus; count: number }[];
}): React.JSX.Element | null {
  const total = parts.reduce((sum, part) => sum + part.count, 0);
  if (!total) return null;
  return (
    <span className="flex h-1.5 w-full min-w-16 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={parts.map((part) => `${STUDY_STATUS_LABELS[part.status]} ${part.count}`).join(', ')}>
      {parts.map((part) => (
        <span
          key={part.status}
          style={{ width: `${(part.count / total) * 100}%` }}
          className={cn(
            part.status === 'completed' && 'bg-success',
            part.status === 'learning' && 'bg-info',
            part.status === 'weak' && 'bg-danger',
            part.status === 'revision_due' && 'bg-warn',
            part.status === 'not_started' && 'bg-line-strong',
          )}
        />
      ))}
    </span>
  );
}
