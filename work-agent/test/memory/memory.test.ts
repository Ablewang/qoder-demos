import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ContractError, OWNER_ACTOR } from '../../src/contracts/common.ts';
import type { MemoryItem, MemoryOrigin } from '../../src/contracts/memory.ts';
import { createMemoryModule } from '../../src/memory/index.ts';
import { classifyLine, formatItemLine, sha256, tombstoneHash } from '../../src/memory/format.ts';
import { appendLine, atomicWrite, loadFile } from '../../src/memory/files.ts';
import { allProvenance, migrate } from '../../src/memory/schema.ts';
import type { Tx } from '../../src/contracts/platform.ts';
import { fixture, TestStorage } from './helpers.ts';

const user: MemoryOrigin = { kind: 'user', evidenceType: 'message', evidenceId: 'ev_message' };
const companion: MemoryOrigin = { kind: 'companion', evidence: [{ kind: 'tool_result', id: 'counts' }] };
const external: MemoryOrigin = { kind: 'external', entityIds: ['entity:test:1'] };
const system = { kind: 'system', component: 'test' } as const;
const fact = (text: string, origin: MemoryOrigin = user): Omit<MemoryItem, 'id' | 'createdAt' | 'file' | 'line'> => ({ layer: 'long_term', kind: 'fact', text, origin, sensitivity: 'normal' });
function errorCode(code: string): (error: unknown) => boolean {
  return (error) => error instanceof ContractError && error.code === code;
}
function dbText(f: ReturnType<typeof fixture>, id: string): string | undefined {
  return f.storage.transaction((tx) => tx.get('SELECT text FROM mem_items WHERE id = ?', [id])?.text as string | undefined);
}
function clearIndexes(f: ReturnType<typeof fixture>): void {
  f.storage.transaction((tx) => {
    tx.run('DELETE FROM mem_fts');
    tx.run('DELETE FROM mem_items');
    tx.run('DELETE FROM mem_files');
  });
}
function ledger(f: ReturnType<typeof fixture>) {
  return f.storage.transaction((tx) => allProvenance(tx));
}
function assertIndexes(f: ReturnType<typeof fixture>): void {
  const items = f.memory.list({ includeExpired: true });
  const provenance = ledger(f);
  const rows = f.storage.transaction((tx) => tx.all('SELECT id, text FROM mem_fts ORDER BY id'));
  assert.deepEqual(rows.map((r) => ({ id: r.id, text: r.text })), items.map((i) => ({ id: i.id, text: i.text })).sort((a, b) => a.id.localeCompare(b.id)));
  for (const item of items) {
    const line = readFileSync(item.file, 'utf8').split(/\r?\n/)[item.line! - 1];
    assert.equal(line, formatItemLine(item));
    assert.equal(dbText(f, item.id), item.text);
    const record = provenance.find((r) => r.id === item.id);
    assert.equal(record?.hash, tombstoneHash(item.text));
    assert.equal(record?.kind, item.kind);
    assert.equal(record?.layer, item.layer);
    assert.equal(record?.file, item.file);
    assert.deepEqual(record?.origin, item.origin);
    assert.deepEqual(record?.about, item.about);
    assert.ok(record && !Object.hasOwn(record, 'text'));
  }
}

test('remember, update, forget keep files, rows and FTS consistent; migrations own mem_ only', (t) => {
  const f = fixture(); t.after(f.cleanup);
  assert.deepEqual(f.storage.registrations, [{ moduleId: 'memory', prefixes: ['mem_'] }]);
  const names = f.storage.transaction((tx) => tx.all("SELECT name FROM sqlite_master WHERE type='table'"));
  assert.ok(names.every((r) => String(r.name).startsWith('mem_')));
  const item = f.memory.remember(fact('张三负责前端'));
  assert.equal(item.createdAt, f.now());
  assert.equal(item.file, join(f.companionDir, 'memory.md'));
  assert.match(readFileSync(item.file, 'utf8'), /^# /);
  assert.match(readFileSync(item.file, 'utf8'), /可以直接编辑/);
  assert.equal(f.memory.get(item.id)?.text, item.text);
  assertIndexes(f);
  const second = f.memory.remember(fact('李四负责后端'));
  const updated = f.memory.update(item.id, { text: '张三负责客户端', sensitivity: 'confidential', validUntil: f.now() + 1000 }, OWNER_ACTOR, 'ev_edit');
  assert.equal(updated.id, item.id);
  assert.equal(updated.sensitivity, 'confidential');
  assertIndexes(f);
  assert.deepEqual(f.memory.search('客户端').map((i) => i.id), [item.id]);
  f.memory.forget(item.id, OWNER_ACTOR, 'ev_message');
  assert.equal(f.memory.get(item.id), undefined);
  assert.equal(dbText(f, item.id), undefined);
  assert.equal(f.memory.search('张三').length, 0);
  assert.equal(f.memory.get(second.id)?.line, updated.line);
  assertIndexes(f);
  const tombstone = f.storage.transaction((tx) => tx.get('SELECT * FROM mem_tombstones WHERE hash = ?', [tombstoneHash(updated.text)]));
  assert.equal(tombstone?.by_kind, 'user');
  assert.equal(tombstone?.at, f.now());
  assert.ok(f.changes.some((c) => c.change === 'forgotten' && c.id === item.id));
  assert.equal(f.memory.get('missing'), undefined);
});

test('rules require true user evidence; user update and forget require message or local_edit', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const rule = { ...fact('周五下午不排会'), layer: 'profile' as const, kind: 'rule' as const };
  for (const origin of [
    { kind: 'user', evidenceType: 'message', evidenceId: '' },
    { kind: 'user', evidenceType: 'message', evidenceId: 'not_valid' },
    { kind: 'user', evidenceType: 'local_edit', evidenceId: 'ev_message' }, companion, external,
    { kind: 'consolidation', runId: 'run_1', evidence: [] },
  ] as MemoryOrigin[]) assert.throws(() => f.memory.remember({ ...rule, origin }), errorCode('rejected'));
  const item = f.memory.remember(rule);
  assert.equal(f.memory.profile()[0].kind, 'rule');
  assert.throws(() => f.memory.update(item.id, { text: '周五下午必须休息' }, OWNER_ACTOR, ''), errorCode('rejected'));
  assert.throws(() => f.memory.update(item.id, {}, OWNER_ACTOR, 'ev_decision'), errorCode('rejected'));
  assert.throws(() => f.memory.forget(item.id, OWNER_ACTOR), errorCode('rejected'));
  assert.throws(() => f.memory.forget(item.id, OWNER_ACTOR, 'invalid'), errorCode('rejected'));
  assert.throws(() => f.memory.update(item.id, { text: '不需要用户证据' }, system, ''), errorCode('rejected'));
  f.memory.update(item.id, { text: '周五下午尽量不排会' }, OWNER_ACTOR, 'ev_edit');
  f.memory.forget(item.id, OWNER_ACTOR, 'ev_message');
  assert.equal(f.memory.profile().length, 0);
});

test('normalized tombstones block every non-user source and survive restart/reindex; user revival invalidates them', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember(fact('Team A 负责前端', companion));
  f.memory.forget(item.id, system);
  for (const origin of [companion, external, { kind: 'consolidation', runId: 'run_1', evidence: [] } as MemoryOrigin]) {
    assert.throws(() => f.memory.remember(fact('team  a 负责前端', origin)), errorCode('tombstoned'));
  }
  f.memory.reindex();
  f.memory.stop(); f.memory.start();
  assert.throws(() => f.memory.remember(fact('TEAM A 负责前端', external)), errorCode('tombstoned'));
  const revived = f.memory.remember(fact('team a 负责前端'));
  assert.notEqual(revived.id, item.id);
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
  assert.doesNotThrow(() => f.memory.remember(fact('team a 负责前端', companion)));
});

