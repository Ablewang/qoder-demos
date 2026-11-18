// Per-module showcase scenes (?show=...) and their stand-in input/player.
import type { GameContext } from "../types/context";
import { Vector3 } from "three";
import { PLAYER_DIMS } from "../config/world";
import { createRender, renderShowcase } from "../render";
import { applyPatch, createMaterials, materialsShowcase } from "../materials";
import {
  PROP_SIZES,
  createProps,
  propsShowcase,
  registerProp,
} from "../props/registry";
import { createLevel, levelShowcase } from "../level";
import { backdropShowcase, createBackdrop } from "../backdrop";
import { createGround, groundShowcase } from "../ground";
import { createFx, fxShowcase } from "../fx";
import { createWeapon, weaponShowcase } from "../weapon";
import { TUNE, createEnemies, enemiesShowcase } from "../enemies";

export const SHOWCASES: Record<
  string,
  {
    applyPatch?: any;
    create: any;
    showcase: any;
    TUNE?: any;
    PROP_SIZES?: any;
    register?: any;
  }
> = {
  mats: {
    applyPatch: applyPatch,
    create: createMaterials,
    showcase: materialsShowcase,
  },
  level: {
    create: createLevel,
    showcase: levelShowcase,
  },
  backdrop: {
    create: createBackdrop,
    showcase: backdropShowcase,
  },
  ground: {
    create: createGround,
    showcase: groundShowcase,
  },
  fx: {
    create: createFx,
    showcase: fxShowcase,
  },
  weapon: {
    create: createWeapon,
    showcase: weaponShowcase,
  },
  enemies: {
    TUNE: TUNE,
    create: createEnemies,
    showcase: enemiesShowcase,
  },
  props: {
    PROP_SIZES: PROP_SIZES,
    create: createProps,
    register: registerProp,
    showcase: propsShowcase,
  },
  render: {
    create: createRender,
    showcase: renderShowcase,
  },
};
export function createShowcaseInput() {
  let i = () => {};
  return {
    move: {
      x: 0,
      y: 0,
    },
    look: {
      dx: 0,
      dy: 0,
    },
    fire: false,
    ads: false,
    sprint: false,
    crouch: false,
    locked: false,
    touch: false,
    sensitivity: 1,
    down: () => false,
    pressed: () => false,
    update: i,
    endFrame: i,
    requestLock: i,
    exitLock: i,
  };
}
export function createShowcasePlayer(i: GameContext) {
  return {
    pos: new Vector3(0, 0, 4),
    vel: new Vector3(),
    yaw: 0,
    pitch: 0,
    health: 100,
    maxHealth: 100,
    alive: true,
    onGround: true,
    sprinting: false,
    crouching: false,
    ads: 0,
    speed: 0,
    eye: new Vector3(0, PLAYER_DIMS.eye, 4),
    forward: new Vector3(0, 0, -1),
    enabled: false,
    reset() {},
    damage() {},
    heal() {},
    addRecoil() {},
    addShake() {},
    update() {},
  };
}
