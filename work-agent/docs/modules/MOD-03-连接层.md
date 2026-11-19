# 模块：MOD-03 连接层

- 状态：待复评（R03-01–05 设计修订已满足；R03-06 定向修订待复评；B01和公共Q未闭环，未批准实施）
- 复评依据：[MOD-03 首轮评审及 R03-01–05](../reviews/2026-11-19-module-design-batch1.md#mod-03-首轮详细设计评审)、[首轮修订复评及 R03-06](../reviews/2026-11-19-module-design-batch1.md#mod-03-首轮修订复评)、[Q13 MOD-03 协调](../open-questions.md#mod-03-连接层协调)、[MOD-07 R07-04 当前设计](MOD-07-动作层.md#21-实现和使用的冻结接口)；保留 R07-01–03 已修语义。首稿 SHA-256：`1e29d4ef87d2e33cf7137a65d3f4f723a5308e9d92b3d51fc1d7beceebb340a3`；首轮修订 SHA-256：`c3d1279c8911983bb5474db6b201765dd5c0aeabea98076e793804f8c38d6e51`
- 负责会话：MOD-03 连接层详细设计会话
- 依据的架构版本：architecture v1，2026-11-19 冻结的评审修正版
- 相关 ADR：0004、0009、0011、0016、0017；旧 ADR 与冻结契约冲突时以 ADR-0017 为准
- 更新：2026-11-19（R03-06 定向修订）
- 交付性质：仅设计。未运行授权、同步、第三方 MCP 或平台探针；未实现产品代码。第 8 节阻塞闭环并经主会话评审前，不进入相关实现。

## 1. 目标与范围

### 1.1 目标

统一管理本机连接实例、受信连接器进程、逐源授权、指定认证适配路径内的短期凭证注入和图谱同步。飞书、Gmail、GitLab 可独立配置；一个源未授权或离线，不阻止其他源形成有明确覆盖范围的工作线索。第一项用途是近期会议负荷和工作事件，不把事件数换算成工时。

M1 保持 metadata-only/self-only 读取底座；正文载荷与受信公共边界未闭环前不拉正文，M4 共享后置。断源即停止读取，缓存/派生/模型/主动通知用途按受信即时源政策禁用；留存与本人明确清理分开，不能借清理秘密自动删除工作历史，也不自动重新开放隔离缓存消费（政策公共能力待 Q13）。M2 为执行器提供冻结决定约束的写调用与核验支持。新增受信连接器包、Provider 及登记不应要求改宿主业务分支；新增实体类型仍须 MOD-02 Schema 登记和主会话批准。

### 1.2 不做

- 不写提议、决定、执行步骤或补偿状态；这些归 MOD-07。
- 不调用 LiteLLM，不提供模型规划循环，不生成规则记忆，不发送用户身份的通知。
- 不修改图谱表、中央审计表、运行时 outbox 表；分别调用 WorkGraphWriter、AuditWriter、EventBus。
- 不默认开启自启、浏览器授权、第三方包、屏幕读取或办公写权限。团子自娱不能触发连接层。
- 不提供插件市场、远程代码热加载、通用沙箱或通用 exactly-once 保证。第三方 MCP 是用户身份下的受信本机代码，不是隔离容器。
- 不迁移 POC 的明文配置、命令行凭证传递或硬编码账号；不读取现有 .env、钥匙串内容及公司数据。

### 1.3 实施分段

| 阶段 | 本模块交付边界 | 必须先满足的门槛 |
|---|---|---|
| 详细设计 | 本文及本模块未决问题 | 主会话一致性评审；本文尚未批准 |
| M1 前置探针 | 获单独许可后的合成数据协议/平台探针 | P01–P09；当前 SDK 阻塞 B01；不得拿真实账号代替合成协议测试 |
| M1 | 三源逐源授权、只读工具、增量同步和手动近期读取 | Q01–Q05、Q08–Q10 的读取相关部分闭环；各源外部权限另行实测 |
| M2 | 执行器专用写调用、等待授权后的安全恢复、核验工具 | Q06、Q07 闭环；冻结步骤、结果未知与真实任务验收 |

## 2. 对外接口

### 2.1 唯一公共依据

接口保持 `architecture/contracts.md` §1.1、§2.4、§3、§4.1、§5.1、§12 原样。本文不新增已生效公共类型，也不修改公共契约。

| 接口/类型 | 本模块提供或使用 | 授予范围与约束 |
|---|---|---|
| ConnectorHost.list/tool | 提供 | 返回登记清单、非敏感账号标识、授权与健康状态；authorized 只供展示，不是实时凭证有效性或授予工具权限的证明 |
| ConnectorHost.callRead | 提供 | 调用者由受信入口确定 Actor；校验运行时声明范围、实例与工具允许列表；只能调用审核后的 read，返回值/错误不得携密 |
| ConnectorHost.callWrite | 提供 | 只把入口交 MOD-07 执行器；M1 明确 feature_unavailable。其他模块仅可见无 callWrite 的投影；所有外部投影均不暴露认证依赖或携密对象，不导出可取得完整宿主的工厂 |
| AuthBroker.status/credential | 提供 | status 不返凭证且 granted 仅供展示；credential 实际返回含 accessToken 的 Credential，只能由指定受信认证适配路径取得。执行器、普通调度、Reader/能力及 Host 普通编排/外部投影均无此方法或携密返回值 |
| AuthBroker.requestGrant/completeGrant/cancelGrant/revoke | 提供 | 受信装配只向相应入口绑定已有方法，不交完整 Broker。requestGrant 由认证用户设置或 MOD-07 受信授权 phase 发起；completeGrant 的 state/code 只交指定认证回调适配路径。未知核验保持 unknown/waiting_verification；连接器和模型没有授权入口。回调、幂等就绪/查询及 token 接入缺口见 Q01–Q03/Q06 |
| AuthProviderRegistry | 提供 | 组合根显式登记受信 Provider，携密 exchange/refresh 路径只供指定认证适配器；重复 id 或未批准版本拒绝启动，不以新版本覆盖旧实现 |
| AuthProvider/ProviderGrant | 使用 | 适配厂商的 URL、换码、refresh；实际携密回包只在指定受信认证适配路径内接收/核验，不交普通 Broker 编排或执行器，不直接作为授权证据 |
| ToolResultReader | 提供受限 Reader | 宿主保管新建白名单 ToolReadResult，网关按引用读取；无 Broker/credential/SecretStore 或携密引用，调用者与账号范围绑定缺口见 Q05 |
| WorkGraphWriter.applySync | 使用 | 只在同步引擎注入；传 SyncBatch 和同步的 cursorCommit 回调 |
| WorkGraphReader/EntitySchemaRegistry | 使用 | 读取来源敏感度、校验实体 Schema；不以陈旧图谱代替写前源系统核验 |
| StorageService/SecretStore/Logger/AuditWriter | 使用 | 仅拥有 conn_/auth_/sync_；SecretStore 仅注入指定受信认证适配路径，普通 Broker/Host 编排和同步引擎不获该依赖 |
| EventBus | 使用 | 发布既有 auth.granted/auth.revoked/sync.completed；图谱实体变化由 MOD-02 发布；订阅 auth 事件需幂等 |

组合根必须在运行时隔离普通编排与指定认证适配路径：执行器、普通调度、Reader/能力和 Host 外部投影不可达完整 Broker、credential、SecretStore、携密 Provider/SDK 对象及错误。只绑定许可方法不等于把完整对象套 Omit/类型断言；不得返回原 Credential、共享嵌套引用、原错误的 cause/response/request，或先交付再删 token。携密调用闭包及其必要序列化/transport 只能在指定路径内，普通编排只接收新建白名单非秘密值/错误；该装配与公共边界尚待 Q05/Q06/Q10 联合证据，不宣称现有接口已经实现隔离。

执行器准备/恢复所需的受信非秘密结果，仅包含当前账号、所需 scopes 的核验值、凭证期限/有效性判定、授权 epoch 与凭证 generation，绑定原 source/冻结步骤/决定和验证时点；只从经核验元数据逐项新建白名单值，scopes 新建数组，不投影或透传携密原对象。status.granted/authorized 不能代替该查询；非秘密权威载体、请求终态/幂等恢复与 U07-05/Q06/Q10 仍待公共统一，未闭环 fail closed，不私加 API 或接受调用者自报 verified。

同步引擎没有已冻结的公共服务接口，调度、手动运行、取消及覆盖范围读取记 Q04。不得让 MOD-06/08 import 本模块内部方法或直接写 sync_ 表来弥补缺口。

### 2.2 调用的信任链

1. 组合根绑定已认证节点主人、Provider 登记、进程启动规格和允许工具；指定认证适配路径独占取密/refresh/携密序列化与注入，普通对象无其依赖。外部 Actor 字段不能自报用户身份。
2. MOD-06 的 ctx.tools 只转发该能力 requires.readTools 中允许的名称；本模块再核对 conn_tools 中的审核记录与启用状态。仅知道名称不能调用，范围 Reader 不得到认证对象。
3. MOD-07 执行器先检验冻结决定、当前策略和源系统前置条件，只通过待统一的非秘密受信载体预验账号/scopes/期限有效性/授权及凭证代际，再调用写入口。ctx.executionId/stepId/account/decisionHash 不是新批准，不能凭字符串伪造授权；预验不是最后取密派发许可。
4. 普通 Host 编排核对非秘密实例/工具登记与参数 Schema；不接纳调用者传入的协议 _meta、凭证或重定向端点。指定认证适配器在所有异步等待后核原票据、取密/合法 refresh 并于真实 I/O 前执行 §4.7 最后闸门；普通编排不接收其 Credential、请求 envelope 或原错误。
5. 跨模块缺少非秘密权威查询、冻结步骤验证/版本查询及恢复隔离的部分列 Q05/Q06/Q10，与 U07-05 合并；未闭环 fail closed，不能偷偷查询 act_ 表或私建 API，也不宣称现有 ctx/status 已能独立验证全部决定/实时授权事实。

## 3. 数据模型

### 3.1 实例身份、账号与命名空间

- SourceId 是连接实例的稳定 id，而非厂商名。建议新实例由宿主生成 `conn-<ulid>`；provider 单独存 `feishu`、`google`、`gitlab` 或受信登记 id。实例显示名可以编辑，SourceId 不变。
- 宿主登记记录是 source 的权威值。连接器清单中的 source 不能自行选择或占用另一个实例；实例化清单时绑定宿主 id，校验实际清单与登记一致。实例化清单注入机制见 Q08。
- 账号绑定使用厂商确认的 issuer/服务实例、租户和本人账号标识。优先不可变 subject/native user id；不能只信 login_hint、用户输入邮箱、模型或连接器返回的 account 字符串。首批 Provider 必须证明最小权限下可核验本人身份；若只能得到可变邮箱，发生变化按账号不一致处理，不能推断自动迁移。见 Q03。
- owner 是本机图谱 self().id，与远端 account 不混用。同一本人的多个源可以共用 owner，但所有实体 id 使用 `<SourceId>:<type>:<native id 的无歧义编码>`，跨账号/租户相同 native id 不碰撞。
- 第一次授权把未绑定实例变为 bound；同账号重授权可保持 SourceId。账号、租户、issuer 或客户端身份改变不能覆盖原绑定：旧源断开，新建实例，旧提议不能在新实例执行。
- `binding_epoch` 单调增加，断开、授权撤销或配置失效都使在途调用失去提交资格。换账号不是提高 epoch 后复用旧源，而是新 SourceId。
- 同账号的多个实例不自动共享 grant 或 scopes；逐实例记录用户同意。禁止复制同一 refresh token 到多份独立可刷新的记录；确需共享 grant 的扩展要先设计显式映射与逐源同意，不能复制令牌绕开刷新锁。
- EntityId/SourceId 的语法只由宿主规范化；不把 qualifiedName 按第一个点随意切分，按已登记完整映射解析，避免第三方工具名中的点造成路由歧义。

### 3.2 持久化表归属

以下均为模块内部逻辑结构，字段落地前通过 MOD-01 迁移登记，不作为公共接口。时间字段均 UTC 毫秒；审计 detail 不放正文。

| 表 | 关键键与字段 | 职责 |
|---|---|---|
| conn_sources | source PK；providerId、providerVersion、owner、accountBinding、binding_epoch、enabled、manifestVersion/hash、configHash、health、createdAt | 稳定实例、非秘密绑定、启用与健康状态 |
| conn_registrations | registrationId PK；包版本/hash、显式信任证据引用、启动规格引用、协议探针结果引用 | 受信包登记；不记录令牌或整个父进程环境 |
| conn_tools | (source, localName) PK；qualifiedName UNIQUE、ToolSpec、输入/输出 Schema hash、审核版号、allowedActors/用途范围、敏感度下限 | 安装、可见、允许调用、允许凭证四件事分别记录；动态清单不自动放权 |
| conn_tool_results | resultId PK；source、owner、accountBinding/epoch、actorScope、tool/版本、sensitivity、evidence、createdAt、expiresAt、normalizedValue | 仅标准化且受限的工具结果；不是原始 MCP 回包存档 |
| auth_providers | providerId PK；登记版本、kind、批准 issuer/端点/clientId/能力策略的非秘密引用 | 版本冲突与端点策略索引；客户端 secret 只在 SecretStore |
| auth_grants | source PK；accountBinding、epoch、状态、grantedScopes、用户允许的 scopes、credentialExpiresAt、activeSecretKey、generation、currentOperationId、pendingSecretKey | 仅指向已验证生效的 envelope；generation 每次生效/失效单调增加，撤销后保留无秘密的世代记录，不能重置 |
| auth_requests | requestId PK；stateHash UNIQUE、source/provider/版本、owner、请求 scopes、expectedAccount、reasonCode、requestedBy、resume 各字段、resumePhase/工具版本绑定、epoch、requestVersion、pendingExpiresAt、grantedAt、publicStatus、internalPhase、secretKeyRef、consumedAt | 请求期限与既成授权分开；requestVersion 是取消/过期的独立屏障。state 原值、PKCE verifier、换码 code 不入库；resumePhase 来自受信执行验证，不接受自报字符串 |
| auth_operations | operationId PK；kind、source/requestId、capturedEpoch/generation/requestVersion/providerVersion、producerInstance/bootId、producerState、invalidatedAt、barrierId、finishedAt、CASResult | prepare/exchange/refresh 的持久 producer 生命周期；running/finishing 不等于已停止。revoke/cancel 屏障亦有 operation 引用，不等待网络锁 |
| auth_operation_keys | secretKeyRef PK；writerOperationId FK、source/requestId、role、registeredAt、writeState、retiredByOperationId | 每个 pending/staging/active 键写前预登记且不可复用；CAS 切指针不删除记录。保留仍可能 set 的 producer 与全部输出键关联 |
| auth_cleanup | secretKeyRef PK/FK；writerOperationId、invalidatingOperationId、source/requestId、reason、state、revision、attempts、nextAttemptAt、deleteConfirmedAt | blocked_producer → ready → deleting → confirmed；切/清指针同事务预登记。只有 producer 结束且删除确认后才可移除任务/键引用 |
| sync_streams | (source, stream) PK；owner、mode、committedCursor、binding_epoch、scope/config/versionHash、enumerationEvidenceId/version、missingDeletionEnabled、tombstonePolicyRef、lastReadAt/lastSuccessAt、coverage、nextEligibleAt、失败预算 | 读取结束与可对账完整覆盖分开；missing 删除默认关闭 |
| sync_stream_evidence | evidenceId/version PK；Provider/流/端点与过滤/排序版本、官方证据引用、测试引用、允许上游变化、enumerationRule、missingRule、tombstoneRule、适用边界、批准记录/失效条件 | 内部逐流受信资格登记，不接受连接器自报 complete；window/primary/support/deletion 公共语义仍待 Q08 |
| sync_runs | runId PK；source/stream、状态、leaseOwner/generation/expiry、触发引用、预算、cancelRequested、errorCode | 一条流一个有效写租约；网络期间不保持 SQLite 事务 |
| sync_snapshots | snapshotId PK；owner/source/stream、固定窗口、epoch、查询/过滤/版本 hash、enumerationEvidenceId/version、runId/leaseGeneration、status、pageSeq、nextCursor、chainEnded、coverageReason、startedAt/completedAt | 页链结束不是完整性证明；末页 CAS 必须验证原范围/证据版本和预期页/输入游标 |
| sync_pages | (snapshotId, pageSeq) PK；requestCursorHash、nextCursor、acceptedAt、counts | 已提交页和连续页序检查；没有实体正文或原始接口响应 |
| sync_seen | (snapshotId, entityId) PK | 宿主已见集合，用于完整性/诊断；对账删除实际由图谱自身维护归属与已见集合 |
| sync_event_receipts | (subscriptionId, eventId) PK；at、scheduledRunId | auth 事件幂等受理；与调度状态同事务 |

游标是允许持久化的同步参数，但不能包含 bearer 凭证。连接器输出含授权签名或令牌的分页 URL 不得原样作为 committedCursor；须改为不含秘密的游标编码，无法满足则阻塞该流。记录游标的 hash 而非值到日志。

### 3.3 SecretStore 与跨库提交

仅 Broker 的指定受信认证适配路径经 MOD-01 SecretStore 操作以下键；实际 envelope 的解析/验证/必要序列化亦限定该路径，普通 Broker/Host 编排只接非秘密引用、原 operation/CAS 元数据和状态。键使用本机随机 id，不含邮箱、code 或 token：

| 秘密类别 | 存储和使用 |
|---|---|
| Provider client secret（确需时） | 单独凭证键，仅认证适配器在调用批准 token 端点时读取；桌面包中的 client secret 不承诺是不可提取的保密凭据 |
| grant envelope | 一个键内保存 accessToken、refreshToken（若有）、已验证 account/scopes/issuer、generation/operationId；每键原子替换能力须 MOD-01 实测 |
| pending OAuth envelope | state 原值、PKCE verifier/challenge、requestId、epoch、有效期；仅指定认证适配路径，可在同 TTL 内恢复待授权请求 |
| staging grant envelope | 新授权/refresh 的结果先落独立键，待 SQLite CAS 指向后成为 active；未生效结果不返回调用者 |

**跨库恢复协议（R03-01/02）**：SecretStore 与 SQLite 不在一个原子事务。取密/写密和接收换码/refresh 回包的 producer 仅在指定受信认证适配路径内运行；普通状态机只处理非秘密引用和 CAS。网络 producer 可按绑定 single-flight，但 cancel/revoke 的同步持久屏障不取得该网络锁；所有网络/SecretStore await 均在 Tx 外。

1. 启动 producer 前，短事务登记 operationId、原 epoch/generation/requestVersion、Provider 版本、producerInstance/bootId，以及本次全部 pending/staging 输出键到 auth_operation_keys。键随机、一次写入、永不复用；新增输出也须先登记。已有 active/pending 键必须有可追溯 writerOperationId，不允许未知引用切换后丢失。
2. producer 携原捕获值调用网络与 SecretStore；每个 await 后重新检查原操作资格，不以最新 epoch 给旧 envelope 换标签。发起 set 前也检查，但屏障与已经进入系统库的 set 仍可能竞态，因此不能仅凭检查或 AbortController 宣称无晚到写入。每次 set 的进行中状态关联原 operation，所有 set/网络回调结清且无后续写分支后，才能持久 producerState=finished。
3. 新 envelope 包含原 operationId、epoch、目标 generation 和已核验账号/issuer/scopes。验证并写 staging 后，用同步 CAS 核对原 operation 未失效、原 epoch/旧 generation/Provider 版本一致及源未被后来的屏障禁用；有关联授权请求时另核对请求仍 pending、在期限内且原 requestVersion 一致。无授权请求的 refresh 不受旧 granted 请求 TTL 限制。显式重授权只能由屏障之后新建的请求恢复源，旧 producer 不能重新 enabled。
4. **切换 active 指针的同一 Tx**：先将全部被替代/清除的旧 active、pending、非选中 staging 键登记 auth_cleanup（含 writerOperationId 和本次 invalidatingOperationId），保留 auth_operation_keys；再切指针、增加 generation、更新 scopes/账号、请求 grantedAt/终态、审计和 auth.granted outbox。被选中的 staging 成为 active，不能误入删除影响集。CAS 拒绝时另一个短事务将原 operation 失效并预登记其全部输出键；不能仅在 delete 报错后才登记。
5. **取消/撤销/失败的同一 Tx**：按 §4.6 先写屏障、终态，把所有受影响引用与 producer 输出键预登记 cleanup，再清相关指针。正在 producing 的键 state=blocked_producer；即使此刻 get 显示不存在也保留引用与删除意图。producer 晚到 set 或 CAS 失败只能转清理，不能发放凭证。
6. cleanup worker 只处理已退役、未被任何当前 active/pending 指针使用且 writer producer 确认结束的 ready 键；短事务捕获 cleanup revision 并标 deleting，事务外 delete，随后同 Tx CAS 确认引用仍退役、producer 已结束并记录删除确认。delete 失败回 ready、按有界退避保留任务。确认“键不存在”只有在 producer 不可能再写后才有效；该系统库保证仍待 Q10/P09。
7. 删除成功后、确认 Tx 前崩溃：任务和键引用仍在，重试缺键 delete；确认 Tx 后、任务回收前崩溃：幂等回收。仅 confirmed 且无存活 producer/指针才清 cleanup 与该键记录；writer/invalidating operation 只在 producer 结束、全部关联键确认删除且无键/cleanup/当前指针引用后回收，已成为 active 的键仍保留 writer operation 记录。超预算只显示待清理，不因 TTL 丢弃定位引用。
8. 重启先依据 MOD-01 的单实例/进程监督证据隔离旧 producer，确认其退出且系统库在途写已结清后才能标 finished；超时或旧实例租约过期本身不是证明，无法证明则保留 blocked_producer。只读数据库已知键。有效且完整的 staging 才可按**原**捕获值恢复 CAS；cancelled/revoked/旧世代只清理。网络结果或轮换秘密无 envelope 时保持 exchange/refresh_unknown，不重放换码/刷新。

| 影响集 | 同事务保留的引用 | 屏障之后的动作 |
|---|---|---|
| grant/refresh 成功切换 | 旧 active、该请求 pending、未选中 staging、其 writer 和本次 operation | 新 active 仅在 CAS 后可发放；旧键确认删除后回收 |
| cancel/过期增量请求 | 该 request 的 pending、全部相关 producer staging；不退役旧有效 active | 请求版本失效；关联恢复资格终止，正常旧只读 grant 可继续 |
| revoke/断开 | 本 source 全部 active/pending/staging 与尚能写的 operation 输出键 | 源 epoch/generation 屏障立即拒绝；不等网络或系统库删除完成 |
| CAS 拒绝/候选失败 | 原 operation 全输出键与失效原因；保留正在 set 的 producer | 晚到结果不可生效/发放，producer 结清后可清理 |

秘密无枚举能力时，定位依赖这些持久引用，不能依赖内存 finally 或仅预登记新 staging。R03-01 的旧键引用/晚到写闭合与 Q10 的原生每键原子性、删除保证是不同问题；本设计修订不冒充两者已验证。

### 3.4 迁移、保留与恢复

- registerMigrations('MOD-03', ['conn_', 'auth_', 'sync_'], ...)；首版先建实例/工具，再建授权，再建流/快照。后续只追加版本，保留 checksum，迁移前由 MOD-01 备份。
- POC 单表和旧 provider 名不能直接推导新的 SourceId/账号绑定；首次正式使用重新登记、核验与授权，不自动导入公司数据或把 POC 明文/命令行秘密迁入。
- conn_tool_results 默认仅会话期内存；需要持久证据时写标准化结果并限制为 24 小时、单条 1 MiB、每实例总量 32 MiB。保留更久须明确用途与用户设置；过期引用返回缺失，不能当作空结果或降低敏感度。有效冻结执行所需证据保留规则由 Q05 协调，不能由清理任务擅自破坏执行审计。
- 未完成快照默认最长 24 小时且受上游游标寿命约束；到期 abandoned，不删除图谱成员。已完成快照页/seen 诊断默认保留 7 天后仅留范围、时间与计数；这些是产品状态，不是可修改的中央审计。
- 凭证不在数据库备份中。恢复旧数据库不得复活已撤销凭证、重放旧写调用或旧 AuthResume；旧备份与残留旧 key 可能同时匹配旧 epoch/operation，故“二者相等”不是有效授权证明。平台恢复隔离/fence 及旧 producer 退出证据未闭环前，恢复的源保持禁用、凭证不可发放、旧恢复链接无效，登记 Q10 联合验证，不私建恢复公共接口。auth_operation_keys/cleanup 只有按 §3.3 确认后回收，不受普通结果/快照 TTL 清理。备份中的实体保留和删除边界交 MOD-02/01 告知用户。

## 4. 内部设计

### 4.1 组件与职责

```
已认证用户设置 / MOD-07 受信授权 phase
    │ 仅许可的授权方法；不获完整 Broker
    ▼
AuthBroker 非秘密状态编排 ── 指定受信认证适配路径
    │                              ├─ SecretStore / Provider exchange、refresh
    │                              └─ 厂商授权/身份端点（不经连接器）
    │ 非秘密状态/引用
    ▼
ConnectorHost 普通编排 ── 工具登记/允许列表/队列/限流
    ▲                              │ 非秘密调用绑定
    │                              ▼
同步引擎 / MOD-07 写入口     指定宿主认证适配路径
    │                              │ 取密/最后闸门/必要 MCP 序列化及 transport
    │                              ▼
    │                      指定连接器认证适配器 ── 厂商业务 API
    │ 仅同步页进入图谱；写结果/错误返回 MOD-07，不返携密引用
    ▼
WorkGraphWriter.applySync(batch, cursorCommit)
    └─ 图谱变更 + 同步进度 + 审计/outbox 同一 SQLite 事务
```

图中认证适配路径是受信装配的内部职责边界，不是新增公共服务。携密的必要序列化、缓冲及凭证注入必须属于该指定路径；不能把整个 Broker/Host/SDK/transport 实例内存作为许可范围。调用队列、页校验器、锁和普通状态机不接携密对象/错误；实际协议结果先在指定路径内检查，再交付新建白名单业务值。内部组件不向上层导出，进程监督、平台退出机制和路径解析依 MOD-01；装配、非秘密权威查询与恢复的公共缺口见 Q05/Q06/Q10。

### 4.2 ConnectorHost 登记、进程与发现

1. 组合根只加载已登记包。核对包版本/hash、用户显式信任记录、批准的绝对可执行路径/固定参数/工作目录；不使用 shell、npx 在线取包或来源文本拼接命令。
2. 启动用最小批准环境 map，不能展开 process.env。非秘密运行所需 PATH/HOME/SystemRoot 等按平台适配提供的批准值逐项登记，不能把父进程同名值当默认许可；不得继承 LiteLLM、飞书、Gmail、GitLab、本机令牌或公司代理认证信息。
3. stderr 设为受控 pipe，既不 inherit 到终端也不原样写中央日志；按字节上限丢弃并仅记录分类/计数。stdout 仅接受有界 MCP 帧。调试抓包使用合成标记，不含真实秘密或正文。
4. 协议必须先通过 §7.1。目标 modern 2026-07-28：server/discover → resources/read 清单 → tools/list 全部分页 → 清单/Schema/工具一致性校验。发现阶段不传业务凭证。
5. 每请求 protocolVersion/clientCapabilities 是规范 MUST，clientInfo 是 SHOULD；本项目 profile 要求每次也填 clientInfo。server/discover 对 server 为 MUST、client 可选，本项目 client 固定调用；serverInfo 位于结果 _meta 是 SHOULD，本项目 profile 要求存在以便诊断，但自报信息不是信任。连接/进程不代表账号会话，工作扩展 capability settings 仍待 Q08，不自定为已兼容。
6. 清单 extensionVersion=1、流类型/mode/权限、write 幂等与核验声明通过 Schema；核验工具必须已登记 read 且属于明确批准的账号范围。wa_sync_pull 仅对自研 work-agent/connector 登记可用，第三方即便返回同名工具也不参与同步。
7. tools/list 新增/修改、清单 hash、输入 Schema、风险、幂等保证或包版本变化均暂时撤下受影响允许项，健康降级；重新审核登记。冻结写步骤要求重新预览决定，不依靠同名工具维持批准。
8. 单源 offline/degraded 不拖垮其他源。空闲进程可退出；重启后先重新发现，凭证不缓存于进程，不重复派发在途写请求。进程退出先 EOF，限时后由 MOD-01 平台退出能力处理，不在本模块判断 OS。

SDK 1.32.2 的 StdioClientTransport 会把 getDefaultEnvironment() 与传入 env 合并（§7.1 E06），传 env={} 不代表最终环境为空。批准最终环境子集及真实子进程观察是门槛；不能通过清空父进程全局环境、全局 monkey patch 或含 token 的参数绕过。

### 4.3 工具允许列表、结果与来源

**调用资格取交集**：已登记且启用的实例 ∩ 信任审核工具集 ∩ 调用者/能力声明 ∩ 用户授权 scopes ∩ 目标资源范围。manifest/annotations 不是权限。

- 自研工具经受信登记方可按声明 read/write；第三方默认 write/high。第三方改为 read 需要用户显式信任和代码/工具语义审核证据，不能只勾选 readOnlyHint。
- 工具安装与凭证发放分离。第三方默认不获任何厂商 token；确需凭证的工具必须有明确批准的 Provider/账号/用途映射和专门审查的 credential 适配器。不得把自研的 work-agent/credential 广播给任意第三方服务器。
- MCP serverInfo、instructions、description、prompts 和输出皆非可信系统指令。不因“官方服务器”自报名称或只读注解放权。默认不加载 prompts，不支持 sampling/roots；未批准的描述不直接加入模型工具说明，使用登记方审核的描述。
- callRead 只返宿主新建白名单 ToolReadResult。指定认证适配路径内接收实际协议回包/错误并检查字段、嵌套引用和错误载体；携密回传拒绝/隔离，不把原 SDK 回包交给普通结果编排再删字段。value 是经输出 Schema、大小与内容类型验证后新建的标准化业务值，不含协议 envelope、_meta、认证材料或其引用；错误也只交不含认证秘密的白名单，不透传 cause/response/request。不含认证材料不代表业务 sensitivity=normal，结果仍按下述最高敏感度规则处理。第三方 unstructured text 仍是来源数据，资源链接不自动跟随、不打开本地 file URI，不自动下载图片/音频。
- id/source/createdAt/evidence 的可信部分由宿主填写；source 取 conn_sources。实体依据必须经受限图谱 Reader 确认 owner/source/访问范围。连接器不能伪造别的源、user 证据或自行降低 sensitivity。
- sensitivity 取工具输出登记下限、连接器较高初值、实例规则、每条被引用实体/结果敏感度的最高值：normal < confidential < secret。无法确定来源或依据范围就拒绝结果；第三方未知敏感度默认 secret，不能默认 normal。降级只凭用户明确决定的可验证记录（接入缺口 Q05）。
- evidence 可包含宿主生成的本结果 tool_result 引用，但它只是来源定位，不是对事实真伪的核实，不用于递归证明自身已可信。结果内部记录工具、账号/epoch、参数 hash、抓取时间；由 Reader 提供可信边界。
- 工具结果不得升级成 instruction、人格/规则记忆或未经通知出口检查的文本。网关按 tool_result id 解析并再次过滤，通知、报告和转渠道继续继承最高敏感度。secret 不外发或入模；confidential 遵循用户用途与渠道设置。
- 正文读取经 AuditWriter 写 tool_read_content，含工具/id/用途/actor/时间而无内容；常规只读调用日志仅工具名、耗时、错误码、数量。标准化结果异常/Schema 错误也不打印正文。

### 4.4 AuthProviderRegistry

- register/get 按冻结接口；启动登记受信本机适配器，不接受 MCP 服务器或模型提供的 Provider 对象/URL。token/none 不调用 grantUrl/exchange。
- 登记记录固定 kind、包/version、clientId、允许 issuer/授权/token/身份端点、scopes 目录和语义、PKCE S256、回调方式、refresh 是否轮换及保留策略。AuthProvider 类型缺 version 和上述元数据字段：登记提案见 Q09，不把内部表当跨模块隐式协议。
- Broker 的指定认证适配器校验 grantUrl 是批准 HTTPS 授权端点，state/challenge/redirectUri/scopes 与请求精确一致，无任意 redirect 参数。除已批准的本机 loopback 回调外，不接受 HTTP；不根据响应中新 URL 或任意 issuer 动态发现/换端点。网络重定向不得改变 token/身份端点信任边界。
- account/scopes 从受信认证适配器访问允许端点所得证据核验；解析 token 响应的缺字段、有限 expiresAt、issuer、token 类型、已授 scopes。仅请求了 scope 不代表授予成功，不将 oldScopes 与 requestedScopes 简单并集充当新 token 的权限。
- 身份核验不能由普通连接器抢先调用 credential 工具完成；这是受信认证适配路径的受限网络读取。首批身份 API/必要最小 scopes 由 MOD-04 提供官方证据并获评审。
- v1 明确登记客户端，不使用 DCR 或 CIMD 自动注册扩展工作源；MCP HTTP 授权框架不等于飞书/Google 业务 OAuth。未来 remote MCP 授权需独立设计，不能沿用 stdio token 元数据假装通用。

### 4.5 授权请求、PKCE 与回调

目标安全顺序如下；异步秘密写入、完整回调参数和失败状态如何跨模块传递见 Q01/Q02，未闭环不得实现一个可“跳过 issuer”的流程。

1. 核对 requestedBy 的真实身份与作用域、source/provider 一致、源 epoch、最小 scopes、expectedAccount。resume 仅执行器可提交，须经受信验证绑定原步骤/决定/账号/工具版本及内部授权 phase：未执行动作可 waiting_auth；未知核验缺权保持 unknown/waiting_verification，不先改成未执行。设置源授权不自动附任何执行恢复；验证能力待 Q06/U07-05，不能由调用者自报 phase。
2. state 用 CSPRNG 至少 256 位熵，不携带账号/执行信息；数据库存 SHA-256 索引，原值存 SecretStore。PKCE verifier 用 32 随机字节 base64url，challenge=BASE64URL(SHA256(verifier))，仅 S256，不回退 plain。
3. pending 授权流程默认期限 10 分钟，映射公共 AuthRequest.expiresAt；source/provider/版本、client/issuer/redirectUri、scope 集合、expectedAccount、AuthResume/受信 phase、epoch/requestVersion 一并冻结。只有持久请求和秘密 envelope 均就绪才显示 grantUrl。同步建立 pending、后台准备只是 Q13 的候选方向，不能把 requestGrant 必须改 async 当裁决；幂等建立、就绪/查询仍为 Q02 阻塞。
4. MOD-08 仅在用户明确开始授权时打开外部系统浏览器，不在 Tauri 内嵌 WebView 登录，不因同步、缺权限错误或后台重试自行弹浏览器。等待授权只显示经过渠道过滤的请求/角标。
5. OAuth 回调路径独立于业务 API。由 MOD-08 校验回环目标、确切路径、长度/重复参数/Host；不得记录完整 URL、code/state/query，不加载第三方资源。Issuer 和 state 校验后立即清理地址栏或重定向无参数本机结果页，不把凭证带去其他 URL。
6. 换码前核对未过期、pending、state 单次使用、固定 provider/issuer/redirectUri/client/epoch；授权响应 iss 进行 form 解码后精确字符串比较，不做 URL 宽松等价匹配，不从回调 iss 选择 provider。声称支持 iss 的源缺失时拒绝；本项目更严格的冻结 issuer 边界不得自动降级为不校验。
7. state 正确且所有回调边界通过后，CAS internalPhase pending → exchanging、标 consumedAt，只允许一次 exchange。参数中的 error=access_denied 必须经过同样来源校验后取消；没有 code 时不能调用 completeGrant(state, '') 来伪造取消。
8. Provider.exchange 只接收已验证 code/verifier/固定 redirectUri。校验账号等于原绑定/expectedAccount；发现不同账号拒绝当前请求并销毁候选 grant，提示用户另建实例，不覆盖旧令牌、不恢复原执行。
9. 实际 scopes 足够且 SecretStore/SQLite 提交成功才 publicStatus=granted、追加 auth 审计和 auth.granted outbox。部分同意只能如实登记实际 scopes；请求缺必需 scopes 为未完成，不恢复冻结步骤、不反复自动请求。
10. 重启时尚未换码且秘密 envelope 完整的 pending 可在原请求 TTL 内继续；exchanging 无已验证 staging envelope 时记 exchange_unknown 并要求用户重新开始，不二次兑换同一 code。pending 期限届满、时钟异常导致期限不可判定、取消/撤销均以持久屏障阻止未提交候选 grant。已在期限内提交的 granted 不因原请求 expiresAt 后来届满转 expired；继续使用/恢复须独立核验当前 Credential.expiresAt、原决定期限、策略、账号和当前条件。

RFC-9207 的授权响应 iss 与 ProviderGrant.issuer（换码后的字段）不是一回事；只校验 token 回包 issuer 已晚于可能把 code 发错 token 端点，不能替代第 6 步。Provider 实际不支持冻结的 PKCE/issuer 门槛时，记录阻塞、回主会话裁决，不以 POC 已有 PKCE 字段宣称厂商已强制校验。

### 4.6 授权状态与取消/断开

| 内部状态 | 对外 AuthRequest.status | 可发生的下一步 |
|---|---|---|
| preparing/pending/exchanging/committing | pending | 只有完整提交可 granted；异常可以 terminal；preparing 不展示授权 URL |
| verified_committed | granted | 发事件供执行器重新检查；不直接触发写调用 |
| user_cancelled/provider_denied/account_mismatch | cancelled | 清理候选秘密；不恢复原执行；具体失败原因需 Q01 的受限读取 |
| expired/exchange_unknown/recovery_failed | expired | 重新开始新请求；旧 state/resume 不能复活 |

- cancelGrant 仅已认证主人或有明确系统终止职责的 Actor 可调用，幂等。**不等待 exchange/refresh 网络互斥**：同步 Tx 将该 pending 请求置 cancelled、增加 requestVersion、失效其所有 operation；预登记全部相关 pending/staging 的 cleanup 和 producer 引用，再清请求/变更指针并写审计及已有适用 outbox。事务外才发 cancel、等待 producer 结清及删除。回包/set 晚到不改变 cancelled，未知核验的旧 attempt 不因此清除。
- 取消增量请求不是 revoke：不修改原有效 grant 的 source epoch/generation/active 指针，不清旧只读 scopes；其他原本合法的读取可以继续。被取消请求的业务恢复资格仍永久终止，不被后来同 source/同账号新授权代替。granted 是已完成流程，原请求 TTL 不把它取消；用户撤销现存授权走 revoke，不用 cancel pending 语义伪装。
- 同一绑定的 prepare/exchange/refresh 变更 producer 有界串行；替换请求先写旧请求取消屏障再新建，不能改变旧请求。网络锁只约束 producer，不阻挡 cancel/revoke/过期屏障；不同源独立。屏障 Tx 失败须明确报错且禁止该源新派发，不报告撤销完成，恢复时先处理失效状态。
- revoke 以独立同步 Tx 将 source disabled/revoked、递增 binding_epoch 与 grant generation、终止所有 pending 请求和同步 run/租约、失效全部 source producer；**清 active/pending/staging 指针之前同事务预登记全部旧键/操作输出到 cleanup**，并追加审计及 auth.revoked outbox。事务提交就是本机逻辑失效点，卡住 refresh、锁定系统库或慢 delete 都不能延后此点；不等网络锁。已捕获旧票据/凭证的等待者一律拒绝。
- 屏障后在 Tx 外取消网络、驱动 §3.3 的 blocked_producer/ready 清理。删除失败、producer 未结清或超预算保留全部引用并如实显示“已逻辑断开，秘密待清理”，不可报已删；系统库后来可读不自动启用旧 grant。新授权也必须新请求/新 generation，旧同账号票据不得转用。
- 已派发的外部写入无法保证撤回；断开/取消后仍必须由执行器进入结果核验。连接层不以本地取消冒充远端未执行。
- 本机删除与厂商服务端撤销授权不同。冻结 AuthProvider 无 revoke 方法；本模块不偷偷发送远端撤销写请求。用户界面应说明本机已断开/凭证删除结果，远端撤销另行设计。

### 4.7 指定认证适配路径、credential 与 refresh 并发

**credential 不发起授权，也不返回普通执行路径**：仅指定受信认证适配器可调用 credential，校验 enabled、binding、用户允许 scopes 与 grant 实际 scopes，缺少即明确 auth_required；到期且不能合法 refresh 则 auth_expired。真实 Credential 含 accessToken，只能在该路径内处理/注入；普通 Broker/Host 编排、执行器、调度和 Reader/能力不接收它。auth_required 不赋予连接器浏览器权限，requestGrant 仍由许可的受信用户/执行器入口发起，不交完整 Broker。

**两个验证边界（R03-06）**：执行器的早期准备/恢复只消费 §2.1 的新建白名单非秘密账号/scopes/期限有效性/授权 epoch/凭证 generation 验证结果，再重验原决定、Policy 和源条件。该结果绑定原 source/冻结步骤/决定与时点，不是 token、不是 status.granted/authorized，也不是可直接派发的许可。随后宿主的指定认证适配器独立取密、合法刷新、等待并核验实际携密票据，在真实 I/O 前执行最后闸门；不能用早期预验顶替最后检查。非秘密权威查询、请求终态/幂等恢复及运行时隔离仍和 U07-05/Q06/Q10 待公共统一，缺证 fail closed，不私加 API、自报 verified 或让执行器取 Credential 补缺。

增量授权：必须按用途请求差额，并向用户说明现有/新增 scopes。Google include_granted_scopes=true 是 Provider 特有机制，不当所有 Provider 都支持；新 grant 的有效 scopes 是实际验证值，不能以 requested 集合覆盖。取消增量授权可保留旧只读 grant 继续其他工作，但关联的原等待执行已取消，随后任意授权不能复活它。

刷新 single-flight 与持久状态（R03-02；携密步骤仅指定认证适配路径）：

1. 一个守护实例管理 Broker 的非秘密状态，指定认证适配器按 source/account/issuer/client 绑定协调 refresh 与增量 grant producer；不复制同一刷新家族。路径内等待者捕获原 epoch、grant generation、工具/Provider 版本后共享该 refresh operation 的 Promise，不向普通编排/执行器交付 resolve 后的 Credential/envelope，不能只按 source 永久缓存 Promise。cancel/revoke 不取得 producer 网络锁，先按 §4.6 写屏障。
2. 指定认证适配器在 credential 进入/等待出队后核对原捕获值，读取 activeSecretKey 并在 SecretStore.get await 后再检查 epoch/generation/key/operation；envelope 必须与被捕获指针/代际一致。存在 expiresAt 时距现在 >60 秒才可在路径内使用，缺省仅按已登记 Provider 的期限语义处理，不跳过其他检查；不存在/权限不足或票据失效即拒绝，不读取退休键顶替。期限与 token 不作为原对象返回普通调用者。
3. 刷新前短事务登记 refresh_started、原 epoch/generation、operationId/producer 身份和 staging 键；事务外由指定认证适配器调用 Provider.refresh，实际回包/错误和身份核验均留在该路径。网络/身份读取/set 的每个 await 后核对原操作资格。CAS 还须核对当前 operationId、未失效、旧 generation、原 epoch、账号/issuer/client/Provider 版本；增量 grant 与 refresh 不可相互覆盖。
4. 按 §3.3 写 staging、同 Tx 预登记旧键 cleanup 并切新 active/generation。轮换秘密成功持久化及 CAS 后才在指定认证适配路径放行 accessToken 注入。Google 无 refreshToken 回包仅按同 issuer/client/account、受信登记允许保留策略保留原 token；轮换型缺新值不猜测有效。等待者只能接受自己等待的**同一有效 refresh operation**产生并通过 CAS 的新 generation；不能接受中途同账号重授权的其他 operation。普通编排只接新建非秘密 CAS/状态值。
5. invalid_grant/撤销证据只可按原 operation CAS 使对应 grant invalid 并退役/清理相关键；迟到旧错误不能使新 grant 失效。原错误不穿越认证边界，只交新建非秘密白名单错误；不用旧 token 反复尝试，需要新授权时仅提示，不自动浏览器。
6. 已派发刷新超时/断连/崩溃且无新 envelope 保留 refresh_unknown，不重用可能已轮换的旧 RT。重新授权是默认；只有上游明确未接收并有登记证据才按剩余认证预算重试，不把网络异常均标 retryable。
7. 已审核无副作用 read 的 auth_expired 最多一次由指定认证适配器刷新/再读，仍受原调用取消、epoch、版本和预算约束。写业务调用 host 重试 0，只交非秘密授权错误给执行器；共享刷新成功不赋予重发写许可。
8. 屏障提交后旧等待者、晚到 envelope/CAS 和旧同账号排队票据均拒绝，输出仅清理；单个普通读调用取消不撤销其他合法读的共享刷新。取消增量 request 只失效该 request 的 producer/恢复关联，不失效旧合法只读 grant 或无关 refresh。

**从入队到真实 I/O 的原票据**：普通 Host 队列仅保存非秘密调用绑定；指定认证适配器内记录被捕获 source/冻结账号、原授权 epoch、凭证 generation/active key/有效 refresh operation、工具与 Schema/包 digest、scopes/期限、取消标记和原决定 hash/step/started/恢复绑定。实际 Credential、携密 envelope/序列化缓冲和原错误不交普通编排，也不新增公共 Credential 字段或让调用者提供票据。入队、出队、取 credential 及每次队列/限流/发现/SecretStore/refresh/前置条件/transport await 之后均核原绑定；refresh 的明确受信原 operation/CAS 代际转换是唯一允许的刷新更新。其他重授权使旧票据失败，必须由上层重新检查新调用，不能同账号换 epoch 继续。

**最后 await 后真实 I/O 闸门**：指定认证适配器在 transport 实际发出请求前核对 enabled、捕获 source/冻结账号、原授权 epoch、凭证 generation/active key、工具及 Schema/包版本、所需 scopes/期限/取消、原决定 hash/step/started、策略/决定期限和受信当前条件证据。started 已持久化只是外呼前条件，不是已发送证明；原决定/started 的权威事实依待统一受信边界取得，不读 act_、不信 ctx 字符串。校验与交付真实 I/O 间不留 await；必要凭证注入/序列化留在指定路径，若 transport 还有异步等待，闸门必须移到该等待后的实际发送点，不能以 call 返回 Promise 前的一次检查或非秘密预验代替。不能读取“当前同账号/新 epoch”后包装旧 token。

适配器能权威确定请求尚未派发时，最后闸门拒绝属确定未调用、不造 WriteResult；已有旧 unknown 不因此解除。若请求可能已派发，错误/取消/撤销或坏回包仍为 outcome_unknown，不能因 started、abort 或最后检查失败推断远端未执行。派发之后屏障不能证明原子撤回：读迟到结果丢弃、同步 Tx 再 CAS，写按未知/核验处理。受信实际发送点、执行/取消/恢复绑定依 Q04/Q06/Q09/Q10，未闭环不靠私有跨模块 import 实现。

不承诺 JavaScript 字符串可可靠内存清零；限定秘密到指定认证适配路径的必要作用域/序列化，禁止含真实凭证的堆转储诊断和生产抓包。受信本机代码不是沙箱；这种装配隔离不承诺保护已受侵害的整个进程，但也不因此把整个 Broker/Host/SDK 泛称为许可携密内存。

### 4.8 AuthResume 与冻结执行

AuthResume 四字段 executionId/stepId/proposalRevision/decisionHash 与 source/expectedAccount、原 epoch、请求 scopes、原工具版本、受信授权用途同一记录冻结；requestId/requestVersion 绑定该链接。用途来自 MOD-07 的可信验证，不由模型/连接器补齐，也不能迁移给另一执行。以下是 Q13/U07-05/Q06 的目标语义，不新增 AuthResume 公共字段或私有读取 act_。

| 受信授权 phase | MOD-07 保留的业务状态 | 授权后的唯一入口 |
|---|---|---|
| 未执行动作缺权 | 原步骤尚未发生，可 waiting_auth | 权威查原 requestId/链接，然后重验决定、策略、当前条件；不直接发写 |
| 未知尝试的只读核验缺权 | 旧 attempt=unknown，步骤/聚合保持 unknown/waiting_verification；独立 auth_links/phase 表示等待权限 | 仅唤醒原核验流程。grant 成功/取消/过期都不清旧 unknown，不先改 waiting_auth |
| 未知后的潜在幂等恢复缺权 | 在权威未执行证据出现前仍 unknown/waiting_verification | 先重验核验/幂等证据及保留期；授权本身不证明未执行或允许重发 |

- MOD-07 先持久化原步骤及对应内部授权 phase，再幂等建立请求并持久化 requestId 链接。建立请求与落链接之间崩溃必须能按原绑定查回同一请求，不能新建多个授权并任择成功；公共幂等建立/权威查询仍待 Q02/Q06，不用 source 已授权代替。
- auth.granted 只是唤醒。MOD-07 按**原 requestId**权威查询 publicStatus、绑定/终止状态及自身冻结链接，再核对原 revision/hash、工具版本、源政策、原决定期限与源系统当前条件。当前账号/scopes/凭证期限有效性/授权 epoch/凭证 generation 只通过指定认证适配路径核验后新建白名单非秘密结果取得，不调用 credential、不接 Credential、携密 envelope 或错误/嵌套引用；scopes 数组亦新建，不以 Omit、只读字段或先交付再删字段代证。身份/epoch 变化按原链接规则拒绝；本模块不直接调用 callWrite、不改 act_。
- 非秘密权威查询及请求终态/幂等建立仍与 U07-05/Q02/Q06/Q10 待公共统一，status.granted/authorized 不证明当前账号/scopes/期限/代际有效，事件或自报 verified 不能替代。未闭环 fail closed，不私建 API 或传 Credential 补缺；查询只用于执行器预验，实际取密/refresh 与最后 await 后真实 I/O 闸门仍由 §4.7 指定认证适配器独立承担。
- pendingExpiresAt 约束尚未提交的请求；已 granted 不因原请求期限后来届满抹去既成授权。当前凭证有效性由指定认证适配器重验、只交非秘密结果，与业务决定/预览期限独立，不能因 granted 就跳过；过期决定的恢复由 MOD-07 裁决，不新增批准。
- 请求取消/过期（尚未 granted）、源撤销、执行取消或账号不一致都使该旧链接不可恢复。之后同 source/同账号/scopes 的新授权不是原 requestId 的成功，不能复活旧取消执行；未知核验期间取消亦保持旧未知事实，只终止授权等待/自动推进资格。
- 同账号授权成功但线程已回复、实体改变、工具升级或批准内容改变：禁止发送旧动作，交 MOD-07 冲突/新决定；若原流程是核验则继续真实只读核验，不改写旧尝试事实。核验仍 unknown/非权威 not_found 时继续 unknown/waiting_verification，不因授予权限转未执行。
- 至少一次事件去重仅用于唤醒，不以“事件已消费”充当业务恢复已完成。重复事件重查同一链接、不重复写；丢事件/重启从持久未结授权链接做有界权威查询。requestId 不匹配的设置授权不恢复业务；查询/事件载体未闭环仍阻塞，不用内存标记或私有跨表补齐。

### 4.9 写派发与核验工具

write 入口只允许执行器，前决预览 callWrite=0。依 R07-01，MOD-07 在**完整预览之前**生成权威 ActionStep.idempotencyKey，按写工具 Schema 唯一物化为 args.idempotencyKey，并冻结为不可编辑字段；scope 包含连接实例、冻结账号、工具与步骤。预览展示的最终 args、actionHash 输入和实际派发 args 必须相等，step 键与 args 键不一致直接拒绝，不在发送时补/改参数。

批准后的调用之前，MOD-07 已同事务写 started 与尝试审计，原键仍在原冻结 args 内。宿主按受信验证服务核对步骤/决定/版本/账号/started、参数 hash 与键相等；不生成或覆盖 key、不通过删去该字段后算 hash，也不拿本地去重冒充 provider_key。必要工具描述/pin 与冻结验证仍为 Q06/U07-02，ctx 字符串不是验证证据。

| 阶段/结果 | 宿主职责 | 执行器职责 |
|---|---|---|
| 入队但尚未派发 | 校验允许项/Schema/账号；取消可确定未外呼，不造 WriteResult | 决定停止或重新检查后再执行 |
| 已派发，确定成功 | 验证 WriteResult.ref、账号/工具关联，返回标准结果 | 事务记录 succeeded/结果审计；永不重放该步骤 |
| 已派发，明确业务拒绝且可排除副作用 | 映射冻结 ConnectorError，不自行重试 | 失败/等待授权或新提议；记录已成功和未执行步骤 |
| 已派发后超时、进程退出、回包 malformed、连接中断或取消 | 保守 outcome_unknown；不能声称 retryable 普通错误 | waiting_verification；先核验 |
| reconciliationTool 返回 found | 只能调用已登记 read、同冻结账号范围；校验 result | 记录真实结果，不再写 |
| 返回 not_found authoritative=true | 只是证据，不在宿主重写；校验依据与查询时点 | 结合源端点一致性/幂等保留期/当前条件裁决是否允许重试 |
| not_found 非权威、unknown、权限不足或只看到未更新的图谱 | 返回不确定，不转换成未执行 | 等用户核对，不盲重发 |

write 在宿主层的自动重试次数为 0，包含 rate_limited、auth_expired、upstream_error 和版本错误。执行器重试只在源系统有效幂等保证期内或权威未执行证据成立时进行，仍受预算、原冻结参数和当前策略约束。失去幂等保留期、模糊的列表搜索和最终一致索引都不能成为权威未执行证明。

**前决预览（R03-05）**只用本地纯 Schema/规则或已登记、经受信审核的 read 预览工具，经现有 callRead 的账号/范围/来源/敏感度边界读取。不能将 write 仅凭 dryRun/readOnlyHint 当 read；supportsDryRun 声明不授予前决写权限。预览不造 executionId、started、WriteResult，不调用 callWrite，不新增私有旁路。无合适只读工具时展示本地完整最终参数与无法远端预演的事实，不伪称执行成功。

用户编辑任何允许字段后须重新生成完整预览/hash，权威键不可编辑；其余内容、接收方、附件与工具版本均按冻结规则绑定。发送阶段与预览逐项相等，不以发送时补 idempotencyKey 或 dryRun=false 改最终 args。M1 写相关能力仍明确不可用；完整描述/编辑/核验公共边界仍待 Q06/Q07，由主会话协调。

### 4.10 同步页标准化

- 同步引擎使用宿主内部只读派发路径调用 wa_sync_pull，不把整页原始实体作为普通 ToolReadResult 反复缓存，也不把完整回包写日志。
- 输入 stream/cursor/window/limit/includeContent 全由本机固定流配置和已授 scopes 决定；连接器无本机状态。includeContent 默认 false，有 contentScopes 也需明确用户选取正文范围，不能授权扩大后自动拉所有历史正文。
- 验证 structuredContent 与扩展 v1，entities/identities/relations/deletions 类型及大小、entityTypes 已登记、时间有效；hasMore=true 必须有可推进且可重放的 nextCursor。游标循环/不推进是错误，不标完成。
- 宿主填写 owner、source、connectorVersion/fetchedAt、private，规范化 id/关系端点和敏感度；不信任占位 owner 或连接器自选 source。内容 hash 算法与 MOD-02/04 协调（Q08），不能只用 title 判断正文未变。
- 每个 native id 的重复页 upsert 安全；关系仅在该实体**完整出边已汇聚/登记分片完成语义**成立时替换，不能以本页或 snapshot.complete 代替出边完整。该公共载荷/大关系分页待 Q08/MOD-02 Q05，不靠私有跨表补齐。deletions 仅接收逐流已登记的权威 tombstone/显式删除证据，并校验 owner/source/stream/适用范围；missing 候选不是 tombstone，跨源或其他归属删除拒绝。
- 输出不含正文的直接承载字段：Entity.hasContent 不是正文。现有 SyncBatch 无正文 payload，列 Q08；在闭环前只能同步元数据，不能写 hasContent=true 假装正文已落地。

### 4.11 cursor 模式

1. 获取 (source, stream) 的单写租约，固定 runId、epoch、scopes/config/清单版本与预算。同步网络请求不在事务内。
2. 读取已提交 cursor，向连接器请求下一页；只有收到并校验整页后才调用 applySync。
3. cursorCommit(tx) 在同一事务 CAS 流 generation/epoch/run/cursor；写新 committedCursor、页进度/计数与必要 outbox。期间源被撤销、租约失效或 config 变化则抛错，整页图谱和进度回滚。
4. hasMore=false 只说明本次拉取结束；最终 nextCursor 按该流定义持久化以供下次增量。cursor 型源若终页给 null 且不能说明下次从何处继续，需 MOD-04 定义明确重扫语义，不把 null 伪装成增量检查点。
5. 超时/崩溃：已提交页从新 cursor 继续，未提交页用同一输入 cursor 重拉；不持久化未校验的回包。过期游标仅在连接器已登记的错误/重置规则成立后重扫，不删除原有图谱或猜测从当前时间跳过。

### 4.12 window 模式、快照与原子分页

每轮选择固定半开 UTC 区间 [from,to)，按 StreamSpec.maxWindowDays 切成合规窗口；不能取到最后一页时把 to 改成“现在”。每个窗口独立 snapshotId。日期展示由上层按用户时区，窗口 API 的边界转换交连接器官方规则验证。

快照边界包含 owner/source/stream/window/原 epoch、过滤与排序/查询范围 hash、includeContent/scopes hash、清单/Schema 版本、逐流 enumerationEvidenceId/version。maxWindowDays 和 window membership/primary/support/deletion 语义需 MOD-04/02 对齐；任一范围/证据版本变化必建新快照。

**逐流完整性与删除资格（R03-03）**：全页链成功是必要条件，不是充分条件。固定窗口、合法 cursor 和 hasMore=false 不证明缺失。反例：旧图谱候选 C 仍在窗口内，但第一页后 C 的排序位置移到已读区；后续合法终页从未返回 C。如果直接 missing 对账会误删。源侧允许怎样变化必须与枚举算法一起证明，而非强求未证存在的全局原子保证。

| 登记项 | 进入 missing 对账前的证据/关闭规则 |
|---|---|
| 枚举方法 | 精确到 Provider/stream/端点/查询、排序、过滤、版本和窗口边界，记录官方语义及合成/真实探针。可候选为有效快照句柄，或有可证明遍历不漏的稳定键/变更算法；不能只登记“支持分页” |
| 允许变化 | 明确插入、更新排序键、跨窗口移动、删除、过滤状态变化及分页期间并发；说明算法如何保持对象可见/缺失判定，以及页重拉的约束。不允许的变化出现、句柄过期或无法识别变化时关闭 missing |
| 缺失规则 | 必须能证明该**适用归属集合**未见对象可移除；完整 source、primary/support、出边完整不是同一语义。证据未登记/未批准/不适用则 missingDeletionEnabled=false，所有 snapshot.complete=false |
| 独立 tombstone | 另登记权威来源、稳定 native id、版本/排序、范围、重放与复活语义；已验证 tombstone 可在普通页按归属处理，不依赖窗口 missing 完整性。普通 not_found、过滤消失或候选未见不能冒充 tombstone |
| 资格失效 | 端点/过滤/排序/权限/包/Schema/证据版本变化、无法检测允许变化边界、取消/租约失效、预算/游标期限不足均关闭对应删除路径。先安全 upsert、标 incomplete，不清旧成员补“完整” |

飞书、Gmail、GitLab 各流尚无本轮资格认定；不是断言其支持或不支持。只有官方依据、具体算法/适用变化和故障断言经评审登记后才可启用 missing。**有界权威候选核验**可交主会话评审：由图谱在自身范围产生候选、只读源端点确证缺失并绑定时点/范围；但候选获取/结果原子提交/核验权威性公共协议尚未冻结（Q08/U07-04），本模块不读 graph_、不私建 API，也不以部分候选核验自动设置整窗 complete=true。

**每页过程**：

1. 在 sync_snapshots 持久 active id、固定范围/证据版本、pageSeq=0 和初始 cursor。出队/派发按 §4.7 核原票据；请求捕获 expectedPageSeq=n、expectedInputCursor=c、runId/leaseGeneration。连接器只见 window/cursor 参数，不保存本机快照。
2. 校验成功页及登记枚举规则，默认 SyncBatch.snapshot={id,window,complete:false}。仅终页、此前连续页均已提交、整个枚举/允许变化证据适用且 missing 对账获准、未取消/超期/截断，才拟 complete=true；该资格还须在事务中 CAS 重验。单页空/终页本身不足。
3. WorkGraphWriter.applySync(batch,cursorCommit) 在自己的 graph_ 维护 seen/candidate/归属；本模块只管 sync_。cursorCommit(tx) 是同步回调，不 await；任何末页资格/CAS 失败抛错，使图谱含拟缺失对账的变更、同步状态、审计/outbox 全部回滚。
4. **每页及末页 CAS 条件**：snapshot active、pageSeq=expectedPageSeq、当前 nextCursor=expectedInputCursor（含 null，不只比较回包 nextCursor）、原 runId/leaseOwner/leaseGeneration 且租约有效、run.cancelRequested=false、source enabled 且原 binding_epoch、固定 window/范围/scopes/config/包/Schema/证据版本均相同。同步条件更新必须恰好影响一行，否则抛错；(snapshotId,n+1) 唯一页键防第二个末页重复推进。
5. 条件成功才同 Tx 追加 sync_pages/sync_seen、推进 pageSeq/nextCursor。已证明完整的末页同时设置 completed、完整 coverage/lastSuccessAt 和 sync.completed outbox；图谱删除/关系/entity.changed 亦在此 Tx。无法证明但合法结束的页只记 chainEnded/terminal checkpoint、lastReadAt 和 incomplete/原因，complete=false，不发布“完整覆盖”完成投影，不能借状态名字唤起图谱 missing 删除。terminal 原生 checkpoint 的公共语义待 Q08，不强制 null 丢失。
6. complete=true 的对账仅移除已登记 owner/source/stream/window 对应归属；跨窗口移动/重叠实体及仍有效关系声明由 MOD-02 保护。support/primary 及目标重现不由本模块私猜；相关公共语义未闭环则关闭该删除路径。禁止先删后补、一次空页全源删除。
7. cancelled、abandoned、游标/证据过期、清单变化、缺权限、页失败、动态变化不能证明不漏或范围不同均不得 complete；已 upsert 页可保留但如实 incomplete。取消与末页竞争以同步 Tx 的线性化先后判定：屏障先提交则末页全回滚；合格末页先提交则取消不声称倒退已提交结果。
8. 重启仅恢复相同 epoch/范围/版本、仍有效证据与句柄的 active 快照，并重取有效租约，从已提交 pageSeq/nextCursor 继续。事务前崩溃重拉原页，提交后旧 n/c CAS 拒绝；不同字节可安全 upsert 不等于枚举完整。无句柄/变化证明则 abandon 并新建 snapshotId 重扫，不删图谱成员。

过滤取消/全天/空闲日程后，只有登记可证的范围缺失对账或独立权威 tombstone 才清旧“幽灵日程”；过滤新页不是删除证据。若门槛未满足，保留旧成员并显示覆盖/状态可能不全，不能为消除旧对象伪造完整。游标流亦须逐流登记显式删除/可靠重扫规则。

**崩溃矩阵**：

| 故障点 | 图谱与同步状态 | 恢复 |
|---|---|---|
| 网络前/回包前 | 无新页提交 | 读取可有界重拉；写绝不走此恢复 |
| 收到页但 applySync 前 | 仍旧检查点 | 不保存原始回包；重拉同页 |
| 图谱 upsert 后、cursorCommit 抛错 | 同事务全部回滚，包括 outbox | 检查 epoch/租约，重拉或终止 |
| 中间页 commit 后进程退出 | 图谱与页进度都已提交，snapshot active | 从新页位置恢复，不标窗口完整 |
| 末页对账/进度/outbox commit 前退出 | 末页事务回滚，旧 completed 不存在 | 重拉末页，再完整对账 |
| 末页 commit 后、事件投递前退出 | 结果与 complete/游标/outbox 都存在 | outbox 至少一次补投递，不再次对账产生副作用 |

### 4.13 调度、资源限制与取消

下列数字是本模块拟定保守默认值，不是厂商配额事实；Provider/流经官方限额验证后只能按批准登记调整。

| 边界 | 默认值/策略 |
|---|---|
| 同步并发 | 每流 1，每实例 1，全宿主最多 3 个网络同步请求；读工具总并发 4，给执行器核验读保留调度优先级 |
| 待执行队列 | 全局最多 64、每实例最多 16；超额拒绝/合并同步触发，不无界排队 |
| 单页 | 请求 limit≤200，标准化页≤4 MiB、单实体≤1 MiB；超过边界视失败，不部分吞页后 complete |
| 目录/Schema | 每源≤256 工具；清单≤256 KiB，Schema 深度≤32；外部 $ref 不联网解析，无法验证就拒绝 |
| 网络时限 | discover 5 秒；普通读/同步页 30 秒；write 60 秒；进度不延长绝对时限 |
| 单次读 | 最多 3 次尝试（含首次），总等待/网络预算 90 秒；认证 refresh 最多一次，计入总预算 |
| 同步轮次 | 默认最多 30 分钟/500 页；耗尽则 incomplete 后暂停，绝不当作末页；完整分页可在有效快照寿命内显式续跑 |
| 退避 | 1 秒基值、指数 full jitter、单等待上限 30 秒；retryAfterMs 校验有限非负，作为最早允许时间，超预算则持久 nextEligibleAt 后结束本轮，不提前重试 |
| 进程重启 | 最多 3 次/10 分钟，退避后源 offline；不跟着进程重启重发 write |

限流按批准的 Provider/账号/端点规则协调，rate_limited 指示不会只限制当前工具而让同账号其他工具继续轰击上游。连接器自身不得再叠一套无界重试；宿主一次尝试与真实上游请求次数在 MOD-04 明确，避免 3×3 重试放大。

休眠由 MOD-06 调度补一次或跳过，不积累每个遗漏周期；本模块保留实际覆盖与 nextEligibleAt。授权就绪可触发一次手动近期读取；未授源单独提示缺失，不能通过扩大权限填齐报告。跨模块触发接口见 Q04。

内部每个调用有 AbortController 和 requestId；取消从队列/等待退避/限流等待传播到 transport 和连接器 fetch。stdio 按官方 notifications/cancelled 关联 requestId，迟到读回包不应用，epoch 检查作为事务最后防线。公共 ConnectorHost 缺 signal/调用 id，能力 signal 无法可靠穿透，列 Q04；不以 Promise.race 假装上游已停止。

写派发后的取消只停止等待和后续步骤，结果保守 unknown；不中断共享 transport 来“取消一个写”而误杀其他请求。强制退出处理所有在途请求；读失败、写未知分开报告。

## 5. 错误处理与降级

冻结 ConnectorError 用于 MCP 工具层；宿主本地超时/取消/协议错误不能假装是服务端业务错误。Promise rejection 的跨模块类型与派发确定性缺口见 Q07。

| 错误/场景 | 读取和同步 | 写入/授权恢复 |
|---|---|---|
| auth_required | 停该源/流，展示缺权限；不弹浏览器、不拿其他账号 token 顶替 | 未执行动作由执行器 waiting_auth；未知核验缺权保留 unknown/waiting_verification，以独立 phase 等授权，宿主不自动授权 |
| auth_expired | 有界 refresh 或明确失效；其他源继续 | 不自动重发写；派发阶段不可确定时 outcome_unknown |
| rate_limited | 尊重有界 retryAfter 与账号共享预算；暂停保留检查点 | host 重试 0；执行器依据未执行/幂等证据裁决 |
| not_found | 单对象读明确缺失；不同于整个窗口完整空集合 | 不把“找不到目标”当成功；核验 not_found 还必须明确 authoritative |
| conflict | 停止本次读取/更新，提示需新范围或数据变化 | 不修改冻结参数、不补偿、不自动新决定 |
| invalid_input/Schema 错 | 不重试；错误不带正文/秘密 | 派发后坏回包不能排除成功，进入未知 |
| upstream_error retryable=true | 只对审核 read 且预算剩余重试；不自作主张把 4xx 当瞬态 | 写工具 retryable 声明不赋予重发许可 |
| outcome_unknown | 读取可丢弃本页并按预算重拉，绝不完成快照 | 核验/用户核对；无保证不盲重试 |
| 未知 resultType/MRTR/非扩展回包 | 拒绝并降级，不把 input_required 当业务完成 | 不接收连接器自发 OAuth、roots/sampling 或自动 MRTR 重调写 |
| SecretStore 不可用 | fail closed，状态不可误报已授权；不落 .env/明文 DB/命令行 | 不发 token，不启用替代账号；删除失败如实报告 |
| 非秘密权威查询/装配未闭环，或结果/错误携密 | 指定认证适配路径在交付前拒绝/隔离，不向调度/Reader/能力/Host 投影透传原对象；不靠 status/Omit 降级 | 执行器不取 credential 补缺；确定未派发才确定拒绝，可能已派发仍 unknown，旧未知不解除；公共依赖 fail closed |
| SDK/协议不兼容 | 源 offline，并作为实施阻塞 | 不降到旧协议伪装符合冻结架构 |

第三方 MRTR 请求人输入不是工作源授权入口；v1 未登记交互需求则拒绝/取消，不自动运行服务器提供的 URL，不将 inputResponses 当新业务批准。Tasks 未显式登记支持时不启用，更不能借 Tasks 绕过 MOD-07 持久步骤。

## 6. 安全与隐私

### 6.1 凭证边界

凭证仅进入系统凭证库及**指定被授权的认证适配路径内存**：Broker 的认证适配器取/写秘密、换码/refresh 和核验携密 envelope，宿主认证适配器执行本次必要序列化、凭证注入与最后派发闸门，指定连接器认证适配器只向批准厂商业务端点注入本次 access token。不能把整个 Broker、Host、SDK 或普通 transport 实例的内存泛称为携密许可边界；refresh/client secret/PKCE verifier 永不进入连接器。每次 tools/call 的 `_meta["work-agent/credential"]` 仅包含冻结契约的 accessToken/expiresAt/account，且只在批准凭证映射的工具请求上由指定认证适配路径添加；请求 envelope/序列化缓冲也不得交普通编排，不放 arguments、进程参数、环境、日志、工具结果、模型或记忆。

组合根使普通调度、执行器、Reader/能力、伙伴/交互业务入口以及 Host 外部投影不可达完整 Broker、credential、SecretStore 或实际携密对象/错误。执行器只接 §2.1 的新建白名单非秘密账号/scopes/期限有效性/授权 epoch/凭证 generation 验证结果；scopes 和嵌套业务值不得复用携密对象引用，错误不透传原 cause/response/request。Omit、只不读取 accessToken、类型断言或交付后再删字段都不能证明隔离；真实返回值/依赖可达性须验证，认证适配器之外取密调用数和接收 token 数均须为 0。非秘密权威查询及请求终态/幂等恢复仍待 U07-05/Q06/Q10 公共统一，未闭环 fail closed，不把 status.granted/authorized 或自报 verified 当实时证明。

_meta 是私有扩展的传递通道，不是自动脱敏或安全存储机制。指定认证适配路径在结果/错误交付普通路径**之前**检查实际值、嵌套引用和错误载体，携密回传拒绝/隔离，只交新建白名单非秘密结果/错误。SDK debug、异常序列化、transport traces 和 stdout/stderr 都须用合成秘密金丝雀测试；不能靠日志无 token 推断执行器从未接收 token，也不能只查已知字段/正则脱敏。若精确 SDK 的装配与序列化路径不能满足此边界则阻塞，不用整个 SDK “受信”放宽 I7；这些均为待证设计，不是已经存在的合规实现。

### 6.2 相关 I1–I35 逐条映射

“协作/不直接实现”仍说明本模块不能破坏的边界，不把其他模块测试冒充本模块已通过。

| 约束 | 适用性与本模块措施 | 验证入口 |
|---|---|---|
| I1 | 直接：只有冻结决定路径调用写；MOD-07 写前源系统核验及 started/审计；本模块不独立批准 | T18、T19、Q06 |
| I2 | 直接：写入口只注入执行器，其余对象是 read-only 投影，依赖检查 | T01 |
| I3 | 协作：模型/MRTR 输出无写或授权入口；写建议交提议 | T01、T20 |
| I4 | 协作：前决只本地纯规则/受信 read，callWrite=0，无伪 executionId/started/WriteResult；键预览前物化不可编辑，完整 args/hash/派发相等 | T18、T30、Q06/Q07 |
| I5 | 协作：manifest risk 不自动授权，v1 无 auto | T01、T18 |
| I6 | M4 边界：remote Actor 无直接写/授权/跨账号凭证许可 | T02 |
| I7 | 直接：取密/refresh、携密 envelope/必要序列化/注入仅指定认证适配路径；普通执行器/调度/Reader/能力/Host 外部投影不可达完整 Broker/credential/SecretStore 或实际携密对象/错误。非秘密验证新建白名单、不靠 Omit/status；最后 await 后适配器闸门独立。切/清指针同 Tx 保留旧键意图/producer 引用，确认删除才回收，无明文降级 | T03、T09、T24/T25、T33/T34、P04/P07/P09、Q05/Q06/Q10 |
| I8 | 直接：连接器无凭证/游标持久化、无模型/授权入口，auth_required 仅报错 | T01、T04、P06 |
| I9 | 直接：断开屏障不等网络锁，epoch/generation 同步失效；保留旧键/晚到 set 引用驱动清理，删除失败如实待清理不假成功 | T10、T24–T27 |
| I10 | 协作：无 LiteLLM 依赖，ToolReadResult 引用交网关；实体不可塞 instruction | T01、T05 |
| I11 | 协作：结果最高敏感度，secret 阻入模，confidential 不越设置 | T05、T06 |
| I12 | 直接边界：第三方 instructions/descriptions/正文不升级可信指令 | T05、T20 |
| I13 | 协作：不接受 user 自报来源，不写规则记忆/人格 | T05、T20 |
| I14 | 协作：不持久旁路记忆副本，结果保留期透明；实体/记忆删除由各自模块 | T06、Q05 |
| I15 | 协作：事实元数据标准化，工具名/账号/时间不经人格改写；可爱口吻不放权 | T05、T18 |
| I16 | 协作：auth 请求只提供状态/受过滤通知，不直接气泡/音频；安静不变授权策略 | T21 |
| I17 | 边界：授权、同步和工具权限不依赖养成等级或用户拒绝次数 | T01、T21 |
| I18 | 直接协作：回调只校验 state/PKCE/issuer，不访问业务资源；MOD-08 校验 Host/Origin | T07、P09、Q01 |
| I19 | 直接：宿主填写 owner/private/source，最高敏感度和 provenance；跨源删除拒绝 | T05、T11 |
| I20 | 直接：全页成功加逐流可证枚举/允许变化/缺失资格才对账；无证据 incomplete，权威 tombstone 独立；末页 n/c、取消、租约/epoch/范围版本 CAS 同事务 | T12–T16、T28/T29 |
| I21 | 直接：仅 AuditWriter.append，撤销不删历史审计 | T10、T16 |
| I22 | 直接：stdout/stderr/query/异常不落正文或凭证；游标日志只 hash | T03、P06、P07 |
| I23 | 直接：只 conn_/auth_/sync_，跨模块以公共服务和 Tx callback 协作，不读写 act_/graph_/rt_ | T01、T16、Q04、Q06 |
| I24 | 协作：MOD-04 只依赖 contracts；客户端不拿连接器/秘密入口 | T01、T04 |
| I25 | 直接：UTC 毫秒；pending 请求 TTL、既成 granted、当前 Credential/决定期限分别核验，cleanup 不因 TTL 丢引用 | T07、T13、T17、T24/T31 |
| I26 | 直接：扩展版本与 Schema 改动不覆盖；不兼容经 ADR/迁移/重评审 | T22、P01、Q08、Q09 |
| I27 | 直接协作：auth 事件受理持久去重；完成 outbox 同业务事务，至少一次 | T16 |
| I28 | 直接：不判断 OS，路径/监督在 MOD-01；两平台装包冒烟不是模拟结论 | P07、P09、T23、Q10 |
| I29 | 直接协作：账号/工具/内容改变使写允许项失效，新预览决定；不改冻结步骤 | T18、T19、Q06 |
| I30 | 直接：派发后未知先核验，host 写重试为 0；成功步骤永不重发 | T19、P08 |
| I31 | 直接：原 requestId/版本/决定/步骤/账号/工具与可信授权 phase 绑定；未知保持 waiting_verification；事件只唤醒原请求权威查询和非秘密预验，实际取密/最后派发归适配器，status 非实时证明；取消/新授权不复活 | T08、T10、T18、T31、T33/T34、Q06/Q10 |
| I32 | 直接协作：工具/实体依据保留来源最高敏感度；最终网关/通知统一过滤不跨渠道放宽 | T05、T06、T21 |
| I33 | 协作：来源不洗白，结果不是规则证据；不擅自解除遗忘墓碑，重新同步不自动记住 | T20、Q05 |
| I34 | 边界：无皮肤/自娱工具权限、不读取窗口；空闲动画不触发同步/模型 | T01、T21 |
| I35 | 直接协作：Provider/连接器版本登记，扩展演练；M2 真实任务对比归整体验收 | T22、T23、P01–P09 |

## 7. 测试计划

本节均为未执行计划。单测/合成互操作通过不代表真实账号授权、厂商权限、macOS/Windows 安装包或生产力指标通过。

### 7.1 官方证据、已发现阻塞与前置 MCP 探针

**首稿只读资料核对事实与主会话独立静态复核（2026-11-19）**：本轮完整阅读指定首轮修订复评、Q13/R03-06 及 MOD-07/R07-04 当前稿，仅定向修本文，未重新联网取包、下载 v2 或运行新探针；下列发行事实仍区分首稿证据与主会话复核。

| 证据 | 官方资料与本次核对所得 | 不能推导的结论 |
|---|---|---|
| E01 | [MCP versioning](https://modelcontextprotocol.io/specification/versioning)：current=2026-07-28；每请求 protocolVersion，server/discover 返回支持版本 | current 不表示 SDK 1.32.2 实现现代协议 |
| E02 | [基础协议](https://modelcontextprotocol.io/specification/2026-07-28/basic)：每请求 protocolVersion/clientCapabilities 为 MUST、clientInfo 为 SHOULD；无连接隐含状态，resultType 按正式 Schema 校验 | 项目可以要求更严，但不得强称所有字段均规范 MUST；legacy 缺 resultType 的兼容文字不证明旧 SDK 支持 modern |
| E03 | [server/discover](https://modelcontextprotocol.io/specification/2026-07-28/server/discover)、[版本/扩展协商](https://modelcontextprotocol.io/specification/2026-07-28/basic/versioning.md)：server 实现 discover 为 MUST，client 调用可选；serverInfo 在结果 _meta 为 SHOULD；extensions 有前缀 id→settings map | 本项目 client 固定 discover、profile 要求 serverInfo，仅是更严门槛；自报不是信任，资源/工具发现仍分别验证 |
| E04 | [stdio](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/stdio.md)：newline JSON-RPC、stdout 仅协议、EOF 退出；modern error -32022 不回 initialize；旧版另有 fallback 规则 | 文档的进程重启后可 retry 不赋予业务写入重试许可；本项目 I30 更严格 |
| E05 | [Tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools)：structuredContent/isError；annotations 默认不可信；MRTR 返回 input_required 不代表完成；[取消](https://modelcontextprotocol.io/specification/2026-07-28/basic/patterns/cancellation.md)：stdio notifications/cancelled 引用 requestId，取消有竞态 | _meta 不自动保密；取消不证明源系统没产生副作用 |
| E06 | [npm 官方 1.32.2 元数据](https://registry.npmjs.org/@modelcontextprotocol/sdk/1.32.2) 与其 [tarball](https://registry.npmjs.org/@modelcontextprotocol/sdk/-/sdk-1.32.2.tgz)：Node>=18，gitHead=3b73021a0a2272c0c04c3917bcdb03398b3ec63f | engines 和发布号不是协议支持表 |
| E07 | [RFC 9700](https://datatracker.ietf.org/doc/html/rfc9700) §2.1/2.1.1、§4.14；[RFC 9207](https://datatracker.ietf.org/doc/html/rfc9207) §2.4：精确 redirect/issuer、PKCE S256、授权响应 iss 及 refresh 轮换约束 | 规范建议不等于飞书/Google 实际支持或配置已验证 |
| E08 | [Google OAuth web-server](https://developers.google.com/identity/protocols/oauth2/web-server)：include_granted_scopes、offline、首次 refresh_token、实际 scopes 核对、Workspace 管理策略及外部浏览器限制 | 不能证明桌面客户端类型、当前租户批准或账号稳定 id 读取已可用 |

首稿对 E06 tarball **仅在内存读取并校验 SHA-512，不解包到工作树、不执行包代码**；主会话亦已独立静态复核，完整性比对不是签名/provenance 或运行通过；digest 与 npm dist.integrity 相同：`sha512-SWsVtH/0vULSQStoZ6xxH2K09Li8fXYTMC64ZeogCdpZ3XSi1eCPOByV1OpuJxuI3OcmHhosDWYyii07tpPsLw==`。可复核包内位置：

- `package/dist/esm/types.js:2–4`：LATEST_PROTOCOL_VERSION='2025-11-25'，SUPPORTED_PROTOCOL_VERSIONS 不含 2026-07-28。
- `package/dist/esm/client/index.js:274–305`：Client.connect 调用 initialize，之后发 notifications/initialized，并校验旧支持版本列表。
- `package/dist/esm/server/index.js:52–53、259–269`：主会话核实注册旧 initialize 握手、保存客户端状态，未知版本回选 2025-11-25；`server/mcp.js:64` 的包装未改变该事实。
- `package/dist/esm/client/stdio.js:8–41、65–74`：spawn 的 env 合并默认白名单与用户 env，不是全父环境，也不是 env={} 就清空；stderr 默认 inherit。

**B01：直接采用 SDK 1.32.2 高层 Client/Server 符合冻结 modern 基线的假设已被静态包事实否定。** 不因此否定协议 current 或 npm 发布号；两者都真实，但不相互推出互操作。不能仅改常量、塞 _meta、跳过 connect 或接受 legacy 回包来报探针成功。由主会话决定重新选取已实现 modern 协议的官方 SDK；若要选择旧协议或新增 transport/协议实现方案，须按冻结变更规则回 ADR 并重评审。本文不替主会话选定替代依赖，也不编写替代协议。

据首轮评审的主会话核验：[SDK registry](https://registry.npmjs.org/@modelcontextprotocol/sdk) README 声明 v1 不计划支持 modern；[client registry](https://registry.npmjs.org/@modelcontextprotocol/client) 与 [server registry](https://registry.npmjs.org/@modelcontextprotocol/server) latest=2.4.0、README 声称 v2 支持 2026-07-28。只列后续**精确发行包审查候选**，未下载/安装/执行新包，未冻结其依赖、验证 transport/元数据/取消或运行 P01–P09；README 不构成实现通过，B01 仍阻塞。

本机 gh 命令不可用，未取得 GitHub 源码评审；以上实际发行包及 integrity 是独立静态证据，不是假称源码/运行测试通过。

**探针条件**：获得单独许可后，在不含 .env、系统凭证或公司数据的隔离测试目录，使用批准的 Node 24、精确 SDK/依赖版本与完整性记录、受信合成 connector fixture。modern 客户端和服务端至少一端采用官方兼容实现/官方 Schema 作为独立 oracle，不能仅两端共享同一个错误适配器自证。macOS/Windows 均保留仅合成内容的 wire transcript、退出码、用时、版本与测试结果；本次没有运行这些探针。

| 探针 | 具体输入与故障注入 | 通过标准与阻塞动作 |
|---|---|---|
| P01 发行实现审查 | 查精确包 SUPPORTED_PROTOCOL_VERSIONS、connect/discover/Schema/取消路径，核对 dist integrity；和官方 2026-07-28 Schema 对照 | 必须原生支持现代语义。1.32.2 当前已阻塞，不进入“真实授权试试看” |
| P02 modern 发现 | 项目 client 新进程首请求 server/discover，_meta 有 version/capabilities/clientInfo；无 initialize；错版本、缺 MUST 元数据、缺 SHOULD info、modern -32022、legacy 缺 resultType 分组注入 | 依正式 Schema 校验 envelope/支持版本，缺 MUST 拒绝；profile 另要求 clientInfo、结果 _meta.serverInfo，缺 SHOULD 记项目不通过而不谎称规范 MUST。server MUST 支持 discover，client 可选但本项目选用；legacy 兼容回包不当 modern 实现通过 |
| P03 目录与扩展 | resources/read wa://connector/manifest、tools/list 多页；work-agent/connector capability/settings、版本错、同名/新增工具、外部 Schema $ref | 同意的扩展语义、资源、工具、Schema 一致；未知扩展/版本和未批准工具不可调用；Q08 先批准 settings |
| P04 每请求与元数据 | 同进程交错两个 source/account 的合成调用，指定认证适配路径每次只注入该调用 synthetic accessToken；观察真实装配、必要 SDK 序列化/缓冲、实际结果及嵌套/错误携密金丝雀；重启继续显式 cursor/window | 不依赖前一次账号或握手；_meta 只经指定认证适配路径且不回普通编排/执行器/Reader 或 content/error/日志，适配器外取密/接收 token 数均为 0，不以 Omit 或事后删字段通过；不得把 token 放 args。SDK 全实例受信不代证，未证即阻塞 |
| P05 stdio/进程内等价 | 分片、多个同包帧、UTF-8、嵌入换行的 JSON 字符串、错误帧/超长帧、stdout 噪声、out-of-order id；进程内 transport 走同 Schema/dispatch | JSON 编码正确、一行一帧、有界；无串请求。不同运行方式不绕开 allowlist/凭证/错误边界 |
| P06 错误/MRTR/取消 | isError+structuredContent 全 ConnectorError、协议错误、未知 resultType、input_required、禁止 sampling/roots；读 cancel/迟到响应/绝对超时 | 业务/协议/本地错误分开；MRTR 不授权或完成写；正确取消 requestId，不提交迟到页，日志无正文/秘密 |
| P07 环境与监督 | 父测试环境加入合成供应商秘密 sentinel，批准 env/cwd/argv 受信 fixture 仅报告违规键/布尔值；stderr 吐合成 token；EOF、崩溃和重启限额 | 子进程不继承未批准环境/令牌，stderr 不泄漏；双平台退出和有界重启，发现后才 ready。SDK 默认 env 合并必须专门核实 |
| P08 写未知及核验 | 合成服务收到写后持久“已写”再丢回包/退出；none/provider_key、过保留期、found/非权威 not_found/unknown 各跑一次 | host 重试 0；不因进程重启/MRTR/版本错误重写；核验只读按冻结账号，unknown 等用户核对 |
| P09 平台授权/库 | 首先合成 callback state/PKCE/issuer/取消/重放与 native SecretStore 故障；之后用户另行许可的三源最小权限真实授权、账号核验、刷新、睡眠恢复 | 双平台库不明文降级；真实授权单独列结果，不以合成通过代替；厂商不支持冻结 PKCE/issuer 或身份要求即阻塞该 Provider |

官方 stdio 推荐环境取凭证的通用方式，与本项目仅本次 _meta 分发是不同策略；基础协议也允许自定义认证策略。本模块只使用经批准的 work-agent 私有扩展，不宣称任意 MCP 服务器接受该字段。第三方仅支持环境 token 时不得自动塞环境绕过 I7，需独立认证适配审查。

### 7.2 单元、集成与故障测试表

| 编号 | 场景/夹具 | 必须断言 |
|---|---|---|
| T01 依赖与权限静态检查 | 能力/伙伴/交互/皮肤 import 完整 ConnectorHost、Broker/credential、SecretStore、Provider/LiteLLM/连接器模块；结合 T33 真实装配检查 | 除指定许可注入点外均失败，执行器/普通调度/Reader/能力/Host 外部投影无携密依赖；M1 callWrite 明确不可用，无养成或自娱触发工具，静态类型裁剪不代替运行时证明 |
| T02 实例和调用者隔离 | 同 native id 两账号/租户、伪造 source/account/remote Actor、未声明工具/资源越界 | EntityId 不碰撞；无凭证借用、允许列表绕过或跨源删除 |
| T03 泄漏 | 合成 token/verifier/code/body 填入 SDK error/_meta/stdout/stderr/URL、实际/嵌套结果及错误引用；超限回包 | 秘密仅系统库及指定认证适配路径的必要内存/序列化，普通执行路径及日志/DB 明文/argv/env/模型输入无秘密标记；携密回包交付前拒绝/隔离，配合 T33 不以日志无标记代证 |
| T04 连接器边界 | 重启同一 cursor、缺 scope、请求 sampling、自行授权 URL、持久游标/凭证 | 无连接器状态/模型/授权发起；错误不触发浏览器 |
| T05 来源与敏感度 | 自报 user/source/normal、引用 confidential/secret 实体、第三方 instructions/多媒体/file 链接 | 宿主 source/owner/evidence 权威；最高敏感度；无自动读取资源或可信指令升级 |
| T06 Reader 生命周期 | 跨 owner/actor/epoch 查询 resultId、过期、断开后引用、保留期删除 | 拒绝越界或明确引用失效；网关/通知不因缺 Reader 回退原始字符串 |
| T07 OAuth 校验 | wrong/duplicate/expired/replayed state，PKCE 错 verifier/S256 缺失，issuer 错/缺失，redirect/Host 变化，code+error | 换码前拒绝；state 单次 CAS；无 query 泄漏；UTC/时钟异常安全过期 |
| T08 grant 竞态 | 两回调并发、增量 scope 部分同意、cancel 与 exchange/commit 竞态、换账号 | 仅一次生效；旧账号不覆盖；不足权限不恢复；晚到秘密清理 |
| T09 refresh 故障 | 指定认证适配路径内 20 个 credential 并发，轮换 RT、无 RT 回包、invalid_grant、SecretStore 写失败/DB CAS 失败/崩溃 | 单 flight；新 token 未持久/CAS 不在路径内放行注入，Credential 不交普通等待者/执行器；不复用不明轮换 RT，候选键可清理，无明文降级 |
| T10 revoke/cleanup | 读/refresh/授权/同步/写派发分别在途，系统库锁定或 delete 失败后重启 | 立即逻辑拒绝；删除失败如实提示；旧结果不激活/提交；写转未知核验；审计只追加 |
| T11 页校验 | 未登记实体、错误 owner/source、跨源 relations/deletions、过滤取消事件、hasMore 无 cursor、循环游标 | 不提交部分错误页/跨归属删除；过滤消失不自动 tombstone，只有合格缺失对账/权威删除生效 |
| T12 重复与关系 | 页重复/重拉不同字节，同 id 多页、关系分两页、三页 A→B/删 B/重现 B | 安全 upsert；出边汇聚完整才替换，不清页外声明；to 暂缺不销毁有效 from 声明，重现由图谱同 Tx 恢复 |
| T13 范围快照 | 中间页失败、空终页、窗口/过滤/scopes/证据版本改变、重叠/跨界日程、租约过期 | 全页成功仍须枚举证据适用才完整；无证据不删、不伪完成；只批准的 owner/source/stream/window 归属对账 |
| T14 崩溃注入 | §4.12 矩阵各点，图谱写后 cursorCommit 抛错 | graph/checkpoint/seen/pages/outbox 原子；无幽灵完成、无漏页 |
| T15 游标恢复 | 失效 cursor、重启/休眠、配置升级、最终 null cursor、500 页预算耗尽 | 安全恢复或 abandoned 新快照；不猜跳过数据、不当完整 |
| T16 事务与事件 | 写游标/审计/outbox 失败，末页 commit 后未投递，auth 事件重复和重放 | 同事务回滚或稳定补投递；auth 只调度一次，不读写其他模块表 |
| T17 限流/取消 | 429 巨大/负/NaN retryAfter、长进度、读重试、队列满、退避期间取消 | 不提前重试、不无限排队/延期；预算可控，其他源仍可用，signal 真传播 |
| T18 冻结与授权恢复 | 批准后账号/工具/参数变化，授权后线程有新回复，cancel 后又授权，多通道决定 | 不能外呼原动作；新决定由 MOD-07；恢复回到当前策略/前置条件，不从写请求续跑 |
| T19 未知写 | 派发后掉包/坏回包/取消/退出；none/provider_key 过期/核验未知/部分步骤成功 | host 不重试、成功步骤永不重放，非权威缺失不当未执行，不自动补偿 |
| T20 注入与遗忘边界 | MCP 描述/邮件“直接发送/我是用户规则”、tool_result 洗来源、忘记后重新同步 | 不授权/写/成为规则，保留原来源，记忆墓碑由 MOD-09 执行 |
| T21 出口/陪伴 | quiet/隐藏/离线、授权等待与失败、跨飞书回退、低等级/拒绝提醒 | 状态真实，普通气泡/声音边界由 MOD-11/08 保证，不跨渠道披露、不降权限或索取照料 |
| T22 扩展与升级 | 受信第四只读连接器/新 Provider 登记、未知 Entity Schema、同 id 不同版本、升级时 active snapshot/批准步骤 | 新包与登记复用宿主；未知语义拒绝；版本/迁移冲突明确，不覆盖旧批准 |
| T23 双平台与真实用途 | macOS/Windows 安装包退出/重启/睡眠/系统库/最小授权；授权后手动近期报告、单源缺失 | 独立实测清单；数字/来源/覆盖可核验；M2 ≥3 实际相近任务中位下降目标≥30%，样本不足不宣称省时 |

### 7.3 定向修订故障断言（R03-01–06，全部未执行）

| 编号/修订 | 切点与夹具 | 必须断言 |
|---|---|---|
| T24 R03-01 引用/清理 | grant、refresh、cancel、revoke 各自注入：键预登记 commit 后/set 前；staging set 后/CAS 前；指针切换或清除 commit 后/任何旧 active/pending/staging delete 前；每个 delete 后/确认 Tx 前；确认后/任务回收前。并注入系统库/DB 失败及重复 cleanup | 每个残留键均能从持久 auth_operation_keys/cleanup 定位；退休键不可 credential/派发；被选中新 active 不误删。提交后崩溃不丢旧键，缺键 delete 可幂等恢复、确认后才回收；超 TTL/预算仍保留意图，不宣称两个库原子 |
| T25 R03-01 晚到 producer | 阻塞 SecretStore.set，取消/撤销后 cleanup get 报缺键，再释放 set；CAS 拒绝、producer 收尾前重启，旧进程未退/确认退两种 | 缺键时 blocked_producer 不能清任务；晚到键仍原 operation 可定位、不可发放；producer 所有写结清并被监督确认后再删。仅租约超时不视作退出，确认删除前/后切点重启均可继续清理，无晚到 set 复活 |
| T26 R03-02 独立屏障/派发 | refresh Promise 永久阻塞时 revoke；分别在出队、SecretStore.get、refresh、限流/发现/条件读取、transport 异步等待后阻塞，再同账号重授权/换工具版本后放行 | revoke Tx 不等待网络锁，提交后立即无新 credential/派发；晚到 CAS/result 和所有旧等待者拒绝。不可用新 epoch 包装旧 token；只比账号会失败该测试。原票据/代际/版本必须在真实 I/O 前验证，写已派发仍 unknown 不伪撤回 |
| T27 R03-02 增量取消 | 旧只读 grant 有效，申请额外写 scopes 并阻塞 exchange/set，取消请求；同时正常旧只读及无关合法 refresh 在途，之后新请求同账号授权 | 原 requestVersion/恢复资格失效，晚到候选仅清理；旧有效 active/允许 scopes 不被误 revoke，正常旧读仍可用；新授权不唤起旧取消执行。取消业务等待与保留只读权限分开 |
| T28 R03-03 动态漏候选 | 固定窗口位置分页：图谱 C 存在，第一页后 C 排序移到已读区，后续 cursor 合法终止且页均成功；加无/失效/适用枚举证据及独立权威 tombstone 对照 | 不凭 hasMore=false 删除 C；没有适用变化证明 complete=false/coverage=incomplete，缺失对账关闭。权威 tombstone 按独立批准范围处理，普通未见/not_found 不代证；不捏造厂商支持/不支持结论 |
| T29 R03-03 末页竞争 | 同 n/inputCursor 的两末页并发；错误 expectedInputCursor；取消/租约过期/epoch/范围/证据版本变化分别在末页 Tx 前后发生；图谱已拟 missing 后 callback CAS 失败 | 末页恰一次推进；n/c、cancel、lease、epoch、范围/版本全校验，任一失败 graph/checkpoint/seen/pages/outbox 同回滚。屏障先提交不 complete；合格末页先提交不伪称已撤回结果；不清其他窗口归属 |
| T30 R03-05/R07-01 零写预览 | 执行器预览本地规则/受信 read，write 声称 dryRun；伪 executionId；step 键≠args 键、试图编辑键/发送时补键，批准后改参数/Schema；同键恢复 | 前决 callWrite 计数=0，started/写审计/WriteResult 均不存在；不造私有入口。权威键预览前唯一物化不可编辑，预览/hash/派发 args 相等；不一致派发前拒绝。合法恢复保留原 args/键，不重放成功步骤 |
| T31 R03-04/TTL 授权恢复 | unknown 核验缺权，建请求/落链接切点崩溃、丢/重复事件、取消/尚 pending 过期后同 source 新授权；原请求 granted 后 TTL 届满，当前凭证/决定分别有效或失效；授权后核验仍 unknown/非权威 not_found | 等授权时及授予后未获权威结论均保留旧 unknown attempt 与 waiting_verification，不转未执行。只查原 requestId/可信链接，事件仅唤醒、重复不写、丢失可查询恢复；取消不复活。既成 granted 不因请求 TTL 消失，当前凭证由指定认证适配器重验、执行器仅消费非秘密验证结果，决定/策略/条件各重验，不因授权成功允许重发 |
| T32 B01/规范/恢复 | 首轮静态包事实与将来 P02 profile 对照；旧 DB 备份匹配残留旧 key、旧 producer 仍活，窗口/结果 TTL 清理 | 保持 B01/公共 Q 阻塞；2.4.0 README 不是通过。区分 discover server MUST/client 可选、info SHOULD 与项目更严要求；不拿 legacy 文本自证。旧 epoch/key 相等不自动恢复授权，平台恢复隔离未证则禁用；TTL 不回收未确认秘密引用 |
| T33 R03-06/R07-04 真实装配与携密金丝雀 | 在未来获准的真实组合根/注入及调用路径中，用合成凭证记录取密/refresh 的发起者和每个接收边界；向执行器、普通调度、Reader/能力及 Host 外部投影误注入完整 Broker/credential/SecretStore，含 Omit/类型断言包裹原对象反例。向同步/异步返回、回调、Promise rejection 的实际字段、scopes/嵌套引用、error.cause/response/request 注入 token，另测试共享原对象后再删字段/变更 | 装配及交付前边界拒绝，普通路径无完整认证方法或实际携密对象/错误可达，适配器外取密调用数=0、接收 token 数=0；指定路径只为批准 source/工具映射取密/注入，必要 SDK 序列化不扩大为整个 SDK 许可。非秘密结果逐项新建白名单/scopes 数组，不引用 Credential；日志/act_ 无标记不是充分证明。不把 status.granted/authorized/自报 verified 当实时证据，公共非秘密查询/请求恢复未闭环则发送增量=0 |
| T34 R03-06 最后 await 后失效 | 非秘密执行器预验后分别阻塞指定认证适配器的 SecretStore.get、refresh、队列/限流/发现/当前条件及 transport 最后 await；期间逐项撤销、过期、scopes 不足、换账号/同账号新授权 epoch、凭证 generation、工具/Schema/包或策略版本变化、取消、决定到期、step/started 绑定失效。合法同一 refresh operation/CAS 转换设正对照；另在可能已派发后注入同类变化/坏回包 | 原 source/冻结账号/决定 hash/step/started、工具及 Schema/包版本、捕获 epoch/generation/scopes/期限/取消/策略在最后等待后真实发送点核验；非秘密预验不顶替。任何失效发送增量=0，旧 token 不贴新 epoch/generation，仅原 operation 受信 CAS 的合法刷新可继续原绑定；校验到 I/O 无未核验 await。started 不证明已发；权威确定未派发才确定拒绝，可能已派发仍 outcome_unknown，不宣称网络原子撤回。旧 unknown/auth phase、相等双键与 R03-01–05 全部保持 |

| 退回项 | 实际修订章节 | 复评定位 |
|---|---|---|
| R03-01 | §3.2/3.3/3.4、§4.5/4.6/4.7 | T24/T25，旧键同 Tx 意图、producer 结清、恢复引用；Q10 系统库保证仍未闭环 |
| R03-02 | §3.3、§4.6/4.7 | T26/T27，独立失效屏障、原票据最终派发、增量取消与 revoke 分开 |
| R03-03 | §3.2、§4.10–4.12 | T28/T29，逐流证据/变化门槛、缺失禁用、末页完整 CAS；Q08 尚未闭环 |
| R03-04 | §2.1、§4.5/4.8、§5 | T31，未知保留/内部 phase、requestId 权威查询、TTL 分离；Q02/Q06 尚未闭环 |
| R03-05 | §4.9、§6.2 | T30，前决零写、无假上下文/结果、键预览前物化不可编辑；Q06/Q07 尚未闭环 |
| R03-06 | §2.1/2.2、§3.3/4.1 认证路径摘要、§4.3/4.7/4.8、§6.1/I7、§7、§8 Q05/Q06/Q10 | T33/T34，运行时注入/实际及嵌套错误金丝雀、适配器外取密/接 token 为 0、非秘密预验与最后 I/O 闸门分开；U07-05/公共查询/恢复仍未闭环 |
| 规范/B01 | §4.2、§7.1、§8 | T32/P01–P09；仅确认旧包静态事实，替代实现/探针未获通过 |

本轮只修改设计与测试计划。T01–T34、P01–P09 全未执行；未使用真实授权、系统凭证或工作数据，未安装/运行 v2、修改代码/配置/权限、执行外部动作。修订覆盖不等于故障断言已验证，更不等于公共契约闭环或批准实施。

### 7.4 POC 可复用与禁用项

完整只读检查了 POC `src/oauth.ts` 与 `src/secrets.ts`，未运行或读取秘密：

- oauth.ts 的随机 PKCE 生成算法可作合成夹具；pending Map 没有持久化、issuer/账号/AuthResume 绑定，不可直接迁为 Broker。
- validAccessToken 处理无 refreshToken 回包的思路仅作 Provider 特定策略参考；没有并发单 flight、epoch CAS、轮换未知结果恢复，不可原样复用。
- secrets.ts 调 `security add-generic-password ... -w value` 把秘密置进进程参数，按 ADR-0017/I7 禁止迁入；由 MOD-01 原生凭证库替代，不能以 POC 用过为依据降级。
- POC 11 个单测和 tsc 不覆盖真实授权、modern MCP 或 Windows。首批连接器端点/权限/映射须 MOD-04 独立查官方资料和实测，不继承“POC 已成功”的错误结论。

## 8. 未决问题

B01/Q01–Q10 已统一归属 [Q13 MOD-03 协调](../open-questions.md#mod-03-连接层协调)，与 U07-01/02/04/05/07/08/11 及 MOD-02 Q01/02/05/07/09/10 联合处理；R03-01–05 已由主会话复评满足设计修订要求，新增 R03-06 对齐 R07-04 的指定认证适配路径及非秘密权威查询/运行时隔离，Q05/Q06/Q10 仍与 U07-05 联合未决。这里保留本模块原编号以便追溯，不另开一套已关闭清单。主会话只裁决责任与目标语义，**B01 和全部公共 Q 均未闭环，本文待复评、未批准实施**。未修改 contracts、ADR、README、open-questions、评审或其他模块；候选方向不是已批准接口，缺口不得以私有 import、直接读跨模块表、全局变量或伪成功绕开。

| 编号 | 缺口/阻塞 | 需主会话协调的最小方向与关闭证据 | 影响 |
|---|---|---|---|
| B01 | 主会话独立核实 1.32.2 Client/Server 旧握手、unknown version 回选 2025-11-25、环境白名单合并/stderr inherit；SHA-512 只是完整性 | 主会话、MOD-03/04/01 后续精确发行实现审查与 P01–P09；client/server 2.4.0 仅官方 README 声明候选，不下载/安装/运行或替主会话冻结。保持 modern 2026-07-28，不改常量/跳 connect/legacy 适配自证；方案变更另评 | MCP 实施前阻塞，尚未关闭 |
| Q01 | completeGrant(state,code) 不接 authorization response issuer、error、redirect 上下文；ProviderGrant.issuer 来自换码后，不能保护换码前 mix-up | MOD-03/08 明确受信回调校验结果如何交 Broker（含 iss/error/path/client/一次性校验）；若改接口由主会话批准。不同 Provider PKCE/issuer 不支持时不能静默降级 | OAuth 安全阻塞 |
| Q02 | requestGrant 同步返回与秘密就绪顺序、幂等建立/按 requestId 权威查询及就绪/终态读取未闭合；现有事件不能代替查询 | MOD-03/07/08/06/01 与 U07-05 联合；同步建 pending、后台准备仅候选，不认定一律改 async。URL 在双持久化后发布；创建/落链接切点可恢复，丢/重复事件可查询；pending TTL 与已 granted/当前凭证分离 | OAuth 启动、取消与未知核验授权恢复阻塞 |
| Q03 | token Provider 无接收用户 PAT、校验身份/scopes 的接口；AuthProvider token/none 禁用 exchange；OAuth ProviderGrant 缺账号/权限核验证据边界 | 明确认证用户提交秘密到 Broker 的专用接口/证据校验、最小 identity scope；MOD-04 给官方本人身份/已授 scope 核验方法。account 采用可验证标识，不盲信 login_hint | GitLab PAT M1 阻塞；三源账号冻结 |
| Q04 | 无 SyncEngine 公共触发/状态/取消接口；ConnectorHost.callRead/callWrite 不接 signal 或可取消调用 id | MOD-03/06/08 批准有界触发、运行/覆盖读取、取消绑定；公共取消传播到 transport。不能仅 Promise.race；写取消仍未知 | 手动近期报告、同步调度、M2 取消 |
| Q05 | ToolResultReader.get 范围绑定、完整可信依据、账号/工具/version/TTL/政策世代与降敏用户证据/保留规则未定；R03-06 要求 Reader/能力与 Host 投影运行时不可达携密依赖/值/错误 | MOD-03/02/05/06/07/08/09 联合受信 scoped Reader/证据及 Q06/Q10 装配；公开非秘密元数据待统一，不必全塞 ToolReadResult。结果/错误在指定认证适配路径交付前新建白名单，不复用 Credential/嵌套/错误引用，不靠 Omit。T33/真实注入与实际携密金丝雀，适配器外取密/接 token 为 0；撤权/过期不回原始 value，不自报 user 降敏，M1 self-only | 来源与模型/通知统一过滤；非秘密边界未证 fail closed |
| Q06 | callWrite ctx 字符串非冻结验证证据；tool() 无版本/Schema/digest pin；AuthResume 无权威查询/幂等恢复及内部用途绑定；缺受信非秘密当前账号/scopes/期限有效性/授权 epoch/凭证 generation 验证载体 | MOD-03/07/01/06 合并 U07-05、Q02/Q05/Q10：执行器只获新建白名单非秘密结果，无完整 Broker/credential/SecretStore，不以 status.granted/authorized/自报 verified 或 Omit 顶替。执行器预验与指定认证适配器最后取密/refresh/真实 I/O 闸门分开；核版本/冻结 args/hash/相等双键/source/账号/step/started/原 epoch/generation/scopes/期限/取消/策略，仅同 operation 受信 CAS 可刷新代际。T33/T34；未知保留 unknown/waiting_verification，原 requestId/phase 绑定，不读 act_、不私加 API | M2 写与授权/核验恢复阻塞；公共非秘密查询/请求终态/幂等恢复未闭环 fail closed |
| Q07 | 宿主错误/派发确定性、权威核验结构/当前读取、完整只读预览与描述公共边界未闭合 | MOD-03/07/08/06/01 联合 U07-02/04/06/11；前决只本地纯规则/受信 read，callWrite=0，无假执行 id/started/WriteResult/私有旁路；found/权威与非权威 not_found 分开，未知不能伪成功 | M2 未知恢复/完整预览阻塞 |
| Q08 | capability settings、Manifest.source 实例化、正文 payload/Schema/hash、关系出边分页、window/primary/support/deletion、terminal checkpoint、机器可判游标过期/重置需统一 | 主会话、MOD-03/04/02/01 与 MOD-02 Q01/05/07/09 联合。逐流枚举/缺失资格须官方证据与测试；无证据禁 missing/incomplete，独立 tombstone 另登记。有界候选核验仅待评方案，不读 graph_ 或新造接口；不解析自由 detail 猜重扫，seen 各归属；M1 metadata-only | 扩展互操作/安全删除门槛；正文暂不可用 |
| Q09 | AuthProvider 无 version/endpoint/issuer/PKCE/refreshPolicy 登记元数据；自研连接器启动清单/第三方工具授权登记接口缺失 | 主会话与 MOD-01/04 确定版本化登记清单，批准环境、路径、工具/凭证映射与校验规则；provider id 不隐式编码未批准语义 | I26/I35 扩展演练与信任 |
| Q10 | 平台监督/旧 producer 退出与系统库每键 set/缺键 delete/失败语义、备份恢复 fence 未闭合；指定认证适配路径的真实组合根、必要序列化/注入/最终发送点隔离与非秘密当前验证/恢复世代仍未证 | MOD-01/03/06/07/02 合并 U07-05/U07-08、Q05/Q06；P04/P07/P09、T24–T27/T32–T34 联合验证。平台原生保证与连接层旧键意图/producer/CAS 分开补证；只有指定适配路径可取密/refresh/接收 envelope，普通执行器/调度/Reader/Host 投影无携密方法、对象/错误，不靠 Omit/SDK 全实例受信。非秘密载体/请求权威终态/幂等恢复由主会话统一公共契约，未闭环 fail closed、不私加 API。旧 DB+残留旧 key 匹配仍不恢复授权，最后 await 后原票据失效零发送、可能派发保持 unknown；逻辑断开与删除失败如实呈现，无明文/argv 降级 | 跨平台凭证/进程、运行时携密隔离与恢复阻塞 |

首批 Provider 的厂商权限、账号核验、PKCE/issuer、refresh 轮换和 GitLab read_api 可用性尚未实测；飞书消息 Q4、长连接 Q6 不构成已可用能力。本模块只设计失败可见和单源独立，不负责扩权限或批准公司策略。

## 9. 变更记录

- 2026-11-19：完整阅读指定愿景、五份架构/验收、体验规格、ADR、模板与 POC 记录；按冻结 v1 形成 MOD-03 待评审详细设计。
- 2026-11-19：只读核验官方 modern 协议资料和 npm SDK 1.32.2 发行包完整性，发现 B01；记录具体探针计划及 Q01–Q10，未运行产品授权/探针、未变更公共契约或权限。
- 2026-11-19：完整阅读首轮评审与 Q13；仅修本文头部、§1–§8 并追加本记录，新增旧键/producer 持久引用与 cleanup 状态、独立失效屏障/凭证票据、逐流枚举删除证据/末页 CAS、未知授权 phase、零写预览及预览前键绑定，澄清请求 TTL 与规范 MUST/SHOULD；新增 T24–T32 与 R03 定位表。头部改待复评，B01/Q01–Q10 均未闭环；v2 仅据主会话核验列后续候选，未取新包/运行探针或测试，未批准实施。
- 2026-11-19（R03-06 定向修订）：完整阅读 MOD-03 首轮修订复评、Q13/R03-06 及 MOD-07/R07-04 当前稿，核对冻结 Credential/AuthBroker/I7；仅修本文 §1 目标摘要、§2.1/2.2、§3.3/4.1/4.3/4.4 认证边界摘要、§4.7/4.8、§5/6.1/I7/I31、§7、§8 Q05/Q06/Q10 及头部/本记录。执行器/普通调度/Reader/能力/Host 外部投影无完整 Broker/credential/SecretStore 或实际携密对象/错误；取密/refresh/envelope/必要序列化与注入仅指定认证适配路径，非秘密验证新建白名单、不靠 Omit/status。执行器预验与最后 await 后真实 I/O 闸门独立，保留原 operation/epoch/generation CAS 和派发前确定拒绝/可能派发 unknown。新增 T33/T34 真实注入/携密金丝雀/适配器外取密及接 token 为 0/最后等待失效零发送计划。R03-01–05 已满足设计修订要求不回退，M1 metadata-only/self-only、M4 后置、TTL/规范与 B01 目标/候选保持；U07-05/全部公共 Q/T/P 仍未闭环，未执行 T01–T34/P01–P09 或新探针/授权/安装/外部动作，不自评通过或批准实施。
