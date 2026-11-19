# 跨模块接口 v1

- 状态：已批准（技术基线冻结；变更由总架构师评审）
- 版本：v1
- 更新：2026-11-19

这是所有模块设计的唯一依据。代码形态放在 `src/contracts/`，内容必须和本文一致。

**变更规则**：
- 新增可选字段、新增实体类型、新增事件类型：总架构师批准后直接改，在文末变更记录里登记。
- 删除或改名字段、改变语义：需要 ADR，并且所有受影响的模块设计都要重新评审。
- 模块需要新接口时：写进 `open-questions.md`，不要自己改本文或 `src/contracts/`。

---

## 1. 通用约定

```ts
type Timestamp = number;              // UTC 毫秒。展示时按用户时区换算
type PersonId = `person:${string}`;   // 有邮箱时为 person:<小写邮箱>；否则为 person:local:<ulid>，以后可以合并
type EntityId = string;               // 来自数据源：<source>:<type>:<原始 id>；派生实体：wa:<type>:<ulid>
type SourceId = string;               // 'feishu' | 'gmail' | 'gitlab' | 第三方连接器 id
type CapabilityId = string;           // 'time-audit' 等

type Visibility =
  | { scope: 'private' }
  | { scope: 'space'; spaceId: string };          // M4

/** 决定内容能否发给模型、能否出现在通知里 */
type Sensitivity = 'normal' | 'confidential' | 'secret';

type Actor =
  | { kind: 'user'; personId: PersonId }
  | { kind: 'capability'; id: CapabilityId }
  | { kind: 'system'; component: string }
  | { kind: 'remote'; personId: PersonId; via: string };   // M4：别人的 agent
```

### 1.1 公共类型与平台服务（MOD-01）

```ts
type JsonSchema = Record<string, unknown>;
type EntityType = string;                 // 内置类型或 <extension>.<type>，必须登记 Schema
type AttrsOf<T extends EntityType> = Record<string, unknown>;
type Unsubscribe = () => void;
type SqlValue = string | number | bigint | Uint8Array | null;

interface Tx {
  run(sql: string, params?: SqlValue[]): { changes: number };
  get(sql: string, params?: SqlValue[]): Record<string, SqlValue> | undefined;
  all(sql: string, params?: SqlValue[]): Array<Record<string, SqlValue>>;
}
interface Migration { version: number; checksum: string; apply(tx: Tx): void }
interface StorageService {
  registerMigrations(moduleId: string, tablePrefixes: string[], migrations: Migration[]): void;
  transaction<T>(work: (tx: Tx) => T): T;
}
interface SecretStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
interface AuditWriter { append(record: AuditRecord, tx?: Tx): void }
interface KeyValueStore {
  get<T>(key: string): T | undefined;
  set<T>(key: string, value: T): void;
  delete(key: string): void;
}
interface Logger {
  info(event: string, fields?: Record<string, unknown>): void;
  warn(event: string, fields?: Record<string, unknown>): void;
  error(event: string, fields?: Record<string, unknown>): void;
}
interface EventFilter { types: DomainEvent['type'][]; source?: SourceId }
interface EventEnvelope { id: string; at: Timestamp; event: DomainEvent }
interface TriggerEvent { id: string; kind: Trigger['kind']; at: Timestamp; input?: unknown; event?: EventEnvelope }
interface ApplyResult { upserted: EntityId[]; deleted: EntityId[]; snapshotCompleted: boolean }
interface DecisionStat { accepted: number; edited: number; dismissed: number; snoozed: number; completed: number; sampleSize: number }

type EvidenceRef =
  | { kind: 'entity'; id: EntityId; owner: PersonId }
  | { kind: 'memory'; id: string }
  | { kind: 'tool_result'; id: string };
interface ToolReadResult {
  id: string; source: SourceId; value: unknown;
  sensitivity: Sensitivity; evidence: EvidenceRef[]; createdAt: Timestamp;
}
interface ToolResultReader { get(id: string): ToolReadResult | undefined }
interface ToolDefinition { name: string; description: string; inputSchema: JsonSchema }
interface ToolInvocation { id: string; name: string; args: unknown }
interface LlmResult {
  text: string; json?: unknown; toolCalls?: ToolInvocation[];
  usage: { inputTokens: number; outputTokens: number };
}

type ChatChunk =
  | { kind: 'text'; text: string }
  | { kind: 'proposal'; proposalId: ProposalId }
  | { kind: 'auth'; requestId: string }
  | { kind: 'error'; code: string; message: string }
  | { kind: 'done'; conversationId: string };
```

- Tx 回调必须同步，不跨网络等待；同一事务可调用游标、审计和事件 outbox 写入，失败一起回滚。Tx 是事务接口而非沙箱；受信模块仍只写自己的表，跨模块写入走服务接口。
- MOD-01 管理 `platform_` 与中央 `audit_` 表，其他模块通过 AuditWriter 追加。迁移按模块有序登记，历史版本和校验和不可改，迁移前备份；恢复方案在模块设计中明确。
- SecretStore 只注入授权代理、网关的供应商认证和本机服务认证；不注入普通能力或皮肤。
- SourceId 是本机连接实例的稳定命名空间，provider 是厂商类型；账号绑定变化不得覆盖旧实例身份。来自外部的 id 在连接实例内唯一。
- EvidenceRef、工具结果敏感度与 origin 的可信部分由宿主填充，不能接受模型或连接器自报的降级。无来源的外部数据不进入可信 instruction/system。

## 2. 工作图谱（MOD-02）

### 2.1 实体

