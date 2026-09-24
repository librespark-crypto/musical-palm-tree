'use client';

/**
 * Exam scope is part of the URL (`?exam=jm|ja`) so a link can point at the same
 * topic in a different scope, and so the back button behaves. Nothing about it
 * is stored in the database: it is a view setting, not tracker data.
 */
import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import type { ExamScope } from '@/lib/types';

export const EXAM_QUERY_KEY = 'exam';

export function useExamScope(fallback: ExamScope = 'jm'): [ExamScope, (next: ExamScope) => void] {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const raw = params.get(EXAM_QUERY_KEY);
  const value: ExamScope = raw === 'ja' ? 'ja' : raw === 'jm' ? 'jm' : fallback;

  const setScope = React.useCallback(
    (next: ExamScope) => {
      const search = new URLSearchParams(params.toString());
      search.set(EXAM_QUERY_KEY, next);
      router.replace(`${pathname}?${search.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  return [value, setScope];
}

/** Reads a scope from a raw query value (used by screens that take a prop). */
export function normaliseScope(value: string | null | undefined, fallback: ExamScope = 'jm'): ExamScope {
  return value === 'ja' ? 'ja' : value === 'jm' ? 'jm' : fallback;
}
