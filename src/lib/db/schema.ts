/**
 * Database schema + connection handling.
 *
 * One IndexedDB database holds every collection. Records are stored one row per
 * entity so a large tracker (tens of thousands of rows) is written incrementally
 * instead of rewriting a single blob - which is exactly what the old
 * localStorage implementation had to do.
 */
import { openDatabase } from '@/lib/db/idb';

export const DB_NAME = 'jee-command-center';
export const DB_VERSION = 2;

/** Multi-record stores (keyed by `id`, or by nodeId for progress). */
export const COLLECTION_STORES = {
  progress: 'progress',
  tasks: 'tasks',
  lectures: 'lectures',
  sessions: 'sessions',
  revisions: 'revisions',
  questions: 'questions',
  mistakes: 'mistakes',
  tests: 'tests',
  chats: 'chats',
  backups: 'backups',
} as const;

/** Single-record stores (key is always `app`). */
export const SINGLETON_STORES = {
  settings: 'settings',
  meta: 'meta',
  timer: 'timer',
  plans: 'plans',
} as const;

export type CollectionStoreName = (typeof COLLECTION_STORES)[keyof typeof COLLECTION_STORES];
export type SingletonStoreName = (typeof SINGLETON_STORES)[keyof typeof SINGLETON_STORES];

export const ALL_STORES: readonly string[] = [...Object.values(COLLECTION_STORES), ...Object.values(SINGLETON_STORES)];

function upgrade(db: IDBDatabase): void {
  // Collections keyed by a stable string id.
  const byId: [string, IndexSpecLike[]][] = [
    [COLLECTION_STORES.tasks, [{ name: 'plannedFor', keyPath: 'plannedFor' }, { name: 'status', keyPath: 'status' }]],
    [COLLECTION_STORES.lectures, [{ name: 'subject', keyPath: 'subject' }, { name: 'status', keyPath: 'status' }]],
    [COLLECTION_STORES.sessions, [{ name: 'subject', keyPath: 'subject' }, { name: 'start', keyPath: 'start' }]],
    [
      COLLECTION_STORES.revisions,
      [
        { name: 'scheduledFor', keyPath: 'scheduledFor' },
        { name: 'nodeId', keyPath: 'nodeId' },
        { name: 'exam', keyPath: 'exam' },
      ],
    ],
    [
      COLLECTION_STORES.questions,
      [
        { name: 'date', keyPath: 'date' },
        { name: 'subject', keyPath: 'subject' },
      ],
    ],
    [COLLECTION_STORES.mistakes, [{ name: 'date', keyPath: 'date' }, { name: 'subject', keyPath: 'subject' }]],
    [COLLECTION_STORES.tests, [{ name: 'date', keyPath: 'date' }, { name: 'exam', keyPath: 'exam' }]],
    [COLLECTION_STORES.chats, []],
    [COLLECTION_STORES.backups, []],
  ];

  for (const [name, indexes] of byId) {
    const store = db.objectStoreNames.contains(name) ? null : db.createObjectStore(name, { keyPath: 'id' });
    if (!store) continue;
    for (const index of indexes) store.createIndex(index.name, index.keyPath, { unique: false });
  }

  // Progress is keyed by syllabus node id.
  if (!db.objectStoreNames.contains(COLLECTION_STORES.progress)) {
    db.createObjectStore(COLLECTION_STORES.progress, { keyPath: 'nodeId' });
  }

  // Settings / meta / timer / plans keep exactly one record each.
  for (const name of Object.values(SINGLETON_STORES)) {
    if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'key' });
  }
}

interface IndexSpecLike {
  name: string;
  keyPath: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

/** Opens (and caches) the database connection. */
export function getDatabase(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = openDatabase(DB_NAME, DB_VERSION, upgrade).catch((error: unknown) => {
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

export function resetDatabaseConnection(): void {
  dbPromise = null;
}
