import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Opt-in, long-running campaign check. Never attach to an existing browser/profile.
// Run only when performance sampling has stopped. No clock/RNG overrides, fixtures,
// save writes, game dispatch, control setters, engine steps, or page-side mutations.
const BASE_URL = 'http://127.0.0.1:5173';
const PLAYWRIGHT = process.env.PLAYWRIGHT_MODULE || '/Users/wangyong/.npm/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';
const OUTPUT = fileURLToPath(new URL('../docs/screenshots/', import.meta.url));
function boundedSetting(name, fallback, maximum) {
  const value = Number(process.env[name] ?? fallback);
  assert.ok(Number.isFinite(value) && value > 0 && value <= maximum, `${name} must be in (0, ${maximum}]`);
  return value;
}
const LIMITS = {
  minutes: boundedSetting('ACT1_MAX_MINUTES', 120, 240),
  actions: boundedSetting('ACT1_MAX_ACTIONS', 100000, 240000),
  areaMinutes: boundedSetting('ACT1_AREA_MINUTES', 18, 40),
  enemySeconds: 240,
  navigation: 1600,
  fights: 2400,
  services: 160,
};
const platformArgument = process.argv.find(arg => arg.startsWith('--platform='));
const platform = platformArgument?.split('=')[1] ?? 'both';
assert.ok(['both', 'desktop', 'touch'].includes(platform), 'Use --platform=both|desktop|touch');
assert.ok(process.argv.slice(2).every(arg => arg === platformArgument), 'Unknown argument');

// Static reference data is read in Node, not imported into the page. This only
// ranks real drops/offers and checks space/requirements; it never generates items.
const raw = async name => Object.values(JSON.parse(await readFile(fileURLToPath(new URL(`../src/data/raw/${name}.json`, import.meta.url)), 'utf8')));
const [weapons, armor, misc, types] = await Promise.all(['weapons', 'armor', 'misc', 'ItemTypes'].map(raw));
const typeByCode = new Map(types.map(row => [String(row.Code).toLowerCase(), row]));
const slots = { tors: 'body', helm: 'head', circ: 'head', pelt: 'head', phlm: 'head', shie: 'offhand', ashd: 'offhand', head: 'offhand', glov: 'gloves', boot: 'boots', belt: 'belt', ring: 'ring1', amul: 'neck' };
const bases = new Map();
for (const [table, rows] of [['weapons', weapons], ['armor', armor], ['misc', misc]]) {
  for (const row of rows) {
    const type = String(row.type ?? '');
    bases.set(row.code, { ...row, slot: table === 'weapons' ? 'weapon' : slots[type], classId: String(typeByCode.get(type.toLowerCase())?.Class ?? '').toLowerCase() });
  }
}
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const potion = item => item && /^(?:[hm]p[1-5]|rv[sl])$/.test(item.code);
const portalCount = player => player.inventory.reduce((n, item) => n + (item.code === 'tsc' ? 1 : item.code === 'tbk' ? item.quantity : 0), 0);
const identifyCount = player => player.inventory.reduce((n, item) => n + (item.code === 'isc' ? 1 : item.code === 'ibk' ? item.quantity : 0), 0);
function beltRows(item) {
  if (!item) return 1;
  const base = bases.get(item.code);
  if (base?.normcode && base.normcode !== item.code) return 4;
  return ({ lbl: 2, vbl: 2, mbl: 3, tbl: 3, hbl: 4 })[item.code] ?? 1;
}
function fits(player, item) {
  if (item.code === 'gld') return true;
  if (potion(item) && player.belt.slice(0, beltRows(player.equipment.belt) * 4).some(cell => !cell)) return true;
  for (let y = 0; y <= 4 - item.height; y++) for (let x = 0; x <= 10 - item.width; x++) {
    if (player.inventory.every(other => x + item.width <= other.x || other.x + other.width <= x || y + item.height <= other.y || other.y + other.height <= y)) return true;
  }
  return false;
}
function wearable(s, item) {
  const base = bases.get(item.code);
  if (!base?.slot || !item.identified || item.requiredLevel > s.player.level || base.classId && !['sor', 'sorceress'].includes(base.classId)) return false;
  if (item.maxDurability && item.durability <= 0 && !item.mods.indestructible) return false;
  const multiplier = Math.max(0, 100 + (item.mods.requirementsPercent ?? 0)) / 100;
  const strength = Math.max(0, Math.floor(Number(base.reqstr ?? 0) * multiplier) - (item.ethereal ? 10 : 0));
  const dexterity = Math.max(0, Math.floor(Number(base.reqdex ?? 0) * multiplier) - (item.ethereal && base.slot === 'weapon' ? 10 : 0));
  if (strength > s.stats.strength || dexterity > s.stats.dexterity) return false;
  // Don't lose the only source of Fire Bolt; don't discard a two-handed staff
  // for a shield. The test deliberately keeps physical melee out of its build.
  if (base.slot === 'offhand' && Number(bases.get(s.player.equipment.weapon?.code)?.['2handed']) === 1) return false;
  if (base.slot === 'weapon' && !s.player.skills[36] && !(item.mods['skill:36'] > 0)) return false;
  return true;
}
function gearScore(item) {
  if (!item) return 0;
  const m = item.mods;
  return item.defense * .35 + beltRows(item) * (bases.get(item.code)?.slot === 'belt' ? 180 : 0)
    + (m.life ?? 0) * 2 + (m.mana ?? 0) * 1.7 + (m.vitality ?? 0) * 4 + (m.energy ?? 0) * 3
    + (m.fcr ?? 0) * 3 + (m.frw ?? 0) * 3 + (m.manaRegenPercent ?? 0)
    + ['resFire', 'resCold', 'resLightning', 'resPoison'].reduce((n, key) => n + (m[key] ?? 0) * 1.5, 0)
    + (m.resAll ?? 0) * 6 + (m.flatReduction ?? 0) * 8 + (m.damageReduction ?? 0) * 3
    + ['skill:36', 'allSkills', 'classSkill:sor', 'skillTab:sor:0', 'fireSkills'].reduce((n, key) => n + (m[key] ?? 0) * 100, 0);
}
function upgradeSlot(s, item) {
  let slot = bases.get(item.code)?.slot;
  if (slot === 'ring1') slot = !s.player.equipment.ring1 ? 'ring1' : !s.player.equipment.ring2 ? 'ring2' : gearScore(s.player.equipment.ring1) <= gearScore(s.player.equipment.ring2) ? 'ring1' : 'ring2';
  return slot && wearable(s, item) && gearScore(item) > gearScore(s.player.equipment[slot]) + .1 ? slot : null;
}
const protectedItem = item => ['tsc', 'tbk', 'isc', 'ibk', 'box', 'cm1', 'cm2', 'cm3'].includes(item.code) || bases.get(item.code)?.type === 'ques' || potion(item);
function inventoryForSale(s, keepUnidentified = false) {
  const reserves = new Set();
  for (const prefix of ['hp', 'mp']) {
    const items = s.player.inventory.filter(item => new RegExp(`^${prefix}[1-5]$`).test(item.code))
      .sort((a, b) => Number(b.code.at(-1)) - Number(a.code.at(-1)) || a.x - b.x || a.y - b.y);
    for (const item of items.slice(0, 2)) reserves.add(item.uid);
  }
  return s.player.inventory.filter(item => (!protectedItem(item) || /^[hm]p[1-5]$/.test(item.code) && !reserves.has(item.uid))
    && !upgradeSlot(s, item) && !(keepUnidentified && !item.identified && bases.get(item.code)?.slot));
}
const persistence = s => ({ id: s.id, xp: s.player.experience, level: s.player.level, classId: s.player.classId, difficulty: s.player.difficulty, gold: s.player.gold, equipment: s.player.equipment, inventory: s.player.inventory, belt: s.player.belt, skills: s.player.skills, statPoints: s.player.statPoints, skillPoints: s.player.skillPoints, vitality: s.player.vitality, energy: s.player.energy, quests: s.player.quests, waypoints: s.player.waypoints, unlockedActs: s.player.unlockedActs });

