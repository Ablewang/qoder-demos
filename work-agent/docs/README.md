# Work Agent 文档

**一只陪伴宠物，能协助日常办公。**

本目录是项目的唯一依据。所有设计、决策、评审都落在这里；实现必须能追溯到这里的文档。文档和代码冲突时，先改文档并通过评审，再改代码。

## 工作流程

| 阶段 | 产出 | 负责 | 通过条件 |
|---|---|---|---|
| 1. 愿景与范围 | `00-vision.md` | 总架构师（主会话） | 用户确认产品目标 |
| 2. 未决问题 | `open-questions.md` | 总架构师 | 影响架构的问题都有答复，并写进 ADR |
| 3. 总体架构 | `architecture/` | 总架构师 | 技术自评通过后冻结 v1（ADR-0016）；用户验收实际体验 |
| 4. 架构决策 | `adr/NNNN-*.md` | 总架构师 | 每个难以回退的决定写一条；已接受的 ADR 只能由新 ADR 取代，不能直接改写 |
| 5. 模块详细设计 | `modules/<编号>-<名称>.md` | 各并行会话 | 遵守 `architecture/` 的接口约定；总架构师检查一致性后标为“已批准” |
| 6. 实现 | 代码 | 各并行会话 | 只能按已批准的模块设计实现；发现设计问题时回到阶段 5 |
| 7. 评审 | `reviews/YYYY-MM-DD-<主题>.md` | 总架构师 | 记录结论、问题和处理结果 |

文档状态统一使用：`草案` → `待评审` → `已批准`；被替代的标为 `已取代`。

## 并行会话规则

见 `architecture/roadmap.md` 第 4 节的启动说明。要点：

- 先读愿景、五份架构/验收文档、体验规格、相关 ADR；
- 只修改自己负责的模块；
- 需要改跨模块接口时写本模块未决问题并回报主会话，由主会话汇总 `open-questions.md`，不能自行修改公共契约；
- 用 `templates/` 里的模板。

## 文档索引与状态

| 文档 | 状态 | 说明 |
|---|---|---|
| [00-vision.md](00-vision.md) | 已批准 | 定位、愿景、原则 |
| [open-questions.md](open-questions.md) | 进行中 | Q4–Q6 待验证；Q10–Q12 已关闭，Windows 尚未实测 |
| [architecture/overview.md](architecture/overview.md) | 已批准 v1 | 分层、模块、数据流、部署 |
| [architecture/contracts.md](architecture/contracts.md) | 已批准 v1 | 跨模块接口（严格类型检查通过） |
| [architecture/invariants.md](architecture/invariants.md) | 已批准 v1 | 35 条约束 |
| [architecture/roadmap.md](architecture/roadmap.md) | 已批准 v1 | 里程碑、并行批次、会话启动说明 |
| [adr/0001-文档驱动与决策记录.md](adr/0001-文档驱动与决策记录.md) | 已接受 | |
| [adr/0002-本机运行.md](adr/0002-本机运行.md) | 已接受 | 由 0008 补充 |
| [adr/0003-模型统一经由LiteLLM.md](adr/0003-模型统一经由LiteLLM.md) | 已接受 | |
| [adr/0004-逐源授权且起步只读.md](adr/0004-逐源授权且起步只读.md) | 已接受 | 第 4 条被 0007 取代 |
| [adr/0005-首批数据源.md](adr/0005-首批数据源.md) | 已接受 | |
| [adr/0006-技术栈.md](adr/0006-技术栈.md) | 已接受（ADR-0017 裁决） | 原提议保留历史，按 ADR-0017 修正与实测门槛执行 |
| [adr/0007-提议决定执行与按需授权.md](adr/0007-提议决定执行与按需授权.md) | 已接受 | Q1 |
| [adr/0008-个人为中心可选共享.md](adr/0008-个人为中心可选共享.md) | 已接受 | Q2 |
| [adr/0009-连接器采用MCP.md](adr/0009-连接器采用MCP.md) | 已接受 | Q3 |
| [adr/0010-工作图谱统一数据模型.md](adr/0010-工作图谱统一数据模型.md) | 已接受（ADR-0017 裁决） | 原提议保留历史，按 ADR-0017 修正与实测门槛执行 |
| [adr/0011-进程与部署模型.md](adr/0011-进程与部署模型.md) | 已接受（ADR-0017 裁决） | 原提议保留历史，按 ADR-0017 修正与实测门槛执行 |
| [adr/0012-产品形态有人格的桌面伙伴.md](adr/0012-产品形态有人格的桌面伙伴.md) | 已接受（ADR-0016/0017 补充） | 需求与技术职责批准，实际能力尚需验证 |
| [adr/0013-记忆透明可编辑.md](adr/0013-记忆透明可编辑.md) | 已接受（ADR-0017 裁决） | 原提议保留历史，按 ADR-0017 修正与实测门槛执行 |
| [adr/0014-跨平台macOS与Windows.md](adr/0014-跨平台macOS与Windows.md) | 已接受（ADR-0017 修正） | 跨平台要求确定，系统能力仍需实测 |
| [adr/0015-宠物客户端采用Tauri.md](adr/0015-宠物客户端采用Tauri.md) | 已接受（ADR-0017 裁决） | Tauri 2 选择，平台探针仍须完成 |
| [design/pet-concepts.md](design/pet-concepts.md) | 已选 B 团子 | Q10 第一轮概念图，不是动画资产 |
| [design/companion-experience.md](design/companion-experience.md) | 已批准 | 窗口生活、自娱、静音听歌与工作入口 |
| [architecture/acceptance.md](architecture/acceptance.md) | 验收基线 | 体验、生产力、扩展性与实测门槛 |
| [adr/0016-团子伙伴与技术自评.md](adr/0016-团子伙伴与技术自评.md) | 已接受 | 产品方向、Windows环境与技术自评授权 |
| [adr/0017-架构基线评审修正.md](adr/0017-架构基线评审修正.md) | 已接受 | 契约修正与原提议技术状态裁决 |
| [poc/time-audit-poc.md](poc/time-audit-poc.md) | 已记录 | 已有验证代码的定位和局限 |
| `modules/` | 第一批设计进行中 | 五个独立会话已派发，尚未批准 |
| [reviews/2026-11-19-module-design-batch1.md](reviews/2026-11-19-module-design-batch1.md) | 已派发 | 模块范围、回执、专项审查及后续评审 |
| [reviews/2026-11-19-architecture-v1.md](reviews/2026-11-19-architecture-v1.md) | 修正版通过 | 首轮退回后修正与复验；冻结技术基线 |

## 变更记录

- 2026-11-18：建立文档体系，记录已有决策和 POC。
- 2026-11-18：Q1–Q3 有了答复（ADR-0007~0009）；确定产品定位为陪伴宠物（ADR-0012、0013）；完成总体架构 v1 草案。
- 2026-11-18：Q8 关闭（真实成长 + 轻度养成）；Q9 关闭（要支持 macOS 和 Windows，提议用 Tauri 2，ADR-0014、0015，新增约束 I28）；Q10 产出第一轮概念图。
- 2026-11-19：选定团子、窗口生活/自娱/听歌，确认 Windows 环境，授权总架构师自评；首轮审查退回，修正并复验后冻结 v1；增加生产力与扩展演练验收标准。
