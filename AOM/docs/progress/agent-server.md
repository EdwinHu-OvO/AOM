# Agent Interaction Layer 进度

## 当前状态

- Phase 5 Claude Code MCP demo surface 已实现。
- 新增 TypeScript package：`@aom/agent-mcp`。
- `AgentInteractionService` 已作为 provider-neutral 交互层，负责 AOM session、
  target lifecycle、runtime snapshot、Rust AnalysisService 调用、capability 调用和 detach。
- `AOMMcpServer` 已作为 stdio MCP JSON-RPC bridge，供 Claude Code / Claude Desktop 调用。
- 本阶段跳过 Phase 4 Gateway。P5 不实现 P4-lite guard，不把 demo 交互层伪装成安全边界；
  risk metadata 只作为 Agent/用户决策输入，正式 allow/deny/confirmation 由未来 Gateway 负责。

## 已完成

- MCP tools：
  - `aom.launch_for_handoff`
  - `aom.attach_existing`
  - `aom.snapshot`
  - `aom.context_pack`
  - `aom.route_context`
  - `aom.context_window`
  - `aom.analysis_graph`
  - `aom.capabilities`
  - `aom.invoke_capability`
  - `aom.invoke_view`
  - `aom.detach`
  - `aom.session_status`
- `aom.launch_for_handoff` 复用 Electron Probe 的 handoff runtime：AOM 拉起带
  `--remote-debugging-port=<port>` 的 PlateRun，detach 后 app 保留给用户。
- `aom.attach_existing` 可重新接入 handoff 返回的 `cdpUrl`。
- 新增 `aom-analysis-bridge` Rust binary：MCP 层把 static/runtime observation 送入
  Rust `AnalysisService`，返回完整 graph、context pack、capabilities 和 verification。
- `aom.context_pack` 暴露 Rust AnalysisService 输出：graph summary、current screen、
  context pack data flows、capability objects 和 verification。它不再是 MCP 本地拼装的
  compact runtime summary。
- 新增 context window routing：
  - `aom.route_context` 根据 task 返回多个窗口，每个窗口都是
    `beforeSummary + exact window + afterSummary`。
  - `aom.context_window` 可按 `windowId`、`offset`、`limit` 展开任意窗口。
  - 当前窗口包括 `ui:primary_actions`、`ui:header`、`ui:main`、`dataflow:all`、
    `event:recent` 和 `capability:all`。
  - 折叠只做结构折叠、重复折叠和任务路由折叠；低价值元素不全局删除，只是进入低优先级
    或后续窗口。
  - 数据流窗口与 UI 窗口并列返回，完整 graph/data-flow 仍可通过 `aom.analysis_graph`
    和 context pack 追溯。
- 新增 context delta：
  - `aom.invoke_capability` 和 `aom.invoke_view` 会返回 `contextDelta`，描述 action 前后
    的 UI、data object、network、data-flow、capability 变化。
  - `contextDelta.outcome` 给出 `verified`、`changed`、`ambiguous`、`no_change` 或
    `failed`，并包含 evidence ids 和 next-step hint。
  - `aom.context_delta` 可读取 session 最近一次 delta，避免动作结果过大被外部工具持久化后
    Agent 丢失“刚刚发生了什么”。
  - 搜索场景中，如果观察到 search/suggest endpoint 或结果列表变化，delta 会推荐
    `open_content_result`，用于阻止 Agent 反复输入/提交同一个搜索。
  - `contextDelta.capabilities.recommendedTargets` 现在会给出可直接 `aom.invoke_view`
    的候选结果 view，优先包含本次 action 后新增的 clickable result，避免 Agent 只能看到
    抽象的 `open_content_result` 却不知道点哪里。
- 新增 dynamic call chain：
  - MCP 工具 `aom.call_chain` 只返回建议调用链，不执行动作，也不隐藏现有工具接口。
  - 每个 step 包含 `toolName`、`arguments`、`reason`、`expectedOutcome` 和 `stopIf`，
    用于让外部 Agent 在每次工具调用后重新评估，而不是沿用旧计划。
  - `launch_for_handoff`、`attach_existing`、`route_context`、`context_window`、
    `context_delta`、`context_pack`、`capabilities`、`analysis_graph`、`invoke_capability`
    和 `invoke_view` 都会刷新 session 的 `nextCallChain`。
  - 当最近一次 `contextDelta` 已验证搜索/状态变化且存在 `recommendedTargets` 时，调用链会把
    下一步切到具体 `invoke_view`/`invoke_capability`，避免 Agent 继续重复已成功动作。
  - 当最近一次动作 `failed` 或 `no_change` 时，调用链会回到 `route_context` +
    `context_window`，要求重新选目标而不是机械重试。
  - 设计记录见 `AOM/docs/design/dynamic-call-chain.md`。
- MCP 默认返回面已收窄：
  - `aom.launch_for_handoff`、`aom.attach_existing`、`aom.invoke_capability` 和
    `aom.invoke_view` 默认只返回 compact analysis summary，不再内联完整 context pack。
  - 完整 context pack 仍可通过 debug/legacy 工具 `aom.context_pack` 显式请求。
  - 这次调整针对 B 站回归中单次 `invoke_capability` 返回 600KB+、`invoke_view`
    返回 300KB+ 导致 Claude Code 将结果持久化并消耗上下文的问题。
