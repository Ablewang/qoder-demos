# 模块：MOD-07 动作层

- 状态：待复评（R07-01–03 设计修订已满足；新增 R07-04 定向修订待复评；公共契约未闭环，未批准实施）
- 负责会话：MOD-07 动作层详细设计会话
- 依据的架构版本：architecture v1（2026-11-19 冻结）；接口以 contracts §5 为准
- 相关 ADR：0007、0009、0016、0017
- 更新：2026-11-19（R07-04 定向修订）
- 评审依据：[MOD-07 首轮评审](../reviews/2026-11-19-module-design-batch1.md#mod-07-首轮详细设计评审)、[首轮修订复评](../reviews/2026-11-19-module-design-batch1.md#mod-07-首轮修订复评)、[Q13 统一裁决](../open-questions.md#q13-第一批详细设计接口协调)
- 交付性质：仅详细设计修订；未实现、未运行授权或外部动作，未验证厂商幂等保证；待主会话复评，不自评通过

## 1. 目标与范围

### 1.1 目标

为 macOS 与 Windows 上的团子办公伙伴提供可追溯的“查背景 → 起草 → 完整预览 → 用户决定 → 按需授权 → 逐步执行 → 核验结果”动作闭环。LiteLLM 只参与上层规划，动作层不调用模型；飞书、Gmail、GitLab 的外部写入均通过连接器宿主的 MCP 写工具执行。

每次外部写入必须有本人决定、冻结参数、当前源系统前置条件核验、先于外呼的持久化尝试，以及结果或未知状态。授权只恢复原决定，不产生新业务批准。未知结果不伪装失败或成功，成功步骤不重放，部分成功不自动补偿。不承诺通用 exactly-once。

### 1.2 范围与非目标

| 纳入 | 不纳入 |
|---|---|
| Proposal、完整预览、编辑白名单、Decision、Policy、执行器、恢复、结果核验、本地稍后提醒 | 模型规划循环、工作图谱同步、OAuth/PAT 实现、凭证管理、MCP 进程管理 |
| 只写 `act_`；调用 MOD-01 AuditWriter 追加中央审计 | 创建、修改、删除 `audit_`；直接写其他模块表或读取 SecretStore |
| M4 内部写处理器的受信登记与执行边界设计 | M4 共享实现、任意脚本、远程插件市场或热加载 |
| 无正文、可清除的产品统计设计及真实省时验证 | 把审计当产品统计、用采纳率/发送量/动画量冒充省时 |
| 基于既定服务的本机、控制台、CLI、飞书卡片决定 | 新建会话/Team、配置/权限改动、未经用户决定的自动执行 |

宠物养成、自娱、皮肤与执行策略无依赖：等级、亲密度、喂食、是否在线均不能阻止办公能力或放宽审批。通知投递仍服从隐私、安静模式和用户渠道设置。

### 1.3 里程碑边界

- **M1**：ActionService 提供明确不可用实现。create、preview、decide 返回/抛出结构化 `feature_unavailable`，不落决定、执行或完成事件；list 可返回空集，不代表曾执行成功。MOD-08/06 需按第 8 节协调错误映射，不把不可用变成空预览、假提议或绿色完成。M1 的摸头、玩耍、用户开启音频属于既定本地交互，不走假的办公执行器。
- **M2**：完整提议、编辑预览、认证决定、外部动作、按需授权、未知恢复、部分成功、本地提醒以及安全审计；至少完成一条真实任务并测量省时。依赖接口缺口必须先闭环，不能把设计稿当完成证据。
- **M4**：只允许已登记受信内部写处理器接入；他人的请求只能产生本人的提议，不继承他人的批准。按 Q13，U07-09 后置至 MOD-10 设计后的 M4 专项协调，不提前扩成通用插件执行器，不阻塞 M1/M2 的无共享范围。

## 2. 对外接口

### 2.1 实现和使用的冻结接口

| 角色 | 已定义接口 | 边界 |
|---|---|---|
| 对能力提供创建提议 | ActionService.create；MOD-06 将 ctx.propose 绑定 capabilityId/runId/origin | 本模块不相信模型自报能力、本人身份、权限或来源 |
| 对 MOD-08 提供查询、预览、决定 | ActionService.list/preview/decide、ProposalPreview、Decision | MOD-08 唯一决定入口，认证及渠道验证在入口完成；服务不向模型或其他插件暴露 decide |
| 内部策略 | Policy.evaluate | 仅 `allow_with_decision` / `deny`，没有 auto；允许并不等于已有 scopes |
| 存储、审计 | StorageService、Tx、AuditWriter、Logger | 同步事务，网络调用在事务外；中央审计所有权归 MOD-01 |
| 工具、账号、授权 | ConnectorHost.list/tool/callRead/callWrite；受信装配仅绑定已有 AuthBroker.status/requestGrant | callWrite 只注入执行器；执行器不获完整 AuthBroker、credential 方法或 SecretStore，不接收含 token 的 Credential；秘密操作只在宿主受信认证适配器 |
| 当前依据读取 | WorkGraphReader、ToolResultReader | 图谱仅用于来源和定位，不能代替源系统当前核验；只读结果按宿主来源与敏感度处理 |
| 业务事件 | EventBus.publish/subscribe、EventEnvelope、DomainEvent | 业务提交、审计、事件 outbox 同事务；至少一次，持久化消费去重 |

本模块不定义新的公共 TypeScript 接口，不私自修改 contracts。下文的快照、表和辅助器是模块内部设计；任何需要其他模块提供的新能力都列在第 8 节，未批准前 fail closed。

执行器的运行时依赖必须使 credential 能力及原 Broker 不可达；不是给完整对象套 Omit 或类型断言。AuthBroker.status.granted 与 ConnectorInfo.authorized 仅可作为展示线索，不能证明当前凭证有效、所需 scopes 可用或授权代际仍匹配。经宿主核验的非秘密当前账号/scopes/授权状态、有效性与代际边界尚待 U07-05、MOD-03 Q06/Q10 统一；动作层不得用 credential 弥补缺口，相关准备/恢复路径未闭环即 fail closed。非秘密结果须由宿主新建受限白名单载体，不能传 Credential 原对象、携密嵌套引用或先传完整对象再删字段；载体及装配证据未批准，不私造替代公共接口。

### 2.2 入口身份与认证决定

1. MOD-08 校验本机令牌、同源会话/CSRF、Host/Origin；飞书卡片校验回调真实性、一次性绑定与发送到已绑定本人的身份。团子气泡的 quickActions 只是选项入口，不是完整预览证据。
2. MOD-08 根据受信认证上下文填入 `decidedBy`、`decidedAt`、`channel`，不透传客户端自报字段；动作层只接受可信入口构造的 Decision，并核对决定人是本机主人。远程 Actor 只能是 Proposal.origin，不能成为 decidedBy。
3. 用户请求提供 proposalId、revision、optionId、actionHash、edits 与请求去重 id；通道不得接受模型或外部消息中的“我已批准”标记。飞书不能只凭显示名/邮箱字符串推断本人。
4. list、preview、decide 的暴露范围都由受信组合根绑定本人、渠道和调用权限，list 也不能泄露其他 owner 或不允许渠道的提议内容。actionHash 不是 bearer token，不授予读取或执行权限；跨通道展示需重新校验披露设置。
5. 按 Q13，可信认证与入口隔离已是冻结契约强制语义，U07-01 需要受信组合和契约测试证据，不是另造一套可自报身份接口。优先由 MOD-01/08/07 在受信组合根绑定，不能给普通能力开放 decide、相信传入 PersonId 或为所有调用添加可伪造 Actor 参数；本稿不改 ActionService 签名。

### 2.3 完整预览语义

ProposalPreview 必须一一对应即将冻结的动作，而非一份可爱摘要。每一步展示：连接实例/厂商、目标账号、工具及登记版本、目标位置、完整 To/Cc/Bcc/群/成员/线程等实际接收方、全文及标题、所有可能产生副作用的参数、附件/引用的确定身份与内容摘要哈希、前置条件说明。还要展示步骤顺序、本地效果、有效期、缺权限状态和“部分成功不自动回滚”。

- `StepPreview.args` 包含完整最终参数及预览前已物化的权威 `args.idempotencyKey`，必须与对应 `ActionStep.idempotencyKey` 相等；键不可编辑。`body` / `recipients` / `target` 是确定性派生展示，不是另外一套可修改数据。工具版本、前置条件等现有类型未单列的信息可在面板从本机快照展示，但跨模块投递字段的补足见 U07-02/U07-07。
- 长正文可滚动阅读，但确认前必须能访问全文；不以“查看摘要”代替。富文本动态事实转义，不执行来源 HTML；不能仅靠聊天历史中曾显示过的草稿确认。
- 必填的目标、接收方、正文或其他效果无法确定时拒绝预览/决定，不显示“系统稍后自动选择”。账号别名、动态默认接收方、发送时才生成的正文不得混入冻结动作。
- 编辑或工具描述变化后旧预览失效；普通气泡、CLI、卡片空间不足时转到完整面板，不能跳过预览。secret 内容只能在用户主动打开且认证、披露允许的本机视图展示，不主动外发。
- supportsDryRun 只是受信能力声明。批准前不得使用 callWrite，即使 args 带 dryRun。M2 优先由登记的纯预览规则或已登记只读预览工具产生视图；契约缺少这份登记和工具 Schema，见 U07-02。无完整预览的工具不准进入可决定选项。

## 3. 数据模型

### 3.1 数据所有权与内部表

只登记 `moduleId=MOD-07`、前缀 `act_` 的迁移。使用 MOD-01 的数据库、UTC 毫秒及事务服务，不自建第二套审计、凭证或调度数据库。下列名称为本模块内部持久化方案，不是公共接口。

| 表 | 主要字段/约束 | 用途 |
|---|---|---|
| `act_proposals` | id、capability_id、dedupe_key、current_revision、status、created_at、origin_json、effective_decision_id、有效期 | 提议聚合与当前状态；effective_decision_id 一旦设置不得替换 |
| `act_proposal_versions` | `(proposal_id,revision)` 主键；draft_json、来源/敏感度侧记录、工具描述快照、created_at、version_format | 内容只追加；生命周期状态留在聚合，版本内容不被修改 |
| `act_pending_keys` | `(capability_id,dedupe_key)` 唯一，proposal_id；只指向 pending | 并发创建/更新同能力提议的唯一入口；终止或批准时事务删除映射 |
| `act_previews` | preview_id、proposal/revision/option、canonical_edits、action_hash、冻结执行文档、认证主体、catalog_digest、created_at、valid_until | 多个编辑预览可并存；只接受与最终决定完全一致且仍有效的一份 |
| `act_decisions` | id 主键；proposal_id 唯一；revision/hash/option/edits、decided_by/channel/decided_at、request_digest | 生效决定只追加，包括忽略；拒绝的并发请求不成为生效决定 |
| `act_executions` | id；decision_id 唯一；冻结快照引用、phase、next_step、lease_owner、lease_epoch、lease_until、updated_at、failure_reason | 单执行器的可恢复聚合；phase 是内部枚举，不扩展 ProposalStatus |
| `act_steps` | 公共 StepExecution 字段；唯一 `(execution_id,step_index)`；冻结步骤 JSON、工具描述 digest、source/account、首次 started 时间 | 逐步记录；succeeded 不可回退；idempotencyKey 永不在重试时更换 |
| `act_step_attempts` | attempt_id、step_id、attempt_no、lease_epoch、started_at、finished_at、outcome、请求 hash、核验证据引用 | 每次真实外呼先追加 started；旧 unknown attempt 永久保留，不覆盖/删除；后续核验另追加证据 |
| `act_reconciliations` | id、step_id、attempt_id、查询工具/版本、status、authoritative、provider_ref、checked_at、保证期限与证据 digest | 保存 found/not_found/unknown 的判断依据，不保存原始接口回包 |
| `act_auth_links` | execution/step/decision/hash/revision/source/expected_account、request_id、phase、resume_phase、created_at | 恢复绑定；状态镜像不是授权事实，不存 state/PKCE/token |
| `act_local_effects` | id、execution/decision/hash、kind、at、state、cancelled_at、投递去重键 | 稍后提醒持久化、到期、取消；不混成外部 MCP 步骤 |
| `act_consumed_events` | `(subscriber_id,event_id)` 唯一、processed_at、checkpoint | 消费 auth/proposal 等至少一次事件的幂等边界 |
| `act_product_stats` | event_id、epoch、category、at、匿名任务样本 id、duration_ms、counter、measurement_kind | 无正文、无收件人和工具参数；用户可关闭/清除，不参与执行恢复 |
| `act_stats_control` | enabled、generation、cleared_at | 清除后不从审计/outbox 重建旧统计；已排队统计按 generation 丢弃 |

不创建 `act_audit` 或直接运行 `audit_` SQL。审计由 AuditWriter.append(record, tx) 写入 MOD-01 所有的中央表；事件 outbox 由 EventBus.publish(event, tx) 写入 MOD-06 所有的持久化边界，本模块不直接修改其表。

### 3.2 关键约束

- 有效决定、执行与其 actionHash/revision 必须一致；execution 不能无 decision 建立。执行步骤按 stepIndex 连续且来自冻结选项，不在运行时追加模型输出。
- 动作层在预览前生成稳定步骤 id 与权威远端幂等键，在连接实例/账号/工具/冻结步骤范围唯一；原草案若同时给出不相等的 step 键与 args 键先拒绝，不能靠覆盖掩盖冲突。物化阶段不采用能力原给的任一键作为执行键，而是将同一个权威键写入 `ActionStep.idempotencyKey` 和最终 `args.idempotencyKey` 后才进入完整 Schema 校验、预览及冻结。两份键必须存在且严格相等；edits 不可改其中任一份。每次预览、Schema 校验、hash 生成、决定冻结、started 落库和外呼前均校验此不变量；不一致则拒绝/停止而不补字段。callWrite 直接使用该冻结 args，ctx 不新增键字段；同一 frozen step 的每次恢复/重试都复用同键同内容，绝不在发送时补键、换键或带能力给的另一个键。
- 接收方、账号、工具、前置条件、本地效果及参数 JSON 都被冻结；lease、attempt、result 和核验证据不是业务内容，可追加或按受限状态迁移更新。
- result 只保留 WriteResult 允许的引用并校验敏感度/长度；providerId、nativeUrl 不是成功的充分证据，须符合登记的结果核验规则。
- owner、来源与敏感度的可信元信息由宿主/Reader/认证上下文补足，不让草案自行声明 normal 降级。ProposalDraft 仅有 EntityId[]，跨 owner、工具结果及用户输入的来源载体缺口见 U07-07。
- 提议 pending 更新不覆盖旧版本；已批准版本、决定、幂等键和成功标记不能被 dedupe、能力升级或用户编辑改掉。

### 3.3 迁移与恢复

1. 迁移按版本顺序注册、固定 checksum；禁止改已登记历史迁移。涉及冻结文档格式、哈希算法或键语义的不兼容变更需要 ADR 与数据迁移评审，不能原地换算法后继续原决定。
2. 迁移前依 MOD-01 备份。恢复旧数据库可能丢失远端已成功记录，因此恢复后的在途/旧执行进入恢复隔离，只读核验，不根据旧 pending/lease 自动重发。若无法确定恢复边界，所有备份时可能在途的步骤保守处理为未知。
3. 重启时先完成存储/审计/工具目录可用性检查，再扫描 approved、executing、waiting_auth、waiting_verification 和未完成 local effects；pending 到期转 expired。started 无确定结果一律转核验，不等价于未调用。
4. 平台备份恢复信号/实例排他性由 MOD-01 提供设计保证，接口未明确的部分见 U07-08；不以本机操作系统判断或文件锁替代公共平台服务。

## 4. 内部设计

### 4.1 提议版本、去重与有效期

**输入校验**：至少一个用户选项；选项 id 唯一，拒绝与系统忽略 id `__system_ignore__` 冲突；每个选项至少一个 ActionStep 或显式 localEffect。只准系统忽略为空步骤且无本地效果。requiredScopes/risk/工具 Schema/版本来源于受信登记，不由能力填入。id、时间与参数大小按登记约束校验，UTC 时间必须有限安全整数。

**同能力 dedupe**：

1. 在同步事务中查 `(capabilityId,dedupeKey)` 的 pending 映射；先核验当前 pending 的有效期，过期则转 expired、移除映射并追加事件。
2. 若已有 pending：先拒绝双键冲突，再比较业务内容与受信描述，排除动作层生成的 stepId、ActionStep.idempotencyKey、args.idempotencyKey 等身份字段；相同则保留原两份权威键并返回原 id/revision。内容、账号、前置条件或工具登记版本发生实质变化才追加 revision+1，在预览前生成该修订步骤身份并物化相等双键，聚合保持 pending，旧预览/卡片 revision 不再可决定。createdAt 保持首次创建；更新时不悄悄延长原 expiresAt，延长需要一个新的提议。
3. 若旧项已 approved/executing/waiting_auth/终态，不能更新旧项；建立新 proposal id。dedupe 只解决提示更新，不是外部写幂等证明。
4. 同一事项仍有在途或结果未知执行时，新 pending 项明确关联“已有执行待核验”，策略拒绝相同目标/效果的重叠写入，先解决旧执行；用户不能通过换 dedupeKey 绕过未知结果。跨工具是否同一业务效果不能可靠推断时标注冲突并人工核对。
5. create/update 与 decide 竞争由 pending 映射、revision 与事务状态比较串行化：批准先赢则不能改它；更新先赢则旧 revision 决定失败。superseded 仅用于尚无决定的旧提议被显式替代，不用于撤销已批准执行。

每个 pending 修订含不可变 effective expiry。按 Q13，M2 内部默认提议有效期 24 小时、完整预览有效期最长 15 分钟，受信工具可缩短；draft.expiresAt 未填时按此生成权威 expiresAt 并展示/存储。预览有效期不晚于提议有效期，默认数值认可不表示实现或公共接口获批准。

决定事务、每次新的外部尝试、授权恢复均检查原决定 expiry；过期不得产生新外部写入或新安排提醒。已经 started 的结果仍须核验，即便提议过期；核验成功是记录原来发生的事实，不是重新批准。approved 后到期若尚无成功/未解除未知步骤，标 failed 并说明“批准已过有效期”；已有成功则 partially_failed；存在未解除未知则 waiting_verification 优先。

提醒在批准有效期内成功持久化安排后，remind.at 可以晚于该有效期；届时仅投递已批准的本地提醒，不执行额外外部动作，不要求旧批准届时仍有效。混合 steps+remind 只在全部外部步骤核实成功且安排时仍在批准有效期内才登记提醒，详见 §4.11。

### 4.2 编辑白名单与参数 Schema

- 按 Q13，多步骤 edits 的最终目标是无歧义的 `(stepIndex, JSON Pointer)` 编辑条目，允许两个步骤各自编辑 `/body`；这需要主会话 ADR、公共契约修订与受影响设计重评。本稿不改已有 `Record<path,value>` 语义、不私编码复合键。冻结 v1 修订前仍 fail closed：跨步骤同名 path 无法区分、重复 path 或未明确的路径语法拒绝，不能把这项临时限制当最终方案。
- 获批准的 JSON Pointer 必须定位 stepIndex 下 args 的现存字段。顶层 account/tool/idempotencyKey/preconditions/localEffect/选项，以及 `args.idempotencyKey` 和其所有父对象整体替换均不可编辑；白名单即使误登记这些键也拒绝。
- 拒绝通配符、父对象整体替换、数组追加/删除/重排、对象污染键 `__proto__` / `constructor` / `prototype`、不存在路径、额外 edits 键和越权字段。仅允许登记的现存叶子值替换；数组整体或收件人集合编辑需要另行批准 Schema/路径语义，不隐式支持。
- Schema 来自已登记工具版本，写输入必须能携带契约已有的 `args.idempotencyKey`。先校验草案业务结构及原双键是否冲突，再由动作层预览前物化相等的权威双键，做完整 Schema 校验；应用允许的 edits 后重新校验完整 Schema、双键相等及业务效果。拒绝缺键、额外属性、非法类型、失效附件或动态目标。禁止执行前强制转换、补键/默认值、截断正文或“智能修正”接收方。
- 默认参数与权威双键只可在预览之前一次性物化并显示；Schema 不得在校验后另行删除/改变已物化键。原字段缺失、null、空字符串语义不可混淆；编辑后的内容必须重新 preview，旧 hash 不接受。
- 如果工具 Schema 声称任意文本字段可携带秘密但审计/预览无法过滤，工具不准登记；Schema 通过不等于权限、风险或来源验证通过。

### 4.3 actionHash 的冻结文档与规范化

建立内部 `action-envelope/v1`，其中包括：

| 必须覆盖 | 内容 |
|---|---|
| 决定目标 | proposalId、revision、capabilityId、optionId、受信本人 id、expiresAt |
| 每一步 | stepIndex、稳定 stepId、完整 tool 名、SourceId、连接器/内部处理器版本、工具 Schema 与语义版本/digest |
| 身份和路由 | 目标账号的宿主稳定绑定、厂商、目标位置、完整实际收件人及接收角色 |
| 执行内容 | 最终 args（含 args.idempotencyKey）、相等的 ActionStep.idempotencyKey、预览确定的正文/附件/目标、全部前置条件和 source/owner 定位快照 |
| 其他效果 | localEffect 的完整 kind/at 与顺序（外部步骤全部成功后才登记提醒）；忽略作为明确无外呼效果 |

args 和其派生 target/recipients/body 必须由同一个登记规则产生，执行以这一份冻结内容为准。任何发送时的不可控模板替换或目标解析都不属于已批准内容；无法固定则拒绝预览。若附件/资源可能变化，应绑定可验证内容哈希并在执行前核验，不能只哈希一个可变文件路径。

规范化规则：

1. 仅接受可往返的 JSON 值；拒绝 undefined、BigInt、非有限数字、非 JSON 对象、未配对 Unicode surrogate。时间为 UTC 毫秒整数。按工具 Schema 校验数值精度，不能让序列化悄悄丢精度。
2. 冻结前完成默认物化与业务规范化；此后使用 RFC 8785 JCS 生成 canonical JSON UTF-8 字节。对象键按该规范排序，数组保留原序；-0 的 canonical 表达为 0。不得在哈希后做账号大小写折叠、别名替换、Unicode NFC、换行替换或接收方重排。
3. 正文、显示名、邮箱 local part 与资源 id 按冻结值保留；账号的稳定身份由宿主给出，不能用显示邮箱字符串代替。scope/risk/schema 描述若影响效果或权限，纳入工具 descriptor digest。
4. actionHash 为 `sha256:` 加 SHA-256 十六进制摘要；输入带固定域分隔 `work-agent.action-envelope/v1` 与 canonical 字节。算法/格式版本随快照保存。哈希只用于内容绑定，不是来源真实性或批准签名。
5. 生成 hash 前先校验双键均存在、严格相等且符合完整 Schema；两份键都纳入 canonical envelope，缺失或不同不能靠重算 hash 接受。Preview 缓存 canonical edits、完整 envelope 与 hash；decide 用当前 revision、登记 descriptor 和同一编辑器重算、再次校验双键，必须与服务器持久化预览逐字节匹配。工具目录变化或 derived preview 内容改变，即便客户端传入旧 hash 也拒绝。

JCS 技术依据：<https://www.rfc-editor.org/rfc/rfc8785>。这只是选定规范，不表示实现库或双平台测试已经通过。工具版本/Schema/pin 的现有公共字段不足，见 U07-02。

### 4.4 原子决定与审批后不可变

决定前在事务外准备确定性校验材料，不发起写工具或授权；事务内不跨网络等待。

1. 认证入口形成 Decision；先检查 id 是否存在。相同 id 与规范化业务请求相同、认证本人相同，返回原决定结果，不再执行；复用 id 携带不同 proposal/revision/hash/option/edits/本人则 conflict。重传的服务器时间不参与请求去重 digest；原 decidedAt/channel 不被覆盖。
2. 同步事务比较 proposal.status=pending、currentRevision、owner、expiresAt、选项、已登记版本/目录戳、服务端预览和重算 actionHash。有效期以服务器当前时间判断，而不是客户端 decidedAt。
3. 插入唯一 proposal_id 的 act_decisions，原子设置 effective_decision_id 并移除 pending 映射。忽略转 dismissed；可执行选项转 approved，创建唯一 execution 与全部冻结 act_steps。
4. 同事务调用 AuditWriter 追加 `kind=decision,outcome=ok`，并 EventBus.publish `proposal.decided`。任一失败全部回滚；客户端即便超时也只能查询/重送同一个决定 id，不生成第二条生效决定。
5. 提交后异步唤醒执行器；多通道不同决定 id 的竞争只有一条赢。失败通道展示当前快照和已决定信息，不自动改选项或重新创建提议。
6. 批准后 edits、账号、工具内容和 revision 均不可改。工具升级、账号切换、内容漂移只能停止原执行并让上层新建待预览提议；原决定与已成功记录保留，不复制成功步骤作为“待执行”。

当前 API 不含预览 id，但可在 act_previews 中通过本人/proposal/revision/option/hash/canonical edits 匹配有效预览。hash 冲突防御还需比较 canonical 字节。目录戳的原子版本一致性/pin 缺口必须由主会话解决，不能把 ConnectorHost.list 的异步可变结果当事务锁。

### 4.5 Proposal 与步骤状态机

| 起点 | 条件 | 目标/动作 |
|---|---|---|
| pending | 同 dedupe 更新 | pending、revision+1，失效旧预览 |
| pending | 到期 / 尚未决定的显式替代 / 系统忽略 | expired / superseded / dismissed；无外呼 |
| pending | 一条决定原子生效 | approved，冻结并创建 execution |
| approved | 领取执行，开始实时准备 | executing，步骤仍 pending |
| executing | 缺 scopes / 当前凭证失效，且没有未解除的旧 unknown | waiting_auth，当前步骤 waiting_auth，明确尚未执行 |
| waiting_auth | 权威绑定请求已 granted，当前凭证和全部准备重验通过 | executing；从准备阶段开始，不从 callWrite 续跑 |
| executing | started 后结果不能确定 | waiting_verification，步骤 unknown |
| waiting_verification | found 且匹配冻结效果，逻辑步骤结果已核实 | 该步骤 succeeded；旧 unknown attempt 留存、另记核验证据；剩余步骤重验，到期不继续新写 |
| waiting_verification | 权威证据已证明所有未解除旧尝试未执行，并排除迟到风险 | 追加核验证据后重新准备；若缺凭证才可显示步骤/提议 waiting_auth 的未执行语义 |
| waiting_verification | 旧尝试仍 unknown，仅有效远端幂等允许同键尝试 | 对外步骤保持 unknown、提议保持 waiting_verification；内记准备/重试 phase，新 attempt 单独 started，绝不抹去旧 unknown |
| waiting_verification | 核验或上述幂等重试缺授权、授权等待/取消/丢事件、期限变化 | 仍 unknown/waiting_verification，需求放内部 phase/auth_links；无权威核验不改为未执行或确定失败 |
| executing / waiting_auth | 无未解除未知且确定失败、pending 授权取消/流程过期、条件改变、版本不符 | failed 或 partially_failed，后续 pending 步骤保持未执行 |
| executing | 全部外部步骤核实成功，批准期内本地效果成功持久化 | succeeded |

派生优先级：未解除的旧尝试 unknown 或当前尝试结果已无法确定 → 步骤 unknown、提议 waiting_verification；没有未知而部分已成功且后续确定停止 → partially_failed；零成功确定停止 → failed；全步骤确认成功且本地效果已落库 → succeeded。有效幂等仅允许受控同键尝试，不是权威未执行证据。授权需求、授权取消/流程过期、Credential 失效/撤销、租约丢失、策略拒绝与幂等期限届满均不解除 unknown。

StepExecution 使用冻结公共状态，内部 phase/attempt 不扩展公共枚举。没有旧未知时 `pending → started → succeeded/failed/unknown`，确定未调用且需权限才 `pending → waiting_auth`。已有 unknown 时，只有权威证明旧尝试未执行并排除迟到风险，才能转成等待权限的未执行语义；只凭有效幂等发起新 attempt 时仍保持对外 unknown/waiting_verification，新 started 记入 act_step_attempts 与审计。新的确定失败也不能覆盖仍未解除的旧 unknown。

旧 unknown attempt 的原始状态和证据永久保留，核验另追加 act_reconciliations，不覆盖/删除旧记录。核实同键逻辑效果成功可以将 StepExecution 记 succeeded，并记录它如何解除步骤层面的结果不确定性；不宣称已知道每一次旧尝试发生了什么。succeeded 不回到任何可调用状态。

`proposal.finished` 在确定执行完成/终止时发布，包括 succeeded、failed、partially_failed；waiting_auth/verification 是待处理而非 finished。现有 DomainEvent 不能表达完整步骤进度/提醒状态，见 U07-06；不冒充新事件类型或以 happy 动画当完成证据。

### 4.6 租约、单执行器与逐步外呼

- execution 由事务 CAS 领取 lease_owner/lease_epoch；同一 execution 同时仅一名受信执行器持有租约。领取者按固定顺序处理步骤，v1 不并行发送同一选项步骤。
- 准备、started 提交、结果提交、续租均比较 owner/epoch；只有当前持有者能发起新的尝试。休眠/超时使租约失效只代表执行器资格失效，不代表远端请求未执行。
- 旧执行器被暂停或失去租约后，继任者遇到 started/unknown 只能进入只读核验；不能因租约过期再次 callWrite。本地 fencing 无法阻止一个已离开数据库事务的旧请求到达远端，不能冒充远端锁。
- 权威 not_found 只有连同旧尝试不再可能迟到执行的证据，才可解除旧 unknown。若只是有效远端幂等覆盖迟到请求而允许同键重试，旧 unknown 不被解除，对外仍 waiting_verification。仅数据库 epoch 或查询时暂未找到既不证明未执行也不允许盲重试；旧进程可能恢复且工具无远端保证时保持待核验。
- 在外呼前最后重验租约与准备证据时效；验证后至远端调用仍有不可消除的窗口。需要强条件修改的工具必须把条件请求/版本限制交由源系统原子检查；接口缺口见 U07-04。
- 确定的迟到成功回包可作为核验证据入队，在当前 epoch 下重新匹配 attempt/hash/account/providerRef 后记录，不让旧持有者启动下一步。迟到错误不能覆盖已核实成功。任一成功记录后都不重放该步。
- 独立 execution 的并发上限及退避受本机运行时预算约束；没有运行时公共调度服务时，动作层内部队列限额执行，不调用其他模块私有表。M2 的租约数值与睡眠恢复实测后定，不宣称远端单执行器。

**每一步执行顺序**：

1. 从数据库读有效决定、冻结 envelope、StepExecution 和尝试历史，校验完整 Schema、ActionStep.idempotencyKey 与 args.idempotencyKey 均存在且相等，并与预览/hash/StepExecution 的固定键一致；不一致停止且不修补。如果 succeeded 直接跳过；started 无结果或 unknown 先核验。旧 unknown 历史永不覆盖/删除。
2. 重新检查 Policy、原决定 expiry、当前工具版本/pin、source/account 绑定、目标/附件当前身份及实时前置条件。拒绝项停止新尝试，不能借授权绕过；已有未知仍保持待核验。
3. 由宿主受信认证适配器取得/刷新并检查当前凭证、所需 scopes、冻结账号和授权代际；执行器没有 credential 入口，不接收含 token 的 Credential。准备只经待统一的非秘密受信边界确认当前状态，不把 status.granted/authorized 当完整有效性证明；U07-05/MOD-03 Q06/Q10 未闭环时不进入新外呼。凭证不足进入 §4.8；未解除旧 unknown 时只记内部授权需求，对外仍 unknown/waiting_verification。
4. 宿主凭证检查及其他准备等待可能耗时；等待后动作层仍须重验冻结账号的非秘密受信绑定、策略版本、原决定有效期、工具描述、新鲜前置条件及相等双键。凭证时效/scopes/撤销和授权代际由宿主认证适配器核验，早期非秘密查询不是最终派发许可；没有权威实时读取或双键/冻结参数不符则不得写。未知同键重试还须重新判断远端幂等保证是否仍有效，等待授权不会延长键保留期。
5. 同步事务 CAS 当前步骤/租约，追加新的 started attempt、稳定键与请求 digest，调用 AuditWriter 追加 `tool_write/started`。没有未解除旧 unknown 才将 StepExecution 记 started；有效幂等重试仍有旧 unknown 时，StepExecution 保持 unknown、Proposal 保持 waiting_verification，新尝试仅在内部 phase/attempt 记录 started。这笔事务成功提交后才能外呼；审计不可用时不得外呼。
6. 事务外通过 ConnectorHost.callWrite 原样调用冻结 tool/args（已含 args.idempotencyKey），调用前再校验它与 ActionStep/StepExecution 的固定键相等。ctx 仅使用已有 executionId、stepId、冻结 account、decisionHash、真实 user Actor，不新增键字段；不补参数、不改键、不用能力原给的另一个键、不带模型新参数。宿主受信认证适配器在最后一次取密/刷新、队列/限流/发现及 transport 等 await 后、真实派发点核对捕获的 source/冻结账号、原决定/步骤/started、工具版本与 Schema/pin、授权 epoch/凭证代际、scopes/期限/撤销及策略/决定期限/当前条件证据；检查至派发之间不插入未核验等待。合法刷新只按宿主核验的原 operation/CAS 转换代际，不能用同账号新授权或新 epoch 包装旧 token。派发前不符必须拒绝，只有宿主权威确认未派发才属确定未调用；已可能派发的错误/撤销仍进入未知核验，旧 unknown 不被清除。不承诺跨网络原子撤销；可信冻结验证与最终闸门依 U07-05/MOD-03 Q06/Q10，未闭环不靠私读 act_、新 ctx 字段或早期 status 绕过。
7. 对结果按登记规则核对实际账号、目标、providerRef 和预期效果，同事务记新 attempt 结果、追加核验证据/审计并计算步骤和聚合。旧 unknown attempt 不改写；新尝试失败或缺授权不能盖掉旧未知，只有可核验逻辑成功或权威未执行证据才解除步骤不确定性。按已定义事件发布确定结果。
8. 下一步从第 1 步开始；不凭上一步旧核验材料继续。无旧未知且确定失败则停止；未知保持待核验；绝不自动补偿前面成功步骤。

### 4.7 当前源系统前置条件核验

| 前置条件 | 实时要求 | 不能接受的替代 |
|---|---|---|
| entity_unchanged | 依据 owner/source/nativeId 定位，用登记只读工具取得当前对象；使用与 provenance.contentHash 同一登记算法/字段范围重算并比较 | 仅比较同步库、缓存时间、标题或接口 ETag 的字符串但没有语义对应 |
| no_newer_in_thread | 当前线程截至查询时所有相关消息分页完整；比较完整线程高水位与 after，并说明 self/他人/系统事件的判定范围 | 拉第一页、仅看未读数、固定延迟后认为无新消息、把日历记录当真实参与 |
| 路由与内容 | 核对目标仍存在、账号仍绑定、附件内容/成员/目标未漂移 | 执行时重新解析昵称、以新账号继续、静默替换附件 |

- 只读核验经 ConnectorHost.callRead 与宿主授权/审计/来源包装，不直接访问厂商 API 或凭证。图谱可提供定位，但不是当前事实。
- 找不到、无权读、分页不完整、内容 hash 算法不匹配或返回 unknown，均“不足以判断”，不能假设条件成立。只读检查缺权限时，若无未解除旧 unknown 才进入 waiting_auth；否则对外步骤 unknown、提议 waiting_verification，仅内部 phase/auth_links 记录需授权。授权恢复从策略、当前账号的非秘密受信绑定、宿主认证适配器的当前凭证检查及源系统检查重来；执行器不取得 Credential，有旧 unknown 先核验旧结果。
- 前置条件 false 为确定阻止新动作；若已有未知尝试，先保留未知并核验它，不通过新内容自动判定旧动作没有发生。
- 读取与写入之间可能有 TOCTOU；读取新鲜只证明读取时的事实。若业务必须严格“没有新回复才发送”，而源系统不提供原子条件写，预览须说明限制；不接受这种风险的工具/流程拒绝执行。不能把 hash 比较或本地 SQLite 事务当远端原子条件。
- 核验工具、分页完整证明、hash 算法和工具 Schema 的登记元数据现有契约未齐，见 U07-02/U07-04；未闭环不准上线相关条件动作。

### 4.8 按需授权与 AuthResume

1. 先持久化 act_auth_links 创建意图和内部 phase/resume_phase，再在事务外调用 AuthBroker.requestGrant。没有未解除旧 unknown（从未外呼，或权威证明旧尝试未执行并排除迟到风险）才显示步骤/提议 waiting_auth；旧 unknown 未解除时，无论缺权限是为核验还是有效幂等重试，对外仍 Step unknown、Proposal waiting_verification。reason 只描述权限与事项，不含正文；expectedAccount 为冻结 account，resume 绑定 executionId、stepId、proposalRevision、decisionHash，requestedBy 为原真实用户决定 Actor。
2. 持久化返回的 request_id；AuthBroker 的受信认证路径负责 state/PKCE/issuer/账号和授权流程期限验证，秘密只由被授权认证适配器处理，动作层不存或读取认证材料，也不接收含 token 的 Credential。异步请求建立与本机链接落库之间的崩溃窗口由 U07-05 幂等建立/查询目标解决，不能盲目创建多个 grant，也不造跨模块异步 Tx。
3. auth.granted 仅是唤醒提示。按 event.id 去重后，目标权威查询必须确认 request 与完整 resume 绑定，source/expectedAccount/decision/hash/revision/step 均匹配，且请求已合法完成为 granted。不得只检查同 source 的 status.granted；事件丢失/迟到也不得改变这条规则。此查询尚未在 AuthBroker 定义，以下语义是 Q13/U07-05 的协调目标，不是假定已经实现。
4. 区分三类时间与状态：pending 请求的 AuthRequest.expiresAt 约束尚未完成的授权流程，超时未完成则流程 expired；已在流程期限内完成的 granted 是既成终态，不因其 expiresAt 后来过去而被否定，迟到事件也不能把它改为 expired。当前 Credential 的过期/刷新可用性、scopes、account、授权代际和撤销状态只由宿主受信认证适配器校验，不把对象或 token 返回动作层；granted 终态不保证当前仍有有效凭证。原 Proposal/Decision 的有效期另查，不能由既成授权延长。
5. 恢复时动作层仍重验 Policy、原决定期限、工具版本、当前账号的非秘密受信绑定与源系统条件；有效凭证的重新取得、时效/scopes/授权代际检查和合法刷新只由宿主受信认证适配器承担，过期不能刷新则按需再授权，撤销不能新写。非秘密受信查询与权威请求/代际绑定未闭环即 fail closed，不调用 credential 替代。恢复重新准备并绑定核实后的当前授权代际，宿主仍在最后 await 后按冻结账号/原决定/工具版本及捕获代际作 §4.6 的最终派发检查，不能把旧票据换成同账号新 epoch 继续发。内容或账号改变拒绝原动作，提示新提议/预览，不以刚授权补批准。旧决定到期可继续合法只读核验既有未知结果，但不得新写或安排新的提醒。
6. pending 流程取消/expired、auth.revoked 或断开源均不自动恢复新动作；没有旧未知的执行确定停止，部分成功保留。旧 unknown 始终保持 unknown/waiting_verification，内部记录授权被取消/流程过期/撤销，旧 unknown attempt 不改为 failed。晚到事件不复活已停止执行；对真正已 granted 的请求，不能仅因流程 expiresAt 已过就认定未授权，仍以权威终态和当前凭证分别核验。
7. 未解除 unknown 的授权需求可在内部区分 verification 与 retry_revalidation；授权等待/取消/丢事件/恢复及幂等期限变化都不改对外 unknown。授权完成后先回策略、当前账号的非秘密受信绑定、宿主认证适配器的凭证/代际检查和源条件重验，再核验旧结果。仅仍有效的远端幂等允许受控同键新 attempt 时，旧未知仍保留、新 started 只记内部 attempt；保证已过期则不重试。只有权威证明旧尝试未执行后，缺凭证才允许 waiting_auth 的未执行语义。
8. 完全相同内容、工具版本、账号和前置条件仍成立，且原决定有效时，用户无需再次决定；授权不是第二次业务确认。业务变化要求新决定，未知结果不能靠新的授权或人工说明自动解除。

当前 AuthBroker 仍无按 id/resume 查请求权威终态/绑定或 requestGrant 幂等建立的公共方法，auth.granted.requestId 也可缺省。U07-05 与 MOD-03 Q06/Q10 合并协调非秘密实时账号/scopes/授权状态、有效性及代际查询、可信冻结执行绑定和最终派发检查；现有 status.granted/ConnectorInfo.authorized 不具备这些保证。pending 流程期限、既成 granted 与当前凭证有效性继续独立，取密/刷新/秘密处理只在宿主受信认证适配器。仍属公共未决；本稿不新增类型/方法或通用认证抽象、不用 Omit/断言伪隔离，不虚构恢复已实现，不退化为“这个 source 授权了就继续”。

### 4.9 未知结果、有效幂等期与禁止盲重试

远端调用成功不等于回包必达；started 已提交但无结果既可能“未调用”，也可能“已成功”。两者都进入待核验，不根据客户端超时或网络错误任选一个。

| 核验结果 | 行为 |
|---|---|
| found，证据匹配账号/工具/幂等键/目标/最终内容 | 记录该步成功和结果审计；跳过它，只对剩余步骤重新做全部准备 |
| found，但结果与冻结效果不符 | 保持未知并展示不一致；不自动改内容、覆盖结果或发送一份“修正” |
| not_found，authoritative=false | 保持未知；不自动重试 |
| not_found，authoritative=true | 必须同时证实查询范围/权限/最终一致性边界及旧尝试无迟到执行可能；满足后确认旧尝试未执行，再做策略/条件/账号/有效期核验才可尝试 |
| unknown、查询不可用、证据不足 | 保持 waiting_verification，展示本机记录、当前已成功/未执行步骤和安全核对入口 |
| 已验证 provider_key 且仍在有效期，旧 unknown 未解除 | 在同账号/实例/工具/步骤、相等双键同冻结内容且旧请求仍被保证覆盖时可受控尝试；仍先核验并重跑准备。对外仍 unknown/waiting_verification，新 started 另记 attempt；缺授权只记内部需求，取消或期限变化不能抹去旧 unknown |

**有效远端幂等保证**必须是已实测登记能力，而不是 ToolSpec 自报或 MCP annotation。记录 retentionMs、保证起点、作用域、同键同内容/不同内容行为、并发行为、重试预算、接口和 SDK/连接器版本、证据到期时间。若缺少保证，实际能力为 none。

- 保证期限保守从第一次 started 的服务器时间计算，不因重试续期；扣除时钟不确定性、传输/排队最长时间等安全余量。不能把新 retry 时间当首次使用键，也不能在期外生成新键绕过去重。
- 新请求必须能在远端保证截止前到达；无法给出传输边界、时钟跳变或旧请求迟到边界时不自动重试。provider 保证的实际起点/刷新语义与本地记录不同则取更保守值。
- 即便有效幂等允许同键调用，决定过期、策略拒绝、账号或内容变化也不能产生新写入。授权等待/取消/请求流程过期、当前凭证过期/撤销、幂等保证届满均不是旧尝试未执行证据；未解除旧 unknown 时保留 Step unknown/Proposal waiting_verification，旧 unknown attempt 永久留存。新 attempt started/确定失败不覆盖它，核验证据另追加；只读核验在权限允许时继续可用。
- 无幂等保证且无权威未执行证据时，用户点“再试”也不是安全证据。先让用户在源系统核对；要重发必须形成新的明确预览/决定、展示旧结果未知及重复风险，不用旧决定盲发。若不能解除并发迟到风险，仍不提供自动重发。
- `upstream_error.retryable=true`、rate_limited、auth_required 只有在登记保证其明确未执行时才能走确定失败/准备重试；MCP/传输模糊错误统一 outcome_unknown。有限只读核验退避不会转成无限写重试。
- 成功步骤在任何恢复、租约接管、升级、授权回调和用户重试中不重放。其后部分失败的补救只能由上层生成只含新动作的提议；不“重新执行整个选项”。

按 Q13，人工说明只作为用户核对记录，不等于厂商 found、权威 not_found 或可核验成功证据；不能直接把 unknown 改为 succeeded/未执行。手工核对身份、证据录入、可核验结果及查询接口仍待 U07-06 协调。未闭环时保持未知并让用户查看来源，不虚构“已核实”按钮或查询已实现。

### 4.10 审计、outbox 与执行事实

| 事务边界 | `act_` 写入 | AuditWriter | EventBus |
|---|---|---|---|
| 提议创建/替代/过期 | proposal/version/pending key | 无写动作审计；必要安全记录不伪装 tool_write | proposal.created 或已存在的状态事件；缺事件见 U07-06 |
| 决定 | decision、冻结 execution/steps、聚合 | decision/ok，正文只哈希 | proposal.decided |
| 发起外呼前 | started attempt、相等双键与冻结 args；旧未知未解除时步骤/聚合仍 unknown/waiting_verification | tool_write/started，关联决定/执行/步骤/工具 | 不杜撰新类型；可待进度契约补足 |
| 确定结果/未知 | 新 attempt 结果与 reconciliation/聚合；旧 unknown attempt 不覆盖/删除 | tool_write/ok、error 或 unknown，与 attempt 关联，核验另追加记录 | 逻辑步骤/执行确定完成才 proposal.finished |
| 授权等待/恢复 | act_auth_links/internal phase；旧未知未解除时不改对外 unknown/waiting_verification | 实际授权审计由 MOD-03 写；动作尝试结果由本模块追加 | 消费 auth 事件作为唤醒，不当作结果或恢复证明 |
| 本地提醒持久化 | local effect、聚合 | 追加独立 id 的 decision/ok 记录，detail.phase=local_effect；不修改原生效决定审计、不假冒外部 tool_write | 当前提醒投递事件缺口见 U07-06 |

每笔审计使用稳定唯一 id；attempt 序号/阶段/hash 放入脱敏 detail。AuditWriter 的重复 id 行为需要 MOD-01 明确：相同记录重复追加幂等或拒绝后能辨识已存在，不同内容复用 id 必须失败，见 U07-08。

- started 与审计任一未提交，不发外呼。结果返回后若结果事务失败，不发布完成，不继续下一步；重启按持久化 started 核验。
- 事件在事务外的临时内存推送不是事实来源。消费重复 proposal.decided 只唤醒唯一 execution，不重新建步骤。event.id、业务写入和消费去重在同事务处理，订阅检查点由 MOD-06 管理。
- 读取中央审计的路径也需要授权；不从审计拷贝正文，不用审计导出共享，不通过“删除产品统计”删审计。
- 统计写失败不改变业务成功，也不能让其错误回滚已发生的远端事实；统计单独投递/写入，业务 outbox 重放时按 generation 和 event_id 过滤。事件重放仅重建显示/消费，不触发成功步骤。

### 4.11 部分成功与本地稍后提醒

**部分成功**：界面逐步显示已成功的源系统引用、确定失败的原因、未知步骤与尚未执行步骤。只有核实成功才说“已发送/已创建”；waiting_auth 只表达无未解除旧未知且尚未执行的等待权限。旧 unknown 核验/幂等重试需授权时仍显示 waiting_verification，并另标“核验/重试需权限”，不能用 waiting_auth 隐去可能已执行的事实。剩余未执行步骤保留 pending，不会被自动队列捡起；停止的 execution 不因能力再次触发重新开始。

不自动删除已发邮件、撤回消息、取消会议或恢复共享状态。补偿也是独立有副作用的动作，未来若支持仍需新完整预览/决定；本模块 M2 不实现自动补偿。已成功步骤可产生事实性日志/记忆更新，由 MOD-11/09 的既定权限处理，失败/未知不能写成成功经历。

**稍后提醒**：

1. remind 的 at 在完整预览中展示本地时区与 UTC 来源。按 Q13，提醒到期可晚于提议/决定有效期；批准期内批准并成功持久化的是本地提醒安排，届时仅投递该提醒，不执行额外外部动作、不要求旧批准继续有效。纯提醒选项空 steps 合法，其他空选项非法，忽略由系统追加。
2. 决定后在批准有效期内将 act_local_effects 与执行结果同事务持久化；有外部步骤时，只在它们全部核实成功且安排时仍在批准有效期内登记 localEffect。预览明确此顺序；外部失败/未解除未知不安排“已完成”提醒。若结果核验拖至批准期外，保留已核实外部事实而不新安排提醒，明确部分完成并要求新提议；不在提醒到期时继续剩余外部步骤。
3. 提议 succeeded 对纯提醒表示“提醒已安排”，不是“提醒已投递”或“外部任务已完成”；提醒到期、取消、投递单独状态表达。提醒持久化失败不能假成功；外部已成功但提醒未安排则 partially_failed。
4. 到期处理采用 CAS 与稳定投递键；重启/睡眠后 overdue 只补跑一次，由 MOD-11/08 合并去重与安静投递，不轰炸用户。排队/发送/已投递事实必须分开，不凭入队就宣称已展示。
5. 用户能取消尚未投递的提醒，取消与到期竞争原子化；取消成功后不会被旧事件重建。若已不可撤回地投递，明确说明边界，不声称撤销用户看过的内容。
6. 现有 ActionService 无取消、local effect 查询或提醒投递接口，不能从动作层直接写 ui_/rt_ 或用未定义 DomainEvent；U07-06 未解决前此功能明确不可用，不交付不可取消的“稍后”。

### 4.12 M4 内部写处理器登记

sharing.publish/unpublish 是本地领域写处理器，不是假 SourceId/MCP 连接器，不向它们传 accessToken。仍须本人 Decision、完整资源/空间/可见范围预览、冻结账号或本机主体、Schema/版本、Policy、前置条件、started、结果核验、审计和成功步骤不重放。

受信组合根显式登记命名空间、handlerVersion、args Schema/digest、纯预览规则、主体映射、风险、核验规则、幂等行为和执行入口。拒绝覆盖已有 id/版本、执行任意脚本或把皮肤 activity 解析成工具；安装登记不是业务写授权。跨人请求的 origin=remote 保留来源，选项由本人节点能力生成，不接受远端的决定或权限。

本地 handler 若由 MOD-10 写 share_，本模块只调用经批准公共接口，不借 Tx 直接写 share_。按 Q13，U07-09 待 MOD-10 的 M4 专项设计后统一处理登记、核验与本地事务边界；本节仅保留 M4 边界目标，不提前定义通用执行插件类型，不阻塞 M1/M2。M2 中 sharing.* 一律 feature_unavailable，不把字符串匹配当登记。

### 4.13 产品统计与真实省时

本模块只记录可关闭、可清除的决定/执行时间与类别：accepted、edited、dismissed、snoozed、completed、failed、unknown，以及用户主动测量的任务开始/结束时间。completed 只由核实完成计一次；accepted 不等于 completed；纯 remind 的 scheduled 与 delivered 分开，不计外部任务完成。

- 同一决定/结果按事件 id 去重，展示分母和样本量。忽略、授权取消、编辑不是“用户不配合”，不扣成长或功能。
- 产品统计不保存正文、收件人、原始事件、凭证、全屏/键盘记录，不为了测量申请新工作数据权限。
- 用户清除后推进 generation，删除 act_product_stats；旧 outbox/审计/记忆整理不能重建已清除统计。若关闭统计，继续保留安全执行记录和不可删除审计，向用户说明两者不同。
- M2 用户主动选择至少 3 个相近真实任务，分别记录手工与辅助端到端耗时，含查背景、编辑、授权等待、核验与必要人工纠错；单列等待/主动工作口径，不挑选只算模型生成秒数的有利区间。中位耗时下降目标 ≥30%，样本不足或未达标不宣称省时。
- 省时测量必须标明用户确认/实测/模型估算；本模块不会从邮件量、点击量或采纳率推算节省工时。统计入口和 MemoryReader.feedback 对接缺口见 U07-10。

## 5. 错误处理与降级

| 情形 | 行为与用户语义 |
|---|---|
| M1 动作不可用 / 未登记工具 / 缺完整预览 | feature_unavailable；不接受决定、不安排执行，不伪造成功 |
| 无效输入、白名单越界、双键缺失/不相等、hash/revision 冲突、旧卡片 | 拒绝/停止且给可读原因；Schema/预览/hash/冻结/外呼前均检查相等双键，不在发送时补字段或换键，必要时重新完整预览 |
| 策略 deny、内容/账号/工具版本改变、前置条件 false | 停止新动作；说明变化，要求新提议。未知尝试仍单独核验 |
| auth_required/auth_expired | 无未解除旧 unknown、确定未执行才 waiting_auth；否则 Step unknown/Proposal waiting_verification，仅内部 phase/auth_links 表达需权限。恢复重验，不无限请求授权 |
| pending 授权流程取消/expired、Credential 撤销或断开源 | 不自动恢复新动作；旧未知保持 unknown/waiting_verification，旧 unknown attempt 永久留存，不假失败覆盖 |
| 已 granted 后请求 expiresAt 届满 / 当前 Credential 过期 | 请求截止不抹去既成 granted；权威请求终态与非秘密当前账号/scopes/有效性分别核验，取密/刷新只在宿主受信认证适配器。重验原决定期限/Policy/源条件；未解除旧未知不因任一期限改成未执行 |
| 非秘密认证边界未闭环 / 最后 await 后撤销、过期或账号/代际漂移 | 不用 credential 或 status.granted/authorized 顶替，宿主真实派发前拒绝；未派发需权威证明，已可能派发仍待核验，不能覆盖旧 unknown |
| rate_limited / 上游错误 | 先判定是否可能执行；确定未执行才有限退避，并再次准备。未知先核验，无保证不重试 |
| 写入超时、断连、进程崩溃、模糊 MCP 错误 | waiting_verification，显示核验方式；不凭 retryable 标记重发 |
| 核验不可用/分页不足/权限不足，或幂等保证在授权等待中届满 | 旧未知仍 unknown/waiting_verification；只读退避有限，授权绑定原步骤，期外不重试、不换键；仅有效幂等不证明未执行 |
| 数据库满/审计失败/started 提交失败 | 外呼前失败则不调用；外呼后结果未持久化则不继续，保留 started 恢复核验 |
| outbox 投递失败、客户端离线 | 已提交事实保留，重放显示事件不重放动作；不擅自转飞书泄露内容 |
| 统计关闭/失败、成长不可用、宠物退出 | 不影响执行安全或已核实事实；无模型也可执行已批准且仍有效的冻结动作 |
| 源系统既无有效幂等保证也无权威未执行核验证据 | 可首次执行经批准且满足条件的动作，但明确恢复限制；未知结果不能自动再次写 |
| 系统时钟跳变/备份恢复/旧执行器迟到 | 保守停止新写并核验；不借租约新 epoch 判断远端未执行 |

确定失败与未知错误必须区分。停止原因记录机器可读内部 reason 和脱敏展示，不把上游 detail 原样写日志、卡片或审计。错误的公共 code 映射尚未冻结，见 U07-11。

## 6. 安全与隐私

### 6.1 权限、来源与信息出口

- ActionService/执行器不读取 .env、凭证文件或 SecretStore，也不获 AuthBroker.credential、完整 Broker 或任何含 token 的 Credential。运行时秘密仅在系统凭证库及被授权的宿主/连接器认证适配器内存；不能将整个 AuthBroker/ConnectorHost 的内存泛称为许可边界。取密/刷新与最后派发时效核验由宿主受信认证适配器承担，执行器只消费待公共契约闭环的非秘密受信状态，不靠 Omit/类型断言去密。非秘密实际返回载体不得夹带 token 或携密引用；token 不进入 act_、模型、args、审计 detail、事件、日志、进程参数或共享。
- 工具写权限只授予执行器，决定入口只授予认证交互服务；能力/伙伴/模型/皮肤无法获取 callWrite。受信本机插件不是沙箱，仍需依赖检查和显式登记，不能靠 readOnly 标记认定安全。
- 提议、预览及结果保留来源最高敏感度；目标账号和接收方也是工作数据。ProposalPreview 不直接广播到所有 surface，通道过滤覆盖标题、依据、body、args、错误、链接、人格台词。
- secret 不入模型，不入主动气泡或外发通知；confidential 按用户渠道设置。外部内容只能作为起草数据/前置事实，不能被当策略、批准、可信用户身份或规则记忆。
- 审计仅记录 id/hash/状态/时间/脱敏工具名和受限引用，不存正文、完整收件人、附件内容或原始响应；Logger 只记录稳定错误 code/id，detail 先过滤。
- act_ 中为执行冻结的正文与路由属于本机业务数据，不是产品统计。其保留/清理应与执行可追溯性、中央无正文审计及备份限制一起向用户说明，不能许诺删除统计就删除业务事实或无痕清除离线备份。

### 6.2 策略不可被人格、授权或展示降级

Policy 在决定及每个新尝试前检查，风险由宿主登记决定；高风险可拒绝而非自动放行。既成 granted 不证明当前 scopes/account/有效性或派发代际合格，更不代表允许动作；这些由宿主受信认证适配器当前核验，策略与原决定仍独立检查。飞书机器人本人通知例外仅走已有通知规则，不能用于绕过用户身份写动作。

人格只能包装伙伴说明，不改外发草稿、事实字段、actionHash 或策略。上层只能根据核实状态说“完成”，不能以萌化语言掩盖失败、未知、缺权限或“不足以判断”。用户忽略、取消提醒、关统计、删记忆、关闭宠物不影响办公能力。

### 6.3 跨平台

本模块不枚举窗口、不截图/OCR、不判断 macOS/Windows、不控制其他应用，不在目录里创建系统凭证或自启配置。SQLite/UTC/JCS/事务测试在两平台执行；平台生命周期、时钟与实例监督通过 MOD-01 协调，音频/动画/窗口生活留在 MOD-11/12。

## 7. 测试计划

所有下列项目是待执行的验收计划，不是本会话已完成的测试。纯模拟证明内部安全路径，真实授权、厂商幂等、跨平台安装和省时必须另获授权实测并保留证据。

### 7.1 单元与契约测试

- Proposal：同能力 dedupe 的创建/更新/到期/批准竞争；revision 单调；同草案 no-op；已批准/未知项不被覆盖；空选项与忽略冲突拒绝；多实例同键隔离。
- Preview/edit：全文、To/Cc/Bcc、账号、目标、附件和所有副作用字段；超长正文不截断；嵌套 JSON Pointer、重复路径、污染键、数组越权、Schema 默认/精度/未知字段；编辑后旧 hash 不可决定。现契约跨步骤同 path 拒绝；主会话 ADR/契约修订后补两个步骤均编辑 `/body`、互不串改的目标测试，不用私编码复合键假通过。
- 双键：原草案带不同 step/args 键即拒绝；预览前生成权威键并同步物化两处；Schema、预览、hash、冻结、started 和外呼前分别注入缺键/不相等，必须拒绝/停止且 callWrite 增量 0。禁止 edits 修改任一键或父对象；不得发送时补键。恢复同键同 args，ctx 没有另加键字段。
- Hash：对象键顺序等价；数组/正文/换行/Unicode/收件角色差异必不同；相等双键、账号/source/toolVersion/schema/preconditions/localEffect/expiry 每项变化必失效，双键不相等即使重算 hash 也拒绝；JCS -0、精度、非法 surrogate、非 JSON 值及双平台一致性测试。
- Decision：伪造本人/渠道/时间被入口覆盖或拒绝；受信组合根限制 list/preview/decide，能力不能直接决定；过期、旧 revision、跨 owner、旧预览拒绝；100 次多通道并发一条生效，同 id 重传不覆盖原时间。
- Executor：callWrite 仅来自执行器，先 started attempt+审计再外呼；成功步骤永不重放；条件/账号/版本变化拒绝。旧 unknown 因核验/有效幂等重试缺授权时始终 Step unknown/Proposal waiting_verification；等待、取消、丢事件、恢复、期限变化、新 attempt started 或确定失败都不能盖掉旧未知，旧记录不删改。
- AuthResume：目标权威查询中 pending 流程超时确为 expired；已合法 granted 后请求期限届满不能否定终态。分别验证宿主认证适配器处理当前 Credential 过期/刷新/撤销及账号/scopes/代际，执行器不接收对象；原决定期限/Policy/源条件独立重验。查询缺失继续 fail closed，不用事件或同 source 授权代替。权威证明旧尝试未执行后才可 waiting_auth。
- Credential 隔离：检查真实组合根、依赖可达性与调用路径，执行器不能获得 credential 方法、完整 Broker、SecretStore 或 token-bearing 对象，适配器以外取密调用数为 0。合成 token 金丝雀覆盖非秘密结果的实际字段、嵌套对象/引用和错误载体；宿主须在交付执行器前拒绝携密载体，不能以 Omit、类型断言或事后删字段通过。宿主独立控制取密/刷新并核验原绑定；最后 await 后注入过期/撤销、scopes 不足、同账号重授权/换账号与工具代际漂移，未派发增量 0；已可能派发保持未知核验，旧 unknown 不降级。
- Reminder/statistics：批准期内安排、提醒到期晚于批准期仍只投递本地提醒，届时 callWrite 增量 0；混合步骤仅全部核实成功后安排；纯提醒不记外部完成。持久化/取消竞争、到期去重/勿扰、统计关闭/清除和重放均测试。

### 7.2 I1–I35 关联测试矩阵

D=本模块直接约束；J=需联合其他模块验证；B=本模块不得越界、主验收在其他模块。列出全部编号，B 不是本模块宣称已覆盖其他模块实现。

| 不变量 | 关联 | 测试/注入与必须断言 | 协作方 |
|---|---|---|---|
| I1 决定/当前条件/审计 | D/J | 无决定调用拒绝；图谱旧而源系统新阻止；每个 tool_write 可关联本人决定和步骤 | MOD-01/03/04 |
| I2 写入口隔离 | D/J | 静态依赖与组合根注入检查；能力/伙伴/交互只有 propose/decide，拿不到 callWrite | MOD-03/06/08/11 |
| I3 模型只提议 | J | 模型/邮件要求直接发送、伪造批准；仅产生 pending，callWrite 次数 0 | MOD-05/06 |
| I4 完整预览 | D/J | 全文/所有接收方/目标/附件核对；小气泡和卡片不允许只摘要确认 | MOD-08/12 |
| I5 无 auto | D | 类型及策略分支检查；常设规则、成长等级不能跳过决定 | MOD-06/11 |
| I6 远端只提议 | J | M4 remote.request 带远端批准；仍 pending，decidedBy 仅本人 | MOD-10/08 |
| I7 凭证边界 | D/J | 真实装配/依赖可达性断言：执行器无 credential/完整 Broker/SecretStore，无 token-bearing 返回对象；非秘密实际载体含字段/嵌套携密引用即失败，仅认证适配器可取密/刷新。最后 await 后过期/撤销/账号或代际漂移派发前拒绝，已可能派发仍未知；金丝雀断言 act_/审计/日志/事件/模型/args 无 token，适配失败不降级 | MOD-01/03/05 |
| I8 连接器无凭证/授权/模型 | B/J | auth_required 只等待宿主；连接器不能自授权、存游标或调用 LiteLLM | MOD-03/04 |
| I9 断开源删除凭证 | J | revoke 后凭证由 MOD-03/01 删除并审计；旧 auth.granted 不恢复步骤 | MOD-01/03 |
| I10 模型网关唯一 | B/J | 动作层无 LLM 依赖；规划实体正文只经网关引用，不拼可信字符串 | MOD-05/06 |
| I11 敏感模型内容 | J | secret 草稿/依据不入模；confidential 设置保持；动作核验不额外发模型 | MOD-05/06 |
| I12 外部内容不可信 | D/J | 正文伪造策略、hash、审批、Schema 与授权链接；不得改变执行入口或信任 | MOD-05/06/03 |
| I13 规则记忆须用户 | J | 外部提议不能自行写 rule；真实 Decision 证据可追溯，动作层无 MemoryWriter | MOD-09/11 |
| I14 记忆可编辑删除 | B/J | 忘记后索引/向量清除由 MOD-09 验证；不因删除记忆重放动作/改变冻结决定 | MOD-09 |
| I15 人格不改事实/策略 | D/J | 可爱台词变换不改账号/正文/hash/条件；失败未知不得表达成功 | MOD-11/08 |
| I16 安静模式与隐私 | J | 授权/未知/提醒事件在勿扰不冒普通气泡/音频；unknown 检测不称可靠 | MOD-11/12/08 |
| I17 养成不锁功能 | D/J | 零等级、拒绝/取消、离线宠物仍可从认证控制台决定，不扣功能 | MOD-11/08 |
| I18 本地接口认证 | J | 缺令牌、坏 Host/Origin/CSRF、伪造卡片本人、OAuth 回调访问业务拒绝 | MOD-08/03 |
| I19 owner/visibility/source | D/J | 跨 owner 依据不可绕范围；M4 共享预览逐项发布，本模块不直写图谱 | MOD-02/10 |
| I20 同步幂等/快照 | B/J | 半页同步/旧游标与动作核验并发；不把未完整图谱状态当实时条件 | MOD-02/03 |
| I21 审计只追加 | D/J | 动作模块无 audit_ SQL；重复审计 id 行为受控；无 update/delete，清统计不删审计 | MOD-01 |
| I22 日志无正文/凭证 | D/J | 上游 error.detail 混正文/token/接收方；日志过滤，错误出口不原样反射 | MOD-01/03/08 |
| I23 表与接口所有权 | D/J | 静态依赖与 Tx 写入检查，仅 act_；审计/outbox/共享走已批准服务 | MOD-01/06/10 |
| I24 连接器/客户端边界 | B/J | connector 只依赖 contracts；宠物只有本地接口，不能直接执行/连接器调用 | MOD-04/12 |
| I25 UTC 毫秒 | D/J | DST/跨时区提醒、expiry、时钟跳变；存 UTC，展示时区变化不改冻结值 | MOD-01/08 |
| I26 格式版本迁移 | D/J | 升级 canonical/schema/connector 版本使旧预览拒绝；旧执行 pin/迁移或核验隔离 | MOD-01/03 |
| I27 至少一次事件幂等 | D/J | 重复/乱序/重放 auth/proposal/outbox，唯一 execution，不重建取消提醒或已清统计 | MOD-06 |
| I28 双平台与适配边界 | D/J | 本模块无系统分支；两平台 SQLite 崩溃/JCS/休眠恢复冒烟，平台探针另验 | MOD-01/12 |
| I29 revision/hash/原子决定 | D/J | 相等双键进最终 args/Schema/预览/hash/冻结，缺键或不等拒绝；账号/工具升级、多通道竞争只一决定 | MOD-03/08 |
| I30 started/未知/不重放 | D/J | 同键恢复，旧 unknown 永久留存；幂等重试/授权等待不改对外 unknown，丢包/崩溃/迟到/期外无盲重试 | MOD-01/03/04 |
| I31 授权绑定与重验 | D/J | 错 request/step/hash/account、取消/丢事件/线程变化；granted 后请求截止不等当前凭证有效，未解除未知始终 waiting_verification | MOD-03/04 |
| I32 来源与出口过滤 | D/J | 原始 tool_result/外部依据缺来源拒绝；secret/confidential 离线回退不外发 | MOD-02/03/05/08/11 |
| I33 规则证据/遗忘墓碑 | B/J | 决定证据伪造拒绝；已忘记内容不从动作统计/日记/审计重建规则 | MOD-09/11 |
| I34 皮肤纯素材/本地效果 | B/J | skin/activity 携带 tool 名拒绝；自娱不进入执行器、不读窗口或发模型 | MOD-12/11 |
| I35 登记演练/真实省时 | D/J | 新能力只有提议入口、新皮肤不改执行器；版本冲突拒绝；≥3真实任务报告样本/口径 | MOD-02/03/06/08/12 |

### 7.3 崩溃与故障注入矩阵

使用可控制“请求到达/远端副作用/回包”的假源系统与临时 SQLite；测试器可 kill 子进程、阻断回包、注入事务异常和乱序事件。每项核对 act_、中央审计/outbox、实际远端副作用计数；不得只看 ProposalStatus。

| ID | 注入点 | 恢复必须满足 |
|---|---|---|
| F01 | create/update 与决定同时提交 | 一个序列化结果；旧 revision 不生效，批准快照不改 |
| F02 | 决定/审计/outbox 事务任一语句失败 | 全回滚，无 execution 外呼；重新同 id 可安全决定 |
| F03 | 决定提交后客户端回包丢失 | 同 id 重传返回原决定；多通道不能再生效一条 |
| F04 | approved 事件丢失/重复/乱序 | 启动扫描能领取唯一 execution；重复事件不建新步骤 |
| F05 | started 提交前崩溃/磁盘满/审计不可用 | 无外呼；无成功/未知远端副作用，无假成功 |
| F06 | started 提交后、callWrite 前崩溃 | 虽假源未执行仍按未知先核验；无保证不自动重发 |
| F07 | 远端已成功，回包丢失 | found 后记成功；相同/后续恢复不产生第二次副作用 |
| F08 | 成功回包后结果事务失败/崩溃 | 持久化 started 转核验，不继续下一步，不发布虚假完成 |
| F09 | lease 持有者暂停、接管、旧请求迟到 | 本地 epoch 不证明未执行；继任者只核验，无远端保证不重发 |
| F10 | 两执行器抢同 lease/100 并发唤醒 | 唯一 started attempt 的外呼资格；成功步骤 0 次重放 |
| F11 | 第一成功、第二确定失败、第三 pending | partially_failed；显示三个类别；第一不重放、第三不执行、无补偿 |
| F12 | 第一成功、第二 unknown、策略后续 deny | waiting_verification 优先；不假定第二未执行、不重发第一 |
| F13 | 申请授权成功但 act_auth_links 未写 request_id | 不创建第二 grant/不以 source 直接恢复；依 U07-05 查询绑定 |
| F14 | 已合法 granted 后事件丢失/重复/迟到或旧取消事件 | 依目标权威请求查询确认终态/绑定，事件只提示；流程未完成的 cancelled/expired 不恢复，granted 后 expiresAt 届满不抹终态。旧未知始终 unknown/waiting_verification；查询未闭环不能假实现 |
| F15 | 授权账号切换、原决定过期、线程有新回复 | 原步骤不新写，已有成功不回滚；旧 unknown 不被改成 failed/未执行，仍核验 |
| F16 | 旧 unknown 核验或有效幂等重试缺授权，等待/取消/丢事件/恢复 | 全阶段 Step unknown/Proposal waiting_verification，授权需求只在内部；旧 attempt 原样留存。恢复先核验并重验准备，只有权威未执行证明才可等待权限的未执行语义 |
| F17 | not_found 非权威/分页不全/读副本延迟 | 保持未知，callWrite 增量 0 |
| F18 | 授权等待或恢复时幂等期将尽/已过、时钟跳变、工具换版本 | 重算原保证期限，不续期/换键/新账号；期外不发新 attempt，旧未知保持 unknown/waiting_verification，不因有效保证曾允许重试而改未执行；权限允许才继续只读核验 |
| F19 | 条件读取后源更新，写前旧执行器恢复 | 再验/源原子条件拒绝或明确限制，不声称消除 TOCTOU |
| F20 | 提醒落库失败、到期与取消竞争、睡眠多次唤醒，提醒 at 晚于批准期 | 不假安排成功；批准期内已安排提醒可在期外去重/勿扰投递且无额外外呼；混合步骤未全核实成功不安排，成功取消不投递 |
| F21 | outbox 投递失败、客户端离线/超出重放窗口 | 当前快照重新同步；不把成功步骤再执行、不偷偷转飞书 |
| F22 | 清统计/关闭统计同时旧事件重放 | generation 丢弃旧计数；不从 audit_ 重建；业务审计仍在 |
| F23 | 从远端已写前的备份恢复/升级失败恢复 | 恢复隔离与核验，不依据旧 pending 或 lease 重新发送 |
| F24 | 上游回包伪造成功 ref/错误夹 token 与正文 | 结果核验失败保留未知；日志/审计/通知无秘密，不能误计 completed |
| F25 | 迟到成功和先到错误/多次 found 并发 | 成功事实不被覆盖；单次计完成，下一步只领取一次 |
| F26 | 原草案双键不同；物化后在 Schema/预览/hash/冻结/外呼前篡改或删除一个键 | 每处拒绝/停止，callWrite 增量 0；不发送时补/改键，不用能力原键；同修订再次预览保留两份相等权威键 |
| F27 | granted 已在流程期内完成，恢复事件晚于请求 expiresAt；另注入 pending 超时、当前凭证过期/撤销与决定过期 | 合法 granted 不因请求截止失效，pending 超时不授权；当前账号/凭证/Policy/源条件和决定期限独立核验。只允许符合条件的新写；旧未知仍待核验，U07-05 查询未闭环不伪造路径 |
| F28 | 旧 unknown 仅靠有效幂等追加同键新 attempt，随后 started/确定失败/核实成功或权威未执行 | 两份键及冻结 args 与第一次相同；新 started/失败时对外仍 unknown/waiting_verification，旧 unknown 记录永久不删改。核实逻辑成功才记 succeeded；权威未执行且排除迟到后才可 waiting_auth，成功步骤不重放 |
| F29 | 实际装配误注入完整 Broker/credential；非秘密返回值或错误载体夹带合成 token、Credential 对象/嵌套引用，含 Omit/类型断言伪隔离反例 | 装配/交付边界拒绝，执行器不能获得方法或携密实际对象，适配器外取密调用数 0；非秘密结果白名单不携密，不能靠事后删 token 或只检查 act_ 无 token 通过；公共边界未闭环不发送 |
| F30 | 阻塞宿主取密/刷新、排队/限流/发现或 transport 最后 await，期间过期/撤销、scopes 变化、同账号重授权/换账号、工具版本变化；另对可能已派发请求注入同类变化/坏回包 | 最后等待后核对冻结账号/原决定/工具版本/捕获授权 epoch 与凭证代际；合法刷新仅受信原 operation/CAS 转换，不给旧 token 贴新代际。派发前不合格则远端发送增量 0，started 不冒充已派发；已可能派发仍 unknown/核验。未解除旧 unknown 全阶段保留，不抹历史、不改双键或冻结 args |

### 7.4 外部幂等与核验依赖的验证门槛

本设计不声明飞书、Gmail 或 GitLab 某个写 API 已有幂等能力；MCP 本身、ToolSpec.provider_key、dryRun、测试模拟和本地唯一键都不是厂商保证。各 MOD-04 必须为每个可写工具提供官方 API 文档链接、准确接口/权限/版本、验证日期及经批准测试账号证据，MOD-03 宿主验证登记后 MOD-07 才能使用。

| 门槛 | 要求的证据 | 未通过的处置 |
|---|---|---|
| G01 MCP 互操作 | 目标协议/SDK 的 discovery、stdio/_meta、工具 Schema、版本与错误 structuredContent 实测；凭证不回传 | 相关连接器不可执行，不凭 ADR 中版本号认定兼容 |
| G02 写入效果与预览 | 全部副作用字段、实际路由、正文/附件、相等双键在最终 args/Schema/预览/hash/外呼中的一致性及 dryRun 无副作用证明；result 匹配规则 | 无完整预览或双键不符禁止批准/外呼；dryRun 不走未经批准 callWrite |
| G03 账号与权限 | account 稳定绑定、scopes 增量/撤销、错误是否确定未执行；OAuth 恢复区分 pending 流程期限、granted 终态和当前凭证。宿主认证适配器取密/刷新及实际派发点代际/期限核验，执行器只接收非秘密载体的装配/返回证据 | 缺身份/权限或非秘密边界语义禁止执行/恢复；授权不解除未知结果，Credential 不返执行器 |
| G04 幂等作用域 | 同账号/工具/连接实例相等双键同冻结 args 的串行、并发、丢回包；跨账号/工具键行为；不同内容同键拒绝，旧未知留存 | 未通过按 none；有效保证只允许受控同键尝试，不当作权威未执行 |
| G05 幂等期限 | 官方 retention/起点/刷新/期外语义；授权等待/恢复跨边界、重启、迟到请求、时钟余量验证 | 期限不明/过期无有效保证；不因授权或 retry 续期，旧未知仍保留 |
| G06 权威核验 | found 匹配完整效果；not_found 的账号/分页/权限/最终一致性/保留范围证据；旧请求迟到排除 | 非权威视 unknown，禁止盲重试 |
| G07 条件与竞态 | 源当前读取/hash 算法一致性、线程分页完整性、读写间原子条件支持与限制 | 不宣称严格原子；需强保证的动作拒绝，缺核验不可写 |
| G08 故障恢复 | 真实受控丢回包、重复调用、凭证过期、限流/超时、升级及部分成功验证 | 相关自动恢复路径关闭，明确未验证 |

官方 MCP 依据来自 ADR-0009/0017：<https://modelcontextprotocol.io/specification/2026-07-28>、<https://modelcontextprotocol.io/specification/versioning>。它们只说明目标协议依据，不证明三厂商 API 幂等/权限、SDK 互操作或本设计已验收。不能把“官方未说明幂等”推断成“实际上支持”，缺证据默认无保证。

### 7.5 M1/M2 闭环与双平台验收

**M1**：create/preview/decide 明确不可用；没有落库决定或成功统计；团子和控制台展示不能替做事；已有报告、静音本地互动不受动作层空实现影响。平台双端启动/退出/离线由对应模块联合冒烟。

**M2 自动测试**：待相关公共契约闭环及模块批准后，在假源系统验证查背景、起草、相等双键完整预览、白名单编辑、认证决定、缺权限、绑定授权恢复、当前条件、写入及核验联动；跑 I1–I35 与 F01–F30，新增执行器无 credential 能力/携密实际载体、宿主最后 await 后派发检查的联合断言；保留旧 unknown 授权等待/取消/丢事件/恢复及期限变化不失真、granted 请求期限与当前凭证独立。多通道先本机/控制台/CLI，飞书卡片须 Q6 真正可用；多步骤同名字段目标测试等待主会话 ADR/契约修订，不把 fail-closed 当最终功能验收。

**M2 授权后真实体验测试**：由用户主动选实际 Gmail/GitLab/飞书事项，记录源系统执行前后、决定快照、结果核验和人工核对；至少一条真实闭环含权限不足恢复、无重复发送、无内容漂移。三厂商某项权限不可用时选已授权事项并明确覆盖范围，不造数据代替真实体验。

**省时报告**：至少 3 个相近真实任务的手工/辅助耗时、中位值、等待口径、样本与失败/纠错成本；目标下降 ≥30%。未达标先改善任务流程，不扩养成数值掩盖。产品统计与不可删除审计分别验证关闭/清理。

**双平台**：macOS/Windows 各执行 SQLite 事务崩溃、JCS 一致性、租约暂停/恢复、时区/睡眠、授权取消/恢复、进度离线重连和无凭证日志测试；安装、系统凭证、自启/重复实例由 MOD-01 和 MCP 互操作由 MOD-03 提供证据。尚未实测的一端不得宣称双平台验收完成。

## 8. 未决问题

U07-01–11 的统一分类、责任与裁决方向以 [Q13](../open-questions.md#q13-第一批详细设计接口协调)、首轮评审及首轮修订复评为准；R07-01–03 已满足设计修订要求，新增 R07-04 仅收紧凭证交接，非秘密边界仍与 MOD-03 Q06/Q10 联合未决。只是协调目标，未宣称任一 U07 项已补齐，也未更新冻结公共契约。本稿只修本模块，禁止新增可自报身份、私有跨模块事务或 edits 替代编码；公共契约/ADR/其他模块由主会话统一修订。P0=相关路径实施前需闭环；P1=相应里程碑交付前需闭环。M4 项不阻塞 M1/M2。

| 编号 | 级别/分类 | 冻结约定与未闭环点 | Q13 协调责任/目标 | 安全边界/放行证据 |
|---|---|---|---|---|
| U07-01 | P0；既有强制语义需组合证据 | 可信认证与入口隔离已强制，不是再加可自报 Actor；list/preview/decide 的暴露和披露绑定待证据 | MOD-01/08/07，主会话定依赖；受信组合根绑定本人、渠道和调用范围 | 伪造本人/渠道/跨 owner/能力直接决定均拒绝；本稿不改签名 |
| U07-02 | P0；确需公共工具描述 | Schema、语义版本/digest、完整预览与 pin 尚缺；输入含键是 §3.3 已有规定，本稿修正相等双键映射，不新增 ctx 字段 | MOD-03/04/07：受信公共工具描述、版本绑定、宿主执行一致性和完整路由/附件预览 | 最终 args/双键/Schema/hash 一致，批准后描述变更拒绝；G01/G02；缺描述不执行 |
| U07-03 | P0；需 ADR/契约修订 | Record<path,value> 仍有跨步骤歧义；最终不能靠禁止两个步骤编辑正文来解决 | 主会话及 MOD-07/08/12：无歧义 `(stepIndex, JSON Pointer)` 条目，ADR、受影响设计重评和新版基线证据 | 修订前拒绝歧义、不私改 Record 语义；修订后双步骤 `/body` 独立编辑测试 |
| U07-04 | P0；联合登记/外部验证 | 当前定位/contentHash/分页完整性/核验权威性需统一，不要求全部塞入 Precondition | MOD-02/03/04/07：登记元数据、查询结果约束及远端幂等/原子条件证据 | G06/G07，未验证保证不使用；有效幂等不解除旧 unknown，不宣称消除 TOCTOU |
| U07-05 | P0；确需公共授权查询/幂等建立及非秘密边界 | 仍无请求权威终态/完整绑定、幂等 requestGrant 与经核验的非秘密实时账号/scopes/授权状态/有效性/代际边界；status.granted/authorized 不提供完整保证，事件只是唤醒 | MOD-03/07 与 MOD-01/06，主会话合并 MOD-03 Q06/Q10：受信冻结执行/授权代际绑定、恢复隔离及最终派发核验；pending expiresAt、既成 granted、当前凭证与原决定期限独立。秘密只由宿主受信认证适配器取得/刷新，不私增 API/通用抽象 | 建请求/落链接、丢/重复事件、取消/流程过期和旧未知恢复；F29/F30 真实装配/载体无 credential/token、过期/刷新/撤销/账号及代际变化、派发前拒绝/派发后未知；未闭环 fail closed，不用 Omit/自报状态/携密对象补缺 |
| U07-06 | P1 M2；确需结果/提醒公共能力 | 认证执行快照、逐步结果、提醒查询/取消、持久化投递/resync 边界未闭环；人工说明非厂商证据 | MOD-07/08/06/11：公共查询/取消、人工核对记录与可核验结果分开 | 取消/投递竞争、未知授权状态真实；无法安全取消不发布稍后，不私写 rt_/ui_ |
| U07-07 | P0；确需来源/出口载体 | 带 owner 的依据、工具结果/受信用户输入、Proposal/Preview 最高敏感度和出口约束待补 | MOD-02/03/05/06/07/08/11：受信证据、全出口过滤；用户输入不靠自报来源建立批准 | 来源不足拒绝执行/外发，外部内容不洗白成用户规则/批准，不广播完整 args |
| U07-08 | P0；既有事务强制语义需证据 | 同步 Tx 与业务/审计/outbox 原子性已冻结；稳定审计 id、备份隔离、实例/时钟边界待细化 | MOD-01/06/07 补回滚/去重/恢复证据；若确需新恢复信号由主会话补公共契约，不另造私有 Tx | 同事务故障全回滚、备份恢复/旧请求迟到不重发；started 前审计失败不外呼 |
| U07-09 | M4 后置；不阻塞 M1/M2 | 内部共享处理器仅保留 M4 目标，当前无专项登记/本地事务边界 | 主会话、MOD-10/07：待 MOD-10 设计后 M4 契约与专项评审，不提前扩通用执行器 | M2 sharing.* feature_unavailable；不假 MCP、不绕过决定，不提前实施登记 |
| U07-10 | P1 M2；确需统计/反馈入口 | 无正文统计开关/清除、主动测时及反馈 Reader 未闭环，清除代际不得从审计重建 | MOD-07/08/09/06：公共统计/反馈读取与 generation | 清除/重放测试及至少三个真实任务；执行成功不依赖统计，不用采纳量估工时 |
| U07-11 | P1 M1；既有不可用语义需统一呈现 | feature_unavailable 与 ChatChunk.error 已有要求，不改为伪成功或新聊天协议 | MOD-01/06/08/07，主会话统一 code/HTTP/CLI/宠物映射，不改方法语义 | 空实现无决定/完成事件，错误呈现一致；不返回假 id |

Q13 已认可 M2 内部默认提议 24h、预览 15min（受信工具可缩短），混合步骤只在全部核实成功后安排提醒，提醒到期可晚于批准期且届时无额外外部动作；这些认可不等于公共契约闭环、实现或复评通过。附件预览前绑定并写前重验。外呼超时/租约/幂等余量/核验预算数字仍待实测，pending 更新不延长期限及备份恢复隔离说明仍待评审；本稿不私定厂商保证。

## 9. 变更记录

- 2026-11-19：建立 MOD-07 详细设计，状态待评审；完整阅读指定愿景、README、架构五文档、体验规格、ADR-0007/0009/0016/0017 和模块模板。明确冻结决定、实时条件、AuthResume、未知核验、审计所有权、提醒/内部处理器边界及 I1–I35/F01–F25/G01–G08 验收计划；公共接口缺口仅列本模块并回报主会话，未修改其他文档。
- 2026-11-19（首轮退回修订）：依首轮评审 R07-01/02/03 与 Q13，修订 §2.2–2.3、§3.1–3.2、§4.1–4.3/4.5–4.12、§5、§7–8：权威双键预览前物化进最终 args 并全阶段校验；旧 unknown 的授权等待/幂等重试维持真实对外状态及永久历史；区分 pending 请求流程期限、granted 终态与当前 Credential；按统一分类保留 U07-01–11 未闭环、多步骤编辑待 ADR/契约修订、M4 后置，并明确批准期内安排晚到本地提醒。更新 I29–I31/F14–F20/G02–G05，新增 F26–F28；测试未执行。仅修改本模块设计，状态待复评、未批准实施，不宣称接口已补齐或自评通过。
- 2026-11-19（R07-04 定向修订）：依首轮修订复评，仅修 §2.1、§4.6–4.8、§5–8 的凭证交接边界及相应安全/测试/未决说明：执行器无 credential/完整 Broker/携密 Credential；取密/刷新与最后 await 后真实派发核验仅由宿主受信认证适配器承担。非秘密当前账号/scopes/授权状态/有效性/代际与 U07-05、MOD-03 Q06/Q10 合并为公共未决，不私增接口或用 Omit/断言伪隔离；补 I7、装配/实际载体计划及 F29/F30。保留主会话已确认满足的 R07-01–03 双键、旧未知全阶段状态及期限三分，提醒安排语义和 M4 后置不变。仅修改本模块文档，未运行测试/新探针/授权/外部动作，未改公共契约/配置/权限；仍待复评、U07 未闭环、未批准实施，不自评通过。
