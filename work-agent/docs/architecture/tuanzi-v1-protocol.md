# 团子先行版协议 v1

- 状态：已批准（总架构师；先行版实现依据）
- 日期：2026-11-19
- 依据：ADR-0018；contracts.md §1、§4、§5.1、§6、§8、§10–§12；invariants.md
- 产品形态：`design/tuanzi-v1-product.md`（动作、台词、界面细节以产品稿为准；接口以本文为准）
- 代码形态：`src/contracts/`（只有总架构师能改）

本文写清楚三个开发角色并行开发时需要约定的内容，包括目录所有权、进程发现、认证、本地接口、事件推送、记忆文件格式和模块注入接口。本文没有写到的内部实现，由各模块自行决定，但不能违反 invariants。

## 1. 范围与角色所有权

| 角色 | 目录 / 文件 | 表前缀 / 数据文件 |
|---|---|---|
| 总架构师 | `src/contracts/**`、`docs/architecture/**`、`docs/adr/**` | — |
| 开发 A（客户端） | `apps/pet/**`（自己的 package.json、Cargo、测试） | 客户端本地设置（`<data>/client/settings.json`） |
| 开发 B（大脑） | `src/platform/**`、`src/surfaces/**`、`src/companion/**`、`src/runtime/**`、`src/daemon.ts`、`test/platform|surfaces|companion|runtime/**`、根 `package.json` 的 scripts | `platform_` `audit_` `ui_` `rt_` `comp_`；`<data>/companion/persona.md`；`<data>/run/` |
| 开发 C（记忆） | `src/memory/**`、`test/memory/**` | `mem_`；`<data>/companion/user.md`、`memory.md`、`journal/*.md` |

- POC 原有文件（`src/cli.ts`、`src/server.ts` 等）先行版不修改，也不导入。
- 跨目录调用只能通过 `src/contracts/` 导出的类型。B 在 `daemon.ts` 里组合 C 的工厂函数 `createMemoryModule`（§8.4）。
- 任何角色需要改 contracts，都写进 `docs/open-questions.md` 并报告总架构师，不能自己改。
- 新增 npm 依赖只有 A 可以加，而且只能加在 `apps/pet/` 下。根目录保持零运行依赖：B 和 C 只用 Node 24 内置模块。

## 2. 进程与发现

- 数据目录：读取环境变量 `WORK_AGENT_DATA_DIR`；没有设置时，开发环境默认用仓库根目录下的 `data/`。仓库根目录由 `src/daemon.ts` 所在位置推出。
- 端口：读取 `WORK_AGENT_PORT`，默认 8787。被占用时依次尝试 8788 到 8797；全部失败就退出，并说明原因。只绑定 `127.0.0.1`（I18）。
  - 注意：将来接 OAuth 回调时，回调地址需要固定端口。届时只能使用已登记的端口，不能自动漂移。
- 启动成功后，原子写入 `<data>/run/daemon.json`，格式为 `DaemonInfo`：
  ```json
  {"pid":123,"port":8788,"startedAt":1763520000000,"version":"0.1.0","protocol":1}
  ```
  这个文件不含令牌。正常退出时删除它；残留文件由客户端用健康检查识别。
- 同一数据目录只允许一个后台进程：用 `<data>/run/daemon.lock` 文件锁（写 pid）。如果锁里的 pid 已经不存在，可以接管。
- 客户端发现流程：
  1. 读取 `daemon.json`；
  2. 请求 `GET /api/v1/health`，核对返回的 `startedAt`；
  3. 失败时进入 offline 状态。
- 唤醒：客户端在仓库根目录执行 `node --disable-warning=ExperimentalWarning src/daemon.ts`，以分离进程方式启动；按 ADR-0021 丢弃原始输出，只向 `<data>/run/bootstrap.log` 写固定启动状态。然后轮询健康检查和认证快照，最多 10 秒；失败提示区分发现信息、本机连接、来源拒绝与认证，不显示原始异常或指向不存在的 daemon.log。
  - 开发构建通过编译期常量知道仓库根目录。仅 debug 且 Tauri 开发模式从应用配置的 devUrl 提取 Origin，验证是带端口的 HTTP loopback 后追加到子后台的 WORK_AGENT_DEV_ORIGINS；release 和打包模式不自动追加，既有 Host/Bearer/窗口 ACL 不变。
  - 已运行后台不会因再次唤醒更换配置；旧后台缺少开发 Origin 时需用户正常停止后重新唤醒，不自动停止用户进程。打包分发不在先行版范围内。
