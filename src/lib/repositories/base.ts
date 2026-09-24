/**
 * Generic entity repository.
 *
 * Every collection gets the same six operations, which keeps the write path in
 * the store tiny and makes the persistence layer trivially replaceable.
 */
import { getAll, putAll, putOne, deleteMany, clearStores, getOne } from '@/lib/db/idb';
import { getDatabase } from '@/lib/db/schema';

export interface Identified {
  id: string;
}

export interface Repository<T extends Identified> {
  list(): Promise<T[]>;
  get(id: string): Promise<T | undefined>;
  put(record: T): Promise<void>;
  putMany(records: readonly T[]): Promise<void>;
  remove(ids: readonly string[]): Promise<void>;
  clear(): Promise<void>;
}

export function createRepository<T extends Identified>(storeName: string): Repository<T> {
  return {
    async list() {
      const db = await getDatabase();
      return getAll<T>(db, storeName);
    },
    async get(id) {
      const db = await getDatabase();
      return getOne<T>(db, storeName, id);
    },
    async put(record) {
      const db = await getDatabase();
      await putOne(db, storeName, record);
    },
    async putMany(records) {
      if (!records.length) return;
      const db = await getDatabase();
      await putAll(db, storeName, records);
    },
    async remove(ids) {
      if (!ids.length) return;
      const db = await getDatabase();
      await deleteMany(db, storeName, ids);
    },
    async clear() {
      const db = await getDatabase();
      await clearStores(db, [storeName]);
    },
  };
}

export interface SingletonRepository<T> {
  get(): Promise<T | undefined>;
  set(value: T): Promise<void>;
  clear(): Promise<void>;
}

const SINGLETON_KEY = 'app';

/** Single-record store helper (settings, meta, timer, plans). */
export function createSingletonRepository<T>(storeName: string): SingletonRepository<T> {
  return {
    async get() {
      const db = await getDatabase();
      const row = await getOne<{ key: string; value: T }>(db, storeName, SINGLETON_KEY);
      return row?.value;
    },
    async set(value) {
      const db = await getDatabase();
      await putOne(db, storeName, { key: SINGLETON_KEY, value });
    },
    async clear() {
      const db = await getDatabase();
      await clearStores(db, [storeName]);
    },
  };
}
