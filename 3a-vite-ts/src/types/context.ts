// Shared game context passed to every subsystem, plus the subsystem types.
import type * as THREE_NS from "three";
import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { QualityPreset } from "../config/quality";
import type { EventBus } from "../utils/events";
import type { Rng } from "../utils/rng";
import type { createRender } from "../render";
import type { createMaterials } from "../materials";
import type { createPhysics } from "../physics";
import type { createProps } from "../props/registry";
import type { createInput } from "../input";
import type { createLevel } from "../level";
import type { createBackdrop } from "../backdrop";
import type { createGround } from "../ground";
import type { createFx } from "../fx";
import type { createAudio } from "../audio";
import type { createPlayer } from "../player";
import type { createCombat } from "../combat";
import type { createWeapon } from "../weapon";
import type { createEnemies } from "../enemies";
import type { createHud } from "../hud";
import type { createGame } from "../game";
import type { UserData } from "../data/user-data";
import type { createNet } from "../net";

export type RenderSystem = Awaited<ReturnType<typeof createRender>>;
export type MaterialLibrary = Awaited<ReturnType<typeof createMaterials>>;
export type PhysicsSystem = ReturnType<typeof createPhysics>;
export type PropSystem = ReturnType<typeof createProps>;
export type InputSystem = ReturnType<typeof createInput>;
export type LevelSystem = Awaited<ReturnType<typeof createLevel>>;
export type BackdropSystem = Awaited<ReturnType<typeof createBackdrop>>;
export type GroundSystem = Awaited<ReturnType<typeof createGround>>;
export type FxSystem = Awaited<ReturnType<typeof createFx>>;
export type AudioSystem = Awaited<ReturnType<typeof createAudio>>;
export type PlayerSystem = ReturnType<typeof createPlayer>;
export type CombatSystem = ReturnType<typeof createCombat>;
export type WeaponSystem = Awaited<ReturnType<typeof createWeapon>>;
export type EnemySystem = Awaited<ReturnType<typeof createEnemies>>;
export type HudSystem = ReturnType<typeof createHud>;
export type GameFlow = ReturnType<typeof createGame>;
export type NetSystem = ReturnType<typeof createNet>;

export interface GameTime {
  t: number;
  dt: number;
  frame: number;
  real: number;
}

/** Scene info returned by a `?show=` showcase. */
export interface ShowcaseInfo {
  cam?: number[];
  target?: number[];
  update?: (dt: number) => void;
}

export interface BenchHarness {
  frame(dt: number): void;
}

export interface GameContext {
  THREE: typeof THREE_NS;
  userData: UserData;
  params: Record<string, string>;
  events: EventBus;
  rng: Rng;
  time: GameTime;
  quality: QualityPreset;
  showcase: string | null;
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  viewCamera: PerspectiveCamera;
  render: RenderSystem;
  mats: MaterialLibrary;
  physics: PhysicsSystem;
  props: PropSystem;
  input: InputSystem;
  level: LevelSystem;
  backdrop: BackdropSystem;
  ground: GroundSystem;
  fx: FxSystem;
  audio: AudioSystem;
  player: PlayerSystem;
  combat: CombatSystem;
  weapon: WeaponSystem;
  enemies: EnemySystem;
  hud: HudSystem;
  game: GameFlow;
  /** LAN multiplayer; absent in showcase scenes. */
  net?: NetSystem;
  showcaseInfo: ShowcaseInfo;
  bench?: BenchHarness;
}

/** Subsystem slots that boot fills (possibly with a stub). */
export type SubsystemKey =
  | "render"
  | "mats"
  | "level"
  | "backdrop"
  | "ground"
  | "fx"
  | "audio"
  | "weapon"
  | "enemies"
  | "hud";
