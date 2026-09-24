'use client';

/**
 * The tracker store: one in-memory snapshot of all user data plus the actions
 * that change it.
 *
 * Design notes
 * ------------
 * - Reads are synchronous. Every calculation module takes the snapshot and is
 *   pure, so screens never await anything.
 * - Writes are surgical: an action declares the records it changed and only
 *   those rows are persisted to IndexedDB. A tracker holding 50k rows still
 *   writes a few hundred bytes per edit.
 * - The snapshot object identity changes only when data changes, which is what
 *   makes the derived-index memoisation (WeakMap) exactly correct.
 */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { defaultMeta, defaultSettings, defaultTimer } from '@/lib/db/defaults';
import { LEGACY_STORAGE_KEY, migrateLegacyState, scanLegacyStorage } from '@/lib/db/migration';
import { parseImport, serializeBackup, serializeExport } from '@/lib/db/transfer';
import { buildSampleData } from '@/lib/db/sample';
import { clearAllData, repositories, type ProgressRow } from '@/lib/repositories';
import { leavesOf, nodeById, subjects, syllabusMeta } from '@/lib/syllabus';
import { withIndex, type DerivedIndex } from '@/lib/calculations/derive';
import { autoRevisionDrafts, nextRevisionAfter, scheduleDateFor } from '@/lib/calculations/revision';
import { sweepBacklog } from '@/lib/calculations/backlog';
import { emptyProgress } from '@/lib/calculations/progress';
import { addDays, todayISO } from '@/lib/date';
import { uid } from '@/lib/utils';
import type {
  AiChat,
  AiPlan,
  AppMeta,
  ExamScope,
  Lecture,
  LectureStatus,
  Mistake,
  Priority,
  QuestionLog,
  RevisionRecord,
  StudySession,
  StudyStatus,
  StudyTask,
  SubjectCode,
  TaskStatus,
  TestRecord,
  TimerState,
  TopicProgress,
  TrackerSnapshot,
  UserSettings,
} from '@/lib/types';

/* -------------------------------------------------------------- persistence */

export type SettingsPatch = Partial<Omit<UserSettings, 'profile' | 'revision' | 'ai'>> & {
  profile?: Partial<UserSettings['profile']>;
  revision?: Partial<UserSettings['revision']>;
  ai?: Partial<UserSettings['ai']>;
};

export type PersistOp =
  | { store: 'tasks'; put?: StudyTask[]; remove?: string[] }
  | { store: 'lectures'; put?: Lecture[]; remove?: string[] }
  | { store: 'sessions'; put?: StudySession[]; remove?: string[] }
  | { store: 'revisions'; put?: RevisionRecord[]; remove?: string[] }
  | { store: 'questions'; put?: QuestionLog[]; remove?: string[] }
  | { store: 'mistakes'; put?: Mistake[]; remove?: string[] }
  | { store: 'tests'; put?: TestRecord[]; remove?: string[] }
  | { store: 'chats'; put?: AiChat[]; remove?: string[] }
  | { store: 'progress'; rows: ProgressRow[]; remove?: string[] }
  | { store: 'settings'; value: UserSettings }
  | { store: 'meta'; value: AppMeta }
  | { store: 'timer'; value: TimerState }
  | { store: 'plan'; value: AiPlan | null };

export interface Toast {
  id: string;
  message: string;
  tone: 'default' | 'success' | 'error';
}

export interface TaskInput {
  title: string;
  type?: StudyTask['type'];
  link?: StudyTask['link'];
  status?: TaskStatus;
  priority?: Priority;
  exam?: ExamScope;
  subject?: SubjectCode | null;
  chapterId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
  plannedFor?: string;
  deadline?: string | null;
  estMin?: number;
  notes?: string;
  inBacklog?: boolean;
  origin?: StudyTask['origin'];
}

export interface SessionInput {
  start: string;
  end?: string | null;
  minutes: number;
  mode: StudySession['mode'];
  subject: SubjectCode;
  exam: ExamScope;
  chapterId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
  taskId?: string | null;
  origin?: StudySession['origin'];
  notes?: string;
}

export interface LectureInput {
  title: string;
  subject: SubjectCode;
  chapterId?: string | null;
  topicId?: string | null;
  exam?: Lecture['exam'];
  number?: number;
  durationMin?: number;
  watchedMin?: number;
  status?: LectureStatus;
  source?: string;
  date?: string | null;
  notes?: string;
}

export interface QuestionInput {
  date: string;
  source: QuestionLog['source'];
  subject: SubjectCode;
  chapterId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
  exam: ExamScope;
  difficulty: QuestionLog['difficulty'];
  attempted: number;
  correct: number;
  wrong: number;
  unattempted: number;
  timeMin: number;
  notes?: string;
}

export interface MistakeInput {
  date: string;
  subject: SubjectCode;
  chapterId?: string | null;
  topicId?: string | null;
  subtopicId?: string | null;
  nodeId?: string | null;
  exam: ExamScope;
  source?: string;
  questionText: string;
  mistakeType: Mistake['mistakeType'];
  whatWentWrong?: string;
  correctConcept?: string;
  status?: Mistake['status'];
  image?: string | null;
  voiceNote?: string | null;
}

export interface TrackerActions {
  updateSettings(patch: SettingsPatch): void;
  syncAiStatus(serverKeyAvailable: boolean, model: string): void;

  setProgress(nodeId: string, exam: ExamScope, patch: Partial<TopicProgress>): void;
  bulkSetProgress(nodeIds: readonly string[], exam: ExamScope, patch: Partial<TopicProgress>): void;
  quickStatus(nodeId: string, exam: ExamScope, status: StudyStatus, leafIds: readonly string[]): void;
  addStudyMinutes(nodeId: string, exam: ExamScope, minutes: number, leafIds: readonly string[]): void;
  clearProgress(nodeIds: readonly string[]): void;

  addTask(input: TaskInput): StudyTask;
  addTasks(inputs: TaskInput[]): StudyTask[];
  updateTask(id: string, patch: Partial<StudyTask>): void;
  deleteTask(id: string): void;
  setTaskStatus(id: string, status: TaskStatus, actualMin?: number): void;
  rescheduleTask(id: string, date: string): void;
  moveTaskToBacklog(id: string): void;
  restoreTaskFromBacklog(id: string, date?: string): void;
  splitTask(id: string, parts: number, from: string): void;

  addLecture(input: LectureInput): void;
  updateLecture(id: string, patch: Partial<Lecture>): void;
  deleteLecture(id: string): void;
  setLectureStatus(id: string, status: LectureStatus): void;

