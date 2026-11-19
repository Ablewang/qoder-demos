import { isAbsolute, join, relative, resolve } from 'node:path';
import { ContractError, OWNER_ACTOR } from '../contracts/common.ts';
import type { Actor } from '../contracts/common.ts';
import type { CreateMemoryModule, MemoryChange, MemoryItem, MemoryLayer, MemoryModule, MemoryModuleDeps, MemoryOrigin } from '../contracts/memory.ts';
import type { SqlValue, Tx } from '../contracts/platform.ts';
import { JOURNAL_TEXT_MAX, checkDate, checkOrigin, checkText, classifyLine, cleanText, encodeOrigin, fileForLayer, formatItemLine, isFence, isKind, isLayer, isSensitivity, isTimestamp, journalFile, layerOfFile, textMaxFor, tombstoneHash } from './format.ts';
import { appendLine, assertDirectory, atomicWrite, discoverFiles, loadFile, newFile, scrubBackup } from './files.ts';
import type { MemoryFile } from './files.ts';
import { allItems, allProvenance, migrate, removeItem, removeProvenance, storeItem, toItem } from './schema.ts';
import type { Provenance } from './schema.ts';

interface Event { change: MemoryChange; actor: Actor }
interface Scan { file: MemoryFile; items: MemoryItem[]; dirty: boolean }

function actorOf(origin: MemoryOrigin): Actor {
  if (origin.kind === 'user') return OWNER_ACTOR;
  return { kind: 'system', component: origin.kind === 'external' ? 'memory.external' : origin.kind };
}

function limitOf(limit: number | undefined, fallback: number): number {
  if (limit === undefined) return fallback;
  if (!Number.isSafeInteger(limit) || limit < 0) throw new ContractError('bad_request', 'memory limit must be a non-negative integer');
  return limit;
}

function sameItem(a: MemoryItem, b: MemoryItem): boolean {
  return a.layer === b.layer && a.kind === b.kind && a.text === b.text && a.sensitivity === b.sensitivity
    && a.createdAt === b.createdAt && a.validUntil === b.validUntil
    && JSON.stringify(a.origin) === JSON.stringify(b.origin) && JSON.stringify(a.about) === JSON.stringify(b.about);
}

export const createMemoryModule: CreateMemoryModule = (deps) => {
  if (!isAbsolute(deps.companionDir)) throw new ContractError('bad_request', 'companion directory must be absolute');
  return new FileMemory(deps);
};

class FileMemory implements MemoryModule {
  private readonly deps: MemoryModuleDeps;
  private readonly root: string;
  private started = false;
  private writing = false;
  private migrated = false;

  constructor(deps: MemoryModuleDeps) {
    this.deps = deps;
    this.root = resolve(deps.companionDir);
  }

  start(): void {
    if (this.started) return;
    assertDirectory(this.root);
    if (!this.migrated) { migrate(this.deps.storage); this.migrated = true; }
    this.started = true;
    try { this.synchronize(); } catch (error) { this.started = false; throw error; }
  }

  stop(): void { this.started = false; }

  private ready(): void {
    if (!this.started) throw new ContractError('internal', 'memory module is not started');
  }

  private mutate<T>(work: () => T): T {
    this.ready();
    if (this.writing) throw new ContractError('conflict', 'memory write is already in progress');
    this.writing = true;
    try { this.synchronize(); return work(); } finally { this.writing = false; }
  }

  private audit(tx: Tx, event: Event): void {
    const c = event.change;
    const detail: Record<string, unknown> = { action: c.change };
    if ('id' in c) { detail.id = c.id; detail.layer = c.layer; }
    this.deps.audit.append({
      id: this.deps.newId('audit'), at: this.deps.now(), actor: event.actor,
      kind: 'memory', refs: {}, summary: `memory.${c.change}`, outcome: 'ok', detail,
    }, tx);
  }

  private publish(events: Event[]): void {
    for (const event of events) {
      const c = event.change;
      const fields: Record<string, unknown> = { action: c.change };
      if ('id' in c) { fields.id = c.id; fields.layer = c.layer; }
      this.deps.log.info('memory.changed', fields);
      this.deps.onChange(c);
    }
  }

