'use client';

/**
 * shadcn/ui-style primitives.
 *
 * Written in the same spirit (cva variants + `cn` merging, data-slot attributes,
 * Radix where accessibility demands it) but only the pieces this app actually
 * needs - no dependency is added for a component that is not used.
 */
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ Button */

const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded-[10px] text-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand text-brand-ink hover:bg-brand-strong shadow-card',
        secondary: 'bg-surface-2 text-ink hover:bg-line border border-line',
        outline: 'border border-line-strong bg-transparent text-ink hover:bg-surface-2',
        ghost: 'text-ink-muted hover:bg-surface-2 hover:text-ink',
        danger: 'bg-danger text-white hover:opacity-90',
        link: 'text-brand underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-2.5 text-[13px]',
        md: 'h-9.5 px-3.5',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
      block: { true: 'w-full', false: '' },
    },
    defaultVariants: { variant: 'secondary', size: 'md', block: false },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, block, loading = false, disabled, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      data-slot="button"
      className={cn(buttonVariants({ variant, size, block }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }): React.JSX.Element {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn('inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent', className)}
    />
  );
}

/* -------------------------------------------------------------------- Card */

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return (
    <div
      data-slot="card"
      className={cn('rounded-[var(--radius-card)] border border-line bg-surface shadow-card', className)}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('flex flex-wrap items-start justify-between gap-3 p-4 pb-0', className)} {...props} />;
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>): React.JSX.Element {
  return <h3 className={cn('text-[15px] font-semibold leading-tight', className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>): React.JSX.Element {
  return <p className={cn('text-[13px] leading-snug text-ink-muted', className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>): React.JSX.Element {
  return <div className={cn('p-4', className)} {...props} />;
}

/* ------------------------------------------------------------------- Badge */

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-tight',
  {
    variants: {
      tone: {
        neutral: 'border-line bg-surface-2 text-ink-muted',
        brand: 'border-transparent bg-brand-soft text-brand',
        success: 'border-transparent bg-success/12 text-success',
        warn: 'border-transparent bg-warn/12 text-warn',
        danger: 'border-transparent bg-danger/12 text-danger',
        outline: 'border-line-strong bg-transparent text-ink-muted',
        phy: 'border-transparent bg-phy/12 text-phy',
        chem: 'border-transparent bg-chem/12 text-chem',
        math: 'border-transparent bg-math/12 text-math',
        jm: 'border-transparent bg-info/12 text-info',
        ja: 'border-transparent bg-danger/12 text-danger',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, tone, ...props }: BadgeProps): React.JSX.Element {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}

export function ExamBadge({ exam }: { exam: 'jm' | 'ja' | 'both' }): React.JSX.Element {
  if (exam === 'both') {
    return (
      <span className="inline-flex gap-0.5">
        <Badge tone="jm" title="In the JEE Main syllabus">
          JM
        </Badge>
        <Badge tone="ja" title="In the JEE Advanced syllabus">
          JA
        </Badge>
      </span>
    );
  }
  return (
    <Badge tone={exam} title={exam === 'jm' ? 'JEE Main syllabus' : 'JEE Advanced syllabus'}>
      {exam.toUpperCase()}
    </Badge>
  );
}

/* ------------------------------------------------------------------ Inputs */

export const inputClass =
  'flex h-9.5 w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-subtle focus-visible:border-brand focus-visible:outline-none disabled:opacity-50';

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} data-slot="input" className={cn(inputClass, className)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        data-slot="textarea"
        className={cn(inputClass, 'h-auto min-h-20 resize-y py-2 leading-relaxed', className)}
        {...props}
      />
    );
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="relative">
      <select
        ref={ref}
        data-slot="select"
        className={cn(inputClass, 'appearance-none pr-8', className)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-subtle" />
    </div>
  );
});

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>): React.JSX.Element {
  return <label className={cn('text-[12.5px] font-medium text-ink-muted', className)} {...props} />;
}

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: React.ReactNode;
  error?: string | null;
  className?: string;
  children: React.ReactNode;
}

export function Field({ label, htmlFor, hint, error, className, children }: FieldProps): React.JSX.Element {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error ? <p className="text-[11.5px] leading-snug text-ink-subtle">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-[11.5px] font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------- Switch */

export interface SwitchProps {
  checked: boolean;
  onCheckedChange(checked: boolean): void;
  label: string;
  description?: string;
  id?: string;
  disabled?: boolean;
}

/** Accessible switch built on a native checkbox so it works with keyboards + forms. */
export function Switch({ checked, onCheckedChange, label, description, id, disabled }: SwitchProps): React.JSX.Element {
  const inputId = id ?? `switch-${label.replace(/\s+/g, '-').toLowerCase()}`;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <label htmlFor={inputId} className="text-sm font-medium">
          {label}
        </label>
        {description ? <p className="text-[12px] text-ink-muted">{description}</p> : null}
      </div>
      <label className="relative inline-flex cursor-pointer items-center">
        <input
          id={inputId}
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onCheckedChange(event.target.checked)}
        />
        <span className="h-5.5 w-10 rounded-full bg-line-strong transition-colors peer-checked:bg-brand peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 size-4.5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4.5" />
      </label>
    </div>
  );
}

