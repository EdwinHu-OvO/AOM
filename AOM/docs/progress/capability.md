# Capability Layer 进度

## 当前状态

- Phase 3 Capability MVP 已落地。
- Phase 5 后新增 LLM-assisted capability recognizer baseline，用于真实 app 上的通用语义候选识别。
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
- B站测试暴露当前 deterministic recipe 无法泛化到复杂内容 App：capabilities 为空，
  verification 报 `graph has no capability nodes`。为此新增 OpenAI-compatible recognizer，
  只负责从 current screen views/facts/dataFlows 生成 capability candidates。
- LLM candidates 会经过 deterministic validator：必须引用 current screen 中存在的
  `targetViewId` 或精确 `targetLabel`，目标 view 必须支持 action 且具备 `rawReference`；
  未通过校验的候选不会进入 `ExecutableCapability`。
- LLM recognizer parser 已支持常见字段别名和返回形态：root array、`candidates`、
  `capabilities`、`actions`，以及 `capability`、`target_view_id`、`target_label`、`score`、
  `probability`、`why` 等字段；规范化后仍必须通过 deterministic validator。
- 当所有候选都因 schema/字段缺失被 validator 拒绝时，recognizer 支持一次可配置
  schema repair：把原始输出和拒绝原因发回同一 OpenAI-compatible endpoint，只允许修正
  字段结构，不允许增加 graph 中不存在的 target 或事实。
- Analysis output 现在区分 `semanticReady` 与 `capabilityReady`。外置 LLM 分析完成但
  0 个候选通过校验时，AOM 会报告 `semanticReady: true`、`capabilityReady: false`，而不是把
  app 标记为可自主执行 capability。
- B站审计显示 `search_content` 已可被 LLM recognizer 识别，但模型给出的 slot 名会在
  `text input`、`input`、`text_input` 之间漂移。Agent Interaction Layer 已把这些输入名
  映射到 capability slot，避免 `missing_input` 阻断能力调用。
- 对搜索类 capability，执行层会把 `set_text` 与 `Enter` 提交绑定。当前这仍属于
  evidence-linked MVP 行为闭环，不代表 AOM 已经完整理解所有搜索表单或按钮语义。
- 默认配置位于 `AOM/aom.config.json`，`capabilityRecognizer.enabled` 默认为 false。

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

- 用 B站 fixture/golden trace 锁定 `open_profile`、`search_content`、`open_video` 等通用
  capability candidate 行为。
- 用真实 add-to-cart GUI trace 替换 fixture-only capability effect 证明。
- 采集 cart review/checkout_prepare live trace；当前 high risk 不自动执行已由 fixture 覆盖。
- Phase 4 Gateway 接入后，将 `automation.canAutoExecute` 作为 policy 输入，而不是最终
  安全结论。
