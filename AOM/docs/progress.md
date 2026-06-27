# AOM 进度索引

本文件只作为进度索引和最新摘要。详细进度必须按模块写入 `AOM/docs/progress/` 下的独立文件，避免总文件占用过多上下文。

## 模块进度文件

- Adapter Host：`AOM/docs/progress/adapter-host.md`
- Analysis Layer：`AOM/docs/progress/analysis.md`
- Capability Layer：`AOM/docs/progress/capability.md`
- Safety Gateway：`AOM/docs/progress/gateway.md`
- Agent Interaction Layer：`AOM/docs/progress/agent-server.md`
- Protocol：`AOM/docs/progress/protocol.md`
- Console：`AOM/docs/progress/console.md`
- targetAPP：`AOM/docs/progress/target-app.md`
- Cross-module testing：`AOM/docs/progress/testing.md`

## 最新摘要

### 2026-06-27

- Phase 5 跳过完整 P4，先交付 Claude Code MCP demo surface：新增
  `@aom/agent-mcp`，包含 provider-neutral `AgentInteractionService` 和 stdio
  `AOMMcpServer`。
- MCP tools 已覆盖 `aom.launch_for_handoff`、`aom.attach_existing`、`aom.snapshot`、
  `aom.context_pack`、`aom.analysis_graph`、`aom.capabilities`、`aom.invoke_capability`、
  `aom.invoke_view`、`aom.detach` 和 `aom.session_status`。
- P5 重构为 AnalysisService-backed Agent surface：MCP 不再使用本地 shortcut context 或
  P4-lite guard；`context_pack`、`analysis_graph`、`capabilities` 均来自 Rust
  AnalysisService / Capability Layer，risk metadata 只作为未来 Gateway 的输入。
- Console audit baseline 已启动：新增 `@aom/console` CLI；`@aom/agent-mcp` 对每个
  MCP `tools/call` 写 JSONL audit record，Console 可查看调用 timeline、参数摘要、动作结果、
  event count、graph/capability 摘要和错误信息。
- 真实 MCP 协议回归已通过：stdio `tools/call` 接入现有 handoff endpoint
  `http://127.0.0.1:64604`，`aom.context_pack` 返回 capabilities，`aom.detach` 返回
  retained target 信息。
- Target lifecycle 已落地到协议和 Electron Analyzer：`attach_existing`、`launch_owned`、
  `copy_for_static_analysis` 明确区分已运行应用、AOM 拥有的启动进程和副本静态分析。
- 已运行目标不允许被 AOM 静默关闭或重启；`attach_existing` 缺少 `cdpUrl` 时初始化失败，
  不会回退到 `executablePath`。
- 静态分析需要读取 artifact 时，`attach_existing` 和 `copy_for_static_analysis` 会先复制
  artifact 到临时目录，再让静态 Adapter 分析副本，session close 时清理副本。
- 项目方向文档补充两个风险边界：当前 capability 规则是 MVP recognizer recipe，不是
  通用应用理解；当前数据流是 evidence-linked MVP data-flow graph，不是完整数据血缘。
- 对用户预启动的 PlateRun 完成 attach-existing/handoff 实验：该进程未暴露 CDP endpoint，
  AOM 明确返回 `attach_existing_requires_cdp_url`，不会回退到 `executablePath` 重启应用；
  尝试把业务 API 端口 `4545` 当 CDP 也失败，原 PlateRun PID 保持存活。
- 对 `launch_owned` 完成对照实验：AOM 自己拉起 PlateRun 后采集 22 个初始 runtime
  node，执行 wait/set_text/scroll/back/click，登录后增长到 142 nodes，采集 11 个事件；
  `session.close()` 后无 PlateRun 进程残留。
- 新增 `launch_for_handoff` 生命周期：AOM 可 detached 启动带
  `--remote-debugging-port=<port>` 的 app，通过 CDP 介入；AOM detach 后 app 保留给用户，
  后续仍可通过同一 CDP endpoint 再次介入。
- 真实 handoff 实验使用 `http://127.0.0.1:64604` 成功再次介入 PlateRun，重连后采集
  142 个 runtime nodes；修复 `WebSocketCdpClient.close()`，确保 AOM detach 后本地连接
  进程能退出。

### 2026-06-26

- Phase 3 Capability MVP 已落地：新增 Rust crate `aom-capability`，从 AOM graph
  输出 `ExecutableCapability`，包含 protocol-compatible `AOMCapability`、input slots、
  action plan、expected effects、availability、riskLevel 和 automation policy。
- `aom-analysis-server.capabilities()` 现在返回 P3 可执行能力对象；bundle CLI 新增
  `capabilities.json` 输出，供 Agent/审计读取。
- 第一版挖掘规则覆盖 `login`、`search_product`、`view_product_detail`、
  `add_to_cart`、`checkout_prepare`；当前 trace 只返回有 graph 证据的能力，不虚构
  当前 screen 不具备的下单入口。
- 真实 PlateRun trace 重新生成：124 nodes、196 edges、114 Evidence records，包含
  4 个 capability。`capabilities.json` 中 `login` 为 medium risk、不可自动执行，且因
  当前 Browse screen 没有登录按钮而是 `missing_target`；`search_product`、
  `view_product_detail`、`add_to_cart` 为 low risk 且具备当前目标。
- `search_product` 声明 `keyword` slot、set_text/observe/verify 三步计划和
  `search.query` + `/api/stores` expected effects；`add_to_cart` 声明 product slot、
  click/observe/verify 三步计划和 `cart.items` expected effect。
- 低置信度 capability 不会默认自动执行；medium/high risk 能力等待 Phase 4 Gateway
  做 allow/deny/confirmation。
