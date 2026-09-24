import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { ChapterScreen } from '@/features/syllabus/chapter-screen';
import { nodeById } from '@/lib/syllabus';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const chapter = nodeById(id)?.chapter;
  return { title: chapter ? chapter.name : 'Chapter' };
}

export default async function ChapterPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <ChapterScreen chapterId={id} />
    </React.Suspense>
  );
}
