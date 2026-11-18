import { existsSync, readFileSync } from 'node:fs';

const path = '.local-data/accounts.json';
if (!existsSync(path)) {
  console.log('请先运行 pnpm dev 创建本机模拟账号。');
} else {
  const accounts = JSON.parse(readFileSync(path, 'utf8')) as { owner: string; backup: string };
  console.log('仅用于本机假数据演练；口令不打包进前端，不用于真实用户。');
  console.log(`店主 owner: ${accounts.owner}\n授权替补 backup: ${accounts.backup}`);
}