  private issue(events: Event[], file: string, reason: string, line?: number): void {
    events.push({ change: { change: 'issue', file, line, reason }, actor: OWNER_ACTOR });
  }

  private localRuleAllowed(item: MemoryItem, previous?: Provenance): boolean {
    if (item.kind !== 'rule') return true;
    if (item.origin.kind !== 'user') return false;
    // Same-id local text edits remain supported; the hash detects edits, not rule approval.
    if (previous?.kind === 'rule' && previous.layer === item.layer && previous.file === item.file
      && encodeOrigin(previous.origin) === encodeOrigin(item.origin)) return true;
    return this.deps.evidence.verify(item.origin.evidenceId, item.origin.evidenceType);
  }

  private scan(file: MemoryFile, old: Map<string, MemoryItem>, provenance: Map<string, Provenance>, claimed: Set<string>, events: Event[]): Scan {
    const rel = relative(this.root, file.path).split('\\').join('/');
    const layer = layerOfFile(rel)!;
    const items: MemoryItem[] = [];
    const protectedIds = new Set<string>();
    let protectFile = false;
    let dirty = false;
    let fenced = false;
    for (let i = 0; i < file.lines.length; i++) {
      const line = file.lines[i];
      if (isFence(line.text)) { fenced = !fenced; continue; }
      if (fenced) continue;
      const parsed = classifyLine(line.text);
      if (parsed.type === 'raw') continue;
      if (parsed.type === 'broken') {
        this.issue(events, file.path, '记忆标记损坏，已保留原行', i + 1);
        if (parsed.looseId) protectedIds.add(parsed.looseId); else protectFile = true;
        continue;
      }
      const text = parsed.text;
      const problem = checkText(text, textMaxFor(layer));
      if (problem) {
        this.issue(events, file.path, problem === 'credential' ? '条目疑似凭证，未导入' : '条目文本格式或长度无效，已保留原行', i + 1);
        if (parsed.type === 'marked') protectedIds.add(parsed.marker.id);
        else if (text.includes('<!--') || text.includes('-->') || text.includes('wa:')) protectFile = true;
        continue;
      }
      let item: MemoryItem;
      if (parsed.type === 'plain') {
        item = {
          id: this.deps.newId('mem'), layer, kind: 'fact', text,
          origin: { kind: 'user', evidenceType: 'local_edit', evidenceId: `memfile:${file.sha256.slice(0, 8)}` },
          sensitivity: 'normal', createdAt: this.deps.now(), file: file.path, line: i + 1,
        };
      } else {
        const previous = provenance.get(parsed.marker.id);
        const matches = previous !== undefined && encodeOrigin(previous.origin) === encodeOrigin(parsed.marker.origin);
        item = { ...parsed.marker, layer, text, file: file.path, line: i + 1 };
        if (matches) {
          item.origin = structuredClone(previous.origin);
          if (previous.about !== undefined) item.about = structuredClone(previous.about);
        } else {
          this.issue(events, file.path, '来源账本缺失或标记不一致，无法恢复完整来源和关联', i + 1);
          // Markdown encodes no companion/consolidation evidence. Never manufacture empty proof.
          // A user marker alone is not a genuine local edit or an approval.
          if (item.origin.kind !== 'external' && (item.origin.kind !== 'user'
            || !this.deps.evidence.verify(item.origin.evidenceId, item.origin.evidenceType))) {
            protectedIds.add(item.id);
            continue;
          }
        }
        if (!isTimestamp(item.createdAt) || (item.validUntil !== undefined && !isTimestamp(item.validUntil))) {
          this.issue(events, file.path, '条目时间无效，已保留原行', i + 1);
          protectedIds.add(item.id);
          continue;
        }
        if (!this.localRuleAllowed(item, previous)) {
          this.issue(events, file.path, '规则缺少有效用户证据，未导入', i + 1);
          protectedIds.add(item.id);
          continue;
        }
      }
      if (claimed.has(item.id)) {
        this.issue(events, file.path, '条目标识重复，已保留原行', i + 1);
        protectedIds.add(item.id);
        continue;
      }
      claimed.add(item.id);
      items.push(item);
      if (parsed.type === 'plain') { line.text = formatItemLine(item); dirty = true; }
    }
    for (const previous of provenance.values()) {
      if (previous.file === file.path && (protectFile || protectedIds.has(previous.id)) && !claimed.has(previous.id)) {
        // Preserve safety metadata for damaged/rejected lines even without disposable body rows.
        claimed.add(previous.id);
        const indexed = old.get(previous.id);
        if (indexed && indexed.kind === previous.kind && encodeOrigin(indexed.origin) === encodeOrigin(previous.origin)
          && tombstoneHash(indexed.text) === previous.hash) items.push({ ...indexed, origin: previous.origin, about: previous.about });
      }
    }
    return { file, items, dirty };
  }