- 开发一键启动：仓库根 `npm start` / `bash start.sh` 依次启动并等后台、Vite 就绪，再启动 Tauri；只追加配置 devUrl 的精确 loopback Origin。健康且匹配发现信息/开发 CORS 的后台可复用；开发端口占用或旧后台拒绝来源则停止启动，不终止既有进程或清锁。脚本关闭或子服务退出时只清理本次创建的进程组，复用后台不停止；脚本启动的后台随前台会话停止，不是常驻服务。
- 退出：收到 SIGINT 或 SIGTERM 时，先给 SSE 客户端发 `bye`，再关闭数据库、删除 `daemon.json` 和锁文件。

## 3. 本机令牌与认证

- 令牌存放在系统凭证库：service 为 `work-agent`，account 为 `local-api-token`。值为 32 字节随机数，用 base64url 编码。后台首次启动时生成，以后复用。
- macOS 凭证库写入必须通过 `security -i`，命令从 stdin 传入（`add-generic-password -U -s … -a … -w …`），**不能出现在 argv**（I7）。读取用 `security find-generic-password -s work-agent -a local-api-token -w`，值从 stdout 取得。
- Windows：SecretStore 返回 `unsupported`，后台拒绝启动（fail closed），不能降级为明文文件。
- 客户端取令牌：由 Rust 命令 `get_api_token` 读取凭证库，只返回给 webview 并保存在内存中。令牌不能写入 localStorage、设置文件、日志或 URL。
- 校验顺序（命中即停止）：
  1. `Host` 必须是 `127.0.0.1:<port>` 或 `localhost:<port>`，否则返回 403；
  2. 如果请求带了 `Origin`，它必须在白名单里，否则返回 403；
  3. 除健康检查外，所有接口都要求 `Authorization: Bearer <token>`。令牌用定长比较，缺失或错误返回 401。
- Origin 白名单：`tauri://localhost`、`http://tauri.localhost`、`https://tauri.localhost`。环境变量 `WORK_AGENT_DEV_ORIGINS`（逗号分隔，例如 `http://localhost:1420`）只在开发时追加。
- CORS：只对白名单内的 Origin 回 `Access-Control-Allow-Origin: <origin>`，允许方法 `GET, POST, PUT, PATCH, DELETE`，允许头 `Authorization, Content-Type, Last-Event-ID`。预检请求 OPTIONS 不要求令牌，但仍校验 Host 和 Origin。
- 浏览器 EventSource 不能带请求头，所以 SSE 用 `fetch` 读取流（客户端自己解析）。**不能把令牌放进查询参数。**
- 本机用户身份：`OWNER: PersonId = 'person:local:owner'`。每个通过认证的写请求，都由 B 登记一条用户证据（§8.3）。

## 4. 通用约定

- 前缀为 `/api/v1`，请求和响应都是 JSON，时间一律用 UTC 毫秒。
- 错误统一格式：`{ "error": { "code": string, "message": string } }`。
  - HTTP 400：`bad_request`；
  - HTTP 401：`unauthorized`；
  - HTTP 403：`forbidden`；
  - HTTP 404：`not_found`；
  - HTTP 409：`conflict`，例如手改冲突或墓碑拦截；
  - HTTP 422：`rejected`，例如 rule 缺少用户证据；
  - HTTP 501：`unsupported`；
  - HTTP 500：`internal`。`message` 不能包含正文或凭证。
- 请求体上限 64 KB。字符串字段按协议长度截断前先做校验：超出长度返回 400，不静默截断。
- 日志只记事件名、id、状态码和耗时，不记记忆正文、聊天正文、通知正文或令牌（I22）。

## 5. 接口清单

