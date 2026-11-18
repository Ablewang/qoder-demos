import * as THREE from 'three';
import { RigBuilder, type RigTemplate, box, cyl, ball, cone, merge, place } from './geo';

export type Body = 'biped' | 'quad' | 'bird';
export type HeadKind = 'plain' | 'hair' | 'helm' | 'horns' | 'hood' | 'mask' | 'skull' | 'imp' | 'big' | 'crown' | 'beard';
export type WeaponKind = 'sword' | 'axe' | 'mace' | 'staff' | 'spear' | 'bow' | 'claw' | null;
export type Offhand = 'shield' | 'quiver' | 'orb' | null;
export interface Spec {
  body: Body; scale: number; bulk: number;
  skin: string; cloth: string; cloth2: string; metal: string; accent: string;
  head: HeadKind; robe: boolean; cape: boolean; apron: boolean; hunch: number;
  weapon: WeaponKind; offhand: Offhand; spikes: boolean; ghost: boolean; float: number;
}

const DEFAULT: Spec = {
  body: 'biped', scale: 1, bulk: 1, skin: '#b98d6c', cloth: '#5d5446', cloth2: '#3b342b', metal: '#9a9890', accent: '#7a4a2a',
  head: 'plain', robe: false, cape: false, apron: false, hunch: 0, weapon: null, offhand: null, spikes: false, ghost: false, float: 0,
};
export const spec = (s: Partial<Spec>): Spec => ({ ...DEFAULT, ...s });
export const specKey = (s: Spec) => JSON.stringify(s);

const CLASS: Record<string, Partial<Spec>> = {
  ama: { skin: '#c99a76', cloth: '#7a6a4a', cloth2: '#4d3f2b', accent: '#c9b27a', head: 'hair', bulk: .95 },
  sor: { skin: '#d2a684', cloth: '#344f7a', cloth2: '#22324e', accent: '#b9a46a', head: 'hair', robe: true, bulk: .92 },
  nec: { skin: '#cfc8bb', cloth: '#26262a', cloth2: '#141416', accent: '#8f9a8a', head: 'plain', robe: true, bulk: .95 },
  pal: { skin: '#c29576', cloth: '#7a2a26', cloth2: '#4a1a18', metal: '#b9b6ac', accent: '#d8c07a', head: 'helm', bulk: 1.1 },
  bar: { skin: '#b9855f', cloth: '#5a4430', cloth2: '#3a2a1c', metal: '#8d8a80', accent: '#8a6a3a', head: 'horns', bulk: 1.22 },
  dru: { skin: '#b98d6c', cloth: '#4d5a34', cloth2: '#2f3820', accent: '#8a7a4a', head: 'hood', cape: true, bulk: 1.05 },
  ass: { skin: '#c49a7c', cloth: '#3a3442', cloth2: '#221e28', metal: '#7d7f86', accent: '#a05a4a', head: 'mask', bulk: .95 },
};
const CLASS_WEAPON: Record<string, WeaponKind> = { ama: 'spear', sor: 'staff', nec: 'staff', pal: 'sword', bar: 'axe', dru: 'mace', ass: 'claw' };

export function playerSpec(classId: string, weaponArt: string | null, offhandArt: string | null): Spec {
  const known: WeaponKind[] = ['sword', 'axe', 'mace', 'staff', 'spear', 'bow'];
  let weapon: WeaponKind = weaponArt ? (known.includes(weaponArt as WeaponKind) ? weaponArt as WeaponKind : 'sword') : null;
  if (weapon === 'sword' && classId === 'ass' && weaponArt === 'sword') weapon = 'claw';
  let offhand: Offhand = offhandArt === 'shield' ? 'shield' : offhandArt === 'arrows' ? 'quiver' : offhandArt === 'staff' ? 'orb' : null;
  if (weapon === 'bow' && !offhand) offhand = 'quiver';
  return spec({ ...CLASS[classId], weapon, offhand });
}
export const defaultClassWeapon = (classId: string) => CLASS_WEAPON[classId] ?? 'sword';