const { chromium } = await import(PLAYWRIGHT);
const browser = await chromium.launch({ headless: process.env.ACT1_HEADED !== '1' });
async function run(mobile) {
  const label = mobile ? 'touch' : 'desktop';
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: mobile ? 2 : 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const cdp = mobile ? await context.newCDPSession(page) : null;
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const started = Date.now();
  let stage = 'normal sorceress creation', actions = 0, servicing = false, serviceCount = 0;
  let lastHealthPotion = -Infinity, lastManaPotion = -Infinity, lastTrainingLevel = 1;
  let andyKilled = false, simultaneous = false, repeatedHeldCast = false, allocated = 0, killsSinceLoot = 0;
  let observedXP = 0;
  const observedMonsters = new Map();
  const lootedItemUids = new Set();
  const evidence = { kills: 0, xpFromKills: 0, goldPicked: 0, bought: {}, drank: {}, equipped: [], sold: 0, casts: 0, learned: {}, detours: [], areasCleared: [], travels: [] };
  const graph = new Map();
  const activate = async locator => {
    await page.waitForFunction(()=>{
      const {engine,ui}=window.sanctuary;
      return engine.state.screen!=='game'||engine.state.panel==='none'||ui.panelSignature===ui.getPanelSignature();
    });
    return mobile ? locator.tap() : locator.click();
  };
  const shot = name => page.screenshot({ path: `${OUTPUT}act1-${label}-${name}.png` });
  const state = () => page.evaluate(() => {
    const engine = window.sanctuary?.engine, s = engine?.state;
    if (!s) return null;
    return { screen: s.screen, id: s.activeSaveId, player: s.player, stats: s.stats, area: s.area?.def, monsters: s.area?.monsters, objects: s.area?.objects, drops: s.area?.drops, panel: s.panel, npc: s.npc, tick: s.tick, events: s.events, eventSeq: s.eventSeq, projectiles: s.projectiles, control: engine.control, saved: s.saved, loadingSave: s.loadingSave, storageStatus: s.storageStatus, storageError: s.storageError, messages: s.messages, characters: s.characters, paused: s.paused };
  });
  async function guard() {
    assert.ok(Date.now() - started < LIMITS.minutes * 60000, 'Platform wall-clock limit reached');
    assert.ok(++actions <= LIMITS.actions, 'Native action/iteration limit reached');
    assert.deepEqual(errors, [], 'Browser emitted JavaScript/console errors');
    const s = await state();
    assert.ok(s, 'Game state unavailable');
    assert.equal(s.storageError, '', 'Storage error');
    if (s.player) {
      assert.equal(s.player.dead, false, 'Character died; no respawn/reload used to erase the failure');
      assert.equal(s.player.difficulty, 'normal');
      assert.equal(s.player.classId, 'sor');
      const deaths = (s.monsters ?? []).filter(monster => monster.dead && observedMonsters.get(monster.uid)?.dead === false);
      for (const monster of deaths) {
        const previous = observedMonsters.get(monster.uid);
        if (monster.code === 'andariel') {
          assert.ok(s.player.experience > observedXP, 'Actual Andy death must award real XP');
          assert.equal(previous.area, 37, 'Andy was observed alive in Catacombs IV');
          assert.equal(s.area.id, 37);
          assert.equal(monster.life, 0);
          assert.equal(s.player.quests['normal:a1q6'], 2);
          assert.equal(s.player.unlockedActs, 1, 'Andy kill requires a later Warriv hand-in');
          andyKilled = true; // Node evidence only, never a game mutation.
        }
      }
      evidence.kills += deaths.length;
      killsSinceLoot += deaths.length;
      if (s.player.experience > observedXP) evidence.xpFromKills += s.player.experience - observedXP;
      observedXP = s.player.experience;
      for (const monster of s.monsters ?? []) {
        if (observedMonsters.get(monster.uid)?.dead && !monster.dead)
          assert.ok(/^fallen\d+$/.test(monster.code) && !monster.boss && !monster.champion, `Ineligible monster revived during actual play: ${monster.name}`);
        observedMonsters.set(monster.uid, { dead: monster.dead, area: s.area.id });
      }
      if (!andyKilled) {
        assert.equal(s.player.unlockedActs, 1, 'Act II unlocked before an observed real Andariel kill');
        assert.ok((s.player.quests['normal:a1q6'] ?? 0) < 2, 'Andy objective completed without an observed kill');
      }
      if (s.area) graph.set(s.area.id, s.objects.filter(o => o.kind === 'exit').map(o => o.targetArea));
    }
    return s;
  }
  async function rendered() {
    await page.waitForFunction(() => window.sanctuary?.engine.state.screen === 'game' && window.sanctuary.renderer.groundArea === window.sanctuary.engine.state.area, null, { timeout: 12000 });
  }
  async function ticks(count = 2) {
    const before = await guard();
    await page.waitForFunction(({ tick, count }) => {
      const s = window.sanctuary.engine.state;
      return s.player.dead || s.tick >= tick + count;
    }, { tick: before.tick, count }, { timeout: 3000 });
    await guard();
  }
  async function closePanel() {
    const s = await guard();
    if (s.panel !== 'none') {
      await activate(page.locator(`.panel-${s.panel} .close-button`));
      await page.waitForFunction(() => window.sanctuary.engine.state.panel === 'none');
    }
  }
  async function panel(name) {
    await closePanel();
    // Desktop genuinely exercises C/T/I/J; touch uses the real HUD buttons.
    if (mobile) await activate(page.locator(`.quick-button[data-panel="${name}"]`));
    else await page.keyboard.press(({ character: 'c', skills: 't', inventory: 'i', quests: 'j' })[name]);
    await page.locator(`.panel-${name}`).waitFor();
    const s = await guard();
    assert.deepEqual(s.control.move, { x: 0, y: 0 });
    assert.equal(s.control.right, false, 'Opening panels releases held cast');
  }
  async function center(selector) {
    const bounds = await page.locator(selector).boundingBox();
    assert.ok(bounds && bounds.width > 0 && bounds.height > 0, `Missing native input surface ${selector}`);
    return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  }
  async function worldScreen(point, lift = 0) {
    return page.evaluate(({ point, lift }) => {
      const screen = window.sanctuary.renderer.worldToScreen(point, lift);
      if (screen.x <= 0 || screen.y <= 0 || screen.x >= innerWidth || screen.y >= innerHeight || document.elementFromPoint(screen.x, screen.y) !== window.sanctuary.ui.canvas) return null;
      return { x: screen.x, y: screen.y };
    }, { point, lift });
  }
  async function released(before, checkPosition = false) {
    await page.waitForFunction(() => {
      const c = window.sanctuary.engine.control;
      return !c.right && !c.left && Math.hypot(c.move.x, c.move.y) < .001;
    });
    if (checkPosition) {
      const atRelease = await state();
      await ticks(2);
      const stopped = await state();
      assert.ok(distance(stopped.player, atRelease.player) < .01, 'Released steering must stop movement');
    }
    const after = await guard();
    assert.ok(after.tick >= before.tick);
    return after;
  }
  function direction(dx, dy) {
    const horizontal = dx - dy, vertical = dx + dy;
    const magnitude = Math.hypot(horizontal, vertical);
    assert.ok(magnitude > .001, 'Zero steering direction');
    const keys = [];
    // Choose the closest of the eight actual WASD directions, not world-axis keys.
    if (Math.abs(horizontal) >= Math.abs(vertical) * .4143) keys.push(horizontal > 0 ? 'd' : 'a');
    if (Math.abs(vertical) >= Math.abs(horizontal) * .4143) keys.push(vertical > 0 ? 's' : 'w');
    return { horizontal: horizontal / magnitude, vertical: vertical / magnitude, keys };
  }
  async function drive(point, castTarget = null) {
    const before = await guard();
    assert.equal(before.panel, 'none');
    const d = distance(before.player, point);
    if (d < .13) return before;
    const dir = direction(point.x - before.player.x, point.y - before.player.y);
    const budget = Math.min(.46, d * .8);
    let mouseHeld = false, touchHeld = false;
    try {
      if (mobile) {
        const stick = await center('.joystick');
        const points = [{ x: stick.x + dir.horizontal * 26, y: stick.y + dir.vertical * 26, id: 70 }];
        if (castTarget) points.push({ ...await center('.touch-action.cast'), id: 71 });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points });
        touchHeld = true;
      } else {
        if (castTarget) {
          const aim = await worldScreen(castTarget);
          assert.ok(aim, 'Cast target is outside unobscured canvas');
          await page.mouse.move(aim.x, aim.y);
          await page.mouse.down({ button: 'right' }); mouseHeld = true;
        }
        for (const key of dir.keys) await page.keyboard.down(key);
      }
      await page.waitForFunction(({ x, y, point, budget, seq, cast }) => {
        const s = window.sanctuary.engine.state, p = s.player;
        const moved = Math.hypot(p.x - x, p.y - y);
        if (p.dead) return true;
        if (cast) return moved > .035 && s.events.some(e => e.seq > seq && e.actor === 'player' && e.kind === 'cast');
        return moved >= budget || Math.hypot(p.x - point.x, p.y - point.y) < .13;
      }, { x: before.player.x, y: before.player.y, point, budget, seq: before.eventSeq, cast: !!castTarget }, { timeout: 2500 });
      if (mobile && castTarget) {
        const held = await state();
        assert.equal(held.control.right, true, 'CDP cast touch is actually held');
        assert.ok(Math.hypot(held.control.move.x, held.control.move.y) > .1, 'CDP joystick and cast are held simultaneously');
        assert.ok(distance(held.player, before.player) > .035, 'Simultaneous native touch actually moves while casting');
        simultaneous = true;
      }
    } finally {
      if (touchHeld) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      if (!mobile) {
        for (const key of dir.keys) await page.keyboard.up(key);
        if (mouseHeld) await page.mouse.up({ button: 'right' });
      }
    }
    return released(before);
  }

  // Page-side work below is observation plus the explicitly allowed pure BFS.
  // It scans reachable enemies and collision tiles, not a guessed entrance enemy.
  async function plan(mode, target = null) {
    return page.evaluate(async ({ mode, target, mobile }) => {
      const { findPath } = await import('/src/engine.ts');
      const { hasLineOfSight } = await import('/src/world.ts');
      const { area, player } = window.sanctuary.engine.state;
      const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
      const walkable = p => area.tiles[Math.floor(p.y)]?.[Math.floor(p.x)] === 0;
      const los = (from, to) => hasLineOfSight(area, from, to);
      const first = path => path.find(p => dist(p, player) > .16) ?? path.at(-1);
      const alive = area.monsters.filter(m => !m.dead);
      if (mode === 'path') {
        if (dist(player, target) < .16) return { point: target, length: 0 };
        const path = findPath(area, player, target);
        return path.length ? { point: first(path), length: path.length } : null;
      }
      if (mode === 'retreat') {
        let best = null;
        const nearest = alive.reduce((n, m) => Math.min(n, dist(player, m)), 30);
        for (let y = Math.floor(player.y) - 4; y <= Math.floor(player.y) + 4; y++) {
          for (let x = Math.floor(player.x) - 4; x <= Math.floor(player.x) + 4; x++) {
            const point = { x: x + .5, y: y + .5 }, radius = dist(player, point);
            if (radius < 1.2 || radius > 4.5 || !walkable(point) || !los(player, point)) continue;
            const path = findPath(area, player, point);
            if (!path.length) continue;
            const clearance = alive.reduce((n, m) => Math.min(n, dist(point, m)), 30);
            const range = target ? dist(point, target) : 7;
            const score = clearance * 4 - radius * .15 - Math.abs(range - 7) * .25;
            if (!best || score > best.score) best = { point: first(path), destination: point, clearance, nearest, score };
          }
        }
        return best;
      }
      const visible = enemy => {
        if (mobile) return true; // Touch has native nine-unit auto-aim, not a pointer.
        const p = window.sanctuary.renderer.worldToScreen(enemy, .8);
        return p.x > 0 && p.y > 0 && p.x < innerWidth && p.y < innerHeight
          && document.elementFromPoint(p.x, p.y) === window.sanctuary.ui.canvas;
      };
      const reachable = alive.map(enemy => {
        const path = findPath(area, player, enemy);
        return { enemy, path, length: path.length, distance: dist(player, enemy) };
      }).filter(entry => entry.path.length || entry.distance < .16).sort((a, b) => a.length - b.length || a.distance - b.distance);
      if (!alive.length) return { clear: true };
      if (!reachable.length) return { blocked: 'No living enemy has a legal approach path', alive: alive.map(m => ({ uid: m.uid, code: m.code, x: m.x, y: m.y })) };
      let entry = reachable[0];
      const nearest = alive.filter(enemy => dist(enemy, player) <= 9 && los(player, enemy)).sort((a, b) => dist(a, player) - dist(b, player))[0];
      if (mobile && nearest) {
        entry = reachable.find(candidate => candidate.enemy.uid === nearest.uid);
        if (!entry) return { blocked: 'Native touch nearest enemy is unreachable and monopolizes auto-aim', enemy: nearest };
      } else if (!mobile) {
        const shootable = reachable.filter(candidate => candidate.distance <= 7.6 && los(player, candidate.enemy) && visible(candidate.enemy));
        if (shootable.length) entry = shootable.sort((a, b) => a.distance - b.distance)[0];
      }
      return { enemy: entry.enemy, distance: entry.distance, los: los(player, entry.enemy), visible: visible(entry.enemy), point: first(entry.path), length: entry.length, clear: false };
    }, { mode, target, mobile });
  }
  async function retreat(target = null, steps = 3) {
    for (let i = 0; i < steps; i++) {
      const move = await plan('retreat', target);
      assert.ok(move?.point, 'No legal kiting/retreat tile');
      await drive(move.point);
    }
  }
  async function moveTo(target, radius = 1.1, defend = true) {
    let stalled = 0, best = Infinity;
    for (let i = 0; i < LIMITS.navigation; i++) {
      const s = await guard();
      if (distance(s.player, target) <= radius) return;
      if (defend && !s.area.town) {
        const threat = s.monsters.filter(m => !m.dead && distance(m, s.player) < 6.5).sort((a, b) => distance(a, s.player) - distance(b, s.player))[0];
        if (threat) { await fightOne(threat.uid); continue; }
      }
      const route = await plan('path', target);
      assert.ok(route?.point, `No legal path to interaction/travel at ${JSON.stringify(target)}`);
      const before = s.player;
      const after = await drive(route.point);
      // BFS distance, rather than straight-line distance, permits genuine detours
      // around cave walls without falsely declaring them stalled.
      const current = route.length + distance(after.player, route.point);
      if (current < best - .08) { best = current; stalled = 0; }
      else if (distance(before, after.player) < .025 || ++stalled > 90) throw new Error(`Native navigation stuck at ${JSON.stringify(after.player)} toward ${JSON.stringify(target)}`);
    }
    throw new Error('Native navigation iteration limit');
  }
  async function nearAction(uid, isDrop = false, defend = true, acceptNearestDrop = false) {
    const s = await guard();
    let target = isDrop ? s.drops.find(d => d.item.uid === uid) : s.objects.find(o => o.uid === uid);
    assert.ok(target, `Missing ${isDrop ? 'drop' : 'object'} ${uid}`);
    await moveTo(target, .55, defend);
    const now = await guard();
    if (isDrop && acceptNearestDrop) {
      target = now.drops.filter(d => distance(d, now.player) <= 3).sort((a, b) => distance(a, now.player) - distance(b, now.player))[0];
      assert.ok(target, 'Approaching loot must leave a real drop within pickup range');
      uid = target.item.uid;
      if (!fits(now.player, target.item)) return { drop: target, before: now, picked: false };
    }
    if (mobile) {
      const candidates = isDrop ? now.drops.map(d => ({ ...d, uid: d.item.uid })) : now.objects.filter(o => !o.used || !['chest', 'shrine'].includes(o.kind));
      const nearest = candidates.filter(o => distance(o, now.player) <= 3).sort((a, b) => distance(a, now.player) - distance(b, now.player))[0];
      assert.equal(nearest?.uid, uid, 'Requested native touch interaction is not the nearest target');
      await activate(page.getByRole('button', { name: isDrop ? '拾取三格内最近的掉落' : '与三格内最近的设施交互', exact: true }));
    } else {
      const candidates = [...now.objects.filter(o => !o.used || !['chest', 'shrine'].includes(o.kind)), ...now.drops.map(d => ({ ...d, uid: d.item.uid }))].filter(o => distance(o, now.player) <= 3);
      // E includes loot. At equal distances the implementation chooses a drop.
      candidates.sort((a, b) => distance(a, now.player) - distance(b, now.player) || Number(!a.item) - Number(!b.item));
      if (candidates[0]?.uid === uid) await page.keyboard.press('e');
      else {
        const screen = isDrop ? await page.evaluate(({ target, uid }) => {
          const { renderer, ui } = window.sanctuary;
          const center = renderer.worldToScreen(target, .4);
          for (const dy of [0, -4, 4, -8, 8]) for (const dx of [0, ...Array.from({ length: 32 }, (_, i) => (i % 2 ? -1 : 1) * (Math.floor(i / 2) + 1) * 8)]) {
            const x = center.x + dx, y = center.y + dy;
            if (document.elementFromPoint(x, y) === ui.canvas && ui.pick(x, y)?.uid === uid) return { x, y };
          }
          return null;
        }, { target, uid }) : await worldScreen(target);
        assert.ok(screen, 'Interaction target has no unobscured, correctly hit-tested canvas point');
        await page.mouse.click(screen.x, screen.y);
      }
    }
    return { drop: isDrop ? target : null, before: now, picked: true };
  }
  async function objectWhere(predicate) {
    const s = await guard();
    const object = s.objects.find(predicate);
    assert.ok(object, `Required world object missing in area ${s.area.id}`);
    return object;
  }
  async function travel(areaId, defend = true) {
    await closePanel();
    const before = await guard();
    const exit = await objectWhere(o => o.kind === 'exit' && o.targetArea === areaId);
    await nearAction(exit.uid, false, defend);
    await page.waitForFunction(id => window.sanctuary.engine.state.area.def.id === id, areaId, { timeout: 12000 });
    await rendered();
    evidence.travels.push([before.area.id, areaId, 'exit']);
    await guard();
  }
  async function talk(npcId) {
    await closePanel();
    const npc = await objectWhere(o => o.npcId === npcId);
    await nearAction(npc.uid);
    await page.waitForFunction(id => window.sanctuary.engine.state.panel === 'vendor' && window.sanctuary.engine.state.npc === id, npcId);
  }
  async function waypoint(areaId) {
    await closePanel();
    const stone = await objectWhere(o => o.kind === 'waypoint');
    await nearAction(stone.uid);
    await page.locator('.panel-waypoint').waitFor();
    const s = await guard();
    assert.ok(s.player.waypoints.includes(s.area.id), 'Real waypoint interaction must discover its area');
    if (areaId !== undefined && areaId !== s.area.id) {
      assert.ok(s.player.waypoints.includes(areaId), 'Cannot use an undiscovered waypoint');
      await activate(page.locator(`.waypoint-button[data-area="${areaId}"]:not(:disabled)`));
      await page.waitForFunction(id => window.sanctuary.engine.state.area.def.id === id, areaId);
      await rendered();
      evidence.travels.push([s.area.id, areaId, 'discovered waypoint']);
    } else await closePanel();
  }
  function routeBetween(from, to) {
    const queue = [[from]], seen = new Set([from]);
    for (const path of queue) {
      if (path.at(-1) === to) return path.slice(1);
      for (const next of graph.get(path.at(-1)) ?? []) {
        if (!graph.has(next) || seen.has(next)) continue;
        seen.add(next); queue.push([...path, next]);
      }
    }
    throw new Error(`No actually visited exit route from ${from} to ${to}`);
  }
  async function buyCode(code, amount = 1) {
    for (let i = 0; i < amount; i++) {
      const s = await guard();
      // vendorItems is read separately to keep ordinary snapshots modest.
      const stock = await page.evaluate(code => window.sanctuary.engine.state.vendorItems.find(item => item.code === code), code);
      assert.ok(stock, `Akara has no ${code} offer`);
      assert.ok(s.player.gold >= stock.price, `Earned gold cannot afford ${code}: ${s.player.gold}/${stock.price}`);
      assert.ok(fits(s.player, stock), `No legitimate space for ${code}`);
      await activate(page.locator('.vendor-row').filter({ has: page.locator(`[data-focus="item:${stock.uid}"]`) }).getByRole('button', { name: /金币 · 购买$/ }));
      await page.waitForFunction(({ gold, price }) => window.sanctuary.engine.state.player.gold === gold - price, { gold: s.player.gold, price: stock.price });
      evidence.bought[code] = (evidence.bought[code] ?? 0) + 1;
    }
  }
  async function equipInventory() {
    const initial = await guard();
    if (!initial.player.inventory.some(item => upgradeSlot(initial, item))) return;
    await panel('inventory');
    const tried = new Set();
    for (let i = 0; i < 30; i++) {
      const s = await guard();
      const item = s.player.inventory.filter(item => !tried.has(item.uid) && upgradeSlot(s, item)).sort((a, b) => gearScore(b) - gearScore(a))[0];
      if (!item) break;
      tried.add(item.uid);
      const slot = upgradeSlot(s, item);
      await activate(page.locator(`.panel-inventory .grid-item[data-focus="item:${item.uid}"]`));
      const detail = page.locator('.panel-inventory .item-detail');
      const text = await detail.innerText();
      const cls = /仅限([^\n]+)/.exec(text)?.[1];
      if (cls && cls !== '法师') continue;
      // Slot/requirement ranking is advisory, but an attempted equip is asserted,
      // never silently treated as a pass when the real engine rejects it.
      await activate(detail.getByRole('button', { name: '装备', exact: true }));
      await page.waitForFunction(({ uid, slot }) => window.sanctuary.engine.state.player.equipment[slot]?.uid === uid, { uid: item.uid, slot });
      evidence.equipped.push({ uid: item.uid, code: item.code, slot, source: lootedItemUids.has(item.uid) ? 'drop' : item.uid.startsWith('shop-') ? 'shop' : 'previous equipment' });
    }
    await closePanel();
  }
  async function train() {
    let s = await guard();
    if (s.player.level <= 1 || !s.player.statPoints && !s.player.skillPoints) return;
    const oldStage = stage; stage = `${oldStage} / earned level ${s.player.level} C/T allocation`;
    if (s.player.statPoints) {
      await panel('character');
      for (let i = 0; i < 500; i++) {
        s = await guard();
        if (!s.player.statPoints) break;
        // Three vitality, two energy per five earned points; no strength grants.
        const stat = allocated % 5 < 3 ? 'vitality' : 'energy';
        await activate(page.getByRole('button', { name: stat === 'vitality' ? '分配一点体力' : '分配一点精力', exact: true }));
        await page.waitForFunction(({ stat, value, budget }) => {
          const p = window.sanctuary.engine.state.player;
          return p[stat] === value + 1 && p.statPoints === budget - 1;
        }, { stat, value: s.player[stat], budget: s.player.statPoints });
        allocated++;
      }
      assert.equal((await guard()).player.statPoints, 0, 'C allocation loop exhausted');
      await closePanel();
    }
    s = await guard();
    if (s.player.skillPoints) {
      await panel('skills');
      // Both skills are on SkillPage 1 / first sorceress tree in this version.
      await activate(page.locator('.panel-skills .panel-tabs .tab-button').first());
      for (let i = 0; i < 60; i++) {
        s = await guard();
        if (!s.player.skillPoints) break;
        const fire = s.player.skills[36] ?? 0, warmth = s.player.skills[37] ?? 0;
        const id = !fire ? 36 : !warmth ? 37 : fire < Math.min(20, s.player.level) ? 36 : warmth < Math.min(20, s.player.level) ? 37 : null;
        if (!id) break; // Hard-point caps retain the actual unspent budget.
        await activate(page.locator(`.skill-node[data-focus="skill:${id}"]`));
        await activate(page.locator('.skill-detail').getByRole('button', { name: '投入 1 技能点', exact: true }));
        await page.waitForFunction(({ id, hard, budget }) => {
          const p = window.sanctuary.engine.state.player;
          return p.skills[id] === hard + 1 && p.skillPoints === budget - 1;
        }, { id, hard: s.player.skills[id] ?? 0, budget: s.player.skillPoints });
        evidence.learned[id] = (evidence.learned[id] ?? 0) + 1;
      }
      await activate(page.locator('.skill-node[data-focus="skill:36"]'));
      await activate(page.locator('.skill-detail .hotkey-button').first());
      await activate(page.locator('.skill-detail').getByRole('button', { name: '绑定右键', exact: true }));
      await page.waitForFunction(() => window.sanctuary.engine.state.panel === 'none');
      if (!mobile) await page.keyboard.press('1');
      assert.equal((await guard()).player.rightSkill, 36);
    }
    lastTrainingLevel = (await guard()).player.level;
    stage = oldStage;
  }
  async function sellInventory(keepUnidentified = false) {
    for (let i = 0; i < 50; i++) {
      const s = await guard();
      const item = inventoryForSale(s, keepUnidentified)[0];
      if (!item) return;
      await activate(page.locator(`.panel-vendor .grid-item[data-focus="item:${item.uid}"]`));
      await activate(page.locator('.panel-vendor .item-detail').getByRole('button', { name: '出售', exact: true }));
      await page.waitForFunction(({ uid, gold }) => {
        const p = window.sanctuary.engine.state.player;
        return !p.inventory.some(item => item.uid === uid) && p.gold > gold;
      }, { uid: item.uid, gold: s.player.gold });
      evidence.sold++;
    }
    throw new Error('Inventory sale limit reached');
  }
  async function townBusiness() {
    await talk('akara');
    await activate(page.locator('.panel-vendor').getByRole('button', { name: '治疗', exact: true }));
    await page.waitForFunction(() => {
      const s = window.sanctuary.engine.state;
      return s.player.life === s.stats.maxLife && s.player.mana === s.stats.maxMana;
    });
    await closePanel();
    await train();
    await equipInventory();
    await talk('akara');
    await sellInventory(true);
    let s = await guard();
    // Maintain a real return-scroll reserve before optional shopping.
    while (portalCount(s.player) < 2 && s.player.gold >= 100) { await buyCode('tsc'); s = await guard(); }
    // Identification uses purchased/looted scrolls, not Cain's unfinished quest.
    if (s.player.inventory.some(item => !item.identified && (bases.get(item.code)?.slot || /^cm[123]$/.test(item.code)))) {
      const unknown = s.player.inventory.filter(item => !item.identified).length;
      const affordable = Math.max(0, Math.floor((s.player.gold - 120) / 80));
      const needed = Math.max(0, unknown - identifyCount(s.player));
      if (needed && affordable) await buyCode('isc', Math.min(needed, affordable, 12));
      if (identifyCount((await guard()).player)) {
        await panel('inventory');
        while (true) {
          const current = await guard(), item = current.player.inventory.find(item => !item.identified);
          if (!item || !identifyCount(current.player)) break;
          await activate(page.locator(`.panel-inventory .grid-item[data-focus="item:${item.uid}"]`));
          await activate(page.locator(mobile ? '.item-popup' : '.panel-inventory .item-detail').getByRole('button', { name: '鉴定', exact: true }));
          await page.waitForFunction(uid => window.sanctuary.engine.state.player.inventory.find(item => item.uid === uid)?.identified, item.uid);
          if (mobile) await activate(page.locator('.popup-close'));
        }
        await closePanel(); await equipInventory(); await talk('akara'); await sellInventory();
      }
    }
    await sellInventory();
    s = await guard();
    const stock = await page.evaluate(() => window.sanctuary.engine.state.vendorItems);
    const beltOffer = stock.filter(item => upgradeSlot(s, item) === 'belt' && item.price <= s.player.gold - 180).sort((a, b) => gearScore(b) - gearScore(a))[0];
    if (beltOffer) {
      await buyCode(beltOffer.code); await closePanel(); await equipInventory(); await talk('akara');
    }
    // Inventory potions have no direct 'drink/refill' button in this build. Do
    // not buy unusable inventory reserves or pretend they are belt charges.
    s = await guard();
    const cells = s.stats.beltRows * 4;
    let empty = s.player.belt.slice(0, cells).filter(item => !item).length;
    const hpTarget = Math.max(1, Math.floor(cells * .35));
    for (let i = 0; i < 16 && empty > 0; i++) {
      s = await guard();
      const hp = s.player.belt.slice(0, cells).filter(item => item?.code.startsWith('hp')).length;
      const prefix = hp < hpTarget ? 'hp' : 'mp';
      const offers = (await page.evaluate(() => window.sanctuary.engine.state.vendorItems)).filter(item => item.code.startsWith(prefix) && /^[hm]p[1-5]$/.test(item.code) && item.price <= s.player.gold).sort((a, b) => Number(b.code.at(-1)) - Number(a.code.at(-1)));
      if (!offers.length) break;
      await buyCode(offers[0].code);
      empty = (await guard()).player.belt.slice(0, cells).filter(item => !item).length;
    }
    await closePanel();
    s = await guard();
    assert.ok(s.player.life === s.stats.maxLife && s.player.mana === s.stats.maxMana, 'Town treatment is real');
  }
  async function serviceTown(reason) {
    assert.equal(servicing, false, `Recursive resupply blocker: ${reason}`);
    assert.ok(++serviceCount <= LIMITS.services, 'Town resupply iteration limit reached');
    servicing = true;
    const oldStage = stage; stage = `${oldStage} / legitimate Akara resupply: ${reason}`;
    const start = await guard(), source = start.area.id;
    let returnPortal = false;
    try {
      await closePanel();
      if (source !== 1) {
        if (portalCount(start.player)) {
          await activate(page.getByRole('button', { name: '回城', exact: true }));
          await page.waitForFunction(() => window.sanctuary.engine.state.area.objects.some(o => o.kind === 'portal' && o.targetArea === 1));
          const portal = await objectWhere(o => o.kind === 'portal' && o.targetArea === 1);
          // Do not stop to fight an approaching pack while urgently using a TP.
          await moveTo(portal, 1, false);
          await nearAction(portal.uid, false, false);
          await page.waitForFunction(() => window.sanctuary.engine.state.area.def.id === 1);
          await rendered(); returnPortal = true;
        } else if (start.area.waypoint && start.monsters.every(m => m.dead)) await waypoint(1);
        else for (const id of routeBetween(source, 1)) await travel(id, false);
      }
      await townBusiness();
      const s = await guard();
      if (source !== 1) {
        if (returnPortal) {
          const back = await objectWhere(o => o.kind === 'portal' && o.targetArea === source);
          await nearAction(back.uid);
          await page.waitForFunction(id => window.sanctuary.engine.state.area.def.id === id, source);
          await rendered();
        } else if (s.player.waypoints.includes(source)) await waypoint(source);
        else for (const id of routeBetween(1, source)) await travel(id);
        assert.equal((await guard()).area.id, source, 'Resupply returns through actual portal/waypoint/exits');
      }
      lastHealthPotion = lastManaPotion = -Infinity;
      console.log(JSON.stringify({ platform: label, resupply: reason, source, level: s.player.level, xp: s.player.experience, gold: s.player.gold, belt: s.player.belt.filter(Boolean).map(item => item.code) }));
    } finally { servicing = false; stage = oldStage; }
  }
  function beltTop(s, kind) {
    for (let column = 0; column < 4; column++) {
      const item = Array.from({ length: s.stats.beltRows }, (_, row) => s.player.belt[row * 4 + column]).find(Boolean);
      if (item && (item.code.startsWith(kind) || /^rv[sl]$/.test(item.code))) return { column, item };
    }
    return null;
  }
  async function drink(kind) {
    const s = await guard(), top = beltTop(s, kind);
    if (!top) return false;
    if (mobile) await activate(page.locator('.belt-cell').filter({ hasText: `⇧${top.column + 1}` }));
    else if (!evidence.drank[top.item.code]) await page.keyboard.press(`Shift+Digit${top.column + 1}`);
    else await page.keyboard.press(kind === 'hp' ? 'q' : 'f');
    await page.waitForFunction(uid => !window.sanctuary.engine.state.player.belt.some(item => item?.uid === uid), top.item.uid);
    evidence.drank[top.item.code] = (evidence.drank[top.item.code] ?? 0) + 1;
    if (kind === 'hp') lastHealthPotion = s.tick; else lastManaPotion = s.tick;
    return true;
  }
  async function refillFromBag(kind) {
    const s = await guard();
    if (beltTop(s, kind) || !s.player.belt.slice(0, s.stats.beltRows * 4).some(item => !item)) return false;
    const item = s.player.inventory.find(item => item.code.startsWith(kind) && potion(item));
    if (!item) return false;
    // The current UI has no bag-to-belt action. Dropping and picking it up is
    // the real exposed route, and both intermediate states must be observed.
    await panel('inventory');
    await activate(page.locator(`.panel-inventory .grid-item[data-focus="item:${item.uid}"]`));
    await activate(page.locator('.panel-inventory .item-detail').getByRole('button', { name: '丢弃', exact: true }));
    await page.waitForFunction(uid => {
      const s = window.sanctuary.engine.state;
      return !s.player.inventory.some(item => item.uid === uid) && s.area.drops.some(drop => drop.item.uid === uid);
    }, item.uid);
    await closePanel();
    await nearAction(item.uid, true, false);
    await page.waitForFunction(uid => {
      const s = window.sanctuary.engine.state;
      return s.player.belt.some(item => item?.uid === uid) && !s.area.drops.some(drop => drop.item.uid === uid);
    }, item.uid);
    evidence.bagToBelt = (evidence.bagToBelt ?? 0) + 1;
    return true;
  }
  async function sustain() {
    await refillFromBag('mp'); await refillFromBag('hp');
    let s = await guard();
    if (s.player.life < s.stats.maxLife * .80 && s.tick - lastHealthPotion > 160) await drink('hp');
    s = await guard();
    if (s.player.mana < Math.max(5, s.stats.maxMana * .32) && s.tick - lastManaPotion > 80) await drink('mp');
    s = await guard();
    const needsHeal = s.player.life < s.stats.maxLife * .38 && !beltTop(s, 'hp');
    const needsMana = s.player.mana < 3 && !beltTop(s, 'mp') && s.tick - lastManaPotion > 140;
    if ((needsHeal || needsMana) && !servicing) {
      await serviceTown(needsHeal ? 'health belt exhausted' : 'mana belt exhausted');
      return;
    }
    if (needsHeal && servicing) throw new Error('No health sustain on the real return path');
    if (s.player.life < s.stats.maxLife * .35) {
      for (let i = 0; i < 100; i++) {
        s = await guard();
        if (s.player.life >= s.stats.maxLife * .42) break;
        if (s.tick - lastHealthPotion > 160) {
          if (!await drink('hp')) throw new Error('Critical health cannot recover through real potions');
        }
        await retreat(null, 2); await ticks(2);
      }
      s = await guard();
      assert.ok(s.player.life >= s.stats.maxLife * .42, 'Critical-health kiting/recovery limit reached');
    }
    if (s.player.mana < 2.5) {
      // Real regeneration while physically kiting, not a fake mana grant.
      for (let i = 0; i < 120; i++) {
        s = await guard();
        if (s.player.mana >= 3) return;
        await retreat(null, 1);
        await ticks(2);
      }
      throw new Error('Mana regeneration/kiting limit reached');
    }
  }
  async function cast(target) {
    const before = await guard();
    let held = false;
    try {
      if (mobile) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...await center('.touch-action.cast'), id: 71 }] });
      } else {
        const currentTarget = before.monsters.find(m => m.uid === target.uid && !m.dead);
        if (!currentTarget) return false;
        const aim = await worldScreen(currentTarget, .8);
        if (!aim) return false;
        await page.mouse.move(aim.x, aim.y); await page.mouse.down({ button: 'right' });
      }
      held = true;
      // Low mana can fund just one cast; this is not counted as repeated-input
      // evidence. A separate mandatory assertion requires a real two-cast hold.
      const desiredCasts = before.player.mana >= 8 ? 2 : 1;
      let finished = false;
      for (let i = 0; i < 24; i++) {
        const current = await guard(), enemy = current.monsters.find(m => m.uid === target.uid);
        if (enemy?.dead || current.player.life < current.stats.maxLife * .25
          || current.events.filter(e => e.seq > before.eventSeq && e.actor === 'player' && e.kind === 'cast').length >= desiredCasts) {
          finished = true;
          break;
        }
        if (!mobile && enemy) {
          const aim = await worldScreen(enemy, .8);
          if (aim) await page.mouse.move(aim.x, aim.y);
        }
        await ticks(2);
      }
      assert.equal(finished, true, 'Held cast did not finish within its actual-frame budget');
    } finally {
      if (held && mobile) await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      if (held && !mobile) await page.mouse.up({ button: 'right' });
    }
    const after = await released(before);
    const events = after.events.filter(e => e.seq > before.eventSeq && e.actor === 'player' && e.kind === 'cast');
    assert.ok(events.length > 0, 'Held UI cast produced no player cast event');
    evidence.casts += events.length;
    if (events.length >= 2) repeatedHeldCast = true;
    return true;
  }
  async function fightOne(requestedUid = null) {
    const began = Date.now();
    let lastDamage = Date.now(), previousLife = null, focusUid = null, repositionAttempts = 0;
    for (let iteration = 0; iteration < LIMITS.fights; iteration++) {
      let s = await guard();
      if (requestedUid && s.monsters.find(m => m.uid === requestedUid)?.dead) return;
      await sustain();
      const approach = await plan('enemy');
      if (approach.clear) return;
      assert.ok(!approach.blocked, JSON.stringify(approach));
      const target = approach.enemy;
      if (focusUid !== target.uid) { focusUid = target.uid; previousLife = target.life; lastDamage = Date.now(); }
      if (previousLife !== null && target.life < previousLife) { lastDamage = Date.now(); repositionAttempts = 0; }
      previousLife = target.life;
      assert.ok(Date.now() - began < LIMITS.enemySeconds * 1000, `Fight budget exhausted; target ${target.code} ${target.life}/${target.maxLife}`);
      s = await guard();
      if (!s.monsters.some(m => !m.dead && m.uid === target.uid)) continue;
      if (lastTrainingLevel !== s.player.level && approach.distance > 5.5) await train();
      if (!approach.los || !approach.visible || approach.distance > 7.6) {
        assert.ok(approach.point, 'Reachable enemy lacks a next path waypoint');
        await drive(approach.point);
        continue;
      }
      const before = await guard();
      const move = await plan('retreat', target);
      if (mobile && !simultaneous) {
        assert.ok(move?.point, 'No legal tile for native simultaneous joystick/cast test');
        await drive(move.point, target);
      } else if (!await cast(target)) {
        const route = await plan('path', target);
        assert.ok(route?.point, 'Unobscured aiming requires a legal approach waypoint');
        await drive(route.point);
        continue;
      }
      if (move?.point) await retreat(target, 3);
      const after = await guard();
      const died = before.monsters.filter(m => !m.dead && after.monsters.find(other => other.uid === m.uid)?.dead);
      if (died.length) {
        assert.ok(after.player.experience >= before.player.experience, 'Combat unexpectedly lost XP');
        lastDamage = Date.now();
        return;
      }
      if (Date.now() - lastDamage > 14000) {
        assert.ok(++repositionAttempts <= 3, `Held spells cannot damage nearest reachable target: ${target.code} ${target.life}/${target.maxLife}; LOS/native aim blocker`);
        // Wall-adjacent/projectile interception can need a different firing tile.
        await retreat(target, 8); lastDamage = Date.now();
      }
    }
    throw new Error('Combat iteration limit exhausted');
  }
  async function lootNearby(radius = 4, maximum = 10) {
    for (let i = 0; i < maximum; i++) {
      const s = await guard();
      if (s.monsters.some(m => !m.dead && distance(m, s.player) < 6)) return;
      const drop = [...s.drops].filter(d => distance(d, s.player) <= radius).sort((a, b) => distance(a, s.player) - distance(b, s.player))[0];
      if (!drop) return;
      const path = await plan('path', drop);
      assert.ok(path, `Drop has no legal pickup path: ${drop.item.code}`);
      const { drop: pickedDrop, before, picked } = await nearAction(drop.item.uid, true, true, true);
      if (!picked) {
        if (!servicing && inventoryForSale(before).length) { await serviceTown('inventory space blocked; sell actual drops or surplus potions'); continue; }
        throw new Error(`Nearest native loot is unpickable with available inventory/belt space: ${pickedDrop.item.code}`);
      }
      await page.waitForFunction(uid => !window.sanctuary.engine.state.area.drops.some(d => d.item.uid === uid), pickedDrop.item.uid);
      const after = await guard();
      if (pickedDrop.item.code === 'gld') {
        assert.equal(after.player.gold, before.player.gold + pickedDrop.item.quantity);
        evidence.goldPicked += pickedDrop.item.quantity;
      } else {
        assert.ok([...after.player.inventory, ...after.player.belt.filter(Boolean)].some(item => item.uid === pickedDrop.item.uid), 'Native loot went missing');
        lootedItemUids.add(pickedDrop.item.uid);
      }
    }
  }
  async function clearArea() {
    const start = await guard(), began = Date.now();
    stage = `clear ${start.area.id} ${start.area.english}`;
    const initialCount = start.monsters.length;
    assert.ok(initialCount > 0 || start.area.id === 20, 'Required campaign area has no real monster population');
    for (let iteration = 0; iteration < 1500; iteration++) {
      const s = await guard();
      assert.equal(s.area.id, start.area.id, 'Combat/navigation changed area unexpectedly');
      assert.ok(Date.now() - began < LIMITS.areaMinutes * 60000, 'Area clear wall-clock limit reached');
      if (s.monsters.every(m => m.dead)) {
        await lootNearby(Infinity, 24);
        await train(); await equipInventory();
        if (s.area.waypoint) await waypoint();
        const end = await guard();
        assert.equal(end.monsters.filter(m => !m.dead).length, 0, 'Revived monsters invalidate a clear');
        if (initialCount) assert.ok(end.player.experience > start.player.experience, 'Populated area clear must produce legitimate XP');
        evidence.areasCleared.push(start.area.id);
        console.log(JSON.stringify({ platform: label, cleared: start.area.id, name: start.area.english, monsters: initialCount, level: end.player.level, xp: end.player.experience, life: end.player.life, mana: end.player.mana, gold: end.player.gold, milliseconds: Date.now() - began }));
        return;
      }
      await fightOne();
      if (killsSinceLoot >= 2) { await lootNearby(); killsSinceLoot = 0; }
      const after = await guard();
      if (after.player.level !== lastTrainingLevel && !after.monsters.some(m => !m.dead && distance(m, after.player) < 5.5)) await train();
    }
    throw new Error('Area clear iteration limit reached');
  }

  try {
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.storageStatus === 'ready');
    assert.equal(await page.locator('.character-save').count(), 0, 'Fresh browser context must have no production characters');
    await activate(page.getByRole('button', { name: '新建角色', exact: true }));
    await activate(page.locator('[data-class="sor"]'));
    await page.locator('#hero-name').fill(mobile ? '触屏第一幕实战' : '桌面第一幕实战');
    await activate(page.getByRole('button', { name: '开启旅程', exact: true }));
    await rendered();
    const starter = await guard();
    assert.equal(starter.area.id, 1); assert.equal(starter.player.level, 1); assert.equal(starter.player.experience, 0);
    assert.equal(starter.player.gold, 0); assert.equal(starter.player.skillPoints, 0); assert.equal(starter.player.statPoints, 0);
    assert.deepEqual(starter.player.skills, {}); assert.equal(starter.player.rightSkill, 36);
    assert.equal(starter.player.equipment.weapon.code, 'sst');
    assert.equal(starter.player.equipment.weapon.mods['skill:36'], 1, 'Only UI-created starter staff grants Fire Bolt');
    assert.equal(starter.player.belt.filter(Boolean).length, 4);
    await page.waitForFunction(() => window.sanctuary.engine.state.saved && !window.sanctuary.engine.state.loadingSave);
    const characterId = starter.id;
    stage = 'native steering/release and pre-Andy travel gate';
    const moved = await drive({ x: starter.player.x + 2, y: starter.player.y - 2 });
    assert.ok(moved.player.x > starter.player.x && moved.player.y < starter.player.y, 'Screen-right D/joystick maps to +worldX,-worldY');
    await released(starter, true);
    await panel('quests'); assert.equal(await page.locator('.panel-quests .quest-card').count(), 6); await closePanel();
    await panel('inventory');
    if (mobile) {
      await activate(page.locator('.panel-inventory').getByRole('button', { name: /^切换武器组/ }));
      assert.equal((await guard()).player.weaponSwap, true);
      await activate(page.locator('.panel-inventory').getByRole('button', { name: /^切换武器组/ }));
    } else { await closePanel(); await page.keyboard.press('x'); assert.equal((await guard()).player.weaponSwap, true); await page.keyboard.press('x'); }
    assert.equal((await guard()).player.weaponSwap, false); await closePanel();
    await talk('akara'); await closePanel(); await talk('warriv');
    assert.equal(await page.getByRole('button', { name: '向东旅行 · 鲁高因', exact: true }).count(), 0, 'No pre-kill east-travel UI');
    assert.equal((await guard()).player.unlockedActs, 1); await closePanel();

    await travel(2); await clearArea();
    await serviceTown('earned Blood Moor loot funds potions and gear');
    await travel(8); await clearArea();
    const den = await guard();
    assert.equal(den.player.quests['normal:a1q1'], 2, 'Every Den enemy, including Corpsefire/revivals, really cleared');
    await shot('den-cleared');
    stage = 'Den of Evil reward via Akara';
    await travel(2); await travel(1);
    const beforeReward = await guard();
    await talk('akara');
    const reward = await guard();
    assert.equal(reward.player.quests['normal:a1q1'], 3);
    assert.equal(reward.player.skillPoints, beforeReward.player.skillPoints + 1, 'Akara grants exactly the legitimate Den reward');
    await closePanel(); await townBusiness();
    await travel(2); await travel(3); await clearArea();
    // Optional *real* detours are reported only when actually traversed/cleared.
    // Neither is a conditional fixture counted as a passed quest.
    if ((await guard()).player.level < 6) {
      evidence.detours.push('Blood Raven for earned XP');
      await travel(17); await clearArea();
      assert.equal((await guard()).player.quests['normal:a1q2'], 2);
      await travel(3);
    }
    for (const id of [4, 10, 5, 6]) { await travel(id); await clearArea(); }
    if ((await guard()).player.level < 10) {
      evidence.detours.push('Countess for earned XP');
      for (const id of [20, 21, 22, 23, 24, 25]) { await travel(id); await clearArea(); }
      assert.equal((await guard()).player.quests['normal:a1q4'], 3);
      for (const id of [24, 23, 22, 21, 20, 6]) await travel(id);
    }
    for (const id of [7, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36]) { await travel(id); await clearArea(); }
    await serviceTown('prepare for actual Andariel combat');
    await travel(37);
    stage = 'Andariel: real LOS combat, XP and objective';
    assert.ok((await guard()).monsters.some(m => m.code === 'andariel' && !m.dead), 'Andariel must be alive on arrival');
    await clearArea();
    const killed = await guard();
    assert.equal(andyKilled, true, 'Must observe an actual living-to-dead Andy transition');
    assert.ok(killed.monsters.find(m => m.code === 'andariel')?.dead);
    assert.equal(killed.player.quests['normal:a1q6'], 2);
    assert.equal(killed.player.unlockedActs, 1, 'Andy death alone must not unlock east travel');
    assert.ok(evidence.xpFromKills > 0 && killed.player.experience > 0);
    assert.ok(evidence.goldPicked > 0 && evidence.sold > 0, 'Actual drops/gold and UI sales fund progression');
    assert.ok(Object.keys(evidence.bought).some(code => /^hp[1-5]$/.test(code)) && Object.keys(evidence.bought).some(code => /^mp[1-5]$/.test(code)), 'Buy real health and mana potions from Akara');
    assert.ok(Object.keys(evidence.drank).some(code => /^hp[1-5]$/.test(code)) && Object.keys(evidence.drank).some(code => /^mp[1-5]$/.test(code)), 'Both health/mana belt potions must actually be consumed');
    assert.ok(evidence.equipped.some(item => item.source === 'drop'), 'Must equip at least one genuine dropped upgrade; RNG failure is not a skipped pass');
    assert.equal(repeatedHeldCast, true, 'A native right mouse/touch hold must produce repeated real casts');
    assert.ok(evidence.learned[36] > 0 && evidence.learned[37] > 0, 'Fire Bolt/Warmth hard points come from earned levels/reward');
    assert.ok(killed.player.vitality > starter.player.vitality && killed.player.energy > starter.player.energy);
    if (mobile) assert.equal(simultaneous, true, 'Native CDP simultaneous joystick/cast must really work');
    await shot('andariel-killed');
    stage = 'actual Warriv reward and east travel';
    // Use a scroll, discovered waypoint, or walked exits; never load to get home.
    servicing = true;
    try {
      if (portalCount(killed.player)) {
        await activate(page.getByRole('button', { name: '回城', exact: true }));
        const portal = await objectWhere(o => o.kind === 'portal' && o.targetArea === 1);
        await nearAction(portal.uid);
        await page.waitForFunction(() => window.sanctuary.engine.state.area.def.id === 1);
        await rendered();
      } else for (const id of routeBetween(37, 1)) await travel(id);
    } finally { servicing = false; }
    await talk('warriv');
    const handIn = await guard();
    assert.equal(handIn.player.quests['normal:a1q6'], 3); assert.equal(handIn.player.unlockedActs, 2);
    await activate(page.getByRole('button', { name: '向东旅行 · 鲁高因', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.area.def.id === 40);
    await rendered(); await shot('act2-unlocked');

    stage = 'UI save, refresh, same character ID/XP/equipment';
    await closePanel();
    const beforeSave = persistence(await guard());
    await activate(page.locator('.save-button'));
    await page.waitForFunction(id => {
      const s = window.sanctuary.engine.state;
      return s.saved && !s.loadingSave && s.characters.some(character => character.id === id);
    }, characterId);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await activate(page.getByRole('button', { name: '开始游戏', exact: true }));
    await page.waitForFunction(() => window.sanctuary.engine.state.storageStatus === 'ready');
    assert.equal(await page.locator('.character-save').count(), 1, 'Only the isolated test character exists after refresh');
    await activate(page.locator(`.character-save[data-save-id="${characterId}"]`));
    await activate(page.getByRole('button', { name: '进入', exact: true }));
    await rendered();
    const reloaded = await guard();
    assert.equal(reloaded.area.id, 40, 'Reload starts in legitimately unlocked Act II town');
    assert.deepEqual(persistence(reloaded), beforeSave, 'Save/refresh preserves ID, XP, gold, gear, inventory, belt, build and quests');
    assert.equal(reloaded.id, characterId);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'No viewport overflow');
    await shot('saved-reloaded');
    stage = 'PASS';
    const result = { platform: label, viewport: mobile ? '390x844 DPR2 native CDP touch' : '1440x900 mouse/WASD', status: 'PASS', id: characterId, level: reloaded.player.level, xp: reloaded.player.experience, gold: reloaded.player.gold, elapsedSeconds: Math.round((Date.now() - started) / 1000), actions, evidence, questsAsserted: ['normal:a1q1', 'normal:a1q6'], limitations: ['Cain and Malus unimplemented; no six-quest completion claim', 'Generic boss AI, original compact maps, advisory gear scoring', 'No original-client numerical/performance/art parity claim', 'World/maps are intentionally regenerated by the normal UI load; only character persistence asserted'] };
    console.log(JSON.stringify(result));
    return result;
  } catch (error) {
    let current = null;
    try { current = await state(); } catch (readError) { current = { readError: readError.message }; }
    const failure = { platform: label, status: 'BLOCKED', stage, reason: error.message, elapsedSeconds: Math.round((Date.now() - started) / 1000), actions, serviceCount, evidence, errors, current };
    console.error(JSON.stringify(failure));
    try { await shot('blocked'); } catch (screenshotError) { console.error(`Failure screenshot unavailable: ${screenshotError.message}`); }
    throw new Error(`${label} Act I BLOCKED at ${stage}: ${error.message}`, { cause: error });
  } finally { await context.close(); }
}
try {
  const results = [], failures = [];
  for (const mobile of platform === 'both' ? [false, true] : [platform === 'touch']) {
    try { results.push(await run(mobile)); }
    catch (error) { failures.push(error); }
  }
  if (failures.length) throw new AggregateError(failures, failures.map(error => error.message).join('; '));
  assert.equal(results.length, platform === 'both' ? 2 : 1);
  console.log(`Act I honest UI progression PASS (${results.map(result => result.platform).join(', ')}); isolated ephemeral contexts only.`);
} finally { await browser.close(); }
