import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const ROOT = resolve(import.meta.dirname, '..');

const envFile = resolve(ROOT, '.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

const env = (key: string, fallback = '') => (process.env[key] ?? fallback).trim();

export const config = {
  port: Number(env('PORT', '8787')),
  dataDir: resolve(ROOT, 'data'),
  workStart: env('WORK_START', '10:00'),
  workEnd: env('WORK_END', '19:00'),
  feishu: {
    appId: env('FEISHU_APP_ID'),
    appSecret: env('FEISHU_APP_SECRET'),
    scopes: env('FEISHU_SCOPES', 'offline_access calendar:calendar:readonly'),
  },
  google: {
    clientId: env('GOOGLE_CLIENT_ID'),
    clientSecret: env('GOOGLE_CLIENT_SECRET'),
  },
  gitlab: {
    baseUrl: env('GITLAB_URL').replace(/\/+$/, ''),
  },
  llm: {
    baseUrl: env('LLM_BASE_URL').replace(/\/+$/, ''),
    apiKey: env('LLM_API_KEY'),
    model: env('LLM_MODEL'),
  },
};

export const origin = () => `http://127.0.0.1:${config.port}`;
export const redirectUri = (provider: string) => `${origin()}/callback/${provider}`;
