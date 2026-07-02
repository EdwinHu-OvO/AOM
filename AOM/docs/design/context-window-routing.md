# Context Window Routing

## Goal

Keep the full AOM graph and evidence-linked data-flow graph as the source of truth, while giving
Agents a smaller, navigable context surface.

The Agent-facing shape is:

```text
beforeSummary + exactWindow + afterSummary
```

A page can expose multiple window sources at once, such as header, primary actions, main surface,
data flow, recent events, and capabilities. The Agent may then open multiple sliding cursors across
those sources. AOM keeps the cursors in session state so the Agent can inspect several places at
once and move each cursor independently.

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
- Task folding: `aom.route_context` can suggest useful windows for a task without deleting the other
  windows. It is not the only router; `aom.context_windows` lets the Agent choose its own windows and
  cursor count.

The first summarizer is deterministic. Future child-agent summarizers may replace the summary text,
but they must keep source ids, ranges, confidence, and stale/invalidated metadata.

## Tools

- `aom.route_context`: runs analysis, suggests task-relevant windows, and returns a compact starting
  set plus available handles. Treat it as a window directory, not the detailed exploration surface.
- `aom.context_windows`: preferred detailed context tool. It returns multiple Agent-selected sliding
  windows in one call and maintains session-level cursors.
- `aom.context_window`: compatibility fallback for one explicit slice by `windowId`, `offset`, and
  `limit`.

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

## Global Multi-Cursor Contract

`aom.context_windows` accepts a list of requests. Each request can include:

- `cursorId`: Agent-chosen stable cursor name.
- `windowId`: source window such as `ui:main` or `dataflow:all`.
- `offset` and `limit`: absolute slice request.
- `direction`: `current`, `next`, `previous`, or `reset` relative to the existing cursor.

AOM records cursor state per session. Reusing the same `cursorId` moves that cursor instead of
starting from scratch. Different cursors may point to different sources or different positions in
the same source.

When `avoidCollisions` is enabled, AOM detects overlapping ranges within the same `windowId` during
one multi-window call. It shifts later cursors to the nearest non-overlapping slice when possible and
reports the resolution in `collisionPolicy`. This prevents the Agent from spending context on two
windows that show the same exact items.

## Current Limits

- Region detection is heuristic and based on current context views/raw references.
- Repetition folding is role/action based, not yet semantic card detection.
- Summaries are deterministic compression, not child-agent summaries yet.
- Single-window handles still exist for compatibility. The preferred path for agent-directed
  exploration is now `aom.context_windows` with explicit cursors.
