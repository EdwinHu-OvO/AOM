# ADR 0004: External Analyzer Tool Adapters

## Status

Accepted. This decision corrects the Phase 1 implementation direction.

## Context

AOM needs static and dynamic evidence, but AOM is not intended to become a new disassembler, debugger, accessibility engine, browser automation engine, or binary analysis suite.

The Adapter design exists so AOM can use mature platform and analysis tools while keeping their schemas, lifecycle, permissions, and platform differences below the AOM object layer.

Some Phase 1 code currently implements low-level mechanics directly, including an ASAR reader and a small CDP WebSocket client. These implementations proved the protocol and graph model, but they are not the intended long-term analyzer engines.

## Decision

Treat analyzers as the downward-facing modules below Adapter Host.

```text
AOM Analysis Layer
  -> normalized Raw/AOM protocols
Adapter Host
  -> lifecycle, routing, validation, event ordering
Analyzer Adapter
  -> tool-specific commands, sessions and schema conversion
External Analyzer / Debug Tool
  -> artifact or running target
```

An Analyzer Adapter:

- declares supported artifact/runtime/platform capabilities
- starts or connects to an existing tool
- converts tool output to `ArtifactInspection`, `RawStaticSnapshot`, `RawRuntimeSnapshot`, or `RawEvent`
- records tool name, version, command/session and source locator as Evidence
- maps AOM actions to tool-native commands when permitted
- handles tool crashes, timeouts and partial results

The Adapter must not move application understanding into the tool driver. Identity resolution, graph fusion, confidence, capability mining and verification remain in AOM Analysis Layer.

## Static Analyzer Adapters

Preferred tool families include:

- package/archive tools: Electron ASAR tooling, ZIP/APK package readers
- native metadata: `file`, `otool`, `nm`, `codesign`, `plutil`, `lipo`, PE/ELF equivalents
- JavaScript structure: TypeScript compiler API, source map readers, module lexers
- native deep analysis when needed: Ghidra, Rizin/radare2, Binary Ninja, or equivalent

The current internal ASAR reader remains a bounded fallback and test oracle. The production Electron adapter uses `@electron/asar` and preserves the same AOM protocol output.

Electron fuse state is read through `@electron/fuses`. This is evidence about which launch, inspection, integrity and environment capabilities are available; AOM must not modify target fuses during analysis.

## Dynamic Analyzer Adapters

Preferred tool families include:

- Chromium/Electron: CDP through a maintained CDP client or Playwright
- platform UI: macOS Accessibility, Windows UI Automation, Android Accessibility
- process/runtime instrumentation: Frida, LLDB, GDB, platform debuggers
- network observation: CDP Network domain, proxy tools, or OS tracing where permitted

The current custom CDP WebSocket client is a protocol prototype. Production Electron runtime paths use:

- Playwright to launch a packaged Electron executable, wait for a usable renderer and create a CDP session.
- `chrome-remote-interface` to attach to an existing permitted remote-debugging endpoint.

AOM owns session policy and output normalization, not the CDP transport implementation.

## Dependency Placement

Analyzer tools are installed as local workspace dependencies in the owning adapter package. They are not global machine dependencies.

Playwright does not download a separate browser for this flow because it launches the target Electron executable and uses its embedded Chromium.

## Boundaries

- `ArtifactParser` only detects and recommends analyzers.
- Analyzer Adapters interact with external tools.
- Adapter Host supervises adapters and transports.
- Analysis Layer fuses evidence into stable AOM identities.
- Gateway controls whether an analyzer capability may be used.
- Agent-facing services never call analyzers directly.

## Consequences

- AOM can gain mature analysis capabilities without duplicating their engines.
- Tool replacement does not change Agent-facing or Analysis Layer protocols.
- Tool provenance becomes part of Evidence and explainability.
- Phase 1 should prioritize adapter contracts, process supervision and real-tool integration over additional custom parsers.
