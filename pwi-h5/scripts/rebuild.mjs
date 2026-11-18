import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { registerHooks } from 'node:module';
import { fileURLToPath } from 'node:url';
import { CLASSES, SKILLS, findSkill, skillReq, skillResources } from '../src/data/classes.js';
import { CLASS_SOURCES, SKILL_SOURCES, normalizeSkillWeapons } from '../src/data/skill-sources.js';
import { CULTIVATION, CULT_TRIALS, HOME_CITY, ZONES } from '../src/data/world.js';
import { HIGH_EQUIPMENT } from '../src/data/high-equipment.js';
import { ITEMS, makeEquip, makeHighEquip, equipStats, equippedWeaponType, gradeOf } from '../src/data/items.js';
import { GEAR_RULES, gearSpec } from '../src/data/gear-specs.js';
import { buildMainline } from '../src/data/quests.js';
import { Game, validateSave } from '../src/core/game.js';
import { stats, expNeed, makeMonster, monsterReward } from '../src/core/model.js';
import { createBattle, canUseSkill, pickAutoAction, takeTurn, expectedAttack } from '../src/core/combat.js';
import { productionAction } from '../src/core/production.js';

// Run: node /absolute/path/to/scripts/rebuild.mjs (Node 24).
// Only local files are read. No browser, storage adapter, network, upstream
// execution, real saves, or writes. Synthetic learning/save fixtures are NOT
// earned progression; the separate journeys use only normal Game actions.
const root = new URL('../', import.meta.url);
const path = (relative) => fileURLToPath(new URL(relative, root));
const readJSON = (relative) => JSON.parse(readFileSync(path(relative), 'utf8'));
const failures = [];
let tests = 0;
let passed = 0;
let sourceRanks = 0;
let learningRanks = 0;
const journeys = [];
const savedRandom = Math.random;
const savedUUID = globalThis.crypto.randomUUID;
const globalDescriptors = new Map();
const sourceSignature = () => JSON.stringify({ CLASSES, SKILLS, CLASS_SOURCES, SKILL_SOURCES, HIGH_EQUIPMENT });
const originalSourceSignature = sourceSignature();

function test(name, fn) {
  tests++;
  try { fn(); passed++; }
  catch (error) {
    const detail = String(error.message).split('\n').slice(0, 4).join(' ');
    failures.push({ name, detail });
    console.error(`FAIL ${name}: ${detail}`);
  }
}
function seeded(seed) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let x = Math.imul(n ^ (n >>> 15), n | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}
function newGame(cls) { const g = new Game(); g.start('回归修士', cls); return g; }
function rejected(g, fn, pattern) {
  const before = structuredClone(g.state);
  const message = g.message;
  assert.throws(fn, pattern);
  assert.deepEqual(g.state, before, 'rejected action changed resources or state');
  assert.equal(g.message, message);
}
function finiteTree(value, label = 'state') {
  if (typeof value === 'number') assert.ok(Number.isFinite(value), `${label} is not finite`);
  else if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) finiteTree(child, `${label}.${key}`);
  }
}
function finiteStats(p, battle = null) {
  const st = stats(p, battle);
  for (const [key, value] of Object.entries(st)) assert.ok(Number.isFinite(value), `stats.${key} is not finite`);
  assert.ok(st.hp > 0 && st.mp > 0 && st.atkMin <= st.atkMax);
  return st;
}
function checkSave(g) {
  finiteTree(g.state);
  finiteStats(g.p, g.busy ? g.battle : null);
  const raw = JSON.parse(g.export());
  const before = structuredClone(raw);
  const clean = validateSave(raw);
  assert.deepEqual(raw, before, 'save validation mutated its input');
  assert.deepEqual(clean, before);
  assert.notEqual(clean.player, raw.player);
  assert.notEqual(clean.player.skills, raw.player.skills);
  return clean;
}

// Independent stable-ID contract, not a derivation from the implementation.
const expected = {
  blademaster: ['wuxia', [['bm1', 1, '虎击'], ['bm2', 3, '凌风'], ['bm3', 55, '狂龙斩'], ['bm4', 77, '金钟罩'], ['bm5', 75, '万剑诀'], ['bm6', 70, '断岳扫'], ['bm7', 896, '狂龙之力'], ['bm8', 923, '一闪']]],
  wizard: ['fashi', [['wz1', 81, '烈火符'], ['wz2', 88, '涌泉'], ['wz3', 181, '磐石护甲'], ['wz4', 99, '泰山压顶'], ['wz5', 86, '炙炎阵'], ['wz6', 93, '玄冰水龙'], ['wz7', 87, '火海刀山']]],
  archer: ['yumang', [['ar1', 234, '引而不发'], ['ar2', 241, '落雷'], ['ar3', 235, '连射'], ['ar4', 254, '羽之守护'], ['ar5', 248, '利齿之矢'], ['ar6', 240, '箭阵'], ['ar7', 239, '致命矢']]],
  cleric: ['yuling', [['cl1', 127, '龙卷风'], ['cl2', 113, '清心咒'], ['cl3', 120, '坚甲符'], ['cl4', 128, '神雷'], ['cl5', 114, '静心咒'], ['cl6', 129, '和风拂面'], ['cl7', 18, '还魂咒'], ['cl8', 130, '狂雷天威']]],
  barbarian: ['yaoshou', [['bb1', 102, '兽王锤'], ['bb2', 112, '白虎变'], ['bb3', 12, '巨浪'], ['bb4', 104, '千斤锤'], ['bb5', 83, '巨灵神力'], ['bb6', 108, '兽王无敌'], ['bb7', 186, '玄武附体']]],
  venomancer: ['yaojing', [['vm1', 299, '剧毒蛊'], ['vm2', 328, '驯服宠物'], ['vm3', 330, '治疗宠物'], ['vm4', 301, '炎蛊'], ['vm5', 312, '妖狐变'], ['vm6', 303, '千蚁蛊'], ['vm7', 329, '复活宠物']]],
  assassin: ['cike', [['as1', 1111, '连击'], ['as2', 1093, '遁隐术'], ['as3', 1118, '斩杀'], ['as4', 1114, '放血'], ['as5', 1121, '狂乱斩'], ['as6', 1123, '深刺'], ['as7', 1112, '斩首']]],
  psychic: ['wushi', [['ps1', 1125, '灵爆咒'], ['ps2', 1126, '冲击术'], ['ps3', 1132, '狂沙穿空咒'], ['ps4', 1102, '复仇之魂—镜像'], ['ps5', 1128, '气爆术'], ['ps6', 1133, '大地灵引咒'], ['ps7', 1134, '水瀑泓泱']]],
  seeker: ['jianling', [['sk1', 1350, '碎石剑气'], ['sk2', 1352, '流光剑气'], ['sk3', 1358, '八方剑影'], ['sk4', 1340, '三才剑咒'], ['sk5', 1351, '破风剑气'], ['sk6', 1359, '剑神无敌'], ['sk7', 1732, '翔龙剑劲']]],
  mystic: ['meiling', [['my1', 1374, '青藤绕'], ['my2', 1385, '武神现世'], ['my3', 1381, '灵光普照'], ['my4', 1384, '满地枝'], ['my5', 1377, '乱舞清风'], ['my6', 1383, '落英缤纷'], ['my7', 1386, '魔神现世']]],
};
// Independent, explicit supported-category oracle; known unsupported categories
// are retained as evidence, not inferred permissions.
const weaponTokens = {
  空手: ['unarmed'], 刀剑: ['blade', 'sword'], 拳套: [], 长兵: [], 法器: ['wand', 'glaive'],
  斧锤: ['axe'], 弓弩: ['bow'], 长鞭: [], 匕首: ['dagger'], 法宝: ['soulsphere'],
};
const sourceRecord = (cls, id) => {
  const s = findSkill(cls, id).source;
  const records = readJSON(s.archive).skills.filter((r) => r.id === s.originalId && r.name === s.originalName && r.xianmo === '3');
  assert.equal(records.length, 1);
  return records[0];
};
function combatFixture(cls, id, rank = 1) {
  const g = newGame(cls), sk = findSkill(cls, id);
  g.p.lv = 105; g.p.cult = sk.cult; g.p.path = sk.cult >= 9 ? 'sage' : null;
  g.p.skills = { [id]: rank }; g.p.chi = 300;
  g.p.hp = stats(g.p).hp; g.p.mp = stats(g.p).mp;
  const b = createBattle(g.p, [{ name: '分量测试靶', lv: 105, hp: 1000000, maxHp: 1000000, atk: 0, def: 0, mdef: 0 }], { type: 'arena' });
  return { g, p: g.p, b, sk, m: b.monsters[0] };
}
function fixedRandom(fn, value = 0.5) {
  const previous = Math.random;
  Math.random = () => value;
  try { return fn(); } finally { Math.random = previous; }
}
const approx = (actual, wanted, label = '') => assert.ok(Math.abs(actual - wanted) < 1e-9, `${label}: ${actual} !== ${wanted}`);
const localMitigate = (amount, defense) => amount * 100 / (100 + Math.max(0, defense) * 0.32);
const cultivationNames = [
  ['筑基'], ['灵虚'], ['和合'], ['元婴'], ['空冥'], ['履霜'], ['渡劫'], ['寂灭'], ['大乘'],
  ['上仙', '狂魔'], ['真仙', '魔圣'], ['天仙', '魔尊'],
];

