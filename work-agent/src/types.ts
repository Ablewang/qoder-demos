export type Source = 'feishu' | 'gmail' | 'gitlab';

export type Kind = 'meeting' | 'email_sent' | 'email_received' | 'email_notification' | 'gitlab_event';

export const KIND_LABELS: Record<Kind, string> = {
  meeting: '会议',
  email_sent: '发出邮件',
  email_received: '收到邮件',
  email_notification: '通知邮件',
  gitlab_event: 'GitLab',
};

export const CATEGORIES = ['研发', '产品', '协作沟通', '行政事务', '其他'] as const;
export type Category = (typeof CATEGORIES)[number];

export interface Item {
  id: string;
  source: Source;
  kind: Kind;
  title: string;
  startAt: number;
  endAt: number | null;
  actor: string | null;
  url: string | null;
  meta: Record<string, unknown>;
  category?: Category | null;
}
