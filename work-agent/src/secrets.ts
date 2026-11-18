import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);
const SERVICE = 'work-agent';

export async function getSecret(account: string): Promise<string | null> {
  try {
    const { stdout } = await run('security', ['find-generic-password', '-s', SERVICE, '-a', account, '-w']);
    return stdout.replace(/\n$/, '');
  } catch {
    return null;
  }
}

export async function setSecret(account: string, value: string): Promise<void> {
  await run('security', ['add-generic-password', '-U', '-s', SERVICE, '-a', account, '-w', value]);
}

export async function deleteSecret(account: string): Promise<void> {
  try {
    await run('security', ['delete-generic-password', '-s', SERVICE, '-a', account]);
  } catch {
    // already absent
  }
}

export async function getJson<T>(account: string): Promise<T | null> {
  const raw = await getSecret(account);
  return raw ? (JSON.parse(raw) as T) : null;
}

export const setJson = (account: string, value: unknown) => setSecret(account, JSON.stringify(value));
