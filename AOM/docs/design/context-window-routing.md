# Context Window Routing

## Goal

Keep the full AOM graph and evidence-linked data-flow graph as the source of truth, while giving
Agents a smaller, navigable context surface.

The Agent-facing shape is:

```text
beforeSummary + exactWindow + afterSummary
```

Each window can slide independently. A page can expose multiple windows at once, such as header,
primary actions, main surface, data flow, recent events, and capabilities.

## Non-goals

- Do not replace `aom.analysis_graph`.
- Do not drop data-flow graph context.
- Do not hide low-value elements globally. They may be routed to lower-priority windows, but they
  remain available through `aom.context_window`.
- Do not let summaries create new facts, capabilities, selectors, or targets.

## Folding Policy

Current implementation supports three folding forms:

- Structure folding: container nesting is represented as semantic windows instead of raw DOM depth.
- Repetition folding: repeated items in a window are summarized as `repeatedGroups`, while exact
  items remain in the current slice and can be paged.
- Task folding: `aom.route_context` selects a useful set of windows for a task without deleting the
  other windows.

The first summarizer is deterministic. Future child-agent summarizers may replace the summary text,
but they must keep source ids, ranges, confidence, and stale/invalidated metadata.

## Tools

- `aom.route_context`: runs analysis, routes task-relevant windows, and returns multiple windows.
- `aom.context_window`: returns a single sliding window by `windowId`, `offset`, and `limit`.

Initial window ids:

- `ui:primary_actions`
- `ui:header`
- `ui:main`
- `dataflow:all`
- `event:recent`
- `capability:all`

## Window Contract

Each returned window contains:

- `beforeSummary`: compressed summary of items before the exact slice.
- `window.items`: exact items for the current slice.
- `window.repeatedGroups`: repeated roles/actions within the exact slice.
- `afterSummary`: compressed summary of items after the exact slice.
- `handles`: previous/next/fullGraph references for follow-up expansion.

Data-flow windows use the same contract as UI windows, so the Agent can inspect UI structure without
losing the project’s core data-flow explanation.

## Current Limits

- Region detection is heuristic and based on current context views/raw references.
- Repetition folding is role/action based, not yet semantic card detection.
- Summaries are deterministic compression, not child-agent summaries yet.
- Window handles are returned as stable strings, but the MCP tool currently accepts explicit
  `windowId`, `offset`, and `limit` rather than a handle parser.