test('forged user origins cannot revive forgotten facts or clear their tombstones', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember(fact('需要保留遗忘意愿的内容'));
  f.memory.forget(item.id, OWNER_ACTOR, 'ev_edit');
  for (const origin of [
    { kind: 'user', evidenceType: 'message', evidenceId: 'forged' },
    { kind: 'user', evidenceType: 'local_edit', evidenceId: 'ev_message' },
  ] as MemoryOrigin[]) {
    assert.throws(() => f.memory.remember(fact(item.text, origin)), errorCode('rejected'));
    assert.equal(f.memory.search(item.text).length, 0);
    assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 1);
  }
  assert.throws(() => f.memory.remember(fact(item.text, companion)), errorCode('tombstoned'));
  const restored = f.memory.remember(fact(item.text));
  assert.equal(restored.text, item.text);
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
});

test('credential detection applies to remember, update and journal, without leaking text', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember(fact('正常记忆内容'));
  const sensitive = ['这是密码', '我的 TOKEN 值', '这是密钥', '这是 sk-example', 'abcdEFGH0123456789XYZ0', 'prefix01234567890123456789suffix'];
  for (const text of sensitive) {
    assert.throws(() => f.memory.remember(fact(text)), errorCode('rejected'));
    assert.throws(() => f.memory.update(item.id, { text }, OWNER_ACTOR, 'ev_message'), errorCode('rejected'));
    assert.throws(() => f.memory.appendJournal('2026-11-19', { text, origin: companion, sensitivity: 'normal' }), errorCode('rejected'));
    assert.ok(!JSON.stringify([f.audit, f.logs, f.changes]).includes(text));
  }
  assert.equal(f.memory.get(item.id)?.text, item.text);
  assertIndexes(f);
});

test('text uses Unicode character limits, refuses unsafe Markdown/control characters, journal allows 500', (t) => {
  const f = fixture(); t.after(f.cleanup);
  for (const text of ['短', '长'.repeat(201), '文本\n换行', '\n文本内容', '文本内容\n', '文本\r换行', '文本 <!-- 注释', '文本 -->', '文本\u0000内容', '文本\u2028换行']) {
    assert.throws(() => f.memory.remember(fact(text)), errorCode('bad_request'));
  }
  const item = f.memory.remember(fact('猫'.repeat(200)));
  assert.equal([...item.text].length, 200);
  assert.equal(f.memory.remember(fact('😀😀')).text, '😀😀');
  f.memory.appendJournal('2026-11-19', { text: '计'.repeat(500), origin: companion, sensitivity: 'normal' });
  assert.equal(f.memory.journal('2026-11-19')[0].text.length, 500);
  assert.throws(() => f.memory.appendJournal('2026-11-19', { text: '计'.repeat(501), origin: companion, sensitivity: 'normal' }), errorCode('bad_request'));
  assertIndexes(f);
});

test('plain local lines import as user facts without verifier, get markers, preserve headers and CRLF', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const path = join(f.companionDir, 'user.md');
  const contents = '# 我自己写的文件\r\n\r\n自定义说明原样保留\r\n- 周五下午不排会\r\n结尾不换行';
  writeFileSync(path, contents);
  const beforeCalls = f.verifications.length;
  f.memory.stop(); f.memory.start();
  const item = f.memory.profile()[0];
  assert.equal(item.kind, 'fact');
  assert.deepEqual(item.origin, { kind: 'user', evidenceType: 'local_edit', evidenceId: `memfile:${sha256(contents).slice(0, 8)}` });
  assert.equal(f.verifications.length, beforeCalls);
  const file = readFileSync(path, 'utf8');
  assert.ok(file.startsWith('# 我自己写的文件\r\n\r\n自定义说明原样保留\r\n'));
  assert.ok(file.endsWith('\r\n结尾不换行'));
  assert.ok(file.includes(formatItemLine(item)));
  assert.equal(f.memory.get(item.id)?.line, 4);
  assert.ok(existsSync(path + '.bak'));
  const again = createMemoryModule(f.deps); again.start();
  assert.equal(again.profile()[0].id, item.id);
  again.stop();
});

test('writer merges manual edits before applying its change, including plain lines and marked text', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const a = f.memory.remember(fact('张三负责前端'));
  const b = f.memory.remember(fact('李四负责后端'));
  writeFileSync(a.file, readFileSync(a.file, 'utf8').replace(a.text, '张三负责客户端') + '- 王五负责测试\n');
  f.memory.update(b.id, { text: '李四负责服务端' }, OWNER_ACTOR, 'ev_edit');
  assert.equal(f.memory.get(a.id)?.text, '张三负责客户端');
  assert.equal(f.memory.get(b.id)?.text, '李四负责服务端');
  assert.ok(f.memory.list().some((i) => i.text === '王五负责测试'));
  assertIndexes(f);
  writeFileSync(a.file, readFileSync(a.file, 'utf8').replace('张三负责客户端', '张三负责桌面端'));
  f.memory.update(a.id, { sensitivity: 'confidential' }, OWNER_ACTOR, 'ev_message');
  assert.equal(f.memory.get(a.id)?.text, '张三负责桌面端');
  assert.equal(f.memory.get(a.id)?.sensitivity, 'confidential');
  assertIndexes(f);
});

test('manual deletion of a marked line or whole file creates tombstone, emits forgotten and clears backup', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember(fact('要删掉的手写记录', companion));
  f.memory.remember(fact('保留下来的记录'));
  writeFileSync(item.file, readFileSync(item.file, 'utf8').split('\n').filter((line) => !line.includes(`id=${item.id};`)).join('\n'));
  f.memory.remember(fact('写入另一条记录'));
  assert.equal(f.memory.get(item.id), undefined);
  assert.throws(() => f.memory.remember(fact(item.text, external)), errorCode('tombstoned'));
  assert.ok(f.changes.some((c) => c.change === 'forgotten' && c.id === item.id));
  assert.ok(!readFileSync(item.file + '.bak', 'utf8').includes(item.text));
  const profile = f.memory.remember({ ...fact('删除整个画像文件'), layer: 'profile' });
  unlinkSync(profile.file);
  f.memory.reindex();
  assert.equal(f.memory.get(profile.id), undefined);
  assert.throws(() => f.memory.remember(fact(profile.text, companion)), errorCode('tombstoned'));
});

test('broken lines stay verbatim and issue reasons never contain body; do not forget damaged ids', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember(fact('损坏标记前的正文'));
  const broken = formatItemLine(item).replace('kind=fact', 'kind=unknown');
  const raw = '- 新手写敏感正文 密码\n- 损坏但不认识 <!-- wa:kind=fact -->\n';
  writeFileSync(item.file, readFileSync(item.file, 'utf8').replace(formatItemLine(item), broken) + raw);
  f.memory.remember(fact('另一条正常内容'));
  const content = readFileSync(item.file, 'utf8');
  assert.ok(content.includes(broken)); assert.ok(content.includes(raw));
  const issues = f.changes.filter((c) => c.change === 'issue');
  assert.equal(issues.length, 3);
  assert.ok(issues.every((c) => c.change === 'issue' && c.file === item.file && typeof c.line === 'number'));
  assert.ok(!JSON.stringify(issues).includes(item.text));
  assert.ok(!JSON.stringify(issues).includes('新手写敏感正文'));
  assert.ok(!f.changes.some((c) => c.change === 'forgotten' && c.id === item.id));
  assert.ok(!f.memory.list().some((i) => i.text.includes('密码')));
});

test('atomic replacement keeps one .bak, removes forgotten content from it, leaves no .tmp', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember(fact('原始记忆内容'));
  const original = readFileSync(item.file, 'utf8');
  f.memory.update(item.id, { text: '更新记忆内容' }, OWNER_ACTOR, 'ev_edit');
  assert.equal(readFileSync(item.file + '.bak', 'utf8'), original);
  f.memory.forget(item.id, OWNER_ACTOR, 'ev_edit');
  assert.ok(!readFileSync(item.file, 'utf8').includes(item.id));
  assert.ok(!readFileSync(item.file + '.bak', 'utf8').includes(item.id));
  const names = readdirSync(f.companionDir);
  assert.equal(names.filter((name) => name.endsWith('.bak')).length, 1);
  assert.equal(names.filter((name) => name.endsWith('.tmp')).length, 0);
});

