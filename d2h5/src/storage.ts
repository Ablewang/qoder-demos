import type { Player } from './types';

export type SaveRecord = {
  id: string;
  version: 1;
  player: Player;
  seed: number;
  timestamp: number;
};

type StoredRecord = SaveRecord | { id: string; deleted: true };

export interface SaveStore {
  list(): Promise<SaveRecord[]>;
  get(id: string): Promise<SaveRecord | undefined>;
  put(record: SaveRecord): Promise<void>;
  delete(id: string): Promise<void>;
  importLegacy(record: SaveRecord): Promise<void>;
}

export const DATABASE_NAME = 'sanctuary-h5';
export const CHARACTERS_STORE = 'characters';
export const LEGACY_SAVE_KEY = 'sanctuary-h5-save-v1';
export const LEGACY_CHARACTER_ID = 'legacy-localstorage-v1';

export class IndexedSaveStore implements SaveStore {
  private database: Promise<IDBDatabase> | undefined;
  private readonly factory: IDBFactory;

  constructor(factory: IDBFactory) {
    this.factory = factory;
  }

  private open(): Promise<IDBDatabase> {
    if (this.database) return this.database;

    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      const request = this.factory.open(DATABASE_NAME, 1);
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true;
        reject(error);
      };

      request.onerror = () => fail(request.error ?? new Error('Failed to open save database'));
      request.onblocked = () => fail(new Error('Opening save database was blocked by another connection'));
      request.onupgradeneeded = () => {
        if (settled) {
          request.transaction?.abort();
          return;
        }
        try {
          const database = request.result;
          if (!database.objectStoreNames.contains(CHARACTERS_STORE)) {
            database.createObjectStore(CHARACTERS_STORE, { keyPath: 'id' });
          }
        } catch (error) {
          fail(error);
          request.transaction?.abort();
        }
      };
      request.onsuccess = () => {
        const database = request.result;
        if (settled) {
          database.close();
          return;
        }
        database.onversionchange = () => {
          database.close();
          if (this.database === opening) this.database = undefined;
        };
        settled = true;
        resolve(database);
      };
    });

    this.database = opening;
    void opening.catch(() => {
      if (this.database === opening) this.database = undefined;
    });
    return opening;
  }

  async list(): Promise<SaveRecord[]> {
    const database = await this.open();
    return new Promise<SaveRecord[]>((resolve, reject) => {
      const transaction = database.transaction(CHARACTERS_STORE, 'readonly');
      let records: SaveRecord[] = [];
      transaction.oncomplete = () => resolve(records);
      transaction.onabort = () => reject(transaction.error ?? new Error('Listing saves was aborted'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to list saves'));

      const request = transaction.objectStore(CHARACTERS_STORE).getAll();
      request.onsuccess = () => {
        records = (request.result as StoredRecord[]).filter(
          (record): record is SaveRecord => !('deleted' in record),
        );
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to read saves'));
    });
  }

  async get(id: string): Promise<SaveRecord | undefined> {
    const database = await this.open();
    return new Promise<SaveRecord | undefined>((resolve, reject) => {
      const transaction = database.transaction(CHARACTERS_STORE, 'readonly');
      let record: SaveRecord | undefined;
      transaction.oncomplete = () => resolve(record);
      transaction.onabort = () => reject(transaction.error ?? new Error('Reading save was aborted'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to get save'));

      const request = transaction.objectStore(CHARACTERS_STORE).get(id);
      request.onsuccess = () => {
        const stored = request.result as StoredRecord | undefined;
        record = stored && !('deleted' in stored) ? stored : undefined;
      };
      request.onerror = () => reject(request.error ?? new Error('Failed to read save'));
    });
  }

  async put(record: SaveRecord): Promise<void> {
    const database = await this.open();
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(CHARACTERS_STORE, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Writing save was aborted'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to put save'));

      const store = transaction.objectStore(CHARACTERS_STORE);
      const request = store.get(record.id);
      request.onerror = () => reject(request.error ?? new Error('Failed to read save before writing'));
      request.onsuccess = () => {
        if (request.result && 'deleted' in request.result) { transaction.abort(); return; }
        const write = store.put(record);
        write.onerror = () => reject(write.error ?? new Error('Failed to write save'));
      };
    });
  }

  async delete(id: string): Promise<void> {
    const database = await this.open();
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(CHARACTERS_STORE, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Deleting save was aborted'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to delete save'));

      const store = transaction.objectStore(CHARACTERS_STORE);
      // Keep a marker so retained localStorage cannot re-import this character.
      const request = id === LEGACY_CHARACTER_ID
        ? store.put({ id, deleted: true })
        : store.delete(id);
      request.onerror = () => reject(request.error ?? new Error('Failed to delete character'));
    });
  }

  async importLegacy(record: SaveRecord): Promise<void> {
    const database = await this.open();
    return new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(CHARACTERS_STORE, 'readwrite');
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error ?? new Error('Importing legacy save was aborted'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Failed to import legacy save'));

      const store = transaction.objectStore(CHARACTERS_STORE);
      const request = store.get(record.id);
      request.onerror = () => reject(request.error ?? new Error('Failed to read legacy character'));
      request.onsuccess = () => {
        if (request.result !== undefined) return;
        try {
          // Queue add in the request callback so the same transaction stays active.
          const insert = store.add(record);
          insert.onerror = () => reject(insert.error ?? new Error('Failed to add legacy character'));
        } catch (error) {
          reject(error);
          transaction.abort();
        }
      };
    });
  }
}
