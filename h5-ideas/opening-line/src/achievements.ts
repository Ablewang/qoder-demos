export const STORAGE_KEY = 'opening-line:achievements:v1';
export type Completion = { attemptId: string; completedDate: string };
export type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type RecordsResult = { records: Completion[]; error: string | null };

function validRecord(value: unknown): value is Completion {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Record<string, unknown>;
  return Object.keys(entry).length === 2 &&
    typeof entry.attemptId === 'string' && entry.attemptId.length > 0 && entry.attemptId.length <= 80 &&
    typeof entry.completedDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.completedDate);
}

export function readRecords(storage: StoragePort | null): RecordsResult {
  if (!storage) return { records: [], error: '这个浏览器暂时存不了记录。开口和复制仍能使用。' };
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { records: [], error: null };
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') throw new Error('invalid records');
    const object = value as Record<string, unknown>;
    if (Object.keys(object).length !== 2 || object.schemaVersion !== 1 || !Array.isArray(object.completions) || !object.completions.every(validRecord)) throw new Error('invalid records');
    const unique = new Map<string, Completion>();
    for (const record of object.completions) unique.set(record.attemptId, record);
    return { records: [...unique.values()], error: null };
  } catch {
    return { records: [], error: '本地记录暂时读不了。旧数据没有被自动清除，本次可先在内存中使用。' };
  }
}

export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function completeAttempt(storage: StoragePort | null, records: Completion[], attemptId: string, isHelp: boolean, date = new Date()): RecordsResult {
  if (isHelp || records.some((record) => record.attemptId === attemptId)) return { records, error: null };
  const next = [...records, { attemptId, completedDate: localDate(date) }];
  if (!storage) return { records: next, error: '这次只记在当前页面，刷新后不会保留。' };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, completions: next }));
    return { records: next, error: null };
  } catch {
    return { records: next, error: '本机保存失败。这次只记在当前页面，刷新后不会保留。' };
  }
}

export function clearRecords(storage: StoragePort | null): string | null {
  if (!storage) return '无法清除浏览器中可能存在的旧记录。当前页面可以重新开始。';
  try {
    storage.removeItem(STORAGE_KEY);
    return null;
  } catch {
    return '清除失败，旧记录可能仍在。请通过浏览器设置清除本站数据。';
  }
}
