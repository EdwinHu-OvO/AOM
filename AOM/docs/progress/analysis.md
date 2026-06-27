# Analysis Layer 进度

## 当前状态

- Phase 2 MVP 审计收尾已落地；deterministic baseline 扩展为完整 MVP graph/API
  surface。
- `aom-analysis-core` 已实现 Normalizer、稳定 Identity、Graph Builder、Evidence
  Manager、snapshot diff、query、transition verification、LLM context pack、logical
  storage、MVP capability graph 和字段级 data-flow graph。
- `aom-analysis-server` 已提供 `snapshot`、`query`、`capabilities`、`observe` 和
  `verify` 进程内服务接口；bundle CLI 可输出 graph 与 context pack。
- 当前已能解释真实 PlateRun 登录迁移并支持低风险下一步规划；Phase 3 已把
  capability schema、slots、action plan、expected effects、riskLevel 和 automation
  policy 做成独立能力层。

## 已完成

- 稳定 ID 不依赖 DOM raw path；同语义 view 在 raw path 改变后保持 ID。
- 静态 endpoint 与动态 request/response 合并为同一 AOM endpoint，并保留发现来源。
- 事件保留 sequence、timestamp、target view、request ID、method、status 和 DOM mutation。
- 相同 request ID 的 request/response 通过 `has_effect` 关联。
- screen、view、event、API、data object 与关系均可追溯到一等 Evidence。
- Context pack 显式输出 session、selected store、menu count、cart state 和 product groups。
- Product group 将商品、描述、价格与 Add action 关联，避免 LLM 按数组位置猜测。
- View 输出 operation kind、mutation flag 和 expected effect，供后续 capability 验证复用。
- Endpoint 输出区分 static discovery 和 runtime observation。
- 生成 `storage_key` 节点：`session.authenticated`、`cart.items`、`search.query`。
- 生成 MVP `capability` 节点：`login`、`search_product`、`view_product_detail`、
  `add_to_cart`；`checkout_prepare` 规则已存在，等待 cart/checkout screen trace 触发。
- 图中已包含 `reads` / `writes` 边，并确保这些边带有 Analysis Evidence。
- 登录迁移会生成 `EvidenceKind::Verified`，并挂回 `navigates_to` edge。
- 搜索验收新增 before/event/after fixture：Search view 触发 text input，关联
  `/api/stores` request/response 和 DOM mutation/result diff，并生成
  `search_product` capability。
- 数据流图新增 `data_field` 和 `message` 节点，以及 `flows_to`、`renders_as`、
  `derives_from`、`updates` 边类型。
- 当前数据流覆盖 text input -> query field -> request message -> response message ->
  rendered UI fact，以及 logical storage -> rendered session/cart/search state。
- 当前数据流定位为 evidence-linked MVP data-flow graph，用于解释已观察的值移动和
  side effect；它不是完整 app data lineage，也不覆盖所有脱敏 payload、IPC/preload
  bridge、本地存储、store/reducer、缓存或虚拟列表场景。
- `add_to_cart` 已有纵向能力效果验证：Add click + cart count increase + state mutation
  会生成 verified Evidence，并通过 `updates` 边连接 `add_to_cart` capability 与
  `cart.items` storage。
- Context pack 新增 `capabilityVerifications`，向 Agent 输出 capability、目标状态、
  verified/confidence、reasons 和 evidence IDs。
- 对真实打包 PlateRun 重新生成 124 nodes、196 edges、114 Evidence records，其中
  4 个 capability、3 个 storage key、32 个 data field、6 个 message、1 个 verified
  Evidence。
- Bundle CLI 现在同时输出 `graph.json`、`context-pack.json` 和 `capabilities.json`。
- `capabilities.json` 当前包含 `login`、`search_product`、`view_product_detail` 和
  `add_to_cart` 的 slots、action plan、expected effects、riskLevel 与 automation
  policy。
- 真实 PlateRun graph 的 flow/evidence closure 检查通过：0 missing Evidence，0 empty
  Evidence edge。
- 无上下文 LLM 评估从 78/74 提升到 88/89，核心对象与状态误解已消除。

## 已确定

- 静态分析不以源码为前提，输出 component network。
- 动态分析输出运行时节点、事件和动作证据。
- 静态/动态身份归并、冲突处理和 confidence 计算由 Analysis Layer 独占。
- 底层 Analyzer 只提供事实和工具 Evidence，不负责 AOM 语义理解。
- Electron 底层 Analyzer 已由 `@electron/asar`、`@electron/fuses`、Playwright 和 `chrome-remote-interface` 提供真实工具能力；这不改变 Analysis Core 仍未实现的判断。
- 设计决策见 `AOM/docs/decisions/0002-static-and-dynamic-analysis.md`。
- 工具适配边界见 `AOM/docs/decisions/0004-external-analyzer-adapters.md`。
- 身份、Evidence 和 LLM context 契约见
  `AOM/docs/decisions/0005-analysis-identity-evidence-context.md`。
- 数据流图边界见 `AOM/docs/decisions/0006-data-flow-graph.md`。
- 能力层边界见 `AOM/docs/decisions/0007-capability-mvp.md`。
- 盲测过程见 `AOM/docs/traces/2026-06-25-phase2-llm-context-evaluation.md`。

## 近期目标

- 在本机进程授权恢复后运行真实 add-to-cart before/event/after capture；当前
  add_to_cart 闭环由自动 fixture 覆盖，尚未声明 live GUI trace 通过。
- 将 add_to_cart fixture verifier 接到真实 capture 输出，并记录真实 graph/context
  trace。
- 为真实 GUI 搜索和 add-to-cart 工作流补 live trace；当前搜索因果链已由
  before/event/after fixture 自动覆盖，add-to-cart live run 仍受本机进程授权限制。
- 将 `analysis.observe` 从一次性替换扩展为持续 session/incremental graph update。
- 扩展数据流来源：IPC/preload bridge、localStorage/sessionStorage、response body schema
  摘要、store/reducer mutation 和 verified field-level effects。
- 采集 cart review/checkout_prepare trace，验证 high risk capability 可被发现但不会默认
  自动执行。
- Phase 4 接入 Gateway policy，让 Agent 请求无法绕过 capability risk 和确认策略。
