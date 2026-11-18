import './style.css';
import { Engine } from './engine';
import { GameUI } from './ui';
import { Renderer } from './renderer3d';

import { IndexedSaveStore, LEGACY_SAVE_KEY } from './storage';

const root = document.getElementById('app')!;
let store: IndexedSaveStore | undefined;
let legacy: string | undefined;
try { if (window.indexedDB) store = new IndexedSaveStore(window.indexedDB); } catch { store = undefined; }
try { legacy = window.localStorage.getItem(LEGACY_SAVE_KEY) ?? undefined; } catch { legacy = undefined; }
const engine = new Engine(store);
void engine.initialize(legacy);
const ui = new GameUI(root, engine.state, engine.dispatch);
const renderer = new Renderer(ui.canvas);
ui.setRenderer(renderer);
ui.setControlHandler((control, press) => engine.setControl(control, press));
let previous = performance.now(), accumulated = 0;
const start = previous;
let frameId = 0;
function frame(now: number) {
  accumulated += Math.min(200, now - previous);
  previous = now;
  while (accumulated >= 40) { engine.step(); accumulated -= 40; }
  ui.update(engine.state);
  renderer.render(engine.state, (now - start) / 1000);
  frameId = requestAnimationFrame(frame);
}
frameId = requestAnimationFrame(frame);
window.addEventListener('resize', () => renderer.resize());
window.addEventListener('pagehide', () => engine.save(false));
document.addEventListener('visibilitychange', () => { if (document.hidden) engine.save(false); previous = performance.now(); accumulated = 0; });
if (import.meta.hot) import.meta.hot.dispose(() => { cancelAnimationFrame(frameId); ui.destroy(); });
if (import.meta.env.DEV) Object.assign(window, { sanctuary: { engine, renderer, ui } });
