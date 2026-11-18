// mergeGeometries/mergeAttributes as bundled in the original build (three r180 addons).
import type { AttributeGPUType } from "three";
import { BufferAttribute, BufferGeometry } from "three";

export function mergeGeometries(i: any, e = false) {
  let t = i[0].index !== null,
    n = new Set(Object.keys(i[0].attributes)),
    s = new Set(Object.keys(i[0].morphAttributes)),
    o = {} as Record<string, any>,
    r = {} as Record<string, any>,
    a = i[0].morphTargetsRelative,
    l = new BufferGeometry(),
    c = 0;
  for (let u = 0; u < i.length; ++u) {
    let h = i[u],
      f = 0;
    if (t !== (h.index !== null)) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " +
          u +
          ". All geometries must have compatible attributes; make sure index attribute exists among all geometries, or in none of them.",
      );
      return null;
    }
    for (let p in h.attributes) {
      if (!n.has(p)) {
        console.error(
          "THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " +
            u +
            '. All geometries must have compatible attributes; make sure "' +
            p +
            '" attribute exists among all geometries, or in none of them.',
        );
        return null;
      }
      if (o[p] === undefined) {
        o[p] = [];
      }
      o[p].push(h.attributes[p]);
      f++;
    }
    if (f !== n.size) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " +
          u +
          ". Make sure all geometries have the same number of attributes.",
      );
      return null;
    }
    if (a !== h.morphTargetsRelative) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " +
          u +
          ". .morphTargetsRelative must be consistent throughout all geometries.",
      );
      return null;
    }
    for (let p in h.morphAttributes) {
      if (!s.has(p)) {
        console.error(
          "THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " +
            u +
            ".  .morphAttributes must be consistent throughout all geometries.",
        );
        return null;
      }
      if (r[p] === undefined) {
        r[p] = [];
      }
      r[p].push(h.morphAttributes[p]);
    }
    if (e) {
      let p: any;
      if (t) {
        p = h.index.count;
      } else if (h.attributes.position !== undefined) {
        p = h.attributes.position.count;
      } else {
        console.error(
          "THREE.BufferGeometryUtils: .mergeGeometries() failed with geometry at index " +
            u +
            ". The geometry must have either an index or a position attribute",
        );
        return null;
      }
      l.addGroup(c, p, u);
      c += p;
    }
  }
  if (t) {
    let u = 0,
      h: any[] = [];
    for (let f = 0; f < i.length; ++f) {
      let p = i[f].index;
      for (let d = 0; d < p.count; ++d) h.push(p.getX(d) + u);
      u += i[f].attributes.position.count;
    }
    l.setIndex(h);
  }
  for (let u in o) {
    let h = mergeAttributes(o[u]);
    if (!h) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " +
          u +
          " attribute.",
      );
      return null;
    }
    l.setAttribute(u, h);
  }
  for (let u in r) {
    let h = r[u][0].length;
    if (h === 0) {
      break;
    }
    l.morphAttributes = l.morphAttributes || {};
    (l.morphAttributes as Record<string, BufferAttribute[]>)[u] = [];
    for (let f = 0; f < h; ++f) {
      let p: any[] = [];
      for (let v = 0; v < r[u].length; ++v) p.push(r[u][v][f]);
      let d = mergeAttributes(p);
      if (!d) {
        console.error(
          "THREE.BufferGeometryUtils: .mergeGeometries() failed while trying to merge the " +
            u +
            " morphAttribute.",
        );
        return null;
      }
      (l.morphAttributes as Record<string, BufferAttribute[]>)[u].push(d);
    }
  }
  return l;
}
function mergeAttributes(i: any) {
  let e: any,
    t: any,
    n: any,
    s = -1,
    o = 0;
  for (let c = 0; c < i.length; ++c) {
    let u = i[c];
    if (e === undefined) {
      e = u.array.constructor;
    }
    if (e !== u.array.constructor) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.array must be of consistent array types across matching attributes.",
      );
      return null;
    }
    if (t === undefined) {
      t = u.itemSize;
    }
    if (t !== u.itemSize) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.itemSize must be consistent across matching attributes.",
      );
      return null;
    }
    if (n === undefined) {
      n = u.normalized;
    }
    if (n !== u.normalized) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.normalized must be consistent across matching attributes.",
      );
      return null;
    }
    if (s === -1) {
      s = u.gpuType;
    }
    if (s !== u.gpuType) {
      console.error(
        "THREE.BufferGeometryUtils: .mergeAttributes() failed. BufferAttribute.gpuType must be consistent across matching attributes.",
      );
      return null;
    }
    o += u.count * t;
  }
  let r = new e(o),
    a = new BufferAttribute(r, t, n),
    l = 0;
  for (let c = 0; c < i.length; ++c) {
    let u = i[c];
    if (u.isInterleavedBufferAttribute) {
      let h = l / t;
      for (let f = 0, p = u.count; f < p; f++)
        for (let d = 0; d < t; d++) {
          let v = u.getComponent(f, d);
          a.setComponent(f + h, d, v);
        }
    } else {
      r.set(u.array, l);
    }
    l += u.count * t;
  }
  if (s !== undefined) {
    a.gpuType = s as AttributeGPUType;
  }
  return a;
}
