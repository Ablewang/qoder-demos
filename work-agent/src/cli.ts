import { execFile } from 'node:child_process';
import { origin } from './config.ts';
import { probeFeishuIm } from './connectors/feishu.ts';
import { fmtMinutes } from './render.ts';
import { runReport } from './pipeline.ts';
import { startServer } from './server.ts';

const [command, ...args] = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main() {
  switch (command) {
    case 'serve': {
      await startServer();
      console.log(`Work Agent 已启动：${origin()}`);
      if (!args.includes('--no-open')) execFile('open', [origin()]);
      return;
    }
    case 'run': {
      const days = Number(flag('--days') ?? 7);
      if (!Number.isInteger(days) || days < 1 || days > 90) throw new Error('--days 需要是 1 到 90 的整数');
      const { data, file, warnings } = await runReport(days, console.log);
      for (const s of data.sources) console.log(`  ${s.label}：${s.status}`);
      for (const w of warnings) console.warn(`  ! ${w}`);
      const t = data.totals;
      console.log(`会议 ${fmtMinutes(t.meetingMinutes)}（${t.meetingCount} 场），发信 ${t.emailSent}，GitLab 操作 ${t.gitlab}`);
      console.log(`报告：${file}`);
      return;
    }
    case 'probe-feishu-im': {
      for (const r of await probeFeishuIm()) console.log(`${r.ok ? '✓' : '✗'} ${r.check}：${r.detail}`);
      return;
    }
    default:
      console.log(`用法：
  node src/cli.ts serve [--no-open]   启动本地页面（授权、生成报告）
  node src/cli.ts run [--days 7]      同步数据并生成时间去向报告
  node src/cli.ts probe-feishu-im     验证飞书应用能否读到群和消息`);
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exitCode = 1;
});
