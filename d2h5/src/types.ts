export type ClassId = 'ama' | 'sor' | 'nec' | 'pal' | 'bar' | 'dru' | 'ass';
export type Difficulty = 'normal' | 'nightmare' | 'hell';
export type Element = 'physical' | 'fire' | 'cold' | 'lightning' | 'poison' | 'magic';
export type StatKey = 'strength' | 'dexterity' | 'vitality' | 'energy';
export type Quality = 'low' | 'normal' | 'superior' | 'magic' | 'rare' | 'set' | 'unique' | 'crafted';
export type Slot = 'head' | 'neck' | 'body' | 'weapon' | 'offhand' | 'gloves' | 'belt' | 'boots' | 'ring1' | 'ring2' | 'weapon2' | 'offhand2';
export interface Point { x: number; y: number }
export type RawRow = Record<string, string | number | boolean>;
export interface ClassDef {
  id: ClassId; name: string; english: string; description: string; color: string;
  strength: number; dexterity: number; vitality: number; energy: number;
  life: number; mana: number; stamina: number;
  lifePerLevel: number; manaPerLevel: number; staminaPerLevel: number;
  lifePerVitality: number; manaPerEnergy: number; staminaPerVitality: number;
  blockFactor: number; arFactor: number; weapon: string; trees: string[];
}
export interface SkillDef {
  id: number; key: string; name: string; classId: ClassId; tree: number; level: number;
  prerequisites: number[]; row: number; column: number; raw: RawRow;
  supported: boolean; description: string;
}
export interface SkillEffect {
  kind: 'melee' | 'projectile' | 'nova' | 'area' | 'summon' | 'aura' | 'buff' | 'curse' | 'teleport' | 'passive';
  element: Element; mana: number; min: number; max: number; radius: number;
  projectiles: number; duration: number; supported: boolean; description: string;
}
export interface ItemMods { [key: string]: number }
export interface BaseItem {
  code: string; name: string; english: string; type: string; slot?: Slot;
  width: number; height: number; minDamage: number; maxDamage: number;
  defenseMin: number; defenseMax: number; strength: number; dexterity: number;
  requiredLevel: number; qlvl: number; maxSockets: number; durability: number;
  twoHanded: boolean; classId?: ClassId; beltRows: number; raw: RawRow;
}
export interface Item {
  uid: string; code: string; name: string; quality: Quality; ilvl: number;
  width: number; height: number; x: number; y: number;
  identified: boolean; ethereal: boolean; durability: number; maxDurability: number;
  minDamage: number; maxDamage: number; defense: number; mods: ItemMods;
  sockets: number; socketed: string[]; runeword?: string; requiredLevel: number;
  price: number; quantity: number;
}
export interface DerivedStats {
  strength: number; dexterity: number; vitality: number; energy: number;
  maxLife: number; maxMana: number; maxStamina: number; defense: number; attackRating: number;
  minDamage: number; maxDamage: number; block: number;
  resFire: number; resCold: number; resLightning: number; resPoison: number;
  resistances: Record<'fire' | 'cold' | 'lightning' | 'poison', { stored: number; maximum: number; effective: number }>;
  magicFind: number; goldFind: number; fcr: number; fhr: number; ias: number; frw: number;
  lifeLeech: number; manaLeech: number; damageReduction: number; flatReduction: number; flatMagicReduction: number;
  criticalStrike: number; deadlyStrike: number; manaRegenPercent: number;
  elementalDamage: Record<'fire' | 'cold' | 'lightning' | 'magic', { min: number; max: number }>;
  coldLength: number; allSkills: number; beltRows: number;
  equipmentAuras: number[];
}
export interface Player extends Point {
  classId: ClassId; name: string; level: number; experience: number; difficulty: Difficulty;
  strength: number; dexterity: number; vitality: number; energy: number;
  statPoints: number; skillPoints: number; skills: Record<number, number>;
  life: number; mana: number; stamina: number; gold: number;
  inventory: Item[]; stash: Item[]; cube: Item[]; equipment: Partial<Record<Slot, Item>>;
  belt: (Item | null)[]; weaponSwap: boolean;
  quests: Record<string, number>; waypoints: number[]; unlockedActs: number; unlockedDifficulties: number;
  bonusLife: number; bonusResist: number; leftSkill: number; rightSkill: number;
  running: boolean; dead: boolean; corpse?: {areaId: number; x: number; y: number; equipment: Partial<Record<Slot, Item>>};
  mercenary?: {
    name: string;
    /** 'rogue-fire'|'rogue-cold'|'desert-guard'|'iron-wolf'|'barbarian' */
    type: string;
    life: number; maxLife: number; level: number;
    equipment: Partial<Record<'head' | 'body' | 'weapon', Item>>;
    x: number; y: number; cooldown: number;
  };
}
export interface AreaDef {
  id: number; name: string; english: string; act: number; town: boolean; waypoint: boolean;
  levels: [number, number, number]; connections: number[];
  style: 'town' | 'grass' | 'cave' | 'dungeon' | 'desert' | 'jungle' | 'hell' | 'snow';
  monsters: string[];
}
/** Runtime only. Tile coordinates belong to the containing AreaState (global on surface regions).
 * Ports are N/E/S/W = 1/2/4/8; adjacent linked blocks have reciprocal three-tile openings.
 */