export function monsterSpec(code: string, color: string, boss: boolean, champion: boolean): Spec {
  const base = code.replace(/\d+$/, '');
  let s: Partial<Spec>;
  switch (base) {
    case 'fallen': s = { scale: .62, skin: '#a8402e', cloth: '#5a3a22', cloth2: '#3a2414', head: 'imp', weapon: 'mace', hunch: .25, bulk: .9 }; break;
    case 'fallenshaman': s = { scale: .66, skin: '#b5552e', cloth: '#7a2a20', cloth2: '#4a1810', head: 'imp', weapon: 'staff', offhand: 'orb', robe: true, hunch: .2, accent: '#ff7a2a' }; break;
    case 'zombie': s = { skin: '#7d8a5d', cloth: '#4a4232', cloth2: '#2e2a20', head: 'plain', hunch: .45, bulk: 1.05 }; break;
    case 'skeleton': s = { skin: '#d7d0bc', cloth: '#d7d0bc', cloth2: '#b9b29e', metal: '#7d7a70', head: 'skull', weapon: 'sword', offhand: 'shield', bulk: .8 }; break;
    case 'sk_archer': s = { skin: '#d7d0bc', cloth: '#d7d0bc', cloth2: '#b9b29e', head: 'skull', weapon: 'bow', offhand: 'quiver', bulk: .8 }; break;
    case 'skmage_fire': case 'skmage': s = { skin: '#d7d0bc', cloth: '#7a3020', cloth2: '#4a1a10', head: 'skull', weapon: 'staff', offhand: 'orb', robe: true, bulk: .8, accent: '#ff8a3a' }; break;
    case 'quillrat': s = { body: 'quad', scale: .7, skin: '#6e5a42', cloth: '#4a3a2a', cloth2: '#2e241a', accent: '#d8cfb8', spikes: true }; break;
    case 'brute': s = { scale: 1.3, skin: '#8a6a5a', cloth: '#5a4a3a', cloth2: '#3a2e22', head: 'big', hunch: .4, bulk: 1.45 }; break;
    case 'corruptrogue': s = { skin: '#9a8a8a', cloth: '#5a2a3a', cloth2: '#3a1a24', head: 'hair', weapon: 'sword', bulk: .92 }; break;
    case 'cr_archer': s = { skin: '#9a8a8a', cloth: '#4a3a4a', cloth2: '#2a1e2a', head: 'hood', weapon: 'bow', offhand: 'quiver', bulk: .9 }; break;
    case 'cr_lancer': s = { skin: '#9a8a8a', cloth: '#4a2a2a', cloth2: '#2a1818', head: 'helm', weapon: 'spear', bulk: .95 }; break;
    case 'goatman': s = { scale: 1.1, skin: '#6a5038', cloth: '#4a3828', cloth2: '#2e2218', head: 'horns', weapon: 'axe', hunch: .15, bulk: 1.15 }; break;
    case 'crownest': s = { body: 'bird', scale: .7, skin: '#2a2a30', cloth: '#1e1e24', cloth2: '#101014', accent: '#c9a040', float: 1.15 }; break;
    case 'wraith': s = { skin: '#8aa0a8', cloth: '#5a6e78', cloth2: '#3a4a52', head: 'hood', robe: true, ghost: true, float: .35, accent: '#a0e0ff' }; break;
    case 'bighead': s = { scale: .8, skin: '#8a7a9a', cloth: '#5a4a6a', cloth2: '#3a2e46', head: 'big', robe: true, offhand: 'orb', accent: '#c080ff' }; break;
    case 'fetish': s = { scale: .55, skin: '#8a6a3a', cloth: '#5a3a1a', head: 'mask', weapon: 'spear', hunch: .2 }; break;
    case 'andariel': s = { scale: 1.9, skin: '#b0603a', cloth: '#6a2030', cloth2: '#3a1018', accent: '#e0b060', metal: '#c0a060', head: 'horns', weapon: 'claw', robe: true, spikes: true, bulk: 1.05 }; break;
    case 'bloodraven': s = { scale: 1.05, skin: '#a08080', cloth: '#8a1a1a', cloth2: '#4a0a0a', head: 'hair', weapon: 'bow', offhand: 'quiver', cape: true, accent: '#ff3030' }; break;
    case 'smith': s = { scale: 1.55, skin: '#8a6a4a', cloth: '#4a3a2a', cloth2: '#2a2018', head: 'big', weapon: 'mace', apron: true, bulk: 1.5, hunch: .25 }; break;
    default: s = { skin: color, cloth: shade(color, .7), cloth2: shade(color, .45), head: 'plain', weapon: 'sword' };
  }
  const out = spec(s);
  if (boss) out.scale *= 1.15;
  else if (champion) { out.scale *= 1.1; out.cloth = mix(out.cloth, '#3a6aff', .35); }
  return out;
}

