import { CLASSES, findSkill, skillReq } from '../data/classes.js';
import { ZONES, CULTIVATION, CULT_TRIALS, DUNGEONS, DUNGEON_DAILY } from '../data/world.js';
import { ITEMS, SLOTS, EQUIPMENT_DEFAULTS, makeEquipmentFor, makeNamedEquip, randomSlot, itemSell, refinePlan } from '../data/items.js';
import { NAMED_EQUIPMENT, matchesNamedEquip, equipmentForShop } from '../data/named-equipment.js';
import { gearWearRequirements, allowedWeaponClasses, matchesGearSpec } from '../data/gear-specs.js';
import { getProductionRecipes, productionTier, LUNAR_MATERIAL_DROPS } from '../data/production.js';
import { productionAction } from './production.js';
import { matchesHighEquip } from '../data/high-equipment.js';
import { buildMainline, makeBounty, BOUNTY_DAILY } from '../data/quests.js';
import { ENCOUNTERS, ENCOUNTER_IDS } from '../data/encounters.js';
import { createPlayer, stats, recommendedAttributes, gainExp, expNeed, makeMonster, monsterReward, BAG_LIMIT, dayKey } from './model.js';
import { createBattle, takeTurn, pickAutoAction } from './combat.js';

import { validateSnapshot } from './schema.js';
import { ensureEquipment, wearEquipment, validateEquipment } from './equipment.js';
import { ensureEconomy } from './economy.js';

const own = (obj, key) => Object.hasOwn(obj, key);
export const validateSave = validateSnapshot;

