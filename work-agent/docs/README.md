# Work Agent 文档

**一只陪伴宠物，能协助日常办公。**

本目录是项目的唯一依据。所有设计、决策、评审都落在这里；实现必须能追溯到这里的文档。文档和代码冲突时，先改文档并通过评审，再改代码。

## 工作流程

| 阶段 | 产出 | 负责 | 通过条件 |
|---|---|---|---|
| 1. 愿景与范围 | `00-vision.md` | 总架构师（主会话） | 用户确认 |
| 2. 未决问题 | `open-questions.md` | 总架构师 | 影响架构的问题都有答复，并写进 ADR |
| 3. 总体架构 | `architecture/` | 总架构师 | 用户评审通过，冻结为 v1 |
| 4. 架构决策 | `adr/NNNN-*.md` | 总架构师 | 每个难以回退的决定写一条；已接受的 ADR 只能由新 ADR 取代，不能直接改写 |
| 5. 模块详细设计 | `modules/<编号>-<名称>.md` | 各并行会话 | 遵守 `architecture/` 的接口约定；总架构师检查一致性后标为“已批准” |
| 6. 实现 | 代码 | 各并行会话 | 只能按已批准的模块设计实现；发现设计问题时回到阶段 5 |
| 7. 评审 | `reviews/YYYY-MM-DD-<主题>.md` | 总架构师 | 记录结论、问题和处理结果 |

文档状态统一使用：`草案` → `待评审` → `已批准`；被替代的标为 `已取代`。

## 并行会话规则

见 `architecture/roadmap.md` 第 4 节的启动说明。要点：

- 先读愿景、四份架构文档、相关 ADR；
- 只修改自己负责的模块；
- 需要改跨模块接口时，写进 `open-questions.md`，不要自己改；
- 用 `templates/` 里的模板。

## 文档索引与状态

| 文档 | 状态 | 说明 |
|---|---|---|
| [00-vision.md](00-vision.md) | 待评审 | 定位、愿景、原则 |
| [open-questions.md](open-questions.md) | 进行中 | Q4–Q6 待验证；Q10 待选形象；Q11 待确认 Windows 环境 |
| [architecture/overview.md](architecture/overview.md) | 待评审 | 分层、模块、数据流、部署 |
| [architecture/contracts.md](architecture/contracts.md) | 待评审 | 跨模块接口 |
| [architecture/invariants.md](architecture/invariants.md) | 待评审 | 28 条约束 |
| [architecture/roadmap.md](architecture/roadmap.md) | 待评审 | 里程碑、并行批次、会话启动说明 |
| [adr/0001-文档驱动与决策记录.md](adr/0001-文档驱动与决策记录.md) | 已接受 | |
| [adr/0002-本机运行.md](adr/0002-本机运行.md) | 已接受 | 由 0008 补充 |
| [adr/0003-模型统一经由LiteLLM.md](adr/0003-模型统一经由LiteLLM.md) | 已接受 | |
| [adr/0004-逐源授权且起步只读.md](adr/0004-逐源授权且起步只读.md) | 已接受 | 第 4 条被 0007 取代 |
| [adr/0005-首批数据源.md](adr/0005-首批数据源.md) | 已接受 | |
| [adr/0006-技术栈.md](adr/0006-技术栈.md) | 提议 | 随架构评审 |
| [adr/0007-提议决定执行与按需授权.md](adr/0007-提议决定执行与按需授权.md) | 已接受 | Q1 |
| [adr/0008-个人为中心可选共享.md](adr/0008-个人为中心可选共享.md) | 已接受 | Q2 |
| [adr/0009-连接器采用MCP.md](adr/0009-连接器采用MCP.md) | 已接受 | Q3 |
| [adr/0010-工作图谱统一数据模型.md](adr/0010-工作图谱统一数据模型.md) | 提议 | 随架构评审 |
| [adr/0011-进程与部署模型.md](adr/0011-进程与部署模型.md) | 提议 | 随架构评审 |
| [adr/0012-产品形态有人格的桌面伙伴.md](adr/0012-产品形态有人格的桌面伙伴.md) | 部分已接受 | 用户需求已接受，第 6–10 条随架构评审 |
| [adr/0013-记忆透明可编辑.md](adr/0013-记忆透明可编辑.md) | 提议 | 随架构评审 |
| [adr/0014-跨平台macOS与Windows.md](adr/0014-跨平台macOS与Windows.md) | 已接受（需求）/ 提议（做法） | 来自 Q9 的答复 |
| [adr/0015-宠物客户端采用Tauri.md](adr/0015-宠物客户端采用Tauri.md) | 提议 | 关闭 Q9 |
| [design/pet-concepts.md](design/pet-concepts.md) | 待用户选择 | Q10 第一轮概念图 |
| [poc/time-audit-poc.md](poc/time-audit-poc.md) | 已记录 | 已有验证代码的定位和局限 |
| `modules/` | 未开始 | 架构 v1 冻结后开始 |
| `reviews/` | — | |

## 变更记录

- 2026-11-18：建立文档体系，记录已有决策和 POC。
- 2026-11-18：Q1–Q3 有了答复（ADR-0007~0009）；确定产品定位为陪伴宠物（ADR-0012、0013）；完成总体架构 v1 草案。
- 2026-11-18：Q8 关闭（真实成长 + 轻度养成）；Q9 关闭（要支持 macOS 和 Windows，提议用 Tauri 2，ADR-0014、0015，新增约束 I28）；Q10 产出第一轮概念图。
