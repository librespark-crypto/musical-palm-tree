'use client';

import { useSnapshot } from '@/lib/store/tracker-store';
import { DashboardScreen } from '@/features/dashboard/dashboard-view';

export default function DashboardPage(): React.JSX.Element {
  const snapshot = useSnapshot();
  return <DashboardScreen userName={snapshot.settings.profile.name} />;
}