  addSession(input: SessionInput): void;
  updateSession(id: string, patch: Partial<StudySession>): void;
  deleteSession(id: string): void;
  updateTimer(patch: Partial<TimerState>): void;
  startTimer(patch?: Partial<TimerState>): void;
  pauseTimer(): void;
  resumeTimer(): void;
  stopTimer(options?: { taskId?: string | null; notes?: string }): void;
  cancelTimer(): void;

  scheduleRevision(input: { nodeId: string; exam: ExamScope; scheduledFor: string; index?: number; note?: string }): void;
  completeRevision(id: string, confidence?: TopicProgress['confidence']): void;
  rescheduleRevision(id: string, date: string): void;
  deleteRevision(id: string): void;
  ensureAutoRevisions(nodeIds: readonly string[], exam: ExamScope): void;

  addQuestion(input: QuestionInput): void;
  updateQuestion(id: string, patch: Partial<QuestionLog>): void;
  deleteQuestion(id: string): void;

  addMistake(input: MistakeInput): void;
  updateMistake(id: string, patch: Partial<Mistake>): void;
  deleteMistake(id: string): void;
  setMistakeStatus(id: string, status: Mistake['status']): void;

  addTest(test: Omit<TestRecord, 'id' | 'createdAt' | 'updatedAt'>): TestRecord;
  updateTest(id: string, patch: Partial<TestRecord>): void;
  deleteTest(id: string): void;

  createChat(): string;
  selectChat(id: string): void;
  appendMessage(chatId: string, message: { role: 'user' | 'model'; text: string }): void;
  clearChat(chatId: string): void;
  deleteChat(chatId: string): void;
  setLastPlan(plan: AiPlan | null): void;
  removePlanItem(index: number): void;

  markOnboarded(): void;
  reload(): Promise<void>;
  exportJson(): string;
  importJson(text: string): Promise<{ counts: Record<string, number>; notes: string[]; kind: 'backup' | 'legacy' }>;
  backupToSlot(slot: number): Promise<void>;
  restoreSlot(slot: number): Promise<void>;
  resetAll(keepProfile: boolean): Promise<void>;
  loadSampleData(): Promise<void>;
  clearSampleData(): Promise<void>;
  sweepBacklogNow(): void;
}

interface TrackerContextValue {
  ready: boolean;
  error: string | null;
  storageAvailable: boolean;
  snapshot: TrackerSnapshot;
  index: DerivedIndex;
  actions: TrackerActions;
  toasts: Toast[];
  notify(message: string, tone?: Toast['tone']): void;
  dismissToast(id: string): void;
  /** Ticks once per second so the study clock re-renders without touching data. */
  clock: number;
}

const TrackerContext = createContext<TrackerContextValue | null>(null);

function emptySnapshot(): TrackerSnapshot {
  return {
    subjects,
    syllabusMeta,
    progress: {},
    tasks: [],
    lectures: [],
    sessions: [],
    revisions: [],
    questions: [],
    mistakes: [],
    tests: [],
    chats: [],
    activeChatId: null,
    lastPlan: null,
    settings: defaultSettings(),
    timer: defaultTimer(),
    meta: defaultMeta(),
  };
}

function mergeSettings(base: UserSettings, incoming?: SettingsPatch): UserSettings {
  if (!incoming) return base;
  return {
    ...base,
    ...incoming,
    profile: { ...base.profile, ...(incoming.profile ?? {}) },
    revision: { ...base.revision, ...(incoming.revision ?? {}) },
    ai: { ...base.ai, ...(incoming.ai ?? {}) },
  };
}

interface NodeMeta {
  chapterId: string;
  topicId: string | null;
  subtopicId: string | null;
  chapterName: string;
  topicName: string;
  subject: SubjectCode;
}

function nodeMeta(nodeId: string): NodeMeta | null {
  const node = nodeById(nodeId);
  if (!node || !node.chapter) return null;
  return {
    chapterId: node.chapter.id,
    topicId: node.topic?.id ?? null,
    subtopicId: node.kind === 'subtopic' ? node.id : null,
    chapterName: node.chapter.name,
    topicName: node.topic?.name ?? node.chapter.name,
    subject: node.subject.code,
  };
}

function leafIdsOf(nodeId: string, exam: ExamScope): string[] {
  const node = nodeById(nodeId);
  if (!node) return [];
  const leaves = leavesOf(nodeId, exam);
  if (leaves.length) return leaves.map((leaf) => leaf.id);
  return node.kind === 'subtopic' ? [node.id] : [];
}

