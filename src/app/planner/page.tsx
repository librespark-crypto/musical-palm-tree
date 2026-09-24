import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { PlannerScreen } from '@/features/planner/planner-screen';

export const metadata: Metadata = {
  title: 'Planner',
  description: 'Plan lectures, questions, revision, tests and custom tasks by day and week.',
};

export default function Page(): React.JSX.Element {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <PlannerScreen />
    </React.Suspense>
  );
}
