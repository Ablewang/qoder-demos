# 跨模块接口 v1

- 状态：待评审
- 版本：v1-草案
- 更新：2026-11-18

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
  entities: Entity[];
  relations: Relation[];         // 由 from 对应的实体负责；同一批里整体替换
  identities: Entity<'identity'>[];
  deletions: EntityId[];
  window?: { from: Timestamp; to: Timestamp };   // 按窗口同步时，窗口内没出现的实体视为已删除
  nextCursor: string | null;
}

interface WorkGraphWriter {           // 只有同步引擎能拿到
  applySync(batch: SyncBatch, cursorCommit: (tx: Tx) => void): ApplyResult;   // 和游标推进放在同一事务里
}

interface WorkGraphReader {           // 能力、交互层能拿到
  get(id: EntityId, owner?: PersonId): Entity | undefined;
  query(q: EntityQuery): Entity[];
  related(id: EntityId, opts?: { kind?: RelationKind; direction?: 'out' | 'in' }): Array<{ relation: Relation; entity?: Entity }>;
  search(text: string, opts?: { types?: EntityType[]; limit?: number }): Entity[];   // FTS5 trigram
  content(id: EntityId): string | undefined;      // 读正文会写审计
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

**身份解析规则（v1）**：先按邮箱精确匹配；飞书优先用 `union_id`（`open_id` 只在单个应用内有效，不能跨应用）；匹配不上就建 `person:local:*`；用户可以在控制台手动合并，合并记录保存下来，重新同步时不会丢。

## 3. 连接器：MCP 扩展 `work-agent/connector` v1（MOD-03 / MOD-04）

目标协议版本是 MCP 2026-07-28（无会话）。

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
  idempotent: boolean;
}
```

MCP 的工具注解（如 `readOnlyHint`）应该和 `kind` 保持一致；但**宿主只认清单里的 `kind`**，不认注解。

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
- 用同一个游标重复拉取，结果必须一样（幂等），方便失败重试。
- 输出里的 `owner` 由宿主填写，连接器填一个占位值即可。

### 3.3 写工具约定

- 输入可以带 `dryRun: true`：只返回预览 `{ preview: { summary, recipients?, body?, target } }`，不产生副作用。
- 输入必须带 `idempotencyKey`：连接器要尽量借助数据源本身的幂等能力（如飞书的 `uuid` 参数）去重。
- 执行成功返回 `{ ref: { entityId?, nativeUrl? } }`，用于核对结果和写审计。

### 3.4 凭证传递

宿主每次 `tools/call` 都在 `_meta["work-agent/credential"]` 里放：

```ts
{ accessToken: string; expiresAt: Timestamp; account: string }
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
  | { code: 'upstream_error'; status?: number; detail: string; retryable: boolean };
```

### 3.6 宿主侧接口（MOD-03 对内提供）

```ts
interface ConnectorHost {
  list(): ConnectorInfo[];                          // 清单 + 授权状态 + 健康状态
  tool(qualifiedName: string): ToolSpec & { source: SourceId; thirdParty: boolean };
  callRead(qualifiedName: string, args: unknown, actor: Actor): Promise<unknown>;
  callWrite(qualifiedName: string, args: unknown, ctx: { executionId: string; actor: Actor }): Promise<unknown>;  // 只有执行器能拿到
}

interface AuthBroker {
  status(provider: string): { granted: boolean; account?: string; scopes: string[] };
  credential(provider: string, scopes: string[]): Promise<Credential>;   // 权限不够时抛出 AuthRequiredError
  requestGrant(req: { provider: string; scopes: string[]; reason: string; requestedBy: Actor; resume?: string }): AuthRequest;
  completeGrant(state: string, code: string): Promise<void>;           // OAuth 回调
  revoke(provider: string): Promise<void>;                              // 删除凭证；视为一次决定，写审计
}
```

第三方 MCP 服务器：工具一律按 `kind: 'write', risk: 'high'` 处理；用户在控制台把某个工具标为只读后才按只读处理。

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
  | { kind: 'intent'; description: string };     // 给对话助理路由用（M3）

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
  tools: { callRead(name: string, args: unknown): Promise<unknown> };   // 只能调用清单里声明过的只读工具
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
  | { type: 'auth.granted' | 'auth.revoked'; provider: string }
  | { type: 'remote.request'; requestId: string };   // M4

interface EventBus {
  publish(e: DomainEvent): void;          // 先持久化，再投递
  subscribe(filter: EventFilter, handler: (e: DomainEvent) => Promise<void>): Unsubscribe;
}
```