```ts
interface Provenance {
  source: SourceId;
  connectorVersion: string;
  fetchedAt: Timestamp;
  nativeUrl?: string;        // 能在原系统里打开的链接
  contentHash: string;       // 用于判断是否变化，以及执行动作前检查前置条件
}

interface Entity<T extends EntityType = EntityType> {
  id: EntityId;
  type: T;
  schemaVersion: number;
  owner: PersonId;           // 数据属于哪个节点的主人；本机同步的数据 = 本人
  visibility: Visibility;    // 默认 private
  sensitivity: Sensitivity;  // 由连接器给出初值，用户规则可以改
  provenance: Provenance;
  title?: string;
  occurredAt?: Timestamp;    // 放在时间轴上的时间点
  endAt?: Timestamp;
  attrs: AttrsOf<T>;         // 按类型定义的属性，见 2.2
  hasContent: boolean;       // 正文另外存，用 graph.content(id) 取
}
```

存储主键是 `(owner, id)`：共享进来的同一个外部对象可以和本人的那份并存。

### 2.2 实体类型（v1）

| 类型 | 来源 | 关键属性 | 说明 |
|---|---|---|---|
| `identity` | 各连接器 | `source, nativeId, displayName, email?, handle?` | 某人在某个数据源上的账号；通过身份解析关联到 PersonId |
| `calendar_event` | 飞书 | `organizer, attendeeCount, isRecurring, location?, selfRsvp?: 'accepted'\|'declined'\|'tentative'\|'unknown'` | 已取消、空闲、全天的日程由连接器过滤掉 |
| `mail_message` | Gmail | `threadId, direction: 'sent'\|'received', category: 'personal'\|'notification', labels[]` | 正文要扩大权限才能拉取 |
| `mail_thread` | Gmail | `messageCount, lastMessageAt` | |
| `chat` | 飞书 | `chatType: 'p2p'\|'group', memberCount` | 依赖 Q4 |
| `chat_message` | 飞书 | `chatId, threadId?, mentionsSelf: boolean` | 依赖 Q4 |
| `document` | 飞书 | `docType, lastEditedAt` | M2 以后 |
| `issue` | GitLab | `project, state, labels[]` | |
| `merge_request` | GitLab | `project, state, draft, sourceBranch, targetBranch` | |
| `code_push` | GitLab | `project, ref, commitCount` | |
| `activity` | 各连接器 | `action, targetType, targetId?` | 用户自己的操作流水（如 GitLab events） |
| `commitment` | 派生 | `direction: 'i_owe'\|'owed_to_me', counterpart: PersonId, dueAt?, status: 'open'\|'done'\|'dropped'` | 由能力生成 |
| `classification` | 派生 | `category, confidence, by: 'llm'\|'rule'\|'user'` | 能力的分类结果；用户改过的永远优先 |

每个类型的属性结构由 MOD-02 的设计写成 JSON Schema 并带版本号，连接器和能力都按它做校验。

### 2.3 关系

```ts
type RelationKind =
  | 'authored_by' | 'organized_by' | 'attendee' | 'recipient' | 'cc'
  | 'member_of' | 'mentions' | 'reply_to' | 'in_thread'
  | 'references'      // 正文或描述里出现的链接，例如邮件里的 MR 链接
  | 'assigned_to' | 'reviewer'
  | 'derived_from';   // 派生实体 → 依据

interface Relation {
  from: EntityId;
  to: EntityId | PersonId;
  kind: RelationKind;
  attrs?: Record<string, unknown>;
}
```

### 2.4 接口

```ts
interface SyncBatch {
  source: SourceId;
  stream: string;
  owner: PersonId;
  entities: Entity[];
  relations: Relation[];
  identities: Entity<'identity'>[];
  deletions: EntityId[];
  snapshot?: { id: string; window: { from: Timestamp; to: Timestamp }; complete: boolean };
  nextCursor: string | null;
}

interface WorkGraphWriter {           // 只有同步引擎能拿到
  applySync(batch: SyncBatch, cursorCommit: (tx: Tx) => void): ApplyResult;   // 和游标推进放在同一事务里
}

interface WorkGraphReader {           // 能力、交互层能拿到
  get(id: EntityId, owner?: PersonId): Entity | undefined;
  query(q: EntityQuery): { items: Entity[]; nextCursor?: string };
  related(id: EntityId, opts?: { owner?: PersonId; kind?: RelationKind; direction?: 'out' | 'in' }): Array<{ relation: Relation; entity?: Entity }>;
  search(text: string, opts?: { owner?: PersonId; types?: EntityType[]; limit?: number }): Entity[];
  content(id: EntityId, owner?: PersonId): string | undefined;
  person(id: PersonId): Person | undefined;
  self(): Person;
}

interface DerivedWriter {             // 能力通过 ctx 拿到，只能写自己的派生实体
  upsertDerived(entities: Entity[], relations: Relation[]): void;   // 自动加上 provenance.source = 'wa:<capabilityId>'
  removeDerived(ids: EntityId[]): void;
}

interface EntityQuery {
  types?: EntityType[];
  sources?: SourceId[];
  owner?: PersonId | 'self' | 'any';  // 默认 'self'
  timeRange?: { from: Timestamp; to: Timestamp };   // 和 [occurredAt, endAt] 有重叠就算
  relatedTo?: { id: EntityId | PersonId; kind?: RelationKind };
  attrs?: Record<string, unknown>;    // 等值过滤
  limit?: number; cursor?: string;
}

interface Person {
  id: PersonId;
  displayName: string;
  emails: string[];
  identities: EntityId[];
  isSelf: boolean;
}
```