export function npcSpec(id: string): Spec {
  const table: Record<string, Partial<Spec>> = {
    akara: { cloth: '#5a3a7a', cloth2: '#3a2450', head: 'hood', robe: true, weapon: 'staff' },
    charsi: { skin: '#c99a76', cloth: '#6a4a2a', cloth2: '#3a2a18', head: 'hair', apron: true, weapon: 'mace', bulk: 1.05 },
    gheed: { cloth: '#7a6a2a', cloth2: '#4a3a18', head: 'beard', bulk: 1.3 },
    kashya: { cloth: '#6a2a2a', cloth2: '#3a1818', head: 'hair', weapon: 'bow', offhand: 'quiver' },
    warriv: { cloth: '#3a5a6a', cloth2: '#243a46', head: 'beard', cape: true, weapon: 'sword' },
    cain: { cloth: '#6a6458', cloth2: '#44403a', head: 'beard', robe: true, weapon: 'staff', hunch: .2 },
    flavie: { cloth: '#5a4a2a', cloth2: '#3a2e18', head: 'hair', weapon: 'bow', offhand: 'quiver' },
  };
  return spec(table[id] ?? { cloth: '#5a5040', head: 'plain' });
}

export function summonSpec(color: string): Spec {
  return spec({ scale: .9, skin: '#d7d0bc', cloth: mix('#d7d0bc', color, .35), cloth2: '#a8a28e', head: 'skull', weapon: 'sword', offhand: 'shield', bulk: .8 });
}

function shade(hex: string, k: number): string {
  const c = new THREE.Color(hex).multiplyScalar(k); return `#${c.getHexString()}`;
}
function mix(a: string, b: string, k: number): string {
  const c = new THREE.Color(a).lerp(new THREE.Color(b), k); return `#${c.getHexString()}`;
}

function weaponGeo(kind: WeaponKind, s: Spec): THREE.BufferGeometry | null {
  const metal = s.metal, wood = '#6a4a2a', dark = '#3a2a1a';
  let parts: THREE.BufferGeometry[] = [], tilt = -1.2;
  switch (kind) {
    case 'sword': parts = [cyl(.025, .025, .16, dark, [0, .04, 0]), box(.18, .03, .05, s.accent, [0, -.05, 0]), box(.06, .72, .018, metal, [0, -.42, 0]), cone(.03, .08, metal, [0, -.82, 0], [Math.PI, 0, 0], 4)]; break;
    case 'axe': parts = [cyl(.025, .025, .78, wood, [0, -.28, 0]), box(.03, .2, .2, metal, [0, -.58, .1]), box(.02, .24, .04, metal, [0, -.58, .2])]; break;
    case 'mace': parts = [cyl(.025, .03, .62, wood, [0, -.24, 0]), ball(.1, metal, [0, -.58, 0], 1, 0), cone(.03, .1, metal, [.1, -.58, 0], [0, 0, -Math.PI / 2], 4), cone(.03, .1, metal, [-.1, -.58, 0], [0, 0, Math.PI / 2], 4)]; tilt = -1.1; break;
    case 'staff': parts = [cyl(.025, .03, 1.7, wood, [0, -.25, 0]), ball(.06, s.accent, [0, .62, 0], 1, 0)]; tilt = -.2; break;
    case 'spear': parts = [cyl(.022, .022, 1.9, wood, [0, -.35, 0]), cone(.045, .26, metal, [0, -1.42, 0], [Math.PI, 0, 0], 4)]; tilt = -1.45; break;
    case 'claw': parts = [box(.08, .06, .1, metal, [0, -.02, .02]), ...[-.03, 0, .03].map(x => cone(.015, .3, metal, [x, -.18, .08], [Math.PI - .5, 0, 0], 3))]; tilt = 0; break;
    default: return null;
  }
  const geo = merge(parts);
  place(geo, [0, -.3, .02], [tilt, 0, 0]);
  return geo;
}

