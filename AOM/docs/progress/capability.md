# Capability Layer 进度

## 当前状态

- Phase 3 Capability MVP 已落地。
- 新增 `aom-capability` Rust crate，输入为 Analysis Layer 的 `AOMGraphSnapshot`，
  输出 `ExecutableCapability`。
- Capability Layer 不直接访问 Adapter Host、Probe、源码、DOM selector 或底层调试工具；
  它只消费 AOM graph 中已经归一化的节点、边和 Evidence。
- Safety Gateway 仍未实现；本阶段只产出 riskLevel 和 automation policy，不做最终
  allow/deny/confirmation。

## 已完成

- `ExecutableCapability` 包含：
  - protocol-compatible `AOMCapability`
  - `availability`
  - `actionPlan`
  - structured `expectedEffects`
  - `automation` policy
  - `reasons`
- `AOMCapability` 填充：
  - `inputSlots`
  - `actionSummary`
  - `expectedEffects`
  - `riskLevel`
  - `confidence`
  - `evidenceIds`
- 第一版 capability mining rules 覆盖：
  - `login`
  - `search_product`
  - `view_product_detail`
  - `add_to_cart`
  - `checkout_prepare`
- 这些规则是 MVP capability recognizer recipes，不是通用应用理解。`/api/login`、
  `/api/stores`、`cart.items` 等 PlateRun 友好锚点只用于证明纵向闭环；后续需要升级
  为基于 UI 语义、事件/数据流 Evidence、endpoint/storage 命名模式、当前 screen
  可操作目标和置信度阈值的通用 discovery 机制。
- `search_product`：
  - slot：`keyword`
  - action plan：输入搜索词、观察 `/api/stores`、验证结果变化
  - expected effects：`search.query` 更新，`/api/stores` 结果被观察
  - risk：low
- `add_to_cart`：
  - slot：`product`
  - action plan：点击 Add 控件、观察 cart state、验证 `cart.items`
  - expected effects：`cart.items` 增加或更新
  - 可携带 P2 verified `updates` evidence
  - risk：low
- `login`：
  - slots：`username`、`password`
  - password 标记 sensitive
  - action plan：填用户名、填密码、提交、验证 authenticated session
  - action target 只从当前 screen 的 interactive view 中选择；历史登录 screen 不会让
    login 变成 available
  - risk：medium，不允许默认自动执行
- `view_product_detail`：
  - slot：`item`
  - 从可点击 view 与同名 entity/product/selected_store 事实推导当前目标
  - risk：low
- `checkout_prepare`：
  - 仅当 graph 中出现 `Place order` 或 `Checkout` 入口时推导
  - risk：high，不允许默认自动执行
- `AnalysisService::capabilities()` 已返回 `Vec<ExecutableCapability>`。
- `aom-analyze-bundle` 已输出 `capabilities.json`。

## 当前真实 Trace

`AOM/docs/traces/2026-06-25-phase2-iteration3/` 已重新生成：

- `graph.json`：124 nodes、196 edges、114 Evidence records。
- capability nodes：4 个。
- `capabilities.json` 当前包含：
  - `add_to_cart`：available，low risk，可自动执行，3 步计划。
  - `login`：missing_target，medium risk，不可自动执行，4 步计划；当前 Browse screen
    没有可点击登录按钮，`login.submit` 不再指向历史 screen。
  - `search_product`：available，low risk，可自动执行，3 步计划。
  - `view_product_detail`：available，low risk，可自动执行，2 步计划。
- 当前登录/浏览 trace 没有 cart review screen，因此没有 `checkout_prepare` 当前实例；
  规则已存在，等待 cart/checkout trace 触发。

## 自动化验证

- Rust 单元测试覆盖：
  - `search_product` 必须声明 `keyword`、action plan 和 expected effects。
  - `add_to_cart` expected effects 可携带 verified cart update Evidence。
  - 历史 login screen 不会让当前 `login` capability 标记为 available。
  - `checkout_prepare` 在 checkout view 存在时为 available，但 high risk 且不可自动执行。
  - low confidence capability 不允许默认自动执行。
  - `AnalysisService::capabilities()` 暴露 executable capability 对象。

## 近期目标

- 用真实 add-to-cart GUI trace 替换 fixture-only capability effect 证明。
- 采集 cart review/checkout_prepare live trace；当前 high risk 不自动执行已由 fixture 覆盖。
- Phase 4 Gateway 接入后，将 `automation.canAutoExecute` 作为 policy 输入，而不是最终
  安全结论。