test('reindex rebuilds FTS, retains evidence/about, reports progress, supports Chinese and short LIKE queries', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember({ ...fact('张三负责前端工程', companion), about: ['entity:test:1'] });
  const profile = f.memory.remember({ ...fact('周五下午不排会'), layer: 'profile', kind: 'rule' });
  const consolidation: MemoryOrigin = { kind: 'consolidation', runId: 'run_整理', evidence: [{ kind: 'memory', id: item.id }] };
  f.memory.remember(fact('李四负责后端工程', consolidation));
  f.storage.transaction((tx) => tx.run('DELETE FROM mem_fts'));
  f.memory.reindex();
  assertIndexes(f);
  assert.deepEqual(f.memory.get(item.id)?.origin, companion);
  assert.deepEqual(f.memory.get(item.id)?.about, ['entity:test:1']);
  assert.deepEqual(f.memory.longTerm({ about: ['entity:test:1'] }).map((i) => i.id), [item.id]);
  f.storage.statements.length = 0;
  assert.deepEqual(f.memory.search('前端工程').map((i) => i.id), [item.id]);
  assert.ok(f.storage.statements.some((sql) => sql.includes('MATCH')));
  f.storage.statements.length = 0;
  assert.deepEqual(f.memory.search('周五').map((i) => i.id), [profile.id]);
  assert.ok(f.storage.statements.some((sql) => sql.includes('LIKE')));
  assert.ok(!f.storage.statements.some((sql) => sql.includes('MATCH')));
  assert.deepEqual(f.memory.search('工程', { layers: ['profile'] }), []);
  assert.equal(f.memory.search('工程', { layers: ['long_term'], limit: 1 }).length, 1);
  assert.ok(f.changes.some((c) => c.change === 'reindexed'));
  assert.equal(f.progress[0]?.done, 0);
  const completed = f.progress.filter((p) => p !== null).at(-1)!;
  assert.equal(completed.done, completed.total);
  assert.equal(f.progress.at(-1), null);
  assert.deepEqual(f.memory.feedback('capability:test'), []);
});

test('expiry is inclusive at now, defaults filter profile/longTerm/search/list; get and includeExpired keep entries', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const expired = f.memory.remember({ ...fact('共同关键词画像过期'), layer: 'profile', validUntil: f.now() });
  const long = f.memory.remember({ ...fact('共同关键词长期过期'), validUntil: f.now() - 1 });
  const live = f.memory.remember({ ...fact('共同关键词长期有效'), validUntil: f.now() + 1000 });
  f.memory.remember({ ...fact('共同关键词画像有效'), layer: 'profile' });
  assert.equal(f.memory.profile().length, 1);
  assert.equal(f.memory.longTerm().length, 1);
  assert.equal(f.memory.search('共同关键词').length, 2);
  assert.equal(f.memory.list().length, 2);
  assert.equal(f.memory.list({ includeExpired: true }).length, 4);
  assert.equal(f.memory.list({ layer: 'profile', includeExpired: true, limit: 1 }).length, 1);
  assert.equal(f.memory.get(expired.id)?.text, expired.text);
  assert.equal(f.memory.get(long.id)?.text, long.text);
  f.advance(1000);
  assert.ok(!f.memory.longTerm().some((i) => i.id === live.id));
  assert.equal(f.memory.list({ limit: 0 }).length, 0);
  assert.throws(() => f.memory.list({ limit: -1 }), errorCode('bad_request'));
  assert.throws(() => f.memory.search('共同', { limit: 1.5 }), errorCode('bad_request'));
});

test('journal date validation rejects impossible dates/path traversal; allowed origins and fixed episode', (t) => {
  const f = fixture(); t.after(f.cleanup);
  for (const date of ['2026-02-29', '2026-13-01', '2026-11-31', '26-11-19', '2026-1-19', '../memory', '2026-11-19/../../']) {
    assert.throws(() => f.memory.appendJournal(date, { text: '摸头两次', origin: companion, sensitivity: 'normal' }), errorCode('bad_request'));
    assert.throws(() => f.memory.journal(date), errorCode('bad_request'));
  }
  assert.throws(() => f.memory.appendJournal('2026-11-19', { text: '外部来源', origin: external, sensitivity: 'normal' }), errorCode('rejected'));
  for (const [date, origin] of [['2026-11-19', companion], ['2026-11-20', user], ['2024-02-29', { kind: 'consolidation', runId: 'run_journal', evidence: [] }]] as Array<[string, MemoryOrigin]>) {
    f.memory.appendJournal(date, { text: '摸头 12 次、通知 5 条', origin, sensitivity: 'normal' });
    const item = f.memory.journal(date)[0];
    assert.equal(item.kind, 'episode'); assert.equal(item.layer, 'journal');
    assert.equal(item.file, join(f.companionDir, 'journal', date + '.md'));
  }
  assert.equal(f.memory.journal('2026-11-21').length, 0);
  assert.throws(() => f.memory.remember({ ...fact('日记不能直接记住'), layer: 'journal', kind: 'episode' }), errorCode('bad_request'));
  assertIndexes(f);
});

test('audits/logs/events are metadata-only for all mutations, imports, issues and reindex', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const body1 = '独特正文甲只应在文件索引出现';
  const body2 = '独特正文乙更新以后不要泄漏';
  const item = f.memory.remember(fact(body1));
  f.memory.update(item.id, { text: body2 }, OWNER_ACTOR, 'ev_edit');
  f.memory.appendJournal('2026-11-19', { text: '独特日记计数摸头七次', origin: companion, sensitivity: 'normal' });
  writeFileSync(item.file, readFileSync(item.file, 'utf8') + '- 独特手写条目原文\n- 独特损坏条目 <!-- wa:damaged -->\n');
  f.memory.reindex();
  f.memory.forget(item.id, OWNER_ACTOR, 'ev_message');
  const recorded = JSON.stringify([f.audit, f.logs, f.changes, f.progress]);
  for (const text of [body1, body2, '独特日记计数摸头七次', '独特手写条目原文', '独特损坏条目']) assert.ok(!recorded.includes(text));
  assert.ok(f.audit.length > 5);
  assert.ok(f.audit.every((r) => r.kind === 'memory' && Object.keys(r.detail!).every((k) => ['action', 'id', 'layer'].includes(k))));
  assert.ok(f.audit.some((r) => r.detail?.action === 'created' && r.detail.id === item.id && r.actor.kind === 'user'));
  assert.equal(f.audit.length, f.changes.length);
});

test('FTS query quoting is safe and LIKE metacharacters are literal; defaults cap search at 20', (t) => {
  const f = fixture(); t.after(f.cleanup);
  f.memory.remember(fact('字符 %_ 特别标记'));
  f.memory.remember(fact('普通特别标记'));
  f.memory.remember(fact('带有 "引用" 字符'));
  assert.equal(f.memory.search('%_').length, 1);
  assert.equal(f.memory.search('"引用"').length, 1);
  assert.doesNotThrow(() => f.memory.search('" OR * : ()'));
  for (let i = 0; i < 23; i++) f.memory.remember(fact(`批量检索测试第 ${i} 条`));
  assert.equal(f.memory.search('批量检索').length, 20);
  assert.equal(f.memory.search('批量检索', { limit: 30 }).length, 23);
  assert.equal(f.memory.search('批量检索', { layers: [] }).length, 0);
});

test('a tombstone is not invalidated by reindexing an unchanged duplicate user item', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember(fact('重复用户事实'));
  f.memory.remember(fact('重复用户事实'));
  f.memory.forget(item.id, OWNER_ACTOR, 'ev_edit');
  f.memory.reindex();
  assert.throws(() => f.memory.remember(fact('重复用户事实', companion)), errorCode('tombstoned'));
  assert.equal(f.memory.list().length, 1);
});

