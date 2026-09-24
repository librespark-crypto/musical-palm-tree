/**
 * A very small promise wrapper around IndexedDB.
 *
 * Deliberately dependency-free: the app needs getAll / get / put / bulkPut /
 * delete / clear / count and nothing else, and a 100-line wrapper is easier to
 * audit than a library for that surface. Every helper is safe to call in a
 * server or test context (it rejects with a clear message instead of throwing
 * a ReferenceError).
 */

export interface IndexSpec {
  name: string;
  keyPath: string;
  unique?: boolean;
}

export interface StoreSpec {
  name: string;
  keyPath: string;
  indexes?: IndexSpec[];
}

export class StorageUnavailableError extends Error {
  constructor(message = 'IndexedDB is not available in this browser context.') {
    super(message);
    this.name = 'StorageUnavailableError';
  }
}

function factory(): IDBFactory {
  if (typeof indexedDB === 'undefined') throw new StorageUnavailableError();
  return indexedDB;
}

export function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed'));
  });
}

export function openDatabase(name: string, version: number, upgrade: (db: IDBDatabase) => void): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory().open(name, version);
    } catch (error) {
      reject(error instanceof Error ? error : new StorageUnavailableError());
      return;
    }
    request.onupgradeneeded = () => {
      try {
        upgrade(request.result);
      } catch (error) {
        reject(error instanceof Error ? error : new Error('IndexedDB upgrade failed'));
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('Could not open the local database'));
    request.onblocked = () => reject(new Error('Another tab is holding an older version of the database. Close it and retry.'));
  });
}

function run<T>(
  db: IDBDatabase,
  storeName: string | string[],
  mode: IDBTransactionMode,
  executor: (tx: IDBTransaction) => Promise<T> | T,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let tx: IDBTransaction;
    try {
      tx = db.transaction(storeName, mode);
    } catch (error) {
      reject(error instanceof Error ? error : new Error('Could not start a database transaction'));
      return;
    }
    let result: T;
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error ?? new Error('Database transaction failed'));
    tx.onabort = () => reject(tx.error ?? new Error('Database transaction aborted'));
    Promise.resolve()
      .then(() => executor(tx))
      .then((value) => {
        result = value;
      })
      .catch((error: unknown) => {
        try {
          tx.abort();
        } catch {
          // transaction already finished
        }
        reject(error instanceof Error ? error : new Error(String(error)));
      });
  });
}

export function getAll<T>(db: IDBDatabase, storeName: string): Promise<T[]> {
  return run(db, storeName, 'readonly', async (tx) => requestToPromise<T[]>(tx.objectStore(storeName).getAll() as IDBRequest<T[]>));
}

export function getOne<T>(db: IDBDatabase, storeName: string, key: IDBValidKey): Promise<T | undefined> {
  return run(db, storeName, 'readonly', async (tx) => requestToPromise<T>(tx.objectStore(storeName).get(key) as IDBRequest<T>));
}

export function count(db: IDBDatabase, storeName: string): Promise<number> {
  return run(db, storeName, 'readonly', async (tx) => requestToPromise<number>(tx.objectStore(storeName).count()));
}

export function putAll<T>(db: IDBDatabase, storeName: string, values: readonly T[]): Promise<number> {
  if (!values.length) return Promise.resolve(0);
  return run(db, storeName, 'readwrite', async (tx) => {
    const store = tx.objectStore(storeName);
    for (const value of values) store.put(value);
    return values.length;
  });
}

export function putOne<T>(db: IDBDatabase, storeName: string, value: T): Promise<void> {
  return run(db, storeName, 'readwrite', async (tx) => {
    tx.objectStore(storeName).put(value);
  });
}

export function deleteMany(db: IDBDatabase, storeName: string, keys: readonly IDBValidKey[]): Promise<void> {
  if (!keys.length) return Promise.resolve();
  return run(db, storeName, 'readwrite', async (tx) => {
    const store = tx.objectStore(storeName);
    for (const key of keys) store.delete(key);
  });
}

export function clearStores(db: IDBDatabase, storeNames: readonly string[]): Promise<void> {
  if (!storeNames.length) return Promise.resolve();
  return run(db, [...storeNames], 'readwrite', async (tx) => {
    for (const name of storeNames) tx.objectStore(name).clear();
  });
}

export function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = factory().deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error('Could not delete the local database'));
  });
}
