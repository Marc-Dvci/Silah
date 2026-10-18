// Minimal IndexedDB wrapper. One database, a few object stores, values stored by key.

const DB_NAME = 'silah';
const DB_VERSION = 1;
export const STORES = ['vault', 'keys', 'clinic', 'net'] as const;
export type StoreName = (typeof STORES)[number];

let dbp: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      for (const s of STORES) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbp;
}

function tx<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const r = fn(t.objectStore(store));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

export const dbGet = <T>(store: StoreName, key: string) => tx<T | undefined>(store, 'readonly', s => s.get(key));
export const dbPut = (store: StoreName, key: string, value: unknown) => tx(store, 'readwrite', s => s.put(value, key));
export const dbDel = (store: StoreName, key: string) => tx(store, 'readwrite', s => s.delete(key));
export const dbKeys = (store: StoreName) => tx<IDBValidKey[]>(store, 'readonly', s => s.getAllKeys());
export const dbAll = <T>(store: StoreName) => tx<T[]>(store, 'readonly', s => s.getAll());

export async function dbClearAll(): Promise<void> {
  for (const s of STORES) await tx(s, 'readwrite', st => st.clear());
}
