import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { SyllabusScreen } from '@/features/syllabus/syllabus-screen';

export const metadata: Metadata = {
  title: 'Syllabus',
  description: 'The full JEE Main and JEE Advanced syllabus with per-topic completion, lectures, questions and revisions.',
};

export default function SyllabusPage(): React.JSX.Element {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <SyllabusScreen />
    </React.Suspense>
  );
}
