import * as React from 'react';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Skeleton } from '@/components/ui/primitives';
import { SyllabusScreen } from '@/features/syllabus/syllabus-screen';
import { SUBJECT_LABELS } from '@/lib/constants';
import { subjectByCode } from '@/lib/syllabus';
import type { SubjectCode } from '@/lib/types';

interface PageProps {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { code } = await params;
  const subject = subjectByCode[code];
  return subject
    ? { title: `${subject.name} syllabus`, description: `${subject.chapters.length} chapters of the ${subject.name} syllabus with progress tracking.` }
    : { title: 'Subject' };
}

export default async function SubjectPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { code } = await params;
  if (!(code in SUBJECT_LABELS)) notFound();
  return (
    <React.Suspense fallback={<Skeleton className="h-96" />}>
      <SyllabusScreen subjectCode={code as SubjectCode} />
    </React.Suspense>
  );
}
