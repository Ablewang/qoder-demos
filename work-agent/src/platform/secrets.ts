import { spawn } from 'node:child_process';
import { KEYCHAIN_SERVICE, ContractError } from '../contracts/index.ts';
import type { SecretStore } from '../contracts/index.ts';

export interface CommandResult { code: number; stdout: string }
export type SecretRunner = (file: string, args: string[], input?: string) => Promise<CommandResult>;

export const runSecurity: SecretRunner = (file, args, input) => new Promise((resolve, reject) => {
  const child = spawn(file, args, { stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '';
  child.stdout.setEncoding('utf8').on('data', (chunk: string) => { stdout += chunk; });
  child.stderr.resume();
  child.on('error', () => reject(new ContractError('internal', 'credential store unavailable')));
  child.on('close', (code) => resolve({ code: code ?? -1, stdout }));
  child.stdin.on('error', () => {});
  child.stdin.end(input);
});

function quote(value: string): string {
  if (/[\r\n\0]/.test(value)) throw new ContractError('bad_request', 'invalid credential input');
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export function createSecretStore(runner: SecretRunner = runSecurity, platform: string = process.platform): SecretStore {
  const supported = () => {
    if (platform !== 'darwin') throw new ContractError('unsupported', 'system credential store unsupported');
  };
  const execute = async (args: string[], input?: string) => {
    supported();
    try { return await runner('/usr/bin/security', args, input); }
    catch { throw new ContractError('internal', 'credential store unavailable'); }
  };
  return {
    async get(key) {
      const result = await execute(['find-generic-password', '-s', KEYCHAIN_SERVICE, '-a', key, '-w']);
      if (result.code === 44) return undefined;
      if (result.code !== 0) throw new ContractError('internal', 'credential read failed');
      return result.stdout.replace(/\r?\n$/, '');
    },
    async set(key, value) {
      const command = `add-generic-password -U -s ${KEYCHAIN_SERVICE} -a ${quote(key)} -w ${quote(value)}\n`;
      const result = await execute(['-i'], command);
      if (result.code !== 0) throw new ContractError('internal', 'credential write failed');
    },
    async delete(key) {
      const result = await execute(['delete-generic-password', '-s', KEYCHAIN_SERVICE, '-a', key]);
      if (result.code !== 0 && result.code !== 44) throw new ContractError('internal', 'credential delete failed');
    },
  };
}