// Restricted data-literal parser. Never eval/import/execute archived JS, and
// never interpret formulas, calls, identifiers or expressions as numbers.
class LiteralReader {
  constructor(text, position = 0) { this.text = text; this.position = position; }
  fail() { throw new Error(`Non-literal archive data at offset ${this.position}`); }
  skip() {
    while (this.position < this.text.length) {
      if (/\s/.test(this.text[this.position])) this.position++;
      else if (this.text.startsWith('//', this.position)) {
        const end = this.text.indexOf('\n', this.position);
        this.position = end < 0 ? this.text.length : end + 1;
      } else if (this.text.startsWith('/*', this.position)) {
        const end = this.text.indexOf('*/', this.position + 2);
        if (end < 0) this.fail();
        this.position = end + 2;
      } else break;
    }
  }
  value(depth = 0) {
    assert.ok(depth <= 30, 'archive literal nesting limit');
    this.skip();
    const ch = this.text[this.position];
    if (ch === '"' || ch === "'") {
      this.position++;
      let out = '';
      while (this.position < this.text.length) {
        let c = this.text[this.position++];
        if (c === ch) return out;
        if (c === '\\') {
          c = this.text[this.position++];
          if (c === 'u' || c === 'x') {
            const length = c === 'u' ? 4 : 2;
            const hex = this.text.slice(this.position, this.position + length);
            if (!new RegExp(`^[a-fA-F0-9]{${length}}$`).test(hex)) this.fail();
            out += String.fromCharCode(Number.parseInt(hex, 16));
            this.position += length;
          } else if (c === '\n') continue;
          else if (c === '\r') { if (this.text[this.position] === '\n') this.position++; }
          else out += ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' })[c] ?? c;
        } else out += c;
      }
      this.fail();
    }
    if (ch === '[' || ch === '{') {
      const object = ch === '{', close = object ? '}' : ']';
      const out = object ? {} : [];
      this.position++;
      while (this.position < this.text.length) {
        this.skip();
        if (this.text[this.position] === close) { this.position++; return out; }
        if (!object && this.text[this.position] === ',') {
          out.push({ $arrayHole: true }); this.position++; continue;
        }
        if (object) {
          let key;
          if (['"', "'"].includes(this.text[this.position])) key = this.value(depth + 1);
          else {
            const match = /^[A-Za-z_$][\w$]*/.exec(this.text.slice(this.position));
            if (!match) this.fail();
            key = match[0]; this.position += key.length;
          }
          assert.ok(!['__proto__', 'prototype', 'constructor'].includes(key), 'unsafe archive key');
          this.skip();
          if (this.text[this.position++] !== ':') this.fail();
          out[key] = this.value(depth + 1);
        } else out.push(this.value(depth + 1));
        this.skip();
        if (this.text[this.position] === ',') this.position++;
        else if (this.text[this.position] !== close) this.fail();
      }
      this.fail();
    }
    const number = /^-?(?:\d+\.\d*|\d+|\.\d+)(?:[eE][+-]?\d+)?/.exec(this.text.slice(this.position));
    if (number) {
      this.position += number[0].length;
      const value = Number(number[0]);
      assert.ok(Number.isFinite(value), 'non-finite archive literal');
      return value;
    }
    for (const [literal, value] of [['true', true], ['false', false], ['null', null]]) {
      if (this.text.startsWith(literal, this.position)) { this.position += literal.length; return value; }
    }
    this.fail();
  }
}
function parseLiteral(text) {
  const parser = new LiteralReader(text), value = parser.value();
  parser.skip();
  assert.equal(parser.position, text.length, 'trailing executable expression');
  return value;
}

// Exact fixtures for each next-rank transaction, not natural player histories.
function learningFixture(cls, sk, to) {
  const g = newGame(cls), req = skillReq(sk, to);
  g.p.lv = Math.max(req.level, CULTIVATION[sk.cult].lv);
  g.p.cult = sk.cult;
  g.p.path = sk.cult >= 9 ? 'sage' : null;
  g.p.sp = req.sp;
  g.p.gold = req.gold;
  if (to === 1) delete g.p.skills[sk.id];
  else g.p.skills[sk.id] = to - 1;
  return g;
}

