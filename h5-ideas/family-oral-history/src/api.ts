export type Notice = (message: string, kind?: 'status' | 'error') => void;

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, { credentials: 'same-origin', ...options });
  } catch {
    throw new ApiError('还没连上本地服务，请检查网络和后端是否启动。草稿不会因此自动发送。', 0);
  }
  const body = await response.json().catch(() => null) as { error?: string } | null;
  if (!response.ok) throw new ApiError(body?.error || '这次操作没完成，请稍后重试。', response.status);
  if (!body) throw new ApiError('服务没有给出确认结果，请刷新检查，不要重复提交新内容。', 502);
  return body as T;
}
export function json<T>(path: string, data: unknown, method = 'POST'): Promise<T> {
  return api<T>(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}
export async function downloadArchive() {
  const response = await fetch('/api/export', { credentials: 'same-origin' });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || '导出没有完成。');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = '然后呢-原声与文字档案.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