test('an edit arriving after synchronization fails closed and is imported on the next write', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember(fact('原有条目内容'));
  writeFileSync(item.file, readFileSync(item.file, 'utf8') + '- 第一次手写内容\n');
  const change = f.deps.onChange;
  let inject = true;
  f.deps.onChange = (c) => {
    change(c);
    if (inject && c.change === 'created') {
      inject = false;
      writeFileSync(item.file, readFileSync(item.file, 'utf8').replace(item.text, '刚刚手改的内容') + '- 第二次手写内容\n');
    }
  };
  assert.throws(() => f.memory.update(item.id, { sensitivity: 'confidential' }, OWNER_ACTOR, 'ev_edit'), errorCode('conflict'));
  assert.ok(readFileSync(item.file, 'utf8').includes('刚刚手改的内容'));
  assert.ok(readFileSync(item.file, 'utf8').includes('- 第二次手写内容'));
  f.memory.remember(fact('下一次程序写入'));
  assert.equal(f.memory.get(item.id)?.text, '刚刚手改的内容');
  assert.equal(f.memory.get(item.id)?.sensitivity, 'normal');
  assertIndexes(f);
});

test('atomic writer rejects a stale snapshot and cleans staging files when backup rename fails', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember(fact('磁盘原始内容'));
  const snapshot = loadFile(item.file);
  appendLine(snapshot, '- 待写入内容');
  const newer = readFileSync(item.file, 'utf8') + '用户后来追加的段落\n';
  writeFileSync(item.file, newer);
  assert.throws(() => atomicWrite(snapshot), errorCode('conflict'));
  assert.equal(readFileSync(item.file, 'utf8'), newer);
  mkdirSync(item.file + '.bak');
  const history = ledger(f);
  assert.throws(() => f.memory.update(item.id, { text: '失败的程序更新' }, OWNER_ACTOR, 'ev_edit'));
  assert.deepEqual(ledger(f), history);
  assert.equal(readFileSync(item.file, 'utf8'), newer);
  assert.equal(f.memory.get(item.id)?.text, '磁盘原始内容');
  assert.equal(readdirSync(f.companionDir).filter((name) => name.endsWith('.tmp')).length, 0);
});

test('origin codecs round-trip reserved delimiters and preserve indexed evidence on rebuild', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const origins: MemoryOrigin[] = [
    { kind: 'user', evidenceType: 'local_edit', evidenceId: 'memfile:中文:百分号%;分号=空 格' },
    { kind: 'external', entityIds: ['entity:甲,乙', 'entity:百分号%分号;等号='] },
    { kind: 'external', entityIds: [] },
    { kind: 'consolidation', runId: '整理:甲,乙;百分号%空 格', evidence: [{ kind: 'memory', id: 'mem:依据' }] },
    companion,
  ];
  for (let i = 0; i < origins.length; i++) {
    const item = f.memory.remember(fact(`编解码条目第 ${i} 条`, origins[i]));
    const parsed = classifyLine(formatItemLine(item));
    assert.equal(parsed.type, 'marked');
    if (parsed.type === 'marked') assert.equal(parsed.marker.origin.kind, origins[i].kind);
  }
  f.memory.reindex();
  for (let i = 0; i < origins.length; i++) {
    const item = f.memory.list().find((v) => v.text === `编解码条目第 ${i} 条`)!;
    assert.deepEqual(item.origin, origins[i]);
  }
  assertIndexes(f);
});

test('damaged rule promotion and duplicate ids are reported and not overwritten; fenced examples stay raw', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember(fact('原有事实不能伪造证据'));
  const duplicate = formatItemLine(item).replace(item.text, '重复标识的另一条正文');
  const forged = formatItemLine({ ...item, id: 'mem_forged', kind: 'rule', origin: { kind: 'user', evidenceId: 'invalid', evidenceType: 'local_edit' } });
  const fenced = '\n```markdown\n- 代码块示例不应导入\n```\n';
  writeFileSync(item.file, readFileSync(item.file, 'utf8') + duplicate + '\n' + forged + '\n' + fenced);
  f.memory.remember(fact('新的正常条目'));
  assert.equal(f.memory.get('mem_forged'), undefined);
  assert.ok(!f.memory.list().some((i) => i.text === '代码块示例不应导入'));
  assert.ok(f.changes.filter((c) => c.change === 'issue').length >= 2);
  assert.equal(f.memory.get(item.id)?.line, item.line);
  assert.throws(() => f.memory.update(item.id, { text: '不能更新重复标识' }, OWNER_ACTOR, 'ev_edit'), errorCode('conflict'));
  assert.throws(() => f.memory.forget(item.id, OWNER_ACTOR, 'ev_edit'), errorCode('conflict'));
  const content = readFileSync(item.file, 'utf8');
  assert.ok(content.includes(duplicate)); assert.ok(content.includes(forged)); assert.ok(content.includes(fenced));
});

test('unsafe symlinked files and invalid journal filenames produce issues without touching the targets', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const target = join(f.dir, 'outside.md');
  const text = '# 不属于记忆模块\n- 外部文件不得改写\n';
  writeFileSync(target, text);
  symlinkSync(target, join(f.companionDir, 'memory.md'));
  const journal = join(f.companionDir, 'journal');
  mkdirSync(journal);
  writeFileSync(join(journal, '2026-02-30.md'), '- 无效日记日期\n');
  f.memory.reindex();
  assert.equal(readFileSync(target, 'utf8'), text);
  assert.ok(f.changes.some((c) => c.change === 'issue'));
  assert.equal(f.memory.list().length, 0);
  assert.throws(() => f.memory.remember(fact('不能跟随符号链接')), errorCode('conflict'));
  assert.equal(readFileSync(target, 'utf8'), text);
});

test('manual removal also scrubs an unmarked import from the previous .bak', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const path = join(f.companionDir, 'memory.md');
  const body = '补标记前已经存在的正文';
  writeFileSync(path, '# 手写文件\n- ' + body + '\n');
  f.memory.stop(); f.memory.start();
  const item = f.memory.longTerm()[0];
  assert.ok(readFileSync(path + '.bak', 'utf8').includes('- ' + body));
  writeFileSync(path, readFileSync(path, 'utf8').split('\n').filter((line) => !line.includes(`id=${item.id};`)).join('\n'));
  f.memory.stop(); f.memory.start();
  assert.equal(f.memory.get(item.id), undefined);
  assert.ok(!readFileSync(path + '.bak', 'utf8').includes(body));
  assert.throws(() => f.memory.remember(fact(body, companion)), errorCode('tombstoned'));
});

test('explicit undefined clears expiry under the current writer contract', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember({ ...fact('需要清除有效期的条目'), validUntil: f.now() - 1000 });
  assert.equal(f.memory.longTerm().length, 0);
  f.memory.update(item.id, { validUntil: undefined }, OWNER_ACTOR, 'ev_edit');
  assert.equal(f.memory.get(item.id)?.validUntil, undefined);
  assert.equal(f.memory.longTerm().length, 1);
  assertIndexes(f);
});

