import { loadLegacySettings, normalizeSettings } from "../config/settings";
import type { Settings } from "../config/settings";

export type StorageStatus = "saved" | "saving" | "error";

export interface PlayerStats {
  attempts: number;
  victories: number;
  deaths: number;
  kills: number;
  shots: number;
  hits: number;
  playTime: number;
  bestTime: number | null;
  bestAccuracy: number | null;
}

export interface PlayerProfile {
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  stats: PlayerStats;
}

export interface RunResult {
  id: string;
  outcome: "victory" | "death";
  duration: number;
  shots: number;
  hits: number;
  kills: number;
  retries: number;
  relays: number;
  totalRelays: number;
  rating: string | null;
}

export interface RunRecord extends RunResult {
  userId: string;
  endedAt: number;
}

export interface UserData {
  readonly profile: PlayerProfile;
  readonly settings: Settings;
  readonly status: StorageStatus;
  readonly error: string | null;
  readonly persistent: boolean;
  saveSettings(settings: Settings): Promise<void>;
  renamePlayer(name: string): Promise<void>;
  recordResult(result: RunResult): Promise<void>;
  getHistory(): Promise<RunRecord[]>;
  subscribe(listener: () => void): () => void;
}

export function createLocalId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function defaultProfile(): PlayerProfile {
  const now = Date.now();
  return {
    id: createLocalId(),
    name: "几猫队员",
    createdAt: now,
    updatedAt: now,
    stats: {
      attempts: 0,
      victories: 0,
      deaths: 0,
      kills: 0,
      shots: 0,
      hits: 0,
      playTime: 0,
      bestTime: null,
      bestAccuracy: null,
    },
  };
}

