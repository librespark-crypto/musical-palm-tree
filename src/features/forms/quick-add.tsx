'use client';

/**
 * Quick-add launcher.
 *
 * One entry point for every record type, so the dashboard, the planner and the
 * topic screen all offer the same actions. Selecting a kind opens the matching
 * dialog; nothing is a stub.
 */
import * as React from 'react';
import { BookOpen, FileWarning, Gauge, ListPlus, NotebookPen, Repeat, Timer } from 'lucide-react';
import type { ExamScope, SubjectCode } from '@/lib/types';
import { Button } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/dialog';
import type { NodeSelection } from '@/features/forms/node-picker';
import {
  LectureDialog,
  MistakeDialog,
  QuestionDialog,
  RevisionDialog,
  SessionDialog,
  TaskDialog,
  TestDialog,
} from '@/features/forms/action-forms';

type Kind = 'task' | 'lecture' | 'question' | 'mistake' | 'revision' | 'session' | 'test';

const OPTIONS: { kind: Kind; label: string; description: string; icon: React.ElementType }[] = [
  { kind: 'task', label: 'Study task', description: 'Anything you plan to do', icon: ListPlus },
  { kind: 'lecture', label: 'Lecture', description: 'Track watch progress', icon: BookOpen },
  { kind: 'question', label: 'Question log', description: 'DPP, PYQ or practice', icon: NotebookPen },
  { kind: 'revision', label: 'Revision', description: 'Schedule a spaced revision', icon: Repeat },
  { kind: 'session', label: 'Study time', description: 'Log minutes you studied', icon: Timer },
  { kind: 'mistake', label: 'Mistake', description: 'Add to the mistake book', icon: FileWarning },
  { kind: 'test', label: 'Mock test', description: 'Record a full test', icon: Gauge },
];

export interface QuickAddProps {
  exam?: ExamScope;
  subject?: SubjectCode;
  node?: NodeSelection | null;
  label?: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
}

export function QuickAdd({ exam, subject, node, label = 'Quick add', variant = 'primary', size = 'md', block }: QuickAddProps): React.JSX.Element {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const [kind, setKind] = React.useState<Kind | null>(null);

  const close = () => setKind(null);

  return (
    <>
      <Button variant={variant} size={size} block={block} onClick={() => setMenuOpen(true)}>
        <ListPlus aria-hidden className="size-4" />
        {label}
      </Button>

      {menuOpen ? (
        <Modal open onOpenChange={(next) => (!next ? setMenuOpen(false) : undefined)} title="Add a record" description="Everything you add feeds the planner, analytics and the AI coach.">
          <ul className="grid gap-2 sm:grid-cols-2">
            {OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <li key={option.kind}>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      setKind(option.kind);
                    }}
                    className="flex w-full items-start gap-2.5 rounded-[10px] border border-line p-2.5 text-left transition-colors hover:bg-surface-2"
                  >
                    <Icon aria-hidden className="mt-0.5 size-4 text-ink-subtle" />
                    <span>
                      <span className="block text-[13px] font-medium">{option.label}</span>
                      <span className="block text-[11.5px] text-ink-muted">{option.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Modal>
      ) : null}

      {kind === 'task' ? <TaskDialog onClose={close} node={node} exam={exam} /> : null}
      {kind === 'lecture' ? <LectureDialog onClose={close} node={node} exam={exam} /> : null}
      {kind === 'question' ? <QuestionDialog onClose={close} node={node} exam={exam} subject={subject} /> : null}
      {kind === 'mistake' ? <MistakeDialog onClose={close} node={node} exam={exam} subject={subject} /> : null}
      {kind === 'revision' ? <RevisionDialog onClose={close} exam={exam} /> : null}
      {kind === 'session' ? <SessionDialog onClose={close} node={node} exam={exam} /> : null}
      {kind === 'test' ? <TestDialog onClose={close} exam={exam} /> : null}
    </>
  );
}