  private safePath(path: string): boolean {
    const rel = relative(this.root, path).split('\\').join('/');
    if (layerOfFile(rel) === null) return false;
    if (rel.startsWith('journal/')) {
      try { checkDate(rel.slice(8, -3)); } catch { return false; }
    }
    return true;
  }

  private synchronize(force = false): void {
    this.ready();
    const events: Event[] = [];
    this.deps.storage.transaction((tx) => {
      const oldItems = allItems(tx);
      const old = new Map(oldItems.map((item) => [item.id, item]));
      const records = allProvenance(tx);
      const provenance = new Map(records.map((record) => [record.id, record]));
      const hashes = new Map(tx.all('SELECT path, sha256 FROM mem_files').map((r) => [String(r.path), String(r.sha256)]));
      const known = [...new Set([...hashes.keys(), ...records.map((r) => r.file), ...oldItems.map((i) => i.file)])]
        .filter((path) => this.safePath(path));
      const knownPaths = new Set(known);
      const incomplete = new Set([
        ...records.filter((r) => !old.has(r.id)).map((r) => r.file),
        ...oldItems.filter((i) => !provenance.has(i.id)).map((i) => i.file),
      ]);
      const paths = discoverFiles(this.root, known, (file, reason) => this.issue(events, file, reason));
      const changed: MemoryFile[] = [];
      for (const path of paths) {
        if (!this.safePath(path)) continue;
        try {
          const file = loadFile(path);
          if (force || incomplete.has(path) || (file.exists ? hashes.get(path) !== file.sha256 : knownPaths.has(path))) changed.push(file);
        } catch {
          this.issue(events, path, '文件无法安全读取，未修改文件或索引');
        }
      }
      const changedPaths = new Set(changed.map((f) => f.path));
      const claimed = new Set([...records, ...oldItems].filter((i) => !changedPaths.has(i.file)).map((i) => i.id));
      const scans = changed.map((file) => this.scan(file, old, provenance, claimed, events));
      const rebuilt = scans.flatMap((s) => s.items);
      const present = new Set([...claimed, ...rebuilt.map((i) => i.id)]);
      const removed = records.filter((i) => changedPaths.has(i.file) && !present.has(i.id));
      const forgotten = new Set(removed.map((i) => i.id));
      const forgottenHashes = new Set(removed.map((i) => i.hash));
      for (const item of removed) {
        this.tombstone(tx, item, OWNER_ACTOR);
        removeItem(tx, item.id);
        removeProvenance(tx, item.id);
        events.push({ change: { change: 'forgotten', id: item.id, layer: item.layer }, actor: OWNER_ACTOR });
      }
      if (force) {
        tx.run('DELETE FROM mem_fts');
        tx.run('DELETE FROM mem_items');
        tx.run('DELETE FROM mem_files');
        for (const item of oldItems.filter((i) => !changedPaths.has(i.file))) {
          const record = provenance.get(item.id);
          if (!record || record.kind !== item.kind || record.hash !== tombstoneHash(item.text)
            || encodeOrigin(record.origin) !== encodeOrigin(item.origin)) {
            this.issue(events, item.file, '无法从来源账本验证未读取的条目，未恢复索引', item.line);
            continue;
          }
          storeItem(tx, { ...item, origin: record.origin, about: record.about });
        }
        for (const [path, hash] of hashes) {
          if (!changedPaths.has(path) && this.safePath(path)) tx.run('INSERT INTO mem_files(path, sha256) VALUES (?, ?)', [path, hash]);
        }
      } else {
        for (const item of oldItems) if (changedPaths.has(item.file)) removeItem(tx, item.id);
      }
      let done = 0;
      if (force) this.deps.progress?.({ label: '重建记忆索引', done, total: scans.length });
      for (const scan of scans) {
        if (scan.dirty) atomicWrite(scan.file, forgotten, forgottenHashes);
        else scrubBackup(scan.file.path, forgotten, forgottenHashes);
        for (const item of scan.items) {
          const previous = old.get(item.id);
          const record = provenance.get(item.id);
          const hash = tombstoneHash(item.text);
          // Rebuilding an unchanged accepted duplicate is not a new request to remember.
          // Only explicit, verified writer operations may invalidate forgotten-text hashes.
          const importedOrEdited = !record || record.hash !== hash;
          if (importedOrEdited && tx.get('SELECT hash FROM mem_tombstones WHERE hash = ?', [hash])) {
            this.issue(events, item.file, '条目命中遗忘墓碑，未导入', item.line);
            removeItem(tx, item.id);
            continue;
          }
          storeItem(tx, item);
          if (!previous) events.push({ change: { change: 'created', id: item.id, layer: item.layer }, actor: OWNER_ACTOR });
          else if (!sameItem(previous, item)) events.push({ change: { change: 'updated', id: item.id, layer: item.layer }, actor: OWNER_ACTOR });
        }
        if (scan.file.exists) tx.run('INSERT INTO mem_files(path, sha256) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET sha256=excluded.sha256', [scan.file.path, scan.file.sha256]);
        else tx.run('DELETE FROM mem_files WHERE path = ?', [scan.file.path]);
        if (force) this.deps.progress?.({ label: '重建记忆索引', done: ++done, total: scans.length });
      }
      if (force) events.push({ change: { change: 'reindexed' }, actor: { kind: 'system', component: 'memory' } });
      for (const event of events) this.audit(tx, event);
    });
    this.publish(events);
  }

