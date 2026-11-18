import { describe, expect, it } from 'vitest';
import { clearRecords, completeAttempt, localDate, readRecords, STORAGE_KEY } from './achievements';
import type { StoragePort } from './achievements';

function memoryStorage(): StoragePort & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); }, removeItem: (key) => { data.delete(key); } };
}

const broken: StoragePort = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('quota'); },
  removeItem: () => { throw new Error('denied'); },
};

describe('本地自报完成与隐私', () => {
  it('空历史诚实为空', () => {
    expect(readRecords(memoryStorage())).toEqual({ records: [], error: null });
  });

  it('同一次开口重复完成只记一次，刷新后仍保留', () => {
    const storage = memoryStorage();
    const first = completeAttempt(storage, [], 'attempt-1', false, new Date(2026, 10, 17));
    const second = completeAttempt(storage, first.records, 'attempt-1', false);
    expect(second.records).toHaveLength(1);
    expect(readRecords(storage).records).toEqual(first.records);
    const raw = storage.data.get(STORAGE_KEY)!;
    expect(raw).toContain('2026-11-17');
    expect(Object.keys(JSON.parse(raw).completions[0]).sort()).toEqual(['attemptId', 'completedDate']);
  });

  it('求助从不新增记录或写存储，即使被调用完成', () => {
    const storage = memoryStorage();
    expect(completeAttempt(storage, [], 'sensitive', true).records).toEqual([]);
    expect(storage.data.size).toBe(0);
    const first = completeAttempt(storage, [], 'ordinary', false);
    const snapshot = storage.data.get(STORAGE_KEY);
    completeAttempt(storage, first.records, 'help', true);
    expect(storage.data.get(STORAGE_KEY)).toBe(snapshot);
  });

  it('损坏JSON和带敏感额外字段的记录不接受、不自动删除', () => {
    const storage = memoryStorage();
    for (const raw of ['broken-json', '{"schemaVersion":2,"completions":[]}', '{"schemaVersion":1,"completions":[{"attemptId":"a","completedDate":"2026-11-17","sceneId":"help_chat"}]}']) {
      storage.setItem(STORAGE_KEY, raw);
      expect(readRecords(storage).error).not.toBeNull();
      expect(storage.getItem(STORAGE_KEY)).toBe(raw);
    }
  });

  it('拒绝读取、写入和清除仍提供明确失败，不虚构保存', () => {
    expect(readRecords(broken).error).not.toBeNull();
    expect(readRecords(null).error).not.toBeNull();
    const failed = completeAttempt(broken, [], 'attempt', false);
    expect(failed.error).not.toBeNull();
    expect(failed.records).toHaveLength(1);
    expect(clearRecords(broken)).not.toBeNull();
    expect(clearRecords(null)).not.toBeNull();
  });

  it('用户确认清除后本机为空，使用本地日历日期', () => {
    const storage = memoryStorage();
    completeAttempt(storage, [], 'one', false);
    expect(clearRecords(storage)).toBeNull();
    expect(readRecords(storage).records).toEqual([]);
    expect(localDate(new Date(2026, 0, 2))).toBe('2026-01-02');
  });
});
