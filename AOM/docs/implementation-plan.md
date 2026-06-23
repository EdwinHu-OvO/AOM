# AOM 分期实现计划

## 设计理解

AOM（Application Object Model）要为非 Web 应用建立 Agent 可查询、可验证、可复用的结构化对象层。Agent 不应依赖截图、OCR 和坐标点击，而应通过稳定对象 ID、运行时事件、数据流、证据链和能力模型理解应用。

核心边界：

- 平台差异留在 Adapter Host。
- 应用理解放在 Analysis Layer。
- Agent 只面对 AOM Tool Protocol。
- 所有操作必须经过 Safety Gateway。
- `targetAPP/` 保持通用消费应用，不加入 AOM 专用后门、隐藏测试按钮或特殊选择器。

目标进程：

| 进程 | 语言 | 职责 |
| --- | --- | --- |
| `aom-adapter-host` | Rust | 管理目标 App、Probe、原始事件采集和底层动作执行 |
| `aom-analysis-server` | Rust | 归一化事件，构建对象图、数据流、Capability 和 Evidence |
| `aom-gateway` | Rust | 权限控制、风险分级、脱敏、审计和能力隔离 |
| `aom-agent-server` | TypeScript | 提供 MCP/JSON-RPC 工具和 Agent 可读上下文 |
| `targetAPP` | Electron/React | 外部 demo 目标应用 |

## 目标模块布局

```text
AOM/
  crates/
    aom-protocol-rs/
    aom-adapter-host/
    aom-analysis-core/
    aom-analysis-server/
    aom-capability/
    aom-policy/
    aom-gateway/
  packages/
    aom-protocol-ts/
    aom-agent-server/
    aom-mcp-server/
    aom-console/
    aom-electron-probe/
  probes/
    electron/
    android/
    flutter/
  docs/
  tests/
```

## Phase 0: 架构基线与协议冻结

目标：冻结跨进程协议、安全边界和第一版对象模型。

交付物：
- 协议对象：`TargetDescriptor`、`RawEvent`、`RawRuntimeSnapshot`、`RawAction`、`RawActionResult`、`AOMNode`、`AOMEdge`、`AOMCapability`、`GatewayRequest`、`GatewayDecision`、`GatewayResponse`。
- 通信方式：采用 transport abstraction；MVP 可用 loopback WebSocket JSON-RPC 和 JSONL/WebSocket event stream，内部高权限链路后续优先 Unix Domain Socket/Named Pipe，Adapter Host 管理的 Probe 子进程可用 stdio JSONL。
- 权限等级：Level 0 read-only、Level 1 observe、Level 2 safe action、Level 3 sensitive action、Level 4 debug/internal。

验收标准：
- Rust 和 TypeScript 都有协议类型。
- 示例消息可跨 Rust/TS 序列化和反序列化。
- 文档明确 Agent 请求必须经过 Gateway。

## Phase 1: Electron 单平台采集 MVP

目标：从现有 `targetAPP` 采集结构、事件和基础动作结果。

交付物：
- `aom-adapter-host`：`TargetManager`、`ProbeManager`、`RawEventBus`、`SnapshotCollector`、`ActionExecutor`。
- `aom-electron-probe`：DOM 或 accessibility snapshot、click/input 事件、route 事件、mock network metadata、storage metadata。
- 底层动作：`click`、`set_text`、`scroll`、`back`、`wait_for`。

验收标准：
- Adapter Host 能注册并连接 `targetAPP`。
- 能输出当前页面 `RawRuntimeSnapshot`。
- 点击、输入、导航和 mock API 请求能生成带 `targetId`、`sequence`、`timestamp`、`evidenceIds` 的 `RawEvent`。
- Adapter Host 不直接暴露 Agent 可调用接口。

## Phase 2: Analysis Core 与对象图 MVP

目标：把平台原始数据转为 Agent 可理解的 AOM 对象图。

交付物：
- `aom-analysis-core`：Normalizer、Identity Resolver、Graph Builder、Evidence Manager。
- `aom-analysis-server`：`analysis.snapshot`、`analysis.query`、`analysis.capabilities`、`analysis.observe`、`analysis.verify`。
- MVP 节点：`app`、`screen`、`view`、`api_endpoint`、`storage_key`、`data_object`、`capability`、`event`。
- MVP 边：`contains`、`triggers`、`navigates_to`、`requests`、`reads`、`writes`、`has_effect`、`observed_before`。

验收标准：
- 首页、登录、商品列表、购物车等界面能生成稳定 `screen` 和 `view` 节点。
- 搜索按钮能关联到搜索 API 请求和结果列表变化。
- 节点、边、能力都能追溯到 Evidence。

## Phase 3: Capability MVP

