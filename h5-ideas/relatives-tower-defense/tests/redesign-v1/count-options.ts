import { Game } from '../../src/engine';
const play = (ids: string[]) => { const g = new Game(); for (const id of ids) { g.choose(id); g.advance(); } return g; };
const seen = new Map<string, number>();
const walk = (ids: string[]) => { const g = play(ids); if (g.phase === 'over') return; const av = g.options().filter(o => o.available); const key = `${g.node.id}:${av.map(o => o.id).join(',')}`; seen.set(key, (seen.get(key) ?? 0) + 1); for (const o of av) walk([...ids, o.id]); };
walk([]);
for (const [k, n] of seen) console.log(n, k);
