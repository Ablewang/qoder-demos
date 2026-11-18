export interface Draft {
  id: string;
  memberId: string;
  familyId: string;
  askId: string | null;
  question: string;
  mode: 'recording' | 'audio' | 'text';
  blob?: Blob;
  mime?: string;
  text?: string;
  duration?: number;
  createdAt: number;
  attempted?: boolean;
}
let connection: Promise<IDBDatabase> | undefined;
function database() {
  connection ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('then-family-drafts', 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('drafts', { keyPath: 'id' });
      const chunks = request.result.createObjectStore('chunks', { keyPath: 'key' });
      chunks.createIndex('draftId', 'draftId');
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('手机没能保存草稿，请先别关页面。'));
  });
  return connection;
}
async function write(store: string, value: unknown) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error('草稿暂存失败，请先别关页面。'));
    tx.onabort = () => reject(new Error('草稿暂存失败，请先别关页面。'));
  });
}
export function saveDraft(draft: Draft) { return write('drafts', draft); }
export function saveChunk(draftId: string, index: number, pcm: Int16Array) {
  return write('chunks', { key: `${draftId}:${index}`, draftId, index, pcm });
}
export async function listDrafts(memberId: string, familyId: string): Promise<Draft[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('drafts').objectStore('drafts').getAll();
    request.onsuccess = () => resolve((request.result as Draft[]).filter((d) => d.memberId === memberId && d.familyId === familyId).sort((a, b) => b.createdAt - a.createdAt));
    request.onerror = () => reject(new Error('暂时读不到草稿。'));
  });
}
export async function readChunks(id: string): Promise<Int16Array[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const request = db.transaction('chunks').objectStore('chunks').index('draftId').getAll(id);
    request.onsuccess = () => resolve(request.result.sort((a, b) => a.index - b.index).map((item) => item.pcm as Int16Array));
    request.onerror = () => reject(new Error('暂时读不到录音片段。'));
  });
}
export async function deleteDraft(id: string) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['drafts', 'chunks'], 'readwrite');
    tx.objectStore('drafts').delete(id);
    const request = tx.objectStore('chunks').index('draftId').openCursor(IDBKeyRange.only(id));
    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) { cursor.delete(); cursor.continue(); }
    };
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(new Error('草稿还没清理好。'));
  });
}
