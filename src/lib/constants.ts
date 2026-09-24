/**
 * Shared vocabulary: labels, weights and colour tokens that the calculation
 * modules and the UI must agree on. Keeping them in one place means a change to
 * the scoring model can never silently drift between analytics and the UI.
 */
import type {
  DimensionKey,
  DimensionStatus,
  ExamScope,
  MistakeStatus,
  MistakeType,
  Priority,
  QuestionSource,
  SessionMode,
  StudyStatus,
  SubjectCode,
  TaskStatus,
  TaskType,
} from '@/lib/types';

export const APP_NAME = 'JEE Command Center';
export const SCHEMA_VERSION = 2;

export const DIMENSION_KEYS: readonly DimensionKey[] = ['theory', 'lecture', 'dpp', 'pyq', 'practice'];

export const DIMENSION_LABELS: Record<DimensionKey, string> = {
  theory: 'Theory',
  lecture: 'Lectures',
  dpp: 'DPP',
  pyq: 'PYQ',
  practice: 'Practice',
};

/** Coverage = weighted mean of the five dimensions (sums to 1). */
export const DIMENSION_WEIGHTS: Record<DimensionKey, number> = {
  theory: 0.22,
  lecture: 0.24,
  dpp: 0.2,
  pyq: 0.18,
  practice: 0.16,
};

export const DIMENSION_STATUS_LABELS: Record<DimensionStatus, string> = {
  none: 'Not done',
  partial: 'Partial',
  done: 'Done',
};

/** Up to 12% of coverage comes from completed spaced revisions. */
export const REVISION_WEIGHT = 0.12;
export const REVISION_TARGET_COUNT = 3;

export const STUDY_STATUSES: readonly StudyStatus[] = [
  'not_started',
  'learning',
  'completed',
  'weak',
  'revision_due',
];

export const STUDY_STATUS_LABELS: Record<StudyStatus, string> = {
  not_started: 'Not started',
  learning: 'Learning',
  completed: 'Completed',
  weak: 'Weak',
  revision_due: 'Revision due',
};

export const TASK_STATUSES: readonly TaskStatus[] = ['pending', 'in_progress', 'completed', 'skipped'];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  pending: 'Pending',
  in_progress: 'In progress',
  completed: 'Completed',
  skipped: 'Skipped',
};

export const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low'];

export const PRIORITY_LABELS: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

/** Sort order for the planner: high first. */
export const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export const TASK_TYPE_LIST: readonly TaskType[] = [
  'Lecture',
  'Theory',
  'Topic study',
  'DPP',
  'PYQ',
  'Practice',
  'Revision',
  'Mock test',
  'Mistake revision',
  'Custom',
];

export const SESSION_MODES: readonly SessionMode[] = [
  'Lecture',
  'Theory',
  'Practice',
  'DPP',
  'PYQ',
  'Revision',
  'Mock Test',
  'Other',
];

export const QUESTION_SOURCE_LIST: readonly QuestionSource[] = ['DPP', 'PYQ', 'Practice', 'Mock Test'];

export const MISTAKE_STATUS_LABELS: Record<MistakeStatus, string> = {
  open: 'Open',
  revised: 'Revised',
  mastered: 'Mastered',
};

export type MistakeTypeOrOther = MistakeType | 'Unspecified';

export const EXAM_LABELS: Record<ExamScope, { short: string; long: string }> = {
  jm: { short: 'JM', long: 'JEE Main' },
  ja: { short: 'JA', long: 'JEE Advanced' },
};

export const SUBJECT_LABELS: Record<SubjectCode, string> = {
  phy: 'Physics',
  chem: 'Chemistry',
  math: 'Mathematics',
};

export const SUBJECT_SHORT: Record<SubjectCode, string> = {
  phy: 'PHY',
  chem: 'CHEM',
  math: 'MATH',
};

/** Tailwind class fragments per subject (kept as static strings for the JIT). */
export const SUBJECT_STYLES: Record<
  SubjectCode,
  { text: string; bg: string; border: string; chart: string; radial: string }
> = {
  phy: {
    text: 'text-phy',
    bg: 'bg-phy/12',
    border: 'border-phy/35',
    chart: 'hsl(var(--chart-phy))',
    radial: 'text-phy',
  },
  chem: {
    text: 'text-chem',
    bg: 'bg-chem/12',
    border: 'border-chem/35',
    chart: 'hsl(var(--chart-chem))',
    radial: 'text-chem',
  },
  math: {
    text: 'text-math',
    bg: 'bg-math/12',
    border: 'border-math/35',
    chart: 'hsl(var(--chart-math))',
    radial: 'text-math',
  },
};

/** CSS colour values used by charts (recharts needs real colours, not classes). */
export const CHART_COLORS = {
  phy: 'var(--chart-phy)',
  chem: 'var(--chart-chem)',
  math: 'var(--chart-math)',
  accent: 'var(--chart-accent)',
  warn: 'var(--chart-warn)',
  danger: 'var(--chart-danger)',
  muted: 'var(--chart-muted)',
} as const;

export function subjectCodeFromName(name: string | null | undefined): SubjectCode | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  if (lower.startsWith('phy')) return 'phy';
  if (lower.startsWith('chem')) return 'chem';
  if (lower.startsWith('math')) return 'math';
  return null;
}

export const SUBJECT_NAME_TO_CODE: Record<'Physics' | 'Chemistry' | 'Mathematics', SubjectCode> = {
  Physics: 'phy',
  Chemistry: 'chem',
  Mathematics: 'math',
};