投递语义是**至少一次**，处理器必须能承受重复投递（幂等）。

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
  dedupeKey: string;                        // 同一个能力下 dedupeKey 相同、尚未结束的提议不会重复创建，只会更新
}

interface ProposalOption {
  id: string;
  label: string;
  steps: ActionStep[];                      // 可以为空：例如“明早提醒我”只在内部登记，不对外写入
  editable?: EditableField[];               // 用户可以在决定前修改的字段，例如回复正文
}

interface ActionStep {
  tool: string;                             // 写工具全名，例如 'feishu.send_message'
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
  | 'succeeded' | 'failed' | 'partially_failed';

interface Decision {
  proposalId: ProposalId;
  optionId: string;                         // 选“忽略”也是一个决定
  edits?: Record<string, unknown>;          // 以 EditableField.path 为键
  decidedBy: PersonId;
  channel: 'console' | 'feishu_card' | 'cli';
  decidedAt: Timestamp;
}

interface ActionService {
  create(capabilityId: CapabilityId, draft: ProposalDraft, origin: Actor): ProposalId;
  list(filter: { status?: ProposalStatus[]; limit?: number }): Proposal[];
  preview(id: ProposalId, optionId: string, edits?: Record<string, unknown>): Promise<StepPreview[]>;  // 调用 dryRun；不支持预演的工具由宿主根据参数生成预览
  decide(decision: Decision): Promise<void>;   // 交互层调用；随后异步执行
}

interface Policy {
  evaluate(step: ActionStep, ctx: { proposal: Proposal; decision: Decision }): 'allow_with_decision' | 'deny';
  // v1 没有 'auto'；要引入无人确认的自动执行，必须有新 ADR
}
```

**执行器流程（每一步）**：

1. 检查策略。
2. 重新检查前置条件；不满足就把提议标为失败，原因是 `conflict`，提示用户重新看。
3. 取凭证；遇到 `AuthRequiredError` 就把状态改为 `waiting_auth`，调用 `requestGrant`，等收到 `auth.granted` 后从这一步继续。
4. `callWrite`。
5. 写审计。

每一步都失败即停；v1 不做自动补偿（回滚）。

### 5.1 审计

```ts
interface AuditRecord {
  id: string; at: Timestamp; actor: Actor;
  kind: 'decision' | 'tool_write' | 'tool_read_content' | 'llm_call' | 'auth' | 'share' | 'config';
  refs: { proposalId?: ProposalId; entityIds?: EntityId[]; tool?: string; provider?: string };
  summary: string;               // 不含凭证；正文只放摘要或哈希
  outcome: 'ok' | 'error';
  detail?: Record<string, unknown>;
}
```

审计表只能追加，不提供修改和删除的接口。

## 6. 通知与报告（MOD-06 定义；MOD-11 转换成宠物的表达；MOD-08 负责投递）

```ts
interface Notice {
  kind: string;                              // 例如 'time-audit.weekly_ready'，伙伴按 kind 选择动作和台词模板
  title: string;                             // 事实性标题
  facts: Array<{ label: string; value: string | number; unit?: string; ref?: EntityId }>;   // 原样展示，不能被人格改写
  body?: string;                             // 事实性正文，不能包含 secret 级内容
  tone: 'neutral' | 'good_news' | 'concern' | 'care';   // 给伙伴的语气提示
  links?: EntityId[];
  urgency: 'low' | 'normal' | 'high';
  dedupeKey: string;
  channels?: Array<'pet' | 'console' | 'feishu_bot'>;    // 默认由用户设置决定；宠物没在运行时退回到飞书
}

interface Report {
  id: string; title: string;
  period?: { from: Timestamp; to: Timestamp };
  data: unknown;                             // 结构化数据，存下来
  renderer: string;                          // 交互层按 renderer 找渲染组件，例如 'time-audit/v1'
}
```

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
  }): Promise<{ text: string; json?: unknown; usage: { inputTokens: number; outputTokens: number } }>;

  // 对话助理（M3）：多轮工具调用；写工具的调用不会执行，而是返回给调用方去创建提议
  runTools?(req: unknown): Promise<unknown>;
}

type LlmInput =
  | { kind: 'instruction'; text: string }                                 // 可信：来自代码或用户
  | { kind: 'entities'; ids: EntityId[]; fields: Array<'title' | 'time' | 'participants' | 'content'> }
  | { kind: 'data'; label: string; value: unknown };                     // 聚合数据
```

网关负责：
- **把实体渲染成模型输入**：按敏感度过滤，`secret` 一律不发，`confidential` 要看用户设置；
- **把外部内容包在“不可信数据”分隔块里**；
- **写调用审计**：用途、实体 id、token 用量，默认不记录全文；
- **控制预算**：按天、按能力限额。

能力**不能**把实体正文自己拼成字符串交给网关，只能用 `entities` 输入。

## 8. 记忆（MOD-09，M2 实现；M1 先提供空实现）

存储格式见 ADR-0013：以 `data/companion/` 下的 Markdown 文件为准，SQLite 只做索引。

```ts
type MemoryLayer = 'profile' | 'long_term' | 'journal';   // 分别对应 user.md、memory.md、journal/*.md
type MemoryOrigin =
  | { kind: 'user' }                                  // 用户亲口说的或手动写的
  | { kind: 'consolidation'; runId: string }          // 夜间整理
  | { kind: 'companion' }                             // 伙伴写的日记
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
  profile(): MemoryItem[];                                   // 画像里的规则和偏好；对话时全部注入
  longTerm(opts?: { about?: Array<EntityId | PersonId>; limit?: number }): MemoryItem[];
  search(query: string, opts?: { layers?: MemoryLayer[]; limit?: number }): MemoryItem[];
  feedback(capabilityId: CapabilityId, dedupeKeyPrefix?: string): DecisionStat[];   // 过去的提议被采纳还是被忽略
}

interface MemoryWriter {        // 只有伙伴层、对话助理、夜间整理能拿到；普通能力拿不到
  remember(item: Omit<MemoryItem, 'id' | 'createdAt' | 'file' | 'line'>): MemoryItem;
  appendJournal(date: string, text: string, about?: Array<EntityId | PersonId>): void;
  forget(id: string): void;                                  // 文件、索引、向量一起删除，并写审计
}
```

**规则**：`kind = 'rule'` 的记忆，`origin` 必须是 `user`，或者来自用户决定过的提议（例如“要不要把‘周五下午不排会’记成规则？”）。来源为 `external` 的只能是 `fact` 或 `episode`。

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
  quietReason?: 'meeting' | 'screen_share' | 'fullscreen' | 'user_dnd';
  growth: GrowthSnapshot;
  updatedAt: Timestamp;
}

