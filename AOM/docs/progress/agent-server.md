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
- `aom.analysis_graph` 暴露完整当前 AOM graph，供上层 Agent 在规划失败或需要解释时读取
  节点、边、Evidence、StorageKey、Capability、DataObject 和数据流。
- `aom.capabilities` 直接返回 Capability Layer 的 `ExecutableCapability`，包含 action plan、
  slots、expected effects、availability、risk/confidence 和 reasons。
- `aom.invoke_capability` 解析 Capability Layer 的 action plan 并映射到 graph 上的
  `rawReference`。`add_to_cart` 可用 `inputs.product` 从 context pack 的 product group
  选择对应 Add view，避免 Agent 只靠页面跳转反复试错。
- `aom.invoke_view` 支持按 `viewId` 或精确 label 调用当前 graph view，作为 capability
  粒度不足时的结构化兜底；仍不回退到坐标点击。
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
