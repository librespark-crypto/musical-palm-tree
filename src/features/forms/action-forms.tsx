'use client';

/**
 * Every write a student can make, as a dialog.
 *
 * These forms are shared by the dashboard quick actions, the planner, the
 * syllabus/topic screens and the tracker screens, so validation rules live in
 * exactly one place:
 *   - correct + wrong can never exceed attempted questions
 *   - a lecture marked complete is forced to its full watched duration
 *   - a test's totals are derived from the per-subject rows
 *
 * Each dialog is mounted only while it is open, so its state always starts from
 * the record being edited (no stale form values, no reset effects).
 */
import * as React from 'react';
import type {
  ExamScope,
  Lecture,
  LectureStatus,
  Mistake,
  MistakeStatus,
  MistakeType,
  Priority,
  QuestionSource,
  StudyDifficulty,
  StudyTask,
  SubjectCode,
  TaskType,
  TestAttempt,
  TestRecord,
} from '@/lib/types';
import { MISTAKE_TYPES, QUESTION_SOURCES, TASK_TYPES } from '@/lib/types';
import { PRIORITY_LABELS, SESSION_MODES, SUBJECT_LABELS } from '@/lib/constants';
import { todayISO } from '@/lib/date';
import { useTracker } from '@/lib/store/tracker-store';
import { Button, Field, Input, Select, Switch, Textarea } from '@/components/ui/primitives';
import { Modal } from '@/components/ui/dialog';
import { AccuracyPreview } from '@/features/forms/form-parts';
import { EMPTY_SELECTION, NodePicker, type NodeSelection } from '@/features/forms/node-picker';
import { normaliseTestInput } from '@/lib/calculations/tests';

interface DialogBaseProps {
  onClose(): void;
}

/* ------------------------------------------------------------------- task */

export interface TaskDialogProps extends DialogBaseProps {
  defaults?: Partial<StudyTask>;
  /** Pre-selects the syllabus node (used by chapter/topic screens). */
  node?: NodeSelection | null;
  exam?: ExamScope;
}

