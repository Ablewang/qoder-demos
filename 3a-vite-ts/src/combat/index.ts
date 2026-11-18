import type { Vector3Like } from "three";
import { Vector3 } from "three";
import type { GameContext } from "../types/context";

export function createCombat(i: GameContext) {
  let e = {
    shots: 0,
    hits: 0,
    kills: 0,
  };
  i.events.on("enemy:killed", () => {
    e.kills++;
  });
  return {
    stats: e,
    reset() {
      e.shots = e.hits = e.kills = 0;
    },
    playerShot(
      n: Vector3,
      s: Vector3,
      {
        damage: o = 28,
        range: r = 300,
        impulse: a = 1,
      }: { damage?: number; range?: number; impulse?: number } = {},
    ) {
      e.shots++;
      let l = i.physics.raycast(n, s, r),
        c = i.enemies.raycast(n, s, l ? l.dist : r);
      if (c) {
        e.hits++;
        let u = c.part === "weak" ? 2.2 : 1,
          h = c.enemy!.damage(o * u, c.point, s, c.part) === true,
          f = {
            point: c.point,
            normal: c.normal || s.clone().negate(),
            dist: c.dist,
            surface: "enemy",
            enemy: c.enemy,
            part: c.part,
            dir: s,
            from: "player",
            killed: h,
          };
        i.events.emit("impact", f);
        i.events.emit("player:hitEnemy", {
          enemy: c.enemy,
          part: c.part,
          killed: h,
          weak: c.part === "weak",
        });
        return f;
      }
      if (l) {
        let u = {
          point: l.point,
          normal: l.normal,
          dist: l.dist,
          surface: l.surface,
          enemy: null,
          dir: s,
          from: "player",
        };
        i.events.emit("impact", u);
        return u;
      }
      return null;
    },
    enemyShot(
      n: Vector3Like,
      s: Vector3,
      {
        damage: o = 6,
        range: r = 200,
      }: { damage?: number; range?: number } = {},
    ) {
      let a = i.physics.raycast(n, s, r),
        l = a ? a.dist : r,
        c = i.player;
      if (c && c.alive) {
        let u = _targetPos.copy(c.pos);
        u.y += 1;
        let h = u.sub(n).dot(s);
        if (h > 0 && h < l) {
          _probeVec.copy(n).addScaledVector(s, h);
          let f = Math.abs(_probeVec.y - (c.pos.y + 0.95));
          if (
            Math.hypot(_probeVec.x - c.pos.x, _probeVec.z - c.pos.z) < 0.38 &&
            f < 0.95
          ) {
            c.damage(o, n);
            return true;
          }
        }
      }
      if (a) {
        i.events.emit("impact", {
          point: a.point,
          normal: a.normal,
          dist: a.dist,
          surface: a.surface,
          enemy: null,
          dir: s,
          from: "enemy",
        });
      }
      return false;
    },
    explode(n: Vector3Like, s = 5, o = 80, r = "player") {
      for (let l of i.enemies.list) {
        if (!l.alive) {
          continue;
        }
        let c = l.pos.distanceTo(n);
        if (
          c < s &&
          i.physics.lineOfSight(n, _targetPos.copy(l.pos).setY(l.pos.y + 0.5))
        ) {
          l.damage(
            o * (1 - c / s),
            l.pos,
            _probeVec.copy(l.pos).sub(n).normalize(),
            "body",
          );
        }
      }
      let a = i.player;
      if (a && a.alive) {
        let l = _targetPos
          .copy(a.pos)
          .setY(a.pos.y + 1)
          .distanceTo(n);
        if (
          l < s &&
          i.physics.lineOfSight(n, _targetPos.copy(a.pos).setY(a.pos.y + 1))
        ) {
          a.damage(o * 0.5 * (1 - l / s), n);
        }
      }
    },
  };
}
const _targetPos = new Vector3();
const _probeVec = new Vector3();
