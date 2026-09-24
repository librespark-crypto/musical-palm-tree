import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { SettingsScreen } from '@/features/settings/settings-screen';

export const metadata: Metadata = {
  title: 'Settings',
  description: 'Profile, appearance, revision scheduling, AI status and data management.',
};

export default function Page(): React.JSX.Element {
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <SettingsScreen />
    </React.Suspense>
  );
}
