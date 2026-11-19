import { closeSync, existsSync, fsyncSync, lstatSync, mkdirSync, openSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ContractError } from '../contracts/common.ts';
import { checkDate, classifyLine, headerLines, isFence, sha256, tombstoneHash } from './format.ts';

export interface FileLine { text: string; eol: string }
export interface MemoryFile {
  path: string;
  exists: boolean;
  sha256: string;
  lines: FileLine[];
}

export function splitLines(content: string): FileLine[] {
  return Array.from(content.matchAll(/([^\r\n]*)(\r\n|\n|\r|$)/g), (m) => ({ text: m[1], eol: m[2] }))
    .filter((line, i, lines) => i !== lines.length - 1 || line.text !== '' || line.eol !== '');
}

export function contentOf(file: MemoryFile): string {
  return file.lines.map((l) => l.text + l.eol).join('');
}

export function assertDirectory(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true, mode: 0o700 });
  const stat = lstatSync(path);
  if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ContractError('conflict', 'memory directory is not a regular directory');
}

function regularFile(path: string): boolean {
  try {
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) throw new ContractError('conflict', 'memory path is not a regular file');
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
}

export function loadFile(path: string): MemoryFile {
  const parent = dirname(path);
  if (existsSync(parent)) {
    const stat = lstatSync(parent);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new ContractError('conflict', 'memory parent is not a regular directory');
  }
  const exists = regularFile(path);
  const bytes = exists ? readFileSync(path) : Buffer.alloc(0);
  const content = bytes.toString('utf8');
  if (exists && !Buffer.from(content, 'utf8').equals(bytes)) throw new ContractError('conflict', 'memory file is not valid UTF-8');
  return { path, exists, sha256: sha256(bytes), lines: splitLines(content) };
}

export function newFile(path: string, rel: string): MemoryFile {
  const file = loadFile(path);
  if (!file.exists) file.lines = headerLines(rel).map((text) => ({ text, eol: '\n' }));
  return file;
}

export function appendLine(file: MemoryFile, text: string): void {
  const eol = file.lines.find((l) => l.eol)?.eol ?? '\n';
  const last = file.lines.at(-1);
  if (last && !last.eol) last.eol = eol;
  file.lines.push({ text, eol });
}

export function discoverFiles(root: string, knownPaths: string[], issue: (file: string, reason: string) => void): string[] {
  const paths = new Set<string>([join(root, 'user.md'), join(root, 'memory.md'), ...knownPaths]);
  const journalDir = join(root, 'journal');
  if (existsSync(journalDir)) {
    const stat = lstatSync(journalDir);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      issue(journalDir, '日记目录不是普通目录');
    } else {
      for (const entry of readdirSync(journalDir, { withFileTypes: true })) {
        if (!entry.name.endsWith('.md')) continue;
        const path = join(journalDir, entry.name);
        try {
          checkDate(entry.name.slice(0, -3));
        } catch {
          issue(journalDir, '发现文件名日期无效的日记文件');
          continue;
        }
        paths.add(path);
      }
    }
  }
  return [...paths].sort();
}

function writeDurable(path: string, bytes: string): void {
  const fd = openSync(path, 'wx', 0o600);
  try {
    writeFileSync(fd, bytes, 'utf8');
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function syncDirectory(path: string): void {
  const fd = openSync(path, 'r');
  try {
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
}

function backupContent(content: string, forgotten: Set<string>, hashes = new Set<string>()): string {
  let fenced = false;
  return splitLines(content).filter((l) => {
    if (isFence(l.text)) { fenced = !fenced; return true; }
    if (fenced) return true;
    const parsed = classifyLine(l.text);
    const id = parsed.type === 'marked' ? parsed.marker.id : parsed.type === 'broken' ? parsed.looseId : undefined;
    if (id && forgotten.has(id)) return false;
    if ((parsed.type === 'marked' || parsed.type === 'plain') && hashes.has(tombstoneHash(parsed.text))) return false;
    return true;
  }).map((l) => l.text + l.eol).join('');
}

export function scrubBackup(path: string, forgotten: Set<string>, hashes = new Set<string>()): void {
  const backup = path + '.bak';
  if ((!forgotten.size && !hashes.size) || !regularFile(backup)) return;
  const original = readFileSync(backup, 'utf8');
  const sanitized = backupContent(original, forgotten, hashes);
  if (original === sanitized) return;
  const tmp = backup + '.' + randomUUID() + '.tmp';
  try {
    writeDurable(tmp, sanitized);
    renameSync(tmp, backup);
    syncDirectory(dirname(path));
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
  }
}

export function atomicWrite(file: MemoryFile, forgotten = new Set<string>(), hashes = new Set<string>()): void {
  const current = loadFile(file.path);
  if (current.exists !== file.exists || current.sha256 !== file.sha256) throw new ContractError('conflict', 'memory file changed during write');
  const tmp = file.path + '.' + randomUUID() + '.tmp';
  const backupTmp = file.path + '.bak.' + randomUUID() + '.tmp';
  try {
    writeDurable(tmp, contentOf(file));
    if (current.exists) {
      // 遗忘不能把已删除的条目留在模块自己的备份里。
      writeDurable(backupTmp, backupContent(contentOf(current), forgotten, hashes));
      renameSync(backupTmp, file.path + '.bak');
    }
    const latest = loadFile(file.path);
    if (latest.exists !== current.exists || latest.sha256 !== current.sha256) throw new ContractError('conflict', 'memory file changed during write');
    renameSync(tmp, file.path);
    syncDirectory(dirname(file.path));
    file.exists = true;
    file.sha256 = sha256(contentOf(file));
    scrubBackup(file.path, forgotten, hashes);
  } finally {
    if (existsSync(tmp)) unlinkSync(tmp);
    if (existsSync(backupTmp)) unlinkSync(backupTmp);
  }
}
