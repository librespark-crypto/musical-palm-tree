import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { AnalyticsScreen } from '@/features/analytics/analytics-screen';

export const metadata: Metadata = {
  title: 'Analytics',
  description: 'Syllabus progress, study time, questions, revision and test performance.',
};

export default function Page(): React.JSX.Element {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <AnalyticsScreen />
    </React.Suspense>
  );
}
