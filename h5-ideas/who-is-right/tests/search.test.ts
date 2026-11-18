import { describe, expect, it } from 'vitest';
import { library } from '../src/content/library';
import { buildIndex, normalize, search } from '../src/search';

const index = buildIndex(library.sayings);
const top = (q: string) => search(index, q)[0]?.saying.id;

describe('normalize', () => {
  it('同义词单次替换，不会连锁', () => {
    expect(normalize('发烧')).toBe('发烧');
    expect(normalize('发热')).toBe('发烧');
    expect(normalize('小孩子')).toBe('孩子');
    expect(normalize('隔夜菜')).toBe('剩菜');
  });

  it('去掉空格和标点、全角转半角、大小写统一', () => {
    expect(normalize(' 少吃，盐！ ')).toBe('少吃盐');
    expect(normalize('ＩＰＡＤ')).toBe(normalize('手机'));
  });
});

describe('search', () => {
  it.each([
    ['发烧要捂汗', 'fever-cover-sweat'],
    ['宝宝发热要捂一捂', 'fever-cover-sweat'],
    ['隔夜菜会致癌', 'leftovers'],
    ['剩饭剩菜', 'leftovers'],
    ['蛋黄别扔', 'egg-yolk'],
    ['学步车', 'baby-walker'],
    ['少放盐', 'salt-less'],
    ['小孩少看电视', 'screen-time-kids'],
    ['不吃早饭', 'breakfast'],
    ['追着喂饭', 'toddler-self-feeding'],
  ])('“%s” → %s', (q, id) => {
    expect(top(q)).toBe(id);
  });

  it('空查询和纯标点返回空', () => {
    expect(search(index, '')).toEqual([]);
    expect(search(index, '   ')).toEqual([]);
    expect(search(index, '？！，。')).toEqual([]);
  });

  it('库里没有的话返回空结果，而不是硬凑', () => {
    expect(search(index, '打雷不能洗澡')).toEqual([]);
    expect(search(index, 'xyz')).toEqual([]);
    expect(search(index, '量子力学')).toEqual([]);
  });

  it('结果按分数从高到低，且不超过上限', () => {
    const hits = search(index, '孩子', 3);
    expect(hits.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < hits.length; i++) expect(hits[i - 1].score).toBeGreaterThanOrEqual(hits[i].score);
  });
});
