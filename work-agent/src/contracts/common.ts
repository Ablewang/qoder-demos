// contracts.md §1：只有总架构师能修改本目录。

export type Timestamp = number;
export type PersonId = `person:${string}`;
export type EntityId = string;
export type SourceId = string;
export type CapabilityId = string;
export type ProposalId = string;

export type Sensitivity = 'normal' | 'confidential' | 'secret';

export type Actor =
  | { kind: 'user'; personId: PersonId }
  | { kind: 'capability'; id: CapabilityId }
  | { kind: 'system'; component: string }
  | { kind: 'remote'; personId: PersonId; via: string };

export type EvidenceRef =
  | { kind: 'entity'; id: EntityId; owner: PersonId }
  | { kind: 'memory'; id: string }
  | { kind: 'tool_result'; id: string };

export type Unsubscribe = () => void;

export const OWNER: PersonId = 'person:local:owner';
export const OWNER_ACTOR: Actor = { kind: 'user', personId: OWNER };

export const SENSITIVITY_RANK: Record<Sensitivity, number> = { normal: 0, confidential: 1, secret: 2 };

export type ContractErrorCode =
  | 'bad_request' | 'not_found' | 'conflict' | 'rejected' | 'tombstoned' | 'unsupported' | 'internal';

/** 跨模块抛出的业务错误；message 不得包含正文或凭证 */
export class ContractError extends Error {
  readonly code: ContractErrorCode;
  constructor(code: ContractErrorCode, message: string) {
    super(message);
    this.name = 'ContractError';
    this.code = code;
  }
}
