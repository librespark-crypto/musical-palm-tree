import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { TestsScreen } from '@/features/tests/tests-screen';

export const metadata: Metadata = {
  title: 'Mock tests',
  description: 'Test scores, accuracy, subject splits and the analysis that follows.',
};

export default function Page(): React.JSX.Element {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <TestsScreen />
    </React.Suspense>
  );
}