**读取范围**：所有读取接口绑定调用者与允许的 owner；默认 self，指定其他 owner 仍须校验共享可见性。正文读取写审计，不能通过 search/related 绕过相同授权。source/stream 记录实体同步归属。关系仅替换本页实体的出边，不清空其他分页的关系。

**窗口快照**：宿主持久化快照 id、范围、已见实体和分页进度。每页 upsert 与分页检查点同事务提交；仅 complete=true 且全页成功后，按该 owner/source/stream 的窗口归属对账删除。半途失败、过期游标、不同范围不能复用完成标记。过滤掉的取消日程等必须最终删除，不能留成幽灵日程。重复应用安全，不要求动态上游字节级不变。

**身份解析规则（v1）**：先按邮箱精确匹配；飞书优先用 `union_id`（`open_id` 只在单个应用内有效，不能跨应用）；匹配不上就建 `person:local:*`；用户可以在控制台手动合并，合并记录保存下来，重新同步时不会丢。

## 3. 连接器：MCP 扩展 `work-agent/connector` v1（MOD-03 / MOD-04）

目标协议版本是 MCP 2026-07-28（官方 current，ADR-0017 已核验）；每次请求声明 protocolVersion 元数据。具体 SDK 的 discover/stdio/_meta 互操作先由 MOD-03 验证，协议无会话不代表同步或执行状态不需要持久化。

### 3.1 清单

连接器通过资源 `wa://connector/manifest` 提供：

```ts
interface ConnectorManifest {
  extension: 'work-agent/connector';
  extensionVersion: 1;
  source: SourceId;
  version: string;
  auth:
    | { kind: 'oauth2'; provider: string; baseScopes: string[] }
    | { kind: 'token'; provider: string }           // 例如 GitLab PAT
    | { kind: 'none' };
  streams: StreamSpec[];
  tools: ToolSpec[];
}

interface StreamSpec {
  name: string;                       // 'calendar_events'、'mail_messages'、'gitlab_events'
  entityTypes: EntityType[];
  mode: 'cursor' | 'window';          // window：每次按时间窗整体对齐（如飞书日程视图）
  maxWindowDays?: number;             // 如飞书日程视图：< 40
  defaultIntervalMinutes: number;
  requiredScopes: string[];
  contentScopes?: string[];           // 拉取正文所需的额外权限
}

interface ToolSpec {
  name: string;                       // 在宿主里的全名是 <source>.<name>
  kind: 'read' | 'write';
  requiredScopes: string[];
  risk: 'low' | 'medium' | 'high';    // 例如给自己发消息为 low，以本人身份群发为 high
  supportsDryRun: boolean;
  idempotency: { kind: 'none' } | { kind: 'provider_key'; scope: 'account_tool'; retentionMs: number };
  reconciliationTool?: string;        // 已登记只读核验工具：found/not_found/unknown
}
```

清单和 MCP 注解都是声明而非授权。自研受信清单经宿主登记与 Schema 验证后使用；第三方工具默认 write/high，用户显式信任并审核后才可标只读。工具权限、调用范围和输出敏感度由宿主策略裁决，安装工具不能自动拿到账号凭证。

### 3.2 增量同步工具 `wa_sync_pull`

```ts
// 输入
{ stream: string; cursor?: string | null; window?: { from: Timestamp; to: Timestamp };
  limit?: number; includeContent?: boolean }
// 输出（structuredContent）
{ entities: Entity[]; relations: Relation[]; identities: Entity<'identity'>[];
  deletions: EntityId[]; nextCursor: string | null; hasMore: boolean }
```

- 连接器不保存游标和凭证；游标由同步引擎保存，每次调用时传进来。
- 同一个游标可安全重拉，宿主重复应用不增加副作用；上游可能变化，不保证结果字节相同。窗口快照 id/完成状态由宿主设置，不能以单页 hasMore=false 代替整个窗口成功。
- 输出里的 `owner` 由宿主填写，连接器填一个占位值即可。

### 3.3 写工具约定

- 输入可以带 `dryRun: true`：只返回预览 `{ preview: { summary, recipients?, body?, target } }`，不产生副作用。
- 输入必须带 `idempotencyKey`，作用域为连接实例/账号/工具/冻结步骤；数据源不支持时明确声明 none，不以本地去重冒充远端幂等。
- 执行成功返回 `WriteResult`，用于核对结果和写审计；网络中断或超时且无法排除成功时必须报告结果未知，不能当作普通 retryable 错误。
- 核验工具返回 `{ status: 'found'; result: WriteResult } | { status: 'not_found'; authoritative: boolean } | { status: 'unknown' }`。只有权威未执行、或幂等键仍在保证期内，才可重试；未知时留给用户核对。

```ts
interface WriteResult { ref: { entityId?: EntityId; nativeUrl?: string; providerId?: string } }
```

### 3.4 凭证传递

宿主每次 `tools/call` 都在 `_meta["work-agent/credential"]` 里放：

```ts
{ accessToken: string; expiresAt?: Timestamp; account: string }
```

连接器**不能**记录、缓存或回传这个字段。

### 3.5 错误

工具返回 `isError: true` 时，`structuredContent` 必须是：

```ts
type ConnectorError =
  | { code: 'auth_required'; provider: string; missingScopes: string[] }
  | { code: 'auth_expired'; provider: string }
  | { code: 'rate_limited'; retryAfterMs: number }
  | { code: 'not_found'; target: string }
  | { code: 'conflict'; detail: string }          // 例如前置条件已经不成立
  | { code: 'invalid_input'; detail: string }
  | { code: 'upstream_error'; status?: number; detail: string; retryable: boolean }
  | { code: 'outcome_unknown'; detail: string };
```

### 3.6 宿主侧接口（MOD-03 对内提供）

