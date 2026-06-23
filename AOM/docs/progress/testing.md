# Testing 进度

## 当前状态

- Phase 0 已建立第一批协议验证测试。

## 已完成

- Rust：`aom-protocol-rs` 读取共享 JSON fixtures，验证 raw event、gateway request、permission enum round-trip、protocol envelope 和 Phase 0 payload 覆盖。
- TypeScript：`@aom/protocol` 的 `pnpm test` 会执行 typecheck、build 和 runtime fixture checks，验证共享 JSON fixtures 与 envelope helper 的运行时 round-trip。

## 近期目标

- 规划 Adapter Host 与 Electron Probe 集成测试。
- 规划 Gateway 策略测试。
- 规划 Agent 工具端到端测试。
