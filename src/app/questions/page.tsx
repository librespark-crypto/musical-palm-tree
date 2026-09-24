import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { QuestionsScreen } from '@/features/questions/questions-screen';

export const metadata: Metadata = {
  title: 'Questions',
  description: 'Question logs for DPP, PYQ, practice and mock tests with accuracy trends.',
};

export default function Page(): React.JSX.Element {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <QuestionsScreen />
    </React.Suspense>
  );
}
