'use client';

import { CheckCircle2, Info, X, AlertTriangle } from 'lucide-react';
import { useTracker } from '@/lib/store/tracker-store';
import { cn } from '@/lib/utils';

export function Toaster(): React.JSX.Element {
  const { toasts, dismissToast } = useTracker();
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6 sm:left-auto sm:right-6 sm:items-end sm:px-0"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="status"
          className={cn(
            'animate-in-up pointer-events-auto flex w-full max-w-md items-start gap-2.5 rounded-[12px] border border-line bg-surface px-3 py-2.5 shadow-pop',
            toast.tone === 'error' && 'border-danger/40',
            toast.tone === 'success' && 'border-success/40',
          )}
        >
          <span className="mt-0.5">
            {toast.tone === 'success' ? (
              <CheckCircle2 aria-hidden className="size-4 text-success" />
            ) : toast.tone === 'error' ? (
              <AlertTriangle aria-hidden className="size-4 text-danger" />
            ) : (
              <Info aria-hidden className="size-4 text-ink-subtle" />
            )}
          </span>
          <p className="flex-1 text-[13px] leading-snug">{toast.message}</p>
          <button
            type="button"
            onClick={() => dismissToast(toast.id)}
            aria-label="Dismiss message"
            className="text-ink-subtle transition-colors hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
