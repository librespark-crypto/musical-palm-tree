'use client';

/**
 * Subject → chapter → topic → subtopic picker.
 *
 * Used by every form that needs to attach a record to a syllabus node. All
 * options come from the stored syllabus and are filtered by the exam scope, so a
 * JEE Main-only chapter cannot be attached to a JEE Advanced record.
 */
import * as React from 'react';
import type { ExamScope, SubjectCode } from '@/lib/types';
import { subjects } from '@/lib/syllabus';
import { Field, Select } from '@/components/ui/primitives';

export interface NodeSelection {
  subject: SubjectCode;
  chapterId: string | null;
  topicId: string | null;
  subtopicId: string | null;
}

export const EMPTY_SELECTION: NodeSelection = { subject: 'phy', chapterId: null, topicId: null, subtopicId: null };

export function selectionNodeId(selection: NodeSelection): string | null {
  return selection.subtopicId ?? selection.topicId ?? selection.chapterId;
}

export function NodePicker({
  value,
  onChange,
  exam,
  idPrefix,
  allowChapterOnly = true,
}: {
  value: NodeSelection;
  onChange(next: NodeSelection): void;
  exam: ExamScope;
  idPrefix: string;
  allowChapterOnly?: boolean;
}): React.JSX.Element {
  const subject = subjects.find((entry) => entry.code === value.subject) ?? subjects[0];
  const chapters = (subject?.chapters ?? []).filter((chapter) => chapter[exam]);
  const chapter = chapters.find((entry) => entry.id === value.chapterId) ?? null;
  const topics = (chapter?.topics ?? []).filter((topic) => topic[exam]);
  const topic = topics.find((entry) => entry.id === value.topicId) ?? null;
  const subs = (topic?.subs ?? []).filter((sub) => sub[exam]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Subject" htmlFor={`${idPrefix}-subject`}>
        <Select
          id={`${idPrefix}-subject`}
          value={value.subject}
          onChange={(event) =>
            onChange({ subject: event.target.value as SubjectCode, chapterId: null, topicId: null, subtopicId: null })
          }
        >
          {subjects.map((entry) => (
            <option key={entry.code} value={entry.code}>
              {entry.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Chapter" htmlFor={`${idPrefix}-chapter`}>
        <Select
          id={`${idPrefix}-chapter`}
          value={value.chapterId ?? ''}
          onChange={(event) =>
            onChange({ ...value, chapterId: event.target.value || null, topicId: null, subtopicId: null })
          }
        >
          <option value="">{allowChapterOnly ? 'No specific chapter' : 'Select a chapter'}</option>
          {chapters.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Topic" htmlFor={`${idPrefix}-topic`} hint={chapter ? undefined : 'Pick a chapter first'}>
        <Select
          id={`${idPrefix}-topic`}
          value={value.topicId ?? ''}
          disabled={!chapter}
          onChange={(event) => onChange({ ...value, topicId: event.target.value || null, subtopicId: null })}
        >
          <option value="">Whole chapter</option>
          {topics.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Subtopic" htmlFor={`${idPrefix}-subtopic`} hint={topic ? undefined : 'Pick a topic first'}>
        <Select
          id={`${idPrefix}-subtopic`}
          value={value.subtopicId ?? ''}
          disabled={!topic || subs.length === 0}
          onChange={(event) => onChange({ ...value, subtopicId: event.target.value || null })}
        >
          <option value="">Whole topic</option>
          {subs.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </Select>
      </Field>
    </div>
  );
}
