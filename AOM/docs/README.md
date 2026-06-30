# AOM 文档目录约定

本目录用于保存 AOM 的架构设计、阶段计划、实现进度、决策记录和验证记录。

后续进度都应放在 `AOM/docs/` 下，并按模块拆分记录，例如：

- `implementation-plan.md`：总体分期实现计划。
- `progress.md`：进度索引，只记录模块文件位置和最新摘要。
- `progress/adapter-host.md`：Adapter Host 进度。
- `progress/analysis.md`：Analysis Layer 进度。
- `progress/capability.md`：Capability Layer 进度。
- `progress/gateway.md`：Safety Gateway 进度。
- `progress/agent-server.md`：Agent Interaction Layer 进度。
- `progress/target-app.md`：demo 目标应用相关进度。
- `design/`：模块设计和工具链边界。
- `decisions/`：架构决策记录。
- `releases/`：dev/local release notes and build handoff records.
- `traces/`：关键 demo、测试或验证链路记录。

进度类文件可以忽略仓库中普通文件的行数限制，但必须按模块拆分，避免单个总进度文件占用过多上下文。需要继续某个模块时，优先只读取该模块进度文件和必要的索引摘要。

当前关键决策：

- `decisions/0001-cross-process-communication.md`：跨进程通信与 transport abstraction。
- `decisions/0002-static-and-dynamic-analysis.md`：静态制品分析与动态运行时分析的双通道边界。
- `decisions/0003-artifact-parser-routing.md`：未知制品的前置识别、置信度证据和 Adapter 路由。
- `decisions/0004-external-analyzer-adapters.md`：Analyzer 作为向下工具适配层，AOM 不重复实现调试和反编译引擎。
- `decisions/0005-analysis-identity-evidence-context.md`：Analysis 稳定身份、一等 Evidence
  和 LLM context pack 契约。
- `decisions/0006-data-flow-graph.md`：Analysis 数据流图、字段/message 节点和
  flow Evidence 边界。
- `decisions/0007-capability-mvp.md`：Phase 3 executable capability schema、
  action plan、expected effects 和自动执行门槛。
- `decisions/0008-target-lifecycle.md`：运行中目标应用的 attach、owned launch、
  copy-for-static-analysis 生命周期边界。
- `decisions/0009-agent-interaction-mcp.md`：Phase 5 Agent Interaction Layer、
  Claude Code MCP 演示面和 AnalysisService-backed Agent surface。

当前模块设计：

- `design/project-direction.md`：AOM 北极星、架构边界、Phase 2 主线和方向检查标准。
- `design/electron-analyzer-toolchain.md`：Electron 静态/动态工具适配、局部依赖、fallback 和 Evidence 约定。
- `design/claude-code-mcp-demo.md`：Claude Code 作为 MCP host 的 Phase 5 演示配置和工具流。
- `design/console-audit.md`：Console audit baseline 的记录格式、边界和使用方式。
- `design/llm-capability-recognizer.md`：OpenAI-compatible LLM capability recognizer 的配置、
  验证边界和 B站测试暴露问题的修复说明。
- `design/context-window-routing.md`：Agent-facing 上下文窗口、结构/重复/任务折叠、
  多滑动窗口路由和数据流保留边界。
- `design/context-delta.md`：动作前后语义 diff、推荐目标和 compact response 边界。
- `design/dynamic-call-chain.md`：只返回建议调用链的动态工具编排层。

当前 dev release：

- `releases/0.1.0-dev.1.md`：第一个本地 dev build 的范围、构建命令和交接说明。
