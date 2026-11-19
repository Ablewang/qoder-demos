import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_PORT, PORT_FALLBACK_LAST, TAURI_ORIGINS } from '../contracts/index.ts';

export const DAEMON_VERSION = '0.1.0';

export interface DaemonConfig {
  repoRoot: string;
  dataDir: string;
  runDir: string;
  companionDir: string;
  dbPath: string;
  portRange: [number, number];
  origins: string[];
  logToFile: boolean;
  version: string;
}

export function repoRootFromHere(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

export function resolveDataPaths(dataDir: string): Pick<DaemonConfig, 'dataDir' | 'runDir' | 'companionDir' | 'dbPath'> {
  const abs = path.resolve(dataDir);
  return {
    dataDir: abs,
    runDir: path.join(abs, 'run'),
    companionDir: path.join(abs, 'companion'),
    dbPath: path.join(abs, 'work-agent.db'),
  };
}

export function parsePortRange(raw: string | undefined): [number, number] {
  if (raw === undefined || raw.trim() === '') return [DEFAULT_PORT, PORT_FALLBACK_LAST];
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('WORK_AGENT_PORT must be an integer port');
  return [port, port <= PORT_FALLBACK_LAST ? Math.max(port, PORT_FALLBACK_LAST) : port];
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env, repoRoot = repoRootFromHere()): DaemonConfig {
  const dataDir = env.WORK_AGENT_DATA_DIR && env.WORK_AGENT_DATA_DIR.trim() !== ''
    ? env.WORK_AGENT_DATA_DIR
    : path.join(repoRoot, 'data');
  const devOrigins = (env.WORK_AGENT_DEV_ORIGINS ?? '').split(',').map((s) => s.trim()).filter((s) => s !== '');
  return {
    repoRoot,
    ...resolveDataPaths(dataDir),
    portRange: parsePortRange(env.WORK_AGENT_PORT),
    origins: [...TAURI_ORIGINS, ...devOrigins],
    logToFile: env.WORK_AGENT_LOG === 'file',
    version: DAEMON_VERSION,
  };
}
