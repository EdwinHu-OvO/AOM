# Context Delta

## Goal

Move Agent operation from repeated full-context rereads toward:

```text
baseline routed context + semantic context delta + optional sliding-window expansion
```

`aom.route_context` remains the planning baseline. After an action, AOM now returns a
`contextDelta` that explains what changed between the previous graph and current graph. The delta is
Agent-facing, not a raw JSON Patch. It preserves AOM's graph/evidence model while making the next
step obvious enough that the Agent should not repeat already-successful actions.

## Contract

`ContextDelta` contains:

- `previousGraphId` and `currentGraphId` for stale-context detection.
- `cause`: action id, tool name, capability/view target, action type, and non-sensitive input
  summary.
- `ui`: added/removed/updated views plus screen/primary-region stability flags.
- `data`: added/updated data objects, fields, messages, or storage-like nodes.
- `network`: added request/response/endpoint observations.
- `dataFlow`: added/removed evidence-linked flow edges.
- `capabilities`: added/removed/changed capabilities and `recommendedNext`.
- `outcome`: `verified`, `changed`, `ambiguous`, `no_change`, or `failed`, with a short summary,
  evidence ids, and optional next-step hint.

The first implementation computes the delta in `@aom/agent-mcp` from two AnalysisService outputs.
That keeps the protocol non-breaking while allowing the MCP surface to stop returning only large
full analysis blobs after every action.

## Search Example

For a search action, the desired output is:

```text
search_content(query=科技资讯)
  -> network request /x/web-interface/wbi/search/all/v2
  -> clickable result views added/refreshed
  -> outcome.status=verified
  -> recommendedNext=open_content_result
```

The important behavioral rule is: when `contextDelta.outcome.status` is `verified` and the
next-step hint says search results loaded, the Agent should stop repeating search and move to
opening or inspecting a result.

## Tool Usage

- `aom.invoke_capability` and `aom.invoke_view` return `contextDelta` inline.
- `aom.context_delta` returns the latest delta for the session when an action result was persisted
  to a file or the Agent needs to re-check what changed.
- Action and launch tools return compact analysis summaries by default. Full `contextPack` is a
  debug surface and must be requested through `aom.context_pack`.
- `contextDelta.capabilities.recommendedTargets` contains concrete follow-up targets such as
  `aom.invoke_view(click, viewId=...)` when AOM can identify them.
- `aom.route_context` should still be called after meaningful actions to get the current windowed
  state, but planning should combine `contextDelta.outcome` with the new windows. If no explicit
  task is provided, the MCP layer may use the last delta's next-step hint for routing.
- `aom.context_window` remains the way to expand a summarized region.

## Boundaries

- Context delta is not complete data lineage. It is an evidence-linked MVP semantic diff.
- Delta summaries must not invent application facts or selectors. They can recommend next actions
  only from graph observations, capability names, and current evidence.
- Raw graph and data-flow details remain available through `aom.analysis_graph`,
  `aom.context_pack`, and sliding windows.
- The delta currently compares graph outputs, not raw runtime snapshots directly. Future work can
  move this into AnalysisService once the shape stabilizes.
