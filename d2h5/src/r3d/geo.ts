import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type V3 = [number, number, number];
const tmpColor = new THREE.Color();
const tmpMatrix = new THREE.Matrix4();
const tmpQuat = new THREE.Quaternion();
const tmpEuler = new THREE.Euler();
const tmpPos = new THREE.Vector3();
const tmpScale = new THREE.Vector3();

export function tint(geo: THREE.BufferGeometry, color: THREE.ColorRepresentation): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  if (g !== geo) geo.dispose();
  if (g.getAttribute('uv')) g.deleteAttribute('uv');
  tmpColor.set(color);
  const count = g.getAttribute('position').count, data = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) { data[i * 3] = tmpColor.r; data[i * 3 + 1] = tmpColor.g; data[i * 3 + 2] = tmpColor.b; }
  g.setAttribute('color', new THREE.BufferAttribute(data, 3));
  return g;
}

export function place(geo: THREE.BufferGeometry, pos: V3 = [0, 0, 0], rot: V3 = [0, 0, 0], scale: V3 | number = 1): THREE.BufferGeometry {
  const s = typeof scale === 'number' ? [scale, scale, scale] : scale;
  tmpMatrix.compose(tmpPos.set(...pos), tmpQuat.setFromEuler(tmpEuler.set(...rot)), tmpScale.set(s[0], s[1], s[2]));
  return geo.applyMatrix4(tmpMatrix);
}

type C = THREE.ColorRepresentation;
export const box = (w: number, h: number, d: number, color: C, pos?: V3, rot?: V3) => place(tint(new THREE.BoxGeometry(w, h, d), color), pos, rot);
export const cyl = (top: number, bottom: number, h: number, color: C, pos?: V3, rot?: V3, seg = 7) => place(tint(new THREE.CylinderGeometry(top, bottom, h, seg), color), pos, rot);
export const ball = (r: number, color: C, pos?: V3, scale: V3 | number = 1, detail = 1) => place(tint(new THREE.IcosahedronGeometry(r, detail), color), pos, [0, 0, 0], scale);
export const cone = (r: number, h: number, color: C, pos?: V3, rot?: V3, seg = 6) => place(tint(new THREE.ConeGeometry(r, h, seg), color), pos, rot);
export const rock = (r: number, color: C, pos?: V3, scale: V3 | number = 1, rot?: V3) => place(tint(new THREE.DodecahedronGeometry(r, 0), color), pos, rot, scale);

export function merge(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error('无法合并几何体');
  merged.computeBoundingSphere();
  return merged;
}

export function actorMaterial(transparent = false): THREE.MeshLambertMaterial {
  return new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true, transparent, opacity: transparent ? .78 : 1 });
}

export interface RigTemplate { geometry: THREE.BufferGeometry; names: string[]; parents: number[]; local: V3[] }

export class RigBuilder {
  private names: string[] = [];
  private parents: number[] = [];
  private local: V3[] = [];
  private world: V3[] = [];
  private parts: THREE.BufferGeometry[] = [];

  bone(name: string, parent: string | null, x: number, y: number, z: number): this {
    const p = parent ? this.names.indexOf(parent) : -1;
    const base: V3 = p >= 0 ? this.world[p] : [0, 0, 0];
    this.names.push(name); this.parents.push(p); this.local.push([x, y, z]);
    this.world.push([base[0] + x, base[1] + y, base[2] + z]);
    return this;
  }

  has(name: string): boolean { return this.names.includes(name); }

  add(name: string, ...geos: THREE.BufferGeometry[]): this {
    const index = this.names.indexOf(name);
    if (index < 0) throw new Error(`未知骨骼 ${name}`);
    const [x, y, z] = this.world[index];
    for (const geo of geos) {
      geo.translate(x, y, z);
      const count = geo.getAttribute('position').count;
      const skinIndex = new Uint16Array(count * 4), skinWeight = new Float32Array(count * 4);
      for (let i = 0; i < count; i++) { skinIndex[i * 4] = index; skinWeight[i * 4] = 1; }
      geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
      geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
      this.parts.push(geo);
    }
    return this;
  }

  build(): RigTemplate {
    return { geometry: merge(this.parts), names: this.names, parents: this.parents, local: this.local };
  }
}

export interface RigInstance { mesh: THREE.SkinnedMesh; bones: Record<string, THREE.Bone>; rest: Record<string, V3> }

export function instantiate(template: RigTemplate, material: THREE.Material): RigInstance {
  const list = template.names.map((name, i) => {
    const bone = new THREE.Bone(); bone.name = name; bone.position.set(...template.local[i]); return bone;
  });
  const mesh = new THREE.SkinnedMesh(template.geometry, material);
  list.forEach((bone, i) => { const parent = template.parents[i]; (parent >= 0 ? list[parent] : mesh).add(bone); });
  mesh.updateMatrixWorld(true);
  mesh.bind(new THREE.Skeleton(list));
  mesh.frustumCulled = false;
  const bones: Record<string, THREE.Bone> = {}, rest: Record<string, V3> = {};
  list.forEach((bone, i) => { bones[bone.name] = bone; rest[bone.name] = template.local[i]; });
  return { mesh, bones, rest };
}

export function hash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export function srgb(hex: string): [number, number, number] {
  const value = hex.replace('#', '');
  const full = value.length === 3 ? value.split('').map(c => c + c).join('') : value.slice(0, 6);
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}
