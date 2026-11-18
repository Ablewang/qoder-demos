// Benchmark overlay (?bench / #bench): cinematic fly-through with frame statistics.
import type { GameContext } from "../types/context";
import { Vector2, Vector3 } from "three";

export function createBench(i: GameContext) {
  let e = document.createElement("pre");
  e.id = "bench";
  e.style.cssText =
    'position:absolute;left:12px;top:12px;z-index:90;margin:0;padding:10px 12px;font:12px/1.45 "PingFang SC",ui-monospace,monospace;color:#d8f0d0;background:rgba(0,0,0,.72);white-space:pre-wrap;max-width:min(560px,90vw);pointer-events:none';
  document.getElementById("app")!.appendChild(e);
  let t = "unknown";
  try {
    let f = i.renderer.getContext(),
      p = f.getExtension("WEBGL_debug_renderer_info");
    t = p
      ? f.getParameter(p.UNMASKED_RENDERER_WEBGL)
      : f.getParameter(f.RENDERER);
  } catch {}
  let n =
      i.level.cinematicPath && i.level.cinematicPath.length >= 2
        ? i.level.cinematicPath
        : [
            {
              pos: [-32, 1.7, 6],
              look: [0, 2, 5],
            },
            {
              pos: [10, 1.7, 6],
              look: [30, 6, 0],
            },
          ],
    s: number[] = [],
    o = 0,
    r = 0,
    a = 30,
    l = new Vector3(),
    c = new Vector3(),
    u = new Vector3(),
    h = new Vector3();
  if (i.player) {
    i.player.enabled = false;
  }
  i.bench = {
    frame(f) {
      o += f;
      let p = ((o / a) % 1) * (n.length - 1),
        d = Math.min(n.length - 2, Math.floor(p)),
        v = p - d,
        g = v * v * (3 - 2 * v);
      l.fromArray(n[d].pos);
      c.fromArray(n[d + 1].pos);
      u.fromArray(n[d].look);
      h.fromArray(n[d + 1].look);
      i.camera.position.lerpVectors(l, c, g);
      i.camera.lookAt(u.lerp(h, g));
      if (o > 2) {
        s.push(f * 1e3);
      }
      if (s.length > 3e3) {
        s.shift();
      }
      if (o - r > 1 && s.length > 10) {
        r = o;
        let x = s.slice().sort((M, E) => M - E),
          y = x.reduce((M, E) => M + E, 0) / x.length,
          b = x[Math.floor(x.length * 0.99)],
          m = x[x.length >> 1],
          A = i.render.stats ? i.render.stats() : {},
          _ = i.renderer.getDrawingBufferSize(new Vector2());
        e.textContent = `几猫性能测试  t=${o.toFixed(0)}s
GPU: ${t}
buffer ${_.x}x${_.y}  quality ${i.quality.name}  dpr ${window.devicePixelRatio}
frame ms avg ${y.toFixed(1)}  median ${m.toFixed(1)}  p99 ${b.toFixed(1)}  => ${(1e3 / y).toFixed(0)} fps
stats ${JSON.stringify(A)}
errors ${window.__errors.length}${
          window.__errors.length
            ? `
 - ` +
              window.__errors.slice(0, 6).join(`
 - `)
            : ""
        }`;
      }
    },
  };
}
