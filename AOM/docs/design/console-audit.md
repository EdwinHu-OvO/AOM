# Console Audit Design

## Goal

The first Console milestone is an audit surface, not a full product UI.

It should answer:

- What tool did the Agent call?
- Which session and target did it affect?
- What object or capability was selected?
- Did the action return `ok`?
- How many runtime events were observed after the action?
- What graph/context/capability summary did AOM expose back to the Agent?

## Boundary

The Console must observe AOM behavior without becoming a second control plane.

- MCP/Agent Interaction Layer writes structured audit records.
- Console reads audit records and renders timeline/summary.
- Console does not call Adapter/Probe directly.
- Console does not enforce Safety Gateway policy.
- Full graph explorer, event stream UI, redaction preview, and Gateway audit log remain later work.

## Current Implementation

- Audit log path defaults to `AOM/logs/aom-audit.jsonl`.
- `AOM_AUDIT_LOG` can override the path for tests or isolated runs.
- `@aom/agent-mcp` writes one JSONL record for every MCP `tools/call`.
- `@aom/console` provides `aom-console audit`.

Example:

```text
cd /Users/edwinh/Desktop/AOM/AOM
pnpm build
pnpm --filter @aom/console run audit -- --limit 20
```

JSON output:

```text
pnpm --filter @aom/console run audit -- --json
```

## Record Shape

Each record includes:

- `auditId`
- `timestamp`
- `toolName`
- `sessionId`
- `ok`
- `durationMs`
- summarized arguments
- summarized result
- error message when the tool failed

Large graph/context payloads are summarized in the audit record. The Agent can still request the full
graph through `aom.analysis_graph`; the Console milestone focuses on the process timeline.