| 方法 | 路径 | 请求 | 响应 |
|---|---|---|---|
| GET | `/health`（免令牌） | — | `{ ok: true, version, protocol: 1, startedAt }` |
| GET | `/pet/state` | — | `PetState` |
| GET | `/pet/persona` | — | `PersonaView` |
| PUT | `/pet/persona` | `Partial<Persona>` | `PersonaView` |
| POST | `/pet/interactions` | `PetInteraction` | `{ utterance: PetUtterance \| null }` |
| POST | `/pet/quiet` | `{ mode: 'dnd' \| 'demo' \| 'off', minutes?: number }` | `PetState` |
| POST | `/pet/quiet/client` | `{ reasons: QuietReason[], detection: 'known' \| 'unknown', ttlMs: number }` | `PetState` |
| PUT | `/pet/audio` | `{ enabled: boolean, volume: number }` | `PetState` |
| GET / PUT | `/pet/settings` | `Partial<CompanionSettings>` | `CompanionSettings` |
| GET | `/reminders?status=` | — | `{ items: Reminder[] }` |
| POST | `/reminders` | `{ text: string, dueAt: number }` | `Reminder` |
| DELETE | `/reminders/:id` | — | `Reminder`（状态变为 cancelled） |
| POST | `/memory/:id/retype` | `{ kind: 'rule' \| 'fact' }` | `MemoryItem`（保留 id、层和原文件） |
| POST | `/notices` | `Notice` | `NoticeRecord` |
| GET | `/notices?status=&limit=` | — | `{ items: NoticeRecord[] }` |
| POST | `/notices/:id/read` | — | `NoticeRecord` |
| POST | `/notices/:id/snooze` | `{ minutes?: number }`，默认 60，范围 5–1440 | `NoticeRecord` |
| POST | `/notices/:id/dismiss` | — | `NoticeRecord` |
| POST | `/memory/reindex` | — | `{ ok: true }`；认证后重建可丢弃索引，安全账本不删除 |
| GET | `/memory?layer=&q=&limit=` | — | `{ items: MemoryItem[] }` |
| POST | `/memory` | `MemoryCreateRequest` | `MemoryItem` |
| PATCH | `/memory/:id` | `{ text?, sensitivity?, validUntil? }` | `MemoryItem` |
| DELETE | `/memory/:id` | — | `{ ok: true }` |
| GET | `/memory/journal?date=YYYY-MM-DD` | — | `{ items: MemoryItem[] }` |
| POST | `/chat` | `{ message: string, conversationId?: string }` | `{ conversationId, chunks: ChatChunk[] }` |
| GET | `/stream` | 请求头 `Last-Event-ID`（可选） | `text/event-stream` |

接口细节：

- **`/pet/quiet`**：
  - `dnd` 写入 `source:'user'` 的 `user_dnd` 信号；
  - `demo` 写入 `source:'user'` 的 `screen_share` 信号，`detection` 为 `known`，客户端会隐藏团子；
  - `minutes` 不填表示直到手动关闭；
  - `off` 只清除 user 来源的信号。
- **`/pet/quiet/client`**：租约最长 120 秒，客户端每 30 秒续一次；租约过期后这个来源变成 `unknown`，不会被认定为“没在共享”。客户端信号不能清除用户的勿扰（contracts §10.3）。
- **`/pet/audio`**：`volume` 取值 0–1。处于 quiet 时 `playing` 强制为 false，`enabled` 保持不变。客户端实际开始或停止播放时，分别上报 `audio_play` 和 `audio_pause` 交互。
- **`/notices`**：本机调试和后续能力的投递入口。来源 Actor 记为 `{kind:'system', component:'local-api'}`。真正的能力通过 `NoticeSink.submit`（§8.2）投递。
- **`/chat`**：先行版不调用模型，同步返回完整的 chunks。指令清单、正则和回答文案以产品稿 §7、§8 为准，包括记住、忘掉、你记得什么、关于 X、提醒、勿扰、通知、关于团子、陪伴和时间。
  - 卡片通过 `ChatChunk{kind:'card'}` 返回，结构为 `LocalCard`。卡片按钮由客户端调用 REST 完成，聊天接口本身不执行二次确认的动作：
    - 撤销记忆：DELETE `/memory/:id`；
    - 改类型：POST `/memory/:id/retype`；
    - 确认忘掉：DELETE `/memory/:id`；
    - 取消提醒：DELETE `/reminders/:id`；
    - 打开面板：只在客户端处理。
  - 写入记忆时同时返回 `memory` chunk。
  - **“忘掉 …”只检索，不删除。**
  - **聊天原文不落盘**：`ui_user_evidence` 只存 id、类型和时间。
  - 内容看起来像凭证的，B 和 C 都要拒绝（产品稿 §7）。
