import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createServer, request } from 'node:http';
import { fixture, openStream } from './fixture.ts';
import { SqliteStorage } from '../../src/platform/storage.ts';
import { createEventHub } from '../../src/surfaces/events.ts';
import { STREAM_RETENTION } from '../../src/contracts/index.ts';

test('chunked oversized and malformed request bodies return unified 400 errors', async (t) => {
  const f = await fixture(t);
  const response = await new Promise<{ status: number; text: string }>((resolve, reject) => {
    const req = request(`${f.base}/chat`, { method: 'POST', headers: { Authorization: `Bearer ${f.token}`, 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, (res) => {
      let text = '';
      res.setEncoding('utf8'); res.on('data', (chunk: string) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode!, text }));
    });
    req.on('error', reject);
    req.write('{"message":"'); req.write('x'.repeat(65537)); req.end('"}');
  });
  assert.equal(response.status, 400); assert.equal(JSON.parse(response.text).error.code, 'bad_request');
  const invalid = await fetch(`${f.base}/chat`, { method: 'POST', headers: { Authorization: `Bearer ${f.token}`, 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(invalid.status, 400);
});

test('SSE heartbeat, age-window resync and persisted checkpoint across event hub recreation', async (t) => {
  const storage = new SqliteStorage(':memory:');
  let now = 0;
  const events = createEventHub({ storage, now: () => now, maxAgeMs: 100, heartbeatMs: 10 });
  const server = createServer((req, res) => events.connect(req, res));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as { port: number }).port;
  const stream = await openStream(`http://127.0.0.1:${port}`, 'fake');
  try {
    await stream.until((source) => source.includes(': ping'));
    assert.equal(STREAM_RETENTION.heartbeatMs, 15000);
    events.emit({ type: 'memory.changed', data: { change: 'reindexed' } });
    const checkpoint = events.seq();
    const recreated = createEventHub({ storage, now: () => now });
    assert.equal(recreated.seq(), checkpoint);
    now = 101; events.prune();
    const old = await openStream(`http://127.0.0.1:${port}`, 'fake', 0);
    try { await old.until((source) => source.includes('resync_required')); }
    finally { old.close(); }
  } finally {
    stream.close(); events.stop();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    storage.close();
  }
});