test('migration v2 leaves v1 unchanged and backfills admitted metadata without rechecking expired rule proof', (t) => {
  const storage = new TestStorage(); t.after(() => storage.close());
  const register = storage.registerMigrations.bind(storage);
  storage.registerMigrations = (moduleId, prefixes, migrations) => {
    assert.equal(migrations[0].version, 1);
    assert.equal(migrations[0].checksum, 'a55587828d07c7c45f1bc7ab31ce08882945ed0c11fa998e22f7788c30287bb6');
    register(moduleId, prefixes, migrations.filter((m) => m.version === 1));
  };
  migrate(storage);
  const admitted: MemoryItem[] = [
    { ...fact('升级前已接纳的规则', { kind: 'user', evidenceType: 'message', evidenceId: 'ev_expired' }),
      id: 'mem_legacy_rule', layer: 'profile', kind: 'rule', createdAt: 1, file: '/fixture/user.md', about: ['person:legacy'] },
    { ...fact('升级前带完整依据的事实', companion), id: 'mem_legacy_fact', createdAt: 2,
      file: '/fixture/memory.md', about: ['entity:legacy'] },
  ];
  storage.transaction((tx) => {
    for (const item of [...admitted, { ...admitted[1], id: 'mem_invalid_rule', kind: 'rule' }]) {
      tx.run('INSERT INTO mem_items VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)', [
        item.id, item.layer, item.kind, item.text, JSON.stringify(item.origin), item.sensitivity,
        item.createdAt, null, item.file, 1, JSON.stringify(item.about),
      ]);
    }
    tx.run('INSERT INTO mem_tombstones VALUES (?, ?, ?, ?)', [tombstoneHash('已忘掉的历史'), 'mem_forgotten', 3, 'user']);
  });
  storage.registerMigrations = register;
  migrate(storage);
  const records = storage.transaction(allProvenance);
  assert.equal(records.length, 2);
  for (const item of admitted) {
    assert.deepEqual(records.find((r) => r.id === item.id), {
      id: item.id, layer: item.layer, kind: item.kind, origin: item.origin, about: item.about,
      hash: tombstoneHash(item.text), file: item.file,
    });
  }
  const columns = storage.transaction((tx) => tx.all('PRAGMA table_info(mem_provenance)').map((r) => r.name));
  assert.deepEqual(columns, ['id', 'layer', 'kind', 'origin_json', 'about_json', 'hash', 'file']);
  for (const item of admitted) assert.ok(!JSON.stringify(records).includes(item.text));
  assert.equal(storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 1);
  migrate(storage);
  assert.deepEqual(storage.transaction(allProvenance), records);
});

test('full disposable-index clear, database reopen and reindex recover accepted rules, full evidence and about', (t) => {
  const f = fixture({ persistent: true }); t.after(f.cleanup);
  const rule = f.memory.remember({ ...fact('已批准的周五安排'), layer: 'profile', kind: 'rule', about: ['person:owner'] });
  const item = f.memory.remember({ ...fact('含完整工具依据的长期事实', companion), about: ['entity:test:1'] });
  const consolidated = f.memory.remember({ ...fact('整理后保留记忆依据', {
    kind: 'consolidation', runId: 'run_full', evidence: [{ kind: 'memory', id: item.id }],
  }), about: ['entity:test:2'] });
  const outside = f.memory.remember({ ...fact('外部事实保留关联', external), about: ['entity:test:1'] });
  f.memory.appendJournal('2026-11-19', { text: '摸头四次', origin: companion, sensitivity: 'normal', about: ['person:owner'] });
  const expected = f.memory.list({ includeExpired: true });
  const history = ledger(f);
  f.valid.clear(); f.advance(11 * 60_000);
  clearIndexes(f);
  assert.deepEqual(ledger(f), history);
  f.memory.stop(); f.storage.reopen();
  const recovered = createMemoryModule(f.deps); t.after(() => recovered.stop());
  recovered.start();
  const beforeVerify = f.verifications.length;
  recovered.reindex();
  assert.equal(f.verifications.length, beforeVerify);
  assert.deepEqual(recovered.list({ includeExpired: true }), expected);
  assert.deepEqual(recovered.get(rule.id)?.origin, user);
  assert.deepEqual(recovered.get(item.id)?.origin, companion);
  assert.deepEqual(recovered.get(consolidated.id)?.origin, consolidated.origin);
  assert.deepEqual(recovered.get(outside.id)?.about, outside.about);
  assert.deepEqual(recovered.longTerm({ about: ['entity:test:1'] }).map((i) => i.id).sort(), [item.id, outside.id].sort());
  assert.deepEqual(ledger(f), history);
  assertIndexes({ ...f, memory: recovered });
  assert.ok(!f.changes.some((c) => c.change === 'issue'));
});

for (const deletion of ['line', 'profile-file', 'journal-file', 'plain-line'] as const) {
  test(`ledger detects ${deletion} deletion after all disposable indexes were cleared and scrubs backup`, (t) => {
    const f = fixture({ persistent: true }); t.after(f.cleanup);
    let item: MemoryItem;
    if (deletion === 'journal-file') {
      f.memory.appendJournal('2026-11-19', { text: '日记里待忘的计数', origin: companion, sensitivity: 'normal' });
      item = f.memory.journal('2026-11-19')[0];
      f.memory.appendJournal('2026-11-19', { text: '同文件的另一个计数', origin: companion, sensitivity: 'normal' });
    } else if (deletion === 'profile-file') {
      item = f.memory.remember({ ...fact('待删除的画像规则'), layer: 'profile', kind: 'rule' });
      f.memory.remember({ ...fact('同文件的另一条画像事实'), layer: 'profile' });
    } else if (deletion === 'plain-line') {
      const path = join(f.companionDir, 'memory.md');
      writeFileSync(path, '# 手写\n- 尚未补标记的待忘事实\n');
      f.memory.reindex();
      item = f.memory.longTerm()[0];
    } else {
      item = f.memory.remember(fact('删行后不可恢复的事实', companion));
      f.memory.remember(fact('同文件保留的事实'));
    }
    assert.ok(readFileSync(item.file + '.bak', 'utf8').includes(item.text));
    const ids = ledger(f).filter((r) => r.file === item.file).map((r) => r.id);
    clearIndexes(f); f.valid.clear();
    if (deletion.endsWith('file')) unlinkSync(item.file);
    else writeFileSync(item.file, readFileSync(item.file, 'utf8').split('\n').filter((l) => !l.includes(`id=${item.id};`)).join('\n'));
    f.memory.stop(); f.storage.reopen(); f.memory.start();
    f.memory.reindex();
    const removedIds = deletion.endsWith('file') ? ids : [item.id];
    for (const id of removedIds) {
      assert.equal(f.memory.get(id), undefined);
      assert.ok(!ledger(f).some((r) => r.id === id));
      assert.ok(f.changes.some((c) => c.change === 'forgotten' && c.id === id));
    }
    const tombstone = f.storage.transaction((tx) => tx.get('SELECT * FROM mem_tombstones WHERE hash = ?', [tombstoneHash(item.text)]));
    assert.equal(tombstone?.id, item.id);
    assert.equal(tombstone?.by_kind, 'user');
    assert.ok(!readFileSync(item.file + '.bak', 'utf8').includes(item.text));
    assert.throws(() => f.memory.remember(fact(item.text, companion)), errorCode('tombstoned'));
    assertIndexes(f);
  });
}

test('repeated full index clears cannot let duplicate or forged user markers bypass a forgotten hash', (t) => {
  const f = fixture({ persistent: true }); t.after(f.cleanup);
  const first = f.memory.remember(fact('保留遗忘墓碑的重复事实'));
  const duplicate = f.memory.remember(fact(first.text));
  f.memory.forget(first.id, OWNER_ACTOR, 'ev_edit');
  f.valid.clear();
  for (let n = 0; n < 3; n++) {
    clearIndexes(f);
    f.memory.stop(); f.storage.reopen(); f.memory.start(); f.memory.reindex();
    assert.equal(f.memory.get(duplicate.id)?.text, first.text);
    assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 1);
    assert.throws(() => f.memory.remember(fact(first.text, companion)), errorCode('tombstoned'));
  }
  const forged = { ...duplicate, id: 'mem_forged_duplicate', origin: { kind: 'user', evidenceType: 'local_edit', evidenceId: 'forged' } as MemoryOrigin };
  const currentlyVerified = { ...duplicate, id: 'mem_marked_duplicate', origin: { kind: 'user', evidenceType: 'local_edit', evidenceId: 'ev_edit' } as MemoryOrigin };
  f.valid.set('ev_edit', 'local_edit');
  writeFileSync(first.file, readFileSync(first.file, 'utf8') + formatItemLine(forged) + '\n' + formatItemLine(currentlyVerified) + '\n- ' + first.text + '\n');
  for (let n = 0; n < 2; n++) {
    clearIndexes(f); f.memory.reindex();
    assert.equal(f.memory.get(forged.id), undefined);
    assert.equal(f.memory.get(currentlyVerified.id), undefined);
    assert.equal(f.memory.list().length, 1);
    assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 1);
    assert.deepEqual(ledger(f).map((r) => r.id), [duplicate.id]);
  }
  assert.throws(() => f.memory.remember(fact(first.text, forged.origin)), errorCode('rejected'));
  const restored = f.memory.remember(fact(first.text, currentlyVerified.origin));
  assert.equal(restored.text, first.text);
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
});

