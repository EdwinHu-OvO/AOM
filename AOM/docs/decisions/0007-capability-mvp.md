# ADR 0007: Capability MVP

## Status

Accepted for Phase 3 MVP.

## Context

Phase 2 can build a stable AOM graph with screens, views, events, API endpoints, storage keys,
data flow, and Evidence. Agents still need a smaller reusable layer: named capabilities with
inputs, plans, expected effects, confidence, and risk. This layer must not become another
automation framework or bypass the Safety Gateway.

## Decision

Add a Rust crate named `aom-capability`.

The crate consumes `AOMGraphSnapshot` and returns `ExecutableCapability` values. Each value wraps
the protocol-level `AOMCapability` and adds Phase 3 execution metadata:

- `availability`
- `actionPlan`
- structured `expectedEffects`
- `automation` policy
- `reasons`

Capability mining is deterministic and evidence-grounded. A capability is returned only when the
graph has a capability node. Current availability is then computed from confidence and whether the
graph contains a concrete current target for its action plan.

The Phase 3 rules are MVP capability recognizer recipes, not general app understanding. Some rules
intentionally use PlateRun-friendly anchors such as `/api/login`, `/api/stores`, and `cart.items`
to prove a vertical workflow. These anchors are allowed for the MVP only when the capability output
keeps its evidence, confidence, availability, and risk explicit. They must not be presented as a
generic recognizer for all apps.

Action targets must come from interactive `view` nodes contained by `graph.currentScreenId`. Storage
keys and API endpoints may be global graph nodes, but click/text action steps must not target
historical screens or non-view nodes.

Phase 3 supports these rules:

- `login`
- `search_product`
- `view_product_detail`
- `add_to_cart`
- `checkout_prepare`

`search_product` declares a required `keyword` input slot and a transport-neutral plan:

1. Set text on the search view.
2. Observe `/api/stores`.
3. Verify result list change or search state update.

`add_to_cart` declares a `product` object slot and a plan:

1. Click a matching Add view.
2. Observe cart state.
3. Verify `cart.items`.

Verified P2 `updates` evidence is attached to `add_to_cart` expected effects when present.

## Safety Boundary

`riskLevel` and `automation.canAutoExecute` are hints, not final authorization. Medium and high risk
capabilities do not auto-execute in Phase 3. Phase 4 Gateway remains responsible for allow, deny,
redaction, audit, and confirmation.

## Consequences

- Agent-facing code can query `AnalysisService::capabilities()` without traversing the whole graph.
- Bundle analysis now writes `capabilities.json` beside `graph.json` and `context-pack.json`.
- Low-confidence capabilities are visible but not auto-executable.
- Historical capabilities can remain queryable while reporting `missing_target` when their action
  view is not available on the current screen.
- `checkout_prepare` can exist as a high-risk capability only when the current graph contains a
  checkout/order submission target.
- Future learned or platform-specific capabilities must still produce the same executable schema
  and evidence-grounded reasons.
- Future recognizers should promote app-specific recipe anchors into reusable signals: UI role and
  text semantics, event/data-flow evidence, endpoint and storage naming patterns, tool provenance,
  current-screen actionability, and conservative confidence thresholds.
