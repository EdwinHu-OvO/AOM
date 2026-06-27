# Claude Code MCP Demo Trace

Date: 2026-06-27

## Goal

Validate the Phase 5 Agent-facing surface using the same stdio MCP protocol path Claude Code will
use.

## Server

```text
node packages/aom-agent-mcp/dist/bin/aom-mcp-server.js
```

## MCP Calls

The smoke test covered:

```text
initialize
tools/list
tools/call aom.session_status
```

The real protocol regression used the existing handoff CDP endpoint:

```text
http://127.0.0.1:64604
```

It executed:

```text
tools/call aom.attach_existing
tools/call aom.context_pack
tools/call aom.analysis_graph
tools/call aom.detach
```

Observed result:

```json
{
  "attach": true,
  "context": true,
  "detach": true
}
```

This means:

- MCP stdio request/response framing works.
- Claude Code-visible tool names are listed.
- `aom.attach_existing` can connect to a handoff-launched PlateRun runtime.
- `aom.context_pack` returns AnalysisService-backed graph summary, context pack, data flows,
  capabilities, and verification.
- `aom.analysis_graph` can expose the full graph when the Agent needs exact node/edge evidence.
- `aom.detach` releases AOM while retaining the target app.

## Boundary

This is the Phase 5 demo surface. It does not replace the future Safety Gateway:

- P5 does not enforce Phase 4 safety policy; risk metadata is exposed but not a guard.
- Capability recognition is still MVP recipe based.
- Data flow is evidence-linked MVP data-flow graph, not complete app data lineage.
- Context pack and graph are now produced by Rust AnalysisService through the MCP analysis bridge.