```ts
interface ConnectorHost {
  list(): ConnectorInfo[];                          // 清单 + 授权状态 + 健康状态
  tool(qualifiedName: string): ToolSpec & { source: SourceId; thirdParty: boolean };
  callRead(qualifiedName: string, args: unknown, actor: Actor): Promise<ToolReadResult>;
  callWrite(qualifiedName: string, args: unknown, ctx: { executionId: string; stepId: string; account: string; decisionHash: string; actor: Actor }): Promise<WriteResult>;
}

interface Credential { accessToken: string; expiresAt?: Timestamp; account: string; scopes: string[] }
interface AuthResume { executionId: string; stepId: string; proposalRevision: number; decisionHash: string }
interface GrantRequest {
  source: SourceId; provider: string; scopes: string[]; reason: string; requestedBy: Actor;
  expectedAccount?: string; resume?: AuthResume;
}
interface AuthRequest { id: string; source: SourceId; status: 'pending' | 'granted' | 'cancelled' | 'expired'; expiresAt: Timestamp; grantUrl?: string }
interface ConnectorInfo { manifest: ConnectorManifest; source: SourceId; account?: string; authorized: boolean; health: 'ready' | 'degraded' | 'offline' }

interface AuthBroker {
  status(source: SourceId): { granted: boolean; account?: string; scopes: string[] };
  credential(source: SourceId, scopes: string[]): Promise<Credential>;
  requestGrant(req: GrantRequest): AuthRequest;
  completeGrant(state: string, code: string): Promise<void>;
  cancelGrant(requestId: string, by: Actor): Promise<void>;
  revoke(source: SourceId): Promise<void>;
}
```

授权请求持久化并绑定 state、PKCE、有效期、source/provider/scopes/预期账号和 AuthResume；完成回调校验 issuer/state/重放/账号，拒绝意外账号切换。取消、过期、断开源不会恢复执行。恢复必须回到策略和当前前置条件检查，不从外呼直接续跑。

第三方 MCP 进程是本机代码，不是沙箱；启动需用户显式信任，只传批准的环境和工作目录，不能继承全部供应商凭证。输出通过宿主封装为 ToolReadResult，工具结果的文字不能升级成 instruction。

## 4. 能力运行时（MOD-06）

```ts
interface CapabilityManifest {
  id: CapabilityId;
  version: string;
  name: string;
  description: string;
  triggers: Trigger[];
  requires: { entityTypes?: EntityType[]; readTools?: string[]; writeTools?: string[] };
  outputs: Array<'report' | 'notice' | 'proposal' | 'derived'>;
  configSchema?: JsonSchema;
}

type Trigger =
  | { kind: 'cron'; expr: string; onMissed: 'run_once' | 'skip' }
  | { kind: 'event'; filter: EventFilter; debounceMs?: number }
  | { kind: 'manual'; inputSchema?: JsonSchema }
  | { kind: 'intent'; description: string };     // 对话路由 M2

interface Capability {
  manifest: CapabilityManifest;
  run(ctx: CapabilityContext, trigger: TriggerEvent): Promise<void>;
}

interface CapabilityContext {
  readonly capabilityId: CapabilityId;
  readonly runId: string;
  readonly config: unknown;
  now(): Timestamp;
  graph: WorkGraphReader & DerivedWriter;
  llm: LlmGateway;                          // 已经绑定了 capabilityId，用于审计和预算
  tools: { callRead(name: string, args: unknown): Promise<ToolReadResult> };
  propose(draft: ProposalDraft): Promise<ProposalId>;
  notify(notice: Notice): Promise<void>;
  publishReport(report: Report): Promise<void>;
  state: KeyValueStore;                     // 能力私有，持久化
  memory: MemoryReader;                     // M1 先返回空
  log: Logger;
  signal: AbortSignal;
}
```

**能力拿不到任何写工具的调用入口**，对外写入只能通过 `propose`。

### 4.1 事件总线

```ts
type DomainEvent =
  | { type: 'entity.changed'; source: SourceId; entityType: EntityType; ids: EntityId[]; change: 'upsert' | 'delete' }
  | { type: 'sync.completed'; source: SourceId; stream: string }
  | { type: 'proposal.created' | 'proposal.decided' | 'proposal.finished'; proposalId: ProposalId; status: ProposalStatus }
  | { type: 'auth.granted' | 'auth.revoked'; source: SourceId; provider: string; requestId?: string }
  | { type: 'remote.request'; requestId: string };   // M4

interface EventBus {
  publish(e: DomainEvent, tx?: Tx): void;
  subscribe(filter: EventFilter, handler: (e: EventEnvelope) => Promise<void>): Unsubscribe;
}
```

投递语义是**至少一次**，稳定事件 id 与业务写入通过同事务 outbox 持久化；每个订阅者有持久化检查点，重复投递按事件 id 去重。休眠补跑、并发上限、重试预算与禁用能力由 MOD-06 管理，不能让失败事件无限堆积。客户端推送超过保留窗口时发送 resync_required，客户端先拉当前快照再恢复事件，不伪装续传完整。

## 5. 动作层（MOD-07）

