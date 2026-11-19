// contracts.md §10 + v1.1（tuanzi-v1-protocol §5、§7）
import type { Actor, ProposalId, Sensitivity, Timestamp } from './common.ts';
import type { NoticeFact } from './notice.ts';

export interface Persona {
  formatVersion: 1;
  name: string;
  skin: string;
  addressUser: string;
  traits: string[];
  speakingStyle: { verbosity: 'terse' | 'normal' | 'chatty'; emoji: boolean; formality: 'casual' | 'neutral' };
  catchphrases: string[];
  taboos: string[];
  description: string;
}

export interface PersonaView { persona: Persona; firstRun: boolean }

export const PERSONA_LIMITS = {
  name: [1, 8], addressUser: [1, 6],
  traits: { items: 6, chars: 6 }, catchphrases: { items: 3, chars: 12 }, taboos: { items: 5, chars: 20 },
  description: 2000,
} as const;

export type PetActivity =
  | 'idle' | 'sleeping' | 'working' | 'alert' | 'waiting_auth'
  | 'happy' | 'concerned' | 'caring' | 'quiet' | 'offline';

export type QuietReason = 'meeting' | 'screen_share' | 'fullscreen' | 'user_dnd';
export interface QuietSignal { source: 'calendar' | 'client' | 'user'; reasons: QuietReason[]; detection: 'known' | 'unknown'; expiresAt?: Timestamp }

export interface GrowthSnapshot { level: number; stats: Record<string, number>; unlocked: string[] }

export interface PetState {
  activity: PetActivity;
  badge: { proposals: number; notices: number; authRequests: number };
  quietReasons: QuietReason[];
  expression?: { activityId: string; animationId: string; startedAt: Timestamp };
  audio: { enabled: boolean; playing: boolean; volume: number };
  growth: GrowthSnapshot;
  progress?: { label: string; done: number; total: number };
  updatedAt: Timestamp;
}

export interface UtteranceQuickAction {
  label: string;
  decision?: { proposalId: ProposalId; optionId: string };
  open?: 'proposal' | 'report' | 'chat' | 'notice';
  notice?: { noticeId: string; op: 'read' | 'snooze' | 'dismiss' };
}

export interface PetUtterance {
  sensitivity: Sensitivity;
  id: string;
  text: string;
  facts?: NoticeFact[];
  animation?: string;
  ref?: { noticeId?: string; proposalId?: ProposalId; reportId?: string };
  quickActions?: UtteranceQuickAction[];
  expiresAt?: Timestamp;
}

export type PetInteraction =
  | { kind: 'click' } | { kind: 'double_click' } | { kind: 'pet' }
  | { kind: 'drag_start' } | { kind: 'drop'; screenEdge?: 'left' | 'right' | 'top' | 'bottom' }
  | { kind: 'hover' } | { kind: 'poke'; times: number }
  | { kind: 'feed' } | { kind: 'play'; activityId: string }
  | { kind: 'audio_pause' } | { kind: 'audio_play' }
  | { kind: 'utterance_dismissed'; id: string };

/** 后台需要的伙伴设置；纯显示类设置留在客户端本地 */
export interface CompanionSettings {
  workHours: { days: number[]; start: string; end: string };   // days: 0=周日；时间 'HH:mm' 本地时区
  dailyBubbleCap: number;                                      // 0–3
  offworkReminder: boolean;
  acceptDevNotices: boolean;
  discloseConfidentialInBubble: boolean;
  sleepAfterWork: boolean;
}

export const DEFAULT_SETTINGS: CompanionSettings = {
  workHours: { days: [1, 2, 3, 4, 5], start: '09:30', end: '18:30' },
  dailyBubbleCap: 3,
  offworkReminder: true,
  acceptDevNotices: true,
  discloseConfidentialInBubble: false,
  sleepAfterWork: true,
};

export type CardAction =
  | { label: string; action: 'memory_undo' | 'memory_forget'; memoryId: string; confirm?: string }
  | { label: string; action: 'memory_retype'; memoryId: string; kind: 'rule' | 'fact' }
  | { label: string; action: 'reminder_cancel'; reminderId: string }
  | { label: string; action: 'open_panel'; panel: 'notices' | 'memory' | 'chat' | 'settings' | 'help' }
  | { label: string; action: 'quiet'; mode: 'dnd' | 'off'; minutes?: number };

/** 聊天里的结构化卡片：title/facts/items 原样渲染，不经人格改写 */
export interface LocalCard {
  title: string;
  facts?: NoticeFact[];
  items?: Array<{ id: string; text: string; kind?: string; note?: string }>;
  actions?: CardAction[];
  undoUntil?: Timestamp;
  sensitivity: Sensitivity;
}

export type ChatChunk =
  | { kind: 'text'; text: string }
  | { kind: 'proposal'; proposalId: ProposalId }
  | { kind: 'auth'; requestId: string }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'memory'; itemId: string; change: 'remembered' | 'updated' | 'forgotten' }
  | { kind: 'card'; card: LocalCard }
  | { kind: 'done'; conversationId: string };

export interface CompanionService {
  state(): PetState;
  persona(): Persona;
  updatePersona(patch: Partial<Persona>, by: Actor): Persona;
  onInteraction(e: PetInteraction): Promise<PetUtterance | null>;
  chat(message: string, conversationId?: string): AsyncIterable<ChatChunk>;
  setQuiet(signal: QuietSignal): void;
  setAudio(settings: { enabled: boolean; volume: number }, by: Actor): void;
}
