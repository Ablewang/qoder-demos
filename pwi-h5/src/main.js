import { RACES, CLASSES, SKILLS, ELEMENTS, skillReq, skillResources } from './data/classes.js';
import { ZONES, CULTIVATION, CULT_TRIALS, cultName, DUNGEONS } from './data/world.js';
import { ITEMS, SLOTS, STAT_NAMES, EQUIPMENT_SETS, equipStats, itemSell, shopList, refineGain, refinePlan } from './data/items.js';
import { GEAR_RULES, gearWearRequirements, allowedWeaponClasses } from './data/gear-specs.js';
import { ITEM_COLOR_PALETTE, ITEM_COLOR_NOTE, itemColorEvidence, itemNameColor } from './data/item-colors.js';
import { NAMED_EQUIPMENT, NAMED_EQUIPMENT_NOTE, namedSpec, matchesNamedEquip, equipmentForShop } from './data/named-equipment.js';
import { PRODUCTION_SKILLS, PRODUCTION_ADAPTATION, QIANKUN_TRANSFER_COSTS, LUNAR_MATERIAL_DROPS, productionTier, gemRequiredGrade } from './data/production.js';
import { getProductionCatalog } from './core/production.js';
import { ATLAS_NODES, ATLAS_SOURCES, ATLAS_ADAPTATION, routeTo, entryDungeons } from './data/atlas.js';
import { ZONE_LANDMARKS } from './data/landmarks.js';
import { stats, expNeed, BAG_LIMIT } from './core/model.js';
import { validateSave } from './core/game.js';
import { LocalBackend, ApiError } from './core/api.js';
import { ECONOMY_RULES, CHARM_CONFIG, COSMETICS, SHOP_PRODUCTS, HONGYUN_POOL, ACTIVITY_POOLS, MILESTONES } from './data/economy.js';
import { canUseSkill, realtimeLoadout, REALTIME_RULES } from './core/combat.js';
import { ENCOUNTERS, choiceHint } from './data/encounters.js';
import { HIGH_EQUIPMENT, HIGH_RECIPES, HIGH_ADAPTATION } from './data/high-equipment.js';
import { EQUIPMENT_CATALOG, CATALOG_TYPES, CATALOG_MAX_LEVEL, catalogSpec, catalogRecipes, queryEquipmentCatalog } from './data/gear-catalog.js';
import { OFFICIAL_EQUIPMENT, OFFICIAL_EQUIPMENT_TYPES, OFFICIAL_EQUIPMENT_NOTE, queryOfficialEquipment } from './data/official-equipment.js';
import { mountWorldScene, unmountWorldScene, approachWorldTarget, stopWorldMovement, moveWorldDirection, toggleWorldOverview, getWorldMovement } from './ui/world-scene.js';

const $ = (s) => document.querySelector(s);
const e = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (n) => Math.round(n || 0).toLocaleString('zh-CN');
const percent = (n) => `${Number(((n || 0) * 100).toFixed(2))}%`;
const percentStats = new Set(['crit', 'dodge', 'accuracy', 'critDamage', 'physicalReduction', 'penetrationP', 'penetrationM', 'channel', 'metalRes', 'woodRes', 'waterRes', 'fireRes', 'earthRes', 'hpPct']);
const statValue = (key, value, bonus = false) => key === 'speed' ? `${Number((value || 0).toFixed(3))}×${bonus ? ' 基础攻速增量' : ''}` : percentStats.has(key) ? percent(value) : num(value);
const currencyName = (id) => ({ gold: '金币', sp: '元神', yuanbao: '元宝', boundYuanbao: '绑定元宝' }[id] || id);
for (const [token, color] of Object.entries(ITEM_COLOR_PALETTE)) document.documentElement.style.setProperty(`--item-color-${token}`, color);
const equipmentName = (item, _q, suffix = '', option = null) => {
  const name = typeof item === 'string' ? item : item?.name || item?.equipment?.name || '';
  const color = itemNameColor(item); const evidence = itemColorEvidence(item);
  const basis = evidence ? 'verified' : 'unknown';
  const note = evidence ? `名称色类别已核；${evidence.rgbBasis}；名称色来源：${evidence.source}` : '名称色未核，使用中性色，不认定为官方白色';
  if (option) return `<option value="${e(option.value)}" class="item-color-${color}" data-item-name="${e(name)}" data-item-color="${color}" data-color-basis="${basis}" title="${e(note)}" aria-label="${e(name + suffix + '，' + note)}" ${option.selected ? 'selected' : ''} ${option.disabled ? 'disabled' : ''}>${e(name + suffix)}</option>`;
  return `<span class="equipment-name item-color-${color}" data-item-name="${e(name)}" data-item-color="${color}" data-color-basis="${basis}" title="${e(note)}">${e(name)}<span class="sr-only">（${e(note)}）</span></span>${e(suffix)}`;
};
const highTemplate = (entry) => HIGH_EQUIPMENT[typeof entry === 'string' ? entry : entry?.templateId || entry?.equipment?.templateId];
const namedTemplate = (entry) => NAMED_EQUIPMENT[typeof entry === 'string' ? entry : entry?.templateId || entry?.equipment?.templateId];
const gradeLabel = (grade) => grade == null ? '品阶未载' : `${grade}品`;
const starLabel = (stars) => stars == null ? '星级未载' : `${stars}星`;
const gearRank = (entry) => `${gradeLabel(entry.grade)}${entry.stage ? ` · ${entry.stage}阶` : ''}`;
const sourceStatus = (entry) => ({ verified: '源字段已核', partial: '资料部分已核', 'local-tutorial': '本作训练 · 非官方' }[entry?.status || entry?.sourceRecord?.status] || (highTemplate(entry) ? '高阶已核样本 · 本作适配' : '来源未载'));
const equipmentLabel = (entry) => entry.ruleVersion === 2 || namedTemplate(entry) ? sourceStatus(entry) : highTemplate(entry) ? '神铸装备' : entry.ruleVersion === 1 ? '历史公式装备' : '旧存档装备';
function itemText(text) {
  const names = [...new Set([...Object.values(ITEMS), ...Object.values(NAMED_EQUIPMENT), ...Object.values(HIGH_EQUIPMENT), ...Object.values(game?.p?.equipment || {}), ...(game?.p?.bag || [])].map((it) => it.name).filter(Boolean))].sort((a, b) => b.length - a.length);
  const pattern = names.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  return pattern ? String(text ?? '').split(new RegExp(`(${pattern})`, 'g')).map((part, index) => index % 2 ? equipmentName(part) : e(part)).join('') : e(text);
}
const prizeName = (prize) => {
  const gear = (prize.rewards || []).find((reward) => reward.type === 'equip');
  return gear ? equipmentName(gear.equipment?.name || highTemplate(gear)?.name || namedTemplate(gear)?.name || prize.name) : equipmentName(prize.name);
};
const paths = {
  world: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Z"/><path d="M9 3v15M15 6v15"/>',
  sword: '<path d="m14 3 7 0v7L9 22l-7-7L14 3Z"/><path d="m5 12 7 7M3 21l4-4"/>',
  quest: '<path d="M6 3h12v18H6zM9 7h6M9 11h6M9 15h3"/>',
  bag: '<path d="M6 8h12l3 13H3L6 8Z"/><path d="M8 8V5a4 4 0 0 1 8 0v3M9 13h6"/>',
  skill: '<path d="m13 2-9 12h7l-1 8 10-13h-8l1-7Z"/>',
  cult: '<circle cx="12" cy="12" r="9"/><path d="m12 5 4 7-4 7-4-7 4-7Z"/>',
  town: '<path d="M3 21h18M5 21V9h14v12M3 9l9-7 9 7M9 21v-6h6v6M9 11h1M14 11h1"/>',
  user: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
  guide: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M9 8h6v8H9z"/>',
  star: '<path d="m12 2 3 7 7 3-7 3-3 7-3-7-7-3 7-3 3-7Z"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  leaf: '<path d="M4 20C-1 6 10 3 21 3c0 11-3 22-17 17ZM4 20 17 7"/>',
  shield: '<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Z"/>',
  bottle: '<path d="M9 2h6M10 2v7l-5 7v5h14v-5l-5-7V2M7 15h10"/>',
  save: '<path d="M3 3h15l3 3v15H3V3ZM7 3v6h10V3M7 21v-8h10v8"/>',
};
const icon = (id) => `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id] || paths.star}</svg>`;
const btn = (text, action, data = '', cls = '', disabled = false) => `<button type="button" class="btn ${cls}" data-action="${action}" ${data} ${disabled ? 'disabled' : ''}>${text}</button>`;
const card = (title, content, aside = '') => `<section class="card"><div class="card-header"><h2 class="section-title">${title}</h2>${aside}</div><div class="card-body">${content}</div></section>`;
const empty = (text) => `<div class="empty-state">${icon('leaf')}<p>${text}</p></div>`;
const bar = (value, max, type, label) => `<div class="bar ${type}"><div class="bar-fill" style="width:${Math.max(0, Math.min(100, value / max * 100))}%"></div><span class="bar-label">${label} ${num(value)} / ${num(max)}</span></div>`;
const navs = [['world', 'world', '游历'], ['quests', 'quest', '任务'], ['character', 'user', '角色'], ['bag', 'bag', '包裹'], ['skills', 'skill', '技能'], ['cult', 'cult', '修真'], ['town', 'town', '工坊'], ['mall', 'coin', '乾坤袋'], ['activities', 'star', '鸿运秘宝'], ['guide', 'guide', '指南']];
const mobileMain = ['world', 'quests', 'bag', 'skills'];
// Vite may load a timestamped entry; bare dynamic imports must not mount twice.
const uiKey = Symbol.for('pwi-h5.main-session');
const uiSession = globalThis[uiKey] ||= { ready: null, api: null, bindings: new Set() };
let api = uiSession.api;
uiSession.bindings.add((backend) => { api = backend; });
export { api };
let game = null; let page = 'world'; let race = 'human'; let cls = 'blademaster'; let charName = ''; let creating = false;
let codexSearch = ''; let codexCategory = 'all';
let bagTab = 'equipment'; let townTab = 'shop'; let mallTab = 'featured'; let auto = false; let exploring = false; let explorePause = 0; let target = null; let lastExplore = null;
let toastTimer; let modalConfirm = null; let returnFocus = null;
let loadError = ''; let loading = true; let pending = false; let replacementAuthorized = false;
let economyViews = {}; let readErrors = {}; let lastDelivery = null;
let atlasSelection = ''; let atlasLayer = 'mainland'; let atlasZoom = 1;
let catalogFilter = { cls: '', minLv: '', maxLv: '', slot: 'all', type: 'all', grade: 'all', sort: 'level-grade', page: 1 };
let officialFilter = { search: '', cls: 'all', type: 'all', slot: 'all', minLv: '', maxLv: '', grade: '', includeUnknown: true, page: 1 };
let fieldSelection = null;
let sceneAvailable = false; let sceneWalking = false; let directionPointer = null;
let realtimeFocused = false; let realtimePending = false; let combatGoal = null;
const combatDirections = new Set();
const combatKeys = { w: 'up', s: 'down', a: 'left', d: 'right', arrowup: 'up', arrowdown: 'down', arrowleft: 'left', arrowright: 'right' };
function suspendRealtime() { realtimeFocused = false; combatDirections.clear(); combatGoal = null; releaseSceneDirection(); }
let productionFilter = { series: 'ordinary', slot: 'weapon', recipeId: '', uid: '', inherit: false };
let refineAid = ''; let gatherReadyAt = 0; let gatherFeedback = ''; let gatherUiTimer;
const materialName = (id) => ITEMS[id]?.name || id;
const seriesName = (id) => id === 'local-tutorial' ? '本作训练 · 非官方' : GEAR_RULES.seriesRules[id]?.name || id || '系列未载';

function applyPending() {
  $('#app').setAttribute('aria-busy', String(pending || loading || sceneWalking));
  for (const button of document.querySelectorAll('#app button, #modal button')) {
    const locked = pending || sceneWalking && !button.hasAttribute('data-walk-control');
    if (locked && !button.hasAttribute('data-pending-disabled')) {
      button.dataset.pendingDisabled = String(button.disabled); button.disabled = true;
    } else if (!locked && button.hasAttribute('data-pending-disabled')) {
      button.disabled = button.dataset.pendingDisabled === 'true'; delete button.dataset.pendingDisabled;
    }
  }
}
function errorMessage(err) { return `${err instanceof ApiError ? `[${err.code}] ` : ''}${err.message || '操作失败。'}`; }
async function readEconomy(section = page) {
  if (!['mall', 'activities', 'bag'].includes(section) || !game?.p) return;
  try {
    const response = await api.request('GET', `/v1/${section === 'bag' ? 'activities' : section}`);
    const view = response.data;
    if (!view?.wallet || !view.shop || !view.treasure || !view.activity) throw new Error('经济查询返回结构不完整，未显示成功；请检查后端查询分区。');
    economyViews[section] = view; delete readErrors[section];
  } catch (err) { delete economyViews[section]; readErrors[section] = errorMessage(err); }
}
async function command(path, body = {}) {
  if (pending || sceneWalking) throw new Error('上一操作仍在进行，请稍候或停止行走。');
  if (!api || loading) throw new Error('本地后端尚未就绪，请重试读取。');
  stopWorldMovement();
  pending = true; applyPending(); renderScene();
  try {
    const response = await api.request('POST', path, body);
    game = api.game; loadError = api.loadError;
    if (game.busy && !game.battle.rt && path !== '/v1/battle/realtime') {
      await api.request('POST', '/v1/battle/realtime', {});
      game = api.game; realtimeFocused = true; combatDirections.clear(); combatGoal = null;
    }
    economyViews = {}; readErrors = {};
    lastDelivery = response.data.result && typeof response.data.result === 'object' ? response.data.result : null;
    const message = lastDelivery?.message || response.data.message;
    if (message) toast(message);
    await readEconomy();
    return response.data;
  } finally { pending = false; applyPending(); render(); }
}
async function openBackend() {
  if (loading && api) return;
  loading = true;
  $('#app').innerHTML = '<main class="startup-screen"><h1>正在读取本地纪行</h1><p class="muted">等待IndexedDB校验；不会删除或重建原始存档。</p></main>';
  try {
    const opened = await LocalBackend.open();
    api?.close(); uiSession.api = opened;
    for (const updateBinding of uiSession.bindings) updateBinding(opened);
    game = api.game; loadError = api.loadError;
    economyViews = {}; readErrors = {}; await readEconomy();
  } catch (err) { loadError = `本地读取失败：${errorMessage(err)}。原始备份保留，未自动重建；请重试读取。`; }
  finally { loading = false; render(); }
}

function toast(text) {
  $('#toast').textContent = text; $('#toast').classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('show'), 3500);
}
function showModal(title, html, confirmText = '', callback = null) {
  suspendRealtime();
  stopWorldMovement();
  const wasActive = auto || exploring;
  const alreadyOpen = !$('#modal').classList.contains('hidden');
  stopAuto();
  if (!alreadyOpen) returnFocus = document.activeElement;
  if (wasActive) render();
  modalConfirm = callback;
  $('#modal').classList.remove('hidden');
  $('#modal').innerHTML = `<div class="modal-backdrop"><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="modal-head"><h2 id="dialog-title">${title}</h2>${btn('关闭', 'closeModal', '', 'ghost small')}</div><div class="modal-body">${html}</div><div class="modal-actions">${btn('返回', 'closeModal', '', 'ghost')}${confirmText ? btn(confirmText, 'confirmModal', '', 'primary') : ''}</div></section></div>`;
  renderScene();
  $('#modal').querySelector('button')?.focus();
}
function closeModal() { $('#modal').classList.add('hidden'); $('#modal').innerHTML = ''; modalConfirm = null; renderScene(); (returnFocus?.isConnected && returnFocus !== document.body ? returnFocus : $('.page button:not(:disabled)'))?.focus(); }
function stopAuto() { auto = false; exploring = false; }
function download(text, filename) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function brand() { return `<div class="brand"><span class="brand-mark">${icon('cult')}</span><div><div class="brand-title">完美纪行</div><div class="brand-sub">单机 · 非官方</div></div></div>`; }

