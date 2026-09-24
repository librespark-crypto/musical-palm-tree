import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Offline',
  description: 'The tracker shell is cached; your data lives on this device in IndexedDB.',
};

export default function OfflinePage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <h1 className="text-xl font-semibold">You are offline</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        This page was loaded from the service-worker cache. Once the app shell has been visited on this device it keeps
        working offline: your tracker data is stored locally in IndexedDB and never depends on the network.
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
        AI coach requests need a connection - when they fail the app falls back to the deterministic rule-based plan
        built from your own records.
      </p>
      <Link
        href="/"
        className="mt-5 inline-flex h-9.5 items-center rounded-[10px] bg-brand px-4 text-sm font-medium text-brand-ink"
      >
        Try the dashboard again
      </Link>
    </div>
  );
}
