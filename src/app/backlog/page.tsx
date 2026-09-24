import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { BacklogScreen } from '@/features/backlog/backlog-screen';

export const metadata: Metadata = {
  title: 'Backlog',
  description: 'Carried-over work, overdue tasks and the debt you need to clear.',
};

export default function Page(): React.JSX.Element {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <BacklogScreen />
    </React.Suspense>
  );
}