export class Game {
  constructor(snapshot = null) {
    this.state = snapshot || { version: 2, player: null, journal: [], battle: null };
    this.message = '';
  }
  get p() { return this.state.player; }
  get battle() { return this.state.battle; }
  get busy() { return !!this.battle && !this.battle.result; }
  get quests() { return this.p ? buildMainline(this.p.race) : []; }
  get mainQuest() { return this.quests[this.p?.mainIndex] || null; }
  event(text, kind = 'system') {
    this.state.journal.push({ text, kind, time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) });
    this.state.journal = this.state.journal.slice(-60);
    this.message = text;
  }
  export() { return JSON.stringify(this.state, null, 2); }
  start(name, cls) {
    if (!own(CLASSES, cls) || !name.trim() || [...name.trim()].length > 12) throw new Error('名字需为1—12个字。');
    this.state = { version: 2, player: createPlayer(name.trim(), cls), journal: [], battle: null };
    ensureEquipment(this.p); ensureEconomy(this.p); this.p.daily.arena = 0;
    this.event(`欢迎，${name.trim()}。${CLASSES[cls].name}的修行从这里开始。`);  }
  refreshDay() {
    if (this.p && this.p.daily.day !== dayKey()) this.p.daily = { day: dayKey(), bounties: 0, dungeons: {}, signed: false, arena: 0 };
  }
  addItem(id, qty = 1) { this.p.items[id] = (this.p.items[id] || 0) + qty; }
  putEquip(it) {
    if (this.p.bag.length < BAG_LIMIT) { this.p.bag.push(it); return true; }
    if (it.bound) throw new Error('背包已满，绑定装备不能自动出售。');
    this.p.gold += itemSell(it); this.event(`背包已满，${it.name}自动折为${itemSell(it)}金币。`); return false;
  }
  awardExp(amount) {
    const n = gainExp(this.p, amount);
    if (n) this.event(`突破！升至${this.p.lv}级，获得${n * 5}点自由属性，生命与真气恢复。`, 'victory');
    return n;
  }
  allocate(key, qty = 1) {
    if (this.busy || !['str', 'con', 'dex', 'mag'].includes(key) || !Number.isInteger(qty) || qty < 1 || this.p.points < qty) throw new Error('没有足够的属性点，或正在战斗。');
    this.p.attrs[key] += qty; this.p.points -= qty;
    this.event('属性已提升。');  }
  autoAllocate() {
    if (this.busy) throw new Error('战斗中无法加点。');
    if (!this.p.points) throw new Error('没有自由属性点。');
    const allocation = recommendedAttributes(this.p);
    for (const [key, quantity] of Object.entries(allocation)) this.p.attrs[key] += quantity;
    this.p.points -= Object.values(allocation).reduce((sum, quantity) => sum + quantity, 0);
    this.event('已优先补足当前等级武器与护甲需求，再分配主攻和体质。');  }
  travel(id, teleport = false) {
    if (this.busy) throw new Error('先结束当前战斗。');
    const z = ZONES[id]; if (!z) throw new Error('目的地不存在。');
    const from = ZONES[this.p.location];
    if (this.p.lv < z.lv[0] - 5 || (z.minCult && this.p.cult < z.minCult)) throw new Error(`需要${Math.max(1, z.lv[0] - 5)}级${z.minCult ? '与仙魔修为' : ''}才能进入。`);
    if (teleport) {
      if (from.type !== 'city' || z.type !== 'city' || !this.p.discovered.includes(id)) throw new Error('只能在城市间传送到已探索的城市。');
      if (id === this.p.location) throw new Error('已经在这里了。');
      const fee = 20 + this.p.lv * 3;
      if (this.p.gold < fee) throw new Error('传送金币不足。'); this.p.gold -= fee;
    } else if (!from.links.includes(id)) throw new Error('只能前往相邻地点。');
    this.p.location = id;
    if (!this.p.discovered.includes(id)) this.p.discovered.push(id);
    if (!this.p.visits.includes(id)) this.p.visits.push(id);
    if (z.type === 'city') this.p.lastCity = id;
    this.p.encounter = null; this.state.battle = null; this.event(`抵达${z.name}。`);  }
  rest() {
    if (this.busy || ZONES[this.p.location].type !== 'city') throw new Error('只能在城镇休息。');
    const s = stats(this.p); const fee = 5 + this.p.lv * 2;
    if (this.p.hp >= s.hp && this.p.mp >= s.mp) throw new Error('生命与真气已满。');
    if (this.p.gold < fee) throw new Error('休息金币不足，可使用药品恢复。');
    this.p.gold -= fee; this.p.hp = s.hp; this.p.mp = s.mp;
    this.event(`客栈休息，花费${fee}金币，状态已恢复。`);  }
  useItem(id) {
    if (this.busy) return this.turn(`item:${id}`);
    const it = ITEMS[id]; if (!it || !(this.p.items[id] > 0)) throw new Error('物品不足。');
    if (this.p.lv < it.lv) throw new Error(`需要${it.lv}级才能使用。`);
    const s = stats(this.p);
    if (it.type === 'hp' || it.type === 'mp') {
      const k = it.type;
      if (this.p[k] >= s[k]) throw new Error(`${k === 'hp' ? '生命' : '真气'}已满。`);
      this.p[k] = Math.min(s[k], this.p[k] + it.value);
    } else if (it.type === 'town') {
      this.p.location = this.p.lastCity; this.p.encounter = null; this.state.battle = null;
    } else if (it.type === 'exp') this.p.expBoost += it.value;
    else throw new Error('这件物品不能直接使用。');
    this.p.items[id]--; this.event(`使用${it.name}。`);  }
  buy(id, qty = 1) {
    if (this.busy || ZONES[this.p.location].type !== 'city') throw new Error('请先前往城镇。');
    const it = ITEMS[id];
    if (!it || !it.price || it.lv > this.p.lv + 5 || !Number.isInteger(qty) || qty < 1 || qty > 99) throw new Error('无法购买。');
    if (this.p.gold < it.price * qty) throw new Error('金币不足。');
    this.p.gold -= it.price * qty; this.addItem(id, qty); this.event(`购买${it.name} × ${qty}。`);  }
  buyEquip(templateId) {
    if (!this.p || this.busy || ZONES[this.p.location]?.type !== 'city') throw new Error('请在城镇装备商购买。');
    const listing = equipmentForShop(this.p).find((entry) => entry.templateId === templateId);
    if (!listing || listing.lv > this.p.lv) throw new Error('该具名模板不在当前装备商列表中。');
    if (!Array.isArray(this.p.bag) || this.p.bag.length >= BAG_LIMIT) throw new Error('背包已满。');
    if (!Number.isSafeInteger(this.p.gold) || this.p.gold < listing.price) throw new Error('金币不足。');
    const it = makeNamedEquip(listing.templateId, { origin: 'shop' });
    validateEquipment(it);
    if ([...this.p.bag, ...Object.values(this.p.equipment)].some((owned) => owned.uid === it.uid)) throw new Error('新装备UID冲突，请重试。');
    this.p.gold -= listing.price; this.p.bag.push(it); this.event(`购入${it.name}，可在背包装备；金币价格为本作适配。`);
    return structuredClone(it);
  }
  equip(uid, slot = null) {
    if (this.busy) throw new Error('战斗中无法更换装备。');
    const i = this.p.bag.findIndex((it) => it.uid === uid); if (i < 0) throw new Error('装备不存在。');
    const it = this.p.bag[i];
    validateEquipment({ ...structuredClone(EQUIPMENT_DEFAULTS), ...it });
    const target = slot || (it.slot === 'ring1' && this.p.equipment.ring1 && !this.p.equipment.ring2 ? 'ring2' : it.slot);
    if (target !== it.slot && !(it.slot === 'ring1' && target === 'ring2')) throw new Error('栏位不符。');
    if (it.ruleVersion === 2 || own(NAMED_EQUIPMENT, it.templateId)) {
      if (!matchesNamedEquip(it)) throw new Error('装备与具名来源模板不符。');
      if (!it.classes.includes(this.p.cls)) throw new Error('该来源武器类型不适用于当前职业。');
      const remaining = Object.fromEntries(Object.entries(this.p.equipment).filter(([key]) => key !== target));
      const available = stats({ ...this.p, equipment: remaining });
      if (it.lv > this.p.lv || Object.entries(it.requirements).some(([key, need]) => need !== null && (!Number.isFinite(available[key]) || available[key] < need))) throw new Error('等级或来源力量、体质、敏捷、灵力需求不足（不含被替换栏位）。');
    } else if (own(it, 'templateId') || it.q === 4 || it.grade > 16) {
      if (!matchesHighEquip(it)) throw new Error('高阶装备与官方固定模板不符。');
      if (this.p.lv !== 105 || (it.classes !== null && !it.classes.includes(this.p.cls))) throw new Error('神铸装备需要105级及允许的职业。');
      // 不计算目标装备或被换下装备，避免靠该槽属性自撑门槛。
      const remaining = Object.fromEntries(Object.entries(this.p.equipment).filter(([key]) => key !== target));
      const available = stats({ ...this.p, equipment: remaining });
      if (Object.entries(it.requirements).some(([key, need]) => !Number.isFinite(available[key]) || available[key] < need)) throw new Error('力量、体质、敏捷或灵力不满足神铸装备需求（不含被替换栏位）。');
    } else if (it.ruleVersion === 1) {
      if (!matchesGearSpec(it)) throw new Error('装备不符合生成规范。');
      if (it.weaponType && !allowedWeaponClasses(it.weaponType).includes(this.p.cls)) throw new Error('该专属武器不适用于当前职业。');
      const remaining = Object.fromEntries(Object.entries(this.p.equipment).filter(([key]) => key !== target));
      const available = stats({ ...this.p, equipment: remaining });
      const missing = Object.entries(gearWearRequirements(it)).filter(([key, need]) => (key === 'lv' ? this.p.lv : available[key]) < need);
      if (missing.length) throw new Error(`穿戴条件不足：${missing.map(([key, need]) => `${key === 'lv' ? '等级' : { str: '力量', con: '体质', dex: '敏捷', mag: '灵力' }[key]}${need}`).join('、')}（不含被替换栏位）。`);
    } else if (it.lv > this.p.lv || (it.cls && it.cls !== this.p.cls)) throw new Error('等级或职业不符合要求。');
    this.p.bag.splice(i, 1);
    if (this.p.equipment[target]) this.p.bag.push(this.p.equipment[target]);
    this.p.equipment[target] = it;
    const s = stats(this.p); this.p.hp = Math.min(this.p.hp, s.hp); this.p.mp = Math.min(this.p.mp, s.mp);
    this.event(`装备${it.name}。`);  }
  unequip(slot) {
    if (this.busy || !own(SLOTS, slot) || !this.p.equipment[slot]) throw new Error('不能卸下该装备。');
    if (this.p.bag.length >= BAG_LIMIT) throw new Error('背包已满。');
    this.p.bag.push(this.p.equipment[slot]); delete this.p.equipment[slot];
    const s = stats(this.p); this.p.hp = Math.min(this.p.hp, s.hp); this.p.mp = Math.min(this.p.mp, s.mp);
    this.event('装备已卸下至行囊。');
  }
  sell(uid) {
    if (this.busy || ZONES[this.p.location].type !== 'city') throw new Error('请在城镇出售。');
    const i = this.p.bag.findIndex((it) => it.uid === uid); if (i < 0) throw new Error('装备不存在。');
    validateEquipment({ ...structuredClone(EQUIPMENT_DEFAULTS), ...this.p.bag[i] });
    if (this.p.bag[i].bound) throw new Error('绑定装备不能出售。');
    const [it] = this.p.bag.splice(i, 1); const money = itemSell(it); this.p.gold += money;
    this.event(`售出${it.name}，获得${money}金币。`);  }
  sellCommon() {
    if (this.busy || ZONES[this.p.location].type !== 'city') throw new Error('请在城镇出售。');
    for (const it of this.p.bag) validateEquipment({ ...structuredClone(EQUIPMENT_DEFAULTS), ...it });
    let money = 0; let count = 0;
    this.p.bag = this.p.bag.filter((it) => { if (it.q > 0 || it.refine > 0 || it.bound || it.sockets.length) return true; money += itemSell(it); count++; return false; });
    this.p.gold += money; this.event(`出售${count}件未精炼普通装备，获得${money}金币。`);  }
  learn(id) {
    if (this.busy || ZONES[this.p.location].type !== 'city') throw new Error('请在城镇找技能导师。');
    const sk = findSkill(this.p.cls, id); if (!sk) throw new Error('技能不存在。');
    const to = (this.p.skills[id] || 0) + 1; const req = skillReq(sk, to);
    if (to > sk.maxLv || this.p.lv < req.level || this.p.cult < (sk.cult || 0)) throw new Error('等级或修真境界不足。');
    if (this.p.sp < req.sp || this.p.gold < req.gold) throw new Error('元神或金币不足。');
    this.p.sp -= req.sp; this.p.gold -= req.gold; this.p.skills[id] = to;
    this.event(`${sk.name}提升至${to}级。`);  }
  refine(slot, aid = '') {
    if (this.busy || !ZONES[this.p.location].npcs?.includes('refine')) throw new Error('请在城镇精炼师处操作。');
    const it = this.p.equipment[slot]; if (!it) throw new Error('装备不存在。');
    validateEquipment({ ...structuredClone(EQUIPMENT_DEFAULTS), ...it });
    const { stones, cost, rate, failLevel } = refinePlan(it, aid);
    if ((this.p.items.huanxian || 0) < stones || this.p.gold < cost || (aid && !(this.p.items[aid] > 0))) throw new Error('金币、幻仙石或辅助材料不足。');
    this.p.gold -= cost; this.p.items.huanxian -= stones; if (aid) this.p.items[aid]--;
    if (Math.random() < rate) { it.refine++; this.event(`${it.name}精炼成功！+${it.refine}`, 'victory'); }
    else { it.refine = failLevel; this.event(`精炼失败。${it.name}现为+${it.refine}。`, 'danger'); }
    const s = stats(this.p); this.p.hp = Math.min(this.p.hp, s.hp);  }
  forge(slot, quality = 1) {
    if (this.busy || ZONES[this.p.location].type !== 'city' || !own(SLOTS, slot) || slot === 'ring2' || ![1, 2].includes(quality)) throw new Error('无法打造。');
    const recipe = getProductionRecipes(this.p.cls).filter((entry) => entry.series === 'local-tutorial' && entry.slot === slot && entry.lv <= this.p.lv).at(-1);
    if (!recipe) throw new Error('没有对应等级的生产配方。');
    return productionAction(this, 'produce', { recipeId: recipe.id, confirm: true });  }
  questProgress(q, isBounty = false) {
    if (!q) return { done: 0, total: 0, ready: false };
    let done = 0; let total = 1;
    if (q.goal.type === 'kill') { total = q.goal.count; done = isBounty ? this.p.bountyProgress : this.p.mainProgress; }
    else if (q.goal.type === 'level') { total = q.goal.lv; done = this.p.lv; }
    else if (q.goal.type === 'cult') { total = q.goal.rank; done = this.p.cult; }
    else if (q.goal.type === 'visit') done = this.p.visits.includes(q.goal.zone) ? 1 : 0;
    else if (q.goal.type === 'dungeon') done = this.p.clears[q.goal.id] || 0;
    return { done: Math.min(done, total), total, ready: done >= total };
  }
  claimQuest(isBounty = false) {
    if (this.busy) throw new Error('先结束战斗。');
    const q = isBounty ? this.p.bounty : this.mainQuest;
    if (!q || !this.questProgress(q, isBounty).ready) throw new Error('任务目标尚未完成。');
    const exp = Math.round(expNeed(Math.min(105, q.rlv)) * q.rexp);
    const sp = Math.round((100 + q.rlv * q.rlv * 1.5) * q.rsp); const gold = Math.round(150 + q.rlv * 100);
    this.p.sp += sp; this.p.gold += gold;
    if (q.equip != null) this.putEquip(makeEquipmentFor(randomSlot(), Math.min(105, q.rlv), q.equip, this.p.cls, { origin: isBounty ? 'bounty' : 'quest' }));
    const starterKit = !isBounty && this.p.mainIndex === 0;
    if (isBounty) { this.p.bounty = null; this.p.bountyProgress = 0; this.p.daily.bounties++; }
    else {
      if (starterKit) for (const id of ['ore1', 'wood1', 'fiber1', 'hide1']) this.addItem(id, 3);
      this.p.mainIndex++; this.p.mainProgress = 0;
    }
    this.event(`完成「${q.title}」：经验+${exp}、元神+${sp}、金币+${gold}。${starterKit ? '新手生产材料包：铁矿、原木、棉线、动物皮毛各3份；返回城镇可制造第一件装备（本作奖励）。' : ''}`, 'victory');
    this.awardExp(exp);  }
  acceptBounty() {
    this.refreshDay();
    if (this.busy || ZONES[this.p.location].type !== 'city') throw new Error('请在城镇接取赏金。');
    if (this.p.bounty || this.p.daily.bounties >= BOUNTY_DAILY) throw new Error('已有赏金，或今日已完成10次。');
    this.p.bounty = makeBounty(this.p.lv); this.p.bountyProgress = 0;
    this.event(`接取「${this.p.bounty.title}」。`);  }
  signIn() {
    this.refreshDay(); if (this.p.daily.signed) throw new Error('今天已领取。');
    if (this.busy) throw new Error('先结束战斗。');
    this.p.daily.signed = true; this.p.gold += 300 + this.p.lv * 50; this.addItem('huanxian', 3); this.addItem('julin');
    this.event('今日补给已领取：金币、幻仙石×3、聚灵丹×1。', 'victory');  }
  redeemCards() {
    if (this.busy || ZONES[this.p.location].type !== 'city') throw new Error('请在城镇兑换。');
    const count = this.p.items.card || 0; if (!count) throw new Error('没有BOSS凭证。');
    const sp = count * (100 + this.p.lv * 30); this.p.items.card = 0; this.p.sp += sp;
    this.event(`兑换${count}张BOSS凭证，元神+${sp}。`);  }
  hunt(index) {
    if (this.busy) throw new Error('已有战斗进行中。');
    if (this.p.hp <= 0) throw new Error('请先恢复生命。');
    const z = ZONES[this.p.location]; const m = z.mobs?.[index];
    if (!m) throw new Error('这里没有这个敌人。');
    this.p.encounter = null;
    this.state.battle = createBattle(this.p, [makeMonster(...m)], { type: 'field', zone: this.p.location });
    this.event(`遭遇${m[0]}，战斗开始。`);
  }
  questTargets(z) {
    const zone = this.p.location;
    const goals = [this.mainQuest?.goal.type === 'kill' && this.mainQuest.zone === zone ? this.mainQuest.goal.mob : null,
      this.p.bounty?.zone === zone ? this.p.bounty.goal.mob : null];
    return z.mobs.filter((m) => goals.includes(m[0]));
  }
  startFieldFight(m, intro, { ambush = false, surprise = false } = {}) {
    this.state.battle = createBattle(this.p, [makeMonster(...m)], { type: 'field', zone: this.p.location, ...(ambush ? { ambush: true } : {}) });
    const b = this.state.battle;
    if (surprise) b.monsters[0].intent = 'heavy';
    b.logs.push({ text: intro, kind: surprise ? 'danger' : 'system' });
    if (surprise) b.logs.push({ text: `${m[0]}已经蓄满力量——下回合将发动重击！先「防御调息」格挡，再伺机反击。`, kind: 'danger' });
    if (ambush) b.logs.push({ text: `${m[0]}还没反应过来，露出了破绽——这回合全力出手伤害+50%！`, kind: 'victory' });
    this.event(intro);
  }
  gather(resource) {
    if (this.busy || this.p.encounter) throw new Error('先处理战斗或眼前奇遇。');
    const zone = ZONES[this.p.location];
    if (zone.type !== 'field' || !['ore', 'wood', 'fiber'].includes(resource)) throw new Error('只能在野外采集矿石、木材或纤维。');
    if (this.p.hp <= 0) throw new Error('请先恢复生命。');
    const now = Date.now();
    if (now - (this.p.lastGatherAt || 0) < 2000) throw new Error('采集间隔为2秒，请稍候。');
    const tier = productionTier(Math.min(this.p.lv, zone.lv[0]));
    const id = `${resource}${tier}`; const quantity = Math.random() < 0.3 ? 2 : 1;
    this.addItem(id, quantity); this.p.lastGatherAt = now;
    this.event(`采集获得${ITEMS[id].name}×${quantity}；皮料来自战斗，材料等级与区域按本作适配。`, 'victory');
    return { id, quantity };
  }
  explore() {
    if (this.busy) throw new Error('先结束当前战斗。');
    if (this.p.encounter) throw new Error('先处理眼前的奇遇。');
    const z = ZONES[this.p.location];
    if (z.type !== 'field') throw new Error('城镇里很安全，没有可探索的野外。先出城吧。');
    if (this.p.hp <= 0) throw new Error('请先恢复生命。');
    this.state.battle = null;
    const lv = this.p.lv; const rand = Math.random();
    const pick = (list) => list[Math.floor(Math.random() * list.length)];
    const targets = this.questTargets(z);
    const normal = z.mobs.filter((m) => !m[2]);
    const fair = normal.filter((m) => m[1] <= lv + 2);
    const nearest = [...normal].sort((a, b) => Math.abs(a[1] - lv) - Math.abs(b[1] - lv))[0];
    const elite = z.mobs.find((m) => m[2] === 'elite');
    const place = pick(['草丛里', '树后', '岩石背后', '薄雾中', '小路尽头']);
    if (this.p.totals.battles < 2 || rand < 0.62) {
      const normalTargets = targets.filter((m) => !m[2]); const eliteTargets = targets.filter((m) => m[2] === 'elite');
      const gentle = normal.filter((x) => x[1] <= lv).sort((x, y) => y[1] - x[1])[0] || nearest;
      const m = normalTargets.length && (this.p.totals.battles < 2 || Math.random() < 0.55) ? pick(normalTargets)
        : this.p.totals.battles < 2 ? gentle
        : eliteTargets.length && Math.random() < 0.3 ? pick(eliteTargets) : fair.length ? pick(fair) : nearest;
      const roll = this.p.totals.battles < 3 ? 1 : Math.random();
      if (roll < 0.22) this.startFieldFight(m, `你发现了一只${m[0]}，它还没察觉到你——偷袭！`, { ambush: true });
      else if (roll < 0.32) this.startFieldFight(m, `${m[0]}从${place}猛扑出来！`, { surprise: true });
      else this.startFieldFight(m, `你在${z.name}四处搜寻，${m[0]}从${place}窜了出来！`);
      return { kind: 'fight', text: this.message };
    }
    if (rand < 0.76) {
      const finds = [
        () => { const n = 20 + lv * 8 + Math.floor(Math.random() * (10 + lv * 4)); this.p.gold += n; return `你在倒下的旅人行囊里找到${n}金币。`; },
        () => { const id = lv >= 15 ? 'hp2' : 'hp1'; const n = 1 + Math.floor(Math.random() * 2); this.addItem(id, n); return `${place}有一个遗落的药包：${ITEMS[id].name}×${n}。`; },
        () => { this.addItem('huanxian'); return '岩缝中闪着微光——是一枚幻仙石！'; },
        () => { const s = stats(this.p); const before = this.p.hp; this.p.hp = Math.min(s.hp, this.p.hp + Math.round(s.hp * 0.35)); return `你采到一株止血草，嚼碎敷上，生命恢复${this.p.hp - before}点。`; },
      ];
      const text = pick(finds)(); this.event(text, 'victory');
      return { kind: 'find', text };
    }
    if (rand < 0.94) {
      const ids = ENCOUNTER_IDS.filter((id) => !ENCOUNTERS[id].needsElite || (elite && elite[1] <= lv + 3));
      const id = pick(ids);
      const mob = ENCOUNTERS[id].needsElite ? elite[0] : (fair.length ? pick(fair) : nearest)[0];
      this.p.encounter = { id, zone: this.p.location, mob };
      const text = `奇遇 · ${ENCOUNTERS[id].title}`; this.event(text);
      return { kind: 'encounter', text };
    }
    if (elite && elite[1] <= lv + 2 && Math.random() < 0.5) {
      this.startFieldFight(elite, `一只落单的${elite[0]}正在附近游荡……它也看见了你！`);
      return { kind: 'fight', text: this.message };
    }
    this.p.expBoost += 3;
    const text = '你误入一处灵气充沛的洞府，浑身经脉通畅：接下来3场战斗双倍经验！';
    this.event(text, 'victory');
    return { kind: 'rare', text };
  }
  chooseEncounter(choiceId) {
    if (this.busy) throw new Error('先结束当前战斗。');
    const enc = this.p.encounter;
    if (!enc || enc.zone !== this.p.location) { this.p.encounter = null; throw new Error('眼前没有奇遇。'); }
    const def = ENCOUNTERS[enc.id]; const choice = def.choices.find((c) => c.id === choiceId);
    if (!choice) throw new Error('没有这个选项。');
    const reason = choice.require?.(this.p);
    if (reason) throw new Error(reason);
    this.p.encounter = null; this.state.battle = null;
    const z = ZONES[this.p.location]; const lv = this.p.lv;
    const lines = []; const gains = []; let fight = null; let exp = 0;
    const h = {
      p: this.p, lv, zone: z.name, mob: enc.mob, roll: Math.random,
      say: (text) => lines.push(text),
      gold: (n) => { this.p.gold += n; gains.push(`金币+${n}`); },
      pay: (n) => { this.p.gold -= n; gains.push(`金币-${n}`); },
      sp: (n) => { this.p.sp += n; gains.push(`元神+${n}`); },
      exp: (frac) => { const n = Math.round(expNeed(lv) * frac); exp += n; gains.push(`经验+${n}`); },
      item: (id, qty) => { this.p.items[id] = Math.max(0, (this.p.items[id] || 0) + qty); gains.push(`${ITEMS[id].name}${qty > 0 ? '+' : ''}${qty}`); },
      equip: (q) => { const it = makeEquipmentFor(randomSlot(), lv, q, this.p.cls, { origin: `encounter:${enc.id}` }); this.putEquip(it); gains.push(it.name); },
      heal: (frac) => { const s = stats(this.p); this.p.hp = Math.min(s.hp, this.p.hp + Math.round(s.hp * frac)); this.p.mp = Math.min(s.mp, this.p.mp + Math.round(s.mp * frac)); gains.push('生命真气恢复'); },
      hurt: (frac) => { const n = Math.min(this.p.hp - 1, Math.round(stats(this.p).hp * frac)); this.p.hp -= n; gains.push(`生命-${n}`); },
      boost: (n) => { this.p.expBoost += n; gains.push(`双倍经验+${n}场`); },
      fight: (name, mobLv, rank, opts = {}) => {
        const known = z.mobs.find((m) => m[0] === name);
        fight = [name, Math.max(1, Math.min(105, mobLv ?? known?.[1] ?? lv)), !known && lv < 8 ? '' : rank, known?.[3] || 'phys', opts];
      },
    };
    choice.resolve(h);
    const text = `${def.title} · ${choice.label}：${lines.join('')}${gains.length ? `（${gains.join('，')}）` : ''}`;
    this.event(text, fight ? 'danger' : 'victory');
    if (exp) this.awardExp(exp);
    if (fight) { const [name, mobLv, rank, type, opts] = fight; this.startFieldFight([name, mobLv, rank, type], lines.at(-1), opts); }
    return { kind: fight ? 'fight' : 'resolved', text };
  }
  enterDungeon(id) {
    if (this.busy || this.p.encounter) throw new Error('请先结束战斗或处理当前奇遇。');
    const d = DUNGEONS.find((x) => x.id === id);
    if (!d) throw new Error('副本不存在。');
    if (!d.entrance.includes(this.p.location)) throw new Error(`请先前往${d.entrance.map((zone) => ZONES[zone].name).join('、')}的副本入口或接引点。`);
    if (this.p.lv < d.lv - 3) throw new Error('等级不足。');
    const today = dayKey();
    const daily = this.p.daily.day === today ? this.p.daily : { day: today, bounties: 0, dungeons: {}, signed: false, arena: 0 };
    if ((daily.dungeons[id] || 0) >= DUNGEON_DAILY) throw new Error('今日进入次数已用尽（3次）。');
    this.p.daily = daily;
    daily.dungeons[id] = (daily.dungeons[id] || 0) + 1;
    this.startDungeonWave(d, 0); this.event(`进入${d.name}，每日次数已消耗。`);  }
  startDungeonWave(d, wave) {
    const bossWave = wave >= (d.waves || 3);
    const mobs = bossWave ? [makeMonster(d.boss, d.lv, 'boss', 'magic')] : [0, 1].map((i) => makeMonster(d.mobs[(wave + i) % d.mobs.length], Math.max(1, d.lv - 2 + wave), '', i ? 'magic' : 'phys', i));
    this.state.battle = createBattle(this.p, mobs, { type: 'dungeon', id: d.id, wave, bossWave, noEscape: false });
  }
  nextWave() {
    const b = this.battle;
    if (!b || b.result !== 'win' || b.context.type !== 'dungeon' || b.context.bossWave) throw new Error('没有下一波。');
    const d = DUNGEONS.find((x) => x.id === b.context.id);
    this.startDungeonWave(d, b.context.wave + 1); this.event('深入副本，新的敌人出现。');
  }
  enterTrial() {
    if (this.busy || ZONES[this.p.location].type !== 'city') throw new Error('请在城镇修真导师处进行试炼。');
    const rank = this.p.cult + 1; const c = CULTIVATION[rank]; const t = CULT_TRIALS[rank];
    if (!c || this.p.lv < c.lv || this.p.trialReady) throw new Error('等级不足、境界已满，或试炼已经完成。');
    const m = makeMonster(t.boss, t.lv, 'elite', rank % 2 ? 'phys' : 'magic');
    this.state.battle = createBattle(this.p, [m], { type: 'cult', rank, noEscape: false });
    this.event(`踏入${t.title}。${t.story}`);
  }
  breakthrough(path = null) {
    if (this.busy || ZONES[this.p.location].type !== 'city') throw new Error('请在城镇突破。');
    const rank = this.p.cult + 1; const c = CULTIVATION[rank];
    if (!c || !this.p.trialReady || this.p.lv < c.lv || this.p.sp < c.sp) throw new Error('需要完成试炼，并备足元神。');
    if (c.path && !this.p.path) {
      if (!['sage', 'demon'].includes(path)) throw new Error('请选择仙或魔。');
      this.p.path = path;
    }
    this.p.sp -= c.sp; this.p.cult = rank; this.p.trialReady = false;
    const s = stats(this.p); this.p.hp = s.hp; this.p.mp = s.mp;
    this.event('修真突破！生命与真气恢复，永久属性提升。', 'victory');  }
  arena() {
    this.refreshDay();
    if (this.busy || ZONES[this.p.location].type !== 'city' || this.p.lv < 20) throw new Error('需20级，在城镇参加比武。');
    if ((this.p.daily.arena || 0) >= 3) throw new Error('今日比武次数已用尽。');
    this.p.daily.arena = (this.p.daily.arena || 0) + 1;
    this.state.battle = createBattle(this.p, [makeMonster('试剑客·凌风（NPC）', this.p.lv, 'elite')], { type: 'arena' });  }
  turn(action, targetId) {
    if (!this.busy) throw new Error('当前没有战斗。');
    const b = this.battle; const result = takeTurn(this.p, b, action, targetId);
    if (result) this.resolveBattle(); return result;
  }
  autoTurn() {
    if (!this.busy) return;
    const { action, targetId } = pickAutoAction(this.p, this.battle); return this.turn(action, targetId);
  }
  resolveBattle() {
    const b = this.battle; const ctx = b.context;
    wearEquipment(this.p);
    const s = stats(this.p); this.p.hp = Math.min(this.p.hp, s.hp); this.p.mp = Math.min(this.p.mp, s.mp);
    if (b.result === 'win') {
      this.p.totals.battles++;
      if (ctx.type === 'cult') { this.p.trialReady = true; this.event('修真试炼通过，返回导师处消耗元神突破。', 'victory'); return; }
      if (ctx.type === 'arena') { this.p.sp += 500 + this.p.lv * 50; this.p.gold += 500 + this.p.lv * 100; this.event('比武获胜，元神与金币奖励到账。', 'victory'); return; }
      let exp = 0; let sp = 0; let gold = 0; const loot = []; const itemsBefore = { ...this.p.items };
      const dungeon = ctx.type === 'dungeon' ? DUNGEONS.find((entry) => entry.id === ctx.id) : null;
      const materialsOnly = dungeon && ['twilight', 'lunar', 'nirvana'].includes(dungeon.family);
      for (const m of b.monsters) {
        const r = monsterReward(m); exp += r.exp; sp += r.sp; gold += r.gold;
        this.p.kills[m.name] = (this.p.kills[m.name] || 0) + 1;
        if (this.mainQuest?.goal.type === 'kill' && this.mainQuest.goal.mob === m.name && this.mainQuest.zone === ctx.zone) this.p.mainProgress++;
        if (this.p.bounty?.goal.mob === m.name && this.p.bounty.zone === ctx.zone) this.p.bountyProgress++;
        if (!materialsOnly && Math.random() < (m.rank === 'boss' ? 1 : m.rank === 'elite' ? 0.7 : 0.22)) {
          const it = makeEquipmentFor(randomSlot(), m.lv, 0, this.p.cls, { origin: ctx.type === 'dungeon' ? `dungeon:${ctx.id}` : `field:${ctx.zone}` }); this.putEquip(it); loot.push({ name: it.name, q: it.q, templateId: it.templateId });
        }
        if (ctx.type === 'field') this.addItem(`hide${productionTier(m.lv)}`);
        if (m.rank === 'boss') { this.addItem('card'); this.addItem('huanxian', 3); }
        else if (Math.random() < 0.12) this.addItem('huanxian');
        if (Math.random() < 0.2) this.addItem(m.type === 'magic' ? 'mp1' : 'hp1');
      }
      if (this.p.expBoost > 0) { exp *= 2; this.p.expBoost--; }
      this.p.sp += sp; this.p.gold += gold; this.p.totals.earned += gold;
      if (ctx.type === 'dungeon' && ctx.bossWave) {
        this.p.clears[ctx.id] = (this.p.clears[ctx.id] || 0) + 1;
        const d = DUNGEONS.find((x) => x.id === ctx.id);
        if (d.family === 'twilight') {
          const material = { d75: 'tt1', d85: 'tt2', d95: 'tt3' }[d.id];
          this.addItem(material, 4);
        } else if (d.family === 'lunar') {
          this.addItem('lunarEssence', 4);
          for (const [id, qty] of Object.entries(LUNAR_MATERIAL_DROPS)) this.addItem(id, qty);
          const text = '神月具名材料每种各1份；分配与数量是本作掉落适配，制造用量按来源逐件精确配方。';
          this.event(text, 'victory'); b.logs.push({ text, kind: 'victory' });
        }
        else if (d.family === 'nirvana') { this.addItem('rapture', 4); this.addItem('uncanny', 4); }
        else {
          const it = makeEquipmentFor('weapon', d.lv, 2, this.p.cls, { origin: `dungeon:${d.id}` });
          this.putEquip(it); loot.push({ name: it.name, q: it.q, templateId: it.templateId });
        }
        this.addItem('tiangang'); this.addItem('huanxian', 5);
        if (d.lv >= 75) {
          this.addItem('highForgeSigil', 2);
          const text = '75级以上副本首领奖励：神铸凭证·本作×2，用于具名高阶装备兑换或升阶。';
          this.event(text, 'victory'); b.logs.push({ text, kind: 'victory' });
        }
        this.event(`${d.name}通关！${materialsOnly ? '生产材料' : '成品装备'}、天罡石及幻仙石已到账。`, 'victory');
      }
      const summary = `胜利！经验+${exp}，元神+${sp}，金币+${gold}${loot.length ? `。获得：${loot.map((x) => x.name).join('、')}` : ''}`;
      this.event(summary, 'victory'); b.logs.push({ text: summary, kind: 'victory' });
      const levelUps = this.awardExp(exp);
      const items = Object.entries(this.p.items).filter(([id, n]) => n > (itemsBefore[id] || 0)).map(([id, n]) => ({ id, qty: n - (itemsBefore[id] || 0) }));
      const q = [this.mainQuest && this.mainQuest.zone === ctx.zone && this.mainQuest.goal.type === 'kill' && b.monsters.some((m) => m.name === this.mainQuest.goal.mob) ? this.mainQuest : null,
        this.p.bounty && this.p.bounty.zone === ctx.zone && b.monsters.some((m) => m.name === this.p.bounty.goal.mob) ? this.p.bounty : null].find(Boolean);
      const progress = q ? this.questProgress(q, q === this.p.bounty) : null;
      b.rewards = { exp, sp, gold, loot: loot.slice(0, 10), items: items.slice(0, 10), levelUps,
        quest: q && progress ? { title: String(q.title).slice(0, 100), done: Math.min(progress.done, progress.total), total: progress.total } : null };
    } else if (b.result === 'lose') {
      this.p.totals.deaths++;
      if (this.p.items.revive > 0) {
        this.p.items.revive--; this.p.hp = Math.ceil(s.hp * 0.5); this.p.mp = Math.ceil(s.mp * 0.5);
        this.event('自动消耗复活卷轴，生命与真气恢复50%，经验无损失。本场挑战失败。', 'danger');
      } else {
        const lost = Math.floor(this.p.exp * 0.05); this.p.exp -= lost; this.p.location = this.p.lastCity;
        this.p.hp = Math.ceil(s.hp * 0.5); this.p.mp = Math.ceil(s.mp * 0.5);
        this.event(`阵亡，返回${ZONES[this.p.lastCity].name}，损失当前经验${lost}（5%），恢复50%状态。`, 'danger');
      }
    } else this.event('已退出战斗。副本退出后须重新消耗进入次数。');
  }
}
