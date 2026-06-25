# AOM 进度索引

本文件只作为进度索引和最新摘要。详细进度必须按模块写入 `AOM/docs/progress/` 下的独立文件，避免总文件占用过多上下文。

## 模块进度文件

- Adapter Host：`AOM/docs/progress/adapter-host.md`
- Analysis Layer：`AOM/docs/progress/analysis.md`
- Safety Gateway：`AOM/docs/progress/gateway.md`
- Agent Interaction Layer：`AOM/docs/progress/agent-server.md`
- Protocol：`AOM/docs/progress/protocol.md`
- Console：`AOM/docs/progress/console.md`
- targetAPP：`AOM/docs/progress/target-app.md`
- Cross-module testing：`AOM/docs/progress/testing.md`

## 最新摘要

### 2026-06-25

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