/* --------------------------------------------------------------- Segmented */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

export interface SegmentedProps<T extends string> {
  options: SegmentedOption<T>[];
  value: T;
  onChange(value: T): void;
  ariaLabel: string;
  size?: 'sm' | 'md';
  className?: string;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
  className,
}: SegmentedProps<T>): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn('inline-flex flex-wrap gap-1 rounded-[12px] border border-line bg-surface-2 p-1', className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[9px] font-medium transition-colors',
              size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-[13px]',
              active ? 'bg-surface text-ink shadow-card' : 'text-ink-muted hover:text-ink',
            )}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------------- Progress */

export interface ProgressBarProps {
  value: number;
  tone?: 'brand' | 'phy' | 'chem' | 'math' | 'success' | 'warn' | 'danger' | 'neutral';
  className?: string;
  label?: string;
}

const PROGRESS_TONE: Record<NonNullable<ProgressBarProps['tone']>, string> = {
  brand: 'bg-brand',
  phy: 'bg-phy',
  chem: 'bg-chem',
  math: 'bg-math',
  success: 'bg-success',
  warn: 'bg-warn',
  danger: 'bg-danger',
  neutral: 'bg-ink-muted',
};

export function ProgressBar({ value, tone = 'brand', className, label }: ProgressBarProps): React.JSX.Element {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-surface-2', className)}
    >
      <span className={cn('block h-full rounded-full transition-[width] duration-300', PROGRESS_TONE[tone])} style={{ width: `${clamped}%` }} />
    </div>
  );
}

/* --------------------------------------------------------------------- KPI */

export interface StatProps {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: 'default' | 'warn' | 'danger' | 'success';
  icon?: React.ReactNode;
  className?: string;
}

/** Information-dense metric tile used across the dashboard and analytics. */
export function Stat({ label, value, hint, tone = 'default', icon, className }: StatProps): React.JSX.Element {
  return (
    <div className={cn('rounded-[12px] border border-line bg-surface p-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-subtle">{label}</span>
        {icon ? <span className="text-ink-subtle [&_svg]:size-3.5">{icon}</span> : null}
      </div>
      <div
        className={cn(
          'mt-1 text-[19px] font-semibold leading-tight tabular',
          tone === 'warn' && 'text-warn',
          tone === 'danger' && 'text-danger',
          tone === 'success' && 'text-success',
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">{hint}</div> : null}
    </div>
  );
}

/* -------------------------------------------------------------- Empty state */

export interface EmptyStateProps {
  title: string;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({ title, description, icon, action, className }: EmptyStateProps): React.JSX.Element {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed border-line px-4 py-8 text-center', className)}>
      {icon ? <div className="text-ink-subtle [&_svg]:size-6">{icon}</div> : null}
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="max-w-md text-[12.5px] leading-relaxed text-ink-muted">{description}</p> : null}
      {action ? <div className="mt-1">{action}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- Skeleton */

export function Skeleton({ className }: { className?: string }): React.JSX.Element {
  return <div aria-hidden className={cn('animate-pulse rounded-md bg-surface-2', className)} />;
}

/* -------------------------------------------------------------------- Chips */

export function Chip({
  active,
  children,
  onClick,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }): React.JSX.Element {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[12px] font-medium transition-colors',
        active ? 'border-brand bg-brand-soft text-brand' : 'border-line bg-surface text-ink-muted hover:text-ink',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------- Checkbox row */

export function CheckButton({
  checked,
  onToggle,
  label,
  size = 'md',
}: {
  checked: boolean;
  onToggle(): void;
  label: string;
  size?: 'sm' | 'md';
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full border transition-colors',
        size === 'sm' ? 'size-5' : 'size-6',
        checked ? 'border-brand bg-brand text-brand-ink' : 'border-line-strong bg-surface hover:border-brand',
      )}
    >
      {checked ? <Check className="size-3.5" strokeWidth={3} /> : null}
    </button>
  );
}

/* ------------------------------------------------------------- Data table */

export function TableWrap({ children, className }: { children: React.ReactNode; className?: string }): React.JSX.Element {
  return (
    <div className={cn('scroll-x -mx-4 px-4 sm:mx-0 sm:px-0', className)}>
      <table className="w-full min-w-[560px] border-collapse text-[13px]">{children}</table>
    </div>
  );
}

export function Th({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return (
    <th
      scope="col"
      className={cn('border-b border-line px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-subtle', className)}
      {...props}
    />
  );
}

export function Td({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>): React.JSX.Element {
  return <td className={cn('border-b border-line/70 px-2.5 py-2 align-top', className)} {...props} />;
}

export { buttonVariants, badgeVariants };
