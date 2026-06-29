# Testing 进度

## 当前状态

- Phase 0 已建立第一批协议验证测试。
- Phase 1 已建立 Adapter Host 单元测试与 Electron Adapter/Probe 集成级测试。
- Phase 2 已建立 deterministic graph、data-flow graph、context pack、搜索因果链、
  server API surface 和隔离 LLM 可理解性验证。
- Phase 3 已建立 executable capability mining、slots/action plan/effects/risk 和低置信度
  自动执行门槛验证。
- Phase 5 已建立 Claude Code MCP smoke test、AnalysisService bridge 回归、Console audit
  回归和真实 stdio `tools/call` 回归。

## 已完成

- Rust：`aom-protocol-rs` 读取共享 JSON fixtures，验证 raw event、gateway request、permission enum round-trip、protocol envelope 和 Phase 0 payload 覆盖。
- TypeScript：`@aom/protocol` 的 `pnpm test` 会执行 typecheck、build 和 runtime fixture checks，验证共享 JSON fixtures 与 envelope helper 的运行时 round-trip。
- Rust：验证 target/probe 注册、静态/动态 snapshot 路由、动作路由和事件 sequence 拒绝策略。
- Rust：验证 PE magic/architecture、Electron 布局 fingerprint、Generic Web 降级路由和 unknown 安全结果。
- TypeScript：直接扫描 `targetAPP/dist`，验证不依赖 `src/`，并生成 application、renderer process 和 API endpoint 结构。
- TypeScript：使用 fake CDP client 验证 DOM snapshot、click/network event 和 click action。
- TypeScript：使用合成 ASAR 验证 virtual artifact、package entrypoint、process role、HTML asset、API、dependency 和 native module 恢复。
- TypeScript：验证恶意 ASAR `..` 路径会被拒绝。
- 动态侧除 fake CDP 单测外，已对打包 PlateRun 完成真实 Playwright Electron/CDP 集成验证。
- Rust 与 TypeScript 均验证 Analyzer JSONL 协议；Rust registry 测试会真实启动受控 Node 子进程。
- TypeScript：验证 `attach_existing` 没有显式 CDP endpoint 时不会回退到
  `executablePath` 启动/重启目标应用。
- TypeScript：验证 `copy_for_static_analysis` 会先复制 artifact；初始化后删除原始
  artifact，静态分析仍能从副本识别 endpoint。
- 真实 PlateRun：验证用户预启动且未开启 CDP endpoint 时，`attach_existing` 返回
  `attach_existing_requires_cdp_url`，不会回退到 `executablePath`；误把业务 API 端口
  `4545` 当 CDP endpoint 也失败，原进程 PID 保持存活。
- 真实 PlateRun：验证 `launch_owned` 可由 AOM 拉起 app，采集 22 -> 142 runtime nodes，
  执行 wait/set_text/scroll/back/click，收集 11 个事件，并在 `session.close()` 后清理
  AOM 拥有的进程。
- 新增手动集成脚本 `AOM/tests/integration/launch-for-handoff.mjs`，用于验证
  `launch_for_handoff`：AOM 拉起带 CDP 的 app、采集 snapshot、detach 后进程保留、
  再次 attach 采集 snapshot、再次 detach 后进程仍保留。
- 真实 PlateRun：`launch_for_handoff` 首次运行保留 CDP endpoint
  `http://127.0.0.1:64604`；AOM detach 后再次 attach 成功采集 142 runtime nodes。
- TypeScript：`WebSocketCdpClient.close()` 已覆盖 detach 清理，避免 AOM 断开 CDP 后
  Node 事件循环挂住。
- TypeScript：`@aom/agent-mcp` smoke test 覆盖 MCP initialize、tools/list 和
  `aom.session_status`。
- TypeScript：`@aom/agent-mcp` smoke test 已验证 MCP `tools/call` 会写入 JSONL audit
  record。
- TypeScript：`@aom/agent-mcp` smoke test 会通过 `aom-analysis-bridge` 读取真实
  PlateRun raw bundle，并验证 Rust AnalysisService 输出 product group、cart state、
  data flows 和 `add_to_cart` capability。
