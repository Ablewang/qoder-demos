import type { Action, ClassId, Control, Dispatch, GameState, Item, Panel, Player, Point, SkillDef, Slot, StatKey, WorldObject } from './types';
import { CLASSES, SKILLS, EXPERIENCE, getClass, getSkill } from './catalog';
import { skillLevel, skillEffect } from './rules';
import { getBase, itemLabel, describeItem, RUNES, GEMS, RUNEWORDS } from './items';
import { AREAS, QUESTS, NPCS, hasLineOfSight, questKey } from './world';
import type { Renderer } from './renderer3d';
import { monsterSpec } from './r3d/rigs';
import { artUrl, heroArtKey, itemArtKey } from './art';
import { CATALOG_CATEGORIES, EQUIPMENT_CATALOG, searchEquipment } from './equipment-catalog';
import type { CatalogKind } from './equipment-catalog';

const NS = 'http://www.w3.org/2000/svg';
const SLOT_NAMES: Record<Slot, string> = { head: '头盔', neck: '项链', body: '护甲', weapon: '主手', offhand: '副手', gloves: '手套', belt: '腰带', boots: '靴子', ring1: '戒指 · 左', ring2: '戒指 · 右', weapon2: '备用主手', offhand2: '备用副手' };
const PANEL_NAMES: Record<Panel, string> = { none: '', inventory: '行囊与装备', character: '角色属性', skills: '技能树', quests: '任务日志', waypoint: '传送点', stash: '私人储物箱', cube: '赫拉迪克方块', vendor: '交易与对话', help: '旅人指南', catalog: '装备图鉴' };
const DIFFICULTY = { normal: '普通', nightmare: '噩梦', hell: '地狱' };
const STAT_NAMES: Record<StatKey, string> = { strength: '力量', dexterity: '敏捷', vitality: '体力', energy: '精力' };
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (className) node.className = className;
  if (text !== undefined) node.textContent = text; return node;
}
function btn(text: string, fn: () => void, className = '', disabled = false): HTMLButtonElement {
  const button = el('button', className, text); button.type = 'button'; button.disabled = disabled; button.addEventListener('click', fn); return button;
}
function svgNode<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag); for (const [k, value] of Object.entries(attrs)) node.setAttribute(k, value); return node;
}
function svgPath(svg: SVGElement, d: string, fill: string, stroke = '#1c231f', width = '1.3') {
  svg.append(svgNode('path', { d, fill, stroke, 'stroke-width': width, 'stroke-linejoin': 'round' }));
}
function lines(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  return String(value ?? '').split('\n');
}
function portrait(id: ClassId): HTMLImageElement {
  const image = el('img', 'portrait-art');
  image.src = artUrl(heroArtKey(id)); image.alt = ''; image.draggable = false;
  return image;
}

function itemSprite(item: Item): HTMLImageElement {
  const image = el('img', `item-sprite${item.ethereal ? ' ethereal-art' : ''}`);
  image.src = artUrl(itemArtKey(item.code)); image.alt = ''; image.draggable = false;
  const type = GEMS.find(gem => gem.code === item.code)?.type;
  const filters: Record<string, string> = { gema: 'hue-rotate(275deg)', gems: 'hue-rotate(220deg)', geme: 'hue-rotate(115deg)', gemd: 'grayscale(1) brightness(1.6)', gemt: 'hue-rotate(50deg) brightness(1.3)' };
  if (type && filters[type]) image.style.filter = `${filters[type]} drop-shadow(0 3px 3px #000)`;
  return image;
}

export class GameUI {
  readonly canvas: HTMLCanvasElement;
  private state: GameState;
  private renderer: Renderer | null = null;
  private readonly abort = new AbortController();
  private readonly screenLayer = el('div', 'screen-layer');
  private readonly hud = el('div', 'game-hud');
  private readonly panelLayer = el('div', 'panel-layer');
  private readonly tooltip = el('div', 'item-tooltip');
  private readonly overlay = el('div', 'modal-layer');
  private readonly messages = el('div', 'message-log');
  private readonly areaNotice = el('div', 'area-notice');
  private areaSignature = '';
  private areaNoticeTime = 0;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  private readonly fields = new Map<string, HTMLElement>();
  private readonly belt = el('div', 'belt-grid');
  private screen = '';
  private titleSignature = '';
  private selectedSaveId: string | null = null;
  private introTimer: ReturnType<typeof setTimeout> | null = null;
  private panelSignature = '';
  private beltSignature = '';
  private messageSignature = '';
  private messageTime = 0;
  private overlaySignature = '';
  private selectedClass: ClassId = 'ama';
  private selectedUid: string | null = null;
  private selectedSkill = 0;
  private skillTree = 0;
  private bindRight = true;
  private questAct = 1;
  private waypointAct = 1;
  private vendorFilter = 'all';
  private tradeInventoryOpen = false;
  private tradeView: 'vendor' | 'inventory' = 'vendor';
  private tradeNpc: string | null = null;
  private previousPanel: Panel = 'none';
  private hotkeys: number[] = [];
  private socketRune = '';
  private catalogKind: CatalogKind = 'base';
  private catalogQuery = '';
  private catalogPage = 0;
  private catalogSelected = '';
  private controlHandler: ((control: Partial<Control>, press?: boolean) => void) | null = null;
  private readonly moveKeys = new Set<string>();
  private pointer: { id: number; buttons: number; suppressLeft: boolean } | null = null;
  private aimClient: Point | null = null;
  private joystick: Point | null = null;
  private joystickNode: HTMLElement | null = null;
  private joystickKnob: HTMLElement | null = null;
  private joystickId: number | null = null;
  private readonly touchHolds = new Map<number, { right: boolean; node: HTMLButtonElement }>();
  private readonly touchKeyHolds = new Set<boolean>();
  private readonly labelMeasure = el('canvas').getContext('2d');
  private inputArea: GameState['area'] = null;
  private inputFocused = true;
  private lootHeld = false;
  private hoveringItem: Item | null = null;

  constructor(private readonly root: HTMLElement, state: GameState, private readonly dispatch: Dispatch) {
    this.state = state;
    this.root.classList.add('game-shell');
    this.canvas = el('canvas', 'world-canvas'); this.canvas.setAttribute('aria-label', '固定 3D 视角游戏场景：WASD 或方向键移动，鼠标瞄准，单击左键攻击、右键施法，按住连续释放；点击设施交互或掉落拾取，营地点击地面移动；H 查看指南'); this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-keyshortcuts', 'W A S D ArrowUp ArrowDown ArrowLeft ArrowRight H');
    this.tooltip.hidden = true; this.tooltip.setAttribute('role', 'tooltip');
    this.messages.setAttribute('role', 'log'); this.messages.setAttribute('aria-live', 'polite');
    this.areaNotice.hidden = true; this.areaNotice.setAttribute('role', 'status'); this.areaNotice.setAttribute('aria-live', 'polite');
    this.areaNotice.addEventListener('animationend', () => { this.areaNotice.hidden = true; }, { signal: this.abort.signal });
    this.root.replaceChildren(this.canvas, this.screenLayer, this.hud, this.messages, this.areaNotice, this.panelLayer, this.overlay, this.tooltip);
    this.buildHUD(); this.installInput();
    this.update(state);
  }

  setRenderer(renderer: Renderer): void { this.renderer = renderer; renderer.resize(); this.updateControl(); }
  setControlHandler(handler: (control: Partial<Control>, press?: boolean) => void): void {
    this.resetControls(); this.controlHandler = handler; this.updateControl();
  }

  private send(action: Action, endTrade = false) {
    if (!endTrade && action.type === 'panel' && action.panel === 'inventory' && this.isTrading()) { this.toggleTradeInventory(); return; }
    if (action.type === 'panel' || action.type === 'pause' || action.type === 'title' || action.type === 'respawn' || action.type === 'travel' || action.type === 'difficulty') this.resetControls();
    this.dispatch(action);
    if (!this.activeGame()) this.resetControls();
  }
  private field(key: string, tag: 'div' | 'span' = 'span', className = '') {
    const node = el(tag, className); this.fields.set(key, node); return node;
  }
  private text(key: string, value: string) { const node = this.fields.get(key); if (node && node.textContent !== value) node.textContent = value; }
  private togglePanel(panel: Panel) { this.send({ type: 'panel', panel: this.state.panel === panel ? 'none' : panel }); }

  private buildHUD() {
    const header = el('header', 'area-header');
    const areaLine = el('div', 'area-line'); areaLine.append(this.field('area', 'div', 'area-title'), this.field('identity', 'span', 'hud-identity'));
    header.append(areaLine, this.field('objective', 'div', 'objective'));
    const utilities = el('nav', 'utilities'); utilities.setAttribute('aria-label', '旅程工具');
    const save = btn('保存', () => this.send({ type: 'save' }), 'small-button save-button');
    const catalog = btn('图鉴', () => this.togglePanel('catalog'), 'small-button catalog-button'); catalog.dataset.panel = 'catalog'; catalog.setAttribute('aria-keyshortcuts', 'L'); catalog.title = '装备图鉴 · L';
    const help = btn('指南', () => this.togglePanel('help'), 'small-button'); help.dataset.panel = 'help'; help.setAttribute('aria-keyshortcuts', 'H'); help.title = '操作与实现边界 · H';
    const pause = btn('暂停', () => this.send({ type: 'pause' }), 'small-button pause-button'); pause.setAttribute('aria-keyshortcuts', 'Escape');
    utilities.append(save, catalog, help, pause);
    const enemy = el('div', 'enemy-hud'); this.fields.set('enemy', enemy);
    enemy.append(this.field('enemy-name', 'div', 'enemy-name'), this.field('enemy-life', 'div', 'enemy-life'), this.field('enemy-mods', 'div', 'enemy-mods'));
    const footer = el('footer', 'bottom-hud');
    const life = this.orb('life', '生命'), mana = this.orb('mana', '法力');
    const leftSkill = btn('', () => { this.bindRight = false; this.togglePanel('skills'); }, 'skill-slot left-skill'); this.fields.set('left-skill', leftSkill);
    const rightSkill = btn('', () => { this.bindRight = true; this.togglePanel('skills'); }, 'skill-slot right-skill'); this.fields.set('right-skill', rightSkill);
    const center = el('div', 'hud-center'), bars = el('div', 'progress-bars');
    const stamina = el('div', 'meter stamina-meter'); stamina.append(this.field('stamina-fill', 'div', 'meter-fill'), this.field('stamina-label', 'span', 'meter-label'));
    const xp = el('div', 'meter xp-meter'); xp.append(this.field('xp-fill', 'div', 'meter-fill'), this.field('xp-label', 'span', 'meter-label')); bars.append(stamina, xp);
    const quick = el('nav', 'quick-panels'); quick.setAttribute('aria-label', '角色面板');
    const entries: [Panel, string, string][] = [['character', '角色', 'C'], ['inventory', '背包', 'I'], ['skills', '技能', 'T'], ['quests', '任务', 'J']];
    for (const [panel, title, key] of entries) {
      const b = btn('', () => this.togglePanel(panel), 'quick-button'); b.append(el('span', '', title), el('kbd', '', key)); b.dataset.panel = panel; b.setAttribute('aria-keyshortcuts', key); quick.append(b);
    }
    const run = btn('行走', () => this.send({ type: 'run' }), 'quick-button run-button'); run.setAttribute('aria-keyshortcuts', 'R'); run.title = '切换行走 / 奔跑 · R';
    const portal = btn('回城', () => this.send({ type: 'portal' }), 'quick-button'); portal.title = '使用回城卷轴';
    const map = btn('地图', () => this.send({ type: 'map' }), 'quick-button map-button'); map.setAttribute('aria-keyshortcuts', 'Tab'); map.title = '探索地图 · Tab';
    quick.append(run, portal, map);
    const combat = el('div', 'hud-combat'); combat.append(leftSkill, this.belt, rightSkill);
    center.append(combat, bars, quick);
    footer.append(life, center, mana);
    const touch = el('div', 'touch-controls');
    const joystick = el('div', 'joystick'); joystick.setAttribute('role', 'group'); joystick.setAttribute('aria-label', '触屏移动摇杆：拖动连续移动，松开停止'); const knob = el('div', 'joystick-knob'); joystick.append(knob);
    this.joystickNode = joystick; this.joystickKnob = knob;
    const touchActions = el('div', 'touch-actions');
    const attack = btn('', () => {}, 'touch-action attack'), cast = btn('', () => {}, 'touch-action cast');
    attack.append(el('span', 'action-label', '攻击'), this.field('touch-attack-skill', 'span', 'action-skill'));
    cast.append(el('span', 'action-label', '施法'), this.field('touch-cast-skill', 'span', 'action-skill'));
    this.fields.set('touch-attack', attack); this.fields.set('touch-cast', cast);
    this.installTouchHold(attack, false); this.installTouchHold(cast, true);
    const interact = btn('', () => this.nearbyInteract(), 'touch-action context-action interact'), loot = btn('', () => this.nearbyLoot(), 'touch-action context-action loot');
    interact.append(el('span', 'action-label', '交互'), this.field('interact-target', 'span', 'target-name'));
    loot.append(el('span', 'action-label', '拾取'), this.field('loot-target', 'span', 'target-name'));
    this.fields.set('touch-interact', interact); this.fields.set('touch-loot', loot);
    touchActions.append(attack, cast, interact, loot);
    touch.append(joystick, touchActions);
    const options = { signal: this.abort.signal };
    joystick.addEventListener('pointerdown', e => {
      if (!this.activeGame() || e.button !== 0 || this.joystickId !== null) return;
      e.preventDefault(); this.joystickId = e.pointerId; joystick.setPointerCapture(e.pointerId); this.updateJoystick(e, joystick, knob);
    }, options);
    joystick.addEventListener('pointermove', e => { if (this.joystickId === e.pointerId) this.updateJoystick(e, joystick, knob); }, options);
    joystick.addEventListener('pointerup', e => {
      if (this.joystickId !== e.pointerId) return;
      this.joystickId = null; this.joystick = null; knob.style.transform = ''; this.updateControl();
      if (joystick.hasPointerCapture(e.pointerId)) joystick.releasePointerCapture(e.pointerId);
    }, options);
    const cancel = (e: PointerEvent) => { if (this.joystickId === e.pointerId) this.resetControls(); };
    joystick.addEventListener('pointercancel', cancel, options); joystick.addEventListener('lostpointercapture', cancel, options);
    this.hud.append(header, utilities, enemy, footer, touch);
  }