- **`/memory/:id/retype`（ADR-0022）**：调用 `MemoryBrowser.retype`，仅本人当前已验证的 local_edit 证据可执行。保留 id、层、原文件、正文、createdAt、about、敏感度和有效期；规则升级建立本次 user/local_edit 来源，降为事实保留完整来源。只原位修改标记，发布 updated，不制造遗忘墓碑。日记不允许改类型，同类型不重写；客户端撤销使用返回 id，不自动搬页。
- **`/reminders`**：
  - 提醒存在 `rt_reminders` 表，状态为 `scheduled | fired | cancelled`；
  - 到点时由 B 生成 `kind:'companion.reminder'` 的通知，`facts` 包含时间和原话，`why` 为“你在 HH:mm 让我提醒”；
  - 如果后台在提醒时间点没有运行，启动时补发一次，并在 facts 里注明“晚了 N 分钟”；
  - 提醒原文属于用户输入，敏感度为 normal，删除提醒时同时删除原文；
  - `dueAt` 必须晚于现在、早于 30 天后，`text` 为 1–100 字。
- **`/pet/settings`**：只放后台需要的设置项（`CompanionSettings`），包括工作时间、每日主动气泡上限、下班提醒、接收开发测试通知、气泡披露机密、夜间睡眠。大小、按屏幕保存的位置、自娱频率、快捷键、角标显示属于客户端本地设置。原生序列化字段 `fixed` 暂保留，但不再提供设置入口或控制自动吸附/跟随。

## 6. 事件推送

- `GET /api/v1/stream`：先发 `retry: 3000`，然后按 `id:` 递增发事件；每 15 秒发一行注释心跳 `: ping`。
- 事件持久化在 `ui_events` 表，保留最近 1000 条或 24 小时。
  - 带 `Last-Event-ID` 重连时，补发这个 id 之后的事件；
  - 如果这个 id 早于保留窗口，只发 `resync_required`，再接着推送新事件；客户端收到后重新拉取 state、persona、notices。
- 不带 `Last-Event-ID` 的新连接：先发一条 `hello`，内容是当前 seq，然后推送实时事件。客户端收到 hello 后再刷新 REST 快照，同时按串行事件队列处理随后到达的消息，覆盖初次快照与订阅之间的空窗；重连 hello 也刷新快照，不能仅设置游标。
- 事件类型（`StreamEvent`）：

| type | data | 说明 |
|---|---|---|
| `hello` | `{ seq }` | 只发给本连接，不持久化 |
| `pet.state` | `{ state: PetState }` | 状态有变化时推送 |
| `pet.utterance` | `{ utterance: PetUtterance }` | 客户端按 `id` 去重，过了 `expiresAt` 就忽略 |
| `notice.created` / `notice.updated` | `{ notice: NoticeRecord }` | |
| `memory.changed` | `{ id?, layer?, change: 'created' \| 'updated' \| 'forgotten' \| 'reindexed' \| 'issue' }` | **不带正文** |
| `persona.updated` | `{ persona: Persona }` | |
| `settings.updated` | `{ settings: CompanionSettings }` | |
| `reminder.changed` | `{ reminder: Reminder }` | |
| `resync_required` | `{}` | 只发给本连接 |
| `bye` | `{}` | 后台正常退出前推送 |

- 交互接口同步返回的 utterance 也会通过 SSE 推送一次，客户端按 `id` 去重。

## 7. 伙伴行为约定（B 实现；数值、文案、阈值以产品稿为准）

后台负责“发不发、何时发、发几条”，客户端负责“怎么显示”。分工如下：

| 规则 | 归属 | 产品稿 |
|---|---|---|
| activity 计算、短暂表情（≤ 8 秒） | 后台 | §3 |
| 通知 → 气泡、tone → 动作、低优先附在下次回应后 | 后台 | §5、§6 |
| 每日主动气泡上限、安静期间排队及结束后合并、忽略后 24 小时不弹、`utterance_dismissed` 后不再弹、暂停到期只重弹一次 | 后台 | §5、§6、§9 |
| 交互台词节流（摸头每 10 分钟、戳 30 秒、拖起 30 秒） | 后台 | §4 |
| 台词模板选择（性格标签、禁忌过滤、口头禅、emoji） | 后台 | §11 |
| 成长：陪伴天数、默契（每天上限 20）、解锁、里程碑通知 | 后台 | §10 |
| 下班提醒、早上第一次互动、离线恢复台词 | 后台；“离线进入”那句由客户端本地给出 | §11 |
| 同时最多 1 个气泡；队列超过 2 条时合并为“有 N 条新通知”；自动收起计时；展开方向 | 客户端 | §5 |
| 自娱调度、打盹、眨眼、看鼠标 | 客户端，不上报，不调用模型（I34） | §3 |
| 手势识别（单击、双击、摸头、戳、拖拽） | 客户端，识别后上报 `PetInteraction`；宠物本体左键不打开或切换面板，功能入口由右键菜单显式选择 | §4 |