  private verifyMutation(by: Actor, evidenceId?: string): void {
    if (by.kind !== 'user') return;
    if (!evidenceId || !(this.deps.evidence.verify(evidenceId, 'message') || this.deps.evidence.verify(evidenceId, 'local_edit'))) {
      throw new ContractError('rejected', 'memory mutation requires verified user evidence');
    }
  }

  private verifyRule(kind: MemoryItem['kind'], origin: MemoryOrigin): void {
    if (kind !== 'rule') return;
    if (origin.kind !== 'user' || !origin.evidenceId || !this.deps.evidence.verify(origin.evidenceId, origin.evidenceType)) {
      throw new ContractError('rejected', 'rule requires verified user evidence');
    }
  }

  private tombstone(tx: Tx, item: Pick<Provenance, 'id' | 'hash'>, by: Actor): void {
    tx.run('INSERT INTO mem_tombstones(hash, id, at, by_kind) VALUES (?, ?, ?, ?) ON CONFLICT(hash) DO UPDATE SET id=excluded.id, at=excluded.at, by_kind=excluded.by_kind',
      [item.hash, item.id, this.deps.now(), by.kind]);
  }

  private checkTombstone(tx: Tx, text: string, origin: MemoryOrigin): void {
    const hash = tombstoneHash(text);
    if (!tx.get('SELECT hash FROM mem_tombstones WHERE hash = ?', [hash])) return;
    if (origin.kind !== 'user') throw new ContractError('tombstoned', 'memory matches a forgotten item');
    if (!this.deps.evidence.verify(origin.evidenceId, origin.evidenceType)) {
      throw new ContractError('rejected', 'restoring forgotten memory requires verified user evidence');
    }
    tx.run('DELETE FROM mem_tombstones WHERE hash = ?', [hash]);
  }

