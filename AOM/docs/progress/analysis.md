# Analysis Layer 进度

## 当前状态

- Analysis Core 尚未开始实现。
- Phase 1 已确定上游输入为静态制品图和动态运行时事实两条独立通道。
- 当前没有静态/动态身份融合、对象稳定 ID、时序关联、confidence 合并或 capability mining，因此还没有真正的 AOM Analysis Layer。

## 已确定

- 静态分析不以源码为前提，输出 component network。
- 动态分析输出运行时节点、事件和动作证据。
- 静态/动态身份归并、冲突处理和 confidence 计算属于 Phase 2 Analysis Layer。
- 底层 Analyzer 只提供事实和工具 Evidence，不负责 AOM 语义理解。
- Electron 底层 Analyzer 已由 `@electron/asar`、`@electron/fuses`、Playwright 和 `chrome-remote-interface` 提供真实工具能力；这不改变 Analysis Core 仍未实现的判断。
- 设计决策见 `AOM/docs/decisions/0002-static-and-dynamic-analysis.md`。
- 工具适配边界见 `AOM/docs/decisions/0004-external-analyzer-adapters.md`。

## 近期目标

- 建立 `aom-analysis-core` 和 `aom-analysis-server`。
- 实现 RawEvent 到 AOMNode/AOMEdge 的最小归一化链路。
- 建立 Evidence Manager 的第一版数据结构。