test('forged origin markers, rule promotion and copied approval metadata never inherit ledger proof or about', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const rule = f.memory.remember({ ...fact('批准过但来源不可伪造的规则'), layer: 'profile', kind: 'rule', about: ['person:owner'] });
  const candidate = f.memory.remember({ ...fact('事实不得自报成为规则'), about: ['entity:private'] });
  const consolidated = f.memory.remember({ ...fact('整理依据不得跨来源继承', {
    kind: 'consolidation', runId: 'run_original', evidence: [{ kind: 'memory', id: candidate.id }],
  }), about: ['entity:private'] });
  const outside = f.memory.remember({ ...fact('外部关联不得跨来源继承', external), about: ['entity:private'] });
  f.valid.clear();
  const forgedRule = formatItemLine({ ...rule, origin: { kind: 'user', evidenceType: 'message', evidenceId: 'forged' } })
    .replace(';sens=', ';approved=true;evidence=ev_message;about=person:forged;sens=');
  const promoted = formatItemLine(candidate).replace('kind=fact', 'kind=rule');
  writeFileSync(rule.file, readFileSync(rule.file, 'utf8').replace(formatItemLine(rule), forgedRule));
  writeFileSync(candidate.file, readFileSync(candidate.file, 'utf8')
    .replace(formatItemLine(candidate), promoted)
    .replace(formatItemLine(consolidated), formatItemLine({ ...consolidated, origin: { kind: 'consolidation', runId: 'run_forged', evidence: [] } }))
    .replace(formatItemLine(outside), formatItemLine({ ...outside, origin: { kind: 'external', entityIds: ['entity:new'] } })));
  clearIndexes(f); f.memory.reindex();
  assert.equal(f.memory.get(rule.id), undefined);
  assert.equal(f.memory.get(candidate.id), undefined);
  assert.equal(f.memory.get(consolidated.id), undefined);
  assert.deepEqual(f.memory.get(outside.id)?.origin, { kind: 'external', entityIds: ['entity:new'] });
  assert.equal(f.memory.get(outside.id)?.about, undefined);
  assert.deepEqual(ledger(f).find((r) => r.id === rule.id)?.origin, user);
  assert.equal(ledger(f).find((r) => r.id === candidate.id)?.kind, 'fact');
  assert.deepEqual(ledger(f).find((r) => r.id === consolidated.id)?.origin, consolidated.origin);
  assert.ok(f.changes.filter((c) => c.change === 'issue').length >= 4);
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
  // Rejected edits protect their metadata, but a subsequent actual deletion must still forget it.
  writeFileSync(rule.file, '# 删除损坏条目\n'); clearIndexes(f); f.memory.reindex();
  assert.ok(!ledger(f).some((r) => r.id === rule.id));
  assert.ok(f.storage.transaction((tx) => tx.get('SELECT hash FROM mem_tombstones WHERE hash = ?', [tombstoneHash(rule.text)])));
});

test('absent ledger and expired proof fail closed with issues even if old mem_items still contains a rule', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const rule = f.memory.remember({ ...fact('没有账本不可恢复的规则'), layer: 'profile', kind: 'rule' });
  const item = f.memory.remember({ ...fact('没有账本不可补空工具依据', companion), about: ['entity:private'] });
  const consolidated = f.memory.remember(fact('没有账本不可补空整理依据', { kind: 'consolidation', runId: 'run_lost', evidence: [{ kind: 'memory', id: item.id }] }));
  const outside = f.memory.remember({ ...fact('外部标记可恢复实体但关联已丢失', external), about: ['entity:private'] });
  const userFact = f.memory.remember(fact('自报用户标记不是来源账本'));
  const files = [rule.file, item.file].map((path) => readFileSync(path, 'utf8'));
  f.valid.clear(); f.advance(11 * 60_000);
  f.storage.transaction((tx) => tx.run('DELETE FROM mem_provenance'));
  // No index clear here: a transient old row must not become a substitute approval ledger.
  f.memory.reindex();
  for (const id of [rule.id, item.id, consolidated.id, userFact.id]) {
    assert.equal(f.memory.get(id), undefined);
    assert.ok(!ledger(f).some((r) => r.id === id));
  }
  assert.deepEqual(f.memory.get(outside.id)?.origin, external);
  assert.equal(f.memory.get(outside.id)?.about, undefined);
  const issues = f.changes.filter((c) => c.change === 'issue');
  assert.ok(issues.length >= 5);
  assert.ok(!JSON.stringify(issues).includes(item.text));
  assert.deepEqual([rule.file, item.file].map((path) => readFileSync(path, 'utf8')), files);
  clearIndexes(f); f.memory.stop(); f.memory.start(); f.memory.reindex();
  assert.equal(f.memory.get(rule.id), undefined);
  assert.equal(f.memory.get(item.id), undefined);
  assert.ok(!ledger(f).some((r) => r.id === rule.id));
  // Genuine CURRENT proof can readmit a rule; it cannot recover missing historical about/evidence.
  f.valid.set('ev_message', 'message');
  f.memory.reindex();
  assert.equal(f.memory.get(rule.id)?.kind, 'rule');
  assert.equal(f.memory.get(rule.id)?.about, undefined);
  assert.equal(ledger(f).find((r) => r.id === rule.id)?.kind, 'rule');
  assert.equal(f.memory.get(item.id), undefined);
});

test('ledger survives cleared-index manual edits and Markdown remains authoritative for kind, text and expiry', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const rule = f.memory.remember({ ...fact('手改前已经批准的规则'), layer: 'profile', kind: 'rule', about: ['person:owner'] });
  const item = f.memory.remember({ ...fact('带依据的手改前事实', companion), about: ['entity:test:1'] });
  f.valid.clear();
  writeFileSync(rule.file, readFileSync(rule.file, 'utf8').replace(formatItemLine(rule), formatItemLine({
    ...rule, text: '手改后仍使用原批准记录', sensitivity: 'confidential', validUntil: f.now(),
  })));
  writeFileSync(item.file, readFileSync(item.file, 'utf8').replace(formatItemLine(item), formatItemLine({
    ...item, kind: 'episode', text: '手改后的事实正文', sensitivity: 'secret', validUntil: f.now() + 1000,
  })) + '- 手写新增仍只是事实\n');
  clearIndexes(f); f.memory.reindex();
  assert.equal(f.memory.get(rule.id)?.text, '手改后仍使用原批准记录');
  assert.equal(f.memory.get(rule.id)?.sensitivity, 'confidential');
  assert.equal(f.memory.get(rule.id)?.validUntil, f.now());
  assert.equal(f.memory.profile().length, 0);
  assert.equal(f.memory.get(item.id)?.kind, 'episode');
  assert.equal(f.memory.get(item.id)?.sensitivity, 'secret');
  assert.deepEqual(f.memory.get(item.id)?.origin, companion);
  assert.deepEqual(f.memory.get(item.id)?.about, item.about);
  assert.equal(ledger(f).find((r) => r.id === item.id)?.hash, tombstoneHash('手改后的事实正文'));
  assert.equal(f.memory.list().find((i) => i.text === '手写新增仍只是事实')?.kind, 'fact');
  assertIndexes(f);
});

test('index, provenance removal and forgotten tombstone roll back together on a deletion transaction failure', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember(fact('故障回滚时保留安全元数据', companion));
  f.memory.remember(fact('保证备份包含待删事实'));
  const history = ledger(f);
  clearIndexes(f);
  writeFileSync(item.file, readFileSync(item.file, 'utf8').split('\n').filter((l) => !l.includes(`id=${item.id};`)).join('\n'));
  const transaction = f.storage.transaction.bind(f.storage);
  let fail = true;
  f.storage.transaction = <T>(work: (tx: Tx) => T): T => transaction((tx) => work({
    ...tx,
    run(sql, params) {
      const result = tx.run(sql, params);
      if (fail && sql === 'DELETE FROM mem_provenance WHERE id = ?') { fail = false; throw new Error('injected ledger deletion failure'); }
      return result;
    },
  }));
  assert.throws(() => f.memory.reindex(), /injected ledger deletion failure/);
  assert.deepEqual(ledger(f), history);
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
  assert.equal(f.memory.list().length, 0);
  f.memory.reindex();
  assert.ok(!ledger(f).some((r) => r.id === item.id));
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 1);
  assert.ok(!readFileSync(item.file + '.bak', 'utf8').includes(item.text));
  assertIndexes(f);
});

