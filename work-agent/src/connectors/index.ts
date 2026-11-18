import { getSecret } from '../secrets.ts';
import type { Item, Source } from '../types.ts';
import { FEISHU_ACCOUNT, feishuAccount, feishuConfigured, syncFeishu } from './feishu.ts';
import { GITLAB_ACCOUNT, gitlabAccount, gitlabConfigured, syncGitlab } from './gitlab.ts';
import { GMAIL_ACCOUNT, gmailAccount, gmailConfigured, syncGmail } from './gmail.ts';

export interface Connector {
  source: Source;
  label: string;
  secretAccounts: string[];
  configured: () => boolean;
  account: () => Promise<string | null>;
  sync: (from: number, to: number) => Promise<Item[]>;
}

export const connectors: Connector[] = [
  {
    source: 'feishu',
    label: '飞书日历',
    secretAccounts: [FEISHU_ACCOUNT, 'feishu.profile'],
    configured: feishuConfigured,
    account: feishuAccount,
    sync: syncFeishu,
  },
  {
    source: 'gmail',
    label: 'Gmail',
    secretAccounts: [GMAIL_ACCOUNT, 'gmail.profile'],
    configured: gmailConfigured,
    account: gmailAccount,
    sync: syncGmail,
  },
  {
    source: 'gitlab',
    label: 'GitLab',
    secretAccounts: [GITLAB_ACCOUNT],
    configured: gitlabConfigured,
    account: gitlabAccount,
    sync: syncGitlab,
  },
];

export async function isAuthorized(c: Connector): Promise<boolean> {
  return (await getSecret(c.secretAccounts[0])) !== null;
}
