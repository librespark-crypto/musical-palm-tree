import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { SearchScreen } from '@/features/search/search-screen';

export const metadata: Metadata = {
  title: 'Search',
  description: 'Search the official JEE syllabus and everything you have tracked.',
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}): Promise<React.JSX.Element> {
  const params = await searchParams;
  const raw = params.q;
  const initialQuery = typeof raw === 'string' ? raw : (raw?.[0] ?? '');

  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <SearchScreen initialQuery={initialQuery} />
    </React.Suspense>
  );
}
