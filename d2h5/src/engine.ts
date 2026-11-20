import type { Action, AreaState, Control, Difficulty, Element, GameEvent, GameState, Item, Monster, Player, Point, Projectile, Rng, Slot, WorldObject } from './types';
import { CLASSES, EXPERIENCE, getClass, getSkill, num, rawRows } from './catalog';
import { allocateSkill, allocateStat, blockChance, createPlayer, deriveStats, grantExperience, hitChance, leechAmount, manaRegeneration, skillEffect, skillLevel, getShrine, setTemporaryShrine } from './rules';
import { allowedSockets, consumeInventoryPotion, consumePotion, createItem, createStartingItems, describeItem, equipItem, fillTome, GEMS, getBase, insertSocket, itemSellPrice, INVENTORY_HEIGHT, INVENTORY_WIDTH, isUsableItem, itemLabel, moveInventoryItem, placeItem, repairItems, rollLoot, STASH_HEIGHT, STASH_WIDTH, transmute, unequipItem, vendorStock } from './items';
import { SURFACE_IDS, canTravel, containsRegion, createArea, createSurfaceWorld, getArea, getConnections, getSurfaceRegion, hasLineOfSight, isTownPoint, onEnterArea, onKill, questKey, surfaceRegionAt, talkNPC, townForAct } from './world';

import { COMBAT_HZ, DIFFICULTY_RULES, lifeBits, rollDamageBits, settleDirectDamage } from './combat';
import type { DamageComponent } from './combat';
import { gamblingCost, gamblingStock, refillGamblingOffer } from './gambling';
import { LEGACY_CHARACTER_ID } from './storage';
import type { SaveRecord, SaveStore } from './storage';
export const FPS = COMBAT_HZ;
export const ENGINE_LIMITATIONS = [
  '当前战斗碰撞、怪物 AI 和攻击动画是自主实现，未达到原版服务器函数级一致。',
  '战役任务仅以 world 模块已实现的触发器为准，不能以区域数量认定完整五幕。',
  '暂未提供联机、永久死亡、复杂持续伤害和全部历史 bug。',
];

// 雇佣兵基础属性表：[名称, 生命/级, 伤害基础/级, 攻击速度帧]
const MERC_STATS: Record<string, {baseName: string; lifeBase: number; lifePerLevel: number; dmgBase: number; dmgPerLevel: number; swingFrames: number; range: number}> = {
  'rogue-fire':   {baseName: '火焰箭罗格',   lifeBase: 45, lifePerLevel: 7,  dmgBase: 5,  dmgPerLevel: 2, swingFrames: 20, range: 7},
  'rogue-cold':   {baseName: '冰霜箭罗格',   lifeBase: 45, lifePerLevel: 7,  dmgBase: 5,  dmgPerLevel: 2, swingFrames: 20, range: 7},
  'desert-guard': {baseName: '沙漠卫士',     lifeBase: 60, lifePerLevel: 10, dmgBase: 8,  dmgPerLevel: 3, swingFrames: 16, range: 1.3},
  'iron-wolf':    {baseName: '铁狼',         lifeBase: 50, lifePerLevel: 8,  dmgBase: 6,  dmgPerLevel: 2, swingFrames: 18, range: 1.3},
  'barbarian':    {baseName: '野蛮人佣兵',   lifeBase: 70, lifePerLevel: 12, dmgBase: 10, dmgPerLevel: 4, swingFrames: 14, range: 1.3},
};

function mercMaxLife(type: string, level: number): number {
  const s = MERC_STATS[type] ?? MERC_STATS['desert-guard'];
  return s.lifeBase + s.lifePerLevel * level;
}

function mercDamage(type: string, level: number): {min: number; max: number} {
  const s = MERC_STATS[type] ?? MERC_STATS['desert-guard'];
  const base = s.dmgBase + s.dmgPerLevel * level;
  return {min: Math.max(1, base), max: Math.max(2, Math.floor(base * 1.5))};
}

function mercElement(type: string): import('./types').Element {
  if (type === 'rogue-fire') return 'fire';
  if (type === 'rogue-cold') return 'cold';
  return 'physical';
}

export function seededRandom(seed: number): Rng {
  let value = seed >>> 0 || 1;
  return () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 4294967296; };
}
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const isWalkable = (area: AreaState, x: number, y: number) => x >= 0 && y >= 0 && x < area.width && y < area.height && area.tiles[Math.floor(y)]?.[Math.floor(x)] === 0;

export function findPath(area: AreaState, from: Point, to: Point): Point[] {
  const sx = Math.floor(from.x), sy = Math.floor(from.y), tx = Math.floor(to.x), ty = Math.floor(to.y);
  if (!isWalkable(area, tx, ty)) return [];
  const start = sy * area.width + sx, goal = ty * area.width + tx;
  if (start === goal) return [{x: to.x, y: to.y}];
  const queue = [start], previous = new Map<number, number>([[start, -1]]);
  for (let i = 0; i < queue.length; i++) {
    const current = queue[i];
    if (current === goal) break;
    const x = current % area.width, y = Math.floor(current / area.width);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!isWalkable(area, nx, ny) || (dx && dy && (!isWalkable(area, x + dx, y) || !isWalkable(area, x, y + dy)))) continue;
      const key = ny * area.width + nx;
      if (!previous.has(key)) { previous.set(key, current); queue.push(key); }
    }
  }
  if (!previous.has(goal)) return [];
  const path: Point[] = [];
  let key = goal;
  while (key !== start) { path.push({x: key % area.width + .5, y: Math.floor(key / area.width) + .5}); key = previous.get(key)!; }
  path.reverse();
  path[path.length - 1] = {x: to.x, y: to.y};
  return path;
}

export function validSave(value: unknown): value is { version: number; player: Player; seed: number } {
  if (!value || typeof value !== 'object') return false;
  const save = value as {version?: number; player?: Player; seed?: number};
  const p = save.player;
  return save.version === 1 && Number.isInteger(save.seed) && !!p && CLASSES.some(c => c.id === p.classId)
    && typeof p.name === 'string' && p.name.length > 0 && p.name.length <= 24
    && Number.isInteger(p.level) && p.level >= 1 && p.level <= 99
    && Number.isFinite(p.experience) && p.experience >= 0
    && Number.isFinite(p.life) && Number.isFinite(p.mana) && Number.isFinite(p.gold) && p.gold >= 0
    && ['strength', 'dexterity', 'vitality', 'energy', 'statPoints', 'skillPoints', 'unlockedActs', 'unlockedDifficulties', 'bonusLife', 'bonusResist', 'stamina'].every(k => Number.isFinite((p as unknown as Record<string, number>)[k]) && (p as unknown as Record<string, number>)[k] >= 0)
    && ['normal', 'nightmare', 'hell'].includes(p.difficulty)
    && Array.isArray(p.inventory) && Array.isArray(p.stash) && Array.isArray(p.cube) && Array.isArray(p.belt)
    && !!p.equipment && typeof p.equipment === 'object' && !!p.skills && !!p.quests && Array.isArray(p.waypoints)
    && Object.values(p.skills).every(v => Number.isInteger(v) && v >= 0 && v <= 20)
    && Object.values(p.quests).every(Number.isFinite)
    && (!p.corpse || (Number.isInteger(p.corpse.areaId) && Number.isFinite(p.corpse.x) && Number.isFinite(p.corpse.y) && !!p.corpse.equipment && typeof p.corpse.equipment === 'object'))
    && [...p.inventory, ...p.stash, ...p.cube, ...p.belt.filter(Boolean), ...Object.values(p.equipment), ...Object.values(p.corpse?.equipment ?? {})].every(i => !!i && typeof i.uid === 'string' && typeof i.code === 'string' && !!getBase(i.code) && Number.isInteger(i.width) && i.width > 0 && Number.isInteger(i.height) && i.height > 0 && typeof i.name === 'string' && ['low', 'normal', 'superior', 'magic', 'rare', 'set', 'unique', 'crafted'].includes(i.quality) && ['price', 'quantity', 'ilvl', 'minDamage', 'maxDamage', 'defense', 'durability', 'maxDurability', 'requiredLevel', 'sockets'].every(k => Number.isFinite((i as unknown as Record<string, number>)[k]) && (i as unknown as Record<string, number>)[k] >= 0) && Number.isInteger(i.x) && Number.isInteger(i.y) && typeof i.identified === 'boolean' && typeof i.ethereal === 'boolean' && Array.isArray(i.socketed) && i.socketed.every(c => typeof c === 'string') && !!i.mods && Object.values(i.mods).every(Number.isFinite));
}