let hook;
try {
  for (const name of ['localStorage', 'sessionStorage', 'indexedDB', 'fetch']) {
    globalDescriptors.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
    Object.defineProperty(globalThis, name, { configurable: true, get() { throw new Error(`Forbidden regression access: ${name}`); } });
  }

  test('restricted parser rejects code and preserves holes/formulas', () => {
    assert.deepEqual(parseLiteral("/* data */ [{id:1,name:'\\u864e\\x31',cost:'5*level'},,null,]"), [{ id: 1, name: '虎1', cost: '5*level' }, { $arrayHole: true }, null]);
    for (const text of ['[1+2]', '[Math.random()]', '[(()=>42)()]', '[undefined]', '{cost:10*level}', '[1];globalThis.bad=true', '{__proto__:null}']) assert.throws(() => parseLiteral(text));
    assert.equal(Object.hasOwn(globalThis, 'bad'), false);
  });
  test('ten classes, 72 stable skill IDs, exact cultivation names', () => {
    assert.deepEqual(Object.keys(CLASSES).sort(), Object.keys(expected).sort());
    assert.deepEqual(Object.keys(SKILLS).sort(), Object.keys(expected).sort());
    const ids = Object.values(expected).flatMap(([, rows]) => rows.map(([id]) => id));
    assert.equal(ids.length, 72);
    assert.deepEqual(Object.keys(SKILL_SOURCES).sort(), [...ids].sort());
    assert.deepEqual(CULTIVATION.map((c) => Array.isArray(c.name) ? c.name : [c.name]), cultivationNames);
    assert.deepEqual(CULTIVATION.map((c) => c.lv), [1, 9, 19, 29, 39, 49, 59, 69, 79, 89, 99, 100]);
    assert.equal(CULT_TRIALS.length, CULTIVATION.length);
    for (let rank = 1; rank < CULTIVATION.length; rank++) assert.ok(CULT_TRIALS[rank].lv >= CULTIVATION[rank].lv);
  });

  for (const [cls, [key, rows]] of Object.entries(expected)) {
    let archive;
    test(`archive ${cls}: checksum + raw literals = structured JSON`, () => {
      archive = readJSON(`official-library/structured/skills-${key}.json`);
      const source = CLASS_SOURCES[cls];
      assert.equal(source.key, key);
      assert.equal(source.archive, `official-library/structured/skills-${key}.json`);
      assert.equal(archive.source, source.url);
      assert.equal(archive.class, CLASSES[cls].name);
      const meta = readJSON(`official-library/assets/${source.skillSourceId}.meta.json`);
      assert.equal(meta.url, source.url);
      assert.equal(meta.status, 'ok');
      assert.equal(meta.path, `assets/${source.skillSourceId}.js`);
      const bytes = readFileSync(path(`official-library/${meta.path}`));
      assert.equal(bytes.length, meta.bytes);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), meta.sha256);
      // Python's archive label utf-8-sig means UTF-8 with an optional BOM;
      // TextDecoder('utf-8') strips that BOM without a replacement decode.
      const encoding = archive.encoding === 'utf-8-sig' ? 'utf-8' : archive.encoding;
      const text = new TextDecoder(encoding, { fatal: true }).decode(bytes);
      for (const [branch, values] of Object.entries(archive.arrays)) {
        assert.match(branch, /^[A-Za-z_$][\w$]*$/);
        const match = new RegExp(`(?:var|let|const)\\s+${branch}\\s*=\\s*(?=[\\[{])`).exec(text);
        assert.ok(match, `raw branch missing: ${branch}`);
        const parsed = new LiteralReader(text, match.index + match[0].length).value();
        assert.deepEqual(parsed, values, `raw/JSON mismatch in ${key}.${branch}`);
      }
      const flattened = Object.values(archive.arrays).filter(Array.isArray).flat().filter((r) => r && typeof r === 'object' && Object.hasOwn(r, 'id') && Object.hasOwn(r, 'name'));
      assert.deepEqual(flattened, archive.skills, 'flattened archive lost variants');
      assert.deepEqual(SKILLS[cls].map((sk) => sk.id), rows.map(([id]) => id));
    });
    for (const [id, originalId, originalName] of rows) {
      test(`source ${id}: normal identity, all ranks, tutorial/cultivation`, () => {
        assert.ok(archive, 'archive unavailable');
        const matches = archive.skills.filter((r) => r.id === originalId && r.name === originalName && r.xianmo === '3');
        assert.equal(matches.length, 1, `normal record is not unique: ${originalId}`);
        const r = matches[0], sk = findSkill(cls, id), source = SKILL_SOURCES[id];
        assert.equal(r.name, originalName);
        assert.equal(source.originalId, originalId);
        assert.equal(source.originalName, r.name);
        assert.equal(source.originalKind, r.clas);
        assert.equal(source.cultivation, r.intm);
        assert.equal(source.variant, 'normal');
        assert.equal(source.xianmo, '3');
        assert.equal(source.wuqi, r.wuqi, `${id} literal restriction differs from normal source`);
        const tokens = r.wuqi.split(/[；;、，,。]/).map((s) => s.trim()).filter(Boolean);
        assert.deepEqual(source.weapons.tokens, tokens);
        assert.ok(tokens.every((token) => Object.hasOwn(weaponTokens, token)), `${id}: uninspected restriction token`);
        assert.deepEqual(source.weapons.supportedTypes, [...new Set(tokens.flatMap((token) => weaponTokens[token]))]);
        assert.deepEqual(source.weapons.unsupportedTokens, tokens.filter((token) => !weaponTokens[token].length));
        assert.deepEqual(source.weapons.unknownTokens, []);
        assert.ok(Object.isFrozen(source.weapons) && Object.isFrozen(source.weapons.supportedTypes));
        assert.equal(source.maxLv, r.nanber);
        assert.equal(sk.name, r.name);
        assert.equal(sk.maxLv, r.nanber);
        const ranks = r.intm.split(/[、，,。；;]/).map((name) => cultivationNames.findIndex((names) => names.includes(name.trim())));
        assert.ok(ranks.length && ranks.every((rank) => rank >= 0 && rank === ranks[0]), `unmapped cultivation ${r.intm}`);
        assert.equal(sk.cult, ranks[0]);
        assert.equal(sk.source.cultivationRank, ranks[0]);
        assert.equal(sk.source.archive, CLASS_SOURCES[cls].archive);
        assert.deepEqual(sk.source.learning, source.learning);
        assert.equal(sk.tutorialUnlock, id === rows[0][0]);
        for (const [local, archived] of [['level', 'dengji'], ['sp', 'yuanshen'], ['gold', 'jinqian']]) {
          assert.equal(r[archived].length, r.nanber);
          assert.ok(r[archived].every((n) => Number.isSafeInteger(n) && n >= 0));
          assert.deepEqual(source.learning[local], r[archived], `${id}.${local} differs from archive`);
          assert.ok(Object.isFrozen(source.learning[local]));
        }
        assert.ok(Object.isFrozen(source) && Object.isFrozen(source.learning));
        assert.equal(sk.learning.length, r.nanber);
        for (let to = 1; to <= r.nanber; to++) {
          const tutorial = sk.tutorialUnlock && to === 1;
          const req = { level: tutorial ? 1 : Math.max(1, r.dengji[to - 1]), sp: tutorial ? 0 : r.yuanshen[to - 1], gold: tutorial ? 0 : r.jinqian[to - 1] };
          assert.deepEqual(skillReq(sk, to), req, `${id} rank ${to}`);
          for (const field of ['level', 'sp', 'gold']) {
            const basis = tutorial ? 'local-tutorial-unlock' : field === 'level' && r.dengji[to - 1] === 0 ? 'local-level-floor' : 'source';
            assert.equal(sk.learning[to - 1].basis[field], basis);
          }
          sourceRanks++;
        }
        assert.equal(sk.lv, skillReq(sk, 1).level);
        assert.deepEqual(skillReq(sk, sk.maxLv + 1), skillReq(sk, sk.maxLv));
        assert.deepEqual(skillReq(sk, Number.MAX_SAFE_INTEGER), skillReq(sk, sk.maxLv));
        const req = skillReq(sk, 1); req.sp++;
        assert.notEqual(skillReq(sk, 1).sp, req.sp, 'requirements are not detached');
        for (const rank of [0, -1, 1.5, NaN, Infinity, '1', null]) assert.throws(() => skillReq(sk, rank));
      });
    }
  }

  test('official attribute coefficients and +20 DEX = +1 percentage point', () => {
    const coefficients = {
      blademaster: [15, 9, 10, 10], wizard: [10, 14, 5, 2], archer: [13, 11, 8, 6], cleric: [10, 14, 5, 2],
      barbarian: [17, 14, 8, 8], venomancer: [12, 12, 7, 6], assassin: [13, 10, 8, 6], psychic: [10, 14, 5, 2],
      seeker: [15, 9, 10, 10], mystic: [10, 14, 8, 6],
    };
    const article = readFileSync(path('official-library/raw/75f04dc49a0514d036ea.html'), 'utf8').split('\n').slice(441, 490).join('\n');
    for (const [cls, [hp, mp, accuracy, evasion]] of Object.entries(coefficients)) {
      const c = CLASSES[cls], p = newGame(cls).p;
      assert.match(article, new RegExp(`${c.name}：每增加一点体质，HP增长${hp}点`));
      assert.match(article, new RegExp(`${c.name}：每增加一点灵力，MP增长${mp}点`));
      assert.match(article, new RegExp(`${c.name}：每增加一点敏捷，准确度增长${accuracy}点，躲闪度增长${evasion}点`));
      assert.deepEqual([c.hpCon, c.mpMag, c.accuracyDex, c.evasionDex], [hp, mp, accuracy, evasion]);
      p.equipment = {};
      const st = stats(p);
      assert.equal(stats({ ...p, attrs: { ...p.attrs, con: p.attrs.con + 1 } }).hp - st.hp, hp);
      assert.equal(stats({ ...p, attrs: { ...p.attrs, mag: p.attrs.mag + 1 } }).mp - st.mp, mp);
      const raised = stats({ ...p, attrs: { ...p.attrs, dex: p.attrs.dex + 20 } });
      approx(raised.crit - st.crit, 0.01, `${cls} crit`);
      assert.equal(raised.accuracyRating - st.accuracyRating, 20 * accuracy);
      assert.equal(raised.evasionRating - st.evasionRating, 20 * evasion);
      approx(raised.accuracy - st.accuracy, 20 * accuracy * 0.0001);
      approx(raised.dodge - st.dodge, 20 * evasion * 0.00005);
      assert.ok(st.accuracy !== st.accuracyRating && st.dodge !== st.evasionRating);
      assert.match(c.attributeSource.adaptation, /本作/);
    }
    assert.equal((article.match(/每增加20点敏捷就增长1%的致命一击率/g) || []).length, 10);
  });
  test('all 72 restrictions: generated, fixed, legacy and unarmed gates', () => {
    const observed = new Set();
    for (const [cls, skills] of Object.entries(SKILLS)) {
      for (const sk of skills) {
        const { p, b } = combatFixture(cls, sk.id, sk.maxLv);
        const raw = sourceRecord(cls, sk.id).wuqi;
        const tokens = raw.split(/[；;、，,。]/).map((s) => s.trim()).filter(Boolean);
        tokens.forEach((token) => observed.add(token));
        const supported = tokens.flatMap((token) => weaponTokens[token]);
        if (sk.kind === 'petheal') b.pet = { name: '测试伙伴', hp: 1, maxHp: 100 };
        const check = (type) => {
          const reason = canUseSkill(p, b, sk.id);
          if (sk.kind === 'passive') assert.match(reason, /被动技能/);
          else if (supported.includes(type)) assert.equal(reason, null, `${sk.id} should allow ${type}`);
          else assert.match(reason, /当前武器不支持此技能/, `${sk.id} should reject ${type}`);
        };
        p.equipment = {}; check('unarmed');
        for (const type of Object.keys(GEAR_RULES.weapons)) {
          const generatingClass = type === 'dagger' ? 'assassin' : type === 'soulsphere' ? 'psychic' : cls;
          p.equipment.weapon = makeEquip('weapon', 1, 0, generatingClass, { weaponType: type });
          assert.equal(equippedWeaponType(p), type); check(type);
          // Name is deliberately misleading; only actual type controls casting.
          p.equipment.weapon.name = type === 'wand' ? '测试法剑' : '测试法器'; check(type);
          p.equipment.weapon.durability = 0; check(type);
        }
        for (const [id, type] of [['axe19a', 'axe'], ['axe19b', 'axe'], ['axe19c', 'axe'], ['sword18b', 'wand']]) {
          p.equipment.weapon = makeHighEquip(id);
          assert.equal(equippedWeaponType(p), type); check(type);
        }
        const legacy = makeEquip('weapon', 1, 0, cls);
        for (const key of ['ruleVersion', 'series', 'weaponType', 'wear', 'ranges', 'stars', 'attackType', 'origin']) delete legacy[key];
        legacy.cls = cls; p.equipment.weapon = legacy;
        assert.equal(equippedWeaponType(p), CLASSES[cls].weapon); check(CLASSES[cls].weapon);
        legacy.cls = null;
        assert.equal(equippedWeaponType(p), null);
        if (sk.kind !== 'passive') assert.match(canUseSkill(p, b, sk.id), /武器类型未知/);
      }
    }
    assert.deepEqual([...observed].sort(), Object.keys(weaponTokens).sort());
    for (const raw of ['', null, '未核武器。', '拳套；长兵；长鞭。', 'constructor；__proto__。']) {
      assert.deepEqual(normalizeSkillWeapons(raw).supportedTypes, [], 'unknown restriction became universal');
    }
    assert.deepEqual(normalizeSkillWeapons('未核武器。').unknownTokens, ['未核武器']);
    assert.deepEqual(normalizeSkillWeapons('法器；未核武器。').supportedTypes, ['wand', 'glaive']);
  });
  test('wearing a verified axe is distinct from wizard casting; magic sword is not 刀剑', () => {
    const { g, p, b } = combatFixture('wizard', 'wz1');
    p.attrs = { str: 400, con: 20, dex: 100, mag: 400 };
    const axe = makeHighEquip('axe19a'); p.bag.push(axe); g.equip(axe.uid);
    assert.equal(p.equipment.weapon.templateId, 'axe19a');
    assert.match(canUseSkill(p, b, 'wz1'), /当前武器不支持/);
    const sword = makeHighEquip('sword18b'); p.bag.push(sword); g.equip(sword.uid);
    assert.equal(canUseSkill(p, b, 'wz1'), null);
    const bm = combatFixture('blademaster', 'bm5');
    bm.p.equipment.weapon = makeHighEquip('sword18b');
    assert.match(canUseSkill(bm.p, bm.b, 'bm5'), /当前武器不支持/);
    bm.p.equipment.weapon = makeEquip('weapon', 1, 0, 'blademaster', { weaponType: 'sword' });
    assert.equal(canUseSkill(bm.p, bm.b, 'bm5'), null);
  });
  test('vetted wz1 resources at every rank; no general formula or blank coercion', () => {
    assert.equal(sourceRecord('wizard', 'wz1').zhenqi, '-9+15*level');
    for (let rank = 1; rank <= 10; rank++) {
      const { p, b, sk } = combatFixture('wizard', 'wz1', rank), cost = skillResources(sk, rank);
      assert.equal(cost.mp, -9 + 15 * rank);
      assert.equal(cost.chi, 0); assert.equal(cost.gain, 15);
      assert.equal(cost.basis.mp, 'source-vetted-linear-wz1'); assert.equal(cost.basis.gain, 'local');
      p.mp = cost.mp - 1;
      assert.match(canUseSkill(p, b, 'wz1'), /真气不足/);
      const before = structuredClone(p); fixedRandom(() => takeTurn(p, b, 'skill:wz1'));
      assert.equal(b.round, 0); assert.deepEqual(p, before);
      p.mp = cost.mp; p.chi = 0;
      assert.equal(canUseSkill(p, b, 'wz1'), null);
      fixedRandom(() => takeTurn(p, b, 'skill:wz1'));
      assert.equal(b.round, 1); assert.equal(p.mp, stats(p).mpRegen); assert.equal(p.chi, cost.gain);
    }
    const sk = findSkill('wizard', 'wz1');
    for (const rank of [0, 11, -1, 1.5, '1', NaN, Infinity]) assert.throws(() => skillResources(sk, rank));
    for (const mp of ['', '15*level', NaN, Infinity, -1]) assert.throws(() => skillResources({ ...sk, source: null, mp }, 1));
    assert.throws(() => skillResources({ ...sk, id: 'wz2' }, 1), /未核实/);
    assert.throws(() => skillResources({ ...sk, source: { ...sk.source, resources: { mp: { base: 0, perRank: 1 } } } }, 1), /未核实/);
    // Synthetic rank-10 fixture intentionally remains at Lv.1: rank resource
    // validation must not silently use rank-1 MP when choosing an automatic action.
    const auto = newGame('wizard').p;
    auto.skills.wz1 = 10; auto.mp = 140;
    const battle = createBattle(auto, [{ name: '自动耗蓝测试靶', hp: 10000, maxHp: 10000, atk: 0 }], { type: 'arena' });
    assert.equal(pickAutoAction(auto, battle).action, 'item:mp1');
    assert.match(canUseSkill(auto, battle, 'wz1'), /真气不足/);
  });
  test('selected normal-record chi costs govern both permission and deductions', () => {
    for (const [cls, id, chi] of [['wizard', 'wz3', 30], ['blademaster', 'bm5', 200], ['blademaster', 'bm6', 0], ['archer', 'ar6', 200], ['archer', 'ar7', 0]]) {
      assert.equal(sourceRecord(cls, id).zhenyuan, chi);
      const { p, b, sk } = combatFixture(cls, id);
      if (id === 'bm6') p.equipment.weapon = makeEquip('weapon', 1, 0, cls, { weaponType: 'axe' });
      const cost = skillResources(sk, 1);
      assert.equal(cost.chi, chi); assert.equal(sk.chi, chi);
      assert.equal(cost.basis.chi, 'source-normal-record'); assert.equal(cost.basis.mp, 'local');
      if (chi) { p.chi = chi - 1; assert.match(canUseSkill(p, b, id), /元气不足/); }
      p.chi = chi; p.mp = cost.mp;
      assert.equal(canUseSkill(p, b, id), null);
      fixedRandom(() => takeTurn(p, b, `skill:${id}`));
      assert.equal(b.round, 1); assert.equal(p.chi, cost.gain); assert.equal(p.mp, stats(p).mpRegen);
    }
  });
  test('落雷: physical basis, metal defense channel, expected damage mirrors casting', () => {
    assert.match(sourceRecord('archer', 'ar2').miaoshu, /基础物理攻击力.*金系伤害/);
    const { p, b, sk, m } = combatFixture('archer', 'ar2', 4);
    m.def = 10000; m.mdef = 9999; m.metalDef = 100; m.metalRes = 0.25;
    const st = { ...stats(p, b), crit: 0 }, mult = sk.mult + sk.per * 3;
    const expectedDamage = localMitigate(st.patk * mult, 100) * 0.75;
    approx(expectedAttack(p, b, st, sk, m), expectedDamage);
    approx(expectedAttack(p, b, { ...st, matk: st.matk * 20, atk: st.atk * 20 }, sk, m), expectedDamage);
    approx(expectedAttack(p, b, { ...st, patk: st.patk * 2 }, sk, m), expectedDamage * 2);
    approx(expectedAttack(p, b, st, sk, { ...m, def: 0, mdef: 0 }), expectedDamage);
    assert.ok(expectedAttack(p, b, st, sk, { ...m, metalDef: 1000 }) < expectedDamage);
    const before = m.hp; fixedRandom(() => takeTurn(p, b, 'skill:ar2', m.id));
    assert.ok(Math.abs(before - m.hp - Math.round(expectedDamage)) <= 1);
    const raised = stats({ ...p, attrs: { ...p.attrs, dex: p.attrs.dex + 100 } });
    assert.ok(expectedAttack(p, b, { ...raised, crit: 0 }, sk, m) > expectedDamage);
  });
  test('火海刀山: magic basis for equal fire and physical components', () => {
    assert.match(sourceRecord('wizard', 'wz7').miaoshu, /基础法术攻击.*火系伤害和同样的物理伤害/);
    const { p, b, sk, m } = combatFixture('wizard', 'wz7', 2);
    m.def = 400; m.mdef = 9999; m.fireDef = 100; m.fireRes = 0.2;
    const st = { ...stats(p, b), crit: 0 }, amount = st.matk * (sk.mult + sk.per);
    const expectedDamage = localMitigate(amount * 0.5, 100) * 0.8 + localMitigate(amount * 0.5, 400);
    approx(expectedAttack(p, b, st, sk, m), expectedDamage);
    approx(expectedAttack(p, b, { ...st, patk: st.patk * 50, atk: st.atk * 50 }, sk, m), expectedDamage);
    approx(expectedAttack(p, b, { ...st, matk: st.matk * 2 }, sk, m), expectedDamage * 2);
    approx(expectedAttack(p, b, st, sk, { ...m, fireRes: 0.8 }), localMitigate(amount * 0.5, 100) * 0.2 + localMitigate(amount * 0.5, 400));
    assert.ok(expectedAttack(p, b, st, sk, { ...m, def: 1000 }) < expectedDamage);
    const before = m.hp; fixedRandom(() => takeTurn(p, b, 'skill:wz7', m.id));
    assert.ok(Math.abs(before - m.hp - Math.round(expectedDamage)) <= 1);
  });
  test('炎蛊: direct wood, subsequent fire DOT; explicit ratings and Res stay separate', () => {
    assert.match(sourceRecord('venomancer', 'vm4').miaoshu, /木系伤害.*30秒内.*火系伤害/);
    const run = (woodRes, fireRes, fireDef = 0) => {
      const { p, b, sk, m } = combatFixture('venomancer', 'vm4');
      m.woodRes = woodRes; m.fireRes = fireRes; m.woodDef = 0; m.fireDef = fireDef;
      const before = m.hp; fixedRandom(() => takeTurn(p, b, 'skill:vm4', m.id));
      const direct = before - m.hp, dot = m.statuses.find((s) => s.kind === 'dot');
      assert.equal(dot.elem, 'fire'); assert.equal(dot.type, 'magic'); assert.equal(dot.turns, 4);
      approx(dot.attack, stats(p).matk * sk.fx.dot[0]);
      const hp = m.hp; m.intent = 'attack'; fixedRandom(() => takeTurn(p, b, 'defend'));
      assert.equal(dot.turns, 3);
      return { direct, dot: hp - m.hp, expected: Math.round(localMitigate(dot.attack, fireDef) * (1 - fireRes)) };
    };
    const normal = run(0, 0), fireResisted = run(0, 0.8), woodResisted = run(0.8, 0), fireDefended = run(0, 0, 1000);
    assert.equal(normal.dot, normal.expected);
    assert.equal(fireResisted.dot, fireResisted.expected); assert.equal(fireDefended.dot, fireDefended.expected);
    assert.equal(fireResisted.direct, normal.direct); assert.equal(fireDefended.direct, normal.direct);
    assert.equal(woodResisted.dot, normal.dot); assert.ok(woodResisted.direct < normal.direct);
    assert.ok(fireResisted.dot < normal.dot && fireDefended.dot < normal.dot);
  });
  test('磐石护甲: rank-scaled equipment physical/earth defense, no absorption or base scaling', () => {
    assert.match(sourceRecord('wizard', 'wz3').miaoshu, /从装备上获得\$10\*level\$%额外土系防御，以及\$10\*level\$%额外物理防御/);
    const { p, b, sk } = combatFixture('wizard', 'wz3', 4);
    p.equipment = {};
    const bare = stats(p), beforeMp = p.mp;
    fixedRandom(() => takeTurn(p, b, 'skill:wz3'));
    const buff = b.buffs.find((x) => x.id === 'wz3');
    assert.deepEqual(buff.values, { equipmentDefPct: 0.4, equipmentEarthDefPct: 0.4 });
    assert.equal(buff.turns, 5); assert.equal(b.shield, 0); assert.equal(buff.shield, undefined);
    assert.equal(stats(p, b).def, bare.def); assert.equal(stats(p, b).earthDef, bare.earthDef);
    assert.equal(p.mp, Math.min(stats(p).mp, beforeMp - skillResources(sk, 4).mp + stats(p).mpRegen));
    // Deliberately synthetic equipment stats isolate explicit vs fallback element
    // contributions, independently of normal generated budgets (not real saves).
    p.equipment.body = { slot: 'body', base: { def: 100, mdef: 200, earthDef: 300 }, addons: {}, refine: 0 };
    p.equipment.neck = { slot: 'neck', base: { def: 50, mdef: 100, earthDef: 0 }, addons: {}, refine: 0 };
    const plain = stats(p), armored = stats(p, b);
    assert.equal(armored.equipmentDef, 150); assert.equal(armored.equipmentEarthDef, 300);
    assert.equal(armored.def - plain.def, 60); assert.equal(armored.earthDef - plain.earthDef, 120);
    assert.equal(armored.mdef, plain.mdef); assert.equal(armored.fireDef, plain.fireDef); assert.equal(armored.earthRes, 0);
    assert.equal(plain.fireDef, plain.mdef, 'absent fire rating must use labeled local mdef fallback');
    const moreBase = { ...p, attrs: { ...p.attrs, str: 400, con: 400, mag: 400 } };
    assert.equal(stats(moreBase, b).def - stats(moreBase).def, 60);
    assert.equal(stats(moreBase, b).earthDef - stats(moreBase).earthDef, 120);
    delete p.equipment.body.base.earthDef;
    assert.equal(stats(p, b).equipmentEarthDef, 200, 'per-item absence falls back; explicit zero does not');
    assert.equal(stats(p, b).earthDef - stats(p).earthDef, 80);
    for (let turn = 0; turn < 5; turn++) fixedRandom(() => takeTurn(p, b, 'defend'));
    assert.equal(b.buffs.some((x) => x.id === 'wz3'), false);
    assert.equal(b.shield, 0);
  });
  test('磐石护甲 reduces physical and earth attacks, not other element channels', () => {
    const incoming = (type, elem, armor) => {
      const { p, b, m } = combatFixture('wizard', 'wz3', 4);
      p.equipment.body = { slot: 'body', base: { def: 500, mdef: 500 }, addons: {}, refine: 0 };
      if (armor) fixedRandom(() => takeTurn(p, b, 'skill:wz3'));
      m.atk = 500; m.type = type; m.elem = elem; m.intent = 'attack';
      p.hp = stats(p, b).hp;
      const hp = p.hp; fixedRandom(() => takeTurn(p, b, 'defend'));
      assert.equal(b.shield, 0);
      return hp - p.hp;
    };
    assert.ok(incoming('phys', 'earth', true) < incoming('phys', 'earth', false));
    assert.ok(incoming('magic', 'earth', true) < incoming('magic', 'earth', false));
    assert.equal(incoming('magic', 'water', true), incoming('magic', 'water', false));
    assert.equal(incoming('magic', 'fire', true), incoming('magic', 'fire', false));
  });
  test('fire DOT snapshot validates while old wood DOT remains intact', () => {
    const g = newGame('venomancer'), p = g.p;
    p.lv = 30; p.cult = 2; p.skills.vm4 = 1; p.location = 'h_f1'; p.hp = stats(p).hp; p.mp = stats(p).mp;
    g.state.battle = createBattle(p, [{ name: '炎蛊存档靶', hp: 10000, maxHp: 10000, atk: 0, woodDef: 100, fireDef: 200 }], { type: 'field', zone: 'h_f1' });
    fixedRandom(() => takeTurn(p, g.battle, 'skill:vm4'));
    const raw = checkSave(g);
    assert.equal(raw.battle.monsters[0].statuses[0].elem, 'fire');
    const old = structuredClone(raw); old.battle.monsters[0].statuses[0].elem = 'wood';
    assert.deepEqual(validateSave(old), old, 'old DOT element was rewritten');
    const invalid = structuredClone(raw); invalid.battle.monsters[0].fireDef = -1;
    assert.throws(() => validateSave(invalid));
  });
  test('new armor buff snapshots validated without rewriting old valid shield buffs', () => {
    const g = newGame('wizard'), p = g.p;
    p.lv = 30; p.cult = 1; p.skills.wz3 = 4; p.chi = 30; p.location = 'h_f1';
    p.equipment.body = makeEquip('body', 1, 0, 'wizard'); p.hp = stats(p).hp; p.mp = stats(p).mp;
    g.state.battle = createBattle(p, [{ name: '护甲存档靶', hp: 10000, maxHp: 10000, atk: 0 }], { type: 'field', zone: 'h_f1' });
    fixedRandom(() => takeTurn(p, g.battle, 'skill:wz3'));
    const raw = checkSave(g), before = structuredClone(raw);
    for (const [key, value] of [['equipmentDefPct', 2], ['equipmentEarthDefPct', 0.2]]) {
      const invalid = structuredClone(raw); invalid.battle.buffs[0].values[key] = value;
      assert.throws(() => validateSave(invalid), /磐石护甲/);
    }
    for (const turns of [6, null, 1.5]) {
      const invalid = structuredClone(raw); invalid.battle.buffs[0].turns = turns;
      assert.throws(() => validateSave(invalid));
    }
    const old = structuredClone(raw);
    old.battle.buffs = [{ id: 'wz3', name: '旧护盾', values: { shield: 3 }, shield: 24, turns: 5 }]; old.battle.shield = 24;
    assert.deepEqual(validateSave(old), old, 'old valid absorption buff was destructively migrated');
    assert.deepEqual(raw, before);
  });
  test('equipment grade regressions: ordinary boundaries, series and fixed samples', () => {
    for (const [lv, grade] of [[1, 1], [4, 1], [5, 2], [9, 2], [10, 3], [19, 3], [20, 4], [35, 5], [55, 7], [60, 8], [98, 11], [99, 12], [105, 12]]) {
      const spec = gearSpec('weapon', lv, 0, 'wizard'); assert.equal(spec.grade, grade); assert.equal(spec.lv, lv);
      assert.equal(makeEquip('weapon', lv, 0, 'wizard').grade, grade);
      assert.equal(gradeOf(lv), Math.min(16, Math.floor(lv / 9) + 1), 'legacy grade algorithm changed');
    }
    for (const [series, definition] of Object.entries(GEAR_RULES.seriesRules)) {
      if (!definition.grades) continue;
      for (const [level, grade] of Object.entries(definition.grades)) {
        assert.equal(gearSpec('weapon', Number(level), definition.q, 'wizard', { series }).grade, grade);
      }
    }
    for (const [id, grade] of [['axe19a', 19], ['axe19b', 19], ['axe19c', 19], ['sword18b', 18], ['robe17c', 17]]) assert.equal(makeHighEquip(id).grade, grade);
    assert.equal(Object.values(SKILLS).flat().reduce((n, s) => n + s.maxLv, 0), 670);
  });

  test('official catalogue import/query requires no RNG or UUID', () => {
    Math.random = () => { throw new Error('official catalogue used RNG'); };
    globalThis.crypto.randomUUID = () => { throw new Error('official catalogue allocated a UID'); };
  });
  // Vite accepts a JSON import without attributes; this one-file, process-local
  // loader supplies ONLY that local JSON as JSON.parse(string). Source modules
  // and configs remain unchanged, and archived JS cannot be imported.
  const equipmentURL = new URL('official-library/structured/equipment-compare.json', root).href;
  hook = registerHooks({
    resolve(specifier, context, next) {
      const result = next(specifier, context);
      if (result.url.startsWith(new URL('official-library/', root).href) && result.url.endsWith('.js')) throw new Error('Archived scripts must never execute');
      return result;
    },
    load(url, context, next) {
      if (url === equipmentURL) return { format: 'module', shortCircuit: true, source: `export default JSON.parse(${JSON.stringify(readFileSync(new URL(url), 'utf8'))});` };
      return next(url, context);
    },
  });
  let catalog;
  try { catalog = await import('../src/data/official-equipment.js'); }
  catch (error) { test('official catalogue loads', () => { throw error; }); }
  finally { hook.deregister(); hook = null; }

  if (catalog) {
    const { OFFICIAL_EQUIPMENT: entries, OFFICIAL_EQUIPMENT_TYPES: types, queryOfficialEquipment: query } = catalog;
    const equipmentArchive = readJSON('official-library/structured/equipment-compare.json');
    const before = JSON.stringify({ entries, HIGH_EQUIPMENT, CLASSES, SKILL_SOURCES });
    const collect = (filters = {}) => {
      const input = structuredClone(filters), first = query(filters), rows = [];
      assert.equal(first.error, '');
      for (let page = 1; page <= first.pageCount; page++) {
        const result = query({ ...filters, page });
        assert.equal(result.error, '');
        assert.equal(result.page, page);
        assert.equal(result.total, first.total);
        assert.equal(result.pageSize, 40);
        assert.ok(result.entries.length <= 40);
        rows.push(...result.entries);
      }
      assert.deepEqual(filters, input, 'query mutated filters');
      assert.equal(rows.length, first.total);
      assert.equal(new Set(rows.map((e) => e.id)).size, rows.length);
      return rows;
    };
    const sorted = (rows) => [...rows].sort((a, b) => (a.lv ?? Infinity) - (b.lv ?? Infinity) || (a.grade ?? Infinity) - (b.grade ?? Infinity) || a.name.localeCompare(b.name, 'zh-CN') || a.id.localeCompare(b.id));
    const matches = (value, condition, unknown) => value === null ? unknown : condition(value);
    test('catalogue: exactly 744 historical records + 5 separate verified samples', () => {
      assert.equal(equipmentArchive.records.length, 744);
      assert.equal(entries.length, 749);
      assert.equal(new Set(entries.map((e) => e.id)).size, 749);
      assert.deepEqual(types, { ...equipmentArchive.types, high: '已核高阶样本' });
      assert.ok(Object.isFrozen(entries) && Object.isFrozen(types));
      const byId = new Map(entries.map((e) => [e.id, e]));
      for (const r of equipmentArchive.records) {
        const e = byId.get(`official:${r.id}`);
        assert.ok(e && Object.isFrozen(e) && Object.isFrozen(e.sourceFields));
        assert.equal(e.name, r.name);
        assert.equal(e.typeId, r.sourceFields.typeid);
        assert.equal(e.type, r.type);
        assert.equal(e.grade, Number(r.sourceFields.level));
        assert.equal(e.grade, Number(r.sourceLevel));
        assert.equal(e.refineUnit, r.refineUnit == null || r.refineUnit === '9999' ? null : Number(r.refineUnit));
        assert.equal(e.refineStatLabel, r.refineStatLabel);
        assert.equal(e.materialsText, r.materialsText || null);
        assert.deepEqual(e.sourceFields, r.sourceFields);
        assert.equal(e.source, equipmentArchive.source);
        assert.equal(e.sourceKind, 'historical-compare');
        for (const field of ['lv', 'slot', 'classes', 'base', 'addons', 'randomAffixes', 'templateId']) assert.equal(e[field], null, `${e.id}.${field} must remain unknown`);
        assert.equal(Object.hasOwn(e, 'uid'), false);
      }
      assert.equal(Object.keys(HIGH_EQUIPMENT).length, 5);
      for (const t of Object.values(HIGH_EQUIPMENT)) {
        const e = byId.get(`sample:${t.id}`);
        assert.ok(e && Object.isFrozen(e));
        for (const field of ['name', 'grade', 'lv', 'slot', 'classes', 'base', 'addons']) assert.deepEqual(e[field], t[field]);
        assert.equal(e.sourceKind, 'verified-sample');
        assert.equal(e.templateId, t.id);
        assert.equal(e.source, t.source[0]);
        assert.equal(e.sourceFields, null);
      }
      assert.deepEqual(collect(), sorted(entries));
      assert.equal(query().pageCount, 19);
      assert.equal(query({ page: 19 }).entries.length, 29);
      assert.equal(query({ page: 999 }).page, 19);
    });
    for (const unknown of [true, false]) {
      for (const cls of Object.keys(CLASSES)) {
        test(`catalogue filters ${cls}, includeUnknown=${unknown}`, () => {
          for (const slot of ['all', 'weapon', 'body']) {
            for (const [minLv, maxLv] of [[1, 105], [1, 104], [105, 105]]) {
              const filters = { cls, slot, minLv, maxLv, includeUnknown: unknown };
              const wanted = entries.filter((e) => matches(e.classes, (c) => c.includes(cls), unknown)
                && (slot === 'all' || matches(e.slot, (s) => s === slot, unknown))
                && matches(e.lv, (lv) => lv >= minLv && lv <= maxLv, unknown));
              assert.deepEqual(collect(filters), sorted(wanted));
            }
          }
        });
      }
    }
    test('catalogue type/grade/text filters, invalid input, detached pages', () => {
      for (const type of Object.keys(types)) assert.deepEqual(collect({ type }), sorted(entries.filter((e) => e.typeId === type)));
      for (let grade = 1; grade <= 19; grade++) assert.deepEqual(collect({ grade: String(grade) }), sorted(entries.filter((e) => e.grade === grade)));
      for (const search of ['亡骨刀', '千机材', '★', '不存在的装备xyz']) {
        assert.deepEqual(collect({ search: ` ${search} ` }), sorted(entries.filter((e) => `${e.name} ${e.type} ${e.materialsText || ''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))));
      }
      assert.equal(query({ minLv: 105, includeUnknown: false }).total, 5);
      assert.equal(query({ minLv: 105, includeUnknown: true }).total, 749);
      assert.equal(query({ maxLv: 104, includeUnknown: false }).total, 0);
      assert.equal(query({ cls: 'seeker', slot: 'weapon', includeUnknown: false }).total, 0);
      assert.equal(query({ minLv: '', maxLv: '', grade: '', cls: 'all', type: 'all', slot: 'all' }).total, 749);
      for (const filters of [{ minLv: 0 }, { maxLv: 106 }, { minLv: 1.5 }, { minLv: 'NaN' }, { minLv: 80, maxLv: 1 }, { grade: 20 }, { grade: 0 }, { grade: NaN }, { grade: false }, { grade: -1 }, { grade: 1.5 }, { grade: 'oops' }, { page: 0 }, { page: 1.5 }, { page: 'oops' }, { cls: 'unknown' }, { type: 'unknown' }, { slot: 'head' }]) {
        const result = query(filters);
        assert.ok(result.error, `invalid filter accepted: ${JSON.stringify(filters)}`);
        assert.equal(result.total, 0);
        assert.deepEqual(result.entries, []);
      }
      const detached = query(); detached.entries.reverse(); detached.entries.pop();
      assert.deepEqual(collect(), sorted(entries));
      assert.throws(() => { entries[0].name = 'mutated'; }, TypeError);
      assert.throws(() => { entries[0].sourceFields.level = '105'; }, TypeError);
      assert.throws(() => { entries.find((e) => e.templateId).base.patk = 0; }, TypeError);
      assert.equal(JSON.stringify({ entries, HIGH_EQUIPMENT, CLASSES, SKILL_SOURCES }), before, 'catalogue/query mutated source data');
    });
  }
  Math.random = savedRandom;
  globalThis.crypto.randomUUID = savedUUID;

  for (const [cls, skills] of Object.entries(SKILLS)) {
    for (const sk of skills) {
      for (let to = 1; to <= sk.maxLv; to++) {
        test(`learn ${sk.id}/${to}: exact payment and rejected-resource invariants`, () => {
          const req = skillReq(sk, to), g = learningFixture(cls, sk, to);
          const before = structuredClone(g.state);
          g.learn(sk.id);
          assert.equal(g.p.skills[sk.id], to);
          assert.equal(g.p.sp, 0);
          assert.equal(g.p.gold, 0);
          const changed = structuredClone(g.state);
          changed.player.skills = before.player.skills;
          changed.player.sp = before.player.sp;
          changed.player.gold = before.player.gold;
          changed.journal = before.journal;
          assert.deepEqual(changed, before, 'learning changed unrelated state');
          finiteStats(g.p);
          for (const [field, requirement, pattern] of [['sp', req.sp, /元神或金币不足/], ['gold', req.gold, /元神或金币不足/], ['lv', req.level, /等级或修真境界不足/], ['cult', sk.cult, /等级或修真境界不足/]]) {
            if (requirement > (field === 'lv' ? 1 : 0)) {
              const failed = learningFixture(cls, sk, to);
              failed.p[field] = requirement - 1;
              rejected(failed, () => failed.learn(sk.id), pattern);
            }
          }
          learningRanks++;
        });
      }
      test(`learn ${sk.id}: max-rank rejection and cultivation cast gate`, () => {
        const g = learningFixture(cls, sk, sk.maxLv);
        g.p.skills[sk.id] = sk.maxLv;
        rejected(g, () => g.learn(sk.id), /等级或修真境界不足/);
        if (sk.cult > 0) {
          const b = createBattle(g.p, [makeMonster('修真门槛测试靶', g.p.lv)], { type: 'field', zone: 'h_f1' });
          g.p.cult = sk.cult - 1;
          assert.match(canUseSkill(g.p, b, sk.id), /修为不足/);
        }
      });
      test(`save ${sk.id}: accepts maxLv=${sk.maxLv}, rejects maxLv+1`, () => {
        const g = learningFixture(cls, sk, sk.maxLv);
        g.p.skills[sk.id] = sk.maxLv;
        const valid = checkSave(g);
        const raw = structuredClone(valid);
        raw.player.skills[sk.id] = sk.maxLv + 1;
        const before = structuredClone(raw);
        assert.throws(() => validateSave(raw), /技能数据无效/, `save accepted ${sk.id}=${sk.maxLv + 1}, documented maxLv=${sk.maxLv}`);
        assert.deepEqual(raw, before);
      });
    }
    test(`save/learn ${cls}: bad skill IDs, illegal ranks, finite values, location/busy gates`, () => {
      const g = newGame(cls), basic = SKILLS[cls][0];
      rejected(g, () => g.learn('missing-skill'), /技能不存在/);
      const foreign = Object.entries(SKILLS).find(([other]) => other !== cls)[1][0].id;
      rejected(g, () => g.learn(foreign), /技能不存在/);
      const base = checkSave(g);
      for (const rank of [0, -1, 1.5, 11, '1', NaN, Infinity]) {
        const raw = structuredClone(base); raw.player.skills[basic.id] = rank;
        assert.throws(() => validateSave(raw));
      }
      const wrong = structuredClone(base); wrong.player.skills[foreign] = 1;
      assert.throws(() => validateSave(wrong), /技能数据无效/);
      for (const value of [NaN, Infinity, -Infinity]) {
        for (const field of ['hp', 'mp', 'sp', 'gold', 'lv']) {
          const raw = structuredClone(base); raw.player[field] = value;
          assert.throws(() => validateSave(raw), /非法数值/);
        }
        const raw = structuredClone(base); raw.player.attrs.mag = value;
        assert.throws(() => validateSave(raw), /非法数值/);
      }
      const field = buildMainline(g.p.race)[0].goal.zone;
      g.travel(field);
      rejected(g, () => g.learn(basic.id), /城镇/);
      g.hunt(0);
      rejected(g, () => g.learn(basic.id), /城镇/);
      rejected(g, () => g.travel(HOME_CITY[g.p.race]), /结束当前战斗/);
      checkSave(g);
    });
  }

  const xpTotal = (p) => p.exp + Array.from({ length: p.lv - 1 }, (_, i) => expNeed(i + 1)).reduce((sum, n) => sum + n, 0);
  function claimEarned(g, ledger) {
    const q = g.mainQuest, before = { xp: xpTotal(g.p), sp: g.p.sp, gold: g.p.gold, index: g.p.mainIndex };
    assert.ok(g.questProgress(q).ready);
    const xp = Math.round(expNeed(Math.min(105, q.rlv)) * q.rexp);
    const sp = Math.round((100 + q.rlv * q.rlv * 1.5) * q.rsp), gold = Math.round(150 + q.rlv * 100);
    g.claimQuest();
    assert.equal(g.p.mainIndex, before.index + 1);
    assert.equal(xpTotal(g.p) - before.xp, xp);
    assert.equal(g.p.sp - before.sp, sp);
    assert.equal(g.p.gold - before.gold, gold);
    ledger.xp += xp; ledger.quests++;
    checkSave(g);
  }
  function finishEarned(g, ledger, firstSkill = null) {
    const b = g.battle, before = { xp: xpTotal(g.p), sp: g.p.sp, gold: g.p.gold, wins: g.p.totals.battles, deaths: g.p.totals.deaths };
    const enemies = structuredClone(b.monsters);
    const startRound = b.round;
    if (firstSkill) {
      assert.equal(canUseSkill(g.p, b, firstSkill), null);
      g.turn(`skill:${firstSkill}`, b.monsters[0].id);
      assert.equal(b.round, startRound + 1);
      checkSave(g);
    }
    while (g.busy && b.round < 150) {
      const choice = pickAutoAction(g.p, b);
      const previous = b.round;
      g.turn(choice.action, choice.targetId);
      assert.equal(b.round, previous + 1, `auto chose rejected action ${choice.action}`);
      checkSave(g);
    }
    assert.equal(b.result, 'win', `${g.p.cls} lost/stalled at Lv.${g.p.lv}: ${enemies.map((m) => m.name).join(', ')}; last log: ${b.logs.at(-1)?.text}`);
    assert.equal(g.p.totals.deaths, before.deaths);
    assert.equal(g.p.totals.battles, before.wins + 1);
    const reward = b.context.type === 'cult' ? { exp: 0, sp: 0, gold: 0 } : enemies.map(monsterReward).reduce((sum, r) => ({ exp: sum.exp + r.exp, sp: sum.sp + r.sp, gold: sum.gold + r.gold }), { exp: 0, sp: 0, gold: 0 });
    assert.equal(xpTotal(g.p) - before.xp, reward.exp);
    assert.equal(g.p.sp - before.sp, reward.sp);
    assert.equal(g.p.gold - before.gold, reward.gold);
    ledger.xp += reward.exp; ledger.fights++; ledger.rounds += b.round - startRound;
    assert.equal(xpTotal(g.p), ledger.xp, 'progression XP not earned from battles/quests');
    checkSave(g);
  }
  function equipEarned(g) {
    for (const it of [...g.p.bag]) {
      const old = g.p.equipment[it.slot];
      if (old && finiteStats({ ...g.p, equipment: { ...g.p.equipment, [it.slot]: it } }).power <= finiteStats(g.p).power) continue;
      const before = structuredClone(g.state);
      try { g.equip(it.uid); }
      catch (error) {
        assert.match(error.message, /穿戴条件不足|等级或职业不符合|专属武器/);
        assert.deepEqual(g.state, before);
      }
    }
  }
  function recoverEarned(g, home) {
    if (g.p.location !== home) g.travel(home);
    if (g.p.points) g.autoAllocate();
    equipEarned(g);
    const st = finiteStats(g.p);
    if (g.p.hp < st.hp || g.p.mp < st.mp) {
      const gold = g.p.gold;
      g.rest();
      assert.equal(g.p.gold, gold - (5 + g.p.lv * 2));
      assert.equal(g.p.hp, st.hp); assert.equal(g.p.mp, st.mp);
    }
    for (const id of ['hp1', 'mp1']) {
      if (g.p.items[id] < 5 && g.p.gold >= ITEMS[id].price * (5 - g.p.items[id])) g.buy(id, 5 - g.p.items[id]);
    }
    checkSave(g);
  }

  for (const [classIndex, cls] of Object.keys(CLASSES).entries()) {
    for (const seed of [0x505749, 0x726562]) {
      test(`natural journey ${cls}, seed=${seed}: opening -> first cultivation`, () => {
        const previousRandom = Math.random;
        Math.random = seeded(seed + classIndex * 101);
        try {
          const g = newGame(cls), p = g.p, home = HOME_CITY[p.race], basic = SKILLS[cls][0];
          const ledger = { xp: 0, fights: 0, rounds: 0, quests: 0 };
          assert.equal(p.lv, 1); assert.equal(p.sp, 0); assert.equal(p.gold, 300);
          assert.deepEqual(Object.keys(p.equipment), ['weapon']);
          assert.equal(p.equipment.weapon.origin, 'starter');
          assert.equal(p.bag.length, 0);
          assert.deepEqual(p.skills, { [basic.id]: 1 });
          assert.deepEqual(p.visits, []); assert.deepEqual(p.discovered, [home]);
          assert.equal(g.mainQuest.goal.type, 'visit');
          for (const zone of ['f_jifeng', 'f_fengsha', 'f_wanjie', 'f_tongtian']) {
            const quest = g.quests.find((entry) => entry.zone === zone && entry.goal.type === 'kill');
            assert.ok(quest.story.includes(ZONES[zone].name), `Quest story does not match ${ZONES[zone].name}`);
          }
          assert.equal(g.questProgress(g.mainQuest).ready, false);
          rejected(g, () => g.claimQuest(), /尚未完成/);
          checkSave(g);
          const field = g.mainQuest.goal.zone;
          assert.ok(ZONES[home].links.includes(field));
          g.travel(field);
          assert.deepEqual(p.visits, [field]);
          claimEarned(g, ledger);
          for (const id of ['ore1', 'wood1', 'fiber1', 'hide1']) assert.equal(p.items[id], 3);
          assert.equal(p.bag.length, 0);
          assert.equal(g.mainQuest.goal.type, 'kill'); assert.equal(g.mainQuest.goal.count, 1);
          rejected(g, () => g.claimQuest(), /尚未完成/);
          const designated = g.mainQuest.goal.mob;
          assert.equal(g.explore().kind, 'fight');
          assert.equal(g.battle.monsters[0].name, designated);
          finishEarned(g, ledger, basic.id);
          assert.equal(p.mainProgress, 1); assert.equal(p.kills[designated], 1);
          claimEarned(g, ledger);
          assert.equal(g.mainQuest.goal.type, 'visit'); assert.equal(g.mainQuest.goal.zone, home);
          assert.ok(p.discovered.includes(home)); assert.ok(!p.visits.includes(home));
          rejected(g, () => g.claimQuest(), /尚未完成/);
          g.travel(home);
          const countBefore = p.bag.length;
          claimEarned(g, ledger);
          assert.equal(p.mainIndex, 3);
          assert.equal(p.bag.length, countBefore + 1);
          assert.equal(p.bag.at(-1).origin, 'quest'); assert.equal(p.bag.at(-1).q, 1);
          if (p.points) g.autoAllocate();
          const beforeGold = p.gold, beforeItems = { ...p.items };
          const made = productionAction(g, 'produce', { recipeId: 'ordinary-1-body', confirm: true });
          assert.equal(p.gold, beforeGold - made.gold);
          for (const [id, quantity] of Object.entries(made.consumed)) assert.equal(p.items[id], beforeItems[id] - quantity);
          assert.equal(p.production.tailor.exp, 1);
          assert.equal(made.equipment.origin, 'production:ordinary-1-body');
          g.equip(made.uid);
          assert.equal(p.equipment.body.uid, made.uid);
          assert.equal(p.items.huanxian >= 5, true, 'ordinary crafting consumed refine material');
          recoverEarned(g, home);

          let learnedSecond = false, attempts = 0;
          const maybeLearn = () => {
            if (learnedSecond) return;
            const req = skillReq(basic, 2);
            if (p.lv < req.level || p.sp < req.sp || p.gold < req.gold) return;
            const before = { sp: p.sp, gold: p.gold };
            g.learn(basic.id);
            assert.equal(p.skills[basic.id], 2);
            assert.equal(p.sp, before.sp - req.sp); assert.equal(p.gold, before.gold - req.gold);
            learnedSecond = true;
          };
          // Follow all remaining first-field quests; practice only real normal
          // monsters when a target is above our earned level. Never assign XP,
          // resources, gear, stats, skills, quest progress, or cultivation here.
          while (g.mainQuest.goal.type === 'kill') {
            assert.ok(++attempts <= 150, 'first-field journey exceeded fight bound');
            const q = g.mainQuest;
            assert.equal(q.zone, field);
            recoverEarned(g, home); maybeLearn();
            if (g.questProgress(q).ready) { claimEarned(g, ledger); continue; }
            const target = ZONES[field].mobs.find((m) => m[0] === q.goal.mob);
            const practice = ZONES[field].mobs.filter((m) => !m[2] && m[1] <= p.lv).at(-1);
            const mob = target[1] > p.lv ? practice : target;
            assert.ok(mob, 'no legal practice target');
            g.travel(field);
            const progress = p.mainProgress;
            g.hunt(ZONES[field].mobs.indexOf(mob));
            finishEarned(g, ledger);
            assert.equal(p.mainProgress, progress + (mob[0] === q.goal.mob ? 1 : 0), 'non-designated kill advanced quest');
          }
          assert.equal(g.mainQuest.goal.type, 'cult'); assert.equal(g.mainQuest.goal.rank, 1);
          while (p.lv < CULTIVATION[1].lv || p.sp < CULTIVATION[1].sp || !learnedSecond) {
            assert.ok(++attempts <= 150, 'natural cultivation preparation exceeded fight bound');
            recoverEarned(g, home); maybeLearn();
            if (p.lv >= CULTIVATION[1].lv && p.sp >= CULTIVATION[1].sp && learnedSecond) break;
            const mob = ZONES[field].mobs.filter((m) => !m[2] && m[1] <= p.lv).at(-1);
            g.travel(field); g.hunt(ZONES[field].mobs.indexOf(mob)); finishEarned(g, ledger);
          }
          recoverEarned(g, home); maybeLearn();
          assert.ok(learnedSecond, 'did not naturally afford initial attack rank 2');
          assert.equal(p.cult, 0); assert.equal(g.questProgress(g.mainQuest).ready, false);
          rejected(g, () => g.breakthrough(), /完成试炼/);
          g.enterTrial();
          assert.equal(g.battle.context.rank, 1);
          finishEarned(g, ledger);
          assert.equal(p.trialReady, true); assert.equal(p.cult, 0);
          const sp = p.sp;
          g.breakthrough();
          assert.equal(p.cult, 1); assert.equal(p.sp, sp - CULTIVATION[1].sp);
          assert.equal(p.trialReady, false); assert.equal(p.hp, finiteStats(p).hp);
          claimEarned(g, ledger);
          assert.equal(p.mainIndex, 9); assert.equal(ledger.quests, 9);
          assert.equal(p.totals.deaths, 0);
          assert.equal(xpTotal(p), ledger.xp);
          assert.ok(p.lv >= 9 && p.lv < 20, 'this is an early journey, not a 1-to-105 test');
          const restored = new Game(checkSave(g));
          assert.deepEqual(restored.p, p);
          journeys.push({ cls, seed, lv: p.lv, cult: p.cult, quests: ledger.quests, fights: ledger.fights, rounds: ledger.rounds, earnedXp: ledger.xp, attackRank: p.skills[basic.id] });
        } finally { Math.random = previousRandom; }
      });
    }
  }
  test('source objects unchanged by catalogue import, queries, stats, learning and journeys', () => {
    assert.equal(sourceSignature(), originalSourceSignature);
  });
  test('coverage: all skill ranks and both natural journeys for all ten classes', () => {
    const ranks = Object.values(SKILLS).flat().reduce((sum, sk) => sum + sk.maxLv, 0);
    assert.equal(ranks, 670);
    assert.equal(sourceRanks, 670);
    assert.equal(learningRanks, 670);
    assert.equal(journeys.length, 20);
    assert.equal(new Set(journeys.map((j) => j.cls)).size, 10);
  });
} catch (error) {
  failures.push({ name: 'harness', detail: error.message });
  console.error(`FAIL harness: ${error.message}`);
} finally {
  hook?.deregister();
  Math.random = savedRandom;
  globalThis.crypto.randomUUID = savedUUID;
  for (const [name, descriptor] of globalDescriptors) {
    if (descriptor) Object.defineProperty(globalThis, name, descriptor);
    else delete globalThis[name];
  }
}

for (const j of journeys) console.log(`JOURNEY ${j.cls} seed=${j.seed}: Lv.${j.lv}, cult=${j.cult}, ${j.quests} quests, ${j.fights} wins/${j.rounds} rounds, earnedXP=${j.earnedXp}, attackRank=${j.attackRank}`);
console.log(`Rebuild regression: ${passed}/${tests} checks passed; ${sourceRanks} archived source ranks, ${learningRanks} learning transactions, ${journeys.length}/20 natural early journeys.`);
console.log('Scope: 72 skills; 744 historical equipment + 5 separately sourced samples; early earned progression only, NOT 1→105. No browser/server, real storage, network or filesystem writes.');
if (failures.length) {
  console.error(`REGRESSIONS: ${failures.length} (details above); exiting 1.`);
  process.exitCode = 1;
}