```ts
type ProposalId = string;

interface ProposalDraft {
  title: string;
  rationale: string;                        // 为什么提这个，给用户看
  evidence: EntityId[];                     // 依据
  options: ProposalOption[];                // 至少 1 个；系统会自动追加“忽略”
  recommendedOptionId?: string;
  urgency: 'low' | 'normal' | 'high';
  expiresAt?: Timestamp;
  dedupeKey: string;                        // 同能力下只可更新 pending 提议；批准后不可变
}

interface ProposalOption {
  id: string;
  label: string;
  steps: ActionStep[];
  localEffect?: { kind: 'remind'; at: Timestamp };   // 空步骤仅配合明确的本地效果；忽略由系统追加
  editable?: EditableField[];               // 用户可以在决定前修改的字段，例如回复正文
}

interface ActionStep {
  tool: string;                             // 已登记工具；M4 内部写处理器另登记，仍经执行器
  account: string;                          // 冻结目标账号
  args: unknown;
  preconditions?: Precondition[];
  idempotencyKey: string;
}

type Precondition =
  | { kind: 'entity_unchanged'; id: EntityId; contentHash: string }
  | { kind: 'no_newer_in_thread'; threadId: EntityId; after: Timestamp };

interface EditableField { stepIndex: number; path: string; label: string; multiline?: boolean }

type ProposalStatus =
  | 'pending' | 'expired' | 'superseded' | 'dismissed'
  | 'approved' | 'executing' | 'waiting_auth'
  | 'succeeded' | 'failed' | 'partially_failed' | 'waiting_verification';

interface Proposal extends ProposalDraft {
  id: ProposalId; capabilityId: CapabilityId; revision: number; status: ProposalStatus;
  createdAt: Timestamp; origin: Actor;
}
interface StepPreview { tool: string; account: string; target: string; recipients?: string[]; body?: string; args: unknown }
interface ProposalPreview { proposalId: ProposalId; revision: number; optionId: string; actionHash: string; steps: StepPreview[]; localEffect?: ProposalOption['localEffect'] }
interface StepExecution {
  id: string; executionId: string; decisionId: string; actionHash: string; stepIndex: number;
  status: 'pending' | 'started' | 'waiting_auth' | 'succeeded' | 'failed' | 'unknown';
  idempotencyKey: string; result?: WriteResult; updatedAt: Timestamp;
}

interface Decision {
  id: string;
  proposalId: ProposalId;
  proposalRevision: number;
  actionHash: string;
  optionId: string;                         // 选“忽略”也是一个决定
  edits?: Record<string, unknown>;          // 以 EditableField.path 为键
  decidedBy: PersonId;
  channel: 'pet' | 'console' | 'feishu_card' | 'cli';
  decidedAt: Timestamp;
}

interface ActionService {
  create(capabilityId: CapabilityId, draft: ProposalDraft, origin: Actor): ProposalId;
  list(filter: { status?: ProposalStatus[]; limit?: number }): Proposal[];
  preview(id: ProposalId, optionId: string, edits?: Record<string, unknown>): Promise<ProposalPreview>;
  decide(decision: Decision): Promise<void>;   // 交互层调用；随后异步执行
}

interface Policy {
  evaluate(step: ActionStep, ctx: { proposal: Proposal; decision: Decision }): 'allow_with_decision' | 'deny';
  // v1 没有 'auto'；要引入无人确认的自动执行，必须有新 ADR
}
```

**决定与预览**：actionHash 覆盖最终参数、工具版本、账号、接收方、前置条件及本地效果。只接受 editable 白名单内编辑，Schema 再校验；编辑后需重新预览。服务器按认证身份填写 decidedBy/时间/渠道，不信任客户端自报。决定以 id 去重并原子比较 pending/revision/hash/有效期；多通道同时点只允许一条生效。批准内容冻结，后续变化新建提议而非修改原步骤。忽略无外呼；稍后本地提醒必须持久化并可取消。

**执行器流程（每一步）**：

1. 读取冻结决定与已持久化步骤；成功步骤不重放。
2. 检查策略、有效期、工具版本与账号；前置条件通过源系统当前只读查询核验，不能仅比较陈旧同步库。
3. 取凭证；不足时持久化 waiting_auth 和 AuthResume。授权完成后重新从第 2 步开始；账号或内容改变要求新决定。
4. 事务写入 started、稳定幂等键与尝试审计，然后外呼。
5. 事务记录结果、终态、结果审计与领域事件。确定失败则停止并显示已成功/未执行步骤；不自动补偿。
6. 超时、断连或重启看到 started 但无结果时进入 waiting_verification，先核验。仅有数据源有效幂等保证或权威未执行证据才重试；否则等待用户核对，不盲重发。

M1 的动作空实现明确返回 feature_unavailable；不接受决定、不假完成。共享等本地写处理器经动作层登记，不伪装成外部 MCP 连接器，也不绕开策略和审计。

### 5.1 审计

```ts
interface AuditRecord {
  id: string; at: Timestamp; actor: Actor;
  kind: 'decision' | 'tool_write' | 'tool_read_content' | 'llm_call' | 'auth' | 'share' | 'config';
  refs: { proposalId?: ProposalId; decisionId?: string; executionId?: string; stepId?: string; entityIds?: EntityId[]; tool?: string; provider?: string };
  summary: string;               // 不含凭证；正文只放摘要或哈希
  outcome: 'started' | 'ok' | 'error' | 'unknown';
  detail?: Record<string, unknown>;
}
```

审计表只能追加，不提供修改和删除的接口。

## 6. 通知与报告（MOD-06 定义；MOD-11 转换成宠物的表达；MOD-08 负责投递）