- P3 审计收尾：动作 target 选择已限制为当前 screen 的 interactive view；新增
  historical login 与 checkout high-risk fixture，覆盖当前可用性和不可自动执行语义。

### 2026-06-25

- Phase 2 行为因果闭环打磨：新增 `add_to_cart` effect verifier，Add click + cart
  count increase + state mutation 会生成 verified Evidence、`updates` edge 和 context
  `capabilityVerifications`。
- Phase 2 数据流图补全：协议和 Analysis graph 新增 `data_field`、`message`、
  `flows_to`、`renders_as`、`derives_from`、`updates`；context pack 新增 data flow
  摘要。
- 真实 PlateRun graph 重新生成后为 123 nodes、194 edges、113 Evidence records；
  flow/evidence closure 为 0 missing、0 empty edge。
- Phase 2 审计收尾完成：`aom-analysis-server` 补齐
  `snapshot/query/capabilities/observe/verify` 进程内 API；Analysis graph 补齐
  `capability`、`storage_key`、`reads`、`writes` 和 verified Evidence。
- 真实 PlateRun graph 已重新生成：85 nodes、123 edges、93 Evidence records；
  包含 `login`、`search_product`、`add_to_cart` capability 和
  `session.authenticated`、`search.query`、`cart.items` storage key。
- 搜索验收新增 before/event/after fixture，验证 Search view 到 `/api/stores`
  request/response、DOM mutation/result diff 和 `search_product` capability 的因果链。
- Phase 2 deterministic Analysis Core 已落地：稳定 Identity、Evidence、图构建、diff、
  query、transition verification 和 LLM context pack。
- 真实 PlateRun 登录输入生成 79 AOM nodes、113 edges、86 Evidence records。
- 通过多轮无上下文 LLM 盲测驱动 schema 修改，理解与安全规划评分从 78/74 提升到
  88/89；商品价格、菜单/购物车数量、事件顺序和 endpoint 来源已明确。
- 新增真实 add-to-cart capture 脚本；本轮因本机进程授权额度未能完成 live run，未标记
  为已验证。
- Phase 1 已完成收尾：Rust Adapter Host 可通过 typed stdio JSONL 自动启动并连接 TypeScript Electron Analyzer。
- Parser -> registry -> Adapter 路由已闭合，支持 Electron、generic Web 和 unknown generic artifact fallback。
- 修复 `Runtime.evaluate` 异常误报成功和 Event Bus 跨 target/部分提交风险。
- 动态 snapshot/event/action 已携带 Playwright tool/version/source Evidence，Host 保存完整记录。
- 自动测试覆盖五种动作、失败动作、输入/导航/状态/网络事件；真实 GUI integration 验证 22 -> 142 nodes。
- 对打包 PlateRun 完成真实动态登录实验：初始 22 runtime nodes，三个 object-addressed RawAction 全部成功，登录后增长到 142 nodes。
- 采集 click、text input、state change、network request/response 共 11 个事件，证明当前 Probe 可观察真实状态迁移。
- 修复网络 Evidence 泄露 CDP request body 和 token 的问题；敏感 header 现已脱敏，请求正文不再进入协议事件。
- 详细 trace：`AOM/docs/traces/2026-06-25-platerun-dynamic-analysis.md`。
- Phase 1 收尾 trace：`AOM/docs/traces/2026-06-25-phase-1-closure.md`。

### 2026-06-24

- Phase 1 采用静态制品分析与动态运行时分析双通道。
- 静态分析保持 Adapter 设计，不以源码为前提；Electron MVP 从 `targetAPP/dist` 生成 application/process/artifact/module/endpoint component network。
- 新增 `aom-adapter-host`、`@aom/electron-probe`、静态 snapshot 协议和对应测试。
- 设计决策记录于 `AOM/docs/decisions/0002-static-and-dynamic-analysis.md`。
- Adapter Host 新增前置 `ArtifactParser`，为未知二进制/目录输出容器类型、runtime candidates、confidence、Evidence 和推荐 Adapter。
- 解析器与分析器边界记录于 `AOM/docs/decisions/0003-artifact-parser-routing.md`。
- 使用 `harderTestApp/哔哩哔哩.app` 完成首次真实应用实验并推动 ASAR 修复；详细 trace 已写入 `AOM/docs/traces/`。
- Electron Adapter 已原生支持只读 ASAR virtual filesystem。PlateRun 打包分析从 6 nodes 恢复到 103 nodes；harderTestApp 从 13 nodes 恢复到 668 nodes。
- 明确 Analyzer Adapter 是 AOM 向下调用现成分析/调试工具的模块；当前自写 ASAR/CDP 代码定位为 fallback 和协议原型，设计见 ADR 0004。
- Electron 工具链已局部接入 `@electron/asar`、`@electron/fuses`、Playwright 和 `chrome-remote-interface`；默认生产路径不再依赖自写 ASAR/CDP transport。
- 首次真实动态回归已完成：Playwright 启动打包 PlateRun，采集 22 个 runtime node 并成功执行 `set_text`。

### 2026-06-23

- 建立 AOM 文档目录。
- 新增总体分期实现计划。
- 确定进度按模块拆分记录，`progress.md` 仅保留索引和最新摘要。
- 完成 Phase 0 项目奠基：新增 `AOM/` 独立 Rust/TypeScript workspace、共享协议 crate/package、跨语言 JSON fixtures 和基础验证命令。
- 验证结果：`cd AOM && cargo test`、`cd AOM && pnpm test`、`cd AOM && pnpm build` 均通过。
- 根据 Phase 0 review 完成收尾：统一 `RawRuntimeSnapshot` 命名、补齐 envelope 关键 payload、让 TypeScript 测试执行 runtime fixture checks。