- TypeScript：`@aom/agent-mcp` smoke test 验证 context view 暴露 `rawReference`，
  `aom.invoke_view` 的 rawId fallback 可生成 graph-backed RawAction。
- TypeScript：`@aom/agent-mcp` smoke test 用 monkeypatched OpenAI-compatible
  `/chat/completions` 响应验证 LLM recognizer 解析候选并通过 deterministic validator 追加
  `ExecutableCapability`，不需要真实网络。
- TypeScript：`@aom/console` smoke test 使用临时 audit JSONL 验证 `aom-console audit`
  文本输出和 `--json` 输出。
- 真实 MCP 协议：stdio server 通过 `tools/call` 调用 `aom.attach_existing` 接入
  `http://127.0.0.1:64604`，随后 `aom.context_pack` 返回 capabilities，`aom.detach`
  返回 retained target 信息。
- Rust：验证 `TargetConnection.lifecycle` 的 `attach_existing` 协议 round-trip。
- Rust：验证语义 view ID 不受 raw DOM path 变化影响。
- Rust：验证 Unicode view labels 生成不同稳定 ID，并在 context pack 中保留 rawReference。
- Rust：验证静态/动态 endpoint 合并、登录 transition、event sequence、session/cart/menu
  分离和 product/action 关系。
- Rust：验证 Phase 2 MVP node/edge 覆盖，包含 `capability`、`storage_key`、
  `reads`、`writes` 和 `EvidenceKind::Verified`。
- Rust：验证搜索输入链路，Search view -> text input event -> `/api/stores`
  request/response -> DOM mutation/result diff -> `search_product` capability。
- Rust：验证字段级数据流，Search input value -> request query field -> request
  message -> response message -> rendered UI fact，并验证 context pack 输出 data flows。
- Rust：验证 `add_to_cart` 纵向能力闭环，Add click + cart count increase + state
  mutation 会生成 verified Evidence、`updates` edge 和 context `capabilityVerifications`。
- Rust：验证 `aom-analysis-server` 暴露 `snapshot`、`query`、`capabilities`、
  `observe`、`verify` 进程内 API。
- Rust：验证 `search_product` 输出 `keyword` slot、action plan 和 expected effects。
- Rust：验证 `add_to_cart` executable capability 可携带 verified cart update Evidence。
- Rust：验证 historical `login` 不会因为旧 screen/view 存在而在当前 Browse screen
  标记为 available，也不会把 `login.submit` 指向非当前 target。
- Rust：验证 `checkout_prepare` fixture 在 `Place order` view 存在时 available，但
  high risk 且不可自动执行。
- Rust：验证低置信度 capability 不会默认自动执行。
- Rust：验证 `AnalysisService::capabilities()` 返回 P3 executable capability 对象。
- TypeScript：验证 DOM/CDP 两条事件通道按 observation timestamp 合并后再分配 sequence。
- TypeScript：验证 Electron Runtime click 优先使用 CDP mouse event；`set_text` 支持
  React-compatible value setter、`input/change` 事件和可选 `Enter` 提交。
- TypeScript：`@aom/agent-mcp` smoke test 验证 capability 输入 slot 别名映射：
  `search_product` 可用 `text_input` 输入映射到真实 `keyword` slot，并生成 `submitKey=Enter`。
- TypeScript：`@aom/agent-mcp` smoke test 验证 context window routing：
  `routeContext` 会为搜索任务选择 `ui:header` 和 `dataflow:all`，每个窗口都有
  `beforeSummary + window + afterSummary`；`contextWindow` 可按 `windowId/offset/limit`
  展开数据流和 UI 主窗口。
- TypeScript：`@aom/agent-mcp` smoke test 验证 context delta：
  搜索 capability 的前后 graph diff 出现 search endpoint 和新 clickable result view 时，
  `contextDelta.outcome.status` 为 `verified`，并推荐 `open_content_result`，用于阻止
  Agent 重复搜索；同时覆盖 `no_change` 和 action dispatch failed 两个负例，避免把无变化
  或失败动作误判为任务成功。
