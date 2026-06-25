# Phase 1 Closure Trace

## Review Findings Addressed

Phase 1 review identified six gaps:

1. Rust Adapter Host did not connect to the TypeScript Electron Analyzer.
2. CDP evaluation exceptions could be reported as successful actions.
3. ArtifactParser recommendations did not close into an Adapter factory.
4. Dynamic Evidence did not transport tool provenance.
5. Action and live Electron automation coverage was incomplete.
6. A failed event batch could contaminate later target polling.

All six are addressed in this closure.

## Cross-process Host Connection

Shared Rust and TypeScript protocol types now include:

- `AnalyzerSessionConfig`
- `AnalyzerCommand`
- `AnalyzerReply`
- typed static snapshot, runtime snapshot, event and action replies
- typed analyzer failures

The TypeScript `aom-electron-analyzer` process reads JSONL commands from stdin and writes exactly one JSON reply per line to stdout.

Rust now provides:

- `StdioAnalyzerClient`
- `StdioStaticAdapter`
- `StdioRuntimeProbe`
- `AnalyzerRegistry`
- `EvidenceStore`

The Host owns process launch, stdin/stdout, error mapping and shutdown. EOF or malformed replies become transport errors instead of entering the Raw layer.

## Automatic Routing

`AnalyzerRegistry.connect_target` performs:

```text
register request
  -> ArtifactParser
  -> recommended adapter or generic fallback
  -> launch analyzer child
  -> initialize session
  -> attach static/runtime proxies
  -> register target in Adapter Host
```

Routes now close as follows:

- `adapter:electron-artifact` -> `ElectronArtifactAdapter`
- `adapter:web-artifact` -> `GenericWebArtifactAdapter`
- no recommendation / unknown file -> `GenericArtifactAdapter`

An unknown single binary now produces a bounded opaque artifact snapshot instead of failing directory traversal.

## Correctness Fixes

`Runtime.evaluate.exceptionDetails` is now checked. Missing targets and rejected `wait_for` expressions return `ok: false`.

`RawEventBus` now:

- stores queues by `targetId`
- validates an entire batch before mutation
- commits the batch atomically
- drains only the requested target

## Dynamic Tool Evidence

`EvidenceRef` gained optional:

- `toolName`
- `toolVersion`
- `sourceLocator`
- structured metadata

Analyzer replies carry these records. Runtime snapshots, events and action results reference the same IDs, and Adapter Host stores the records in `EvidenceStore`.

Dynamic results identify Playwright only. Static results identify the static tools that participated in collection.

## Automated Coverage

Fast tests cover:

- cross-language Analyzer command fixture
- stdio server initialization and generic Web static collection
- Rust registry and proxy request/reply routing
- unknown artifact fallback
- all five action mappings
- `Runtime.evaluate` exception failure
- click, text input, navigation, state and network events
- sensitive network Evidence redaction
- atomic event batches and target-isolated drains

The explicit GUI integration command is:

```bash
cd AOM
pnpm test:integration:electron
```

Observed result:

```text
before nodes: 22
after nodes: 142
actions: wait_for, set_text, scroll, back, click
missing target rejected: true
events: 11
```

## Real Rust to TypeScript Verification

```bash
cd AOM
cargo run -p aom-adapter-host --bin aom-run-electron-analysis -- \
  packages/aom-electron-probe/dist/bin/aom-electron-analyzer.js \
  ../targetAPP/release/mac-arm64/PlateRun.app \
  ../targetAPP/release/mac-arm64/PlateRun.app/Contents/MacOS/PlateRun
```

Result:

```text
static adapter: adapter:electron-artifact
artifacts: 15
static nodes: 103
edges: 122
runtime nodes: 22
dynamic tool evidence: playwright 1.61.0
```

## Phase Boundary

Phase 1 now provides raw static and dynamic collection through the real process boundary.

The following remain Phase 2 or later:

- stable identity across snapshots
- static/dynamic graph fusion
- semantic object normalization
- capability mining
- verification policies
- Gateway authorization
- automatic analyzer restart and multi-platform process pools
