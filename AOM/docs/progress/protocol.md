# Protocol 进度

## 当前状态

- Phase 0 协议基线已落地。
- 已记录跨进程通信决策：`AOM/docs/decisions/0001-cross-process-communication.md`
- 已创建 Rust crate：`AOM/crates/aom-protocol-rs`
- 已创建 TypeScript package：`AOM/packages/aom-protocol-ts`
- 已创建共享 fixtures：`AOM/tests/fixtures/raw-event.json`、`AOM/tests/fixtures/gateway-request.json`

## 已完成

- 建立 Rust 和 TypeScript 的共享协议定义。
- 覆盖 Target、RawEvent、Snapshot、Action、AOM Graph、Capability、Gateway request/response。
- 增加跨语言序列化样例。
- 设计 transport-neutral `ProtocolMessage` envelope，避免业务逻辑绑定到 WebSocket、stdio 或 OS IPC。
- 验证 Rust/TS 都可读取同一批 JSON fixtures。
- Phase 0 review 收尾：实现层统一使用 `RawRuntimeSnapshot`，与计划文档命名一致。
- `ProtocolPayload` 已覆盖 Phase 0 关键对象：Target、RawEvent、RawRuntimeSnapshot、RawAction、RawActionResult、AOMNode、AOMEdge、AOMCapability、EvidenceRef、GatewayRequest、GatewayDecision、GatewayResponse。

## 验证记录

### 2026-06-23

- `cd AOM && cargo test`：通过，5 个 Rust fixture/payload/round-trip 测试通过。
- `cd AOM && pnpm test`：通过，TypeScript typecheck、build 和 runtime fixture checks 均通过。
- `cd AOM && pnpm build`：通过，`@aom/protocol` 可生成 `dist/`。

## 后续目标

- Phase 1 启动前，根据 Adapter Host 需要补充 Probe manifest、target status 和 raw event stream envelope。
- 保持 Rust/TypeScript 类型同步；新增协议字段时必须同步 fixtures 和两侧测试。
