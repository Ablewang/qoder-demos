import { config } from './config.ts';
import { CATEGORIES, KIND_LABELS, type Category, type Item } from './types.ts';

const BATCH = 40;

export const llmConfigured = () => Boolean(config.llm.baseUrl && config.llm.apiKey && config.llm.model);

async function chat(system: string, user: string): Promise<string> {
  const res = await fetch(`${config.llm.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.llm.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.llm.model,
      temperature: 0,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`LiteLLM 返回 ${res.status}：${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return body.choices?.[0]?.message?.content ?? '';
}

export function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('模型没有返回 JSON');
  return JSON.parse(text.slice(start, end + 1));
}

export function parseCategories(text: string, count: number): Category[] {
  const obj = extractJson(text) as Record<string, unknown>;
  return Array.from({ length: count }, (_, i) => {
    const value = obj[String(i)];
    return CATEGORIES.includes(value as Category) ? (value as Category) : '其他';
  });
}

const CLASSIFY_PROMPT = `你在帮一位同时负责研发和产品的工程师统计时间去向。把每条工作记录归入且仅归入一个类别：
- 研发：技术方案、编码、代码评审、架构、排障、测试、发布上线、技术分享
- 产品：需求讨论、PRD、产品或需求评审、用户调研、竞品、数据分析、产品规划
- 协作沟通：站会、周会、1on1、项目同步、进度对齐、跨团队协调
- 行政事务：招聘面试、HR、报销、培训、团建、全员会、行政通知
- 其他：无法判断或与工作无关
只输出 JSON 对象，键为记录编号，值为类别名，例如 {"0":"研发","1":"产品"}。`;

export async function classify(items: Item[]): Promise<Map<string, Category>> {
  const result = new Map<string, Category>();
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const lines = batch.map((it, idx) => `${idx}. [${KIND_LABELS[it.kind]}] ${it.title}`).join('\n');
    const categories = parseCategories(await chat(CLASSIFY_PROMPT, lines), batch.length);
    batch.forEach((it, idx) => result.set(it.id, categories[idx]));
  }
  return result;
}

const INSIGHT_PROMPT = `你是一位务实的效率顾问。用户同时负责研发和产品，下面是他一段时间的工作数据统计（会议来自飞书日历，邮件只统计数量和主题，GitLab 是他的操作记录）。
写 3 到 5 条具体观察和可执行的建议：必须引用数据里的具体数字、日期或会议名；不写空话套话；每条一到两句；用中文。
只输出 JSON：{"insights":["...","..."]}`;

export async function generateInsights(summary: unknown): Promise<string[]> {
  const obj = extractJson(await chat(INSIGHT_PROMPT, JSON.stringify(summary))) as { insights?: unknown };
  if (!Array.isArray(obj.insights)) return [];
  return obj.insights.filter((s): s is string => typeof s === 'string').slice(0, 5);
}