function errorText(reason: unknown): string {
  if (!(reason instanceof Error)) return String(reason);
  return reason.name === "Error"
    ? reason.message
    : `${reason.name}: ${reason.message}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("saltline.userdata", 1);
    let settled = false;
    const fail = (reason: unknown): void => {
      if (settled) return;
      settled = true;
      reject(reason);
    };
    request.onblocked = () =>
      fail(new Error("用户数据库升级被其他标签页阻塞，请关闭旧标签页后重试"));
    request.onerror = () =>
      fail(request.error ?? new Error("无法打开用户数据库"));
    request.onupgradeneeded = () => {
      if (settled) {
        request.transaction?.abort();
        return;
      }
      try {
        const db = request.result;
        db.createObjectStore("profile");
        db.createObjectStore("settings");
        const records = db.createObjectStore("records", { keyPath: "id" });
        records.createIndex("userEndedAt", ["userId", "endedAt"]);
      } catch (reason) {
        fail(reason);
        request.transaction?.abort();
      }
    };
    request.onsuccess = () => {
      if (settled) {
        request.result.close();
        return;
      }
      settled = true;
      resolve(request.result);
    };
  });
}

type WatchRequest = <T>(
  request: IDBRequest<T>,
  success: (value: T) => void,
) => void;

function transact<T>(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  work: (
    tx: IDBTransaction,
    watch: WatchRequest,
    finish: (value: T) => void,
  ) => void,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    let value: T | undefined;
    let ready = false;
    let failure: unknown;
    const fail = (reason: unknown): void => {
      failure ??= reason ?? new Error("用户数据事务失败");
      try {
        tx.abort();
      } catch {
        reject(failure);
      }
    };
    tx.onabort = () =>
      reject(failure ?? tx.error ?? new Error("用户数据事务已中止"));
    tx.onerror = (event) => {
      const target = event.target;
      fail(target instanceof IDBRequest ? target.error : tx.error);
    };
    tx.oncomplete = () => {
      if (ready) resolve(value as T);
      else reject(new Error("用户数据事务未返回结果"));
    };
    const watch: WatchRequest = (request, success) => {
      request.onsuccess = () => {
        try {
          success(request.result);
        } catch (reason) {
          fail(reason);
        }
      };
    };
    try {
      work(tx, watch, (result) => {
        value = result;
        ready = true;
      });
    } catch (reason) {
      fail(reason);
    }
  });
}

class LocalUserData implements UserData {
  private profileValue = defaultProfile();
  private settingsValue = normalizeSettings(null);
  private statusValue: StorageStatus = "error";
  private errorValue: string | null = null;
  private database: IDBDatabase | null = null;
  private pendingWrites = 0;
  private readonly listeners = new Set<() => void>();

  get profile(): PlayerProfile {
    return { ...this.profileValue, stats: { ...this.profileValue.stats } };
  }
  get settings(): Settings {
    return { ...this.settingsValue };
  }
  get status(): StorageStatus {
    return this.statusValue;
  }
  get error(): string | null {
    return this.errorValue;
  }
  get persistent(): boolean {
    return this.database !== null;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify(): void {
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch {}
    }
  }

  private fail(reason: unknown): Error {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    this.statusValue = "error";
    this.errorValue = errorText(error);
    this.notify();
    return error;
  }

  async initialize(): Promise<void> {
    try {
      const db = await openDatabase();
      this.database = db;
      db.onversionchange = () => {
        db.close();
        this.database = null;
        this.fail(
          new Error("用户数据库版本已变更，连接已关闭；请刷新页面后继续保存"),
        );
      };
      const initial = await transact<{
        profile: PlayerProfile;
        settings: Settings;
      }>(db, ["profile", "settings"], "readwrite", (tx, watch, finish) => {
        const profiles = tx.objectStore("profile");
        const settings = tx.objectStore("settings");
        watch<PlayerProfile | undefined>(
          profiles.get("current"),
          (storedProfile) => {
            const profile = storedProfile ?? this.profileValue;
            if (!storedProfile) profiles.put(profile, "current");
            watch<unknown>(settings.get(profile.id), (storedSettings) => {
              const value =
                storedSettings === undefined
                  ? loadLegacySettings()
                  : normalizeSettings(storedSettings);
              if (storedSettings === undefined) settings.put(value, profile.id);
              finish({ profile, settings: value });
            });
          },
        );
      });
      if (this.database !== db)
        throw new Error(this.errorValue ?? "用户数据库连接已关闭");
      this.profileValue = initial.profile;
      this.settingsValue = initial.settings;
      this.statusValue = "saved";
      this.errorValue = null;
    } catch (reason) {
      this.database?.close();
      this.database = null;
      this.settingsValue = loadLegacySettings();
      this.fail(
        new Error(
          `用户数据无法持久化，当前仅为会话；保存及历史读取不可用。${errorText(reason)}`,
        ),
      );
    }
  }

  private async write(
    operation: (db: IDBDatabase) => Promise<void>,
  ): Promise<void> {
    const db = this.database;
    if (!db)
      throw this.fail(
        new Error(this.errorValue ?? "用户数据仅为会话，不能持久保存"),
      );
    if (this.pendingWrites++ === 0) {
      this.statusValue = "saving";
      this.errorValue = null;
    }
    this.notify();
    try {
      await operation(db);
    } catch (reason) {
      this.pendingWrites--;
      throw this.fail(reason);
    }
    this.pendingWrites--;
    if (this.database && !this.errorValue) {
      this.statusValue = this.pendingWrites ? "saving" : "saved";
    }
    this.notify();
  }

  saveSettings(settings: Settings): Promise<void> {
    const snapshot = normalizeSettings(settings);
    return this.write(async (db) => {
      await transact<void>(
        db,
        ["settings"],
        "readwrite",
        (tx, _watch, finish) => {
          tx.objectStore("settings").put(snapshot, this.profileValue.id);
          finish(undefined);
        },
      );
      this.settingsValue = snapshot;
    });
  }

  renamePlayer(name: string): Promise<void> {
    const trimmed = name.trim();
    if (!trimmed || [...trimmed].length > 24) {
      return Promise.reject(new Error("昵称须为 1–24 个字符"));
    }
    return this.write(async (db) => {
      this.profileValue = await transact<PlayerProfile>(
        db,
        ["profile"],
        "readwrite",
        (tx, watch, finish) => {
          const profiles = tx.objectStore("profile");
          watch<PlayerProfile | undefined>(
            profiles.get("current"),
            (profile) => {
              if (!profile) throw new Error("用户档案不存在");
              const updated = {
                ...profile,
                name: trimmed,
                updatedAt: Date.now(),
              };
              profiles.put(updated, "current");
              finish(updated);
            },
          );
        },
      );
    });
  }

  recordResult(result: RunResult): Promise<void> {
    const snapshot = { ...result };
    const endedAt = Date.now();
    return this.write(async (db) => {
      this.profileValue = await transact<PlayerProfile>(
        db,
        ["profile", "records"],
        "readwrite",
        (tx, watch, finish) => {
          const profiles = tx.objectStore("profile");
          const records = tx.objectStore("records");
          watch<RunRecord | undefined>(records.get(snapshot.id), (existing) => {
            watch<PlayerProfile | undefined>(
              profiles.get("current"),
              (profile) => {
                if (!profile) throw new Error("用户档案不存在");
                if (existing) {
                  finish(profile);
                  return;
                }
                const stats = { ...profile.stats };
                const victory = snapshot.outcome === "victory";
                stats.attempts++;
                if (victory) stats.victories++;
                else stats.deaths++;
                stats.kills += snapshot.kills;
                stats.shots += snapshot.shots;
                stats.hits += snapshot.hits;
                stats.playTime += snapshot.duration;
                if (victory) {
                  stats.bestTime =
                    stats.bestTime === null
                      ? snapshot.duration
                      : Math.min(stats.bestTime, snapshot.duration);
                  if (snapshot.shots > 0) {
                    const accuracy = snapshot.hits / snapshot.shots;
                    stats.bestAccuracy =
                      stats.bestAccuracy === null
                        ? accuracy
                        : Math.max(stats.bestAccuracy, accuracy);
                  }
                }
                const updated = { ...profile, updatedAt: Date.now(), stats };
                const record: RunRecord = {
                  ...snapshot,
                  userId: profile.id,
                  endedAt,
                };
                profiles.put(updated, "current");
                records.add(record);
                finish(updated);
              },
            );
          });
        },
      );
    });
  }

  async getHistory(): Promise<RunRecord[]> {
    try {
      const db = this.database;
      if (!db)
        throw new Error(
          this.errorValue ?? "用户数据仅为会话，无法读取持久历史",
        );
      const userId = this.profileValue.id;
      return await transact<RunRecord[]>(
        db,
        ["records"],
        "readonly",
        (tx, watch, finish) => {
          const history: RunRecord[] = [];
          const range = IDBKeyRange.bound(
            [userId, -Infinity],
            [userId, Infinity],
          );
          const request = tx
            .objectStore("records")
            .index("userEndedAt")
            .openCursor(range, "prev");
          watch<IDBCursorWithValue | null>(request, (cursor) => {
            if (!cursor) {
              finish(history);
              return;
            }
            history.push(cursor.value as RunRecord);
            if (history.length === 20) finish(history);
            else cursor.continue();
          });
        },
      );
    } catch (reason) {
      throw this.fail(reason);
    }
  }
}

export async function createUserData(): Promise<UserData> {
  const data = new LocalUserData();
  await data.initialize();
  return data;
}
