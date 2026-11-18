export type Verdict = 'right' | 'half' | 'outdated';
export type Category = 'parenting' | 'health';
/** source-checked = 编辑已把结论与来源原文逐字对上（不是医生审核）；pending = 演示条目，未核验 */
export type CheckStatus = 'source-checked' | 'pending';
export type Risk = 'low' | 'medical';

export interface Source {
  org: string;
  title: string;
  year?: number;
  url?: string;
  quote?: string;
  scope?: string;
  checkedAt?: string;
}

export interface BigCard {
  lines: string[];
  sourceLine: string;
}

export interface Saying {
  id: string;
  category: Category;
  tags: string[];
  title: string;
  aliases: string[];
  verdict: Verdict;
  elderRight?: string;
  intent?: string;
  nowAdvice: string;
  scopeNote?: string;
  whyChanged?: string;
  redFlags?: string;
  sources: Source[];
  status: CheckStatus;
  risk: Risk;
  pendingNote?: string;
  bigCard?: BigCard;
}

export interface Library {
  version: string;
  updatedAt: string;
  sayings: Saying[];
}
