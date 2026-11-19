import { invoke, isTauri } from '@tauri-apps/api/core';
import { emit, listen } from '@tauri-apps/api/event';
import { getCurrentWindow, currentMonitor, availableMonitors } from '@tauri-apps/api/window';
import { LogicalPosition, LogicalSize } from '@tauri-apps/api/dpi';
import type { DaemonInfo } from '../../../src/contracts/index.ts';
import type { ClientSettings } from './settings.ts';
import { clientDefaults } from './settings.ts';
import type { Frame, Point, Rect } from './geometry.ts';
declare global { interface Window { __PET_TEST__?: { info: DaemonInfo; token: string } } }
export const native = isTauri();
const events = new EventTarget();
let localSettings = structuredClone(clientDefaults);
export const bridge = {
  async info(): Promise<DaemonInfo> {
    if (native) return invoke('read_daemon_info');
    if (window.__PET_TEST__) return window.__PET_TEST__.info;
    throw new Error('offline');
  },
  async token(): Promise<string> {
    if (native) return invoke('get_api_token');
    if (window.__PET_TEST__) return window.__PET_TEST__.token;
    throw new Error('offline');
  },
  async wake(): Promise<void> { if (native) await invoke('wake_daemon'); },
  async settings(): Promise<ClientSettings> { return native ? invoke('read_client_settings') : structuredClone(localSettings); },
  async save(settings: ClientSettings): Promise<void> { if (native) await invoke('write_client_settings', { settings }); else localSettings = structuredClone(settings); await this.send('client-settings', settings); },
  async frames(): Promise<Frame[]> { if (!native) return []; try { return await invoke('window_frames'); } catch { return []; } },
  async geometry(): Promise<{ pet: Rect; work: Rect; screenId: string; scale: number }> {
    if (!native) return { pet: { x: 460, y: 460, width: 160, height: 160 }, work: { x: 0, y: 0, width: innerWidth, height: innerHeight }, screenId: 'browser', scale: 1 };
    const win = getCurrentWindow(); const [p, s, monitor] = await Promise.all([win.outerPosition(), win.outerSize(), currentMonitor()]);
    const scale = monitor?.scaleFactor || await win.scaleFactor();
    const area = monitor?.workArea || { position: { x: 0, y: 0 }, size: { width: 1440, height: 900 } };
    return { pet: { x: p.x / scale, y: p.y / scale, width: s.width / scale, height: s.height / scale },
      work: { x: area.position.x / scale, y: area.position.y / scale, width: area.size.width / scale, height: area.size.height / scale },
      screenId: monitor?.name || `${area.position.x}:${area.position.y}`, scale };
  },
  async position(p: Point): Promise<void> { if (native) await getCurrentWindow().setPosition(new LogicalPosition(p.x, p.y)); },
  async resize(size: number): Promise<void> { if (native) await getCurrentWindow().setSize(new LogicalSize(size, size)); },
  async drag(): Promise<void> { if (native) await getCurrentWindow().startDragging(); },
  async hits(areas: Rect[]): Promise<void> { if (native) await invoke('set_hit_areas', { areas }); },
  async aux(label: 'panel' | 'bubble', view: string, rect: Rect): Promise<void> { if (native) await invoke('show_aux', { label, view, ...rect }); },
  async hide(label: string): Promise<void> { if (native) await invoke('hide_aux', { label }); },
  async demo(hidden: boolean): Promise<void> { if (native) await invoke('set_demo_visual', { hidden }); },
  async folder(): Promise<void> { if (native) await invoke('open_memory_folder'); },
  async shortcut(shortcut: string): Promise<void> { if (native) await invoke('register_shortcut', { shortcut }); },
  async quit(): Promise<void> { if (native) await invoke('quit_pet'); },
  async send<T>(name: string, payload: T): Promise<void> { if (native) await emit(name, payload); else events.dispatchEvent(new CustomEvent(name, { detail: payload })); },
  async on<T>(name: string, handler: (payload: T) => void): Promise<() => void> {
    if (native) return listen<T>(name, e => handler(e.payload));
    const fn = (e: Event) => handler((e as CustomEvent<T>).detail); events.addEventListener(name, fn); return () => events.removeEventListener(name, fn);
  },
  async monitors(): Promise<string[]> { return native ? (await availableMonitors()).map(m => m.name || 'display') : ['browser']; },
};