test('retype promotes in place across layers and origins, preserving all other metadata and surrounding Markdown', (t) => {
  const origins: MemoryOrigin[] = [user, companion, external, {
    kind: 'consolidation', runId: 'run_retype', evidence: [{ kind: 'memory', id: 'mem_basis' }],
  }];
  for (const layer of ['profile', 'long_term'] as const) for (const origin of origins) {
    const f = fixture(); t.after(f.cleanup);
    const item = f.memory.remember({ ...fact('修改类型不应替换这条正文', origin), layer,
      about: ['person:owner', 'entity:test:1'], sensitivity: 'secret', validUntil: f.now() });
    const neighbor = f.memory.remember({ ...fact('同文件的邻居保持不变'), layer });
    writeFileSync(item.file, readFileSync(item.file, 'utf8').replaceAll('\n', '\r\n') + '自定义尾段不换行');
    f.memory.reindex();
    const before = f.memory.get(item.id)!;
    const contents = readFileSync(item.file, 'utf8');
    const files = readdirSync(f.companionDir);
    f.advance(1000);
    f.changes.length = 0; f.audit.length = 0; f.logs.length = 0;
    const promoted = f.memory.retype(item.id, 'rule', OWNER_ACTOR, 'ev_edit');
    assert.deepEqual(promoted, { ...before, kind: 'rule', origin: { kind: 'user', evidenceType: 'local_edit', evidenceId: 'ev_edit' } });
    assert.deepEqual(f.memory.get(item.id), promoted);
    assert.deepEqual(f.memory.get(neighbor.id), neighbor);
    assert.equal(readFileSync(item.file, 'utf8'), contents.replace(formatItemLine(before), formatItemLine(promoted)));
    assert.equal(readFileSync(item.file + '.bak', 'utf8'), contents);
    assert.deepEqual(readdirSync(f.companionDir), files);
    assert.deepEqual(f.changes, [{ change: 'updated', id: item.id, layer }]);
    assert.equal(f.audit.length, 1);
    assert.deepEqual(f.audit[0].actor, OWNER_ACTOR);
    assert.deepEqual(f.audit[0].detail, { action: 'updated', id: item.id, layer });
    assert.equal(f.logs.length, 1);
    assert.ok(!JSON.stringify([f.audit, f.logs, f.changes]).includes(item.text));
    assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
    assertIndexes(f);
    f.valid.clear(); clearIndexes(f); f.memory.stop(); f.memory.start(); f.memory.reindex();
    assert.deepEqual(f.memory.get(item.id), promoted);
    assertIndexes(f);
  }
});

test('retype demotes rules without replacing their full original user proof or other metadata', (t) => {
  const origins: MemoryOrigin[] = [user,
    { kind: 'user', evidenceType: 'decision', evidenceId: 'ev_decision' },
    { kind: 'user', evidenceType: 'local_edit', evidenceId: 'ev_original_edit' },
  ];
  for (const layer of ['profile', 'long_term'] as const) for (const origin of origins) {
    const f = fixture(); t.after(f.cleanup);
    f.valid.set('ev_original_edit', 'local_edit');
    const item = f.memory.remember({ ...fact('降低类型也应保留原批准记录', origin), layer, kind: 'rule',
      about: ['person:owner'], sensitivity: 'confidential', validUntil: f.now() + 1000 });
    const contents = readFileSync(item.file, 'utf8');
    if (origin.kind === 'user') f.valid.delete(origin.evidenceId);
    f.advance(1000);
    f.changes.length = 0; f.audit.length = 0;
    const demoted = f.memory.retype(item.id, 'fact', OWNER_ACTOR, 'ev_edit');
    assert.deepEqual(demoted, { ...item, kind: 'fact' });
    assert.equal(readFileSync(item.file, 'utf8'), contents.replace(formatItemLine(item), formatItemLine(demoted)));
    assert.deepEqual(f.changes, [{ change: 'updated', id: item.id, layer }]);
    assert.deepEqual(f.audit.map((r) => r.detail), [{ action: 'updated', id: item.id, layer }]);
    assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
    assertIndexes(f);
    f.valid.clear(); clearIndexes(f); f.memory.reindex();
    assert.deepEqual(f.memory.get(item.id), demoted);
    assertIndexes(f);
  }
});

test('retype requires real local_edit proof even for same-kind requests; message, decision and memfile claims do not suffice', (t) => {
  const f = fixture(); t.after(f.cleanup);
  for (const kind of ['fact', 'rule'] as const) {
    const item = f.memory.remember({ ...fact('类型操作必须由真正本地编辑证明'), kind });
    const contents = readFileSync(item.file, 'utf8');
    const history = ledger(f);
    f.changes.length = 0; f.audit.length = 0; f.logs.length = 0; f.verifications.length = 0;
    for (const target of ['fact', 'rule'] as const) for (const evidenceId of ['', 'forged', 'ev_message', 'ev_decision', 'memfile:claimed']) {
      f.storage.statements.length = 0;
      assert.throws(() => f.memory.retype(item.id, target, OWNER_ACTOR, evidenceId), errorCode('rejected'));
      assert.deepEqual(f.storage.statements, []);
    }
    assert.ok(f.verifications.length > 0 && f.verifications.every((v) => v.type === 'local_edit'));
    assert.deepEqual(f.memory.get(item.id), item);
    assert.equal(readFileSync(item.file, 'utf8'), contents);
    assert.deepEqual(ledger(f), history);
    assert.deepEqual([f.changes, f.audit, f.logs], [[], [], []]);
    assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
  }
});

test('retype rejects every non-user actor even with valid local edit evidence', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember(fact('非用户不能改变记忆类型', companion));
  const contents = readFileSync(item.file, 'utf8');
  f.changes.length = 0; f.audit.length = 0; f.verifications.length = 0;
  for (const by of [system, { kind: 'capability', id: 'capability:test' },
    { kind: 'remote', personId: 'person:local:owner', via: 'test' }] as const) {
    for (const kind of ['fact', 'rule'] as const) assert.throws(() => f.memory.retype(item.id, kind, by, 'ev_edit'), errorCode('rejected'));
  }
  assert.deepEqual(f.verifications, []);
  assert.deepEqual(f.memory.get(item.id), item);
  assert.equal(readFileSync(item.file, 'utf8'), contents);
  assert.deepEqual([f.changes, f.audit], [[], []]);
});

test('retype validates target kinds and rejects journal layers and non-journal episodes without writes', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember(fact('类型参数需要运行时检查'));
  const episode = f.memory.remember({ ...fact('长期层的事件也不可转换'), kind: 'episode' });
  f.memory.appendJournal('2026-11-19', { text: '日记事件不可转换', origin: companion, sensitivity: 'normal' });
  const journal = f.memory.journal('2026-11-19')[0];
  // The layer guard must also protect manually marked journal facts, not only episodes.
  writeFileSync(journal.file, readFileSync(journal.file, 'utf8').replace('kind=episode', 'kind=fact'));
  f.memory.reindex();
  const before = f.memory.list({ includeExpired: true });
  const history = ledger(f);
  const contents = new Map(before.map((i) => [i.file, readFileSync(i.file, 'utf8')]));
  f.changes.length = 0; f.audit.length = 0; f.logs.length = 0; f.storage.statements.length = 0;
  for (const kind of ['episode', 'unknown', '', null, undefined, 1]) {
    assert.throws(() => f.memory.retype(item.id, kind as 'rule', OWNER_ACTOR, 'ev_edit'), errorCode('bad_request'));
  }
  for (const id of [episode.id, journal.id]) for (const kind of ['fact', 'rule'] as const) {
    assert.throws(() => f.memory.retype(id, kind, OWNER_ACTOR, 'ev_edit'), errorCode('rejected'));
  }
  assert.throws(() => f.memory.retype('missing', 'rule', OWNER_ACTOR, 'ev_edit'), errorCode('not_found'));
  assert.ok(!f.storage.statements.some((sql) => /^(INSERT|UPDATE|DELETE)/i.test(sql)));
  assert.deepEqual(f.memory.list({ includeExpired: true }), before);
  assert.deepEqual(ledger(f), history);
  for (const [path, content] of contents) assert.equal(readFileSync(path, 'utf8'), content);
  assert.deepEqual([f.changes, f.audit, f.logs], [[], [], []]);
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
});