export function TaskDialog({ onClose, defaults, node, exam: examProp }: TaskDialogProps): React.JSX.Element {
  const { actions, notify } = useTracker();
  const [title, setTitle] = React.useState(defaults?.title ?? '');
  const [type, setType] = React.useState<TaskType>(defaults?.type ?? 'Topic study');
  const [exam, setExam] = React.useState<ExamScope>(defaults?.exam ?? examProp ?? 'jm');
  const [priority, setPriority] = React.useState<Priority>(defaults?.priority ?? 'medium');
  const [plannedFor, setPlannedFor] = React.useState(defaults?.plannedFor ?? todayISO());
  const [deadline, setDeadline] = React.useState(defaults?.deadline ?? '');
  const [estMin, setEstMin] = React.useState(defaults?.estMin ?? 60);
  const [notes, setNotes] = React.useState(defaults?.notes ?? '');
  const [inBacklog, setInBacklog] = React.useState(defaults?.inBacklog ?? false);
  const [selection, setSelection] = React.useState<NodeSelection>(
    node ?? {
      subject: defaults?.subject ?? EMPTY_SELECTION.subject,
      chapterId: defaults?.chapterId ?? null,
      topicId: defaults?.topicId ?? null,
      subtopicId: defaults?.subtopicId ?? null,
    },
  );
  const [error, setError] = React.useState<string | null>(null);

  const submit = () => {
    if (!title.trim()) {
      setError('Give the task a title.');
      return;
    }
    actions.addTask({
      title: title.trim(),
      type,
      exam,
      priority,
      plannedFor,
      deadline: deadline || null,
      estMin: Math.max(5, Math.round(estMin)),
      notes,
      inBacklog,
      subject: selection.subject,
      chapterId: selection.chapterId,
      topicId: selection.topicId,
      subtopicId: selection.subtopicId,
      link: selection.subtopicId ? 'subtopic' : selection.topicId ? 'topic' : selection.chapterId ? 'chapter' : 'custom',
    });
    notify('Task added', 'success');
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => (!next ? onClose() : undefined)}
      title="Add a study task"
      description="Tasks feed the planner, today's plan and the backlog sweep."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Add task
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Task" htmlFor="task-title" error={error}>
          <Input
            id="task-title"
            value={title}
            autoFocus
            onChange={(event) => {
              setTitle(event.target.value);
              setError(null);
            }}
            placeholder="e.g. Rotational motion - DPP 3"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Type" htmlFor="task-type">
            <Select id="task-type" value={type} onChange={(event) => setType(event.target.value as TaskType)}>
              {TASK_TYPES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Priority" htmlFor="task-priority">
            <Select id="task-priority" value={priority} onChange={(event) => setPriority(event.target.value as Priority)}>
              {(['high', 'medium', 'low'] as Priority[]).map((entry) => (
                <option key={entry} value={entry}>
                  {PRIORITY_LABELS[entry]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Exam scope" htmlFor="task-exam">
            <Select id="task-exam" value={exam} onChange={(event) => setExam(event.target.value as ExamScope)}>
              <option value="jm">JEE Main</option>
              <option value="ja">JEE Advanced</option>
            </Select>
          </Field>
          <Field label="Planned for" htmlFor="task-planned">
            <Input id="task-planned" type="date" value={plannedFor} onChange={(event) => setPlannedFor(event.target.value)} />
          </Field>
          <Field label="Deadline (optional)" htmlFor="task-deadline">
            <Input id="task-deadline" type="date" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
          </Field>
          <Field label="Estimated minutes" htmlFor="task-est">
            <Input
              id="task-est"
              type="number"
              min={5}
              step={5}
              value={estMin}
              onChange={(event) => setEstMin(Number(event.target.value) || 0)}
            />
          </Field>
        </div>
        <NodePicker value={selection} onChange={setSelection} exam={exam} idPrefix="task" />
        <Field label="Notes" htmlFor="task-notes">
          <Textarea id="task-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
        </Field>
        <Switch
          checked={inBacklog}
          onCheckedChange={setInBacklog}
          label="Already in the backlog"
          description="Use this for work you are carrying over instead of scheduling it for a specific day."
        />
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- lecture */

export function LectureDialog({
  onClose,
  defaults,
  node,
  exam: examProp,
}: DialogBaseProps & { defaults?: Partial<Lecture>; node?: NodeSelection | null; exam?: ExamScope }): React.JSX.Element {
  const { actions, notify } = useTracker();
  const [title, setTitle] = React.useState(defaults?.title ?? '');
  const [exam, setExam] = React.useState<ExamScope>(
    defaults ? (defaults.exam === 'ja' ? 'ja' : 'jm') : (examProp ?? 'jm'),
  );
  const [number, setNumber] = React.useState(defaults?.number ?? 1);
  const [durationMin, setDurationMin] = React.useState(defaults?.durationMin ?? 60);
  const [watchedMin, setWatchedMin] = React.useState(defaults?.watchedMin ?? 0);
  const [status, setStatus] = React.useState<LectureStatus>(defaults?.status ?? 'not_started');
  const [source, setSource] = React.useState(defaults?.source ?? '');
  const [date, setDate] = React.useState(defaults?.date ?? todayISO());
  const [notes, setNotes] = React.useState(defaults?.notes ?? '');
  const [selection, setSelection] = React.useState<NodeSelection>(
    node ?? { subject: defaults?.subject ?? 'phy', chapterId: defaults?.chapterId ?? null, topicId: defaults?.topicId ?? null, subtopicId: null },
  );
  const [error, setError] = React.useState<string | null>(null);

  const submit = () => {
    if (!title.trim()) {
      setError('Give the lecture a title.');
      return;
    }
    const finalWatched = status === 'completed' ? durationMin : Math.min(watchedMin, durationMin);
    const payload = {
      title: title.trim(),
      subject: selection.subject,
      chapterId: selection.chapterId,
      topicId: selection.topicId,
      exam,
      number,
      durationMin,
      watchedMin: finalWatched,
      status,
      source: source.trim(),
      date,
      notes,
    };
    if (defaults?.id) {
      actions.updateLecture(defaults.id, payload);
      notify('Lecture updated', 'success');
    } else {
      actions.addLecture(payload);
      notify('Lecture added', 'success');
    }
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => (!next ? onClose() : undefined)}
      title={defaults?.id ? 'Edit lecture' : 'Add a lecture'}
      description="Lecture progress rolls up into the chapter and subject totals."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {defaults?.id ? 'Save changes' : 'Add lecture'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Lecture title" htmlFor="lec-title" error={error}>
          <Input
            id="lec-title"
            value={title}
            autoFocus
            onChange={(event) => {
              setTitle(event.target.value);
              setError(null);
            }}
            placeholder="e.g. Rotational motion - lecture 2"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Lecture number" htmlFor="lec-number">
            <Input id="lec-number" type="number" min={1} value={number} onChange={(event) => setNumber(Number(event.target.value) || 1)} />
          </Field>
          <Field label="Duration (min)" htmlFor="lec-duration">
            <Input
              id="lec-duration"
              type="number"
              min={5}
              step={5}
              value={durationMin}
              onChange={(event) => setDurationMin(Number(event.target.value) || 0)}
            />
          </Field>
          <Field label="Watched (min)" htmlFor="lec-watched" hint={status === 'completed' ? 'Forced to the full duration' : undefined}>
            <Input
              id="lec-watched"
              type="number"
              min={0}
              step={5}
              value={status === 'completed' ? durationMin : watchedMin}
              disabled={status === 'completed'}
              onChange={(event) => setWatchedMin(Number(event.target.value) || 0)}
            />
          </Field>
          <Field label="Status" htmlFor="lec-status">
            <Select id="lec-status" value={status} onChange={(event) => setStatus(event.target.value as LectureStatus)}>
              <option value="not_started">Not started</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
            </Select>
          </Field>
          <Field label="Exam scope" htmlFor="lec-exam">
            <Select id="lec-exam" value={exam} onChange={(event) => setExam(event.target.value as ExamScope)}>
              <option value="jm">JEE Main</option>
              <option value="ja">JEE Advanced</option>
            </Select>
          </Field>
          <Field label="Watched on" htmlFor="lec-date">
            <Input id="lec-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
        </div>
        <NodePicker value={selection} onChange={setSelection} exam={exam} idPrefix="lec" />
        <Field label="Source (optional)" htmlFor="lec-source" hint="Coaching batch, YouTube playlist, book chapter…">
          <Input id="lec-source" value={source} onChange={(event) => setSource(event.target.value)} />
        </Field>
        <Field label="Notes" htmlFor="lec-notes">
          <Textarea id="lec-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
        </Field>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- question */

export function QuestionDialog({
  onClose,
  node,
  exam: examProp,
  subject,
}: DialogBaseProps & { node?: NodeSelection | null; exam?: ExamScope; subject?: SubjectCode }): React.JSX.Element {
  const { actions, notify } = useTracker();
  const [date, setDate] = React.useState(todayISO());
  const [source, setSource] = React.useState<QuestionSource>('DPP');
  const [exam, setExam] = React.useState<ExamScope>(examProp ?? 'jm');
  const [difficulty, setDifficulty] = React.useState<StudyDifficulty>('moderate');
  const [attempted, setAttempted] = React.useState(20);
  const [correct, setCorrect] = React.useState(15);
  const [wrong, setWrong] = React.useState(5);
  const [timeMin, setTimeMin] = React.useState(45);
  const [notes, setNotes] = React.useState('');
  const [selection, setSelection] = React.useState<NodeSelection>(
    node ?? { subject: subject ?? 'phy', chapterId: null, topicId: null, subtopicId: null },
  );
  const [error, setError] = React.useState<string | null>(null);

  const unattempted = Math.max(0, attempted - correct - wrong);

  const submit = () => {
    if (attempted <= 0) {
      setError('Log at least one attempted question.');
      return;
    }
    if (correct + wrong > attempted) {
      setError('Correct + wrong cannot exceed attempted.');
      return;
    }
    actions.addQuestion({
      date,
      source,
      subject: selection.subject,
      chapterId: selection.chapterId,
      topicId: selection.topicId,
      subtopicId: selection.subtopicId,
      exam,
      difficulty,
      attempted,
      correct,
      wrong,
      unattempted,
      timeMin,
      notes,
    });
    notify('Question log added', 'success');
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => (!next ? onClose() : undefined)}
      title="Log question practice"
      description="Accuracy from these logs drives mastery scores and the weak-topic list."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Save log
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date" htmlFor="q-date">
            <Input id="q-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Source" htmlFor="q-source">
            <Select id="q-source" value={source} onChange={(event) => setSource(event.target.value as QuestionSource)}>
              {QUESTION_SOURCES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Difficulty" htmlFor="q-difficulty">
            <Select id="q-difficulty" value={difficulty} onChange={(event) => setDifficulty(event.target.value as StudyDifficulty)}>
              <option value="easy">Easy</option>
              <option value="moderate">Moderate</option>
              <option value="hard">Hard</option>
            </Select>
          </Field>
          <Field label="Attempted" htmlFor="q-attempted">
            <Input id="q-attempted" type="number" min={1} value={attempted} onChange={(event) => setAttempted(Number(event.target.value) || 0)} />
          </Field>
          <Field label="Correct" htmlFor="q-correct">
            <Input id="q-correct" type="number" min={0} value={correct} onChange={(event) => setCorrect(Number(event.target.value) || 0)} />
          </Field>
          <Field label="Wrong" htmlFor="q-wrong">
            <Input id="q-wrong" type="number" min={0} value={wrong} onChange={(event) => setWrong(Number(event.target.value) || 0)} />
          </Field>
          <Field label="Time (min)" htmlFor="q-time">
            <Input id="q-time" type="number" min={0} value={timeMin} onChange={(event) => setTimeMin(Number(event.target.value) || 0)} />
          </Field>
          <Field label="Exam scope" htmlFor="q-exam">
            <Select id="q-exam" value={exam} onChange={(event) => setExam(event.target.value as ExamScope)}>
              <option value="jm">JEE Main</option>
              <option value="ja">JEE Advanced</option>
            </Select>
          </Field>
        </div>
        <AccuracyPreview attempted={attempted} correct={correct} wrong={wrong} unattempted={unattempted} />
        <NodePicker value={selection} onChange={setSelection} exam={exam} idPrefix="q" />
        <Field label="Notes" htmlFor="q-notes" error={error}>
          <Textarea id="q-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} />
        </Field>
      </div>
    </Modal>
  );
}

/* ---------------------------------------------------------------- mistake */

export function MistakeDialog({
  onClose,
  node,
  exam: examProp,
  subject,
  edit,
}: DialogBaseProps & { node?: NodeSelection | null; exam?: ExamScope; subject?: SubjectCode; edit?: Mistake }): React.JSX.Element {
  const { actions, notify } = useTracker();
  const [date, setDate] = React.useState(edit?.date ?? todayISO());
  const [exam, setExam] = React.useState<ExamScope>(edit?.exam ?? examProp ?? 'jm');
  const [source, setSource] = React.useState(edit?.source ?? '');
  const [mistakeType, setMistakeType] = React.useState<MistakeType>(edit?.mistakeType ?? 'Conceptual');
  const [status, setStatus] = React.useState<MistakeStatus>(edit?.status ?? 'open');
  const [questionText, setQuestionText] = React.useState(edit?.questionText ?? '');
  const [whatWentWrong, setWhatWentWrong] = React.useState(edit?.whatWentWrong ?? '');
  const [correctConcept, setCorrectConcept] = React.useState(edit?.correctConcept ?? '');
  const [selection, setSelection] = React.useState<NodeSelection>(
    node ?? {
      subject: edit?.subject ?? subject ?? 'phy',
      chapterId: edit?.chapterId ?? null,
      topicId: edit?.topicId ?? null,
      subtopicId: edit?.subtopicId ?? null,
    },
  );
  const [error, setError] = React.useState<string | null>(null);

  const submit = () => {
    if (!questionText.trim()) {
      setError('Describe the question (a short label is enough).');
      return;
    }
    const payload = {
      date,
      subject: selection.subject,
      chapterId: selection.chapterId,
      topicId: selection.topicId,
      subtopicId: selection.subtopicId,
      nodeId: selection.subtopicId ?? selection.topicId ?? selection.chapterId,
      exam,
      source: source.trim(),
      questionText: questionText.trim(),
      mistakeType,
      whatWentWrong,
      correctConcept,
      status,
    };
    if (edit) {
      actions.updateMistake(edit.id, payload);
      notify('Mistake updated', 'success');
    } else {
      actions.addMistake(payload);
      notify('Added to the mistake book', 'success');
    }
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => (!next ? onClose() : undefined)}
      title={edit ? 'Edit mistake' : 'Add a mistake'}
      description="The mistake book is for errors worth never repeating - keep each entry specific."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {edit ? 'Save changes' : 'Add mistake'}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Date" htmlFor="m-date">
            <Input id="m-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Exam scope" htmlFor="m-exam">
            <Select id="m-exam" value={exam} onChange={(event) => setExam(event.target.value as ExamScope)}>
              <option value="jm">JEE Main</option>
              <option value="ja">JEE Advanced</option>
            </Select>
          </Field>
          <Field label="Mistake type" htmlFor="m-type">
            <Select id="m-type" value={mistakeType} onChange={(event) => setMistakeType(event.target.value as MistakeType)}>
              {MISTAKE_TYPES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Status" htmlFor="m-status">
            <Select id="m-status" value={status} onChange={(event) => setStatus(event.target.value as MistakeStatus)}>
              <option value="open">Open</option>
              <option value="revised">Revised</option>
              <option value="mastered">Mastered</option>
            </Select>
          </Field>
        </div>
        <Field label="Question (or a clear label)" htmlFor="m-question" error={error}>
          <Textarea
            id="m-question"
            rows={3}
            value={questionText}
            onChange={(event) => {
              setQuestionText(event.target.value);
              setError(null);
            }}
            placeholder="e.g. Block on incline with friction - find minimum force"
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="What went wrong" htmlFor="m-wrong">
            <Textarea id="m-wrong" rows={3} value={whatWentWrong} onChange={(event) => setWhatWentWrong(event.target.value)} />
          </Field>
          <Field label="Correct concept / method" htmlFor="m-concept">
            <Textarea id="m-concept" rows={3} value={correctConcept} onChange={(event) => setCorrectConcept(event.target.value)} />
          </Field>
        </div>
        <NodePicker value={selection} onChange={setSelection} exam={exam} idPrefix="m" />
        <Field label="Source" htmlFor="m-source" hint="Test name, DPP number, chapter…">
          <Input id="m-source" value={source} onChange={(event) => setSource(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- revision */

export function RevisionDialog({
  onClose,
  nodeId,
  exam: examProp,
}: DialogBaseProps & { nodeId?: string | null; exam?: ExamScope }): React.JSX.Element {
  const { actions, notify } = useTracker();
  const [exam, setExam] = React.useState<ExamScope>(examProp ?? 'jm');
  const [selection, setSelection] = React.useState<NodeSelection>(
    nodeId ? { subject: 'phy', chapterId: null, topicId: null, subtopicId: null } : EMPTY_SELECTION,
  );
  const [scheduledFor, setScheduledFor] = React.useState(todayISO());
  const [index, setIndex] = React.useState(1);
  const [note, setNote] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const submit = () => {
    const target = nodeId ?? selection.subtopicId ?? selection.topicId ?? selection.chapterId;
    if (!target) {
      setError('Choose the topic to revise.');
      return;
    }
    actions.scheduleRevision({ nodeId: target, exam, scheduledFor, index, note });
    notify('Revision scheduled', 'success');
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => (!next ? onClose() : undefined)}
      title="Schedule a revision"
      description="Spaced revision: revise today, then the scheduler spaces the next pass further out."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Schedule
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        {nodeId ? null : <NodePicker value={selection} onChange={setSelection} exam={exam} idPrefix="rev" allowChapterOnly={false} />}
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Revise on" htmlFor="rev-date">
            <Input id="rev-date" type="date" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
          </Field>
          <Field label="Revision number" htmlFor="rev-index" hint="1 = first pass after learning">
            <Input
              id="rev-index"
              type="number"
              min={1}
              max={5}
              value={index}
              onChange={(event) => setIndex(Math.min(5, Math.max(1, Number(event.target.value) || 1)))}
            />
          </Field>
          <Field label="Exam scope" htmlFor="rev-exam">
            <Select id="rev-exam" value={exam} onChange={(event) => setExam(event.target.value as ExamScope)}>
              <option value="jm">JEE Main</option>
              <option value="ja">JEE Advanced</option>
            </Select>
          </Field>
        </div>
        <Field label="Note" htmlFor="rev-note" error={error}>
          <Textarea id="rev-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)} />
        </Field>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------ study session */

export function SessionDialog({
  onClose,
  node,
  exam: examProp,
}: DialogBaseProps & { node?: NodeSelection | null; exam?: ExamScope }): React.JSX.Element {
  const { actions, notify } = useTracker();
  const [exam, setExam] = React.useState<ExamScope>(examProp ?? 'jm');
  const [mode, setMode] = React.useState<(typeof SESSION_MODES)[number]>('Theory');
  const [minutes, setMinutes] = React.useState(60);
  const [date, setDate] = React.useState(todayISO());
  const [startTime, setStartTime] = React.useState('18:00');
  const [notes, setNotes] = React.useState('');
  const [selection, setSelection] = React.useState<NodeSelection>(node ?? EMPTY_SELECTION);
  const [error, setError] = React.useState<string | null>(null);

  const submit = () => {
    if (minutes <= 0) {
      setError('Enter the minutes you studied.');
      return;
    }
    const start = `${date}T${startTime}:00`;
    const startedAt = new Date(start);
    if (Number.isNaN(startedAt.getTime())) {
      setError('That date and time combination is not valid.');
      return;
    }
    const end = new Date(startedAt.getTime() + minutes * 60_000);
    actions.addSession({
      start: startedAt.toISOString(),
      end: end.toISOString(),
      minutes,
      mode,
      subject: selection.subject,
      exam,
      chapterId: selection.chapterId,
      topicId: selection.topicId,
      subtopicId: selection.subtopicId,
      origin: 'manual',
      notes,
    });
    notify('Study time logged', 'success');
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => (!next ? onClose() : undefined)}
      title="Log study time"
      description="Manual sessions count exactly like timer sessions in every total."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            Log time
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Date" htmlFor="s-date">
            <Input id="s-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Start time" htmlFor="s-start">
            <Input id="s-start" type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </Field>
          <Field label="Minutes" htmlFor="s-minutes">
            <Input id="s-minutes" type="number" min={5} step={5} value={minutes} onChange={(event) => setMinutes(Number(event.target.value) || 0)} />
          </Field>
          <Field label="Mode" htmlFor="s-mode">
            <Select id="s-mode" value={mode} onChange={(event) => setMode(event.target.value as (typeof SESSION_MODES)[number])}>
              {SESSION_MODES.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <NodePicker value={selection} onChange={setSelection} exam={exam} idPrefix="s" />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Exam scope" htmlFor="s-exam">
            <Select id="s-exam" value={exam} onChange={(event) => setExam(event.target.value as ExamScope)}>
              <option value="jm">JEE Main</option>
              <option value="ja">JEE Advanced</option>
            </Select>
          </Field>
          <Field label="Notes" htmlFor="s-notes" error={error}>
            <Input id="s-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------- mock test */

export function TestDialog({
  onClose,
  edit,
  exam: examProp,
}: DialogBaseProps & { edit?: TestRecord; exam?: ExamScope }): React.JSX.Element {
  const { actions, notify } = useTracker();
  const [name, setName] = React.useState(edit?.name ?? '');
  const [date, setDate] = React.useState(edit?.date ?? todayISO());
  const [exam, setExam] = React.useState<ExamScope>(edit?.exam ?? examProp ?? 'jm');
  const [durationMin, setDurationMin] = React.useState(edit?.durationMin ?? 180);
  const [percentile, setPercentile] = React.useState(edit?.percentile ?? null);
  const [rank, setRank] = React.useState(edit?.rank ?? null);
  const [notes, setNotes] = React.useState(edit?.notes ?? '');
  const [error, setError] = React.useState<string | null>(null);
  const [rows, setRows] = React.useState<Record<SubjectCode, TestAttempt>>(() => ({
    phy: edit?.subjects.phy ?? blankAttempt(),
    chem: edit?.subjects.chem ?? blankAttempt(),
    math: edit?.subjects.math ?? blankAttempt(),
  }));

  const totals = React.useMemo(() => {
    const list = Object.values(rows);
    return {
      score: list.reduce((sum, row) => sum + (row.score || 0), 0),
      maxMarks: list.reduce((sum, row) => sum + (row.max || 0), 0),
      attempted: list.reduce((sum, row) => sum + (row.attempted || 0), 0),
      correct: list.reduce((sum, row) => sum + (row.correct || 0), 0),
      wrong: list.reduce((sum, row) => sum + (row.wrong || 0), 0),
      unattempted: list.reduce((sum, row) => sum + (row.unattempted || 0), 0),
    };
  }, [rows]);

  const update = (code: SubjectCode, patch: Partial<TestAttempt>) => {
    setRows((current) => {
      const next = { ...current[code], ...patch };
      next.unattempted = Math.max(0, next.unattempted);
      return { ...current, [code]: next };
    });
  };

  const submit = () => {
    if (!name.trim()) {
      setError('Name the test (e.g. "Full syllabus mock 1").');
      return;
    }
    if (totals.maxMarks <= 0) {
      setError('Enter the maximum marks for at least one subject.');
      return;
    }
    const invalid = (Object.entries(rows) as [SubjectCode, TestAttempt][]).find(
      ([, row]) => row.correct + row.wrong > row.attempted,
    );
    if (invalid) {
      setError(`In ${SUBJECT_LABELS[invalid[0]]}, correct + wrong cannot exceed attempted.`);
      return;
    }
    const payload = normaliseTestInput({
      name: name.trim(),
      date,
      exam,
      durationMin,
      score: totals.score,
      maxMarks: totals.maxMarks,
      attempted: totals.attempted,
      correct: totals.correct,
      wrong: totals.wrong,
      unattempted: totals.unattempted,
      percentile,
      rank,
      subjects: rows,
      notes,
    });
    if (edit) {
      actions.updateTest(edit.id, payload);
      notify('Test updated', 'success');
    } else {
      actions.addTest(payload);
      notify('Test recorded', 'success');
    }
    onClose();
  };

  return (
    <Modal
      open
      onOpenChange={(next) => (!next ? onClose() : undefined)}
      title={edit ? 'Edit test' : 'Record a mock test'}
      description="Enter the marks you actually scored - accuracy, subject spread and the trend are computed from these numbers."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit}>
            {edit ? 'Save changes' : 'Save test'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Test name" htmlFor="t-name" error={error}>
            <Input
              id="t-name"
              value={name}
              autoFocus
              onChange={(event) => {
                setName(event.target.value);
                setError(null);
              }}
              placeholder="Full syllabus mock 1"
            />
          </Field>
          <Field label="Date" htmlFor="t-date">
            <Input id="t-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          </Field>
          <Field label="Duration (min)" htmlFor="t-duration">
            <Input id="t-duration" type="number" min={30} step={10} value={durationMin} onChange={(event) => setDurationMin(Number(event.target.value) || 0)} />
          </Field>
          <Field label="Exam scope" htmlFor="t-exam">
            <Select id="t-exam" value={exam} onChange={(event) => setExam(event.target.value as ExamScope)}>
              <option value="jm">JEE Main</option>
              <option value="ja">JEE Advanced</option>
            </Select>
          </Field>
        </div>

        <div className="scroll-x">
          <table className="w-full min-w-[620px] border-collapse text-[13px]">
            <caption className="sr-only">Per-subject marks and attempts</caption>
            <thead>
              <tr className="text-[10.5px] uppercase tracking-wide text-ink-subtle">
                <th scope="col" className="px-2 py-1.5 text-left font-semibold">
                  Subject
                </th>
                <th scope="col" className="px-2 py-1.5 text-left font-semibold">
                  Score
                </th>
                <th scope="col" className="px-2 py-1.5 text-left font-semibold">
                  Max
                </th>
                <th scope="col" className="px-2 py-1.5 text-left font-semibold">
                  Attempted
                </th>
                <th scope="col" className="px-2 py-1.5 text-left font-semibold">
                  Correct
                </th>
                <th scope="col" className="px-2 py-1.5 text-left font-semibold">
                  Wrong
                </th>
                <th scope="col" className="px-2 py-1.5 text-left font-semibold">
                  Unattempted
                </th>
              </tr>
            </thead>
            <tbody>
              {(['phy', 'chem', 'math'] as SubjectCode[]).map((code) => (
                <tr key={code} className="border-t border-line/70">
                  <th scope="row" className="px-2 py-1.5 text-left font-medium">
                    {SUBJECT_LABELS[code]}
                  </th>
                  {(['score', 'max', 'attempted', 'correct', 'wrong', 'unattempted'] as const).map((field) => (
                    <td key={field} className="px-2 py-1.5">
                      <Input
                        type="number"
                        min={0}
                        aria-label={`${SUBJECT_LABELS[code]} ${field}`}
                        className="h-8 w-20"
                        value={rows[code][field]}
                        onChange={(event) => update(code, { [field]: Number(event.target.value) || 0 })}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t border-line font-semibold">
                <th scope="row" className="px-2 py-1.5 text-left">
                  Total
                </th>
                <td className="px-2 py-1.5 tabular">{totals.score}</td>
                <td className="px-2 py-1.5 tabular">{totals.maxMarks}</td>
                <td className="px-2 py-1.5 tabular">{totals.attempted}</td>
                <td className="px-2 py-1.5 tabular">{totals.correct}</td>
                <td className="px-2 py-1.5 tabular">{totals.wrong}</td>
                <td className="px-2 py-1.5 tabular">{totals.unattempted}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Percentile (optional)" htmlFor="t-percentile" hint="Only if your test series published one">
            <Input
              id="t-percentile"
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={percentile ?? ''}
              onChange={(event) => setPercentile(event.target.value === '' ? null : Number(event.target.value))}
            />
          </Field>
          <Field label="Rank (optional)" htmlFor="t-rank">
            <Input
              id="t-rank"
              type="number"
              min={1}
              value={rank ?? ''}
              onChange={(event) => setRank(event.target.value === '' ? null : Number(event.target.value))}
            />
          </Field>
          <Field label="Notes" htmlFor="t-notes">
            <Input id="t-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
        </div>
      </div>
    </Modal>
  );
}

function blankAttempt(): TestAttempt {
  return { score: 0, max: 0, attempted: 0, correct: 0, wrong: 0, unattempted: 0, accuracy: 0 };
}