- TypeScript：`@aom/agent-mcp` smoke test 验证 Agent-facing compact payload 不包含完整
  `contextPack`，并验证 search delta 会暴露具体 `recommendedTargets`，避免 Agent 只拿到
  抽象下一步名称。
- TypeScript：`@aom/agent-mcp` smoke test 验证 `contextWindow` offset 越界会夹到非空尾页，
  避免空窗口导致 Agent 继续翻页扩大上下文。

## Phase 1 验证记录

### 2026-06-24

- Electron 静态 Adapter 对清理后的 `targetAPP/dist` 产出 10 个 artifact、29 个 static node、33 条 edge。
- 节点类型包含 application、artifact、process component、module dependency、API endpoint。
- 识别 endpoint：`/api/addresses`、`/api/categories`、`/api/login`、`/api/orders`、`/api/me`、`/api/stores`、`/api/stores/:id`。
- `cd AOM && cargo test`：通过。
- `cd AOM && pnpm test && pnpm build`：通过。
- `cd targetAPP && pnpm test && pnpm build`：通过，目标应用源码无改动。
- `ArtifactParser` 对 `targetAPP/dist` 返回 `directory + generic_web + adapter:web-artifact`。
- `aom-inspect-artifact ../targetAPP/dist` 可输出完整 JSON inspection 和三条 Web artifact Evidence。
- 默认 ASAR backend 切换为 `@electron/asar` 后，PlateRun 和 harderTestApp 的 artifact/node/edge 规模与内部 reader 版本一致。
- `@electron/fuses` 对两个真实 Electron binary 均成功读取 fuse wire。
- Playwright 启动修复后的 PlateRun，采集 22 个 runtime node，并成功执行一次 `set_text` RawAction。
- 工具链集成 trace：`AOM/docs/traces/2026-06-24-electron-toolchain-integration.md`。

### 2026-06-25 动态登录链路

- 使用初始 runtime snapshot 返回的 `rawId` 选择电话、密码和登录按钮，没有使用源码 selector。
- 三个 RawAction 全部成功：两次 `set_text` 和一次 `click`。
- 登录前 22 nodes，登录后 142 nodes，观察到用户、导航、餐厅和分类等新状态。
- 采集 11 个事件：3 request、3 response、2 text input、1 click、2 state change。
- 网络链路为 `POST /api/login -> 200`、`GET /api/addresses -> 200`、`GET /api/orders -> 200`。
- 首次运行发现 raw CDP Evidence 泄露 request body 和 token；已增加网络摘要与敏感 header 脱敏测试。
- 重跑确认密码、电话号码、Bearer token 和 `postData` 均不出现在 RawEvent 中。
- 详细记录：`AOM/docs/traces/2026-06-25-platerun-dynamic-analysis.md`。

### 2026-06-25 Phase 1 收尾

- 动作测试覆盖 `click`、`set_text`、`scroll`、`back`、`wait_for`，并验证缺失 DOM target 返回失败。
- 事件测试覆盖 click、text input、navigation、state change、network request/response。
- Event Bus 测试验证批量 sequence 失败不会部分提交，且不同 target 只 drain 自己的事件。
- stdio server 测试验证 `adapter:web-artifact` 自动路由、静态 snapshot 和 tool provenance。
- Rust registry 测试验证 generic Web、unknown file fallback、runtime snapshot、event 和 action reply。
- `pnpm test:integration:electron` 会启动真实 PlateRun，覆盖五种动作、失败动作、11 个事件和 22 -> 142 nodes 状态变化。
- Rust Host -> TypeScript Analyzer 真实验证输出 15 artifacts、103 static nodes、122 edges、22 runtime nodes。
- 详细收尾记录：`AOM/docs/traces/2026-06-25-phase-1-closure.md`。

## 真实应用实验

### 2026-06-25 Phase 2 PlateRun Analysis

- 对真实打包 PlateRun 登录流程产出 103 static nodes、22 -> 142 runtime nodes 和 11 events。
- Analysis Core 初版产出 79 AOM nodes、113 edges 和 86 Evidence records。
- P2 审计收尾后重新生成 85 AOM nodes、123 edges 和 93 Evidence records；新增
  3 个 capability、3 个 storage key、`reads` / `writes` 边和 1 个 verified
  Evidence。
