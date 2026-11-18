# 开发与参数参考

核对日期：2026-11-17。本文覆盖当前 TypeScript 工程的运行、架构、完整外部参数及视听系统；玩家规则和数值见 [游戏设定与玩法](GAMEPLAY.md)。

## 目录

1. [工程来源与运行](#1-工程来源与运行)
2. [文件与模块导航](#2-文件与模块导航)
3. [初始化主循环类型与事件](#3-初始化主循环类型与事件)
4. [完整 URL 参数](#4-完整-url-参数)
5. [展示模式与性能测试](#5-展示模式与性能测试)
6. [画质预设与渲染](#6-画质预设与渲染)
7. [程序化资产与物理](#7-程序化资产与物理)
8. [特效与音频](#8-特效与音频)
9. [开发调试入口](#9-开发调试入口)
10. [还原验证与已知限制](#10-还原验证与已知限制)
11. [修改位置速查](#11-修改位置速查)
12. [本地用户数据](#12-本地用户数据indexeddb)
13. [局域网联机服务](#13-局域网联机服务)

## 1. 工程来源与运行

### 来源与版本

- 原始单文件：[3a.html](3a.html)，包含 UI/CSS、游戏代码和打包的 Three.js；原样保留在项目根目录，仅供逆向与参数对照，不参与当前 Vite 默认构建。
- 早期 JavaScript 拆分工程已于 2026-11-18 核对迁移完整性后清理，后续只维护当前 TypeScript 工程。
- 当前工程：`3a-vite-ts`，使用模块化 TypeScript，不是仅给单个 JS 文件改后缀。
- 拆分原则：从原文件寻找参数，保留游戏算法、默认值、UI 文案、桌面和移动端行为；类型调整不主动改变玩法。

| 项目 | 声明 / 当前锁定 |
| --- | --- |
| 包管理器 | pnpm 12.4.2，packageManager 字段固定 |
| three | 0.180.0 |
| @types/three | 0.180.0 |
| TypeScript | 声明 ~5.9.0，锁定 5.9.3 |
| Vite | 声明 ^7.1.0，锁定 7.3.8 |
| 本次验证环境 | macOS arm64，Node.js 24.22.1 |
| 构建目标 | ES2022 |

Node.js 24.22.1 是本次实际验证版本，不是对所有更低版本的兼容承诺。依赖实际版本以 [pnpm-lock.yaml](pnpm-lock.yaml#L165) 为准。

### pnpm 命令

在当前项目目录执行：

```bash
pnpm install --frozen-lockfile
pnpm dev
pnpm typecheck
pnpm build
pnpm preview
pnpm lan
pnpm server
pnpm dev:server
```

- `dev`：Vite 开发服务，地址以终端输出为准。
- `typecheck`：依次检查浏览器源码（`tsc --noEmit`）、Vite 配置（`tsconfig.node.json`）和联机服务（`server/tsconfig.json`）。
- `build`：先执行完整 `typecheck`，再 `vite build`。
- `preview`：预览已存在的生产产物，不代替生产构建。
- `lan`（新增）：`pnpm build` 后运行 `pnpm server`，一个进程同时提供 `dist/` 页面与 `/ws` 联机。
- `server`（新增）：`node server/index.ts`，直接运行 TypeScript；要求 Node.js ≥ 22.18（package.json `engines`）。
- `dev:server`（新增）：同上，带 `--watch`，修改服务端源码后自动重启。

联机细节见 [§13](#13-局域网联机服务)。

固定开发/预览端口：

```bash
pnpm dev --port 5181 --strictPort
pnpm preview --port 5182 --strictPort
```

Vite server 和 preview 均配置 `host: true`，会允许网络接口访问，具体地址看终端。不是只绑定本机 loopback；局域网试机时仍需设备可达、防火墙放行并考虑信任范围。

### 安装脚本与锁文件

- 使用 pnpm 锁文件，不再保留 npm 的 package-lock.json。
- [pnpm-workspace.yaml](pnpm-workspace.yaml#L1) 仅包含对 `esbuild` 构建脚本的明确授权。
- pnpm 12 对未授权依赖脚本会报错，当前 esbuild 安装脚本已通过；不要用全局允许所有脚本或忽略错误来掩盖问题。
- 新增有构建脚本的依赖时应单独审查、授权并保存相应配置。
- 锁文件继承原安装环境的包解析结果。换环境遇到注册源/认证错误时，应诊断依赖来源和自己的访问权限，不把凭据写入代码或文档。
- `--frozen-lockfile` 要求声明与锁文件一致；主动调整依赖后应正常重新生成 pnpm 锁文件，再验证冻结安装。

### 生产交付

`pnpm build` 输出 `dist/`。`base: './'` 使用相对资源地址，适合静态资源目录部署。产物必须由 HTTP 静态服务提供；直接 `file://` 打开不能替代模块、资源及浏览器能力的正常运行。

当前有 IndexedDB 本地用户数据库和新增的局域网联机服务（`server/`）；没有云部署配置、公网服务或账号系统。联机服务只读取 `PORT`、`HOST` 两个环境变量，Vite 代理只读取 `LAN_PORT`。新增功能不改变原始战斗规则，也不发布网站。纯静态部署 `dist/` 时单人游戏正常，联机面板会提示连接失败。

源码：[package.json](package.json#L4)、[Vite 配置](vite.config.ts#L1)、[TS 配置](tsconfig.json#L1)、[Node 侧 TS 配置](tsconfig.node.json#L1)。

## 2. 文件与模块导航

### 根目录

| 文件 / 目录 | 用途 |
| --- | --- |
| [index.html](index.html#L1) | canvas、UI、启动进度容器与 TS 模块入口 |
| [package.json](package.json#L1) | pnpm 版本、依赖及脚本 |
| [pnpm-lock.yaml](pnpm-lock.yaml#L1) | 应用及包管理器的依赖解析与完整性锁定 |
| [pnpm-workspace.yaml](pnpm-workspace.yaml#L1) | 当前依赖脚本授权 |
| [tsconfig.json](tsconfig.json#L1) | 浏览器源码（仅 `src/`）的 TypeScript 检查与模块规则 |
| [tsconfig.node.json](tsconfig.node.json#L1) | `vite.config.ts` 的 Node 类型检查；与浏览器配置分开，避免 Node 定时器类型污染 `src/` |
| [server/](server/index.ts#L1) | 新增：局域网联机服务（HTTP 静态页面 + WebSocket 房间），见 [§13](#13-局域网联机服务) |
| [vite.config.ts](vite.config.ts#L1) | 开发、预览与生产打包 |
| [src/main.ts](src/main.ts#L1) | 加载 CSS、调用 boot、显示顶层致命错误 |
| src/ | 所有拆分的 TS 与 UI 样式 |
| dist/ | 自动生成的生产结果，不应直接修改 |
| node_modules/ | pnpm 安装结果，不是可维护源码 |
| [README.md](README.md) | 文档入口 |
| [GAMEPLAY.md](GAMEPLAY.md) | 设定与玩法手册 |
| DEVELOPMENT.md | 本开发参考 |

### src 模块

| 模块 | 主要文件 | 责任 |
| --- | --- | --- |
| app | [boot.ts](src/app/boot.ts#L50)、[diagnostics.ts](src/app/diagnostics.ts#L1)、[showcase.ts](src/app/showcase.ts#L1)、[bench.ts](src/app/bench.ts#L1)、[stubs.ts](src/app/stubs.ts#L1) | 初始化编排、诊断、展示、性能巡检、局部降级 |
| config | [world.ts](src/config/world.ts#L4)、[quality.ts](src/config/quality.ts#L20)、[settings.ts](src/config/settings.ts#L15) | 世界/光照/尺寸、画质、设置默认值/校验及旧设置迁移 |
| data | [user-data.ts](src/data/user-data.ts#L1) | 本地玩家、IndexedDB 设置与战绩、事务与状态通知 |
| net（新增） | [index.ts](src/net/index.ts#L54)、[avatars.ts](src/net/avatars.ts#L412)、[lobby.ts](src/net/lobby.ts#L74) | 协议 v2 连接、房主/准备与全队倒计时、关节士兵动作及插值、联机面板、标题/暂停房间条与 HUD 房主徽标 |
| types | [context.ts](src/types/context.ts#L60)、[globals.d.ts](src/types/globals.d.ts#L4)、[three.ts](src/types/three.ts#L1) | 共享上下文、子系统返回类型、浏览器调试钩子与 Three 类型 |
| utils | [math.ts](src/utils/math.ts#L1)、[rng.ts](src/utils/rng.ts#L1)、[events.ts](src/utils/events.ts#L1)、[dom.ts](src/utils/dom.ts#L1)、[geometry.ts](src/utils/geometry.ts#L1)、[buffer-geometry-utils.ts](src/utils/buffer-geometry-utils.ts#L1) | 数学、可复现随机、事件、DOM、几何与合并 |
| input | [index.ts](src/input/index.ts#L4) | 键鼠、指针锁、触屏、手柄与帧输入合成 |
| ui | [menus.ts](src/ui/menus.ts#L34) | 标题、暂停、死亡、结算、设置、玩家档案、介绍与操作面板 |
| hud | [index.ts](src/hud/index.ts#L20) | 任务、目标、交互、生命弹药、命中、广播与消息 |
| styles | [ui.css](src/styles/ui.css#L1) | 菜单/HUD/触屏控件、响应式与 safe-area |
| game | [index.ts](src/game/index.ts#L9) | 状态机、中继、撤离、增援、死亡重试与评分 |
| player | [index.ts](src/player/index.ts#L7) | 第一人称移动、碰撞、生命与镜头 |
| weapon | [index.ts](src/weapon/index.ts#L33)、[geometry.ts](src/weapon/geometry.ts#L1)、[model.ts](src/weapon/model.ts#L1)、[shader.ts](src/weapon/shader.ts#L1) | 步枪参数、造型、姿态、手部与换弹动画、湿润 shader |
| combat | [index.ts](src/combat/index.ts#L5) | 玩家/敌方射线、爆炸及战斗统计 |
| enemies | [index.ts](src/enemies/index.ts#L24)、[gull.ts](src/enemies/gull.ts#L6)、[hound.ts](src/enemies/hound.ts#L6)、[models.ts](src/enemies/models.ts#L1)、[rig.ts](src/enemies/rig.ts#L1) | 敌人导演、AI、命中体、骨骼、IK、飞弹与残骸池 |
| physics | [index.ts](src/physics/index.ts#L7) | 碰撞体、胶囊移动、射线/视线、二维导航 |
| level | [index.ts](src/level/index.ts#L170)、[yard.ts](src/level/yard.ts#L1)、[warehouse.ts](src/level/warehouse.ts#L1)、[quay.ts](src/level/quay.ts#L1)、[static-builder.ts](src/level/static-builder.ts#L1)、[text-batch.ts](src/level/text-batch.ts#L1) | 港区布局、任务坐标、出生点、静态合并、标识批处理 |
| props | [registry.ts](src/props/registry.ts#L6)、[catalog.ts](src/props/catalog.ts#L1)、[infrastructure.ts](src/props/infrastructure.ts#L1)、[machinery.ts](src/props/machinery.ts#L1)、[clutter.ts](src/props/clutter.ts#L1)、[soft-goods.ts](src/props/soft-goods.ts#L1)、[kit.ts](src/props/kit.ts#L1)、[clutter-kit.ts](src/props/clutter-kit.ts#L1) | 道具注册、工业设施、机械、杂物和软物体建模 |
| backdrop | [index.ts](src/backdrop/index.ts#L1)、[cranes.ts](src/backdrop/cranes.ts#L1)、[vessels.ts](src/backdrop/vessels.ts#L1)、[kit.ts](src/backdrop/kit.ts#L1) | 起重机、船/艇、远景和对应造型工具 |
| ground | [index.ts](src/ground/index.ts#L1)、[apron.ts](src/ground/apron.ts#L1)、[sea.ts](src/ground/sea.ts#L1)、[rain.ts](src/ground/rain.ts#L1)、[textures.ts](src/ground/textures.ts#L1)、[noise.ts](src/ground/noise.ts#L1) | 港区地面、积水、海面、雨、反射与纹理 |
| materials | [index.ts](src/materials/index.ts#L1)、[library.ts](src/materials/library.ts#L15)、[surfaces.ts](src/materials/surfaces.ts#L1)、[bake.ts](src/materials/bake.ts#L1)、[canvas.ts](src/materials/canvas.ts#L1) | 表面定义、GPU 烘焙、贴花、Canvas 标识与缓存 |
| render | [index.ts](src/render/index.ts#L53)、[post.ts](src/render/post.ts#L1)、[shadows.ts](src/render/shadows.ts#L1)、[sky.ts](src/render/sky.ts#L1)、[noise.ts](src/render/noise.ts#L1) | WebGL、相机、天空/环境、阴影、后处理、动态分辨率 |
| fx | [index.ts](src/fx/index.ts#L1)、[systems.ts](src/fx/systems.ts#L1)、[atlases.ts](src/fx/atlases.ts#L1) | 命中特效、烟雾爆炸、曳光、弹壳、粒子池和图集 |
| audio | [index.ts](src/audio/index.ts#L1)、[bank.ts](src/audio/bank.ts#L1)、[dsp.ts](src/audio/dsp.ts#L1)、[music.ts](src/audio/music.ts#L1)、[sfx.ts](src/audio/sfx.ts#L1) | 音频引擎、运行时采样生成、DSP、音乐与音效 |

源码文件保留原算法并进行类型化，很多局部变量仍是逆向来源中的短名称；“模块化”不表示全部内部符号已重新语义命名。

## 3. 初始化、主循环、类型与事件

### 正常初始化顺序

```text
main.ts → boot()
URL 参数 / 本地用户数据加载或首次迁移 / 随机源 / 事件总线 / 自动画质
render → materials
physics / props / input
level → backdrop → ground → physics.build()
fx → audio → player → combat → weapon → enemies → hud
net（新增；showcase / bench / 非空 shot 时不创建）→ game
render.onLevelReady() → 启动 setAnimationLoop
```

使用静态 ES module import；初始化工厂可以异步，但没有动态 import 下载子系统的分包流程。

`render` 与 `level` 是必需步骤，失败会抛出致命错误。可降级模块初始化异常时采用对应 stub，例如音频静音、FX 空操作。stub 的目标是局部故障时继续运行，不表示全部功能仍完整。ground 失败还有备用地面。循环中各系统 update 的首个异常会记录，避免重复刷屏；这也不代表异常已经自动修好。

展示模式改用 stand-in 玩家和输入、stub HUD/音频，选择展示函数生成相应场景，不等于进入正常关卡。

### 每帧更新

1. 从真实时钟计算帧秒数；普通模拟 dt 为 `min(真实 dt, 0.05)`，非空 `dt` 参数可直接替换。
2. 更新共享 `time.dt / t / frame / real`。
3. `input.update`，再 `game.update`。
4. 正常游戏允许时更新 `player → weapon → enemies`；展示模式执行展示回调。
5. 判断首个仓库室内盒，逐渐把武器湿润值向室内 0.3 / 室外 1 调整。
6. 非暂停时更新 `fx → ground → level → backdrop → mats`。
7. 音频与 HUD 持续更新；随后更新新增的 `net`（发送本机状态、插值队友模型）。
8. 应用冻结相机；bench 如启用会再接管相机。
9. 渲染，帧末清 look/pressed，累计自动化帧数；第二帧设置 ready。

任务用时与 `time.t` 不同：前者只在 playing 累积，后者按主循环 dt 累积。bench 使用真实帧时，不被固定模拟 dt 改成确定性时间。

### 共享类型与事件

- `GameContext` 包含 Three、params、events、rng、time、quality、scene、camera、userData 和全部子系统。
- 子系统类型主要用 `ReturnType` / `Awaited<ReturnType>` 从工厂推导，避免重复抄接口。
- 使用 `strict: true`、ES2022、bundler resolution、isolatedModules、verbatimModuleSyntax、noEmit。
- 某些几何/骨骼类型使用 `declare` 字段，类型声明不新增运行时实例字段。
- 当前仍有显式 `any`、注册表动态访问、非空断言及双重断言，不是零 any 或完全强类型事件项目。
- 事件总线同步调用 handler，逐 handler 捕获异常，on 返回 unsubscribe；事件名和 payload 没有统一泛型 schema。

主要事件包括 `game:state`、`input:lock`、`player:hit/dead/jump/land/step/rescued`、`weapon:fire/reload/dry`、`player:hitEnemy`、`enemy:alert/killed/melee`、`impact`、`objective:progress/done/all`、`extraction:reached`、`radio:line`。事件存在与正常发出不是一回事，例如音频订阅 `weapon:melee` 不说明已实现玩家近战。

目前没有应用级统一 destroy、停止所有 animationLoop 或清理全部 DOM 监听器入口；只有局部 GPU dispose/音频 loop.stop。若嵌入会反复挂载的应用，需要另行设计生命周期，不应宣称已可无泄漏重复挂载。

源码：[boot 与主循环](src/app/boot.ts#L50)、[共享类型](src/types/context.ts#L60)、[事件总线](src/utils/events.ts#L1)。

## 4. 完整 URL 参数

以下 37 个 query key 来自原实现模块的实际消费；另有 1 个新增联机参数见 [4.7](#47-新增联机服务地址1-项)。示例使用相对路径，如 `/?q=low`，可接在你正在使用的开发或生产地址之后；不是另一个网站。

### 解析规则，先看这一段

- 使用 `Object.fromEntries(new URLSearchParams(location.search))`；同名 key 重复时最后一个值胜出。
- 没有统一布尔/数字验证器。很多开关使用字符串 truthiness。
- 下表中的 **T** 表示非空字符串为真：`?noaudio=1` 启用，裸 `?noaudio` 或 `?noaudio=` 不启用；`?noaudio=0`、`?noaudio=false` 反而启用。
- “仅等于 0/1”表示严格比对字符串，不能套用 T 的理解。
- 数字常用 `+value`，并非所有参数都检查有限值或范围。相机、dt、预推进请传合理数值；极端值可能破坏展示或阻塞初始化。
- URL 不是稳定产品级配置 API；文档描述的是原实现行为，不替它补校验。

源码：[解析入口](src/app/boot.ts#L50)。

### 4.1 启动、相机与时间：12 项

| 参数 | 类型 / 默认 | 用途与限制 |
| --- | --- | --- |
| bench | T，默认关闭 | 或 hash 精确为 `#bench` 启用；强制 noaudio=1 和 autostart=1 |
| seed | 数字，默认 4207 | 主随机源，内部按 uint32 处理；改变地图/特效等主随机流，不等于敌人独立种子 |
| q | test/low/medium/high/ultra | 默认自动；无有效请求时按设备检测；无 q 且 shot 为 T 默认 test |
| shot | T，默认关闭 | 正常游戏自动开始且跳过 intro，快速曝光、禁用动态分辨率、每帧更新阴影，保护初始质量不被已保存质量覆盖；不冻结世界 |
| show | 九种展示名称，默认无 | 选择展示；未知名称回到正常游戏，但非空 show 仍让渲染快速曝光并禁用 dynres |
| cam | 逗号数字，默认无 | 前三数相机位置，后三 lookAt；后三缺省 `[0,1,0]`。固定相机，不固定整个模拟；无长度/有限值校验 |
| fov | 非空数字，默认无 | 固定相机视野并阻止玩家动态 FOV 接管；query 不受设置菜单 60–95 范围校验 |
| exposure | 非空数字，渲染默认 1 | 裸 query 不独立生效；须通过非空 cam 让 helper 接收整组参数，或 weapon 展示使用 helper |
| noaudio | T，默认关闭 | 音频 stub，无声音；并非关闭 HUD 字幕 |
| autostart | T，默认关闭 | 正常模式跳过开场进入 playing，无需菜单点击，但浏览器音频/指针锁仍受手势规则约束 |
| noweapon | T，默认关闭 | 启动后隐藏武器，非永久禁用；重新开始会再次显示 |
| dt | 非空数字，默认真实 dt 最多 0.05 | 每帧直接替换模拟 dt，替换后不再夹紧；不是实际 FPS 控制器 |

### 4.2 渲染与材质：9 项

| 参数 | 默认 / 比对 | 用途与限制 |
| --- | --- | --- |
| post | 开；仅 `post=0` 关闭 | 关闭高级后处理路径 |
| ao | 按画质；仅 `ao=0` 关闭 | SSAO；其他值沿用预设，不强制把 low 的 AO 打开 |
| vol | 按预设；仅 `vol=0` 关闭 | 体积光；其他值沿用预设 |
| bloom | 按画质；仅 `bloom=0` 关闭 | 泛光；其他值沿用预设 |
| mb | 按画质；仅 `mb=1` 强开 | `mb=0` 不能关闭 high/ultra 已默认开启的运动模糊 |
| dynres | 默认开；仅 `dynres=0` 关闭 | shot/show 或 forward 降级还会停用；不是固定输出分辨率开关 |
| tex | 非零数字，否则画质 tex/1024 | 材质烘焙基准；普通表面上限 1024、hero 可到 2048，不覆盖每一种地面纹理 |
| wet | 默认 1；存在即数字 | 空值为 0，修改材质湿润；不表示关闭雨，也不是武器室内湿润唯一入口 |
| only | mats 中默认全部 | 逗号分隔非空材质名称；`decals` 为特殊项，筛选时要显式列入才显示贴花；未知名称会走 fallback |

### 4.3 道具、远景、敌人展示：6 项

| 参数 | 默认 | 用途与限制 |
| --- | --- | --- |
| names | 全部道具 | props 展示逗号名称列表；未知名退化成盒体，不过滤空项 |
| bshow | 全部 | backdrop 专用：crane/ship/boat/sky；无值或非法展示全部。sky 是天际线，不是渲染天空替换 |
| eseed | 9001 | 敌人独立 RNG；正常游戏也使用，并非只展示使用 |
| eshow | both | enemies：both/gull/hound/fight/dead；非法按 both，fight 为 3 犬 2 鸥 |
| epre | 随 eshow | 预推进秒数，乘 60 后按整步模拟；存在即可数字，空为 0，见展示表 |
| efreeze | T，默认关闭 | 只冻结 enemies 展示的敌人 update，不冻结其他系统 |

### 4.4 武器展示：5 项

| 参数 | 默认 | 用途与限制 |
| --- | --- | --- |
| wpose | hip | hip/ads/sprint/fire/reload/empty；部件视图 side/right/top/hands/rhand/muzzle/optic/lower；非法按普通 hip |
| wlook | south | 第一人称背景朝向 south/east/north/west/nw，非法 south |
| wt | 按姿态 | 换弹动画时间，存在即数字；reload/empty 默认 0.62，部件视图须显式传入才设换弹进度 |
| wempty | T，默认关闭 | 仅部件视图且有 wt 时设空仓；第一人称是否空仓由 wpose=empty 决定 |
| wads | T，默认关闭 | 仅 wpose=fire 时附加 ADS |

### 4.5 特效：5 项

| 参数 | 默认 | 用途与限制 |
| --- | --- | --- |
| fxsoft | 开；仅 `fxsoft=0` 关闭 | 软粒子深度融合，还依赖有效世界深度与主世界相机 |
| fxshow | all | fx：all/impact/explosion/tracer；非法不会生成这三组预设效果 |
| fxhold | 无 | 仅 `fxhold=muzzle` 每帧持续枪口闪光，不按一般布尔解释 |
| fxsize | 非零数字或轮换 1/2/3 | fx 展示爆炸大小；不是玩家爆炸伤害参数 |
| fxt | 数字，默认 0 | 首次 update 按 1/30 秒预推进指定时间，无上限 |

### 4.6 不是 URL 参数的内容

- `fxage` 只由 FX 展示包装后的 `window.__setShot` 消费，不从 URL 自动消费。
- 没有 `mobile`、`touch`、`drag` 强制输入 query。
- 没有 `volume`、`sens`、`invertY` 的 URL 配置消费者；这些是保存设置。
- `wpose=fire` 的展示不等于正在正常任务中进行玩家攻击。
- `shot=1` 不会自动固定 Math.random、时钟、浏览器帧调度或 benchmark 数字，不能单独当像素确定性保证。

### 4.7 新增：联机服务地址：1 项

| 参数 | 类型 / 默认 | 用途与限制 |
| --- | --- | --- |
| `server` | 字符串；默认空 | 指定联机服务。可写 `192.168.1.8:4207` 或完整 `ws://…`/`wss://…`；未写路径时补 `/ws`。为空时使用当前页面同源的 `ws(s)://当前主机/ws`。无法解析时联机面板提示错误，单人游戏不受影响。 |

源码：[serverUrl](src/net/index.ts#L34)。

参数证据：[boot](src/app/boot.ts#L50)、[render](src/render/index.ts#L251)、[materials](src/materials/index.ts#L85)、[材质展示](src/materials/index.ts#L489)、[props](src/props/registry.ts#L87)、[backdrop](src/backdrop/index.ts#L197)、[enemies](src/enemies/index.ts#L710)、[weapon](src/weapon/index.ts#L1033)、[FX](src/fx/index.ts#L1986)、[soft particle](src/fx/systems.ts#L270)。

## 5. 展示模式与性能测试

### 九种 show

| 相对入口 | 展示内容 |
| --- | --- |
| `/?show=mats` | 材质球、测试平面、贴花与字体标识 |
| `/?show=level` | 完整港区静态布局 |
| `/?show=backdrop` | 起重机、货船、艇及天际线 |
| `/?show=ground` | 湿地、海面、雨、反射及测试对象 |
| `/?show=fx` | 命中、曳光、弹壳、枪口与爆炸粒子 |
| `/?show=weapon` | 步枪第一人称姿态或部件特写 |
| `/?show=enemies` | 飞鸥/猎犬模型、战斗与死亡表现 |
| `/?show=props` | 注册道具的排列展示 |
| `/?show=render` | 粗糙度/金属球、阴影、室内和后处理测试 |

展示模式不是关卡选择菜单，不提供正常玩家操作，采用固定相机和专门的系统占位对象。

### 可直接使用的例子

```text
/?q=low
/?autostart=1&noaudio=1
/?shot=1&seed=4207&eseed=9001&dt=0.016&noaudio=1
/?cam=-32,1.7,6,0,2,5&fov=74&exposure=1
/?show=backdrop&bshow=crane
/?show=props&names=container20,relay_node,forklift
/?show=mats&only=concrete,asphalt,decals
/?show=weapon&wpose=ads
/?show=weapon&wpose=empty&wt=1.8
/?show=weapon&wpose=side&wt=0.62&wempty=1
/?show=enemies&eshow=fight&epre=7&efreeze=1
/?show=fx&fxshow=explosion&fxsize=2&fxt=0.6
/?show=fx&fxhold=muzzle
/?bench=1&q=medium
/#bench
```

#### 敌人预推进默认值

| eshow | 默认预推进秒数 |
| --- | --- |
| both | 2.6 |
| gull | 1.2 |
| hound | 1.25 |
| fight | 7 |
| dead | 0.42 |

武器观察视角中 `hands/rhand/muzzle/optic/lower` 是模型部位取景，不是额外装备。`fxsize` 只改展示规模；它与死亡飞鸥的 gameplay 爆炸伤害不是同一配置。

### bench

只有一种自动飞行巡检，不是多个性能关卡：

- 入口 `bench=1` 或 hash 精确 `#bench`，自动开局且静音。
- 使用关卡 cinematicPath；缺少有效路径时使用 `[-32,1.7,6] → [10,1.7,6]` 的备用路径及对应 look 点。
- 30 秒循环，前 2 秒预热不纳入样本，最多保留 3000 帧。
- 约每秒更新平均、中位数、P99 帧毫秒、FPS、GPU、绘图缓冲分辨率、画质、DPR、渲染统计及错误。
- 禁用玩家控制，不是冻结任务和全部敌人。
- 飞行、采样与统计依赖真实帧时；即使 `dt` 固定，不同机器或两次运行的截图/数字也会不同。
- 关闭动态分辨率与固定同一画质后对比帧时更有解释性；不要只比较 FPS 而忽略缓冲分辨率、GPU 和降级状态。

源码：[showcase 注册](src/app/showcase.ts#L20)、[bench](src/app/bench.ts#L5)。

## 6. 画质预设与渲染

### 完整预设

`scale` 为内部渲染分辨率倍率，`shadow`/`tex` 为纹理尺寸配置，`planar` 为平面反射比例/启用配置，`rain` 为雨量预算系数，不是现实气象单位。

| 质量 | scale | MSAA | shadow | tex | volSteps | AO | planar | bloom | motionBlur | rain |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| test | 1 | 0 | 1024 | 256 | 10 | 开 | 0.5 | 开 | 关 | 0.4 |
| low | 0.7 | 0 | 2048 | 512 | 12 | 关 | 0 | 开 | 关 | 0.5 |
| medium | 0.85 | 2 | 2048 | 1024 | 16 | 开 | 0.5 | 开 | 关 | 0.8 |
| high | 1 | 4 | 4096 | 1024 | 24 | 开 | 0.5 | 开 | 开 | 1 |
| ultra | 1 | 4 | 4096 | 2048 | 40 | 开 | 1 | 开 | 开 | 1 |

test 是截图/调试预设，不等于最低质量，且不在普通设置按钮中。预设名称不能代替逐项数值。

### 自动检测与动态降级

- Android/iPhone/iPad/Mobile UA，或多点触控且屏幕短边小于 900，初始 low。
- 软件渲染、SwiftShader、llvmpipe、Mali、Adreno、PowerVR、非 Arc 的 Intel，初始 medium。
- 其余或无法读取 GPU 信息，初始 high。
- 在高级渲染路径且未被参数禁用时，动态分辨率会在 0.6 到 1 范围调节，还可能按 ultra → high → medium → low 降级。
- 同一个画质名称不保证每帧输出分辨率完全一致。

切换画质会重配阴影、MSAA、后处理与尺寸；不会重新创建所有材质/地面纹理和雨粒子初始预算。平面反射每 pass 读取 planar，能够跟随设置变化。画质切换不是整套资产重新烘焙。

### 相机与光照

- WebGLRenderer 不启用内建 antialias；高级路径使用 HalfFloat HDR 渲染目标及预设 MSAA。
- 世界 layer 0，基础相机 74°；武器 layer 1，viewmodel 相机 54°。
- 世界深度复制后绘制武器，并压缩武器 depthRange，降低武器穿模表现。
- 程序天空 + PMREM 环境光，太阳软阴影，首个仓库室内盒有局部环境探针。

| 世界光照项 | 配置 |
| --- | --- |
| 太阳方向 | 归一化 `(0.916, 0.225, 0.331)` |
| 太阳 RGB / 强度 | `(1, 0.72, 0.42)` / 9 |
| 天顶 RGB | `(0.055, 0.085, 0.13)` |
| 朝阳地平 RGB | `(0.95, 0.55, 0.28)` |
| 背阳地平 RGB | `(0.16, 0.22, 0.3)` |
| 雾 RGB | `(0.42, 0.47, 0.52)` |

### 后处理管线

自定义 shader 管线，不是直接使用 Three EffectComposer：

- 深度与双边滤波 SSAO；
- 体积太阳光和雾；
- 相机运动重投影、9 tap 运动模糊；
- 六级 bloom；
- 自动曝光与 ACES/AgX 调色；
- 色差、镜头污渍、颗粒、晕影、伤害/低血效果；
- FXAA 与锐化。

不能把所有 post 字段都当已启用功能；focusDist/shake/wet 等字段并非都被真正消费，不能据字段名宣称完整景深、额外镜头震动或后处理天气机制。

### 失败与兼容降级

- PCSS 软阴影失败可退 PCFSoftShadow。
- 后处理自测或高级渲染运行失败，会转 forward 路径；一旦转入不自动恢复高级路径。
- forward 继续绘制但画面效果和动态分辨率行为不同。
- WebGL/GPU 能力是必要边界；局部 fallback 不保证任意浏览器都具备完整效果。

源码：[画质](src/config/quality.ts#L20)、[检测](src/config/quality.ts#L87)、[渲染创建](src/render/index.ts#L53)、[质量切换](src/render/index.ts#L564)、[动态分辨率](src/render/index.ts#L627)、[后处理](src/render/post.ts#L1028)、[光照](src/config/world.ts#L11)。

## 7. 程序化资产与物理

### 资产生成

- 道具、建筑、敌人、步枪和手部主要由代码生成几何。
- 材质在 GPU 烘焙 albedo/ORM/height 与法线，结合缓存、mipmap、最多 8 的各向异性、宏观污渍、湿润和 triplanar。
- Canvas 用于贴花和工业文字标识；不依赖运行时外部美术素材服务器。
- 表面类别包含沥青、混凝土、砖、环氧、涂装、船壳、镀锌、金属、拉丝、锈蚀、花纹板、瓦楞、铁丝网、警示条、枪金属、塑料、布料和木材。
- 完整表面规格和 shader 定义以 [library.ts](src/materials/library.ts#L15)、[surfaces.ts](src/materials/surfaces.ts#L1) 为准；顶点坐标和着色器全文不重复抄入文档。
- 材质烘焙失败可用平面标准材质继续；道具 builder 失败或名称未知可退化为尺寸盒体。

### 36 种道具注册表

下表为默认注册规格 `(X, Y, Z)` 及默认材质/碰撞表面，不保证复杂 builder 的每个零件都占满此盒，也不表示每种道具可互动。

| 名称 | 含义 | 默认尺寸 | 默认材质 / 表面 |
| --- | --- | --- | --- |
| container20 | 20 尺箱 | 6.06, 2.59, 2.44 | paint_red / metal |
| container40 | 40 尺箱 | 12.19, 2.59, 2.44 | paint_blue / metal |
| container40hc | 高柜 | 12.19, 2.9, 2.44 | paint_green / metal |
| jersey_barrier | 隔离墩 | 3, 0.81, 0.6 | concrete / concrete |
| light_mast | 灯塔杆 | 0.5, 14, 0.5 | steel_galv / metal |
| fence_panel | 围栏片 | 3, 2.4, 0.08 | chainlink / metal |
| guard_booth | 岗亭 | 2.6, 2.7, 2.2 | paint_white / metal |
| gate_arm | 道闸 | 5, 1.1, 0.3 | hazard_stripes / metal |
| bollard_mooring | 系泊柱 | 0.7, 0.6, 0.7 | steel_dark / metal |
| bollard_post | 防撞柱 | 0.17, 1, 0.17 | paint_yellow / metal |
| relay_node | 中继节点 | 1.2, 2.4, 0.8 | paint_grey / metal |
| shelf_rack | 货架 | 2.7, 4.2, 1.1 | paint_orange / metal |
| stairs_metal | 金属楼梯 | 3, 2.6, 1 | diamond_plate / metal |
| catwalk | 步道 | 3, 1.1, 1.2 | diamond_plate / metal |
| reefer_unit | 冷藏机组 | 0.5, 2.3, 2.3 | paint_white / metal |
| barrel | 桶 | 0.6, 0.9, 0.6 | paint_blue / metal |
| pallet | 托盘 | 1.2, 0.144, 1 | wood_pallet / wood |
| pallet_stack | 托盘堆 | 1.2, 1.15, 1 | wood_pallet / wood |
| crate_wood | 木箱 | 1.1, 1, 0.9 | wood_pallet / wood |
| crate_stack | 箱堆 | 1.2, 1.9, 1 | wood_pallet / wood |
| ibc_tote | 吨桶 | 1.2, 1.16, 1 | plastic_grey / metal |
| forklift | 叉车 | 3.4, 2.2, 1.25 | paint_yellow / metal |
| cable_reel | 电缆卷盘 | 1.3, 1.3, 0.8 | wood_dark / wood |
| tire_stack | 轮胎堆 | 0.8, 1, 0.8 | tire / rubber |
| dumpster | 垃圾箱 | 1.9, 1.35, 1.1 | paint_green / metal |
| generator | 发电机 | 2.2, 1.4, 1 | paint_yellow / metal |
| jerry_can | 油壶 | 0.35, 0.47, 0.17 | paint_green / metal |
| traffic_cone | 路锥 | 0.36, 0.7, 0.36 | plastic_red / rubber |
| gas_cylinders | 气瓶组 | 0.9, 1.6, 0.5 | steel_dark / metal |
| tarp_cargo | 苫布货物 | 2.4, 1.5, 1.4 | tarp / dirt |
| sandbags | 沙袋 | 2, 0.9, 0.6 | tarp / dirt |
| toolbox_cart | 工具车 | 0.9, 0.95, 0.5 | plastic_red / metal |
| floodlight_stand | 泛光灯架 | 1, 2.2, 1 | paint_yellow / metal |
| cardboard_boxes | 纸箱 | 1, 0.8, 0.8 | cardboard / wood |
| pipe_stack | 管堆 | 6, 0.9, 1.2 | steel_rust / metal |
| sign_post | 标牌杆 | 0.6, 2.4, 0.08 | paint_white / metal |

源码：[注册尺寸与 fallback](src/props/registry.ts#L6)。

### 物理和世界逻辑

- 使用内部轻量碰撞和导航实现，不使用 Rapier/Ammo 等外部刚体引擎。
- 玩家主要为胶囊移动、台阶处理、站立空间检查、世界边界限制。
- 射线用于环境遮挡、玩家/敌人伤害与视线；玩家步枪为 hitscan、飞鸥为移动弹、猎犬为 hitscan。
- 敌犬二维导航网格为 0.5，部分碰撞带 bulletOnly/noNav 标记；可见模型与导航障碍不是永远同一集合。
- 落水救援、坠落伤害是玩家模块规则，不是全局流体或动力学模拟。
- 大量几何合并、InstancedMesh、文字批次、重用向量和对象池降低 CPU/GPU 开销。

源码：[physics](src/physics/index.ts#L7)、[静态构建](src/level/static-builder.ts#L1)、[批量标识](src/level/text-batch.ts#L1)、[几何工具](src/utils/geometry.ts#L1)。

## 8. 特效与音频

### FX / 地面 / 远景

- FX 包括材质相关的命中火花/碎片、烟雾、爆炸、曳光、弹壳和枪口表现。
- 粒子采用池化/结构化数组、动态几何与图集，软粒子从场景深度做融合。
- 渲染动态灯池提供短时枪口/爆炸光，粒子数量与灯池容量不是无限。
- ground 负责湿地细节、积水反射、海面和雨；apron 的平面反射独立处理。
- backdrop 负责起重机、船/艇及天际线；远景物件不是额外可选择关卡。
- 实际伤害由 combat/enemies/player 决定，不能根据粒子规模推断伤害。

源码：[FX 系统](src/fx/systems.ts#L1)、[FX 入口](src/fx/index.ts#L1)、[ground](src/ground/index.ts#L24)、[积水反射](src/ground/apron.ts#L418)、[雨](src/ground/rain.ts#L149)。

### Web Audio

- 音效与音乐在运行时合成，不加载外部配音或成套采样资源。
- AudioContext 不可用时静音降级；首次用户交互解锁，后台 suspend，恢复可 resume。
- 启动关键声音同步准备，其余音色分时间片后台生成，降低开场阻塞。
- 总线：world / near / amb / dry / music。
- 空间 Panner、室外/仓库双卷积混响、受伤低通、压缩与软限幅。
- 一次性声部预算分组为 22 + 12 + 8 + 3，按优先级抢占。
- 敌人循环声只优先保留 90 场景单位内最近 6 个，其余虚拟化，减少开销。
- 音乐含 drone / ost / percussion / brass / motif，随状态和战斗强度分层，并在枪声/爆炸时 ducking。
- 巡逻、接触、热波次/撤离强度分别常用 0.15、0.6、1；主音量由保存设置控制。
- 暂停仍更新音频系统，由 setPaused 调整音频行为，不是主循环彻底不调用它。
- `radio:line` 没有语音朗读消费者；指挥中心字幕不等于 TTS。

源码：[audio](src/audio/index.ts#L133)、[声音事件](src/audio/index.ts#L1019)、[DSP](src/audio/dsp.ts#L1)、[音乐](src/audio/music.ts#L1)、[音效生成](src/audio/sfx.ts#L1)。

## 9. 开发调试入口

以下在浏览器开发者工具中使用，属于调试能力，不是普通玩家菜单。会影响当前关卡的动作明确列出。

| 入口 | 内容 / 影响 |
| --- | --- |
| `window.__G` | 当前共享上下文，可查看 player、weapon、game、enemies、render |
| `window.__stats()` | 渲染统计、平滑估算 FPS、当前状态 |
| `window.__frames` | 已渲染帧计数 |
| `window.__ready` | 主循环第二帧后为 true；并不表示真实移动设备已验证 |
| `window.__errors` | 诊断收集的错误信息 |
| `window.__fatal` | 致命错误内容，若无则空值 |
| `window.__setShot({...})` | 设置/清除冻结相机、FOV、曝光；FX 展示会包装此入口 |
| `window.__G.game.debugCut()` | 直接切下一处中继，会触发该任务完成与波次 |
| `window.__G.game.start({skipIntro:true})` | 重置当前局并直接开始 |

只读查看示例：

```js
window.__stats();
window.__G.game.state;
window.__G.game.run;
window.__G.player.tuning;
window.__G.weapon.ammo;
window.__G.combat.stats;
```

固定/清除相机：

```js
window.__setShot({ cam: '-32,1.7,6,0,2,5', fov: '74', exposure: '1' });
window.__setShot({ cam: '' });
```

清除 cam 只解除相机冻结，不自动撤销其他已设置值。URL fov 非空时仍会让玩家动态 FOV 接管逻辑停用，必要时移除参数并刷新。

仅在 `show=fx` 的展示模式下，可把爆炸推进到指定年龄并冻结该展示效果：

```js
window.__setShot({ fxage: 0.6, fxsize: 2 });
```

上述 fxage 不属于 URL key。现有 debug 字段和上下文可以被直接修改，但没有安全、稳定、版本化的编辑器 API；调试后刷新页面恢复正常部署状态。

本地档案、设置与战绩保存在当前 origin 的 IndexedDB；旧 localStorage 设置仅在缺少数据库设置时迁移，之后不再写入旧键。换端口/协议/域名通常是不同存储，没有跨设备同步。

源码：[全局类型](src/types/globals.d.ts#L4)、[调试相机](src/app/boot.ts#L77)、[诊断](src/app/diagnostics.ts#L1)、[FX 包装](src/fx/index.ts#L2152)。

## 10. 还原验证与已知限制

### 已完成验证的历史记录

以下是增加 IndexedDB 用户数据之前，重构与 pnpm 切换期间实际执行的历史验证记录，不是每次启动自动执行的测试套件。新增档案入口会改变菜单画面，下面的零像素差异结果不适用于新增后的菜单：

| 项目 | 结果 |
| --- | --- |
| strict TypeScript 检查 | 通过 |
| Vite 生产构建 | 通过 |
| pnpm 冻结安装 | 通过；原依赖版本未主动升级 |
| pnpm dev 页面 / TS 入口 | HTTP 200 |
| 原 HTML 与 TS：PC 标题 | 同条件截图零像素差异 |
| 原 HTML 与 TS：模拟移动端标题 | 同条件截图零像素差异 |
| 九种 showcase | 同条件截图零像素差异，渲染调用/三角形/几何/纹理/program 统计匹配 |
| 生产预览 PC / 模拟移动端交互 | 同步操作状态匹配，最终同条件截图零像素差异 |
| 延展流程 | 设置、暂停面板、死亡重试、交互推进/取消/完成、提前撤离受阻、全部中继、成功撤离和再次部署已验证 |
| benchmark | 能运行；真实时间与性能统计不同，截图非确定性 |

交互比对使用固定种子、固定模拟 dt 和锁步 requestAnimationFrame，避免不同浏览器指令间多跑若干帧造成伪差异。不是仅依靠编译通过判断体验正确。

这些自动化比对脚本在本次工作临时测试环境中执行，**未作为项目 scripts/test 目录交付**。当前 package.json 没有 `pnpm test` 或永久集成的端到端测试命令。

### 新增 IndexedDB 用户数据验证

新增功能另行使用隔离浏览器上下文验证，没有修改用户日常浏览器的数据：

| 项目 | 已执行结果 |
| --- | --- |
| pnpm 冻结安装、类型检查与生产构建 | 通过；没有新增依赖 |
| 自动档案、旧 localStorage 迁移、设置刷新 | 通过；稳定 ID、昵称与设置保留，旧键不再写入 |
| 昵称表单与安全文本展示 | 通过；HTML 字符串按字面显示，空白昵称不保存 |
| 标题/暂停/死亡/结算档案入口 | Chrome 实际点击通过；桌面开始、暂停恢复、重试与撤离接入通过 |
| 死亡/胜利统计与刷新 | 通过；测试夹具触发原死亡与撤离处理，射击/命中/击杀/时间及重试统计匹配 |
| 多标签首次创建与并发结算 | 三连接共用一个 ID，累计统计不丢失，同一行动 ID 不重复累加 |
| 历史读取与保留 | 28 条记录完整保留，界面与查询仅显示倒序最近 20 条 |
| shot/showcase/bench | 测试夹具验证不写正常战绩 |
| 故障与原子性 | 注入 SecurityError、blocked、QuotaExceededError、事务中止与版本变更，明确提示失败；中止同时回滚档案统计与战绩，成功重试恢复保存状态 |
| 模拟移动端 | 390px、320px 与 844×390 横屏实际触屏入口和滚动验证，无横向溢出 |
| 应用异常 | 本次浏览器测试无 pageerror；不等价于全部网络请求均成功 |

移动端仍是 Chrome 的设备模拟，不宣称经过真机 Safari 验证；配额与 blocked 采用受控故障注入，没有填满磁盘或干扰真实数据。脚本在临时测试环境中运行，未新增项目级 `pnpm test` 命令。

### 新增局域网联机验证

下表为最终 v2 与关节模型的复测记录：真实 WebSocket 39 项、开发模式双浏览器 45 项、生产模式双浏览器 48 项全部通过，均无 pageerror；另外验证了 4 项阶段回退边界。上述原版还原验证表不变。

| 项目 | 已执行结果 |
| --- | --- |
| 类型检查、Prettier、生产构建 | 通过；新增依赖仅 `ws` 及 `@types/ws`、`@types/node` |
| 协议 v2 脚本（真实 WebSocket，39 项） | 通过：房主权限、准备与倒计时期间防重复、移出、移交与继任，以及版本/状态校验、满员、离开回收与限流 |
| 协议 v2 双浏览器端到端（开发 45 / 生产 48 项） | 通过：PC/触屏准备、统一开局、管理确认、原开局按钮接入及离房恢复、关节模型动作同步、320px 主按钮整行布局；生产另含服务关闭/连接失败检查，无 pageerror |
| 阶段回退（4 项） | 通过：10 秒保护期内不回退；超时全员 idle 才回退；仍有 field 不回退；最后一人变 idle 后回退 |
| 服务不可用 | 单人游戏继续运行，联机面板显示明确错误；shot 模式不创建联机 |
| 生产方式 `pnpm lan` | 页面与 `/ws` 同端口工作，局域网地址打印正确 |
| 布局 | pc-1280、pc-700、m-390、m-320、横屏五种视口，徽标与指南针、档案状态无重叠，无横向溢出 |
| 端口冲突 | 本机已有其他程序占用回环地址时，服务启动自检失败并给出换端口提示，不会静默打开别人的服务 |

只在单台 macOS 上用多个浏览器上下文验证，未在多台真机、iOS Safari 或 Windows 防火墙环境验证。

### 已知限制与解释

- PC 使用 Chrome，移动端为浏览器模拟，不是实际 iPhone Safari / 全 Android 设备覆盖。
- 原文件与重构测试均出现过原有资源 404，未造成应用失败；不能将“无应用异常”扩展为“所有网络请求均成功”。
- benchmark 不适合逐帧像素断言，因为相机和统计依赖真实帧时。
- strict 通过不表示零 any；额外的 noUnusedLocals/noUnusedParameters 未启用，逆向来源中保留一些未使用内部量。
- 近战、Q备用动作和部分 post 字段只是保留结构/文案，没有正常玩法对应效果；详见玩法边界。
- 没有统一销毁入口、自动恢复高级渲染、正式配置参数校验或跨设备存档。
- 生产 JS 较大：本次 v2 与关节模型构建约 1431.37 kB，gzip 约 456.25 kB；含 Three 与程序化场景/Shader。体积为本次构建快照，不是永恒值。
- 文档不会替代完整模型点位或 shader 算法，已经给出对应可追溯源码。

### 后续改动的回归清单

- [ ] `pnpm install --frozen-lockfile`、`pnpm typecheck`、`pnpm build`。
- [ ] PC 启动、指针锁成功/失败、键盘兜底、暂停/恢复。
- [ ] 触屏摇杆+转向+开火并行、ADS切换、交互按钮、touchcancel、不同比例屏幕。
- [ ] 中继顺序自由、失去交互条件后的进度衰减、三波增援、活敌限制。
- [ ] 提前撤离提示、全切后的自动撤离、死亡重试计数及评分边界。
- [ ] 空仓/非空换弹、备用不足、静止/运动/蹲伏/ADS散布。
- [ ] 设置保存、已有质量存档与 URL 覆盖、全屏支持/不支持。
- [ ] 档案首次创建、旧设置迁移、改名/刷新、并发结算去重、历史上限与完整保留、数据库故障提示。
- [ ] 九种展示、截图模式、benchmark、advanced/forward降级。
- [ ] 联机 v2：建房/加入/满员/离开、准备/取消与全队 3 秒出击（不强制锁鼠标）、踢人/移交二次确认、最低槽位继任及 ready 清除、lobby/mission 回退、房间条/HUD 房主标记、关节士兵步行/冲刺/蹲伏/瞄准/后坐力/倒地与两端同步、服务停止时单人仍可玩、`pnpm lan` 局域网地址可达。
- [ ] 与原文件对比状态和画面，并查看控制台应用错误及网络失败。

## 11. 修改位置速查

| 想修改什么 | 主要位置 | 同步注意 |
| --- | --- | --- |
| 故事、标题、介绍 | src/ui/menus.ts；src/game/index.ts RADIO_LINES | 这是原文案；修改后不再是字面 1:1 |
| 中继位置、地图、出生点、撤离 | src/level/index.ts；yard/warehouse/quay | 坐标、碰撞、导航、目标标记同步 |
| 交互距离/时长、波次、追兵 | src/game/index.ts GAME | 评分流程、原始参数与文档同步 |
| 生命/移动/回复/FOV反馈 | src/player/index.ts MOVE；src/config/world.ts | 输入、碰撞、镜头与操作说明同步 |
| 步枪伤害/弹药/射速/换弹/散布 | src/weapon/index.ts | 通用combat默认值不是实际步枪值 |
| 弱点倍率、射线与爆炸 | src/combat/index.ts；enemies命中体 | AI双方判定不同，不要混为统一hitbox |
| 敌人参数与AI | src/enemies/index.ts TUNE；gull.ts；hound.ts | 池容量、token、波次和视觉状态同步 |
| 键位/触屏/手柄 | src/input/index.ts | 原文案与实际动作消费需一起检查 |
| 用户档案 / 设置 / 战绩 | src/data/user-data.ts；src/config/settings.ts；src/ui/menus.ts；src/game/index.ts | IndexedDB 事务、旧设置迁移、统计口径与 URL 优先级 |
| HUD反馈 | src/hud/index.ts；src/styles/ui.css | PC/mobile、安全区、ADS/换弹隐藏条件 |
| 画质与后处理 | src/config/quality.ts；src/render | 动态分辨率、已创建资产不会全重烘焙 |
| 资产、地面、远景 | src/props；src/materials；src/ground；src/backdrop | GPU生成失败fallback、碰撞和批处理 |
| 音乐/音效 | src/audio | 用户手势、声部预算、室内外与字幕分离 |
| 新URL参数/调试入口 | src/app/boot.ts及消费模块 | 更新完整参数表，明确空字符串与0的语义 |
| 联机协议、房间上限、同步频率、房主/准备/出击 | server/protocol.ts；server/rooms.ts；src/net/index.ts；src/net/lobby.ts | 当前 v2；改协议须递增 `PROTOCOL_VERSION` 并两端同步；阶段与倒计时不等于共享战斗 |
| 队友关节模型、动作、房主标签 | src/net/avatars.ts；src/net/lobby.ts | 外观与动作分离；保持 20 Hz 服务/15 Hz 客户端/120 ms 插值，开火仅表现 |

要保持 1:1，应先回到原始 `3a.html` 核对，再做必要的类型/组织调整。新增功能应明确标为新设计，不将其写成原始实现。

## 12. 本地用户数据（IndexedDB）

这是按后续需求新增的功能，原始 HTML 没有用户档案或持久战绩。实现使用浏览器原生 IndexedDB，不增加依赖、后端或登录服务；一个 origin 自动创建一个本地队员。

### 模块与接入

- [src/data/user-data.ts](src/data/user-data.ts#L1)：导出 `createUserData`、`createLocalId`、档案/统计/战绩类型及存储状态；提供 `profile`、`settings`、`status`、`error`、`persistent` 只读快照，以及 `saveSettings`、`renamePlayer`、`recordResult`、`getHistory`、`subscribe`。
- [src/config/settings.ts](src/config/settings.ts#L1)：默认值、边界校验、旧 localStorage 设置读取；不再向 localStorage 写入。
- [src/app/boot.ts](src/app/boot.ts#L1)：创建用户数据后写入共享 `GameContext.userData`，再初始化原游戏子系统。
- [src/ui/menus.ts](src/ui/menus.ts#L1)：档案入口、昵称表单、统计/历史及保存状态；设置即时应用并异步持久化。用户昵称只写入 `textContent`，不作为 HTML 解释。
- [src/game/index.ts](src/game/index.ts#L1)：每次开始行动生成独立 ID，死亡与撤离时捕获当前战斗统计并写入。

### 数据库结构

数据库名 `saltline.userdata`，版本 `1`：

| Object store | 主键 | 内容 |
| --- | --- | --- |
| profile | 固定键 `current`，无 keyPath | `id`、`name`、`createdAt`、`updatedAt`、`stats` |
| settings | 档案 `id`，无 keyPath | `quality`、`sens`、`invertY`、`volume`、`fov` |
| records | keyPath `id`，每次行动一个 ID | `userId`、`endedAt`、`outcome`、`duration`、`shots`、`hits`、`kills`、`retries`、`relays`、`totalRelays`、`rating` |

`records` 索引 `userEndedAt` 是 `[userId, endedAt]` 复合键。档案界面通过当前用户范围的倒序 cursor 读取最近 20 条；不会删除更早记录。时间戳使用毫秒，行动时长使用原状态机的秒数，命中率存储为 0–1 比率。用户与行动 ID 使用 `crypto.getRandomValues` 生成 UUID，不消耗游戏随机源。

### 首次初始化与迁移

档案与设置在同一个 readwrite 事务中检查和创建，多标签同时启动也复用同一 ID。只有该用户还没有数据库设置时，才读取旧键 `saltline.settings.v1`，校验后存入 IndexedDB；保留旧键作为备份，后续设置变更只写数据库。已有数据库设置优先于旧键。

原默认值与边界不变：画质 auto/low/medium/high/ultra，灵敏度默认 1、范围 0.2–3，反转 Y 默认关闭，音量默认 0.8、范围 0–1，FOV 默认 74、范围 60–95。非法数值回归默认或钳制到边界；URL 与保存画质的优先级遵循原菜单逻辑。

### 统计与事务语义

- `attempts` 只统计死亡或成功结算；`victories`/`deaths` 分别递增，击杀、射击、命中与行动时间累加。
- 累计命中率是 `总 hits / 总 shots`；零射击无命中率。`bestTime` 只取胜利最短时间，`bestAccuracy` 只取有射击的胜利最高命中率。
- 每条记录的 `retries` 是原游戏该次行动的重试计数，不再全局求和。
- 记录插入与累计统计使用一个 profile+records readwrite 事务。先查行动 ID，已有记录不重复累加；事务内重新读取最新档案，因此跨标签的重命名和结算不会用旧缓存覆盖统计。
- 设置、昵称与战绩的缓存只在事务完成后更新。`saving` 表示写入进行中，事务完成才显示 `saved`；错误显示 `error` 及原因，调用方能接收到拒绝结果。
- showcase、bench 和非空 shot 截图模式不记录战绩。主动重开未结束行动、暂停或离开页面也不产生结算记录。

### 失败、隐私与限制

首次打开/初始化失败时允许游戏启动，但显式标为非持久会话，保存与历史读取会失败并提示；没有静默回写 localStorage 的后备实现。数据库打开遇到 blocked 不会无限卡住启动；版本变更会关闭旧连接并提示刷新。写入中断或配额不足不会显示为成功，也不改变原任务规则。

档案和历史不会上传服务器。它们受当前协议、域名、端口和浏览器存储隔离约束，不是可用于服务器认证的身份。清除网站数据、无痕会话结束、浏览器回收存储或更换设备都可能失去数据；当前没有导入导出、云备份、多档案切换或主动删除界面。

**不保存正在进行的任务现场**：刷新后仍回到标题，已结算战绩和设置保留，但玩家位置、敌人、弹药与未结算进度不恢复。

返回 [文档总览](README.md)。

## 13. 局域网联机服务

这是按后续需求新增的功能，原始 HTML 是纯单人游戏，没有任何网络代码。目标是同一局域网内 2–4 人“同场可见”：协议 v2 增加房主、准备、全队倒计时出击和房间阶段，并同步位置、姿态及开火标记；每人仍在自己设备上完整运行原版任务，不是真正共享战斗。

### 启动方式

| 场景 | 命令 | 访问地址 |
| --- | --- | --- |
| 正式联机 | `pnpm lan` | 终端打印的 `http://局域网IP:4207`；页面与 `/ws` 同端口 |
| 只启动服务（已构建） | `pnpm server` | 同上；`dist/` 不存在时页面返回 503 “请先运行 pnpm build” |
| 开发联机 | 终端一 `pnpm dev:server`，终端二 `pnpm dev` | Vite 地址；Vite 把 `/ws` 代理到 `127.0.0.1:4207` |
| 开发预览 | `pnpm server` + `pnpm preview` | preview 同样配置了 `/ws` 代理 |

| 环境变量 | 默认 | 作用 |
| --- | --- | --- |
| `PORT` | 4207 | 服务监听端口 |
| `HOST` | `0.0.0.0` | 监听地址；改为 `127.0.0.1` 则只允许本机 |
| `LAN_PORT` | 4207 | 仅 Vite：`/ws` 代理目标端口，需与服务的 `PORT` 一致 |

页面也可以用 [`?server=`](#47-新增联机服务地址1-项) 连接另一台主机的服务。服务端没有构建步骤：Node.js ≥ 22.18 会直接剥离 TypeScript 类型运行 `.ts`，因此服务端源码只使用可擦除语法（`erasableSyntaxOnly`），导入写完整 `.ts` 扩展名。

#### 端口与启动自检

默认端口原计划为 8787，但它是 Cloudflare workerd / wrangler 的常用端口；本机实测已有程序只监听 `127.0.0.1:8787`，此时本服务虽能绑定 `0.0.0.0:8787`，本机浏览器访问的却是另一个程序。因此默认改为 4207，并在启动后请求自己的 `http://127.0.0.1:PORT/healthz`，比对每次启动随机生成的 `instance`。不一致时打印“端口 X 的本机回环地址被其他程序占用，请用 PORT=其他端口 pnpm server 启动”并以退出码 1 结束。端口被完全占用（EADDRINUSE）也会给出同样的换端口提示。

`GET /healthz` 返回 `{ ok, protocol, instance, rooms, players }`，可用于排查。

### 文件

| 文件 | 责任 |
| --- | --- |
| [server/protocol.ts](server/protocol.ts#L1) | 前后端共享的常量、消息类型、昵称与房间号规范化；客户端直接 import 此文件，不重复定义 |
| [server/rooms.ts](server/rooms.ts#L96) | 房间注册表：成员、房主继任/移交、准备/出击/踢人、阶段回退、状态清洗、20 Hz 快照 |
| [server/index.ts](server/index.ts#L1) | HTTP 静态服务、WebSocket 升级、限流、心跳、启动自检、优雅退出 |
| [server/tsconfig.json](server/tsconfig.json#L1) | NodeNext 模块、Node 类型，仅检查服务端 |
| [src/net/index.ts](src/net/index.ts#L54) | 协议 v2 客户端：房主/准备/阶段状态、倒计时自动开局、15 Hz 上报（含开火标记）、2 秒 ping、昵称同步 |
| [src/net/avatars.ts](src/net/avatars.ts#L412) | 程序化关节士兵、步态/姿态/开火反馈、昵称与房主标签、120 ms 插值 |
| [src/net/lobby.ts](src/net/lobby.ts#L74) | 联机页、二次确认管理、标题/暂停房间条、全队倒计时与 HUD 房主徽标 |

### 房间规则

- 房间号 4 位，字母表 `ABCDEFGHJKMNPQRSTUVWXYZ23456789`（去掉易混的 I、L、O、0、1），用 `crypto.randomInt` 生成；输入时自动转大写。
- 每房最多 4 人，整台服务最多 64 个房间。第 5 人收到“房间 X 已满（最多 4 人）”。
- 每人占一个槽位 0–3，决定颜色：橙 `#ffb347`、蓝 `#4fc3f7`、绿 `#9ccc65`、粉 `#f06292`。有人离开后空位可被新人复用。
- 昵称取自玩家档案（[§12](#12-本地用户数据indexeddb)），规则与档案一致：去掉控制字符和首尾空白后 1–24 个字符。档案里改名会实时广播给房间。
- 创建者为房主，与运行服务的电脑无关。非房主可准备/取消准备；房主无需准备，其他成员全部准备后才能“全员出击”（仅房主一人时也可发起）。
- 房主可移出其他成员或移交房主，客户端要求在 3 秒内二次点击确认；服务校验调用者为房主、目标在房间内且不是自己。被踢者收到 `kicked`，其余成员收到 `peer-left.kicked = true`，本地游戏不受影响。
- 房主离开或断线后，剩余最低 `slot` 的成员继任；自动继任与手动移交都将新房主的 `ready` 清为 false。最后一人离开或断线时房间立即删除。
- `phase` 为 `lobby`（等待出击）或 `mission`（行动中）。出击清除全员准备并记录 `startedAt`；自出击起超过 `MISSION_COUNTDOWN_MS + 7000`（10000ms）且当前全员 `idle` 时，下一次 tick 回到 `lobby`，并非要求连续 idle 10 秒。暂停为 `field`、死亡为 `down`，不会满足回退条件。
- 连接、房间和玩家 ID 都只存在服务进程内存中，重启服务后全部清空。

源码：[入房与房主](server/rooms.ts#L125)、[离开/继任/移交](server/rooms.ts#L160)、[准备/出击/踢人](server/rooms.ts#L295)、[阶段回退](server/rooms.ts#L373)。

### 协议

JSON 文本帧，路径 `/ws`，`PROTOCOL_VERSION = 2`。`create`/`join` 携带版本号，不一致时返回 `version` 错误并提示刷新页面。`PeerInfo = { id, name, slot, ready }`；`PeerState.fire` 表示自上次客户端状态上报以来至少开火一次，不传子弹轨迹或伤害。

| 方向 | 消息 | 内容 |
| --- | --- | --- |
| 客户端 → 服务 | `create` / `join` | `v`、`name`，`join` 另带 `room` |
| | `state` | `s: { x, y, z, yaw, pitch, crouch, fire, mode }` |
| | `rename` / `leave` / `ping` | 新昵称 `name` / 无 / 客户端时间 `at` |
| | `ready` / `start` | 布尔 `ready`（非房主）/ 无（房主发起） |
| | `kick` / `host` | 目标成员 `id`：移出 / 移交房主 |
| 服务 → 客户端 | `welcome` | `v`、自己的 `id`、`room`、房主 ID `host`、`phase`、`peers: PeerInfo[]` |
| | `peer-joined` / `peer-left` / `peer-renamed` | `peer` / `id` + 布尔 `kicked` / `id` + `name` |
| | `peer-ready` / `host-changed` | `id` + 布尔 `ready` / 新房主 `id` |
| | `mission` / `phase` / `kicked` | 发起者 `by` + 倒计时 `delay`（3000ms）/ 房间 `phase` / 被移出通知（无字段） |
| | `snapshot` | 每 50 ms 一次，`at` 与房间内全部成员的最新状态（含 `id`、`fire`） |
| | `pong` / `left` / `error` | 原样返回 `at` / 离开确认 / `code` + 中文 `message` |

`mode` 含义：`idle` 表示标题、介绍或结算（队友模型隐藏），`field` 表示正在行动或暂停，`down` 表示死亡；与房间 `phase` 独立。错误码：`bad-message`、`version`、`bad-name`、`bad-room`、`room-not-found`、`room-full`、`server-full`、`not-in-room`、`already-in-room`，v2 新增 `not-host`、`not-ready`、`bad-target`。

源码：[共享协议](server/protocol.ts#L15)、[消息与错误码](server/protocol.ts#L41)、[本机状态映射](src/net/index.ts#L289)。

### 同步与显示

- 本机每秒上报 15 次（[SEND_HZ](src/net/index.ts#L30)），服务每秒广播 20 次快照；队友模型仍延后 120 ms 在相邻快照间插值，朝向取最短角度插值，频率与插值延迟未变。
- 收到 `mission` 后，以本机 `performance.now() + delay` 计算倒计时；3 秒后 `net.update` 调用 `game.start({})` 重置并进入原开场。不强制请求鼠标锁定，电脑端等待玩家首次点击；不是锁步或服务端权威战斗同步。
- 模型为无外部资源的程序化关节士兵：髋/膝/脚、脊柱、头、持枪关节分组，圆角护甲、肩甲、头盔、弹袋、背包与步枪按骨骼/材质合并几何；共享程序化迷彩纹理，不下载外部模型或贴图；槽位颜色用于饰条与发光部位，而非全身染色。
- 动作根据插值位移推导步行/冲刺速度与步态，蹲伏通过髋膝弯曲、脚踝补偿和躯干前倾实现；头与持枪关节跟随 `pitch` 瞄准（不另同步 ADS），`fire` 驱动后坐力与枪口闪光，`down` 平滑后仰倒地。不是压扁胶囊模型，也不新增碰撞或伤害判定。
- 头顶昵称标签不被遮挡，房主另有标记，改名/移交时实时更新；`idle` 时模型隐藏。
- 标题/暂停房间条显示房间号、人数、准备人数、房主身份，以及准备/全员出击与房间入口；联机页提供移出/移交二次确认。入房后原开始、重试、再次出击与重新开始按钮也接入准备/房主出击，离房或断线后恢复原动作。全队另有 3 秒倒计时覆盖层，每秒更新文字，避免逐帧重复朗读。
- HUD 徽标在自己为房主时显示“房主”，否则“联机”，其余为房间号、人数、延迟；只在介绍、行动、暂停和死亡时显示。PC 在右上角；窄屏下移；触屏窄屏移到左上角，仅显示房间号和人数两行，避开指南针与触屏按钮。
- showcase、bench 和非空 `shot` 模式不创建联机客户端，也不显示入口。

源码：[自动开局](src/net/index.ts#L95)、[倒计时与上报](src/net/index.ts#L400)、[士兵建模](src/net/avatars.ts#L202)、[关节与标签](src/net/avatars.ts#L412)、[插值与动作](src/net/avatars.ts#L550)、[房间 UI](src/net/lobby.ts#L74)。

### 安全与容错

服务只面向可信的局域网，没有登录或加密；任何能访问端口的人都能建房或用房间号加入。已做的防护：

- 消息上限 1024 字节，超出以 1009 关闭；每连接每秒超过 90 条以 1008 关闭；二进制帧和非法 JSON 返回 `bad-message`。
- 状态逐字段清洗：任一数值字段不是有限数字、`crouch`/`fire` 不是布尔或 `mode` 不在白名单时拒绝整条并返回 `bad-message`；坐标钳制到 ±1000，俯仰钳制到 ±1.5，偏航归一化到 ±π。房主操作另校验身份/目标，未全员准备的出击返回 `not-ready`；倒计时期间服务也拒绝重复出击与修改准备。
- 只在 `/ws` 路径接受升级；每 10 秒心跳 ping，到下一轮仍未回 pong 的连接被终止（约 10–20 秒）。
- 静态服务仅允许 GET/HEAD，解析后路径必须位于 `dist/` 内，防止目录穿越；附 `X-Content-Type-Options: nosniff`，`assets/` 下带哈希的文件长期缓存。
- 昵称在页面中只写入 `textContent`，不作为 HTML 解释。
- 客户端连接 5 秒超时；连不上显示“无法连接联机服务，请确认已运行 pnpm server 且处于同一局域网”，中途断线显示“与联机服务的连接已断开”。任何联机错误都不会中断单人游戏。
- SIGINT / SIGTERM（如 Ctrl+C）时以 1001 关闭所有连接后退出，最多等待 1 秒。

如需公网使用，至少要加 HTTPS/WSS、访问控制和更严格的限流，当前实现不提供。

### 局限

- **不是完整多人对战或共享世界**：敌人、射击命中、生命、波次、中继和撤离都在各自设备本地计算；队友打掉的敌人不会在你这里消失，你也不能打中或救起队友。
- 每人的地图相同（原关卡固定），但敌人随机源各自独立。
- 战绩仍各自写入本机 IndexedDB，不汇总。
- 没有聊天、语音、房间列表、断线重连或观战。
- 没有服务端权威校验，能改客户端的人可以上报任意（被钳制过的）位置。
