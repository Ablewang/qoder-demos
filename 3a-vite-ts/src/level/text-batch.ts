import type { Group, Object3D, Object3DEventMap } from "three";
import type { AnyMesh, TextBatch } from "../types/three";
import { CanvasTexture, LinearMipmapLinearFilter, MathUtils } from "three";

const TEXT_BATCH_SCALE = 4;
interface TextBatchEntry {
  m: any;
  img: any;
  w: number;
  h: number;
  x: number;
  y: number;
  version: number;
}
export function createTextBatch(
  i: Group<Object3DEventMap>,
  { scale: e = 0.5, maxW: t = 2048 }: { scale?: number; maxW?: number } = {},
): TextBatch {
  let n: TextBatch = {
    count: 0,
    material: null,
    update() {},
  };
  if (typeof document > "u") {
    return n;
  }
  let s = new Map();
  i.traverse((b) => {
    if (!(b as AnyMesh).isMesh || Array.isArray((b as AnyMesh).material)) {
      return;
    }
    let m = (b as AnyMesh).material;
    if (
      !m ||
      m.name !== "label" ||
      !m.map ||
      !m.map.image ||
      !m.map.image.width
    ) {
      return;
    }
    let A: Object3D | null = b,
      _ = false;
    for (; A;) {
      if (A.userData && A.userData.noMerge) {
        _ = true;
        break;
      }
      A = A.parent;
    }
    if (!_) {
      if (!s.has(m)) {
        s.set(m, []);
      }
      s.get(m).push(b);
    }
  });
  if (s.size < 2) {
    return n;
  }
  let o = [...s.keys()].map((b) => {
    let m = b.map.image;
    return {
      m: b,
      img: m,
      w: Math.max(4, Math.ceil(m.width * e)),
      h: Math.max(4, Math.ceil(m.height * e)),
    } as TextBatchEntry;
  });
  o.sort((b, m) => m.h - b.h || m.w - b.w);
  let r = 0,
    a = 0,
    l = 0;
  for (let b of o) {
    let m = Math.min(b.w, t - 2 * TEXT_BATCH_SCALE);
    if (m < b.w) {
      b.h = Math.max(4, Math.round((b.h * m) / b.w));
      b.w = m;
    }
    if (r + b.w + 2 * TEXT_BATCH_SCALE > t) {
      r = 0;
      a += l;
      l = 0;
    }
    b.x = r + TEXT_BATCH_SCALE;
    b.y = a + TEXT_BATCH_SCALE;
    r += b.w + 2 * TEXT_BATCH_SCALE;
    l = Math.max(l, b.h + 2 * TEXT_BATCH_SCALE);
  }
  let c = t,
    u = MathUtils.ceilPowerOfTwo(Math.max(16, a + l));
  if (u > 4096) {
    return n;
  }
  let h = document.createElement("canvas");
  h.width = c;
  h.height = u;
  let f = h.getContext("2d"),
    p = () => {
      f!.setTransform(1, 0, 0, 1, 0, 0);
      f!.globalAlpha = 1;
      f!.globalCompositeOperation = "source-over";
      f!.clearRect(0, 0, c, u);
      for (let b of o) {
        f!.drawImage(
          b.img,
          b.x - TEXT_BATCH_SCALE,
          b.y - TEXT_BATCH_SCALE,
          b.w + 2 * TEXT_BATCH_SCALE,
          b.h + 2 * TEXT_BATCH_SCALE,
        );
        f!.clearRect(b.x, b.y, b.w, b.h);
        f!.drawImage(b.img, b.x, b.y, b.w, b.h);
        b.version = b.m.map.version;
      }
    };
  p();
  let d = o[0].m,
    v = new CanvasTexture(h);
  v.colorSpace = d.map.colorSpace;
  v.anisotropy = d.map.anisotropy;
  v.generateMipmaps = true;
  v.minFilter = LinearMipmapLinearFilter;
  let g = d.clone();
  g.map = v;
  g.name = "label_atlas";
  let x = new Map();
  for (let b of o) {
    let m = b.x / c,
      A = (b.x + b.w) / c,
      _ = 1 - b.y / u,
      M = 1 - (b.y + b.h) / u;
    for (let E of s.get(b.m)) {
      let w = E.geometry.uuid + "|" + b.m.uuid,
        S = x.get(w);
      if (!S) {
        S = E.geometry.clone();
        let z = S.attributes.uv;
        if (z) {
          for (let H = 0; H < z.count; H++)
            z.setXY(
              H,
              m + MathUtils.clamp(z.getX(H), 0, 1) * (A - m),
              M + MathUtils.clamp(z.getY(H), 0, 1) * (_ - M),
            );
          z.needsUpdate = true;
        }
        x.set(w, S);
      }
      E.geometry = S;
      E.material = g;
    }
  }
  let y = 0;
  return {
    count: o.length,
    material: g,
    size: [c, u],
    update(b: number) {
      if (!(y > 8)) {
        y += b;
        for (let m of o)
          if (m.m.map.version !== m.version) {
            p();
            v.needsUpdate = true;
            break;
          }
      }
    },
  };
}
