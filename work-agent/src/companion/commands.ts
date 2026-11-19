export function normalizeCommand(message: string, name: string): string {
  let text = message.trim().replace(/[：]/g, ':').replace(/[，]/g, ',');
  if (text.startsWith(`@${name}`)) text = text.slice(name.length + 1).replace(/^[,:\s]+/, '');
  else if (text.startsWith(`${name},`)) text = text.slice(name.length + 1).trim();
  return text;
}

export function looksLikeCredential(text: string): boolean {
  return /密码|token|密钥|sk-|[a-zA-Z0-9]{20,}/i.test(text);
}

export function memoryValidity(text: string, now: number): number | undefined {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const endDays = (days: number) => { const date = new Date(today); date.setDate(date.getDate() + days); return date.getTime() - 1; };
  if (/下周/.test(text)) return endDays((7 - ((today.getDay() + 6) % 7)) + 7);
  if (/这周|本周/.test(text)) return endDays(7 - ((today.getDay() + 6) % 7));
  if (/本月/.test(text)) return new Date(today.getFullYear(), today.getMonth() + 1, 1).getTime() - 1;
  const until = /到\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/.exec(text);
  if (until) {
    const month = Number(until[1]); const day = Number(until[2]);
    const date = new Date(today.getFullYear(), month - 1, day);
    if (month < 1 || month > 12 || day < 1 || date.getMonth() !== month - 1) return undefined;
    if (date.getTime() < today.getTime()) date.setFullYear(date.getFullYear() + 1);
    date.setDate(date.getDate() + 1);
    return date.getTime() - 1;
  }
  if (/明天/.test(text)) return endDays(2);
  if (/今天/.test(text)) return endDays(1);
  return undefined;
}

export function parseReminder(text: string, now: number): { text: string; dueAt: number } | undefined {
  const relative = /^(\d+)\s*(分钟|小时)后提醒我\s*(.+)$/.exec(text);
  if (relative) return { text: relative[3], dueAt: now + Number(relative[1]) * (relative[2] === '小时' ? 3600_000 : 60_000) };
  const clock = /^(\d{1,2}):(\d{2})\s*提醒我\s*(.+)$/.exec(text);
  if (clock) {
    if (Number(clock[1]) > 23 || Number(clock[2]) > 59) return undefined;
    const date = new Date(now); date.setHours(Number(clock[1]), Number(clock[2]), 0, 0);
    if (date.getTime() <= now) date.setDate(date.getDate() + 1);
    return { text: clock[3], dueAt: date.getTime() };
  }
  const tomorrow = /^明天\s*(\d{1,2})\s*点(?:\s*(\d{1,2})\s*分)?\s*提醒我\s*(.+)$/.exec(text);
  if (tomorrow) {
    if (Number(tomorrow[1]) > 23 || Number(tomorrow[2] ?? 0) > 59) return undefined;
    const date = new Date(now); date.setDate(date.getDate() + 1); date.setHours(Number(tomorrow[1]), Number(tomorrow[2] ?? 0), 0, 0);
    return { text: tomorrow[3], dueAt: date.getTime() };
  }
  return undefined;
}