interface PetUtterance {           // 宠物要说的一句话
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
  setQuiet(reason: PetState['quietReason'] | null): void;             // 客户端检测到共享屏幕或全屏时上报
}

type PetInteraction =
  | { kind: 'click' } | { kind: 'double_click' } | { kind: 'pet' }     // 摸头
  | { kind: 'drag_start' } | { kind: 'drop'; screenEdge?: 'left' | 'right' | 'top' | 'bottom' }
  | { kind: 'hover' } | { kind: 'poke'; times: number }
  | { kind: 'utterance_dismissed'; id: string };
```

## 11. 本地接口与事件推送（MOD-08 实现）

- 所有接口都在 `http://127.0.0.1:8787/api/v1/` 下，只能用 JSON。
- **认证**：
  - 宠物客户端和命令行用本机令牌：后台进程首次启动时生成随机令牌，存进系统凭证库（macOS 钥匙串 / Windows 凭据管理器），请求头带 `Authorization: Bearer`；
  - 浏览器控制台用一次性登录码换取同源会话 Cookie（命令行打开控制台时附带登录码）；
  - 另外仍然校验 Host 和 Origin。
- **事件推送**：`GET /api/v1/stream`（Server-Sent Events），推送 `pet.state`、`pet.utterance`、`proposal.*`、`auth.request`、`report.published`。客户端断开重连时带上 `Last-Event-ID` 续传。
- 接口清单由 MOD-08 设计列出，必须只调用 `CompanionService`、`ActionService`、`WorkGraphReader`、`MemoryReader/Writer`、`AuthBroker` 这些已定义的接口。

## 变更记录

- v1-草案（2026-11-18）：初稿。
- v1-草案（2026-11-18）：根据 ADR-0012、ADR-0013 新增第 8 节（记忆完整接口）、第 10 节（伙伴）、第 11 节（本地接口）；`Notice` 改成事实和语气分开；`CapabilityContext.memory` 改为必有。
