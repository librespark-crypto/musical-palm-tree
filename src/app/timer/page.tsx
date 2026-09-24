import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { TimerScreen } from '@/features/timer/timer-screen';

export const metadata: Metadata = {
  title: 'Study timer',
  description: 'Track real study time against subjects, topics and tasks.',
};

export default function Page(): React.JSX.Element {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <TimerScreen />
    </React.Suspense>
  );
}
