# ADR 0003: Artifact Parser and Adapter Routing

## Status

Accepted for Phase 1.

## Context

Static analysis adapters need to handle targets whose implementation technology is unknown. Sending every artifact directly to an Electron, CEF, WebView2, or native analyzer would duplicate format detection and make adapter selection depend on guesses outside Adapter Host.

The pre-analysis stage must remain useful when the artifact is compressed, stripped, partially recognized, or not Web-based.

## Decision

Add `ArtifactParser` at the front of Adapter Host.

Pipeline:

```text
artifact path/package
  -> ArtifactParser
  -> ArtifactInspection
  -> adapter selection
  -> StaticAnalysisAdapter
  -> RawStaticSnapshot
  -> Analysis Layer
```

`ArtifactParser` performs bounded, read-only inspection and returns:

- `containerType`: directory, macOS app bundle, PE, Mach-O, ELF, ZIP, ASAR, APK, AppImage, or unknown.
- `architecture`: when available from executable headers.
- `runtimeCandidates`: zero or more Web runtime families with confidence.
- `recommendedAdapter`: a routing hint, not a trusted fact.
- `evidence`: the magic bytes, filenames, libraries, resources, or symbols supporting the result.

Initial runtime fingerprints:

- Electron
- CEF
- WebView2
- NW.js
- Tauri
- Qt WebEngine
- generic Web artifacts
- unknown

## Boundaries

- The parser identifies artifact and runtime types; it does not build the component graph.
- Static adapters may validate or reject the routing hint.
- Static adapters expose `accepts(inspection)` so routing remains an explicit contract.
- Unknown is a valid result and must not fail the pipeline.
- Confidence is additive evidence, not proof of framework identity.
- The parser must not execute the target.
- Directory scanning is bounded by entry count, depth, and sampled bytes.
- Source code is not required. Packaged metadata and deployed scripts are artifacts and may be sampled.

## Consequences

- Adapter selection becomes explicit and auditable.
- A generic binary analyzer can be used when no specialized adapter is available.
- New format and runtime detectors can be added independently from component graph analyzers.
- False positives remain visible through candidate lists and evidence instead of being hidden behind one hard classification.

## Phase 1 Route Registry

The initial registry closes parser output into these Analyzer adapters:

- Electron recommendation -> `adapter:electron-artifact`
- generic Web recommendation -> `adapter:web-artifact`
- no recommendation -> `adapter:generic-artifact`

The generic artifact fallback accepts a single unknown file and emits bounded metadata, digest and opaque artifact structure. It does not attempt disassembly. Deeper native analysis remains a future external-tool adapter.
