# AOM 项目方向守则

## 北极星

AOM 不是新的 UI 自动化框架、截图识别工具、反编译器或调试器。AOM 是面向 Agent 的应用语义控制层：把不同平台提供的结构、状态、事件和动作事实，转化为稳定对象、因果关系、可复用能力和可审计操作。

项目的最终价值必须同时体现在三个方面：

- 稳定性：Agent 使用跨快照、跨会话尽可能稳定的对象身份，而不是坐标和临时 selector。
- 可解释性：对象、关系、能力、动作和验证结论都能追溯到 Evidence。
- 可复用性：Agent 操作命名能力及其输入、风险和预期效果，而不是重新拼装一次性 UI 步骤。

如果一个新模块不能明显改善以上至少一项，就不应进入近期主线。

## 不可破坏的边界

- Adapter 和外部 Analyzer 只提供平台事实，不负责 AOM 语义理解。
- Analysis Layer 独占身份归并、静态/动态融合、置信度、因果关系和能力发现。
- Agent 只能通过 Gateway 访问能力，不能直连 Adapter Host、Probe 或 Analyzer。
- `targetAPP/` 始终是普通消费应用，不加入 AOM 专用 selector、后门或测试控制。
- Raw Action 必须引用已观察对象；视觉坐标只能作为未来受限 fallback，不能成为主身份。
- Evidence、数据分类和脱敏是数据模型的一部分，不是最终展示层的补丁。
- 平台扩展通过 Probe/Analyzer Adapter 完成，不能把 Electron 特性泄漏到 AOM 核心模型。

## 当前阶段判断

截至 2026-06-25：

- Phase 0 已建立 Rust/TypeScript 协议基线。
- Phase 1 已证明打包 Electron 应用可被静态分析、动态观察和对象寻址操作。
- Rust Adapter Host 到 TypeScript Analyzer 的真实跨进程链路已经闭合。
- 当前产物仍是 Raw facts；项目尚未形成真正的 Application Object Model。

因此，近期最重要的工作不是继续扩大 Electron 解析深度，而是完成 Phase 2：把 Raw facts 转换为稳定、可追溯、可查询的对象图。

## Phase 2 主线

Phase 2 按以下顺序推进：

1. 身份契约
   - 定义对象身份的作用域、生命周期、版本和失效规则。
   - 区分稳定 identity、一次观察 occurrence 和平台 raw reference。
   - 明确对象合并、拆分、冲突和不确定匹配的表达方式。

2. Evidence 模型
   - 从引用列表提升为可持久化、可查询的一等记录。
   - 区分采集事实、推断结论和验证结果。
   - 保留工具、时间、目标、来源、数据分类和派生链。

3. 确定性归一化
   - 先建立可测试的规则式 Normalizer 和 Identity Resolver。
   - 同一输入必须生成相同对象 ID 和图结构。
   - 在规则基线稳定前，不引入依赖模型的语义推断。

4. 图构建与查询
   - 支持 snapshot、diff、query、observe 和 explain 的最小内部 API。
   - 所有边必须说明来源；无法证明的关系保持候选状态。

5. 真实工作流切片
   - 先用 PlateRun 登录流程验证 screen、view、endpoint、event 和 effect。
   - 再验证搜索或商品筛选，证明对象和关系能跨状态变化保持稳定。

Phase 2 完成的标志不是“创建了 crate”，而是 Agent 上层可以不看 Raw DOM 路径，稳定查询并解释一次真实状态迁移。

## 后续阶段的执行方式

Phase 2 后不再只做横向模块堆叠，而采用纵向能力切片：

```text
对象查询
  -> capability plan
  -> Gateway decision
  -> Raw Action
  -> event/effect observation
  -> verification
  -> explanation
```

第一条完整切片优先选择 `login`，第二条选择 `search_product` 或等价的只读筛选能力。`checkout` 仅做到准备和确认边界，不自动提交真实高风险操作。

每条切片都必须同时包含：

- Analysis 对象与关系
- Capability 输入和预期效果
- Gateway 风险与数据分类
- Adapter 动作映射
- Evidence 和验证
- 端到端测试

## 近期暂缓

- Android、Flutter 和其他平台的完整 Probe。
- 更深的 native 反编译和调试能力。
- 复杂自动 capability 学习模型。
- 直接调用应用内部方法或修改 raw storage。
- 大型 Console 产品化。
- 为可靠性而提前建设复杂分布式基础设施。

可以补必要的超时、状态和崩溃隔离，但不得让 Adapter Host 的工程增强挤占 Analysis Core 主线。

## 方向检查

开始重要工作前，应回答：

1. 这项工作改善稳定性、可解释性或可复用性中的哪一项？
2. 它属于 Raw 事实、AOM 语义、策略决策还是 Agent 表达？
3. 是否把平台细节放错到了上层？
4. 是否有 Evidence、数据分类和失败语义？
5. 是否能由打包的外部目标应用验证，而不修改目标应用？
6. 是否有更小的纵向切片可以先证明价值？

若这些问题没有清晰答案，应先补设计，不直接扩展实现。
