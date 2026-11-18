import { dateKey, type ReportData } from './report.ts';

export function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function fmtMinutes(min: number | null): string {
  if (min === null) return '—';
  if (min < 60) return `${min} 分钟`;
  return `${(min / 60).toFixed(1)} 小时`;
}

const STYLE = `
  :root { --fg:#1f2329; --muted:#646a73; --line:#e4e6eb; --bg:#f7f8fa; --accent:#3370ff; --ok:#2ea121; --warn:#de7802; --bad:#d83931; }
  * { box-sizing: border-box; }
  body { margin:0; font:14px/1.6 -apple-system, "PingFang SC", "Helvetica Neue", sans-serif; color:var(--fg); background:var(--bg); }
  main { max-width: 960px; margin: 0 auto; padding: 32px 20px 64px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 32px 0 12px; }
  .muted { color: var(--muted); }
  .card { background:#fff; border:1px solid var(--line); border-radius:8px; padding:16px 20px; margin-bottom:12px; }
  .grid { display:grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap:12px; }
  .stat .num { font-size: 22px; font-weight: 600; }
  table { width:100%; border-collapse: collapse; background:#fff; border:1px solid var(--line); border-radius:8px; overflow:hidden; }
  th, td { text-align:left; padding:8px 12px; border-bottom:1px solid var(--line); vertical-align: top; }
  th { background:#fafbfc; font-weight:500; color:var(--muted); }
  tr:last-child td { border-bottom:none; }
  .bar { height:8px; background:var(--accent); border-radius:4px; min-width:2px; }
  .badge { display:inline-block; padding:0 8px; border-radius:10px; font-size:12px; border:1px solid currentColor; }
  .ok { color: var(--ok); } .warn { color: var(--warn); } .bad { color: var(--bad); }
  button, .btn { display:inline-block; font:inherit; padding:6px 14px; border-radius:6px; border:1px solid var(--accent); background:var(--accent); color:#fff; text-decoration:none; cursor:pointer; }
  .btn.secondary, button.secondary { background:#fff; color:var(--accent); }
  input, select { font:inherit; padding:5px 8px; border:1px solid var(--line); border-radius:6px; }
  ol { padding-left: 20px; margin: 8px 0; }
  code { background:#f2f3f5; padding:1px 5px; border-radius:4px; font-size:12px; }
  form.inline { display:inline; }
  .row { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
`;

export function page(title: string, body: string): string {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${STYLE}</style></head><body><main>${body}</main></body></html>`;
}

export function renderReport(data: ReportData): string {
  const t = data.totals;
  const range = `${dateKey(data.from)} 至 ${dateKey(data.to - 1)}`;
  const stat = (label: string, value: string) => `<div class="card stat"><div class="muted">${esc(label)}</div><div class="num">${esc(value)}</div></div>`;

  const maxCat = Math.max(1, ...data.categories.map((c) => c.meetingMinutes));
  const categoryRows = data.categories
    .map(
      (c) => `<tr><td>${esc(c.category)}</td>
        <td style="width:35%"><div class="bar" style="width:${(c.meetingMinutes / maxCat) * 100}%"></div></td>
        <td>${esc(fmtMinutes(c.meetingMinutes))}（${c.meetings} 场）</td>
        <td>${c.emailSent} / ${c.emailReceived}</td><td>${c.gitlab}</td></tr>`,
    )
    .join('');

  const dayRows = data.days
    .map(
      (d) => `<tr><td>${esc(d.date)} ${esc(d.weekday)}</td><td>${esc(fmtMinutes(d.meetingMinutes))}（${d.meetingCount} 场）</td>
        <td class="${d.longestFocusMinutes !== null && d.longestFocusMinutes < 90 ? 'warn' : ''}">${esc(fmtMinutes(d.longestFocusMinutes))}</td>
        <td>${d.focusBlocks ?? '—'}</td><td>${d.gitlab}</td><td>${d.emailSent}</td></tr>`,
    )
    .join('');

  const meetingRows = data.topMeetings
    .map((m) => `<tr><td>${esc(m.title)}</td><td>${m.count}</td><td>${esc(fmtMinutes(m.minutes))}</td></tr>`)
    .join('');

  const gitlabRows = data.gitlabActions.map((a) => `<tr><td>${esc(a.label)}</td><td>${a.count}</td></tr>`).join('');

  const insights = data.insights.length
    ? `<h2>观察与建议</h2><div class="card"><ol>${data.insights.map((s) => `<li>${esc(s)}</li>`).join('')}</ol></div>`
    : '';

  const sources = data.sources
    .map((s) => `<span class="badge ${s.ok ? 'ok' : 'warn'}">${esc(s.label)}：${esc(s.status)}</span>`)
    .join(' ');

  const empty = (cols: number) => `<tr><td colspan="${cols}" class="muted">暂无数据</td></tr>`;

  return page(
    `时间去向 ${range}`,
    `<h1>时间去向报告</h1>
    <div class="muted">${esc(range)} · 生成于 ${esc(new Date(data.generatedAt).toLocaleString('zh-CN'))} · <a href="/">返回首页</a></div>
    <div class="row" style="margin-top:8px">${sources}</div>

    <h2>总览</h2>
    <div class="grid">
      ${stat('会议总时长', fmtMinutes(t.meetingMinutes))}
      ${stat('会议场次', String(t.meetingCount))}
      ${stat('会议占工作时间', t.meetingShare === null ? '—' : `${Math.round(t.meetingShare * 100)}%`)}
      ${stat('发出 / 收到邮件', `${t.emailSent} / ${t.emailReceived}`)}
      ${stat('通知类邮件', String(t.emailNotification))}
      ${stat('GitLab 操作', String(t.gitlab))}
    </div>
    ${insights}

    <h2>按类别</h2>
    <table><tr><th>类别</th><th colspan="2">会议时长</th><th>发出 / 收到邮件</th><th>GitLab 操作</th></tr>${categoryRows || empty(5)}</table>

    <h2>每天</h2>
    <table><tr><th>日期</th><th>会议</th><th>最长无会议时段</th><th>≥90 分钟专注块</th><th>GitLab</th><th>发信</th></tr>${dayRows || empty(6)}</table>

    <h2>最耗时的会议</h2>
    <table><tr><th>会议</th><th>次数</th><th>总时长</th></tr>${meetingRows || empty(3)}</table>

    <h2>GitLab 操作分布</h2>
    <table><tr><th>操作</th><th>次数</th></tr>${gitlabRows || empty(2)}</table>

    <p class="muted" style="margin-top:24px">说明：会议时长来自飞书日历，重叠会议只算一次；已拒绝但仍在日历上的会议也会计入（飞书日程视图接口不返回你的回复状态）。专注时段只统计工作日 .env 里配置的工作时间窗口。邮件只读取了标题和收发件人，没有读取正文。</p>`,
  );
}
