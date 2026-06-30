# Dynamic Call Chain

## Goal

Add a small orchestration surface above the existing AOM MCP tools:

```text
current graph + latest contextDelta + task -> suggested tool-call chain
```

The call chain is not an autonomous executor. It only proposes the next few AOM tool calls, including
arguments, reasons, expected outcomes, and stop conditions. All existing interfaces remain exposed:
`route_context`, `context_window`, `context_delta`, `invoke_capability`, `invoke_view`,
`analysis_graph`, `context_pack`, and raw snapshot/debug tools stay callable.

## Contract

`aom.call_chain` returns:

- `chainId`, `graphId`, `currentScreenId`, and generation time for stale-plan detection.
- `basis`: the task and latest `contextDelta.outcome` used to build the chain.
- `status`: `ready`, `needs_observation`, `blocked`, or `done`.
- `steps`: a small sequence of AOM tool calls. Each step includes `toolName`, `arguments`,
  `reason`, `expectedOutcome`, and `stopIf`.
- `invalidatesWhen`: conditions that require the Agent to regenerate the chain.
- `allInterfacesRemainAvailable: true`, making the orchestration boundary explicit.

The MCP service refreshes `nextCallChain` after meaningful calls such as launch/attach, context
routing/window expansion, context delta reads, graph/capability reads, and invoke actions. External
Agents should re-check this chain after every tool result instead of continuing an old plan.

## Planning Rules

- If a current executable capability matches the task, the first step can be `aom.invoke_capability`.
  The next step is expected to inspect `contextDelta`.
- If the latest `contextDelta.outcome.status` is `verified` and it includes concrete
  `recommendedTargets`, the first step becomes the recommended `invoke_view` or
  `invoke_capability`. This prevents repeated successful search submissions.
- If the latest action is `failed` or `no_change`, the chain stops retrying the same target and
  returns to `aom.route_context` plus a focused `aom.context_window`.
- If AOM cannot choose a concrete action, the chain starts with observation: `route_context` and a
  relevant sliding window. Data-flow windows remain first-class and are not discarded.

## Boundaries

- Dynamic call chains are not a general agent planner and do not replace user/provider reasoning.
- The chain must not invent selectors or coordinates. It may only use current capabilities,
  graph-backed views, context delta recommendations, and routed windows.
- A chain is valid only for the graph/screen that generated it. Any invoke action, screen change, or
  stronger target discovered by a context window invalidates it.
- This feature is meant to reduce loops and context waste, not to hide uncertainty. A failed or
  ambiguous step should route back through context rather than repeat.
