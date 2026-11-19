# 模块：MOD-02 工作图谱

- 状态：待复评（R02-01/02 已满足设计修订要求，R02-03 定向修订待复评；公共契约未闭环，未批准实施）
- 负责会话：MOD-02 工作图谱详细设计会话
- 依据的架构版本：architecture v1（2026-11-19 冻结技术基线）
- 相关 ADR：0008、0010、0016、0017；旧提议与本文冲突时，以 ADR-0017 和冻结 contracts 为准
- 评审依据：[首轮退回记录：MOD-02](../reviews/2026-11-19-module-design-batch1.md#mod-02-首轮详细设计评审)、[首轮修订复评：MOD-02](../reviews/2026-11-19-module-design-batch1.md#mod-02-首轮修订复评)、[主会话 Q13：MOD-02 协调](../open-questions.md#mod-02-工作图谱协调)。主会话已完整复评 R02-01/02 满足设计修订要求，新增 R02-03 须对齐 MOD-03 R03-03；这些裁决不是已补齐的接口、测试通过或实施批准。
- 更新：2026-11-19
- 交付范围：仅修订本详细设计的 R02-03 完成/缺失对账门槛、失败矩阵、I20/F/G、Q07 及相关摘要；保留 R02-01 的精确人员 ID 全出口安全拒绝和 R02-02 的声明/物化生命周期。Q01–Q11、F/G 和逐源/双平台证据未闭环；没有产品实现、授权运行、配置或权限修改。本文的 Schema、表、预算和算法均非已执行验证结果。

## 1. 目标与范围

### 1.1 目标

把逐源授权得到的办公元数据转换为可确定查询、可回溯的实体与关系，使 CAP-01 能按用户选择的一到两周范围立即整理计划会议负荷，后续能力能查人、查背景、跟进承诺，不必每次重新拉源或让模型理解一套原始结构。

工作图谱是事实和来源层，不是规则记忆库，也不是自动行动入口。省时来自复用结构化背景、避免重复整理和幽灵事项，不来自扩大采集范围。事件计数、日历空档、模型推算均不能被本模块解释为真实工时。

### 1.2 做与不做

| 本模块负责 | 明确不负责 |
|---|---|
| EntitySchemaRegistry、13 种内置实体 attrs Schema、版本校验与迁移 | 更改 contracts、运行时清单、OAuth scopes、供应商接口探针 |
| `(owner,id)` 实体、关系、人员身份、图谱索引 | 保存凭证、原始 API 回包、供应商 SDK 对象 |
| 受调用上下文约束的全部 WorkGraphReader 方法 | 对外写工具、批准提议、当前源系统前置条件核验 |
| applySync、持久化 seen 集合、实体 source/stream 归属、窗口对账 | 网络拉取、同步调度、授权、sync_ 游标或 rt_ outbox 的 SQL |
| 正文分离存储与读取审计语义；写入入口缺口明确阻塞 | 借 attrs/title/Relation.attrs 传正文，或私造正文写接口 |
| 能力私有派生实体、来源敏感度继承 | 模型调用、通知出口披露决策、可编辑 Markdown 记忆 |
| 身份精确匹配及手动合并的数据与回溯设计 | 模糊姓名匹配、模型自动合并、M4 共享传输协议 |

M1 限 self-only、metadata-only，建实体/查询/检索/同步基础和 CAP-01 可用数据；仍以对应契约、逐源映射及测试闭环为前提，不表示现在可实施。M2 按批准接口开放手动身份管理和正文使用；M4 仅在共享入口、ACL 和撤回语义批准后导入远端 owner。M1 不建立绕过同步引擎的共享 Writer。无法安全披露人员 ID 的事实保留落库但不返回不安全投影；请求链成功但未具备逐流源枚举/缺失证据也只能标 incomplete、保留未见候选。报告必须说明范围未覆盖，不能把隐藏或枚举不完整的事项解释为零工作。

### 1.3 基线阅读与适用说明

已完整阅读：README、00-vision、architecture 的 overview/contracts/invariants/roadmap/acceptance、companion-experience、ADR-0008/0010/0016/0017、module-design 模板、time-audit-poc。

ADR-0010 中“原始结构作为附属”不作为落库依据；overview §5 明确原始接口响应不持久化。ADR-0010 的本机中文 FTS 验证只是一条历史证据，不证明安装包或 Windows 上已可用。ADR-0017 修正读取边界、快照删除、来源与敏感度，本文不复活旧的单页 replaceRange 做法。

## 2. 对外接口

### 2.1 实现及依赖清单

仅实现 contracts §2.4 的 WorkGraphReader、WorkGraphWriter、DerivedWriter，以及 §12 的 EntitySchemaRegistry；不增加公开方法或另一个 Tx/AuditWriter 版本。

| 接口 | 注入/持有方 | 使用约束 |
|---|---|---|
| EntitySchemaRegistry.register/get | 启动组合根；受信连接器/能力使用已登记 Schema | 注册不是权限申请，也不执行远程代码 |
| WorkGraphWriter.applySync(batch,cursorCommit) | 仅 MOD-03 同步引擎 | 宿主填写 owner、来源、快照信息；cursorCommit 同步接受同一个 Tx |
| WorkGraphReader | MOD-06、MOD-08、MOD-05 等受信 Reader 使用者 | 每个实例绑定认证 actor、本人、允许 owner/source/type/正文用途；未绑定实例不对外提供 |
| DerivedWriter.upsertDerived/removeDerived | 能力的 CapabilityContext | 绑定 capabilityId/runId/self；只能写该能力私有派生实体 |
| StorageService.registerMigrations/transaction | MOD-01 注入 | 本模块登记 moduleId=MOD-02、tablePrefixes=[graph_]；只用 run/get/all |
| AuditWriter.append(record,tx?) | MOD-01 注入 | 中央 audit_ 仅由该服务写；图谱不直接 SQL 操作审计表 |
| EventBus.publish(event,tx?) | MOD-06 注入 | 同事务写 outbox；不由图谱直接操作 rt_ 表 |

Reader 绑定是 contracts §2.4 已冻结的语义，不是新公共工厂接口。组合根如何从认证身份、能力声明、共享 ACL 建立该绑定，尚无完整契约，列为 Q02；不能让普通插件自行构造“允许 any owner”的 Reader。

### 2.2 方法的确定语义

| 方法 | 本设计的语义 |
|---|---|
| get(id,owner?) | owner 缺省为 self；仅查这个复合键，不以 id 在其他 owner 回退；不存在、不可见或含不能安全披露的人员引用均返回 undefined，不删必填字段或改原值 |
| query(q) | 默认 self；any 仅表示调用者已获准 owner 的并集；固定排序及稳定游标见 §4.2；在排序/limit/session 固化前完成整实体及人员引用检查 |
| related(id,opts?) | 锚点、有效声明及两端均须当前可见；Person 端点执行 §4.1 的精确输入/输出检查；不以 entity=undefined 泄漏隐藏 id；关系分页限制见 §4.3/Q05 |
| search(text,opts?) | 同 owner/type/source/可见性及人员投影约束；只返回 Entity，正文匹配也按正文读取授权与审计处理，不能返回 snippet |
| content(id,owner?) | 元数据及人员投影可见不等于正文可读；先验证全部读取边界，再本地同步读取、追加审计成功后返回 |
| person(id) | 精确证明输入 ID 在当前范围可解析，再解析内部映射并证明输出 canonical ID 可披露；任一失败为 undefined，不因有一条无邮箱可见身份披露隐藏邮箱 ID |
| self() | 仅返回宿主认证、允许当前用途的最小本人档案；其 ID 也须有可信档案证据；未具备则服务不可用，不伪造 Person 或借隐藏源补全 |
| upsertDerived | 批次原子校验，强制绑定 owner/source/能力归属；继承证据敏感度；不改变源实体 |
| removeDerived | 同 owner 且该 capability 所有的派生 id 才能删；越权 id 使整批失败，不先删合法项 |
| register | 同 type/version/规范化 Schema 哈希重复登记为无副作用；同键不同 Schema 是启动冲突；不覆盖旧版本 |
| get(type,version) | 仅返回这一确切版本的不可变副本；未知为 undefined，不猜最新版本 |

EntityQuery 的 attrs 只接受登记字段的等值匹配；不接受 SQL/JSONPath/表达式。缺失与 null 不相等。数组和对象按规范化 JSON 深度相等，不变成 contains；标量按 Schema 类型精确比较，false 不等于 0，数字 1 不等于字符串 "1"。

### 2.3 缺口与实施边界

冻结接口没有正文载荷、身份管理写入口、关系读取分页、共享 ACL/缓存策略注入或能力可写类型范围。本文分别给出内部设计及保守边界，但不借构造参数、Tx SQL、配置键、工具名或 EventBus 事件私造跨模块接口。相关功能在 §8 裁决前不得宣称可实施。

R02-01 首轮修订选择“保持冻结 ID 与原始事实，拒绝不安全结果”，不在返回值里把隐藏邮箱 canonical 改成临时 local 字符串；主会话已复评其设计修订满足要求，公共 Reader/身份与报告依赖仍未闭环。“同人按授权范围返回安全别名”的公共语义只列 §8.1 候选，未经 ADR/重评不可启用。R02-02 的 graph_ 内部声明/物化模型保持不变，不新增跨模块入口。R02-03 的证明载体、complete/cursorCommit 语义和同 Tx 核验仍属 Q07 公共缺口；未统一前关闭 missing 对账，不以回调成功或连接器自报布尔值暗中补齐。

AuditRecord 使用冻结字段：id/at/actor/kind/refs/summary/outcome/detail；正文读取用 kind=tool_read_content，身份管理候选用已有 kind=config。禁止增加 graph.audit 表来代替中央审计，禁止擅加 content_read、identity_merge 等审计枚举。

## 3. 数据模型

### 3.1 Envelope、时间、主键与来源校验

1. `(owner,id)` 是业务主键，所有实体外键、删除、正文和关系 JOIN 都含 owner。禁止 `WHERE id=?` 或以 SourceId 当 owner。
2. 同步 owner 必须等于绑定本机主人；source 是本机稳定连接实例，不是 provider 名。同账号更换连接实例不得改写旧命名空间。
3. 同步实体 provenance.source 与 batch.source 一致，identity.attrs.source 也一致；id 按 `<source>:<type>:<native-id>` 映射。原生 id 的拼接/编码由连接器映射规范确定，宿主不以简单 split(':') 解析可含冒号的 SourceId 或原生 id。
4. 派生 id 为 `wa:<type>:<ulid>`，provenance.source 为 `wa:<capabilityId>`；能力所有权另存 graph_，不能靠 id 前缀授予修改权。
5. schemaVersion 为正整数且确切 Schema 已登记；attrs 为有限 JSON 对象，不接受 NaN/Infinity/undefined、循环对象或运行时代码对象。
6. 每条 Entity 都有 owner/visibility/sensitivity/provenance；本机同步和派生默认 private。源回包里的 space 或他人 owner 一律拒绝，不能触发共享。sensitivity 按 normal < confidential < secret 保持或提升；降低只接受用户明确决定的受信政策，接口缺口见 Q08。
7. occurredAt、endAt、fetchedAt 以及 attrs 时间统一为 UTC 毫秒、安全整数。允许负时间；区间 endAt 必须不小于 occurredAt，缺 occurredAt 时不允许 endAt。calendar_event 必须有两端且 endAt > occurredAt。正文 hash/更新时间不充当日程时间。
8. title 可缺省；空标题不表示实体不存在。nativeUrl 仅是来源链接，不由图谱访问；宿主校验 http/https 与已登记源域，不允许 javascript/file/data 协议或 URL 凭证。
9. contentHash 是源对象规范化内容的前置条件标识，不得用 fetchedAt 生成。相同 hash 不代表用户敏感度、关系、Schema 或 ACL 没有变化；这些必须分别比较。图谱不把本地 hash 当当前源系统核验结果。
10. hasContent 表示实际存在可读取的本地正文，而非“源支持正文”。冻结 batch 无正文时，M1 新实体必须为 false；不可把 true 空载荷写入（Q01）。正文读取权限另行判断。

### 3.2 EntitySchemaRegistry 与新类型命名空间

- 13 个无点的内置类型保留，不允许扩展抢占。第三方类型候选语法为 `<extension>.<type>`：extension 使用已批准的稳定小写登记 id，字符为小写字母/数字/连字符；type 使用小写字母/数字/下划线，以字母开头。仅一处点分隔，不接受 wa、graph、platform、内置类型名冒充扩展命名空间。该精确语法须主会话随新类型登记批准，不自动约束尚未登记的历史 SourceId。
- type/version 与规范化 JSON Schema SHA-256 保存在 graph_schema_specs；同键不同 checksum 启动失败。旧 Schema 永不通过 register 覆盖。数据库有 Schema 不等于允许安装其代码，启动仍必须显式登记受信实现。
- register 校验 2020-12 dialect、Schema 本身及本地引用闭包，编译后冻结；禁止远程 `$ref` 拉取、脚本/custom keyword 执行。拒绝未支持的 dialect/keyword，而非静默忽略安全限制。
- validator 候选为兼容 2020-12 的严格模式实现；具体库版本和打包兼容待 MOD-01/组合根验证。不启用类型强转、默认值填充、移除未知属性，以免宿主悄悄改事实。
- attrsSchema 只验证 attrs，完整 Entity envelope 和跨字段不变量由宿主验证。validator 成功不表示来源可信、账号有效或数据已授权。
- 新 type 或新增可选字段仍须总架构师批准；不兼容字段、required/enum 语义或数据含义变化须 ADR 和迁移。Schema registry 没有迁移函数接口，迁移属于本模块历史不可变 Migration，不借 register 执行。

### 3.3 内置 attrs 精确 JSON Schema（v1 候选，映射未批准）

下列是一份完整的 Schema 定义包，不是新增文件或公共契约。每个内置 EntitySchemaSpec.version=1；其 attrsSchema 由以下包按确定规则展开：复制 `$schema`、共享 `$defs`（NonEmpty/PersonId/Timestamp/Count/StringList），再把对应类型定义的 type/properties/required/additionalProperties 复制为根。引用只在展开后的本地 `$defs` 内解析。比如 get('issue',1) 返回 issue 对象根及五个共享定义，而非整个包或跨网络 `$ref`。

所有字段恰按 contracts §2.2；可选字段缺失不等于 null；所有对象拒绝额外属性。Schema 不添加正文、账号令牌、unionId 或项目原始对象。格式 email 是结构辅助，不能证明账号身份；精确邮箱归一化与可信来源另见 §4.4。

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$defs": {
    "NonEmpty": { "type": "string", "minLength": 1 },
    "PersonId": { "type": "string", "pattern": "^person:.+$" },
    "Timestamp": {
      "type": "integer",
      "minimum": -9007199254740991,
      "maximum": 9007199254740991
    },
    "Count": {
      "type": "integer",
      "minimum": 0,
      "maximum": 9007199254740991
    },
    "StringList": {
      "type": "array",
      "items": { "$ref": "#/$defs/NonEmpty" },
      "uniqueItems": true
    },
    "identity": {
      "type": "object",
      "properties": {
        "source": { "$ref": "#/$defs/NonEmpty" },
        "nativeId": { "$ref": "#/$defs/NonEmpty" },
        "displayName": { "type": "string" },
        "email": { "type": "string", "minLength": 1, "format": "email" },
        "handle": { "$ref": "#/$defs/NonEmpty" }
      },
      "required": ["source", "nativeId", "displayName"],
      "additionalProperties": false
    },
    "calendar_event": {
      "type": "object",
      "properties": {
        "organizer": { "$ref": "#/$defs/PersonId" },
        "attendeeCount": { "$ref": "#/$defs/Count" },
        "isRecurring": { "type": "boolean" },
        "location": { "type": "string" },
        "selfRsvp": { "enum": ["accepted", "declined", "tentative", "unknown"] }
      },
      "required": ["organizer", "attendeeCount", "isRecurring"],
      "additionalProperties": false
    },
    "mail_message": {
      "type": "object",
      "properties": {
        "threadId": { "$ref": "#/$defs/NonEmpty" },
        "direction": { "enum": ["sent", "received"] },
        "category": { "enum": ["personal", "notification"] },
        "labels": { "$ref": "#/$defs/StringList" }
      },
      "required": ["threadId", "direction", "category", "labels"],
      "additionalProperties": false
    },
    "mail_thread": {
      "type": "object",
      "properties": {
        "messageCount": { "$ref": "#/$defs/Count" },
        "lastMessageAt": { "$ref": "#/$defs/Timestamp" }
      },
      "required": ["messageCount", "lastMessageAt"],
      "additionalProperties": false
    },
    "chat": {
      "type": "object",
      "properties": {
        "chatType": { "enum": ["p2p", "group"] },
        "memberCount": { "$ref": "#/$defs/Count" }
      },
      "required": ["chatType", "memberCount"],
      "additionalProperties": false
    },
    "chat_message": {
      "type": "object",
      "properties": {
        "chatId": { "$ref": "#/$defs/NonEmpty" },
        "threadId": { "$ref": "#/$defs/NonEmpty" },
        "mentionsSelf": { "type": "boolean" }
      },
      "required": ["chatId", "mentionsSelf"],
      "additionalProperties": false
    },
    "document": {
      "type": "object",
      "properties": {
        "docType": { "$ref": "#/$defs/NonEmpty" },
        "lastEditedAt": { "$ref": "#/$defs/Timestamp" }
      },
      "required": ["docType", "lastEditedAt"],
      "additionalProperties": false
    },
    "issue": {
      "type": "object",
      "properties": {
        "project": { "$ref": "#/$defs/NonEmpty" },
        "state": { "$ref": "#/$defs/NonEmpty" },
        "labels": { "$ref": "#/$defs/StringList" }
      },
      "required": ["project", "state", "labels"],
      "additionalProperties": false
    },
    "merge_request": {
      "type": "object",
      "properties": {
        "project": { "$ref": "#/$defs/NonEmpty" },
        "state": { "$ref": "#/$defs/NonEmpty" },
        "draft": { "type": "boolean" },
        "sourceBranch": { "$ref": "#/$defs/NonEmpty" },
        "targetBranch": { "$ref": "#/$defs/NonEmpty" }
      },
      "required": ["project", "state", "draft", "sourceBranch", "targetBranch"],
      "additionalProperties": false
    },
    "code_push": {
      "type": "object",
      "properties": {
        "project": { "$ref": "#/$defs/NonEmpty" },
        "ref": { "$ref": "#/$defs/NonEmpty" },
        "commitCount": { "$ref": "#/$defs/Count" }
      },
      "required": ["project", "ref", "commitCount"],
      "additionalProperties": false
    },
    "activity": {
      "type": "object",
      "properties": {
        "action": { "$ref": "#/$defs/NonEmpty" },
        "targetType": { "$ref": "#/$defs/NonEmpty" },
        "targetId": { "$ref": "#/$defs/NonEmpty" }
      },
      "required": ["action", "targetType"],
      "additionalProperties": false
    },
    "commitment": {
      "type": "object",
      "properties": {
        "direction": { "enum": ["i_owe", "owed_to_me"] },
        "counterpart": { "$ref": "#/$defs/PersonId" },
        "dueAt": { "$ref": "#/$defs/Timestamp" },
        "status": { "enum": ["open", "done", "dropped"] }
      },
      "required": ["direction", "counterpart", "status"],
      "additionalProperties": false
    },
    "classification": {
      "type": "object",
      "properties": {
        "category": { "$ref": "#/$defs/NonEmpty" },
        "confidence": { "type": "number", "minimum": 0, "maximum": 1 },
        "by": { "enum": ["llm", "rule", "user"] }
      },
      "required": ["category", "confidence", "by"],
      "additionalProperties": false
    }
  }
}
```

补充的宿主语义校验（不能由 JSON Schema 单独完成）：

- organizer/counterpart 必须有宿主精确解析的人员引用绑定及证据；连接器自报 PersonId 字符串不是受信解析结果。organizer=PersonId 和解析次序仍是 Q09 候选，须逐源确认无邮箱参与者及未知必填表达。缺证据整页隔离并报告映射不可用，不填不存在的 PersonId，也不把这种拒绝方案当已支持合法缺失数据。
- 写入的原始人员引用及 source contentHash 保留；内部解析结果另存 §3.4 的引用绑定。读取时 organizer/counterpart 及登记扩展中的所有人员字段统一执行 §4.1；无法安全披露就隐藏整条实体，不将必填字段删掉/填空/替换为伪名后宣称同一 Schema。
- displayName 允许空字符串，表示源没有提供名称；Person 展示可使用可见 handle 或已验证可披露的 id，而非隐藏 canonical/邮箱回退或制造姓名。计数字段未知不能填 0；mail_thread 可为 0，但不能把过滤后的局部消息数当完整 thread messageCount。
- threadId/chatId/targetId 候选统一为归一化 EntityId；project 为 SourceId 内稳定项目键字符串，v1 不存在 project 实体，不偷注册该类型。状态/docType/action/targetType 的字符串值保留已受信映射后的源含义，不擅造 GitLab 或飞书枚举（Q09）。
- labels 是集合，连接器去重，存储与哈希按确定字节排序；其他数组不一律排序。category=mail personal/notification 与 classification.category 不是同一分类体系。
- by=user 不能由普通能力自报；只有认证本人编辑证据能建立或替换这一分类。用户编辑入口尚缺契约（Q08）；M1 普通 DerivedWriter 仅接受 llm/rule。
- JSON Schema 的 email format 默认并不保证断言，注册时需验证候选 validator 的明确行为；即使语法验证通过，也不证明邮箱由此人控制（官方依据 R4）。

### 3.4 graph_ 表清单

以下是逻辑表定义，实施迁移仅经 MOD-01；不在本次执行 SQL。除特别注明的逻辑引用外，实体引用用同 owner 复合外键。JSON 文本使用确定序列化；读写不暴露数据库行对象。

| 表 | 主键/唯一键 | 字段与职责 |
|---|---|---|
| graph_schema_specs | `(type,version)` | dialect、schema_json、checksum；历史只追加 |
| graph_entities | `(owner,id)` | type/schema_version、visibility_scope/space_id、sensitivity、provenance_source/connector_version/fetched_at/native_url/content_hash、title、occurred_at/end_at、attrs_json、has_content、revision、relation_revision（物化关系变化，不改源 hash） |
| graph_contents | `(owner,entity_id)` | body_text、body_hash、fetched_at；正文由已批准写入口提交，与 entity 同事务 |
| graph_entity_streams | `(owner,source,stream,entity_id)` | role=primary/identity/support、membership_mode=cursor/window、coverage_at（事件点）、coverage_end、last_seen_snapshot、last_seen_revision；实体同步归属事实，不是游标 |
| graph_relations | `(owner,from_id,to_kind,to_id,kind)` | 可重建的物化并集，不是来源权威；attrs_json、materialized_revision；from 实体及 entity 目标存在才物化，person 目标须有可解析内部绑定；每次读仍即时过滤 |
| graph_relation_sets | `(owner,source,stream,from_id)` | 当前完整出边集合的 set_generation、set_digest；空集合也有记录；外键指同复合键 from membership，删除归属只清该 holder 的集合 |
| graph_relation_streams | `(owner,source,stream,from_id,to_kind,to_id,kind)` | 来源权威出边声明、attrs_json、set_generation；外键指对应完整集合；to 是允许暂缺的同 owner 逻辑引用，不外键到目标或 graph_relations |
| graph_relation_derived | `(owner,capability_id,from_id,to_kind,to_id,kind)` | 派生所有者持有的权威出边声明、attrs_json、set_generation；外键指该 capability 的派生归属；不靠 graph_relations 保存唯一派生关系 |
| graph_persons | `(owner,person_key)`；唯一 `(owner,canonical_person_id)` | person_key 为至少 128 位本机随机持久内部键，非 PersonId；canonical_person_id 按冻结 v1，可能含隐藏邮箱；创建依据/identity_revision、merged_into_person_key；合并保留旧节点并指向当前根，旧节点不冒充当前 Person，键/canonical 不直接输出 |
| graph_identity_links | `(owner,identity_id)` | 当前 person_key、匹配 basis、resolution_revision；外键到身份及内部人员键，不授予公开 canonical 的读取权 |
| graph_identity_keys | `(owner,key_kind,key_scope,key_value,identity_id)` | 精确邮箱/源原生 id/待批准的 union 键；key_scope 含连接或应用/租户范围；冲突保留不强行选人 |
| graph_person_id_evidence | `(owner,reference_id,evidence_kind,evidence_id)` | 精确 PersonId 的 identity 或可信本人档案证据、当前 person_key、建立 revision；local 的创建身份绑定或 email 的精确字段证据，证据当前可见性不持久当授权 |
| graph_person_references | `(owner,from_id,location,reference_id)` | location 为实体字段 JSON Pointer 或含 source/stream（派生含 capability）的关系 holder/kind/to 位置；原始 ID、宿主证据引用/person_key；from 外键；不改 attrs/Relation.to/hash，target 暂缺不级联删除 |
| graph_identity_history | `(owner,operation_id,sequence)` | link/match/conflict/merge/undo 类型、前后 person_key/canonical/证据映射、identity 引用、at/actor；只追加，不存正文 |
| graph_person_aliases | `(owner,alias_id)` | 内部 canonical 归一关系、目标 person_key、operation_id；拒绝环；不对外导出，也不建立公开 ID 许可；alias_id 本身仍可能含邮箱 |
| graph_sync_snapshots | `(owner,source,stream,snapshot_id)` | 精确 from/to、状态 open/completed/incomplete/abandoned、page_count、last_next_cursor_digest、started_at/completed_at、completion_fingerprint；incomplete 是合法 terminal 已提交但完整性未证，completed_at/fingerprint 不作成功完成标记；不新建证明表或私有证明载荷 |
| graph_snapshot_seen | `(owner,source,stream,snapshot_id,entity_id)` | 累计本轮成功页已见实体；包括 primary/identity/support，身份不按时间窗口删 |
| graph_snapshot_candidates | `(owner,source,stream,snapshot_id,entity_id)` | 首个成功页时固化该窗口原有 primary 归属、coverage、stream revision；删除候选而非全图扫描 |
| graph_snapshot_pages | `(owner,source,stream,snapshot_id,page_no)` | 页摘要、next_cursor_digest、实体计数、提交图谱 revision；图谱侧收据，不替代 sync_ 请求游标/CAS |
| graph_derived_owners | `(owner,entity_id)`；唯一 `(owner,capability_id,entity_id,set_generation)` | capability_id、run_id、type、set_generation/set_digest（完整派生出边，含空集合）；不可覆盖所有者；generation 与声明一致 |
| graph_derived_evidence | `(owner,derived_id,evidence_owner,evidence_id)` | derived_id 外键到派生 from；输入复合键为允许 missing 的逻辑引用、不随输入 target 删除级联；hash/revision/current/stale/missing 持久化，依赖传播不能只用 id |
| graph_search_metadata | search_rowid 整数；唯一 `(owner,entity_id)` | title_text 与登记的元数据投影、normalization_version；正文不放在这里 |
| graph_search_bodies | search_rowid 整数；唯一 `(owner,entity_id)` | 正文搜索规范化副本，外键正文；只在正文授权与实现批准后启用 |
| graph_fts_metadata / graph_fts_bodies | FTS5 rowid | 两套 external-content trigram 索引；其自动 shadow tables 仍以 graph_ 开头 |
| graph_read_sessions | session_id | Reader/actor/owner/source/type/purpose 范围摘要及 query 摘要、graph_revision、policy_revision、schema_revision、identity_revision、expires_at；不存原文人员查询 ID/检索词/正文，不把摘要当授权 |
| graph_read_session_items | `(session_id,ordinal)`；唯一 `(session_id,owner,entity_id)` | 首次 query 固化的排序键及实体 revision；跨页稳定结果集合 |
| graph_state | key | 单调 graph/Schema/identity revision、relation_set_sequence（分配不复用的集合 generation）；不是授权配置或能力运行状态。身份映射/证据改变递增 identity revision，即使暂无输出变化 |

graph_search_bodies 与 graph_contents 的本地副本及 FTS tokens 都是敏感数据，不因为叫“索引”就低敏。正文删除必须同事务删除它们。所有 FTS shadow tables、index、trigger 名使用 graph_ 前缀；依赖检查还要覆盖触发器 SQL，不仅检查业务 run()。

候选索引：graph_entities `(owner,type,occurred_at,id)`、`(owner,provenance_source,occurred_at,id)`；实体流 `(owner,source,stream,role,coverage_at,coverage_end,entity_id)`；物化边反向及声明目标反向均建 `(owner,to_kind,to_id,kind,from_id)`，声明另含 source/stream，派生声明含 capability_id；声明 holder 前缀含 owner/source/stream/from；身份键 `(owner,key_kind,key_scope,key_value)`；ID 证据按 owner/reference_id 及 owner/person_key/identity_id，人员引用按 owner/person_key/from_id；seen/candidates 按 snapshot 前缀；derived_evidence 按输入复合键。attrs 仅对高频已登记字段建表达式/投影索引，不动态创建用户 SQL。

#### 声明、端点与身份的外键约束（R02-01/02）

- graph_entity_streams 到 graph_entities 的复合外键可随 from 物理删除级联；graph_relation_sets 到对应 `(owner,source,stream,entity_id)` membership 可级联，提供 holder+set_generation 唯一键供 graph_relation_streams 外键级联。这是“from 归属消失”方向；完整替换须先删旧声明/该 holder 的关系引用绑定，再更新 generation/插入当前声明及绑定，一事务完成。
- graph_relation_streams 和 graph_relation_derived 的 to_id 均**不得**外键到 graph_entities、graph_persons 或 graph_relations；也不许 trigger 在目标删除时删除声明。物化 graph_relations 的 from 可外键到实体；多态 to_kind 的 entity 目标存在性由受信同 Tx 检查，不用单一外键误把 Person 当 Entity。目标删除显式清物化边，绝不清入边声明。
- graph_relation_derived 到 graph_derived_owners 的 owner/capability_id/from/set_generation 唯一键可级联，只随派生 from 归属或完整出边替换消失；替换派生集合也先清其旧声明/绑定，再更新 generation。graph_relations 不能作为来源或派生声明的父表。空出边 set、generation 与来源 attrs 是重建权威，物化丢失可恢复，权威声明丢失不能猜边。
- 人员证据与引用的内部键均含 owner；graph_person_aliases 不跨 owner，历史/别名不因目标源删除级联清除。当前 identity 链接和证据随身份删除失效，保留的历史不计为当前证据。可信本人档案只有宿主引用，不复制平台表或增设档案 Writer。
- graph_derived_evidence 的输入是逻辑复合引用，目标删除保留 hash/状态并置 missing；只有 derived from 删除才级联其证据。seen/candidates/pages 的父表是相应快照，其 entity_id 是历史集合成员而非 target FK，不因实体删除清掉分页证据；不得从这些记录恢复关系声明。
- CHECK 覆盖 to_kind/kind、generation 正整数、visibility 的 space_id 同步存在性、schemaVersion 正数、hasContent 布尔、计数与时间类型。没有 FK 不等于可接任意 owner：宿主确认声明 holder、引用命名空间及证据 owner，Reader 再核验所有端点。

SQLite 外键开启、JSON 能力、SQL 参数、级联方向和索引计划由 MOD-01 联合探针验证；本稿不修改 PRAGMA。SQLite 单写者和 BEGIN IMMEDIATE 的具体选项属于 StorageService，不由图谱再开嵌套事务（R2）。

### 3.5 版本迁移与恢复

Schema 版本、数据库 Migration.version、connectorVersion 和 search normalization_version 是四个独立维度，不相互替代。

1. 首次正式 graph_ 迁移建立表、索引、注册内置 Schema checksum；没有正式旧 graph_ 数据时不创造迁移样本当生产数据。
2. 新 attrs 版本登记 v2 后，受信本机纯转换明确 v1→v2，逐行验证旧输入和新输出。不能跳过中间版本或因新 Schema 已登记就把 schemaVersion 直接加一。
3. 迁移需要 ADR/批准、MOD-01 备份及不可变 checksum。转换只能写 graph_；同步暂停、Reader 不服务半迁移。正常同步旧格式经批准转换链写当前格式；未知未来版本整页拒绝，不推进游标。
4. 转换不调用模型、连接器、SecretStore 或网络；不丢证据、不降敏感度、不丢 user 分类/合并历史。只变规范化 attrs 时保留原 source contentHash，增加本地图谱 revision；源前置条件 hash 不能被迁移 hash 污染。
5. 小迁移一事务；大迁移是否允许 graph_ staging 分段构建、最终原子切换，须 MOD-01 明确迁移锁与备份边界后才用（Q10）。不以分段迁移的中间状态恢复能力。
6. 完成后重建/验证 FTS、实体外键、Schema 覆盖、内部身份/精确 ID 证据及引用绑定、流归属、关系 holder/generation 和声明→物化并集；读分页游标因 Schema/graph/identity revision 变化失效。声明没有 target FK，迁移不得以清孤儿 target 为名删有效入边声明。迁移失败恢复整体一致备份及旧应用，不改历史迁移或做半表回退。
7. 未理解的共享 Schema 不导入图谱、不允许 get/query 假装支持；由 MOD-10 标不支持。能力停用不删除其 Schema 或别人数据，停触发和显式数据清理由负责模块协调。

## 4. 内部设计

### 4.1 全部 Reader 的 owner 与可见性边界

Reader 的有效集合是：绑定 owner 集合 ∩ source/type 声明范围 ∩ 实体可见性 ∩ 当前缓存/源策略；正文另加用途及正文权限。调用时参数只能收窄，不能授予新权限。身份精确聚合也受这一集合约束，内部 person_key、canonical、历史和别名都不是授权证据。

| 数据/调用 | 本人交互 Reader | 能力 Reader / 网关 Reader | 其他 owner |
|---|---|---|---|
| private 元数据 | 认证本人且符合缓存策略可读 | 在绑定 source/type 范围内可读；不是继承完整本人数据库权限 | 一律不可读 |
| space 元数据 | 须满足有效共享读取范围 | 还须显式绑定该 owner/space | 仅相应 space 当前成员及批准资源，M4 后置 |
| secret 元数据 | 认证本机界面可按用户选择查看 | 不自动保证可入模/通知，出口仍禁止 | 共享入口须政策批准，M1 禁用 |
| 正文/正文匹配 | 必须明确允许的本机查看用途 | 必须正文读权限和明确 purpose；网关再次过滤 | 同时满足 owner/space/正文许可 |
| 人员/关系间接引用 | 可见身份、公开 ID 的精确证据及边端点全部通过 | 不因引用到某人而自动增加 identity/source 权限 | 不拼接另一 owner 的邮箱或别名 |
| self() / Entity.owner | 当前用途允许的宿主可信本人档案支持 ID | 同一最小档案；不借隐藏源补档案 | 不接受 remote owner 覆盖本人；远端 owner ID 的披露契约留 M4 |

#### 内部归一键、精确引用证据与公开 ID（R02-01）

三者分开：person_key 是 owner 内持久随机内部键；canonical_person_id 是冻结 v1 的人员标识选择，可能含邮箱；公开 ID 只有在本次 Reader 范围内通过证据检查才可输出。内部 alias 的闭包只回答“历史引用归到哪个内部人”，不回答“输入或输出 ID 是否受权”。本轮不提供新的公开 alias，也不把 PersonId 的“有邮箱时用邮箱”改为“按 Reader 换 ID”。

- 邮箱型 ID 的证据必须精确支持该邮箱：当前可见 identity 的受信结构化 email 归一后等于 ID 的邮箱部分，且其当前链接归到该 person_key；或当前 actor/owner/purpose 允许的受信本人档案明确支持此邮箱。B 的历史 email/alias、隐藏 identity、另一条无邮箱 A、人工选 canonical 的动作、正文中的邮箱都不能代证。
- local 型 ID 必须是持久创建的冻结 local ID，有对应可见创建身份/可信本人档案的精确绑定，且当前归一结果一致。解析不接受任意 `person:local:*` 占位，不从字符串生成新 Person，不因知道内部 alias 就拥有 local ID 的使用权。
- merge 保留旧 person_key 节点/原 canonical 并记录 merged_into_person_key，当前 identity/ID 证据/引用绑定改指根；输出只考虑根 canonical。旧节点不复制根邮箱作为自己的 canonical，避免唯一键冲突和伪造证据；undo 可据历史恢复旧键。无既有邮箱根时 local→email 可以更新当前根 canonical，并保留旧 local 的内部 alias；以上都不授权披露。
- graph_person_id_evidence 持久保存“哪一条结构化证据曾建立哪个精确 reference_id”；当前可见性每次重新计算。同步邮箱修改/身份删除使旧证据失效；merge/undo 改变 person_key 映射但不把证据复制给其他邮箱 ID。历史只有解释作用。graph_person_references 记录字段/边的宿主解析依据，防止 connector 自报 ID 建立绑定。
- 所有判断以同 owner 为边界。same PersonId 在另一个 owner 内的证据不能代证；owner=any 也必须逐 owner 独立核验。冻结 person(id) 没有 owner 参数，M1 固定 self，不遍历 allowed owners 猜匹配；多 owner 人员定位留待 M4 契约。

#### 同范围输入与输出流程

以下为内部算法步骤，不新增公开方法：

1. 读取宿主受信 actor/self/owner/source/type/purpose、即时 policy generation 和 identity revision；无法得到有效绑定就不可用。多语句查询用有限本地同步事务，序列化返回前重验政策世代；跨模块即时检查入口仍属 Q02/Q03，不假定 SQL 快照锁住授权。
2. 人员输入首先在该 owner 的精确 ID 证据集合中找当前允许证据。没有则 person 返回 undefined，query.relatedTo 返回空授权匹配集，与未知 ID 一致；不先查全量 alias/邮箱键再决定报什么错。不得回显隐藏输入、canonical、冲突人数或“此人存在但无权限”。
3. 仅对证据通过的输入，在 owner 内解析 person_key/alias，检测冲突和环；再次核验输出 canonical_person_id 的精确证据。输出 canonical 邮箱隐藏则拒绝整个人员解析结果，即使输入 local A 合法，也不返回其隐藏邮箱 canonical 或悄悄换回 A 的 local ID。
4. 在同一有效范围中汇聚可见身份及允许的本人档案，确定 Person.displayName/emails/identities。本人显式设置优先，其次稳定 source/id 顺序；不从隐藏 canonical 作显示名回退。isSelf 只由宿主已认证本人链接决定，不由邮箱相同或 alias 相等自行认证。
5. 输出 Person.id 必须作为第 2 步的精确输入可同范围回查到同一 person_key；所有输出邮箱各有当前证据。范围/政策/身份版本不变时 `person(returned.id)` 确定，重启凭持久 ID/证据仍能回查；撤权/merge/undo 后不承诺旧 ID 继续可用。
6. relatedTo 人员锚点只有第 2–5 步全部通过才展开内部归一引用候选；每条关系、from 实体及其人员字段都再按当前范围核验。不是“查到一个合法 ID，就沿内部闭包开放所有来源”。entity 锚点则先验证当前 owner 的整实体，不能跨 owner 回退。

#### 全出口一致检查

| 出口/输入 | 检查与无法安全投影时的行为 |
|---|---|
| person / self / Person.id | 精确输入（self 用可信档案）和输出 canonical 双重证明；person 不安全为 undefined；self 缺最小合法档案是服务不可用，不能编造非可选返回值 |
| get / query / search 的 Entity | 先验证 Entity.owner 披露依据，再检查所有登记人员字段及其原始引用 ID；输出原值必须可同范围解析，不重写事实。任一不安全隐藏整实体，过滤发生在 limit、排序/session 固化前 |
| calendar_event.organizer / commitment.counterpart | 使用宿主持久引用绑定，不以“字段在可见实体上”证明隐藏 canonical 邮箱可披露；不能删 required 字段、填空或改字符串后返回 |
| Relation.to / related in、out | 原始 Person ID 的精确证据及其解析输出都通过；entity 两端当前可见。隐藏/缺失目标整边不返回，不用 entity=undefined 保留裸 to。in 返回 from 也必须整实体可投影 |
| query.relatedTo / attrs 的人员等值条件 | 人员字段参数先做同 owner 精确 ID 检查，再按冻结等值语义匹配原 attrs；不偷偷把等值变为 alias contains。隐藏邮箱猜测不能命中 A 的事项 |
| 正文读取 / 正文搜索 | 元数据整实体及人员投影先通过，再做正文授权和审计；不把 content 当绕过 metadata 安全拒绝的入口；M1 不启用正文 |
| 事件/结果/日志/索引/下游缓存 | 内部 person_key、alias、canonical 不进入事件、ApplyResult 或日志；metadata 检索不索引内部人员键或隐藏画像。下游重读绑定 Reader，并在模型/报告/通知出口重验同一证据范围 |

内置结构化人员位置为 Entity.owner、Person.id、Relation.to（person）、organizer、counterpart；扩展 Schema 和经批准的 Relation.attrs 必须登记所有人员字段路径/语义才能读写，不靠遍历任意字符串猜人员。M1 Relation.attrs 仅缺省或空对象（Q09）。已有自由文本仍按其来源/敏感度许可，不把本规则宣称为自动消除所有文本中的个人信息；禁止把内部归一 ID 搬进 title/attrs 来绕过结构化检查。

B 撤权而无邮箱 A 仍可见的反例：B 的精确邮箱证据立即不合格，Person、指向 B canonical 的边及含不安全必填人员引用的实体不可输出；猜测 B 邮箱输入也无资格查 alias。A 的 identity 自身仍可按原 Schema 可见，但它不证明 B 邮箱；缓存、分页、派生不得沿旧人员映射继续消费。拒绝造成的可用性影响须在 G0/G2/G4 复评，报告只说明范围未覆盖，不输出被隐藏邮箱/数目，也不声称没有事项。

所有 JOIN/EXISTS、FTS rowid 映射和 session 都含 owner；先安全筛选再 limit，不先截全图 N 条后过滤。scope 越界统一范围错误，缺失与不可见同结果。即时政策变化不依赖迟到 auth.revoked；policy、identity revision 或 Reader 范围变化使分页失效，见 §4.2。受权安全 alias 的候选及必要 ADR 依赖见 §8.1，不能用它宣称本轮公共问题已闭环。

### 4.2 query：过滤、确定排序和稳定游标

#### 时间与排序

查询 timeRange 为半开 `[from,to)`，from < to：

- 有正长度区间：occurredAt < to 且 endAt > from。
- 点事件（endAt 缺省或等于 occurredAt）：from ≤ occurredAt < to。
- occurredAt 缺失：不命中 timeRange，不伪造时间；无 timeRange 时可查询。
- 跨日会议按重叠选出；图谱不裁剪原始两端，CAP-01 按用户时区/统计窗口裁剪和并集。

固定顺序为 `(time_missing ASC, sort_time ASC, owner BINARY ASC, id BINARY ASC)`；time_missing=0/1，sort_time=occurredAt 或 0。NULL 不进入游标元组，保证 tuple comparison 不因未知值失效（R3）。同毫秒、同 id 的两个 owner 是不同元素，明确以 owner/id 破同序。query 不提供隐式 relevance 排序。

limit 默认 100、允许 1–500；超限/负数/非整数拒绝，不静默截断。types/sources 为空数组时结果为空而非“不筛选”；最多允许的字段数、查询体大小等实现边界须契约测试固化，无动态 SQL 名。

#### 游标 v1（内部格式，不新增字段）

候选格式 `gq1.<随机session-id>.<下一ordinal>`。session-id 用本机 CSPRNG 生成至少 128 位随机值；存数据库绑定 Reader/认证 actor/owner/source/type/purpose 范围摘要、规范化 query hash、Schema/policy/identity revision 与到期时间。它是分页定位符，不是 Bearer 授权。拒绝过长、非法版本/编码/ordinal、其他 Reader 的 token、不同过滤条件、不同 owner 或 graph/schema/policy/identity revision 的游标；错误不回显查询人员 ID 或隐藏 canonical。

采用“固化匹配键 + revision fence”，不用跨请求长读事务或全版本 MVCC：

1. 第一页在一个本地同步事务内取当前 graph/schema/identity revision 和受信 policy generation；人员查询输入先按 §4.1 验证，逐候选完成实体/人员引用投影检查后，以固定元组 keyset 枚举合格复合键，存 graph_read_session_items。筛选成本计入查询预算，不先固化隐藏匹配键或暴露其数量。
2. session 中只存键/排序/实体 revision，不复制 Entity/正文/Person/canonical。相同 query 的 token 重试在所有范围及 revision 不变时返回相同页；序列化返回前仍检查当前政策世代。
3. 后续页验证 graph/schema/policy/identity revision 及 Reader 范围仍相同，重验人员锚点/字段/端点，再按 ordinal 取 limit 条实体；任一变化返回 graph_cursor_stale，要求从第一页重查，绝不悄悄混合新旧页、跳过无邮箱 A 关联项或沿旧别名继续。已撤权范围不能以持有 token 回查。
4. get/query/related/search 的多语句读取均在有限同步事务内完成；不在用户翻页间持锁。graph revision 因实体/物化关系/可读人员/派生改变增加，fetchedAt 等返回字段变化也算；identity revision 因 match/merge/undo、邮箱证据/引用绑定及内部别名变化增加，不能因当时隐藏就跳过。policy generation 由宿主同步提供，图谱不自造授权表。seen/page 收据及 session 自身不增加上述 revision。
5. session 候选 TTL 为 10 分钟，最多 20 个/Reader、最多 20,000 个匹配键；超限返回 graph_query_too_broad，建议收窄，不给假完整列表。只清理 graph_ session；预算与真实数据规模须实测后批准。

稳定性是“静态图谱无重无漏、动态更新显式失效”，不是上游动态变化下的永久快照。频繁同步导致 cursor 失效的用户成本需要 M1 压测观察；若不可接受再 ADR 评审轻量版本化方案，不提前复制全量历史。R3 支持 keyset 优于大 OFFSET 的依据，但本稿的 session/失效策略是设计候选，不是 SQLite 自带保证。

### 4.3 关系声明、物化及分页写替换（R02-02）

#### 权威集合与可重建物化

graph_relation_streams 是由有效 `(owner,source,stream,from)` 归属持有的**来源声明**；graph_relation_derived 是能力所有者持有的派生声明。graph_relations 是从当前有效声明构建的**结构物化并集**。来源声明的生命周期由 from 的完整出边集合及归属决定，绝不由 to 的在场/可见性决定。

“有效归属”是仍留存的业务 membership，不等于当前 Reader 可以读该 source。断源隔离不自动销毁业务归属/声明；读取资格每次按即时政策判断。物化表不是每个 Reader 的权限缓存：物化可保留结构存在但某个 Reader 不可见的边，Reader 仍检查声明持有源、from、to 和人员投影。若隔离清物化，也只清物化，不当业务删除。

结构物化条件：至少一个当前 holder/set_generation 的有效声明、from 实体存在且属于同 owner；entity 目标在同 owner 存在，person 目标有同 owner 可解析内部引用绑定；重复边 attrs 一致。任何一项不满足不物化，但只要 from 声明仍有效就保留它。目标是否受某 Reader 许可由 §4.1 再检查，不把写入时的授权快照永久当读许可。

#### 本页完整出边替换

本页 E = batch.entities ∪ batch.identities，按 `(owner,id)` 去重；同 id 冲突整页失败。输入 from 必须属于 E（派生批同理），kind 登记，to 受信绑定为同 owner 逻辑 EntityId 或 PersonId；to_kind 由已批准端点语义/宿主映射确定，不凭字符串前缀猜，未明确者属 Q09。不能修改页外 from 声明或跨 owner 接边。Person 引用先保存宿主解析证据，内部绑定不自动授予公开 ID 许可。

1. 同事务 upsert E、身份/引用绑定并建立 graph_entity_streams membership。
2. 对每个 E 的 from，只完整替换该 owner/source/stream holder 的旧声明。graph_relation_sets 保留完整集合摘要，包括空出边；内容实际改变才生成新的 set_generation 并先删除旧 holder 的声明再写当前集合。generation 从 graph_ 单调序号取，from 删除再创建也不复用旧 generation；相同已提交集合重试可保持 generation。
3. 重算影响边：旧/新出边键并集，以及所有本页出现、删除或身份绑定改变的目标反向声明键。用反向索引收集，不要求把页外 A 重新拉取；重算只更新其物化，不改 A 的来源声明。
4. 对每条影响键重新读取当前 holder、generation、from 归属和端点，更新/删物化并集。target 仍缺则只删/不建 graph_relations；target 返回则从有效声明恢复。不能从旧物化、seen、事件或历史“补回”已替换的声明。
5. 同逻辑边多 stream/派生持有时，所有有效声明非空 attrs 必须一致，否则整页冲突回滚。冲突即使目标缺失也校验，不能拖到目标出现后偷偷择一。只移除一个 holder 时，其他有效 holder 的声明继续存在并重新决定物化。
6. 出边变化只替换该 from 的当前完整集合，不代表清整 stream。两页含同 from 时较新成功页替换其本 stream 集合；相同页幂等受 MOD-03 的 checkpoint/CAS 保护，不以旧请求复活旧 generation。

冻结 Relation/SyncBatch 无单 from 关系分片完成标记；网络阶段必须把该 from 完整汇聚才提交。大关系需 Q05 公共分片/分页契约，不借 snapshot.complete 当出边完整。实现预算不足整页明确失败、无部分声明/物化/游标提交；预算尚未验证。

#### target 与 from 删除的不同影响集

| 事件 | 来源/派生权威声明 | 物化与恢复 |
|---|---|---|
| B 从未到本地或暂缺 | 保留有效 A holder 的 A→B 逻辑声明；不要求 target FK | 无 A→B 物化/读结果；B 到来触发反向索引重算 |
| 移除 B 的一个 stream 归属 | 仅销毁以 B 为 from 且由该 stream 持有的出边声明/完整集合；A→B 声明不动 | B 有其他有效归属则保留实体，重算 B 出边；入边读仍检查 B 当前可见性 |
| B 最后归属消失并物理删 | 先清 B 自身所有有效 from holder（通常已随归属移除），删除 B/正文/索引及其 incident 物化边；**保留所有有效 A from 持有的入边声明** | 派生依据标 missing，不靠 Relation 墓碑返回 B id；B 返回后仅据现存声明重算 |
| A 的本 stream 完整出边变为空/不再含 B | 删除该 holder 的旧 A→B 声明，提交新 generation/空集合；别的 stream 不动 | 即使 B 后来重现也不能复活这份旧声明 |
| A 的一个归属移除 / A 物理删 | 前者只删对应 A holder；后者清 A 全部 from holder 与派生所有者声明 | B 重现不恢复已不存在的 A holder；别人指向 A 的有效声明仍按 target 规则留存 |
| B 隐藏/断源/撤权 | 留存 B/A 的业务声明，不自动删历史 | Reader 即时隐藏端点和边；可清物化，但再授权不等于自动允许旧缓存消费，须 Q03 政策 |
| 人员目标证据失效/merge/undo | 原 Relation.to/原始字段及来源 hash 保留；当前绑定/identity revision 更新 | 重新验证内部目标并重算，读时严格检查精确公开 ID；禁止借内部 canonical 泄漏 |

由此，即使 B 也作为 from 被删除，清除其 B→C 声明与保留 A→B 声明是两条不同路径。graph_derived_evidence 的缺失与最高敏感度另行持久化，不能因 A→B 声明保留就认为证据 current。

#### 三页反例与事务重建

前置合成状态：同 owner/source/串行 stream 中 B 已有合法归属。page1 写 A→B，page2 合法删除 B 最后归属，page3 重现 B，A 不再拉取。期望依次为：A→B 声明+物化；A→B 声明留存但物化移除；同事务核验现存 A holder/generation、A/B owner、B 新归属及端点条件后恢复物化。若 page2 后 A 集合不再含 B 或 A holder 已移除，page3 无此声明，就不恢复；多 stream 时只剩下未删除 holder 的贡献。

- applySync 在同 Tx 中维护声明、集合 generation、物化、身份、索引、依赖、seen、checkpoint/outbox；target 返回后的重算也属于这次事务。任一 cursorCommit/outbox/SQL 失败，回滚到前页完整状态，包括声明和物化，不能先清声明再单独补边。
- 影响集包含新/旧 from 集合、删/增 target 的反向声明、identity 链接变化的人员目标及依赖。物化改变的页外 from 也令 graph revision/其图谱关系 revision 变化，事件按受影响 from 的真实 source/type 分组；不重写其 attrs/contentHash。DomainEvent 缺 owner 仍是 Q11，不借新事件补私有恢复协议。
- 本地重建只从当前 graph_relation_sets、来源/派生声明、from 归属及当前端点绑定构建新 graph_relations，检查 attrs/owner/generation 后原子替换。Reader 不服务半重建；小重建一事务，大图 staging/切换待 Q10。禁止用旧物化、历史 alias 或快照 seen 恢复已删除声明；权威表损坏则报不可用并按平台恢复，不能猜关系。
- 结构重建不等于授权恢复；读取在有限事务中重验端点与至少一个当前允许的 holder，序列化前检查 policy generation。隐藏目标不返回裸 id、实体墓碑、隐藏边计数或 entity=undefined 占位。

#### related 读取

冻结 related 返回 Array，无 limit/cursor，不能改成公共分页。M1 候选在授权及人员投影过滤后内部 keyset 分块遍历，最多 2,000 个可见结果，超过整次 graph_relation_too_broad，不返回截断数组；该预算须实测，不据此称已解决大关系。out 返回目标 Entity，in 返回起点 Entity；Person 端点只有其原始公开 ID 可安全回查才返回，不塞进 Entity。不存在/隐藏 target 无结果。

query.relatedTo 也检查当前声明 holder 与两端，不因物化旧行就命中隐藏关系。它能分页取实体但不返回 Relation.attrs 或完整边集合，不替代 Q05 公共 related 分页。

### 4.4 身份精确匹配、手动合并与回溯

#### 自动解析只建立内部归一，不授予公开 ID

所有步骤在同 owner 内；person_key 不改 Entity.owner，也不对外序列化：

1. 先加载持久人工映射/undo 与显式冲突。既有 `(owner,source,nativeId)` 的 identity 链接优先保持；邮箱改变作为新精确证据记录，旧 email 证据失效，不能无提示换人或让人工合并历史自动消失。
2. 新身份按受信账号/参与者结构化字段取邮箱，trim 外层空白、转小写后精确相等。不从正文、标题、签名、显示名、模型或伪造 From 认证；不去点、不剥 +tag、不做域别名或 handle/拼音/编辑距离匹配。
3. 无冲突时，canonical_person_id 依冻结 v1 为邮箱型，否则为持久 local ID；另分配 owner 内稳定 person_key。此前 local 首次获得可信邮箱可建立内部 local→email alias、绑定精确证据并追加历史，不覆写旧 attrs/Relation.to。内部合并也不能凭 A 无邮箱身份给 B 邮箱建立公开证据。
4. 稳定 nativeId 与邮箱/人工约束冲突，保留已有或独立 local 映射并记 conflict，不强行选择 canonical。每个 reference_id 的当前证据都追踪到 identity/可信本人档案；merge 更新 person_key 归属，不增加未经证据支持的 ID。
5. 飞书 union_id 优先是冻结方向；open_id 限 SourceId/应用域，union_id 的应用/租户域及原生参与者映射待 MOD-04a/03 的 Q04/Q09 证据。未核验只按 source/nativeId，不按字符串前缀猜类型，不伪造 union/app 字段。
6. identity、email 证据、内部 alias、引用绑定变更同 Tx 增加 identity revision，重算受影响物化和派生状态；旧 session/Person 缓存必须失效。源撤权由受信 policy generation 即时禁用证据，不能等待一次重新同步。

外部 EvidenceRef、原始 organizer/counterpart、Relation.to 与源 contentHash 不批量重写；内部 graph_person_references 只保存解析依据。反查先执行 §4.1 的精确输入和输出检查，**然后**才在同 owner 展开内部引用闭包，且每个被返回的原始 ID 都单独证明；直接用 canonical/alias 闭包当授权被禁止。M1 精确映射可用性的逐源业务证据仍未闭环。

#### 人工合并与撤销（候选设计，受信入口未补）

仅已认证本人界面按批准身份管理契约操作；模型/能力/remote agent 只能建议，不能获得写入口。M2 候选流程：

- 预览只显示该本人范围内可披露的 ID、身份、邮箱、冲突及影响，不借管理界面解除断源隔离。内部 canonical 选择由受信服务根据用户决定及证据完成，不要求 UI 提交/显示隐藏邮箱 canonical；具体请求/返回尚待 Q04。
- 同事务追加 graph_identity_history（operation_id/actor/证据/前后内部链接及 alias），更新 links、ID 证据对应 person_key 和引用绑定，增 identity/graph revision，重算人员物化与派生依赖；AuditWriter.append 用冻结 config、身份 entityIds 和 operation/evidence 引用，不把隐藏 canonical/alias/person_key 抄成公开审计摘要或普通日志。
- 重复决定绑定同操作可幂等确认；自合并/跨 owner/成环/更改本机主人拒绝。合并决定不是新的邮箱证据、认证本人或共享许可，也不重写源 facts/hash。
- undo 追加而非删历史，恢复该操作 links/alias/证据归属；后续新同步按原精确键及后续历史重解析。若有更晚人工依赖，先撤销依赖或受信重新分配，不用裸逆 SQL 拆开。撤销后重新检查全部公开 ID，不承诺以前返回的 canonical 仍可读。
- 重启/全量重同步保留 person_key/local ID、人工记录与精确证据来源；源身份删除只失效当前证据/链接，不删除历史，也不从历史恢复可见身份。合并持久化与公开 ID 可用性分别验证。
- 冲突状态可保存合法 identity；强制人员字段确实无合法宿主映射时隔离整页并明示不可用，合法无邮箱/未知参与者的表达仍待 Q09，不能填假人后推进游标。

WorkGraphReader 只有 person/self，不能据此实现 list/merge/undo 路由或让 MOD-08 直接写 graph_。M1 精确映射与 M2 受信管理分开；Q04 的新契约和 §8.1 的公开 ID 语义候选分别需主会话统一裁决，本文未关闭任何一项。

### 4.5 派生实体权限与依据

绑定 DerivedWriter 的 capabilityId/self/runId 由 MOD-06 提供可信上下文，插件不能自报。只有 commitment、classification 以及明确批准可派生的扩展类型可写，不允许 identity、源邮件/日程或别人的派生 id。

- 首次创建校验 wa id/type 和 Schema；graph_derived_owners 保存真实能力归属，后续不可更换。写源强制 wa:<capabilityId>，connectorVersion 使用已登记能力版本，fetchedAt 使用宿主时钟，contentHash 由规范化派生载荷/依据生成。
- 所有派生为 self/private，hasContent=false；源于 space 的数据也不自动转为可共享资源。权限不因 commitment/分类是“抽象摘要”而放宽。
- 每个派生至少一条 derived_from；证据锚点必须当前可读，写入 graph_derived_evidence 保留 owner/id/hash/revision。冻结 Relation 无 evidence_owner，M1 只允许同 self 证据；跨 owner 派生要新受信证据接口（Q06），不能用裸 id 猜来源。
- 输出 sensitivity 至少取所有证据、旧派生及宿主策略的最高值；原证据 secret 时分类也是 secret。增加敏感度立即传播至全部后代，读时仍递归验证来源最高敏感度，不能依赖异步能力重跑。
- 证据删除、断源禁读、hash/内容或身份改变使派生状态 stale/missing，不直接宣称 done。Reader 隐藏无有效依据的派生；counterpart 等人员引用还须 §4.1 的精确公开 ID 证据和同范围回查检查，不能从隐藏 canonical 造一个可读 commitment。通知/报告/模型缓存重验 EvidenceRef 与 policy/identity revision；人工恢复或重新计算不洗白旧来源。
- 派生关系完整集合保存在 graph_relation_derived，由真实 capability/from 归属持有；graph_relations 仅物化。拒绝 derived_from 环；删除本能力派生 from 才能清其声明、正文/索引及证据，不能顺手删除其他有效 from 指向它的入边声明。其他证据指向它时标 missing，重现也不自动恢复旧 hash 的 current 依据。删除不外呼、不改源状态、不删别人 Schema。
- upsertDerived 中的人员输入（包括 counterpart）须先通过当前绑定 Reader 同范围解析再写；不能让能力把内部 alias/person_key 当 PersonId 输入，或 self/private 包装后绕过隐藏邮箱许可。受信证据/可写类型入口仍待 Q06，禁止靠私有 SQL 实施。
- classification 中 by=user 需要认证用户编辑证据；能力以 llm/rule 不能覆盖用户结果。稳定分类优先键候选为 `(owner,依据id,分类体系)`；contracts 没有分类体系字段，M1 CAP-01 仅在该能力内使用约定体系，不跨能力凭 category 字符串抢优先（Q08）。
- 来源失效图遍历需有界；上限未批准前大图操作整批失败，不提交一半敏感度传播。长链不交给模型推断。

### 4.6 applySync、cursorCommit 与 outbox 原子性

#### 网络与事务严格分界

MOD-03 在事务外完成 scopes/账号/manifest 校验、网络拉页、响应解码和完整关系聚合；然后同步调用 applySync。applySync 内不 await、不刷新凭证、不读网络、不执行模型、不触发订阅 handler，也不在 callback 中开始另一个事务。

事务序列（示意流程，不是新接口或产品代码）：

1. 检查 batch envelope、各 Schema、owner/source/type/敏感度、重复 id、删除/写入冲突、关系 from 范围、snapshot 不变量；跨存储状态的检查在 Tx 内再验证。
2. StorageService.transaction(tx => ...) 开始，初始化/验证 open 快照与候选窗口，校验实体流 ownership，不允许将同 owner/id 转给另一 SourceId。
3. upsert 实体/identity、流归属、精确 ID 证据及人员引用绑定，完整替换本页 stream 的 from 声明与集合 generation；同 snapshot seen 取集合并集，不用 target 缺失销毁入边声明。
4. 应用经宿主按独立登记权威 tombstone 校验的 deletions；仅在 §4.7 的合法请求链与逐流源枚举/缺失证据独立通过、且终页同 Tx 资格重验落实后执行 missing 对账。缺证保持 complete=false，missing 删除及其候选 from 声明销毁增量为零；合法页 upsert/完整出边替换、独立 tombstone 不被混同为 missing。按 §4.3 分开 from 归属销毁与 target 物化隐藏；同 Tx 重算端点物化、FTS/派生依赖和 revisions，不改来源 hash。
5. 调用 cursorCommit(tx)，由 MOD-03 写自己的 sync_ checkpoint、请求链及 terminal 的 completed/incomplete 状态；原子 CAS 核验 expected pageSeq/inputCursor、owner/source/stream/账号/授权世代/快照/范围/版本、取消与租约。图谱不读写 sync_；回调成功只证明这次检查点提交获准，不证明源枚举不漏。终页证明资格如何按统一公共协议同 Tx 传递及重验仍待 Q07，不通过隐含闭包成功给 graph 授予 missing 删除资格。
6. EventBus.publish(entity.changed,tx) 为真实语义变化写 outbox，含物化改变的页外 from；source/entityType/change/ids 按实际受影响实体的来源分组，使用冻结字段，不把 batch.source 套给其他来源的 A。仅真正 qualified completed 才由 MOD-03 在 cursorCommit 内同 Tx 发布一次 sync.completed；terminal incomplete 仍可提交合法页和检查点，但不发该事件或完整覆盖凭据，也不私增 incomplete 事件。事件不是人员 ID 或恢复权限出口。
7. 审计若该事务有受信操作则 AuditWriter.append(...,tx)；同步不硬造一个新 audit kind，也不拿 tool_read_content 记录纯元数据同步。
8. 任一步抛错（含 cursorCommit、outbox 或审计失败）全部回滚，返回值仅在提交成功后生成。ApplyResult.upserted/deleted 是本次实际变化去重列表；snapshotCompleted 仅本轮 qualified complete（或受信确认的同页历史完成回放）为 true，terminal incomplete 为 false。历史回放不建立当前完整覆盖；缺证不产生 missing 删除结果。

EventBus 的 tx 可选，不意味着 applySync 可以 omit tx；同数据库同连接是实施门槛。MOD-06 不得在 publish 同步调用插件。MOD-01 若允许 Promise 回调或分库 transaction 无法同写 outbox，I20 不成立，必须阻塞而非“提交后补发”。

#### 幂等与重启

- upsert/声明集合/派生声明/物化/seen 使用稳定复合键；相同完整出边集合不新建 generation，target 重现只根据当前有效 holder 重算，不能回放旧声明。无新语义变化不产生重复 entity.changed；fetchedAt 更新若保留新值是元数据变化，不能一边改字段一边谎称无变化。
- 幂等不要求 upstream 相同游标返回相同字节；重拉的新合法页按当前事实 upsert，已见集合继续累计，但不能重新消耗已经提交的旧请求检查点。
- MOD-03 对每条 stream 串行消费，并在 cursorCommit 用持久化 CAS 排除旧请求/另一个进程/过期账号。图谱 pages 的 output 摘要仅用于安全同页回放识别，不是网络幂等键。
- 回包应用提交后进程在返回前崩溃：恢复先读 sync_ checkpoint，已推进则从 nextCursor 继续；不能把旧请求拿当前游标重新包装后 applySync。callback CAS 错误回滚整个旧页。
- 相同 completed snapshot 的相同完成 fingerprint 只可受信确认其原已提交完成事实、无图谱变化回放，不再执行 missing 删除或发布新的 sync.completed；仍核验原轮/范围/版本及合法幂等 cursorCommit。旧证据/历史成功不得被当作当前完整覆盖或新轮资格；terminal incomplete 回放保持 incomplete。不同 payload/range/owner/source/stream 或新拉取必须新 snapshot id，哈希不同不说明上游违约，只说明旧完成标记不得复用。
- DomainEvent 缺 owner（Q11）；M1 仅 self，事件是“有变化”提示而非授权证据，订阅方依旧以绑定 Reader 重读。M4 前必须补 owner 语义，不能让共享事件 id 混成自己的证据。

### 4.7 完整窗口快照：seen、归属、删除与失败恢复

#### 归属与窗口成员

窗口统一 `[from,to)`，source/stream 的 primary 成员判定须和 StreamSpec/连接器查询语义一致。候选默认采用事件区间重叠，点事件按点；禁止以任意 fetchedAt/lastEditedAt 替代事件时间。日历跨窗事件使用 overlap，不能只按 startAt 删除。不同源只按 startAt、更新时间或 provider membership 的 stream 需在 MOD-03/04 评审声明；冻结 StreamSpec 没有完整 membership 表达，列 Q07。

graph_entity_streams 为每条 stream 保存 coverage（此页规范化 occurredAt/endAt）和 role：

- primary：manifest 声明该 stream 管理的主实体，参与窗口对账；没有覆盖时间的 window primary 整页拒绝。
- identity：batch.identities 仅身份辅助，不因“不在本周日程”删除。
- support：线程/文档等补充实体是否属于该 stream 主对象，必须显式映射；不能自动按每页伴随对象对账。无法从冻结 manifest 确定时先阻塞 Q07，不假定 support 永久不删。

删除 stream 归属与删除实体是两件事。只有本节独立源侧证据及同 Tx 门槛满足的窗口 missing 才能移除本 stream membership 及由该实体作为 from 持有的声明集合；未见本身不触发删除，缺证保留候选。其他 stream 归属保留。没有其他有效归属且非派生时物理删实体/正文/FTS/incident 物化并传播 missing evidence，但**不删除仍由其他有效 from/source/stream 持有的入边声明**。该实体以后作为 target 重现，按 §4.3 同 Tx 重算；作为 from 重现仅使用本次新完整集合。别人的同 id、其他 source/stream、窗外对象、身份与人工历史不扩大删除。

#### 请求链与源侧证据是两个独立门槛（R02-03）

合法请求链只证明“本轮各请求及页提交连续”，seen 只证明“本轮成功页实际见过这些对象”。两者都不证明动态源侧没有漏对象。合成反例：旧 primary candidate C 仍存活且仍在窗口；第一页后 C 排序移到已读区，后续位置 cursor 全合法、成功到 terminal，但 seen 没有 C。此时不能从 candidates−seen 推导 C 不存在，不能删其 membership/from 声明或把依赖标 missing；这是设计反例，不是已发生的产品或厂商事故。

缺失对账须同时满足：① MOD-03 受信确认合法完整请求链；② MOD-03/04 按逐流受信登记独立核验可证明不漏、或覆盖拟删除候选的权威缺失依据。② 必须覆盖实际 missing 删除集合；完整覆盖/complete 还必须得到该 stream 所声明覆盖范围的完整枚举依据，不能用只证明若干旧候选不存在的结果冒充全部源对象已枚举。没有任一门槛时 complete=false、missing 删除关闭；请求链不能代证②，②也不能代替失败页、取消或末页 CAS。

以下是联合登记/核验必须满足的条件，不是新 DTO、API 或可由连接器填写的字段：

| 绑定/有效性 | 必须核验的内容 |
|---|---|
| 主体与流 | 精确 owner、稳定 SourceId 实例、stream、window `[from,to)`、primary membership 与删除适用范围；另一 owner/source/stream/window 证据不得代用 |
| 账号与授权 | 受信账号/issuer/应用租户绑定、当前授权与政策世代；证明不夹带凭证，不能借同厂商或“同账号已授权”复用旧轮证据 |
| 查询与映射 | 实际过滤条件、排序及稳定破同序规则、分页语义、角色/coverage/删除映射、connector/映射/Schema 版本及 digest；合法单页不证明动态排序安全 |
| 登记及证据版本 | MOD-03/04 受信批准的逐流证明资格、证据方法/版本与实际来源、覆盖边界；manifest、annotations、connector 自报 complete/verified 或 callback 成功都不建立资格 |
| 同步轮次 | 唯一本轮 snapshot/run、初始条件和终页链一致；其他轮、旧 completed/incomplete、旧请求或旧候选核验不得借来完成本轮 |
| 时效 | 登记证据的建立/有效期限、失效条件及受信时钟/源标记解释；末页提交时仍有效。休眠、重启、游标重置、证据过期必须重新核验，不能自动延长 TTL |
| 上游变化 | 明确创建/删除/移窗/重排/过滤变化在该逐流证据中如何被覆盖、识别或使其失效；无法证明不会遗漏存活 C 时不合格。不预设任何厂商具备全局原子快照 |
| 终页同 Tx | 在任何 missing 移除前按统一协议重验当前资格与绑定；与 expected pageSeq/inputCursor、取消/租约/授权世代/范围版本 CAS 及提交边界检查同 Tx。不得在 Tx 内为证明再访问网络 |

网络取证/候选核验在 Tx 外；末页同 Tx 只通过受信装配核验已取得依据、当前绑定、期限/失效世代和链/CAS。检查失败且本页仍合法时降为 terminal incomplete，而不是先删后另存 incomplete；本页自身范围/授权/取消/租约或 CAS 不合法则整页回滚。不能承诺本地 Tx 锁住上游变化；源侧允许变化的证据必须覆盖所登记的语义，否则不得对账。

证明载体、complete 与 cursorCommit 的公共语义、资格到 missing 删除的同 Tx 联合核验均须主会话统一契约、必要 ADR/新基线及受影响模块重评。现有 SyncBatch 没有独立证明载荷，graph 不能读 sync_ 取证，cursorCommit 成功也不能暗中代替证明；本稿不新建证明表、接口或隐含回调约定。公共闭环前所有 missing 对账禁用，合法页按 complete=false 提交；terminal/checkpoint 与 incomplete 的对接也须按 Q07 落实，不声称现有接口已支持完整协议。

“有界候选逐项权威核验”仅为公共候选：须登记谁有权核验、逐候选精确绑定、缺失结论的权威性/时点/允许变化和预算终止规则；无权限、超时、非权威 not_found 或未查对象都不能当删除。不完整核验不扩大删除集合，即使旧候选全核验也不自动证明所有新对象的完整覆盖。尚未采用，不编造核验工具或要求未证实存在的全局原子源快照。

#### 快照状态机

`未创建 → open → completed` 仅用于双门槛及终页同 Tx 核验均通过；合法 terminal 但完整性未证为 `open → incomplete`，放弃为 `open → abandoned`。incomplete 是现有 graph_sync_snapshots 的内部覆盖状态，不是新增公共事件/接口；保留合法终页收据与检查点，不写成功 completed_at/completion_fingerprint。completed/incomplete/abandoned 的 id 不用于新范围/新轮；same fingerprint 历史完成回放不是新轮或当前完整性证明。graph 只收到实际成功页，不从 hasMore=false 推测曾失败页或源枚举已经完整。

1. MOD-03 为准确 owner/source/stream/window 和账号/授权/查询映射版本分配唯一本轮 snapshot.id，在 sync_ 保存请求链/页进度/绑定，并独立核验逐流源枚举依据；连接器只提供源响应事实，complete/verified 自报不可信。
2. 首个成功页的同事务创建 graph_sync_snapshots，并复制此前在该窗口的 primary stream 归属到 graph_snapshot_candidates，记录 stream revision；seen 空集只代表“本轮尚未见”，不是删除指令，也不是权威 tombstone。
3. 每页成功事务 upsert+from 声明完整替换+stream membership+端点物化重算+seen union+页收据+cursorCommit+真实变化 outbox。缺完整性证据不阻断合法增量写入；seen 持久化复合键，重复页不增加人数，实体移窗而再次出现也算 seen、更新最新 coverage。页内合法替换与独立 tombstone 的影响不计为 missing 对账。
4. 后续页必须同 snapshot.id/范围/owner/source/stream/账号/查询映射版本；MOD-03 持久请求链连续及 expected pageSeq/inputCursor、取消/租约/epoch CAS 不通过全页回滚。graph page_count/seen、complete 布尔值或 nextCursor=null 都不能单独证明链或源枚举完成。
5. terminal 到达后独立判定两项门槛并同 Tx 末次重验：请求链全成功且合法；逐流完整枚举/缺失依据仍有效、与本轮及拟删除范围精确绑定并能证明不漏。均满足才允许 snapshot.complete=true（空终页也一样）；任一证明缺失/过期/错绑定/失效或无法排除漏存活 C，宿主保持 snapshot.complete=false，按第 7 步提交合法 terminal incomplete。不能强制 nextCursor=null 丢厂商 terminal 原生 checkpoint；terminal、分页游标与后续增量检查点表达仍由 Q07 统一，图谱不私增字段。
6. qualified complete 事务只取 candidates 未 seen 对象；先确认逐流依据覆盖其缺失对账，再核验该 owner/source/stream membership 的候选 revision 或本串行快照合法更新、coverage 仍属此窗口，才移除。只清对应 from holder；无其他归属才物理删实体/正文/FTS、传播 missing 并清 incident 物化，保留其他有效 from 的入边声明。缺证分支不进入此步骤：missing membership 删除、候选 from 声明销毁及其引起的派生 missing 增量均为零；不以“所有页成功”跳过资格门槛，不扩大到轮后新对象/其他 stream/owner。
7. qualified complete 把 missing 对账、声明/实体/FTS/物化/依赖、graph completed、sync_ terminal checkpoint/完成状态和一次 sync.completed outbox 同 Tx 提交。terminal incomplete 则把本页合法 upsert/完整出边、独立权威 tombstone、seen/页收据、graph incomplete、合法原生 terminal checkpoint 与 sync_ incomplete 同 Tx 提交；保留未见候选归属及声明，不发布完整覆盖或 sync.completed，ApplyResult.snapshotCompleted=false。终页资格失效但页仍合法不能先 missing 删除后再改 incomplete；CAS/取消等页资格失败则全部回滚，不推进 terminal。
8. 重启先查 MOD-03 持久检查点/覆盖状态：提交前失败保留前页，提交后按 completed 或 incomplete 事实恢复；terminal 成功不等于完整覆盖。incomplete 新扫描必须新 id/本轮证据，不借旧 terminal/seen 升级完整。快照进度按批准保留期清理，保留相应收据/去重边界；incomplete/abandoned 清自身进度不得删除候选业务归属/声明。graph 清理不改 sync_；公共恢复/清理边界仍属 Q07。

#### 移动、过滤与显式删除

- 取消/空闲/全天日程的过滤条件必须受信登记并绑定证据；只有 qualified 完整快照证明该候选不再属于管理集合时才作 missing 移除。半途失败或动态漏枚举/无证据都保留，不能仅凭某页未返回而删除正常日程。
- 日程由 W1 移到 W2：W1 返回新对象则 seen+新 coverage 保留；W1 不返回仅在有效证据证明其已不属于 W1 时移除旧归属，否则 W1 incomplete 并保留。W2 合法页可独立建立新归属；不声称跨窗全局原子，上游变化按逐流证据边界展示。
- 同 source 的其他 stream 保存同实体时，qualified missing 只移除当前 stream；缺页/缺证不是归属删除，记录本 stream 未覆盖并保留业务归属。窗口只对候选主对象，不清全 source。
- missing 不是 tombstone。batch.deletions 裸 id 仅接受 MOD-03/04 独立受信登记并核验的此 owner/source/stream 权威删除事实、时效/版本及适用范围；不得由 candidates−seen、hasMore=false 或连接器自报 deleted 合成。该证据合法时不因枚举 incomplete 一概禁删；M1 候选仅移除此 stream membership/from holder，最后归属才物理删。target 删除只清入边物化、保留有效入边声明，重现仍按 §4.3；同批 upsert/delete 冲突拒绝，源级多 stream 删除仍待 Q07。
- 窗口外 explicit deletion 仅在 cursor 模式登记的权威 tombstone 范围内处理；无权限/超时/非权威 not_found、窗口列表不返回都不是删除证据。不能为绕过 missing 门槛把候选改填入 deletions。

#### 失败恢复矩阵

| 故障点 | 持久化状态 | 恢复与禁止事项 |
|---|---|---|
| 网络页失败/超时/限流 | 最近成功页与 seen 保留 | MOD-03 预算内重拉失败 requestCursor；不 complete、不删除 |
| attrs/owner/关系校验失败 | 本页全部未提交，前页保留 | 修映射/版本后重拉；不跳坏实体后推进页 |
| 数据库/游标 CAS/outbox 失败 | 本页实体/身份/声明 generation/物化/seen 全回滚 | 恢复上一个 checkpoint，禁止补发脱离业务的事件或从旧物化补声明 |
| B 删除/重现后物化重算失败 | 前页有效入边声明与物化状态保持 | B 页整体回滚；重试重验当前 A holder，不恢复已被替换/删除的旧声明 |
| 进程提交前崩溃 | 未提交页回滚 | 从最后成功 checkpoint；不从内存 page_count 恢复 |
| 提交后未收到本地结果即崩溃 | graph+sync+outbox 都在 | 先查 sync checkpoint，再续 nextCursor；不是盲回放旧页 |
| 过期游标/失效 page token | open 快照不可继续 | MOD-03 标放弃并用新 id 从窗头重拉；旧 seen 不合并到新轮 |
| 中途修改 window/账号/source 绑定 | 原 open 不完成 | 新实例/新 id；不可复用旧 completed 标记 |
| 终页收到了，前页未成功应用 | 无合法完整请求链 | 不给 complete=true；链/CAS 页资格失败整体回滚，不用合法源证明替代失败请求 |
| 所有请求合法成功但动态重排漏存活 C，不能证明不漏 | 合法终页/检查点与 graph/sync incomplete 同 Tx；C 的归属/声明保留 | complete=false，missing 删除/候选 from 声明销毁增量为零；不得标派生 missing 或报告完整/零事项 |
| 源枚举证据缺失/过期/版本失效，或只核验部分候选 | 本页仍合法则 terminal incomplete；seen 与合法页变化保留 | 不对账、不延长期限、不由 connector complete/verified、callback 成功补证；重新取证/新轮按 Q07 |
| 证明 owner/source/stream/window/账号授权/过滤排序/映射 Schema/证据版本/轮次错绑 | 证明不合格；合法页按 incomplete 提交 | 另一范围/旧轮证据不能代用；零 missing 删除。若本页本身账号/范围/授权已错，则整页回滚，而非降级后继续写 |
| 末页同 Tx 重验发现证明过期/失效，但页及 CAS 仍合法 | terminal/checkpoint 与 incomplete 原子提交 | 在 missing 移除前降为 complete=false；禁止先删候选后另存 incomplete，不发 sync.completed |
| 取消/租约或授权 epoch 失效、末页 expected pageSeq/inputCursor CAS 竞争 | 本页全部回滚，前页检查点/声明保留 | terminal 不推进，只有合法获胜页能提交；证明不能覆盖取消/旧页，迟到页不重包装为新轮 |
| 断源/撤权发生在拉页与应用之间 | 即时策略判定此页无权应用 | callback 再核验账号/授权世代，抛错；不能以先前令牌有效当长期授权 |
| 末页 completed/incomplete 事务磁盘满或任一服务失败 | 本页数据/seen/声明/物化/状态/游标/outbox 全回滚 | 保持前页 open/旧 checkpoint；证明失效不是逃离同 Tx 的理由，不先推进 terminal |
| terminal incomplete 提交前/后崩溃 | 提交前保留前页；提交后合法页+terminal/checkpoint+incomplete 同在 | C 归属/from 声明保持，missing 增量为零；重启不凭 terminal 自动升级 complete、不补发 sync.completed |
| 无枚举证明但本页 upsert/独立权威 tombstone 合法 | 在各自登记范围提交真实变化、terminal incomplete | 不 blanket 禁用独立路径；missing 候选不能伪装 tombstone，其他 stream 及有效入边声明仍保留 |

graph_ 无取消/重启快照公共方法，也无 inputCursor/hasMore/独立证明字段；合法请求链/CAS 归 MOD-03，源侧证据资格归 MOD-03/04 的受信登记/核验，graph 只管理 seen/candidates/membership，不能凭 page_count/seen 或 callback 成功“证明完整”，不能跨表读 sync_。Q07 的证明载体、终页同 Tx 资格重验、complete/cursorCommit 与 incomplete/terminal 公共对接未闭环；此时 missing 路径关闭，不能把设计要求写成现有接口已完成。

### 4.8 正文与 FTS5 trigram

#### 正文读取与审计

M1 默认正文不拉取、不入索引。已存正文通过 content 读取时：

1. 绑定 Reader 的 actor/source/owner/visibility/用途、整实体人员投影及当前正文 scopes/缓存许可全部通过；只查复合键，返回前核验 policy/identity revision。不安全的 metadata 不能借 content/正文匹配绕过。
2. 一个同步本地事务读取 Entity/正文并检查 hasContent 与正文 hash，追加 AuditRecord 后才返回字符串；审计失败不返回正文。
3. kind=tool_read_content、outcome=ok、refs.entityIds=[id]；detail 记录 owner/source/reader-purpose/run 引用、body_hash、字节长度和调用入口 content/search。不把 query 原文、正文或邮箱抄到 summary；不自增公开字段。
4. 无正文且已授权返回 undefined；没有权限与不存在尽量统一不可见结果。范围错误/审计不可用使用已批准错误映射；失败审计如果可追加则 outcome=error，不能为记录审计绕过 owner 可见性。
5. get/query/related 只返回 envelope/attrs，不读取 graph_contents；来源过长标题/attrs 不允许用来藏完整正文。网关请求 content 会走相同 Reader 并再次按 sensitivity/purpose 过滤。

冻结 SyncBatch 只有 Entity.hasContent，没有正文内容/撤除载荷；graph_contents 的实际写入、正文 scopes 撤回时清理及 FTS 的插入均为 Q01/Q03 阻塞。绝不新增未批准 writeContent、调用任意工具回包直接存正文或让连接器在 Tx 写表。

#### 双索引与中文策略

元数据与正文分开索引，防“没调用 content 却从正文搜索得知内容”。候选 DDL：

```sql
CREATE VIRTUAL TABLE graph_fts_metadata USING fts5(
  title_text, attrs_text,
  content='graph_search_metadata', content_rowid='search_rowid',
  tokenize='trigram case_sensitive 0 remove_diacritics 0', detail='full'
);
CREATE VIRTUAL TABLE graph_fts_bodies USING fts5(
  body_text,
  content='graph_search_bodies', content_rowid='search_rowid',
  tokenize='trigram case_sensitive 0 remove_diacritics 0', detail='full'
);
```

- metadata 的 attrs_text 只投影登记字符串（标签/项目键/identity displayName），不索引任意 JSON、内部 person_key/canonical/alias、organizer/counterpart ID 或混合人员画像。可见 identity.email 如需检索须单独登记来源许可，不能从其他身份补全。字符规范化候选 NFC，原始 title/body 不改；身份匹配不复用搜索归一化。
- 官方 trigram 按连续 3 个 Unicode 字符支持子串，不是中文语义分词。MATCH 少于 3 字符没有命中；LIKE/GLOB 可能退为全扫描；detail=none/column 限制长 token，因此本稿用 full（R1）。不得把“会议”查无结果误报为没有会议。
- 长查询（≥3 Unicode code point）只接受 literal substring 模式：转义内部双引号并包成 FTS phrase，参数绑定；不让用户的 OR/NOT/*/: 当查询程序。若包含无可用 trigram 的标点组合，按受限 literal fallback 处理，不执行原始 MATCH DSL。
- 1–2 字符短查询用 metadata 普通表上参数化 instr/literal 搜索；先 owner/source/type/可见性收窄，按固定排序输出。正文短查询仅正文授权 Reader 可执行，需同样审计。空白查询返回空，不扫描全库。
- 短查询预算候选为最多 5,000 个授权候选行/总文本 2MiB，超过返回 graph_search_too_broad，要求补长关键词或缩小 types/owner；不静默返回一部分冒充完整。没有 timeRange 参数，不能擅增参数；若实测不可用列公共过滤扩展问题。
- 搜索不调用模型、不生成拼写猜测、不以名字相似自动关联。trigram 不能承担身份认证、语义检索或未来向量检索的许可。
- search 默认 limit=50、1–200；排序用元数据命中优先、同类按固定时间/owner/id，不用正文 bm25 的全库统计决定未授权结果。无 cursor 的冻结 search 明确是限量结果，不假装可以遍历全搜索集。
- 正文参与 MATCH/短扫描本身就是内容读取。只有绑定正文用途的 Reader 启用 body 分支；对实际进入该分支评估的授权对象集合在同事务追加 tool_read_content 审计（包括未命中检查过的受限短扫描），审计不可用则整次失败。仅查询 metadata 的 Reader 永不执行 body 分支。
- FTS rowid 候选 JOIN 原实体与授权条件，并通过 §4.1 全部人员引用检查后才排序/limit/返回；短扫描/body 分支也只评估合格实体。禁止未授权命中计数、rank、snippet/highlight 或“隐藏结果若干”；实际 source/owner/visibility/policy/identity revision 再核验，不相信索引或旧 Person 投影缓存。

#### 索引一致性与清理

候选采用 graph_search_* 普通投影表 + 外部内容 FTS。graph_ 同事务维护投影和 FTS delete-old/insert-new；可用 graph_ 触发器，但触发器不得写 audit_/sync_/rt_。插入、更新、删除及迁移都经过相同路径；禁止 INSERT OR REPLACE 绕开 FTS 更新语义。

官方明确 external content 一致性由应用负责，创建 triggers 不会自动回填既有行，应 rebuild（R1）。索引异常时 search 明确 graph_index_unavailable；get/query 继续可用，不静默改成无界正文扫描。重建只读已授权留存的 graph_ 内容、离线本地执行，不重新授权或拉源。

删除/正文撤除同事务删除主正文、搜索副本、FTS tokens；这一路径不得级联清仍有效 from 的入边声明。元数据/物化重建仅构建派生投影，不从索引恢复权威声明或公开 ID 证据。不能承诺 WAL、空闲页或旧备份无痕清除；MOD-01 需透明保留/备份清理政策（Q10），本稿不修改配置或降低恢复能力。

## 5. 错误处理与降级

### 5.1 错误分类

以下是内部错误标签候选，不是擅加公共 union/HTTP 码；由主会话协调 MOD-03/06/08 的已有错误映射（Q11）。错误结构只保留安全 code、字段路径和无原值原因。

| 类别 | 结果 | 恢复 |
|---|---|---|
| graph_schema_unknown / graph_schema_invalid / graph_schema_conflict | 拒绝注册或整页；不丢坏条后推进 | 评审登记/修正映射；若是未来版本先停该 stream |
| graph_scope_denied / graph_source_conflict | 不返回数据/整批回滚 | 重新由宿主构造合法范围，不诱导授权其他源 |
| graph_cursor_invalid / graph_cursor_stale / graph_cursor_expired | 不续旧页 | 界面明确重新查询；禁止当空数据报告 |
| graph_query_too_broad / graph_relation_too_broad / graph_search_too_broad | 不假截断/完整 | 收窄范围或批准分页能力 |
| graph_snapshot_conflict / graph_checkpoint_conflict | 本页全部回滚 | 查持久化进度、从正确快照恢复，不复用完成标记 |
| 源枚举/缺失依据未证、过期或错绑 | 本页合法且 CAS 通过时提交 complete=false/terminal incomplete；不是伪成功 completed | 保留 candidates 未 seen 归属/from 声明，missing 删除增量零；展示覆盖不完整而非零事项，不发 sync.completed；页自身无权或 CAS 失败仍整页回滚，状态载体/错误映射归 Q07/Q11 |
| graph_identity_conflict | 保留原/独立 local 内部映射与冲突记录 | 本人受信手动管理；不借冲突错误披露隐藏 ID |
| 人员 ID 无当前精确可见证据 | person/get/content 为不可见结果；集合读安全筛选，self 缺可信档案为服务不可用 | 不回显 canonical/alias、不改字段伪造合法 Entity；范围未覆盖不等于没有事项 |
| 关系声明/物化不一致 | related/相关关系查询明确不可用，不猜边或假空结果 | 本地从权威 holder/generation 重建；权威损坏按平台恢复，错误码归 Q11 |
| graph_audit_unavailable | 正文不返回，写事务回滚 | MOD-01 恢复审计；不新建本模块审计库 |
| graph_index_unavailable | search 不可用，明确状态 | 本地重建索引；其他元数据查询可用 |
| graph_storage_unavailable / busy / disk-full | 不推进游标、不发假成功事件 | MOD-01/03 受限退避/人工处理；图谱内部不 sleep 循环 |

单源未配置/断开不阻塞其他源查询与同步。授权、限流和网络错误由 MOD-03 管理，本模块不调用 requestGrant 或重试 provider。

### 5.2 未授权、断开与缓存可见性（Q13 方向确定，接口未闭环）

主会话 Q13 已定设计默认：断开即停止源读取并隐藏缓存及其派生，对能力/模型/主动通知即时禁用；不自动删除历史业务数据，不自动恢复消费。它不是实际数据留存许可或已具备的即时策略接口，留存期/清理入口/备份限制仍待协调。身份证据和关系物化使用同一政策；留存历史或有效业务声明不代表可读取隐藏邮箱/端点。

| 状态 | Q13 方向与待协调策略 | 保守实施边界 |
|---|---|---|
| 从未授权的源 | 不同步、不展示凭空数据；其他源仍可用 | 无历史缓存视为未覆盖，不视为零工作 |
| 临时 offline/网络异常，授权仍有效 | 展示合法本机缓存及 fetchedAt/覆盖范围 | 不说“当前已回复/正在开会/结果已核验”；正文仍需原用途许可 |
| token 过期需刷新/补 scopes | 元数据可按已批准留存使用，写/新读暂停 | 未裁决正文策略时 body 不参与搜索/模型 |
| 用户明确断开/撤权 | 停源读取，对能力/模型/主动通知及普通图谱读即时隐藏；保留数据不自动删除 | 旧邮箱 ID 证据不合格、Person/关系/派生/session 同步失效；隔离查看/清除入口未批准不开放 |
| 已断开后重新授权同账号 | 重新确认 source/账号及明确缓存恢复许可，并做相关完整快照 | 不自动恢复旧缓存消费、Person 反查、提议或报告；声明留存/重建不恢复权限 |
| 绑定其他账号 | 新 SourceId，新命名空间 | 旧缓存不覆盖、新账号不能继承旧 owner/source 键 |

留存可保留离线追溯与人工合并解释，但隐私风险不能靠留存声明消除；删除也不能保证旧备份无痕。因此采用 Q13 的“立即隐藏，留存与清理分离”，保留期/本人隔离查看/正文撤权/清理限制仍待公共协调及实际授权透明说明，不声称用户已许可留存。

禁止靠最终一致 auth.revoked 单独保证“立即”：Reader 在调用及返回前同步核验受信 policy generation；query session、人物 ID 证据/反查、关系两端、派生/报告/模型/通知缓存都重新验证。已返回数据无法从用户记忆撤回，但下游下一次消费不得用旧范围。AuthBroker.status 没有所需断开原因/缓存许可/世代，Q02/Q03 未闭环不得承诺已保证即时隐藏；M1 不开放缺少这种受信绑定的断源读取路径，更不默许 cached content 入模。

## 6. 安全与隐私

### 6.1 写入与读取边界

- WorkGraphWriter 只有 MOD-03 持有；DerivedWriter 只写私有派生；人员合并/用户分类/共享导入不借这些入口越权。
- 本模块无 SecretStore、OAuth、LiteLLM、ConnectorHost.callWrite 或平台窗口 API 依赖。正文与原始回包中的指令只是数据，不进入可信 instruction，也不写规则记忆。
- 所有 SQL 参数化；type/attrs 字段名先用登记白名单映射固定列/JSON 路径。动态 Schema 不变成动态 SQL、代码或远程引用。
- 日志只有安全错误类别、计数、耗时及无正文的内部引用；原始 cursor、搜索词、邮箱、native URL 查询参数、title、body 和 attrs 原值默认不记录。source 与实体引用也按 MOD-01 脱敏策略处理。
- graph_snapshot_pages 存 nextCursor 摘要而非令牌；raw 同步游标归 MOD-03 私有状态，不能包含凭证。source/stream 由受信登记确定，不允许任意字符串使图谱越过命名空间。
- 审计不可修改/删除；本模块的 identity_history 是业务回溯不是中央审计替代。产品可清除统计不存 graph_，不为省时统计申请新权限。
- 身份合并不是公开 ID/共享授权：隐藏 canonical 邮箱、内部 alias/history/person_key 不由可见无邮箱身份代证；精确输入、输出 ID、实体人员字段、关系和缓存统一 §4.1。无法安全投影拒绝，不改源事实/hash，不以私有 alias 补契约。
- 目标删除不是入边声明销毁：graph_relation_streams 仅随其 from 完整替换/归属移除销毁；graph_relations 可删可重建。target 缺失不返回裸 ID，target 返回不复活已删除 from 声明；FK/trigger/重建规则都按此方向检查。
- 派生不降敏，政策/identity revision 改变使全出口重新检查。M4 未批准前其他 owner 导入保持不存在，不借安全 alias 或 owner-aware 事件提前扩大范围。

### 6.2 I1–I35 逐项对照

D=本模块直接实现；C=本模块配合/不能绕过；N=不拥有该行为。每条给出失败用例/检查，编号对应 §7 契约测试；N 不表示全系统该约束已通过。

| 约束 | 关系 | 本模块落实及失败用例/测试 |
|---|---|---|
| I1 | C | 图谱 hash 仅提供依据；执行当前前置条件仍 MOD-07/03 核验。F21：旧同步 hash 不能证明外部对象未变 |
| I2 | D | 无 callWrite 注入或导出；F01 依赖检查 |
| I3 | C | 模型产物仅合法派生数据，不可成为 Writer/身份编辑；F17/F21 |
| I4 | C | content 能返回完整已授权正文，不能以 search 摘要代替预览；正文不可用必须由动作层拒绝不完整预览，F10 |
| I5 | N/C | 无自动行动策略或对外调用；F01 |
| I6 | C | 远端 owner 只读，远端“合并/改分类”不能调用 Writer；F02/F17 |
| I7 | D | 无凭证库权限、不存原始回包、游标只摘要；F01/F22 |
| I8 | C | 图谱持久化归属/快照；请求游标归 MOD-03，连接器不持久化，F12–F16 |
| I9 | C | 凭证删除与审计归 MOD-03；图谱配合即时隐藏不宣称执行 revoke，F23/Q03 |
| I10 | D/C | 无模型 SDK；Entity 不拼 system/instruction；网关走受信 Reader，F01/F10/F21 |
| I11 | C | secret 可本机合法查看，不自动入模；最高敏感度与网关边界，F18/F21 |
| I12 | D/C | attrs/正文/Schema 不执行外部指令、拒远程 $ref；F03/F21 |
| I13 | C | 不写规则记忆/人格；by=user 需证据而非能力自报，F17/F19 |
| I14 | C | 图谱不是记忆 Markdown/向量索引，不能代替 forget；本模块正文清理覆盖自己的全部副本，F11/F21 |
| I15 | C | 原始事实、UTC、人员引用/hash 保留；安全拒绝不改 organizer/counterpart 或伪造 local ID，F04/F20/F21/F27 |
| I16 | C | 仅提供日历计划事实，declined/unknown 区分；不判断实际开会、不枚举窗口，F04/F21 |
| I17 | N | 无成长/功能解锁；图谱读取不看等级，F01 |
| I18 | C | 仅接受宿主绑定 Reader；不得把 owner 参数当认证。网络服务仍由 MOD-08 验证，F02/Q02 |
| I19 | D | envelope/复合键/private，拒源自报 space/owner/人员许可；canonical/alias 不扩权，F02/F04/F27/F28 |
| I20 | D/C | 合法请求链与逐流可核验源枚举/缺失证据独立；绑定 owner/source/stream/window、账号授权/过滤排序/映射 Schema/证据版本/轮次/时效和允许上游变化，末页同 Tx 重验。缺证 complete=false/incomplete，missing 删除/候选 from 声明销毁增量零，不发 sync.completed；合法 upsert/独立权威 tombstone 分开。graph+seen/归属/声明物化+terminal cursor/CAS+outbox 同 Tx，公共对接 Q07 未闭环，F12–F16/F29–F38 |
| I21 | D/C | 冻结 AuditWriter 只 append；图谱无 audit_ SQL/更新入口，F01/F10 |
| I22 | D | 日志无正文/搜索词/凭证/原值；F22 |
| I23 | D | 本模块只写 graph_，跨模块通过冻结服务同 Tx，含触发器前缀，F01/F16 |
| I24 | C | 不让连接器导入 graph 实现或客户端开 SQLite，F01 |
| I25 | D | 安全整数 UTC 毫秒、半开范围重叠；F04/F20 |
| I26 | D/C | Schema 不覆盖；安全 alias/Reader 语义改变仅候选，需 ADR/重评/新基线，F03/F24/F28 |
| I27 | D/C | outbox 按实际受影响 from/source 分组，物化恢复含页外 A；无变化不发、订阅 id 去重，F16/F21/F31 |
| I28 | D/C | 图谱不判断系统、不拼数据目录；两平台 SQLite/FTS/迁移探针 F25 |
| I29 | C | 图谱不修改冻结决定；源 hash 不被迁移覆盖，F21/F24 |
| I30 | C | 不重试外部写、不以 applySync 成功冒充动作核验，F21 |
| I31 | C | network/apply 与返回前账号/政策世代再验，断源不续旧页/旧人物映射/动作，F15/F23/F27/F28 |
| I32 | D/C | 精确公开 ID 证据、输入/输出同范围回查、所有人员字段及关系端点；正文/派生/缓存统一重验，F02/F09/F18/F23/F27/F28/F30 |
| I33 | C | 不把外部派生 by=user 洗白；不私自删除记忆墓碑，F19/F21 |
| I34 | N/C | 不采窗口/音频、不为自娱调用模型或读取工作图，F01/F21 |
| I35 | D/C | 新 Schema 显式登记、扩展与真实任务演练，不以索引速度宣称省时，F26/§7.3 |

## 7. 测试计划

### 7.1 契约与失败用例

以下均为将来实施后的测试计划，本次未运行或声称通过。使用合成非敏感数据、内存/临时 SQLite、冻结 Tx/AuditWriter/EventBus 替身；真实平台/真实授权不能被替身代替。

| 编号 | 场景与注入 | 必须断言 |
|---|---|---|
| F01 | 依赖/表前缀/接口扫描；触发器尝试写 audit_；能力拿 Writer | 只有 graph_ 写入；外部服务经冻结接口；无凭证/SDK/callWrite/平台 API；无另版 Tx/AuditWriter |
| F02 | 同 id 两 owner/相同邮箱不同 owner，一方 private；other/any/relatedTo/Person/反向边/FTS/session 越界 | 所有 JOIN 和 ID 证据含 owner；另一 owner 的可见邮箱不代证，person 固定 self；参数不升级权限；无隐藏 ID/邮箱/数量泄漏 |
| F03 | 13 Schema 每字段有效/缺失/错类型/null/额外字段；未来版本；同键异 hash/remote $ref | 精确 Schema 验证；全页失败且 checkpoint 不变；登记不覆盖、不联网；不默认填值/强转 |
| F04 | 缺 envelope、假 owner/source/space、NaN/大整数、end<start、零时长日历、缺计数 | 整批拒绝；UTC/时间关系正确；不得填假 0/假人；calendar cancelled 等在 connector 过滤 |
| F05 | 千条同毫秒实体，跨 owner 同 id、occurredAt=null、limit=1/500、含不安全 organizer/counterpart | 安全投影在排序/limit/session 前完成；静态合格集无重漏，无正文/隐藏键计数；NULL 不掉合法记录 |
| F06 | 游标篡改/跨 actor/改范围/Schema/graph/TTL；B 撤权、email 改变、merge/undo 发生在翻页或返回前 | policy/identity revision 及范围 fence 返回 stale/不可用；不得用旧 alias/canonical；静态重试相同页、不跨请求锁、不延长撤权 |
| F07 | 两窗边界、跨窗区间、点事件、无 occurredAt；attrs string/number/false/array/null | 半开重叠准确；类型等值准确；缺失不等于 null；空数组筛选不变全图 |
| F08 | page1 A 出边/page2 B 出边、重复 A、A 本页空边、另一 stream 持 A→B，目标 B 暂缺 | 替换仅当前 from holder/generation；页外及其他 stream 声明保留；空集合持久化；目标缺失也校验 attrs 冲突 |
| F09 | target 未同步/隐藏、related in/out、超 2,000 边、Person.to 为隐藏 canonical 邮箱 | 悬空声明可保留但不返回裸 ID；两端/holder/人员原始 ID 均当前可见，entity=undefined 不泄漏；超限整次失败；预算未算通过 |
| F10 | content 有/无正文、其他 owner、未授正文 scope、search body 匹配、AuditWriter 抛错 | 正文读取与命中审计冻结字段、无全文；失败不返回；metadata search 不跑 body 分支 |
| F11 | 中文“需求评审/需求/需”、英文大小写、emoji/组合字、%/_/引号/OR/NOT、FTS 重建与删除 | 三字子串命中；一两字受限 fallback；literal 不执行 DSL；无 snippet；删除正文副本与 tokens；双平台行为记录 |
| F12 | 三页窗口，中页网络/校验失败、空终页、登记过滤；分别有/无合格逐流源枚举依据 | 失败不推进 seen/cursor；重试链成功仍不能代证源完整。有合格本轮证据且同 Tx 重验通过才对账；无证 terminal incomplete、missing 删除/候选 from 声明销毁增量零，不报完整或零事项 |
| F13 | 快照每条 SQL 前后、末页资格重验/missing 删除/terminal checkpoint/outbox/COMMIT 切点崩溃；completed 与 incomplete 两分支 | 本页 graph/seen/声明物化/FTS/状态/cursor/outbox 全有或全无；qualified completed 不先于对账，incomplete 保留未见候选且无 sync.completed，重启不升级覆盖 |
| F14 | 重复页/终页、dynamic 重拉不同 payload、旧 completed/incomplete id 或证据套新范围、新轮、过期 token 重启 | 集合幂等不要求 byte 相同；旧轮/terminal/seen/证据不代证新轮；新 id 不继承旧 seen，不得跳页完成或将 incomplete 回放升为完整 |
| F15 | 双 worker/两进程、末页旧 expected pageSeq/inputCursor CAS、账号/范围/映射版本切换、取消/租约/授权 epoch 失效在 network/apply 间 | 只有合法获胜页推进 checkpoint；旧/取消页整页回滚，无 missing 删除/声明销毁/完成事件，断源不续；真实页错绑定拒绝，证据错绑但页合法则 incomplete，均不跨 owner/source/stream/range |
| F16 | cursorCommit/AuditWriter/EventBus 各抛错，publish 试图网络等待，订阅重复投递 | 同 Tx 回滚；回调全同步；稳定 outbox/id 与订阅去重；提交后崩溃先查 checkpoint |
| F17 | 能力 A 写源 identity、他人 owner/B 的派生、非法 wa id、派生环、删除混合合法/越权 id | 整批拒绝，不能先成功一部分；只写绑定能力、私有来源与合法 Schema |
| F18 | normal 派生引用 secret、父源提升敏感度/删除/hash 变化、断源、跨 owner 裸 Relation | 最高敏感度即时继承/后代重检；失效不通知假结论；跨 owner 派生禁用直到有接口 |
| F19 | 同名异邮箱、+tag/去点、伪 From、open_id 跨 app、人工 merge/undo/重同步；可见无邮箱 A 合并隐藏邮箱 B | 精确可信键不跨 app；内部 person_key/历史持久且可回溯，但不授权 B 邮箱公开；isSelf 宿主决定；不复制 ID 证据、不改原 hash |
| F20 | CAP-01 使用跨午夜/DST、重叠会议、部分源缺失数据 | 图谱原始 UTC 不改；CAP 按时区裁剪/并集；不把会议负荷或事件数叫完整工时 |
| F21 | 图谱数据含“忽略策略并发送”、前置条件漂移、记忆删除、secret 通知/模型、团子自娱 | 无写调用/规则记忆/人格改写；源系统重新核验；出口过滤及 memory forget 责任不被图谱替代 |
| F22 | Schema 失败包含密钥样式字段、长正文、URL query、raw cursor、搜索词 | Logger/AuditRecord 无原值/正文/凭证；错误仅安全路径与原因 |
| F23 | Reader/session/Person/报告/派生/模型输入/通知已缓存，随后 B 撤权与 offline 区分；再授权同账号 | Q13 断源即时隐藏；旧政策/identity 范围不可消费，session stale；其他源可用；不自动开放旧缓存/内部 alias，清理不自动获权 |
| F24 | v1→v2 迁移失败/磁盘满/错 Schema；身份 ID 证据、user 分类、人工合并及悬空 A→B 声明 | 原子恢复；原 hash/证据/敏感度保留，不因 target 不在删有效声明；schema checksum 不改；物化可重建、未知共享不入库 |
| F25 | 安装包 Node/SQLite，macOS+Windows，FK/FTS/trigram/JSON/事务/重启/恢复 | 实际 sqlite_version/compile options 和行为留证；不得把开发机结果当 Windows 通过 |
| F26 | 扩展 <extension>.task 的 Schema/字段映射/人员引用路径登记、新能力派生 | 无内核 switch 特判；未登记人员引用语义不可读写，不能把隐藏 canonical 藏 attrs；未知/冲突明确失败 |
| F27 R02-01 全出口 | 先有无邮箱 local A、邮箱 B，受信合并为 B canonical；建立 Person/实体/边/报告后 B 撤权、A 保持可见 | person(A local/B email) 不披露 B canonical；self 只用可信档案。逐测 get/query/search/related in/out、organizer、counterpart、人员 attrs 条件、content/body search、派生/模型/通知/session；隐藏 ID 不在 payload/日志/索引画像；raw 引用/hash 不变，必填字段不改，隐藏整项不报零事项 |
| F28 R02-01 输入与回查 | 猜 B 邮箱、旧 local/随机 local、内部 alias、跨 owner 证据；可见邮箱证据恢复/失效；重启/merge/undo/改 Reader 范围 | 未证明精确输入不查内部闭包、不命中 A 事项/泄漏存在性；合法返回 ID 在同有效范围 person(id) 回到同人；无证据拒绝，旧 session stale；别名替换候选未经 ADR 不启用 |
| F29 R02-02 三页 | B 预存；同串行 stream page1 写 A→B、page2 删除 B 最后归属、page3 B 返回，A 不重拉；再测 B 从未到本地 | 第一页声明+物化，第二页保留 A 声明且无物化/读结果，第三页据当前 holder/generation 同 Tx 恢复；全程无悬空/隐藏 target ID；无需 A 再同步 |
| F30 R02-02 多 holder/期间 from 变化 | B 暂缺时 A 的 s1 出边替换为空/删 s1 归属/物理删 A；s2 持 A→B、独立派生 C→B；B 的另一 stream 仍在；跨 owner 同 id | 仅当前 holder 声明销毁；B 重现只恢复未销毁 holder，旧 generation 不复活；删 B 自身出边不删 A 入边；另一 owner 不贡献，隐藏源 holder 不提供读权；attrs 冲突整页失败 |
| F31 R02-02 重复与回滚 | 删除页/重现页/空集合页重复、旧 CAS 拒绝，在声明/重算/FTS/checkpoint/outbox/COMMIT 切点失败或崩溃 | 重开 DB 断言 holder/generation/声明/物化/seen/游标/outbox 全有或全无；重试按当前状态，不复活旧边；物化恢复包含页外 A 的正确来源事件，无重复语义事件 |
| F32 R02-02 FK 与重建 | 真实 SQLite 开 FK、删除 target、删除 from membership、物化清空/重建、声明损坏/大图超预算 | target 无级联声明删除，from 级联限 holder；物化可从当前声明恢复，已删除集合/历史不能恢复；错误不伪空、不提交半重建；反向索引与双平台迁移留实际证据 |
| F33 R02-03 动态漏存活 C | 旧窗口 primary C 持 C→B 声明/归属/有效派生；第一页后 C 重排到已读位置，后续请求/cursor 全合法成功 terminal、seen 不含 C，无可证明不漏的源证据 | snapshot.complete=false、graph/sync terminal incomplete 与合法原生 checkpoint 同 Tx；C membership/holder/generation/声明及其有效派生不因 missing 改变。missing 删除/候选 from 声明销毁增量零，不发布 sync.completed/完整报告，不报零事项；R02-01 全出口与 R02-02 入边规则不回退 |
| F34 R02-03 合格源证据 | 合成受信登记的逐流稳定枚举/快照证据，精确绑定本轮及允许变化；请求链合法、终页同 Tx 重验有效；另测旧候选仍存活 C 和确已离开集合 D | C 必须被所登记语义枚举/排除漏失，不能只看合法页；只有获证明的缺失 D 在候选/revision/coverage 范围移除，其他 owner/stream 和有效入边声明保留。对账/依赖/FTS/状态/terminal/outbox 原子、一次完成；合成替身不算厂商支持或实测证据 |
| F35 R02-03 缺失/过期/自报 | 无证、拉页时有效但末页已过期/休眠失效、只核验部分候选、connector 自报 complete/verified、callback 仅 CAS 成功、候选伪装 deletion | 合法页继续写、terminal/checkpoint+incomplete 原子，snapshotCompleted=false；missing 删除/候选 from 声明销毁增量零，无假完成。自报/回调/非权威 not_found 不补证，未查/预算终止不当不存在；候选不得伪装 tombstone，不跨 sync_ 取证 |
| F36 R02-03 绑定错误 | 单独替换证据 owner/source/stream/window、账号/issuer/授权政策世代、过滤/排序/破同序、membership/删除范围、connector/映射/Schema/证据版本与 digest、同步轮次；本页仍合法 | 每种错绑定证明均拒绝，complete=false/incomplete、零 missing 删除/候选 from 声明销毁，合法 terminal 保留；不能借别的 owner/范围/旧轮证明。若实际页也变账号/范围/版本或无授权，整页回滚不推进，而非以 incomplete 放行越权页 |
| F37 R02-03 末页竞争/崩溃 | 取证后取消/租约/epoch 改变、旧 pageSeq/inputCursor 竞争；证明提交前过期；在资格重验、missing 移除、状态、checkpoint/outbox/COMMIT 前后注入失败并重开 DB | 页资格/CAS 失败整页回滚、保留前页；仅证明失效且页合法时原子 terminal incomplete、未见候选保留。提交前后两个分支均无部分删除/声明销毁/检查点；已提交 incomplete 不自动升级或补发 sync.completed，旧页不重包装新轮 |
| F38 R02-03 独立路径/呈现 | 同 incomplete 页合法 upsert X、当前完整出边替换、独立登记权威 tombstone T；C 缺失无证；报告/通知重读覆盖；清理/重启旧 incomplete | X/合法替换和 T 仅按各自范围处理、真实 entity.changed 同 Tx；C 不删，不 blanket 禁用 tombstone，也不把 missing 变 tombstone。from/target 生命周期按 §4.3，incomplete 清进度不删业务归属，范围不完整不报完整/零事项；无新私有事件/证明接口 |

### 7.2 同步集成验证重点

必须与 MOD-01/03/06 共同使用真实共享 SQLite 连接验证，不仅 mock 回调：

- 故障注入遍历“实体、stream 归属、身份精确证据、from 集合 generation/声明、target 删除/重现、物化、FTS、seen、cursor CAS、outbox、COMMIT”切点，重开 DB 查一致性，不能只断言错误返回。
- callback 接收 Tx 与 AuditWriter/EventBus 必须来自同一事务；Promise/网络型替身在事务中应被拒绝。声明与物化不能分库或提交后恢复；重现 B 的页外 A 影响集也参与原子提交。
- W1/W2 重叠窗、事件移动、其他 stream 同对象、跨 owner 同 id、primary/identity 混页分别验证不误删；并以 F29–F32 查询权威声明表、物化表和 generation，不能仅通过 related 看不到边就判删除正确。
- MOD-03/04 的受信逐流证据登记/核验与 MOD-02 的 seen/candidates 必须分开取断言：F33–F38 在真实共享 Tx 中验证动态位置漏 C、合法证据及缺失/过期/各项错绑、取消/末页 CAS 与崩溃两分支。检查缺证 missing 删除/候选 from 声明销毁增量零，合法 terminal/checkpoint 与 incomplete 同在、无 sync.completed；合法 upsert/独立权威 tombstone 范围不受 missing 限制。测试替身只能按批准公共协议模拟，不能靠成功 callback 自证完整，不让图谱跨表读 sync_。
- MOD-01/03/06/08 联合验证 B 撤权在输入解析、数据读取、序列化及下一次模型/通知消费切点生效；所有 R02-01 出口和同范围回查都需真实受信 policy 绑定，替身不能证明即时性。内部 canonical 不作为输出安全回退。
- SQLite 一个写者意味着网络不得占写锁；测同步事务时长、FTS 更新和快照终页删除峰值，不能用长期 BEGIN 锁住宠物查询。预算超标回设计拆页/预处理，不删安全检查。
- 稳定事件 id 与至少一次消费检查点归 MOD-06；重复通知由其 dedupeKey/订阅 checkpoint 约束，图谱不能宣称 exactly-once。

### 7.3 实施与里程碑门槛

| 门槛 | 必需证据 | 未满足的阻塞 |
|---|---|---|
| G0 修订复评与批准 | 主会话已完整复评 R02-01/02 设计修订满足；须核实本次 R02-03 双门槛、缺证保留与 F33–F38，并确认前两项不回退。Q01–Q11 依 Q13 按里程碑闭环；公共 ID、证明载体/complete/cursorCommit 语义变化须 ADR/新基线及受影响重评 | R02-03 待复评，公共契约/证据及 F/G 未闭环，未批准实施；设计满足、写出或静态检查均不放行 |
| G1 冻结服务对接 | MOD-01 事务/迁移/AuditWriter、MOD-06 outbox 同 Tx；MOD-03 expected pageSeq/inputCursor/取消/租约/epoch CAS；受信 Reader/policy/self 档案。Q07 须统一证明资格的终页同 Tx 联合核验及合法 terminal+incomplete/checkpoint 对接 | 不能以 cursorCommit 成功、连接器自报 complete/verified 或跨 sync_ 读替代源证据；缺公共对接不实施相关路径，missing 对账关闭，不私造接口 |
| G2 Schema/身份/流映射 | 13 类逐源映射、未知/无邮箱表达、人员证据/字段路径、union/open 域；window/primary/support/独立权威 tombstone/terminal 契约。逐流源枚举/缺失资格须 MOD-03/04 受信登记，含绑定版本/轮次/时效/允许上游变化和真实源证据 | JSON/请求链成功非不漏证明；缺证/过期/错绑保留候选并 incomplete；不预设全局原子快照，有界候选核验仅公共候选。不得填假人/计数、强制 null 丢 checkpoint 或启用未批 alias |
| G3 本地存储探针 | 双平台安装包真实 SQLite/validator/FTS/Unicode；声明 holder FK、target 不级联、generation/反向索引/物化重建/故障恢复的 F25/F32 证据 | 文档表/预算不是验证，ADR 历史或开发机结果不等于 Windows 完成 |
| G4 M1 基础正确性 | self-only/metadata-only；适用 F01–F09/F11–F16/F20/F22–F25/F27–F38，M2 正文/人工场景开放前执行；相应 Q 闭环。动态漏 C、证据失效/错绑、末页竞争/崩溃须证明零 missing 删除/候选 from 声明销毁与 terminal incomplete 原子，报告含范围/来源/覆盖/fetchedAt | 人员安全拒绝/缺源/枚举 incomplete 均不报零事项，不发假完整报告/sync.completed；三页恢复/全出口撤权及 R02-03 无实测不称完成，F/G 均未执行 |
| G5 M2 数据能力 | 正文同页入口/审计/撤权、受信 list/merge/undo、user 分类及证据策略批准；F10/F17–F23/F27/F28 的 M2 全出口/回查验证 | 暂不开放对应能力；如用安全 alias 需公共契约、ADR 及受影响设计重评，不能私有替换 |
| G6 扩展演练 | 进入 M2 前 F26 与新只读连接器/新能力试装，移除/升级不破坏他人数据 | 扩展性仍未证明；不添加皮肤养成绕过生产力修复 |
| G7 真实省时 | acceptance 规定至少 3 个相近真实任务、中位耗时下降目标 ≥30%，含查背景/起草/决定/执行/核验 | 样本不足/未达不宣称省时；图谱性能指标不能代替用户任务耗时 |

性能候选验收：10,000 元数据实体、100,000 关系、1–2 周查询、有限正文规模，在两平台测 query 第一页建 session 成本、后页延迟、短查询预算和窗口终页事务；测事件循环阻塞、峰值内存/索引大小。不提前填写“<X ms 已达标”。全产品 CPU/内存目标属于 acceptance/MOD-01/12 综合实测，不能把图谱压测当团子整体验收。

### 7.4 非敏感 POC 迁移依据

本次只阅读代码，不运行程序、不读取 .env、配置或凭证。具体复用在设计批准后由相应模块执行。

| 已读来源 | 可复用思想 | 不迁移的旧假设 |
|---|---|---|
| src/db.ts:8–25 | SQLite 参数化 CRUD 的简洁实现 | items 单 id 主键、直接自行建库/BEGIN、不含 owner/Schema/正文边界 |
| src/db.ts:29–59 | 集合差值与事务回滚思路 | 单页 replaceRange、只按 start_at/全 source 删、完整分页未成功也删；必须换本稿 seen/stream/窗口归属 |
| src/db.ts:95–100 | 分类可确定写回的需求 | categories 直接改源行、只凭 title 相同保留 user 分类、无证据的 user 编辑；改派生与优先记录 |
| src/types.ts:1–27 | 时间/事项字段映射、CAP-01 分类集合的迁移参考 | 封闭 Source/Kind 枚举、扁平 actor 字符串、无 PersonId/Schema 的 meta |
| src/report.ts:78–100 | mergeIntervals/freeGaps 纯算法 | 图谱不接管报告；CAP-01 需先裁剪跨日/统计窗口并解释“日历空档”而非实际专注 |
| src/report.ts:105–205 | 原确定性统计的测试输入思路 | 主机时区及 startAt 当天过滤、meetingShare 冒充真实工时；按 acceptance 改名/解释 |
| test/report.test.ts:21–38、40–103 | 重叠只算一次、窗口裁剪测试思想 | 旧 11 测通过只是 POC 记录，不能替代 graph/双平台/真实授权验证 |

不读、不迁移旧 secrets/config/OAuth 数据；不把现有 items 表任意自动导入正式 graph_。若用户需要旧数据迁移，必须选定数据范围和 SourceId/owner 映射，经批准后一次受信本地迁移；未知来源/身份/正文权限的历史行隔离，不伪造 provenance。

## 8. 未决问题

下表按[主会话 Q13](../open-questions.md#mod-02-工作图谱协调)更新责任及裁决方向，**Q01–Q11 全部仍待公共契约/证据闭环**。不修改 contracts、ADR、open-questions、评审记录或他人文件；P0 只阻塞对应路径，M4 共享不提前阻塞无共享的 M1/M2。主会话已复评 R02-01/02 满足设计修订要求；本次仅 R02-03 待复评，不代表公共依赖、F/G 或实施批准。

| 编号/优先级 | Q13 方向、仍缺内容与本模块边界 | 协调责任 / 放行前证据 |
|---|---|---|
| Q01 P0 正文载荷 | 需受信同页同复合键正文 upsert/清除及 Entity/FTS 同 Tx；hasContent 仅实际留存。M1 metadata-only/false，不用私有工具结果/构造参数偷建 Writer | MOD-03/04/02/05/01；载荷契约、原子性/scopes 撤回测试，正文入模前 |
| Q02 P0 Reader 上下文 | 宿主按认证/能力声明绑定范围，参数只收窄；即时源政策世代和人员公开 ID 证据不可自报，self-only。R02-01 拒绝/回查设计已满足复评要求，但受信绑定/证据接口未闭环，M4 ACL 后置 | MOD-01/03/06/08/02/05/10；全直接/间接出口、person/relatedTo/字段、session/撤权 F27/F28 及受信绑定契约 |
| Q03 P0 断源缓存 | 默认断源停读/隐藏缓存与派生，对能力/模型/主动通知即时禁用，不自动删历史或恢复消费。持久政策/世代、保留期、隔离查看/清理/备份限制尚缺，不把方向当用户留存许可 | 主会话、MOD-03/02/05/06/08/09；政策与全出口失效、本人明确清理及透明授权证据 |
| Q04 P0 身份管理 | M1 可信精确映射与 M2 受信 list/merge/undo 分开；native/app/tenant/union/open 键域待登记。内部 person_key/alias 不授权公开 ID；安全 alias 仅 §8.1 公共候选 | MOD-04a/03/02/08/01；无邮箱/跨应用/merge/undo/重同步及公开 ID 回查测试；邮箱非本人认证 |
| Q05 P0 关系分页 | 小关系完整汇聚后 applySync；大关系需显式分片完成语义及公共 related 分页。预算未测、超限不截断；from/source/stream 完整集合不由 snapshot.complete 代证 | MOD-03/04/02/06/08；三页出边替换与 target 重现、分片输入、相关关系分页/超限契约证据 |
| Q06 P0 派生授权 | 受信可写类型/能力归属/EvidenceRef，self/private/同 owner 证据；最高敏感度及人员输入可核验，不借裸 Relation ID 获权；跨 owner M4 | MOD-06/02/05/07/10；与 U07-07 协调证据载体，越权/失效/升敏/环及 counterpart 出口测试 |
| Q07 P0 快照协调（R02-03/R03-03） | MOD-03 持久请求链/原生游标/expected pageSeq/inputCursor、取消/租约/epoch CAS；MOD-02 seen/candidates/membership，既有 cursorCommit 同 Tx 不代证完整。window/primary/support/deletion、逐流可核验源枚举/缺失依据和独立权威 tombstone 由 MOD-03/04 受信登记/核验；绑定 owner/source/stream/window、账号授权、过滤排序/映射 Schema/证据版本/轮次、期限/允许上游变化，终页同 Tx 末验。缺证/过期/错绑/不能证明不漏，complete=false、保留候选归属/from 声明、合法 terminal/checkpoint+incomplete 同 Tx、不发 sync.completed；missing 非 tombstone，合法 upsert/独立删除按范围保留。有界候选权威核验仅候选，不要求未证存在的全局原子快照 | MOD-03/04/02/01/06、主会话统一证明载体/complete/cursorCommit 与 incomplete/terminal 公共语义，必要 ADR/新基线/受影响重评；未闭环 missing 关闭、不私建接口/表、不跨 sync_ 读/用回调成功偷补证据。F33–F38 动态漏存活 C、合法证据/失效错绑、取消/末页 CAS/崩溃证明零 missing 删除/候选 from 声明销毁、不报零事项；terminal 原生 checkpoint 不强制 null，恢复/进度清理优先内部 |
| Q08 P0 用户修改 | 人工分类/降敏需认证证据及独立受信入口/分类体系键，与动作/记忆统一；普通能力 llm/rule、只升不降，不凭 user 字段抢优先 | MOD-07/08/06/02/05/09；用户结果不被覆盖、体系隔离、伪造来源/降敏测试，M2 开放前 |
| Q09 P0 字段映射 | 13 类 Schema 全候选；organizer/人员解析次序、项目稳定键、thread/chat/target、Relation.attrs/扩展人员路径待逐源确认。未知必填/无邮箱不能用假 PersonId/0 填补；精确引用证据的宿主建立需协调 | MOD-04a/b/c/03/02；每类型映射、无邮箱/unknown 表达、hash 一致性及 R02-01 字段出口证据 |
| Q10 P0 存储与恢复 | 同连接同步 Tx/outbox 已强制，平台负责迁移/恢复/留存，本模块负责正文/FTS/人员投影及声明物化。FK 方向、generation/重建/反向索引、SQLite/validator/Unicode/短查预算双平台仍待实测 | MOD-01/06/02/03；与 U07-08 协调，真实 SQLite 故障注入/不可变迁移/FTS/关系恢复探针 |
| Q11 P1 结果/错误 | M1 self-only 事件只唤醒并重读 Reader；M4 前补 owner-aware 事件/ApplyResult。统一错误码/呈现与 U07-11，游标/超限/索引/物化异常不能当空数据。人员安全拒绝及枚举 incomplete 只说明范围未覆盖，不报零事项/假完整或泄漏隐藏存在性；terminal 成功不代替 sync.completed | MOD-06/03/08/02/05/10；M1 错误展示/事件重复/范围测试，M4 owner 结果专项 |

### 8.1 R02-01 的公共 ID/Reader 语义候选（未采用）

当前本稿只安全拒绝：不把隐藏 canonical 临时改字符串，不创建公开 alias 接口。若主会话认为无邮箱 A 在 B 撤权后仍须可按人员查背景，可评审“受权范围安全 alias”候选；它会改变冻结 PersonId 的邮箱优先和 Reader 返回/解析语义，不能在本模块自行实施。

候选须定义持久随机 local 形态 alias 与 `(owner,受信投影范围,内部人)` 的唯一绑定，独立于隐藏邮箱字节；范围包含认证 principal、source/type/purpose 许可，不把 token/alias 当授权。相同范围重启稳定、在当前有效 policy generation 下同范围回查；跨范围/owner 猜 alias 无匹配。撤权即时令旧范围 ID/session 失效，返回受权子范围的 alias 是否保持、合并/撤销如何重绑定、恢复账号是否再启用，都必须明确，不能把 alias 永久当跨范围同人追踪器。不得反查全量内部 alias 闭包或从隐藏邮箱派生可猜 alias，源 attrs/Relation.to/hash 仍保持原值。

这只是公共方案的要求清单，不新增 graph_ alias 表/公开工厂/DTO/错误协议，也不是“写入已有 person:local 字符串就兼容 v1”。实体人员字段的投影值、查询等值/relatedTo、Person/self、导出/模型/动作预览及依据 ID 的稳定性都受影响；由主会话联合 MOD-01/02/03/04/05/06/07/08 统一 ADR、契约/新基线和受影响设计重评。跨 owner 一律留 M4。未采用候选前保持 §4.1 的拒绝及 Q02/Q04/Q09/G0 阻塞，不宣称 R02-01 公共依赖已闭环。

### 8.2 官方资料与证据状态

以下官方页面在本设计会话阅读核对（2026-11-19 本地日期）；页面描述不等于本机或安装包实测。只引用与程序设计相关资料，不上传用户工作数据。未核验的供应商字段/平台行为已列候选与门槛。

| 引用 | 官方材料 | 核对到的事实/本稿边界 |
|---|---|---|
| R1 | [SQLite FTS5：Trigram](https://www.sqlite.org/fts5.html#the_trigram_tokenizer)、[External Content](https://www.sqlite.org/fts5.html#external_content_tables)、[Pitfalls](https://www.sqlite.org/fts5.html#external_content_table_pitfalls) | 连续三字符子串、短 MATCH 不命中、LIKE/GLOB 回退与 ESCAPE 限制、detail 限制；外部索引需应用维护与 rebuild。NFC/预算/双索引是本稿候选，不是官方自动保证 |
| R2 | [SQLite Transactions](https://www.sqlite.org/lang_transaction.html) | 同时一个写事务，BEGIN 不嵌套，IMMEDIATE 可 BUSY；错误未必自动全回滚。StorageService 明确统一回滚、同连接与同步回调，不让图谱自行重试 COMMIT |
| R3 | [SQLite Row Values：比较](https://www.sqlite.org/rowvalue.html#row_value_comparisons)、[Scrolling Window](https://www.sqlite.org/rowvalue.html#scrolling_window_queries) | Tuple 从左到右比较，NULL 可使结果未知；合适索引下 keyset 避免随 OFFSET 增大的代价。本稿固化键 session/失效 fence 是候选算法 |
| R4 | [JSON Schema 2020-12 Validation](https://json-schema.org/draft/2020-12/json-schema-validation.html)、[Format Annotation](https://json-schema.org/draft/2020-12/json-schema-validation.html#name-format-annotation-vocabular) | required/类型/数值/enum；format 默认可仅 annotation、格式断言与邮箱身份可信性不同；ECMA 正则需显式锚定。validator 实际支持须探针 |

仍未验证：Node 24 安装包所带 SQLite 版本/FTS5 编译选项、Windows 中文短查询与 Unicode 行为、JSON 校验库版本、飞书 union_id 具体边界与实际消息权限、Gmail 正文范围、GitLab 项目/事件映射。本文不引用猜测的供应商链接、不把旧 ADR 的验证记载升级为新通过结论。

## 9. 变更记录

- 2026-11-19 首稿：依据冻结 architecture v1/ADR-0017 编写详细设计，初始状态待评审；SHA-256 `603e25e569afa96d1dbcd6cda1b79ed3d6428f9a66196a10a987ae5d4f006a26` 与主会话核实一致。首轮评审退回，未批准实施。
- 2026-11-19 定向修订：状态改待复评，引用首轮评审/Q13。§1/2/3/4/5/6/7/8 修订 R02-01：内部 person_key/canonical/alias 与当前公开 ID 证据分离，精确输入/输出同范围回查、人员全字段/关系/缓存/游标重验，无法安全披露拒绝整项，不改事实/hash；安全 alias 仅公共 ADR 候选。修订 R02-02：来源/派生声明与物化生命周期分离，from holder/generation 替换、target 暂缺保声明、重现反向影响集同 Tx 重建，补 FK/索引/重建/回滚及 F27–F32、G0–G5。按 Q13 更新 Q01–Q11 责任及未闭环状态，取消 final 强制 null 以避免丢 terminal checkpoint；M1 metadata-only/self-only，M4 后置。仅修本文；文档静态检查不等于 Schema validator、业务映射、F/G 或双平台测试。本次均未执行产品测试、授权/真实工作数据访问、外部动作、安装、配置/权限或其他文件修改，等待主会话核实复评。
- 2026-11-19 R02-03 定向修订：依据主会话对 872 显示行稿（SHA-256 `9945b39930f541a7e3f66753d9db81438ea2af928e1b669d8ae9e32dd86a9257`）的完整复评，头部记录 R02-01/02 满足设计修订要求，保持其安全拒绝/原引用 hash 与声明/物化、from/target 生命周期不变。仅收紧 §4.7 及相关摘要：合法请求链与逐流受信源枚举/缺失证据独立，列主体/账号授权/过滤排序/映射 Schema/证据版本/轮次/时效/允许上游变化及末页同 Tx 重验；缺证 complete=false、合法 terminal/checkpoint+incomplete 原子，零 missing 删除/候选 from 声明销毁、不发假完整或 sync.completed。合法 upsert/完整出边及独立权威 tombstone 按范围处理；有界候选核验仅公共候选。补失败矩阵、I20、F33–F38/同步集成、G0/G1/G2/G4 与 Q07（对齐 R03-03）；证明载体/complete/cursorCommit 公共语义仍待主会话契约/ADR/受影响重评，不私造接口/表或跨 sync_ 读、借回调成功补证。R02-03 待复评，Q01–Q11/F/G 未闭环、未批准实施，M1 metadata-only/self-only 与 M4 后置保持。仅文档修订及静态核对，未执行 validator、产品、F/G、逐源/双平台或省时测试，未运行新探针/授权/安装/外部动作、读取凭证/工作数据或修改其他文件/配置/权限。