  private orb(kind: 'life' | 'mana', name: string) {
    const wrap = el('div', `orb-wrap ${kind}-wrap`), orb = el('div', `orb ${kind}-orb`);
    orb.setAttribute('role', 'meter'); orb.setAttribute('aria-label', name); this.fields.set(`${kind}-orb`, orb);
    orb.append(this.field(`${kind}-fill`, 'div', 'orb-liquid'), el('div', 'orb-reflection'), this.field(`${kind}-value`, 'div', 'orb-value'));
    const shortcut = kind === 'life' ? 'Q' : 'F'; orb.setAttribute('aria-keyshortcuts', shortcut); orb.setAttribute('aria-valuemin', '0');
    wrap.append(orb, el('span', 'orb-caption', `${name} · ${shortcut}`)); return wrap;
  }

  update(state: GameState): void {
    this.state = state;
    if (this.isTrading()) {
      if (this.previousPanel !== 'vendor' || this.tradeNpc !== state.npc) { this.tradeInventoryOpen = true; this.tradeView = 'vendor'; this.vendorFilter = 'all'; this.selectedUid = null; }
      this.tradeNpc = state.npc;
    } else { this.tradeInventoryOpen = false; this.tradeView = 'vendor'; this.tradeNpc = null; }
    if (this.inputArea !== state.area || !this.activeGame()) this.resetControls();
    this.inputArea = state.area;
    if (state.panel === 'waypoint' && this.previousPanel !== 'waypoint') this.waypointAct = state.area?.def.act ?? 1;
    this.previousPanel = state.panel;
    const changed = this.screen !== state.screen;
    if (changed) {
      if (this.introTimer) { clearTimeout(this.introTimer); this.introTimer = null; }
      this.screen = state.screen; this.panelSignature = ''; this.titleSignature = ''; this.screenLayer.replaceChildren(); this.hideTooltip();
      this.resetControls();
      if (state.screen === 'intro') this.buildIntro();
      if (state.screen === 'creation') this.buildCreation();
      if (state.screen === 'game') { this.selectedUid = null; this.hotkeys = []; this.skillTree = 0; this.selectedSkill = 0; this.questAct = 1; this.vendorFilter = 'all'; this.areaSignature = ''; }
    }
    this.updateControl();
    if (state.screen === 'title') {
      const signature = JSON.stringify([state.characters, state.storageStatus, state.storageError, state.loadingSave, this.selectedSaveId]);
      if (this.titleSignature !== signature) { this.titleSignature = signature; this.buildTitle(); }
    }
    const game = state.screen === 'game' && !!state.player;
    this.hud.hidden = !game; this.messages.hidden = !game; this.panelLayer.hidden = !game;
    if (!game) this.areaNotice.hidden = true;
    this.screenLayer.hidden = game;
    this.root.classList.toggle('has-panel', game && state.panel !== 'none'); this.root.classList.toggle('is-paused', game && state.paused);
    if (!game || !state.player || !state.stats || !state.area) { this.overlay.hidden = true; return; }
    const p = state.player, stats = state.stats;
    const areaSignature = `${p.difficulty}:${state.area.def.id}`;
    if (this.areaSignature !== areaSignature) {
      this.areaSignature = areaSignature; this.areaNoticeTime = performance.now();
      this.areaNotice.replaceChildren(el('span', 'area-notice-name', state.area.def.name));
      this.areaNotice.hidden = false;
    }
    if (this.reducedMotion.matches && performance.now() - this.areaNoticeTime >= 3200) this.areaNotice.hidden = true;
    this.root.classList.toggle('has-panel', state.panel !== 'none'); this.root.classList.toggle('is-paused', state.paused);
    this.text('area', state.area.def.name); this.text('objective', this.objective());
    this.text('identity', `Lv.${p.level} · ${DIFFICULTY[p.difficulty]}`);
    this.fields.get('identity')!.title = `${p.name} · ${getClass(p.classId).name} · ${Math.floor(p.gold).toLocaleString()} 金币`;
    for (const [kind, current, max] of [['life', p.life, stats.maxLife], ['mana', p.mana, stats.maxMana]] as const) {
      const fill = this.fields.get(`${kind}-fill`)!, orb = this.fields.get(`${kind}-orb`)!;
      fill.style.height = `${clamp(current / Math.max(1, max), 0, 1) * 100}%`;
      orb.setAttribute('aria-valuenow', String(Math.ceil(current))); orb.setAttribute('aria-valuemax', String(Math.ceil(max)));
      this.text(`${kind}-value`, `${Math.ceil(current)} / ${Math.ceil(max)}`);
    }
    this.fields.get('stamina-fill')!.style.width = `${clamp(p.stamina / Math.max(1, stats.maxStamina), 0, 1) * 100}%`;
    this.text('stamina-label', `耐力 ${Math.ceil(p.stamina)}`);
    this.fields.get('stamina-fill')!.parentElement!.title = `耐力 ${Math.ceil(p.stamina)} / ${Math.ceil(stats.maxStamina)}`;
    const floor = EXPERIENCE[p.level] ?? 0, next = EXPERIENCE[p.level + 1] ?? floor;
    const progress = p.level >= 99 ? 1 : clamp((p.experience - floor) / Math.max(1, next - floor), 0, 1);
    this.fields.get('xp-fill')!.style.width = `${progress * 100}%`;
    this.text('xp-label', p.level >= 99 ? '已满级' : `经验 ${Math.floor(progress * 100)}%`);
    this.fields.get('xp-fill')!.parentElement!.title = `经验 ${Math.floor(p.experience).toLocaleString()} / ${next.toLocaleString()}`;
    this.text('left-skill', `${this.skillName(p.leftSkill)} · 左`); this.text('right-skill', `${this.skillName(p.rightSkill)} · 右`);
    this.fields.get('left-skill')!.title = '战场单击左键攻击一次，按住连续攻击；点击此处选择左键技能'; this.fields.get('right-skill')!.title = '战场单击右键施法一次，按住连续施法；点击此处选择右键技能，1–8 只切换技能';
    this.fields.get('left-skill')!.setAttribute('aria-label', `选择左键技能：${this.skillName(p.leftSkill)}`);
    this.fields.get('right-skill')!.setAttribute('aria-label', `选择右键技能：${this.skillName(p.rightSkill)}`);
    this.text('touch-attack-skill', this.skillName(p.leftSkill)); this.text('touch-cast-skill', this.skillName(p.rightSkill));
    (this.fields.get('touch-cast') as HTMLButtonElement).disabled = !this.activeGame() || !!state.area.def.town || !this.canCast();
    (this.fields.get('touch-attack') as HTMLButtonElement).disabled = !this.activeGame() || !!state.area.def.town;
    this.updateNearbyActions();
    const runButton = this.hud.querySelector('.run-button'); if (runButton) { runButton.textContent = p.running ? '奔跑' : '行走'; runButton.setAttribute('aria-pressed', String(p.running)); }
    const mapButton = this.hud.querySelector('.map-button'); mapButton?.setAttribute('aria-pressed', String(state.automap));
    const pauseButton = this.hud.querySelector('.pause-button'); if (pauseButton) { pauseButton.textContent = state.paused ? '继续' : '暂停'; pauseButton.setAttribute('aria-pressed', String(state.paused)); }
    const saveButton = this.hud.querySelector('.save-button'); if (saveButton) saveButton.textContent = state.saved ? '已保存' : '保存';
    this.updatePanelButtons();
    const monster = state.area.monsters.find(m => m.uid === state.selectedMonster && !m.dead);
    this.fields.get('enemy')!.hidden = !monster;
    if (monster) {
      this.text('enemy-name', `${monster.name}${monster.boss ? ' · 首领' : monster.champion ? ' · 冠军' : ''}`);
      this.fields.get('enemy-life')!.style.setProperty('--health', `${clamp(monster.life / monster.maxLife, 0, 1) * 100}%`);
      this.fields.get('enemy-life')!.setAttribute('aria-label', `敌人生命 ${Math.ceil(monster.life)} / ${Math.ceil(monster.maxLife)}`);
      this.text('enemy-mods', `等级 ${monster.level} · ${monster.modifiers.join(' · ') || '普通怪物'}`);
    }
    const beltSignature = JSON.stringify([stats.beltRows, p.belt.map(i => i ? [i.uid, i.quantity, i.code] : null)]);
    if (this.beltSignature !== beltSignature) { this.beltSignature = beltSignature; this.renderBelt(p); }
    const messages = state.messages.slice(-3), messageSignature = JSON.stringify(messages);
    if (this.messageSignature !== messageSignature) { this.messageSignature = messageSignature; this.messageTime = performance.now(); this.messages.replaceChildren(...messages.map(m => el('div', `message ${m.kind}`, m.text))); }
    this.messages.hidden = performance.now() - this.messageTime > 8000;
    const signature = this.getPanelSignature();
    if (this.panelSignature !== signature) { this.panelSignature = signature; this.renderPanel(); }
    this.updateOverlay();
  }

  private objective(): string {
    const p = this.state.player!, area = this.state.area!;
    const quest = QUESTS.find(q => q.act === 1 && q.number === 1);
    const step = quest ? p.quests[questKey(p.difficulty, quest.id)] ?? 0 : 0;
    if (area.def.act !== 1) return `第${area.def.act}幕 · 探索 / J 任务`;
    if (area.def.id === 8 && step < 2) return `邪恶洞窟 · 剩余 ${area.monsters.filter(m => !m.dead).length} 个敌人`;
    if (step >= 3) return '继续探索 · J 任务';
    if (step >= 2) return '返回营地 · 向阿卡拉交付';
    return area.def.town ? '与阿卡拉交谈 · 前往鲜血荒地' : '寻找邪恶洞窟';
  }