export function TrackerProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [snapshot, setSnapshot] = useState<TrackerSnapshot>(() => emptySnapshot());
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [clock, setClock] = useState(() => Date.now());
  // Kept in sync inside `commit`/`load` (never during render) so the action
  // callbacks always read the latest snapshot without re-creating themselves.
  const snapshotRef = useRef(snapshot);

  const notify = useCallback((message: string, tone: Toast['tone'] = 'default') => {
    const toast: Toast = { id: uid('toast'), message, tone };
    setToasts((current) => [...current.slice(-3), toast]);
    setTimeout(() => setToasts((current) => current.filter((entry) => entry.id !== toast.id)), tone === 'error' ? 7000 : 3600);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const persist = useCallback(async (ops: PersistOp[]) => {
    if (!ops.length) return;
    try {
      for (const op of ops) {
        switch (op.store) {
          case 'tasks':
            if (op.put?.length) await repositories.tasks.putMany(op.put);
            if (op.remove?.length) await repositories.tasks.remove(op.remove);
            break;
          case 'lectures':
            if (op.put?.length) await repositories.lectures.putMany(op.put);
            if (op.remove?.length) await repositories.lectures.remove(op.remove);
            break;
          case 'sessions':
            if (op.put?.length) await repositories.sessions.putMany(op.put);
            if (op.remove?.length) await repositories.sessions.remove(op.remove);
            break;
          case 'revisions':
            if (op.put?.length) await repositories.revisions.putMany(op.put);
            if (op.remove?.length) await repositories.revisions.remove(op.remove);
            break;
          case 'questions':
            if (op.put?.length) await repositories.questions.putMany(op.put);
            if (op.remove?.length) await repositories.questions.remove(op.remove);
            break;
          case 'mistakes':
            if (op.put?.length) await repositories.mistakes.putMany(op.put);
            if (op.remove?.length) await repositories.mistakes.remove(op.remove);
            break;
          case 'tests':
            if (op.put?.length) await repositories.tests.putMany(op.put);
            if (op.remove?.length) await repositories.tests.remove(op.remove);
            break;
          case 'chats':
            if (op.put?.length) await repositories.chats.putMany(op.put);
            if (op.remove?.length) await repositories.chats.remove(op.remove);
            break;
          case 'progress':
            if (op.rows.length) await repositories.progress.putRows(op.rows);
            if (op.remove?.length) await repositories.progress.remove(op.remove);
            break;
          case 'settings':
            await repositories.settings.set(op.value);
            break;
          case 'meta':
            await repositories.meta.set(op.value);
            break;
          case 'timer':
            await repositories.timer.set(op.value);
            break;
          case 'plan':
            if (op.value) await repositories.plans.set(op.value);
            else await repositories.plans.clear();
            break;
          default:
            break;
        }
      }
    } catch (persistError) {
      setStorageAvailable(false);
      setError(persistError instanceof Error ? persistError.message : 'Could not write to local storage.');
    }
  }, []);

  /** Applies a partial change, refreshes meta, and persists exactly what changed. */
  const commit = useCallback(
    (changes: Partial<TrackerSnapshot>, ops: PersistOp[], options: { touchMeta?: boolean } = {}) => {
      const previous = snapshotRef.current;
      const touchMeta = options.touchMeta !== false;
      const meta: AppMeta = touchMeta ? { ...previous.meta, updatedAt: new Date().toISOString() } : previous.meta;
      const next: TrackerSnapshot = { ...previous, ...changes, meta };
      snapshotRef.current = next;
      setSnapshot(next);
      void persist(touchMeta ? [...ops, { store: 'meta', value: meta }] : ops);
    },
    [persist],
  );

  const commitSettings = useCallback(
    (patch: SettingsPatch) => {
      const next = mergeSettings(snapshotRef.current.settings, patch);
      commit({ settings: next }, [{ store: 'settings', value: next }]);
    },
    [commit],
  );

  const commitProgressRows = useCallback(
    (rows: ProgressRow[], progress: TrackerSnapshot['progress']) => {
      commit({ progress }, [{ store: 'progress', rows }]);
    },
    [commit],
  );

  /* ------------------------------------------------------------------- load */

  const load = useCallback(async () => {
    try {
      const [progress, tasks, lectures, sessions, revisions, questions, mistakes, tests, chats, settings, meta, timer, plan] =
        await Promise.all([
          repositories.progress.map(),
          repositories.tasks.list(),
          repositories.lectures.list(),
          repositories.sessions.list(),
          repositories.revisions.list(),
          repositories.questions.list(),
          repositories.mistakes.list(),
          repositories.tests.list(),
          repositories.chats.list(),
          repositories.settings.get(),
          repositories.meta.get(),
          repositories.timer.get(),
          repositories.plans.get(),
        ]);

      const base = emptySnapshot();
      let next: TrackerSnapshot = {
        ...base,
        progress,
        tasks,
        lectures,
        sessions,
        revisions,
        questions,
        mistakes,
        tests,
        chats: [...chats].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
        activeChatId: chats[0]?.id ?? null,
        settings: settings ? mergeSettings(base.settings, settings) : base.settings,
        meta: meta ?? base.meta,
        timer: timer ? { ...base.timer, ...timer } : base.timer,
        lastPlan: plan ?? null,
      };

      // ------------------------------------------------------- legacy import
      if (!meta) {
        const scan = scanLegacyStorage();
        const backup = [...scan.backups].sort((a, b) => b.slot - a.slot)[0];
        const source = scan.primary ?? backup?.state ?? null;
        if (source) {
          const migration = migrateLegacyState(source);
          if (migration.found) {
            next = {
              ...next,
              progress: { ...migration.progress, ...next.progress },
              tasks: migration.tasks,
              lectures: migration.lectures,
              sessions: migration.sessions,
              revisions: migration.revisions,
              questions: migration.questions,
              mistakes: migration.mistakes,
              tests: migration.tests,
              chats: migration.chats,
              settings: mergeSettings(mergeSettings(next.settings, migration.settings), {
                ai: { legacyKeyRemoved: migration.legacyApiKeyFound },
              }),
              timer: { ...next.timer, ...migration.timer },
              meta: {
                ...next.meta,
                onboarded: true,
                migration: {
                  ranAt: new Date().toISOString(),
                  source: 'localStorage-legacy',
                  found: true,
                  counts: migration.counts,
                  skipped: migration.skipped,
                  notes: migration.notes,
                },
              },
            };
            await Promise.all([
              repositories.tasks.putMany(migration.tasks),
              repositories.lectures.putMany(migration.lectures),
              repositories.sessions.putMany(migration.sessions),
              repositories.revisions.putMany(migration.revisions),
              repositories.questions.putMany(migration.questions),
              repositories.mistakes.putMany(migration.mistakes),
              repositories.tests.putMany(migration.tests),
              repositories.chats.putMany(migration.chats),
              repositories.progress.putRows(
                Object.entries(migration.progress).map(([nodeId, entry]) => ({ nodeId, jm: entry.jm, ja: entry.ja })),
              ),
              repositories.settings.set(next.settings),
              repositories.meta.set(next.meta),
            ]);
            notify(
              `Imported your previous tracker (${migration.counts.tasks ?? 0} tasks, ${migration.counts.questions ?? 0} question logs, ${migration.counts.progressNodes ?? 0} tracked nodes).`,
              'success',
            );
          }
        }
      }

      // ------------------------------------------------------- backlog sweep
      const today = todayISO();
      if (next.meta.lastBacklogSweep !== today) {
        const { updates, moved } = sweepBacklog(next, today);
        if (moved) {
          const map = new Map(updates.map((task) => [task.id, task]));
          next = {
            ...next,
            tasks: next.tasks.map((task) => map.get(task.id) ?? task),
            meta: { ...next.meta, lastBacklogSweep: today, updatedAt: new Date().toISOString() },
          };
          await Promise.all([repositories.tasks.putMany(updates), repositories.meta.set(next.meta)]);
          notify(`${moved} unfinished task${moved > 1 ? 's' : ''} moved to the backlog`);
        } else {
          next = { ...next, meta: { ...next.meta, lastBacklogSweep: today } };
          await repositories.meta.set(next.meta);
        }
      }

      snapshotRef.current = next;
      setSnapshot(next);
      setReady(true);
    } catch (loadError) {
      setStorageAvailable(false);
      setError(
        loadError instanceof Error
          ? `${loadError.message} The tracker is running in memory only - export your data to keep it.`
          : 'Local storage is unavailable; the tracker is running in memory only.',
      );
      setReady(true);
    }
  }, [notify]);

  useEffect(() => {
    // IndexedDB is an external system; the first read has to land in state once
    // the async load resolves, which is exactly what this effect is for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    const interval = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!snapshot.timer.running) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [snapshot.timer.running]);

  /* ------------------------------------------------------- progress helpers */

  const writeProgress = useCallback(
    (updates: { nodeId: string; exam: ExamScope; patch: Partial<TopicProgress> }[]) => {
      if (!updates.length) return;
      const progress: TrackerSnapshot['progress'] = { ...snapshotRef.current.progress };
      const rows = new Map<string, ProgressRow>();
      for (const update of updates) {
        const current = progress[update.nodeId] ?? {};
        const existing = current[update.exam] ?? emptyProgress();
        const merged: TopicProgress = { ...existing, ...update.patch };
        progress[update.nodeId] = { ...current, [update.exam]: merged };
        const row = rows.get(update.nodeId) ?? { nodeId: update.nodeId };
        row[update.exam] = merged;
        rows.set(update.nodeId, row);
      }
      commitProgressRows([...rows.values()], progress);
    },
    [commitProgressRows],
  );

  const logStudyMinutes = useCallback(
    (nodeId: string | null, exam: ExamScope, minutes: number, leafIds: readonly string[]) => {
      if (!nodeId || minutes <= 0) return;
      const ids = leafIds.length ? [...leafIds] : [nodeId];
      const perLeaf = minutes / ids.length;
      const progress: TrackerSnapshot['progress'] = { ...snapshotRef.current.progress };
      const rows = new Map<string, ProgressRow>();
      const today = todayISO();
      for (const id of ids) {
        const current = progress[id] ?? {};
        const existing = current[exam] ?? emptyProgress();
        const updated: TopicProgress = {
          ...existing,
          timeMin: Math.round((existing.timeMin + perLeaf) * 10) / 10,
          lastStudied: today,
        };
        progress[id] = { ...current, [exam]: updated };
        const row = rows.get(id) ?? { nodeId: id };
        row[exam] = updated;
        rows.set(id, row);
      }
      commitProgressRows([...rows.values()], progress);
    },
    [commitProgressRows],
  );

  /* ----------------------------------------------------------------- actions */

  const actions = useMemo<TrackerActions>(() => {
    const now = () => new Date().toISOString();

    const api: TrackerActions = {
      updateSettings(patch) {
        commitSettings(patch);
      },

      syncAiStatus(serverKeyAvailable, model) {
        commitSettings({ ai: { serverKeyAvailable, model, lastCheckedAt: new Date().toISOString() } });
      },

      setProgress(nodeId, exam, patch) {
        writeProgress([{ nodeId, exam, patch }]);
      },

      bulkSetProgress(nodeIds, exam, patch) {
        const ids = [...new Set(nodeIds)];
        writeProgress(ids.map((id) => ({ nodeId: id, exam, patch })));
        if (patch.status === 'completed' && snapshotRef.current.settings.revision.autoSchedule) {
          api.ensureAutoRevisions(ids, exam);
        }
      },

      quickStatus(nodeId, exam, status, leafIds) {
        const ids = leafIds.length ? [...leafIds] : [nodeId];
        const patch: Partial<TopicProgress> = { status };
        if (status === 'completed') patch.theory = 'done';
        if (status === 'not_started') {
          patch.weak = false;
          patch.theory = 'none';
          patch.confidence = null;
        }
        writeProgress(ids.map((id) => ({ nodeId: id, exam, patch })));
        if (status === 'completed' && snapshotRef.current.settings.revision.autoSchedule) {
          api.ensureAutoRevisions(ids, exam);
        }
      },

      addStudyMinutes(nodeId, exam, minutes, leafIds) {
        logStudyMinutes(nodeId, exam, minutes, leafIds);
      },

      clearProgress(nodeIds) {
        const progress = { ...snapshotRef.current.progress };
        for (const id of nodeIds) delete progress[id];
        commit({ progress }, [{ store: 'progress', rows: [], remove: [...nodeIds] }]);
      },

      addTask(input) {
        return api.addTasks([input])[0]!;
      },

      addTasks(inputs) {
        const created: StudyTask[] = inputs.map((input) => ({
          id: uid('task'),
          title: input.title.trim(),
          type: input.type ?? 'Topic study',
          link: input.link ?? (input.subtopicId ? 'subtopic' : input.topicId ? 'topic' : input.chapterId ? 'chapter' : 'custom'),
          status: input.status ?? 'pending',
          priority: input.priority ?? 'medium',
          exam: input.exam ?? 'jm',
          subject: input.subject ?? null,
          chapterId: input.chapterId ?? null,
          topicId: input.topicId ?? null,
          subtopicId: input.subtopicId ?? null,
          plannedFor: input.plannedFor ?? todayISO(),
          deadline: input.deadline ?? null,
          estMin: input.estMin ?? 45,
          actualMin: 0,
          notes: input.notes ?? '',
          inBacklog: input.inBacklog ?? false,
          backlogSince: null,
          origin: input.origin ?? 'manual',
          createdAt: now(),
          updatedAt: now(),
          completedAt: null,
        }));
        if (!created.length) return created;
        commit({ tasks: [...snapshotRef.current.tasks, ...created] }, [{ store: 'tasks', put: created }]);
        return created;
      },

      updateTask(id, patch) {
        const existing = snapshotRef.current.tasks.find((task) => task.id === id);
        if (!existing) return;
        const updated: StudyTask = { ...existing, ...patch, id, updatedAt: now() };
        commit({ tasks: snapshotRef.current.tasks.map((task) => (task.id === id ? updated : task)) }, [
          { store: 'tasks', put: [updated] },
        ]);
      },

      deleteTask(id) {
        commit({ tasks: snapshotRef.current.tasks.filter((task) => task.id !== id) }, [
          { store: 'tasks', remove: [id] },
        ]);
      },

      setTaskStatus(id, status, actualMin) {
        const existing = snapshotRef.current.tasks.find((task) => task.id === id);
        if (!existing) return;
        const updated: StudyTask = {
          ...existing,
          status,
          completedAt: status === 'completed' ? now() : null,
          inBacklog: status === 'completed' || status === 'skipped' ? false : existing.inBacklog,
          actualMin: actualMin ?? (status === 'completed' ? existing.actualMin || existing.estMin : existing.actualMin),
          updatedAt: now(),
        };
        commit({ tasks: snapshotRef.current.tasks.map((task) => (task.id === id ? updated : task)) }, [
          { store: 'tasks', put: [updated] },
        ]);
      },

      rescheduleTask(id, date) {
        api.updateTask(id, { plannedFor: date, inBacklog: false, backlogSince: null });
      },

      moveTaskToBacklog(id) {
        api.updateTask(id, { inBacklog: true, backlogSince: todayISO() });
      },

      restoreTaskFromBacklog(id, date) {
        api.updateTask(id, { inBacklog: false, backlogSince: null, plannedFor: date ?? todayISO() });
      },

      splitTask(id, parts, from) {
        const existing = snapshotRef.current.tasks.find((task) => task.id === id);
        if (!existing || parts < 2) return;
        const each = Math.max(10, Math.round(existing.estMin / parts));
        const baseTitle = existing.title.replace(/ \(part \d+\)$/, '');
        const first: StudyTask = {
          ...existing,
          title: `${baseTitle} (part 1)`,
          estMin: each,
          plannedFor: from,
          inBacklog: false,
          backlogSince: null,
          updatedAt: now(),
        };
        const created: StudyTask[] = [];
        for (let index = 1; index < parts; index += 1) {
          created.push({
            ...existing,
            id: uid('task'),
            title: `${baseTitle} (part ${index + 1})`,
            estMin: each,
            plannedFor: addDays(from, index),
            status: 'pending',
            completedAt: null,
            actualMin: 0,
            inBacklog: false,
            backlogSince: null,
            createdAt: now(),
            updatedAt: now(),
          });
        }
        commit({ tasks: [...snapshotRef.current.tasks.map((task) => (task.id === id ? first : task)), ...created] }, [
          { store: 'tasks', put: [first, ...created] },
        ]);
      },

      addLecture(input) {
        const lecture: Lecture = {
          id: uid('lec'),
          title: input.title.trim(),
          subject: input.subject,
          chapterId: input.chapterId ?? null,
          topicId: input.topicId ?? null,
          exam: input.exam ?? 'jm',
          number: input.number ?? 1,
          durationMin: input.durationMin ?? 60,
          watchedMin: input.watchedMin ?? 0,
          status: input.status ?? 'not_started',
          source: input.source ?? '',
          date: input.date ?? todayISO(),
          notes: input.notes ?? '',
          createdAt: now(),
          updatedAt: now(),
        };
        if (lecture.status === 'completed') lecture.watchedMin = lecture.durationMin;
        commit({ lectures: [...snapshotRef.current.lectures, lecture] }, [{ store: 'lectures', put: [lecture] }]);
      },

      updateLecture(id, patch) {
        const existing = snapshotRef.current.lectures.find((lecture) => lecture.id === id);
        if (!existing) return;
        const updated: Lecture = { ...existing, ...patch, id, updatedAt: now() };
        if (updated.status === 'completed') updated.watchedMin = updated.durationMin;
        commit({ lectures: snapshotRef.current.lectures.map((lecture) => (lecture.id === id ? updated : lecture)) }, [
          { store: 'lectures', put: [updated] },
        ]);
      },

      deleteLecture(id) {
        commit({ lectures: snapshotRef.current.lectures.filter((lecture) => lecture.id !== id) }, [
          { store: 'lectures', remove: [id] },
        ]);
      },

      setLectureStatus(id, status) {
        const lecture = snapshotRef.current.lectures.find((entry) => entry.id === id);
        if (!lecture) return;
        const watchedMin = status === 'completed' ? lecture.durationMin : lecture.watchedMin;
        api.updateLecture(id, { status, watchedMin });
        if (status === 'completed' && lecture.topicId) {
          logStudyMinutes(lecture.topicId, lecture.exam === 'ja' ? 'ja' : 'jm', Math.max(0, lecture.durationMin - lecture.watchedMin), []);
        }
      },

      addSession(input) {
        const session: StudySession = {
          id: uid('ses'),
          start: input.start,
          end: input.end ?? null,
          minutes: Math.max(0, Math.round(input.minutes)),
          mode: input.mode,
          subject: input.subject,
          exam: input.exam,
          chapterId: input.chapterId ?? null,
          topicId: input.topicId ?? null,
          subtopicId: input.subtopicId ?? null,
          taskId: input.taskId ?? null,
          origin: input.origin ?? 'manual',
          notes: input.notes ?? '',
          createdAt: now(),
        };
        const taskId = input.taskId ?? null;
        const tasks = taskId
          ? snapshotRef.current.tasks.map((task) =>
              task.id === taskId
                ? { ...task, actualMin: task.actualMin + session.minutes, status: (task.status === 'completed' ? task.status : 'in_progress') as TaskStatus, updatedAt: now() }
                : task,
            )
          : snapshotRef.current.tasks;
        const ops: PersistOp[] = [{ store: 'sessions', put: [session] }];
        if (taskId) {
          const changed = tasks.filter((task) => task.id === taskId);
          ops.push({ store: 'tasks', put: changed });
        }
        commit({ sessions: [...snapshotRef.current.sessions, session], tasks }, ops);

        const target = input.subtopicId ?? input.topicId ?? input.chapterId ?? null;
        if (target) logStudyMinutes(target, input.exam, session.minutes, []);
      },

      updateSession(id, patch) {
        const existing = snapshotRef.current.sessions.find((session) => session.id === id);
        if (!existing) return;
        const updated: StudySession = { ...existing, ...patch, id };
        commit({ sessions: snapshotRef.current.sessions.map((session) => (session.id === id ? updated : session)) }, [
          { store: 'sessions', put: [updated] },
        ]);
      },

      deleteSession(id) {
        commit({ sessions: snapshotRef.current.sessions.filter((session) => session.id !== id) }, [
          { store: 'sessions', remove: [id] },
        ]);
      },

      updateTimer(patch) {
        const timer: TimerState = { ...snapshotRef.current.timer, ...patch };
        commit({ timer }, [{ store: 'timer', value: timer }], { touchMeta: false });
      },

      startTimer(patch) {
        const timer: TimerState = {
          ...snapshotRef.current.timer,
          ...patch,
          running: true,
          startedAt: now(),
          pausedMs: 0,
          pausedAt: null,
        };
        commit({ timer }, [{ store: 'timer', value: timer }], { touchMeta: false });
      },

      pauseTimer() {
        const timer = snapshotRef.current.timer;
        if (!timer.running || timer.pausedAt) return;
        const paused: TimerState = { ...timer, pausedAt: now() };
        commit({ timer: paused }, [{ store: 'timer', value: paused }], { touchMeta: false });
      },

      resumeTimer() {
        const timer = snapshotRef.current.timer;
        if (!timer.running || !timer.pausedAt) return;
        const pausedMs = timer.pausedMs + Math.max(0, Date.now() - new Date(timer.pausedAt).getTime());
        const resumed: TimerState = { ...timer, pausedMs, pausedAt: null };
        commit({ timer: resumed }, [{ store: 'timer', value: resumed }], { touchMeta: false });
      },

      stopTimer(options) {
        const timer = snapshotRef.current.timer;
        if (!timer.running || !timer.startedAt) return;
        // While paused the clock stops at the pause timestamp, so the session
        // length never includes time the student was away.
        const endMs = timer.pausedAt ? new Date(timer.pausedAt).getTime() : Date.now();
        const elapsedMs = endMs - new Date(timer.startedAt).getTime() - timer.pausedMs;
        const minutes = Math.max(1, Math.round(elapsedMs / 60000));
        const stopped: TimerState = { ...timer, running: false, startedAt: null, pausedMs: 0, pausedAt: null };
        const taskId = options?.taskId ?? timer.taskId;
        const session: StudySession = {
          id: uid('ses'),
          start: timer.startedAt,
          end: now(),
          minutes,
          mode: timer.mode,
          subject: timer.subject,
          exam: timer.exam,
          chapterId: timer.chapterId,
          topicId: timer.topicId,
          subtopicId: timer.subtopicId,
          taskId,
          origin: 'timer',
          notes: options?.notes ?? '',
          createdAt: now(),
        };
        const tasks = taskId
          ? snapshotRef.current.tasks.map((task) =>
              task.id === taskId
                ? { ...task, actualMin: task.actualMin + minutes, status: (task.status === 'completed' ? task.status : 'in_progress') as TaskStatus, updatedAt: now() }
                : task,
            )
          : snapshotRef.current.tasks;
        const ops: PersistOp[] = [
          { store: 'timer', value: stopped },
          { store: 'sessions', put: [session] },
        ];
        if (taskId) ops.push({ store: 'tasks', put: tasks.filter((task) => task.id === taskId) });
        commit({ timer: stopped, sessions: [...snapshotRef.current.sessions, session], tasks }, ops);

        const target = timer.subtopicId ?? timer.topicId ?? timer.chapterId;
        if (target) logStudyMinutes(target, timer.exam, minutes, []);
      },

      cancelTimer() {
        const timer: TimerState = { ...snapshotRef.current.timer, running: false, startedAt: null, pausedMs: 0, pausedAt: null };
        commit({ timer }, [{ store: 'timer', value: timer }], { touchMeta: false });
      },

      scheduleRevision(input) {
        const meta = nodeMeta(input.nodeId);
        if (!meta) return;
        const revision: RevisionRecord = {
          id: uid('rev'),
          nodeId: input.nodeId,
          chapterId: meta.chapterId,
          topicId: meta.topicId,
          subtopicId: meta.subtopicId,
          chapterName: meta.chapterName,
          topicName: meta.topicName,
          subject: meta.subject,
          exam: input.exam,
          index: input.index ?? 1,
          scheduledFor: input.scheduledFor,
          completedAt: null,
          completedOn: null,
          confidence: null,
          note: input.note ?? '',
          auto: false,
          createdAt: now(),
        };
        commit({ revisions: [...snapshotRef.current.revisions, revision] }, [{ store: 'revisions', put: [revision] }]);
      },

      completeRevision(id, confidence) {
        const existing = snapshotRef.current.revisions.find((revision) => revision.id === id);
        if (!existing) return;
        const completedOn = todayISO();
        const updated: RevisionRecord = {
          ...existing,
          completedAt: now(),
          completedOn,
          confidence: confidence ?? existing.confidence,
        };
        const index = withIndex(snapshotRef.current);
        const followUp = snapshotRef.current.settings.revision.autoSchedule
          ? nextRevisionAfter(index, updated, snapshotRef.current.settings.revision.intervals)
          : null;
        commit(
          {
            revisions: [
              ...snapshotRef.current.revisions.map((revision) => (revision.id === id ? updated : revision)),
              ...(followUp ? [followUp] : []),
            ],
          },
          [{ store: 'revisions', put: followUp ? [updated, followUp] : [updated] }],
        );

        const leaves = leafIdsOf(existing.nodeId, existing.exam);
        const patch: Partial<TopicProgress> = {
          revisionCount: Math.max(existing.index, 1),
          lastRevision: completedOn,
          nextRevision: followUp?.scheduledFor ?? null,
          lastStudied: completedOn,
        };
        if (confidence) patch.confidence = confidence;
        writeProgress(leaves.map((leafId) => ({ nodeId: leafId, exam: existing.exam, patch })));
      },

      rescheduleRevision(id, date) {
        const existing = snapshotRef.current.revisions.find((revision) => revision.id === id);
        if (!existing) return;
        const updated: RevisionRecord = { ...existing, scheduledFor: date };
        commit({ revisions: snapshotRef.current.revisions.map((revision) => (revision.id === id ? updated : revision)) }, [
          { store: 'revisions', put: [updated] },
        ]);
      },

      deleteRevision(id) {
        commit({ revisions: snapshotRef.current.revisions.filter((revision) => revision.id !== id) }, [
          { store: 'revisions', remove: [id] },
        ]);
      },

      ensureAutoRevisions(nodeIds, exam) {
        const ids = [...new Set(nodeIds)];
        if (!ids.length) return;
        const index = withIndex(snapshotRef.current);
        const intervals = snapshotRef.current.settings.revision.intervals;
        const isFreshInstall = index.snapshot.revisions.length === 0;
        const drafts: RevisionRecord[] = [];
        for (const nodeId of ids) {
          const leafIds = leafIdsOf(nodeId, exam);
          for (const leafId of leafIds) {
            const node = nodeById(leafId);
            const leaf = node?.subtopic;
            if (!leaf) continue;
            const existing = index.revisionsByNode.get(leafId)?.filter((revision) => revision.exam === exam) ?? [];
            if (existing.some((revision) => !revision.completedAt)) continue;
            const completedCount = existing.filter((revision) => revision.completedAt).length;
            const progress = index.progress.get(leafId)?.[exam];
            if (progress && progress.revisionCount > completedCount) continue;
            for (const draft of autoRevisionDrafts(index, [leaf], exam, intervals)) {
              if (draft.index === completedCount + 1) drafts.push(draft);
            }
          }
        }
        if (!drafts.length) return;
        commit({ revisions: [...snapshotRef.current.revisions, ...drafts] }, [{ store: 'revisions', put: drafts }]);
        notify(
          `${drafts.length} revision${drafts.length > 1 ? 's' : ''} scheduled${isFreshInstall ? ` - first one due ${scheduleDateFor(1, intervals)}` : ''}`,
        );
      },

      addQuestion(input) {
        const log: QuestionLog = {
          id: uid('q'),
          date: input.date,
          source: input.source,
          subject: input.subject,
          chapterId: input.chapterId ?? null,
          topicId: input.topicId ?? null,
          subtopicId: input.subtopicId ?? null,
          nodeId: input.subtopicId ?? input.topicId ?? input.chapterId ?? null,
          exam: input.exam,
          difficulty: input.difficulty,
          attempted: input.attempted,
          correct: input.correct,
          wrong: input.wrong,
          unattempted: input.unattempted,
          timeMin: input.timeMin,
          accuracy: input.attempted ? Math.round((input.correct / input.attempted) * 100) : 0,
          notes: input.notes ?? '',
          createdAt: now(),
        };
        commit({ questions: [...snapshotRef.current.questions, log] }, [{ store: 'questions', put: [log] }]);

        const target = input.subtopicId ?? input.topicId ?? input.chapterId ?? null;
        if (target) {
          const dimension = input.source === 'PYQ' ? 'pyq' : input.source === 'DPP' ? 'dpp' : 'practice';
          const leaves = leafIdsOf(target, input.exam);
          const patch = { [dimension]: 'done', lastStudied: input.date } as Partial<TopicProgress>;
          writeProgress(leaves.map((leafId) => ({ nodeId: leafId, exam: input.exam, patch })));
        }

        if (log.nodeId && log.attempted >= 8 && log.accuracy < 45) {
          const leaves = leafIdsOf(log.nodeId, input.exam);
          writeProgress(leaves.map((leafId) => ({ nodeId: leafId, exam: input.exam, patch: { weak: true } })));
          notify('Accuracy under 45% - that subtopic is now flagged weak', 'default');
        }
      },

      updateQuestion(id, patch) {
        const existing = snapshotRef.current.questions.find((log) => log.id === id);
        if (!existing) return;
        const updated: QuestionLog = { ...existing, ...patch, id };
        updated.accuracy = updated.attempted ? Math.round((updated.correct / updated.attempted) * 100) : 0;
        commit({ questions: snapshotRef.current.questions.map((log) => (log.id === id ? updated : log)) }, [
          { store: 'questions', put: [updated] },
        ]);
      },

      deleteQuestion(id) {
        commit({ questions: snapshotRef.current.questions.filter((log) => log.id !== id) }, [
          { store: 'questions', remove: [id] },
        ]);
      },

      addMistake(input) {
        const mistake: Mistake = {
          id: uid('err'),
          date: input.date,
          subject: input.subject,
          chapterId: input.chapterId ?? null,
          topicId: input.topicId ?? null,
          subtopicId: input.subtopicId ?? null,
          nodeId: input.nodeId ?? input.subtopicId ?? input.topicId ?? input.chapterId ?? null,
          exam: input.exam,
          source: input.source ?? '',
          questionText: input.questionText,
          mistakeType: input.mistakeType,
          whatWentWrong: input.whatWentWrong ?? '',
          correctConcept: input.correctConcept ?? '',
          status: input.status ?? 'open',
          revisions: 0,
          lastRevised: null,
          image: input.image ?? null,
          voiceNote: input.voiceNote ?? null,
          createdAt: now(),
          updatedAt: now(),
        };
        commit({ mistakes: [...snapshotRef.current.mistakes, mistake] }, [{ store: 'mistakes', put: [mistake] }]);
      },

      updateMistake(id, patch) {
        const existing = snapshotRef.current.mistakes.find((mistake) => mistake.id === id);
        if (!existing) return;
        const updated: Mistake = { ...existing, ...patch, id, updatedAt: now() };
        commit({ mistakes: snapshotRef.current.mistakes.map((mistake) => (mistake.id === id ? updated : mistake)) }, [
          { store: 'mistakes', put: [updated] },
        ]);
      },

      deleteMistake(id) {
        commit({ mistakes: snapshotRef.current.mistakes.filter((mistake) => mistake.id !== id) }, [
          { store: 'mistakes', remove: [id] },
        ]);
      },

      setMistakeStatus(id, status) {
        const existing = snapshotRef.current.mistakes.find((mistake) => mistake.id === id);
        if (!existing) return;
        api.updateMistake(id, {
          status,
          revisions: status === 'open' ? existing.revisions : existing.revisions + 1,
          lastRevised: status === 'open' ? existing.lastRevised : todayISO(),
        });
      },

      addTest(input) {
        const test: TestRecord = { ...input, id: uid('test'), createdAt: now(), updatedAt: now() };
        commit({ tests: [...snapshotRef.current.tests, test] }, [{ store: 'tests', put: [test] }]);
        return test;
      },

      updateTest(id, patch) {
        const existing = snapshotRef.current.tests.find((test) => test.id === id);
        if (!existing) return;
        const updated: TestRecord = { ...existing, ...patch, id, updatedAt: now() };
        commit({ tests: snapshotRef.current.tests.map((test) => (test.id === id ? updated : test)) }, [
          { store: 'tests', put: [updated] },
        ]);
      },

      deleteTest(id) {
        commit({ tests: snapshotRef.current.tests.filter((test) => test.id !== id) }, [
          { store: 'tests', remove: [id] },
        ]);
      },

      createChat() {
        const chat: AiChat = { id: uid('chat'), title: 'New chat', createdAt: now(), updatedAt: now(), messages: [] };
        commit({ chats: [chat, ...snapshotRef.current.chats], activeChatId: chat.id }, [{ store: 'chats', put: [chat] }]);
        return chat.id;
      },

      selectChat(id) {
        commit({ activeChatId: id }, [], { touchMeta: false });
      },

      appendMessage(chatId, message) {
        const chat = snapshotRef.current.chats.find((entry) => entry.id === chatId);
        if (!chat) return;
        const updated: AiChat = {
          ...chat,
          title: chat.messages.length === 0 && message.role === 'user' ? message.text.slice(0, 48) : chat.title,
          updatedAt: now(),
          messages: [...chat.messages, { id: uid('msg'), role: message.role, text: message.text, ts: now() }],
        };
        commit({ chats: snapshotRef.current.chats.map((entry) => (entry.id === chatId ? updated : entry)) }, [
          { store: 'chats', put: [updated] },
        ]);
      },

      clearChat(chatId) {
        const chat = snapshotRef.current.chats.find((entry) => entry.id === chatId);
        if (!chat) return;
        const updated: AiChat = { ...chat, messages: [], title: 'New chat', updatedAt: now() };
        commit({ chats: snapshotRef.current.chats.map((entry) => (entry.id === chatId ? updated : entry)) }, [
          { store: 'chats', put: [updated] },
        ]);
      },

      deleteChat(chatId) {
        const remaining = snapshotRef.current.chats.filter((entry) => entry.id !== chatId);
        commit({ chats: remaining, activeChatId: remaining[0]?.id ?? null }, [{ store: 'chats', remove: [chatId] }]);
      },

      setLastPlan(plan) {
        commit({ lastPlan: plan }, [{ store: 'plan', value: plan }]);
      },

      removePlanItem(indexToRemove) {
        const plan = snapshotRef.current.lastPlan;
        if (!plan) return;
        const items = plan.items.filter((_, position) => position !== indexToRemove);
        const next: AiPlan = { ...plan, items, usedMinutes: items.reduce((total, item) => total + item.estMin, 0) };
        commit({ lastPlan: next }, [{ store: 'plan', value: next }]);
      },

      markOnboarded() {
        commit({ meta: { ...snapshotRef.current.meta, onboarded: true } }, []);
      },

      async reload() {
        await load();
      },

      exportJson() {
        return serializeExport(snapshotRef.current);
      },

      async importJson(text) {
        const result = parseImport(text);
        const base = snapshotRef.current;
        const next: TrackerSnapshot = {
          ...base,
          progress: result.data.progress ?? base.progress,
          tasks: result.data.tasks ?? base.tasks,
          lectures: result.data.lectures ?? base.lectures,
          sessions: result.data.sessions ?? base.sessions,
          revisions: result.data.revisions ?? base.revisions,
          questions: result.data.questions ?? base.questions,
          mistakes: result.data.mistakes ?? base.mistakes,
          tests: result.data.tests ?? base.tests,
          chats: result.data.chats ?? base.chats,
          settings: mergeSettings(base.settings, result.data.settings),
          timer: { ...base.timer, ...(result.data.timer ?? {}) },
          meta: {
            ...base.meta,
            migration: {
              ranAt: new Date().toISOString(),
              source: 'import',
              found: true,
              counts: result.counts,
              skipped: result.skipped,
              notes: result.notes,
            },
            updatedAt: new Date().toISOString(),
          },
        };
        snapshotRef.current = next;
        setSnapshot(next);

        await Promise.all([
          repositories.progress.clear(),
          repositories.tasks.clear(),
          repositories.lectures.clear(),
          repositories.sessions.clear(),
          repositories.revisions.clear(),
          repositories.questions.clear(),
          repositories.mistakes.clear(),
          repositories.tests.clear(),
          repositories.chats.clear(),
        ]);
        await Promise.all([
          repositories.progress.putRows(Object.entries(next.progress).map(([nodeId, entry]) => ({ nodeId, jm: entry.jm, ja: entry.ja }))),
          repositories.tasks.putMany(next.tasks),
          repositories.lectures.putMany(next.lectures),
          repositories.sessions.putMany(next.sessions),
          repositories.revisions.putMany(next.revisions),
          repositories.questions.putMany(next.questions),
          repositories.mistakes.putMany(next.mistakes),
          repositories.tests.putMany(next.tests),
          repositories.chats.putMany(next.chats),
          repositories.settings.set(next.settings),
          repositories.meta.set(next.meta),
        ]);
        return { counts: result.counts, notes: result.notes, kind: result.kind };
      },

      async backupToSlot(slot) {
        const payload = serializeBackup(snapshotRef.current);
        await repositories.backups.put({
          id: `backup-${slot}`,
          slot,
          createdAt: new Date().toISOString(),
          bytes: payload.bytes,
          records: payload.records,
          payload: payload.payload,
        });
      },

      async restoreSlot(slot) {
        const row = await repositories.backups.get(`backup-${slot}`);
        if (!row) throw new Error(`Backup slot ${slot} is empty.`);
        await api.importJson(row.payload);
      },

      async resetAll(keepProfile) {
        const settings = snapshotRef.current.settings;
        const next: TrackerSnapshot = {
          ...emptySnapshot(),
          settings: keepProfile ? settings : defaultSettings(),
          meta: { ...defaultMeta(), onboarded: true },
        };
        snapshotRef.current = next;
        setSnapshot(next);
        await clearAllData();
        await Promise.all([repositories.settings.set(next.settings), repositories.meta.set(next.meta)]);
      },

      async loadSampleData() {
        const sample = buildSampleData();
        const base = snapshotRef.current;
        const next: TrackerSnapshot = {
          ...base,
          progress: { ...base.progress, ...sample.progress },
          tasks: sample.tasks,
          lectures: sample.lectures,
          sessions: sample.sessions,
          revisions: sample.revisions,
          questions: sample.questions,
          mistakes: sample.mistakes,
          tests: sample.tests,
          settings: mergeSettings(base.settings, sample.settings),
          meta: { ...base.meta, sampleDataLoaded: true, onboarded: true },
        };
        snapshotRef.current = next;
        setSnapshot(next);
        await Promise.all([
          repositories.progress.putRows(Object.entries(sample.progress).map(([nodeId, entry]) => ({ nodeId, jm: entry.jm, ja: entry.ja }))),
          repositories.tasks.putMany(sample.tasks),
          repositories.lectures.putMany(sample.lectures),
          repositories.sessions.putMany(sample.sessions),
          repositories.revisions.putMany(sample.revisions),
          repositories.questions.putMany(sample.questions),
          repositories.mistakes.putMany(sample.mistakes),
          repositories.tests.putMany(sample.tests),
          repositories.settings.set(next.settings),
          repositories.meta.set(next.meta),
        ]);
      },

      async clearSampleData() {
        if (!snapshotRef.current.meta.sampleDataLoaded) return;
        await api.resetAll(true);
      },

      sweepBacklogNow() {
        const { updates, moved } = sweepBacklog(snapshotRef.current);
        if (!moved) return;
        const map = new Map(updates.map((task) => [task.id, task]));
        commit({ tasks: snapshotRef.current.tasks.map((task) => map.get(task.id) ?? task) }, [
          { store: 'tasks', put: updates },
        ]);
      },
    };

    return api;
  }, [commit, commitSettings, load, logStudyMinutes, notify, writeProgress]);

  const index = useMemo(() => withIndex(snapshot), [snapshot]);

  const value = useMemo<TrackerContextValue>(
    () => ({ ready, error, storageAvailable, snapshot, index, actions, toasts, notify, dismissToast, clock }),
    [ready, error, storageAvailable, snapshot, index, actions, toasts, notify, dismissToast, clock],
  );

  return <TrackerContext.Provider value={value}>{children}</TrackerContext.Provider>;
}

export function useTracker(): TrackerContextValue {
  const context = useContext(TrackerContext);
  if (!context) throw new Error('useTracker must be used inside <TrackerProvider>');
  return context;
}

export function useActions(): TrackerActions {
  return useTracker().actions;
}

export function useSnapshot(): TrackerSnapshot {
  return useTracker().snapshot;
}

export function useDerivedIndex(): DerivedIndex {
  return useTracker().index;
}

export { LEGACY_STORAGE_KEY };

/** Empty progress record, re-exported for forms that build a fresh patch. */
export { emptyProgress };