- `aom.route_context` 在没有显式 task 时会参考最近一次 `contextDelta.outcome.nextStepHint`
  做窗口路由，并在返回中带 `lastContextDelta` 摘要，避免 Agent 刚看完 delta 又丢掉动作因果。
- `aom.context_window` 的 offset 越界现在会夹到最后一个非空窗口页，不再返回空窗口诱导
  Agent 继续翻页。
- MCP tool descriptions 已改为操作契约，明确推荐流程：
  `launch/attach -> call_chain/route_context -> context_window 按需展开 -> invoke_capability -> contextDelta + call_chain 验证并重规划`。
  `context_pack`、`analysis_graph`、`snapshot` 被标记为 debug/legacy/large context 工具，避免
  Agent 默认读取大 JSON 后自行猜测按钮。
- `invoke_capability` 和 `invoke_view` 的描述现在明确区分 action dispatch 成功与任务效果成功；
  `actionResult.ok` 不代表用户目标完成，必须优先检查 `contextDelta.outcome`，再结合
  analysis、eventCount、data-flow/effect 或再次调用 `route_context`。
- `aom.analysis_graph` 暴露完整当前 AOM graph，供上层 Agent 在规划失败或需要解释时读取
  节点、边、Evidence、StorageKey、Capability、DataObject 和数据流。
- MCP 启动时会读取 `AOM/aom.config.json` 或 `AOM_CONFIG` 指定文件。当前配置用于控制
  OpenAI-compatible LLM capability recognizer，默认关闭。
- 启用 recognizer 后，`analyzeSession` 会在 Rust AnalysisService 输出后调用模型生成
  capability candidates，并由 AOM validator 校验 current view/action/rawReference 后追加到
  `analysis.capabilities`。
- Agent payload 现在暴露 `readiness`：`runtimeReady`、`analysisReady`、`semanticReady`、
  `capabilityReady` 和状态原因。`launch_for_handoff`、`context_pack`、`invoke_view` 的返回与
  audit 摘要都会带上该状态，避免上层把“CDP 已连接”误解成“语义能力可执行”。
- `aom.capabilities` 直接返回 Capability Layer 的 `ExecutableCapability`，包含 action plan、
  slots、expected effects、availability、risk/confidence 和 reasons。
- `aom.invoke_capability` 解析 Capability Layer 的 action plan 并映射到 graph 上的
  `rawReference`。`add_to_cart` 可用 `inputs.product` 从 context pack 的 product group
  选择对应 Add view，避免 Agent 只靠页面跳转反复试错。
- `aom.invoke_capability` 对文本 slot 做稳定别名映射，接受 `query`、`keyword`、`text`、
  `input`、`value`、`text_input`、`text input`、`search_query` 等常见输入名。LLM 生成的
  slot 名不会再成为 Agent 必须精确猜中的外部 API。
- 搜索类 `set_text` capability 会在填入文本后提交 `Enter`，用于覆盖真实 Web/Electron
  app 中搜索按钮无 label、submit button 不可靠或按钮点击不触发请求的情况。
- `aom.invoke_view` 支持按 `viewId` 或精确 label 调用当前 graph view，作为 capability
  粒度不足时的结构化兜底；现在也支持 `rawId` fallback，用于把 raw snapshot 中的节点映射回
  graph-backed action，仍不回退到坐标点击或 Agent 直接 CDP。
- MCP smoke test 覆盖 initialize、tools/list 和 session_status。
- MCP smoke test 使用真实 PlateRun raw bundle 通过 `aom-analysis-bridge` 回归 Rust
  AnalysisService 输出，断言可抽出 `Tonkotsu Ramen` product group、cart state、
  data flows 和 `add_to_cart` capability。
- 真实 MCP 协议回归已通过：通过 stdio `tools/call` 调用 `aom.attach_existing` 接入
  `http://127.0.0.1:64604`，随后 `aom.context_pack` 和 `aom.detach` 均返回预期内容。

## Claude Code 使用方式

先构建：

```text
cd /Users/edwinh/Desktop/AOM/AOM
pnpm build
```

MCP server command：

```text
node /Users/edwinh/Desktop/AOM/AOM/packages/aom-agent-mcp/dist/bin/aom-mcp-server.js
```

详细演示流程见 `AOM/docs/design/claude-code-mcp-demo.md`。

## 近期目标

- 将 Rust `AnalysisService` 做成长驻服务或 FFI/stdio bridge，让 MCP context pack 使用完整
  AOM graph；当前为 per-call bridge，优先正确性，后续再优化常驻进程性能。
- 接入正式 Phase 4 Safety Gateway，在 P5 tool invocation 前后加入 allow/deny/confirmation
  和审计，而不是在 MCP 层维持临时 guard。
- 增加 MCP trace/audit 文件输出，记录 tool call、risk、action result 和 evidence IDs。
- 增加 Claude Code 真实完整演示 trace：launch_for_handoff -> context_pack ->
  analysis_graph -> capabilities -> invoke_capability/invoke_view -> detach -> attach_existing。
- 将 LLM recognizer 的候选、拒绝原因和 prompt hash 接入更细粒度 Console artifact。
- 将 context delta 从 MCP 本地比较推进到 AnalysisService/Core 层，复用 graph diff、
  EvidenceKind::Verified 和 capability verification，减少 TS/Rust 双侧启发式差异。
- 根据 `readiness.capabilityReady` 调整外部 Agent 提示词：能力未 ready 时优先查询
  `analysis_graph`/`context_pack` 或使用 `invoke_view` 做受控探索，不应直接进入自主任务循环。