- **activity 优先级**：quiet（任一来源）> waiting_auth（先行版恒为 0）> alert（有未读且未暂停、urgency ≥ normal 的通知）> 短暂表情（happy/caring/concerned）> sleeping（下班后 10 分钟没有交互；设置项 `sleepAfterWork`）> idle。
  - 记忆重建索引期间，activity 为 working，并带上 `PetState.progress`。
  - 客户端自己判断 offline。
- **气泡内容**：
  - `text` 只来自模板，只能引用 `{addressUser}` 等占位符和事实占位；
  - `title`、`facts` 放进 `PetUtterance.facts`，结构化后原样复制（I15）；
  - `ref.noticeId` 指向通知；
  - `quickActions` 使用 `open:'notice'` 和 `notice:{op}`。
- **敏感度**：
  - secret 通知不冒气泡，角标照常计数；通知中心只显示“一条机密通知”，用户点击后才显示标题。
  - confidential 由设置项 `discloseConfidentialInBubble`（默认 false）控制：关闭时，气泡里只显示“有一条敏感通知”，不显示 title 和 facts。
  - 台词继承通知的敏感度。
- **去重（ADR-0020）**：普通通知同一个 dedupeKey 已有未读、暂停或 24 小时内忽略的记录时就地更新（count+1），不冒新气泡；合并保留完整依据引用及历史/输入/记忆依据的最高敏感度，facts 原样使用本次输入。companion.reminder 使用持久单次投递键 reminder:<id>，首次通知和无正文 rt_notice_receipts 回执同事务；重试不加 count、不发布通知或触发气泡钩子。
- **保留**：通知正文保留 30 天，投递回执不随正文清理。清理后的提醒重试只返回原 id 的无正文过期摘要，不新建通知；整库丢失不保证跨故障幂等。
- **取消提醒**：扫描器在投递前及返回后检查 scheduled，条件更新必须核验 changes。投递中取消后清理新通知、持久事件原话；不发送 fired 或携原话的取消状态，客户端清除对应队列、气泡 DOM 和关联卡片。
- **勿扰退出事件顺序**：先推送非 quiet 的 pet.state，再推送安静期合并 utterance，避免客户端按旧 quiet 状态丢弃补报。手动解除与到期路径一致。
- **通知凭证边界**：持久化前检查所有可控字符串，包括正文、facts、dedupeKey、links、evidence 与行为方元数据；疑似凭证拒绝且不写库/发布事件/钩子。生成的机器 id 仅在对应元数据字段且验证所有权后豁免，不豁免自由文本。
- **开发测试通知**：只接受 `kind` 以 `dev.` 开头的通知，`settings.acceptDevNotices` 为 false 时返回 422。根目录脚本 `npm run notify -- --title … --fact 评审中=3:个 --tone … --urgency … --why … --next-step … --dedupe …` 读取 `daemon.json` 和凭证库令牌后调用 `POST /notices`。
- **日记**：只记计数（产品稿 §7）。
  - B 在 `comp_` 表里累加当天的计数；在日期切换后第一次活动时，或后台退出时（注明“截至 HH:mm”），通过 `appendJournal` 写入一行，origin 为 `companion`，sensitivity 为 normal。
  - 日记中**禁止**出现窗口、应用、通知正文和 facts、记忆原文、聊天原文。
- **人格**：
  - 按 contracts §10.1 读写 `persona.md`（YAML 头 + Markdown 正文），写入采用原子替换。
  - `PersonaView.firstRun` 在 `persona.md` 不存在时为 true。选“先用默认”也要 PUT 一次默认值。
  - 只有用户能修改人格（I13），并写审计 `config`。
  - 后台校验上限：

    | 字段 | 上限 |
    |---|---|
    | `name` | 1–8 字 |
    | `addressUser` | 1–6 字 |
    | `traits` | ≤ 6 项，每项 ≤ 6 字 |
    | `catchphrases` | ≤ 3 项，每项 ≤ 12 字 |
    | `taboos` | ≤ 5 项，每项 ≤ 20 字 |
    | `description` | ≤ 2000 字 |

  - `skin` 先行版固定为 `tuanzi-default`。

