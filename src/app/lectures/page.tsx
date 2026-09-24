import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { LecturesScreen } from '@/features/lectures/lectures-screen';

export const metadata: Metadata = {
  title: 'Lectures',
  description: 'Lecture library with watch progress and completion status.',
};

export default function Page(): React.JSX.Element {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <LecturesScreen />
    </React.Suspense>
  );
}