export class Engine {
  readonly state: GameState = {
    screen: 'intro', player: null, area: null, stats: null, panel: 'none', projectiles: [], effects: [], summons: [],
    characters: [], activeSaveId: null, storageStatus: 'loading', storageError: '', loadingSave: false, savingAndExiting: false,
    messages: [], tick: 0, seed: Date.now() >>> 0, paused: false, automap: false, showLoot: false, target: null,
    selectedMonster: null, selectedItem: null, identifySource: null, npc: null, vendorItems: [], gamblingOffers: [], dialogue: '', saved: false,
    events: [], eventSeq: 0, facing: Math.PI * .75, moving: false,
  };
  readonly control: Control = {move: {x: 0, y: 0}, aim: null, aimMonster: null, left: false, right: false};
  private alertedMonsters = new WeakSet<Monster>();
  private meleeSwings = new WeakMap<Monster, number>();
  private rewardedMonsters = new WeakSet<Monster>();
  private rng: Rng = seededRandom(this.state.seed);
  private path: Point[] = [];
  private cooldown = 0;
  private runtimeRevision = 0;
  private runningThisFrame = false;
  private attackTarget: {point: Point; right: boolean; monster?: string} | null = null;
  private pendingInteraction: {uid: string; pickup: boolean} | null = null;
  private regeneration: {life: number; mana: number; frames: number}[] = [];
  private areas = new Map<number, AreaState>();
  private portal: {areaId: number; point: Point; townId: number; sourceUid: string; townUid: string} | null = null;
  private aura: {skillId: number; next: number} | null = null;
  private npcServices: string[] = [];
  private vendorStocks = new Map<string, Item[]>();
  private gamblingNpcUid: string | null = null;
  private saving: Promise<void> = Promise.resolve();
  private deletingSaveId: string | null = null;
  constructor(private readonly store?: SaveStore) {}
  async initialize(legacy?: string) {
    if (!this.store) { this.state.storageStatus = 'error'; this.state.storageError = '浏览器不支持 IndexedDB，无法保存角色。'; return; }
    try {
      if (legacy) {
        let parsed: unknown;
        try { parsed = JSON.parse(legacy); } catch { parsed = null; }
        if (validSave(parsed)) {
          await this.store.importLegacy({id: LEGACY_CHARACTER_ID, version: 1, player: parsed.player, seed: parsed.seed, timestamp: Date.now()});
        } else this.state.storageError = '旧 localStorage 存档损坏或版本不兼容，原数据已保留，未导入。';
      }
      await this.refreshCharacters();
      this.state.storageStatus = 'ready';
    } catch {
      this.state.storageStatus = 'error'; this.state.storageError = '无法打开 IndexedDB，请检查浏览器存储空间、隐私设置或其他页面。';
    }
  }
  private async refreshCharacters() {
    const saves = await this.store!.list();
    this.state.characters = saves.filter(s => validSave(s) && typeof s.id === 'string' && Number.isFinite(s.timestamp))
      .sort((a, b) => b.timestamp - a.timestamp || a.id.localeCompare(b.id))
      .map(s => ({id: s.id, name: s.player.name, classId: s.player.classId, level: s.player.level, difficulty: s.player.difficulty, timestamp: s.timestamp}));
  }
  setControl(next: Partial<Control>, press?: boolean) {
    const c = this.control, wasHeld = c.left || c.right, s = this.state;
    Object.assign(c, next);
    if (next.move) { const len = Math.hypot(c.move.x, c.move.y); c.move = len > 1 ? {x: c.move.x / len, y: c.move.y / len} : {x: c.move.x || 0, y: c.move.y || 0}; }
    if (wasHeld && !c.left && !c.right) {
      if (this.attackTarget && !this.pendingInteraction) this.path = [];
      this.attackTarget = null;
    }
    if (press === undefined || !(press ? c.right : c.left && !c.right) || !c.aim || this.cooldown > 0 || s.screen !== 'game' || !s.player || !s.area || !s.stats || s.player.dead || s.paused || s.panel !== 'none') return;
    if (s.area.def.town) { this.message('营地内不能使用攻击技能，请先前往野外。', 'error'); return; }
    this.pendingInteraction = null;
    this.aimAttack(press, Math.hypot(c.move.x, c.move.y) > .05);
    this.tryAttack();
  }
  private event(actor: string, kind: GameEvent['kind'], from: Point, to: Point = from, element: Element = 'physical') {
    const st = this.state;
    st.events.push({seq: ++st.eventSeq, tick: st.tick, actor, kind, x: from.x, y: from.y, tx: to.x, ty: to.y, element});
    if (st.events.length > 64) st.events.shift();
  }
  message(text: string, kind: 'info' | 'loot' | 'error' = 'info') {
    const last = this.state.messages[this.state.messages.length - 1];
    if (last && last.text === text && this.state.tick - last.time < FPS) return;
    this.state.messages.push({text, time: this.state.tick, kind});
    if (this.state.messages.length > 30) this.state.messages.shift();
  }
  private id(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }
  private updateStats(adjust = false) {
    const p = this.state.player;
    if (!p) return;
    const old = this.state.stats;
    this.state.stats = deriveStats(p);
    if (adjust && old && !p.dead) { p.life += Math.max(0, this.state.stats.maxLife - old.maxLife); p.mana += Math.max(0, this.state.stats.maxMana - old.maxMana); }
    p.life = Math.max(0, Math.min(p.life, this.state.stats.maxLife));
    p.mana = Math.max(0, Math.min(p.mana, this.state.stats.maxMana));
    p.stamina = Math.max(0, Math.min(p.stamina, this.state.stats.maxStamina));
  }
  private resetRuntime() {
    this.runtimeRevision++;
    this.path = []; this.attackTarget = null; this.pendingInteraction = null; this.cooldown = 0; this.meleeSwings = new WeakMap(); this.runningThisFrame = false; this.state.events = []; this.state.moving = false;
    this.regeneration = []; this.aura = null; this.state.projectiles = []; this.state.effects = []; this.state.summons = [];
    this.state.target = null; this.state.selectedMonster = null; this.state.selectedItem = null; this.state.identifySource = null; this.state.panel = 'none';
    this.state.npc = null; this.state.vendorItems = []; this.state.gamblingOffers = []; this.gamblingNpcUid = null; this.state.dialogue = ''; this.npcServices = [];
  }
  private cachedArea(id: number): AreaState {
    const cached = this.areas.get(id);
    if (cached) return cached;
    const p = this.state.player!;
    if (SURFACE_IDS.some(surfaceId => surfaceId === id)) {
      const world = createSurfaceWorld(p.difficulty,this.state.seed,p);
      for (const surfaceId of SURFACE_IDS) this.areas.set(surfaceId,world);
      return world;
    }
    const area = createArea(id,p.difficulty,(this.state.seed ^ id * 2654435761) >>> 0,p);
    this.areas.set(id,area);
    return area;
  }
  private regionMessage(from?: number) {
    const p=this.state.player!,area=this.state.area!;
    if (area.def.town && from !== area.def.id) {
      this.vendorStocks.clear();
      this.state.vendorItems = [];
    }
    for (const text of onEnterArea(p,area)) this.message(text);
    this.reveal();
    this.message(`${area.def.name} · ${p.difficulty === 'normal' ? '普通' : p.difficulty === 'nightmare' ? '噩梦' : '地狱'}`);
  }
  private updateSurfaceRegion() {
    const p=this.state.player,area=this.state.area;
    if (!p || !area) return;
    const region=surfaceRegionAt(area,p);
    if (!region || region.def.id===area.def.id) return;
    const from = area.def.id;
    this.state.identifySource = null;
    area.def=region.def;area.spawn=region.spawn;
    this.regionMessage(from);
  }
  private validTravelPoint(area: AreaState, id: number, point: Point, from?: Point) {
    return isWalkable(area,point.x,point.y)
      && (area.regions ? surfaceRegionAt(area,point)?.def.id===id : area.def.id===id)
      && (!from || (isWalkable(area,from.x,from.y) && findPath(area,from,point).length>0));
  }
  private syncCorpse(area: AreaState) {
    const p=this.state.player!,corpse=p.corpse;
    if (!corpse) return;
    const region=getSurfaceRegion(area,corpse.areaId);
    if (!region && (area.regions || area.def.id!==corpse.areaId)) return;
    if (region && !containsRegion(region,corpse) && !this.validTravelPoint(area,corpse.areaId,corpse)) {
      // Version-1 local points migrate once, never rerolling or replacing equipment.
      const local=createArea(corpse.areaId,p.difficulty,region.seed,p);
      if (isWalkable(local,corpse.x,corpse.y)) {corpse.x+=region.x;corpse.y+=region.y;}
    }
    const spawn=region?.spawn ?? area.spawn;
    if (!this.validTravelPoint(area,corpse.areaId,corpse,spawn)) {corpse.x=spawn.x;corpse.y=spawn.y;}
    const object=area.objects.find(o=>o.kind==='corpse');
    if (object) {object.x=corpse.x;object.y=corpse.y;object.regionId=corpse.areaId;}
    else area.objects.push({uid:this.id('corpse'),kind:'corpse',name:`${p.name} 的尸体`,x:corpse.x,y:corpse.y,regionId:corpse.areaId});
  }
  private enterArea(id: number, position?: Point, atSpawn = false, sourceId?: number) {
    const p = this.state.player;
    if (!p) return;
    const from = sourceId ?? this.state.area?.def.id;
    this.resetRuntime();
    const area = this.cachedArea(id),region=getSurfaceRegion(area,id);
    if (region) {area.def=region.def;area.spawn=region.spawn;}
    this.state.area = area;
    this.syncCorpse(area);
    const inTarget = (point: Point) => this.validTravelPoint(area,id,point,area.spawn);
    const back = !position && !atSpawn && from !== undefined ? area.objects.find(o => (o.kind === 'exit' || o.kind === 'portal') && o.targetArea === from && (!region || o.regionId===id) && inTarget(o)) : undefined;
    if (back) {
      const dx = (region ? region.x+region.width/2 : area.width/2) - back.x, dy = (region ? region.y+region.height/2 : area.height/2) - back.y, len = Math.hypot(dx, dy) || 1;
      for (const r of [2.2, 1.6, 1.1, 3]) {
        const x = back.x + .5 + dx / len * r, y = back.y + .5 + dy / len * r;
        if (inTarget({x,y})) { position = {x, y}; break; }
      }
    }
    const landing = position && inTarget(position) ? position : area.spawn;
    p.x = landing.x; p.y = landing.y;
    this.state.screen = 'game'; this.state.paused = false;
    if (p.mercenary && p.mercenary.life > 0) { p.mercenary.x = landing.x + 1; p.mercenary.y = landing.y; }
    this.regionMessage(from);
  }
  private reveal() {
    const {player: p, area} = this.state;
    if (!p || !area) return;
    const radius = 10;
    for (let y = Math.max(0, Math.floor(p.y) - radius); y < Math.min(area.height, Math.ceil(p.y) + radius); y++)
      for (let x = Math.max(0, Math.floor(p.x) - radius); x < Math.min(area.width, Math.ceil(p.x) + radius); x++)
        if (Math.hypot(x - p.x, y - p.y) <= radius) area.revealed[y][x] = true;
  }
  dispatch = (action: Action): void => {
    if (this.state.savingAndExiting) return;
    if (action.type === 'save-and-title') { void this.saveAndReturnToTitle(); return; }
    if (action.type === 'cancel-identify') { this.state.identifySource = null; return; }
    if (action.type === 'creation') { if (!this.state.loadingSave) { this.state.identifySource = null; this.state.screen = 'creation'; } return; }
    if (action.type === 'new') {
      if (this.state.loadingSave || (this.store && this.state.storageStatus !== 'ready')) return;
      const name = action.name.trim().slice(0, 24);
      if (!name || !CLASSES.some(c => c.id === action.classId)) { this.message('请选择职业并输入角色名。', 'error'); return; }
      this.clearShrineBuff();
      this.state.seed = Date.now() >>> 0; this.rng = seededRandom(this.state.seed); this.areas.clear(); this.vendorStocks.clear(); this.portal = null;
      this.state.messages = []; this.state.activeSaveId = this.id('character'); this.state.saved = false;
      this.state.player = createPlayer(action.classId, name); createStartingItems(this.state.player);
      this.updateStats(); this.enterArea(1, undefined, true); this.message('前往鲜血荒地的邪恶洞窟，消灭所有怪物后向阿卡拉领取奖励。'); this.save(); return;
    }
    if (action.type === 'continue') { void this.load(action.id); return; }
    if (action.type === 'delete-character') { void this.deleteCharacter(action.id); return; }
    if (action.type === 'title') {
      if (this.state.loadingSave) return;
      if (this.state.screen === 'game') void this.save(false);
      this.state.identifySource = null; this.state.gamblingOffers = []; this.gamblingNpcUid = null; this.state.screen = 'title'; this.state.paused = true; return;
    }
    const p = this.state.player, area = this.state.area;
    if (!p || !area || this.state.screen !== 'game') return;
    if (action.type === 'save') { this.save(); return; }
    if (action.type === 'panel') {
      if (action.panel === 'gamble') return;
      this.state.identifySource = null; this.state.gamblingOffers = []; this.gamblingNpcUid = null;
      this.state.panel = this.state.panel === action.panel ? 'none' : action.panel; return;
    }
    if (action.type === 'pause') { this.state.paused = !this.state.paused; return; }
    if (action.type === 'map') { this.state.automap = !this.state.automap; return; }
    if (action.type === 'loot') { this.state.showLoot = !this.state.showLoot; return; }
    if (action.type === 'respawn') { this.respawn(); return; }
    if (p.dead) return;
    if (this.state.paused && ['move', 'attack', 'interact', 'pickup', 'potion', 'use-item', 'move-item', 'fill-tome', 'portal', 'travel', 'swap'].includes(action.type)) return;
    switch (action.type) {
      case 'move':
        if (!Number.isFinite(action.point.x) || !Number.isFinite(action.point.y)) break;
        this.path = findPath(area, p, action.point); this.state.target = action.point; this.attackTarget = null; this.pendingInteraction = null; break;
      case 'attack': {
        if (area.def.town) { this.message('营地内不能使用攻击技能。', 'error'); break; }
        if (!Number.isFinite(action.point.x) || !Number.isFinite(action.point.y)) break;
        const m = area.monsters.filter(m => !m.dead && distance(m, action.point) < 1.5).sort((a, b) => distance(a, action.point) - distance(b, action.point))[0];
        this.state.selectedMonster = m?.uid ?? null;
        this.attackTarget = {point: action.point, right: !!action.right, monster: m?.uid}; this.pendingInteraction = null;
        this.tryAttack(); break;
      }
      case 'interact': this.interact(action.uid); break;
      case 'pickup': this.pickup(action.uid); break;
      case 'stat': if (allocateStat(p, action.stat)) this.updateStats(true); break;
      case 'learn': { const result = allocateSkill(p, action.skillId); this.message(result.message, result.ok ? 'info' : 'error'); this.updateStats(true); break; }
      case 'bind': {
        const skill = getSkill(action.skillId);
        if (action.skillId !== 0 && (!skill?.supported || skillLevel(p, action.skillId) <= 0)) { this.message('技能未获得或特殊行为尚未实现。', 'error'); break; }
        if (action.right) p.rightSkill = action.skillId; else p.leftSkill = action.skillId;
        if (this.aura?.skillId !== p.rightSkill) this.aura = null;
        break;
      }
      case 'equip': { const r = equipItem(p, action.uid); this.message(r.message, r.ok ? 'info' : 'error'); this.updateStats(); break; }
      case 'unequip': { const r = unequipItem(p, action.slot); this.message(r.message, r.ok ? 'info' : 'error'); this.updateStats(); break; }
      case 'swap': p.weaponSwap = !p.weaponSwap; this.updateStats(); this.message(`切换武器组 ${p.weaponSwap ? 'II' : 'I'}`); break;
      case 'drop': { const i = p.inventory.findIndex(i => i.uid === action.uid); if (i >= 0) { const [item] = p.inventory.splice(i, 1); area.drops.push({item, x: p.x, y: p.y}); this.updateStats(); } break; }
      case 'potion': this.drink(action.column); break;
      case 'use-item': this.useItem(action.uid, action.targetUid); break;
      case 'move-item': { const r = moveInventoryItem(p, action.uid, action.x, action.y); if (!r.ok) this.message(r.message, 'error'); break; }
      case 'fill-tome': {
        const r = fillTome(p, action.uid, action.tomeUid);
        this.message(r.message, r.ok ? 'info' : 'error');
        if (!r.ok) return;
        this.state.selectedItem = action.tomeUid;
        if (this.state.identifySource === action.uid && !p.inventory.some(i => i.uid === action.uid)) this.state.identifySource = null;
        break;
      }
      case 'heal': if (area.def.town && this.npcServices.includes('heal')) { p.life = this.state.stats!.maxLife; p.mana = this.state.stats!.maxMana; p.stamina = this.state.stats!.maxStamina; this.regeneration = []; this.message('生命和法力已恢复。'); } break;
      case 'identify': this.identify(action.uid); break;
      case 'buy': this.buy(action.uid); break;
      case 'gamble-open': this.openGambling(); break;
      case 'gamble-refresh': if (this.gamblingContext()) this.state.gamblingOffers = gamblingStock(p.level, this.rng); break;
      case 'gamble-buy': this.gamble(action.uid); break;
      case 'sell': this.sell(action.uid); break;
      case 'repair': if (area.def.town && this.npcServices.includes('repair')) { const r = repairItems(p); this.message(r.message, r.ok ? 'info' : 'error'); this.updateStats(); } break;
      case 'storage': this.storage(action.uid, action.destination); break;
      case 'socket': { const r = insertSocket(p, action.itemUid, action.runeUid); this.message(r.message, r.ok ? 'info' : 'error'); this.updateStats(); break; }
      case 'transmute': {
        if (!p.inventory.some(i => i.code === 'box')) { this.message('需要先在第二幕取得赫拉迪克方块。', 'error'); break; }
        const r = transmute(p); this.message(r.message, r.ok ? 'info' : 'error'); this.updateStats();
        if (r.ok && r.enterArea) this.enterArea(r.enterArea);
        break;
      }
      case 'portal': this.openPortal(); break;
      case 'travel': {
        const exit = area.objects.find(o => o.kind === 'exit' && o.targetArea === action.areaId && distance(o, p) <= 2);
        if (exit && getConnections(p, exit.regionId ?? area.def.id).includes(action.areaId)) { this.interact(exit.uid); break; }
        if (area.def.town && this.state.npc === 'warriv' && action.areaId === 40 && p.unlockedActs >= 2) { this.enterArea(40); break; }
        const waypoint = area.objects.find(o => o.kind === 'waypoint' && distance(o, p) < 3);
        if (!waypoint || !canTravel(p, action.areaId)) { this.message('必须站在传送点旁，且目的地已经激活。', 'error'); break; }
        this.enterArea(action.areaId, undefined, true); break;
      }
      case 'run': p.running = !p.running; break;
      case 'respec': this.respec(); break;
      case 'difficulty': this.changeDifficulty(action.difficulty); break;
      case 'hire-merc': this.hireMerc(action.mercType); break;
      case 'resurrect-merc': this.resurrectMerc(); break;
      case 'merc-equip': this.mercEquip(action.uid); break;
      case 'merc-unequip': this.mercUnequip(action.slot); break;
      case 'imbue': {
        const qk = questKey(p, 'a1q5');
        if ((p.quests[qk] ?? 0) !== 3) { this.message('需要先从恰西处领取注入权限。', 'error'); break; }
        if (p.quests[`${p.difficulty}:imbueDone`]) { this.message('本难度的注入权限已使用。', 'error'); break; }
        const containers = [p.inventory, ...Object.values(p.equipment).filter((v): v is Item[] => Array.isArray(v))];
        const item = [...p.inventory, ...Object.values(p.equipment).filter((v): v is Item => !!v && !Array.isArray(v) && typeof (v as Item).code === 'string')]
          .find(i => i.uid === action.itemUid);
        if (!item) { this.message('找不到该物品。', 'error'); break; }
        const base = getBase(item.code);
        if (!base?.slot) { this.message('只能注入可装备的物品。', 'error'); break; }
        if (!['normal', 'magic', 'superior', 'low'].includes(item.quality)) { this.message('只能注入普通/魔法品质的物品。', 'error'); break; }
        const rare = createItem(item.code, item.ilvl, this.rng, 'rare');
        rare.uid = item.uid; rare.x = item.x; rare.y = item.y;
        const inInventory = p.inventory.findIndex(i => i.uid === action.itemUid);
        if (inInventory >= 0) { p.inventory[inInventory] = rare; }
        else {
          for (const [slot, equipped] of Object.entries(p.equipment)) {
            if (equipped && !Array.isArray(equipped) && (equipped as Item).uid === action.itemUid) {
              (p.equipment as Record<string, Item>)[slot] = rare; break;
            }
          }
        }
        p.quests[`${p.difficulty}:imbueDone`] = 1;
        this.updateStats(); this.message(`注入成功！${itemLabel(rare)}`);
        break;
      }
      case 'larzuk-socket': {
        const qk = questKey(p, 'a5q1');
        if ((p.quests[qk] ?? 0) !== 3) { this.message('需要先从拉苏克处领取镶孔权限。', 'error'); break; }
        if (p.quests[`${p.difficulty}:larzukDone`]) { this.message('本难度的镶孔服务已使用。', 'error'); break; }
        const item = p.inventory.find(i => i.uid === action.itemUid);
        if (!item) { this.message('找不到该物品（仅支持背包中的物品）。', 'error'); break; }
        const base = getBase(item.code);
        if (!base?.maxSockets) { this.message('此物品不能开凹槽。', 'error'); break; }
        if (item.sockets > 0) { this.message('此物品已有凹槽。', 'error'); break; }
        item.sockets = allowedSockets(base, item.ilvl);
        if (!item.sockets) { this.message('此物品等级过低，无法开凹槽。', 'error'); break; }
        p.quests[`${p.difficulty}:larzukDone`] = 1;
        this.updateStats(); this.message(`镶孔完成！物品现有 ${item.sockets} 个凹槽。`);
        break;
      }
      case 'open-cow-portal': {
        if ((p.quests[questKey(p, 'a5q6')] ?? 0) < 3) { this.message('须先通关当前难度（击杀巴尔）才能开启牛场传送门。', 'error'); break; }
        if (p.quests[`${p.difficulty}:cowPortal`]) { this.message('秘密奶牛场传送门已开启。', 'error'); break; }
        p.quests[`${p.difficulty}:cowPortal`] = 1;
        this.message('维兰的腿已被使用！秘密奶牛场传送门在罗格营地开启。');
        break;
      }
      case 'personalize': {
        if (p.quests[questKey(p, 'a5q4')] < 2) { this.message('需要先完成哈洛加斯的背叛任务。', 'error'); break; }
        if (p.quests[`${p.difficulty}:personalizeDone`]) { this.message('本难度的刻名服务已使用。', 'error'); break; }
        const item = [...p.inventory, ...Object.values(p.equipment).filter((v): v is Item => !!v && !Array.isArray(v) && typeof (v as Item).code === 'string')]
          .find(i => i.uid === action.itemUid);
        if (!item) { this.message('找不到该物品。', 'error'); break; }
        item.mods['internal:personalized'] = 1;
        item.durability = item.maxDurability;
        p.quests[`${p.difficulty}:personalizeDone`] = 1;
        p.quests[questKey(p, 'a5q4')] = 3;
        this.updateStats(); this.message(`刻名完成！${itemLabel(item)} 已刻上你的名字并修复。`);
        break;
      }
    }
    this.state.saved = false;
  };
  private findObjectPoint(uid: string, pickup = false): Point | undefined {
    const area = this.state.area!;
    return pickup ? area.drops.find(d => d.item.uid === uid) : area.objects.find(o => o.uid === uid);
  }
  private approach(uid: string, pickup: boolean): boolean {
    const p = this.state.player!, area = this.state.area!;
    const target = this.findObjectPoint(uid, pickup);
    if (!target) return false;
    if (distance(p, target) <= 2) return true;
    let bestPath: Point[] = [];
    for (let r = 0; r <= 1.5; r += .5)
      for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
        const dest = {x: target.x + dx, y: target.y + dy};
        if (!isWalkable(area, dest.x, dest.y)) continue;
        const candidate = findPath(area, p, dest);
        if (candidate.length && (!bestPath.length || candidate.length < bestPath.length)) bestPath = candidate;
      }
    this.path = bestPath;
    this.pendingInteraction = {uid, pickup}; this.attackTarget = null;
    if (!this.path.length) { this.pendingInteraction = null; this.message('无法到达该目标。', 'error'); }
    return false;
  }
  private interact(uid: string) {
    const seam = this.state.area!.objects.find(o=>o.uid===uid && o.kind==='exit' && o.seam);
    if (seam) {
      const p=this.state.player!,area=this.state.area!,source=seam.regionId ?? area.def.id,target=seam.targetArea;
      const back=area.objects.find(o=>o.kind==='exit' && o.seam && o.regionId===target && o.targetArea===source);
      if (target===undefined || !back || !getConnections(p,source).includes(target) || !getConnections(p,target).includes(source)) {this.message('这里的道路尚未开启。','error');return;}
      this.path=findPath(area,p,back);this.state.target={x:back.x,y:back.y};this.pendingInteraction=null;this.attackTarget=null;
      if (!this.path.length) this.message('无法到达该目标。','error');
      return;
    }
    if (!this.approach(uid, false)) return;
    const p = this.state.player!, area = this.state.area!, o = area.objects.find(o => o.uid === uid);
    if (!o) return;
    this.path = []; this.pendingInteraction = null;
    const sourceDef=getArea(o.regionId ?? area.def.id);
    switch (o.kind) {
      case 'exit': if (o.targetArea !== undefined && getConnections(p, sourceDef.id).includes(o.targetArea)) this.enterArea(o.targetArea,undefined,false,sourceDef.id); else this.message('这里的道路尚未开启。', 'error'); break;
      case 'npc': {
        this.state.identifySource = null;
        this.state.gamblingOffers = []; this.gamblingNpcUid = null;
        const result = talkNPC(p, o.npcId!); this.state.npc = o.npcId!; this.state.dialogue = result.message; this.npcServices = result.services;
        if (result.services.includes('trade')) {
          let stock = this.vendorStocks.get(o.npcId!);
          if (!stock) { stock = vendorStock(p, this.rng, o.npcId!); this.vendorStocks.set(o.npcId!, stock); }
          this.state.vendorItems = stock;
        } else this.state.vendorItems = [];
        this.state.panel = 'vendor';
        if (o.npcId === 'gheed' && result.services.includes('gamble')) this.openGambling();
        this.message(result.message); this.updateStats(true);
        if (o.npcId === 'akara' && sourceDef.town && isTownPoint(area, p) && result.services.includes('heal')) this.dispatch({ type: 'heal' });
        break;
      }
      case 'waypoint': this.state.identifySource = null; if (!p.waypoints.includes(sourceDef.id)) { p.waypoints.push(sourceDef.id); this.message(`已激活 ${sourceDef.name} 的传送点。`); } this.state.panel = 'waypoint'; break;
      case 'stash': this.state.identifySource = null; this.state.panel = 'stash'; break;
      case 'chest': if (!o.used) {
        o.used = true;
        // 特殊任务宝箱：赫拉迪克马勒斯（a1q5）
        if (o.name === '赫拉迪克马勒斯' && sourceDef.id === 28) {
          const qk = questKey(p, 'a1q5');
          if ((p.quests[qk] ?? 0) < 2) { p.quests[qk] = 2; this.message('你取回了赫拉迪克马勒斯！回到营地交给恰西领取奖励。'); }
        }
        // 特殊任务宝箱：蓝·依森的古书（a3q4）
        else if (o.name === '蓝·依森的古书' && sourceDef.id === 95) {
          const qk = questKey(p, 'a3q4');
          if ((p.quests[qk] ?? 0) < 2) { p.quests[qk] = 2; this.message('你找到了蓝·依森的古书！回到库拉斯特海港交给奥玛斯领取奖励。'); }
        } else {
          const choices = rawRows('weapons').filter(b => num(b, 'level') <= Math.max(1, p.level) && num(b, 'spawnable') === 1);
          const base = choices[Math.floor(this.rng() * choices.length)];
          const item = base ? createItem(String(base.code), Math.max(1, sourceDef.levels[0]), this.rng, this.rng() < .3 ? 'magic' : 'normal') : createItem('hp1', 1, this.rng);
          area.drops.push({item, x: o.x, y: o.y});
        }
        this.message('箱子打开了。');
      } break;
      case 'shrine': this.activateShrine(o); break;
      case 'portal': {
        const portal=this.portal;
        if (portal && o.uid===portal.sourceUid) this.enterArea(portal.townId,undefined,true);
        else if (portal && o.uid===portal.townUid) {this.enterArea(portal.areaId,portal.point);this.removePortal();}
        else if (o.targetArea !== undefined && getConnections(p,sourceDef.id).includes(o.targetArea)) this.enterArea(o.targetArea,undefined,false,sourceDef.id);
        break;
      }
      case 'corpse': this.recoverCorpse(); break;
    }
  }
  private clearShrineBuff() {
    if (this.state.player) setTemporaryShrine(this.state.player);
    this.state.shrineBuff = undefined;
    this.updateStats();
  }
  private advanceShrines() {
    const buff = this.state.shrineBuff;
    if (buff && --buff.frames <= 0) { this.clearShrineBuff(); this.message(`${buff.name}的祝福已消退。`); }
    // Cached areas keep charging during active play, including while elsewhere.
    for (const area of new Set([...this.areas.values(), this.state.area!])) for (const object of area.objects) {
      if (object.kind === 'shrine' && object.used && object.shrineReadyTick !== undefined && this.state.tick >= object.shrineReadyTick) {
        object.used = false; delete object.shrineReadyTick;
      }
    }
  }
  private activateShrine(object: WorldObject) {
    const p = this.state.player!, area = this.state.area!, shrine = getShrine(object.shrineCode ?? 1);
    if (!shrine || !hasLineOfSight(area, p, object)) return;
    if (object.used && (object.shrineReadyTick === undefined || this.state.tick < object.shrineReadyTick)) {
      this.message(object.shrineReadyTick === undefined ? '神龛的力量已经耗尽。' : `神龛正在充能，还需 ${Math.ceil((object.shrineReadyTick - this.state.tick) / FPS)} 秒。`);
      return;
    }
    object.used = true;
    if (shrine.resetFrames) object.shrineReadyTick = this.state.tick + shrine.resetFrames;
    if (shrine.duration) {
      setTemporaryShrine(p, shrine.code);
      this.state.shrineBuff = {code: shrine.code, name: shrine.name, frames: shrine.duration};
      this.updateStats();
    }
    let result: string;
    switch (shrine.code) {
      case 1:
        p.life = Math.min(this.state.stats!.maxLife, p.life + this.state.stats!.maxLife * shrine.arg0 / 100);
        p.mana = Math.min(this.state.stats!.maxMana, p.mana + this.state.stats!.maxMana * shrine.arg1 / 100);
        result = '生命和法力已恢复'; break;
      case 6: result = `防御 +${shrine.arg0}%`; break;
      case 7: result = `攻击准确率 +${shrine.arg0}%，物理伤害 +${shrine.arg1}%`; break;
      case 8: case 9: case 10: case 11: result = `对应抗性 +${shrine.arg0}%（仍受抗性上限限制）`; break;
      case 12: result = `已获得且支持的技能 +${shrine.arg0} 级`; break;
      case 13: result = `法力回复速度 +${shrine.arg0}%`; break;
      case 14: p.stamina = this.state.stats!.maxStamina; result = '耐力充满且奔跑不消耗耐力'; break;
      case 15: result = `击杀经验 +${shrine.arg0}%`; break;
      case 17: this.createTownPortal(); result = '回城传送门开启（不消耗卷轴）'; break;
      case 18: result = this.upgradeShrineGem(); break;
      default: return;
    }
    this.effect(object, shrine.code === 17 ? 'portal' : 'heal', 1, shrine.name);
    this.state.effects[this.state.effects.length - 1].color = shrine.color;
    this.message(`${shrine.name}：${result}${shrine.duration ? `，持续 ${shrine.duration / FPS} 秒` : ''}。`);
    this.state.saved = false;
  }
  private upgradeShrineGem(): string {
    const p = this.state.player!, area = this.state.area!;
    const candidates = p.inventory.flatMap(item => {
      const gem = GEMS.find(gem => gem.code === item.code);
      const next = gem && GEMS.find(next => next.type === gem.type && next.grade === gem.grade + 1);
      return gem && next ? [{item, gem, next}] : [];
    }).sort((a, b) => b.gem.grade - a.gem.grade);
    if (candidates.length) {
      const {item, next} = candidates[0], upgraded = createItem(next.code, item.ilvl, this.rng, 'normal');
      // Preserve identity/coordinates; replace only this gem with its canonical next grade.
      Object.assign(upgraded, {uid: item.uid, x: item.x, y: item.y, quantity: item.quantity});
      p.inventory[p.inventory.indexOf(item)] = upgraded; this.updateStats();
      return `宝石升级为 ${itemLabel(upgraded)}`;
    }
    const chipped = GEMS.filter(gem => gem.grade === 0), gem = chipped[Math.floor(this.rng() * chipped.length)];
    const item = createItem(gem.code, 1, this.rng, 'normal');
    if (placeItem(p.inventory, item, INVENTORY_WIDTH, INVENTORY_HEIGHT)) return `获得 ${itemLabel(item)}`;
    area.drops.push({item, x: p.x, y: p.y}); return `${itemLabel(item)}已落在脚边（行囊已满）`;
  }
  private pickupNearbyGold() {
    const p = this.state.player!, area = this.state.area!;
    let gold = 0;
    area.drops = area.drops.filter(drop => {
      if (drop.item.code !== 'gld' || distance(p, drop) > 2 || !isWalkable(area, drop.x, drop.y) || !hasLineOfSight(area, p, drop)) return true;
      gold += drop.item.quantity; return false;
    });
    if (gold > 0) { p.gold += gold; this.message(`拾取 ${gold} 金币`, 'loot'); this.state.saved = false; }
  }
  private pickup(uid: string) {
    if (!this.approach(uid, true)) return;
    const p = this.state.player!, area = this.state.area!, index = area.drops.findIndex(d => d.item.uid === uid);
    if (index < 0) return;
    const item = area.drops[index].item;
    if (item.code === 'gld') { p.gold += item.quantity; this.message(`拾取 ${item.quantity} 金币`, 'loot'); }
    else if (/^(?:(hp|mp)[1-5]|rvs|rvl)$/.test(item.code) && this.putBelt(item)) this.message(`拾取 ${itemLabel(item)} → 腰带`, 'loot');
    else if (placeItem(p.inventory, item, INVENTORY_WIDTH, INVENTORY_HEIGHT)) this.message(`拾取 ${itemLabel(item)}`, 'loot');
    else { this.message('背包已满。', 'error'); this.pendingInteraction = null; return; }
    area.drops.splice(index, 1); this.pendingInteraction = null; this.path = []; this.updateStats(); this.state.saved = false;
  }
  private putBelt(item: Item): boolean {
    const p = this.state.player!, rows = this.state.stats!.beltRows;
    let idx = -1;
    for (let c = 0; c < 4; c++) if (p.belt[c]?.code === item.code) {
      for (let r = 0; r < rows; r++) if (!p.belt[r * 4 + c]) { idx = r * 4 + c; break; }
      if (idx >= 0) break;
    }
    if (idx < 0) for (let i = 0; i < rows * 4; i++) if (!p.belt[i]) { idx = i; break; }
    if (idx < 0) return false;
    p.belt[idx] = item; return true;
  }
  private drink(column: number, inventoryUid?: string) {
    if (inventoryUid === undefined && (!Number.isInteger(column) || column < 0 || column > 3)) return;
    const p = this.state.player!, r = inventoryUid === undefined ? consumePotion(p, column) : consumeInventoryPotion(p, inventoryUid);
    if (!r.ok) { this.message(r.message, 'error'); return; }
    const frames = Math.round(r.duration * FPS);
    if (frames > 0) this.regeneration.push({life: r.life / frames, mana: r.mana / frames, frames});
    else { p.life += r.life; p.mana += r.mana; this.updateStats(); }
    this.effect(p, 'heal', .6); this.message(r.message);
  }
  private consumeScroll(code: 'tsc' | 'isc', tome: 'tbk' | 'ibk', uid?: string): boolean {
    const p = this.state.player!;
    if (uid !== undefined) {
      const index = p.inventory.findIndex(i => i.uid === uid);
      if (index < 0) return false;
      const source = p.inventory[index];
      if (source.code === tome && source.quantity > 0) { source.quantity--; return true; }
      if (source.code !== code) return false;
      p.inventory.splice(index, 1); return true;
    }
    const book = p.inventory.find(i => i.code === tome && i.quantity > 0);
    if (book) { book.quantity--; return true; }
    const index = p.inventory.findIndex(i => i.code === code);
    if (index < 0) return false;
    p.inventory.splice(index, 1); return true;
  }
  private useItem(uid: string, targetUid?: string) {
    const p = this.state.player!, source = p.inventory.find(i => i.uid === uid);
    if (!source || !isUsableItem(source)) {
      this.message(source ? `${itemLabel(source)}不能使用。` : '只能使用行囊中的物品。', 'error'); return;
    }
    if (source.code === 'isc' || source.code === 'ibk') {
      if (source.code === 'ibk' && source.quantity <= 0) { this.message(`${itemLabel(source)}已用尽。`, 'error'); return; }
      if (targetUid === undefined) {
        this.state.identifySource = source.uid; return;
      }
      const target = p.inventory.find(i => i.uid === targetUid);
      if (!target || target.identified || target.uid === source.uid) { this.message('请选择行囊中的未鉴定物品。', 'error'); return; }
      if (!this.consumeScroll('isc', 'ibk', source.uid)) { this.message('鉴定来源已失效。', 'error'); return; }
      target.identified = true; this.state.identifySource = null;
      this.message(`鉴定成功：${itemLabel(target)}`, 'loot'); this.updateStats(); return;
    }
    if (targetUid !== undefined) { this.message('该物品不能用于鉴定。', 'error'); return; }
    if (source.code === 'tsc' || source.code === 'tbk') this.openPortal(source.uid);
    else this.drink(0, source.uid);
  }
  private identify(uid?: string) {
    const s = this.state, p = s.player!, area = s.area!;
    if (s.paused) return;
    const cain = s.panel === 'vendor' && s.npc === 'cain' && p.quests[questKey(p, 'a1q3')] === 3 && this.npcServices.includes('identify') && isTownPoint(area, p)
      && area.objects.some(o => o.kind === 'npc' && o.npcId === 'cain' && getArea(o.regionId ?? area.def.id).town && distance(o, p) <= 2);
    if (uid === undefined && !cain) { this.message('鉴定全部需要与本难度已获救的凯恩交谈；也可使用鉴定卷轴逐件鉴定。', 'error'); return; }
    const candidates = uid ? p.inventory.filter(i => i.uid === uid) : p.inventory.filter(i => !i.identified);
    if (!candidates.length) { this.message('没有需要鉴定的物品。'); return; }
    for (const item of candidates) {
      if (item.identified) continue;
      if (!cain && !this.consumeScroll('isc', 'ibk')) { this.message('需要辨识卷轴。', 'error'); break; }
      item.identified = true; this.message(`鉴定成功：${itemLabel(item)}`, 'loot');
    }
    this.updateStats();
  }
  private gamblingContext(opening = false) {
    const s = this.state, p = s.player!, area = s.area!;
    if (s.paused || p.dead || s.npc !== 'gheed' || !this.npcServices.includes('gamble') || !isTownPoint(area, p)) return false;
    if (opening ? s.panel !== 'vendor' : s.panel !== 'gamble') return false;
    return area.objects.some(o => o.kind === 'npc' && o.npcId === 'gheed' && (opening || o.uid === this.gamblingNpcUid) && getArea(o.regionId ?? area.def.id).town && distance(o, p) <= 2);
  }
  private openGambling() {
    if (!this.gamblingContext(true)) return;
    this.gamblingNpcUid = this.state.area!.objects.find(o => o.kind === 'npc' && o.npcId === 'gheed' && distance(o, this.state.player!) <= 2)!.uid;
    this.state.identifySource = null; this.state.selectedItem = null;
    this.state.gamblingOffers = gamblingStock(this.state.player!.level, this.rng);
    this.state.panel = 'gamble';
  }
  private gamble(uid: string) {
    if (!this.gamblingContext()) return;
    const p = this.state.player!, offer = this.state.gamblingOffers.find(o => o.uid === uid);
    if (!offer) return;
    const price = gamblingCost(offer.code, p), base = getBase(offer.code)!;
    if (p.gold < price) { this.message('金币不足。', 'error'); return; }
    let room = false;
    for (let y = 0; y <= INVENTORY_HEIGHT - base.height && !room; y++) for (let x = 0; x <= INVENTORY_WIDTH - base.width && !room; x++) {
      room = p.inventory.every(i => x + base.width <= i.x || i.x + i.width <= x || y + base.height <= i.y || i.y + i.height <= y);
    }
    if (!room) { this.message('背包已满。', 'error'); return; }
    const item = structuredClone(offer.item);
    if (!placeItem(p.inventory, item, INVENTORY_WIDTH, INVENTORY_HEIGHT)) { this.message('背包已满。', 'error'); return; }
    p.gold -= price; this.state.selectedItem = item.uid;
    this.state.gamblingOffers[this.state.gamblingOffers.indexOf(offer)] = refillGamblingOffer(offer, p.level, this.rng);
    this.updateStats(); this.message(`赌博获得：${itemLabel(item)}`, 'loot');
  }
  private buy(uid: string) {
    const p = this.state.player!;
    if (!this.state.area!.def.town || this.state.panel !== 'vendor' || !this.npcServices.includes('trade')) return;
    const offer = this.state.vendorItems.find(i => i.uid === uid);
    if (!offer) return;
    if (p.gold < offer.price) { this.message('金币不足。', 'error'); return; }
    const item = structuredClone(offer); item.uid = this.id('shop'); item.x = item.y = -1;
    if (/^(?:(hp|mp)[1-5]|rvs|rvl)$/.test(item.code) && this.putBelt(item)) p.gold -= offer.price;
    else if (placeItem(p.inventory, item, INVENTORY_WIDTH, INVENTORY_HEIGHT)) p.gold -= offer.price;
    else { this.message('背包已满。', 'error'); return; }
    this.message(`购买 ${itemLabel(item)}`, 'loot');
  }
  private sell(uid: string) {
    const p = this.state.player!;
    if (this.state.panel === 'gamble' ? !this.gamblingContext() : !this.state.area!.def.town || this.state.panel !== 'vendor' || !this.npcServices.includes('trade')) { this.message('请先与商人交谈。', 'error'); return; }
    const idx = p.inventory.findIndex(i => i.uid === uid);
    if (idx < 0) return;
    const item = p.inventory[idx];
    const price = itemSellPrice(item, p.difficulty, this.state.area!.def.act);
    if (price === null) { this.message('不能出售任务物品。', 'error'); return; }
    p.inventory.splice(idx, 1);
    p.gold += price; this.message(`出售 ${itemLabel(item)}，获得 ${price} 金币。`); this.updateStats();
  }
  private storage(uid: string, destination: 'inventory' | 'stash' | 'cube') {
    const p = this.state.player!;
    if (destination === 'stash' && (!this.state.area!.def.town || this.state.panel !== 'stash')) { this.message('请先打开营地仓库。', 'error'); return; }
    if ((destination === 'cube' || p.cube.some(i => i.uid === uid)) && !p.inventory.some(i => i.code === 'box')) { this.message('尚未取得赫拉迪克方块。', 'error'); return; }
    const source = [p.inventory, p.stash, p.cube].find(list => list.some(i => i.uid === uid));
    if (!source || source === p[destination]) return;
    if (source === p.stash && !this.state.area!.def.town) return;
    const index = source.findIndex(i => i.uid === uid), item = source[index];
    if (item.code === 'box' && destination === 'cube') { this.message('方块不能放入自身。', 'error'); return; }
    const [w, h] = destination === 'inventory' ? [INVENTORY_WIDTH, INVENTORY_HEIGHT] : destination === 'stash' ? [STASH_WIDTH, STASH_HEIGHT] : [3, 4];
    if (!placeItem(p[destination], item, w, h)) { this.message('目标空间不足。', 'error'); return; }
    source.splice(index, 1); this.updateStats();
  }
  private removePortal() {
    const portal=this.portal;
    if (!portal) return;
    for (const area of new Set(this.areas.values())) area.objects=area.objects.filter(o=>o.uid!==portal.sourceUid && o.uid!==portal.townUid);
    this.portal=null;
  }
  private openPortal(sourceUid?: string) {
    const p = this.state.player!, area = this.state.area!;
    if (area.def.town) { this.message('不能在营地施放城镇传送。', 'error'); return; }
    if (!this.consumeScroll('tsc', 'tbk', sourceUid)) { this.message('需要城镇传送卷轴。', 'error'); return; }
    this.createTownPortal();
  }
  // Shared portal lifecycle; shrine callers never consume inventory charges.
  private createTownPortal() {
    const p = this.state.player!, area = this.state.area!;
    this.removePortal();
    const townId = townForAct(area.def.act), point = {x: p.x, y: p.y}, preferred = {x:p.x+.7,y:p.y};
    const source = this.validTravelPoint(area,area.def.id,preferred,p) ? preferred : point;
    this.portal = {areaId: area.def.id, point, townId,sourceUid:this.id('portal'),townUid:this.id('portal')};
    area.objects.push({uid: this.portal.sourceUid, kind: 'portal', name: '返回营地', targetArea: townId, x: source.x, y: source.y, regionId:area.def.id});
    const town = this.cachedArea(townId), townSpawn=getSurfaceRegion(town,townId)?.spawn ?? town.spawn;
    town.objects.push({uid: this.portal.townUid, kind: 'portal', name: `返回 ${area.def.name}`, targetArea: area.def.id, x: townSpawn.x + 2, y: townSpawn.y, regionId:townId});
    this.message('蓝色传送门已开启，点击进入。');
  }
  private respec() {
    const p = this.state.player!, key = `${p.difficulty}:respec`;
    if (!this.state.area!.def.town || this.state.npc !== 'akara' || p.quests[key] !== 1) { this.message('需完成邪恶洞窟任务；每个难度可向阿卡拉重置一次。', 'error'); return; }
    const def = getClass(p.classId);
    p.statPoints += p.strength - def.strength + p.dexterity - def.dexterity + p.vitality - def.vitality + p.energy - def.energy;
    p.skillPoints += Object.values(p.skills).reduce((a, b) => a + b, 0);
    p.strength = def.strength; p.dexterity = def.dexterity; p.vitality = def.vitality; p.energy = def.energy;
    p.skills = {}; p.leftSkill = 0; p.rightSkill = p.classId === 'sor' ? 36 : p.classId === 'nec' ? 70 : 0;
    p.quests[key] = 2; this.updateStats(); p.life = this.state.stats!.maxLife; p.mana = this.state.stats!.maxMana; this.message('属性与技能点已重置。');
  }
  private changeDifficulty(difficulty: Difficulty) {
    const p = this.state.player!, idx = ['normal', 'nightmare', 'hell'].indexOf(difficulty);
    if (idx < 0 || idx >= p.unlockedDifficulties) { this.message('需要击败当前难度的巴尔才能解锁下一难度。', 'error'); return; }
    if (p.difficulty === difficulty) return;
    p.difficulty = difficulty; p.waypoints = [1]; this.areas.clear(); this.vendorStocks.clear(); this.portal = null; this.updateStats(); this.enterArea(1, undefined, true); this.save();
  }
  private hireMerc(mercType: string) {
    const p = this.state.player!, area = this.state.area!;
    if (!area.def.town || this.state.panel !== 'vendor') { this.message('需要在营地与雇佣兵 NPC 交谈。', 'error'); return; }
    if (!MERC_STATS[mercType]) { this.message('无效的雇佣兵类型。', 'error'); return; }
    const cost = p.level * 200;
    if (p.gold < cost) { this.message(`雇佣需要 ${cost} 金币。`, 'error'); return; }
    p.gold -= cost;
    const level = Math.max(1, p.level - 2 + Math.floor(this.rng() * 5));
    const maxLife = mercMaxLife(mercType, level);
    const spawn = area.spawn;
    p.mercenary = {name: MERC_STATS[mercType].baseName, type: mercType, life: maxLife, maxLife, level, equipment: {}, x: spawn.x + 1, y: spawn.y, cooldown: 0};
    this.message(`雇佣了${MERC_STATS[mercType].baseName}（等级 ${level}）。`);
  }
  private resurrectMerc() {
    const p = this.state.player!, area = this.state.area!;
    if (!area.def.town || this.state.panel !== 'vendor') { this.message('需要在营地与雇佣兵 NPC 交谈。', 'error'); return; }
    if (!p.mercenary) { this.message('没有雇佣兵需要复活。', 'error'); return; }
    if (p.mercenary.life > 0) { this.message('雇佣兵尚未阵亡。', 'error'); return; }
    const cost = Math.min(50000, p.mercenary.level * 500);
    if (p.gold < cost) { this.message(`复活需要 ${cost} 金币。`, 'error'); return; }
    p.gold -= cost;
    p.mercenary.life = p.mercenary.maxLife;
    const spawn = area.spawn;
    p.mercenary.x = spawn.x + 1; p.mercenary.y = spawn.y;
    this.message(`${p.mercenary.name} 已复活（花费 ${cost} 金币）。`);
  }
  private mercEquip(uid: string) {
    const p = this.state.player!;
    if (!p.mercenary) { this.message('没有雇佣兵。', 'error'); return; }
    const idx = p.inventory.findIndex(i => i.uid === uid);
    if (idx < 0) { this.message('物品不在背包中。', 'error'); return; }
    const item = p.inventory[idx];
    const baseSlot = getBase(item.code)?.slot;
    const slot = baseSlot === 'head' ? 'head' : baseSlot === 'body' ? 'body' : baseSlot === 'weapon' ? 'weapon' : null;
    if (!slot) { this.message('雇佣兵只能装备头盔、护甲和武器。', 'error'); return; }
    const old = p.mercenary.equipment[slot];
    if (old) { p.inventory.push(old); }
    p.mercenary.equipment[slot] = item;
    p.inventory.splice(idx, 1);
    // 重新计算最大生命（护甲加成）
    p.mercenary.maxLife = mercMaxLife(p.mercenary.type, p.mercenary.level);
    p.mercenary.life = Math.min(p.mercenary.life, p.mercenary.maxLife);
    this.message(`${p.mercenary.name} 装备了 ${item.name}。`);
  }
  private mercUnequip(slot: 'head' | 'body' | 'weapon') {
    const p = this.state.player!;
    if (!p.mercenary) { this.message('没有雇佣兵。', 'error'); return; }
    const item = p.mercenary.equipment[slot];
    if (!item) { this.message('该部位没有装备。', 'error'); return; }
    if (!placeItem(p.inventory, item, INVENTORY_WIDTH, INVENTORY_HEIGHT)) { this.message('背包已满，无法卸下装备。', 'error'); return; }
    delete p.mercenary.equipment[slot];
    this.message(`卸下了 ${item.name}。`);
  }
  private castFrames(): number {
    const p = this.state.player!, fcr = this.state.stats!.fcr;
    const tables: Record<string, [number[], number]> = {
      ama: [[0, 7, 14, 22, 32, 48, 68, 99, 152], 19], sor: [[0, 9, 20, 37, 63, 105, 200], 13],
      nec: [[0, 9, 18, 30, 48, 75, 125], 15], pal: [[0, 9, 18, 30, 48, 75, 125], 15],
      bar: [[0, 9, 20, 37, 63, 105, 200], 13], dru: [[0, 4, 10, 19, 30, 46, 68, 99, 163], 18], ass: [[0, 8, 16, 27, 42, 65, 102, 174], 16],
    };
    const [breakpoints, first] = tables[p.classId];
    return first - Math.max(0, breakpoints.filter(b => fcr >= b).length - 1);
  }
  private tryAttack() {
    const p = this.state.player!, area = this.state.area!, stats = this.state.stats!, intent = this.attackTarget;
    if (!intent || this.cooldown > 0 || p.dead || area.def.town) return;
    const skillId = intent.right ? p.rightSkill : p.leftSkill;
    const e = skillEffect(p, skillId);
    if (skillId !== 0 && skillLevel(p, skillId) <= 0) { this.message(`当前未获得${getSkill(skillId)?.name ?? '所选技能'}，请学习技能或切换到提供该技能的武器组。`, 'error'); this.attackTarget = null; return; }
    if (!e.supported) { this.message('此技能的特殊行为尚未实现。', 'error'); this.attackTarget = null; return; }
    const target = intent.monster ? area.monsters.find(m => m.uid === intent.monster && !m.dead) : undefined;
    const point = target ?? intent.point;
    if (e.kind === 'passive') { this.message('被动技能无需施放。'); this.attackTarget = null; return; }
    if (e.kind === 'melee' && target && (distance(p, target) > 1.35 || !hasLineOfSight(area, p, target))) { this.path = findPath(area, p, target); return; }
    if (e.mana > p.mana) { this.message('法力不足。', 'error'); this.attackTarget = null; return; }
    if (e.kind === 'summon' && skillId === 70 && !area.monsters.some(m => m.dead && m.poisonFrames !== -1 && distance(m, point) < 3)) { this.message('需要怪物尸体才能召唤骷髅。', 'error'); this.attackTarget = null; return; }
    this.path = [];
    p.mana -= e.mana;
    this.cooldown = e.kind === 'melee' ? Math.max(5, Math.floor(num(rawRows('charstats').find(r => r.class === getClass(p.classId).english)!, '#swing', 16) / (1 + stats.ias / 100))) : this.castFrames();
    if (distance(p, point) > .01) this.state.facing = Math.atan2(point.y - p.y, point.x - p.x);
    this.event('player', e.kind === 'melee' ? 'attack' : 'cast', p, point, e.element);
    const min = skillId === 0 ? stats.minDamage : e.min, max = skillId === 0 ? stats.maxDamage : e.max;
    switch (e.kind) {
      case 'melee': {
        this.effect(point, 'hit', .35);
        if (target) this.damageMonster(target, min || stats.minDamage, max || stats.maxDamage, e.element, true);
        this.attackTarget = target && !target.dead ? intent : null; break;
      }
      case 'projectile': {
        const angle = Math.atan2(point.y - p.y, point.x - p.x);
        for (let i = 0; i < Math.max(1, e.projectiles); i++) {
          const a = angle + (i - (e.projectiles - 1) / 2) * .14;
          this.state.projectiles.push({uid: this.id('p'), x: p.x, y: p.y, dx: Math.cos(a) * 14 / FPS, dy: Math.sin(a) * 14 / FPS, owner: 'player', min, max, element: e.element, life: FPS * 2, radius: .35, skillId, explosionRadius: e.radius, chillDuration: e.duration * FPS});
        }
        this.attackTarget = null; break;
      }
      case 'nova':
      case 'area': {
        const center = e.kind === 'nova' ? p : point;
        this.effect(center, e.element === 'physical' || e.element === 'magic' ? 'nova' : e.element as 'fire', .8, undefined, e.radius);
        for (const m of area.monsters) if (!m.dead && distance(m, center) < e.radius) this.damageMonster(m, min, max, e.element, false);
        this.attackTarget = null; break;
      }
      case 'teleport': if (isWalkable(area, point.x, point.y)) { this.effect(p, 'portal', .4); p.x = point.x; p.y = point.y; this.updateSurfaceRegion(); this.effect(p, 'portal', .4); this.reveal(); } else p.mana += e.mana; this.attackTarget = null; break;
      case 'summon': {
        const level = skillLevel(p, skillId);
        const limit = skillId === 70 ? (level <= 3 ? level : 3 + Math.floor((level - 3) / 3)) : 1;
        if (skillId === 70) { const corpse = area.monsters.find(m => m.dead && m.poisonFrames !== -1 && distance(m, point) < 3)!; corpse.poisonFrames = -1; }
        const existing = this.state.summons.filter(s => s.name === getSkill(skillId)?.name);
        if (existing.length >= limit) this.state.summons.splice(this.state.summons.indexOf(existing[0]), 1);
        this.state.summons.push({uid: this.id('s'), name: getSkill(skillId)?.name ?? '召唤物', x: p.x + 1, y: p.y, life: 30 + level * 10, maxLife: 30 + level * 10, min: min || 1, max: max || 2, cooldown: 0, duration: e.duration > 0 ? e.duration * FPS : Infinity, color: '#cac7af'});
        this.effect(p, 'summon', .7); this.attackTarget = null; break;
      }
      case 'aura': this.aura = {skillId, next: this.state.tick}; this.effect(p, 'nova', .8, getSkill(skillId)?.name); this.attackTarget = null; break;
      case 'buff':
      case 'curse': this.message('该技能状态处理尚未接入实战，不消耗法力。', 'error'); p.mana += e.mana; this.attackTarget = null; break;
    }
    this.state.saved = false;
  }
  private aimAttack(right: boolean, steering: boolean) {
    const p = this.state.player!, area = this.state.area!, aim = this.control.aim!;
    const e = skillEffect(p, right ? p.rightSkill : p.leftSkill);
    const alive = area.monsters.filter(m => !m.dead);
    let target = this.control.aimMonster ? alive.find(m => m.uid === this.control.aimMonster) : undefined;
    if (!target && e.kind === 'melee') {
      const d = distance(p, aim), dir = d > .01 ? {x: (aim.x - p.x) / d, y: (aim.y - p.y) / d} : {x: Math.cos(this.state.facing), y: Math.sin(this.state.facing)};
      target = alive.filter(m => { const r = distance(p, m); return r <= 1.35 && (r < .5 || ((m.x - p.x) * dir.x + (m.y - p.y) * dir.y) / r > .3); }).sort((a, b) => distance(p, a) - distance(p, b))[0];
      if (!target && !steering) target = alive.filter(m => distance(m, aim) < 1.5).sort((a, b) => distance(a, aim) - distance(b, aim))[0];
    }
    this.state.selectedMonster = target?.uid ?? null;
    this.attackTarget = {point: target ? {x: target.x, y: target.y} : {x: aim.x, y: aim.y}, right, monster: target?.uid};
  }
  private effect(point: Point, kind: GameState['effects'][number]['kind'], seconds: number, text?: string, radius = 1) {
    this.state.effects.push({x: point.x, y: point.y, kind, life: seconds * FPS, maxLife: seconds * FPS, radius, text});
  }
  private damageMonster(m: Monster, min: number, max: number, element: Element, melee: boolean, chillDuration = FPS * 2) {
    const p = this.state.player!, stats = this.state.stats!;
    if (m.dead) return;
    if (melee && this.rng() * 100 >= hitChance(stats.attackRating, m.defense, p.level, m.level)) { this.effect(m, 'text', .7, '未命中'); this.event(m.uid, 'miss', m); return; }
    let rolledBits = rollDamageBits(min, max, this.rng);
    const weaponAttack = melee && element === 'physical';
    if (weaponAttack) {
      const critical = stats.criticalStrike > 0 && this.rng() * 100 < stats.criticalStrike;
      const deadly = !critical && stats.deadlyStrike > 0 && this.rng() * 100 < stats.deadlyStrike;
      if (critical || deadly) rolledBits *= 2;
    }
    const packet: DamageComponent[] = [{ element, bits: rolledBits }];
    let coldFrames = chillDuration;
    if (weaponAttack) {
      for (const e of ['fire', 'cold', 'lightning', 'magic'] as const) {
        const range = stats.elementalDamage[e];
        if (range.max <= 0) continue;
        packet.push({ element: e, bits: rollDamageBits(range.min, range.max, this.rng) });
        if (e === 'cold') coldFrames = stats.coldLength;
      }
    }
    const result = settleDirectDamage(packet, m.life, { resistances: m.resists });
    if (weaponAttack) {
      const raw = rawRows('monstats').find(r => r.Id === m.code);
      const suffix = p.difficulty === 'normal' ? '' : p.difficulty === 'nightmare' ? '(N)' : '(H)';
      const drain = raw ? num(raw, `Drain${suffix}`) : 0;
      p.life = Math.min(stats.maxLife, p.life + leechAmount(result.physicalLifeLoss, stats.lifeLeech, drain, p.difficulty));
      p.mana = Math.min(stats.maxMana, p.mana + leechAmount(result.physicalLifeLoss, stats.manaLeech, drain, p.difficulty));
    }
    const coldDamage = result.stages.find(stage => stage.element === 'cold')?.afterResistanceBits ?? 0;
    if (coldDamage > 0 && coldFrames > 0) {
      const raw = rawRows('monstats').find(r => r.Id === m.code);
      const suffix = p.difficulty === 'normal' ? '' : p.difficulty === 'nightmare' ? '(N)' : '(H)';
      if (raw && num(raw, `coldeffect${suffix}`) < 0) m.chill = Math.floor(coldFrames / DIFFICULTY_RULES[p.difficulty].coldLengthDivisor);
    }
    const damage = result.lifeLoss;
    m.life = result.remainingLife; if (damage > 0) { this.alertedMonsters.add(m); this.event(m.uid, 'hurt', m, m, element); } this.effect(m, 'text', .75, damage > 0 ? String(Math.max(1, Math.floor(damage))) : '免疫');
    this.effect(m, element === 'physical' || element === 'magic' ? 'hit' : element as 'fire', .25);
    if (m.life <= 0) this.kill(m);
  }
  private kill(m: Monster) {
    const p = this.state.player!, area = this.state.area!;
    if (p.dead) return;
    m.dead = true; this.meleeSwings.delete(m); const before = p.level; this.event(m.uid, 'death', m);
    if (!this.rewardedMonsters.has(m)) {
      this.rewardedMonsters.add(m);
      grantExperience(p, m.level, m.experience);
      this.updateStats();
      if (p.level > before) { p.life = this.state.stats!.maxLife; p.mana = this.state.stats!.maxMana; this.effect(p, 'level', 1.5, `等级 ${p.level}`); this.message(`提升至 ${p.level} 级！获得 ${(p.level - before) * 5} 属性点和 ${p.level - before} 技能点。`); }
      for (const item of rollLoot(m, this.rng, p.difficulty, this.state.stats!.magicFind)) {
        const x = m.x + (this.rng() - .5) * .8, y = m.y + (this.rng() - .5) * .8;
        const clear = isWalkable(area, x, y) && isWalkable(area, m.x, y) && isWalkable(area, x, m.y);
        area.drops.push({item, x: clear ? x : m.x, y: clear ? y : m.y});
      }
      // Uber boss guaranteed organ/torch drops (hell only)
      const uberOrgans: Record<string,string> = {uberandariel:'dhn',uberduriel:'bey',ubermephisto:'mbr'};
      if (p.difficulty === 'hell' && uberOrgans[m.code]) {
        const organ = createItem(uberOrgans[m.code], m.level, this.rng);
        area.drops.push({item: organ, x: m.x, y: m.y});
      }
      if (p.difficulty === 'hell' && m.code === 'uberdiablo') {
        const torch = createItem('cm3', m.level, this.rng); // hellfire torch = unique large charm
        area.drops.push({item: torch, x: m.x, y: m.y});
      }
    }
    for (const text of onKill(p, area, m)) this.message(text);
    if (m.boss) this.message(`${m.name} 已被击败。`);
    if (this.state.selectedMonster === m.uid) this.state.selectedMonster = null;
  }
  private damagePlayer(m: Monster, amount: number, element: Element = 'physical') {
    const p = this.state.player!, s = this.state.stats!;
    if (p.dead || isTownPoint(this.state.area!,p)) return;
    if (element === 'physical' && this.rng() * 100 >= hitChance(m.attackRating, s.defense, m.level, p.level, this.runningThisFrame)) return;
    if (element === 'physical' && this.rng() * 100 < Math.floor(s.block / (this.runningThisFrame ? 3 : 1))) { this.effect(p, 'text', .4, '格挡'); this.event('player', 'block', p); return; }
    const result = settleDirectDamage([{ element, bits: lifeBits(amount) }], p.life, {
      resistances: { physical: s.damageReduction, fire: s.resFire, cold: s.resCold, lightning: s.resLightning, poison: s.resPoison, magic: 0 },
      flatPhysical: s.flatReduction,
    });
    const damage = result.lifeLoss;
    p.life = result.remainingLife;
    if (damage > 0) { this.event('player', 'hurt', p, p, element); this.effect(p, 'hit', .3); this.effect(p, 'text', .8, `−${Math.max(1, Math.floor(damage))}`); }
    if (p.life <= 0) this.die();
  }
  private damageMerc(m: Monster, amount: number) {
    const p = this.state.player!;
    if (!p.mercenary || p.mercenary.life <= 0) return;
    const merc = p.mercenary;
    const dmg = Math.max(1, Math.floor(amount * (1 - m.level / (m.level + merc.level + 10))));
    merc.life = Math.max(0, merc.life - dmg);
    if (merc.life <= 0) {
      merc.life = 0;
      this.message(`${merc.name} 阵亡了，前往营地找雇佣兵 NPC 复活。`, 'error');
    }
  }
  private die() {
    const p = this.state.player!, area = this.state.area!;
    p.dead = true; this.clearShrineBuff(); this.path = []; this.attackTarget = null; this.pendingInteraction = null; this.event('player', 'death', p);
    const penalty = p.difficulty === 'normal' ? 0 : p.difficulty === 'nightmare' ? .05 : .1;
    const previous = EXPERIENCE[p.level] ?? 0, next = EXPERIENCE[p.level + 1] ?? previous;
    p.experience = Math.max(previous, p.experience - Math.floor((next - previous) * penalty));
    const gold = p.gold;
    p.gold = Math.max(0, p.gold - Math.floor(p.gold * Math.min(20, p.level) / 100));
    const dropped = p.gold; p.gold = 0;
    if (dropped) { const item = createItem('gld', p.level, this.rng); item.quantity = dropped; area.drops.push({item, x: p.x, y: p.y}); }
    if (!p.corpse) { p.corpse = {areaId: area.def.id, x: p.x, y: p.y, equipment: p.equipment}; p.equipment = {}; area.objects.push({uid: this.id('corpse'), kind: 'corpse', name: `${p.name} 的尸体`, x: p.x, y: p.y,regionId:area.def.id}); }
    this.message(`你死了。金币损失 ${gold - dropped}；装备保留在尸体上。`, 'error'); this.updateStats(); this.save();
  }
  private respawn() {
    const p = this.state.player;
    if (!p?.dead) return;
    p.dead = false; this.updateStats(); p.life = this.state.stats!.maxLife; p.mana = this.state.stats!.maxMana; p.stamina = this.state.stats!.maxStamina;
    this.enterArea(townForAct(this.state.area?.def.act ?? 1), undefined, true); this.message('返回尸体所在区域取回装备；地表尸体保留原位置，地牢尸体在重新载入后返回营地。');
  }
  private recoverCorpse() {
    const p = this.state.player!;
    if (!p.corpse) return;
    const area=this.state.area!,region=getSurfaceRegion(area,p.corpse.areaId);
    if ((!region && (area.regions || area.def.id!==p.corpse.areaId)) || distance(p,p.corpse)>2) return;
    for (const [slot, item] of Object.entries(p.corpse.equipment) as [Slot, Item][]) {
      if (!p.equipment[slot]) { p.equipment[slot] = item; delete p.corpse.equipment[slot]; }
      else if (placeItem(p.inventory, item, INVENTORY_WIDTH, INVENTORY_HEIGHT)) delete p.corpse.equipment[slot];
    }
    this.updateStats(true);
    if (Object.keys(p.corpse.equipment).length) { this.message('背包空间不足，尸体上仍有装备。', 'error'); return; }
    delete p.corpse; for (const a of new Set(this.areas.values())) a.objects = a.objects.filter(o => o.kind !== 'corpse');
    this.updateStats(true); this.message('已取回尸体上的装备。');
  }
  private moveToward(unit: Point, target: Point, speed: number) {
    const area = this.state.area!, d = distance(unit, target);
    if (d < .001) return;
    const enemy=area.monsters.includes(unit as Monster);
    const clear = (x: number, y: number) => isWalkable(area, x, y) && (!enemy || !isTownPoint(area,{x,y})) && (unit === this.state.player || !area.monsters.some(m => m !== unit && !m.dead && Math.hypot(m.x - x, m.y - y) < .75));
    const step = Math.min(d, speed / FPS), segments = Math.max(1, Math.ceil(step / .2));
    const dx = (target.x - unit.x) / d * step / segments, dy = (target.y - unit.y) / d * step / segments;
    for (let i = 0; i < segments; i++) {
      const canX = clear(unit.x + dx, unit.y), canY = clear(unit.x, unit.y + dy);
      if (canX && canY && clear(unit.x + dx, unit.y + dy)) { unit.x += dx; unit.y += dy; }
      else if (canX) unit.x += dx;
      else if (canY) unit.y += dy;
      else break;
    }
  }
  step() {
    const {player: p, area} = this.state;
    let s = this.state.stats;
    if (p?.dead && this.state.shrineBuff) this.clearShrineBuff();
    if (this.state.screen !== 'game' || !p || !area || !s || this.state.paused || p.dead) return;
    const runtimeRevision=this.runtimeRevision;
    this.state.tick++;
    this.advanceShrines(); s = this.state.stats!;
    this.updateSurfaceRegion();
    this.cooldown = Math.max(0, this.cooldown - 1);
    this.runningThisFrame = false;
    const c = this.control, steering = Math.hypot(c.move.x, c.move.y) > .05;
    const running = p.running && p.stamina > 0;
    const speed = (running ? 9 : 6) * (1 + s.frw / 100);
    const before = {x: p.x, y: p.y};
    if (steering) {
      this.path = []; this.state.target = null; this.pendingInteraction = null;
      if (!c.left && !c.right) this.attackTarget = null;
      this.moveToward(p, {x: p.x + c.move.x * 4, y: p.y + c.move.y * 4}, speed * Math.min(1, Math.hypot(c.move.x, c.move.y) * 1.25));
    } else if (this.path.length) {
      this.moveToward(p, this.path[0], speed);
      if (distance(p, this.path[0]) < .18) this.path.shift();
    }
    this.updateSurfaceRegion();
    const travelled = distance(p, before);
    this.state.moving = travelled > .001;
    if (this.state.moving) {
      this.state.facing = Math.atan2(p.y - before.y, p.x - before.x);
      this.runningThisFrame = running;
      if (running && !area.def.town && this.state.shrineBuff?.code !== 14) p.stamina = Math.max(0, p.stamina - .2);
      this.reveal();
    } else p.stamina = Math.min(s.maxStamina, p.stamina + .6);
    if (this.pendingInteraction) {
      const intent = this.pendingInteraction, point = this.findObjectPoint(intent.uid, intent.pickup);
      if (!point) { this.pendingInteraction = null; this.path = []; }
      else if (distance(p, point) <= 2) intent.pickup ? this.pickup(intent.uid) : this.interact(intent.uid);
    }
    if (this.state.area !== area || this.runtimeRevision!==runtimeRevision) return;
    this.pickupNearbyGold();
    if ((c.left || c.right) && c.aim && !area.def.town && this.cooldown === 0) this.aimAttack(c.right, steering);
    if (this.attackTarget) this.tryAttack();
    if (steering) this.path = [];
    s = this.state.stats!;
    for (const regen of this.regeneration) { p.life = Math.min(s.maxLife, p.life + regen.life); p.mana = Math.min(s.maxMana, p.mana + regen.mana); regen.frames--; }
    this.regeneration = this.regeneration.filter(r => r.frames > 0);
    p.mana = Math.min(s.maxMana, p.mana + manaRegeneration(s.maxMana, s.manaRegenPercent));
    for (const m of area.monsters) {
      if (m.dead) continue;
      m.cooldown = Math.max(0, m.cooldown - 1); m.chill = Math.max(0, m.chill - 1);
      const swing = this.meleeSwings.get(m);
      if (swing !== undefined) {
        if (swing > 1) this.meleeSwings.set(m, swing - 1);
        else {
          this.meleeSwings.delete(m);
          if (distance(p, m) <= 1.35 && hasLineOfSight(area, m, p)) this.damagePlayer(m, Math.floor(m.minDamage + this.rng() * (m.maxDamage - m.minDamage + 1)));
        }
        if (p.dead) break;
        continue;
      }
      if (distance(p, m) > 11) continue;
      if (!this.alertedMonsters.has(m)) {
        if (distance(p, m) > 7 || !hasLineOfSight(area, m, p)) continue;
        this.alertedMonsters.add(m);
      }
      if (m.ai === 'shaman' && m.cooldown === 0) {
        const fallen = area.monsters.find(x => x.dead && x.poisonFrames !== -1 && /^fallen\d+$/.test(x.code) && !x.boss && !x.champion && distance(m, x) < 6);
        if (fallen) { fallen.dead = false; fallen.life = fallen.maxLife; m.cooldown = 75; this.event(fallen.uid, 'revive', fallen); this.event(m.uid, 'cast', m, fallen, 'fire'); this.effect(fallen, 'fire', .6, '复活'); continue; }
      }
      const range = m.ai === 'ranged' || m.ai === 'shaman' ? 6 : 1.2;
      // 50% 概率优先攻击雇佣兵（若雇佣兵存活且距怪物更近）
      const merc = p.mercenary && p.mercenary.life > 0 ? p.mercenary : null;
      const attackMerc = merc && distance(m, merc) < distance(m, p) * 1.2 && this.rng() < .5;
      const combatTarget: Point = attackMerc ? merc! : p;
      if (distance(combatTarget, m) > range || !hasLineOfSight(area, m, combatTarget)) this.moveToward(m, combatTarget, (m.chill ? 1 : 2.2));
      else if (m.cooldown === 0) {
        m.cooldown = Math.round((m.boss ? 25 : 35) * (m.chill ? 2 : 1));
        this.event(m.uid, range > 2 ? 'cast' : 'attack', m, combatTarget, m.ai === 'shaman' ? 'fire' : 'physical');
        if (range > 2) {
          const a = Math.atan2(combatTarget.y - m.y, combatTarget.x - m.x);
          this.state.projectiles.push({uid: this.id('mp'), x: m.x, y: m.y, dx: Math.cos(a) * 7 / FPS, dy: Math.sin(a) * 7 / FPS, owner: 'monster', min: m.minDamage, max: m.maxDamage, element: m.ai === 'shaman' ? 'fire' : 'physical', life: FPS * 3, radius: .3, skillId: 0, ownerUid: m.uid});
        } else {
          if (attackMerc && merc) this.damageMerc(m, Math.floor(m.minDamage + this.rng() * (m.maxDamage - m.minDamage + 1)));
          else this.meleeSwings.set(m, m.chill ? 12 : 6);
        }
      }
      if (p.dead) break;
    }
    if (p.dead) return;
    for (const proj of this.state.projectiles) { this.updateProjectile(proj); if (p.dead) return; }
    this.state.projectiles = this.state.projectiles.filter(proj => proj.life > 0);
    for (const summon of this.state.summons) {
      summon.duration--; summon.cooldown = Math.max(0, summon.cooldown - 1);
      const target = area.monsters.filter(m => !m.dead && distance(m, p) < 10).sort((a, b) => distance(a, summon) - distance(b, summon))[0];
      if (target) {
        if (distance(summon, target) > 1.2) this.moveToward(summon, target, 4);
        else if (!summon.cooldown) { this.event(summon.uid, 'attack', summon, target); this.damageMonster(target, summon.min, summon.max, 'physical', false); summon.cooldown = 25; }
      } else if (distance(summon, p) > 2) this.moveToward(summon, p, 5);
    }
    this.state.summons = this.state.summons.filter(s => s.duration > 0 && s.life > 0);
    // 雇佣兵战斗 AI
    if (p.mercenary && p.mercenary.life > 0 && !area.def.town) {
      const merc = p.mercenary;
      merc.cooldown = Math.max(0, merc.cooldown - 1);
      const st = MERC_STATS[merc.type] ?? MERC_STATS['desert-guard'];
      const isRanged = st.range > 2;
      const target = area.monsters.filter(m => !m.dead && distance(m, p) < 14).sort((a, b) => distance(a, merc) - distance(b, merc))[0];
      if (target) {
        if (distance(merc, target) > st.range || !hasLineOfSight(area, merc, target)) {
          this.moveToward(merc, target, 4.5);
        } else if (merc.cooldown === 0) {
          merc.cooldown = st.swingFrames;
          const dmg = mercDamage(merc.type, merc.level);
          const elem = mercElement(merc.type);
          this.event(merc.name, 'attack', merc, target, elem);
          if (isRanged) {
            const a = Math.atan2(target.y - merc.y, target.x - merc.x);
            this.state.projectiles.push({uid: this.id('mp'), x: merc.x, y: merc.y, dx: Math.cos(a) * 12 / FPS, dy: Math.sin(a) * 12 / FPS, owner: 'summon', min: dmg.min, max: dmg.max, element: elem, life: FPS * 2, radius: .35, skillId: 0});
          } else {
            if (distance(merc, target) <= st.range && hasLineOfSight(area, merc, target)) {
              this.damageMonster(target, dmg.min, dmg.max, elem, false);
            }
          }
        }
      } else if (distance(merc, p) > 3) {
        this.moveToward(merc, p, 5);
      }
    } else if (p.mercenary && p.mercenary.life > 0 && area.def.town) {
      // 在城镇跟随玩家
      if (distance(p.mercenary, p) > 2) this.moveToward(p.mercenary, p, 4);
    }
    if (this.aura && this.state.tick >= this.aura.next) {
      const e = skillEffect(p, this.aura.skillId); this.aura.next = this.state.tick + FPS * 2;
      this.effect(p, e.element === 'physical' || e.element === 'magic' ? 'nova' : e.element as 'fire', .7, undefined, e.radius);
      for (const m of area.monsters) if (!m.dead && distance(m, p) <= e.radius) this.damageMonster(m, e.min, e.max, e.element, false);
    }
    if (!this.aura && this.state.tick % (FPS * 2) === 0) {
      const stats = deriveStats(p);
      for (const id of stats.equipmentAuras) {
        const e = skillEffect(p, id);
        if (e.radius > 0 && e.min > 0) {
          this.effect(p, e.element === 'physical' || e.element === 'magic' ? 'nova' : e.element as 'fire', .5, undefined, e.radius);
          for (const m of area.monsters) if (!m.dead && distance(m, p) <= e.radius) this.damageMonster(m, e.min, e.max, e.element, false);
        }
      }
    }
    for (const e of this.state.effects) e.life--;
    this.state.effects = this.state.effects.filter(e => e.life > 0);
    if (this.state.tick % (FPS * 20) === 0) this.save(false);
  }
  private updateProjectile(proj: Projectile) {
    const {player: p, area} = this.state;
    if (!p || !area || p.dead) return;
    proj.life--; proj.x += proj.dx; proj.y += proj.dy;
    if (!isWalkable(area, proj.x, proj.y)) { proj.life = 0; return; }
    if (proj.owner === 'monster') {
      const merc = p.mercenary && p.mercenary.life > 0 ? p.mercenary : null;
      if (merc && distance(proj, merc) < .65) {
        const owner = area.monsters.find(m => m.uid === proj.ownerUid);
        if (owner) this.damageMerc(owner, proj.min + this.rng() * (proj.max - proj.min));
        proj.life = 0;
      } else if (distance(proj, p) < .65) {
        const owner = area.monsters.find(m => m.uid === proj.ownerUid);
        if (owner) this.damagePlayer(owner, proj.min + this.rng() * (proj.max - proj.min), proj.element);
        proj.life = 0;
      }
    } else {
      const hit = area.monsters.find(m => !m.dead && distance(m, proj) < .65);
      if (hit) {
        if ((proj.explosionRadius ?? 0) > 0) {
          this.effect(proj, proj.element === 'fire' ? 'fire' : 'nova', .6, undefined, proj.explosionRadius);
          for (const target of area.monsters) if (!target.dead && distance(target, proj) <= proj.explosionRadius!) this.damageMonster(target, proj.min, proj.max, proj.element, false, proj.chillDuration);
        } else this.damageMonster(hit, proj.min, proj.max, proj.element, false, proj.chillDuration);
        proj.life = 0;
      }
    }
  }
  save(notify = true): Promise<void> {
    if (!this.store || !this.state.player || !this.state.activeSaveId || this.state.activeSaveId === this.deletingSaveId) return Promise.resolve();
    const record: SaveRecord = structuredClone({id: this.state.activeSaveId, version: 1, player: this.state.player, seed: this.state.seed, timestamp: Date.now()});
    this.state.saved = false;
    this.saving = this.saving.then(async () => {
      try {
        await this.store!.put(record);
        await this.refreshCharacters();
        if (this.state.activeSaveId === record.id) {
          this.state.saved = true; this.state.storageError = '';
          if (notify) this.message('角色已保存到 IndexedDB。');
        }
      } catch {
        this.state.storageError = '存档写入失败，请检查浏览器存储空间或隐私设置。';
        if (this.state.activeSaveId === record.id) this.state.saved = false;
        this.message(this.state.storageError, 'error');
      }
    });
    return this.saving;
  }
  async saveAndReturnToTitle() {
    const s = this.state;
    if (!this.store || !s.player || !s.activeSaveId || s.screen !== 'game' || s.loadingSave || s.savingAndExiting) return;
    s.savingAndExiting = true; s.paused = true;
    try {
      await this.save(false);
      if (!s.saved) return;
      s.identifySource = null; s.gamblingOffers = []; this.gamblingNpcUid = null; s.panel = 'none'; s.screen = 'title';
    } finally { s.savingAndExiting = false; }
  }
  async deleteCharacter(id: string) {
    if (!this.store || this.state.storageStatus !== 'ready' || this.state.loadingSave || this.state.screen !== 'title' || !this.state.characters.some(c => c.id === id)) return;
    this.state.loadingSave = true; this.deletingSaveId = id;
    this.saving = this.saving.then(async () => {
      try {
        await this.store!.delete(id);
        if (this.state.activeSaveId === id) {
          this.clearShrineBuff();
          this.state.activeSaveId = null; this.state.player = null; this.state.area = null; this.state.stats = null; this.state.saved = false;
          this.resetRuntime(); this.areas.clear(); this.vendorStocks.clear(); this.portal = null;
        }
        this.state.characters = this.state.characters.filter(c => c.id !== id);
        this.state.storageError = '';
      } catch {
        this.state.storageError = '删除角色失败，原存档已保留，请重试。';
      }
    });
    await this.saving;
    this.deletingSaveId = null; this.state.loadingSave = false;
  }
  async load(id: string) {
    if (!this.store || this.state.storageStatus !== 'ready' || this.state.loadingSave) return;
    this.state.identifySource = null; this.state.loadingSave = true;
    try {
      await this.saving;
      const save = await this.store.get(id);
      if (!save) { this.state.storageError = '找不到该角色存档，请重新选择。'; return; }
      if (save.id !== id || !validSave(save)) { this.state.storageError = '存档损坏或版本不兼容；原存档未被覆盖。'; return; }
      this.clearShrineBuff();
      this.state.messages = []; this.state.activeSaveId = id;
      this.state.player = save.player; this.state.seed = save.seed; this.rng = seededRandom(save.seed); this.areas.clear(); this.vendorStocks.clear(); this.portal = null;
      const p = this.state.player; p.dead = false; this.updateStats();
      if (p.life <= 0) p.life = this.state.stats!.maxLife;
      this.enterArea(townForAct(Math.min(5, Math.max(1, p.unlockedActs))), undefined, true);
      if (p.corpse) {
        if (SURFACE_IDS.some(surfaceId=>surfaceId===p.corpse!.areaId)) this.syncCorpse(this.cachedArea(p.corpse.areaId));
        else {p.corpse.areaId=this.state.area!.def.id;p.corpse.x=p.x+1;p.corpse.y=p.y;this.syncCorpse(this.state.area!);}
      }
      this.state.saved = true; this.state.storageError = '';
      this.message('存档已载入。重新进入游戏后怪物刷新，角色从营地出发。');
    } catch { this.state.storageError = '无法读取角色存档；原存档未被覆盖。'; }
    finally { this.state.loadingSave = false; }
  }
}