function renderCreate() {
  const c = CLASSES[cls]; const r = RACES[race]; const landmark = ZONE_LANDMARKS[r.home];
  $('#app').innerHTML = `<div class="create-screen"><header class="create-header">${brand()}<span class="tag">本地存档 · 无需账号</span></header><main class="create-layout"><section class="creation-preview"><div class="eyebrow">${e(r.name)}故乡</div><h1>${e(ZONES[r.home].name)}</h1><section class="world-scene creation-scene" aria-label="${e(c.name)}与出生地预览"><div class="scene-backdrop" aria-hidden="true"><img src="/art/celestial-valley-v1.webp" alt=""></div><div id="world-scene-host" style="position:absolute;inset:0"></div><figure class="scene-avatar"><img src="/art/cultivator-portrait-v1.webp" alt="静态意象，非职业外观"></figure><div class="scene-landmark"><strong>${e(landmark.name)}</strong><span>原创 Q 版地标</span></div><div class="scene-copy"><strong>${e(c.name)}</strong><span>${e(c.role)}</span></div><div class="scene-status" data-scene-status>正在准备场景</div></section><div class="creation-role"><h2>${e(c.name)}</h2><p>${e(c.desc)}</p><div class="location-tags"><span class="tag">${c.armor === 'heavy' ? '重装' : c.armor === 'light' ? '轻装' : '法装'}</span><span class="tag">${c.atkType === 'phys' ? '物理' : '法术'}攻击</span><span class="tag">${e(c.role)}</span></div><p class="muted">${e(landmark.description)}</p></div></section><section class="create-panel"><div class="eyebrow">五族 · 十职业</div><h2>创建角色</h2>${loadError ? `<div class="notice warning" role="alert">${e(loadError)} ${btn('备份原始存档', 'backupRaw', '', 'small')}${btn('重试读取', 'retryLoad', '', 'ghost small')}</div>` : ''}<form id="create-form"><label for="char-name">道号</label><input id="char-name" class="field" name="name" maxlength="12" required autocomplete="off" placeholder="请输入1—12个字" value="${e(charName)}"><label>种族</label><div class="race-grid">${Object.entries(RACES).map(([id, d]) => `<button type="button" class="race-option ${race === id ? 'selected' : ''}" data-action="race" data-id="${id}" aria-pressed="${race === id}"><span>${d.name[0]}</span>${d.name}</button>`).join('')}</div><p class="muted">${e(r.desc)}</p><label>职业</label><div class="class-grid">${r.classes.map((id) => `<button type="button" class="class-option ${cls === id ? 'selected' : ''}" data-action="class" data-id="${id}" aria-pressed="${cls === id}">${icon(CLASSES[id].atkType === 'phys' ? 'sword' : 'skill')}<strong>${CLASSES[id].name}</strong><small>${CLASSES[id].role}</small></button>`).join('')}</div><button class="btn primary wide" type="submit">进入完美大陆 ${icon('arrow')}</button>${game.p ? btn('继续现有角色', 'cancelCreate', '', 'ghost wide') : ''}</form><div class="create-footer">${btn('导入存档', 'importPicker', '', 'ghost small')}<p>经典五族十职业，单机实时战斗。技能名与学习门槛参照历史资料；战斗、路线和 Q 版美术不是端游复刻。</p></div></section></main></div>`;
  sceneAvailability(mountWorldScene($('#world-scene-host'), { cls, race, location: r.home, city: true, monsters: [], active: false }));
}
function navButton(id, mobile = false) {
  const [, ic, name] = navs.find((entry) => entry[0] === id);
  const ready = id === 'quests' && game.questProgress(game.mainQuest).ready;
  return `<button class="nav-item ${page === id ? 'active' : ''}" data-action="page" data-id="${id}" ${page === id ? 'aria-current="page"' : ''}>${icon(ic)}<span>${mobile ? name.slice(0, 2) : name}</span>${ready ? '<span class="badge">可领</span>' : ''}</button>`;
}
function sidebar() {
  return `<aside class="sidebar">${brand()}<nav class="nav" aria-label="主要导航">${navs.map(([id]) => navButton(id)).join('')}</nav></aside>`;
}
function playerHud() {
  const p = game.p; const s = stats(p, game.busy ? game.battle : null);
  return `<section class="player-hud" aria-label="角色状态"><div class="hud-identity"><span class="hud-avatar" aria-hidden="true">${CLASSES[p.cls].name[0]}</span><div><strong>${e(p.name)} <small>Lv.${p.lv}</small></strong><span>${CLASSES[p.cls].name} · ${cultName(p.cult, p.path)}</span></div></div><div class="hud-vitals">${bar(p.hp, s.hp, 'hp', '生命')}${bar(p.mp, s.mp, 'mp', '真气')}${bar(p.exp, expNeed(p.lv), 'xp', '经验')}</div><div class="hud-chi"><div class="chi-dots" aria-hidden="true">${[100, 200, 300].map(value => `<i class="${p.chi >= value ? 'filled' : ''}"></i>`).join('')}</div><span>元气 ${p.chi}/300</span></div></section>`;
}
function pageTitle(title, subtitle, actions = '') { return `<header class="page-title"><div><h1>${title}</h1><p class="subtle">${subtitle}</p></div><div class="page-actions">${actions}</div></header>`; }
function render() {
  if (!game) {
    $('#app').innerHTML = `<main class="startup-screen"><h1>本地纪行读取失败</h1><p class="notice warning" role="alert">${e(loadError)}</p>${btn('重试读取', 'retryLoad', '', 'primary')}<p class="muted">数据库尚不可用，无法导出原始备份；不会自动创建空白存档覆盖数据。</p></main>`;
    applyPending(); return;
  }
  if (!game.p || creating) { renderCreate(); applyPending(); return; }
  const openFolds = new Set([...$('#app').querySelectorAll('.economy-fold[open]')].map((fold) => fold.dataset.fold));
  const p = game.p;
  const pages = { world: worldPage, quests: questsPage, character: characterPage, bag: bagPage, skills: skillsPage, cult: cultPage, town: townPage, mall: mallPage, activities: activitiesPage, guide: guidePage };
  $('#app').innerHTML = `<div class="shell" data-page="${page}">${sidebar()}<main class="main"><header class="topbar"><div class="breadcrumb"><span class="mobile-brand">完美 · 纪行</span><span>${e(ZONES[p.location].name)}</span></div><div class="topbar-right"><span>金币 <strong>${num(p.gold)}</strong></span><span>元神 <strong>${num(p.sp)}</strong></span><span class="save-status">${pending ? '保存中' : loadError ? '读取失败' : '本地已存'}</span>${btn(icon('save'), 'export', 'aria-label="导出存档（含战斗）"', 'ghost small')}</div></header>${playerHud()}<div class="page">${loadError ? `<div class="notice warning" role="alert">${e(loadError)} ${btn('保留原始备份', 'backupRaw', '', 'small')}${btn('重试读取', 'retryLoad', '', 'ghost small')}</div>` : ''}${pages[page]()}</div></main><nav class="mobile-nav" aria-label="手机导航">${mobileMain.map((id) => navButton(id, true)).join('')}<details class="mobile-nav-more"><summary>${icon('guide')}<span>更多</span></summary><div class="mobile-more-menu">${navs.filter(([id]) => !mobileMain.includes(id)).map(([id]) => navButton(id)).join('')}</div></details></nav></div>`;
  for (const fold of $('#app').querySelectorAll('.economy-fold')) fold.open = openFolds.has(fold.dataset.fold);
  $('.combat-log')?.scrollTo(0, 100000);
  renderScene();
  applyPending();
}
function journeyFocus() {
  const p = game.p; const z = ZONES[p.location]; const q = game.mainQuest;
  if (!q) return `<section class="journey-focus"><span class="focus-seal" aria-hidden="true">${icon('quest')}</span><div class="focus-copy"><small>主线已完结</small><h3>山海仍有可期之处</h3><p class="focus-goal">精进装备、挑战副本，或继续探索未至之地。</p></div><div class="focus-actions">${btn('查看装备', 'page', 'data-id="bag"', 'primary')}${btn('天下地图', 'map', '', 'ghost')}</div></section>`;
  const pr = game.questProgress(q); const goal = q.goal;
  let action; let text;
  if (pr.ready) {
    text = '目标已达成，领取奖励后开启下一段主线。';
    action = btn('领取主线奖励', 'claim', 'data-bounty="false"', 'primary', game.busy);
  } else if (goal.type === 'level') {
    text = `当前${p.lv}级 → 目标${goal.lv}级。${z.type === 'city' ? '出城到野外，' : ''}挑战合适等级的普通怪获得经验；探索与奇遇是可选玩法。`;
    if (z.type === 'city') {
      const next = z.links.filter((id) => ZONES[id].type !== 'city' && p.lv >= ZONES[id].lv[0] - 5 && p.cult >= (ZONES[id].minCult || 0)).sort((a, b) => Math.abs(ZONES[a].lv[0] - p.lv) - Math.abs(ZONES[b].lv[0] - p.lv))[0];
      action = next ? btn(`出发 · ${e(ZONES[next].name)}`, 'navigate', `data-id="${next}"`, 'primary', game.busy) : btn('查看天下地图', 'map', '', 'primary');
    } else action = '';
  } else if (goal.type === 'kill') {
    const mob = z.mobs?.find((m) => m[0] === goal.mob); const index = z.mobs?.indexOf(mob) ?? -1;
    text = `击败${goal.mob} · ${pr.done} / ${pr.total}。${!mob ? '按路线前往任务地点，每次移动一站。' : mob[2] ? `${mob[2] === 'boss' ? '首领' : '精英'}很强，准备好药品、看清它的蓄力再挑战。` : '可直接挑战任务目标，不必随机探索。'}`;
    action = !mob ? btn(`前往 · ${e(ZONES[q.zone].name)}`, 'navigate', `data-id="${q.zone}"`, 'primary', game.busy)
      : btn(`挑战 · ${e(goal.mob)}`, 'hunt', `data-index="${index}"`, 'primary', game.busy || !!p.encounter);
  } else if (goal.type === 'visit') {
    text = `前往${ZONES[goal.zone].name}。按已开放的道路逐站前进。`;
    action = btn('前往任务地点', 'navigate', `data-id="${goal.zone}"`, 'primary', game.busy);
  } else if (goal.type === 'cult') {
    text = `修真达到${cultName(goal.rank, p.path)}。查看突破条件与试炼。`;
    action = btn('查看修真条件', 'page', 'data-id="cult"', 'primary');
  } else {
    text = `通关${DUNGEONS.find((d) => d.id === goal.id).name}。查看准入条件与波次。`;
    action = btn('前往副本使者', 'dungeonTab', '', 'primary');
  }
  return `<section class="journey-focus"><span class="focus-seal" aria-hidden="true">${icon('quest')}</span><div class="focus-copy"><small>下一步 · 当前主线</small><h3>${e(q.title)}</h3><p class="focus-goal">${e(text)}</p></div><div class="focus-actions">${action}${btn('任务详情', 'page', 'data-id="quests"', 'ghost small')}</div></section>`;
}
function questCard(q, bounty = false) {
  if (!q) return empty(bounty ? '暂无赏金任务。到城镇接取虎符悬赏。' : '主线已完结。天下尚有无尽的历练，愿你道心长明。');
  const pr = game.questProgress(q, bounty);
  const goal = q.goal;
  const text = goal.type === 'kill' ? `击败${goal.mob} ${pr.done} / ${pr.total}` : goal.type === 'level' ? `达到${goal.lv}级` : goal.type === 'cult' ? `修真达到${cultName(goal.rank, game.p.path)}` : goal.type === 'dungeon' ? `通关${DUNGEONS.find((d) => d.id === goal.id)?.name}` : `前往${ZONES[goal.zone].name}`;
  return `<article class="quest-card"><span class="quest-tag">${bounty ? '虎符悬赏' : '主线'} · ${pr.ready ? '已完成' : '进行中'}</span><h3 class="quest-name">${e(q.title)}</h3><p class="quest-story">${e(q.story)}</p><div class="quest-meta"><span>${e(q.giver)}</span><span>推荐 Lv.${q.rlv}</span></div><div class="progress-track"><div class="progress-fill" style="width:${pr.done / pr.total * 100}%"></div></div><p>${e(text)}</p><div class="quest-footer">${q.zone ? btn('前往目标', 'navigate', `data-id="${q.zone}"`, 'ghost small', game.busy) : goal.type === 'visit' ? btn('前往目标', 'navigate', `data-id="${goal.zone}"`, 'ghost small', game.busy) : goal.type === 'cult' ? btn('修真之路', 'page', 'data-id="cult"', 'ghost small') : goal.type === 'dungeon' ? btn('副本使者', 'dungeonTab', '', 'ghost small') : ''}${btn('领取奖励', 'claim', `data-bounty="${bounty}"`, 'primary small', !pr.ready || game.busy)}</div></article>`;
}
function travelCard(id, teleport = false) {
  const z = ZONES[id];
  const locked = game.p.lv < z.lv[0] - 5 || (z.minCult && game.p.cult < z.minCult);
  return `<div class="travel-card"><div>${icon(z.type === 'city' ? 'town' : 'world')}<strong>${z.name}</strong><small>${z.type === 'city' ? '城镇 · 安全区' : `野外 Lv.${z.lv.join('—')}`}</small></div>${btn(locked ? '未解锁' : teleport ? '传送' : '前往', 'travel', `data-id="${id}" data-teleport="${teleport}"`, 'ghost small', locked || game.busy)}</div>`;
}
function howToPlay() {
  if (game.p.lv >= 8) return '';
  const steps = [['leaf', '探索', '点「探索」遇怪、寻宝、触发奇遇；打赢和部分奇遇获得经验。'], ['shield', '看敌人意图', '敌人「蓄力」就防御，完美格挡并反击；露出「破绽」就全力输出。'], ['star', '变强', '升级后加点、回城补给，完成任务领奖励开启新地图。']];
  return `<section class="howto" aria-label="怎么玩">${steps.map(([ic, title, text], i) => `<div class="howto-step"><span class="howto-no">${i + 1}</span>${icon(ic)}<div><strong>${title}</strong><small>${text}</small></div></div>`).join('')}</section>`;
}
function encounterCard() {
  const p = game.p; const enc = p.encounter; const def = ENCOUNTERS[enc.id];
  return `<section class="encounter-card" aria-live="polite"><div class="encounter-head"><span class="tag gold">奇遇</span><h3>${e(def.title)}</h3></div><p class="encounter-text">${e(def.text(ZONES[enc.zone].name, enc.mob))}</p><div class="encounter-choices">${def.choices.map((c) => {
    const why = c.require?.(p) || '';
    return `<button type="button" class="encounter-choice" data-action="encounter" data-id="${e(c.id)}" ${why || game.busy ? 'disabled' : ''}><strong>${e(c.label)}</strong><small>${e(why || choiceHint(c, p.lv))}</small></button>`;
  }).join('')}</div></section>`;
}
function explorePanel() {
  const p = game.p; const s = stats(p);
  const low = p.hp < s.hp * 0.35;
  const result = lastExplore?.text ? `<p class="explore-result ${e(lastExplore.kind || '')}">${itemText(lastExplore.text)}</p>` : `<p class="explore-result">四处走走，看看${e(ZONES[p.location].name)}藏着什么。</p>`;
  const body = p.encounter ? encounterCard() : `<div class="explore-actions">${btn(`${icon('leaf')} 探索`, 'explore', '', 'primary big', game.busy)}${btn(exploring ? '停止自动探索' : '自动探索', 'autoExplore', 'title="自动探索与战斗；遇到奇遇、生命偏低或任务可领时自动停下"', exploring ? 'danger' : 'ghost', game.busy && !exploring)}</div>${result}${low ? '<p class="notice warning">生命偏低：先喝药、在城里客栈休息，或探索时留意灵泉。</p>' : ''}`;
  return `<section class="explore-panel"><div class="explore-head"><h2>${icon('world')} 野外探索</h2><span class="muted">约六成遇敌 · 也会寻到宝物或奇遇</span></div>${body}</section>`;
}
function updateGatherReadiness() {
  if (pending || loading || !game?.p || game.busy || game.p.encounter || game.p.hp <= 0 || page !== 'world' || Date.now() < Math.max(gatherReadyAt, (game.p.lastGatherAt || 0) + 2000)) return;
  for (const button of document.querySelectorAll('[data-action="gather"]')) button.disabled = false;
  if ($('#gather-feedback')) $('#gather-feedback').textContent = gatherFeedback ? gatherFeedback.replace('2秒后可再次采集。', '现在可再次采集。') : '间隔已结束，现在可手动采集。';
}
function gatherPanel() {
  const p = game.p; const z = ZONES[p.location]; const tier = productionTier(Math.max(1, Math.min(p.lv, z.lv[0])));
  const readyAt = Math.max(gatherReadyAt, (p.lastGatherAt || 0) + 2000);
  const ready = Date.now() >= readyAt;
  clearTimeout(gatherUiTimer);
  if (!ready) gatherUiTimer = setTimeout(updateGatherReadiness, readyAt - Date.now() + 50);
  return `<section class="gather-panel"><div><div class="eyebrow">从材料开始 · ${tier}档资源</div><h3>亲手采集，回城制器</h3><p class="muted">野外与人物等级取较低档；皮料来自战斗。手动点击，每次采集后需间隔2秒，无自动采集。</p></div><div class="gather-actions">${[['ore', '采矿'], ['wood', '伐木'], ['fiber', '采纤维']].map(([id, name]) => btn(`${name}<small>${equipmentName(materialName(`${id}${tier}`))} · 持有${num(p.items[`${id}${tier}`])}</small>`, 'gather', `data-id="${id}"`, 'ghost small', game.busy || !!p.encounter || p.hp <= 0 || !ready)).join('')}</div><p id="gather-feedback" role="status" class="muted">${e(gatherFeedback || (ready ? '可采集 · 材料实际到账后更新持有数' : '采集间隔中，请稍候2秒'))}</p>${btn('查看可制造装备与所需材料', 'productionGo', '', 'ghost small')}</section>`;
}
function fieldIndex() {
  const p = game.p; const mobs = ZONES[p.location].mobs || [];
  if (fieldSelection?.location === p.location && mobs[fieldSelection.index]) return fieldSelection.index;
  const objective = mobs.findIndex((m) => m[0] === game.mainQuest?.goal.mob);
  return Math.max(0, objective);
}
function sceneRoster() {
  if (game.battle) return game.battle.monsters;
  return (ZONES[game.p.location].mobs || []).map(([name, lv, rank], index) => ({ id: `field-${index}`, name, lv, rank, hp: 1, maxHp: 1 }));
}
function worldScene(battle = false) {
  const p = game.p; const z = ZONES[p.location]; const city = z.type === 'city' && !battle;
  const landmark = ZONE_LANDMARKS[p.location];
  return `<section class="world-scene" aria-label="${e(z.name)}人物与场景"><div class="scene-backdrop" aria-hidden="true"><img src="/art/celestial-valley-v1.webp" alt=""></div><div class="scene-shade" aria-hidden="true"></div><div id="world-scene-host" style="position:absolute;inset:0"></div><header class="scene-header"><div><span class="scene-label">${city ? '城镇 · 安全区' : battle ? (game.battle.result ? '战斗已结束' : '正在战斗') : '野外 · 可选择目标'}</span><h2>${e(z.name)}</h2></div><span class="scene-label">${e(z.region)}</span></header><figure class="scene-avatar"><img src="/art/cultivator-portrait-v1.webp" alt="修真者静态意象，非实际装备外观"></figure><div class="scene-landmark"><strong>${e(landmark.name)}</strong><span>原创 Q 版地标</span></div><div class="scene-copy"><strong>${e(p.name)}</strong><span>Lv.${p.lv} · ${CLASSES[p.cls].name}${p.expBoost ? ` · 聚灵 ${p.expBoost}场` : ''}</span></div><div class="scene-status" data-scene-status>正在准备场景</div></section>`;
}
function sceneTargets(battle = false) {
  if (!battle && ZONES[game.p.location].type === 'city') return '';
  const selected = battle ? target : `field-${fieldIndex()}`;
  return `<div class="scene-monsters" aria-label="场景目标">${sceneRoster().map((m, i) => `<button class="scene-mob ${m.id === selected ? 'selected' : ''} ${m.hp <= 0 ? 'dead' : ''}" data-action="${battle ? 'target' : 'fieldTarget'}" data-id="${e(m.id)}" data-index="${i}" aria-pressed="${m.id === selected}" ${m.hp <= 0 || pending ? 'disabled' : ''}><span class="scene-mob-icon">${icon(m.rank === 'boss' ? 'cult' : 'sword')}</span><span><strong>${e(m.name)}</strong><small>Lv.${m.lv}${m.rank === 'boss' ? ' · 首领' : m.rank === 'elite' ? ' · 精英' : ''}${!battle && m.name === game.mainQuest?.goal.mob ? ' · 任务' : ''}</small></span></button>`).join('')}</div>`;
}
function sceneNavigation() {
  if (game.battle) return game.busy ? `<section class="rt-movement" aria-label="战斗走位"><div><strong>走位躲开红圈</strong><p class="muted">点地面移动 · WASD / 方向键 · 空格守御</p></div><div class="scene-direction-pad">${[['up', '↑'], ['left', '←'], ['down', '↓'], ['right', '→']].map(([direction, glyph]) => btn(glyph, 'sceneDirection', `data-direction="${direction}" data-walk-control aria-label="战斗${direction}走位"`, `ghost scene-direction ${direction}`)).join('')}</div></section>` : '';
  return `<section class="scene-navigation" data-scene-navigation hidden aria-label="区域行走"><div class="scene-navigation-copy"><div class="scene-position"><strong>区域行走</strong><output data-scene-coords aria-label="人物局部坐标">—</output></div><p data-scene-distance>点地面行走 · WASD / 方向键 · 横拖转视角</p><div class="scene-navigation-actions">${btn('全图视野', 'sceneOverview', 'data-walk-control', 'ghost small')}${btn('停止', 'sceneStop', 'data-walk-control', 'ghost small')}${ZONES[game.p.location].type === 'city' ? '' : `${btn('走近目标', 'sceneApproach', '', 'ghost small')}${btn('靠近后交战 · E', 'sceneEngage', '', 'primary small', true)}`}</div></div><div class="scene-direction-pad" aria-label="按住方向行走">${[['up', '↑', '向前'], ['left', '←', '向左'], ['down', '↓', '向后'], ['right', '→', '向右']].map(([direction, glyph, label]) => btn(glyph, 'sceneDirection', `data-direction="${direction}" data-walk-control aria-label="${label}行走"`, `ghost scene-direction ${direction}`)).join('')}</div></section>`;
}
function updateSceneMovement(movement) {
  const navigation = $('[data-scene-navigation]');
  if (!navigation || !game?.p || movement?.location !== game.p.location) return;
  navigation.hidden = !sceneAvailable;
  Object.assign(navigation.dataset, { x: String(movement.x), z: String(movement.z), moving: String(movement.moving), enabled: String(movement.enabled), overview: String(movement.overview), targetId: movement.targetId || '', distance: movement.distance == null ? '' : String(movement.distance) });
  const coordinates = $('[data-scene-coords]');
  if (coordinates) coordinates.textContent = `${movement.x.toFixed(1)}, ${movement.z.toFixed(1)}${movement.moving ? ' · 行走中' : ''}`;
  const distance = $('[data-scene-distance]');
  const mob = ZONES[game.p.location].mobs?.[fieldIndex()];
  const near = movement.targetId === `field-${fieldIndex()}` && movement.distance != null && movement.distance <= 2.3;
  if (distance) distance.textContent = !movement.enabled ? '当前不能行走：请先处理奇遇或完成操作。' : mob && movement.distance != null ? `${mob[0]} · 距离 ${movement.distance.toFixed(1)}${near ? ' · 可交战' : ' · 点怪物走近'}` : '点地面行走 · WASD / 方向键 · 横拖转视角';
  const approach = $('[data-action="sceneApproach"]');
  if (approach) approach.disabled = !movement.enabled || pending || sceneWalking;
  const engage = $('[data-action="sceneEngage"]');
  if (engage) { engage.disabled = !near || !movement.enabled || pending || sceneWalking; engage.textContent = near ? '交战 · E' : '靠近后交战 · E'; }
  const overview = $('[data-action="sceneOverview"]');
  if (overview) overview.textContent = movement.overview ? '跟随人物' : '全图视野';
  for (const button of document.querySelectorAll('[data-direction]')) button.disabled = !movement.enabled || pending;
}
function renderScene() {
  if (!game?.p || creating) return;
  const host = $('#world-scene-host');
  if (!host || page !== 'world') { unmountWorldScene(); sceneAvailable = false; return; }
  const p = game.p;
  const live = mountWorldScene(host, { cls: p.cls, race: p.race, location: p.location, city: ZONES[p.location].type === 'city', monsters: sceneRoster(), targetId: game.battle ? target : `field-${fieldIndex()}`, round: game.battle?.round || 0, rt: game.battle?.rt, hp: p.hp, active: game.busy, equipment: p.equipment, explorable: !game.battle, movementEnabled: !game.battle && !p.encounter && p.hp > 0 && !pending && $('#modal').classList.contains('hidden') });
  sceneAvailability(live);
  updateSceneMovement(getWorldMovement());
}
function sceneAvailability(available) {
  sceneAvailable = available;
  $('.scene-avatar')?.toggleAttribute('hidden', available);
  $('.scene-backdrop')?.toggleAttribute('hidden', available);
  $('[data-scene-navigation]')?.toggleAttribute('hidden', !available);
  const status = $('[data-scene-status]');
  if (status) status.textContent = available ? !game?.p || creating ? 'Q 版程序化 3D · 拖动查看' : game.battle ? '实时交战 · 点地面走位 / 横拖查看' : 'Q 版程序化 3D · 点地面行走 / 拖动查看' : '静态意象 · 此设备未启用 3D';
  if (!available && game?.p && !creating && !game.battle) {
    const button = $('.world-primary [data-action="hunt"]');
    if (button) button.textContent = `挑战 · ${ZONES[game.p.location].mobs?.[fieldIndex()]?.[0] || '目标'}`;
  }
}
async function hunt(index, nearOnly = false) {
  const p = game.p; const location = p.location; const mob = ZONES[location].mobs?.[index];
  if (!Number.isSafeInteger(index) || !mob || game.battle || p.encounter || p.hp <= 0 || pending || sceneWalking) throw new Error('当前不能挑战这个目标。');
  exploring = false;
  fieldSelection = { location, index }; page = 'world'; render();
  const movement = getWorldMovement(); const id = `field-${index}`; const usingScene = sceneAvailable;
  if (usingScene && (!movement?.available || movement.location !== location || !movement.enabled)) throw new Error('场景暂不可行走，请回到地图后重试。');
  if (nearOnly && (!usingScene || movement.targetId !== id || movement.distance == null || movement.distance > 2.3)) throw new Error('请先走到目标附近。');
  if (usingScene && !nearOnly) {
    sceneWalking = true; applyPending(); $('#world-scene-host canvas')?.focus({ preventScroll: true });
    let arrived;
    try { arrived = await approachWorldTarget(id); }
    finally { sceneWalking = false; applyPending(); updateSceneMovement(getWorldMovement()); }
    if (!arrived) { toast('未靠近目标，未开始战斗。'); return; }
  }
  if (document.hidden || game.p.location !== location || game.battle || game.p.encounter || game.p.hp <= 0) return;
  const reached = getWorldMovement();
  if (usingScene && (!reached?.available || !reached.enabled || reached.location !== location || reached.targetId !== id || reached.distance == null || reached.distance > 2.3)) return;
  await command('/v1/battle/hunt', { index });
}
function worldPage() {
  const p = game.p; const z = ZONES[p.location];
  if (game.battle) return battlePage();
  const city = z.type === 'city'; const index = fieldIndex(); const mob = z.mobs?.[index];
  const blocked = game.busy || !!p.encounter;
  const services = [['town', 'shield', '工坊补给', '装备 · 制造 · 精炼'], ['skills', 'skill', '职业导师', '技能 · 元神'], ['cult', 'cult', '修真试炼', '境界 · 仙魔'], ['bag', 'bag', '装备包裹', '穿戴 · 道具']];
  const quest = game.mainQuest;
  const destination = quest?.goal.type === 'visit' ? quest.goal.zone : quest?.zone;
  const cityAction = game.questProgress(quest).ready ? btn('领取主线奖励', 'claim', 'data-bounty="false"', 'primary', game.busy) : destination && destination !== p.location ? btn(`出发 · ${e(ZONES[destination].name)}`, 'navigate', `data-id="${destination}"`, 'primary', game.busy) : btn('天下地图', 'map', '', 'primary');
  const primary = city ? `<div><strong>${e(quest?.title || '从这里启程')}</strong><p class="muted">按主线出发，回来以后补给、学技能和制器。</p></div>${cityAction}${btn(`客栈休息 · ${5 + p.lv * 2}金币`, 'rest', '', 'ghost', game.busy)}` : `<div><strong>目标：${e(mob?.[0] || '野外目标')}</strong><p class="muted">点地面行走，点怪物走近；挑战时先接近目标，精英与首领请先补给。</p></div>${btn(`走近并挑战 · ${e(mob?.[0] || '目标')}`, 'hunt', `data-index="${index}"`, 'primary big', blocked || !mob)}`;
  return pageTitle('游历', `${e(z.name)} · ${city ? '休整与出发' : `Lv.${z.lv.join('—')}历练`}`, btn('天下地图', 'map', '', 'ghost')) + `<div class="world-layout"><div class="scene-column">${worldScene()}<section class="world-primary">${primary}</section>${sceneNavigation()}${sceneTargets()}${p.encounter ? encounterCard() : ''}${city ? `<div class="quick-services">${services.map(([id, ic, title, desc]) => `<button class="quick-service" data-action="page" data-id="${id}">${icon(ic)}<strong>${title}</strong><small>${desc}</small></button>`).join('')}</div>` : `<details class="world-detail"><summary>采集与野外奇遇 <small>可选玩法，不是主线必经步骤</small></summary>${gatherPanel()}${explorePanel()}</details>`}<details class="world-detail"><summary>最近纪行与场景说明</summary>${journal(6)}<p class="muted">${e(z.desc)} 地名有官方出处；路线、生态和程序化模型为单机示意，不是原版地图或怪物模型。</p></details></div><aside class="world-rail">${journeyFocus()}${card('附近道路', `<div class="travel-list">${z.links.map((id) => travelCard(id)).join('')}</div>`)}${entryDungeons(p.location).length ? card('副本入口', entryDungeons(p.location).map((d) => dungeonCard(d, true)).join('')) : ''}${card('成长提醒', `<p>${p.points ? `还有${p.points}点属性可分配。` : '装备与技能比盲目打强敌更重要。'}</p><div class="form-row">${p.points ? btn('推荐加点', 'allocateAuto', '', 'primary small', blocked) : btn('查看职业技能', 'page', 'data-id="skills"', 'ghost small')}${btn('玩法全景', 'page', 'data-id="guide"', 'ghost small')}</div>`)}</aside></div>`;
}
function battlePage() {
  const b = game.battle; const p = game.p; const s = stats(p, game.busy ? b : null);
  const ctx = b.context;
  const title = ctx.type === 'dungeon' ? DUNGEONS.find((d) => d.id === ctx.id).name : ctx.type === 'cult' ? CULT_TRIALS[ctx.rank].title : ctx.type === 'arena' ? '比武大会 · NPC试剑' : ZONES[p.location].name;
  if (!b.monsters.some((m) => m.id === target && m.hp > 0)) target = b.monsters.find((m) => m.hp > 0)?.id;
  const live = b.monsters.filter((m) => m.hp > 0);
  const rec = game.busy && !auto ? pickAutoAction(p, b) : null;
  const recSkill = rec?.action.startsWith('skill:') ? SKILLS[p.cls].find((sk) => sk.id === rec.action.slice(6)) : null;
  const recEnemy = live.find((m) => m.id === rec?.targetId);
  const recName = recSkill?.name || (rec?.action.startsWith('item:') ? ITEMS[rec.action.slice(5)]?.name : rec?.action === 'defend' ? '防御调息' : '普通攻击');
  const recWhy = !rec ? '' : rec.action === 'defend' ? '敌人正在蓄力：防御可完美格挡，还会顺势反击。'
    : rec.action.startsWith('item:') || recSkill?.kind === 'heal' ? '状态偏低，先恢复稳住。'
      : recSkill?.kind === 'summon' ? '召唤伙伴，分担伤害并协助攻击。'
        : recSkill && recSkill.kind !== 'dmg' ? '先准备这一招，为接下来的回合创造优势。'
          : recEnemy?.intent === 'exposed' ? '目标露出破绽，受到伤害+50%，全力输出！'
            : live.some((m) => m.intent === 'heavy' && !m.statuses.some((st) => st.kind === 'stun')) ? '当前状态适合抢攻；重击将至，打不倒它就要留意防御。'
              : recSkill ? '这一招当前收益最高。' : '普通攻击即可，留着真气应对强敌。';
  const mark = (id) => rec?.action === id ? 'recommended' : '';
  const intentTag = (m) => {
    if (m.hp <= 0) return '';
    if (m.statuses.some((st) => st.kind === 'stun')) return '<span class="intent stun">眩晕中 · 无法行动</span>';
    if (m.intent === 'heavy') return `<span class="intent heavy">${m.type === 'magic' ? '吟唱法术' : '蓄力重击'} · 快防御</span>`;
    if (m.intent === 'exposed') return '<span class="intent exposed">露出破绽 · 受伤+50%</span>';
    return '<span class="intent">准备普通攻击</span>';
  };
  const locked = !game.busy || auto;
  const quickAction = rec && (recSkill || rec.action.startsWith('item:')) ? btn(`${e(recName)} · 建议`, 'turn', `data-id="${e(rec.action)}"`, 'primary recommended', locked) : '';
  const controls = `<div class="battle-controls">${quickAction}${btn('普通攻击', 'turn', 'data-id="attack"', `${rec?.action === 'attack' ? 'primary' : 'ghost'} ${mark('attack')}`, locked)}${btn('防御调息', 'turn', 'data-id="defend"', `${rec?.action === 'defend' ? 'primary' : ''} ${mark('defend')}`, locked)}${btn('撤退', 'turn', 'data-id="escape"', 'ghost', locked)}</div>`;
  const advice = rec ? `<div class="battle-advice">${icon('star')} 建议：<strong>${e(recName)}</strong> —— ${e(recWhy)}${recEnemy && recEnemy.id !== target && (rec.action === 'attack' || recSkill?.kind === 'dmg') ? `<div>${btn(`选中${e(recEnemy.name)}`, 'target', `data-id="${e(recEnemy.id)}"`, 'ghost small')} <small>建议目标 · 切换不耗回合</small></div>` : ''}</div>` : auto ? '<p class="battle-advice">自动战斗中，可随时暂停接管。</p>' : '';
  const r = b.rewards;
  const rewardPanel = r ? `<div class="reward-chips"><span class="reward-chip xp">经验 +${num(r.exp)}</span><span class="reward-chip">元神 +${num(r.sp)}</span><span class="reward-chip gold">金币 +${num(r.gold)}</span>${r.items.map((x) => `<span class="reward-chip">${equipmentName(ITEMS[x.id].name)} ×${num(x.qty)}</span>`).join('')}</div>${r.loot.length ? `<div class="reward-loot"><span class="detail-label">战利品</span>${r.loot.map((x) => equipmentName(x.name, x.q)).join('')}</div>` : ''}${r.levelUps ? `<div class="levelup-callout"><strong>升级了！Lv.${p.lv}</strong><span>生命真气已回满${p.points ? `，还有${p.points}点属性未分配` : ''}。</span>${p.points >= 5 ? btn('一键推荐加点', 'allocateAuto', '', 'small primary') : ''}</div>` : ''}${r.quest ? `<p class="reward-quest">${icon('quest')} ${e(r.quest.title)} · ${r.quest.done} / ${r.quest.total}${r.quest.done >= r.quest.total ? ' · 可以领奖了' : ''}</p>` : ''}` : `<p>${itemText(game.state.journal.at(-1)?.text)}</p>`;
  const questReady = game.questProgress(game.mainQuest).ready || game.questProgress(p.bounty, true).ready;
  const resultActions = b.result === 'win'
    ? `${ctx.type === 'dungeon' && !ctx.bossWave ? btn('进入下一波', 'nextWave', '', 'primary') : ''}${questReady ? btn(`${icon('quest')} 领取任务奖励`, 'page', 'data-id="quests"', 'primary') : ''}${btn(ctx.type === 'dungeon' && !ctx.bossWave ? '放弃副本' : '返回游历', 'leaveBattle', '', questReady || ctx.type === 'dungeon' && !ctx.bossWave ? 'ghost' : 'primary')}`
    : btn('返回游历', 'leaveBattle', '', 'primary');
  const result = !b.result ? '' : b.result === 'win'
    ? `<div class="battle-result win"><h2>此战告捷</h2>${rewardPanel}<div class="form-row">${resultActions}</div></div>`
    : `<div class="battle-result ${b.result}"><h2>${b.result === 'lose' ? '胜败乃兵家常事' : '脱离战斗'}</h2><p>${itemText(game.state.journal.at(-1)?.text)}</p>${b.result === 'lose' ? '<p class="muted">建议：回城买药、分配属性点、学新技能；挑战等级接近的敌人，看到「蓄力」记得防御。</p>' : ''}<div class="form-row">${resultActions}</div></div>`;
  const enemies = b.monsters.map((m) => `<button class="enemy ${target === m.id ? 'selected' : ''} ${m.hp <= 0 ? 'dead' : ''}" data-action="target" data-id="${m.id}" ${m.hp <= 0 ? 'disabled' : ''} aria-pressed="${target === m.id}"><h3>${e(m.name)}</h3><p class="muted">Lv.${m.lv} · ${m.rank === 'boss' ? '首领' : m.rank === 'elite' ? '精英' : '普通'}</p>${bar(m.hp, m.maxHp, 'hp', '生命')}${intentTag(m)}<div class="enemy-status">${m.statuses.filter((st) => st.kind !== 'stun').map((st) => `<span class="tag">${e(st.name || '状态')} ${st.turns || ''}</span>`).join('')}</div></button>`).join('');
  const skills = SKILLS[p.cls].filter((sk) => sk.kind !== 'passive' && p.skills[sk.id]).map((sk) => {
    const why = canUseSkill(p, b, sk.id);
    const cost = skillResources(sk, p.skills[sk.id]);
    return `<button class="skill-button ${why ? 'locked' : 'ready'} ${mark(`skill:${sk.id}`)}" data-action="turn" data-id="skill:${sk.id}" ${why || auto ? 'disabled' : ''} title="${e(sk.desc)}"><strong>${e(sk.name)} <small>Lv.${p.skills[sk.id]}</small></strong><small>${why ? e(why) : `真气 ${cost.mp}${cost.chi ? ` · 元气 ${cost.chi}` : ''}`}</small></button>`;
  }).join('');
  const supplies = Object.entries(p.items).filter(([id, qty]) => qty > 0 && ['hp', 'mp'].includes(ITEMS[id].type)).slice(-8).map(([id, qty]) => btn(`${equipmentName(ITEMS[id].name)} ×${qty}`, 'turn', `data-id="item:${id}"`, `ghost small ${mark(`item:${id}`)}`, locked)).join('');
  return pageTitle('战斗历练', `${title} · 第${b.round + (b.result ? 0 : 1)}回合`, game.busy ? btn(auto ? '暂停自动' : '自动战斗', 'auto', '', auto ? 'danger' : 'ghost') : '') + `<div class="world-layout"><div class="scene-column">${worldScene(true)}${sceneNavigation()}${result}${b.result ? '' : `<section class="card">${advice}${controls}<div class="skill-grid">${skills}</div><details class="world-detail"><summary>战斗补给 · 使用药品消耗一回合</summary><div class="form-row">${supplies}</div></details></section>`}${sceneTargets(true)}<details class="world-detail" ${b.result ? 'open' : ''}><summary>战斗记录 · 按实际回合结算</summary><div class="combat-log" role="log" aria-live="off">${b.logs.map((l) => `<div class="log-line ${e(l.kind)}">${itemText(l.text)}</div>`).join('')}</div></details></div><aside class="world-rail">${card('敌人意图 · 选择不耗回合', `<div class="battle-grid">${enemies}</div>`)}${card('角色状态', `<div class="stat-bars">${bar(p.hp, s.hp, 'hp', '生命')}${bar(p.mp, s.mp, 'mp', '真气')}</div><p class="muted">元气 ${p.chi}/300${b.shield > 0 ? ` · 护盾 ${num(b.shield)}` : ''}${b.stealth ? ' · 遁隐' : ''}</p>${b.pet ? `<div class="notice">${e(b.pet.name)}${bar(b.pet.hp, b.pet.maxHp, 'hp', '宠物')}</div>` : ''}<p class="muted">蓄力时防御；破绽时输出。药品、技能和普通攻击都会推进回合。回合规则为本作适配，非端游原公式。</p>`)}</aside></div>`;
}
function questsPage() {
  const p = game.p;
  return pageTitle('任务卷轴', `主线 ${Math.min(p.mainIndex + 1, game.quests.length)} / ${game.quests.length} · 悬赏每日10次`) + `<div class="grid-two">${card('主线纪行', questCard(game.mainQuest))}${card('虎符悬赏', questCard(p.bounty, true) + `<div class="form-row">${btn('接取悬赏', 'bounty', '', 'primary', !!p.bounty || game.busy || ZONES[p.location].type !== 'city')}${btn('领取悬赏', 'claim', 'data-bounty="true"', 'ghost', !game.questProgress(p.bounty, true).ready || game.busy)}</div><p class="muted">今日 ${p.daily.bounties}/10 · 在任意城镇接取，完成后可随地领取。</p>`)}</div>${card('已完成的足迹', game.quests.slice(0, p.mainIndex).reverse().slice(0, 15).map((q) => `<div class="guide-step"><span class="tag green">完成</span><span>${e(q.title)}</span></div>`).join('') || empty('尚未完成任务。先按主线前往第一处野外。'))}`;
}
function itemStats(it) { return Object.entries(equipStats(it)).map(([k, v]) => `<span>${e(STAT_NAMES[k] || k)} +${statValue(k, v, true)}</span>`).join(''); }
function equipmentOrigin(it) {
  const [kind, id] = (it.origin || '').split(':');
  if (kind === 'production') return `${seriesName(it.series)}生产工坊 · ${it.lv}级${SLOTS[it.slot]}`;
  if (kind === 'field') return `${ZONES[id]?.name || '野外'}战斗掉落`;
  if (kind === 'dungeon') return `${DUNGEONS.find(d => d.id === id)?.name || '副本'}战利品`;
  if (kind === 'encounter') return `${ENCOUNTERS[id]?.title || '野外奇遇'}奖励`;
  return ({ starter: '新角色初始装备', shop: '城镇装备商购买', quest: '主线任务奖励', bounty: '悬赏任务奖励' })[kind] || it.origin || (namedTemplate(it) ? '具名装备；具体获取记录见纪行' : highTemplate(it) ? '已核高阶样本；本作获取' : it.ruleVersion === 1 ? '历史公式装备；具体获取记录见纪行' : '旧存档来源');
}
function equipmentMeta(it) {
  return `耐久 ${num(it.durability)}/${num(it.maxDurability)} · ${it.bound ? '已绑定' : '未绑定'} · 已开孔 ${it.sockets.length}/${it.socketLimit} · 宝石 ${it.sockets.filter(Boolean).length}<br>${highTemplate(it) || namedTemplate(it) ? `${e(gearRank(it))} · ${e(starLabel(it.stars))} · ${e(equipmentLabel(it))} · 不可随机洗练` : it.ruleVersion === 1 ? `${e(seriesName(it.series))} · ${e(starLabel(it.stars))} · 历史规则装备，不通用升级 / 洗练` : `旧制套装：${e(EQUIPMENT_SETS[it.setId]?.name || '无')} · 升级 ${num(it.upgrades)}次 · 重洗 ${num(it.rerolls)}次`}`;
}
function highRequirements(template) {
  return `${template.lv == null ? '等级未载' : `Lv.${num(template.lv)}`}${template.requirements == null ? ' · 属性需求未载' : Object.entries(template.requirements).map(([key, value]) => ` · ${e(STAT_NAMES[key] || { str: '力量', con: '体质', dex: '敏捷', mag: '灵力' }[key] || key)} ${value == null ? '资料未载' : num(value)}`).join('')}`;
}
function highDetails(template) {
  const ranges = Object.entries(template.attackRanges || {}).map(([key, range]) => `${e(STAT_NAMES[key] || key)} ${num(range[0])}—${num(range[1])}`).join(' · ');
  return `<div class="high-template-details"><p><span class="detail-label">装备规格</span>${e(gearRank(template))} · ${e(starLabel(template.stars))} · ${e(SLOTS[template.slot])} · <span class="tag">高阶已核样本 · 本作获取</span></p><p><span class="detail-label">穿戴需求</span>${highRequirements(template)}</p><p><span class="detail-label">适用职业</span>${template.classes?.length ? template.classes.map((id) => e(CLASSES[id]?.name || id)).join('、') : '不限职业'}</p>${ranges ? `<p><span class="detail-label">官方原始攻击</span>${ranges}<small>原始范围仅供对照；实际战斗数值以本作属性为准。</small></p>` : ''}<div class="raw-stat-grid"><section><span class="detail-label">固定基础属性 · +0</span>${rawStats(template.base)}</section><section><span class="detail-label">固定附加属性</span>${rawStats(template.addons)}</section></div><div class="fixed-effects"><span class="detail-label">固定效果 · 本作适配</span>${(template.effects || []).map((effect) => `<p><strong>${e(effect.name)}</strong><span>${e(effect.description)}</span></p>`).join('') || '<p>以固定基础属性与附加属性生效。</p>'}</div>${template.adaptation ? `<p class="muted">${e(template.adaptation)}</p>` : ''}<p><span class="detail-label">模板来源</span>${(Array.isArray(template.source) ? template.source : [template.source]).map((source, index) => /^https:\/\//.test(source) ? `<a href="${e(source)}" target="_blank" rel="noopener">官方原图资料${index + 1}</a>` : e(source)).join(' · ')}</p><p class="muted">已核对的具名样本；并非完整官方装备库。固定模板不支持普通升级或随机洗练。</p></div>`;
}
const highCost = (recipe) => `${num(recipe.gold)}金币${Object.entries(recipe.materials || {}).map(([id, count]) => ` + ${equipmentName(ITEMS[id]?.name || id)} ×${num(count)}`).join('')}`;
function highBlockReason(template, recipe, uid = '') {
  if (game.busy) return '战斗中不可办理';
  if (ZONES[game.p.location].type !== 'city') return '需返回城镇';
  if (game.p.lv < template.lv) return `需人物${template.lv}级`;
  if (uid && !game.p.bag.some((it) => it.uid === uid && it.templateId === recipe.from)) return '先卸下至行囊';
  if (!uid && game.p.bag.length >= BAG_LIMIT) return '装备行囊已满';
  if (game.p.gold < recipe.gold) return '金币不足';
  if (Object.entries(recipe.materials || {}).some(([id, count]) => (game.p.items[id] || 0) < count)) return '神铸材料不足';
  return '';
}
function nextHighRecipe(templateId) {
  if (!templateId) return null;
  return Object.entries(HIGH_RECIPES).find(([, recipe]) => recipe.from === templateId);
}
function equipmentRequirements(it) {
  const template = namedTemplate(it);
  return template ? { lv: template.lv, ...(template.requirements || {}) } : gearWearRequirements(it);
}
function highWearReason(it, targetSlot = it.slot) {
  const ring = ['ring1', 'ring2'].includes(it.slot);
  if (targetSlot !== it.slot && !(ring && ['ring1', 'ring2'].includes(targetSlot))) return '部位不符';
  const template = highTemplate(it) || namedTemplate(it);
  if (it.ruleVersion === 2) {
    if (!namedTemplate(it) || !matchesNamedEquip(it)) return '具名模板未核，不能穿戴';
    if (template.playable === false || template.referenceOnly) return '仅供资料参考';
    if (template.lv == null || template.requirements == null || !Array.isArray(template.classes) || !template.classes.length) return '穿戴需求或适用职业未载，不能穿戴';
  }
  if (it.lv == null) return '穿戴等级未载';
  if (it.lv > game.p.lv) return `需${it.lv}级`;
  if (template && (!Array.isArray(template.classes) || !template.classes.includes(game.p.cls))) return '职业不符';
  if (it.ruleVersion === 1 && it.slot === 'weapon' && !allowedWeaponClasses(it.weaponType).includes(game.p.cls)) return '武器类型不适用';
  if (!template && it.ruleVersion !== 1 && it.cls && it.cls !== game.p.cls) return '职业不符';
  const p = structuredClone(game.p); delete p.equipment[targetSlot];
  const actual = stats(p); const requirements = equipmentRequirements(it);
  if (Object.values(requirements).some((value) => (it.ruleVersion !== 2 || value !== null) && !Number.isFinite(value))) return '穿戴需求未载';
  const missing = Object.entries(requirements).filter(([key, value]) => key !== 'lv' && value !== null && (actual[key] || 0) < value);
  return missing.length ? `需${missing.map(([key, value]) => `${STAT_NAMES[key] || key}${num(value)}`).join(' / ')}` : '';
}
function highConfirm(templateId, uid = '') {
  const template = HIGH_EQUIPMENT[templateId]; const recipe = HIGH_RECIPES[templateId];
  if (!template || !recipe) throw new Error('神铸配方尚未就绪。');
  const previous = uid ? game.p.bag.find((it) => it.uid === uid && it.templateId === recipe.from) : null;
  if (recipe.from && !previous) throw new Error('请先将对应前阶装备卸下至行囊。');
  if (!recipe.from && uid) throw new Error('根配方请使用打造。');
  const reason = highBlockReason(template, recipe, uid);
  if (reason) throw new Error(reason);
  showModal(uid ? '确认神铸升阶' : '确认神铸打造', `<div class="high-confirm-heading">${highEquipmentArt(templateId)}<div>${previous ? `<p>${equipmentName(previous.name, 4)} →</p>` : ''}<h3>${equipmentName(template.name, 4)}</h3><p>${e(gearRank(template))}</p></div></div><p class="notice warning">实际扣除：${highCost(recipe)}<br>${uid ? '替换为下一阶模板，保留同一UID、精炼、镶嵌、绑定与当前耐久；前阶装备不会另行返还。' : '成功后由后端生成真实装备，收入行囊并占用1格；装备自动绑定，不能出售或分解。'}<br>提交成功后不可回滚。只有确认后才扣料，失败不显示获得。</p>${highDetails(template)}`, uid ? '确认扣料并升阶' : '确认扣料并打造', async () => {
    const response = await command(`/v1/equipment/${uid ? 'ascend' : 'craft'}`, uid ? { uid, confirm: true } : { templateId, confirm: true });
    const equipment = response.result?.equipment || response.equipment;
    if (equipment?.uid) equipmentModal(equipment.uid);
  });
}
function highForgePage() {
  const templates = Object.values(HIGH_EQUIPMENT);
  return `<section class="high-forge"><header class="high-forge-heading"><div><div class="eyebrow">神铸谱 · 具名装备</div><h2>以凭证铸器，以培养传承</h2></div><span>${equipmentName(materialName('highForgeSigil'))} ×${num(game.p.items.highForgeSigil)}</span></header><p class="notice">本作真实资源途径：乾坤袋商城购买「神铸凭证」、推荐等级≥75的副本最终首领波通关每次获得2个（普通波与野外首领不掉落），以及秘宝奖池。打造与升阶费用为本作配方，并非官方成本。需在城镇、105级、材料与金币充足；打造还需空余行囊格。</p>${HIGH_ADAPTATION ? `<p class="muted high-adaptation">${e(HIGH_ADAPTATION.source)} ${e(HIGH_ADAPTATION.cultivation)}</p>` : ''}<div class="high-forge-list">${templates.map((template) => {
    const recipe = HIGH_RECIPES[template.id];
    const previous = recipe?.from ? game.p.bag.filter((it) => it.templateId === recipe.from) : [];
    const reason = recipe ? highBlockReason(template, recipe, previous[0]?.uid || (recipe.from ? 'missing' : '')) : '尚无配方';
    return `<article class="high-forge-entry"><div class="forge-art">${highEquipmentArt(template.id)}</div><div class="forge-copy"><h3>${equipmentName(template.name, 4)}</h3><p class="item-meta">${e(gearRank(template))} · ${e(SLOTS[template.slot])} · 神铸</p><p class="muted">需求：${highRequirements(template)}</p><p>${recipe ? highCost(recipe) : '暂无配方'}</p>${recipe?.from ? `<p class="muted">前阶：${equipmentName(HIGH_EQUIPMENT[recipe.from]?.name, 4)} · 需放在行囊</p>` : '<p class="muted">独立根配方 · 打造后收入行囊</p>'}<div class="form-row">${btn('规格 / 固定效果', 'highDetail', `data-id="${e(template.id)}"`, 'ghost small')}${recipe?.from ? previous.length ? previous.map((it) => btn(`${it.refine ? `+${it.refine}装备 · ` : ''}升至${template.stage}阶`, 'highAscend', `data-id="${e(it.uid)}"`, 'gold-button small', !!highBlockReason(template, recipe, it.uid))).join('') : btn('先取得并卸下前阶', 'highForgeTab', '', 'ghost small', true) : btn(reason || '确认神铸打造', 'highCraft', `data-id="${e(template.id)}"`, 'gold-button small', !!reason)}${reason && recipe?.from ? `<small class="muted">${e(reason)}</small>` : ''}</div></div></article>`;
  }).join('')}</div><p class="muted">只有以上5个已核样本。行囊装备详情也可升阶；终阶不可继续升阶。精炼、维修与镶嵌仍按本作现有规则执行。</p></section>`;
}
function refineDelta(it) {
  if (it.refine >= 12) return {};
  const before = refineGain(it, it.refine); const after = refineGain(it, it.refine + 1);
  return Object.fromEntries(Object.entries(after).map(([key, value]) => [key, +(value - (before[key] || 0)).toFixed(3)]));
}
function gemBlockReason(it, id) {
  const gem = ITEMS[id];
  if (it.ruleVersion === 2 && it.grade == null) return '装备品阶未载，不能镶嵌';
  if (it.ruleVersion !== 1 && it.ruleVersion !== 2) return gem.lv > it.lv || gem.lv > game.p.lv ? `角色和装备需${gem.lv}级` : '';
  const family = it.slot === 'weapon' ? ['patk', 'matk', 'crit', 'attackLevel', 'atkLevel'] : ['head', 'body', 'legs', 'feet', 'wrist'].includes(it.slot) ? ['hp', 'mp', 'def', 'mdef', 'defenseLevel', 'defLevel'] : [];
  if (!family.includes(gem.stat)) return '栏位属性族不适配';
  return it.grade < gemRequiredGrade(id, gem) ? `装备需${gemRequiredGrade(id, gem)}品` : '';
}
function comparisonDetails(it, targetSlot) {
  const worn = game.p.equipment[targetSlot];
  if (worn?.uid === it.uid) return '<p class="notice">当前已穿戴此装备；同UID比较无变化。</p>';
  const before = stats(game.p); const projected = structuredClone(game.p);
  for (const [slot, entry] of Object.entries(projected.equipment)) if (entry.uid === it.uid) delete projected.equipment[slot];
  projected.equipment[targetSlot] = structuredClone(it);
  const after = stats(projected);
  const differences = Object.keys(STAT_NAMES).filter((key) => Math.abs((after[key] || 0) - (before[key] || 0)) > 0.00001);
  return `<div class="equipment-comparison"><span class="detail-label">与${e(slotName(targetSlot))}比较 · 含已生效套装 / 耐久</span><p class="muted">替换${worn ? equipmentName(worn.name, worn.q) : '空栏位'}；预览不穿戴。</p>${differences.map((key) => { const delta = (after[key] || 0) - (before[key] || 0); return `<div class="comparison-row"><span>${e(STAT_NAMES[key])}</span><span>${statValue(key, before[key])} → ${statValue(key, after[key])}</span><strong class="${delta > 0 ? 'gain' : 'loss'}">${delta > 0 ? '+' : '−'}${statValue(key, Math.abs(delta), true)}</strong></div>`; }).join('') || '<p>有效属性无变化。</p>'}</div>`;
}
function equipmentModal(uid, targetSlot = '') {
  const it = [...Object.values(game.p.equipment), ...game.p.bag].find((entry) => entry.uid === uid);
  if (!it) throw new Error('装备已不存在。');
  const wornSlot = Object.entries(game.p.equipment).find(([, entry]) => entry.uid === uid)?.[0];
  const ring = it.slot === 'ring1' || it.slot === 'ring2';
  const destination = ring && ['ring1', 'ring2'].includes(targetSlot) ? targetSlot : wornSlot || it.slot;
  const locked = game.busy || ZONES[game.p.location].type !== 'city';
  const gems = Object.entries(ITEMS).filter(([id, entry]) => entry.type === 'gem' && game.p.items[id] > 0);
  const suitableGems = gems.filter(([id]) => !gemBlockReason(it, id));
  const limit = it.ruleVersion === 1 || it.ruleVersion === 2 || highTemplate(it) ? it.socketLimit : it.slot === 'weapon' ? Math.min(2, it.socketLimit) : ['head', 'body', 'legs', 'feet', 'wrist'].includes(it.slot) ? it.socketLimit : 0;
  const controls = (label, action, disabled = false) => btn(label, 'equipmentAction', `data-op="${action}" data-id="${e(uid)}"`, 'ghost small', locked || disabled);
  const template = highTemplate(it); const next = nextHighRecipe(it.templateId); const set = EQUIPMENT_SETS[it.setId];
  const requirements = equipmentRequirements(it); const excluded = structuredClone(game.p); delete excluded.equipment[destination]; const available = stats(excluded);
  const nextRecipe = it.ruleVersion === 2 ? getProductionCatalog(game.p).recipes.find((r) => predecessorIds(r).includes(it.templateId)) : null;
  const wearReason = highWearReason(it, destination);
  showModal(`${wornSlot ? '穿戴' : '行囊'}装备详情`, `${template ? `<div class="equipment-detail-art">${highEquipmentArt(template.id)}</div>` : ''}<h3>${equipmentName(it.name, undefined, it.refine ? ` +${it.refine}` : '')}</h3><div class="spec-dimensions">${[['类型', GEAR_RULES.weapons[it.weaponType]?.name || ({ heavy: '重装', light: '轻装', robe: '法装' })[it.armorType] || SLOTS[it.slot]], ['等级', it.lv == null ? '等级未载' : `Lv.${it.lv}`], ['品阶', gearRank(it)], ['星级', starLabel(it.stars)], ['系列', template ? '具名神铸' : namedTemplate(it) ? seriesName(it.series) : '历史装备']].map(([label, value]) => `<div><small>${e(label)}</small><strong>${e(value)}</strong></div>`).join('')}</div><p>${e(equipmentLabel(it))} · ${e(equipmentOrigin(it))}</p><p class="notice">${equipmentMeta(it)}${it.durability === 0 ? '<br>耐久归零：属性减半，不计套装。' : ''}</p><span class="detail-label">当前有效属性 · 精炼、宝石、耐久</span><div class="item-stats">${itemStats(it)}</div>${template ? highDetails(template) : namedTemplate(it) ? sourceDetails(it) : `<div class="raw-stat-grid"><section><span class="detail-label">未精炼基础</span>${rawStats(it.base)}${Object.entries(it.ranges || {}).map(([key, range]) => `<p>${e(STAT_NAMES[key])} ${num(range[0])}—${num(range[1])}</p>`).join('')}</section><section><span class="detail-label">实际已生成词条</span>${rawStats(it.addons)}</section></div>`}<section class="wear-requirements"><span class="detail-label">穿戴条件 · 已排除被替换的${e(slotName(destination))}</span>${Object.entries(requirements).map(([key, value]) => `<p class="${value == null ? 'muted' : (key === 'lv' ? game.p.lv : available[key] || 0) >= value ? 'gain' : 'loss'}">${key === 'lv' ? '人物等级' : e(STAT_NAMES[key] || key)}：需要 ${value == null ? '资料未载' : num(value)} / 可用 ${num(key === 'lv' ? game.p.lv : available[key])}</p>`).join('')}${it.ruleVersion === 2 ? '<p class="muted">穿戴只检查已载等级、职业和属性需求；未载属性保持未知，不认定为官方0需求。</p>' : ''}${it.ruleVersion === 1 && it.slot === 'weapon' ? `<p class="muted">按武器类型限制，非生成职业封锁：${allowedWeaponClasses(it.weaponType).length === 10 ? '不限职业' : allowedWeaponClasses(it.weaponType).map((id) => CLASSES[id].name).join('、')}</p>` : ''}</section>${ring ? `<label for="equipment-target-slot">比较 / 穿戴目标戒指栏</label><select id="equipment-target-slot" data-uid="${uid}">${['ring1', 'ring2'].map((slot) => `<option value="${slot}" ${destination === slot ? 'selected' : ''}>${e(slotName(slot))}</option>`).join('')}</select>` : ''}${comparisonDetails(it, destination)}${it.grade == null && it.ruleVersion === 2 ? '<p class="notice">品阶未载，不能精炼，不补写下一次增量。</p>' : it.refine < 12 ? `<p class="detail-label">下一次精炼 +${it.refine + 1} 的增量 · 满耐久预算</p>${rawStats(refineDelta(it))}` : '<p class="tag gold">精炼已满 +12</p>'}${btn('城镇精炼 / 转移', 'catalogGo', 'data-page="town" data-tab="refine"', 'ghost small')}<p class="muted">培养处理须在城镇且战斗外。新装备不允许通用+5升级 / 任意洗练，按实际前件配方制造。旧制动作只对无规则版本装备保留。</p><div class="form-row">${controls('维修', 'repair', it.durability >= it.maxDurability)}${template ? next ? btn('神铸升阶', 'highAscend', `data-id="${uid}"`, 'gold-button small', !!highBlockReason(HIGH_EQUIPMENT[next[0]], next[1], uid)) : '<span class="tag gold">模板终阶</span>' : it.ruleVersion === 1 || it.ruleVersion === 2 ? btn(nextRecipe ? `下一配方 · ${e(seriesName(nextRecipe.series))}${nextRecipe.lv}` : '查看生产配方', 'productionGo', `data-id="${nextRecipe?.id || ''}"`, 'ghost small') : `${controls('旧制重洗', 'reroll', !it.q)}${controls('旧制升级', 'upgrade', it.lv >= game.p.lv)}`}${controls('绑定（不可逆）', 'bind', it.bound)}${controls(it.grade == null ? '品阶未载 · 不能分解' : '分解（不可逆）', 'decompose', it.grade == null || !!wornSlot || it.bound || it.locked)}</div>${set ? `<p class="muted">旧制套装 ${e(set.name)}：${Object.entries(set.bonuses).map(([count, bonus]) => `${count}件：${Object.entries(bonus).map(([key, value]) => `${e(STAT_NAMES[key])} +${statValue(key, value, true)}`).join('、')}`).join('<br>')}</p>` : ''}<h3>孔位与宝石</h3><p class="muted">已开 ${it.sockets.length} / 上限 ${it.socketLimit}。${template ? `此高阶模板上限${it.socketLimit}孔；初始${template.initialSockets}孔，来源与本作扩展见上方。` : '新武器2、护甲4、饰品0；旧孔位原样可读。'}开孔消耗品阶×（已开孔数+1）枚镶嵌石；镶嵌只消耗宝石×1及${num(40 + it.lv * 2)}金币，拆除${num(30 + it.lv)}金币并返还宝石。</p>${controls(it.grade == null ? '品阶未载 · 不能开孔' : `开下一个孔 · ${num(it.grade * (it.sockets.length + 1))}${equipmentName(materialName('socketStone'))}`, 'punch', it.grade == null || it.sockets.length >= limit || !limit || (game.p.items.socketStone || 0) < it.grade * (it.sockets.length + 1))}<div class="socket-list">${Array.from({ length: it.socketLimit }, (_, index) => `<div class="travel-card"><span>孔${index + 1} · ${index >= it.sockets.length ? '未开孔' : it.sockets[index] === null ? '空孔（已开）' : equipmentName(materialName(it.sockets[index]))}</span>${btn('拆除并返还', 'equipmentAction', `data-op="unsocket" data-id="${uid}" data-index="${index}"`, 'ghost small', locked || !it.sockets[index])}</div>`).join('') || '<p class="muted">饰品不设镶嵌孔。</p>'}</div><label for="socket-gem">选择实际持有宝石 · 不适配项不可选</label><select id="socket-gem">${gems.length ? gems.sort(([a], [b]) => Number(!!gemBlockReason(it, a)) - Number(!!gemBlockReason(it, b))).map(([id, gem]) => `${equipmentName(gem.name, undefined, ` ×${game.p.items[id]} · ${it.ruleVersion === 1 || it.ruleVersion === 2 ? `需${gemRequiredGrade(id, gem)}品` : `需${gem.lv}级`} ${gemBlockReason(it, id)}`, { value: id, disabled: !!gemBlockReason(it, id) })}`).join('') : '<option value="">没有宝石 · 可到杂货店购买</option>'}</select>${controls('镶嵌到首个已开空孔', 'socket', !suitableGems.length || !it.sockets.includes(null) || game.p.gold < 40 + it.lv * 2)}${!wornSlot ? btn(wearReason || `装备到${e(slotName(destination))}`, 'equip', `data-id="${uid}" data-slot="${destination}"`, 'primary', game.busy || !!wearReason) : `${btn('卸下至行囊', 'unequip', `data-id="${wornSlot}"`, 'ghost', game.busy || game.p.bag.length >= BAG_LIMIT)}<p class="muted">配方前件和分解装备需先卸下至行囊。</p>`}`);
}
function equipmentSlot(slot) {
  const it = game.p.equipment[slot];
  const shapes = {
    head: '<path d="M5 15V9a7 7 0 0 1 14 0v6l-4 5v-8H9v8Z"/>',
    body: '<path d="m8 3-5 4 3 6 2-2v10h8V11l2 2 3-6-5-4-4 4Z"/>',
    legs: '<path d="M6 3h12l-1 18h-4l-1-10-1 10H7Z"/>',
    feet: '<path d="M5 3h7v10l7 3v5H4l1-9Z"/>',
    wrist: '<path d="m7 4 11 3-4 14-11-3Z"/><path d="m5 10 11 3m-9-9 7 13"/>',
    cape: '<path d="M8 3h8l5 18-9-3-9 3Z"/><path d="M8 3q4 7 8 0m-4 4v11"/>',
    neck: '<path d="M4 3c0 9 4 12 8 13 4-1 8-4 8-13"/><path d="m12 14 4 4-4 4-4-4Z"/>',
    waist: '<path d="M3 8h18v8H3Z"/><path d="M9 7h6v10H9Z"/>',
    ring1: '<circle cx="12" cy="14" r="7"/><path d="m12 2 4 4-4 4-4-4Z"/>',
    ring2: '<circle cx="12" cy="14" r="7"/><path d="m12 2 4 4-4 4-4-4Z"/>'
  };
  const art = highTemplate(it) ? highEquipmentArt(it.templateId) : slot === 'weapon' ? icon('sword') : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" aria-hidden="true">${shapes[slot]}</svg>`;
  return `<button class="equip-slot " data-action="equipped" data-id="${slot}"><span class="slot-label">${slotName(slot)}</span><span class="slot-art">${art}</span><strong>${it ? equipmentName(it.name, undefined, it.refine ? ` +${it.refine}` : '') : '尚未装备'}</strong><small>${it ? `Lv.${it.lv} · ${e(gearRank(it))} · ${e(equipmentLabel(it))} · 耐久${it.durability} · ${it.bound ? '绑定' : '未绑定'}` : '点击查看获取途径'}</small></button>`;
}
function characterPage() {
  const p = game.p; const s = stats(p, game.busy ? game.battle : null);
  return pageTitle('人物属性', `${e(p.name)} · ${CLASSES[p.cls].name} · 战力 ${num(s.power)}`, btn('推荐加点', 'allocateAuto', '', 'primary', !p.points || game.busy)) + `<section class="character-banner"><figure class="character-portrait"><img src="/art/cultivator-portrait-v1.webp" alt="原创修真者意象，非实时职业或装备外观"></figure><div class="character-identity"><div class="eyebrow">修行之人</div><h2>${e(p.name)}</h2><p>${RACES[p.race].name} · ${CLASSES[p.cls].name} · ${cultName(p.cult, p.path)}</p><small class="muted">人物意象 · 非实时外观</small></div><div class="character-summary">${[['人物等级', p.lv], ['战力', num(s.power)], ['生命上限', num(s.hp)], ['真气上限', num(s.mp)]].map(([label, value]) => `<div class="stat-box"><small>${label}</small><strong>${value}</strong></div>`).join('')}</div></section><div class="grid-two">${card('根骨与修为', `<p class="notice">每升一级获得5点自由属性。待分配：<strong>${p.points}</strong></p>${[['str', '力量', '提升物攻与物防'], ['con', '体质', '提升生命与双防'], ['dex', '敏捷', '提升弓匕攻击、暴击与闪避'], ['mag', '灵力', '提升法攻、真气与法防']].map(([id, name, desc]) => `<div class="attribute-row"><div class="attribute-name"><strong>${name}</strong><small>${desc}</small></div><strong class="attribute-value">${num(s[id])}</strong><div class="attribute-actions">${btn('+1', 'allocate', `data-id="${id}" data-qty="1"`, 'small', p.points < 1 || game.busy)}${btn('+5', 'allocate', `data-id="${id}" data-qty="5"`, 'ghost small', p.points < 5 || game.busy)}</div></div>`).join('')}<div class="stat-grid">${Object.entries(STAT_NAMES).map(([k, title]) => `<div class="stat-box" data-stat="${k}"><small>${title}${['hp', 'mp'].includes(k) ? '上限' : ''}</small><strong>${statValue(k, s[k])}</strong></div>`).join('')}</div>`) }${card('随身装备', `<div class="equipped-grid">${Object.keys(SLOTS).map(equipmentSlot).join('')}</div>`, btn('装备图鉴与培养', 'catalogGo', 'data-page="bag" data-tab="arsenal"', 'ghost small'))}</div>${card('外观与护符', appearancePanel())}${card('修行足迹', `<div class="stat-grid"><div class="stat-box"><small>战斗胜利</small><strong>${num(p.totals.battles)}</strong></div><div class="stat-box"><small>阵亡次数</small><strong>${num(p.totals.deaths)}</strong></div><div class="stat-box"><small>探索地点</small><strong>${p.discovered.length}/${Object.keys(ZONES).length}</strong></div><div class="stat-box"><small>副本通关</small><strong>${num(Object.values(p.clears).reduce((a, b) => a + b, 0))}</strong></div></div>`)}`;
}
const ITEM_GROUPS = { potions: '生命与真气', materials: '装备材料', gems: '镶嵌宝石', activities: '宝盒与秘宝', charms: '自动护符', other: '历练与保命' };
const slotName = (slot) => slot === 'ring1' ? '主戒' : slot === 'ring2' ? '副戒' : SLOTS[slot];
function itemGroup(id) {
  const type = ITEMS[id].type;
  return ['hp', 'mp'].includes(type) ? 'potions' : ['mat', 'material'].includes(type) ? 'materials' : type === 'gem' ? 'gems' : ['chest', 'event'].includes(type) ? 'activities' : type === 'charm' ? 'charms' : 'other';
}
function itemUsage(id) {
  const it = ITEMS[id];
  if (['hp', 'mp'].includes(it.type)) return `恢复${num(it.value)}点${it.type === 'hp' ? '生命' : '真气'}，不超过上限；战斗中使用占用一回合，敌人仍会行动。`;
  if (it.type === 'gem') return `镶嵌增加${STAT_NAMES[it.stat]} ${statValue(it.stat, it.value, true)}；新装备需${gemRequiredGrade(id, it)}品且适配栏位属性族（武器攻击类 / 护甲生命真气防御类）。旧装备与固定模板仍要求角色、装备均${it.lv}级。先开孔，镶嵌消耗宝石×1及金币；拆除返还宝石。`;
  if (ACTIVITY_POOLS[id]) return '先购入持有，在「装备与行囊 → 持有道具」开启；每次消耗本物品×1，不额外扣钥匙或钱包，不影响鸿运保底。随机奖励不是购买即到账。';
  if (id === 'treasureKey') return '仅用于鸿运秘宝，每抽消耗1把；支持1抽或10抽。开箱开粽不消耗钥匙。';
  if (it.type === 'charm') return `${it.desc} 战斗外在人物页装填，消耗持有道具，储量可追加；装填本身不直接治疗。`;
  return ({ town: '战斗外直接使用，消耗1张并返回最近停留的主城。', julin: `每枚追加${it.value}场双倍战斗经验，可叠加剩余场数；只加倍经验，不加倍金币或元神，无离线收益。`, revive: '阵亡时自动消耗1张，生命与真气恢复50%，不损失经验；该场挑战仍然失败，不是手动满血复活。', huanxian: '城镇精炼的基本材料：武器每次2枚、其他部位1枚，失败也扣材料及金币。普通生产不用幻仙石；具名装备品阶未载时不能分解，已载装备按本作后端规则回收，不按名称色判断。', tiangang: '精炼辅助：本作成功率+15个百分点，失败归零；每次1枚，不能和其他辅助叠加。', disha: '精炼辅助：本作成功率+5个百分点，失败降1级最低0；每次1枚。', qiankun: '精炼辅助：失败保持原等级，不翻倍概率。亦用于精炼转移和配方继承；转移使用官方乾坤石数量表，孔位 / 宝石继承费用为本作适配。', dragonOrb1: '一星龙珠只保证当前+0的下一次+1成功，不跳级，不能保证+2或以上。', card: `城镇「日常 → 卡片BOSS」全部兑换，每张获得${num(100 + game.p.lv * 30)}元神（按当前人物等级计算）。`, socketStone: '城镇装备详情先开孔：消耗品阶×（当前已开孔数+1）枚。新武器最多2孔、护甲4孔、饰品0孔；镶嵌本身只扣宝石及金币。开孔成本为本作适配。', reforgeStone: '仅旧存档无ruleVersion装备可重洗：重铸石×1、精华×1及金币。新装备须按配方重新制造，固定神铸不可随机洗练。', upgradeStone: '仅旧存档无ruleVersion装备通用最多+5级：升阶石×1、精华×2及金币。新普通 / 系列装备不能使用，须按配方消耗材料与前件。', salvage: '旧装备分解所得旧制培养材料；新装备分解按品质回收普通资源 / 幻仙石，黄昏装备额外回收剑魂。仅分解行囊中未绑定、未锁定装备；宝石返还。', highForgeSigil: '城镇105级神铸兑换和19品双斧升阶材料；各配方需20—120枚及金币。配方、资源与回合适配均为本作设定，不是官方成本。' })[id] || it.desc;
}
function itemSources(id) {
  const result = [];
  const add = (text, destination, tab = '', product = '') => result.push({ text, destination, tab, product });
  if ([...shopList('potion', 105), ...shopList('other', 105)].includes(id)) add(`城镇补给 · ${num(ITEMS[id].price)}金币 / 个${ITEMS[id].lv > game.p.lv + 5 ? ` · 需人物${Math.max(1, ITEMS[id].lv - 5)}级才在售` : ' · 当前等级可购买'}`, 'town', 'shop');
  for (const product of SHOP_PRODUCTS) {
    const reward = product.rewards.find((reward) => reward.type === 'item' && reward.itemId === id);
    if (!reward) continue;
    const minLevel = Math.max(product.minLevel, ...product.rewards.map((reward) => reward.type === 'item' ? ITEMS[reward.itemId].lv : reward.type === 'cosmetic' ? COSMETICS.find((it) => it.id === reward.cosmeticId).minLevel : 1));
    add(`乾坤袋 · ${product.name} · ${num(product.price)}${currencyName(product.currency)} / 份 · 内含${reward.quantity}个 · 需${minLevel}级 · 日限${product.dailyLimit}份`, 'mall', 'all', product.id);
  }
  if (HONGYUN_POOL.some((prize) => prize.rewards.some((reward) => reward.type === 'item' && reward.itemId === id))) add('鸿运秘宝 · 奖池随机获得，非必出', 'activities');
  for (const pool of Object.values(ACTIVITY_POOLS)) if (pool.pool.some((prize) => prize.rewards.some((reward) => reward.type === 'item' && reward.itemId === id))) add(`${pool.name} · 开启随机获得，非必出`, 'bag', 'items');
  for (const milestone of MILESTONES) if (milestone.rewards.some((reward) => reward.type === 'item' && reward.itemId === id)) add(`累计活动礼 · ${milestone.name}（${milestone.target}次）达标后手动领取一次`, milestone.counter === 'draws' ? 'activities' : 'bag', milestone.counter === 'draws' ? '' : 'items');
  if (['hp1', 'mp1', 'town', 'huanxian'].includes(id)) add('新角色初始补给；仅创建时发放，不是每日礼包', 'guide');
  if (['hp1', 'mp1'].includes(id)) add('战斗胜利 · 按敌人类型概率掉落基础药品', 'world');
  if (id === 'huanxian') { add('战斗胜利 · 首领确定掉落3枚、其他敌人概率掉落；副本最终首领通关另奖5枚', 'town', 'dungeon'); add('城镇今日补给 · 每日3枚', 'town', 'activities'); }
  if (id === 'julin') add('城镇今日补给 · 每日1枚', 'town', 'activities');
  if (id === 'card') add('击败首领 · 野外及副本首领每只1张', 'world');
  if (id === 'tiangang') add('副本最终首领波通关 · 每次1枚', 'town', 'dungeon');
  if (id === 'salvage') add('分解行囊内可分解装备 · 数量由品质、等级与精炼决定', 'bag', 'equipment');
  if (id === 'highForgeSigil') add('推荐等级≥75的副本最终首领波通关 · 每次2枚；普通波与野外首领不掉落', 'town', 'dungeon');
  if (/^(ore|wood|fiber)[123]$/.test(id)) add('野外手动采集：人物等级与所在区域推荐下限取较低值，≤20 / ≤60 / >60分三档，后端间隔2秒', 'world');
  if (/^hide[123]$/.test(id)) add('实际战斗胜利的皮料资源；档位与数量按本作规则，不可用矿 / 木 / 纤维按钮采皮', 'world');
  for (const d of DUNGEONS.filter((d) => d.rewardMaterials?.includes(id))) add(`${d.name} · 本作汇总生产材料，不掉成品装备`, 'town', 'dungeon');
  if (Object.hasOwn(LUNAR_MATERIAL_DROPS, id)) for (const d of DUNGEONS.filter((d) => d.family === 'lunar')) add(`${d.name} · 最终首领波通关获得${LUNAR_MATERIAL_DROPS[id]}份；具名材料分配与数量为本作适配，不是官方掉落表`, 'town', 'dungeon');
  if (id === 'ttMachine') add('城镇生产台 · 消耗一、二档矿木资源与金币加工', 'town', 'forge');
  if (id === 'ttSoul') add('历史公式黄昏装备分解所得；当前具名目录未登记黄昏前件链，不代表可执行新链', 'bag', 'equipment');
  if (['ore1', 'wood1', 'fiber1', 'hide1'].includes(id)) add('首个主线完成后各获3份一档原料，仅一次；本作新手生产奖励', 'quests');
  if (id === 'dragonOrb1') add('当前版本未开放获取途径；仅提供持有后的精炼规则，不在商城或补给店售卖', 'town', 'refine');
  return result;
}
function directItemReason(id) {
  const it = ITEMS[id];
  if (game.p.lv < it.lv) return `需${it.lv}级`;
  if (!(game.p.items[id] > 0)) return '尚未持有';
  if (game.busy && !['hp', 'mp'].includes(it.type)) return '需战斗外使用';
  if (auto) return '先暂停自动战斗';
  if (['hp', 'mp'].includes(it.type) && !game.busy && game.p[it.type] >= stats(game.p)[it.type]) return `${it.type === 'hp' ? '生命' : '真气'}已满`;
  return '';
}
function boxOpenReason(id, count) {
  const pool = ACTIVITY_POOLS[id];
  if (game.busy) return '战斗中不可开启';
  const minLevel = Math.max(pool.minLevel, ITEMS[id].lv);
  if (game.p.lv < minLevel) return `需${minLevel}级`;
  if ((game.p.items[id] || 0) < count) return `需持有${count}个`;
  if ((game.p.items.treasureKey || 0) < pool.keyCost * count) return '钥匙不足';
  if (pool.pool.some((prize) => prize.rewards.some((reward) => reward.type === 'equip')) && game.p.bag.length + count > BAG_LIMIT) return `需预留${count}格装备行囊`;
  return '';
}
function boxOpenButtons(id) {
  return [1, 10].map((count) => {
    const reason = boxOpenReason(id, count);
    return btn(`开启${count}个`, 'activityOpen', `data-id="${e(id)}" data-count="${count}" title="${e(reason || `消耗${ITEMS[id].name}×${count}`)}" aria-label="开启${e(ITEMS[id].name)}${count}个${reason ? `：${e(reason)}` : ''}"`, count === 1 ? 'gold-button small' : 'ghost small', !!reason);
  }).join('');
}
function itemDetail(id) {
  const it = ITEMS[id]; if (!it) throw new Error('道具不存在。');
  const direct = ['hp', 'mp', 'town', 'exp'].includes(it.type); const reason = direct ? directItemReason(id) : '';
  showModal('道具详情 · 用途与获取', `<div class="item-detail-heading">${itemArt(id)}<div><span class="eyebrow">${e(ITEM_GROUPS[itemGroup(id)])}</span><h3>${equipmentName(it.name)}</h3><p>需人物 ${it.lv} 级 · 持有 <strong>${num(game.p.items[id])}</strong> 个${it.tier ? ` · ${it.tier}阶宝石` : ''}</p></div></div><p class="notice">${itemText(itemUsage(id))}</p>${direct ? btn(reason || '使用1个', 'useItem', `data-id="${e(id)}"`, 'primary', !!reason) : ACTIVITY_POOLS[id] ? `<div class="economy-actions">${boxOpenButtons(id)}</div><p class="muted">${e(boxOpenReason(id, 1) || '可开启；提交成功后消耗持有物品，发放一次真实随机奖励。')}</p><h4 class="info-subtitle">可能获得 · 独立奖池</h4>${probabilityList(ACTIVITY_POOLS[id].pool)}${btn('查看包裹持有物品', 'catalogGo', 'data-page="bag" data-tab="items"', 'ghost small')}` : id === 'treasureKey' ? btn('前往鸿运秘宝', 'catalogGo', 'data-page="activities"', 'gold-button') : it.type === 'charm' ? btn('前往人物装填护符', 'catalogGo', 'data-page="character"', 'primary') : id === 'card' ? btn('前往兑换元神', 'catalogGo', 'data-page="town" data-tab="activities"', 'primary') : id === 'highForgeSigil' ? btn('查看神铸配方与需求', 'catalogGo', 'data-page="bag" data-tab="arsenal"', 'primary') : ['huanxian', 'tiangang', 'disha', 'qiankun', 'dragonOrb1'].includes(id) ? btn('前往城镇精炼', 'catalogGo', 'data-page="town" data-tab="refine"', 'primary') : id === 'revive' ? '<span class="tag gold">阵亡时自动使用 · 无手动复活</span>' : btn('查看装备与培养', 'catalogGo', 'data-page="bag" data-tab="equipment"', 'primary')}<h4 class="info-subtitle">实际获取途径</h4>${/^(ore|wood|fiber|hide)[123]$/.test(id) || Object.hasOwn(LUNAR_MATERIAL_DROPS, id) || ['tt1', 'tt2', 'tt3', 'ttMachine', 'ttSoul', 'lunarEssence', 'rapture', 'uncanny'].includes(id) ? btn('采集地点 / 材料副本 / 前件来源', 'materialSource', `data-id="${id}"`, 'ghost small') : ''}<ul class="item-source-list">${itemSources(id).map((source) => `<li><span>${itemText(source.text)}</span>${btn('前往', 'catalogGo', `data-page="${source.destination}" data-tab="${source.tab}"${source.product ? ` data-product="${e(source.product)}"` : ''}`, 'ghost small')}</li>`).join('')}</ul><p class="muted">以上为本作当前规则。持有数来自存档；浏览不会发物品，商城价格与礼包数量以实际商品为准，材料基础价格为0不代表免费。</p>`);
}
function itemPreview(id, ownedOnly = false) {
  const it = ITEMS[id]; const quantity = game.p.items[id] || 0;
  const direct = ['hp', 'mp', 'town', 'exp'].includes(it.type); const reason = direct ? directItemReason(id) : '';
  return `<article class="codex-item ${quantity ? 'owned' : ''}" data-item="${e(id)}"><button class="codex-preview" data-action="itemDetail" data-id="${e(id)}" aria-label="查看${e(it.name)}用途与获取"><span class="codex-art">${itemArt(id)}</span><span class="codex-copy"><small>${e(ITEM_GROUPS[itemGroup(id)])} · Lv.${it.lv}</small><strong>${equipmentName(it.name)}</strong><span>${e(it.type === 'gem' ? `镶嵌：${STAT_NAMES[it.stat]} +${statValue(it.stat, it.value, true)}` : it.desc)}</span></span></button><div class="codex-footer"><span class="${quantity ? 'owned-label' : 'muted'}">${quantity ? `持有 ×${num(quantity)}` : '尚未持有 · 可查来源'}</span>${ownedOnly && ACTIVITY_POOLS[id] ? boxOpenButtons(id) : ownedOnly && direct ? btn(reason || '使用', 'useItem', `data-id="${e(id)}"`, 'ghost small', !!reason) : ''}${btn(ACTIVITY_POOLS[id] ? '用途 / 奖池' : '用途 / 获取', 'itemDetail', `data-id="${e(id)}"`, 'ghost small')}</div></article>`;
}
function filteredItems() {
  const query = codexSearch.trim().toLocaleLowerCase();
  return Object.keys(ITEMS).filter((id) => (codexCategory === 'all' || itemGroup(id) === codexCategory) && (!query || `${ITEMS[id].name} ${ITEMS[id].desc} ${itemUsage(id)} ${ITEM_GROUPS[itemGroup(id)]}`.toLocaleLowerCase().includes(query)));
}
function updateCodexResults() {
  const ids = filteredItems();
  if ($('#codex-results')) $('#codex-results').innerHTML = ids.map((id) => itemPreview(id)).join('') || empty('没有符合的道具，试试其他名称、效果或分类。');
  if ($('#codex-count')) $('#codex-count').textContent = `显示 ${ids.length} / ${Object.keys(ITEMS).length} 种`;
}
function itemCatalog() {
  const ids = filteredItems();
  return `<section class="item-catalog"><div class="catalog-intro"><div><div class="eyebrow">万物有谱 · 不持有也能查</div><h2>道具图鉴</h2><p class="muted">药品、材料、魂石、护符与箱粽。点击道具查看数值、使用方式和实际获取途径。</p></div><span id="codex-count" class="tag">显示 ${ids.length} / ${Object.keys(ITEMS).length} 种</span></div><div class="codex-toolbar"><div><label for="codex-search">搜索道具 / 效果</label><input id="codex-search" class="field" type="search" maxlength="100" placeholder="如：暴击、精炼、回城" value="${e(codexSearch)}"></div><div><label for="codex-category">道具分类</label><select id="codex-category" class="field"><option value="all">全部道具</option>${Object.entries(ITEM_GROUPS).map(([id, name]) => `<option value="${id}" ${codexCategory === id ? 'selected' : ''}>${name}</option>`).join('')}</select></div></div><div id="codex-results" class="codex-grid">${ids.map((id) => itemPreview(id)).join('') || empty('没有符合的道具，试试其他名称、效果或分类。')}</div></section>`;
}
function discoveryLinks() {
  return `<div class="discovery-grid"><button data-action="catalogGo" data-page="bag" data-tab="equipment">${icon('sword')}<strong>我的装备</strong><span>${Object.keys(SLOTS).length}个穿戴栏 · 装备与处理</span>${icon('arrow')}</button><button data-action="catalogGo" data-page="bag" data-tab="catalog">${icon('bag')}<strong>道具图鉴</strong><span>${Object.keys(ITEMS).length}种 · 用途、数值与获取</span>${icon('arrow')}</button><button data-action="catalogGo" data-page="bag" data-tab="arsenal">${icon('cult')}<strong>装备图鉴</strong><span>有限具名条目 · 职业 / 等级 / 部位查询</span>${icon('arrow')}</button></div>`;
}
function rawStats(values) {
  return `<div class="item-stats">${Object.entries(values || {}).filter(([key, value]) => STAT_NAMES[key] && Number.isFinite(value)).map(([key, value]) => `<span>${e(STAT_NAMES[key])} ${value < 0 ? '−' : '+'}${percentStats.has(key) || key === 'speed' ? statValue(key, Math.abs(value), true) : Number(Math.abs(value).toFixed(3)).toLocaleString('zh-CN')}</span>`).join('') || '<span class="muted">无额外属性</span>'}</div>`;
}
function sourceValue(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'string') return itemText(value).replaceAll('\n', '<br>');
  if (Number.isFinite(value)) return e(num(value));
  if (Array.isArray(value)) return value.map((entry) => typeof entry === 'string' ? sourceValue(entry) : typeof entry?.text === 'string' ? sourceValue(entry.text) : '').filter(Boolean).join('<br>');
  if (typeof value === 'object') return Object.entries(value).filter(([key, entry]) => STAT_NAMES[key] && (Number.isFinite(entry) || Array.isArray(entry) && entry.length === 2 && entry.every(Number.isFinite))).map(([key, entry]) => `<p>${e(STAT_NAMES[key])}：${Array.isArray(entry) ? entry.map((v) => statValue(key, v, true)).join('—') : statValue(key, entry, true)}</p>`).join('');
  return '';
}
function sourceDetails(template) {
  const source = template.sourceRecord || {};
  const local = (template.status || source.status) === 'local-tutorial';
  const links = [source.source?.url, source.url, typeof source.source === 'string' ? source.source : null, ...(Array.isArray(template.source) ? template.source : [typeof template.source === 'string' ? template.source : template.source?.url])].filter((url) => typeof url === 'string' && /^https?:\/\//.test(url));
  const recorded = Object.fromEntries(Object.entries(source.sourceStats || {}).map(([key, value]) => [key === 'evade' ? 'evasionRating' : key, value]).filter(([key, value]) => STAT_NAMES[key] && (Number.isFinite(value) || Array.isArray(value) && value.length === 2 && value.every(Number.isFinite))));
  const unknown = [];
  if (!local) {
    if (template.slot === 'weapon' && !['patk', 'matk'].some((key) => recorded[key] != null)) unknown.push('原始攻击');
    if (template.grade == null) unknown.push('品阶');
    if (template.stars == null) unknown.push('星级');
    if (template.lv == null || template.requirements == null || Object.values(template.requirements).some((value) => value == null)) unknown.push('部分穿戴需求');
  }
  const ranges = Object.entries(template.ranges || {}).filter(([key, range]) => STAT_NAMES[key] && Array.isArray(range) && range.length === 2 && range.every(Number.isFinite)).map(([key, range]) => `<p>${e(STAT_NAMES[key])}范围 ${range.map((v) => statValue(key, v, true)).join('—')}</p>`).join('');
  const affixes = (template.affixes || []).filter((affix) => typeof affix.text === 'string');
  const originalMaterials = (Array.isArray(source.materials) ? source.materials : []).filter((material) => typeof material.name === 'string').map((material) => `<li>${equipmentName(material.name)}${Number.isFinite(material.quantity ?? material.qty ?? material.count) ? ` ×${num(material.quantity ?? material.qty ?? material.count)}` : ' · 数量待确认'}</li>`).join('');
  return `<section class="named-source-details" data-source-status="${e(template.status || source.status || 'unknown')}"><section class="catalog-detail-section"><h4>装备属性</h4><p class="catalog-property-label">本作参考属性${local ? ' · 训练用' : ''}</p><div class="raw-stat-grid"><section><span class="detail-label">基础属性</span>${rawStats(template.base)}${ranges}</section><section><span class="detail-label">${template.uid ? '当前附加属性' : '附加属性参考'}</span>${rawStats(template.addons)}${!template.uid && affixes.some((affix) => affix.supported && affix.range?.[0] !== affix.range?.[1]) ? '<p class="muted">此处展示下限，制造后在原文范围内取值。</p>' : ''}</section></div>${local ? '<p class="catalog-boundary-note">本作训练装备：名称、属性、需求与费用为教学设定，非官方装备。</p>' : unknown.length ? `<p class="catalog-boundary-note">资料未载：${e(unknown.join('、'))}。参考属性仅用于本作，不补作官方值。</p>` : '<p class="catalog-boundary-note">原始资料见下方；战斗换算与获取费用按本作规则。</p>'}</section><section class="catalog-detail-section"><h4>穿戴需求</h4><p>${highRequirements(template)}</p><p>适用职业：${Array.isArray(template.classes) ? template.classes.length ? template.classes.filter((id) => CLASSES[id]).map((id) => e(CLASSES[id].name)).join('、') : '不限职业' : '待确认'}</p>${template.slot === 'ring1' ? '<p class="muted">主戒、副戒均可穿戴。</p>' : ''}</section><details class="catalog-original-source"><summary>原文与来源</summary><div class="catalog-source-body">${local ? '<p>本作训练装备，没有官方原文。</p>' : `<p>已记录 ${Object.keys(recorded).length} 项基础属性、${(source.affixes || []).length} 条附加属性、${(source.materials || []).length} 种材料。</p>${Object.keys(recorded).length ? `<h5>原始基础属性</h5>${sourceValue(recorded)}` : ''}${source.requirements ? `<h5>原始穿戴需求</h5>${sourceValue(source.requirements)}` : ''}${affixes.length ? `<h5>附加属性原文</h5><ul>${affixes.map((affix) => `<li>${sourceValue(affix.text)}${!affix.supported ? '<small>仅供参考 · 本作暂不生效</small>' : ''}</li>`).join('')}</ul>` : ''}${originalMaterials ? `<h5>原文材料用量</h5><ul>${originalMaterials}</ul>` : ''}<p class="muted">攻击区间在本作属性面板取均值；职业限制与防御换算按本作规则，未记录的属性保持未知。</p>`}<p class="source-note">名称颜色只反映已核来源，不代表等级、品阶或星级；颜色未知时不推测。</p><div class="source-links">${[...new Set(links)].map((url, index) => `<a href="${e(url)}" target="_blank" rel="noopener">官方资料 ${index + 1}</a>`).join(' · ') || (local ? '' : '<span class="muted">暂缺来源链接</span>')}</div></div></details></section>`;
}
function specDetails(spec) {
  if (!spec) return empty('装备详情暂不可用。');
  const local = (spec.status || spec.sourceRecord?.status) === 'local-tutorial';
  return `<div class="spec-preview catalog-equipment-preview"><div class="spec-preview-head">${icon(spec.slot === 'weapon' ? 'sword' : 'shield')}<div><small>装备图鉴 · 预览不会获得装备</small><h3>${equipmentName(spec.name)}</h3>${local ? '<span class="tag catalog-training-tag">本作训练装备</span>' : ''}</div></div><div class="spec-dimensions">${[['部位', catalogSlotLabel(spec.slot) || '待确认'], ['等级', spec.lv == null ? '待确认' : `${spec.lv}级`], ['品阶', gradeLabel(spec.grade)], ['星级', starLabel(spec.stars)]].map(([label, value]) => `<div><small>${e(label)}</small><strong>${e(value)}</strong></div>`).join('')}</div>${sourceDetails(spec)}</div>`;
}
function productionReasons(recipe, candidate = null, inherit = false) {
  const m = recipe.missing; const reasons = [];
  if (game.busy) reasons.push('战斗中不可生产');
  if (m.city) reasons.push('需回城生产');
  if (m.playerLv) reasons.push(`需人物${recipe.playerLv}级`);
  if (m.skillLevel) reasons.push(`需${PRODUCTION_SKILLS[recipe.skill].name}${recipe.skillLevel}级`);
  if (recipe.from && !candidate) reasons.push('需行囊中的匹配前件');
  if (m.bagSpace) reasons.push('行囊已满');
  if (m.skillExpCap) reasons.push('生产经验已满，先训练');
  const payment = inherit && candidate ? candidate.inherit.missing : m;
  if (payment.gold) reasons.push(`缺${num(payment.gold)}金币`);
  if (Object.keys(payment.materials).length) reasons.push('缺材料');
  return reasons;
}
function predecessorIds(recipe) {
  const from = recipe.from;
  if (typeof from === 'string') return [from];
  if (Array.isArray(from)) return from.filter((id) => typeof id === 'string');
  return from?.templateId ? [from.templateId] : (from?.templateIds || []);
}
function predecessorNames(recipe) {
  return predecessorIds(recipe).map((id) => `${equipmentName(NAMED_EQUIPMENT[id]?.name || HIGH_EQUIPMENT[id]?.name || id)} <small>${e(id)}</small>`).join(' 或 ') || '无具名可执行前件';
}
function recipeChain(recipe) {
  const template = namedTemplate(recipe.templateId);
  return `<div class="recipe-chain" aria-label="实际具名配方"><span>${namedTemplate(recipe.templateId)?.status === 'local-tutorial' ? '本作训练材料' : '源材料 · 原文数量'}</span><b aria-hidden="true">→</b>${recipe.from ? `<span>${predecessorNames(recipe)}<small>行囊前件 · 真实消耗</small></span><b aria-hidden="true">→</b>` : ''}<span>${e(PRODUCTION_SKILLS[recipe.skill]?.name || recipe.skill)} ${recipe.skillLevel}级<small>金币 + 材料</small></span><b aria-hidden="true">→</b><span class="recipe-output">${equipmentName(template?.name || recipe.previews?.[0]?.name || recipe.name)}<small>${e(recipe.templateId)}</small></span></div>`;
}
function materialTable(materials, sourceButtons = true) {
  return `<div class="material-table">${Object.entries(materials).map(([id, count]) => {
    const owned = game.p.items[id] || 0;
    return `<div class="material-row ${owned < count ? 'missing' : 'enough'}"><span>${equipmentName(materialName(id))}</span><strong>${num(owned)} / ${num(count)}<small>持有 / 需要</small></strong>${sourceButtons ? btn('来源', 'materialSource', `data-id="${id}"`, 'ghost small') : ''}</div>`;
  }).join('')}</div>`;
}
function productionSource(id) {
  const raw = /^(ore|wood|fiber|hide)([123])$/.exec(id);
  const lunar = Object.hasOwn(LUNAR_MATERIAL_DROPS, id);
  const dungeons = DUNGEONS.filter((d) => lunar ? d.family === 'lunar' : d.rewardMaterials?.includes(id));
  let body = '';
  if (raw) {
    const fields = Object.entries(ZONES).filter(([, z]) => z.type === 'field' && productionTier(Math.max(1, z.lv[0])) === Number(raw[2]));
    body = `<p class="notice">${raw[1] === 'hide' ? '战斗胜利获取该档皮料；不设自动采集。' : `野外手动${{ ore: '采矿', wood: '伐木', fiber: '采纤维' }[raw[1]]}，后端每2秒最多采集一次。`}材料分档取人物等级与所在野外推荐下限的较低值：≤20 / ≤60 / >60；低等级进入高档区域仍只能采较低档。</p><div class="travel-list">${fields.map(([zoneId, z]) => `<div class="travel-card"><div><strong>${e(z.name)}</strong><small>本作 Lv.${z.lv.join('—')}${routeTo(game.p.location, zoneId, game.p) ? ' · 可按路线抵达' : ' · 旅行门槛未满足'}</small></div>${btn('路线', 'sourceRoute', `data-id="${zoneId}"`, 'ghost small')}</div>`).join('')}</div>`;
  } else if (id === 'ttMachine') body = `<p class="notice">在城镇生产台加工千机材，消耗一、二档矿 / 木资源与金币。不是商城免费材料。</p>${btn('查看加工成本', 'productionGo', '', 'primary')}`;
  else if (id === 'ttSoul') body = `<p class="notice warning">历史公式黄昏装备曾用分解获取剑魂；分解永久失去该装备。当前具名目录没有登记对应黄昏进阶链，不把此旧材料当作可执行新链。</p>${btn('查看行囊装备', 'catalogGo', 'data-page="bag" data-tab="equipment"', 'primary')}`;
  else body = dungeons.length ? `<p class="notice">${lunar ? `神月最终首领波通关获得此具名材料${LUNAR_MATERIAL_DROPS[id]}份；分配与数量是本作适配，不是官方掉落表。材料名称和制造用量按逐件来源配方。` : '以下副本提供本作汇总生产材料，不直接掉该系列成品装备。数量和波次为本作适配。'}</p>${dungeons.map((d) => `<div class="travel-card"><div><strong>${e(d.name)}</strong><small>本作 Lv.${d.lv}</small></div>${btn('门槛 / 入口', 'dungeonDetail', `data-id="${d.id}"`, 'ghost small')}</div>`).join('')}` : `<p class="notice">${itemText(itemUsage(id))}</p>${itemSources(id).map((source) => `<p>${itemText(source.text)}</p>`).join('')}${btn('查看完整道具来源', 'itemDetail', `data-id="${id}"`, 'primary')}`;
  showModal(`${equipmentName(materialName(id))} · 实际来源`, body);
}
function catalogSlotLabel(slot) {
  return slot === 'ring1' || slot === 'ring2' ? '戒指（主/副戒共用）' : SLOTS[slot];
}
function catalogSeriesLabel(series) { return series === 'high' ? '固定神铸' : seriesName(series); }
function equipmentCatalogFilters() {
  const f = catalogFilter;
  const select = (id, label, value, options) => `<label for="${id}">${label}<select id="${id}" class="field">${[['all', '全部'], ...options].map(([key, name]) => `<option value="${e(key)}" ${String(key) === String(value) ? 'selected' : ''}>${e(name)}</option>`).join('')}</select></label>`;
  const grades = [...new Set(EQUIPMENT_CATALOG.map((entry) => entry.grade).filter((grade) => grade != null))].sort((a, b) => a - b);
  return `<div class="gear-catalog-filters gear-catalog-primary">${select('catalog-class', '职业 / 已载穿戴限制', f.cls || game.p.cls, Object.entries(CLASSES).map(([id, c]) => [id, c.name]))}${select('catalog-slot', '装备部位', f.slot, Object.keys(SLOTS).filter((slot) => slot !== 'ring2').map((slot) => [slot, catalogSlotLabel(slot)]))}<label for="catalog-min-level">最低等级<input id="catalog-min-level" class="field" type="number" min="1" max="${CATALOG_MAX_LEVEL}" step="1" inputmode="numeric" placeholder="留空不限" value="${e(f.minLv)}"></label><label for="catalog-max-level">最高等级<input id="catalog-max-level" class="field" type="number" min="1" max="${CATALOG_MAX_LEVEL}" step="1" inputmode="numeric" placeholder="留空不限" value="${e(f.maxLv)}"></label></div><details class="gear-catalog-advanced"><summary>更多筛选 · 类型 / 已载品阶 / 数字排序</summary><div class="gear-catalog-filters">${select('catalog-type', '装备类型', f.type, Object.entries(CATALOG_TYPES))}${select('catalog-grade', '已载数字品阶', f.grade, grades.map((grade) => [grade, gradeLabel(grade)]))}<label for="catalog-sort">数字升序排列<select id="catalog-sort" class="field">${[['level-grade', '等级 → 品阶'], ['grade-level', '品阶 → 等级']].map(([id, text]) => `<option value="${id}" ${id === f.sort ? 'selected' : ''}>${text}</option>`).join('')}</select></label></div></details><p class="muted catalog-level-hint">实际有限具名条目；未载不补写。名称色与品阶、等级、星级及系列独立。</p>`;
}
function equipmentCatalogResults(result) {
  const { entries, total, catalogTotal, page, pageCount, pageSize, error } = result;
  const first = total ? (page - 1) * pageSize + 1 : 0;
  const rows = entries.map((entry) => `<button type="button" class="gear-catalog-row" data-action="catalogEquipmentDetail" data-id="${e(entry.id)}" data-template-id="${e(entry.templateId || entry.id)}"><span class="gear-catalog-name">${equipmentName(entry.name)}<small>${e(catalogSlotLabel(entry.slot) || '部位未载')} · ${e(CATALOG_TYPES[entry.type] || entry.type)} · ${e(catalogSeriesLabel(entry.series))}</small></span><span class="gear-catalog-meta"><span>${entry.lv == null ? '等级未载' : `Lv.${entry.lv}`}</span><span>${gradeLabel(entry.grade)}</span><span>${e(sourceStatus(entry))}</span><span>${starLabel(entry.stars)}${entry.stage ? ` · ${entry.stage}阶` : ''}</span>${entry.referenceOnly || entry.playable === false ? '<span>仅供参考 · 不可获取</span>' : ''}</span><span class="gear-catalog-view">原文 / 适配 <span aria-hidden="true">→</span></span></button>`).join('');
  return `<div class="gear-catalog-count" id="catalog-count">筛选 ${num(total)} / 全目录 ${num(catalogTotal)} 条 · 本页 ${first}—${total ? Math.min(page * pageSize, total) : 0} 条 · 每页60条</div>${error ? `<p class="catalog-filter-error" role="alert">${e(error)}（未显示旧结果）</p>` : rows ? `<div class="gear-catalog-list">${rows}</div>` : empty('没有符合条件的装备；可独立调整职业、等级、部位、类型或已载品阶。')}<nav class="gear-catalog-pagination" aria-label="装备目录分页">${btn('首页', 'catalogEquipmentPage', 'data-page="1"', 'ghost small', !error && (!pageCount || page === 1))}${btn('上一页', 'catalogEquipmentPage', `data-page="${Math.max(1, page - 1)}"`, 'ghost small', !pageCount || page === 1)}<span>第 ${pageCount ? page : 0} / ${pageCount} 页</span>${btn('下一页', 'catalogEquipmentPage', `data-page="${page + 1}"`, 'ghost small', !pageCount || page === pageCount)}${btn('末页', 'catalogEquipmentPage', `data-page="${Math.max(1, pageCount)}"`, 'ghost small', !pageCount || page === pageCount)}<div class="gear-catalog-jump"><label for="catalog-page-jump">跳至页</label><input id="catalog-page-jump" class="field" type="number" min="1" ${pageCount ? `max="${pageCount}"` : ''} step="1" inputmode="numeric" value="${page}">${btn('跳转', 'catalogEquipmentJump', '', 'ghost small', !pageCount && !error)}</div></nav>`;
}
function updateEquipmentCatalogResults(focus = '') {
  const container = $('#catalog-results'); if (!container) return;
  const result = queryEquipmentCatalog({ ...catalogFilter, cls: catalogFilter.cls || game.p.cls });
  if (!result.error) catalogFilter.page = result.page;
  for (const id of ['catalog-min-level', 'catalog-max-level']) {
    const field = document.getElementById(id);
    field?.setAttribute('aria-invalid', String(!!result.error && /等级/.test(result.error)));
  }
  container.innerHTML = equipmentCatalogResults(result);
  if (focus === 'jump') $('#catalog-page-jump')?.focus({ preventScroll: true });
  if (focus === 'page') {
    container.querySelector('.gear-catalog-row, .gear-catalog-pagination button:not(:disabled)')?.focus({ preventScroll: true });
    container.scrollIntoView({ block: 'start' });
  }
  applyPending();
}
function catalogEquipmentAcquisition(entry) {
  if (entry.referenceOnly || entry.playable === false) return '<p class="notice">仅供资料参考：不支持的装备类型没有穿戴、购买或制造入口。</p>';
  const current = catalogRecipes(entry, game.p.cls)[0];
  const recipe = current || catalogRecipes(entry)[0];
  if (recipe) return `<section class="catalog-recipe"><h4>实际具名制造配方</h4>${recipeChain(recipe)}<p>配方ID：${e(recipe.id)} · 精确模板：${e(recipe.templateId)}</p><p>人物${recipe.playerLv}级 · ${e(PRODUCTION_SKILLS[recipe.skill]?.name || recipe.skill)}${recipe.skillLevel}级 · ${num(recipe.gold)}金币（本作运行时费用）</p>${materialTable(recipe.materials)}${recipe.from ? `<p>必须消耗具名行囊前件：${predecessorNames(recipe)}。</p>` : '<p>独立根配方，无前件。</p>'}<p class="muted">源材料、未知字段与本作费用分别展示；不按q或星级生成新组合，不代表黄昏 / 轮回所有进阶链已实现。</p>${current ? btn('在生产台核对实际配方', 'productionGo', `data-id="${e(recipe.id)}"`, 'primary') : '<p class="notice">当前职业无对应可执行配方；仅查看记录。</p>'}</section>`;
  const templateId = entry.templateId || entry.id;
  if (equipmentForShop(game.p).some((spec) => (spec.templateId || spec.id) === templateId)) return `<p class="notice">当前装备商在售这件精确具名装备。</p>${btn('前往装备商核对价格', 'catalogGo', 'data-page="town" data-tab="equipment"', 'primary')}`;
  return '<p class="notice">具名资料与纯预览，不代表当前等级可获取；没有匹配的可执行配方或在售记录。</p>';
}
function catalogEquipmentDetail(id) {
  const entry = EQUIPMENT_CATALOG.find((entry) => entry.id === id);
  if (!entry) throw new Error('装备目录条目不存在。');
  const spec = catalogSpec(id);
  const wearing = `<p class="muted">已载职业：${entry.classes == null ? '资料未载' : entry.classes.length ? entry.classes.map((id) => e(CLASSES[id]?.name || id)).join('、') : '不限职业'}；实际穿戴须满足具名模板的等级、属性与部位要求。${entry.slot === 'ring1' ? '主戒 / 副戒穿戴同一种戒指。' : ''}</p>`;
  if (highTemplate(entry)) {
    const recipe = HIGH_RECIPES[entry.templateId];
    showModal('固定神铸 · 目录详情', `<h3>${equipmentName(entry.name, entry.q)}</h3>${wearing}${highDetails(spec)}<p class="notice">固定附加属性，不随机抽取词条；具名特效触发概率另按本作规则。${entry.stars === null ? '此样本星级未核；阶段不代替星级。' : ''}</p><section class="catalog-recipe"><h4>本作神铸配方 · 非官方成本</h4><p>人物${spec.lv}级 · 城镇办理 · ${highCost(recipe)}</p><p>${recipe.from ? `消耗行囊前阶：${equipmentName(HIGH_EQUIPMENT[recipe.from].name)}；保留精炼、孔位及绑定。` : '独立根配方，需空余行囊格。'}</p>${btn('前往城镇神铸', 'highForgeTab', '', 'gold-button')}</section>`);
  } else {
    const template = namedTemplate(entry) || namedTemplate(id);
    showModal('具名装备 · 原文与本作适配', `${specDetails(template ? namedSpec(template.id) : spec)}${wearing}${catalogEquipmentAcquisition(entry)}`);
  }
  $('#modal .modal-body')?.classList.add('catalog-detail');
}
function officialResults() {
  const result = queryOfficialEquipment(officialFilter);
  if (!result.error) officialFilter.page = result.page;
  if (result.error) return `<p class="notice warning" role="alert">${e(result.error)}</p>`;
  return `<p class="source-note">找到 ${num(result.total)} 条 · 等级、品阶升序，未载置后。${officialFilter.includeUnknown ? '未载字段不证明符合筛选。' : '只匹配已载字段。'}</p><div class="catalog-table-scroll"><table class="official-table"><thead><tr><th>名称</th><th>类型 / 部位</th><th>穿戴等级</th><th>品阶</th><th>职业限制</th><th>资料范围</th><th>详情</th></tr></thead><tbody>${result.entries.map((entry) => `<tr><td><strong>${equipmentName(entry.name)}</strong></td><td>${e(entry.type)}<small>${entry.slot ? e(SLOTS[entry.slot]) : '部位未载'}</small></td><td>${entry.lv === null ? '未载' : entry.lv}</td><td>${entry.grade === null ? '未载' : `${entry.grade}品`}</td><td>${entry.classes === null ? '未载' : entry.classes.map((id) => e(CLASSES[id].name)).join('、')}</td><td><span class="source-badge">${highTemplate(entry) ? '高阶已核样本' : '历史具名记录'}</span><small>${highTemplate(entry) ? '属性与需求已核' : entry.materialsText ? '部分材料 / 精炼单位' : '基础属性未载'}</small></td><td>${btn('查看', 'officialDetail', `data-id="${e(entry.id)}"`, 'ghost small')}</td></tr>`).join('') || '<tr><td colspan="7">没有符合条件的资料；可包含未载字段或放宽筛选。</td></tr>'}</tbody></table></div><div class="catalog-pagination">${btn('上一页', 'officialPage', `data-page="${result.page - 1}"`, 'ghost small', result.page <= 1)}<span>第 ${result.page} / ${Math.max(1, result.pageCount)} 页 · 每页40条</span>${btn('下一页', 'officialPage', `data-page="${result.page + 1}"`, 'ghost small', result.page >= result.pageCount)}</div>`;
}
function officialCatalog() {
  const f = officialFilter;
  const options = (entries, selected) => entries.map(([id, name]) => `<option value="${e(id)}" ${selected === id ? 'selected' : ''}>${e(name)}</option>`).join('');
  return `<section class="official-catalog"><header class="catalog-intro"><div><h2>官方装备资料</h2><p class="muted">历史744条不完整来源参考，另含5个跨年代样本；不是主要可玩装备清单，未载保持未知。</p></div><a href="/official-library/index.html" target="_blank" rel="noopener">完整资料册</a></header><div class="official-filters official-primary"><label>名称 / 材料<input id="official-search" type="search" value="${e(f.search)}" placeholder="如：亡骨刀、千机材"></label><label>职业<select id="official-cls">${options([['all', '全部职业'], ...Object.entries(CLASSES).map(([id, c]) => [id, c.name])], f.cls)}</select></label></div><details class="official-filter-more" data-fold="官方装备更多筛选"><summary>更多筛选 · 等级 / 部位 / 类别 / 品阶</summary><div class="official-filters"><label>类别<select id="official-type">${options([['all', '全部类别'], ...Object.entries(OFFICIAL_EQUIPMENT_TYPES)], f.type)}</select></label><label>已核部位<select id="official-slot">${options([['all', '全部 / 未载'], ['weapon', '武器'], ['body', '上衣']], f.slot)}</select></label><label>穿戴等级 ≥<input id="official-minLv" type="number" min="1" max="105" step="1" value="${e(f.minLv)}" placeholder="不限"></label><label>穿戴等级 ≤<input id="official-maxLv" type="number" min="1" max="105" step="1" value="${e(f.maxLv)}" placeholder="不限"></label><label>品阶<input id="official-grade" type="number" min="1" max="19" step="1" value="${e(f.grade)}" placeholder="不限"></label><label><input id="official-includeUnknown" type="checkbox" ${f.includeUnknown ? 'checked' : ''}>筛选时包含未载信息</label></div></details><div id="official-results" aria-live="polite">${officialResults()}</div><details class="official-source-more"><summary>来源边界 · 未载不补写</summary><p class="source-note">${e(OFFICIAL_EQUIPMENT_NOTE)}</p></details></section>`;
}
function updateOfficialResults() { const host = $('#official-results'); if (host) host.innerHTML = officialResults(); }
function officialDetail(id) {
  const entry = OFFICIAL_EQUIPMENT.find((row) => row.id === id);
  if (!entry) throw new Error('资料记录不存在。');
  const playable = Object.values(NAMED_EQUIPMENT).find((template) => template.name === entry.name && template.playable !== false && !template.referenceOnly);
  const html = highTemplate(entry) ? highDetails(highTemplate(entry)) + `<p class="source-note">该样本原属性已有记录；本作神铸成本与战斗效果另作适配。</p>${btn('查看本作获取路径', 'highDetail', `data-id="${entry.templateId}"`, 'primary small')}` : `<div class="raw-stat-grid"><section><span class="detail-label">已记载字段</span><p>类型：${e(entry.type)}</p><p>品阶：${entry.grade === null ? '未载' : `${entry.grade}品`}</p><p>精炼单位：${entry.refineUnit === null ? '未载 / 源占位值' : `${e(entry.refineStatLabel)} ${entry.refineUnit}`}</p><p class="muted">精炼单位不是基础攻击；原字段 level 在此资料中表示品阶，不是穿戴等级。</p></section><section><span class="detail-label">没有记载，不能编造</span><p>穿戴等级、职业与属性需求、基础攻击 / 防御、固定及随机附加属性。</p></section></div><span class="detail-label">原文材料 · 不补写费用和前置</span><p>${entry.materialsText ? itemText(entry.materialsText).replaceAll('\n', '<br>') : '未载'}</p><p class="notice">这是资料记录，不是可领取装备。实际有限具名装备另在「具名装备」查询；此记录未载字段不补写。</p><details><summary>原始字段</summary><pre>${e(JSON.stringify(entry.sourceFields, null, 2))}</pre></details>`;
  showModal('官方装备资料', `<h3>${equipmentName(entry.name)}</h3>${html}${playable ? `<p class="notice">存在同名可玩具名模板；原参考记录不补写其缺项。</p>${btn('查看精确具名模板', 'catalogEquipmentDetail', `data-id="${e(playable.id)}"`, 'primary small')}` : ''}<p class="source-note">历史资料与高阶样本来自不同年代，不表示当前统一版本。</p><p><a href="${e(entry.libraryUrl)}" target="_blank" rel="noopener">本地资料册</a> · <a href="${e(entry.source)}" target="_blank" rel="noopener">已归档官方来源</a></p>`);
}
function equipmentReference() {
  const f = catalogFilter;
  const result = queryEquipmentCatalog({ ...f, cls: f.cls || game.p.cls });
  if (!result.error) f.page = result.page;
  return `<div class="equipment-reference equipment-catalog"><div class="catalog-intro"><div><div class="eyebrow">器物有源 · 有限具名目录</div><h2>具名装备规格</h2><p class="muted" id="catalog-filter-note">职业、等级与部位独立查询；名称色不代表品阶，未载项不补值；穿戴按本作已载需求。</p></div></div>${equipmentCatalogFilters()}<div id="catalog-results" aria-live="polite">${equipmentCatalogResults(result)}</div><details class="rules-boundary catalog-source-boundary"><summary>来源与未知项 · 官方原表 / 本作训练 / 名称色</summary>${sourceValue(NAMED_EQUIPMENT_NOTE)}<p class="source-note">${e(ITEM_COLOR_NOTE)}</p></details><details class="rules-boundary catalog-cultivation"><summary>装备培养参考 · 精炼、镶嵌与生产</summary>${card('培养从实际装备出发', `<div class="cultivation-reference"><article><strong>精炼不是换装备</strong><p>品阶预算 × 精炼增益；下一次增量、辅助成功率、失败等级和真实成本在城镇精炼台逐件展示。乾坤保级，天罡+15百分点仍归零，地煞+5百分点降1级；龙珠仅保+1。</p>${btn('精炼与转移', 'catalogGo', 'data-page="town" data-tab="refine"', 'ghost small')}</article><article><strong>先开孔，再镶嵌</strong><p>新武器最多2孔，护甲4孔，饰品0孔；未开孔不等于空孔。宝石以装备品阶与栏位属性族校验。</p>${btn('持有装备详情', 'bagTab', 'data-id="equipment"', 'ghost small')}</article><article><strong>生产与明确前身</strong><p>新装备只使用已登记的精确具名配方与实际材料。未登记黄昏 / 轮回前件链不算已实现；本作训练单独标明。</p>${btn('生产台', 'productionGo', '', 'ghost small')}</article></div>`)}</details><details class="rules-boundary"><summary>历史公式解释 · 非当前具名装备数值来源</summary>${Object.values(GEAR_RULES.adaptation).map((text) => `<p>${e(text)}</p>`).join('')}<p>${e(PRODUCTION_ADAPTATION.scope)}</p><p>护甲基础 =（初值 + 装备等级×增长）×部位预算×品质倍率×系列倍率；需求 = ceil（每级需求×（等级−1））+初值。武器均值按等级预算，类型决定区间宽度；这些不是端游逐件精确数值。</p>${PRODUCTION_ADAPTATION.sources.map((url, index) => `<p><a href="${e(url)}" target="_blank" rel="noopener">官方机制参考 ${index + 1}</a></p>`).join('')}</details><details class="rules-boundary"><summary>旧存档套装兼容 · 不再作为新装备获取目标</summary><p class="muted">守御 / 猎手 / 法术等旧套装仅保留旧存档效果；新规则装备没有虚构套装。无ruleVersion旧装备仍可旧制升级与洗练。</p>${Object.values(EQUIPMENT_SETS).map((set) => `<h4>${e(set.name)}</h4>${Object.entries(set.bonuses).map(([count, bonus]) => `<p>${count}件</p>${rawStats(bonus)}`).join('')}`).join('')}</details></div>`;
}
function productionWorkbench() {
  const catalog = getProductionCatalog(game.p); const f = productionFilter;
  const series = [...new Set(catalog.recipes.map((r) => r.series))];
  const selectedSeries = series.includes(f.series) ? f.series : series[0];
  const line = catalog.recipes.filter((r) => r.series === selectedSeries);
  const slots = [...new Set(line.map((r) => r.slot))]; const slot = slots.includes(f.slot) ? f.slot : slots[0];
  const recipes = line.filter((r) => r.slot === slot);
  const recipe = recipes.find((r) => r.id === f.recipeId) || [...recipes].sort((a, b) => {
    const aAbove = a.lv > game.p.lv; const bAbove = b.lv > game.p.lv;
    return Number(aAbove) - Number(bAbove) || (aAbove ? a.lv - b.lv : b.lv - a.lv);
  })[0];
  if (!recipe) return empty('当前系列无可浏览配方。');
  const candidate = recipe.candidates.find((c) => c.uid === f.uid) || null;
  const inherit = recipe.inheritance && f.inherit; const reasons = productionReasons(recipe, candidate, inherit);
  const costs = inherit && candidate ? candidate.inherit.costs : recipe.costs;
  return `<section class="production-workbench"><header class="workbench-heading"><div><div class="eyebrow">制造不是领奖 · 材料有来处</div><h2>生产工坊</h2><p>先选配方，再核对材料与前身。只有确认提交成功才得到装备。</p></div>${icon('sword')}</header><div class="production-skills">${Object.entries(catalog.skills).map(([id, skill]) => `<article><strong>${e(skill.name)} <span>${skill.level}级</span></strong><p>成功制造经验 ${num(skill.exp)}${skill.next ? ` / ${skill.next.exp}` : ' · 圆满'}</p>${skill.next ? `<small>下级：人物${skill.next.lv}级 · 经验${skill.next.exp} · ${num(skill.next.gold)}金币，训练后经验归零</small>${btn('确认训练', 'productionTrain', `data-id="${id}"`, 'ghost small', game.busy || !skill.canTrain)}` : ''}</article>`).join('')}</div><div class="workbench-layout"><section><div class="spec-filters"><label>生产系列<select id="production-series">${series.map((id) => `<option value="${id}" ${id === selectedSeries ? 'selected' : ''}>${e(seriesName(id))}</option>`).join('')}</select></label><label>部位<select id="forge-slot">${slots.map((id) => `<option value="${id}" ${id === slot ? 'selected' : ''}>${e(SLOTS[id])}</option>`).join('')}</select></label><label class="wide-filter">精确具名配方<select id="production-recipe">${recipes.map((r) => equipmentName(namedTemplate(r.templateId)?.name || r.name, undefined, ` · Lv.${r.lv} · ${r.skillLevel}级${PRODUCTION_SKILLS[r.skill]?.name || r.skill}${r.available ? ' · 资源满足' : ''}`, { value: r.id, selected: r.id === recipe.id })).join('')}</select></label></div>${recipeChain(recipe)}${specDetails(namedSpec(recipe.templateId))}<p class="notice">${namedTemplate(recipe.templateId)?.status === 'local-tutorial' ? '本作训练配方，非官方。' : '此配方只产出所列精确具名模板；源字段与本作运行时适配分别展示。'}不按q、星级或系列猜测名称色。</p></section><aside class="production-costs"><div class="eyebrow">${itemText(recipe.name)}</div><h3>实际支付清单</h3><p class="production-gold">${num(costs.gold)}<small>金币 · 持有${num(game.p.gold)}</small></p>${materialTable(costs.materials)}${recipe.from ? `<label for="production-predecessor">必须消耗行囊中的前件</label><select id="production-predecessor"><option value="">请选择具体装备</option>${recipe.candidates.map((c) => equipmentName(c.name, undefined, ` +${c.refine} · ${c.bound ? '绑定' : '未绑定'} · UID ${c.uid}`, { value: c.uid, selected: candidate?.uid === c.uid })).join('')}</select><p class="muted">穿戴中的装备先卸下。前件仅匹配精确具名ID：${predecessorNames(recipe)}；不把未登记的黄昏 / 轮回组合当作进阶链。</p><label><input id="production-inherit" type="checkbox" ${inherit ? 'checked' : ''}>付费继承精炼、孔位与宝石</label><p class="notice warning">${inherit ? `额外乾坤石：${candidate ? num(candidate.inherit.qiankun) : '先选前件'}。` : '不继承：前件精炼与宝石永久丢失，不返还宝石，新孔位重新生成。'}前件绑定始终保留；消耗后不可撤销。</p>` : '<p class="muted">独立根配方；成功后占用1格行囊。无前件继承选项。</p>'}<p class="production-status" role="status">${reasons.length ? e(reasons.join(' · ')) : '可得到 · 还未获得，需确认支付'}</p>${btn('核对成本并生产', 'produceConfirm', `data-id="${recipe.id}" data-uid="${candidate?.uid || ''}" data-inherit="${!!inherit}"`, 'primary wide', !!reasons.length)}<p class="muted">仅浏览配方不会扣费。失败时不会扣料或显示获得。</p></aside></div><details class="machine-workbench"><summary>千机材加工 · 当前持有${num(game.p.items.ttMachine)}</summary><p>加工得到1份千机材，消耗${num(catalog.machine.gold)}金币，不增加装备制造经验。</p>${materialTable(catalog.machine.materials)}${btn('核对并加工千机材', 'machineConfirm', '', 'primary', game.busy || !catalog.machine.available)}</details><details class="rules-boundary"><summary>生产机制来源与有限适配</summary>${Object.entries(catalog.adaptation).filter(([key]) => key !== 'sources').map(([, text]) => `<p>${e(text)}</p>`).join('')}${catalog.adaptation.sources.map((url, index) => `<p><a href="${e(url)}" target="_blank" rel="noopener">官方机制参考 ${index + 1}</a></p>`).join('')}</details></section>`;
}
function produceConfirm(recipeId, uid = '', inherit = false) {
  const recipe = getProductionCatalog(game.p).recipes.find((r) => r.id === recipeId);
  if (!recipe) throw new Error('配方不存在。');
  const candidate = recipe.candidates.find((c) => c.uid === uid) || null;
  const reasons = productionReasons(recipe, candidate, inherit);
  if (reasons.length) throw new Error(reasons.join(' · '));
  const costs = inherit && candidate ? candidate.inherit.costs : recipe.costs;
  showModal('确认生产 · 实际扣除全部成本', `<h3>${itemText(recipe.name)}</h3>${recipeChain(recipe)}<p class="production-gold">${num(costs.gold)}<small>金币</small></p>${materialTable(costs.materials, false)}${candidate ? `<p class="notice warning">消耗：${equipmentName(candidate.name, 3)} +${candidate.refine} · UID ${e(candidate.uid)}<br>${inherit ? `付费继承培养，所需乾坤石${num(candidate.inherit.qiankun)}已列在成本中；源装备被替换。` : '未选继承：精炼和宝石永久丢失，新孔位重新生成，宝石不返还。'}绑定状态保留；此操作不可撤销。</p>` : '<p class="notice">成功后生成真实装备收入行囊；此刻尚未获得。</p>'}`, '确认扣料生产', async () => {
    const response = await command('/v1/equipment/produce', { recipeId, ...(recipe.from ? { uid, inherit } : {}), confirm: true });
    const actual = response.result?.equipment || response.equipment;
    if (actual?.uid) equipmentModal(actual.uid);
    else toast(response.result?.message || '生产请求已提交；请查看行囊实际结果。');
  });
}
function openProduction(recipeId = '') {
  stopAuto(); closeModal();
  if (recipeId) {
    const recipe = getProductionCatalog(game.p).recipes.find((r) => r.id === recipeId);
    if (recipe) productionFilter = { series: recipe.series, slot: recipe.slot, recipeId, uid: '', inherit: false };
  }
  page = 'town'; townTab = 'forge'; render();
}
function bagPage() {
  const p = game.p;
  const tabs = `<div class="tabs bag-tabs" aria-label="装备与道具浏览">${[['equipment', '我的装备'], ['items', '持有道具'], ['catalog', '道具图鉴'], ['arsenal', '具名装备'], ['specs', '规格与来源']].map(([id, title]) => `<button class="tab ${bagTab === id ? 'active' : ''}" data-action="bagTab" data-id="${id}">${title}</button>`).join('')}</div>`;
  let content;
  if (bagTab === 'equipment') content = p.bag.length ? `<div class="item-grid">${p.bag.map((it) => `<article class="item-card"><div class="item-icon ${highTemplate(it) ? 'high-bag-art' : ''}">${highTemplate(it) ? highEquipmentArt(it.templateId) : icon(it.slot === 'weapon' ? 'sword' : 'shield')}</div><h3 class="item-name">${equipmentName(it.name, undefined, it.refine ? ` +${it.refine}` : '')}</h3><div class="item-meta">${e(gearRank(it))} · ${e(equipmentLabel(it))} · ${e(SLOTS[it.slot])} · Lv.${it.lv}</div>${highTemplate(it) ? `<p class="muted">需求：${highRequirements(highTemplate(it))}<br>${highTemplate(it).classes ? highTemplate(it).classes.map((id) => e(CLASSES[id]?.name || id)).join('、') : '不限职业'} · 固定效果：${(it.effects || []).map((effect) => e(effect.name)).join('、') || '固定属性'}<br>不可随机洗练 · 详情可查原始范围与来源</p>` : ''}<div class="item-stats">${itemStats(it)}</div><p class="item-meta">${equipmentMeta(it)}</p><div class="item-actions">${btn('详情 / 装备处理', 'equipmentDetail', `data-id="${it.uid}"`, 'ghost small')}${btn(highWearReason(it) || '装备', 'equip', `data-id="${e(it.uid)}"`, 'small', !!highWearReason(it) || game.busy)}${it.slot === 'ring1' ? btn('副戒', 'equip', `data-id="${it.uid}" data-slot="ring2"`, 'ghost small', !!highWearReason(it, 'ring2') || game.busy) : ''}${btn(it.bound ? '已绑定 · 不可售' : `售 ${num(itemSell(it))}`, 'sell', `data-id="${it.uid}"`, 'ghost small', ZONES[p.location].type !== 'city' || game.busy || it.bound || it.locked)}</div></article>`).join('')}</div>` : empty('行囊中尚无装备。挑战敌人、完成任务或到城镇购买。');
  else if (bagTab === 'items') {
    const owned = Object.entries(p.items).filter(([, qty]) => qty > 0).map(([id]) => id);
    owned.sort((a, b) => Number(!!ACTIVITY_POOLS[b]) - Number(!!ACTIVITY_POOLS[a]));
    content = `<div class="catalog-intro" id="owned-items"><div><h2>包裹 · 持有道具</h2><p class="muted">箱子与粽子在这里开启，消耗持有物品后随机获得奖励。点物品可查完整奖池。</p></div>${btn('浏览全部道具', 'bagTab', 'data-id="catalog"', 'ghost small')}</div><div class="codex-grid">${owned.map((id) => itemPreview(id, true)).join('') || empty('暂未持有道具。打开道具图鉴查看如何获取。')}</div>${economyNotice('bag')}${economyViews.bag ? bagOpeningRewards(economyViews.bag) : ''}`;
  }
  else if (bagTab === 'catalog') content = itemCatalog();
  else if (bagTab === 'arsenal') content = equipmentReference() + `<details class="rules-boundary"><summary>历史744条不完整资料参考 · 非可玩交付清单</summary>${officialCatalog()}</details>`;
  else if (bagTab === 'specs') content = equipmentReference();
  if (bagTab === 'equipment') content = card(`已穿戴 · ${Object.keys(p.equipment).length} / ${Object.keys(SLOTS).length}栏`, `<div class="equipment-stage"><figure class="paperdoll-art"><img src="/art/cultivator-portrait-v1.webp" alt="原创修真者意象"><figcaption>人物意象 · 非实时外观</figcaption></figure><div class="equipped-grid bag-equipped-grid">${Object.keys(SLOTS).map(equipmentSlot).join('')}</div></div>`, btn('原文 / 未载 / 生产 / 培养', 'bagTab', 'data-id="specs"', 'ghost small')) + card(`待穿戴 · 装备行囊 ${p.bag.length} / ${BAG_LIMIT}`, content + `<div class="form-row">${btn('装备商', 'catalogGo', 'data-page="town" data-tab="equipment"', 'ghost small')}${btn('生产工坊', 'catalogGo', 'data-page="town" data-tab="forge"', 'ghost small')}${btn('副本', 'catalogGo', 'data-page="town" data-tab="dungeon"', 'ghost small')}</div>`);
  return pageTitle('装备与行囊', `已穿戴 ${Object.keys(p.equipment).length}件 · 行囊 ${p.bag.length}/${BAG_LIMIT} · ${Object.keys(ITEMS).length}种道具可查`, bagTab === 'equipment' ? btn('出售普通装备', 'sellCommonConfirm', '', 'ghost', game.busy || ZONES[p.location].type !== 'city') : '') + tabs + content;
}
function skillDetail(id) {
  const sk = SKILLS[game.p.cls].find((skill) => skill.id === id);
  if (!sk) throw new Error('本职业没有该技能。');
  const source = sk.source;
  const costs = sk.learning.map((_, index) => skillResources(sk, index + 1));
  const resourceRows = costs.map((cost, index) => `<tr><td>${index + 1}</td><td>${cost.mp} <small>${cost.basis.mp === 'local' ? '本作' : '源记录'}</small></td><td>${cost.chi} <small>${cost.basis.chi === 'local' ? '本作' : '源记录'}</small></td></tr>`).join('');
  const weaponNote = `<section class="notice"><strong>原武器限制</strong><p>${e(source.wuqi)}</p><p>${e(sk.adaptation.weapons)}</p></section><div class="catalog-table-scroll"><table class="official-table"><thead><tr><th>技能阶数</th><th>真气消耗</th><th>元气消耗</th></tr></thead><tbody>${resourceRows}</tbody></table></div>`;
  showModal('技能原记录与单机适配', `<h3>${e(sk.name)}</h3><p>原技能ID ${source.originalId} · ${e(source.originalKind)} · 普通分支 · 修真 ${e(source.cultivation)}</p><section class="notice"><strong>当前可玩效果</strong><p>${e(sk.desc)}</p><p>${e(sk.adaptation.mapping)}</p></section><p class="source-note">${e(sk.adaptation.combat)}</p>${weaponNote}<div class="catalog-table-scroll"><table class="official-table"><thead><tr><th>技能等级</th><th>原学习等级</th><th>原元神</th><th>原金币</th><th>本作要求</th></tr></thead><tbody>${sk.learning.map((row, index) => `<tr><td>${index + 1}</td><td>${source.learning.level[index]}</td><td>${num(source.learning.sp[index])}</td><td>${num(source.learning.gold[index])}</td><td>Lv.${row.level} · 元神${num(row.sp)} · 金币${num(row.gold)}${row.basis.level === 'local-tutorial-unlock' ? '<small>教学免费解锁，非源要求</small>' : row.basis.level === 'local-level-floor' ? '<small>源等级0规范为1</small>' : ''}</td></tr>`).join('')}</tbody></table></div><p class="muted">${e(sk.adaptation.learning)}</p><p><a href="/official-library/index.html#page=${e(source.skillSourceId)}" target="_blank" rel="noopener">本地技能资料</a> · <a href="${e(source.url)}" target="_blank" rel="noopener">原模拟器存档来源</a></p>`);
}
function skillsPage() {
  const p = game.p;
  return pageTitle('职业技能', `${CLASSES[p.cls].name} · 金币与元神精进技艺 · 技能效果为回合制改编`) + `<div class="item-grid">${SKILLS[p.cls].map((sk) => {
    const lv = p.skills[sk.id] || 0; const req = skillReq(sk, lv + 1); const cost = skillResources(sk, Math.max(1, lv)); const can = lv < sk.maxLv && p.lv >= req.level && p.cult >= (sk.cult || 0) && p.sp >= req.sp && p.gold >= req.gold && !game.busy && ZONES[p.location].type === 'city';
    return `<article class="item-card"><div class="item-icon">${icon(sk.kind === 'heal' ? 'leaf' : sk.kind === 'buff' ? 'shield' : 'skill')}</div><h3>${sk.name} <span class="tag ${lv ? 'green' : ''}">${lv ? `Lv.${lv}` : '未学习'}</span></h3><p class="muted">${sk.desc}</p><div class="item-meta">${sk.kind === 'passive' ? '被动生效' : `真气 ${cost.mp} · 元气 ${cost.chi} · 冷却 ${sk.cd}回合${lv ? '' : '（1阶）'}`}</div>${sk.elem ? `<span class="tag">${ELEMENTS[sk.elem]}系</span>` : ''}${lv < sk.maxLv ? `<p class="muted">下一级：人物${req.level}级${sk.cult ? ` · ${cultName(sk.cult, p.path)}` : ''}<br>元神 ${num(req.sp)} · 金币 ${num(req.gold)}</p>${btn(lv ? '提升技能' : '学习技能', 'learn', `data-id="${sk.id}"`, 'primary small', !can)}` : '<span class="tag gold">圆满</span>'}<div class="form-row">${btn('原记录 / 学习表 / 适配差异', 'skillDetail', `data-id="${sk.id}"`, 'ghost small skill-source-link')}</div></article>`;
  }).join('')}</div><p class="notice">需在城镇学习。普通攻击与技能积攒元气，每100点为一格，最多三格。强力技能消耗元气；战斗中点击自动战斗可智能选择技能和药品。</p>`;
}
function cultPage() {
  const p = game.p; const next = CULTIVATION[p.cult + 1]; const trial = CULT_TRIALS[p.cult + 1];
  const ready = next && p.lv >= next.lv && p.sp >= next.sp && p.trialReady && !game.busy && ZONES[p.location].type === 'city';
  return pageTitle('修真之路', '始于筑基，终于道心。境界门槛沿用经典体系，试炼为文字改编。') + `<div class="grid-two">${card('当前境界', `<div class="cult-orb">${cultName(p.cult, p.path)}</div><p class="quest-story">${next ? `下一境界：${Array.isArray(next.name) ? next.name.join(' / ') : next.name}` : '你已走至仙魔之巅。'}</p>${next ? `<div class="notice"><p>需要人物${next.lv}级 · 元神 ${num(next.sp)}</p><p>试炼：${trial.title} · ${p.trialReady ? '已通过' : '尚未完成'}</p></div><p class="muted">${trial.story}</p><div class="form-row">${btn('进入试炼', 'trial', '', 'ghost', game.busy || p.trialReady || p.lv < next.lv || ZONES[p.location].type !== 'city')}${btn('突破境界', 'breakthrough', '', 'primary', !ready)}</div><p class="muted">元神够不够，不影响参加试炼；通过后须在城镇突破。仙魔选择不可逆。</p>` : '<span class="tag gold">境界圆满</span>'}`)}${card('道途', `<div class="cult-track">${CULTIVATION.map((c, i) => `<div class="cult-step ${p.cult === i ? 'current' : p.cult > i ? 'done' : ''}"><span>${i < p.cult ? '✓' : i + 1}</span><div><strong>${Array.isArray(c.name) ? c.name.join(' / ') : c.name}</strong><small>Lv.${c.lv} ${i === p.cult ? '· 当前境界' : ''}</small></div></div>`).join('')}</div>`)}</div>`;
}
function refineWorkbench() {
  const p = game.p;
  return `<section class="refine-workbench"><div class="notice warning">精炼成本和概率为本作适配。天罡+15个百分点、失败归零；地煞+5个百分点、失败降1级；乾坤保持原等级，不翻倍概率；一星龙珠只保下一次+1。辅助每次只能选一种，消耗1枚，失败也扣费。</div><label for="refine-aid">本次辅助材料<select id="refine-aid">${[['', '无辅助'], ['tiangang', '天罡石'], ['disha', '地煞石'], ['qiankun', '乾坤石'], ['dragonOrb1', '一星龙珠']].map(([id, name]) => equipmentName(id ? materialName(id) : name, undefined, `${id === 'dragonOrb1' ? '（仅当前+0）' : ''}${id ? ` · 持有${num(p.items[id])}` : ''}`, { value: id, selected: id === refineAid })).join('')}</select></label><div class="item-grid">${Object.entries(p.equipment).map(([slot, it]) => {
    let plan; let reason = '';
    try { plan = refinePlan(it, refineAid); } catch (err) { reason = err.message; }
    if (game.busy) reason = '战斗中不可精炼';
    if (plan && (p.gold < plan.cost || (p.items.huanxian || 0) < plan.stones || (refineAid && !(p.items[refineAid] > 0)))) reason = '金币 / 精炼材料不足';
    return `<article class="item-card"><h3>${equipmentName(it.name, it.q)} +${it.refine}</h3><p class="muted">${e(SLOTS[slot])} · ${e(gearRank(it))}</p>${plan ? `<p class="refine-rate">${percent(plan.rate)} <small>本次成功率</small></p><p>下一次 +${it.refine + 1} 增量</p>${rawStats(refineDelta(it))}<p class="muted">${equipmentName(materialName('huanxian'))}×${plan.stones}${refineAid ? ` + ${equipmentName(materialName(refineAid))}×1` : ''} · ${num(plan.cost)}金币<br>失败后 +${plan.failLevel}（现为 +${it.refine}）</p>` : ''}${btn(reason || '核对并精炼', 'refineConfirm', `data-id="${slot}"`, 'primary small', !!reason)}</article>`;
  }).join('') || empty('先穿戴装备，才能在此精炼。行囊装备可用于精炼转移。')}</div>${card('扭转乾坤 · 精炼转移', `<p>两件真实自有装备：源等级必须高于目标。转后源归零、目标被覆盖，不叠加；绑定源只能转到绑定目标。</p>${btn('选择源与目标装备', 'transferOpen', '', 'primary', game.busy || [...Object.values(p.equipment), ...p.bag].filter((it) => it.refine > 0).length === 0)}<details><summary>官方乾坤石数量表 +1—+12</summary><div class="transfer-cost-table">${QIANKUN_TRANSFER_COSTS.slice(1).map((cost, index) => `<span>+${index + 1}<strong>${num(cost)}枚</strong></span>`).join('')}</div><p class="muted">仅转移石数参照官方表；新普通装备精炼加值为本作品阶预算。</p><a href="https://w2i.wanmei.com/xtjs/jlxt/20091020/30166.shtml" target="_blank" rel="noopener">官方精炼系统资料</a></details>`)}</section>`;
}
function transferModal(fromUid = '', toUid = '') {
  const owned = [...Object.values(game.p.equipment), ...game.p.bag];
  const source = owned.find((it) => it.uid === fromUid) || owned.find((it) => it.refine > 0);
  const options = owned.filter((it) => source && it.uid !== source.uid && it.refine < source.refine && (!source.bound || it.bound));
  const target = options.find((it) => it.uid === toUid);
  const cost = source ? QIANKUN_TRANSFER_COSTS[source.refine] : 0;
  const reason = game.busy ? '战斗中不可转移' : ZONES[game.p.location].type !== 'city' ? '需在城镇处理' : !target ? '请选择满足条件的目标' : (game.p.items.qiankun || 0) < cost ? '乾坤石不足' : '';
  showModal('精炼转移 · 先选两件真实装备', `<label>精炼源<select id="transfer-from">${owned.filter((it) => it.refine > 0).map((it) => equipmentName(it.name, undefined, ` +${it.refine} · ${it.bound ? '绑定' : '未绑定'} · ${it.uid}`, { value: it.uid, selected: source?.uid === it.uid })).join('')}</select></label><label>覆盖目标<select id="transfer-to"><option value="">请选择目标装备</option>${options.map((it) => equipmentName(it.name, undefined, ` +${it.refine} · ${it.bound ? '绑定' : '未绑定'} · ${it.uid}`, { value: it.uid, selected: target?.uid === it.uid })).join('')}</select></label><p class="notice warning">${equipmentName(materialName('qiankun'))}×${num(cost)}，持有${num(game.p.items.qiankun)}。源 +${source?.refine || 0} → +0；目标${target ? ` +${target.refine} → +${source.refine}` : '被覆盖为源精炼等级'}。不叠加，不转移宝石，不改变绑定。目标原精炼不返还。</p>${reason ? `<p role="status">${e(reason)}</p>` : ''}${btn('核对并确认转移', 'transferConfirm', `data-from="${source?.uid || ''}" data-to="${target?.uid || ''}"`, 'primary wide', !!reason)}`);
}
function dungeonReason(d) {
  const p = game.p;
  if (game.busy) return '战斗中不可进入';
  if (p.encounter) return '先处理眼前奇遇';
  if (p.lv < d.lv - 3) return `需人物${d.lv - 3}级`;
  if ((p.daily.dungeons[d.id] || 0) >= 3) return '今日次数已满';
  return '';
}
function dungeonCard(d, compact = false) {
  const p = game.p; const here = d.entrance.includes(p.location); const reason = dungeonReason(d);
  return `<article class="${compact ? 'atlas-dungeon' : 'item-card'}"><span class="tag gold">本作 Lv.${d.lv}${d.originalLevel ? ` · 原版${d.originalLevel}` : ''}</span><h3>${e(d.id === 'd15' ? d.variants?.[p.race] || d.name : d.name)}</h3><p class="muted">${e(d.desc)}</p><p class="dungeon-reward">${d.rewardKind === 'materials' ? `生产材料：${(d.rewardMaterials || []).map((id) => equipmentName(materialName(id))).join('、')}。全程不掉成品装备。` : d.family === 'frost' ? '覆霜成品装备历练，非轮回材料副本。' : '成品装备与精炼资源；本作奖励适配。'}</p><p class="muted">${(d.waves || 3) + 1}波 · 今日${p.daily.dungeons[d.id] || 0}/3<br>进入消耗1次每日次数 · 金币入场费0（当前本作规则）</p><p class="muted">${here ? '此处是登记的入口 / 接引节点（可能为H5服务适配）' : `入口 / 接引：${d.entrance.map((id) => ZONES[id].name).join('、')}`}</p><div class="form-row">${here ? btn(reason || '从此节点进入', 'dungeon', `data-id="${d.id}"`, 'primary small', !!reason) : btn('查看入口路线', 'dungeonRoute', `data-id="${d.id}"`, 'primary small', game.busy)}${btn('来源与门槛', 'dungeonDetail', `data-id="${d.id}"`, 'ghost small')}</div></article>`;
}
function dungeonDetail(id) {
  const d = DUNGEONS.find((entry) => entry.id === id); if (!d) throw new Error('副本不存在。');
  showModal('副本历练 · 入口与奖励', `${dungeonCard(d, true)}<details open><summary>原版资料与本作边界</summary><p>${e(d.originalEntrance)}</p><p>${e(d.adaptation)}</p><p class="muted">H5服务接引不是原版物理入口；旅行门槛独立于副本挑战等级。进入副本以实际后端校验为准，不虚构远程入口。</p></details>`);
}
function dungeonRoute(id) {
  const d = DUNGEONS.find((entry) => entry.id === id); if (!d) throw new Error('副本不存在。');
  const reachable = d.entrance.map((zone) => ({ zone, path: routeTo(game.p.location, zone, game.p) })).filter((entry) => entry.path).sort((a, b) => a.path.length - b.path.length);
  mapModal(); atlasSelection = reachable[0]?.zone || d.entrance[0]; atlasLayer = ATLAS_NODES[atlasSelection]?.layer || 'mainland'; refreshAtlas();
}
function dungeonList() {
  return `<p class="notice">副本每日各3次，进入即消耗次数；波次间可补给。黄昏、神月、轮回只供生产材料，不掉系列成品。先查看登记入口 / 接引路线再进入；城镇使者仅提供目录，不冒称端游原入口。</p><div class="item-grid">${DUNGEONS.map((d) => dungeonCard(d)).join('')}</div>`;
}
function townPage() {
  const p = game.p;
  if (ZONES[p.location].type !== 'city') return pageTitle('城镇与副本', '野外可查看配方与副本，生产和精炼须回城。') + `<div class="tabs">${[['forge', '生产配方'], ['dungeon', '副本入口']].map(([id, title]) => btn(title, 'townTab', `data-id="${id}"`, townTab === id ? 'primary small' : 'ghost small')).join('')}</div>` + card('荒野不设商铺', `<p class="muted">当前在${ZONES[p.location].name}。使用回城符返回${ZONES[p.lastCity].name}，或沿路线回城；以下生产预览不会绕过城镇门槛。</p>${btn('使用回城符', 'useItem', 'data-id="town"', 'primary', game.busy || !p.items.town)}${btn('查看道路', 'map', '', 'ghost')}`) + (townTab === 'forge' ? productionWorkbench() : dungeonList());
  const tabs = `<div class="tabs">${[['shop', '补给'], ['equipment', '装备商'], ['refine', '精炼'], ['forge', '生产'], ['high', '神铸'], ['dungeon', '副本'], ['activities', '日常']].map(([id, t]) => `<button class="tab ${townTab === id ? 'active' : ''}" data-action="townTab" data-id="${id}">${t}</button>`).join('')}</div>`;
  let html = '';
  if (townTab === 'shop') html = `<div class="item-grid">${[...shopList('potion', p.lv), ...shopList('other', p.lv)].map((id) => `<article class="item-card"><div class="item-icon">${icon('bottle')}</div><h3>${equipmentName(ITEMS[id].name)}</h3><p class="muted">${ITEMS[id].desc}</p><p>金币 ${num(ITEMS[id].price)} · 持有 ${num(p.items[id])}</p>${btn('详情 / 用途与获取', 'itemDetail', `data-id="${e(id)}"`, 'ghost small')}<div class="form-row">${btn('买1个', 'buy', `data-id="${id}" data-qty="1"`, 'primary small', game.busy || p.gold < ITEMS[id].price)}${btn('买10个', 'buy', `data-id="${id}" data-qty="10"`, 'ghost small', game.busy || p.gold < ITEMS[id].price * 10)}</div></article>`).join('')}</div>`;
  if (townTab === 'high') html = highForgePage();
  if (townTab === 'equipment') html = `<p class="notice">仅出售当前人物可查询到的精确具名模板。购买提交templateId，不再按部位生成随机装备；本作训练不是官方装备，资料缺失与临时数值单独标明。</p><div class="item-grid">${equipmentForShop(p).map((spec) => {
    const id = spec.templateId || spec.id; const cost = spec.price;
    const available = Number.isFinite(cost) && spec.playable !== false && !spec.referenceOnly;
    return `<article class="item-card named-shop-card" data-template-id="${e(id)}"><div class="item-icon">${icon(spec.slot === 'weapon' ? 'sword' : 'shield')}</div><h3>${equipmentName(spec.name)}</h3><p class="item-meta">Lv.${spec.lv} · ${e(SLOTS[spec.slot])} · ${gradeLabel(spec.grade)} · ${starLabel(spec.stars)}</p><p class="source-badge">${e(sourceStatus(spec))}</p>${spec.status === 'partial' && spec.series === 'ordinary' ? '<p class="notice warning">资料未载攻击，本作临时数值</p>' : ''}${spec.status === 'local-tutorial' ? '<p class="muted">本作训练 · 非官方</p>' : ''}<p class="muted">需求：${highRequirements(spec)}</p><p class="muted">模板：${e(id)}</p>${btn('原文 / 本作适配', 'catalogEquipmentDetail', `data-id="${e(id)}"`, 'ghost small')}${btn(available ? `购买 · ${num(cost)}金币（本作价格）` : '仅供参考 · 未开放购买', 'buyEquip', `data-id="${e(id)}"`, 'primary small', !available || game.busy || p.gold < cost || p.bag.length >= BAG_LIMIT)}</article>`;
  }).join('') || empty('当前人物没有在售的具名装备；不补造部位组合。')}</div>`;
  if (townTab === 'refine') html = refineWorkbench();
  if (townTab === 'forge') html = productionWorkbench();
  if (townTab === 'dungeon') html = dungeonList();
  if (townTab === 'activities') html = `<div class="grid-three">${card('今日补给', `<p class="muted">每日金币${300 + p.lv * 50}、${equipmentName(materialName('huanxian'))}×3、${equipmentName(materialName('julin'))}×1。</p>${btn(p.daily.signed ? '今日已领' : '领取补给', 'sign', '', 'primary', p.daily.signed || game.busy)}`)}${card('卡片BOSS', `<p class="muted">持有凭证${p.items.card || 0}张。每张可换${100 + p.lv * 30}元神。</p>${btn('全部兑换', 'cards', '', 'ghost', !p.items.card || game.busy)}`)}${card('比武大会', `<p class="muted">与NPC试剑客切磋，赢取元神与金币；不是玩家PVP。</p><p>20级开启 · 今日 ${p.daily.arena || 0}/3</p>${btn('开始比武', 'arena', '', 'primary', p.lv < 20 || game.busy || (p.daily.arena || 0) >= 3)}`)}</div>`;
  return pageTitle('城镇与副本', `${ZONES[p.location].name} · 歇脚之后，再赴山海`, btn(`客栈 · ${5 + p.lv * 2}金币`, 'rest', '', 'ghost', game.busy)) + tabs + html;
}
function rewardText(rewards = []) {
  return rewards.map((reward) => {
    const template = highTemplate(reward) || namedTemplate(reward);
    const name = reward.type === 'equip' ? reward.equipment?.name || template?.name || reward.name || `${SLOTS[reward.slot] || '装备'}（精确名称未载）` : reward.name || (reward.type === 'item' ? ITEMS[reward.itemId]?.name || reward.itemId : reward.type === 'cosmetic' ? COSMETICS.find((entry) => entry.id === reward.cosmeticId)?.name || reward.cosmeticId : currencyName(reward.type));
    const label = ['equip', 'item', 'cosmetic'].includes(reward.type) ? equipmentName(name) : e(name);
    return `${label} ×${num(reward.quantity ?? 1)}${reward.duplicateOf ? '（重复外观补偿）' : ''}`;
  }).join('、');
}
function appearancePanel() {
  const p = game.p;
  if (!p.cosmetics || !p.charms) return '<p class="notice warning">外观/护符字段未初始化，未自动创建虚假储量；请检查后端迁移。</p>';
  return `<p class="muted">${e(ECONOMY_RULES.appearance)}</p><div class="appearance-list">${[['outfit', '时装'], ['mount', '坐骑'], ['flyer', '飞行器']].map(([slot, name]) => `<div class="travel-card"><div><strong>${name}：${equipmentName(COSMETICS.find((entry) => entry.id === p.cosmetics[slot])?.name || '未佩戴')}</strong><small>${slot === 'flyer' ? `飞行资格：${p.flight ? '已开启' : '未开启'}` : '文字名片外观，不增加战斗属性'}</small></div><div class="economy-actions">${COSMETICS.filter((entry) => entry.slot === slot && p.cosmetics.owned.includes(entry.id)).map((entry) => btn(p.cosmetics[slot] === entry.id ? `${equipmentName(entry.name)} · 已装备` : `装备${equipmentName(entry.name)}`, 'cosmeticEquip', `data-id="${entry.id}" data-slot="${slot}"`, 'ghost small', game.busy || p.lv < entry.minLevel || p.cosmetics[slot] === entry.id)).join('') || '<span class="muted">尚无外观，可在商城购买或活动获得</span>'}${p.cosmetics[slot] ? btn('卸下外观', 'cosmeticUnequip', `data-slot="${slot}"`, 'ghost small', game.busy) : ''}</div></div>`).join('')}</div><p class="notice">生命护符储量 ${num(p.charms.hp)} · 真气护符储量 ${num(p.charms.mp)}<br>${e(ECONOMY_RULES.charm)}</p><div class="economy-actions">${Object.entries(CHARM_CONFIG).map(([id, config]) => [1, 10].map((count) => btn(`装载${equipmentName(ITEMS[id].name)} ×${count}（+${num(config.charge * count)}）`, 'charmEquip', `data-id="${id}" data-count="${count}"`, 'ghost small', game.busy || (p.items[id] || 0) < count)).join('')).join('')}</div><p class="muted">未装载：${equipmentName(materialName('charmHp'))} ×${num(p.items.charmHp)} · ${equipmentName(materialName('charmMp'))} ×${num(p.items.charmMp)}</p>`;
}
const economyFold = (title, content, cls = '') => `<details class="economy-fold ${cls}" data-fold="${e(title.split(' · ')[0])}"><summary>${title}</summary><div class="fold-body">${content}</div></details>`;
function economyNotice(section) {
  return readErrors[section] ? `<div class="notice warning" role="alert">读取失败：${e(readErrors[section])}。已提交的存档未被修改；没有自动成功或虚构商品。${btn('重试读取', 'retryEconomy', `data-id="${section}"`, 'ghost small')}</div>` : !economyViews[section] ? `<p class="notice">等待读取真实商品与活动配置。${btn('读取数据', 'retryEconomy', `data-id="${section}"`, 'ghost small')}</p>` : '';
}
function economyBoundary(view) {
  return economyFold('非官方单机改编 · 仅虚拟币，无充值、提现或交易', `<p>${e(view.rules?.disclaimer || ECONOMY_RULES.disclaimer)}</p><p>${e(view.rules?.catalog || ECONOMY_RULES.catalog)}</p><p>${e(view.rules?.festival || ECONOMY_RULES.festival)} 开启入口：包裹 → 持有道具。</p><p>${e(view.rules?.day || ECONOMY_RULES.day)}</p><p>${e(view.rules?.history || ECONOMY_RULES.history)}</p>`, 'economy-boundary');
}
let artIndex = 0;
function highEquipmentArt(templateId) {
  const uid = `armory-${++artIndex}`;
  const gold = `url(#${uid}-gold)`; const steel = `url(#${uid}-steel)`; const jade = `url(#${uid}-jade)`;
  const ax = `<g><path d="M112 49v221" stroke="#191414" stroke-width="11"/><path d="M112 49v221" stroke="${gold}" stroke-width="6"/><path d="M110 130v100" stroke="#602e2a" stroke-width="6"/><path d="m109 135 6 5-6 5 6 5-6 5 6 5-6 5 6 5-6 5 6 5-6 5 6 5-6 5 6 5-6 5 6 5-6 5 6 5-6 5 6 5" stroke="#b18a52" stroke-width="1.2"/><path d="m108 260 4 22 4-22Z" fill="${gold}" stroke="#ecd5a3"/><path d="M102 80C85 64 70 57 68 30c-25 18-25 60-12 83 17-18 30-23 46-19Z" fill="${steel}" stroke="${gold}" stroke-width="2"/><path d="M122 80c17-16 32-23 34-50 25 18 25 60 12 83-17-18-30-23-46-19Z" fill="${steel}" stroke="${gold}" stroke-width="2"/><path d="M63 42c-13 23-9 47-5 62M161 42c13 23 9 47 5 62" stroke="#e7e6d8" stroke-width="2"/><path d="m101 77-9-10-14 4-8-10-10 19 18 5 5 10m40-18 9-10 14 4 8-10 10 19-18 5-5 10" fill="none" stroke="${gold}" stroke-width="1.4"/><path d="m92 76-13 1 3 11m50-12 13 1-3 11M106 61l6-25 6 25v46h-12Z" fill="${gold}" stroke="#e4cc94"/><path d="m112 73 8 13-8 15-8-15Z" fill="${jade}" stroke="#efd79c"/><path d="m112 81 3 5-3 5-3-5Z" fill="#d0e9c4"/><path d="M107 114h10M107 122h10M107 248h10M107 254h10" stroke="#e1c58c" stroke-width="3"/><path d="M112 111c-21 6-11 20 0 5 12 14 21 0 0-5Zm0 8c-10 11-6 31-17 38m18-38c8 10 12 25 9 34" fill="none" stroke="#ac3835" stroke-width="2.4"/><path d="m94 155-3 12m31-15 2 12" stroke="#cc5950" stroke-width="3"/></g>`;
  let drawing;
  if (String(templateId).startsWith('axe')) {
    drawing = `<g transform="translate(-28 2) rotate(-13 112 165)">${ax}</g><g transform="translate(51 -8) rotate(13 112 165)">${ax}</g>`;
  } else if (String(templateId).startsWith('sword')) {
    drawing = `<g transform="rotate(16 120 152)"><path d="m120 8-15 45 4 136h22l4-136Z" fill="${jade}" stroke="${gold}" stroke-width="2"/><path d="m120 8-4 52 4 120 4-120Z" fill="#eef0cb" opacity=".75"/><path d="m108 60 12 14 12-14m-24 21 12 14 12-14m-23 30 11 13 11-13m-21 30 10 12 10-12m-20 24 10 12 10-12" fill="none" stroke="${gold}" stroke-width="1.6"/><path d="m120 35 5 18-5 9-5-9Z" fill="${gold}"/><path d="m86 177 24 7 10-13 10 13 24-7-4 17-21 3-9 10-9-10-21-3Z" fill="${gold}" stroke="#eddbac" stroke-width="1.5"/><path d="m90 184 15 6m30 0 15-6" stroke="#4b6255" stroke-width="3"/><path d="m120 183 8 9-8 9-8-9Z" fill="${jade}" stroke="#ece6b0"/><path d="M113 207h14v53h-14Z" fill="${jade}" stroke="${gold}" stroke-width="2"/><path d="M114 216h12m-12 8h12m-12 8h12m-12 8h12m-12 8h12" stroke="${gold}" stroke-width="2"/><path d="m120 260 9 8-9 14-9-14Z" fill="${gold}" stroke="#f0d7a3"/><path d="m120 263 4 5-4 7-4-7Z" fill="#739b86"/><path d="M134 197c15-14 27 3 4 8 9-24-17-16-4-8Zm6 7c10 15 0 45 10 55m-10-55c14 10 11 30 19 33" fill="none" stroke="#a8443d" stroke-width="2.2"/><path d="m151 258 2 15m7-36 5 12" stroke="#d76252" stroke-width="3"/></g>`;
  } else {
    drawing = `<path d="m93 26-28 13-42 33 15 70 34-20-16 140c40 23 88 23 128 0l-16-140 34 20 15-70-42-33-28-13-27 19Z" fill="url(#${uid}-silk)" stroke="${gold}" stroke-width="1.7"/><path d="m92 26 28 44 28-44-16 79-22 1Z" fill="#dae0c0" stroke="${gold}"/><path d="m93 29 27 43-10 34m38-77-28 43 12 33" fill="none" stroke="${gold}" stroke-width="4"/><path d="m65 43 8 77-34 18-13-60m149-35-8 77 34 18 13-60" fill="#27393a" stroke="${gold}"/><path d="m41 124 29-16m100 0 29 16M76 125l-9 127m97-127 9 127" stroke="${gold}" stroke-width="3"/><path d="M76 105h88v17H76Z" fill="${gold}" stroke="#ecdaae"/><path d="m120 103 13 10-13 13-13-13Z" fill="${jade}" stroke="#fff0c2"/><path d="m92 132 28 25 28-25-9 45 16 35-35-16-35 16 16-35Z" fill="none" stroke="${gold}" stroke-width="1.3"/><path d="M119 140c-22 8-29 23-15 25 10 1 11-12 0-8m17-17c22 8 29 23 15 25-10 1-11-12 0-8M91 198c-9-18 11-17 5-4m53 4c9-18-11-17-5-4M120 155v85" fill="none" stroke="#ccb383" stroke-width="1.2"/><path d="m120 171 8 10-8 18-8-18Z" fill="${jade}" stroke="${gold}"/><path d="M63 246c36 21 78 21 114 0m-116 9c37 22 81 22 118 0" fill="none" stroke="${gold}" stroke-width="2"/><path d="m74 251 8-9 8 15 10-9 10 15 10-10 10 10 10-15 10 9 8-15 8 9M39 96l10-8 11 10-9 8Zm142 2 11-10 10 8-12 10Z" fill="none" stroke="${gold}" stroke-width="1"/><path d="M120 123c18 5 16 18 2 7 5-17-18-8-2-7Zm2 10c8 23-4 43 9 61" stroke="#a8413e" stroke-width="2.5" fill="none"/><path d="m132 194 3 14" stroke="#d76854" stroke-width="4"/>`;
  }
  return `<svg class="relic-art high-equipment-art" viewBox="0 0 240 300" fill="none" aria-hidden="true"><defs><linearGradient id="${uid}-gold" x1="40" y1="30" x2="184" y2="270" gradientUnits="userSpaceOnUse"><stop stop-color="#79613b"/><stop offset=".25" stop-color="#f1deaa"/><stop offset=".46" stop-color="#b28a4f"/><stop offset=".65" stop-color="#e3c891"/><stop offset="1" stop-color="#725334"/></linearGradient><linearGradient id="${uid}-steel" x1="55" y1="30" x2="168" y2="110" gradientUnits="userSpaceOnUse"><stop stop-color="#283c3e"/><stop offset=".42" stop-color="#a5b7ab"/><stop offset=".52" stop-color="#e5e7d0"/><stop offset=".6" stop-color="#496360"/><stop offset="1" stop-color="#162d30"/></linearGradient><linearGradient id="${uid}-jade" x1="90" y1="20" x2="140" y2="240" gradientUnits="userSpaceOnUse"><stop stop-color="#e2ecd2"/><stop offset=".32" stop-color="#7fa899"/><stop offset=".58" stop-color="#c5dbc0"/><stop offset="1" stop-color="#456c61"/></linearGradient><linearGradient id="${uid}-silk" x1="40" y1="30" x2="200" y2="280" gradientUnits="userSpaceOnUse"><stop stop-color="#475357"/><stop offset=".3" stop-color="#202e33"/><stop offset=".55" stop-color="#485654"/><stop offset=".8" stop-color="#1e3034"/><stop offset="1" stop-color="#4d5855"/></linearGradient></defs>${drawing}</svg>`;
}
function palaceOrnament() {
  return '<svg class="palace-ornament" viewBox="0 0 600 28" fill="none" aria-hidden="true"><path d="M0 14h240l18-8 18 8-18 8-18-8m360 0H360l-18-8-18 8 18 8 18-8M276 14l24-13 24 13-24 13-24-13Z" stroke="currentColor"/><path d="m293 14 7-5 7 5-7 5-7-5ZM6 10h220M374 10h220" stroke="currentColor" opacity=".45"/></svg>';
}
function itemArt(id, category = '', rewards = []) {
  const gear = rewards.find((reward) => reward.type === 'equip');
  const template = highTemplate(gear);
  if (template) return highEquipmentArt(template.id);
  const entry = ITEMS[id];
  const first = rewards[0] || {};
  if (!category && first.type === 'cosmetic') category = COSMETICS.find((cosmetic) => cosmetic.id === first.cosmeticId)?.slot || '';
  if (!entry && first.type === 'item' && !/Bundle/.test(id)) return itemArt(first.itemId, category);
  const seed = [...String(id)].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  const colors = ['#86d8c5', '#b0bbfa', '#e4aa68', '#e17f8a', '#b5d987', '#78c7ef'];
  const accent = colors[seed % colors.length];
  const uid = `relic-${++artIndex}`;
  let drawing;
  if (id === 'highForgeSigil') {
    drawing = `<path d="M48 11v12m-4-12h8" stroke="#bb5447" stroke-width="3"/><path d="m48 21 24 13v38L48 86 24 72V34Z" fill="url(#${uid}-gold)" stroke="#efd4a3" stroke-width="1.5"/><path d="m48 28 18 10v30L48 78 30 68V38Z" fill="#682b2b" stroke="#b8955d"/><path d="M37 43h22M38 49h20M42 38v18m12-18v18M37 60h22M48 54v18m-10-7 10 7 10-7" stroke="#e5c78d" stroke-width="1.5"/><path d="M48 21c-18-6-11-19 0-9 13-12 21 4 0 9Z" stroke="#b44c43" stroke-width="2"/><path d="m27 33-9 21m54-21 8 21" stroke="#e1b963" stroke-width="1.2"/>`;
  } else if (/Chest/i.test(id) || id === 'treasureStage') {
    const bronze = id === 'bronzeChest';
    drawing = `<ellipse cx="48" cy="80" rx="35" ry="6" fill="#000" opacity=".35"/><path d="M15 45h66v28l-9 7H23l-8-7Z" fill="${bronze ? '#345953' : '#642e31'}" stroke="url(#${uid}-gold)" stroke-width="2"/><path d="M15 44c0-19 11-28 33-28s33 9 33 28v7H15Z" fill="url(#${uid}-body)" stroke="url(#${uid}-gold)" stroke-width="2.5"/><path d="M26 20v58M70 20v58M15 48h66" stroke="url(#${uid}-gold)" stroke-width="5"/><path d="M20 37c9-14 47-14 56 0M30 61l7 7m-7 0 7-7M59 61l7 7m-7 0 7-7" fill="none" stroke="#f2d99b" stroke-width="1.3"/><path d="m48 38 9 7v15l-9 7-9-7V45Z" fill="url(#${uid}-gold)" stroke="#fff0bc"/><circle cx="48" cy="50" r="3" fill="#5e2c28"/><path d="M46 52h4v7h-4Z" fill="#5e2c28"/><path d="M31 14q17-9 34 0" fill="none" stroke="#f9dfa1" opacity=".6"/>`;
  } else if (/zongzi/i.test(id)) {
    const deluxe = id === 'bigZongzi';
    drawing = `<ellipse cx="48" cy="80" rx="31" ry="5" fill="#000" opacity=".3"/><path d="m48 12 34 56-30 15-37-18Z" fill="url(#${uid}-body)" stroke="#bad7a0" stroke-width="1.5"/><path d="m48 12 4 71-37-18Z" fill="#326a51"/><path d="m48 12 34 56-30 15Z" fill="#72905a"/><path d="M23 52 52 70 75 58M30 39l23 17 15-13M48 13l4 69" fill="none" stroke="${deluxe ? '#f6d286' : '#e2dab2'}" stroke-width="3"/><path d="m25 47 21 20m-10-36 11 22m14-21 12 25M26 62l19 10" stroke="#a4c487" stroke-width=".9"/><path d="M51 55c-16-14-22 5-3 3-6 14 13 13 7 0 20 5 17-13-4-3Z" fill="none" stroke="${deluxe ? '#f6cf77' : '#ece0b8'}" stroke-width="2"/>${deluxe ? '<path d="m53 66 6 5-6 7-6-7Z" fill="#ebc77d"/>' : ''}`;
  } else if (/charm|town|revive/i.test(id)) {
    const red = id !== 'charmMp';
    drawing = `<path d="m31 12 39 8-13 65-39-8Z" fill="url(#${uid}-gold)" stroke="#e3ca8d" stroke-width="1.5"/><path d="m36 19 27 5-10 52-27-5Z" fill="${red ? '#9c3d3c' : '#365e8a'}"/><path d="m49 26-5 11 10 2-14 10 10 2-10 15m-4-30 20 4M34 56l20 4" fill="none" stroke="#ffe4a2" stroke-width="2"/><path d="m29 76-1 10 6-4 3 7 5-9" fill="#ceab65"/><circle cx="51" cy="16" r="4" fill="#a85748"/>`;
  } else if (/Key/i.test(id)) {
    drawing = `<path d="m58 39-34 37 8 8 7-7-2-5 8-1 2-9 8-1 10-14" fill="url(#${uid}-gold)" stroke="#f5dca5" stroke-width="1.5"/><path d="M76 14c14 14-8 37-22 23S62 0 76 14Z" fill="url(#${uid}-gold)" stroke="#f7e2b5" stroke-width="2"/><path d="m68 17 8 8-10 10-8-8Z" fill="#173e43"/><path d="m29 76 30-33" stroke="#fff1c1" stroke-width="1.5"/>`;
  } else if (category === 'gems' || entry?.type === 'gem' || /stone|huanxian|tiangang|disha|qiankun|salvage/i.test(id)) {
    const shapes = ['22,29 41,15 66,21 80,46 58,79 24,69 14,48', '26,22 64,15 82,41 66,76 32,82 14,47', '48,12 78,34 72,66 48,84 19,65 16,33'];
    drawing = `<ellipse cx="48" cy="82" rx="29" ry="4" fill="#000" opacity=".3"/><polygon points="${shapes[seed % 3]}" fill="url(#${uid}-body)" stroke="${accent}" stroke-width="2"/><path d="m48 12-16 32 16 39 18-37-18-34Z" fill="${accent}" opacity=".65"/><path d="m22 29 26 15 32 2-32 37M24 69l8-25 34 2-8 33M41 15l7 29 18-23" fill="none" stroke="#f4f5dc" stroke-width="1" opacity=".65"/><path d="m30 29 8-7" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="77" cy="16" r="2" fill="#f0e7c0"/>`;
  } else if (category === 'outfit' || first.type === 'cosmetic' && COSMETICS.find((c) => c.id === first.cosmeticId)?.slot === 'outfit') {
    drawing = `<path d="m34 16-22 17 14 21 9-10-11 35h48L61 44l9 10 14-21-22-17-14 9Z" fill="url(#${uid}-body)" stroke="${accent}" stroke-width="1.5"/><path d="m35 16 13 29 14-29M34 52h28M48 45v32" fill="none" stroke="url(#${uid}-gold)" stroke-width="3"/><path d="m29 70 8-7 11 7 11-7 8 7" fill="none" stroke="#e8d49d"/><path d="m43 17 5 8 5-8" fill="#f1d7a5"/>`;
  } else if (category === 'mount') {
    drawing = `<path d="M17 52q4-18 25-9l14-16 1-12 7 9 12-1 7 12-8 8-10-3-6 21 2 21h-8l-6-24-13 4-6 20h-8l3-26Z" fill="url(#${uid}-body)" stroke="${accent}" stroke-width="1.7"/><path d="M18 48Q7 31 10 67M60 27l7 8M32 47l13 6 12-15" fill="none" stroke="url(#${uid}-gold)" stroke-width="3"/><circle cx="72" cy="30" r="2" fill="#f5e3af"/>`;
  } else if (category === 'flyer') {
    drawing = `<path d="M48 17C23-2 7 23 12 41l30 16L48 76l7-19 29-16c5-18-12-44-36-24Z" fill="url(#${uid}-body)" stroke="${accent}" stroke-width="1.5"/><path d="m48 17-6 40L12 41m36-24 7 40 29-16M48 17v59" fill="none" stroke="url(#${uid}-gold)" stroke-width="2"/><path d="M48 76c-13 12 16 6 7 16" fill="none" stroke="#e8d299"/><circle cx="48" cy="35" r="6" fill="#eedba7"/>`;
  } else if (first.type === 'equip') {
    drawing = `<path d="m67 10 12 6-30 48-12-8Z" fill="url(#${uid}-body)" stroke="#cce4de" stroke-width="1.5"/><path d="m34 49 24 14-5 7-24-14Z" fill="url(#${uid}-gold)"/><path d="m38 59-13 23-8-5 14-23Z" fill="#67313a" stroke="#e3bf76"/><circle cx="19" cy="82" r="5" fill="#e7c987"/><path d="m67 15-26 42" stroke="#edf6ed"/>`;
  } else if (first.type === 'gold' || first.type === 'boundYuanbao' || first.type === 'yuanbao') {
    drawing = `<ellipse cx="48" cy="72" rx="32" ry="9" fill="#7c542b"/><path d="M17 57q30 21 62 0v15q-31 19-62 0Z" fill="url(#${uid}-gold)" stroke="#e2bb72"/><ellipse cx="48" cy="57" rx="31" ry="10" fill="#f1d28b"/><path d="M22 45q26 16 52 0v12q-26 16-52 0Z" fill="url(#${uid}-gold)"/><ellipse cx="48" cy="44" rx="26" ry="9" fill="#e5c079"/><path d="m40 40 15 1 3 6-15 1Z" fill="#836132"/><circle cx="65" cy="25" r="13" fill="url(#${uid}-gold)" stroke="#f0d593"/><path d="M62 21h7v8h-7Z" fill="#765533"/>`;
  } else if (/Bundle/.test(id)) {
    drawing = `<path d="m16 37 33-14 31 14v37L48 85 16 74Z" fill="url(#${uid}-body)" stroke="${accent}" stroke-width="1.5"/><path d="m16 37 32 12 32-12M48 49v36" fill="none" stroke="url(#${uid}-gold)" stroke-width="5"/><path d="M48 26c-22-25-32 5-3 5-2-26 28-23 11-6" fill="none" stroke="#f0d28d" stroke-width="4"/><path d="m28 32 32 12v35M33 79V43l34-13" stroke="#e8c784" stroke-width="3"/>`;
  } else if (/hp|mp|julin/i.test(id) || entry?.type === 'hp' || entry?.type === 'mp') {
    const blue = /mp/i.test(id);
    drawing = `<path d="M36 13h24v9H36Z" fill="url(#${uid}-gold)"/><path d="M38 22v16c-27 10-24 43 10 43s37-33 10-43V22Z" fill="#182e3c" stroke="#a4bbb3" stroke-width="1.5"/><path d="M25 53c-4 28 51 29 46 0Z" fill="${blue ? '#568ec0' : '#bf5768'}"/><path d="M30 46q18 7 36 0M42 28v10" stroke="#e9e7cb" fill="none" opacity=".65"/><path d="M38 65h20M48 55v20" stroke="#f5dca0" stroke-width="2"/>`;
  } else {
    drawing = `<path d="M28 24q20-17 40 0l-8 16c34 32 20 43-12 43S2 72 36 40Z" fill="url(#${uid}-body)" stroke="${accent}" stroke-width="1.5"/><path d="M34 38h28M34 43h28" stroke="url(#${uid}-gold)" stroke-width="3"/><path d="m48 51 13 13-13 13-13-13Z" fill="url(#${uid}-gold)"/><path d="M43 61h10v7H43Z" fill="#385853"/>`;
  }
  return `<svg class="relic-art" viewBox="0 0 96 96" fill="none" aria-hidden="true"><defs><linearGradient id="${uid}-gold" x1="20" y1="12" x2="76" y2="82" gradientUnits="userSpaceOnUse"><stop stop-color="#fff0bb"/><stop offset=".45" stop-color="#d8ad58"/><stop offset="1" stop-color="#8a592e"/></linearGradient><linearGradient id="${uid}-body" x1="24" y1="15" x2="74" y2="80" gradientUnits="userSpaceOnUse"><stop stop-color="${id === 'treasureStage' || /Chest/.test(id) ? '#ba6650' : accent}"/><stop offset="1" stop-color="${/Chest/.test(id) || id === 'treasureStage' ? '#47222c' : '#234b54'}"/></linearGradient></defs>${drawing}</svg>`;
}
const featuredProducts = ['zongzi', 'huanxian', 'tiangang', 'disha', 'qiankun', 'charmHp', 'charmMp', 'julin'];
function productName(product) { return product.name || ITEMS[product.id]?.name || product.id; }
function buyButtons(product, view, compact = false) {
  return `<div class="shop-buy-actions">${[1, 10].map((quantity) => btn(compact ? `购×${quantity}` : `购买 ×${quantity}`, 'mallBuy', `data-id="${e(product.id)}" data-qty="${quantity}" aria-label="购买${e(productName(product))}${quantity}份"`, quantity === 1 ? 'gold-button small' : 'ghost small', game.busy || !product.available || product.remaining < quantity || view.wallet[product.currency] < product.price * quantity || (quantity > 1 && product.rewards.some((reward) => reward.type === 'cosmetic')))).join('')}</div>`;
}
function mallDetail(id) {
  const view = economyViews[page] || economyViews.mall;
  const product = view?.shop.products.find((entry) => entry.id === id);
  if (!product) throw new Error('商品读取未就绪，请重读商城。');
  const pool = view.activity.pools[id];
  const desc = ITEMS[id]?.desc || COSMETICS.find((entry) => entry.id === id)?.desc;
  showModal(equipmentName(productName(product)), `<div class="product-detail-art">${itemArt(id, product.category, product.rewards)}</div><p class="muted">${product.catalog === 'classic' ? '端游经典名称 · 回合效果与价格改编' : '本作扩展 · 非端游原版商品'}</p><p class="detail-price">${num(product.price)} <small>${e(currencyName(product.currency))} / 份</small></p>${desc ? `<p>${e(desc)}</p>` : ''}<p class="notice">每份实际到账：${rewardText(product.rewards)}${pool ? '<br>购买后存入「包裹 → 持有道具」，持有后再开启。' : ''}</p><p class="muted">等级要求 ${product.effectiveMinLevel} · 今日已购 ${product.boughtToday}/${product.dailyLimit}份 · 剩余 ${product.remaining}份</p>${product.unavailableReason ? `<p class="muted">${e(product.unavailableReason)}</p>` : ''}${ITEMS[id] ? btn('查看道具数值 / 使用方式', 'itemDetail', `data-id="${e(id)}"`, 'ghost small') : ''}${buyButtons(product, view)}${pool ? economyFold('查看独立奖池与开启条件', `${probabilityList(pool.pool)}<p class="muted">每次消耗本物品×1${pool.keyCost ? ` + 钥匙×${pool.keyCost}` : '，不额外消耗钥匙'}；需${Math.max(pool.minLevel, ITEMS[id]?.lv || 1)}级。箱粽不影响鸿运保底。</p><p class="muted">${e(view.rules.capacity)}</p>`) : ''}`);
}
function economyHistory(records) {
  return economyFold(`逐次真实记录 · ${records.length}条`, records.length ? `<div class="economy-history">${[...records].reverse().map((result) => `<article><strong>${prizeName(result)}${result.guaranteed ? ' · 保底传说' : ''}</strong><small>${e(ACTIVITY_POOLS[result.poolId]?.name || '鸿运秘宝')} · ${e(result.id)} · ${e(result.time)}${result.pityAfter != null ? ` · 保底计数${result.pityBefore} → ${result.pityAfter}` : ''}</small><span class="reward-line">实际到账：${rewardText(result.rewards)}</span></article>`).join('')}</div>` : '<p class="muted">尚无记录。不会生成虚假中奖公告。</p>');
}
function mallSubsidy(view) {
  const festival = view.activity.festival;
  return economyFold('每日商城补贴', `<div class="experience-reward"><h3>${e(festival.name)}</h3><p>每日一次：${rewardText(festival.rewards)}。不赠箱子、粽子或秘宝钥匙。</p>${btn(festival.claimed ? '今日已领取' : '领取每日补贴', 'activityClaim', `data-id="${e(festival.id)}"`, 'ghost small', game.busy || festival.claimed)}</div>`);
}
function bagOpeningRewards(view) {
  const milestones = view.activity.milestones.filter((milestone) => milestone.counter !== 'draws');
  return economyFold('物品开启累计礼', `<div class="milestone-list">${milestones.map((milestone) => `<article data-milestone="${e(milestone.id)}"><div><h3>${e(milestone.name)}</h3><p class="muted">${milestone.progress}/${milestone.target} · ${rewardText(milestone.rewards)}</p></div>${btn(milestone.claimed ? '已领取' : milestone.ready ? '领取' : `还需${milestone.target - milestone.progress}次`, 'activityClaim', `data-id="${e(milestone.id)}"`, 'ghost small', game.busy || !milestone.ready || milestone.claimed)}</article>`).join('')}</div>`) + economyHistory(view.history.filter((result) => ACTIVITY_POOLS[result.poolId]));
}
function resultDisplay(delivery) {
  if (delivery.results?.length) return `<div class="result-grid">${delivery.results.map((result) => `<article class="real-prize ${result.rarity === 'legendary' || result.guaranteed ? 'legendary' : ''}"><div class="result-art">${itemArt(result.id, '', result.rewards)}</div><strong>${prizeName(result)}</strong>${result.guaranteed ? '<span class="tag gold">保底传说</span>' : ''}<span class="reward-line">${rewardText(result.rewards)}</span></article>`).join('')}</div>`;
  return `<p class="notice">${rewardText(delivery.rewards)}</p>`;
}
function actualResultModal(delivery, title, boxId = '') {
  if (!delivery || (!delivery.results && !delivery.rewards)) return;
  showModal(title, `<p class="muted">${e(delivery.message || '本次事务已提交，以下为实际到账物品。')}</p>${resultDisplay(delivery)}${boxId ? `${btn('前往包裹开启', 'bagOpenables', '', 'gold-button wide')}<p class="muted">先持有物品，再开启；此刻没有提前抽取奖励。</p>` : '<p class="muted">结果已保存，可关闭后继续操作。</p>'}`);
}
function walletPanel(view, controls = true) {
  const wallet = view.wallet;
  return `<div class="wallet-ribbon"><div class="wallet-balance">${icon('coin')}<span>元宝 <strong>${num(wallet.yuanbao)}</strong></span></div><div class="wallet-balance bound"><span>绑定元宝 <strong>${num(wallet.boundYuanbao)}</strong></span></div>${controls ? btn('兑换 / 补给', 'walletDetail', '', 'ghost small') : ''}</div>`;
}
function walletDetail() {
  const view = economyViews[page];
  if (!view) throw new Error('钱包尚未读取。');
  const wallet = view.wallet;
  showModal('本地虚拟钱包', `<p class="detail-price">${num(wallet.gold)} <small>金币</small></p>${walletPanel(view, false)}<p class="notice">每日实际到账：${rewardText(wallet.daily.rewards)}。每日仅一次；两种元宝分别扣除，不自动互换。</p><div class="economy-actions">${btn(wallet.dailyClaimed ? '今日已领取' : '领取每日虚拟补给', 'walletDaily', '', 'gold-button', wallet.dailyClaimed || game.busy)}${[1, 10].map((quantity) => btn(`兑换${quantity * wallet.exchange.yuanbaoPerUnit}元宝 · ${num(quantity * wallet.exchange.goldPerUnit)}金币`, 'walletExchange', `data-qty="${quantity}"`, 'ghost small', game.busy || wallet.gold < quantity * wallet.exchange.goldPerUnit || wallet.exchangeUsed + quantity > wallet.exchange.dailyLimit)).join('')}</div><p class="muted">今日兑换 ${wallet.exchangeUsed}/${wallet.exchange.dailyLimit}份。无充值、无支付入口。</p>`);
}
function deliveryPanel() {
  if (!lastDelivery) return '';
  const results = lastDelivery.results;
  const rewards = lastDelivery.rewards;
  if (!results && !rewards) return '';
  return `<section class="delivery-showcase"><div class="shop-section-head"><h2>最近获得</h2><span class="tag gold">实际到账</span></div>${resultDisplay(lastDelivery)}</section>`;
}
function mallPage() {
  const view = economyViews.mall;
  const header = `<header class="shop-masthead"><div><div class="eyebrow">乾坤纳珍 · 玉府藏金</div><h1>乾坤袋商城</h1></div>${view ? walletPanel(view) : ''}</header>${economyNotice('mall')}`;
  if (!view) return header;
  const products = view.shop.products.filter((product) => mallTab === 'featured' ? featuredProducts.includes(product.id) : mallTab === 'all' ? true : mallTab === 'extension' ? product.catalog === 'adaptation' : product.category === mallTab);
  if (mallTab === 'featured') products.sort((a, b) => featuredProducts.indexOf(a.id) - featuredProducts.indexOf(b.id));
  const heroProduct = view.shop.products.find((product) => product.id === 'goldChest');
  const categories = [{ id: 'featured', name: '精选' }, ...view.shop.categories, { id: 'all', name: '全部' }, { id: 'extension', name: '本作扩展' }];
  return `<div class="economy-page mall-page">${header}<section class="mall-banner"><div class="banner-copy"><div class="eyebrow">珍藏入袋 · 好物随行</div><h2>一匣藏鸿运<br><span>一叶寄山海</span></h2><p>选购箱粽，收入包裹；持有之后，再启奇遇。</p>${btn('去包裹开启', 'bagOpenables', '', 'gold-button small')}</div><div class="banner-relics" aria-hidden="true"><div>${itemArt('zongzi')}</div><div>${itemArt('goldChest')}</div></div>${heroProduct ? `<span class="banner-caption">${equipmentName(productName(heroProduct))} · 本作扩展</span>` : ''}</section><div class="mall-toolbar"><div class="tabs mall-tabs" aria-label="商品分类">${categories.map((category) => `<button type="button" class="tab ${mallTab === category.id ? 'active' : ''}" data-action="mallTab" data-id="${e(category.id)}" aria-pressed="${mallTab === category.id}">${e(category.name)}</button>`).join('')}</div>${btn(icon('arrow'), 'retryEconomy', 'data-id="mall" aria-label="重读商品"', 'ghost small')}</div><div class="shop-section-head shelf-heading"><h2>${e(categories.find((category) => category.id === mallTab)?.name || '珍品')}陈列</h2><span class="muted">${products.length}件 · 点物品查看详情</span></div><div class="mall-shelf">${products.map((product) => `<article class="shop-product" data-product="${e(product.id)}"><button type="button" class="product-preview" data-action="mallDetail" data-id="${e(product.id)}" aria-label="查看${e(productName(product))}详情"><div class="product-art">${itemArt(product.id, product.category, product.rewards)}</div><h3>${equipmentName(productName(product))}</h3></button><p class="shop-price">${num(product.price)} <small>${e(currencyName(product.currency))} / 份</small></p><p class="product-stock">${product.catalog === 'classic' ? '经典名称 · 数值改编' : '本作扩展'}</p><p class="product-stock">${product.available ? `日余 ${num(product.remaining)}份 · Lv.${product.effectiveMinLevel}` : e(product.unavailableReason || '暂不可购')}</p>${buyButtons(product, view, true)}</article>`).join('') || empty('当前分类暂无商品。')}</div>${deliveryPanel()}${mallSubsidy(view)}${economyFold('外观与护符 · 持有物品装载', appearancePanel())}${economyFold(`本地实际订单 · ${view.shop.orders.length}条`, view.shop.orders.length ? `<div class="economy-history">${[...view.shop.orders].reverse().map((order) => `<article><strong>${equipmentName(order.name)} ×${order.quantity}份 · 实扣 ${num(order.cost)}${e(currencyName(order.currency))}</strong><small>${e(order.id)} · ${e(order.time)}</small><span class="reward-line">${rewardText(order.rewards)}</span></article>`).join('')}</div>` : '<p class="muted">暂无订单。购买后显示真实扣款与到账记录。</p>')}${economyBoundary(view)}</div>`;
}
function treasureMilestones(view) {
  const milestones = view.activity.milestones.filter((milestone) => milestone.counter === 'draws');
  const next = milestones.find((milestone) => !milestone.claimed);
  return `<aside class="treasure-progress" aria-label="秘宝累计领奖"><header><div class="eyebrow">本作累计礼</div><h2>福运阶礼</h2><p>累计开启 <strong data-draw-total>${num(view.treasure.draws)}</strong> 次</p></header><div class="treasure-milestones">${milestones.map((milestone) => `<article class="treasure-milestone ${milestone.claimed ? 'claimed' : milestone.ready ? 'ready' : ''}" data-milestone="${e(milestone.id)}"><div class="milestone-heading"><span class="milestone-seal">${milestone.target}<small>抽</small></span><div><h3>${e(milestone.name)}</h3><small>${num(Math.min(milestone.progress, milestone.target))} / ${milestone.target}</small></div></div><div class="milestone-track" role="progressbar" aria-label="${e(milestone.name)}累计进度" aria-valuemin="0" aria-valuemax="${milestone.target}" aria-valuenow="${Math.min(milestone.progress, milestone.target)}"><span style="width:${Math.min(100, milestone.progress / milestone.target * 100)}%"></span></div><p class="reward-line">${rewardText(milestone.rewards)}</p>${btn(milestone.claimed ? '已领取' : milestone.ready ? '领取阶段礼' : `还需 ${num(milestone.target - milestone.progress)} 抽`, 'activityClaim', `data-id="${e(milestone.id)}"`, 'gold-button small wide', game.busy || !milestone.ready || milestone.claimed)}</article>`).join('')}</div><footer>${next ? next.ready ? '阶段礼已达成，点击领取实际奖励。' : `下阶礼：累计${next.target}抽` : '全部阶段礼已领取。'}<br>累计次数不随传说保底重置；奖励只能领取一次。<br>门槛与奖励为本作设定，并非官方福禄值规则。</footer></aside>`;
}
function probabilityList(pool) {
  const total = pool.reduce((sum, prize) => sum + prize.weight, 0);
  return `<ul class="probability-list">${pool.map((prize) => `<li><span>${prizeName(prize)}</span><strong>${percent(prize.weight / 10000)}</strong></li>`).join('')}</ul><p class="muted">基础概率合计 ${percent(total / 10000)}${total !== 10000 ? ' · 配置异常，请勿开启' : ''}</p>`;
}
const activityTier = (prize) => ({ legendary: '传说档', rare: '稀有档', uncommon: '精良档', common: '基础档' }[prize.rarity] || '奖池档');
function treasureCollection(pool) {
  const named = pool.filter((prize) => prize.rewards.some((reward) => highTemplate(reward)));
  const directory = pool.filter((prize) => !named.includes(prize));
  const tiers = [['legendary', 'legendary', '传说珍藏'], ['rare', 'purple', '稀有珍品'], ['uncommon', 'blue', '精良宝材'], ['common', 'common', '基础供给']];
  return `<div class="collection-heading"><div><h2>神铸装备</h2><p>具名样本 · 点击查看原始属性与本作效果</p></div><span class="collection-seal" aria-hidden="true">藏<br>珍</span></div>${palaceOrnament()}<div class="treasure-orbit sovereign-gallery">${named.map((prize) => {
    const reward = prize.rewards.find((entry) => highTemplate(entry)); const template = highTemplate(reward);
    return `<article class="orbit-prize sovereign-prize" data-prize="${e(prize.id)}"><div class="sovereign-rank"><span>${template.grade}<small>品</small></span><strong>${template.stage}阶 · 神铸</strong></div><button class="armory-preview" data-action="highDetail" data-id="${e(template.id)}" aria-label="查看${e(template.name)}需求与固定效果"><span class="weapon-curtain" aria-hidden="true"></span>${highEquipmentArt(template.id)}</button><h3>${prizeName(prize)}</h3><p class="sovereign-requirement">${highRequirements(template)}</p><div class="prize-probability"><span>活动 · ${e(activityTier(prize))}</span><strong>${percent(prize.weight / 10000)}</strong></div>${btn('原始规格 / 固定效果', 'highDetail', `data-id="${e(template.id)}"`, 'ghost small')}</article>`;
  }).join('')}</div><div class="collection-caption"><span>品阶为装备规格，与活动奖项分类独立</span><span>${pool.length}项真实奖池 · 基础概率</span></div>${palaceOrnament()}<div class="treasure-directory">${tiers.map(([rarity, color, title]) => {
    const prizes = directory.filter((prize) => prize.rarity === rarity);
    return prizes.length ? `<section class="directory-tier tier-${color}"><h3><span></span>${title}</h3><div class="directory-prizes">${prizes.map((prize) => `<article class="orbit-prize directory-prize" data-prize="${e(prize.id)}"><div class="directory-art">${itemArt(prize.id, '', prize.rewards)}</div><div class="directory-copy"><strong>${prizeName(prize)}</strong><small>${rewardText(prize.rewards)}</small></div><span class="directory-probability">${percent(prize.weight / 10000)}</span></article>`).join('')}</div></section>` : '';
  }).join('')}</div>`;
}
function activitiesPage() {
  const view = economyViews.activities;
  const header = `<header class="shop-masthead"><div><div class="eyebrow">鸿运入匣 · 珍宝待启</div><h1>鸿运秘宝</h1></div>${view ? walletPanel(view) : ''}</header>${economyNotice('activities')}`;
  if (!view) return header;
  const treasure = view.treasure;
  const p = game.p;
  const keyProduct = view.shop.products.find((product) => product.id === 'treasureKey');
  const legendary = treasure.pool.filter((prize) => prize.rarity === 'legendary');
  const equipment = treasure.pool.some((prize) => prize.rewards.some((reward) => reward.type === 'equip'));
  const validPool = treasure.pool.reduce((sum, prize) => sum + prize.weight, 0) === 10000;
  return `<div class="economy-page treasure-page">${header}<div class="treasure-layout"><section class="treasure-palace"><div class="treasure-controls"><div class="key-status"><span>${itemArt('treasureKey')}<span>${equipmentName(materialName('treasureKey'))} <strong>×${num(treasure.keys)}</strong></span></span>${keyProduct ? btn('添置钥匙', 'mallDetail', 'data-id="treasureKey"', 'ghost small') : btn('前往商城', 'page', 'data-id="mall"', 'ghost small')}</div><div class="pity-status"><div><span>连续未传说 ${treasure.pity} / ${treasure.pityLimit}</span><strong>最迟 ${Math.max(1, treasure.pityLimit - treasure.pity)}抽得传说</strong></div><div class="pity-track" role="progressbar" aria-label="鸿运保底进度" aria-valuemin="0" aria-valuemax="${treasure.pityLimit}" aria-valuenow="${treasure.pity}"><span style="width:${Math.min(100, treasure.pity / treasure.pityLimit * 100)}%"></span></div></div><div class="draw-actions">${[1, 10].map((count) => btn(`<strong>${count === 1 ? '开启一次' : '鸿运十连'}</strong><small>${count}把钥匙 · ${count}抽</small>`, 'treasureDraw', `data-count="${count}"`, `draw-button ${count === 10 ? 'ten-draw' : ''}`, game.busy || !validPool || treasure.keys < count || (equipment && p.bag.length + count > BAG_LIMIT))).join('')}</div><p class="stage-footnote">${!validPool ? '概率配置异常，已禁用开启 · ' : ''}${equipment && p.bag.length >= BAG_LIMIT ? '行囊已满，请先整理 · ' : ''}本作${treasure.pityLimit}抽传说分类保底，不保证神铸 · 预览不代表已获得</p></div>${treasureCollection(treasure.pool)}</section>${treasureMilestones(view)}</div>${lastDelivery?.action === 'treasure.draw' || (lastDelivery?.action === 'activity.claim' && lastDelivery.milestoneId?.startsWith('draw')) ? deliveryPanel() : ''}${economyFold('概率、保底与开启规则', `<p class="muted">传说预览：${legendary.map(prizeName).join('、')}。已抽 ${num(treasure.draws)}次。</p>${probabilityList(treasure.pool)}<p>${e(view.rules.pity)}</p><p>${e(view.rules.probability)}</p><p>${e(view.rules.capacity)}</p><p>${e(view.rules.duplicateCosmetic)}</p>${keyProduct ? `<p class="muted">钥匙商城价：${num(keyProduct.price)}${e(currencyName(keyProduct.currency))} / 份；每份实际到账 ${rewardText(keyProduct.rewards)}。</p>` : ''}`)}${economyHistory(view.history.filter((result) => result.poolId === 'hongyun'))}${economyBoundary(view)}</div>`;
}
function journal(count = 60) { return `<div class="combat-log">${game.state.journal.slice(-count).reverse().map((l) => `<div class="log-line ${e(l.kind)}"><small>${e(l.time)}</small> ${itemText(l.text)}</div>`).join('')}</div>`; }
function guidePage() {
  const systems = [
    ['world', '游历与任务', '五族故乡 → 指定目标 → 领取奖励 → 逐站旅行。探索与奇遇是可选内容。'],
    ['character', '职业与属性', '五族十职业；升级得5点自由属性。先满足穿戴需求，再按主攻属性和体质分配。成长公式为本作设计。'],
    ['skills', '技能与修真', '72个可玩技能采用已归档普通技能名和逐级学习表；战斗效果单独标注差异。修真需等级、试炼与元神。'],
    ['bag', '装备获取与培养', '任务 / 战斗 / 生产获取实际具名装备 → 检查需求 → 穿戴 → 培养。官方原文、资料未载与本作训练分开展示。'],
    ['town', '生产与副本', '按已登记的精确具名配方支付真实材料与金币。源材料数量和本作费用分列；未登记黄昏 / 轮回前件链不算已实现。'],
    ['mall', '商城与包裹', '全部货币是本地虚拟余额。商城购买箱子或粽子，物品进入包裹，开启时才消耗并随机获奖。没有充值。'],
    ['activities', '鸿运秘宝', '唯一独立抽奖页；消耗钥匙，可查奖池、概率、保底和累计领奖。价格与概率不是官方运营数据。'],
  ];
  return pageTitle('玩法与存档', '先走一段清楚的旅程，再逐步接触成长系统。') + `<div class="grid-two">${card('第一段历练 · 三步就能开始', `<div class="guide-step"><span class="tag">01</span><div><strong>前往第一处野外</strong><p>在「大陆游历」按当前主线出发，到达后领取启程奖励与基础材料。</p></div></div><div class="guide-step"><span class="tag">02</span><div><strong>挑战一只指定敌人</strong><p>点击任务目标直接挑战。用初始技能输出，敌人蓄力时防御；胜利后领取初战奖励。</p></div></div><div class="guide-step"><span class="tag">03</span><div><strong>回城领装备，再变强</strong><p>完成归来任务，得到历练装备。在包裹检查穿戴需求，在角色页分配属性；休息和学习技能都在城镇进行。</p></div></div>${btn('返回当前主线', 'page', 'data-id="world"', 'primary')}`)}${card('存档管理', `<p class="notice warning">存档仅在本浏览器的IndexedDB。清理数据会丢失进度；回合会自动保存，刷新可继续战斗。</p><div class="settings-grid">${btn('导出存档（含战斗）', 'export', '', 'primary')}${btn('导入存档', 'importPicker', '', 'ghost', game.busy)}${btn('手动保存', 'save', '', 'ghost')}${btn('导出原始备份', 'backupRaw', '', 'ghost')}${btn('重试读取', 'retryLoad', '', 'ghost')}${btn('重新创建角色', 'newConfirm', '', 'danger', game.busy)}</div><p class="muted">本轮主线顺序与技能要求已重做，旧角色不保证适配；不会自动删除存档，重建或导入必须确认。没有账号、云存档或支付。</p>`)}</div>${card('系统全景 · 按需要打开', `<div class="system-overview">${systems.map(([id, title, text]) => `<article class="system-node"><h3>${title}</h3><p>${text}</p>${btn('打开', 'page', `data-id="${id}"`, 'ghost small')}</article>`).join('')}</div>`)}<details class="world-detail"><summary>官方资料、适配和未实现边界</summary><p>官方资料册保存历史页面与原始资源；装备资料图鉴收录744条历史具名记录及5个跨年代高阶样本。没有记载的基础属性、穿戴等级和随机词条保持未知，不虚构为0。</p><p>3D人物和地图为本作程序化示意，非官方模型。保留经典五族十职业，未覆盖后续所有职业、技能和版本；战斗倍率、回合、宠物、成长、任务编排、装备预算、配方费用与抽奖概率为明确的单机适配。</p><p>未实现多人组队、帮派领土战、交易市场、婚姻、转生星盘、家园、官方充值和完整宠物养成；不以不可操作入口冒充完成，也未声称自然1→105通关或完整官方装备库。</p><a href="/official-library/index.html" target="_blank" rel="noopener">查看官方资料册与缺项</a></details><details class="world-detail"><summary>完整纪行</summary>${journal()}</details>`;
}

async function navigateToward(id) {
  if (game.p.location === id) { page = 'world'; toast('已在目标地点。'); return; }
  const route = routeTo(game.p.location, id, game.p);
  if (!route || route.length < 2) throw new Error('没有可通行路线：目标或途经地点的等级 / 修真门槛尚未满足。');
  await command('/v1/world/travel', { id: route[1] });
  page = 'world';
  toast(`已前进一站至${ZONES[route[1]].name}，距${ZONES[id].name}还需${route.length - 2}站。`);
}
const atlasLayers = { mainland: '完美大陆', islands: '海岛与内部地图', otherworld: '仙魔之界' };
function atlasLandmark(id) {
  const drawing = {
    wanliu: '<path fill="#9daca2" d="m6 37 12-26 10 26m15 0 10-32 10 32"/><path fill="#dee0c4" d="m30 3 4 7-1 25h-6L26 10Z"/><path d="M23 30h14m-7 5v7"/>',
    h_f1: '<path fill="#bca584" d="M12 23h40v17H12Z"/><path fill="#a06143" d="m7 24 25-16 25 16Z"/><path d="M28 40V28h8v12m-18-9h4m19 0h4M7 14V5h10v9"/>',
    h_f2: '<path fill="#a1a994" d="m4 40 9-28 9 15 10-20 9 19 11-15 8 29Z"/><path fill="#554b3f" d="M25 40V29a7 7 0 0 1 14 0v11"/>',
    jiyu: '<path d="M30 43V15m0 15L14 21m16 3 17-11"/><path fill="#87976b" d="M5 20a11 11 0 0 1 15-12 15 15 0 0 1 29-3 11 11 0 0 1 11 15Z"/><path fill="#bda980" d="M40 23h16v10H40Zm-29 6h12v9H11Z"/><path d="m38 23 10-8 10 8M8 29l9-7 9 7"/>',
    e_f1: '<path d="M18 42V17m29 25V15"/><g fill="#ca9c9a"><circle cx="13" cy="15" r="9"/><circle cx="23" cy="14" r="9"/><circle cx="44" cy="13" r="9"/><circle cx="54" cy="16" r="7"/></g><path d="m10 39 18-2 25 6"/>',
    e_f2: '<path stroke="#73989d" stroke-width="5" d="M3 37q12-8 25 0t33 0"/><path fill="#c9bb97" d="M9 28q23-21 46 0v7q-23-20-46 0Z"/><path d="M14 28v12m36-12v12"/>',
    wanhua: '<path fill="#a69c82" d="M7 18h12v23H7Zm38 0h12v23H45ZM18 26h28v15H18Z"/><path d="M7 13v8m6-8v8m6-8v8m26-8v8m6-8v8m6-8v8"/><path fill="#b68c64" d="M28 10h8v31h-8Z"/><path d="m24 7 8 9 8-9m-12 16h8m-8 7h8"/>',
    u_f1: '<path d="M15 43V4m31 38V10"/><path fill="#ab6248" d="m16 5 23 5-9 9-14-2Zm31 6 14 4-7 8-7-2Z"/><path fill="#b0a58a" d="m7 42 14-17 13 17m1 0 12-12 12 12"/>',
    u_f2: '<path fill="#a7a18e" d="m5 41 12-25 10 12 12-23 20 36Z"/><path stroke="#eee4c7" d="M26 14v18m-10-9h21m-18-7 14 14m-2-16L19 30m-3-7 3-7 7-2 7 4 4 5-4 7-7 2-7-2Z"/>',
    xidao: '<path fill="#b1c9bb" d="M9 39C-2 17 15 7 31 29 48 4 67 17 54 39Z"/><path d="M31 40V29M31 29 11 20m20 9 19-10m-19 9 1-18"/><path stroke="#aa7d77" stroke-width="3" d="M7 42V28m0 7-6-4m6 6 6-5m42 10V24m0 9-5-5m5 11 7-7"/>',
    t_f1: '<path fill="#b4a280" d="M10 27h25v14H10Z"/><path fill="#7c9e9e" d="m5 27 17-13 18 13Z"/><path d="m48 40-4-26 7-11 5 11-5 26M3 43q14-6 26 0t31 0"/>',
    t_f2: '<path stroke="#8ea7a2" stroke-width="4" d="M3 37q12-7 23 0t35 0"/><path fill="#d9c9a1" d="m31 12 13 8-13 11-13-11Z"/><path d="m31 12 3 19m-16-11h26M12 31l4-6m35 2 5 4"/>',
    lingyuan: '<ellipse cx="32" cy="37" rx="24" ry="5" fill="#9ca99c"/><path fill="#bfb8d8" d="M13 27h38L32 7Z"/><path fill="#dcd1ae" d="M18 27h28v8H18Z"/><path d="M24 28v7m16-7v7m-24 0-7-7 3-4m36 11 7-7-3-4"/>',
    g_f1: '<ellipse cx="34" cy="36" rx="25" ry="7" fill="#8fb4a8"/><path fill="#d3adb1" d="M32 34Q13 18 18 30q3 9 14 4 11 5 14-4 5-12-14 4Zm0 0q-9-22 0-24 9 2 0 24Z"/><path fill="#b5a294" d="M9 35v-8m-6 0a6 6 0 0 1 12 0Z"/>',
    g_f2: '<path fill="#879d82" d="m5 41 14-14 13 14 11-19 17 19Z"/><path fill="#c1b8cd" d="m30 5 8 10-4 17h-8l-4-17Z"/><path d="M30 5v27m-8-17h16"/>',
    zulong: '<path fill="#aaa488" d="M7 22h10v20H7Zm40 0h10v20H47ZM17 23h30v10H17Z"/><path d="m3 22 9-8 10 8m20 0 10-8 10 8M19 17q7-13 13-2 6-11 13 2m-14 7v18"/><path stroke="#7b9d98" d="M2 45q16-4 30 0t30 0"/>',
    f_kuangkeng: '<path fill="#aba38b" d="m5 42 19-18 19 18 10-11 8 11Z"/><path d="M25 32V4m18 37V12"/><path fill="#a56953" d="m26 5 18 5-6 8-12-2Zm18 8 12 3-5 7-7-2Z"/>',
    taoyuan: '<circle cx="45" cy="15" r="11" fill="#c28a60"/><path fill="#c1a67f" d="M7 28h30v14H7Z"/><path fill="#9b684c" d="m3 28 18-13 20 13Z"/><path d="M18 42V30h7v12M39 40h20"/>',
    f_taoyuan: '<path fill="#8f9787" d="M10 16h44v27H10Z"/><path fill="#574e46" d="M23 43V29a9 9 0 0 1 18 0v14Z"/><path d="m5 16 27-12 27 12M17 21h30m-29-3v18m28-18v18"/>',
    jifeng: '<path fill="#a6a08e" d="m4 40 16-27 13 27m8 0 12-30 9 30"/><path fill="#b99873" d="M23 24h20v14H23Z"/><path d="m18 24 15-11 15 11M33 29v9M5 43q28-9 54 0"/>',
    f_jifeng: '<path fill="#beaa7d" d="m26 16-5 27h23l-6-27Z"/><path d="M32 21V3m0 18 17 8M32 21l-17 8m17-8L19 7m13 14L45 7"/><circle cx="32" cy="21" r="3" fill="#d1b275"/>',
    f_fengsha: '<path fill="#b5a68a" d="M13 23h38v18H13Z"/><path d="M13 18v8m9-8v8m20-8v8m9-8v8M32 24V8"/><path fill="#a16f58" d="m33 9 17 5-7 8-10-2Z"/><path stroke="#83a3a3" d="M3 44q13-7 26 0t32 0"/>',
    f_bingfeng: '<path fill="#97a995" d="m4 39 18-29 12 29m-6 0 14-34 18 34Z"/><path stroke="#ddd6bd" stroke-width="4" d="M4 32q20-8 30 0t26 0M9 39q17-6 25 0t25 0"/>',
    f_shangqi: '<path stroke="#738a76" stroke-width="4" d="M3 42q15-5 29 0t29 0"/><path d="M12 39V9m0 11-8-6m8 10 8-10"/><path fill="#aaa084" d="M28 14h8v27h-8Zm16 0h8v27h-8ZM36 14h8v7h-8Z"/>',
    wanjie: '<path fill="#a88663" d="M4 35h37v5H4Z"/><path d="M9 40v6m24-6v6m14-35v31"/><path fill="#e5d6b4" d="m48 12 12 15H48Z"/><path fill="#8d6c50" d="m36 33 25 0-5 8H43Z"/><path fill="#bcaf87" d="M12 4h8v27h-8Zm-2 0h12v8H10Z"/>',
    f_wanjie: '<path fill="#887b66" d="m7 30 49-1-12 13-20-2Z"/><path d="M31 8v27m-8-13 9-14 9 14m-29 7 3-13m31 14 6-12M5 44h54"/>',
    f_tongtian: '<path fill="#a09a87" d="m4 43 9-23L27 8l19 5 15 30Z"/><path fill="#625646" d="M16 43V31a16 16 0 0 1 32 0v12Z"/><path fill="#c5a15e" d="M24 34h18v9H24Zm1 0v-7h16v7Z"/><path d="M32 28v14"/>',
    f_shedao: '<path fill="#ac9b7c" d="M26 5h13v37H26Z"/><path stroke="#80966f" stroke-width="4" d="M23 38q28-7 2-14T41 7"/><path d="M19 44h26"/>',
    f_longgong: '<path fill="#a4c1b2" d="M13 23h39v17H13Z"/><path d="m8 23 24-17 25 17M20 24v16m12-16v16m13-16v16"/><path stroke="#b38983" d="M6 43V24m0 13 6-7m42 13V26m0 9 8-6"/><circle cx="12" cy="9" r="3" fill="#bbd5c7"/>',
    f_xianmo: '<circle cx="32" cy="24" r="18" fill="#ddcfab"/><path fill="#756d89" d="M32 6a9 9 0 0 1 0 18 9 9 0 0 0 0 18 18 18 0 0 0 0-36Z"/><circle cx="32" cy="15" r="3" fill="#756d89"/><circle cx="32" cy="33" r="3" fill="#ddcfab"/>',
  };
  return `<svg viewBox="0 0 64 48" fill="none" stroke="#62573f" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><ellipse cx="32" cy="43" rx="28" ry="4" fill="#736f55" stroke="none" opacity=".15"/>${drawing[id]}</svg>`;
}
function atlasContents() {
  const p = game.p; const selected = ZONES[atlasSelection] ? atlasSelection : p.location;
  const z = ZONES[selected]; const node = ATLAS_NODES[selected];
  const route = routeTo(p.location, selected, p);
  const locked = p.lv < z.lv[0] - 5 || p.cult < (z.minCult || 0);
  const entrances = entryDungeons(selected);
  const point = (id) => `${ATLAS_NODES[id].x * 8 + 50},${ATLAS_NODES[id].y * 5.5 + 50}`;
  const nodes = Object.entries(ATLAS_NODES).filter(([, n]) => n.layer === atlasLayer);
  const edges = nodes.flatMap(([id]) => ZONES[id].links.filter((next) => ATLAS_NODES[next]?.layer === atlasLayer && id < next).map((next) => `<path d="M${point(id)} L${point(next)}"/>`)).join('');
  const routeLines = route ? route.slice(1).map((id, index) => ATLAS_NODES[id]?.layer === atlasLayer && ATLAS_NODES[route[index]]?.layer === atlasLayer ? `<path d="M${point(route[index])} L${point(id)}"/>` : '').join('') : '';
  return `<div class="atlas-masthead"><div><div class="eyebrow">山河为卷 · 逐站纪行</div><h3>${e(ZONES[p.location].name)} <small>此刻所在</small></h3></div><span class="tag gold">已探索 ${p.discovered.length} / ${Object.keys(ZONES).length}</span></div><div class="atlas-layout"><section class="atlas-map-section"><div class="atlas-tools"><div class="tabs">${Object.entries(atlasLayers).map(([id, label]) => btn(label, 'atlasLayer', `data-id="${id}" aria-pressed="${atlasLayer === id}"`, `small ${atlasLayer === id ? 'primary' : 'ghost'}`)).join('')}</div><div class="atlas-zoom">${btn('−', 'atlasZoom', 'data-delta="-0.25" aria-label="缩小地图"', 'ghost small', atlasZoom <= 1)}<span>${Math.round(atlasZoom * 100)}%</span>${btn('+', 'atlasZoom', 'data-delta="0.25" aria-label="放大地图"', 'ghost small', atlasZoom >= 2)}</div></div><div class="atlas-scroll" tabindex="0" aria-label="可横向滚动的地图，亦可用下方地点选择器"><div class="atlas-canvas ${atlasLayer}" style="--atlas-zoom:${atlasZoom}"><svg viewBox="0 0 900 650" class="atlas-terrain" aria-hidden="true"><defs><pattern id="atlas-grain" width="24" height="24" patternUnits="userSpaceOnUse"><path d="M2 5h3m12 10h2M8 22h3" stroke="#b5aa85" opacity=".13"/></pattern><linearGradient id="atlas-land" x2=".8" y2="1"><stop stop-color="#c6c3a0"/><stop offset="1" stop-color="#e0cfa7"/></linearGradient></defs><rect width="900" height="650" fill="#315d5b"/><path class="atlas-landmass" d="M20 15Q180 65 290 12L650 18 710 105 655 160 763 240 698 326 763 400 660 480 701 590 576 620 445 590 330 637 218 559 158 447 69 399 100 297 15 217Z" fill="url(#atlas-land)" stroke="#e4d3a5" stroke-width="3"/><path class="atlas-river" d="M420 28Q380 123 495 208T499 349Q513 405 480 548" fill="none" stroke="#548b86" stroke-width="9" opacity=".65"/><path class="atlas-river" d="M505 298Q604 279 727 387" fill="none" stroke="#548b86" stroke-width="6"/><g class="atlas-mountains" fill="none" stroke="#767f62" stroke-width="2" opacity=".35"><path d="m100 166 34-55 32 55m-36 0 30-43 32 43m96 203 34-60 38 60m-10-347 29-37 26 37m183 376 27-49 33 49m-334 139 28-45 30 45"/><path d="M95 180q70-25 115 0m53 151q53-17 105 6m65 202q49-20 130 0"/></g><rect width="900" height="650" fill="url(#atlas-grain)"/>${atlasLayer === 'islands' ? '<g fill="url(#atlas-land)" stroke="#d5c998" stroke-width="2"><path d="M125 170q62-72 143-27l69 72-46 65-127 4-44-64Z"/><path d="M436 145h157v142H436Z"/><path d="M178 419q40-54 112-20l68 54-49 65-111-9Z"/><path d="M541 436q51-62 100-29t49 82q-76 57-147-9Z"/></g><g fill="none" stroke="#658674" opacity=".55"><path d="M451 165h126v104H451Zm16 16h94v70h-94Zm17 18h60v33h-60"/><ellipse cx="608" cy="453" rx="63" ry="39"/></g>' : atlasLayer === 'otherworld' ? '<g fill="none" stroke="#97af94" opacity=".6"><circle cx="450" cy="325" r="163"/><circle cx="450" cy="325" r="175"/><path d="M450 162a81.5 81.5 0 0 1 0 163 81.5 81.5 0 0 0 0 163"/><circle cx="450" cy="243" r="16"/><circle cx="450" cy="407" r="16"/></g>' : ''}<g class="atlas-roads">${edges}</g><g class="atlas-route">${routeLines}</g><g class="atlas-calligraphy"><text x="70" y="85">${atlasLayer === 'mainland' ? '完美大陆' : atlasLayer === 'islands' ? '跨图纪行' : '仙魔两界'}</text><text x="475" y="490">${atlasLayer === 'mainland' ? '无忧河' : ''}</text><text x="735" y="585">${atlasLayer === 'otherworld' ? '道心' : '无尽海'}</text><text x="20" y="626">${atlasLayer === 'mainland' ? '方位示意 · 非原版坐标投影' : '独立地图示意 · 不与大陆共用坐标'}</text></g></svg>${nodes.map(([id, n]) => {
    const place = ZONES[id]; const blocked = p.lv < place.lv[0] - 5 || p.cult < (place.minCult || 0);
    const entrance = entryDungeons(id).length > 0;
    return `<button type="button" data-action="mapSelect" data-id="${id}" class="atlas-node ${place.type === 'city' ? 'city' : 'field'} ${entrance ? 'entrance' : ''} ${p.discovered.includes(id) ? 'explored' : 'unknown'} ${blocked ? 'locked' : ''} ${p.location === id ? 'current' : ''} ${selected === id ? 'selected' : ''}" style="left:${(n.x * 8 + 50) / 9}%;top:${(n.y * 5.5 + 50) / 6.5}%" aria-pressed="${selected === id}" aria-label="${e(place.name)}，${place.type === 'city' ? '城镇' : '野外'}${entrance ? '，副本接引' : ''}，${blocked ? '未解锁' : p.location === id ? '当前所在地' : p.discovered.includes(id) ? '已探索' : '未探索'}"><span class="atlas-marker" aria-hidden="true">${atlasLandmark(id)}</span><span class="atlas-label">${e(place.name)}</span></button>`;
  }).join('')}<div class="atlas-compass" aria-hidden="true">北<br>↑</div></div></div><div class="atlas-legend"><span>图标：地区地标意象</span><span class="jade">亮环：当前所在</span><span>虚线：H5压缩行程</span><span>城镇 / 副本门槛见地点详情</span></div><label for="atlas-place">地点选择 · 无需在小图中寻找</label><select id="atlas-place">${Object.entries(ZONES).map(([id, place]) => `<option value="${id}" ${selected === id ? 'selected' : ''}>${e(place.name)} · ${place.type === 'city' ? '城镇' : `Lv.${place.lv.join('—')}`} ${p.discovered.includes(id) ? '已探索' : ''}</option>`).join('')}</select></section><aside class="atlas-detail"><div class="eyebrow">选中地点</div><h2>${e(z.name)}</h2><p>${e(node?.regionLabel || z.region)}</p><div class="atlas-landmark">${atlasLandmark(selected)}<div><strong>${e(ZONE_LANDMARKS[selected].name)}</strong><p>${e(ZONE_LANDMARKS[selected].description)}</p><small>原创 Q 版意象 · 非官方建筑清单</small></div></div><div class="location-tags"><span class="tag">${z.type === 'city' ? '安全城镇' : '野外'}</span><span class="tag gold">本作 Lv.${z.lv.join('—')}</span><span class="tag ${locked ? '' : 'green'}">${locked ? '尚未解锁' : selected === p.location ? '当前所在地' : p.discovered.includes(selected) ? '已探索' : '未探索'}</span></div><p class="muted">旅行门槛：${Math.max(1, z.lv[0] - 5)}级${z.minCult ? ` · ${cultName(z.minCult, p.path)}` : ''}</p><div class="atlas-route-card"><span class="detail-label">先看路线，再前进一步</span>${selected === p.location ? '<p>你正站在这里。</p>' : route ? `<ol>${route.map((id, index) => `<li class="${index === 0 ? 'current' : ''}">${e(ZONES[id].name)}${index === 1 ? ' · 下一站' : ''}${ATLAS_NODES[id]?.layer !== atlasLayer ? ' · 跨图' : ''}</li>`).join('')}</ol>` : '<p class="notice warning">暂无可通行路线。途经地点也必须满足等级与修真门槛；不会跳过未开放节点。</p>'}${btn('沿路线前进一站', 'atlasStep', `data-id="${selected}"`, 'primary wide', game.busy || !route || route.length < 2)}</div>${z.type === 'city' && p.discovered.includes(selected) && selected !== p.location && ZONES[p.location].type === 'city' ? btn(`城镇传送 · ${num(20 + p.lv * 3)}金币`, 'travel', `data-id="${selected}" data-teleport="true"`, 'ghost wide', game.busy || locked || p.gold < 20 + p.lv * 3) : ''}<h3>副本入口 / 接引</h3>${entrances.length ? entrances.map((d) => `<div class="atlas-dungeon"><strong>${e(d.name)}</strong><small>本作${d.lv}级 · ${d.rewardKind === 'materials' ? '材料，不掉成品' : '成品装备历练'}</small>${btn('查看门槛与奖励', 'dungeonDetail', `data-id="${d.id}"`, 'ghost small')}</div>`).join('') : '<p class="muted">此节点没有登记副本入口。</p>'}<details><summary>地点依据与坐标边界</summary><p class="muted">${node?.evidence === 'official' ? '地名 / 参照有官方资料支持' : node?.evidence === 'secondary' ? '参照来自二级攻略' : '本作适配节点，精确连接未核实'}；图上位置均为避让示意。</p>${node?.anchor ? `<p>${e(node.anchor.npc)}：${node.anchor.x}，${node.anchor.y}。不是城市中心，也不是此图的投影坐标。</p>` : ''}</details></aside></div><details class="atlas-sources"><summary>地图资料与改编边界 · 非官方美术</summary><p>${e(ATLAS_ADAPTATION)}</p><p>地图由代码绘制地形提示；道路均为H5压缩行程。副本「接引」不等于核实了端游物理入口。</p><ul>${ATLAS_SOURCES.map((source) => `<li><a href="${e(source.url)}" target="_blank" rel="noopener">${e(source.title)}</a></li>`).join('')}</ul></details>`;
}
function centerAtlasSelection() {
  const scroll = $('#modal .atlas-scroll'); const marker = $('#modal .atlas-node.selected');
  if (scroll && marker) scroll.scrollTo({ left: marker.offsetLeft - scroll.clientWidth / 2, top: marker.offsetTop - scroll.clientHeight / 2 });
}
function refreshAtlas() {
  const scroll = $('#modal .atlas-scroll'); const left = scroll?.scrollLeft || 0; const top = scroll?.scrollTop || 0;
  const focusId = document.activeElement?.dataset.id; const focusAction = document.activeElement?.dataset.action;
  $('#modal .modal-body').innerHTML = atlasContents();
  $('#modal .atlas-scroll')?.scrollTo(left, top);
  if (focusAction && focusId) [...$('#modal').querySelectorAll('[data-action]')].find((b) => b.dataset.action === focusAction && b.dataset.id === focusId)?.focus({ preventScroll: true });
  applyPending();
}
function mapModal() {
  atlasSelection = game.p.location; atlasLayer = ATLAS_NODES[game.p.location]?.layer || 'mainland';
  showModal('天下地图 · 山海行旅', atlasContents());
  $('#modal .modal-card').classList.add('atlas-modal');
  centerAtlasSelection();
}
async function importFile(file) {
  if (!file || pending) return;
  stopAuto();
  try {
    if (file.size > 1024 * 1024) throw new Error('存档不能超过1MB。');
    const snapshot = JSON.parse(await file.text());
    const preview = validateSave(snapshot);
    if (!preview.player) throw new Error('导入存档必须包含角色。');
    showModal('导入存档', `<p>将恢复 <strong>${e(preview.player.name)}</strong> · ${CLASSES[preview.player.cls].name} · Lv.${preview.player.lv}。</p><p class="notice warning">这会覆盖当前本地进度。此刻仅预览，未写入；建议先导出备份。</p>`, '确认替换', async () => {
      await command('/v1/save/import', { snapshot, confirm: true });
      creating = false; replacementAuthorized = false; page = 'world'; render();
    });
  } catch (err) { toast(err instanceof SyntaxError ? 'JSON格式错误，当前进度未改变。' : errorMessage(err)); }
}
async function initializeUI() {
document.addEventListener('scene-availability', (event) => { sceneAvailability(event.detail.available); updateSceneMovement(getWorldMovement()); });
document.addEventListener('scene-movement', (event) => updateSceneMovement(event.detail));
document.addEventListener('scene-engage', async (event) => {
  if (!game?.p || pending || sceneWalking || loading || page !== 'world' || !$('#modal').classList.contains('hidden')) return;
  const index = sceneRoster().findIndex(m => m.id === event.detail?.id);
  if (index < 0 || game.battle) return;
  try { await hunt(index, true); }
  catch (err) { toast(errorMessage(err)); render(); }
});
document.addEventListener('scene-target', (event) => {
  if (pending || loading || page !== 'world' || !$('#modal').classList.contains('hidden')) return;
  const id = event.detail?.id;
  if (game.battle) { if (!game.battle.monsters.some((m) => m.id === id && m.hp > 0)) return; target = id; }
  else { const index = sceneRoster().findIndex((m) => m.id === id); if (index < 0) return; fieldSelection = { location: game.p.location, index }; }
  render(); $('#world-scene-host canvas')?.focus({ preventScroll: true });
});
document.addEventListener('input', (event) => {
  if (event.target.id === 'char-name') charName = event.target.value;
  if (event.target.id === 'codex-search') { codexSearch = event.target.value; updateCodexResults(); }
  if (event.target.id === 'official-search') { officialFilter.search = event.target.value; officialFilter.page = 1; updateOfficialResults(); }
  if (['catalog-min-level', 'catalog-max-level'].includes(event.target.id)) {
    const key = event.target.id === 'catalog-min-level' ? 'minLv' : 'maxLv';
    catalogFilter[key] = event.target.validity.badInput ? 'invalid' : event.target.value;
    catalogFilter.page = 1;
    updateEquipmentCatalogResults();
  }
});
document.addEventListener('change', (event) => {
  const { id, value } = event.target;
  if (id === 'codex-category') { codexCategory = value; updateCodexResults(); }
  if (id.startsWith('official-') && id !== 'official-search') {
    const key = id.slice(9);
    if (Object.hasOwn(officialFilter, key)) { officialFilter[key] = key === 'includeUnknown' ? event.target.checked : event.target.validity?.badInput ? 'invalid' : value; officialFilter.page = 1; updateOfficialResults(); }
  }
  if (id === 'atlas-place') { atlasSelection = value; atlasLayer = ATLAS_NODES[value]?.layer || 'mainland'; refreshAtlas(); centerAtlasSelection(); $('#modal .atlas-detail h2')?.scrollIntoView({ block: 'nearest' }); }
  if (id.startsWith('catalog-')) {
    const keys = { 'catalog-class': 'cls', 'catalog-min-level': 'minLv', 'catalog-max-level': 'maxLv', 'catalog-slot': 'slot', 'catalog-type': 'type', 'catalog-grade': 'grade', 'catalog-sort': 'sort' };
    const key = keys[id];
    const next = event.target.validity?.badInput ? 'invalid' : value;
    if (key && catalogFilter[key] !== next) {
      catalogFilter[key] = next;
      catalogFilter.page = 1;
      updateEquipmentCatalogResults();
    }
  }
  if (['production-series', 'forge-slot', 'production-recipe', 'production-predecessor', 'production-inherit'].includes(id)) {
    productionFilter.recipeId = $('#production-recipe')?.value || '';
    if (id === 'production-series') { productionFilter.series = value; productionFilter.recipeId = ''; productionFilter.uid = ''; productionFilter.inherit = false; }
    if (id === 'forge-slot') { productionFilter.slot = value; productionFilter.recipeId = ''; productionFilter.uid = ''; productionFilter.inherit = false; }
    if (id === 'production-recipe') { productionFilter.recipeId = value; productionFilter.uid = ''; productionFilter.inherit = false; }
    if (id === 'production-predecessor') productionFilter.uid = value;
    if (id === 'production-inherit') productionFilter.inherit = event.target.checked;
    render(); document.getElementById(id)?.focus({ preventScroll: true });
  }
  if (id === 'refine-aid') { refineAid = value; render(); $('#refine-aid')?.focus({ preventScroll: true }); }
  if (id === 'equipment-target-slot') { equipmentModal(event.target.dataset.uid, value); $('#equipment-target-slot')?.focus({ preventScroll: true }); }
  if (['transfer-from', 'transfer-to'].includes(id)) { transferModal($('#transfer-from').value, id === 'transfer-from' ? '' : $('#transfer-to').value); document.getElementById(id)?.focus({ preventScroll: true }); }
});
document.addEventListener('submit', async (event) => {
  if (event.target.id !== 'create-form') return;
  event.preventDefault();
  if (pending || loading) return;
  const name = charName.trim(); const selectedClass = cls;
  const perform = async () => {
    if (game.p && !replacementAuthorized) throw new Error('请先通过原有「重新创建角色」确认替换角色。');
    await command('/v1/character', { name, cls: selectedClass, ...(replacementAuthorized ? { confirm: true } : {}) });
    creating = false; replacementAuthorized = false; page = 'world'; render();
  };
  try {
    if (loadError) showModal('重建角色', '<p>原始存档将被覆盖，建议先备份。只有点击确认才提交重建。</p>', '确认重建', async () => { replacementAuthorized = true; await perform(); });
    else await perform();
  } catch (err) { toast(errorMessage(err)); render(); }
});
async function performEquipment(button) {
  const { id: uid, op } = button.dataset;
  let body = { uid };
  if (op === 'socket') body.gemId = $('#socket-gem').value;
  if (op === 'unsocket') body.index = Number(button.dataset.index);
  if (['bind', 'decompose'].includes(op)) {
    const equipment = [...Object.values(game.p.equipment), ...game.p.bag].find((entry) => entry.uid === uid);
    if (!equipment) throw new Error('装备已不存在。');
    showModal(op === 'bind' ? '二次确认 · 永久绑定' : '二次确认 · 分解装备', `<p><strong>${equipmentName(equipment.name, equipment.q)}</strong> · Lv.${equipment.lv} · ${gradeLabel(equipment.grade)} · ${e(equipmentLabel(equipment))}</p><p class="notice warning">${op === 'bind' ? '绑定不可撤销，绑定后不能出售或分解。' : '分解不可撤销，装备从行囊移除；镶嵌宝石返还。'}请确认是你要处理的装备。</p>`, op === 'bind' ? '确认永久绑定' : '确认分解', async () => { await command(`/v1/equipment/${op}`, { uid, confirm: true }); });
    return;
  }
  await command(`/v1/equipment/${op}`, body);
  equipmentModal(uid);
}
function releaseSceneDirection() {
  const pointer = directionPointer; directionPointer = null;
  if (!pointer) return;
  moveWorldDirection(pointer.direction, false);
  if (pointer.button.hasPointerCapture(pointer.id)) pointer.button.releasePointerCapture(pointer.id);
}
document.addEventListener('pointerdown', (event) => {
  const button = event.target.closest('[data-direction]');
  if (!button || button.disabled || !event.isPrimary || event.button !== 0 || pending || loading || !$('#modal').classList.contains('hidden')) return;
  event.preventDefault(); releaseSceneDirection();
  if (!moveWorldDirection(button.dataset.direction, true)) return;
  directionPointer = { id: event.pointerId, direction: button.dataset.direction, button };
  button.setPointerCapture(event.pointerId);
});
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) document.addEventListener(type, event => {
  if (directionPointer?.id === event.pointerId) releaseSceneDirection();
});
document.addEventListener('keydown', event => {
  const button = event.target.closest('[data-direction]');
  if (!button || button.disabled || pending || ![' ', 'Enter'].includes(event.key)) return;
  event.preventDefault(); moveWorldDirection(button.dataset.direction, true);
});
document.addEventListener('keyup', event => {
  const button = event.target.closest('[data-direction]');
  if (button && [' ', 'Enter'].includes(event.key)) { event.preventDefault(); moveWorldDirection(button.dataset.direction, false); }
});
document.addEventListener('focusout', event => {
  const button = event.target.closest('[data-direction]');
  if (button) moveWorldDirection(button.dataset.direction, false);
});
document.addEventListener('click', async (event) => {
  const b = event.target.closest('[data-action]'); if (!b || b.disabled || pending || loading || sceneWalking && !b.hasAttribute('data-walk-control')) return;
  if (!$('#modal').classList.contains('hidden') && !b.closest('#modal')) return;
  const { action, id } = b.dataset;
  try {
    if (action === 'closeModal') { closeModal(); return; }
    if (action === 'confirmModal') { const cb = modalConfirm; closeModal(); await cb?.(); return; }
    if (action === 'retryLoad') { stopAuto(); closeModal(); await openBackend(); return; }
    if (action === 'race') { race = id; cls = RACES[id].classes[0]; }
    else if (action === 'class') cls = id;
    else if (action === 'cancelCreate') { creating = false; replacementAuthorized = false; }
    else if (action === 'page') { if (id !== 'world') stopAuto(); page = id; await readEconomy(); }
    else if (action === 'catalogGo') {
      stopAuto(); closeModal(); page = b.dataset.page;
      if (page === 'bag' && b.dataset.tab) bagTab = b.dataset.tab;
      if (page === 'town' && b.dataset.tab) townTab = b.dataset.tab;
      if (page === 'mall' && b.dataset.tab) mallTab = b.dataset.tab;
      await readEconomy(); render();
      if (page === 'bag' && bagTab === 'arsenal') $('.bag-tabs')?.scrollIntoView({ block: 'start', behavior: 'instant' });
      if (b.dataset.product) mallDetail(b.dataset.product);
      return;
    }
    else if (action === 'catalogGems') { codexCategory = 'gems'; codexSearch = ''; bagTab = 'catalog'; }
    else if (action === 'officialDetail') { officialDetail(id); return; }
    else if (action === 'officialPage') { officialFilter.page = Number(b.dataset.page); updateOfficialResults(); return; }
    else if (action === 'skillDetail') { skillDetail(id); return; }
    else if (action === 'catalogEquipmentDetail') { catalogEquipmentDetail(id); return; }
    else if (action === 'catalogEquipmentPage') { catalogFilter.page = Number(b.dataset.page); updateEquipmentCatalogResults('page'); return; }
    else if (action === 'catalogEquipmentJump') {
      catalogFilter.page = $('#catalog-page-jump')?.validity.badInput ? NaN : Number($('#catalog-page-jump')?.value);
      updateEquipmentCatalogResults('jump'); return;
    }
    else if (action === 'itemDetail') { itemDetail(id); return; }
    else if (action === 'bagTab') { bagTab = id; if (id === 'items') await readEconomy('bag'); }
    else if (action === 'townTab') townTab = id;
    else if (action === 'mallTab') mallTab = id;
    else if (action === 'mallDetail') { mallDetail(id); return; }
    else if (action === 'walletDetail') { walletDetail(); return; }
    else if (action === 'bagOpenables') { stopAuto(); closeModal(); page = 'bag'; bagTab = 'items'; await readEconomy(); render(); $('#owned-items')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    else if (action === 'retryEconomy') await readEconomy(id);
    else if (action === 'dungeonTab') { stopAuto(); page = 'town'; townTab = 'dungeon'; }
    else if (action === 'target') { if (game.battle?.monsters.some((m) => m.id === id && m.hp > 0)) target = id; }
    else if (action === 'fieldTarget') fieldSelection = { location: game.p.location, index: Number(b.dataset.index) };
    else if (action === 'sceneStop') { stopWorldMovement(); return; }
    else if (action === 'sceneOverview') { toggleWorldOverview(); updateSceneMovement(getWorldMovement()); return; }
    else if (action === 'sceneDirection') return;
    else if (action === 'sceneApproach') {
      if (!sceneAvailable || !getWorldMovement()?.enabled) return;
      sceneWalking = true; applyPending(); $('#world-scene-host canvas')?.focus({ preventScroll: true });
      try { if (!await approachWorldTarget(`field-${fieldIndex()}`)) toast('未靠近目标，未开始战斗。'); }
      finally { sceneWalking = false; applyPending(); updateSceneMovement(getWorldMovement()); }
      return;
    }
    else if (action === 'sceneEngage') await hunt(fieldIndex(), true);
    else if (action === 'hunt') await hunt(Number(b.dataset.index));
    else if (action === 'explore') { const r = await command('/v1/world/explore'); lastExplore = r.result; page = 'world'; }
    else if (action === 'autoExplore') { if (exploring) stopAuto(); else { exploring = true; auto = true; explorePause = 0; } }
    else if (action === 'encounter') { const r = await command('/v1/world/encounter', { choice: id }); lastExplore = r.result; }
    else if (action === 'turn') { await command('/v1/battle/turn', { action: id, ...(target ? { targetId: target } : {}) }); if (!game.busy) stopAuto(); }
    else if (action === 'auto') { if (auto) stopAuto(); else auto = true; }
    else if (action === 'leaveBattle') { stopAuto(); await command('/v1/battle/leave'); }
    else if (action === 'nextWave') await command('/v1/dungeons/next');
    else if (action === 'travel') {
      stopAuto();
      if (b.dataset.teleport === 'true') {
        const cost = 20 + game.p.lv * 3;
        showModal('确认付费城镇传送', `<p>${e(ZONES[game.p.location].name)} → ${e(ZONES[id].name)}</p><p class="notice warning">实际扣除${num(cost)}金币。仅限已探索城镇之间的本作传送服务；不是地图点击免费快传。</p>`, '确认支付并传送', async () => { await command('/v1/world/travel', { id, teleport: true }); page = 'world'; render(); mapModal(); }); return;
      }
      await command('/v1/world/travel', { id }); page = 'world'; closeModal();
    }
    else if (action === 'navigate') { stopAuto(); await navigateToward(id); closeModal(); }
    else if (action === 'map') { mapModal(); return; }
    else if (action === 'mapSelect') { atlasSelection = id; refreshAtlas(); centerAtlasSelection(); if (window.innerWidth <= 760) $('#modal .atlas-detail')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
    else if (action === 'atlasLayer') { atlasLayer = id; refreshAtlas(); return; }
    else if (action === 'atlasZoom') { atlasZoom = Math.max(1, Math.min(2, atlasZoom + Number(b.dataset.delta))); refreshAtlas(); return; }
    else if (action === 'atlasStep') { stopAuto(); await navigateToward(id); refreshAtlas(); return; }
    else if (action === 'sourceRoute') { mapModal(); atlasSelection = id; atlasLayer = ATLAS_NODES[id]?.layer || 'mainland'; refreshAtlas(); return; }
    else if (action === 'materialSource') { productionSource(id); return; }
    else if (action === 'productionGo') { openProduction(id); return; }
    else if (action === 'produceConfirm') { produceConfirm(id, b.dataset.uid, b.dataset.inherit === 'true'); return; }
    else if (action === 'productionTrain') {
      const skill = getProductionCatalog(game.p).skills[id];
      if (!skill?.canTrain || game.busy) throw new Error('生产技能训练门槛未满足。');
      showModal('确认生产技能训练', `<p>${e(skill.name)} ${skill.level}级 → ${skill.next.level}级</p><p class="notice warning">扣除${num(skill.next.gold)}金币，当前制造经验${num(skill.exp)}归零。等级与经验门槛是本作适配。</p>`, '确认支付并训练', async () => { await command('/v1/equipment/train', { skill: id }); }); return;
    }
    else if (action === 'machineConfirm') {
      const machine = getProductionCatalog(game.p).machine;
      if (!machine.available || game.busy) throw new Error('千机材加工资源 / 城镇条件未满足。');
      showModal('确认加工千机材', `<p>加工得到千机材×1；费用为本作适配，不增加装备制造经验。</p><p>${num(machine.gold)}金币</p>${materialTable(machine.materials, false)}`, '确认扣料加工', async () => { await command('/v1/equipment/machine'); }); return;
    }
    else if (action === 'transferOpen') { transferModal(); return; }
    else if (action === 'transferConfirm') {
      const { from: fromUid, to: toUid } = b.dataset;
      const owned = [...Object.values(game.p.equipment), ...game.p.bag];
      const source = owned.find((it) => it.uid === fromUid); const dest = owned.find((it) => it.uid === toUid);
      if (!source || !dest || source.uid === dest.uid || source.refine <= dest.refine || (source.bound && !dest.bound)) throw new Error('源与目标或绑定条件不符。');
      const cost = QIANKUN_TRANSFER_COSTS[source.refine];
      showModal('二次确认 · 覆盖精炼', `<p>${equipmentName(source.name, source.q)} +${source.refine} → +0</p><p>${equipmentName(dest.name, dest.q)} +${dest.refine} → +${source.refine}</p><p class="notice warning">${equipmentName(materialName('qiankun'))}×${num(cost)}，金币0。源清零、目标覆盖而不是叠加；目标原精炼不返还，不改变宝石和绑定，提交后不可撤销。</p>`, '确认转移并覆盖', async () => { await command('/v1/equipment/transfer', { fromUid, toUid, confirm: true }); }); return;
    }
    else if (action === 'dungeonDetail') { dungeonDetail(id); return; }
    else if (action === 'dungeonRoute') { dungeonRoute(id); return; }
    else if (action === 'gather') {
      stopAuto();
      const response = await command('/v1/world/gather', { resource: id });
      const actual = response.result;
      gatherReadyAt = (game.p.lastGatherAt || Date.now()) + 2000;
      gatherFeedback = actual?.id ? `实际采集：${materialName(actual.id)}×${actual.quantity}。2秒后可再次采集。` : '采集已提交，请查看实际材料持有数；2秒后可再次采集。';
      render();
      return;
    }
    else if (action === 'allocateAuto') await command('/v1/character/attributes/recommended');
    else if (action === 'allocate') await command('/v1/character/attributes', { key: id, quantity: Number(b.dataset.qty) });
    else if (action === 'rest') await command('/v1/world/rest');
    else if (action === 'claim') await command('/v1/quests/claim', { bounty: b.dataset.bounty === 'true' });
    else if (action === 'bounty') await command('/v1/quests/bounty');
    else if (action === 'equip') { await command('/v1/equipment/equip', { uid: id, ...(b.dataset.slot ? { slot: b.dataset.slot } : {}) }); closeModal(); }
    else if (action === 'unequip') { await command('/v1/equipment/unequip', { slot: id }); closeModal(); }
    else if (action === 'sell') await command('/v1/equipment/sell', { uid: id });
    else if (action === 'sellCommonConfirm') { showModal('出售普通装备', '<p>仅出售行囊中普通、未精炼、未绑定且没有镶嵌孔记录的装备。穿戴装备与高品质装备不会出售。</p>', '确认出售', async () => { await command('/v1/equipment/sell-common', { confirm: true }); }); return; }
    else if (action === 'useItem') { await command('/v1/items/use', { id }); if (b.closest('#modal')) closeModal(); }
    else if (action === 'buy') await command('/v1/shop/potions/buy', { id, quantity: Number(b.dataset.qty) });
    else if (action === 'buyEquip') await command('/v1/shop/equipment/buy', { templateId: id });
    else if (action === 'learn') await command('/v1/skills/learn', { id });
    else if (action === 'highForgeTab') { stopAuto(); closeModal(); page = 'town'; townTab = 'high'; }
    else if (action === 'highDetail') {
      const template = HIGH_EQUIPMENT[id]; if (!template) throw new Error('神铸模板未就绪。');
      const recipe = HIGH_RECIPES[id];
      showModal('神铸藏珍 · 模板规格', `<div class="equipment-detail-art">${highEquipmentArt(id)}</div><h3>${equipmentName(template.name, 4)}</h3>${highDetails(template)}<div class="item-stats">${Object.entries(Object.entries(template.addons).reduce((values, [key, value]) => ({ ...values, [key]: (values[key] || 0) + value }), { ...template.base })).map(([key, value]) => `<span>${e(STAT_NAMES[key] || key)} +${statValue(key, value, true)}</span>`).join('')}</div>${recipe ? `<p class="notice">本作配方：${highCost(recipe)}${recipe.from ? `<br>前阶：${equipmentName(HIGH_EQUIPMENT[recipe.from]?.name, 4)}` : '<br>独立根配方'}</p>` : ''}${btn('前往城镇神铸', 'highForgeTab', '', 'gold-button')}`); return;
    }
    else if (action === 'highCraft') { highConfirm(id); return; }
    else if (action === 'highAscend') {
      const equipment = [...Object.values(game.p.equipment), ...game.p.bag].find((it) => it.uid === id);
      const next = nextHighRecipe(equipment?.templateId);
      if (!next) throw new Error('此模板没有下一阶。');
      highConfirm(next[0], id); return;
    }
    else if (action === 'equipmentDetail') { equipmentModal(id); return; }
    else if (action === 'equipmentAction') { await performEquipment(b); return; }
    else if (action === 'equipped') { const it = game.p.equipment[id]; if (it) equipmentModal(it.uid); else showModal(slotName(id), `<p class="notice">此栏位尚未装备。${id === 'ring2' ? '戒指道具可放副戒栏，不需要专用副戒物品。' : '已有的装备在行囊中穿戴；也可在城镇购买、打造或通过战斗与任务获得。'}</p><div class="form-row">${btn('查看行囊装备', 'catalogGo', 'data-page="bag" data-tab="equipment"', 'primary')}${btn('前往装备商', 'catalogGo', 'data-page="town" data-tab="equipment"', 'ghost')}${btn('查看装备体系', 'catalogGo', 'data-page="bag" data-tab="arsenal"', 'ghost')}</div>`); return; }
    else if (action === 'refineConfirm') {
      const aid = $('#refine-aid').value; const it = game.p.equipment[id]; const plan = refinePlan(it, aid);
      showModal('确认精炼 · 本次实际规则', `<p>${equipmentName(it.name, it.q)} +${it.refine} → +${it.refine + 1}</p><p>成功率：${percent(plan.rate)} · 辅助：${aid ? equipmentName(materialName(aid)) : '无'}</p><p>实际扣除：${num(plan.cost)}金币 + 幻仙石×${plan.stones}${aid ? ` + ${equipmentName(materialName(aid))}×1` : ''}</p><p>下一次满耐久增量：</p>${rawStats(refineDelta(it))}<p class="notice warning">${aid === 'dragonOrb1' ? '一星龙珠只保证此次目标+1成功；不跳级，不可用于更高精炼。' : `失败后精炼为+${plan.failLevel}（现为+${it.refine}），材料与金币仍会消耗。`}成功率加成、基础成本和属性增益为本作适配；乾坤不是概率翻倍石。</p>`, '确认扣费精炼', async () => { await command('/v1/equipment/refine', { slot: id, aid }); }); return;
    }
    else if (action === 'forge') { produceConfirm($('#production-recipe').value, $('#production-predecessor')?.value || '', $('#production-inherit')?.checked || false); return; }
    else if (action === 'dungeon') { closeModal(); stopAuto(); await command('/v1/dungeons/enter', { id }); page = 'world'; }
    else if (action === 'trial') { await command('/v1/cultivation/trial'); page = 'world'; }
    else if (action === 'breakthrough') {
      const next = CULTIVATION[game.p.cult + 1];
      if (next?.path && !game.p.path) { showModal('仙魔一念', `<div class="path-options"><button class="path-card" data-action="choosePath" data-id="sage"><h3>升仙</h3><p>生命与双防，守护众生。</p></button><button class="path-card" data-action="choosePath" data-id="demon"><h3>入魔</h3><p>攻击与暴击，唯力是从。</p></button></div><p class="notice warning">选择不可逆。点击分支后还会要求确认。</p>`); return; }
      await command('/v1/cultivation/breakthrough');
    }
    else if (action === 'choosePath') { showModal('确认道途', `<p>确定${id === 'sage' ? '升仙' : '入魔'}？本作不支持仙魔转换。</p>`, '确认突破', async () => { await command('/v1/cultivation/breakthrough', { path: id }); }); return; }
    else if (action === 'sign') await command('/v1/daily/sign');
    else if (action === 'cards') await command('/v1/daily/cards');
    else if (action === 'arena') { await command('/v1/arena/enter'); page = 'world'; }
    else if (action === 'mallBuy') {
      const box = ACTIVITY_POOLS[id];
      closeModal();
      const response = await command('/v1/mall/buy', { productId: id, quantity: Number(b.dataset.qty) });
      actualResultModal(response.result, '选购成功 · 已收入囊中', box ? id : '');
    }
    else if (action === 'walletExchange') { closeModal(); await command('/v1/wallet/exchange', { quantity: Number(b.dataset.qty) }); walletDetail(); }
    else if (action === 'walletDaily') { closeModal(); await command('/v1/wallet/daily'); walletDetail(); }
    else if (action === 'treasureDraw' || action === 'activityOpen') {
      closeModal();
      const response = await command(action === 'treasureDraw' ? '/v1/treasure/draw' : '/v1/activities/open', action === 'treasureDraw' ? { count: Number(b.dataset.count) } : { itemId: id, count: Number(b.dataset.count) });
      actualResultModal(response.result, action === 'treasureDraw' ? '鸿运揭晓 · 实际获得' : '包裹物品已开启 · 实际获得');
    }
    else if (action === 'activityClaim') { const response = await command('/v1/activities/claim', { milestoneId: id }); actualResultModal(response.result, '奖励已领取'); }
    else if (action === 'cosmeticEquip') await command('/v1/cosmetics/equip', { cosmeticId: id, slot: b.dataset.slot });
    else if (action === 'cosmeticUnequip') await command('/v1/cosmetics/equip', { cosmeticId: null, slot: b.dataset.slot });
    else if (action === 'charmEquip') await command('/v1/charms/equip', { itemId: id, count: Number(b.dataset.count) });
    else if (action === 'save') await command('/v1/save');
    else if (action === 'export' || action === 'backupRaw') {
      stopAuto();
      const response = await api.request('GET', action === 'export' ? '/v1/save/export' : '/v1/save/backup');
      download(typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2), action === 'export' ? 'perfect-text-save.json' : 'perfect-text-raw-backup.json');
      toast(action === 'export' ? '含战斗的存档备份已下载。' : '原始备份已下载，未经预览校验改写。');
    }
    else if (action === 'importPicker') {
      stopAuto(); if (game.busy) throw new Error('请结束战斗后导入。');
      const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json';
      input.addEventListener('change', async () => { await importFile(input.files[0]); }); input.click(); return;
    }
    else if (action === 'newConfirm') { showModal('重新启程', '<p>创建新角色会替换当前角色与进度。建议先导出存档。选择期间可返回原角色。</p>', '开始创建', async () => { stopAuto(); replacementAuthorized = true; creating = true; render(); }); return; }
    render();
    if (page === 'bag' && bagTab === 'arsenal' && ['bagTab', 'page'].includes(action)) $('.bag-tabs')?.scrollIntoView({ block: 'start', behavior: 'instant' });
  } catch (err) { stopAuto(); toast(errorMessage(err)); render(); }
});
document.addEventListener('keydown', (event) => {
  if (!$('#modal').classList.contains('hidden')) {
    if (event.key === 'Escape' && !pending) closeModal();
    if (event.key === 'Tab') { const list = [...$('#modal').querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), a, summary, [tabindex="0"]')]; const first = list[0]; const last = list.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); } }
  }
});
document.addEventListener('visibilitychange', async () => {
  if (document.hidden) { stopAuto(); releaseSceneDirection(); stopWorldMovement(); }
  else if (game && !loading) { await readEconomy(); render(); }
});
window.addEventListener('blur', () => { releaseSceneDirection(); stopWorldMovement(); });
window.addEventListener('beforeunload', () => { stopAuto(); });
let autoTickPending = false;
function exploreStopReason() {
  const p = game.p;
  if (p.encounter) return '遇到奇遇，请做出选择。';
  if (ZONES[p.location].type !== 'field') return '已离开野外，自动探索结束。';
  if (p.hp < stats(p).hp * 0.4) return '生命低于四成，自动探索已暂停：喝药或回城休息后再继续。';
  if (game.questProgress(game.mainQuest).ready || game.questProgress(p.bounty, true).ready) return '任务目标已达成，自动探索暂停，去领取奖励吧。';
  if (p.bag.length >= BAG_LIMIT) return '行囊已满，自动探索暂停。';
  return '';
}
setInterval(async () => {
  if (autoTickPending || pending || sceneWalking || loading || document.hidden || page !== 'world' || !game?.p || !auto) return;
  if (!exploring && !game.busy) return;
  if (Date.now() < explorePause) return;
  autoTickPending = true;
  try {
    if (game.busy) {
      await command('/v1/battle/auto');
      const result = game.battle?.result;
      if (result && (!exploring || result !== 'win')) stopAuto();
      else if (result) explorePause = Date.now() + 1600;
    } else {
      const reason = exploreStopReason();
      if (reason) { stopAuto(); toast(reason); }
      else {
        const r = await command('/v1/world/explore'); lastExplore = r.result;
        if (game.p.encounter) { stopAuto(); toast('遇到奇遇，请做出选择。'); }
        else if (!game.busy) explorePause = Date.now() + 1300;
      }
    }
    render();
  } catch (err) { stopAuto(); render(); toast(errorMessage(err)); }
  finally { autoTickPending = false; }
}, 650);
await openBackend();
}
if (!uiSession.ready) uiSession.ready = initializeUI();
