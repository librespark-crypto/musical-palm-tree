import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { RevisionScreen } from '@/features/revision/revision-screen';

export const metadata: Metadata = {
  title: 'Revision',
  description: 'Spaced revision queue: overdue, due today and upcoming topics.',
};

export default function Page(): React.JSX.Element {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <RevisionScreen />
    </React.Suspense>
  );
}
