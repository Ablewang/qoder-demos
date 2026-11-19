import type { CompanionSettings, Persona, PetState } from '../../../src/contracts/index.ts';
export interface ClientSettings {
  size: 96 | 112 | 128;
  fixed: boolean;
  positions: Record<string, { x: number; y: number }>;
  entertainment: 'off' | 'low' | 'medium';
  shortcut: string;
  badgeInQuiet: boolean;
  decorations: string[];
}
export const clientDefaults: ClientSettings = {
  size: 112, fixed: false, positions: {}, entertainment: 'medium',
  shortcut: 'Control+Alt+D', badgeInQuiet: true, decorations: [],
};
export const companionDefaults: CompanionSettings = {
  workHours: { days: [1, 2, 3, 4, 5], start: '09:30', end: '18:30' },
  dailyBubbleCap: 3, offworkReminder: true, acceptDevNotices: true,
  discloseConfidentialInBubble: false, sleepAfterWork: true,
};
export const personaDefaults: Persona = {
  formatVersion: 1, name: '团子', skin: 'tuanzi-default', addressUser: '你',
  traits: ['靠谱', '元气'], speakingStyle: { verbosity: 'normal', emoji: false, formality: 'casual' },
  catchphrases: [], taboos: [], description: '',
};
export const offlineState = (): PetState => ({
  activity: 'offline', badge: { notices: 0, proposals: 0, authRequests: 0 }, quietReasons: [],
  audio: { enabled: false, playing: false, volume: 0.3 },
  growth: { level: 1, stats: {}, unlocked: [] }, updatedAt: Date.now(),
});
export const quietExplanation = '开会自动安静：暂不可用（还没接日历）。共享屏幕识别：未知。要演示请用『演示模式』。';
export const deleteExplanation = '删除后会从 user.md 和搜索索引里一起删掉，团子里没法恢复。电脑自己的备份（比如时间机器）团子管不到。';
