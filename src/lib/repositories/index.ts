/**
 * Typed repositories for every stored collection.
 *
 * Progress is stored as one row per syllabus node (`{ nodeId, jm?, ja? }`) so a
 * single subtopic update rewrites a few hundred bytes instead of the whole map -
 * the main scalability win over the previous single-blob localStorage design.
 */
import { ALL_STORES, COLLECTION_STORES, SINGLETON_STORES, getDatabase } from '@/lib/db/schema';
import { clearStores, deleteMany, getAll, putAll } from '@/lib/db/idb';
import { createRepository, createSingletonRepository, type Repository } from '@/lib/repositories/base';
import type {
  AiChat,
  AiPlan,
  AppMeta,
  ExamScope,
  Lecture,
  Mistake,
  ProgressMap,
  QuestionLog,
  RevisionRecord,
  StudySession,
  StudyTask,
  TestRecord,
  TimerState,
  TopicProgress,
  UserSettings,
} from '@/lib/types';

export interface ProgressRow {
  nodeId: string;
  jm?: TopicProgress;
  ja?: TopicProgress;
}

export interface BackupRow {
  id: string;
  slot: number;
  createdAt: string;
  bytes: number;
  records: number;
  payload: string;
}

export interface ProgressRepository {
  list(): Promise<ProgressRow[]>;
  map(): Promise<ProgressMap>;
  putRows(rows: readonly ProgressRow[]): Promise<void>;
  remove(nodeIds: readonly string[]): Promise<void>;
  clear(): Promise<void>;
}

export interface Repositories {
  progress: ProgressRepository;
  tasks: Repository<StudyTask>;
  lectures: Repository<Lecture>;
  sessions: Repository<StudySession>;
  revisions: Repository<RevisionRecord>;
  questions: Repository<QuestionLog>;
  mistakes: Repository<Mistake>;
  tests: Repository<TestRecord>;
  chats: Repository<AiChat>;
  backups: Repository<BackupRow>;
  settings: ReturnType<typeof createSingletonRepository<UserSettings>>;
  meta: ReturnType<typeof createSingletonRepository<AppMeta>>;
  timer: ReturnType<typeof createSingletonRepository<TimerState>>;
  plans: ReturnType<typeof createSingletonRepository<AiPlan>>;
}

const progressRepository: ProgressRepository = {
  async list() {
    const db = await getDatabase();
    return getAll<ProgressRow>(db, COLLECTION_STORES.progress);
  },
  async map() {
    const rows = await this.list();
    const out: ProgressMap = {};
    for (const row of rows) {
      const entry: Partial<Record<ExamScope, TopicProgress>> = {};
      if (row.jm) entry.jm = row.jm;
      if (row.ja) entry.ja = row.ja;
      out[row.nodeId] = entry;
    }
    return out;
  },
  async putRows(rows) {
    if (!rows.length) return;
    const db = await getDatabase();
    await putAll(db, COLLECTION_STORES.progress, rows);
  },
  async remove(nodeIds) {
    if (!nodeIds.length) return;
    const db = await getDatabase();
    await deleteMany(db, COLLECTION_STORES.progress, nodeIds);
  },
  async clear() {
    const db = await getDatabase();
    await clearStores(db, [COLLECTION_STORES.progress]);
  },
};

export const repositories: Repositories = {
  progress: progressRepository,
  tasks: createRepository<StudyTask>(COLLECTION_STORES.tasks),
  lectures: createRepository<Lecture>(COLLECTION_STORES.lectures),
  sessions: createRepository<StudySession>(COLLECTION_STORES.sessions),
  revisions: createRepository<RevisionRecord>(COLLECTION_STORES.revisions),
  questions: createRepository<QuestionLog>(COLLECTION_STORES.questions),
  mistakes: createRepository<Mistake>(COLLECTION_STORES.mistakes),
  tests: createRepository<TestRecord>(COLLECTION_STORES.tests),
  chats: createRepository<AiChat>(COLLECTION_STORES.chats),
  backups: createRepository<BackupRow>(COLLECTION_STORES.backups),
  settings: createSingletonRepository<UserSettings>(SINGLETON_STORES.settings),
  meta: createSingletonRepository<AppMeta>(SINGLETON_STORES.meta),
  timer: createSingletonRepository<TimerState>(SINGLETON_STORES.timer),
  plans: createSingletonRepository<AiPlan>(SINGLETON_STORES.plans),
};

/** Removes every record. Used by "reset tracker" after a confirmation. */
export async function clearAllData(): Promise<void> {
  const db = await getDatabase();
  await clearStores(db, ALL_STORES);
}

/** Approximate on-disk footprint of the tracker data, in bytes. */
export async function estimateStorageBytes(): Promise<number> {
  if (typeof navigator === 'undefined' || !navigator.storage?.estimate) return 0;
  const estimate = await navigator.storage.estimate();
  return estimate.usage ?? 0;
}

export type { Repository };
