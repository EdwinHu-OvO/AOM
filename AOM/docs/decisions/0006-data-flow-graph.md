# ADR 0006: Analysis Data Flow Graph

## Status

Accepted for Phase 2 data-flow completion.

## Context

The Phase 2 object graph can explain screens, views, events, endpoints, storage, and capability
affordances, but that is not enough to answer where a visible value came from or where an input
value went. Agents need a separate flow projection that keeps observed value movement distinct from
UI containment and event ordering.

## Decision

Analysis Core adds an evidence-linked MVP data-flow layer inside the AOM graph.

- `data_field` nodes represent observed or inferred values at a field boundary.
- `message` nodes represent network request or response messages.
- `flows_to` edges represent value movement between fields and messages.
- `renders_as` edges represent data becoming visible UI facts.
- `updates` edges represent verified capability effects on logical state.
- `derives_from` is reserved for later static and storage mutation analysis.

The data-flow layer remains evidence-first:

- request/response messages are observed evidence
- field nodes are inferred from events, message metadata, or rendered facts
- every data-flow edge must carry evidence IDs and must pass graph closure checks
- verified capability effects must use `EvidenceKind::Verified` and summarize the action/event/UI
  diff that made the effect trustworthy

Sensitive payload policy still applies. Sanitized request bodies and tokens are not reconstructed.
If a value is intentionally removed by the Adapter layer, Analysis may show a missing or partial
flow rather than guessing the secret.

This is not a claim of complete app data lineage. In particular, Phase 2 does not fully cover
redacted payload contents, IPC, preload bridge messages, `localStorage`/`sessionStorage`, reducer or
store internals, caches, virtualized lists, or every backend response schema. The graph should be
described as an evidence-linked MVP data-flow graph until those boundaries are expanded and tested.

## Scope

Phase 2 covers:

- text input value to query parameter when the value is observable
- request field to request message
- request message to response message
- response message to rendered UI facts
- logical storage to rendered session/cart/search state
- `add_to_cart` action to `cart.items` update when an Add click and cart count increase are both
  observed

Phase 3+ will expand this to IPC, preload bridge messages, local storage mutations, response body
schema summaries, reducer/store internals, cache behavior, virtualized list evidence, and broader
field-level effect verification.

## Consequences

- The object graph remains useful for navigation and action planning.
- The MVP data-flow graph becomes the basis for explaining observed provenance and side effects.
- Real apps with sanitized or unavailable payloads produce conservative partial flows instead of
  fabricated lineage.
