import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { config } from './config.ts';
import { connectors, isAuthorized } from './connectors/index.ts';
import { itemsInRange, openDb, replaceRange, setCategories } from './db.ts';
import { classify, generateInsights, llmConfigured } from './llm.ts';
import { renderReport } from './render.ts';
import { addDays, buildReport, dateKey, insightInput, startOfDay, type ReportData, type SourceStatus } from './report.ts';
import type { Kind } from './types.ts';

const CLASSIFIABLE: Kind[] = ['meeting', 'email_sent', 'email_received'];
export const reportsDir = () => join(config.dataDir, 'reports');
export const latestReportFile = () => join(reportsDir(), 'latest.html');

export interface RunResult {
  data: ReportData;
  file: string;
  warnings: string[];
}

export async function runReport(days: number, log: (msg: string) => void = () => {}): Promise<RunResult> {
  const db = openDb(join(config.dataDir, 'work-agent.db'));
  try {
    const to = Date.now();
    const from = addDays(startOfDay(to), -(days - 1));
    const sources: SourceStatus[] = [];
    const warnings: string[] = [];

    for (const c of connectors) {
      if (!c.configured()) {
        sources.push({ label: c.label, status: '未配置', ok: false });
        continue;
      }
      if (!(await isAuthorized(c))) {
        sources.push({ label: c.label, status: '未授权', ok: false });
        continue;
      }
      log(`同步 ${c.label}…`);
      try {
        const items = await c.sync(from, to);
        replaceRange(db, c.source, from, to, items);
        sources.push({ label: c.label, status: `${items.length} 条`, ok: true });
      } catch (err) {
        const msg = (err as Error).message;
        sources.push({ label: c.label, status: '同步失败', ok: false });
        warnings.push(`${c.label} 同步失败：${msg}`);
      }
    }

    let items = itemsInRange(db, from, to);
    if (llmConfigured()) {
      const todo = items.filter((i) => !i.category && CLASSIFIABLE.includes(i.kind));
      if (todo.length) {
        log(`用模型分类 ${todo.length} 条记录…`);
        try {
          setCategories(db, await classify(todo));
          items = itemsInRange(db, from, to);
        } catch (err) {
          warnings.push(`分类失败：${(err as Error).message}`);
        }
      }
    } else {
      warnings.push('未配置 LiteLLM，记录不会分类，也不会生成观察与建议');
    }

    const data = buildReport(items, from, to, { start: config.workStart, end: config.workEnd });
    data.sources = sources;
    if (llmConfigured() && items.length) {
      log('生成观察与建议…');
      try {
        data.insights = await generateInsights(insightInput(data));
      } catch (err) {
        warnings.push(`生成观察与建议失败：${(err as Error).message}`);
      }
    }

    mkdirSync(reportsDir(), { recursive: true });
    const html = renderReport(data);
    const file = join(reportsDir(), `${dateKey(from)}_${dateKey(to)}.html`);
    writeFileSync(file, html);
    writeFileSync(latestReportFile(), html);
    return { data, file, warnings };
  } finally {
    db.close();
  }
}