```ts
interface Notice {
  sensitivity: Sensitivity;
  evidence: EvidenceRef[];
  kind: string;                              // 例如 'time-audit.weekly_ready'，伙伴按 kind 选择动作和台词模板
  title: string;                             // 事实性标题
  facts: Array<{ label: string; value: string | number; unit?: string; ref?: EntityId }>;   // 原样展示，不能被人格改写
  body?: string;                             // 事实性正文，不能包含 secret 级内容
  tone: 'neutral' | 'good_news' | 'concern' | 'care';   // 给伙伴的语气提示
  links?: EntityId[];
  urgency: 'low' | 'normal' | 'high';
  dedupeKey: string;
  channels?: Array<'pet' | 'console' | 'feishu_bot'>;    // 只在用户允许的渠道和披露范围内投递
}

interface Report {
  sensitivity: Sensitivity; evidence: EvidenceRef[];
  id: string; title: string;
  period?: { from: Timestamp; to: Timestamp };
  data: unknown;                             // 结构化数据，存下来
  renderer: string;                          // 交互层按 renderer 找渲染组件，例如 'time-audit/v1'
}
```

投递前过滤整个 title/body/facts/links/台词与报告：继承来源最高敏感度，secret 不进入主动气泡或外发；confidential 遵循用户渠道披露设置。飞书机器人免审批仅限已验证绑定本人且符合设置的通知，默认关闭跨渠道自动回退；离线时先存本机，不能偷偷把工作内容转发到飞书。人格事实部分使用结构化原文，台词也按相同敏感度处理。

## 7. 模型网关（MOD-05）

```ts
interface LlmGateway {
  complete(req: {
    purpose: string;                       // 'time-audit.classify' 之类，用于审计和预算
    tier: 'fast' | 'smart';                // 映射到 LiteLLM 里的模型名，可以配置
    system?: string;
    input: LlmInput[];
    schema?: JsonSchema;                   // 有就做结构化输出并校验，失败自动重试一次
    maxOutputTokens?: number;
    tools?: ToolDefinition[];
    signal?: AbortSignal;
  }): Promise<LlmResult>;
}

type LlmInput =
  | { kind: 'instruction'; text: string }                                 // 可信：来自代码或用户
  | { kind: 'entities'; ids: EntityId[]; fields: Array<'title' | 'time' | 'participants' | 'content'> }
  | { kind: 'data'; label: string; value: unknown; evidence: EvidenceRef[]; sensitivity: Sensitivity }
  | { kind: 'tool_result'; id: string }
  | { kind: 'memory'; ids: string[] };
```

网关负责：
- **把实体渲染成模型输入**：按敏感度过滤，`secret` 一律不发，`confidential` 要看用户设置；
- **把外部内容包在“不可信数据”分隔块里**；
- **写调用审计**：用途、实体 id、token 用量，默认不记录全文；
- **控制预算**：按天、按能力限额。

能力不能把实体、记忆或工具正文塞入 system/instruction/data 冒充可信内容；直接内容使用引用类型，聚合 data 保留依据且不得低于原始敏感度。网关从受信 Reader 解析实体/记忆/工具结果、校验范围与时效，再统一过滤；来源缺失的外部内容拒绝入模。secret 不因来自 profile 而例外。原始 SDK 回包、system 和工具描述不得夹入未批准的外部提示。

M2 的对话助理由 MOD-06 能力实现多轮规划循环，MOD-05 只返回 ToolInvocation，不执行工具。只读调用经声明范围内的 ctx.tools，结果作为 tool_result 输入；写调用只生成提议。每轮验证参数、调用额度、取消信号及预算，循环有上限。普通能力无 MemoryWriter；“记住/编辑/忘记”由已认证对话入口验证用户证据后调用记忆服务。

## 8. 记忆（MOD-09，M2 实现；M1 先提供空实现）

存储格式见 ADR-0013：以 `data/companion/` 下的 Markdown 文件为准，SQLite 只做索引。

```ts
type MemoryLayer = 'profile' | 'long_term' | 'journal';   // 分别对应 user.md、memory.md、journal/*.md
type MemoryOrigin =
  | { kind: 'user'; evidenceId: string; evidenceType: 'message' | 'decision' | 'local_edit' }
  | { kind: 'consolidation'; runId: string; evidence: EvidenceRef[] }
  | { kind: 'companion'; evidence: EvidenceRef[] }
  | { kind: 'external'; entityIds: EntityId[] };      // 根据外部内容得出

interface MemoryItem {
  id: string;
  layer: MemoryLayer;
  kind: 'rule' | 'fact' | 'episode';     // rule = 要怎么做（只能来自用户）；fact = 是什么；episode = 发生过什么
  text: string;
  about?: Array<EntityId | PersonId>;    // 关联的实体或人员
  origin: MemoryOrigin;
  sensitivity: Sensitivity;
  createdAt: Timestamp;
  validUntil?: Timestamp;                // 有时效的记忆，例如“这周三之前别安排会”
  file: string; line?: number;           // 在 Markdown 文件里的位置
}

interface MemoryReader {
  profile(): MemoryItem[];                                   // 注入前仍须网关过滤、限长与有效期检查
  longTerm(opts?: { about?: Array<EntityId | PersonId>; limit?: number }): MemoryItem[];
  search(query: string, opts?: { layers?: MemoryLayer[]; limit?: number }): MemoryItem[];
  feedback(capabilityId: CapabilityId, dedupeKeyPrefix?: string): DecisionStat[];   // 过去的提议被采纳还是被忽略
}

interface MemoryWriter {        // 只有伙伴层、对话助理、夜间整理能拿到；普通能力拿不到
  remember(item: Omit<MemoryItem, 'id' | 'createdAt' | 'file' | 'line'>): MemoryItem;
  update(id: string, patch: { text?: string; sensitivity?: Sensitivity; validUntil?: Timestamp }, by: Actor, evidenceId: string): MemoryItem;
  appendJournal(date: string, item: { text: string; about?: Array<EntityId | PersonId>; origin: MemoryOrigin; sensitivity: Sensitivity }): void;
  forget(id: string, by: Actor): void;
}
```