export interface AreaLayout {
  blockSize: number;
  blocks: { x: number; y: number; width: number; height: number; ports: number; template: string; center: Point }[];
}
export interface SurfaceRegion {
  def: AreaDef; x: number; y: number; width: number; height: number; spawn: Point; seed: number;
  layout?: AreaLayout;
}
export interface Monster extends Point {
  regionId?: number;
  uid: string; code: string; name: string; level: number; life: number; maxLife: number;
  minDamage: number; maxDamage: number; defense: number; attackRating: number; experience: number;
  resists: Record<Element, number>; boss: boolean; champion: boolean;
  ai: 'melee' | 'ranged' | 'shaman' | 'boss'; color: string;
  cooldown: number; dead: boolean; chill: number; poison: number; poisonFrames: number;
  target?: Point; modifiers: string[];
}
export interface GroundItem extends Point { item: Item }
export interface WorldObject extends Point {
  uid: string; kind: 'exit' | 'npc' | 'waypoint' | 'stash' | 'chest' | 'shrine' | 'portal' | 'corpse';
  name: string; targetArea?: number; npcId?: string; used?: boolean; regionId?: number; seam?: boolean;
  shrineCode?: number; shrineReadyTick?: number;
}
export interface AreaState {
  def: AreaDef; width: number; height: number; tiles: number[][]; revealed: boolean[][];
  monsters: Monster[]; objects: WorldObject[]; drops: GroundItem[];
  spawn: Point; seed: number; regions?: SurfaceRegion[]; layout?: AreaLayout;
}
export interface QuestDef { id: string; act: number; number: number; name: string; description: string; reward: string }
export interface Projectile extends Point {
  uid: string; dx: number; dy: number; owner: 'player' | 'monster' | 'summon';
  min: number; max: number; element: Element; life: number; radius: number; skillId: number; ownerUid?: string; explosionRadius?: number; chillDuration?: number;
}
export interface Effect extends Point {
  kind: 'hit' | 'fire' | 'cold' | 'lightning' | 'poison' | 'nova' | 'summon' | 'portal' | 'heal' | 'level' | 'text';
  life: number; maxLife: number; radius: number; text?: string; color?: string;
}
export interface GameEvent {
  seq: number; tick: number; actor: string; kind: 'attack' | 'cast' | 'hurt' | 'death' | 'block' | 'miss' | 'revive';
  x: number; y: number; tx: number; ty: number; element: Element;
}
export interface Control { move: Point; aim: Point | null; aimMonster: string | null; left: boolean; right: boolean }
export interface Summon extends Point { uid: string; name: string; life: number; maxLife: number; min: number; max: number; cooldown: number; duration: number; color: string }
export interface GamblingOffer { uid: string; code: string; item: Item }
export type Panel = 'inventory' | 'character' | 'skills' | 'quests' | 'waypoint' | 'stash' | 'cube' | 'vendor' | 'gamble' | 'help' | 'catalog' | 'none';
export interface CharacterSave {
  id: string; name: string; classId: ClassId; level: number; difficulty: Difficulty; unlockedDifficulties: number; timestamp: number;
}
export interface GameState {
  screen: 'intro' | 'title' | 'creation' | 'game'; player: Player | null; area: AreaState | null;
  characters: CharacterSave[]; activeSaveId: string | null; storageStatus: 'loading' | 'ready' | 'error'; storageError: string; loadingSave: boolean; savingAndExiting: boolean;
  stats: DerivedStats | null; panel: Panel; projectiles: Projectile[]; effects: Effect[]; summons: Summon[];
  shrineBuff?: {code: number; name: string; frames: number};
  events: GameEvent[]; eventSeq: number; facing: number; moving: boolean;
  messages: {text: string; time: number; kind: 'info' | 'loot' | 'error'}[];
  tick: number; seed: number; paused: boolean; automap: boolean; showLoot: boolean;
  target: Point | null; selectedMonster: string | null; selectedItem: string | null; identifySource: string | null;
  npc: string | null; vendorItems: Item[]; gamblingOffers: GamblingOffer[]; dialogue: string; saved: boolean;
}
export type Action =
  | {type: 'new'; classId: ClassId; name: string}
  | {type: 'continue'; id: string; difficulty?: Difficulty} | {type: 'delete-character'; id: string} | {type: 'creation'} | {type: 'title'} | {type: 'select-difficulty'; difficulty: Difficulty}
  | {type: 'move'; point: Point} | {type: 'attack'; point: Point; right?: boolean}
  | {type: 'interact'; uid: string} | {type: 'pickup'; uid: string}
  | {type: 'panel'; panel: Panel} | {type: 'stat'; stat: StatKey}
  | {type: 'learn'; skillId: number} | {type: 'bind'; skillId: number; right: boolean}
  | {type: 'equip'; uid: string} | {type: 'unequip'; slot: Slot}
  | {type: 'drop'; uid: string} | {type: 'potion'; column: number}
  | {type: 'move-item'; uid: string; x: number; y: number}
  | {type: 'fill-tome'; uid: string; tomeUid: string}
  | {type: 'use-item'; uid: string; targetUid?: string} | {type: 'cancel-identify'}
  | {type: 'identify'; uid?: string} | {type: 'buy'; uid: string} | {type: 'sell'; uid: string}
  | {type: 'gamble-open'} | {type: 'gamble-refresh'} | {type: 'gamble-buy'; uid: string}
  | {type: 'repair'} | {type: 'heal'} | {type: 'portal'} | {type: 'travel'; areaId: number}
  | {type: 'storage'; uid: string; destination: 'inventory' | 'stash' | 'cube'}
  | {type: 'socket'; itemUid: string; runeUid: string} | {type: 'transmute'}
  | {type: 'save'} | {type: 'save-and-title'} | {type: 'run'} | {type: 'map'} | {type: 'loot'} | {type: 'pause'}
  | {type: 'swap'} | {type: 'respawn'} | {type: 'respec'}
  | {type: 'difficulty'; difficulty: Difficulty}
  | {type: 'hire-merc'; mercType: string}
  | {type: 'resurrect-merc'}
  | {type: 'merc-equip'; uid: string}
  | {type: 'merc-unequip'; slot: 'head' | 'body' | 'weapon'}
  | {type: 'imbue'; itemUid: string}
  | {type: 'larzuk-socket'; itemUid: string}
  | {type: 'personalize'; itemUid: string}
  | {type: 'open-cow-portal'};
export type Dispatch = (action: Action) => void;
export type Rng = () => number;