  private saveFile(tx: Tx, file: MemoryFile, forgotten = new Set<string>()): void {
    const indexed = tx.get('SELECT sha256 FROM mem_files WHERE path = ?', [file.path]);
    if (file.exists ? indexed?.sha256 !== file.sha256 : indexed !== undefined) {
      throw new ContractError('conflict', 'memory file changed after synchronization');
    }
    atomicWrite(file, forgotten);
    tx.run('INSERT INTO mem_files(path, sha256) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET sha256=excluded.sha256', [file.path, file.sha256]);
    let fenced = false;
    const seen = new Set<string>();
    for (let i = 0; i < file.lines.length; i++) {
      if (isFence(file.lines[i].text)) { fenced = !fenced; continue; }
      if (fenced) continue;
      const parsed = classifyLine(file.lines[i].text);
      if (parsed.type === 'marked' && !seen.has(parsed.marker.id)) {
        seen.add(parsed.marker.id);
        tx.run('UPDATE mem_items SET line = ? WHERE id = ? AND file = ?', [i + 1, parsed.marker.id, file.path]);
      }
    }
  }

  remember(input: Parameters<MemoryModule['remember']>[0]): MemoryItem {
    if (!isKind(input.kind)) throw new ContractError('bad_request', 'invalid memory kind');
    this.verifyRule(input.kind, input.origin);
    const origin = checkOrigin(input.origin);
    if (!isLayer(input.layer) || input.layer === 'journal') throw new ContractError('bad_request', 'use appendJournal for journal entries');
    if (!isSensitivity(input.sensitivity)) throw new ContractError('bad_request', 'invalid memory sensitivity');
    if (input.validUntil !== undefined && !isTimestamp(input.validUntil)) throw new ContractError('bad_request', 'invalid memory expiry');
    const text = cleanText(input.text, textMaxFor(input.layer));
    return this.mutate(() => this.insert(fileForLayer(input.layer as Exclude<MemoryLayer, 'journal'>), { ...input, text, origin }));
  }

  private insert(rel: string, input: Omit<MemoryItem, 'id' | 'createdAt' | 'file' | 'line'>): MemoryItem {
    const events: Event[] = [];
    const item = this.deps.storage.transaction((tx) => {
      this.checkTombstone(tx, input.text, input.origin);
      const file = newFile(join(this.root, rel), rel);
      const item: MemoryItem = { ...structuredClone(input), id: this.deps.newId('mem'), createdAt: this.deps.now(), file: file.path };
      appendLine(file, formatItemLine(item));
      item.line = file.lines.length;
      storeItem(tx, item);
      this.saveFile(tx, file);
      const event: Event = { change: { change: 'created', id: item.id, layer: item.layer }, actor: actorOf(item.origin) };
      this.audit(tx, event);
      events.push(event);
      return item;
    });
    this.publish(events);
    return item;
  }

  appendJournal(date: string, input: Parameters<MemoryModule['appendJournal']>[1]): void {
    checkDate(date);
    const origin = checkOrigin(input.origin);
    if (origin.kind === 'external') throw new ContractError('rejected', 'external sources cannot append journal entries');
    if (!isSensitivity(input.sensitivity)) throw new ContractError('bad_request', 'invalid memory sensitivity');
    const text = cleanText(input.text, JOURNAL_TEXT_MAX);
    this.mutate(() => {
      assertDirectory(join(this.root, 'journal'));
      this.insert(journalFile(date), { ...input, origin, text, layer: 'journal', kind: 'episode' });
    });
  }

  private editableFile(item: MemoryItem): { file: MemoryFile; index: number } {
    if (!this.safePath(item.file)) throw new ContractError('conflict', 'memory item has an invalid file path');
    const file = loadFile(item.file);
    let fenced = false;
    let index = -1;
    for (let i = 0; i < file.lines.length; i++) {
      if (isFence(file.lines[i].text)) { fenced = !fenced; continue; }
      if (fenced) continue;
      const p = classifyLine(file.lines[i].text);
      if (p.type === 'marked' && p.marker.id === item.id) {
        if (index !== -1) throw new ContractError('conflict', 'memory id occurs more than once in its file');
        index = i;
      }
    }
    if (index === -1) throw new ContractError('conflict', 'memory item is not safely editable in its file');
    return { file, index };
  }

