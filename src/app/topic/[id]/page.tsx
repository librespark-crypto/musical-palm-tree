import * as React from 'react';
import type { Metadata } from 'next';
import { Skeleton } from '@/components/ui/primitives';
import { TopicScreen } from '@/features/syllabus/topic-screen';
import { nodeById } from '@/lib/syllabus';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const node = nodeById(id);
  return {
    title: node ? node.name : 'Topic',
    description: node ? `${node.name} - progress, lectures, questions, revisions and notes.` : undefined,
  };
}

export default async function TopicPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { id } = await params;
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <TopicScreen nodeId={id} />
    </React.Suspense>
  );
}
