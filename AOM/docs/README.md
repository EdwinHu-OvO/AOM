# AOM 文档目录约定

本目录用于保存 AOM 的架构设计、阶段计划、实现进度、决策记录和验证记录。

后续进度都应放在 `AOM/docs/` 下，并按模块拆分记录，例如：

- `implementation-plan.md`：总体分期实现计划。
- `progress.md`：进度索引，只记录模块文件位置和最新摘要。
- `progress/adapter-host.md`：Adapter Host 进度。
- `progress/analysis.md`：Analysis Layer 进度。
- `progress/gateway.md`：Safety Gateway 进度。
- `progress/agent-server.md`：Agent Interaction Layer 进度。
- `progress/target-app.md`：demo 目标应用相关进度。
- `decisions/`：架构决策记录。
- `traces/`：关键 demo、测试或验证链路记录。

进度类文件可以忽略仓库中普通文件的行数限制，但必须按模块拆分，避免单个总进度文件占用过多上下文。需要继续某个模块时，优先只读取该模块进度文件和必要的索引摘要。
