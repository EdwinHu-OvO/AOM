# Electron Analyzer Toolchain

## Purpose

`@aom/electron-probe` is the Electron-specific Analyzer Adapter below Adapter Host. It calls maintained Electron and Chromium tools, then converts their output to AOM transport-neutral protocol objects.

It does not own object identity fusion, capability mining, safety policy, or Agent-facing APIs.

## Local Toolchain

All JavaScript tools are local dependencies of `AOM/packages/aom-electron-probe`:

- `@electron/asar` `4.2.0`: production ASAR listing, stat and bounded extraction.
- `@electron/fuses` `2.1.2`: read-only Electron fuse inspection.
- `playwright` `1.61.0`: launch packaged Electron apps and select renderer windows.
- `chrome-remote-interface` `0.34.0`: connect to an existing remote-debugging endpoint and exchange raw CDP messages.
- TypeScript compiler API: JavaScript module, symbol and API string facts.

No npm package is installed globally. Playwright uses the Chromium embedded in the target Electron executable, so this path does not require `playwright install chromium`.

## Static Flow

```text
ArtifactParser
  -> ElectronArtifactAdapter
    -> ElectronAsarBackend (@electron/asar)
    -> inspectElectronFuses (@electron/fuses)
    -> TypeScript/HTML fact collectors
  -> RawStaticSnapshot
```

The adapter records tool name, version, mode, capability, operation, locator and Evidence ID in the root artifact metadata. ASAR archive artifacts also identify the backend that produced their inventory.

The internal bounded ASAR reader remains available through `InternalAsarFallbackBackend`. It is a fallback and test oracle, not the default production path.

One unreadable or oversized text entry produces partial artifact metadata and is skipped. It does not fail the entire static snapshot.

## Dynamic Flow

Two connection modes are available:

```text
launchElectronAnalyzer
  -> Playwright launches packaged Electron
  -> waits for a loaded renderer document
  -> creates renderer CDP session
  -> ElectronRuntimeProbe

ChromeRemoteInterfaceClient.connect
  -> connects to an existing --remote-debugging-port
  -> ElectronRuntimeProbe
```

Both paths preserve the existing `RuntimeProbe` contract. Upper layers receive `RawRuntimeSnapshot`, `RawEvent`, and `RawActionResult`, not Playwright or CDP-native objects.

`WebSocketCdpClient` remains a protocol prototype and fallback. New production integrations should use Playwright or `chrome-remote-interface`.

## Adapter Host Boundary

The production path is now:

```text
Rust AnalyzerRegistry
  -> ArtifactParser route
  -> managed TypeScript child
  -> stdio JSONL AnalyzerCommand / AnalyzerReply
  -> StdioStaticAdapter / StdioRuntimeProbe
  -> Adapter Host managers
```

The child exposes no Agent-facing API. It can only receive the Analyzer protocol supported by Adapter Host.

Dynamic replies include Playwright tool provenance as `EvidenceRef`. Static replies include only tools participating in static collection.

## Current Limits

- Playwright Electron support is experimental and depends on the target's `EnableNodeCliInspectArguments` fuse when launching through its Electron API.
- Existing-process attach requires the target to expose a permitted remote debugging endpoint.
- Native dialogs and non-Chromium surfaces require a platform accessibility adapter.
- Main-process V8 inspection, tracing, net log, crash reports and external process supervision are not integrated yet.
- Tool Evidence is carried in snapshot metadata and IDs; the Phase 2 Evidence Manager will normalize it into first-class records.