- 数据流补全后重新生成 123 AOM nodes、194 edges 和 113 Evidence records；新增
  32 个 data field、6 个 message、`flows_to` / `renders_as` 边，并通过 0 missing /
  0 empty Evidence closure 检查。
- Phase 3 capability 输出后重新生成 124 AOM nodes、196 edges 和 114 Evidence records；
  `capabilities.json` 包含 `login`、`search_product`、`view_product_detail`、
  `add_to_cart` 四个可查询能力；其中 `login` 因当前 Browse screen 没有登录按钮而为
  `missing_target`。
- `add_to_cart` 的能力效果验证目前由合成 before/event/after fixture 覆盖，用来锁定
  Analysis 规则；真实 GUI add-to-cart capture 仍待本机进程授权恢复后补跑。
- attach-existing/handoff trace 证明当前生命周期边界正确，但也暴露默认动态覆盖不足：
  未开启 CDP 的已运行 Electron 仍需要后续 OS-level fallback adapter。
- launch-owned trace 证明当用户明确允许 AOM 拥有目标生命周期时，现有 Electron 动态
  通道可以完成高保真观察、动作执行、事件采集和状态验证。
- launch-for-handoff trace 用于验证“由 AOM 拉起调试态 app，但生命周期交还给用户”的
  曲线 runtime 模式。
- 三轮 schema 迭代使用全新隔离 LLM，只提供 context pack，评分为 78、74、88/89。
- 74 分轮次证明 flat visible facts 增加上下文后反而造成 cart/menu/price 歧义。
- 最终 evaluator 能准确规划 Search、Open cart、Orders 和单次 Add action。
- 最终 evaluator 未再混淆商品价格、菜单/购物车数量、静态/动态 endpoint 或历史 view。
- Live add-to-cart capture 脚本已添加，但本机进程授权额度阻止了本轮启动，不记为通过。
- 详细记录：`AOM/docs/traces/2026-06-25-phase2-llm-context-evaluation.md`。

### 2026-06-24 harderTestApp

- 对 `harderTestApp/哔哩哔哩.app` 完成只读静态实验，未启动目标。
- `ArtifactParser` 识别为 `mac_app_bundle`，Electron confidence 为 `0.99`，推荐 `adapter:electron-artifact`。
- 单独主 Mach-O 只能识别容器，无法推断 Web Runtime，证明整包上下文对 framework routing 必要。
- 修复前 Electron Adapter 只输出 12 artifacts、13 nodes、12 edges。
- 只读 ASAR header 验证内部有 7,928 个文件、main/preload/bridge、271 个 renderer 文件、23 个 HTML 页面和 19 个 native module。
- 修复后输出 317 artifacts、668 nodes、1,175 edges；恢复 bootstrap/main/renderer、348 个 package dependency、20 个 native module 和 111 条 HTML asset edge。
- 详细记录：`AOM/docs/traces/2026-06-24-harder-test-app-static-analysis.md`。

### 2026-06-24 targetAPP macOS package

- 使用 `electron-builder` 生成 arm64 `PlateRun.app`，未增加 AOM 专用代码。
- `ArtifactParser` 对打包产物识别为 Electron `0.99`。
- 未打包 `dist` 输出 29 nodes、33 edges、3 个 process role、7 个 endpoint。
- 修复前打包 `.app` 只输出 6 nodes、5 edges。
- 只读 ASAR 验证可恢复 9 个应用文件、main/preload/renderer/backend、全部 endpoint 和模块依赖。
- 修复后打包 `.app` 输出 15 artifacts、103 nodes、122 edges；恢复 3 个 process role、7 个 endpoint、78 个 package dependency 和 2 条 HTML asset edge。
- 详细记录：`AOM/docs/traces/2026-06-24-targetapp-packaged-analysis.md`。

## 近期目标

- 增加 `chrome-remote-interface` 对已运行目标的 attach 集成测试。
- 规划 Gateway 策略测试。
- 规划 Agent 工具端到端测试。
