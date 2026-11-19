// contracts.md §6 + v1.1（tuanzi-v1-protocol §5、§8.2）
import type { Actor, EntityId, EvidenceRef, Sensitivity, Timestamp } from './common.ts';

export interface NoticeFact { label: string; value: string | number; unit?: string; ref?: EntityId }

export interface Notice {
  sensitivity: Sensitivity;
  evidence: EvidenceRef[];
  kind: string;
  title: string;
  facts: NoticeFact[];
  body?: string;
  why?: string;
  nextStep?: string;
  tone: 'neutral' | 'good_news' | 'concern' | 'care';
  links?: EntityId[];
  urgency: 'low' | 'normal' | 'high';
  dedupeKey: string;
  channels?: Array<'pet' | 'console' | 'feishu_bot'>;
}

export type NoticeStatus = 'unread' | 'read' | 'snoozed' | 'dismissed';

export interface NoticeRecord {
  id: string;
  notice: Notice;
  from: Actor;
  status: NoticeStatus;
  count: number;                 // 同 dedupeKey 合并次数，至少 1
  createdAt: Timestamp;
  updatedAt: Timestamp;
  snoozedUntil?: Timestamp;
}

export interface NoticeSink { submit(notice: Notice, from: Actor): Promise<NoticeRecord> }

export const NOTICE_LIMITS = { title: 80, facts: 8, body: 2000, dedupeKey: 200, why: 300, nextStep: 300 } as const;

export interface Reminder {
  id: string;
  text: string;
  dueAt: Timestamp;
  createdAt: Timestamp;
  status: 'scheduled' | 'fired' | 'cancelled';
  noticeId?: string;
}