目标：把对象图提升为可复用能力，而不是一次性 UI 步骤。

交付物：
- 优先能力：`login`、`search_product`、`view_product_detail`、`add_to_cart`、`checkout_prepare`。
- `aom-capability`：Capability schema、input slots、action plan、expected effects、confidence、riskLevel。
- 第一版挖掘规则：UI 文本/role、事件时序、API 命名、storage key 命名、snapshot diff。

验收标准：
- Agent 可以查询当前可用 capability。
- `search_product` 能声明输入 `keyword`、动作步骤和预期效果。
- `add_to_cart` 能验证购物车状态或对应事件变化。
- 低置信度能力不会默认自动执行。

## Phase 4: Safety Gateway MVP

目标：建立 Agent 与真实平台能力之间的安全边界。

交付物：
- `aom-policy`：Permission Scope、Redaction Policy、Risk Classification。
- `aom-gateway`：method allowlist、action level check、capability risk check、sensitive field redaction、audit log、confirmation decision。
- Demo Mode 默认允许 metadata observe 和 Level 0 到部分 Level 2 能力，默认禁止读取真实敏感值、执行脚本、直接改 storage、直接调用内部方法。

验收标准：
- Agent Server 的所有请求都只能发给 Gateway。
- Gateway 能区分 read、observe、safe action、sensitive action。
- password、token、authorization、cookie、phone、email、address、card 等字段默认脱敏。
- 所有 `invoke` 都产生 audit record。
- 高风险能力返回 `require_confirmation` 或 `deny`。

## Phase 5: Agent Server 与 MCP 工具

目标：让 Agent 用稳定工具访问 AOM，而不关心底层进程。

交付物：
- `aom-agent-server`：session manager、context pack builder、gateway client、LLM-friendly formatter。
- `aom-mcp-server`：`aom.snapshot`、`aom.query`、`aom.capabilities`、`aom.observe`、`aom.invoke`、`aom.verify`、`aom.explain`。

验收标准：
- Agent 能完成 query objects、choose capability、invoke、observe side effects、verify result 的闭环。
- 返回给 Agent 的上下文使用 `AOMNodeBrief` 和 `AgentCapabilityBrief`。
- Agent Server 不直接访问 Adapter Host 或 Probe。

## Phase 6: 端到端 Demo 与测试体系

目标：用 `targetAPP` 证明 AOM 的稳定性、解释性和可复用性。

交付物：
- 核心场景：登录、搜索商品、查看商品详情、加入购物车、结算前确认。
- 测试范围：协议序列化、Normalizer、Identity Resolver、Adapter Host 与 Electron Probe 集成、Gateway 策略、Agent 工具端到端、Evidence 链路快照。

验收标准：
- 场景不依赖屏幕坐标。
- 失败时能说明是哪一步 Evidence 或 expected effect 没满足。
- 测试覆盖查询对象、理解能力、执行动作、监听副作用、验证结果。

## Phase 7: Console 与多平台扩展

目标：先让开发者能看见 AOM，再扩展平台。

交付物：
- `aom-console`：target 状态、live snapshot、event stream、graph explorer、capability list、gateway audit log、redaction preview。
- 多平台准备：`ProbeCapabilityManifest`、Probe schema 校验、Probe 崩溃隔离、平台能力差异映射。
- 候选 Probe：Android Accessibility、Android Frida、Flutter、Web、Debug Mock。

验收标准：
- Console 能查看 screen、visible nodes、capability、action plan、expected effects、riskLevel 和 evidenceIds。
- Gateway 决策 allow/deny/redact/require_confirmation 可审计。
- 新 Probe 只需实现统一 `PlatformProbe` 接口，Analysis Layer 不依赖具体平台字段。

## 推荐实现顺序

1. `aom-protocol-rs` 和 `aom-protocol-ts`
2. `aom-adapter-host` 和 `aom-electron-probe`
3. `aom-analysis-core` 和 `aom-analysis-server`
4. `aom-policy` 和 `aom-gateway`
5. `aom-agent-server` 和 `aom-mcp-server`
6. 端到端 demo 和测试
7. `aom-console`
8. Android/Flutter 等多平台 Probe

## MVP 成功标准

MVP 应展示完整链路：

```text
Agent
  -> aom.snapshot
  -> Gateway policy check
  -> Analysis graph query
  -> current screen + available capabilities
  -> aom.invoke(search_product)
  -> Gateway risk check
  -> Analysis action plan
  -> Adapter Host execute action
  -> Electron Probe events
  -> Analysis verification
  -> Agent receives verified result
```

第一轮暂缓直接调用 App 内部方法、读写 raw storage、读取敏感网络 body、自动支付/提交订单/删除账号、多平台完整实现，以及复杂的自动 capability 学习模型。
