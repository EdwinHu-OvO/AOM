# ADR 0005: Analysis Identity, Evidence, and LLM Context

## Status

Accepted for the Phase 2 deterministic baseline and MVP graph closure.

## Context

Adapter output contains platform raw references, static artifacts, runtime nodes, events, and
tool Evidence. Agents should not consume those records directly: DOM paths are unstable,
static and dynamic observations have different scopes, and a flat list of visible strings can
cause an LLM to associate the wrong price, count, user, or action.

## Decision

Analysis Core owns three contracts.

### Stable identity

- AOM IDs are deterministic within one target.
- Screen IDs use semantic screen keys.
- View IDs use screen, role, label, input kind, and duplicate ordinal.
- Platform raw references remain node features for execution and Evidence; they are not the
  Agent-facing identity.
- The same normalized input must produce the same IDs and graph structure.

### First-class Evidence

- Evidence is stored as observed, inferred, or verified.
- Evidence retains target, timestamp, source IDs, derivation, and metadata.
- Every normalized node and edge links to Evidence IDs.
- Context summaries include timestamp and related AOM object IDs instead of unscoped text.

Verified Evidence is reserved for effects that can be checked against ordered observations, such
as a transition supported by action/network/state events. Expected effects remain inferred until
a later snapshot or event chain confirms them.

### Logical storage and capability nodes

Analysis may infer logical storage keys when runtime state is observable but the physical store is
not yet exposed. Examples include `session.authenticated`, `search.query`, and `cart.items`.
These nodes use `storage_key` plus `reads` / `writes` edges and must carry inferred Evidence.

Phase 2 capability nodes are graph affordances, not Phase 3 executable skills. They may summarize
observed or inferred interaction patterns such as `login`, `search_product`, and `add_to_cart`.
Executable inputs, multi-step plans, risk scoring, and Gateway policy remain Phase 3/4 work.

### LLM context

The context pack is a projection of the graph, not a second source of truth. It must:

- separate current screen objects from historical transition objects
- preserve event sequence, timestamp, request ID, target view, and network result
- distinguish static endpoint discovery from runtime observation
- express session, browse, cart, and product group state explicitly
- state whether an operation mutates state and its expected observable effect
- label deterministic inference with confidence and limitations

DOM ancestry may be used internally to group one product card's name, description, price, and
action. The emitted relationship uses stable AOM IDs; raw DOM paths remain implementation
evidence.

## Validation rule

Phase 2 context quality is tested with isolated LLM evaluators that receive only the generated
context pack. Misunderstandings are treated as schema defects when the underlying observation
already exists.

This does not replace deterministic tests. Blind evaluation checks usability; Rust and
TypeScript tests check identity, ordering, serialization, and graph invariants.

## Consequences

- More visible text is not automatically better context.
- Relations and scope take priority over flat evidence volume.
- Context packs can support low-risk planning before Phase 3 capability mining.
- Expected effects are analysis hypotheses until a later snapshot verifies them.
- Permissions, confirmation, and sensitive operation policy remain Phase 4 Gateway concerns.
