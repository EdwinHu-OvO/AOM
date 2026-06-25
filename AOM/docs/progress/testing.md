# Testing 进度

## 当前状态

- Phase 0 已建立第一批协议验证测试。
- Phase 1 已建立 Adapter Host 单元测试与 Electron Adapter/Probe 集成级测试。

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