## 8. 模块注入接口

### 8.1 平台（B 提供）

使用 contracts §1.1 的 `StorageService`、`SecretStore`、`Logger`、`AuditWriter`，存储基于 `node:sqlite` 的 `DatabaseSync`，数据库文件为 `<data>/work-agent.db`。

- `registerMigrations` 校验表前缀：迁移 SQL 里创建的表名必须以本模块登记的前缀开头。
- 每个迁移只执行一次，并记录版本号和校验和。

### 8.2 通知（B 提供）

```ts
interface NoticeSink { submit(notice: Notice, from: Actor): Promise<NoticeRecord> }
```

`CapabilityContext.notify` 以后就是对 `submit` 的薄封装。B 负责校验字段：

| 字段 | 约束 |
|---|---|
| `title` | ≤ 80 字 |
| `facts` | ≤ 8 条 |
| `body` | ≤ 2000 字 |
| `dedupeKey` | ≤ 200 字 |

### 8.3 用户证据（B 提供给 C）

```ts
interface UserEvidenceVerifier {
  verify(evidenceId: string, type: 'message' | 'decision' | 'local_edit'): boolean;
}
```

- B 在 `ui_user_evidence` 表里登记证据。类型对应关系：
  - 聊天消息记为 `message`；
  - 记忆面板和设置面板里的增删改记为 `local_edit`；
  - 先行版没有 `decision` 类型的证据。
- 证据 id 用 `ev_<ulid>`，有效期 10 分钟。

### 8.4 记忆模块（C 提供）

```ts
function createMemoryModule(deps: MemoryModuleDeps): MemoryModule;
interface MemoryModule extends MemoryReader, MemoryWriter, MemoryBrowser {
  start(): void;                              // 建索引、扫描手改，对比文件和索引
  stop(): void;
}
```

`MemoryModuleDeps`、`MemoryBrowser`、`MemoryChange` 的定义见 `src/contracts/memory.ts`。

**规则**：
- `rule` 必须带 `user` 来源，并且通过 `verify(evidenceId, evidenceType)`，否则抛出 `MemoryError('rejected')`。
- `update` 和 `forget` 在 `by.kind === 'user'` 时需要证据。`forget` 新增可选参数 `evidenceId`；先行版运行时要求用户必须提供。
- `remember` 的文本归一化后（去首尾空白、合并空白、转小写），如果哈希命中墓碑，并且来源不是 `user`，抛出 `MemoryError('tombstoned')`。用户本人重新记住同一条内容是允许的，墓碑随即作废。
- 先行版对 `validUntil` 已过期的条目，在检索和 `profile` 中默认过滤掉；`list` 可以通过 `includeExpired` 查看。
- 审计用 `kind:'memory'`，只记 id、层、动作和行为方，不记正文。
- 每次变更调用 `deps.onChange(change)`，由 B 转成 `memory.changed` 事件。遇到无法识别的行或文件，发出 `change:'issue'`，带上 file 和 line，不带正文；B 据此生成 `memory.reindex_issue` 通知（low 级）。
- `remember` 和 `update` 遇到疑似凭证的文本，抛出 `MemoryError('rejected')`：
  - 包含“密码 / token / 密钥 / sk-”；
  - 或者有连续 20 位以上的字母数字串。
- 文本长度 2–200 字。
- 记忆模块通过 `deps.progress` 汇报重建索引的进度，用于团子的 working 动作。

### 8.5 记忆文件格式

| 层 | 文件 | 说明 |
|---|---|---|
| profile | `<data>/companion/user.md` | 用户画像，以 rule 和 fact 为主 |
| long_term | `<data>/companion/memory.md` | |
| journal | `<data>/companion/journal/YYYY-MM-DD.md` | 按本地日期 |

每个条目占一行：

```markdown
- 周五下午不排会 <!-- wa:id=mem_01J…;kind=rule;origin=user:local_edit:ev_01J…;sens=normal;created=1763520000000;until=1763900000000 -->
```

- **文件头**：一级标题加一段说明，告诉用户可以直接编辑。条目之外的行原样保留。
- **origin 编码**：
  - `user:<evidenceType>:<evidenceId>`；
  - `companion`：完整依据保存在不可丢弃的来源账本；
  - `consolidation:<runId>`；
  - `external:<entityId,...>`。
