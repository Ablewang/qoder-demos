import { mkdirSync, writeFileSync, renameSync, openSync, closeSync, readFileSync, unlinkSync, fsyncSync } from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { ContractError } from '../contracts/index.ts';
import type { DaemonInfo } from '../contracts/index.ts';

export function atomicWrite(filename: string, content: string): void {
  mkdirSync(path.dirname(filename), { recursive: true, mode: 0o700 });
  const temp = `${filename}.${randomBytes(8).toString('hex')}.tmp`;
  try {
    writeFileSync(temp, content, { mode: 0o600, flag: 'wx' });
    const fd = openSync(temp, 'r');
    try { fsyncSync(fd); } finally { closeSync(fd); }
    renameSync(temp, filename);
  } finally {
    try { unlinkSync(temp); } catch {}
  }
}

export function acquireLock(runDir: string, pid = process.pid, isAlive = (candidate: number) => {
  try { process.kill(candidate, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code !== 'ESRCH'; }
}): () => void {
  mkdirSync(runDir, { recursive: true, mode: 0o700 });
  const file = path.join(runDir, 'daemon.lock');
  for (let attempts = 0; attempts < 3; attempts++) {
    try {
      const fd = openSync(file, 'wx', 0o600);
      try { writeFileSync(fd, String(pid)); fsyncSync(fd); } finally { closeSync(fd); }
      return () => {
        try { if (readFileSync(file, 'utf8') === String(pid)) unlinkSync(file); } catch {}
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
      let old: string;
      try { old = readFileSync(file, 'utf8'); } catch { continue; }
      const candidate = Number(old);
      if (!Number.isInteger(candidate) || candidate <= 0 || isAlive(candidate)) throw new ContractError('conflict', 'daemon already running or lock incomplete');
      const recovery = path.join(runDir, 'daemon.lock.recovery');
      let recoveryFd: number;
      try { recoveryFd = openSync(recovery, 'wx', 0o600); }
      catch { throw new ContractError('conflict', 'daemon lock recovery in progress'); }
      try {
        if (readFileSync(file, 'utf8') === old) unlinkSync(file);
      } finally { closeSync(recoveryFd); unlinkSync(recovery); }
    }
  }
  throw new ContractError('conflict', 'daemon lock unavailable');
}

export function writeDaemonInfo(runDir: string, info: DaemonInfo): void {
  atomicWrite(path.join(runDir, 'daemon.json'), JSON.stringify(info) + '\n');
}

export function removeDaemonInfo(runDir: string): void {
  try { unlinkSync(path.join(runDir, 'daemon.json')); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
}
