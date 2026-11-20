import type { Action, ClassId, Control, Dispatch, GameState, Item, Panel, Player, Point, SkillDef, Slot, StatKey, WorldObject } from './types';
import { CLASSES, SKILLS, EXPERIENCE, getClass, getSkill } from './catalog';
import { skillLevel, skillEffect } from './rules';
import { getBase, isUsableItem, itemLabel, describeItem, unmetItemRequirements, runewordName, RUNES, GEMS, RUNEWORDS, INVENTORY_WIDTH, INVENTORY_HEIGHT, STASH_WIDTH, STASH_HEIGHT, fitsItem, TOME_CAPACITY, canFillTome, itemSellPrice } from './items';
import { AREAS, QUESTS, NPCS, hasLineOfSight, questKey } from './world';
import type { Renderer } from './renderer3d';
import { monsterSpec } from './r3d/rigs';
import { artUrl, heroArtKey, itemArtKey } from './art';
import { CATALOG_CATEGORIES, EQUIPMENT_CATALOG, equipmentPropertyLines, runewordEquipmentGroup, runewordRequiredLevel, searchEquipment } from './equipment-catalog';
import type { CatalogKind } from './equipment-catalog';
import { gamblingCost, gamblingDiscount } from './gambling';

const NS = 'http://www.w3.org/2000/svg';
const SLOT_NAMES: Record<Slot, string> = { head: '头盔', neck: '项链', body: '护甲', weapon: '主手', offhand: '副手', gloves: '手套', belt: '腰带', boots: '靴子', ring1: '左戒', ring2: '右戒', weapon2: '备用主手', offhand2: '备用副手' };
const PANEL_NAMES: Record<Panel, string> = { none: '', inventory: '行囊与装备', character: '角色属性', skills: '技能树', quests: '任务日志', waypoint: '传送点', stash: '私人储物箱', cube: '赫拉迪克方块', vendor: '交易与对话', gamble: '基德 · 赌博', help: '旅人指南', catalog: '装备图鉴' };
const DIFFICULTY = { normal: '普通', nightmare: '噩梦', hell: '地狱' };
const STAT_NAMES: Record<StatKey, string> = { strength: '力量', dexterity: '敏捷', vitality: '体力', energy: '精力' };
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));
function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag); if (className) node.className = className;
  if (text !== undefined) node.textContent = text; return node;
}
function btn(text: string, fn: (event: MouseEvent) => void, className = '', disabled = false): HTMLButtonElement {
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
  private readonly actionFeedback = el('div', 'action-feedback');
  private feedbackMessage: GameState['messages'][number] | undefined;
  private feedbackTime = 0;
  private modalSession = false;
  private modalReturnFocus: HTMLElement | null = null;
  private modalReturnKey = '';
  private modalFocusKey = '';
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
  private skillFeedback = '';
  private skillReturnFocus: HTMLElement | null = null;
  private skillTreeScroll = 0;
  private skillTreePageScroll = 0;
  private bindRight = true;
  private questAct = 1;
  private waypointAct = 1;
  private vendorFilter = 'all';
  private merchantServicesOpen = false;
  private restoringTradeFocus = false;
  private merchantPurchase: { uid: string; label: string; location: 'inventory' | 'belt' } | null = null;
  private tradeInventoryOpen = false;
  private tradeView: 'vendor' | 'inventory' = 'vendor';
  private tradeNpc: string | null = null;
  private readonly tradeScroll = new Map<string, { top: number; left: number }>();
  private selectedGambleOfferUid = '';
  private gamblingResultUid = '';
  private inventoryArranging = false;
  private skillDetailOpen = false;
  private previousPanel: Panel = 'none';
  private hotkeys: number[] = [];
  private socketRune = '';
  private moreExpandedUid = '';
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
  private tooltipAnchor: HTMLElement | null = null;
  private readonly itemPopup = el('div', 'item-popup');
  private itemPopupTimer: ReturnType<typeof setTimeout> | null = null;
  private popup: { uid: string; location: string; x: number; y: number; signature: string } | null = null;
  private lastItemPointer = '';
  private drag: {
    id: number; uid: string; node: HTMLElement; grid: HTMLElement; start: Point; anchor: Point;
    active: boolean; moved: boolean; awaitingHold: boolean; holdTimer: ReturnType<typeof setTimeout> | null;
    touchId: number | null; ghost: HTMLElement | null; preview: HTMLElement | null;
    target: { type: 'move'; x: number; y: number } | { type: 'sell' } | { type: 'tome'; tomeUid: string } | null;
    saleZone: HTMLElement | null; tomeNode: HTMLElement | null;
  } | null = null;
  private suppressItemUntil = 0;
  private suppressDragClick = false;

  constructor(private readonly root: HTMLElement, state: GameState, private readonly dispatch: Dispatch) {
    this.state = state;
    this.root.classList.add('game-shell');
    this.canvas = el('canvas', 'world-canvas'); this.canvas.setAttribute('aria-label', '固定 3D 视角游戏场景：WASD 或方向键移动，鼠标瞄准，单击左键攻击、右键施法，按住连续释放；点击设施交互或掉落拾取，营地点击地面移动；H 查看指南'); this.canvas.tabIndex = 0;
    this.canvas.setAttribute('aria-keyshortcuts', 'W A S D ArrowUp ArrowDown ArrowLeft ArrowRight H');
    this.tooltip.hidden = true; this.tooltip.id = 'item-hover-tooltip'; this.tooltip.setAttribute('role', 'tooltip');
    this.itemPopup.hidden = true; this.itemPopup.setAttribute('role', 'dialog'); this.itemPopup.setAttribute('aria-label', '物品属性与操作');
    this.itemPopup.addEventListener('pointerdown', e => e.stopPropagation(), { signal: this.abort.signal });
    this.itemPopup.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const controls = [...this.itemPopup.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), summary, [tabindex="0"]')].filter(node => node.getClientRects().length);
      const next = controls.indexOf(document.activeElement as HTMLElement) + (e.shiftKey ? -1 : 1);
      if (next < 0 || next >= controls.length) { e.preventDefault(); controls[e.shiftKey ? controls.length - 1 : 0]?.focus(); }
    }, { signal: this.abort.signal });
    const options = { signal: this.abort.signal };
    this.root.addEventListener('pointerdown', e => {
      this.lastItemPointer = e.pointerType; if (e.isPrimary) this.suppressDragClick = false;
      if (!this.itemPopup.contains(e.target as Node)) this.closeItemPopup();
    }, { ...options, capture: true });
    for (const type of ['click', 'dblclick', 'contextmenu'] as const) this.root.addEventListener(type, e => {
      if (performance.now() < this.suppressItemUntil && (type === 'click' ? this.suppressDragClick && e.detail !== 0 : true)) { e.preventDefault(); e.stopImmediatePropagation(); if (type === 'click') this.suppressDragClick = false; }
    }, { ...options, capture: true });
    window.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch' && !e.isPrimary) this.cancelItemDrag(true);
    }, { ...options, capture: true });
    window.addEventListener('touchstart', e => {
      if (e.touches.length > 1) this.cancelItemDrag(true);
    }, { ...options, capture: true, passive: true });
    window.addEventListener('pointermove', e => this.moveItemDrag(e), options);
    window.addEventListener('pointerup', e => this.finishItemDrag(e), options);
    window.addEventListener('pointercancel', e => { if (this.drag?.id === e.pointerId) this.cancelItemDrag(); }, options);
    this.messages.setAttribute('role', 'log'); this.messages.setAttribute('aria-live', 'polite');
    this.feedbackMessage = state.messages.at(-1);
    this.actionFeedback.hidden = true; this.actionFeedback.setAttribute('role', 'alert'); this.actionFeedback.setAttribute('aria-atomic', 'true');
    this.areaNotice.hidden = true; this.areaNotice.setAttribute('role', 'status'); this.areaNotice.setAttribute('aria-live', 'polite');
    this.areaNotice.addEventListener('animationend', () => { this.areaNotice.hidden = true; }, { signal: this.abort.signal });
    this.root.replaceChildren(this.canvas, this.screenLayer, this.hud, this.messages, this.areaNotice, this.panelLayer, this.overlay, this.tooltip, this.itemPopup, this.actionFeedback);
    this.buildHUD(); this.installInput();
    this.update(state);
  }

  setRenderer(renderer: Renderer): void { this.renderer = renderer; renderer.resize(); this.updateControl(); }
  setControlHandler(handler: (control: Partial<Control>, press?: boolean) => void): void {
    this.resetControls(); this.controlHandler = handler; this.updateControl();
  }

  private send(action: Action, endTrade = false) {
    if (!endTrade && action.type === 'panel' && action.panel === 'inventory' && this.isTrading()) { this.toggleTradeInventory(); return; }
    if (action.type === 'panel' || action.type === 'pause' || action.type === 'title' || action.type === 'save-and-title' || action.type === 'respawn' || action.type === 'travel' || action.type === 'difficulty') this.resetControls();
    if (['panel', 'pause', 'title', 'save-and-title', 'respawn', 'travel', 'difficulty'].includes(action.type)) this.clearActionFeedback();
    this.dispatch(action);
    this.updateActionFeedback();
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
    const blessing = this.field('shrine-buff', 'div', 'shrine-buff'); blessing.hidden = true;
    header.append(areaLine, this.field('objective', 'div', 'objective'), blessing);
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
    if (this.previousPanel !== state.panel || this.screen !== state.screen || this.tradeNpc && this.tradeNpc !== state.npc) {
      this.cancelItemDrag(); this.closeItemPopup(); this.clearActionFeedback(); this.setInventoryArranging(false); this.skillDetailOpen = false;
    }
    this.state = state;
    if (this.isTrading()) {
      if (!['vendor', 'gamble'].includes(this.previousPanel) || this.tradeNpc !== state.npc) { this.tradeInventoryOpen = true; this.tradeView = 'vendor'; this.vendorFilter = 'all'; this.selectedUid = null; this.tradeScroll.clear(); this.selectedGambleOfferUid = ''; this.gamblingResultUid = ''; this.merchantPurchase = null; this.merchantServicesOpen = false; }
      if (state.panel !== 'vendor') { this.merchantPurchase = null; this.merchantServicesOpen = false; }
      this.tradeNpc = state.npc;
    } else { this.tradeInventoryOpen = false; this.tradeView = 'vendor'; this.tradeNpc = null; this.merchantPurchase = null; this.merchantServicesOpen = false; this.tradeScroll.clear(); }
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
    this.root.classList.toggle('is-identifying', game && state.identifySource !== null && !state.paused && !state.player?.dead);
    this.updateActionFeedback();
    if (!game || !state.player || !state.stats || !state.area) { this.updateOverlay(); return; }
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
    const blessing = this.fields.get('shrine-buff')!, buff = state.shrineBuff;
    blessing.hidden = !buff || buff.frames <= 0;
    if (buff && buff.frames > 0) this.text('shrine-buff', `${buff.name} · ${Math.ceil(buff.frames / 25)} 秒`);
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
    const castAvailable = this.canCast(), rightSkillName = `${this.skillName(p.rightSkill)}${castAvailable ? '' : '（不可用）'}`;
    this.text('left-skill', `${this.skillName(p.leftSkill)} · 左`); this.text('right-skill', `${rightSkillName} · 右`);
    this.fields.get('right-skill')!.classList.toggle('skill-unavailable', !castAvailable);
    this.fields.get('touch-cast')!.classList.toggle('skill-unavailable', !castAvailable);
    this.fields.get('left-skill')!.title = '战场单击左键攻击一次，按住连续攻击；点击此处选择左键技能'; this.fields.get('right-skill')!.title = castAvailable ? '战场单击右键施法一次，按住连续施法；点击此处选择右键技能，1–8 只切换技能' : '当前未获得或未支持此技能；请学习技能、切换到提供该技能的武器组，或点击重新绑定可用技能';
    this.fields.get('left-skill')!.setAttribute('aria-label', `选择左键技能：${this.skillName(p.leftSkill)}`);
    this.fields.get('right-skill')!.setAttribute('aria-label', `选择右键技能：${rightSkillName}`);
    this.text('touch-attack-skill', this.skillName(p.leftSkill)); this.text('touch-cast-skill', castAvailable ? this.skillName(p.rightSkill) : `不可用 · ${this.skillName(p.rightSkill)}`);
    (this.fields.get('touch-cast') as HTMLButtonElement).disabled = !this.activeGame() || !!state.area.def.town || !castAvailable;
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
    this.updateOverlay(); this.refreshItemPopup();
  }

  private clearActionFeedback() { this.actionFeedback.hidden = true; this.actionFeedback.textContent = ''; }

  private updateActionFeedback() {
    const latest = this.state.messages.at(-1);
    if (latest !== this.feedbackMessage) {
      this.feedbackMessage = latest; this.clearActionFeedback();
      if (latest?.kind === 'error' && this.state.screen === 'game' && (this.state.panel !== 'none' || this.popup)) {
        this.actionFeedback.textContent = latest.text; this.actionFeedback.hidden = false; this.feedbackTime = performance.now();
      }
    }
    if (this.state.screen !== 'game' || this.state.panel === 'none' && !this.popup || performance.now() - this.feedbackTime > 6000) this.clearActionFeedback();
    this.syncPopupFeedback();
  }

  private syncPopupFeedback() {
    const feedback = this.itemPopup.querySelector<HTMLElement>('.item-popup-feedback'); if (!feedback) return;
    feedback.hidden = this.actionFeedback.hidden; feedback.textContent = this.actionFeedback.textContent;
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
    const focusedSaveId = (document.activeElement as HTMLElement | null)?.closest<HTMLElement>('.character-save')?.dataset.saveId;
    const previousList = this.screenLayer.querySelector('.character-list');
    const scrollTop = previousList?.scrollTop ?? 0, scrollLeft = previousList?.scrollLeft ?? 0;
    const content = el('section', 'character-screen');
    const backdrop = el('img', 'character-backdrop'); backdrop.src = artUrl('gate'); backdrop.alt = ''; backdrop.draggable = false;
    const header = el('header', 'character-header'), brand = el('div', 'character-brand');
    brand.append(el('div', 'title-kicker', 'THE LAST EMBER'), el('h1', '', '庇护之地'));
    header.append(brand, el('span', 'character-mode', '离线单人 · LoD 1.14d'));
    const list = el('div', 'character-list'); list.setAttribute('aria-label', '游戏人物列表');
    if (!this.state.characters.some(c => c.id === this.selectedSaveId)) this.selectedSaveId = this.state.characters.find(c => c.id === this.state.activeSaveId)?.id ?? this.state.characters[0]?.id ?? null;
    for (const save of this.state.characters) {
      const def = getClass(save.classId);
      const card = btn('', () => { this.selectedSaveId = save.id; }, 'character-save', this.state.loadingSave);
      card.dataset.saveId = save.id; card.setAttribute('aria-pressed', String(save.id === this.selectedSaveId)); card.classList.toggle('selected', save.id === this.selectedSaveId);
      const info = el('div', 'character-save-info');
      const details = el('div', 'saved-details');
      details.append(el('span', 'saved-level', `等级 ${save.level}`), el('span', 'saved-class', def.name), el('span', 'saved-time', DIFFICULTY[save.difficulty]));
      const name = el('strong', 'saved-name', save.name); name.title = save.name;
      info.append(name, details); card.title = save.name;
      const thumbnail = el('div', 'character-thumbnail'); thumbnail.append(portrait(save.classId)); thumbnail.setAttribute('aria-hidden', 'true');
      const arrow = el('span', 'character-arrow', '›'); arrow.setAttribute('aria-hidden', 'true');
      card.append(thumbnail, info, arrow); list.append(card);
    }
    if (!this.state.characters.length) list.append(el('div', 'character-empty', this.state.storageStatus === 'loading' ? '正在读取本地角色存档…' : this.state.storageStatus === 'error' ? '本地存储不可用' : '尚无本地角色'));
    const sidebar = el('div', 'character-sidebar'), rosterHeading = el('div', 'character-list-heading');
    rosterHeading.append(el('h2', '', '选择角色'), el('span', 'character-count', String(this.state.characters.length)), btn('新建角色', () => this.send({type: 'creation'}), 'secondary-button character-create', this.state.storageStatus !== 'ready' || this.state.loadingSave));
    sidebar.append(rosterHeading, list);
    const selected = this.state.characters.find(c => c.id === this.selectedSaveId);
    const preview = el('div', 'character-preview'), figure = el('div', 'character-figure'), identity = el('div', 'character-identity');
    if (selected) {
      const def = getClass(selected.classId); preview.style.setProperty('--class-color', def.color);
      figure.append(portrait(selected.classId));
      const name = el('h2', '', selected.name); name.title = selected.name;
      identity.append(name, el('p', 'character-meta', `${def.name} · 等级 ${selected.level} · ${DIFFICULTY[selected.difficulty]}`));
    } else {
      figure.append(el('div', 'empty-sigil', 'VII'));
      identity.append(el('h2', '', '旅程尚未开始'), el('p', 'character-meta', '新建一个角色，踏入余烬之门。'));
    }
    const actions = el('div', 'character-actions');
    const disabled = !selected || this.state.storageStatus !== 'ready' || this.state.loadingSave;
    const remove = btn('', () => {
      if (selected && window.confirm(`永久删除“${selected.name}”（等级 ${selected.level} · ${getClass(selected.classId).name}）？\n该角色的本地存档无法恢复，其他角色不会受影响。`)) this.send({type: 'delete-character', id: selected.id});
    }, 'secondary-button character-delete', disabled);
    remove.setAttribute('aria-label', '删除'); remove.title = '删除角色';
    const trash = svgNode('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false', 'stroke-linecap': 'round' });
    svgPath(trash, 'M3 6H21M9 6V3H15V6M5 6L6 21H18L19 6M10 10V17M14 10V17', 'none', 'currentColor', '1.7');
    remove.append(trash);
    actions.append(btn('进入', () => {
      if (!selected) return;
      if (selected.unlockedDifficulties > 1) {
        const overlay = el('div', 'difficulty-overlay');
        const dialog = el('div', 'difficulty-dialog');
        dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-modal', 'true');
        dialog.append(el('h3', 'difficulty-dialog-title', '选择难度'));
        const DIFF_LABEL: Record<string, string> = { normal: '普通', nightmare: '噩梦', hell: '地狱' };
        const DIFF_DESC: Record<string, string> = { normal: '标准冒险体验', nightmare: '怪物更强，掉落更好', hell: '最高挑战，最佳掉落' };
        for (const d of ['normal', 'nightmare', 'hell'] as const) {
          const idx = (['normal','nightmare','hell'] as const).indexOf(d) + 1;
          const locked = idx > selected.unlockedDifficulties;
          const row = btn('', () => { if (!locked) { overlay.remove(); this.send({ type: 'continue', id: selected.id, difficulty: d }); } }, `difficulty-row${locked ? ' locked' : ''}`);
          row.disabled = locked;
          row.append(el('span', 'difficulty-row-name', DIFF_LABEL[d]), el('span', 'difficulty-row-desc', locked ? '尚未解锁' : DIFF_DESC[d]));
          dialog.append(row);
        }
        dialog.append(btn('取消', () => overlay.remove(), 'secondary-button difficulty-cancel'));
        overlay.append(dialog);
        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        this.screenLayer.querySelector('.character-roster')?.append(overlay);
      } else {
        this.send({ type: 'continue', id: selected.id });
      }
    }, 'primary-button', disabled), remove);
    preview.append(figure, identity, actions);
    const roster = el('div', 'character-roster'); roster.append(sidebar, preview);
    const status = el('p', this.state.storageError ? 'warning storage-status' : 'muted storage-status', this.state.storageError || (this.state.loadingSave ? '正在处理角色存档…' : this.state.storageStatus === 'loading' ? '正在读取本地存档…' : '存档仅保存在本浏览器，不跨设备同步')); status.setAttribute('role', 'status');
    const footer = el('footer', 'character-footer'); footer.append(status, el('p', 'title-disclaimer', '非官方规则重构 · 原创美术'));
    content.append(backdrop, header, roster, footer);
    this.screenLayer.replaceChildren(content);
    list.scrollTop = scrollTop; list.scrollLeft = scrollLeft;
    if (focusedSaveId) [...list.querySelectorAll<HTMLButtonElement>('[data-save-id]')].find(b => b.dataset.saveId === focusedSaveId)?.focus({preventScroll: true});
  }

  private referenceNote(...content: HTMLElement[]) {
    const note = el('details', 'reference-note'); note.append(el('summary', '', '规则与实现说明'), ...content); return note;
  }

  private buildCreation() {
    const section = el('section', 'creation-screen');
    const header = el('header', 'creation-header'); header.append(el('span', 'eyebrow', 'CHOOSE YOUR PATH'), el('h1', '', '选择你的旅人'), el('p', 'muted', '七种信念，同一片黑暗。'));
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
    detail(); section.append(header, cards, description, form, this.referenceNote(el('p', 'muted', '角色采用原创写实贴图，不使用原版素材。特殊技能行为逐步实现；技能树会明确标记可执行范围，未实现技能不可施放。'))); this.screenLayer.append(section);
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
    const base: unknown[] = [s.panel, this.selectedUid, this.selectedSkill, this.skillTree, this.bindRight, this.questAct, p.level, p.classId, p.difficulty, s.identifySource, s.paused, p.dead];
    if (['inventory', 'stash', 'cube', 'vendor', 'gamble'].includes(s.panel)) base.push(p.inventory, p.equipment, p.stash, p.cube, p.gold, p.weaponSwap, s.vendorItems, s.gamblingOffers.map(offer => [offer.uid, offer.code]), s.npc, s.dialogue, this.socketRune, s.stats?.strength, s.stats?.dexterity, s.selectedItem);
    if (s.panel === 'vendor' || s.panel === 'gamble') base.push(this.vendorFilter, this.tradeInventoryOpen, this.tradeView, this.selectedGambleOfferUid, this.gamblingResultUid, this.merchantPurchase, this.merchantServicesOpen);
    if (s.panel === 'character') base.push(s.stats, p.statPoints, p.skillPoints, p.experience);
    if (s.panel === 'skills') base.push(p.skills, p.skillPoints, p.leftSkill, p.rightSkill, p.equipment, p.weaponSwap, p.inventory, s.shrineBuff?.code, this.hotkeys, s.stats, this.skillDetailOpen);
    if (s.panel === 'quests') base.push(p.quests, p.unlockedActs);
    if (s.panel === 'waypoint') base.push(this.waypointAct, p.waypoints, p.unlockedActs, p.unlockedDifficulties, s.area?.def.id);
    return JSON.stringify(base);
  }

  private isTrading() { return this.state.screen === 'game' && (this.state.panel === 'vendor' && !!NPCS[this.state.npc ?? '']?.services.includes('trade') || this.state.panel === 'gamble' && this.state.npc === 'gheed'); }

  private updatePanelButtons() {
    for (const node of this.hud.querySelectorAll<HTMLButtonElement>('[data-panel]')) {
      const active = node.dataset.panel === this.state.panel || node.dataset.panel === 'inventory' && this.isTrading() && this.tradeInventoryOpen;
      node.classList.toggle('active', active); node.setAttribute('aria-expanded', String(active));
    }
  }

  private saveTradeScroll() {
    const workspace = this.panelLayer.querySelector<HTMLElement>('.trade-workspace');
    if (!workspace) return;
    for (const node of [workspace, ...workspace.querySelectorAll<HTMLElement>('.panel-body[data-scroll]')]) {
      if (node.dataset.scroll && node.getClientRects().length) this.tradeScroll.set(node.dataset.scroll, { top: node.scrollTop, left: node.scrollLeft });
    }
  }

  private restoreTradeScroll() {
    const workspace = this.panelLayer.querySelector<HTMLElement>('.trade-workspace');
    if (!workspace) return;
    workspace.dataset.scroll = `trade-workspace:${this.tradeView}`;
    for (const node of [workspace, ...workspace.querySelectorAll<HTMLElement>('.panel-body[data-scroll]')]) {
      if (!node.getClientRects().length) continue;
      const scroll = this.tradeScroll.get(node.dataset.scroll!);
      node.scrollTop = scroll?.top ?? 0; node.scrollLeft = scroll?.left ?? 0;
    }
  }

  private maintainMerchantLayout(revealFocus = false) {
    const body = this.panelLayer.querySelector<HTMLElement>('.panel-vendor .panel-body');
    const toolbar = body?.querySelector<HTMLElement>('.merchant-toolbar');
    const stock = body?.querySelector<HTMLElement>('.merchant-stock');
    const service = toolbar?.querySelector<HTMLDetailsElement>('.merchant-services');
    if (!body?.clientHeight || !toolbar || !stock || !service) return;
    const focused = document.activeElement instanceof HTMLElement && stock.contains(document.activeElement) ? document.activeElement : null;
    const row = focused?.closest<HTMLElement>('.vendor-row') ?? stock.querySelector<HTMLElement>('.vendor-row');
    // Measure live services and shelf height; short viewports let the toolbar flow away.
    toolbar.classList.toggle('merchant-toolbar-flow', service.open && toolbar.offsetHeight + (row?.offsetHeight ?? 0) + 8 > body.clientHeight);
    if (!revealFocus || !focused) return;
    const viewport = body.getBoundingClientRect(), target = focused.getBoundingClientRect();
    const top = Math.max(0, viewport.top, toolbar.classList.contains('merchant-toolbar-flow') ? viewport.top : toolbar.getBoundingClientRect().bottom) + 4;
    const bottom = Math.min(innerHeight, viewport.bottom) - 4;
    if (target.top < top) body.scrollTop -= top - target.top;
    else if (target.bottom > bottom) body.scrollTop += target.bottom - bottom;
  }

  private toggleTradeInventory() {
    this.saveTradeScroll(); this.resetControls(); this.cancelItemDrag(); this.closeItemPopup(); this.clearActionFeedback(); this.tradeInventoryOpen = !this.tradeInventoryOpen;
    if (!this.tradeInventoryOpen) { this.setInventoryArranging(false); this.send({ type: 'cancel-identify' }); }
    this.tradeView = this.tradeInventoryOpen ? 'inventory' : 'vendor'; this.invalidatePanel(); this.updatePanelButtons();
    this.panelLayer.querySelector<HTMLElement>(`[data-focus="trade-view:${this.tradeView}"]`)?.focus({ preventScroll: true });
  }

  private showTradeView(view: 'vendor' | 'inventory') {
    this.saveTradeScroll(); this.resetControls(); this.cancelItemDrag(); this.closeItemPopup(); this.clearActionFeedback(); this.hideTooltip(); this.tradeView = view;
    if (view === 'vendor') this.setInventoryArranging(false);
    if (view === 'inventory' && !this.tradeInventoryOpen) { this.tradeInventoryOpen = true; this.invalidatePanel(); }
    else {
      this.panelLayer.dataset.tradeView = view;
      for (const button of this.panelLayer.querySelectorAll<HTMLButtonElement>('[data-trade-view]')) {
        const active = button.dataset.tradeView === view; button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
      }
      this.restoreTradeScroll(); this.panelSignature = this.getPanelSignature();
    }
    this.panelLayer.querySelector<HTMLElement>(`[data-focus="trade-view:${view}"]`)?.focus({ preventScroll: true });
    this.updatePanelButtons();
  }

  private buyItem(item: Item) {
    const p = this.state.player!, gold = p.gold;
    const before = new Map(p.inventory.map(i => [i.uid, i.quantity]));
    const beltBefore = new Map(p.belt.filter((i): i is Item => !!i).map(i => [i.uid, i.quantity]));
    this.saveTradeScroll(); this.closeItemPopup(); this.merchantPurchase = null;
    this.send({ type: 'buy', uid: item.uid });
    if (!this.isTrading()) return;
    const changed = (i: Item, snapshot: Map<string, number>) => i.code === item.code && (!snapshot.has(i.uid) || i.quantity > snapshot.get(i.uid)!);
    const purchased = p.inventory.find(i => changed(i, before));
    const beltItem = p.belt.find(i => i && changed(i, beltBefore));
    // Potions may go to the belt first. Report the actual destination, never infer success from the offer.
    if (p.gold < gold && (purchased || beltItem)) {
      const actual = purchased ?? beltItem!;
      this.merchantPurchase = { uid: actual.uid, label: itemLabel(actual), location: purchased ? 'inventory' : 'belt' };
      if (purchased && !window.matchMedia('(max-width: 1000px)').matches) this.selectedUid = purchased.uid;
    }
    this.invalidatePanel(); this.updatePanelButtons();
  }

  private renderTradePanels() {
    const gambling = this.state.panel === 'gamble', merchantLabel = gambling ? '赌博' : '商店';
    const workspace = el('div', `trade-workspace${this.tradeInventoryOpen ? '' : ' trade-bag-closed'}`); workspace.dataset.scroll = `trade-workspace:${this.tradeView}`; this.panelLayer.append(workspace);
    const nav = el('nav', 'trade-switcher'); nav.setAttribute('aria-label', '交易窗口切换');
    for (const [view, label] of [['vendor', merchantLabel], ['inventory', this.tradeInventoryOpen ? '背包 · I' : '打开背包 · I']] as const) {
      const button = btn(label, () => this.showTradeView(view), `tab-button${this.tradeView === view ? ' active' : ''}`);
      button.dataset.tradeView = view; button.dataset.focus = `trade-view:${view}`; button.setAttribute('aria-pressed', String(this.tradeView === view)); nav.append(button);
    }
    workspace.append(nav);
    for (const kind of ['vendor', 'inventory'] as const) {
      if (kind === 'inventory' && !this.tradeInventoryOpen) continue;
      const title = kind === 'vendor' ? `${NPCS[this.state.npc ?? '']?.name ?? '商人'} · ${merchantLabel}` : PANEL_NAMES.inventory;
      const frame = el('section', `gothic-panel panel-${kind}${kind === 'inventory' ? ' trade-inventory' : ''}`); frame.setAttribute('aria-label', title);
      const heading = el('div', 'panel-heading'); heading.append(el('span', 'panel-inscription', kind === 'vendor' ? '交易' : '装备'), el('h2', '', title));
      const close = btn('关闭 ×', () => kind === 'inventory' ? this.toggleTradeInventory() : this.send({ type: 'panel', panel: 'none' }), 'close-button');
      close.dataset.focus = `trade-close:${kind}`; close.setAttribute('aria-label', kind === 'vendor' ? `关闭${merchantLabel}，结束交易并返回场景` : `关闭背包，保留${merchantLabel}`);
      const header = el('header', 'panel-header'); header.append(heading, close);
      const body = el('div', 'panel-body'); body.dataset.scroll = kind === 'vendor' && !gambling ? `panel:vendor:${this.vendorFilter}` : `panel:${kind}`;
      if (kind === 'vendor') { if (gambling) this.gamblingPanel(body); else this.vendorPanel(body); } else this.inventoryPanel(body);
      frame.append(header, body); workspace.append(frame);
    }
  }

  private invalidatePanel() { this.panelSignature = ''; this.renderPanel(); this.panelSignature = this.getPanelSignature(); }

  private renderPanel() {
    const panel = this.state.panel;
    this.saveTradeScroll();
    const oldScroll = new Map<string, { top: number; left: number }>();
    for (const node of this.panelLayer.querySelectorAll<HTMLElement>('[data-scroll]')) oldScroll.set(node.dataset.scroll!, { top: node.scrollTop, left: node.scrollLeft });
    const focus = this.panelLayer.contains(document.activeElement) ? (document.activeElement as HTMLElement)?.dataset.focus : undefined;
    this.cancelItemDrag(); this.hideTooltip(); this.panelLayer.replaceChildren();
    this.panelLayer.classList.toggle('trade-mode', this.isTrading()); this.panelLayer.dataset.tradeView = this.tradeView;
    if (panel === 'none' || !this.state.player) return;
    if (this.isTrading()) this.renderTradePanels();
    else this.renderSinglePanel(panel);
    // Establish toolbar layout before restoring scroll; rebuilding is not focus navigation.
    this.maintainMerchantLayout();
    for (const node of this.panelLayer.querySelectorAll<HTMLElement>('[data-scroll]')) { const scroll = oldScroll.get(node.dataset.scroll!); node.scrollTop = scroll?.top ?? 0; node.scrollLeft = scroll?.left ?? 0; }
    if (this.isTrading()) this.restoreTradeScroll();
    if (focus) {
      const nodes = [...this.panelLayer.querySelectorAll<HTMLElement>('[data-focus]')];
      const restored = nodes.find(node => node.dataset.focus === focus && !node.matches(':disabled') && node.getClientRects().length);
      this.restoringTradeFocus = true;
      try { (restored ?? (this.isTrading() ? nodes.find(node => node.dataset.focus === `trade-view:${this.tradeView}`) : undefined))?.focus({ preventScroll: true }); }
      finally { this.restoringTradeFocus = false; }
    }
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
      case 'skills': {
        const entering = !this.skillReturnFocus || this.hud.contains(document.activeElement) || document.activeElement === this.canvas;
        if (entering) {
          this.skillReturnFocus = document.activeElement instanceof HTMLElement && this.hud.contains(document.activeElement) ? document.activeElement : this.hud.querySelector<HTMLElement>('[data-panel="skills"]');
          this.skillFeedback = '';
        }
        frame.setAttribute('role', 'dialog'); frame.setAttribute('aria-modal', 'true');
        const returnFocus = () => {
          const target = this.skillReturnFocus;
          this.skillReturnFocus = null;
          if (!this.state.paused && !this.state.player?.dead && target?.isConnected) target.focus({ preventScroll: true });
        };
        close.addEventListener('click', returnFocus);
        frame.addEventListener('keydown', event => {
          if (this.state.paused || this.state.player?.dead || event.metaKey || event.ctrlKey || event.altKey) return;
          if (event.key === 'Escape' || event.key.toLowerCase() === 't') {
            event.preventDefault(); event.stopPropagation();
            if (!event.repeat) { this.send({ type: 'panel', panel: 'none' }); returnFocus(); }
          } else if (event.key === 'Tab') {
            event.stopPropagation();
            const controls = [...frame.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]')].filter(node => node.getClientRects().length > 0);
            const index = controls.indexOf(document.activeElement as HTMLElement);
            if (index < 0 || event.shiftKey && index === 0 || !event.shiftKey && index === controls.length - 1) {
              event.preventDefault(); controls[event.shiftKey ? controls.length - 1 : 0]?.focus({ preventScroll: true });
            }
          }
        });
        this.skillsPanel(body);
        queueMicrotask(() => { if (frame.isConnected && !this.state.paused && !this.state.player?.dead && !frame.contains(document.activeElement)) close.focus({ preventScroll: true }); });
        break;
      }
      case 'quests': this.questsPanel(body); break;
      case 'stash': case 'cube': this.storagePanel(body, panel); break;
      case 'vendor': this.vendorPanel(body); break;
      case 'gamble': this.gamblingPanel(body); break;
      case 'waypoint': this.waypointPanel(body); break;
      case 'help': this.helpPanel(body); break;
      case 'catalog': this.catalogPanel(body); break;
    }
    this.panelLayer.append(frame);
  }

  private grid(items: Item[], columns: number, rows: number, location: 'inventory' | 'stash' | 'cube') {
    const grid = el('div', 'item-grid'); grid.style.setProperty('--columns', String(columns)); grid.style.setProperty('--rows', String(rows)); grid.dataset.location = location; grid.setAttribute('aria-label', `${location === 'inventory' ? '背包' : location === 'stash' ? '储物箱' : '方块'} ${columns} × ${rows}`);
    for (const item of items) {
      let identifyingClick = false;
      const b = this.itemButton(item, event => {
        if (event.detail > 1) return;
        const source = location === 'inventory' ? this.state.identifySource : null;
        identifyingClick = source !== null; this.selectItem(item.uid);
        if (source !== null) this.useInventoryItem(source, item.uid);
      }); b.classList.add('grid-item');
      b.style.gridColumn = `${item.x + 1} / span ${item.width}`; b.style.gridRow = `${item.y + 1} / span ${item.height}`;
      if (location === 'inventory') this.installItemDrag(b, grid, item);
      if (location !== 'inventory' || !isUsableItem(item)) b.addEventListener('dblclick', () => {
        if (identifyingClick || this.state.identifySource) return;
        this.send(location === 'inventory' ? { type: 'equip', uid: item.uid } : { type: 'storage', uid: item.uid, destination: 'inventory' });
      });
      grid.append(b);
    }
    if (location === 'inventory') grid.addEventListener('contextmenu', event => {
      event.preventDefault(); event.stopPropagation();
      if (this.lastItemPointer === 'touch' || this.drag?.active || this.state.paused || this.state.player?.dead) return;
      this.closeItemPopup(); this.hideTooltip();
      if (this.state.identifySource !== null) { this.send({ type: 'cancel-identify' }); this.invalidatePanel(); return; }
      const button = (event.target as HTMLElement).closest<HTMLElement>('.item-button');
      const uid = button?.dataset.uid, item = this.state.player?.inventory.find(item => item.uid === uid);
      if (!item) return;
      this.selectItem(item.uid);
      if (getBase(item.code)?.slot) {
        this.send({ type: 'equip', uid: item.uid });
        if (this.panelSignature !== this.getPanelSignature()) this.invalidatePanel();
      } else if (isUsableItem(item)) this.useInventoryItem(item.uid);
    });
    const scroll = el('div', 'grid-scroll'); scroll.dataset.scroll = `grid:${location}`;
    scroll.append(grid); return scroll;
  }

  private useInventoryItem(uid: string, targetUid?: string) {
    this.send({ type: 'use-item', uid, targetUid });
    if (targetUid === undefined && this.state.identifySource === uid) this.closeItemPopup();
    if (this.panelSignature !== this.getPanelSignature()) this.invalidatePanel();
    this.refreshItemPopup();
  }

  private selectItem(uid: string | null) {
    this.selectedUid = uid;
    if (this.popup?.uid !== uid) this.closeItemPopup();
    for (const node of this.panelLayer.querySelectorAll<HTMLElement>('.item-button')) {
      const selected = node.dataset.focus === `item:${uid}`;
      node.classList.toggle('selected', selected); node.setAttribute('aria-pressed', String(selected));
    }
    // Selection never rebuilds either trade window or moves its scroll position.
    const focus = (document.activeElement as HTMLElement | null)?.dataset.focus;
    const scroll = [...this.panelLayer.querySelectorAll<HTMLElement>('[data-scroll]')].map(node => ({ node, top: node.scrollTop, left: node.scrollLeft }));
    if (focus) [...this.panelLayer.querySelectorAll<HTMLElement>('[data-focus]')].find(node => node.dataset.focus === focus)?.focus({ preventScroll: true });
    for (const entry of scroll) { entry.node.scrollTop = entry.top; entry.node.scrollLeft = entry.left; }
    this.panelSignature = this.getPanelSignature();
  }

  private itemButton(item: Item, select: (event: MouseEvent) => void = () => this.selectItem(item.uid)) {
    const b = btn('', event => {
      const identifying = this.state.identifySource !== null;
      select(event);
      if (!identifying && event.detail <= 1 && !this.drag?.active && !(this.suppressDragClick && performance.now() < this.suppressItemUntil)) {
        const rect = b.getBoundingClientRect(), x = event.detail === 0 ? rect.right : event.clientX, y = event.detail === 0 ? rect.top : event.clientY;
        // Keep the second desktop click available for existing equip/unequip double-click actions.
        if (this.lastItemPointer !== 'touch' && event.detail > 0) {
          this.itemPopupTimer = setTimeout(() => { this.itemPopupTimer = null; this.openItemPopup(item.uid, x, y); }, 240);
        } else this.openItemPopup(item.uid, x, y);
      }
    }, `item-button quality-${item.quality}${this.selectedUid === item.uid ? ' selected' : ''}`);
    const tome = item.code === 'tbk' || item.code === 'ibk';
    b.dataset.uid = item.uid; b.dataset.focus = `item:${item.uid}`; b.setAttribute('aria-label', `${itemLabel(item)}${tome ? ` · 卷轴 ${item.quantity}/${TOME_CAPACITY}` : ''}`); b.setAttribute('aria-pressed', String(this.selectedUid === item.uid)); b.append(itemSprite(item));
    const rune = RUNES.find(r => r.code === item.code), gem = GEMS.find(g => g.code === item.code);
    if (rune) b.append(el('span', 'item-rank rune-number', String(rune.number)));
    else if (gem) b.append(el('span', 'item-rank gem-grade', `${gem.grade + 1}/5`));
    if (tome || item.quantity > 1) b.append(el('span', `item-quantity${tome ? ' tome-quantity' : ''}`, tome ? `${item.quantity}/${TOME_CAPACITY}` : String(item.quantity)));
    if (item.sockets > 0) b.append(el('span', 'socket-count', `${item.socketed.length}/${item.sockets}`));
    this.itemTooltip(b, item); return b;
  }

  private setInventoryArranging(arranging: boolean) {
    this.cancelItemDrag(); this.inventoryArranging = arranging;
    this.root.classList.toggle('is-inventory-arranging', arranging);
    for (const button of this.panelLayer.querySelectorAll<HTMLButtonElement>('.inventory-arrange')) {
      button.setAttribute('aria-pressed', String(arranging)); button.textContent = arranging ? '完成整理' : '整理物品';
    }
  }

  private inventoryTools() {
    const tools = el('div', 'inventory-tools');
    const arrange = btn(this.inventoryArranging ? '完成整理' : '整理物品', () => { this.closeItemPopup(); this.setInventoryArranging(!this.inventoryArranging); }, 'secondary-button inventory-arrange', this.state.paused || !!this.state.player?.dead);
    arrange.dataset.focus = 'inventory-arrange'; arrange.setAttribute('aria-pressed', String(this.inventoryArranging));
    const identifying = this.state.identifySource !== null;
    if (!identifying) tools.append(arrange);
    tools.append(el('span', 'muted', identifying ? '点选未鉴定物品，或取消鉴定。' : '滑动浏览，轻点看属性；按住物品拖动或拖卷入书。'));
    if (identifying) {
      const cancel = btn('取消鉴定', () => { this.send({ type: 'cancel-identify' }); this.invalidatePanel(); }, 'secondary-button'); cancel.dataset.focus = 'cancel-identify'; tools.append(cancel);
    }
    return tools;
  }

  private inventoryPanel(body: HTMLElement) {
    const p = this.state.player!;
    const layout = el('div', 'inventory-layout'), equipment = el('div', 'equipment-column');
    equipment.append(el('div', 'section-caption', '装备 · 双击穿戴 / 点击查看'));
    const paperdoll = el('div', 'paperdoll'); paperdoll.append(portrait(p.classId));
    const weaponTabs = el('div', 'weapon-set-tabs'); weaponTabs.setAttribute('role', 'tablist'); weaponTabs.setAttribute('aria-label', '武器组');
    const primaryWeapon = btn('主武器', () => { if (p.weaponSwap) this.send({ type: 'swap' }); }, `weapon-set-tab${p.weaponSwap ? '' : ' active'}`, this.state.paused || p.dead);
    const secondaryWeapon = btn('副武器', () => { if (!p.weaponSwap) this.send({ type: 'swap' }); }, `weapon-set-tab${p.weaponSwap ? ' active' : ''}`, this.state.paused || p.dead);
    primaryWeapon.setAttribute('role', 'tab'); primaryWeapon.setAttribute('aria-selected', String(!p.weaponSwap)); primaryWeapon.title = '主武器组 · 快捷键 X';
    secondaryWeapon.setAttribute('role', 'tab'); secondaryWeapon.setAttribute('aria-selected', String(p.weaponSwap)); secondaryWeapon.title = '副武器组 · 快捷键 X';
    weaponTabs.append(primaryWeapon, secondaryWeapon); paperdoll.append(weaponTabs);
    const slots: Slot[] = ['head', 'neck', 'body', 'weapon', 'offhand', 'gloves', 'belt', 'boots', 'ring1', 'ring2', 'weapon2', 'offhand2'];
    for (const slot of slots) {
      const item = p.equipment[slot], wrap = el('div', `equipment-slot slot-${slot}${p.weaponSwap && ['weapon2', 'offhand2'].includes(slot) || !p.weaponSwap && ['weapon', 'offhand'].includes(slot) ? ' active-weapon' : ''}`);
      wrap.dataset.slot = slot;
      if (item) { const b = this.itemButton(item); b.addEventListener('dblclick', () => this.send({ type: 'unequip', slot })); wrap.append(b); }
      else { const b = btn('', () => this.selectItem(null), 'empty-slot'); b.setAttribute('aria-label', `${SLOT_NAMES[slot]}：未装备`); b.title = `${SLOT_NAMES[slot]}：未装备`; wrap.append(b); }
      wrap.append(el('span', 'slot-label', SLOT_NAMES[slot])); paperdoll.append(wrap);
    }
    equipment.append(paperdoll);
    const bag = el('div', 'bag-column');
    if (this.isTrading() && !window.matchMedia('(max-width: 1000px)').matches) { const sale = el('div', 'sell-dropzone', '拖到此处出售 · 松手确认'); sale.dataset.sellDropzone = 'inventory'; sale.setAttribute('aria-label', '背包物品出售区域'); bag.append(sale); }
    bag.append(el('div', 'section-caption', `行囊 · ${INVENTORY_WIDTH} × ${INVENTORY_HEIGHT}`), this.inventoryTools(), this.grid(p.inventory, INVENTORY_WIDTH, INVENTORY_HEIGHT, 'inventory'), el('div', 'gold-line', `${p.gold.toLocaleString()} 金币`));
    const buttons = el('div', 'button-row'); buttons.append(btn('赫拉迪克方块', () => this.send({ type: 'panel', panel: 'cube' }), 'secondary-button', !this.ownsCube()), btn('回城卷轴', () => this.send({ type: 'portal' }), 'secondary-button'));
    bag.append(buttons, el('p', 'muted', '点击查看属性与操作 · 鼠标右键装备 / 使用，双击装备 / 卸下。')); layout.append(equipment, bag); body.append(layout);
  }

  private selectedItem(): { item: Item; location: 'inventory' | 'stash' | 'cube' | 'equipment' | 'vendor'; slot?: Slot } | null {
    const p = this.state.player!;
    for (const location of ['inventory', 'stash', 'cube'] as const) { const item = p[location].find(i => i.uid === this.selectedUid); if (item) return { item, location }; }
    for (const [slot, item] of Object.entries(p.equipment)) if (item && item.uid === this.selectedUid) return { item, location: 'equipment', slot: slot as Slot };
    const item = this.state.vendorItems.find(i => i.uid === this.selectedUid); return item ? { item, location: 'vendor' } : null;
  }

  private itemDetail() {
    const detail = el('section', 'item-detail'), selected = this.selectedItem();
    if (!selected) return detail;
    const { item, location, slot } = selected, p = this.state.player!, base = getBase(item.code), label = itemLabel(item), blocked = this.state.paused || p.dead;
    const heading = el('header', 'item-detail-heading'), icon = el('div', `item-detail-icon quality-${item.quality}`), title = el('div', 'item-detail-title');
    icon.append(itemSprite(item)); icon.setAttribute('aria-hidden', 'true');
    const name = el('h3', `quality-${item.quality}`, label); name.id = 'item-popup-name';
    const tome = item.code === 'tbk' || item.code === 'ibk';
    title.append(name, el('span', 'muted', `${{ inventory: '行囊', stash: '储物箱', cube: '方块', equipment: '已装备', vendor: '商店 · 未购买' }[location]}${tome ? ` · 卷轴 ${item.quantity}/${TOME_CAPACITY}` : ''}`));
    heading.append(icon, title); detail.append(heading);
    const properties = el('div', 'item-properties'), rows = this.itemProperties(item);
    // Only the leading, identical label is redundant; base names and all attributes stay.
    if (rows[0]?.textContent === label) rows.shift();
    properties.append(...rows, el('p', 'item-detail-meta muted', `占用 ${item.width} × ${item.height} · 物品等级 ${item.ilvl}${item.ethereal ? ' · 无形' : ''}${item.runeword ? ` · ${runewordName(item.runeword)}` : ''}`));
    detail.append(properties);
    const actions = el('footer', 'item-actions item-popup-actions'); actions.setAttribute('role', 'group'); actions.setAttribute('aria-label', `${label}主要操作`);
    const more = el('details', 'item-more'); more.open = this.moreExpandedUid === item.uid;
    const summary = el('summary', '', '更多操作'); summary.dataset.focus = `more-toggle:${item.uid}`; more.append(summary);
    more.addEventListener('toggle', () => {
      if (!more.isConnected) return;
      if (more.open) this.moreExpandedUid = item.uid; else if (this.moreExpandedUid === item.uid) this.moreExpandedUid = '';
    });
    const secondary = el('div', 'item-secondary-actions');
    const addAction = (group: HTMLElement, text: string, key: string, fn: () => void, primary = false, disabled = false) => {
      const button = btn(text, () => { if (!this.state.paused && !this.state.player?.dead) fn(); }, primary ? 'primary-button' : 'secondary-button', blocked || disabled);
      button.dataset.focus = `${key}:${item.uid}`; group.append(button); return button;
    };
    const pricedAction = (text: string, price: number | null, key: string, fn: () => void, primary = false) => {
      const button = addAction(actions, '', key, fn, primary, price === null);
      button.append(el('span', 'item-action-label', price === null ? '不可出售' : text));
      if (price !== null) button.append(el('span', 'item-action-price', `${price.toLocaleString()} 金币`));
      button.setAttribute('aria-label', price === null ? '不可出售' : `${text} · ${price.toLocaleString()} 金币`); return button;
    };
    if (location === 'vendor') {
      pricedAction('购买', item.price, 'buy', () => this.buyItem(item), true);
      if (p.gold < item.price) detail.append(el('p', 'item-context-note', '金币不足，购买不会扣款。'));
    } else if (location === 'equipment' && slot) {
      addAction(actions, '卸下', 'unequip', () => this.send({ type: 'unequip', slot }), true);
    } else if (location === 'inventory') {
      if (base?.slot) addAction(actions, '装备', 'equip', () => this.send({ type: 'equip', uid: item.uid }), true);
      else if (isUsableItem(item)) addAction(actions, '使用', 'use', () => this.useInventoryItem(item.uid), true);
      if (this.isTrading()) pricedAction('出售', this.sellPrice(item), 'sell', () => this.send({ type: 'sell', uid: item.uid }));
      else addAction(actions, '丢弃', 'drop', () => this.send({ type: 'drop', uid: item.uid })).classList.add('item-discard');
      if (!item.identified) addAction(secondary, '鉴定', 'identify', () => {
        const source = this.state.identifySource;
        if (source !== null) this.useInventoryItem(source, item.uid); else this.send({ type: 'identify', uid: item.uid });
      });
      if (this.nearFacility('stash')) addAction(secondary, '存入仓库', 'stash', () => { if (this.state.panel !== 'stash') this.send({ type: 'panel', panel: 'stash' }); this.send({ type: 'storage', uid: item.uid, destination: 'stash' }); });
      if (this.ownsCube() && item.code !== 'box') addAction(secondary, '放入方块', 'cube', () => this.send({ type: 'storage', uid: item.uid, destination: 'cube' }));
      if (secondary.childElementCount) more.append(secondary);
      if (item.sockets > item.socketed.length) {
        const candidates = p.inventory.filter(i => i.uid !== item.uid && (RUNES.some(r => r.code === i.code) || GEMS.some(g => g.code === i.code) || /gem|jewel|宝石|珠宝/.test(`${getBase(i.code)?.type} ${getBase(i.code)?.name}`)));
        const sockets = el('section', 'item-sockets'); sockets.setAttribute('aria-label', '永久镶嵌');
        const caption = el('h4', '', `镶嵌 · ${item.sockets - item.socketed.length} 个空余凹槽`);
        const socketRow = el('div', 'socket-row'), select = el('select'); select.setAttribute('aria-label', '选择镶嵌符文或宝石'); select.dataset.focus = 'socket-select'; select.disabled = blocked;
        select.append(new Option('选择符文 / 宝石', '')); for (const rune of candidates) select.append(new Option(itemLabel(rune), rune.uid));
        if (candidates.some(i => i.uid === this.socketRune)) select.value = this.socketRune;
        const socketButton = addAction(socketRow, '永久镶嵌', 'socket', () => { if (select.value) this.send({ type: 'socket', itemUid: item.uid, runeUid: select.value }); }, false, !select.value);
        select.addEventListener('change', () => {
          this.socketRune = select.value; socketButton.disabled = blocked || !select.value;
          // Keep the native select and its focus alive; the current DOM already reflects the choice.
          if (this.popup?.uid === item.uid) this.popup.signature = JSON.stringify([item, this.getPanelSignature()]);
        });
        socketRow.prepend(select); sockets.append(caption, socketRow, el('p', 'warning', '永久消耗，顺序不可逆。符文之语需匹配底材、孔数与符文顺序。'));
        if (!candidates.length) sockets.append(el('p', 'item-context-note muted', '行囊中没有可选择的符文或宝石。')); more.append(sockets);
      }
      const notes: string[] = [];
      if (!this.nearFacility('stash')) notes.push('存仓需靠近储物箱');
      if (!this.ownsCube()) notes.push('方块操作需先获得方块');
      if (notes.length) more.append(el('p', 'item-context-note muted', notes.join(' · ')));
      if (more.children.length > 1) detail.append(more);
    } else addAction(actions, '取回', 'retrieve', () => this.send({ type: 'storage', uid: item.uid, destination: 'inventory' }), true);
    if (this.state.identifySource !== null) {
      const cancel = addAction(actions, '取消鉴定', 'cancel-identify', () => { this.send({ type: 'cancel-identify' }); this.invalidatePanel(); }); cancel.dataset.focus = 'cancel-identify';
    }
    detail.append(actions); return detail;
  }

  private sellPrice(item: Item) { return itemSellPrice(item, this.state.player!.difficulty, this.state.area?.def.act ?? 1); }

  private ownsCube() { return !!this.state.player?.inventory.some(i => i.code === 'box'); }
  private nearFacility(kind: 'stash' | 'npc') { const p = this.state.player; return !!p && !!this.state.area?.objects.some(o => o.kind === kind && Math.hypot(o.x - p.x, o.y - p.y) <= 3); }

  private storagePanel(body: HTMLElement, destination: 'stash' | 'cube') {
    const p = this.state.player!, layout = el('div', 'storage-layout'), store = el('div', 'storage-column'), bag = el('div', 'bag-column');
    if (destination === 'cube' && !this.ownsCube()) { body.append(el('p', 'warning', '尚未获得赫拉迪克方块。请在旅途中寻找；不能凭空使用方块。'), btn('查看背包', () => this.send({ type: 'panel', panel: 'inventory' }), 'secondary-button')); return; }
    if (destination === 'stash' && !this.nearFacility('stash')) { body.append(el('p', 'warning', '储物箱在营地中。靠近并点击箱子后才能访问。')); return; }
    store.append(el('div', 'section-caption', destination === 'stash' ? `私人仓库 · ${STASH_WIDTH} × ${STASH_HEIGHT}` : '方块容器 · 3 × 4'), this.grid(p[destination], destination === 'stash' ? STASH_WIDTH : 3, destination === 'stash' ? STASH_HEIGHT : 4, destination));
    if (destination === 'cube') store.append(btn('转化', () => this.send({ type: 'transmute' }), 'primary-button'), el('p', 'muted', '仅已实现且材料匹配的配方可转化；失败不会凭空产出物品。'));
    bag.append(el('div', 'section-caption', '行囊 · 点击查看 / 双击装备'), this.inventoryTools(), this.grid(p.inventory, INVENTORY_WIDTH, INVENTORY_HEIGHT, 'inventory')); layout.append(store, bag); body.append(layout);
    if (destination === 'cube') {
      const recipes = el('details', 'reference-details'); recipes.append(el('summary', '', '符文与符文之语 · 数据参考'));
      recipes.append(el('p', 'muted', `收录符文 ${Array.isArray(RUNES) ? RUNES.length : Object.keys(RUNES).length} 种，符文之语 ${Array.isArray(RUNEWORDS) ? RUNEWORDS.length : Object.keys(RUNEWORDS).length} 种。数据收录不代表所有附加属性已实现。`)); body.append(recipes);
    }
  }

  private characterPanel(body: HTMLElement) {
    const p = this.state.player!, stats = this.state.stats!;
    const heading = el('div', 'character-heading'); heading.append(portrait(p.classId), el('div', '', `${p.name} · ${getClass(p.classId).name} · 等级 ${p.level}`)); body.append(heading);
    body.append(el('div', 'point-budget', `未分配属性点 ${p.statPoints} · 未分配技能点 ${p.skillPoints}`), el('p', 'muted', '每级获得 5 属性点与 1 技能点。'));
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
    body.append(resists, el('p', 'muted', '噩梦抗性惩罚 −40，地狱 −100；一般抗性上限 75%。奔跑影响防御与格挡。'), this.referenceNote(el('p', 'muted', '任务奖励以引擎实际状态为准；数据收录不代表所有词缀与特殊技能行为已实现。')));
  }

  private skillName(id: number) { return id === 0 ? '普通攻击' : getSkill(id)?.name || '普通攻击'; }

  private bindSkill(skillId: number, right = this.bindRight) {
    const p = this.state.player;
    if (!p || this.state.paused || p.dead) return;
    if (skillId !== 0) {
      const effect = skillEffect(p, skillId);
      if (!getSkill(skillId)?.supported || !effect.supported || skillLevel(p, skillId) <= 0 || effect.kind === 'passive') return;
    }
    this.send({ type: 'bind', skillId, right });
    if (p[right ? 'rightSkill' : 'leftSkill'] === skillId) {
      this.skillFeedback = `已绑定${right ? '右键' : '左键'}：${this.skillName(skillId)}`;
      if (this.state.panel === 'skills') this.invalidatePanel();
    }
  }

  private skillsPanel(body: HTMLElement) {
    body.dataset.scroll = this.skillDetailOpen ? 'skill-detail-page' : `skill-tree-page:${this.skillTree}`;
    const p = this.state.player!, def = getClass(p.classId), classSkills = SKILLS.filter(s => s.classId === p.classId);
    const summary = el('div', 'skill-summary');
    summary.append(el('div', 'point-budget', `剩余技能点 ${p.skillPoints} · 角色等级 ${p.level}`), el('p', 'skill-current-bindings', `左键：${this.skillName(p.leftSkill)} · 右键：${this.skillName(p.rightSkill)}`));
    const slotbar = el('div', 'skill-bind-bar');
    slotbar.setAttribute('role', 'group'); slotbar.setAttribute('aria-label', '普通攻击绑定');
    for (const right of [false, true]) {
      const button = btn(`普通攻击 → ${right ? '右键' : '左键'}`, () => this.bindSkill(0, right), 'secondary-button', this.state.paused || p.dead);
      button.dataset.focus = `skill-basic:${right ? 'right' : 'left'}`;
      button.setAttribute('aria-pressed', String(p[right ? 'rightSkill' : 'leftSkill'] === 0)); slotbar.append(button);
    }
    summary.append(slotbar);
    const feedback = el('p', 'skill-feedback', this.skillFeedback); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite'); summary.append(feedback);
    body.append(summary);
    const tabs = el('div', 'panel-tabs skill-tabs');
    tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '技能系别');
    def.trees.forEach((name, i) => {
      const tab = btn(name, () => { this.skillTree = i; this.skillDetailOpen = false; this.skillTreeScroll = 0; this.invalidatePanel(); }, `tab-button${this.skillTree === i ? ' active' : ''}`);
      tab.dataset.focus = `skill-tree:${i}`; tab.id = `skill-tree-tab-${i}`; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-selected', String(this.skillTree === i)); tab.setAttribute('aria-controls', 'skill-tree-content'); tab.tabIndex = this.skillTree === i ? 0 : -1; tabs.append(tab);
    });
    tabs.addEventListener('keydown', event => {
      if (this.state.paused || p.dead || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault(); event.stopPropagation();
      const count = def.trees.length;
      this.skillTree = event.key === 'Home' ? 0 : event.key === 'End' ? count - 1 : (this.skillTree + (event.key === 'ArrowRight' ? 1 : count - 1)) % count;
      this.skillDetailOpen = false; this.skillTreeScroll = 0; this.invalidatePanel();
      this.panelLayer.querySelector<HTMLElement>(`[data-focus="skill-tree:${this.skillTree}"]`)?.focus({ preventScroll: true });
    });
    body.append(tabs);
    const skills = classSkills.filter(s => s.tree === this.skillTree), tree = el('div', 'skill-tree');
    tree.id = 'skill-tree-content'; tree.dataset.scroll = `skill-tree:${this.skillTree}`; tree.setAttribute('role', 'tabpanel'); tree.setAttribute('aria-labelledby', `skill-tree-tab-${this.skillTree}`);
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
      const card = btn('', () => {
        this.skillTreeScroll = tree.scrollTop; this.skillTreePageScroll = body.scrollTop; this.selectedSkill = skill.id; this.skillDetailOpen = true; this.skillFeedback = ''; this.invalidatePanel();
        if (matchMedia('(max-width: 760px), (pointer: coarse) and (max-height: 600px)').matches) this.panelLayer.querySelector<HTMLElement>('.skill-detail-close')?.focus({ preventScroll: true });
      }, `skill-node${this.selectedSkill === skill.id ? ' selected' : ''}${!skill.supported ? ' unsupported' : ''}${level > 0 ? ' learned' : ''}`);
      card.style.gridColumn = String(clamp(skill.column - minCol + 1, 1, 3)); card.style.gridRow = String(skill.row - minRow + 1); card.dataset.focus = `skill:${skill.id}`;
      card.setAttribute('aria-pressed', String((skills.find(s => s.id === this.selectedSkill) || skills[0])?.id === skill.id));
      card.classList.toggle('selected', card.getAttribute('aria-pressed') === 'true');
      const rune = svgNode('svg', { viewBox: '0 0 40 40', 'aria-hidden': 'true', class: 'skill-rune' });
      svgPath(rune, 'M20 3L35 12L32 29L20 37L7 28L5 12Z', '#29322a', '#9a8857');
      const n = skill.id % 4;
      svgPath(rune, ['M12 27L20 10L28 27M15 21L25 21', 'M13 11L27 29M27 11L13 29M20 8L20 32', 'M11 24L20 10L29 24L20 30ZM20 10L20 30', 'M13 10L27 10L13 29L27 29M20 10L20 29'][n]!, 'none', skill.supported ? '#d0bc80' : '#777f71', '2');
      card.append(rune, el('span', 'skill-node-name', skill.name), el('span', 'skill-node-level', `需求 ${skill.level}级 · 硬点 ${hard}/20${level !== hard ? ` · 有效 ${level}` : ''}`));
      card.title = `${skill.description}\n${skill.supported ? '已支持执行' : '特殊行为尚未实现'}\n前置：${skill.prerequisites.map(id => this.skillName(id)).join('、') || '无'}`;
      tree.append(card);
    }
    const layout = el('div', 'skill-layout'); layout.append(tree);
    const skill = skills.find(s => s.id === this.selectedSkill) || skills[0];
    if (skill) layout.append(this.skillDetail(skill));
    body.append(layout, el('p', 'muted skill-tree-hint', '选择技能后可直接升级或绑定左／右键，不会关闭面板。1–8 在战场切换右键技能；连线表示前置硬点。'));
  }

  private skillDetail(skill: SkillDef) {
    const p = this.state.player!, hard = p.skills[skill.id] || 0, level = skillLevel(p, skill.id);
    const effect = skillEffect(p, skill.id), supported = skill.supported && effect.supported, passive = effect.kind === 'passive';
    const blocked = this.state.paused || p.dead, detail = el('section', `skill-detail${this.skillDetailOpen ? ' is-open' : ''}`);
    const header = el('header', 'skill-detail-header');
    const close = btn('返回技能树', () => {
      this.skillDetailOpen = false; this.invalidatePanel();
      const tree = this.panelLayer.querySelector<HTMLElement>('.skill-tree'); if (tree) tree.scrollTop = this.skillTreeScroll;
      const body = this.panelLayer.querySelector<HTMLElement>('.panel-skills .panel-body'); if (body) body.scrollTop = this.skillTreePageScroll;
      this.panelLayer.querySelector<HTMLElement>(`[data-focus="skill:${skill.id}"]`)?.focus({ preventScroll: true });
    }, 'secondary-button skill-detail-close'); close.dataset.focus = 'skill-detail-close';
    const title = el('h3', '', skill.name); title.id = `skill-detail-title-${skill.id}`; title.tabIndex = -1; detail.setAttribute('aria-labelledby', title.id);
    header.append(close, title);
    const content = el('div', 'skill-detail-body'); content.dataset.scroll = `skill-detail:${skill.id}`;
    const levels = el('div', 'skill-levels');
    for (const [label, value] of [['角色等级', p.level], ['需求等级', skill.level], ['当前硬点', `${hard} / 20`], ['有效等级', level], ['剩余技能点', p.skillPoints]] as const) {
      const row = el('div', 'skill-level-row'); row.append(el('span', 'muted', label), el('strong', '', String(value))); levels.append(row);
    }
    content.append(levels, el('p', 'muted', `本次升级需求：角色 ${skill.level + hard} 级 · 前置硬点 ≥ 1：${skill.prerequisites.map(id => `${this.skillName(id)}（${p.skills[id] || 0}）`).join('、') || '无'}`));
    const learnReasons: string[] = [];
    if (p.dead) learnReasons.push('角色已死亡'); else if (this.state.paused) learnReasons.push('游戏已暂停');
    if (hard >= 20) learnReasons.push('硬点已达 20 上限');
    else {
      if (p.skillPoints <= 0) learnReasons.push('没有剩余技能点');
      if (p.level < skill.level + hard) learnReasons.push(`角色需达到 ${skill.level + hard} 级`);
      const missing = skill.prerequisites.filter(id => (p.skills[id] || 0) < 1);
      if (missing.length) learnReasons.push(`需先学习${missing.map(id => this.skillName(id)).join('、')}（硬点 ≥ 1）`);
    }
    const learnReason = el('p', learnReasons.length ? 'skill-action-reason warning' : 'skill-action-reason muted', learnReasons.length ? `无法升级：${learnReasons.join('；')}` : '升级消耗 1 点，仅增加当前技能 1 硬点。'); learnReason.id = `skill-learn-reason-${skill.id}`; content.append(learnReason);
    const bindReasons: string[] = [];
    if (blocked) bindReasons.push(p.dead ? '角色已死亡' : '游戏已暂停');
    if (!supported) bindReasons.push('仅规则数据，特殊行为尚未实现，不可施放');
    else if (passive) bindReasons.push('被动，学习后自动生效，无需绑定');
    else if (level <= 0) bindReasons.push('尚未学习，需先获得有效等级');
    const bindReason = el('p', supported ? 'supported-label skill-action-reason' : 'warning skill-action-reason', bindReasons.join('；') || '主动技能 · 已学习，可绑定左／右键及快捷槽。'); bindReason.id = `skill-bind-reason-${skill.id}`;
    content.append(bindReason, el('p', 'skill-description', skill.description));
    const extra = effect.description.trim().startsWith(skill.description.trim()) ? effect.description.trim().slice(skill.description.trim().length).trim() : effect.description.trim();
    if (extra) content.append(el('p', 'skill-effect-note muted', extra));
    content.append(el('p', 'skill-preview-label', level <= 0 ? '等级 1 预览 · 尚未学习，不可施放' : `当前有效等级 ${level} 的数值`));
    if (!passive) content.append(el('p', 'skill-numbers', `耗蓝 ${effect.mana} · 伤害 ${Math.floor(effect.min)}–${Math.floor(effect.max)}${supported ? '' : '（规则数据预览）'}`));
    const canBind = !blocked && supported && !passive && level > 0;
    const hotkeyRow = el('div', 'hotkey-row'); hotkeyRow.setAttribute('role', 'group'); hotkeyRow.setAttribute('aria-label', '右键快捷槽'); hotkeyRow.append(el('span', 'muted', '快捷槽 1–8 · 点击分配，战场按数字切换右键'));
    for (let i = 0; i < 8; i++) {
      const assigned = this.hotkeys[i], selected = assigned === skill.id;
      const b = btn('', () => {
        if (this.state.paused || p.dead || !canBind) return;
        this.hotkeys[i] = skill.id; this.skillFeedback = `快捷槽 ${i + 1} 已分配：${skill.name}`; this.invalidatePanel();
      }, `hotkey-button${selected ? ' active' : ''}`, !canBind);
      b.append(el('strong', '', String(i + 1)), el('span', '', assigned ? this.skillName(assigned) : '未分配'));
      b.dataset.focus = `skill-hotkey:${i}`; b.setAttribute('aria-pressed', String(selected)); b.setAttribute('aria-label', `快捷槽 ${i + 1}：${assigned ? this.skillName(assigned) : '未分配'}${selected ? '，已分配当前技能' : `，分配${skill.name}`}`);
      b.setAttribute('aria-describedby', bindReason.id); b.title = canBind ? `分配${skill.name}到快捷槽 ${i + 1}` : bindReasons.join('；'); hotkeyRow.append(b);
    }
    content.append(hotkeyRow);
    const footer = el('footer', 'skill-detail-footer');
    footer.append(el('p', 'skill-current-bindings', `左键：${this.skillName(p.leftSkill)} · 右键：${this.skillName(p.rightSkill)}`));
    const feedback = el('p', 'skill-feedback', this.skillFeedback || '绑定与快捷槽分配不会关闭面板'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite'); footer.append(feedback);
    const actions = el('div', 'skill-primary-actions');
    const learn = btn('升级 (+1)', () => {
      if (this.state.paused || p.dead) return;
      const before = p.skills[skill.id] || 0;
      this.send({ type: 'learn', skillId: skill.id });
      if ((p.skills[skill.id] || 0) === before + 1) this.skillFeedback = `${skill.name}已升级 · 剩余技能点 ${p.skillPoints}`;
      this.invalidatePanel();
      if (this.panelLayer.querySelector<HTMLButtonElement>(`[data-focus="skill-learn:${skill.id}"]`)?.disabled) this.panelLayer.querySelector<HTMLElement>(`#${title.id}`)?.focus({ preventScroll: true });
    }, 'secondary-button', learnReasons.length > 0); learn.dataset.focus = `skill-learn:${skill.id}`; learn.setAttribute('aria-describedby', learnReason.id); learn.title = learnReasons.join('；') || '消耗 1 技能点'; actions.append(learn);
    for (const right of [false, true]) {
      const bound = p[right ? 'rightSkill' : 'leftSkill'] === skill.id;
      const button = btn(`${bound ? '已绑' : '绑定'}${right ? '右键' : '左键'}`, () => this.bindSkill(skill.id, right), `primary-button${bound ? ' active' : ''}`, !canBind);
      button.dataset.focus = `skill-assign:${skill.id}:${right ? 'right' : 'left'}`; button.setAttribute('aria-pressed', String(bound)); button.setAttribute('aria-describedby', bindReason.id); button.title = canBind ? `绑定${right ? '右键' : '左键'}：${skill.name}` : bindReasons.join('；'); actions.append(button);
    }
    footer.append(actions); detail.append(header, content, footer); return detail;
  }

  private questsPanel(body: HTMLElement) {
    const p = this.state.player!, tabs = el('div', 'panel-tabs');
    tabs.setAttribute('aria-label', '任务章节');
    for (let act = 1; act <= 5; act++) {
      const tab = btn(`第${act}幕`, () => { this.questAct = act; this.invalidatePanel(); }, `tab-button${this.questAct === act ? ' active' : ''}`, act > p.unlockedActs);
      tab.setAttribute('aria-pressed', String(this.questAct === act)); tab.dataset.focus = `quest-act:${act}`; if (tab.disabled) tab.title = '尚未解锁'; tabs.append(tab);
    }
    body.append(tabs, el('div', 'section-caption', `${DIFFICULTY[p.difficulty]}难度 · 第${this.questAct}幕 · 各难度独立进度`));
    const list = el('div', 'quest-list');
    for (const q of QUESTS.filter(q => q.act === this.questAct)) {
      const step = p.quests[questKey(p.difficulty, q.id)] ?? 0, card = el('article', `quest-card${step >= 3 ? ' complete' : ''}`);
      card.append(el('div', 'quest-number', String(q.number).padStart(2, '0')), el('h3', '', q.name), el('span', 'quest-state', step >= 3 ? '已完成' : step === 2 ? '待交付' : step > 0 ? '进行中' : '未开始'), el('p', '', q.description), el('p', 'muted', `奖励：${q.reward}`)); list.append(card);
    }
    body.append(list, this.referenceNote(el('p', 'warning', '收录 27 项任务数据，不等于完整五幕脚本验收。没有免费跳幕或首领跳过入口。')));
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
    const dialogue = el('p', 'npc-dialogue', this.state.dialogue || '与旅人交谈，了解这片土地。');
    const controls = el('div', 'button-row npc-services');
    if (this.state.npc === 'gheed' && services.includes('gamble')) controls.append(btn('赌博', () => { this.closeItemPopup(); this.merchantPurchase = null; this.tradeView = 'vendor'; this.send({ type: 'gamble-open' }); this.invalidatePanel(); }, 'primary-button', this.state.paused || p.dead));
    if (services.includes('heal')) controls.append(btn('治疗', () => this.send({ type: 'heal' }), 'secondary-button'));
    if (this.state.npc === 'cain' && p.quests[questKey(p, 'a1q3')] === 3) controls.append(btn('鉴定全部', () => this.send({ type: 'identify' }), 'secondary-button', this.state.paused || p.dead));
    if (services.includes('repair')) controls.append(btn('修理装备', () => this.send({ type: 'repair' }), 'secondary-button'));
    if (this.state.npc === 'akara') controls.append(btn('任务奖励洗点', () => this.send({ type: 'respec' }), 'secondary-button', p.quests[questKey(p.difficulty, 'respec')] !== 1));
    if (this.state.npc === 'warriv' && p.unlockedActs >= 2) controls.append(btn('向东旅行 · 鲁高因', () => this.send({ type: 'travel', areaId: 40 }), 'primary-button'));
    if (!canTrade) {
      body.append(el('h3', 'npc-name', npc?.name || '营地旅人'), dialogue);
      if (controls.childElementCount) body.append(controls);
      return;
    }
    const charsi = this.state.npc === 'charsi';
    const notice = charsi ? '恰西的货架只陈列武器；她也可以修理已装备且并非无形的物品。' : '改编便利商店，不等于原版掉落与交易：大紫、全等级符文与宝石可购买，镶嵌需求不变。三种钥匙仅可购买、保存，地狱难度可在赫拉迪克方块中合成开启超级区域传送门。黑毛事件尚未开放，出售乔丹不会召唤。';
    const ranks = new Map([...RUNES, ...GEMS].map((item, index) => [item.code, index]));
    const category = (item: Item) => {
      const base = getBase(item.code);
      if (/^pk[1-3]$/.test(item.code) || item.code === 'rin' && item.quality === 'unique' && item.name === 'The Stone of Jordan') return 'keys';
      if (ranks.has(item.code) || /^(gem|skul)$/.test(String(base?.raw.type2 ?? ''))) return 'gems';
      if (base?.slot) return 'equipment';
      if (base && (isUsableItem(item) || ['key', 'bowq', 'xboq'].includes(base.type))) return 'supplies';
      return 'all';
    };
    const items = this.state.vendorItems.filter(item => this.vendorFilter === 'all' || category(item) === this.vendorFilter);
    if (this.vendorFilter === 'gems') items.sort((a, b) => (ranks.get(a.code) ?? 99) - (ranks.get(b.code) ?? 99));
    const toolbar = el('div', 'merchant-toolbar');
    const service = el('details', 'merchant-services'); service.open = this.merchantServicesOpen;
    const summary = el('summary', 'merchant-wallet'); summary.dataset.focus = 'merchant-services';
    summary.append(el('strong', 'merchant-gold', `${p.gold.toLocaleString()} 金币`), el('span', 'merchant-service-label', '商人服务 / 交谈'));
    service.append(summary, dialogue, controls);
    service.addEventListener('toggle', () => {
      if (!service.isConnected) return;
      const changed = this.merchantServicesOpen !== service.open;
      this.merchantServicesOpen = service.open;
      // Recreated open details also emit toggle; only an actual service change reveals focus.
      this.maintainMerchantLayout(changed);
    });
    const filters = el('div', 'vendor-filters'); filters.setAttribute('role', 'group'); filters.setAttribute('aria-label', '商店商品分类');
    for (const [key, label] of [['all', '全部'], ['supplies', '补给'], ['equipment', '装备'], ['gems', '符文宝石'], ['keys', '珍品']] as const) {
      if (charsi && !['all', 'equipment'].includes(key)) continue;
      const button = btn(label, () => { this.closeItemPopup(); this.vendorFilter = key; this.invalidatePanel(); }, `tab-button${this.vendorFilter === key ? ' active' : ''}`);
      button.dataset.focus = `vendor-filter:${key}`; button.setAttribute('aria-pressed', String(this.vendorFilter === key)); filters.append(button);
    }
    const status = el('div', 'merchant-purchase-status'); status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
    const message = el('div', 'merchant-status-text'), purchase = this.merchantPurchase;
    if (purchase) {
      status.classList.add('has-purchase');
      message.append(el('span', '', `已放入${purchase.location === 'inventory' ? '行囊' : '腰带'}`), el('strong', '', purchase.label)); message.title = `已放入${purchase.location === 'inventory' ? '行囊' : '腰带'} · ${purchase.label}`;
      status.append(message);
      if (purchase.location === 'inventory') {
        const owned = p.inventory.some(item => item.uid === purchase.uid);
        const inspect = btn('查看', () => { this.selectItem(purchase.uid); this.openItemPopup(purchase.uid, innerWidth / 2, 80); }, 'merchant-status-action', !owned);
        inspect.dataset.focus = `merchant-inspect:${purchase.uid}`; inspect.setAttribute('aria-label', `查看已购买的${purchase.label}`); status.append(inspect);
      }
      const bag = btn('背包', () => this.showTradeView('inventory'), 'merchant-status-action'); bag.dataset.focus = 'merchant-bag'; status.append(bag);
    } else {
      message.append(el('strong', '', `${charsi ? '武器货架' : '货架'} · ${items.length} 件`), el('span', '', '点击商品看属性 · 仅「购买」扣款')); status.append(message);
    }
    toolbar.append(service, filters, status); body.append(toolbar);
    if (this.vendorFilter === 'keys' && !charsi) body.append(el('p', 'warning vendor-event-warning', '钥匙仅可购买、保存，不能开启 Uber 门；黑毛事件未开放，出售乔丹不会召唤。'));
    const stock = el('div', 'vendor-stock merchant-stock'); stock.setAttribute('aria-label', '商店商品陈列');
    for (const item of items) {
      const base = getBase(item.code), rune = RUNES.find(r => r.code === item.code), gem = GEMS.find(g => g.code === item.code);
      const type = category(item) === 'keys' ? '事件珍品 · 功能未开放' : rune ? `符文 · ${rune.number} 号` : gem ? `宝石 · ${gem.grade + 1}/5 级` : base?.slot ? SLOT_NAMES[base.slot] : base?.type === 'book' ? '补给 · 卷轴之书' : base?.type === 'scro' ? '补给 · 卷轴' : base?.type === 'key' ? '补给 · 开锁钥匙' : isUsableItem(item) ? '补给 · 药水' : '物品';
      const row = el('div', 'vendor-row'), button = this.itemButton(item); row.dataset.code = item.code;
      const icon = el('span', 'merchant-item-icon'); icon.append(...button.childNodes); button.append(icon);
      const label = el('span', 'merchant-item-label');
      label.append(el('strong', 'vendor-item-name', itemLabel(item)), el('span', 'merchant-item-type', type)); button.append(label); button.title = `${itemLabel(item)} · ${type} · 点击查看完整属性`;
      const purchase = el('div', 'merchant-purchase');
      purchase.append(el('span', 'merchant-price', `${item.price.toLocaleString()} 金币`));
      const buy = btn('购买', () => this.buyItem(item), `small-button merchant-buy${p.gold < item.price ? ' unaffordable' : ''}`, this.state.paused || p.dead);
      buy.dataset.focus = `buy:${item.uid}`; buy.setAttribute('aria-label', `${itemLabel(item)} · ${item.price.toLocaleString()} 金币 · 购买`);
      if (p.gold < item.price) buy.title = '金币不足；购买时会显示失败原因，不扣款。';
      purchase.append(buy); row.append(button, purchase); stock.append(row);
    }
    if (!items.length) stock.append(el('p', 'muted', '此分类暂无商品。'));
    body.append(stock, this.referenceNote(el('p', 'warning vendor-warning', notice)));
    // Pointer purchases and preventScroll restoration keep the user's exact shelf position.
    // Native Tab/Shift+Tab still reveal focus beneath the sticky toolbar.
    stock.addEventListener('focusin', () => this.maintainMerchantLayout(!this.restoringTradeFocus && document.activeElement?.matches(':focus-visible') === true));
  }

  private buyGamblingOffer(uid: string) {
    const index = this.state.gamblingOffers.findIndex(offer => offer.uid === uid);
    if (index < 0) return;
    const before = new Set(this.state.player!.inventory.map(item => item.uid));
    this.closeItemPopup(); this.send({ type: 'gamble-buy', uid });
    const result = this.state.player?.inventory.find(item => item.uid === this.state.selectedItem && !before.has(item.uid));
    if (result) {
      this.gamblingResultUid = result.uid; this.selectedUid = result.uid;
      this.selectedGambleOfferUid = this.state.gamblingOffers[index]?.uid ?? '';
    }
    this.invalidatePanel();
    if (!result) return;
    // The result and same-slot purchase button live above stock; expose them after restoration.
    const workspace = this.panelLayer.querySelector<HTMLElement>('.trade-workspace');
    if (workspace) { workspace.scrollTop = 0; this.saveTradeScroll(); }
    const body = this.panelLayer.querySelector<HTMLElement>('.panel-vendor .panel-body'); if (body) body.scrollTop = 0;
    const nextPurchase = this.panelLayer.querySelector<HTMLButtonElement>(`[data-focus="gamble:${this.selectedGambleOfferUid}"]`);
    (nextPurchase && !nextPurchase.disabled ? nextPurchase : this.panelLayer.querySelector<HTMLElement>(`[data-focus="gamble-result:${result.uid}"]`))?.focus({ preventScroll: true });
  }

  private gamblingPanel(body: HTMLElement) {
    const p = this.state.player!, blocked = this.state.paused || p.dead;
    const controls = el('div', 'button-row gambling-controls');
    const refresh = btn('刷新货物', () => { this.closeItemPopup(); this.selectedGambleOfferUid = ''; this.send({ type: 'gamble-refresh' }); this.invalidatePanel(); }, 'primary-button', blocked); refresh.dataset.focus = 'gamble-refresh';
    const back = btn('返回基德商店', () => { this.closeItemPopup(); this.send({ type: 'panel', panel: 'vendor' }, true); this.invalidatePanel(); }, 'secondary-button'); back.dataset.focus = 'gamble-back';
    controls.append(refresh, back);
    const selectedOffer = this.state.gamblingOffers.find(offer => offer.uid === this.selectedGambleOfferUid);
    const result = p.inventory.find(item => item.uid === this.gamblingResultUid);
    if (result) {
      const last = el('section', 'gambling-result'); last.setAttribute('aria-label', '最近赌博结果');
      const feedback = el('div', 'section-caption', '赌博购买成功 · 已鉴定'); feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite');
      const obtained = el('div', 'gambling-result-item'); obtained.append(this.itemButton(result), el('strong', `item-name quality-${result.quality}`, itemLabel(result)));
      const inspect = btn('查看属性与操作', () => { this.selectItem(result.uid); this.openItemPopup(result.uid, innerWidth / 2, 80); }, 'secondary-button'); inspect.dataset.focus = `gamble-result:${result.uid}`;
      last.append(feedback, obtained, inspect);
      if (selectedOffer) {
        const price = gamblingCost(selectedOffer.code, p);
        const again = btn('', () => this.buyGamblingOffer(selectedOffer.uid), 'primary-button', blocked || p.gold < price); again.dataset.focus = `gamble:${selectedOffer.uid}`;
        again.append(el('span', '', '赌博购买 · 同货位'), el('span', '', `${price.toLocaleString()} 金币`));
        again.setAttribute('aria-label', `同货位赌博购买 · ${price.toLocaleString()} 金币${p.gold < price ? ' · 金币不足' : ''}`);
        last.append(again);
      }
      body.append(last);
    }
    body.append(el('p', 'npc-dialogue', '“来试试运气吧。”'), controls, el('div', 'gold-line', `持有 ${p.gold.toLocaleString()} 金币 · 折扣 ${gamblingDiscount(p)}%`), el('p', 'muted', '轻点图标只查看报价与底材，品质未知。只有「赌博购买」会扣款，购买后立即鉴定；同一货位可连续购买。'));
    if (selectedOffer) {
      // Read only public offer/base data. Never inspect or construct the hidden rolled item.
      const base = getBase(selectedOffer.code)!, quote = el('section', 'gambling-quote'); quote.setAttribute('aria-label', '所选底材报价');
      quote.append(el('h3', '', base.name), el('p', '', `${gamblingCost(selectedOffer.code, p).toLocaleString()} 金币 · 品质未知 · 底材占用 ${base.width} × ${base.height}`), el('p', 'muted', '最终底材、品质与属性购买后揭晓。'));
      body.append(quote);
    }
    const stock = el('div', 'gambling-stock'); stock.dataset.scroll = 'gambling-stock'; stock.setAttribute('aria-label', '赌博货物陈列');
    for (const offer of this.state.gamblingOffers) {
      const base = getBase(offer.code)!, price = gamblingCost(offer.code, p);
      const row = el('div', 'gambling-slot'); row.dataset.offerUid = offer.uid; row.dataset.code = offer.code;
      const icon = btn('', () => { this.closeItemPopup(); this.selectedGambleOfferUid = offer.uid; this.invalidatePanel(); }, 'gambling-icon'); icon.dataset.focus = `gamble-offer:${offer.uid}`; icon.setAttribute('aria-pressed', String(offer.uid === this.selectedGambleOfferUid));
      const image = el('img', 'item-sprite'); image.src = artUrl(itemArtKey(offer.code)); image.alt = ''; image.draggable = false;
      icon.append(image); icon.setAttribute('aria-label', `${base.name} · 查看报价与底材 · 品质未知`); icon.title = `${base.name} · ${price.toLocaleString()} 金币 · 品质未知`;
      icon.addEventListener('contextmenu', event => event.preventDefault());
      const purchase = btn(`赌博购买 · ${price.toLocaleString()} 金币`, () => this.buyGamblingOffer(offer.uid), 'small-button', blocked || p.gold < price); purchase.setAttribute('aria-label', `${base.name} · ${price.toLocaleString()} 金币 · 赌博购买`); purchase.dataset.focus = `gamble:${offer.uid}`;
      row.append(icon, el('span', 'gambling-base-name', base.name), purchase);
      if (offer.uid === this.selectedGambleOfferUid) row.append(el('p', 'muted gambling-offer-info', `所选报价 ${price.toLocaleString()} 金币 · 底材 ${base.width} × ${base.height} · 品质未知`));
      stock.append(row);
    }
    body.append(stock, this.referenceNote(el('p', 'warning gambling-baseline', '采用经典赌博算法与重制版刷新交互；精确报价、底材升级冲突及词缀实现边界见旅人手册，不宣称重制版逐项实测一致。')));
  }

  private catalogPanel(body: HTMLElement) {
    body.append(el('p', 'catalog-baseline', `LoD 1.14d · ${EQUIPMENT_CATALOG.length.toLocaleString()} 项只读定义 · 含历史、禁用及未完成条目`), el('p', 'warning', '完整收录不等于全部属性生效：套装组合、触发技能、聚气和完整合成仍未实现。图鉴不生成装备，也不改变存档。'));
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
      let previousRunewordGroup = '';
      for (const entry of visible) {
        const runewordGroup = entry.kind === 'runeword' ? runewordEquipmentGroup(entry) : '';
        if (runewordGroup && runewordGroup !== previousRunewordGroup) {
          list.append(el('div', 'catalog-group-heading', `装备类型 · ${runewordGroup}`));
          previousRunewordGroup = runewordGroup;
        }
        const card = btn('', () => { this.catalogSelected = entry.id; refresh(); }, `catalog-entry catalog-${entry.kind}${this.catalogSelected === entry.id ? ' selected' : ''}`);
        card.dataset.entryId = entry.id; card.setAttribute('aria-pressed', String(this.catalogSelected === entry.id));
        if (entry.code) { const image = el('img', 'catalog-icon'); image.src = artUrl(itemArtKey(entry.code)); image.alt = ''; card.append(image); }
        const label = el('span', 'catalog-entry-label');
        const level = entry.kind === 'runeword' ? runewordRequiredLevel(entry) : Number.POSITIVE_INFINITY;
        label.append(el('strong', '', entry.name), el('small', 'muted', entry.kind === 'runeword' ? `${runewordGroup} · ${Number.isFinite(level) ? `需求等级 ${level}` : '等级未定义'}` : entry.code || entry.id));
        card.append(label); list.append(card);
      }
      const selected = results.find(entry => entry.id === this.catalogSelected);
      if (selected) {
        detail.append(el('h3', `catalog-${selected.kind}`, selected.name), el('p', 'catalog-entry-status', selected.status));
        for (const line of selected.lines.filter(line => !line.startsWith('原始字段：'))) detail.append(el('div', 'item-property', line));
        const properties = equipmentPropertyLines(selected);
        if (properties.length) {
          detail.append(el('h4', 'section-caption', '装备属性 · 定义展示不代表全部已生效'));
          for (const property of properties) detail.append(el('div', 'item-property', property));
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
    const rows: [string, string][] = [['WASD / 方向键', '固定 3D 视角，按屏幕方向连续移动；松开立即停止。可边移动边用鼠标瞄准。'], ['鼠标 / 左键', '鼠标指向地面或敌人瞄准，单击左键攻击一次，按住连续攻击。点击设施交互、点击掉落拾取；仅营地内点击地面寻路移动。'], ['右键', '单击施放右键绑定的已获得、已支持的主动技能，按住连续施放，松开停止。技能树中绑定成功会关闭面板；营地内禁用攻击技能。'], ['1–8', '切换已分配的右键技能；在技能详情中点击数字分配快捷键，本次旅人会话有效。未获得或不可执行的技能不能绑定。'], ['Shift+1–4', '使用腰带对应列的药水；也可点击腰带。'], ['Q / F', '使用腰带中当前可取用的生命 / 法力药水；没有对应药水时尝试回复活力药水，不跨过列首药水。'], ['E', '与三格内最近的设施交互或拾取掉落；超过范围须先靠近。'], ['I / C / T / J', '背包 / 角色属性 / 技能树 / 任务日志。'], ['L / 图鉴', '查阅全部装备定义、原始参数及实现状态；只读，不生成装备。'], ['X / R', 'X 按物理按键切换武器组，面板打开时也有效，中文输入法下无需切换英文；输入框、暂停、死亡或拖动物品时不触发。R 切换行走与奔跑。'], ['Tab / Alt', '切换探索地图 / 按住显示掉落名称。面板内 Tab 保留键盘导航。'], ['Esc / H', '关闭面板；无面板时暂停或继续 / 打开旅人指南。打开面板、暂停、切走窗口或取消触控都会释放移动与攻击，关闭后需重新按下。'], ['触屏', '左下摇杆按屏幕方向连续移动；轻点攻击或施法一次，按住连续释放，自动瞄准九格内最近的敌人。交互 / 拾取按钮选择三格内最近的设施 / 掉落。'], ['行囊物品', '轻点 / 单击固定完整详情，选择装备、卸下或使用；垂直滑动浏览，只有开启「整理物品」才启用触屏拖动，交易出售使用详情按钮。鼠标右键快速装备 / 替换，双击装备 / 卸下。药水、卷轴与书右键使用，键盘可选择物品后点击「使用」（Enter 激活按钮）。回城卷轴为蓝色、鉴定卷轴为红色。右键鉴定卷轴后鼠标变为鉴定样式，点击未鉴定行囊物品即可鉴定；再次右键或 Esc 取消。触屏点击「使用」后点选目标。符文宝石通过详情按钮镶嵌。'], ['存档', '点击保存后存储在当前浏览器；标题页继续旅程。离线单人，无云端账户。']];
    const addRow = (target: HTMLElement, [key, description]: [string, string]) => { const row = el('div', 'help-row'); row.append(el('kbd', '', key), el('p', '', description)); target.append(row); };
    body.append(el('h3', 'section-caption', '上手指南'));
    addRow(body, ['触屏', '摇杆移动；轻点攻击 / 施法一次，按住连续释放。靠近目标后用「交互」「拾取」。']);
    addRow(body, ['行囊物品', '轻点固定详情，选择装备、使用、出售或永久镶嵌；滑动浏览。「整理物品」开启触屏拖动，再点「完成整理」退出。鉴定卷轴先「使用」再点目标。']);
    const saveGuide = rows.find(row => row[0] === '存档'); if (saveGuide) addRow(body, saveGuide);
    const keyboard = el('details', 'reference-details help-keyboard'); keyboard.open = !matchMedia('(max-width: 760px)').matches; keyboard.append(el('summary', '', '完整操作与桌面键位'));
    for (const row of rows.filter(row => row[0] !== '存档')) addRow(keyboard, row);
    body.append(keyboard, this.referenceNote(el('p', 'muted', 'LoD 1.14d 扩展模式规则重构研究项目，非官方。原创写实角色、物品与材质贴图；不含原版美术、音乐或代码。人物使用程序化骨骼动作，非原版完整方向动画与行动帧。五幕地图与技能数据收录不代表完整服务器行为、首领脚本、词缀和配方已经验收。')));
  }

  private modalControls(scope: HTMLElement) {
    return [...scope.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]')].filter(node => node.getClientRects().length && !node.closest('[inert]'));
  }

  private updateOverlay() {
    const s = this.state, p = s.player, blocking = s.screen === 'game' && !!p && (p.dead || s.paused);
    const wasVisible = !this.overlay.hidden, starting = blocking && !this.modalSession;
    const active = document.activeElement as HTMLElement | null;
    if (starting) {
      this.modalReturnFocus = active && this.root.contains(active) ? active : null;
      this.modalReturnKey = this.modalReturnFocus?.dataset.focus ?? ''; this.modalFocusKey = '';
    }
    if (active && this.overlay.contains(active)) this.modalFocusKey = active.dataset.focus ?? '';
    this.hud.inert = blocking; this.canvas.inert = blocking;
    this.overlay.hidden = !blocking || !p?.dead && s.panel !== 'none'; this.panelLayer.inert = !this.overlay.hidden;
    if (!blocking) {
      this.overlaySignature = ''; this.overlay.replaceChildren();
      if (this.modalSession && s.screen === 'game') {
        const candidate = this.modalReturnFocus?.isConnected ? this.modalReturnFocus : [...this.root.querySelectorAll<HTMLElement>('[data-focus]')].find(node => node.dataset.focus === this.modalReturnKey);
        const valid = candidate && candidate.getClientRects().length && !candidate.matches(':disabled') && !candidate.closest('[inert], [hidden]');
        (valid ? candidate : this.canvas).focus({ preventScroll: true });
      }
      this.modalSession = false; this.modalReturnFocus = null; this.modalReturnKey = ''; this.modalFocusKey = ''; return;
    }
    this.modalSession = true;
    const signature = `${p!.dead}:${s.paused}:${s.panel}:${s.savingAndExiting}:${s.storageError}`;
    if (this.overlaySignature === signature) return; this.overlaySignature = signature; this.overlay.replaceChildren();
    if (this.overlay.hidden) {
      if (wasVisible || starting) this.panelLayer.querySelector<HTMLElement>('.close-button')?.focus({ preventScroll: true });
      return;
    }
    this.cancelItemDrag(); this.closeItemPopup(); this.hideTooltip();
    const card = el('section', `modal-card${p!.dead ? ' death-card' : ''}`); card.tabIndex = -1; card.dataset.focus = 'modal-card'; card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'game-modal-title');
    const title = el('h2', '', p!.dead ? '你已倒下' : '旅途暂歇'); title.id = 'game-modal-title';
    card.append(el('div', 'eyebrow', p!.dead ? 'THE EMBER REMAINS' : 'A MOMENT OF SILENCE'), title, el('p', 'muted', p!.dead ? '回到营地重新出发，取回遗体与失落的装备。' : '黑暗仍在等待。准备好后继续你的旅途。'));
    if (p!.dead) { const revive = btn('在营地复活', () => this.send({ type: 'respawn' }), 'primary-button'); revive.dataset.focus = 'modal-respawn'; card.append(revive); }
    else {
      card.setAttribute('aria-busy', String(s.savingAndExiting));
      const saveExitNote = el('p', 'muted', '保存当前角色进度到本机，成功后返回角色菜单；再次进入会从营地出发，怪物会刷新。'); saveExitNote.id = 'save-exit-note';
      const saveExit = btn(s.savingAndExiting ? '正在保存，请稍候…' : '保存并返回角色菜单', () => this.send({ type: 'save-and-title' }), 'secondary-button', s.savingAndExiting); saveExit.setAttribute('aria-describedby', saveExitNote.id); saveExit.dataset.focus = 'modal-save-exit';
      const resume = btn('继续 · Esc', () => this.send({ type: 'pause' }), 'primary-button', s.savingAndExiting); resume.dataset.focus = 'modal-resume';
      const save = btn('保存旅程', () => this.send({ type: 'save' }), 'secondary-button', s.savingAndExiting); save.dataset.focus = 'modal-save';
      const help = btn('旅人指南', () => this.send({ type: 'panel', panel: 'help' }), 'secondary-button', s.savingAndExiting); help.dataset.focus = 'modal-help';
      card.append(resume, save, help, saveExit, saveExitNote);
      if (s.storageError && !s.savingAndExiting) { const error = el('p', 'warning', `${s.storageError} 未返回角色菜单，请重试保存。`); error.setAttribute('role', 'alert'); card.append(error); }
    }
    this.overlay.append(card);
    const preserved = [...this.overlay.querySelectorAll<HTMLElement>('[data-focus]')].find(node => node.dataset.focus === this.modalFocusKey && !node.matches(':disabled') && node.getClientRects().length);
    (preserved ?? this.modalControls(card)[0] ?? card).focus({ preventScroll: true });
  }

  private openItemPopup(uid: string, x: number, y: number) {
    if (this.itemPopupTimer) { clearTimeout(this.itemPopupTimer); this.itemPopupTimer = null; }
    if (this.selectedUid !== uid || !this.state.player || this.drag?.active) return;
    const source = this.selectedItem(); if (!source || source.item.uid !== uid) return;
    this.hideTooltip(); this.popup = { uid, location: source.location, x, y, signature: '' };
    this.itemPopup.hidden = false; this.root.classList.add('has-item-popup'); this.refreshItemPopup();
    this.itemPopup.querySelector<HTMLButtonElement>('.popup-close')?.focus({ preventScroll: true });
  }

  private closeItemPopup() {
    if (this.itemPopupTimer) { clearTimeout(this.itemPopupTimer); this.itemPopupTimer = null; }
    const uid = this.popup?.uid, restoreFocus = this.itemPopup.contains(document.activeElement);
    if (this.popup) this.clearActionFeedback();
    this.popup = null; this.itemPopup.hidden = true; this.itemPopup.replaceChildren(); this.root.classList.remove('has-item-popup');
    if (restoreFocus && uid) [...this.panelLayer.querySelectorAll<HTMLElement>('[data-focus]')].find(node => node.dataset.focus === `item:${uid}`)?.focus({ preventScroll: true });
  }

  private refreshItemPopup() {
    const popup = this.popup; if (!popup) return;
    const selected = this.state.player && this.selectedItem();
    if (!selected || selected.item.uid !== popup.uid || selected.location !== popup.location || this.state.screen !== 'game' || this.state.panel === 'none' || this.state.paused || this.state.player?.dead) { this.closeItemPopup(); return; }
    const signature = JSON.stringify([selected.item, this.getPanelSignature()]);
    if (signature !== popup.signature) {
      popup.signature = signature;
      const scroll = this.itemPopup.querySelector<HTMLElement>('.item-popup-body')?.scrollTop ?? 0, focused = this.itemPopup.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.focus : null;
      const close = btn('×', () => this.closeItemPopup(), 'close-button popup-close'); close.dataset.focus = 'popup-close'; close.setAttribute('aria-label', '关闭物品浮层'); close.setAttribute('aria-keyshortcuts', 'Escape');
      const detail = this.itemDetail(), heading = detail.querySelector('.item-detail-heading'), actions = detail.querySelector<HTMLElement>('.item-popup-actions'); heading?.append(close);
      const body = el('div', 'item-popup-body'); body.tabIndex = 0; body.dataset.focus = 'popup-body'; body.setAttribute('aria-label', '完整属性与更多操作，可滚动');
      for (const child of [...detail.children]) if (child !== heading && child !== actions) body.append(child);
      const feedback = el('p', 'item-popup-feedback'); feedback.hidden = true; feedback.setAttribute('aria-hidden', 'true'); actions?.prepend(feedback);
      detail.append(body); if (actions) detail.append(actions);
      this.itemPopup.setAttribute('aria-labelledby', 'item-popup-name'); this.itemPopup.replaceChildren(detail);
      if (focused) ([...this.itemPopup.querySelectorAll<HTMLElement>('[data-focus]')].find(node => node.dataset.focus === focused && !node.matches(':disabled') && node.getClientRects().length) ?? close).focus({ preventScroll: true });
      body.scrollTop = scroll;
    }
    this.syncPopupFeedback();
    const viewport = window.visualViewport, left = (viewport?.offsetLeft ?? 0) + 8, top = (viewport?.offsetTop ?? 0) + 8;
    const right = left + (viewport?.width ?? innerWidth) - 16;
    const hud = this.hud.querySelector<HTMLElement>('.bottom-hud')?.getBoundingClientRect();
    const bottom = Math.min(top + (viewport?.height ?? innerHeight) - 16, hud && hud.height > 0 && hud.top > top ? hud.top - 8 : innerHeight - 8);
    this.itemPopup.style.setProperty('--item-popup-height', `${Math.max(120, Math.min(480, bottom - top))}px`);
    this.itemPopup.style.setProperty('--item-popup-width', `${Math.max(160, right - left)}px`);
    const rect = this.itemPopup.getBoundingClientRect(), touch = matchMedia('(pointer: coarse)').matches || this.lastItemPointer === 'touch';
    this.itemPopup.style.left = `${touch ? left + (right - left - rect.width) / 2 : clamp(popup.x + 12, left, Math.max(left, right - rect.width))}px`;
    this.itemPopup.style.top = `${touch ? Math.max(top, bottom - rect.height) : clamp(popup.y + 12, top, Math.max(top, bottom - rect.height))}px`;
  }

  private installItemDrag(node: HTMLElement, grid: HTMLElement, item: Item) {
    node.addEventListener('pointerdown', e => {
      if (e.button !== 0 || !e.isPrimary || this.drag || this.state.identifySource !== null || this.state.paused || this.state.player?.dead || !this.state.player?.inventory.some(i => i.uid === item.uid)) return;
      this.resetControls();
      const rect = grid.getBoundingClientRect(), cell = (rect.width - 2) / INVENTORY_WIDTH;
      const awaitingHold = e.pointerType === 'touch' && !this.inventoryArranging;
      const drag = this.drag = { id: e.pointerId, uid: item.uid, node, grid, start: { x: e.clientX, y: e.clientY }, anchor: { x: clamp(Math.floor((e.clientX - rect.left - 1) / cell) - item.x, 0, item.width - 1), y: clamp(Math.floor((e.clientY - rect.top - 1) / cell) - item.y, 0, item.height - 1) }, active: false, moved: false, awaitingHold, holdTimer: null as ReturnType<typeof setTimeout> | null, touchId: null as number | null, ghost: null, preview: null, target: null, saleZone: null, tomeNode: null };
      if (awaitingHold) drag.holdTimer = setTimeout(() => {
        drag.holdTimer = null;
        if (this.drag !== drag || !this.activateItemDrag()) return;
        this.positionItemDrag(drag.start.x, drag.start.y);
      }, 400);
      else node.setPointerCapture(e.pointerId);
    });
    // Register before the gesture starts: changing touch-action after a hold cannot stop pan-y.
    // Only an activated hold blocks native scrolling; the first ordinary swipe stays cancelable.
    node.addEventListener('touchstart', e => {
      if (this.drag?.node === node && e.touches.length === 1) this.drag.touchId = e.changedTouches[0]?.identifier ?? null;
    }, { passive: false });
    node.addEventListener('touchmove', e => {
      const drag = this.drag; if (!drag || drag.node !== node) return;
      if (e.touches.length !== 1) { this.cancelItemDrag(true); return; }
      const touch = [...e.touches].find(t => t.identifier === drag.touchId); if (!touch) return;
      if (drag.awaitingHold && Math.hypot(touch.clientX - drag.start.x, touch.clientY - drag.start.y) >= 10) { this.cancelItemDrag(); return; }
      if (drag.active) {
        if (!e.cancelable) { this.cancelItemDrag(true); return; }
        e.preventDefault();
      }
    }, { passive: false });
    node.addEventListener('lostpointercapture', e => { if (this.drag?.id === e.pointerId) this.cancelItemDrag(); });
    node.addEventListener('dragstart', e => e.preventDefault());
  }

  private activateItemDrag(): boolean {
    const drag = this.drag; if (!drag) return false;
    const item = this.state.player?.inventory.find(i => i.uid === drag.uid);
    if (!item || !drag.node.isConnected || !drag.grid.isConnected || this.state.identifySource !== null || this.state.screen !== 'game' || this.state.panel === 'none' || this.state.paused || this.state.player?.dead || !this.inputFocused || document.hidden) { this.cancelItemDrag(); return false; }
    if (!drag.active) {
      if (drag.holdTimer) clearTimeout(drag.holdTimer);
      drag.holdTimer = null; drag.awaitingHold = false;
      drag.active = true; this.hideTooltip(); this.closeItemPopup(); this.selectItem(drag.uid);
      drag.node.setPointerCapture(drag.id);
      drag.node.classList.add('drag-source'); this.root.classList.add('is-item-dragging');
      drag.ghost = el('div', `item-drag-ghost quality-${item.quality}`); drag.ghost.append(itemSprite(item)); drag.ghost.setAttribute('aria-hidden', 'true'); this.root.append(drag.ghost);
      drag.preview = el('div', 'item-drop-preview'); drag.preview.setAttribute('aria-hidden', 'true');
    }
    return true;
  }

  private moveItemDrag(e: PointerEvent) {
    const drag = this.drag; if (!drag || drag.id !== e.pointerId) return;
    const distance = Math.hypot(e.clientX - drag.start.x, e.clientY - drag.start.y), threshold = e.pointerType === 'touch' ? 10 : 6;
    if (drag.awaitingHold) { if (distance >= threshold) this.cancelItemDrag(); return; }
    if (!drag.active && distance < threshold || !this.activateItemDrag()) return;
    if (distance >= threshold) drag.moved = true;
    e.preventDefault(); e.stopPropagation();
    this.positionItemDrag(e.clientX, e.clientY);
  }

  private positionItemDrag(clientX: number, clientY: number) {
    const drag = this.drag, item = this.state.player?.inventory.find(i => i.uid === drag?.uid);
    if (!drag || !item) return;
    drag.target = null; drag.saleZone?.classList.remove('sell-drag-over'); drag.saleZone = null; drag.preview?.remove();
    drag.tomeNode?.classList.remove('tome-drag-over', 'tome-drag-full'); drag.tomeNode = null;
    drag.ghost?.querySelector('.tome-drop-hint')?.remove();
    const rect = drag.grid.getBoundingClientRect(), cell = (rect.width - 2) / INVENTORY_WIDTH;
    if (drag.ghost) {
      drag.ghost.style.width = `${item.width * cell}px`; drag.ghost.style.height = `${item.height * cell}px`;
      drag.ghost.style.left = `${clientX - (drag.anchor.x + .5) * cell}px`; drag.ghost.style.top = `${clientY - (drag.anchor.y + .5) * cell}px`;
    }
    const hit = document.elementFromPoint(clientX, clientY) as HTMLElement | null;
    const sale = hit?.closest<HTMLElement>('[data-sell-dropzone], .trade-mode .panel-vendor');
    if (sale && this.isTrading()) {
      if (item.code !== 'box' && getBase(item.code)?.type !== 'ques') { drag.target = { type: 'sell' }; drag.saleZone = sale; sale.classList.add('sell-drag-over'); }
    }
    else {
      const targetGrid = hit?.closest<HTMLElement>('.item-grid[data-location="inventory"]');
      if (targetGrid && drag.preview) {
        const r = targetGrid.getBoundingClientRect(), unit = (r.width - 2) / INVENTORY_WIDTH;
        const hitX = Math.floor((clientX - r.left - 1) / unit), hitY = Math.floor((clientY - r.top - 1) / unit);
        // Hit the pointer's exact occupied cell, not the dragged item's anchor or nearest book.
        const tome = this.state.player!.inventory.find(i => canFillTome(item, i) && hitX >= i.x && hitX < i.x + i.width && hitY >= i.y && hitY < i.y + i.height);
        if (tome) {
          const full = tome.quantity >= TOME_CAPACITY;
          drag.tomeNode = [...targetGrid.querySelectorAll<HTMLElement>('[data-uid]')].find(node => node.dataset.uid === tome.uid) ?? null;
          drag.tomeNode?.classList.add(full ? 'tome-drag-full' : 'tome-drag-over');
          drag.ghost?.append(el('span', 'tome-drop-hint', full ? `${TOME_CAPACITY}/${TOME_CAPACITY} · 已满，不可装入` : `装入 · ${tome.quantity}/${TOME_CAPACITY}`));
          if (!full) drag.target = { type: 'tome', tomeUid: tome.uid };
        } else {
          const x = hitX - drag.anchor.x, y = hitY - drag.anchor.y;
          const valid = fitsItem(this.state.player!.inventory.filter(i => i.uid !== item.uid), item, x, y, INVENTORY_WIDTH, INVENTORY_HEIGHT);
          drag.preview.classList.toggle('invalid', !valid); drag.preview.style.left = `${1 + x * unit}px`; drag.preview.style.top = `${1 + y * unit}px`;
          drag.preview.style.width = `${item.width * unit}px`; drag.preview.style.height = `${item.height * unit}px`; targetGrid.append(drag.preview);
          if (valid) drag.target = { type: 'move', x, y };
        }
      }
    }
    drag.ghost?.classList.toggle('invalid', !drag.target);
  }

  private finishItemDrag(e: PointerEvent) {
    const drag = this.drag; if (!drag || drag.id !== e.pointerId) return;
    if (drag.active) this.moveItemDrag(e);
    if (this.drag !== drag) return;
    const target = drag.moved ? drag.target : null, uid = drag.uid, active = drag.active;
    if (active) { e.preventDefault(); e.stopPropagation(); }
    this.cancelItemDrag();
    if (!active || !target || !this.state.player?.inventory.some(i => i.uid === uid)) return;
    if (target.type === 'sell') { if (this.isTrading()) this.send({ type: 'sell', uid }); }
    else if (target.type === 'tome') this.send({ type: 'fill-tome', uid, tomeUid: target.tomeUid });
    else this.send({ type: 'move-item', uid, x: target.x, y: target.y });
    if (this.panelSignature !== this.getPanelSignature()) this.invalidatePanel();
  }

  private cancelItemDrag(suppressClick = false) {
    const drag = this.drag; if (!drag) return;
    this.drag = null;
    if (drag.holdTimer) clearTimeout(drag.holdTimer);
    drag.holdTimer = null;
    if (drag.active || suppressClick) { this.suppressItemUntil = performance.now() + 650; this.suppressDragClick = true; }
    drag.node.classList.remove('drag-source'); drag.ghost?.remove(); drag.preview?.remove(); drag.saleZone?.classList.remove('sell-drag-over'); drag.tomeNode?.classList.remove('tome-drag-over', 'tome-drag-full'); this.root.classList.remove('is-item-dragging');
    if (drag.node.hasPointerCapture(drag.id)) drag.node.releasePointerCapture(drag.id);
  }

  private itemTooltip(node: HTMLElement, item: Item) {
    node.addEventListener('pointerenter', e => { if (e.pointerType !== 'touch' && !this.drag?.active && !this.popup) { node.setAttribute('aria-describedby', this.tooltip.id); this.showTooltip(item, e.clientX, e.clientY, node); } });
    node.addEventListener('pointermove', e => { if (this.hoveringItem === item && !this.drag?.active) this.positionTooltip(e.clientX, e.clientY); });
    node.addEventListener('pointerleave', () => { node.removeAttribute('aria-describedby'); if (this.hoveringItem === item) this.hideTooltip(); });
    node.addEventListener('focus', () => { if (this.lastItemPointer !== 'touch' && !this.drag?.active && !this.popup) { const r = node.getBoundingClientRect(); node.setAttribute('aria-describedby', this.tooltip.id); this.showTooltip(item, r.right, r.top, node); } });
    node.addEventListener('blur', () => { node.removeAttribute('aria-describedby'); if (this.hoveringItem === item) this.hideTooltip(); });
  }
  private itemProperties(item: Item): HTMLElement[] {
    const unmet = new Set(unmetItemRequirements(this.state.player!, item));
    return lines(describeItem(item)).filter(Boolean).map(line => el('div', `item-property${unmet.has(line) ? ' unmet-requirement' : ''}`, line));
  }
  private showTooltip(item: Item, x: number, y: number, node?: HTMLElement) {
    this.tooltipAnchor = node?.closest<HTMLElement>('.vendor-row') ?? node ?? null;
    const label = itemLabel(item), properties = this.itemProperties(item);
    if (properties[0]?.textContent === label) properties.shift();
    this.hoveringItem = item; this.tooltip.hidden = false; this.tooltip.replaceChildren();
    if (this.isTrading()) {
      const price = this.sellPrice(item); this.tooltip.append(el('div', 'item-sell-quote', price === null ? '不可出售' : `可售 ${price.toLocaleString()} 金币`));
      if (this.state.vendorItems.some(stock => stock.uid === item.uid)) this.tooltip.append(el('div', 'item-buy-quote', `购买 ${item.price.toLocaleString()} 金币`));
    }
    this.tooltip.append(el('h3', `quality-${item.quality}`, label), ...properties);
    this.positionTooltip(x, y);
  }
  private positionTooltip(x: number, y: number) {
    const rect = this.tooltip.getBoundingClientRect(), anchor = this.tooltipAnchor?.getBoundingClientRect();
    let left = x + 18, top = y + 12;
    if (anchor) {
      if (anchor.right + rect.width + 12 <= innerWidth - 8) left = anchor.right + 12;
      else if (anchor.left - rect.width - 12 >= 8) left = anchor.left - rect.width - 12;
      else if (anchor.top - rect.height - 8 >= 8) top = anchor.top - rect.height - 8;
      else if (anchor.bottom + rect.height + 8 <= innerHeight - 8) top = anchor.bottom + 8;
    }
    this.tooltip.style.left = `${clamp(left, 8, innerWidth - rect.width - 8)}px`; this.tooltip.style.top = `${clamp(top, 8, innerHeight - rect.height - 8)}px`;
  }
  private hideTooltip() { this.tooltip.hidden = true; this.hoveringItem = null; this.tooltipAnchor = null; }

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
    window.addEventListener('blur', () => { this.inputFocused = false; this.resetControls(); this.cancelItemDrag(); this.closeItemPopup(); this.hideTooltip(); }, options);
    window.addEventListener('focus', () => { this.inputFocused = true; this.updateControl(); }, options);
    window.addEventListener('pagehide', () => { this.resetControls(); this.cancelItemDrag(); this.closeItemPopup(); this.hideTooltip(); }, options);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { this.resetControls(); this.cancelItemDrag(); this.closeItemPopup(); this.hideTooltip(); } else this.updateControl(); }, options);
    this.root.addEventListener('focusin', e => { const target = e.target as HTMLElement; if (target.matches('input,textarea,select') || target.isContentEditable) this.resetControls(); }, options);
    window.addEventListener('resize', () => { this.renderer?.resize(); this.cancelItemDrag(); this.hideTooltip(); this.refreshItemPopup(); this.maintainMerchantLayout(true); this.updateControl(); }, options);
    window.visualViewport?.addEventListener('resize', () => this.refreshItemPopup(), options);
    window.visualViewport?.addEventListener('scroll', () => this.refreshItemPopup(), options);
  }

  private keydown(e: KeyboardEvent) {
    const target = e.target as HTMLElement;
    this.lastItemPointer = '';
    if (this.state.screen !== 'game' || !this.state.player || !this.inputFocused || document.hidden) return;
    if (this.state.paused || this.state.player.dead) {
      const scope = this.overlay.hidden ? this.panelLayer : this.overlay;
      if (e.key === 'Tab') {
        const controls = this.modalControls(scope), index = controls.indexOf(document.activeElement as HTMLElement);
        if (!controls.length) { e.preventDefault(); scope.querySelector<HTMLElement>('.modal-card')?.focus({ preventScroll: true }); }
        else if (index < 0 || e.shiftKey && index === 0 || !e.shiftKey && index === controls.length - 1) {
          e.preventDefault(); controls[e.shiftKey ? controls.length - 1 : 0]?.focus({ preventScroll: true });
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (!e.repeat && !this.state.player.dead && !this.state.savingAndExiting) {
          if (this.state.panel !== 'none') this.send({ type: 'panel', panel: 'none' }); else this.send({ type: 'pause' });
        }
      }
      return; // Native modal buttons still work; background game shortcuts never do.
    }
    if (e.key === 'Escape') {
      e.preventDefault(); if (e.repeat) return;
      if (this.drag) { this.cancelItemDrag(); return; }
      if (this.popup) { this.closeItemPopup(); if (this.state.identifySource !== null) { this.send({ type: 'cancel-identify' }); this.invalidatePanel(); } return; }
      if (this.state.identifySource !== null) { this.send({ type: 'cancel-identify' }); this.invalidatePanel(); }
      else if (this.state.panel !== 'none') this.send({ type: 'panel', panel: 'none' }); else if (!this.state.player.dead) this.send({ type: 'pause' });
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
    if (e.code === 'KeyX') {
      if (!this.state.area || this.state.player.dead || this.state.paused || this.drag || e.altKey) return;
      e.preventDefault(); this.send({ type: 'swap' }); this.updateControl(); return;
    }
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
    const dropLabel = closest(area.drops, d => this.state.showLoot || Math.hypot(d.x - player.x, d.y - player.y) < 2.8 ? labelScore(d, itemLabel(d.item), .4) : Infinity);
    if (dropLabel) return { action: { type: 'pickup', uid: dropLabel.item.uid }, uid: dropLabel.item.uid, point: { x: dropLabel.x, y: dropLabel.y } };
    const monster = closest(area.monsters.filter(m => !m.dead), m => {
      const spec = monsterSpec(m.code, m.color, m.boss, m.champion);
      const height = (spec.body === 'biped' ? 1.85 : spec.body === 'quad' ? .85 : .3) * spec.scale + spec.float;
      return score(m, .65 * Math.max(1, spec.scale), height);
    });
    if (monster) return { action: { type: 'attack', point: { x: monster.x, y: monster.y } }, uid: monster.uid, point: { x: monster.x, y: monster.y } };
    // A chest's drop keeps priority over its used footprint.
    const drop = closest(area.drops, d => score(d, .55, .2, this.state.showLoot || Math.hypot(d.x - player.x, d.y - player.y) < 2.8 ? { text: itemLabel(d.item), lift: .4 } : undefined));
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
      control.right = (press === true || !area.def.town && this.canCast()) && (!!this.pointer && !!(this.pointer.buttons & 2) || touchRight);
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

  destroy(): void { this.cancelItemDrag(); this.closeItemPopup(); this.resetControls(); this.controlHandler = null; if (this.introTimer) clearTimeout(this.introTimer); this.abort.abort(); this.renderer?.destroy(); this.root.replaceChildren(); this.fields.clear(); }
}