**规则**：rule 只接受 user 来源，evidenceId 必须能关联到已认证本人消息、决定或本机手动编辑；调用者自行声明 user 不够。整理和日记保存原始依据链、继承最高敏感度，外部/整理来源只能为 fact/episode，不能借多次整理变成规则。外部派生内容视为未核实事实并保留来源，不自动获得可信指令地位。

修改/删除需用户证据，忘记同步删除正文、索引和向量；追加无正文墓碑阻止历史整理重新生成同条已忘信息。备份保留和审计中无正文引用的处理要明确告知，不能承诺无痕删除已有离线备份。文件原子写入，索引可重建；多进程并发和手改冲突由 MOD-09 设计，不直接覆盖用户修改。

## 9. 共享（MOD-10，M4 实现，先保留语义）

- 发布：`ActionStep{ tool: 'sharing.publish', args: { entityIds | resource, spaceId } }`，和其他写操作一样必须有决定。
- 撤回：`sharing.unpublish`，同样要有决定。
- 别人的请求进来：创建提议，`origin = { kind: 'remote', ... }`，选项由本人节点的能力生成，**不会自动执行**。
- 共享进来的实体：`owner` 是对方，`visibility` 是对应的 space，只读。

## 10. 伙伴（MOD-11）

### 10.1 人格档案 `data/companion/persona.md`

文件开头是 YAML 元数据，后面是自由描述的 Markdown：

```ts
interface Persona {
  formatVersion: 1;
  name: string;                       // 用户起的名字
  skin: string;                       // 形象皮肤 id，由宠物客户端提供
  addressUser: string;                // 怎么称呼用户，例如“老板”“小王”
  traits: string[];                   // 性格关键词，例如 ['毒舌', '靠谱', '爱操心']
  speakingStyle: { verbosity: 'terse' | 'normal' | 'chatty'; emoji: boolean; formality: 'casual' | 'neutral' };
  catchphrases: string[];             // 口头禅
  taboos: string[];                   // 不许说、不许开的玩笑
  description: string;                // Markdown 正文：自由描述它是谁、它和用户的关系
}
```

修改人格的途径只有两个：用户编辑（控制台或对话）、伙伴的提议经用户决定。伙伴不能自己改。

### 10.2 宠物状态与表达

```ts
type PetActivity =
  | 'idle' | 'sleeping'            // 下班时间、深夜
  | 'working'                      // 正在同步或运行能力
  | 'alert'                        // 有待决定的提议，或者有重要通知
  | 'waiting_auth'                 // 有等待授权的事项
  | 'happy' | 'concerned' | 'caring'
  | 'quiet'                        // 安静模式：开会、共享屏幕、全屏演示
  | 'offline';                     // 大脑没在运行（由客户端自己判断）

interface PetState {
  activity: PetActivity;
  badge: { proposals: number; notices: number; authRequests: number };
  quietReasons: QuietReason[];
  expression?: { activityId: string; animationId: string; startedAt: Timestamp };
  audio: { enabled: boolean; playing: boolean; volume: number };
  growth: GrowthSnapshot;
  updatedAt: Timestamp;
}

type QuietReason = 'meeting' | 'screen_share' | 'fullscreen' | 'user_dnd';
interface QuietSignal { source: 'calendar' | 'client' | 'user'; reasons: QuietReason[]; detection: 'known' | 'unknown'; expiresAt?: Timestamp }

interface PetUtterance {
  sensitivity: Sensitivity;
  id: string;
  text: string;                    // 人格包装后的话
  facts?: Notice['facts'];         // 原样展示的事实卡片
  animation?: string;              // 建议动作，客户端没有就用默认动作
  ref?: { noticeId?: string; proposalId?: ProposalId; reportId?: string };
  quickActions?: Array<{ label: string; decision?: { proposalId: ProposalId; optionId: string }; open?: 'proposal' | 'report' | 'chat' }>;
  expiresAt?: Timestamp;
}

interface GrowthSnapshot {         // Q8：真实成长 + 轻度养成，具体规则由 MOD-11 设计；字段允许增加
  level: number;
  stats: Record<string, number>;   // 例如 默契、见识、陪伴天数
  unlocked: string[];              // 解锁的动作或皮肤
}
```

### 10.3 伙伴服务（供交互层调用）

```ts
interface CompanionService {
  state(): PetState;
  persona(): Persona;
  updatePersona(patch: Partial<Persona>, by: Actor): Persona;          // by 必须是用户，写审计
  onInteraction(e: PetInteraction): Promise<PetUtterance | null>;      // 鼠标交互：摸头、拖动、戳一下……
  chat(message: string, conversationId?: string): AsyncIterable<ChatChunk>;   // 转给对话助理能力
  setQuiet(signal: QuietSignal): void;
  setAudio(settings: { enabled: boolean; volume: number }, by: Actor): void;
}

type PetInteraction =
  | { kind: 'click' } | { kind: 'double_click' } | { kind: 'pet' }     // 摸头
  | { kind: 'drag_start' } | { kind: 'drop'; screenEdge?: 'left' | 'right' | 'top' | 'bottom' }
  | { kind: 'hover' } | { kind: 'poke'; times: number }
  | { kind: 'feed' } | { kind: 'play'; activityId: string }
  | { kind: 'audio_pause' }
  | { kind: 'utterance_dismissed'; id: string };
```

工作状态 PetActivity 与皮肤动作 id 分离；新增自娱动作不用改办公状态枚举。自主活动注册只含本机视觉与已启用音频，不能携带任意工具调用。QuietSignal 按来源合并，清除客户端信号不能清掉用户勿扰；临时系统信号有租约，过期变 unknown 而不是擅自认定无共享。unknown 显示检测限制并提供显式演示模式；用户启用保护模式时可直接隐藏团子。真实音频启用需用户操作，quiet/隐藏策略立即停止，不把 disabled 改回 true。

