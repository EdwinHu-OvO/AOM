# ADR 0009: Agent Interaction Layer And MCP Demo Surface

## Status

Accepted for Phase 5 demo.

## Context

AOM needs a deliverable Agent-facing surface quickly. Building a full custom provider loop would
shift effort into chat orchestration, provider SDK differences, and UI concerns. For a Phase 5 demo,
the better boundary is to expose AOM as tools through MCP while keeping AOM's own Agent Interaction
Layer provider-neutral.

Phase 4 Safety Gateway is intentionally skipped for the demo. Phase 5 must not pretend that it has
a substitute safety boundary. Instead, it should expose AOM's real analysis artifacts to the Agent:
graph, context pack, capability action plans, data-flow summaries, and verification results. The
Agent host and the human operator remain responsible for whether a tool should be invoked.

## Decision

Add a TypeScript package named `@aom/agent-mcp`.

The package has two layers:

- `AgentInteractionService`: provider-neutral AOM session and capability API.
- `AOMMcpServer`: stdio MCP JSON-RPC bridge for Claude Code/Claude Desktop.

The MCP server does not call Adapter/Probe internals directly. It calls `AgentInteractionService`,
which owns target lifecycle sessions, delegates runtime work to `@aom/electron-probe`, and sends
the resulting static/runtime observations through Rust `AnalysisService`.

Initial tools:

- `aom.launch_for_handoff`
- `aom.attach_existing`
- `aom.snapshot`
- `aom.context_pack`
- `aom.analysis_graph`
- `aom.capabilities`
- `aom.invoke_capability`
- `aom.invoke_view`
- `aom.detach`
- `aom.session_status`

`launch_for_handoff` is the preferred demo path. AOM starts a debuggable app, attaches through CDP,
can detach without closing the app, and can later reattach through the same endpoint.

## Analysis Exposure

The Phase 5 interface exposes AOM analysis outputs directly:

- `aom.context_pack` returns Rust `AnalysisService` context, graph summary, capability objects,
  data-flow summaries, and verification result.
- `aom.analysis_graph` returns the full current AOM graph for Agents that need deeper inspection.
- `aom.invoke_capability` resolves executable action plans produced by the Capability Layer instead
  of using MCP-local business recipes.
- `aom.invoke_view` lets the Agent operate a specific current-screen AOM view from the graph when a
  named capability is too coarse.
- Missing action targets return structured failure instead of coordinate fallback.

There is no Phase 4-lite execution guard in this demo layer. Risk metadata is still surfaced, but it
is informational until the real Gateway is implemented.

## Consequences

- Claude Code can demo AOM through standard MCP stdio tools.
- The interaction layer remains usable by a future OpenAI Agents SDK or custom provider client.
- Current capability discovery remains MVP-recognizer based, not general app understanding.
- Current data-flow output is an evidence-linked MVP data-flow graph, not complete app data lineage.
- The MCP layer now depends on the same Rust analysis/capability path as the offline analysis
  pipeline, reducing the risk that demo behavior diverges from AOM's actual model.
