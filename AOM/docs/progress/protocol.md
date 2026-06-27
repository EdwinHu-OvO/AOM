# Protocol 进度

## 当前状态

- Phase 0 协议基线已落地。
- 已记录跨进程通信决策：`AOM/docs/decisions/0001-cross-process-communication.md`
- 已创建 Rust crate：`AOM/crates/aom-protocol-rs`
- 已创建 TypeScript package：`AOM/packages/aom-protocol-ts`
- 已创建共享 fixtures：`AOM/tests/fixtures/raw-event.json`、`AOM/tests/fixtures/raw-static-snapshot.json`、`AOM/tests/fixtures/gateway-request.json`
- Phase 1 Analyzer 子进程协议已在 Rust/TypeScript 两端落地。

## 已完成

- 建立 Rust 和 TypeScript 的共享协议定义。
- 覆盖 Target、RawEvent、Snapshot、Action、AOM Graph、Capability、Gateway request/response。
- 增加跨语言序列化样例。
- 设计 transport-neutral `ProtocolMessage` envelope，避免业务逻辑绑定到 WebSocket、stdio 或 OS IPC。
- 验证 Rust/TS 都可读取同一批 JSON fixtures。
- Phase 0 review 收尾：实现层统一使用 `RawRuntimeSnapshot`，与计划文档命名一致。
- `ProtocolPayload` 已覆盖 Phase 0 关键对象：Target、RawEvent、RawRuntimeSnapshot、RawAction、RawActionResult、AOMNode、AOMEdge、AOMCapability、EvidenceRef、GatewayRequest、GatewayDecision、GatewayResponse。
- Phase 1 新增 transport-neutral 静态制品模型：`RawArtifactDescriptor`、`RawStaticNode`、`RawStaticEdge`、`RawStaticSnapshot`。
- `RawRuntimeSnapshot.nodes` 已从 generic JSON 收紧为 `RawRuntimeNode`。
- 静态协议不包含源码路径、行列号等必需字段，保证二进制/打包制品 Adapter 可实现。
- 新增 `ArtifactInspection` 协议：容器类型、架构、runtime candidates、adapter recommendation 和检测 Evidence。
- Rust/TypeScript envelope 均可传输 `artifact_inspection` payload。
- 新增 `AnalyzerSessionConfig`、`AnalyzerCommand`、`AnalyzerReply`、`AnalyzerResult` 和 `AnalyzerFailure`。
- Analyzer stdio 使用 typed JSONL command/reply，不依赖 `ProtocolPayload::Json`。
- `EvidenceRef` 新增可选 tool name、version、source locator 和 metadata，用于跨进程携带 analyzer provenance。
- 新增共享 `analyzer-command.json` fixture，验证 Rust/TS 的初始化命令字段和枚举一致。
- Phase 2 数据流图扩展 AOM graph enum：新增 `data_field`、`message` 节点类型，
  以及 `flows_to`、`derives_from`、`renders_as`、`updates` 边类型。

## 验证记录

### 2026-06-23

- `cd AOM && cargo test`：通过，5 个 Rust fixture/payload/round-trip 测试通过。
- `cd AOM && pnpm test`：通过，TypeScript typecheck、build 和 runtime fixture checks 均通过。
- `cd AOM && pnpm build`：通过，`@aom/protocol` 可生成 `dist/`。

### 2026-06-24

- `cd AOM && cargo test`：通过，包含静态 snapshot fixture 与 Adapter Host 测试。
- `cd AOM && pnpm test`：通过，包含 Electron 制品 Adapter 与 CDP runtime Probe 测试。

### 2026-06-25

- `cd AOM && cargo test`：通过，包含 Analyzer command fixture、stdio proxy 与 registry 测试。
- `cd AOM && pnpm test`：通过，包含 Analyzer JSONL server runtime test。
- 真实 Rust Host -> TypeScript Analyzer 链路可传输静态、动态与工具 Evidence。
- Rust/TypeScript 协议均已同步 data-flow graph 节点/边枚举，`pnpm test && pnpm build`
  和 `cargo test` 均通过。
- `TargetConnection` 新增 `lifecycle`：`attach_existing`、`launch_owned`、
  `launch_for_handoff`、`copy_for_static_analysis`，用于区分已运行目标、AOM 拥有的启动
  进程、AOM 启动后可交还用户的调试进程和静态副本分析。
- Rust/TypeScript 均支持 lifecycle 序列化；Rust fixture 测试验证
  `attach_existing` snake_case round-trip。

## 后续目标

- 补充 Probe manifest、target status、长时 event stream 状态协议和 attach 断线重连状态。
- 保持 Rust/TypeScript 类型同步；新增协议字段时必须同步 fixtures 和两侧测试。