  update(id: string, patch: Parameters<MemoryModule['update']>[1], by: Actor, evidenceId: string): MemoryItem {
    this.verifyMutation(by, evidenceId);
    if (patch.sensitivity !== undefined && !isSensitivity(patch.sensitivity)) throw new ContractError('bad_request', 'invalid memory sensitivity');
    if (patch.validUntil !== undefined && !isTimestamp(patch.validUntil)) throw new ContractError('bad_request', 'invalid memory expiry');
    return this.mutate(() => {
      const events: Event[] = [];
      const result = this.deps.storage.transaction((tx) => {
        const row = tx.get('SELECT * FROM mem_items WHERE id = ?', [id]);
        if (!row) throw new ContractError('not_found', 'memory item not found');
        const old = toItem(row);
        if (old.kind === 'rule' && by.kind !== 'user') throw new ContractError('rejected', 'only the user can modify rule memories');
        const text = patch.text === undefined ? old.text : cleanText(patch.text, textMaxFor(old.layer));
        if (text !== old.text) this.checkTombstone(tx, text, by.kind === 'user' ? { kind: 'user', evidenceType: 'local_edit', evidenceId } : old.origin.kind === 'user' ? { kind: 'companion', evidence: [] } : old.origin);
        const { file, index } = this.editableFile(old);
        const item: MemoryItem = { ...old, ...patch, text, line: index + 1 };
        file.lines[index].text = formatItemLine(item);
        storeItem(tx, item);
        this.saveFile(tx, file);
        const event: Event = { change: { change: 'updated', id, layer: item.layer }, actor: by };
        this.audit(tx, event);
        events.push(event);
        return item;
      });
      this.publish(events);
      return result;
    });
  }

  retype(id: string, kind: 'rule' | 'fact', by: Actor, evidenceId: string): MemoryItem {
    if (by.kind !== 'user' || !evidenceId || !this.deps.evidence.verify(evidenceId, 'local_edit')) {
      throw new ContractError('rejected', 'memory retype requires verified local user edit evidence');
    }
    if (kind !== 'rule' && kind !== 'fact') throw new ContractError('bad_request', 'invalid memory retype kind');
    return this.mutate(() => {
      const events: Event[] = [];
      const result = this.deps.storage.transaction((tx) => {
        const row = tx.get('SELECT * FROM mem_items WHERE id = ?', [id]);
        if (!row) throw new ContractError('not_found', 'memory item not found');
        const old = toItem(row);
        if (old.layer === 'journal' || old.kind === 'episode') throw new ContractError('rejected', 'journal episodes cannot be retyped');
        if (old.kind === kind) return old;
        const { file, index } = this.editableFile(old);
        const item: MemoryItem = {
          ...old, kind, line: index + 1,
          origin: kind === 'rule' ? { kind: 'user', evidenceType: 'local_edit', evidenceId } : old.origin,
        };
        file.lines[index].text = formatItemLine(item);
        storeItem(tx, item);
        this.saveFile(tx, file);
        const event: Event = { change: { change: 'updated', id, layer: item.layer }, actor: by };
        this.audit(tx, event);
        events.push(event);
        return item;
      });
      this.publish(events);
      return result;
    });
  }

  forget(id: string, by: Actor, evidenceId?: string): void {
    this.verifyMutation(by, evidenceId);
    this.mutate(() => {
      const events: Event[] = [];
      this.deps.storage.transaction((tx) => {
        const row = tx.get('SELECT * FROM mem_items WHERE id = ?', [id]);
        if (!row) throw new ContractError('not_found', 'memory item not found');
        const item = toItem(row);
        const { file, index } = this.editableFile(item);
        this.tombstone(tx, { id: item.id, hash: tombstoneHash(item.text) }, by);
        file.lines.splice(index, 1);
        removeItem(tx, id);
        removeProvenance(tx, id);
        this.saveFile(tx, file, new Set([id]));
        const event: Event = { change: { change: 'forgotten', id, layer: item.layer }, actor: by };
        this.audit(tx, event);
        events.push(event);
      });
      this.publish(events);
    });
  }

