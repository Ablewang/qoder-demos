export const DATABASE_NAME = 'pwi-text-backend';
export const DATABASE_VERSION = 1;

export class StorageError extends Error {
  constructor(code, message) { super(message); this.name = 'StorageError'; this.code = code; }
}

export class IndexedStore {
  constructor(db) { this.db = db; }
  static open(name = DATABASE_NAME) {
    if (!globalThis.indexedDB) return Promise.reject(new StorageError('STORAGE_UNAVAILABLE', '当前浏览器无法使用IndexedDB，请解除存储限制后重试。'));
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(name, DATABASE_VERSION);
      let finished = false;
      const fail = (error) => { if (!finished) { finished = true; reject(error); } };
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('saves')) db.createObjectStore('saves', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('requests')) {
          const store = db.createObjectStore('requests', { keyPath: 'id' });
          store.createIndex('revision', 'revision');
        }
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
      };
      request.onblocked = () => fail(new StorageError('STORAGE_BLOCKED', '数据库升级被其他游戏标签页阻挡，请关闭其他标签页后重试。'));
      request.onerror = () => fail(new StorageError('STORAGE_UNAVAILABLE', request.error?.message || '无法打开本地数据库。'));
      request.onsuccess = () => {
        if (finished) { request.result.close(); return; }
        finished = true;
        request.result.onversionchange = () => request.result.close();
        resolve(new IndexedStore(request.result));
      };
    });
  }
  read(store, key) {
    return new Promise((resolve, reject) => {
      let tx;
      try { tx = this.db.transaction(store, 'readonly'); } catch (error) { reject(new StorageError('STORAGE_CLOSED', error.message)); return; }
      const request = tx.objectStore(store).get(key);
      tx.oncomplete = () => resolve(request.result || null);
      tx.onabort = () => reject(new StorageError('STORAGE_READ_FAILED', tx.error?.message || '读取存档失败。'));
    });
  }
  current() { return this.read('saves', 'current'); }
  receipt(id) { return this.read('requests', id); }
  migration() { return this.read('meta', 'legacyMigration'); }
  commit(snapshot, expectedRevision, operation, migration = null) {
    return new Promise((resolve, reject) => {
      let tx;
      let result;
      let failure;
      try { tx = this.db.transaction(['saves', 'requests', 'meta'], 'readwrite'); }
      catch (error) { reject(new StorageError('STORAGE_CLOSED', error.message)); return; }
      const saves = tx.objectStore('saves');
      const requests = tx.objectStore('requests');
      const abort = (code, message) => { failure = new StorageError(code, message); tx.abort(); };
      const previous = requests.get(operation.id);
      previous.onsuccess = () => {
        const current = saves.get('current');
        current.onsuccess = () => {
          if (previous.result) {
            if (previous.result.signature !== operation.signature) {
              abort('REQUEST_ID_REUSED', '请求编号已用于其他操作，未执行本次请求。');
              return;
            }
            result = { record: current.result || null, receipt: previous.result, duplicate: true };
            return;
          }
          if ((current.result?.revision || 0) !== expectedRevision) {
            abort('REVISION_CONFLICT', '存档已被其他标签页更新，请刷新后重试；本次操作未扣费。');
            return;
          }
          const revision = expectedRevision + 1;
          const now = new Date().toISOString();
          const record = { id: 'current', schemaVersion: 2, revision, updatedAt: now, snapshot };
          const receipt = { ...operation, revision, createdAt: now };
          saves.put(record);
          requests.put(receipt);
          tx.objectStore('meta').put({ key: 'schema', value: { databaseVersion: DATABASE_VERSION, snapshotVersion: 2 } });
          if (migration) tx.objectStore('meta').put({ key: 'legacyMigration', value: migration });
          result = { record, receipt, duplicate: false };
        };
      };
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || new StorageError('STORAGE_WRITE_FAILED', tx.error?.message || '本地存储写入失败，操作未生效。'));
    });
  }
  history(limit = 100, beforeRevision = null) {
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction('requests', 'readonly');
      const rows = [];
      const cursor = tx.objectStore('requests').index('revision').openCursor(beforeRevision === null ? null : IDBKeyRange.upperBound(beforeRevision, true), 'prev');
      cursor.onsuccess = () => { const c = cursor.result; if (c && rows.length < limit) { rows.push(c.value); c.continue(); } };
      tx.oncomplete = () => resolve(rows);
      tx.onabort = () => reject(new StorageError('STORAGE_READ_FAILED', '读取操作记录失败。'));
    });
  }
  close() { this.db.close(); }
}
