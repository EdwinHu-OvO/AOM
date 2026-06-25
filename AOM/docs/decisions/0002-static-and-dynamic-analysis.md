# ADR 0002: Static and Dynamic Analysis Channels

## Status

Accepted for Phase 1.

## Context

AOM needs both broad structural knowledge and runtime evidence. Static analysis can discover components and dependencies before a workflow is exercised, while dynamic analysis can prove the current UI, event order, network activity, and action effects.

The static channel cannot assume source code is available. Production targets may be packaged as Electron asar archives, minified bundles, native executables, mobile packages, or other binary artifacts.

## Decision

Use two independent, adapter-based collection channels.

### Static analysis adapter

Input:

- deployable artifacts
- application packages or archives
- executable and library images
- process/module metadata available without running Agent actions

Output:

- `RawArtifactDescriptor`
- `RawStaticNode`
- `RawStaticEdge`
- `RawStaticSnapshot`

The output is a component network. Nodes may represent application, process component, bundle, module, native library, resource, endpoint, storage namespace, import, export, or other adapter-supported structures. Edges describe containment, loading, dependency, reference, and communication relationships.

Source paths, line numbers, and source symbols are not required protocol fields. A future source-aware adapter may add development evidence through generic attributes, but Analysis Layer must work without it.

### Dynamic runtime probe

Input:

- a running target process
- platform inspection APIs such as CDP, accessibility, OS hooks, or debug protocols

Output:

- `RawRuntimeSnapshot`
- ordered `RawEvent` streams
- `RawActionResult`

Dynamic evidence proves what was visible or observed at a specific time. It does not redefine the static component graph.

### Fusion boundary

Adapter Host keeps both channels separate. Phase 2 Analysis Layer owns identity resolution and graph fusion:

- static evidence says a component or relationship may exist
- dynamic evidence says an object or effect was observed
- fused AOM nodes retain evidence from both channels
- disagreement is represented through confidence and evidence, not silently overwritten

## Electron MVP

The Electron static adapter reads build-directory content and packaged artifacts such as asar archives. Its bounded, read-only ASAR virtual filesystem exposes application files without extracting them to disk. The adapter identifies process roles, compiled JS/HTML/CSS artifacts, package dependencies, native modules, resources, and API endpoint references. It must not require `src/`.

The Electron runtime probe uses CDP for DOM snapshots, input/click/navigation/network events, and basic actions. CDP is an Electron implementation detail behind the runtime probe interface.

## Consequences

- AOM remains usable when source code is unavailable.
- Native binary adapters can implement the same static contract later.
- Minified or stripped artifacts may produce lower-granularity graphs; this is expressed through available attributes and later confidence scoring.
- Static and dynamic evidence can evolve independently without coupling protocol objects to one platform.