- **手改**：
  - 启动时和每次写入前，比较文件哈希与索引记录。不一致就先重新解析，再在最新内容上应用本次修改（不覆盖用户手改）。
  - 用户手写的、没有标记的 `- ` 行，导入为 `fact`，来源是 `user:local_edit:memfile:<sha8>`，并补写标记。
  - 手写的行只能成为 fact。要变成 rule，需要用户在面板里改 kind；这算一次带证据的用户编辑，产品稿负责提示。
  - 用户删除了带标记的行，视为本机删除，写墓碑。
  - 同一行文本被改动，按 id 更新。
- **原子写入**：先写临时文件，再 rename；写前保留 `.bak`，只保留一份。
- **可重建索引**：`mem_items`（id、layer、kind、text、origin_json、sens、created、until、file、line）、`mem_fts`（trigram）、`mem_files`（path、sha256）。这三张表可以清空后重建。
- **持久安全元数据（ADR-0019，Q14 技术裁决）**：`mem_provenance`（id、layer、kind、完整 origin_json、about_json、归一化文本 hash、file）与 `mem_tombstones`（hash、id、at、by_kind）不能作为缓存丢弃。来源标记与账本一致时恢复依据/about；规则还须匹配既有已认证规则记录或通过当前有效用户证据，不能相信自报标记。
- **重建与删除**：账本参与判断已接纳条目的手改/删行/整文件删除，即使索引已清空也要建立墓碑和清理来源元数据；未改变的重复用户项不能因重建清除墓碑。缺失账本与无法恢复依据/规则时报告 issue，不捏造空依据。普通写入时来源元数据与索引、墓碑同事务更新；用新迁移版本从已有合法索引补账本，不改写旧迁移。
- **恢复范围**：删除整个数据库或两张安全元数据表不是索引重建，先行版不承诺从只有 Markdown 的副本自动恢复全部来源、规则批准或遗忘状态；历史数据库恢复不能自行绕过墓碑。

## 9. 客户端约定（A）

- **窗口**：
  - 宠物窗口透明、无边框、置顶、不显示在任务栏，跨所有桌面空间可见。
  - 点击穿透（ADR-0021）：原生层约 60ms 轮询光标，仅命中有限且有界的身体/气泡区域才接收鼠标；初次显示前先穿透，外部开始的按键序列整个保持穿透。几何必须在可用显示区域内，焦点/拖动/多屏/DPI 的真实 OS 竞态未验。
  - 原生锁边界：CursorState 和 HitState 仅在纯状态更新或命中计算期间持锁；窗口 getter/setter、平台查询、事件发送和主线程调度必须在释放 guard 后执行。Tauri 后台线程的窗口 getter 会同步等主线程回包，持应用锁等待会与显示气泡等主线程命令形成死锁；不能用删穿透、超时重试或放宽权限替代锁范围修正。
  - 气泡滚动边界：外框裁剪装饰箭头，不让装饰触发横向或纵向滚动条；正文/事实/快捷按钮放入独立的纵向滚动区，长内容仍可访问。关闭按钮固定在外框，原生气泡的页面本身不滚动；不通过整块隐藏长内容来消除滚动条。
  - 鼠标入口：宠物本体左键单击/双击仅给出本地轻戳/开心回应，不打开或切换通知、聊天或设置面板；养成手势协议不变。功能由右键菜单显式选择，菜单选项和气泡按钮仍正常点击。低优先通知留在角标/通知中心，不借单击、摸头或连戳的回应投递；正常/高优先通知和勿扰汇总规则不变。
- **拖动与自由停放**：
  - 拖动用 `startDragging`；放下后只读取并按屏幕保存松手位置，不再执行 setPosition 或查询外部窗口。取消首次见面自动落窗、无保存位置时贴边初始化及定时窗口跟随；启动仍可恢复用户保存的位置。外部窗口移动/关闭不改变宠物位置。
  - 保留既有平台窗口查询接口与公共 `WindowAnchor` 合同，不由当前客户端调用；不读取标题和内容，不截图（I34）。
  - Windows 窗口查询仍返回 `unsupported`，不因此重新定位到桌面边缘。