test('same-kind retype returns the original after authentication without SQL, filesystem, audit or event writes', (t) => {
  const f = fixture(); t.after(f.cleanup);
  for (const kind of ['fact', 'rule'] as const) {
    const item = f.memory.remember({ ...fact('重复类型请求不应刷新原证据', kind === 'fact' ? companion : user), kind, about: ['entity:test:1'] });
    f.memory.remember(fact('创建备份以验证无操作请求'));
    const history = ledger(f);
    const files = readdirSync(f.companionDir);
    const paths = [item.file, item.file + '.bak'];
    const stats = paths.map((path) => statSync(path));
    const contents = paths.map((path) => readFileSync(path, 'utf8'));
    f.changes.length = 0; f.audit.length = 0; f.logs.length = 0; f.verifications.length = 0; f.storage.statements.length = 0;
    f.advance(1000);
    assert.deepEqual(f.memory.retype(item.id, kind, OWNER_ACTOR, 'ev_edit'), item);
    assert.deepEqual(f.verifications, [{ id: 'ev_edit', type: 'local_edit' }]);
    assert.ok(!f.storage.statements.some((sql) => /^(INSERT|UPDATE|DELETE)/i.test(sql)));
    for (const [index, path] of paths.entries()) {
      const stat = statSync(path);
      assert.equal(stat.ino, stats[index].ino);
      assert.equal(stat.mtimeMs, stats[index].mtimeMs);
      assert.equal(stat.ctimeMs, stats[index].ctimeMs);
      assert.equal(stat.size, stats[index].size);
    }
    assert.deepEqual(paths.map((path) => readFileSync(path, 'utf8')), contents);
    assert.deepEqual(readdirSync(f.companionDir), files);
    assert.deepEqual(ledger(f), history);
    assert.deepEqual([f.changes, f.audit, f.logs], [[], [], []]);
    assertIndexes(f);
  }
});

test('retype duplicate-id conflict preserves original lines and ledger without tombstones or forgotten events', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember(fact('重复标识冲突时保留原文', companion));
  const history = ledger(f);
  const contents = readFileSync(item.file, 'utf8') + formatItemLine({ ...item, text: '同标识的第二条原文' }) + '\n';
  writeFileSync(item.file, contents);
  f.changes.length = 0; f.audit.length = 0;
  assert.throws(() => f.memory.retype(item.id, 'rule', OWNER_ACTOR, 'ev_edit'), errorCode('conflict'));
  assert.equal(readFileSync(item.file, 'utf8'), contents);
  assert.deepEqual(f.memory.get(item.id), item);
  assert.deepEqual(ledger(f), history);
  assert.ok(f.changes.every((c) => c.change === 'issue'));
  assert.ok(f.audit.every((r) => r.detail?.action === 'issue'));
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
});

test('retype fails closed on edits arriving after synchronization without overwriting the newer body', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember({ ...fact('并发类型修改时保留正文', companion), about: ['entity:test:1'] });
  writeFileSync(item.file, readFileSync(item.file, 'utf8') + '- 同步时导入的新事实\n');
  const onChange = f.deps.onChange;
  let contents = '';
  f.deps.onChange = (change) => {
    onChange(change);
    if (!contents && change.change === 'created') {
      contents = readFileSync(item.file, 'utf8').replace(item.text, '同步之后用户编辑的新正文');
      writeFileSync(item.file, contents);
    }
  };
  f.changes.length = 0; f.audit.length = 0;
  assert.throws(() => f.memory.retype(item.id, 'rule', OWNER_ACTOR, 'ev_edit'), errorCode('conflict'));
  assert.ok(contents);
  assert.equal(readFileSync(item.file, 'utf8'), contents);
  assert.deepEqual(f.memory.get(item.id), item);
  assert.deepEqual(ledger(f).find((r) => r.id === item.id)?.origin, companion);
  assert.ok(f.changes.every((c) => c.change === 'created'));
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
  f.memory.reindex();
  assert.equal(f.memory.get(item.id)?.text, '同步之后用户编辑的新正文');
  assert.equal(f.memory.get(item.id)?.kind, 'fact');
  assert.ok(!f.changes.some((c) => c.change === 'forgotten'));
  assertIndexes(f);
});

test('retype atomic replacement failure retains the original body and rolls back indexes and provenance', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember({ ...fact('原子替换失败不能删掉正文', companion), about: ['entity:test:1'] });
  const contents = readFileSync(item.file, 'utf8');
  const history = ledger(f);
  mkdirSync(item.file + '.bak');
  f.changes.length = 0; f.audit.length = 0; f.logs.length = 0;
  assert.throws(() => f.memory.retype(item.id, 'rule', OWNER_ACTOR, 'ev_edit'), (error: unknown) =>
    error instanceof Error && ['EISDIR', 'ENOTDIR', 'EEXIST'].includes((error as NodeJS.ErrnoException).code ?? ''));
  assert.equal(readFileSync(item.file, 'utf8'), contents);
  assert.deepEqual(f.memory.get(item.id), item);
  assert.deepEqual(ledger(f), history);
  assert.deepEqual([f.changes, f.audit, f.logs], [[], [], []]);
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
  assert.equal(readdirSync(f.companionDir).filter((name) => name.endsWith('.tmp')).length, 0);
  assertIndexes(f);
});

test('retype SQL failure after filesystem replacement keeps body and backup, rolls back SQL, and never forgets', (t) => {
  const f = fixture(); t.after(f.cleanup);
  const item = f.memory.remember({ ...fact('跨介质失败仍然保留同一正文', { kind: 'user', evidenceType: 'local_edit', evidenceId: 'ev_edit' }),
    about: ['entity:test:1'] });
  const contents = readFileSync(item.file, 'utf8');
  const history = ledger(f);
  const transaction = f.storage.transaction.bind(f.storage);
  let fail = true;
  f.storage.transaction = <T>(work: (tx: Tx) => T): T => transaction((tx) => work({
    ...tx,
    run(sql, params) {
      const result = tx.run(sql, params);
      if (fail && sql.startsWith('INSERT INTO mem_files')) { fail = false; throw new Error('injected retype file-index failure'); }
      return result;
    },
  }));
  f.changes.length = 0; f.audit.length = 0; f.logs.length = 0;
  assert.throws(() => f.memory.retype(item.id, 'rule', OWNER_ACTOR, 'ev_edit'), /injected retype file-index failure/);
  assert.equal(readFileSync(item.file, 'utf8'), contents.replace('kind=fact', 'kind=rule'));
  assert.equal(readFileSync(item.file + '.bak', 'utf8'), contents);
  assert.deepEqual(f.memory.get(item.id), item);
  assert.deepEqual(ledger(f), history);
  assert.deepEqual(f.memory.search(item.text), [item]);
  assert.deepEqual([f.changes, f.audit, f.logs], [[], [], []]);
  assert.equal(f.storage.transaction((tx) => tx.all('SELECT * FROM mem_tombstones')).length, 0);
  f.memory.reindex();
  assert.deepEqual(f.memory.get(item.id), { ...item, kind: 'rule' });
  assert.ok(!f.changes.some((c) => c.change === 'forgotten'));
  assertIndexes(f);
});