## 11. 本地接口与事件推送（MOD-08 实现）

- 业务接口在 `http://127.0.0.1:8787/api/v1/` 下，用 JSON；OAuth 回调单独列入 allowlist，校验一次性 state/PKCE/issuer，不要求 Bearer，但不能访问业务资源。
- **认证**：
  - 宠物客户端和命令行用本机令牌：后台进程首次启动时生成随机令牌，存进系统凭证库（macOS 钥匙串 / Windows 凭据管理器），请求头带 `Authorization: Bearer`；
  - 浏览器控制台用一次性登录码换取同源会话 Cookie（命令行打开控制台时附带登录码）；
  - 仍校验 Host 与明确的浏览器/Tauri Origin allowlist；Cookie 会话需要 SameSite/CSRF 防护，令牌不得进URL、日志、前端持久化；登录码一次性短有效期，用后从地址栏清除。
- **事件推送**：`GET /api/v1/stream`（Server-Sent Events），推送 `pet.state`、`pet.utterance`、`proposal.*`、`auth.request`、`report.published`。客户端断开重连时带上 `Last-Event-ID` 续传。
- 接口清单由 MOD-08 设计列出，必须只调用 `CompanionService`、`ActionService`、`WorkGraphReader`、`MemoryReader/Writer`、`AuthBroker` 这些已定义的接口。

## 12. 扩展登记边界

```ts
interface EntitySchemaSpec { type: EntityType; version: number; attrsSchema: JsonSchema }
interface EntitySchemaRegistry { register(spec: EntitySchemaSpec): void; get(type: EntityType, version: number): EntitySchemaSpec | undefined }

interface ProviderGrant { credential: Credential; refreshToken?: string; issuer?: string }
interface AuthProvider {
  id: string;
  kind: 'oauth2' | 'token' | 'none';
  grantUrl(req: { state: string; challenge: string; redirectUri: string; scopes: string[]; expectedAccount?: string }): string;
  exchange(req: { code: string; verifier: string; redirectUri: string }): Promise<ProviderGrant>;
  refresh(refreshToken: string): Promise<ProviderGrant>;
}
interface AuthProviderRegistry { register(provider: AuthProvider): void; get(id: string): AuthProvider | undefined }
interface CapabilityRegistry { register(capability: Capability): void; disable(id: CapabilityId): void }
interface ReportRenderer { id: string; dataSchema: JsonSchema; render(report: Report): string }
interface ReportRendererRegistry { register(renderer: ReportRenderer): void }

interface SkinManifest {
  id: string; formatVersion: 1; version: string;
  assets: Array<{ path: string; sha256: string; mediaType: string }>;
  anchor: { x: number; y: number };          // 归一化坐标，窗口边停靠的身体基准
  hitAreas: Array<{ x: number; y: number; width: number; height: number }>;
  animations: Record<string, string[]>;    // 动作 id → 本包素材路径，细节由 MOD-12 Schema 定义
  semanticMap: Partial<Record<PetActivity, string>>;
  activities: Array<{ id: string; animationId: string; minIntervalMs: number; audioAsset?: string }>;
}
interface SkinRegistry { register(skin: SkinManifest): void; get(id: string): SkinManifest | undefined }
interface WindowAnchor {
  kind: 'window_edge' | 'desktop_edge';
  screenId: string; windowHandle?: string; edge: 'left' | 'right' | 'top' | 'bottom'; offset: number;
}
```

- Schema/AuthProvider/Capability/Renderer/Skin 注册分别属于 MOD-02/03/06/08/12；启动组合根执行显式登记，统一 id 与版本冲突检查，v1 不做远程任意代码热加载。
- 内置类型按 §2.2，扩展类型命名空间与 Schema 先经总架构师批准；旧版本迁移不能通过登记覆盖实现。共享仅在支持对应 Schema 时导入，不理解的资源标不支持。
- OAuth 实现由受信适配器注入，token/none 不调用 grantUrl/exchange；MOD-03 校验允许端点、issuer、账号和 scopes，refreshToken 只存 SecretStore。provider 的回包不是授权证据，需 host 校验后才生效。
- Renderer 是受信本机实现，动态事实需转义，不直接渲染来源HTML或执行脚本；未知 renderer 以受过滤的结构化数据视图显示。插件自己声明只读或 renderer 不是安全许可。
- Skin 是纯素材/清单，没有脚本/可执行文件或远程资源；路径限制在包内，校验大小、格式与哈希，不容许穿越目录。音频仅用有许可的素材或用户明确选择的文件。
- WindowAnchor 属于客户端平台层，windowHandle 仅本机临时标识，不上传或记忆化窗口内容；跨屏/DPI、窗口销毁需重新校验。平台信号与能力可用性由 MOD-12 提供本地探针，工作后端不枚举窗口。
- 产品统计只记录决定/执行/通知时间与计数，与中央不可变审计分离并可清除；测量细则见 acceptance.md。

## 变更记录

- v1-草案（2026-11-18）：初稿。
- v1-评审修正版（2026-11-19）：ADR-0016/0017；补公共接口、审批冻结、窗口快照、结果未知、数据来源出口检查、记忆证据、M2 对话与编辑、多源安静模式、皮肤与扩展注册。
- v1-草案（2026-11-18）：根据 ADR-0012、ADR-0013 新增第 8 节（记忆完整接口）、第 10 节（伙伴）、第 11 节（本地接口）；`Notice` 改成事实和语气分开；`CapabilityContext.memory` 改为必有。
