import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseFact } from '../../scripts/notify.ts';

test('notify fact parser preserves labels/values/units and rejects malformed flags', () => {
  assert.deepEqual(parseFact('评审中=3:个'), { label: '评审中', value: 3, unit: '个' });
  assert.deepEqual(parseFact('负责人=张三'), { label: '负责人', value: '张三' });
  assert.deepEqual(parseFact('编号=003'), { label: '编号', value: '003' });
  assert.throws(() => parseFact('invalid'));
  assert.throws(() => parseFact('标签='));
});
