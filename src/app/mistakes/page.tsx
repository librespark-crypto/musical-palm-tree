import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { MistakesScreen } from '@/features/mistakes/mistakes-screen';

export const metadata: Metadata = {
  title: 'Mistake book',
  description: 'Every mistake worth never repeating, with a revision workflow.',
};

export default function Page(): React.JSX.Element {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <MistakesScreen />
    </React.Suspense>
  );
}
