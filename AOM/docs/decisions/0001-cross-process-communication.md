# ADR 0001: Cross-process Communication

## Status

Accepted for MVP planning.

## Context

AOM is designed as multiple independently running processes:

- `aom-adapter-host`
- `aom-analysis-server`
- `aom-gateway`
- `aom-agent-server`
- platform probes such as Electron, Android, Flutter, and debug probes

The communication layer must support Rust and TypeScript, request/response calls, high-volume event streams, local security boundaries, easy debugging, and future Console/MCP integration.

## Options Considered

### OS-native IPC only

Examples include Unix Domain Socket, Windows Named Pipe, process stdio, and platform-specific IPC APIs.

Pros:

- Strong local-only boundary.
- Avoids accidentally exposing privileged services on network interfaces.
- Good fit for high-trust service-to-service traffic on the same machine.
- Stdio is simple for child probes managed by Adapter Host.

Cons:

- More platform-specific handling.
- Harder browser-based Console integration.
- More friction for TypeScript clients and remote debug tools.

### WebSocket only

Pros:

- Easy Rust/TypeScript interoperability.
- Natural support for streams.
- Convenient for Console, MCP bridge, and external tools.
- Easy to inspect with existing network tooling.

Cons:

- Must be carefully bound to loopback or protected by auth.
- Easier to accidentally expose privileged APIs.
- Less ideal for highly privileged local-only Adapter/Gateway links.

### gRPC or Protobuf-first

Pros:

- Strong schemas.
- Efficient and mature for service-to-service APIs.
- Good long-term option for stable high-throughput boundaries.

Cons:

- Higher setup cost for the MVP.
- More generated-code workflow to maintain across Rust and TypeScript.
- Less convenient while protocols are still changing quickly.

## Decision

Use a transport abstraction with different default transports per boundary.

MVP defaults:

| Boundary | Default transport | Rationale |
| --- | --- | --- |
| Agent Server -> Gateway | WebSocket JSON-RPC on loopback | TypeScript-friendly, stream-capable, easy MCP/Console integration |
| Gateway -> Analysis Server | Local transport abstraction; MVP may use loopback WebSocket | Policy decisions stay explicit while keeping MVP simple |
| Analysis Server -> Adapter Host | Local transport abstraction; prefer Unix Domain Socket or Named Pipe after MVP | Higher-privilege internal path should become local-only |
| Adapter Host -> managed Probe child | stdio JSONL or length-prefixed JSON | Adapter Host owns lifecycle and can supervise crash/restart |
| Adapter Host -> external Probe | WebSocket JSON-RPC with capability manifest and token | Needed when the probe is not a child process |
| Event streams | JSONL frames or WebSocket stream messages | Easy debugging and incremental parsing |

The protocol layer must not depend on one transport. Message schemas should be shared across Rust and TypeScript, while transport adapters handle WebSocket, Unix Domain Socket, Named Pipe, TCP loopback, or stdio.

## Security Rules

- Privileged services must bind only to loopback when using WebSocket or TCP.
- Every connection must carry a session or service token once Gateway exists.
- Adapter Host must not accept Agent-originated actions directly.
- Probe messages must be schema-validated before they enter the Raw Event Bus.
- External Probe connections must declare a `ProbeCapabilityManifest`.
- Debug/internal Level 4 methods must not be exposed through public Agent tools.

## Consequences

- The MVP can move quickly with WebSocket JSON-RPC where convenient.
- The implementation can later harden internal privileged links without changing AOM message schemas.
- Console and MCP remain easy to integrate.
- A small transport abstraction is required early so service logic does not assume WebSocket.

## Implementation Notes

- Define protocol messages before transport code.
- Keep request/response and event stream envelopes transport-neutral.
- Use JSON for MVP because schemas are still changing.
- Revisit gRPC/Protobuf after the Electron MVP and Gateway policy model stabilize.

## Phase 1 Implementation

The managed Electron Analyzer boundary now uses stdio JSONL.

- Shared `AnalyzerCommand` and `AnalyzerReply` types exist in Rust and TypeScript.
- Adapter Host launches and owns the TypeScript child process.
- One command and one reply occupy one line each.
- Tool stderr is inherited for diagnostics; stdout is reserved for protocol frames.
- EOF, malformed JSON and analyzer error replies become typed Adapter Host errors.
- Static and runtime proxy objects share one supervised analyzer process.
- The transport remains replaceable; Adapter Host traits and Raw protocol objects do not depend on stdio.