function bowGeo(s: Spec): THREE.BufferGeometry {
  const wood = '#7a5530';
  return place(merge([
    box(.04, .08, .05, '#3a2a1a'),
    box(.025, .025, .5, wood, [0, .06, .24], [.32, 0, 0]),
    box(.025, .025, .5, wood, [0, .06, -.24], [-.32, 0, 0]),
    box(.006, .006, .96, '#d8d0b8', [0, .16, 0]),
    box(.02, .02, .02, s.accent, [0, .02, .48]),
  ]), [0, -.3, .03]);
}

function headGeo(s: Spec): THREE.BufferGeometry[] {
  const skin = s.skin, hair = '#2a1e16', g: THREE.BufferGeometry[] = [cyl(.05, .06, .1, skin, [0, .02, 0])];
  const face = (r = .14) => ball(r, skin, [0, .14, 0], [1, 1.12, 1]);
  const eyes = (color = '#1a1410', y = .16) => [box(.035, .02, .02, color, [.05, y, .12]), box(.035, .02, .02, color, [-.05, y, .12])];
  switch (s.head) {
    case 'plain': g.push(face(), ball(.145, hair, [0, .2, -.02], [1, .6, 1]), ...eyes()); break;
    case 'hair': g.push(face(), ball(.15, hair, [0, .19, -.02], [1, .7, 1.05]), box(.1, .3, .06, hair, [0, .02, -.13]), ...eyes()); break;
    case 'beard': g.push(face(), ball(.145, '#8a8478', [0, .2, -.02], [1, .55, 1]), cone(.1, .22, '#a8a294', [0, .0, .08], [Math.PI, 0, 0], 6), ...eyes()); break;
    case 'helm': g.push(ball(.165, s.metal, [0, .15, 0], [1, 1.1, 1.05]), box(.16, .025, .04, '#151515', [0, .15, .15]), box(.03, .1, .2, s.accent, [0, .3, -.02])); break;
    case 'horns': g.push(face(), ball(.15, s.metal, [0, .2, 0], [1, .7, 1]), cone(.04, .22, '#e0d6bc', [.16, .3, 0], [0, 0, -.7], 5), cone(.04, .22, '#e0d6bc', [-.16, .3, 0], [0, 0, .7], 5), ...eyes()); break;
    case 'hood': g.push(face(.13), cone(.2, .42, s.cloth2, [0, .2, -.02], [-.12, 0, 0], 7), box(.17, .1, .03, '#100c0a', [0, .14, .12]), ...eyes(s.accent === '#a0e0ff' ? '#a0e0ff' : '#e0c080', .15)); break;
    case 'mask': g.push(face(), ball(.15, hair, [0, .2, -.02], [1, .65, 1]), box(.24, .1, .04, s.metal, [0, .15, .13]), box(.2, .015, .02, '#e04030', [0, .15, .155])); break;
    case 'skull': g.push(ball(.13, skin, [0, .14, 0], [.95, 1.1, 1.05]), box(.04, .04, .02, '#1a1410', [.045, .15, .12]), box(.04, .04, .02, '#1a1410', [-.045, .15, .12]), box(.1, .05, .08, skin, [0, .04, .07])); break;
    case 'imp': g.push(ball(.15, skin, [0, .12, .03], [1.1, .95, 1.1]), cone(.04, .18, skin, [.15, .2, 0], [0, 0, -1.1], 4), cone(.04, .18, skin, [-.15, .2, 0], [0, 0, 1.1], 4), box(.04, .03, .02, '#ffd040', [.05, .14, .16]), box(.04, .03, .02, '#ffd040', [-.05, .14, .16])); break;
    case 'big': g.push(ball(.2, skin, [0, .16, .03], [1.1, 1, 1.1]), ...eyes('#ffd040', .18).map(e => e.translate(0, 0, .08))); break;
    case 'crown': g.push(face(), cyl(.14, .14, .07, s.accent, [0, .26, 0]), ...eyes()); break;
  }
  return g;
}

