'use client';

import * as React from 'react';
import { Badge } from '@/components/ui/primitives';

/** Live accuracy readout used by the question and test forms. */
export function AccuracyPreview({
  attempted,
  correct,
  wrong,
  unattempted,
}: {
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
}): React.JSX.Element {
  const accuracy = attempted > 0 ? Math.round((correct / attempted) * 1000) / 10 : 0;
  const invalid = correct + wrong > attempted;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-surface-2 px-3 py-2 text-[12.5px]">
      <span className="font-medium">Accuracy</span>
      <Badge tone={invalid ? 'danger' : accuracy >= 60 ? 'success' : attempted ? 'warn' : 'neutral'}>{accuracy}%</Badge>
      <span className="text-ink-muted">
        {correct} correct · {wrong} wrong · {unattempted} left blank
      </span>
      {invalid ? <span className="font-medium text-danger">Correct + wrong exceeds attempted</span> : null}
    </div>
  );
}

/** Two-column form section with a heading, used by longer forms. */
export function FormSection({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section className="space-y-3 border-t border-line pt-3 first:border-0 first:pt-0">
      <h3 className="text-[12px] font-semibold uppercase tracking-wide text-ink-subtle">{title}</h3>
      {children}
    </section>
  );
}