  private query(where: string[], params: SqlValue[], limit?: number): MemoryItem[] {
    this.ready();
    return this.deps.storage.transaction((tx) => tx.all(`SELECT * FROM mem_items ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY created DESC, id DESC${limit === undefined ? '' : ' LIMIT ?'}`, limit === undefined ? params : [...params, limit]).map(toItem));
  }

  profile(): MemoryItem[] { return this.list({ layer: 'profile' }); }

  longTerm(opts: Parameters<MemoryModule['longTerm']>[0] = {}): MemoryItem[] {
    const limit = opts.limit === undefined ? undefined : limitOf(opts.limit, 20);
    const where = ['layer = ?', '(until IS NULL OR until > ?)'];
    const params: SqlValue[] = ['long_term', this.deps.now()];
    if (opts.about?.length) {
      where.push('EXISTS (SELECT 1 FROM json_each(mem_items.about_json) WHERE value IN (' + opts.about.map(() => '?').join(',') + '))');
      params.push(...opts.about);
    }
    return this.query(where, params, limit);
  }

  list(opts: Parameters<MemoryModule['list']>[0] = {}): MemoryItem[] {
    const where: string[] = [];
    const params: SqlValue[] = [];
    if (opts.layer !== undefined) {
      if (!isLayer(opts.layer)) throw new ContractError('bad_request', 'invalid memory layer');
      where.push('layer = ?'); params.push(opts.layer);
    }
    if (!opts.includeExpired) { where.push('(until IS NULL OR until > ?)'); params.push(this.deps.now()); }
    return this.query(where, params, opts.limit === undefined ? undefined : limitOf(opts.limit, 20));
  }

  get(id: string): MemoryItem | undefined {
    this.ready();
    return this.deps.storage.transaction((tx) => {
      const row = tx.get('SELECT * FROM mem_items WHERE id = ?', [id]);
      return row ? toItem(row) : undefined;
    });
  }

  journal(date: string): MemoryItem[] {
    checkDate(date);
    return this.query(['file = ?', '(until IS NULL OR until > ?)'], [join(this.root, journalFile(date)), this.deps.now()]);
  }

  search(query: string, opts: Parameters<MemoryModule['search']>[1] = {}): MemoryItem[] {
    this.ready();
    if (typeof query !== 'string') throw new ContractError('bad_request', 'memory query must be a string');
    const q = query.trim();
    const limit = limitOf(opts.limit, 20);
    if (opts.layers?.some((layer) => !isLayer(layer))) throw new ContractError('bad_request', 'invalid memory search layers');
    if (!q || !limit || opts.layers?.length === 0) return [];
    const where = ['(i.until IS NULL OR i.until > ?)'];
    const params: SqlValue[] = [this.deps.now()];
    if (opts.layers) { where.push('i.layer IN (' + opts.layers.map(() => '?').join(',') + ')'); params.push(...opts.layers); }
    const like = '%' + q.replace(/[\\%_]/g, '\\$&') + '%';
    return this.deps.storage.transaction((tx) => {
      const results = [...q].length >= 3 ? tx.all(`SELECT i.* FROM mem_fts JOIN mem_items i ON i.id=mem_fts.id WHERE mem_fts MATCH ? AND ${where.join(' AND ')} ORDER BY rank, i.created DESC LIMIT ?`, ['"' + q.replace(/"/g, '""') + '"', ...params, limit]).map(toItem) : [];
      const ids = new Set(results.map((i) => i.id));
      if (results.length < limit) {
        const fallback = tx.all(`SELECT i.* FROM mem_items i WHERE i.text LIKE ? ESCAPE '\\' AND ${where.join(' AND ')} ORDER BY i.created DESC, i.id DESC LIMIT ?`, [like, ...params, limit]).map(toItem);
        for (const item of fallback) if (!ids.has(item.id) && results.length < limit) { results.push(item); ids.add(item.id); }
      }
      return results;
    });
  }

  feedback(): [] { this.ready(); return []; }

  reindex(): void {
    this.ready();
    if (this.writing) throw new ContractError('conflict', 'memory write is already in progress');
    this.writing = true;
    try { this.synchronize(true); } finally { this.writing = false; this.deps.progress?.(null); }
  }
}