export function buildRig(s: Spec): RigTemplate {
  if (s.body === 'quad') return buildQuad(s);
  if (s.body === 'bird') return buildBird(s);
  const b = s.bulk, r = new RigBuilder();
  r.bone('root', null, 0, 0, 0).bone('hips', 'root', 0, .84, 0).bone('torso', 'hips', 0, .08, 0).bone('head', 'torso', 0, .56, 0)
    .bone('armR', 'torso', -.24 * b, .47, 0).bone('foreR', 'armR', 0, -.3, 0)
    .bone('armL', 'torso', .24 * b, .47, 0).bone('foreL', 'armL', 0, -.3, 0)
    .bone('legR', 'hips', -.11 * b, 0, 0).bone('shinR', 'legR', 0, -.42, 0)
    .bone('legL', 'hips', .11 * b, 0, 0).bone('shinL', 'legL', 0, -.42, 0);
  const { skin, cloth, cloth2 } = s;
  r.add('hips', box(.36 * b, .2, .24 * b, cloth2, [0, .0, 0]), box(.38 * b, .05, .26 * b, s.accent, [0, .08, 0]));
  r.add('torso', box(.42 * b, .5, .26 * b, cloth, [0, .27, 0]), box(.5 * b, .14, .3 * b, cloth2, [0, .46, 0]), box(.3 * b, .2, .02, s.accent, [0, .34, .135 * b]));
  r.add('head', ...headGeo(s));
  for (const side of ['R', 'L'] as const) {
    r.add(`arm${side}`, ball(.085 * b, cloth2, [0, -.02, 0], 1, 0), cyl(.06 * b, .055 * b, .3, cloth, [0, -.15, 0]));
    r.add(`fore${side}`, cyl(.052 * b, .045 * b, .28, s.robe ? cloth : skin, [0, -.14, 0]), ball(.055 * b, skin, [0, -.3, .01], 1, 0));
    r.add(`leg${side}`, cyl(.075 * b, .065 * b, .42, cloth2, [0, -.21, 0]));
    r.add(`shin${side}`, cyl(.06 * b, .05 * b, .38, cloth2, [0, -.19, 0]), box(.1 * b, .07, .2, '#2a2018', [0, -.39, .04]));
  }
  if (s.robe) r.add('hips', cyl(.2 * b, .34 * b, .8, cloth, [0, -.38, 0], [0, 0, 0], 8), cyl(.34 * b, .35 * b, .05, cloth2, [0, -.78, 0], [0, 0, 0], 8));
  if (s.apron) r.add('torso', box(.36 * b, .7, .02, '#4a3420', [0, -.05, .15 * b]));
  if (s.cape) r.add('torso', box(.44 * b, .95, .03, cloth2, [0, -.02, -.16 * b], [-.1, 0, 0]));
  if (s.spikes) r.add('torso', ...[-.12, 0, .12].map(x => cone(.04, .2, s.accent, [x * b, .5, -.12], [-.6, 0, 0], 4)));
  const weapon = s.weapon === 'bow' ? null : weaponGeo(s.weapon, s);
  if (weapon) r.add('foreR', weapon);
  if (s.weapon === 'claw') { const left = weaponGeo('claw', s); if (left) r.add('foreL', left); }
  if (s.weapon === 'bow') r.add('foreL', bowGeo(s));
  if (s.offhand === 'shield') r.add('foreL', cyl(.22, .22, .04, s.metal, [.09 * b, -.17, .03], [0, 0, Math.PI / 2], 9), ball(.04, s.accent, [.115 * b, -.17, .03], 1, 0));
  if (s.offhand === 'orb') r.add('foreL', ball(.075, s.accent, [0, -.36, .05], 1, 1));
  if (s.offhand === 'quiver') r.add('torso', cyl(.06, .05, .5, '#5a3a20', [.1 * b, .3, -.17 * b], [.35, 0, -.25]), ...[0, .03, -.03].map(x => box(.01, .12, .01, '#d8d0b8', [.1 * b + x - .06, .6, -.08 * b])));
  return r.build();
}

