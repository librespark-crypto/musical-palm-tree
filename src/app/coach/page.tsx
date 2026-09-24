import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { CoachScreen } from '@/features/coach/coach-screen';

export const metadata: Metadata = {
  title: 'AI coach',
  description: 'Data-grounded study advice, plans and chat with a rule-based fallback.',
};

export default function Page(): React.JSX.Element {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <CoachScreen />
    </React.Suspense>
  );
}
