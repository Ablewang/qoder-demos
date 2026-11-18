// Debug/automation hooks exposed on window.
import type { GameContext } from "./context";

declare global {
  interface Window {
    __G: GameContext;
    __frames: number;
    __ready: boolean;
    __errors: string[];
    __fatal: string | null;
    __setShot: (shot: Record<string, any>) => void;
    __stats: () => Record<string, unknown>;
    webkitAudioContext?: typeof AudioContext;
  }
  interface Document {
    webkitFullscreenElement?: Element | null;
    webkitFullscreenEnabled?: boolean;
    webkitExitFullscreen?: () => void;
  }
  interface HTMLElement {
    webkitRequestFullscreen?: () => Promise<void> | void;
  }
}

export {};