function buildQuad(s: Spec): RigTemplate {
  const r = new RigBuilder();
  r.bone('root', null, 0, 0, 0).bone('body', 'root', 0, .36, 0).bone('head', 'body', 0, .04, .32)
    .bone('legFR', 'body', -.14, -.08, .2).bone('legFL', 'body', .14, -.08, .2)
    .bone('legBR', 'body', -.14, -.08, -.2).bone('legBL', 'body', .14, -.08, -.2);
  r.add('body', ball(.28, s.skin, [0, .04, 0], [1, .7, 1.35], 1), ball(.2, s.cloth, [0, .14, -.1], [1, .6, 1.2], 0));
  r.add('head', ball(.15, s.skin, [0, 0, .08], [1, .9, 1.2], 0), cone(.06, .14, '#2a2018', [0, -.02, .24], [Math.PI / 2, 0, 0], 4), box(.04, .03, .02, '#ffd040', [.06, .05, .17]), box(.04, .03, .02, '#ffd040', [-.06, .05, .17]));
  for (const name of ['legFR', 'legFL', 'legBR', 'legBL']) r.add(name, cyl(.045, .035, .28, s.cloth2, [0, -.14, 0]));
  if (s.spikes) {
    const spikes: THREE.BufferGeometry[] = [];
    for (let i = 0; i < 9; i++) spikes.push(cone(.025, .3, s.accent, [((i % 3) - 1) * .12, .22, -.2 + Math.floor(i / 3) * .16], [-.5 + Math.floor(i / 3) * .1, 0, ((i % 3) - 1) * -.5], 3));
    r.add('body', ...spikes);
  }
  return r.build();
}

function buildBird(s: Spec): RigTemplate {
  const r = new RigBuilder();
  r.bone('root', null, 0, 0, 0).bone('body', 'root', 0, 0, 0).bone('head', 'body', 0, .06, .2)
    .bone('wingR', 'body', -.08, .04, 0).bone('wingL', 'body', .08, .04, 0);
  r.add('body', ball(.13, s.skin, [0, 0, 0], [1, .85, 1.6], 0), box(.16, .02, .2, s.cloth, [0, 0, -.26]));
  r.add('head', ball(.08, s.skin, [0, 0, .04], 1, 0), cone(.03, .1, s.accent, [0, -.01, .14], [Math.PI / 2, 0, 0], 4), box(.02, .02, .02, '#ff3020', [.05, .02, .08]), box(.02, .02, .02, '#ff3020', [-.05, .02, .08]));
  r.add('wingR', box(.5, .02, .22, s.cloth, [-.25, 0, -.02]), box(.25, .02, .14, s.cloth2, [-.55, 0, -.05]));
  r.add('wingL', box(.5, .02, .22, s.cloth, [.25, 0, -.02]), box(.25, .02, .14, s.cloth2, [.55, 0, -.05]));
  return r.build();
}

const cache = new Map<string, { template: RigTemplate; references: number }>();
export function rigTemplate(s: Spec): RigTemplate {
  const key = specKey(s);
  let entry = cache.get(key);
  if (!entry) { entry = { template: buildRig(s), references: 0 }; cache.set(key, entry); }
  entry.references++;
  return entry.template;
}
export function releaseRig(key: string): void {
  const entry = cache.get(key)!;
  if (--entry.references === 0) { entry.template.geometry.dispose(); cache.delete(key); }
}