  private buildIntro() {
    const section = el('section', 'intro-screen');
    const art = el('img', 'intro-scene'); art.src = artUrl('gate'); art.alt = ''; art.draggable = false;
    const firelight = el('div', 'intro-firelight'); firelight.setAttribute('aria-hidden', 'true');
    const embers = el('div', 'intro-embers'); embers.setAttribute('aria-hidden', 'true');
    for (let i = 0; i < 32; i++) {
      const ember = el('i', 'intro-ember'); ember.style.setProperty('--x', `${(i * 37) % 100}%`); ember.style.setProperty('--delay', `${-(i % 9)}s`); ember.style.setProperty('--drift', `${(i % 5 - 2) * 55}px`); embers.append(ember);
    }
    const captions = el('div', 'intro-captions');
    captions.append(el('p', 'intro-caption caption-one', '那道门后，火焰从未熄灭。'), el('p', 'intro-caption caption-two', '当最后的余烬落下，旅人再次踏入黑暗。'));
    const finale = el('div', 'intro-finale'); finale.hidden = true;
    finale.append(el('div', 'title-kicker', 'THE LAST EMBER'), el('h1', 'game-title', '庇护之地'), el('div', 'title-rule'), el('p', 'title-subtitle', '在余烬之中，重拾你的命运。'), btn('开始游戏', () => this.send({type: 'title'}), 'primary-button intro-start'), el('p', 'title-disclaimer', '原创开场 · 离线单人 · LoD 1.14d 规则'));
    const finish = () => {
      if (this.introTimer) { clearTimeout(this.introTimer); this.introTimer = null; }
      section.classList.add('intro-finished'); finale.hidden = false; skip.hidden = true; captions.hidden = true;
    };
    const skip = btn('跳过动画', finish, 'small-button intro-skip');
    const inscription = el('div', 'intro-inscription', '序章  /  余烬之门');
    section.append(art, firelight, embers, el('div', 'intro-vignette'), inscription, captions, finale, skip); this.screenLayer.append(section);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) finish();
    else this.introTimer = setTimeout(finish, 7000);
  }

  private buildTitle() {
    const restoreFocus = document.activeElement?.closest('.character-list');
    const scrollTop = this.screenLayer.querySelector('.character-list')?.scrollTop ?? 0;
    const content = el('section', 'character-screen');
    const header = el('header', 'character-header');
    header.append(el('div', 'title-kicker', 'THE LAST EMBER / YOUR TRAVELERS'), el('h1', '', '选择你的旅人'), el('p', 'muted', '每一段旅程，都有属于自己的存档。'));
    const list = el('div', 'character-list'); list.setAttribute('aria-label', '游戏人物列表');
    if (!this.state.characters.some(c => c.id === this.selectedSaveId)) this.selectedSaveId = this.state.characters.find(c => c.id === this.state.activeSaveId)?.id ?? this.state.characters[0]?.id ?? null;
    for (const save of this.state.characters) {
      const def = getClass(save.classId);
      const card = btn('', () => { this.selectedSaveId = save.id; this.titleSignature = ''; this.buildTitle(); }, 'character-save', this.state.loadingSave);
      card.dataset.saveId = save.id; card.setAttribute('aria-pressed', String(save.id === this.selectedSaveId)); card.classList.toggle('selected', save.id === this.selectedSaveId);
      const info = el('div', 'character-save-info');
      const details = el('div', 'saved-details');
      details.append(el('span', 'saved-level', `等级 ${save.level}`), el('span', 'saved-class', def.name));
      info.append(el('strong', 'saved-name', save.name), details, el('span', 'saved-time', DIFFICULTY[save.difficulty]));
      card.append(info, el('span', 'character-arrow', save.id === this.selectedSaveId ? '已选' : '›')); list.append(card);
    }
    if (!this.state.characters.length) list.append(el('div', 'character-empty', this.state.storageStatus === 'loading' ? '正在读取本地角色存档…' : this.state.storageStatus === 'error' ? '本地存储不可用' : '这里还没有旅人。创建第一个角色，开启你的旅程。'));
    const sidebar = el('div', 'character-sidebar');
    sidebar.append(list, btn('新建角色', () => this.send({type: 'creation'}), 'secondary-button character-create', this.state.storageStatus !== 'ready' || this.state.loadingSave));
    const selected = this.state.characters.find(c => c.id === this.selectedSaveId);
    const preview = el('div', 'character-preview'), figure = el('div', 'character-figure');
    if (selected) {
      const def = getClass(selected.classId); preview.style.setProperty('--class-color', def.color);
      figure.append(portrait(selected.classId), el('h2', '', selected.name), el('p', 'class-trees', `${def.name} · ${def.english}`), el('p', 'muted', `等级 ${selected.level} / ${DIFFICULTY[selected.difficulty]}`));
    } else figure.append(el('div', 'empty-sigil', 'VII'), el('h2', '', '七种信念'), el('p', 'muted', '同一片黑暗，等待新的旅人。'));
    const actions = el('div', 'character-actions');
    const disabled = !selected || this.state.storageStatus !== 'ready' || this.state.loadingSave;
    actions.append(btn('进入', () => { if (selected) this.send({type: 'continue', id: selected.id}); }, 'primary-button', disabled), btn('删除', () => {
      if (selected && window.confirm(`永久删除“${selected.name}”（等级 ${selected.level} · ${getClass(selected.classId).name}）？\n该角色的本地存档无法恢复，其他角色不会受影响。`)) this.send({type: 'delete-character', id: selected.id});
    }, 'secondary-button character-delete', disabled));
    preview.append(figure, actions);
    const roster = el('div', 'character-roster'); roster.append(sidebar, preview);
    const status = el('p', this.state.storageError ? 'warning storage-status' : 'muted storage-status', this.state.storageError || (this.state.loadingSave ? '正在处理角色存档…' : this.state.storageStatus === 'loading' ? '正在打开 IndexedDB…' : `${this.state.characters.length} 个旅人 · 本机独立存档`)); status.setAttribute('role', 'status');
    content.append(header, roster, status, el('p', 'title-disclaimer', '非官方规则重构 · 原创美术 · 本地存档不跨浏览器同步'));
    this.screenLayer.replaceChildren(content);
    list.scrollTop = scrollTop;
    if (restoreFocus) [...list.querySelectorAll<HTMLButtonElement>('[data-save-id]')].find(b => b.dataset.saveId === this.selectedSaveId)?.focus({preventScroll: true});
  }

  private buildCreation() {
    const section = el('section', 'creation-screen');
    const header = el('header', 'creation-header'); header.append(el('span', 'eyebrow', 'CHOOSE YOUR PATH'), el('h1', '', '选择你的旅人'), el('p', 'muted', '七种信念，同一片黑暗。角色采用原创写实贴图，不使用原版素材。'));
    const cards = el('div', 'class-cards');
    const description = el('div', 'class-description');
    const form = el('form', 'creation-form'), label = el('label', '', '旅人之名'), input = el('input', 'name-input');
    input.id = 'hero-name'; input.name = 'name'; input.maxLength = 24; input.autocomplete = 'off'; input.value = getClass(this.selectedClass).name; label.htmlFor = input.id;
    const detail = () => { const def = getClass(this.selectedClass); description.replaceChildren(el('h2', '', def.name), el('p', '', def.description), el('div', 'class-trees', def.trees.join(' · ')), el('p', 'muted', `力量 ${def.strength} · 敏捷 ${def.dexterity} · 体力 ${def.vitality} · 精力 ${def.energy}`)); };
    for (const def of CLASSES) {
      const card = btn('', () => {
        const previous = getClass(this.selectedClass).name; this.selectedClass = def.id;
        if (!input.value.trim() || input.value === previous) input.value = def.name;
        for (const c of cards.querySelectorAll<HTMLButtonElement>('.class-card')) { c.classList.toggle('selected', c.dataset.class === def.id); c.setAttribute('aria-pressed', String(c.dataset.class === def.id)); }
        detail();
      }, 'class-card');
      card.style.setProperty('--class-color', def.color); card.dataset.class = def.id; card.classList.toggle('selected', def.id === this.selectedClass); card.setAttribute('aria-pressed', String(def.id === this.selectedClass));
      card.append(portrait(def.id), el('span', 'class-name', def.name), el('span', 'class-english', def.english)); cards.append(card);
    }
    const start = el('button', 'primary-button', '开启旅程'); start.type = 'submit';
    form.append(label, input, start, btn('返回', () => this.send({ type: 'title' }), 'secondary-button'));
    form.addEventListener('submit', e => { e.preventDefault(); this.selectedUid = null; this.hotkeys = []; this.skillTree = 0; this.selectedSkill = 0; this.questAct = 1; this.send({ type: 'new', classId: this.selectedClass, name: input.value.trim() || getClass(this.selectedClass).name }); });
    detail(); section.append(header, cards, description, form, el('p', 'title-disclaimer', '特殊技能行为逐步实现；技能树会明确标记可执行范围。')); this.screenLayer.append(section);
  }

  private renderBelt(p: Player) {
    const rows = clamp(this.state.stats?.beltRows ?? 1, 1, 4);
    const focusedColumn = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.belt-cell')?.dataset.column;
    this.belt.setAttribute('aria-label', `腰带 · ${rows} 行容量 · 显示各列下一瓶药水`);
    const cells: HTMLButtonElement[] = [];
    for (let column = 0; column < 4; column++) {
      let item: Item | null = null, remaining = 0;
      for (let row = 0; row < rows; row++) {
        const candidate = p.belt[row * 4 + column];
        if (candidate) { item ??= candidate; remaining++; }
      }
      const label = `腰带第 ${column + 1} 列 · Shift+${column + 1}${item ? `：${itemLabel(item)} · 剩余 ${remaining} 瓶` : '：空'}`;
      const button = btn('', () => this.send({ type: 'potion', column }), 'belt-cell', !item);
      button.dataset.column = String(column); button.setAttribute('aria-label', label); button.title = label; button.setAttribute('aria-keyshortcuts', `Shift+${column + 1}`);
      if (item) { button.append(itemSprite(item), el('span', 'belt-count', String(remaining))); this.itemTooltip(button, item); }
      button.append(el('kbd', '', `⇧${column + 1}`)); cells.push(button);
    }
    this.belt.replaceChildren(...cells);
    if (focusedColumn !== undefined) cells[Number(focusedColumn)]?.focus({ preventScroll: true });
  }

  private getPanelSignature(): string {
    const s = this.state, p = s.player!;
    if (s.panel === 'none') return 'none';
    if (s.panel === 'catalog') return JSON.stringify([s.panel, this.catalogKind, this.catalogQuery, this.catalogPage, this.catalogSelected]);
    const base: unknown[] = [s.panel, this.selectedUid, this.selectedSkill, this.skillTree, this.bindRight, this.questAct, p.level, p.classId, p.difficulty];
    if (['inventory', 'stash', 'cube', 'vendor'].includes(s.panel)) base.push(p.inventory, p.equipment, p.stash, p.cube, p.gold, p.weaponSwap, s.vendorItems, s.npc, s.dialogue, this.socketRune, s.stats?.strength, s.stats?.dexterity);
    if (s.panel === 'vendor') base.push(this.vendorFilter, this.tradeInventoryOpen, this.tradeView);
    if (s.panel === 'character') base.push(s.stats, p.statPoints, p.skillPoints, p.experience);
    if (s.panel === 'skills') base.push(p.skills, p.skillPoints, p.leftSkill, p.rightSkill, p.equipment, this.hotkeys, s.stats);
    if (s.panel === 'quests') base.push(p.quests, p.unlockedActs);
    if (s.panel === 'waypoint') base.push(this.waypointAct, p.waypoints, p.unlockedActs, p.unlockedDifficulties, s.area?.def.id);
    return JSON.stringify(base);
  }

  private isTrading() { return this.state.screen === 'game' && this.state.panel === 'vendor' && !!NPCS[this.state.npc ?? '']?.services.includes('trade'); }

  private updatePanelButtons() {
    for (const node of this.hud.querySelectorAll<HTMLButtonElement>('[data-panel]')) {
      const active = node.dataset.panel === this.state.panel || node.dataset.panel === 'inventory' && this.isTrading() && this.tradeInventoryOpen;
      node.classList.toggle('active', active); node.setAttribute('aria-expanded', String(active));
    }
  }

  private toggleTradeInventory() {
    this.resetControls(); this.tradeInventoryOpen = !this.tradeInventoryOpen;
    this.tradeView = this.tradeInventoryOpen ? 'inventory' : 'vendor'; this.invalidatePanel(); this.updatePanelButtons();
  }

  private showTradeView(view: 'vendor' | 'inventory') {
    this.resetControls(); this.hideTooltip(); this.tradeView = view;
    if (view === 'inventory' && !this.tradeInventoryOpen) { this.tradeInventoryOpen = true; this.invalidatePanel(); }
    else {
      this.panelLayer.dataset.tradeView = view;
      for (const button of this.panelLayer.querySelectorAll<HTMLButtonElement>('[data-trade-view]')) {
        const active = button.dataset.tradeView === view; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
      }
      this.panelSignature = this.getPanelSignature();
    }
    this.updatePanelButtons();
  }

  private buyItem(item: Item) {
    const before = new Map(this.state.player!.inventory.map(i => [i.uid, i.quantity]));
    this.send({ type: 'buy', uid: item.uid });
    const purchased = this.state.player?.inventory.find(i => !before.has(i.uid) || i.code === item.code && i.quantity > (before.get(i.uid) ?? 0));
    if (!purchased || !this.isTrading()) return;
    this.tradeInventoryOpen = true; this.tradeView = 'inventory'; this.selectedUid = purchased.uid;
    this.invalidatePanel(); this.updatePanelButtons();
    if (window.matchMedia('(max-width: 1000px)').matches) this.panelLayer.querySelector('.trade-inventory .item-detail')?.scrollIntoView({ block: 'nearest' });
  }

  private renderTradePanels() {
    const workspace = el('div', `trade-workspace${this.tradeInventoryOpen ? '' : ' trade-bag-closed'}`); this.panelLayer.append(workspace);
    const nav = el('nav', 'trade-switcher'); nav.setAttribute('aria-label', '交易窗口切换');
    for (const [view, label] of [['vendor', '商店'], ['inventory', this.tradeInventoryOpen ? '背包 · I' : '打开背包 · I']] as const) {
      const button = btn(label, () => this.showTradeView(view), `tab-button${this.tradeView === view ? ' active' : ''}`);
      button.dataset.tradeView = view; button.dataset.focus = `trade-view:${view}`; button.setAttribute('aria-pressed', String(this.tradeView === view)); nav.append(button);
    }
    workspace.append(nav);
    for (const kind of ['vendor', 'inventory'] as const) {
      if (kind === 'inventory' && !this.tradeInventoryOpen) continue;
      const title = kind === 'vendor' ? `${NPCS[this.state.npc ?? '']?.name ?? '商人'} · 商店` : PANEL_NAMES.inventory;
      const frame = el('section', `gothic-panel panel-${kind}${kind === 'inventory' ? ' trade-inventory' : ''}`); frame.setAttribute('aria-label', title);
      const heading = el('div', 'panel-heading'); heading.append(el('span', 'panel-inscription', kind === 'vendor' ? '交易' : '装备'), el('h2', '', title));
      const close = btn('关闭 ×', () => kind === 'inventory' ? this.toggleTradeInventory() : this.send({ type: 'panel', panel: this.tradeInventoryOpen ? 'inventory' : 'none' }, true), 'close-button');
      close.dataset.focus = `trade-close:${kind}`; close.setAttribute('aria-label', kind === 'vendor' ? '关闭商店，结束交易' : '关闭背包，保留商店');
      const header = el('header', 'panel-header'); header.append(heading, close);
      const body = el('div', 'panel-body'); body.dataset.scroll = `panel:${kind}`;
      if (kind === 'vendor') this.vendorPanel(body); else this.inventoryPanel(body);
      frame.append(header, body); workspace.append(frame);
    }
  }

  private invalidatePanel() { this.panelSignature = ''; this.renderPanel(); this.panelSignature = this.getPanelSignature(); }

  private renderPanel() {
    const panel = this.state.panel;
    const oldScroll = new Map<string, { top: number; left: number }>();
    for (const node of this.panelLayer.querySelectorAll<HTMLElement>('[data-scroll]')) oldScroll.set(node.dataset.scroll!, { top: node.scrollTop, left: node.scrollLeft });
    const focus = this.panelLayer.contains(document.activeElement) ? (document.activeElement as HTMLElement)?.dataset.focus : undefined;
    this.hideTooltip(); this.panelLayer.replaceChildren();
    this.panelLayer.classList.toggle('trade-mode', this.isTrading()); this.panelLayer.dataset.tradeView = this.tradeView;
    if (panel === 'none' || !this.state.player) return;
    if (this.isTrading()) this.renderTradePanels();
    else this.renderSinglePanel(panel);
    for (const node of this.panelLayer.querySelectorAll<HTMLElement>('[data-scroll]')) { const scroll = oldScroll.get(node.dataset.scroll!); node.scrollTop = scroll?.top ?? 0; node.scrollLeft = scroll?.left ?? 0; }
    if (focus) for (const node of this.panelLayer.querySelectorAll<HTMLElement>('[data-focus]')) if (node.dataset.focus === focus && node.getClientRects().length) { node.focus({ preventScroll: true }); break; }
  }

  private renderSinglePanel(panel: Panel) {
    const frame = el('section', `gothic-panel panel-${panel}`); frame.setAttribute('aria-label', PANEL_NAMES[panel]);
    const category = ['inventory', 'stash', 'cube', 'vendor'].includes(panel) ? '物品' : ['character', 'skills', 'quests'].includes(panel) ? '旅人' : panel === 'waypoint' ? '旅途' : '参考';
    const heading = el('div', 'panel-heading'); heading.append(el('span', 'panel-inscription', category), el('h2', '', PANEL_NAMES[panel]));
    const close = btn('关闭 ×', () => this.send({ type: 'panel', panel: 'none' }), 'close-button'); close.setAttribute('aria-label', `关闭${PANEL_NAMES[panel]}，返回场景`); close.setAttribute('aria-keyshortcuts', 'Escape'); close.dataset.focus = 'panel-close';
    const header = el('header', 'panel-header'); header.append(heading, close);
    const body = el('div', 'panel-body'); body.dataset.scroll = 'panel'; frame.append(header);
    const group: Panel[] = ['inventory', 'character', 'skills', 'quests'].includes(panel) ? ['inventory', 'character', 'skills', 'quests'] : ['catalog', 'help'].includes(panel) ? ['catalog', 'help'] : [];
    if (group.length) {
      const nav = el('nav', 'panel-navigation'); nav.setAttribute('aria-label', `${category}分类`);
      for (const destination of group) {
        const button = btn(PANEL_NAMES[destination], () => this.send({ type: 'panel', panel: destination }), `tab-button${destination === panel ? ' active' : ''}`);
        button.dataset.panel = destination; button.dataset.focus = `panel:${destination}`; button.setAttribute('aria-current', destination === panel ? 'page' : 'false'); nav.append(button);
      }
      frame.append(nav);
    }
    frame.append(body);
    switch (panel) {
      case 'inventory': this.inventoryPanel(body); break;
      case 'character': this.characterPanel(body); break;
      case 'skills': this.skillsPanel(body); break;
      case 'quests': this.questsPanel(body); break;
      case 'stash': case 'cube': this.storagePanel(body, panel); break;
      case 'vendor': this.vendorPanel(body); break;
      case 'waypoint': this.waypointPanel(body); break;
      case 'help': this.helpPanel(body); break;
      case 'catalog': this.catalogPanel(body); break;
    }
    this.panelLayer.append(frame);
  }

  private grid(items: Item[], columns: number, rows: number, location: 'inventory' | 'stash' | 'cube') {
    const grid = el('div', 'item-grid'); grid.style.setProperty('--columns', String(columns)); grid.style.setProperty('--rows', String(rows)); grid.setAttribute('aria-label', `${location === 'inventory' ? '背包' : location === 'stash' ? '储物箱' : '方块'} ${columns} × ${rows}`);
    for (const item of items) {
      const b = this.itemButton(item); b.classList.add('grid-item');
      b.style.gridColumn = `${item.x + 1} / span ${item.width}`; b.style.gridRow = `${item.y + 1} / span ${item.height}`;
      b.addEventListener('dblclick', () => location === 'inventory' ? this.send({ type: 'equip', uid: item.uid }) : this.send({ type: 'storage', uid: item.uid, destination: 'inventory' })); grid.append(b);
    }
    const scroll = el('div', 'grid-scroll'); scroll.dataset.scroll = `grid:${location}`; scroll.append(grid); return scroll;
  }

  private selectItem(uid: string | null) {
    const changed = this.selectedUid !== uid;
    this.selectedUid = uid; this.hideTooltip();
    for (const node of this.panelLayer.querySelectorAll<HTMLElement>('.item-button')) {
      const selected = node.dataset.focus === `item:${uid}`;
      node.classList.toggle('selected', selected); node.setAttribute('aria-pressed', String(selected));
    }
    for (const detail of this.panelLayer.querySelectorAll<HTMLElement>('.item-detail')) {
      const owner = detail.dataset.owner as 'vendor' | 'inventory' | undefined, properties = detail.querySelector('.item-properties');
      const next = this.itemDetail(owner); detail.replaceWith(next);
      const nextProperties = next.querySelector('.item-properties'); if (nextProperties) nextProperties.scrollTop = properties?.scrollTop ?? 0;
      if (changed && owner && !next.classList.contains('empty-detail') && window.matchMedia('(max-width: 1000px)').matches) next.scrollIntoView({ block: 'nearest' });
    }
    this.panelSignature = this.getPanelSignature();
  }

  private itemButton(item: Item) {
    const b = btn('', () => this.selectItem(item.uid), `item-button quality-${item.quality}${this.selectedUid === item.uid ? ' selected' : ''}`);
    b.dataset.focus = `item:${item.uid}`; b.setAttribute('aria-label', itemLabel(item)); b.setAttribute('aria-pressed', String(this.selectedUid === item.uid)); b.append(itemSprite(item));
    const rune = RUNES.find(r => r.code === item.code), gem = GEMS.find(g => g.code === item.code);
    if (rune) b.append(el('span', 'item-rank rune-number', String(rune.number)));
    else if (gem) b.append(el('span', 'item-rank gem-grade', `${gem.grade + 1}/5`));
    if (item.quantity > 1) b.append(el('span', 'item-quantity', String(item.quantity)));
    if (item.sockets > 0) b.append(el('span', 'socket-count', `${item.socketed.length}/${item.sockets}`));
    this.itemTooltip(b, item); return b;
  }

  private inventoryPanel(body: HTMLElement) {
    const p = this.state.player!;
    const layout = el('div', 'inventory-layout'), equipment = el('div', 'equipment-column');
    equipment.append(el('div', 'section-caption', '装备 · 双击穿戴 / 点击查看'));
    const paperdoll = el('div', 'paperdoll'); paperdoll.append(portrait(p.classId));
    const slots: Slot[] = ['head', 'neck', 'body', 'weapon', 'offhand', 'gloves', 'belt', 'boots', 'ring1', 'ring2', 'weapon2', 'offhand2'];
    for (const slot of slots) {
      const item = p.equipment[slot], wrap = el('div', `equipment-slot slot-${slot}${p.weaponSwap && ['weapon2', 'offhand2'].includes(slot) || !p.weaponSwap && ['weapon', 'offhand'].includes(slot) ? ' active-weapon' : ''}`);
      if (item) { const b = this.itemButton(item); b.addEventListener('dblclick', () => this.send({ type: 'unequip', slot })); wrap.append(b); }
      else { const b = btn(SLOT_NAMES[slot], () => this.selectItem(null), 'empty-slot'); b.setAttribute('aria-label', `${SLOT_NAMES[slot]}：未装备`); wrap.append(b); }
      wrap.append(el('span', 'slot-label', SLOT_NAMES[slot])); paperdoll.append(wrap);
    }
    equipment.append(paperdoll, btn(`切换武器组 · ${p.weaponSwap ? 'II' : 'I'} · X`, () => this.send({ type: 'swap' }), 'secondary-button'));
    const bag = el('div', 'bag-column'); bag.append(el('div', 'section-caption', '行囊 · 10 × 4'), this.grid(p.inventory, 10, 4, 'inventory'), el('div', 'gold-line', `${p.gold.toLocaleString()} 金币`));
    const buttons = el('div', 'button-row'); buttons.append(btn('赫拉迪克方块', () => this.send({ type: 'panel', panel: 'cube' }), 'secondary-button', !this.ownsCube()), btn('回城卷轴', () => this.send({ type: 'portal' }), 'secondary-button'));
    bag.append(buttons, el('p', 'muted', this.isTrading() ? '交易中 · 点击物品查看或出售，双击装备。' : '点击查看 · 双击装备。储物与交易需靠近营地设施。')); layout.append(equipment, bag); body.append(layout, this.itemDetail(this.isTrading() ? 'inventory' : undefined));
  }

  private selectedItem(): { item: Item; location: 'inventory' | 'stash' | 'cube' | 'equipment' | 'vendor'; slot?: Slot } | null {
    const p = this.state.player!;
    for (const location of ['inventory', 'stash', 'cube'] as const) { const item = p[location].find(i => i.uid === this.selectedUid); if (item) return { item, location }; }
    for (const [slot, item] of Object.entries(p.equipment)) if (item && item.uid === this.selectedUid) return { item, location: 'equipment', slot: slot as Slot };
    const item = this.state.vendorItems.find(i => i.uid === this.selectedUid); return item ? { item, location: 'vendor' } : null;
  }

  private itemDetail(owner?: 'vendor' | 'inventory') {
    const detail = el('section', 'item-detail'); let selected = this.selectedItem();
    if (owner) {
      detail.dataset.owner = owner;
      if (selected && (owner === 'vendor' ? selected.location !== 'vendor' : !['inventory', 'equipment'].includes(selected.location))) selected = null;
    }
    detail.setAttribute('aria-label', `${owner === 'vendor' ? '商店' : owner === 'inventory' ? '背包' : '所选'}物品详情与操作`);
    if (!selected) { detail.classList.add('empty-detail'); detail.append(el('h3', '', owner === 'vendor' ? '商品详情' : '物品详情'), el('p', 'muted', owner === 'vendor' ? '点击商品查看属性与价格，下方可直接购买。' : owner === 'inventory' ? '点击行囊物品查看属性与出售；双击装备 / 卸下。' : '点击物品查看属性与操作；双击装备 / 卸下。')); return detail; }
    const { item, location, slot } = selected, p = this.state.player!, base = getBase(item.code);
    const heading = el('header', 'item-detail-heading'); heading.append(el('h3', `quality-${item.quality}`, itemLabel(item)), el('span', 'muted', { inventory: '行囊', stash: '储物箱', cube: '方块', equipment: '已装备', vendor: '商店' }[location])); detail.append(heading);
    const properties = el('div', 'item-properties'); if (owner) properties.dataset.scroll = `detail:${owner}`;
    for (const line of lines(describeItem(item))) if (line) properties.append(el('div', 'item-property', line));
    properties.append(el('p', 'muted', `占用 ${item.width} × ${item.height} · 物品等级 ${item.ilvl}${item.ethereal ? ' · 无形' : ''}${item.runeword ? ` · ${item.runeword}` : ''}`));
    detail.append(properties);
    const actions = el('div', 'item-actions'); actions.setAttribute('role', 'group'); actions.setAttribute('aria-label', `${itemLabel(item)}操作`);
    if (location === 'vendor') { actions.append(btn(`购买 · ${item.price.toLocaleString()} 金币`, () => this.buyItem(item), 'primary-button', p.gold < item.price)); }
    else if (location === 'equipment' && slot) { actions.append(btn('卸下至背包', () => this.send({ type: 'unequip', slot }), 'secondary-button')); }
    else {
      if (location === 'inventory') {
        actions.append(btn('装备', () => this.send({ type: 'equip', uid: item.uid }), 'secondary-button', !base?.slot), btn('丢弃', () => this.send({ type: 'drop', uid: item.uid }), 'secondary-button'));
        if (!item.identified) actions.append(btn('鉴定', () => this.send({ type: 'identify', uid: item.uid }), 'secondary-button'));
        const canStash = this.nearFacility('stash');
        actions.append(btn('存入仓库', () => { if (this.state.panel !== 'stash') this.send({ type: 'panel', panel: 'stash' }); this.send({ type: 'storage', uid: item.uid, destination: 'stash' }); }, 'secondary-button', !canStash));
        if (!canStash) actions.lastElementChild!.setAttribute('title', '靠近营地储物箱后可存入');
        actions.append(btn('放入方块', () => this.send({ type: 'storage', uid: item.uid, destination: 'cube' }), 'secondary-button', !this.ownsCube() || item.code === 'box'));
        actions.append(btn('出售', () => this.send({ type: 'sell', uid: item.uid }), 'secondary-button', this.state.panel !== 'vendor' || !NPCS[this.state.npc ?? '']?.services.includes('trade')));
        if (this.state.panel !== 'vendor') actions.lastElementChild!.setAttribute('title', '与商人交谈后，在交易面板出售');
      } else actions.append(btn('取回背包', () => this.send({ type: 'storage', uid: item.uid, destination: 'inventory' }), 'secondary-button'));
    }
    detail.append(actions);
    if (location === 'inventory' && item.sockets > item.socketed.length) {
      const candidates = p.inventory.filter(i => i.uid !== item.uid && (RUNES.some(r => r.code === i.code) || GEMS.some(g => g.code === i.code) || /gem|jewel|宝石|珠宝/.test(`${getBase(i.code)?.type} ${getBase(i.code)?.name}`)));
      const socketRow = el('div', 'socket-row'), select = el('select'); select.setAttribute('aria-label', '选择镶嵌符文或宝石'); select.dataset.focus = 'socket-select';
      select.append(new Option('选择符文 / 宝石', '')); for (const rune of candidates) select.append(new Option(itemLabel(rune), rune.uid));
      if (candidates.some(i => i.uid === this.socketRune)) select.value = this.socketRune;
      const socketButton = btn('永久镶嵌', () => { if (select.value) this.send({ type: 'socket', itemUid: item.uid, runeUid: select.value }); }, 'secondary-button', !select.value);
      select.addEventListener('change', () => { this.socketRune = select.value; socketButton.disabled = !select.value; });
      socketRow.append(select, socketButton); detail.append(socketRow, el('p', 'warning', '镶嵌顺序不可逆。符文之语只适用于正确底材、孔数与符文顺序。'));
    }
    if (base && location !== 'vendor') properties.append(el('p', 'muted', `需求：等级 ${item.requiredLevel} · 力量 ${base.strength} · 敏捷 ${base.dexterity}`));
    return detail;
  }

  private ownsCube() { return !!this.state.player?.inventory.some(i => i.code === 'box'); }
  private nearFacility(kind: 'stash' | 'npc') { const p = this.state.player; return !!p && !!this.state.area?.objects.some(o => o.kind === kind && Math.hypot(o.x - p.x, o.y - p.y) <= 3); }

  private storagePanel(body: HTMLElement, destination: 'stash' | 'cube') {
    const p = this.state.player!, layout = el('div', 'storage-layout'), store = el('div', 'storage-column'), bag = el('div', 'bag-column');
    if (destination === 'cube' && !this.ownsCube()) { body.append(el('p', 'warning', '尚未获得赫拉迪克方块。请在旅途中寻找；不能凭空使用方块。'), btn('查看背包', () => this.send({ type: 'panel', panel: 'inventory' }), 'secondary-button')); return; }
    if (destination === 'stash' && !this.nearFacility('stash')) { body.append(el('p', 'warning', '储物箱在营地中。靠近并点击箱子后才能访问。')); return; }
    store.append(el('div', 'section-caption', destination === 'stash' ? '私人仓库 · 6 × 8' : '方块容器 · 3 × 4'), this.grid(p[destination], destination === 'stash' ? 6 : 3, destination === 'stash' ? 8 : 4, destination));
    if (destination === 'cube') store.append(btn('转化', () => this.send({ type: 'transmute' }), 'primary-button'), el('p', 'muted', '仅已实现且材料匹配的配方可转化；失败不会凭空产出物品。'));
    bag.append(el('div', 'section-caption', '行囊 · 点击查看 / 双击装备'), this.grid(p.inventory, 10, 4, 'inventory')); layout.append(store, bag); body.append(layout, this.itemDetail());
    if (destination === 'cube') {
      const recipes = el('details', 'reference-details'); recipes.append(el('summary', '', '符文与符文之语 · 数据参考'));
      recipes.append(el('p', 'muted', `收录符文 ${Array.isArray(RUNES) ? RUNES.length : Object.keys(RUNES).length} 种，符文之语 ${Array.isArray(RUNEWORDS) ? RUNEWORDS.length : Object.keys(RUNEWORDS).length} 种。数据收录不代表所有附加属性已实现。`)); body.append(recipes);
    }
  }

  private characterPanel(body: HTMLElement) {
    const p = this.state.player!, stats = this.state.stats!;
    const heading = el('div', 'character-heading'); heading.append(portrait(p.classId), el('div', '', `${p.name} · ${getClass(p.classId).name} · 等级 ${p.level}`)); body.append(heading);
    body.append(el('div', 'point-budget', `未分配属性点 ${p.statPoints} · 未分配技能点 ${p.skillPoints}`), el('p', 'muted', '每级获得 5 属性点与 1 技能点；任务奖励以引擎实际状态为准。'));
    const attributes = el('div', 'attributes');
    for (const stat of ['strength', 'dexterity', 'vitality', 'energy'] as const) {
      const row = el('div', 'attribute-row'); const add = btn('+', () => this.send({ type: 'stat', stat }), 'stat-add', p.statPoints <= 0); add.setAttribute('aria-label', `分配一点${STAT_NAMES[stat]}`); add.dataset.focus = `stat:${stat}`;
      row.append(el('span', '', STAT_NAMES[stat]), el('strong', '', String(stats[stat])), add); attributes.append(row);
    }
    body.append(attributes);
    const derived = el('div', 'derived-stats');
    for (const [label, value] of [['攻击伤害', `${Math.floor(stats.minDamage)}–${Math.floor(stats.maxDamage)}`], ['攻击准确率', stats.attackRating], ['防御', stats.defense], ['站立 / 行走格挡', `${Math.floor(stats.block)}%`], ['奔跑格挡', `${Math.floor(stats.block / 3)}%`], ['生命上限', stats.maxLife], ['法力上限', stats.maxMana], ['法力回复加成', `${stats.manaRegenPercent}%`], ['普通攻击暴击', `${stats.criticalStrike}%`], ['致命攻击', `${stats.deadlyStrike}%`], ['耐力上限', stats.maxStamina], ['魔法物品获取', `${stats.magicFind}%`], ['施法速度', `${stats.fcr}%`], ['攻击速度', `${stats.ias}%`], ['打击恢复', `${stats.fhr}%`], ['移动速度', `${stats.frw}%`]] as const) { const row = el('div', 'derived-row'); row.append(el('span', 'muted', label), el('strong', '', String(value))); derived.append(row); }
    body.append(derived, el('h3', 'section-caption', `元素抗性 · ${DIFFICULTY[p.difficulty]}`));
    const resists = el('div', 'resist-grid');
    for (const [label, value, element] of [['火焰', stats.resFire, 'fire'], ['冰冷', stats.resCold, 'cold'], ['闪电', stats.resLightning, 'lightning'], ['毒素', stats.resPoison, 'poison']] as const) {
      const row = el('div', `resist ${element}${value < 0 ? ' negative' : ''}`); row.append(el('span', '', label), el('strong', '', `${value}%`)); resists.append(row);
    }
    body.append(resists, el('p', 'muted', '噩梦抗性惩罚 −40，地狱 −100；一般抗性上限 75%。奔跑影响防御与格挡。'));
  }

  private skillName(id: number) { return id === 0 ? '普通攻击' : getSkill(id)?.name || '普通攻击'; }

  private bindSkill(skillId: number) {
    this.send({ type: 'bind', skillId, right: this.bindRight });
    if (this.state.player![this.bindRight ? 'rightSkill' : 'leftSkill'] === skillId) this.send({ type: 'panel', panel: 'none' });
  }

  private skillsPanel(body: HTMLElement) {
    const p = this.state.player!, def = getClass(p.classId), classSkills = SKILLS.filter(s => s.classId === p.classId);
    const slotbar = el('div', 'skill-bind-bar');
    slotbar.append(btn(`左键：${this.skillName(p.leftSkill)}`, () => { this.bindRight = false; this.invalidatePanel(); }, `secondary-button${!this.bindRight ? ' active' : ''}`), btn(`右键：${this.skillName(p.rightSkill)}`, () => { this.bindRight = true; this.invalidatePanel(); }, `secondary-button${this.bindRight ? ' active' : ''}`), btn('绑定普通攻击', () => this.bindSkill(0), 'secondary-button'));
    slotbar.setAttribute('role', 'group'); slotbar.setAttribute('aria-label', '选择技能绑定位置');
    [...slotbar.querySelectorAll('button')].slice(0, 2).forEach((button, i) => { button.setAttribute('aria-pressed', String(i === (this.bindRight ? 1 : 0))); button.dataset.focus = `skill-bind:${i}`; });
    body.append(el('div', 'point-budget', `剩余技能点 ${p.skillPoints} · 当前等级 ${p.level}`), slotbar);
    const tabs = el('div', 'panel-tabs');
    tabs.setAttribute('aria-label', '技能系别');
    def.trees.forEach((name, i) => {
      const tab = btn(name, () => { this.skillTree = i; this.invalidatePanel(); }, `tab-button${this.skillTree === i ? ' active' : ''}`);
      tab.dataset.focus = `skill-tree:${i}`; tab.setAttribute('aria-pressed', String(this.skillTree === i)); tabs.append(tab);
    });
    body.append(tabs);
    const skills = classSkills.filter(s => s.tree === this.skillTree), tree = el('div', 'skill-tree');
    const minRow = 0, minCol = 0;
    const maxRow = Math.max(5, ...skills.map(s => s.row - minRow)); const rowCount = maxRow + 1;
    tree.style.setProperty('--skill-rows', String(rowCount));
    const paths = svgNode('svg', { viewBox: `0 0 360 ${rowCount * 108}`, preserveAspectRatio: 'none', class: 'skill-paths', 'aria-hidden': 'true' });
    for (const skill of skills) for (const prerequisite of skill.prerequisites) {
      const prev = skills.find(s => s.id === prerequisite); if (!prev) continue;
      const x1 = (prev.column - minCol) * 120 + 60, y1 = (prev.row - minRow) * 108 + 70, x2 = (skill.column - minCol) * 120 + 60, y2 = (skill.row - minRow) * 108 + 30;
      svgPath(paths, `M${x1} ${y1}V${(y1 + y2) / 2}H${x2}V${y2}`, 'none', p.skills[prerequisite] ? '#b09a62' : '#4f5544', '1.5');
    }
    tree.append(paths);
    for (const skill of skills) {
      const level = skillLevel(p, skill.id), hard = p.skills[skill.id] || 0;
      const card = btn('', () => { this.selectedSkill = skill.id; this.invalidatePanel(); }, `skill-node${this.selectedSkill === skill.id ? ' selected' : ''}${!skill.supported ? ' unsupported' : ''}${level > 0 ? ' learned' : ''}`);
      card.style.gridColumn = String(clamp(skill.column - minCol + 1, 1, 3)); card.style.gridRow = String(skill.row - minRow + 1); card.dataset.focus = `skill:${skill.id}`;
      card.setAttribute('aria-pressed', String((skills.find(s => s.id === this.selectedSkill) || skills[0])?.id === skill.id));
      card.classList.toggle('selected', card.getAttribute('aria-pressed') === 'true');
      const rune = svgNode('svg', { viewBox: '0 0 40 40', 'aria-hidden': 'true', class: 'skill-rune' });
      svgPath(rune, 'M20 3L35 12L32 29L20 37L7 28L5 12Z', '#29322a', '#9a8857');
      const n = skill.id % 4;
      svgPath(rune, ['M12 27L20 10L28 27M15 21L25 21', 'M13 11L27 29M27 11L13 29M20 8L20 32', 'M11 24L20 10L29 24L20 30ZM20 10L20 30', 'M13 10L27 10L13 29L27 29M20 10L20 29'][n]!, 'none', skill.supported ? '#d0bc80' : '#777f71', '2');
      card.append(rune, el('span', 'skill-node-name', skill.name), el('span', 'skill-node-level', `${skill.level}级 · ${level}/20${level !== hard ? `（硬点${hard}）` : ''}`));
      card.title = `${skill.description}\n${skill.supported ? '已支持执行' : '特殊行为尚未实现'}\n前置：${skill.prerequisites.map(id => this.skillName(id)).join('、') || '无'}`;
      card.addEventListener('click', event => {
        if (event.detail > 0 && matchMedia('(max-width: 760px)').matches) this.panelLayer.querySelector('.skill-detail')?.scrollIntoView({ block: 'nearest' });
      });
      tree.append(card);
    }
    const layout = el('div', 'skill-layout'); layout.append(tree);
    const skill = skills.find(s => s.id === this.selectedSkill) || skills[0];
    if (skill) layout.append(this.skillDetail(skill));
    body.append(layout, el('p', 'muted', '点击技能查看详情；学习后绑定左／右键，绑定成功会关闭面板。战场中单击释放一次，按住连续释放；1–8 只切换右键技能。连线为前置硬点，灰色技能不可施放。'));
  }

  private skillDetail(skill: SkillDef) {
    const p = this.state.player!, hard = p.skills[skill.id] || 0, level = skillLevel(p, skill.id);
    const effect = skillEffect(p, skill.id), detail = el('div', 'skill-detail');
    detail.append(el('h3', '', skill.name), el('p', '', skill.description), el('div', skill.supported ? 'supported-label' : 'warning', skill.supported ? '可执行技能' : '特殊行为尚未实现'), el('p', 'muted', `需求等级 ${skill.level} · 前置：${skill.prerequisites.map(id => this.skillName(id)).join('、') || '无'} · 当前有效等级 ${level}`));
    if (effect) detail.append(el('p', 'skill-numbers', `${effect.description} · 法力 ${effect.mana} · 伤害 ${Math.floor(effect.min)}–${Math.floor(effect.max)}`));
    const canLearn = p.skillPoints > 0 && hard < 20 && p.level >= skill.level + hard && skill.prerequisites.every(id => (p.skills[id] || 0) > 0);
    const actions = el('div', 'button-row');
    actions.append(btn(skill.supported ? '投入 1 技能点' : '学习规则数据（不可施放）', () => this.send({ type: 'learn', skillId: skill.id }), 'secondary-button', !canLearn), btn(`绑定${this.bindRight ? '右键' : '左键'}`, () => this.bindSkill(skill.id), 'primary-button', !skill.supported || !effect?.supported || level <= 0 || effect?.kind === 'passive'));
    detail.append(actions);
    const hotkeyRow = el('div', 'hotkey-row'); hotkeyRow.append(el('span', 'muted', '右键快捷绑定：'));
    for (let i = 0; i < 8; i++) {
      const b = btn(String(i + 1), () => { this.hotkeys[i] = skill.id; this.invalidatePanel(); }, `hotkey-button${this.hotkeys[i] === skill.id ? ' active' : ''}`, !skill.supported || !effect.supported || level <= 0 || effect.kind === 'passive'); b.title = this.hotkeys[i] ? this.skillName(this.hotkeys[i]!) : '尚未分配'; b.setAttribute('aria-label', `将${skill.name}分配到右键技能快捷键 ${i + 1}`); hotkeyRow.append(b);
    }
    detail.append(hotkeyRow); return detail;
  }

  private questsPanel(body: HTMLElement) {
    const p = this.state.player!, tabs = el('div', 'panel-tabs');
    tabs.setAttribute('aria-label', '任务章节');
    for (let act = 1; act <= 5; act++) {
      const tab = btn(`第${act}幕`, () => { this.questAct = act; this.invalidatePanel(); }, `tab-button${this.questAct === act ? ' active' : ''}`, act > p.unlockedActs);
      tab.setAttribute('aria-pressed', String(this.questAct === act)); tab.dataset.focus = `quest-act:${act}`; if (tab.disabled) tab.title = '尚未解锁'; tabs.append(tab);
    }
    body.append(tabs, el('div', 'section-caption', `${DIFFICULTY[p.difficulty]}难度 · 27 项任务数据 · 各难度独立进度`));
    const list = el('div', 'quest-list');
    for (const q of QUESTS.filter(q => q.act === this.questAct)) {
      const step = p.quests[questKey(p.difficulty, q.id)] ?? 0, card = el('article', `quest-card${step >= 3 ? ' complete' : ''}`);
      card.append(el('div', 'quest-number', String(q.number).padStart(2, '0')), el('h3', '', q.name), el('span', 'quest-state', step >= 3 ? '已完成' : step === 2 ? '待交付' : step > 0 ? '进行中' : '未开始'), el('p', '', q.description), el('p', 'muted', `奖励：${q.reward}`)); list.append(card);
    }
    body.append(list, el('p', 'warning', '任务数据不等于完整五幕脚本验收。没有免费跳幕或首领跳过入口。'));
  }

  private waypointPanel(body: HTMLElement) {
    const p = this.state.player!, labels = ['第一幕', '第二幕', '第三幕', '第四幕', '第五幕'];
    const tabs = el('div', 'panel-tabs waypoint-tabs');
    tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '传送点章节');
    for (let act = 1; act <= 5; act++) {
      const selected = act === this.waypointAct;
      const tab = btn(labels[act - 1]!, () => { this.waypointAct = act; this.invalidatePanel(); }, `tab-button${selected ? ' active' : ''}`);
      tab.id = `waypoint-tab-${act}`; tab.dataset.focus = tab.id;
      tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(selected));
      tab.setAttribute('aria-controls', 'waypoint-destinations'); tab.tabIndex = selected ? 0 : -1;
      tabs.append(tab);
    }
    tabs.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      this.waypointAct = event.key === 'Home' ? 1 : event.key === 'End' ? 5 : (this.waypointAct - 1 + (event.key === 'ArrowRight' ? 1 : 4)) % 5 + 1;
      this.invalidatePanel();
      this.panelLayer.querySelector<HTMLElement>(`#waypoint-tab-${this.waypointAct}`)?.focus();
    });
    body.append(tabs);
    const destinations = el('section', 'waypoint-group'); destinations.id = 'waypoint-destinations';
    destinations.setAttribute('role', 'tabpanel'); destinations.setAttribute('aria-labelledby', `waypoint-tab-${this.waypointAct}`); destinations.tabIndex = 0;
    const locked = this.waypointAct > p.unlockedActs;
    destinations.append(el('h3', 'section-caption', `${labels[this.waypointAct - 1]}${locked ? ' · 未解锁，仅可查看' : ''}`));
    const list = el('div', 'waypoint-list');
    for (const area of AREAS.filter(a => a.act === this.waypointAct && a.waypoint)) {
      const discovered = p.waypoints.includes(area.id), current = this.state.area?.def.id === area.id;
      const status = current ? '当前位置' : locked ? '未解锁' : discovered ? '已发现' : '未发现';
      const destination = btn('', () => this.send({ type: 'travel', areaId: area.id }), `waypoint-button${current ? ' active' : ''}`, !discovered || locked || current);
      destination.append(el('span', 'waypoint-name', area.name), el('span', 'waypoint-status', ` · ${status}`));
      destination.setAttribute('aria-label', `${area.name} · ${status}`); if (current) destination.setAttribute('aria-current', 'location');
      destination.dataset.area = String(area.id); destination.dataset.focus = `waypoint:${area.id}`; list.append(destination);
    }
    destinations.append(list); body.append(destinations);
    body.append(el('p', 'muted', '只有亲自发现的传送点可用。抵达区域不会自动发现传送点，需点击石台。'));
    const difficulty = el('div', 'button-row');
    difficulty.setAttribute('role', 'group'); difficulty.setAttribute('aria-label', '旅程难度');
    (['normal', 'nightmare', 'hell'] as const).forEach((d, index) => {
      const button = btn(`${DIFFICULTY[d]}${index + 1 > p.unlockedDifficulties ? ' · 未解锁' : ''}`, () => this.send({ type: 'difficulty', difficulty: d }), `secondary-button${d === p.difficulty ? ' active' : ''}`, index + 1 > p.unlockedDifficulties || d === p.difficulty);
      button.setAttribute('aria-pressed', String(d === p.difficulty)); difficulty.append(button);
    });
    body.append(difficulty);
  }

  private vendorPanel(body: HTMLElement) {
    const p = this.state.player!, npc = this.state.area?.objects.find(o => o.npcId === this.state.npc);
    const services = NPCS[this.state.npc ?? '']?.services ?? [], canTrade = services.includes('trade');
    body.append(el('h3', 'npc-name', npc?.name || '营地旅人'), el('p', 'npc-dialogue', this.state.dialogue || '与旅人交谈，了解这片土地。'));
    const controls = el('div', 'button-row npc-services');
    if (services.includes('heal')) controls.append(btn('治疗', () => this.send({ type: 'heal' }), 'secondary-button'));
    if (canTrade || this.state.npc === 'cain') controls.append(btn('鉴定全部', () => this.send({ type: 'identify' }), 'secondary-button'));
    if (services.includes('repair')) controls.append(btn('修理装备', () => this.send({ type: 'repair' }), 'secondary-button'));
    if (this.state.npc === 'akara') controls.append(btn('任务奖励洗点', () => this.send({ type: 'respec' }), 'secondary-button', p.quests[questKey(p.difficulty, 'respec')] !== 1));
    if (this.state.npc === 'warriv' && p.unlockedActs >= 2) controls.append(btn('向东旅行 · 鲁高因', () => this.send({ type: 'travel', areaId: 40 }), 'primary-button'));
    if (controls.childElementCount) body.append(controls);
    if (!canTrade) return;
    body.append(el('div', 'gold-line', `持有 ${p.gold.toLocaleString()} 金币`), el('p', 'warning vendor-warning', '改编便利商店，不等于原版掉落与交易：大紫、全等级符文与宝石可购买，镶嵌需求不变。三种钥匙仅可购买、保存，不能开启尚未实现的 Uber 门。黑毛事件尚未开放，出售乔丹不会召唤。'));
    const filters = el('div', 'panel-tabs vendor-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', '商店商品分类');
    for (const [key, label] of [['all', '全部商品'], ['gems', '符文与宝石 · 33 + 35'], ['keys', '事件 / 珍品']]) {
      const button = btn(label!, () => { this.vendorFilter = key!; this.invalidatePanel(); }, `tab-button${this.vendorFilter === key ? ' active' : ''}`);
      button.dataset.focus = `vendor-filter:${key}`; button.setAttribute('aria-pressed', String(this.vendorFilter === key)); filters.append(button);
    }
    const ranks = new Map([...RUNES, ...GEMS].map((item, index) => [item.code, index]));
    const items = this.state.vendorItems.filter(item => {
      if (this.vendorFilter === 'gems') return ranks.has(item.code) || /^(gem|skul)$/.test(String(getBase(item.code)?.raw.type2 ?? ''));
      if (this.vendorFilter === 'keys') return /^pk[1-3]$/.test(item.code) || item.code === 'rin' && item.quality === 'unique' && item.name === 'The Stone of Jordan';
      return true;
    });
    if (this.vendorFilter === 'gems') items.sort((a, b) => (ranks.get(a.code) ?? 99) - (ranks.get(b.code) ?? 99));
    const stock = el('div', 'vendor-stock'); stock.dataset.scroll = `stock:${this.vendorFilter}`; stock.setAttribute('aria-label', '商店商品陈列');
    for (const item of items) {
      const row = el('div', 'vendor-row'), button = this.itemButton(item); row.dataset.code = item.code;
      button.append(el('span', 'vendor-item-name', itemLabel(item)));
      const buy = btn(`${item.price.toLocaleString()} 金币 · 购买`, () => this.buyItem(item), 'small-button', p.gold < item.price);
      buy.dataset.focus = `buy:${item.uid}`; buy.setAttribute('aria-label', `${itemLabel(item)} · ${item.price.toLocaleString()} 金币 · 购买`);
      row.append(button, buy); stock.append(row);
    }
    if (!items.length) stock.append(el('p', 'muted', '此分类暂无商品。'));
    body.append(filters, el('div', 'section-caption vendor-stock-caption', `陈列 ${items.length} 件 · 点击图标查看属性`), stock, this.itemDetail('vendor'));
  }

  private catalogPanel(body: HTMLElement) {
    body.append(el('p', 'catalog-baseline', `LoD 1.14d · ${EQUIPMENT_CATALOG.length.toLocaleString()} 项只读定义 · 含历史、禁用及未完成条目`), el('p', 'warning', '完整收录不等于全部属性生效：套装组合、触发技能、装备光环、聚气和完整合成仍未实现。图鉴不生成装备，也不改变存档。'));
    const tabs = el('nav', 'catalog-tabs'); tabs.setAttribute('aria-label', '装备图鉴分类');
    for (const category of CATALOG_CATEGORIES) {
      const count = EQUIPMENT_CATALOG.filter(entry => entry.kind === category.kind).length;
      const button = btn(`${category.label} ${count}`, () => { this.catalogKind = category.kind; this.catalogPage = 0; this.catalogSelected = ''; this.invalidatePanel(); }, `tab-button${this.catalogKind === category.kind ? ' active' : ''}`);
      button.dataset.kind = category.kind; button.dataset.focus = `catalog-kind:${category.kind}`;
      button.setAttribute('aria-pressed', String(this.catalogKind === category.kind)); tabs.append(button);
    }
    const tools = el('div', 'catalog-tools'), input = el('input', 'catalog-search');
    input.type = 'search'; input.placeholder = '搜索名称 / 英文 / 代码'; input.value = this.catalogQuery;
    input.setAttribute('aria-label', '搜索装备图鉴'); input.dataset.focus = 'catalog-search';
    const clear = btn('清空', () => { input.value = ''; this.catalogQuery = ''; this.catalogPage = 0; this.catalogSelected = ''; refresh(); input.focus(); }, 'small-button');
    const summary = el('div', 'catalog-summary'); summary.setAttribute('role', 'status'); summary.setAttribute('aria-live', 'polite');
    tools.append(input, clear);
    const layout = el('div', 'catalog-layout'), list = el('div', 'catalog-list'), detail = el('section', 'catalog-detail');
    list.setAttribute('aria-label', '装备图鉴结果'); detail.setAttribute('aria-label', '装备定义详情');
    const paging = el('div', 'catalog-paging');
    const refresh = () => {
      const focusedEntry = (document.activeElement as HTMLElement | null)?.dataset.entryId;
      const results = searchEquipment(this.catalogKind, this.catalogQuery), pages = Math.max(1, Math.ceil(results.length / 24));
      this.catalogPage = Math.min(this.catalogPage, pages - 1);
      const visible = results.slice(this.catalogPage * 24, (this.catalogPage + 1) * 24);
      if (!visible.some(entry => entry.id === this.catalogSelected)) this.catalogSelected = visible[0]?.id ?? '';
      list.replaceChildren(); detail.replaceChildren();
      for (const entry of visible) {
        const card = btn('', () => { this.catalogSelected = entry.id; refresh(); }, `catalog-entry catalog-${entry.kind}${this.catalogSelected === entry.id ? ' selected' : ''}`);
        card.dataset.entryId = entry.id; card.setAttribute('aria-pressed', String(this.catalogSelected === entry.id));
        if (entry.code) { const image = el('img', 'catalog-icon'); image.src = artUrl(itemArtKey(entry.code)); image.alt = ''; card.append(image); }
        const label = el('span', 'catalog-entry-label'); label.append(el('strong', '', entry.name), el('small', 'muted', entry.code || entry.id));
        card.append(label); list.append(card);
      }
      const selected = results.find(entry => entry.id === this.catalogSelected);
      if (selected) {
        detail.append(el('h3', `catalog-${selected.kind}`, selected.name), el('p', 'catalog-entry-status', selected.status));
        for (const line of selected.lines.filter(line => !line.startsWith('原始字段：'))) detail.append(el('div', 'item-property', line));
        const properties = Object.entries(selected.raw).filter(([key, value]) => value !== '' && /^(prop\d+|aprop\d+[ab]|PCode\d+[ab]|FCode\d+|T1Code\d+|mod\d+code|(weapon|helm|shield)Mod\d+Code)$/.test(key));
        if (properties.length) {
          detail.append(el('h4', 'section-caption', '原始属性代码 · 不代表全部生效'));
          for (const [key, value] of properties) detail.append(el('div', 'item-property', `${key} = ${value}`));
        }
        const raw = el('details', 'catalog-raw'); raw.append(el('summary', '', '查看完整原始定义与参数'), el('pre', '', JSON.stringify(selected.raw, null, 2))); detail.append(raw);
      } else list.append(el('p', 'muted', '没有匹配的装备定义，请尝试名称或代码。'));
      summary.textContent = `匹配 ${results.length} 项 · 第 ${this.catalogPage + 1} / ${pages} 页 · 每页 24 项`;
      const previous = btn('上一页', () => { this.catalogPage--; this.catalogSelected = ''; refresh(); }, 'secondary-button', this.catalogPage === 0);
      const next = btn('下一页', () => { this.catalogPage++; this.catalogSelected = ''; refresh(); }, 'secondary-button', this.catalogPage + 1 >= pages);
      paging.replaceChildren(previous, next); this.panelSignature = this.getPanelSignature();
      if (focusedEntry) [...list.querySelectorAll<HTMLButtonElement>('[data-entry-id]')].find(card => card.dataset.entryId === focusedEntry)?.focus({preventScroll: true});
    };
    input.addEventListener('input', () => { this.catalogQuery = input.value; this.catalogPage = 0; this.catalogSelected = ''; refresh(); });
    layout.append(list, detail); body.append(tabs, tools, summary, layout, paging); refresh();
  }

  private helpPanel(body: HTMLElement) {
    const rows: [string, string][] = [['WASD / 方向键', '固定 3D 视角，按屏幕方向连续移动；松开立即停止。可边移动边用鼠标瞄准。'], ['鼠标 / 左键', '鼠标指向地面或敌人瞄准，单击左键攻击一次，按住连续攻击。点击设施交互、点击掉落拾取；仅营地内点击地面寻路移动。'], ['右键', '单击施放右键绑定的已获得、已支持的主动技能，按住连续施放，松开停止。技能树中绑定成功会关闭面板；营地内禁用攻击技能。'], ['1–8', '切换已分配的右键技能；在技能详情中点击数字分配快捷键，本次旅人会话有效。未获得或不可执行的技能不能绑定。'], ['Shift+1–4', '使用腰带对应列的药水；也可点击腰带。'], ['Q / F', '使用腰带中当前可取用的生命 / 法力药水；没有对应药水时尝试回复活力药水，不跨过列首药水。'], ['E', '与三格内最近的设施交互或拾取掉落；超过范围须先靠近。'], ['I / C / T / J', '背包 / 角色属性 / 技能树 / 任务日志。'], ['L / 图鉴', '查阅全部装备定义、原始参数及实现状态；只读，不生成装备。'], ['X / R', '切换武器组 / 行走与奔跑。'], ['Tab / Alt', '切换探索地图 / 按住显示掉落名称。面板内 Tab 保留键盘导航。'], ['Esc / H', '关闭面板；无面板时暂停或继续 / 打开旅人指南。打开面板、暂停、切走窗口或取消触控都会释放移动与攻击，关闭后需重新按下。'], ['触屏', '左下摇杆按屏幕方向连续移动；轻点攻击或施法一次，按住连续释放，自动瞄准九格内最近的敌人。交互 / 拾取按钮选择三格内最近的设施 / 掉落。'], ['装备', '单击查看详情，双击装备/卸下。符文宝石通过详情按钮镶嵌。'], ['存档', '点击保存后存储在当前浏览器；标题页继续旅程。离线单人，无云端账户。']];
    for (const [key, description] of rows) { const row = el('div', 'help-row'); row.append(el('kbd', '', key), el('p', '', description)); body.append(row); }
    body.append(el('h3', 'section-caption', '诚实的实现边界'), el('p', 'muted', 'LoD 1.14d 扩展模式规则重构研究项目，非官方。原创写实角色、物品与材质贴图；不含原版美术、音乐或代码。人物使用程序化骨骼动作，非原版完整方向动画与行动帧。五幕地图与技能数据收录不代表完整服务器行为、首领脚本、词缀和配方已经验收。'));
  }

  private updateOverlay() {
    const s = this.state, p = s.player!;
    const signature = `${p.dead}:${s.paused}:${s.panel}`;
    this.overlay.hidden = !p.dead && (!s.paused || s.panel !== 'none');
    if (this.overlaySignature === signature) return; this.overlaySignature = signature; this.overlay.replaceChildren();
    if (this.overlay.hidden) return;
    const card = el('section', `modal-card${p.dead ? ' death-card' : ''}`); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
    card.append(el('div', 'eyebrow', p.dead ? 'THE EMBER REMAINS' : 'A MOMENT OF SILENCE'), el('h2', '', p.dead ? '你已倒下' : '旅途暂歇'), el('p', 'muted', p.dead ? '回到营地重新出发，取回遗体与失落的装备。' : '黑暗仍在等待。准备好后继续你的旅途。'));
    if (p.dead) card.append(btn('在营地复活', () => this.send({ type: 'respawn' }), 'primary-button'));
    else card.append(btn('继续 · Esc', () => this.send({ type: 'pause' }), 'primary-button'), btn('保存旅程', () => this.send({ type: 'save' }), 'secondary-button'), btn('旅人指南', () => this.send({ type: 'panel', panel: 'help' }), 'secondary-button'), btn('返回角色列表', () => this.send({ type: 'title' }), 'secondary-button'));
    this.overlay.append(card);
  }

  private itemTooltip(node: HTMLElement, item: Item) {
    node.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch') this.showTooltip(item, e.clientX, e.clientY); });
    node.addEventListener('pointermove', e => { if (this.hoveringItem === item) this.positionTooltip(e.clientX, e.clientY); });
    node.addEventListener('pointerleave', () => this.hideTooltip());
    node.addEventListener('focus', () => { const r = node.getBoundingClientRect(); this.showTooltip(item, r.right, r.top); }); node.addEventListener('blur', () => this.hideTooltip());
  }
  private showTooltip(item: Item, x: number, y: number) {
    this.hoveringItem = item; this.tooltip.hidden = false; this.tooltip.replaceChildren(el('h3', `quality-${item.quality}`, itemLabel(item)), ...lines(describeItem(item)).filter(Boolean).map(line => el('div', 'item-property', line)));
    this.positionTooltip(x, y);
  }
  private positionTooltip(x: number, y: number) {
    const rect = this.tooltip.getBoundingClientRect(); this.tooltip.style.left = `${clamp(x + 18, 8, window.innerWidth - rect.width - 8)}px`; this.tooltip.style.top = `${clamp(y + 12, 8, window.innerHeight - rect.height - 8)}px`;
  }
  private hideTooltip() { this.tooltip.hidden = true; this.hoveringItem = null; }

  private activeGame(): boolean {
    const s = this.state;
    return this.inputFocused && !document.hidden && s.screen === 'game' && !!s.player && !!s.area && !s.player.dead && !s.paused && s.panel === 'none';
  }

  private resetControls() {
    const pointer = this.pointer, joystickId = this.joystickId, holds = [...this.touchHolds.entries()];
    this.pointer = null; this.aimClient = null; this.joystick = null; this.joystickId = null;
    this.moveKeys.clear(); this.touchHolds.clear(); this.touchKeyHolds.clear();
    if (this.joystickKnob) this.joystickKnob.style.transform = '';
    for (const key of ['touch-attack', 'touch-cast']) { const node = this.fields.get(key); node?.classList.remove('held'); node?.setAttribute('aria-pressed', 'false'); }
    if (this.renderer) this.renderer.hover = null;
    this.canvas.style.cursor = '';
    this.controlHandler?.({ move: { x: 0, y: 0 }, aim: null, aimMonster: null, left: false, right: false });
    if (pointer && this.canvas.hasPointerCapture(pointer.id)) this.canvas.releasePointerCapture(pointer.id);
    if (joystickId !== null && this.joystickNode?.hasPointerCapture(joystickId)) this.joystickNode.releasePointerCapture(joystickId);
    for (const [id, hold] of holds) if (hold.node.hasPointerCapture(id)) hold.node.releasePointerCapture(id);
    if (this.lootHeld) { this.lootHeld = false; if (this.state.showLoot) this.send({ type: 'loot' }); }
  }

  private installInput() {
    const options = { signal: this.abort.signal };
    this.canvas.addEventListener('contextmenu', e => e.preventDefault(), options);
    this.canvas.addEventListener('pointerdown', e => {
      if (!this.activeGame() || !this.renderer || this.renderer.groundArea !== this.state.area || (e.button !== 0 && e.button !== 2) || this.pointer && this.pointer.id !== e.pointerId) return;
      e.preventDefault(); this.canvas.focus({ preventScroll: true }); this.aimClient = { x: e.clientX, y: e.clientY };
      this.pointer ??= { id: e.pointerId, buttons: 0, suppressLeft: false };
      this.pointer.buttons = e.buttons;
      this.canvas.setPointerCapture(e.pointerId);
      if (e.button === 0) this.pressLeft(e.clientX, e.clientY);
      this.updateControl(e.button === 2 ? true : undefined);
    }, options);
    this.canvas.addEventListener('pointermove', e => {
      if (!this.activeGame() || this.pointer && this.pointer.id !== e.pointerId || e.pointerType === 'touch' && !this.pointer) return;
      this.aimClient = { x: e.clientX, y: e.clientY };
      const startRight = !!this.pointer && !(this.pointer.buttons & 2) && !!(e.buttons & 2);
      if (this.pointer) {
        const startLeft = !(this.pointer.buttons & 1) && !!(e.buttons & 1);
        this.pointer.buttons = e.buttons; if (!(e.buttons & 1)) this.pointer.suppressLeft = false;
        if (startLeft) this.pressLeft(e.clientX, e.clientY);
      }
      this.updateControl(startRight ? true : undefined);
    }, options);
    this.canvas.addEventListener('pointerup', e => {
      if (this.pointer?.id !== e.pointerId) return;
      this.pointer.buttons = e.buttons;
      if (!(e.buttons & 1)) this.pointer.suppressLeft = false;
      if (!(e.buttons & 3)) {
        this.pointer = null; if (e.pointerType === 'touch') this.aimClient = null;
        if (this.canvas.hasPointerCapture(e.pointerId)) this.canvas.releasePointerCapture(e.pointerId);
      }
      this.updateControl();
    }, options);
    const cancel = (e: PointerEvent) => { if (this.pointer?.id === e.pointerId) this.resetControls(); };
    this.canvas.addEventListener('pointercancel', cancel, options); this.canvas.addEventListener('lostpointercapture', cancel, options);
    this.canvas.addEventListener('pointerleave', () => { if (!this.pointer) { this.aimClient = null; this.updateControl(); } }, options);
    // Pointer Events emit pointerdown/up only for the first/last mouse button.
    this.canvas.addEventListener('mousedown', e => {
      if (!this.pointer || !this.activeGame()) return;
      const startRight = e.button === 2 && !(this.pointer.buttons & 2);
      if (e.button === 0 && !(this.pointer.buttons & 1)) {
        this.pointer.buttons |= 1; this.aimClient = { x: e.clientX, y: e.clientY }; this.pressLeft(e.clientX, e.clientY);
      } else if (startRight) { this.pointer.buttons |= 2; this.aimClient = { x: e.clientX, y: e.clientY }; }
      this.updateControl(startRight ? true : undefined);
    }, options);
    window.addEventListener('mouseup', e => {
      if (!this.pointer) return;
      this.pointer.buttons &= ~(e.button === 0 ? 1 : e.button === 2 ? 2 : 0);
      if (e.button === 0) this.pointer.suppressLeft = false;
      if (!(this.pointer.buttons & 3)) {
        const id = this.pointer.id; this.pointer = null;
        if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
      }
      this.updateControl();
    }, options);
    window.addEventListener('keydown', e => this.keydown(e), options);
    window.addEventListener('keyup', e => {
      if (this.moveKeys.delete(e.code)) { e.preventDefault(); this.updateControl(); }
      if (e.key === 'Alt' && this.lootHeld) { e.preventDefault(); this.lootHeld = false; if (this.state.showLoot) this.send({ type: 'loot' }); }
    }, options);
    window.addEventListener('blur', () => { this.inputFocused = false; this.resetControls(); this.hideTooltip(); }, options);
    window.addEventListener('focus', () => { this.inputFocused = true; this.updateControl(); }, options);
    window.addEventListener('pagehide', () => { this.resetControls(); this.hideTooltip(); }, options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.resetControls(); this.hideTooltip(); } else this.updateControl(); }, options);
    this.root.addEventListener('focusin', e => { const target = e.target as HTMLElement; if (target.matches('input,textarea,select') || target.isContentEditable) this.resetControls(); }, options);
    window.addEventListener('resize', () => { this.renderer?.resize(); this.hideTooltip(); this.updateControl(); }, options);
  }

  private keydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    if (this.state.screen !== 'game' || !this.state.player || !this.inputFocused || document.hidden) return;
    if (e.key === 'Escape') {
      e.preventDefault(); if (e.repeat) return;
      if (this.state.panel !== 'none') this.send({ type: 'panel', panel: 'none' }); else if (!this.state.player.dead) this.send({ type: 'pause' });
      return;
    }
    if (target?.matches('input,textarea,select') || target?.isContentEditable || e.metaKey || e.ctrlKey) return;
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      if (!this.activeGame()) return;
      e.preventDefault(); if (e.repeat && !this.moveKeys.has(e.code)) return;
      this.moveKeys.add(e.code); this.updateControl(); return;
    }
    if (e.key === 'Alt') {
      if (!this.activeGame()) return;
      e.preventDefault(); if (e.repeat && !this.lootHeld) return;
      if (!this.lootHeld) { this.lootHeld = true; if (!this.state.showLoot) this.send({ type: 'loot' }); }
      return;
    }
    if (e.repeat) return;
    const key = e.key.toLowerCase();
    const panels: Record<string, Panel> = { i: 'inventory', c: 'character', t: 'skills', j: 'quests', l: 'catalog', h: 'help' };
    if (panels[key]) { e.preventDefault(); this.togglePanel(panels[key]!); return; }
    if (key === 'q' || key === 'f') { e.preventDefault(); this.quickPotion(key === 'q' ? 'hp' : 'mp'); return; }
    if (e.shiftKey && /^Digit[1-4]$/.test(e.code)) { e.preventDefault(); this.send({ type: 'potion', column: Number(e.code.at(-1)) - 1 }); return; }
    if (!this.activeGame()) return;
    const digit = /^Digit([1-8])$/.exec(e.code)?.[1] ?? (/^[1-8]$/.test(key) ? key : null);
    if (digit) {
      e.preventDefault(); const index = Number(digit) - 1;
      if (e.shiftKey) { if (index < 4) this.send({ type: 'potion', column: index }); }
      else {
        const id = this.hotkeys[index], p = this.state.player;
        if (id && getSkill(id)?.supported && skillLevel(p, id) > 0) {
          const effect = skillEffect(p, id);
          if (effect.supported && effect.kind !== 'passive') this.send({ type: 'bind', skillId: id, right: true });
        }
      }
    } else if (key === 'e') { e.preventDefault(); this.nearbyInteract(true); }
    else if (key === 'x') { e.preventDefault(); this.send({ type: 'swap' }); }
    else if (key === 'r') { e.preventDefault(); this.send({ type: 'run' }); }
    else if (key === 'tab') { e.preventDefault(); this.send({ type: 'map' }); }
    this.updateControl();
  }

  private quickPotion(kind: 'hp' | 'mp') {
    const p = this.state.player; if (!p) return;
    const rows = clamp(this.state.stats?.beltRows ?? 1, 1, 4), tops: { column: number; item: Item }[] = [];
    for (let column = 0; column < 4; column++) {
      for (let row = 0; row < rows; row++) {
        const item = p.belt[row * 4 + column]; if (item) { tops.push({ column, item }); break; }
      }
    }
    const potion = tops.find(v => new RegExp(`^${kind}[1-5]$`).test(v.item.code)) ?? tops.find(v => /^rv[sl]$/.test(v.item.code));
    if (potion) this.send({ type: 'potion', column: potion.column });
  }

  private pick(clientX: number, clientY: number): { action: Action; uid: string; point: Point } | null {
    const renderer = this.renderer, area = this.state.area, player = this.state.player;
    if (!renderer || !area || !player || renderer.groundArea !== area) return null;
    const point = renderer.screenToWorld(clientX, clientY);
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    const visible = (entity: Point) => Math.hypot(entity.x - player.x, entity.y - player.y) < 13 && !!area.revealed[Math.floor(entity.y)]?.[Math.floor(entity.x)];
    const labelScore = (entity: Point, text: string, lift: number) => {
      const p = renderer.worldToScreen(entity, lift);
      if (this.labelMeasure) this.labelMeasure.font = '13px "Microsoft YaHei", "PingFang SC", sans-serif';
      const textWidth = this.labelMeasure?.measureText(text).width ?? text.length * 13, halfWidth = Math.min(260, textWidth + 16) / 2;
      return Math.abs(clientX - p.x) <= halfWidth && clientY >= p.y - 13 && clientY <= p.y + 8 ? 2 + Math.abs(clientX - p.x) / halfWidth : Infinity;
    };
    const score = (entity: Point, radius: number, lift: number, label?: { text: string; lift: number }) => {
      const ground = Math.hypot(entity.x - point.x, entity.y - point.y) / radius;
      if (ground <= 1) return ground;
      const foot = renderer.worldToScreen(entity), top = renderer.worldToScreen(entity, lift);
      const edge = renderer.worldToScreen({ x: entity.x + radius, y: entity.y - radius });
      const width = Math.max(10, Math.hypot(edge.x - foot.x, edge.y - foot.y) * .65);
      const dx = top.x - foot.x, dy = top.y - foot.y;
      const t = clamp(((clientX - foot.x) * dx + (clientY - foot.y) * dy) / Math.max(1, dx * dx + dy * dy), 0, 1);
      const silhouette = Math.hypot(clientX - foot.x - t * dx, clientY - foot.y - t * dy) / width;
      if (silhouette <= 1) return 1 + silhouette;
      return label ? labelScore(entity, label.text, label.lift) : Infinity;
    };
    const closest = <T extends Point>(entities: T[], metric: (entity: T) => number) => {
      let best: T | undefined, distance = Infinity;
      for (const entity of entities) { if (!visible(entity)) continue; const d = metric(entity); if (d < distance) { best = entity; distance = d; } }
      return best;
    };
    const objectLift: Record<WorldObject['kind'], number> = { npc: 1.85, portal: 2.04, exit: 2.31, shrine: 1.53, stash: .62, chest: .41, waypoint: .16, corpse: .2 };
    // Match Overlay's label lifts and Terrain's prop dimensions.
    const objectScore = (o: WorldObject) => {
      const radius = o.kind === 'portal' ? .45 : .85, labelLift = o.kind === 'npc' ? 2.05 : o.kind === 'exit' ? 1.5 : .8;
      const main = score(o, radius, objectLift[o.kind], Math.hypot(o.x - player.x, o.y - player.y) <= 7 ? { text: o.name, lift: labelLift } : undefined);
      return o.kind === 'corpse' ? Math.min(main, score(o, radius, .2, { text: '你的遗体', lift: .4 })) : main;
    };
    const interaction = (o: WorldObject) => ({ action: { type: 'interact', uid: o.uid } as Action, uid: o.uid, point: { x: o.x, y: o.y } });
    const portal = closest(area.objects.filter(o => o.kind === 'portal'), objectScore); if (portal) return interaction(portal);
    const dropLabel = closest(area.drops, d => this.state.showLoot || Math.hypot(d.x - player.x, d.y - player.y) < 2.8 ? labelScore(d, d.item.name || d.item.code, .4) : Infinity);
    if (dropLabel) return { action: { type: 'pickup', uid: dropLabel.item.uid }, uid: dropLabel.item.uid, point: { x: dropLabel.x, y: dropLabel.y } };
    const monster = closest(area.monsters.filter(m => !m.dead), m => {
      const spec = monsterSpec(m.code, m.color, m.boss, m.champion);
      const height = (spec.body === 'biped' ? 1.85 : spec.body === 'quad' ? .85 : .3) * spec.scale + spec.float;
      return score(m, .65 * Math.max(1, spec.scale), height);
    });
    if (monster) return { action: { type: 'attack', point: { x: monster.x, y: monster.y } }, uid: monster.uid, point: { x: monster.x, y: monster.y } };
    // A chest's drop keeps priority over its used footprint.
    const drop = closest(area.drops, d => score(d, .55, .2, this.state.showLoot || Math.hypot(d.x - player.x, d.y - player.y) < 2.8 ? { text: d.item.name || d.item.code, lift: .4 } : undefined));
    if (drop) return { action: { type: 'pickup', uid: drop.item.uid }, uid: drop.item.uid, point: { x: drop.x, y: drop.y } };
    const object = closest(area.objects.filter(o => !(o.used && (o.kind === 'chest' || o.kind === 'shrine'))), objectScore);
    return object ? interaction(object) : null;
  }

  private pressLeft(clientX: number, clientY: number) {
    if (!this.pointer || !this.renderer || this.renderer.groundArea !== this.state.area) return;
    const hit = this.pick(clientX, clientY), town = !!this.state.area!.def.town;
    this.pointer.suppressLeft = town || !!hit && hit.action.type !== 'attack';
    this.updateControl(false);
    if (hit && hit.action.type !== 'attack') this.send(hit.action);
    else if (town) {
      const point = this.renderer.screenToWorld(clientX, clientY);
      if (Number.isFinite(point.x) && Number.isFinite(point.y)) this.send({ type: 'move', point });
    }
  }

  private canCast() {
    const p = this.state.player; if (!p) return false; if (!p.rightSkill) return true;
    const effect = skillEffect(p, p.rightSkill);
    return !!getSkill(p.rightSkill)?.supported && skillLevel(p, p.rightSkill) > 0 && effect.supported && effect.kind !== 'passive';
  }

  private screenMove(horizontal: number, vertical: number): Point {
    const length = Math.max(1, Math.hypot(horizontal, vertical));
    return { x: (horizontal + vertical) / Math.SQRT2 / length, y: (vertical - horizontal) / Math.SQRT2 / length };
  }

  private updateControl(press?: boolean) {
    const control: Control = { move: { x: 0, y: 0 }, aim: null, aimMonster: null, left: false, right: false };
    if (this.activeGame()) {
      const p = this.state.player!, area = this.state.area!, keys = this.moveKeys;
      const horizontal = Number(keys.has('KeyD') || keys.has('ArrowRight')) - Number(keys.has('KeyA') || keys.has('ArrowLeft'));
      const vertical = Number(keys.has('KeyS') || keys.has('ArrowDown')) - Number(keys.has('KeyW') || keys.has('ArrowUp'));
      control.move = this.joystick ?? this.screenMove(horizontal, vertical);
      const hit = this.aimClient ? this.pick(this.aimClient.x, this.aimClient.y) : null;
      if (this.aimClient && this.renderer?.groundArea === area) {
        const point = this.renderer.screenToWorld(this.aimClient.x, this.aimClient.y);
        if (Number.isFinite(point.x) && Number.isFinite(point.y)) control.aim = point;
        if (hit?.action.type === 'attack') { control.aim = hit.point; control.aimMonster = hit.uid; }
      }
      if (this.renderer) this.renderer.hover = hit?.uid ?? null;
      this.canvas.style.cursor = hit?.action.type === 'attack' ? 'crosshair' : hit ? 'pointer' : area.def.town ? 'default' : 'crosshair';
      const holds = [...this.touchHolds.values()];
      const touchLeft = this.touchKeyHolds.has(false) || holds.some(h => !h.right), touchRight = this.touchKeyHolds.has(true) || holds.some(h => h.right);
      control.left = !area.def.town && (!!this.pointer && !!(this.pointer.buttons & 1) && !this.pointer.suppressLeft || touchLeft);
      control.right = !area.def.town && this.canCast() && (!!this.pointer && !!(this.pointer.buttons & 2) || touchRight);
      if (touchLeft || touchRight) {
        const target = area.monsters.filter(m => !m.dead && Math.hypot(m.x - p.x, m.y - p.y) <= 9 && hasLineOfSight(area, p, m)).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
        control.aim = target ? { x: target.x, y: target.y } : { x: p.x + Math.cos(this.state.facing) * 3, y: p.y + Math.sin(this.state.facing) * 3 };
        control.aimMonster = target?.uid ?? null;
        if (this.renderer) this.renderer.hover = target?.uid ?? null;
      }
      for (const [key, held] of [['touch-attack', touchLeft], ['touch-cast', touchRight && this.canCast()]] as const) {
        const node = this.fields.get(key); node?.classList.toggle('held', held); node?.setAttribute('aria-pressed', String(held));
      }
    } else if (this.renderer) this.renderer.hover = null;
    this.controlHandler?.(control, press);
  }

  private updateJoystick(e: PointerEvent, node: HTMLElement, knob: HTMLElement) {
    const r = node.getBoundingClientRect(), dx = e.clientX - r.left - r.width / 2, dy = e.clientY - r.top - r.height / 2;
    const length = Math.hypot(dx, dy), reach = Math.max(1, (r.width - knob.offsetWidth) / 2 - 1), scale = Math.min(1, reach / Math.max(1, length));
    knob.style.transform = `translate(${dx * scale}px, ${dy * scale}px)`;
    this.joystick = length < 5 ? null : this.screenMove(dx * scale / reach, dy * scale / reach);
    this.updateControl();
  }

  private installTouchHold(node: HTMLButtonElement, right: boolean) {
    const options = { signal: this.abort.signal };
    node.setAttribute('aria-label', `轻点${right ? '施法' : '攻击'}一次，按住连续释放，自动瞄准九格内最近的敌人，松开停止`); node.setAttribute('aria-pressed', 'false');
    node.addEventListener('contextmenu', e => e.preventDefault(), options);
    node.addEventListener('pointerdown', e => {
      if (!this.activeGame() || this.state.area!.def.town || e.button !== 0 || right && !this.canCast()) return;
      e.preventDefault(); this.touchHolds.set(e.pointerId, { right, node }); node.setPointerCapture(e.pointerId); this.updateControl(right);
    }, options);
    node.addEventListener('pointerup', e => {
      if (!this.touchHolds.has(e.pointerId)) return;
      e.preventDefault(); this.touchHolds.delete(e.pointerId); this.updateControl();
      if (node.hasPointerCapture(e.pointerId)) node.releasePointerCapture(e.pointerId);
    }, options);
    const cancel = (e: PointerEvent) => { if (this.touchHolds.has(e.pointerId)) this.resetControls(); };
    node.addEventListener('pointercancel', cancel, options); node.addEventListener('lostpointercapture', cancel, options);
    node.addEventListener('keydown', e => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      e.preventDefault(); e.stopPropagation();
      if (e.repeat || !this.activeGame() || this.state.area!.def.town || right && !this.canCast()) return;
      this.touchKeyHolds.add(right); this.updateControl(right);
    }, options);
    node.addEventListener('keyup', e => {
      if (e.code !== 'Space' && e.code !== 'Enter') return;
      e.preventDefault(); e.stopPropagation(); this.touchKeyHolds.delete(right); this.updateControl();
    }, options);
    node.addEventListener('blur', () => { this.touchKeyHolds.delete(right); this.updateControl(); }, options);
  }

  private nearbyTargets() {
    const p = this.state.player, area = this.state.area;
    const nearest = <T extends Point>(entities: T[]): T | undefined => {
      if (!p) return undefined;
      let target: T | undefined, best = Infinity;
      for (const entity of entities) {
        const distance = Math.hypot(entity.x - p.x, entity.y - p.y);
        if (distance <= 3 && distance < best) { target = entity; best = distance; }
      }
      return target;
    };
    return {
      object: nearest(area?.objects.filter(o => !(o.used && (o.kind === 'chest' || o.kind === 'shrine'))) ?? []),
      drop: nearest(area?.drops ?? []),
    };
  }

  private updateNearbyActions() {
    const { object, drop } = this.nearbyTargets();
    const interact = this.fields.get('touch-interact') as HTMLButtonElement, loot = this.fields.get('touch-loot') as HTMLButtonElement;
    const objectName = object?.name ?? '无附近目标', dropName = drop ? itemLabel(drop.item) : '无附近掉落';
    this.text('interact-target', objectName); this.text('loot-target', dropName);
    interact.disabled = !this.activeGame() || !object; loot.disabled = !this.activeGame() || !drop;
    interact.setAttribute('aria-label', object ? `交互：${objectName}，三格内最近目标` : '交互：附近没有可用目标');
    loot.setAttribute('aria-label', drop ? `拾取：${dropName}，三格内最近掉落` : '拾取：附近没有掉落');
    interact.title = objectName; loot.title = dropName;
  }

  private nearbyInteract(includeLoot = false) {
    if (!this.activeGame()) return;
    const p = this.state.player!, { object, drop } = this.nearbyTargets();
    const distance = (point: Point) => Math.hypot(point.x - p.x, point.y - p.y);
    if (includeLoot && drop && (!object || distance(drop) <= distance(object))) { this.resetControls(); this.send({ type: 'pickup', uid: drop.item.uid }); }
    else if (object) { this.resetControls(); this.send({ type: 'interact', uid: object.uid }); }
  }
  private nearbyLoot() {
    if (!this.activeGame()) return;
    const { drop } = this.nearbyTargets();
    if (drop) { this.resetControls(); this.send({ type: 'pickup', uid: drop.item.uid }); }
  }

  destroy(): void { this.resetControls(); this.controlHandler = null; if (this.introTimer) clearTimeout(this.introTimer); this.abort.abort(); this.renderer?.destroy(); this.root.replaceChildren(); this.fields.clear(); }
}