- **面板**：第二个窗口，按需创建，包含通知中心、记忆、设定（人格、音频、安静、敏感度披露、睡眠时段）和聊天。
- **网络**：所有请求都附带内存中的令牌。SSE 断开后按 retry 重连，带上 Last-Event-ID；hello/resync_required 后重新拉取快照。
- **重同步后的记忆显示**：每次成功快照使各窗口旧的记忆关联聊天输入/卡片失效，包括关闭面板后仍保留的节点，并提示重新查询；可见记忆页重新拉取。关联来源包含 memory chunk 和卡片 items/actions，不以有数量上限的列表缺席判定遗忘。未删除记忆也可能需要重查，这是显示失效而非修改持久化记忆。不清无关联的已完成聊天/提醒，不扩大到不含记忆原文的气泡。重同步使用代次屏障丢弃之前发起的迟到聊天显示回填，并清理尚未获知关联的待回复输入；后台已执行的操作不因此撤销，不自动重试，提示先查看记忆或提醒结果。此修改不新增接口或更改 SSE 协议。
- **原生权限与唤醒（ADR-0021）**：自定义命令在 AppManifest 显式登记并默认拒绝，capabilities 按 pet/panel/bubble 最小授权，不用 core:default 或通用 shell/fs。Node24 的绝对可信路径在构建时确定、运行时复核，不按 PATH 重新选进程；子进程清空环境后仅给必要非凭证字段和明确配置，原始 stdout/stderr 不直接持久化。相对数据目录按仓库根解析，设置/日志拒绝符号链接，唯一独占临时文件/0600/同步/rename。macOS 原生系统命令用绝对路径，Windows 凭证继续 unsupported；不表示修改系统或 Qoder 权限。
- **音频**：默认关闭。用户启用后，用本机 WebAudio 生成一段原创的轻音乐循环，不加载外部资源。quiet 时立刻停止。
- **皮肤**：内置 `tuanzi-default`，符合 `SkinManifest`。素材是分层 SVG 加 CSS 动画；动作 id 以产品稿为准，缺失时按 `semanticMap` 降级。
- **本机玩法（产品稿 §14）**：客户端内存状态驱动互动连招、抛接球和纸箱，最长30秒；短单击由本体处理，拖动/结束/勿扰/隐藏/办公事项可打断，不重播。开启仅发送一次现有 `{kind:'play',activityId}`，抛接球为 play_ball、纸箱为新增白名单 box_peek；逐帧和接球/漏接不发送事件，不扩大 PetActivity、HTTP 结构、命中区域、原生命令/ACL 或持久化设置。提示用纯文本并遵守字面禁忌，不经气泡、不占主动额度。开始保留等待队列，通知出队显示时中断玩法；跨30秒退出的按下/松开不转成普通互动请求。本机拥有的连招/玩法动画被替换或收尾后，后台同名互动表情和台词不重新驱动旧动作。
- **离线**：显示睡着的团子和“唤醒”按钮；办公入口标明“离线”。

## 10. 测试与验收门槛

- **B**：
  - 认证：返回 401、403，Origin 白名单生效，OPTIONS 预检正确；
  - 端口：被占用时能漂移；单实例锁有效；
  - SSE：重放和 `resync_required` 正确；
  - 通知：去重、忽略 24 小时、暂停到期、quiet 排队与合并都正确；
  - facts 原样保留，secret 和 confidential 按规则过滤；
  - 人格字段校验正确，`firstRun` 正确；
  - 凭证写入不出现在 argv（检查 spawn 参数）；
  - 日志不含正文。
- **C**：
  - remember、update、forget 正常；疑似凭证的文本被拒绝；无法识别的行报告为 `issue`；墓碑能阻止非用户来源重生；
  - rule 缺少证据时被拒绝；
  - 手写行能导入，手改不被覆盖，删行写墓碑；
  - 原子写入有效；索引可重建；FTS 检索正常；
  - `validUntil` 过滤正确。
- **A**：
  - 前端单元测试覆盖：状态到动作的映射、气泡 facts 原样渲染、SSE 解析与去重、命中区域计算；
  - 无头 Playwright 跑通前端页面（用模拟后台）；
  - `cargo build` 通过。
- **总架构师联调**：真实启动后台和客户端，用 `npm run notify` 投递通知，走通冒气泡、稍后、忽略、记住、忘掉、改名、安静、音频；然后按 invariants 逐条做代码评审，结论写入 `docs/reviews/`。
