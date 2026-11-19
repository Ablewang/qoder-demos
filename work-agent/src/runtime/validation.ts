import { ContractError } from '../contracts/index.ts';

// Keep the persistence boundary aligned with memory/commands without importing them.
export function assertCredentialFree(value: unknown): void {
  const seen = new WeakSet<object>();
  const check = (item: unknown): void => {
    if (typeof item === 'string') {
      if (/密码|token|密钥|sk-|[a-zA-Z0-9]{20,}/i.test(item)) throw new ContractError('rejected', 'credential-like text is not allowed');
    } else if (item && typeof item === 'object') {
      if (seen.has(item)) throw new ContractError('bad_request', 'invalid fields');
      seen.add(item);
      for (const [key, child] of Object.entries(item)) { check(key); check(child); }
      seen.delete(item);
    }
  };
  check(value);
}

// A long generated ID is not free text. Only callers that resolve its ownership
// may exempt it, and only in the corresponding metadata field.
export function isGeneratedId(value: string, prefix: string): boolean {
  return new RegExp(`^${prefix}_[0-9A-HJKMNP-TV-Z]{26}$`).test(value);
}
