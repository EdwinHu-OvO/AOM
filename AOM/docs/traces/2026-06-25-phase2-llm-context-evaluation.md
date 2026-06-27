# Phase 2 PlateRun Context Evaluation

## Purpose

Validate whether an LLM with no repository or application context can understand a real target
application from AOM Analysis output alone. Each evaluation used a new isolated agent and only
one generated `context-pack.json`.

## Real input

- Target: packaged `PlateRun.app`
- Static graph input: 103 raw static nodes
- Runtime before login: 22 raw nodes
- Runtime after login: 142 raw nodes
- Runtime events: 11
- Final normalized graph: 79 nodes, 113 edges, 86 Evidence records
- Workflow: enter phone and password, click Sign in, observe login, address, and order requests

The target application was not modified with AOM selectors or test hooks.

## Evaluation rounds

| Round | Score | Main result |
| --- | ---: | --- |
| Baseline | 78 | Understood food ordering and login, but app label, actions, endpoint results, and state were weak. |
| Iteration 2 | 74 | More visible facts increased ambiguity because user, cart, prices, and events were still flat and unscoped. |
| Iteration 3A | 88 | Structured session, cart, selected store, product groups, ordered events, and static/runtime endpoints removed core misunderstandings. |
| Iteration 3B | 89 | Operation kind, mutation flag, expected effect, DOM mutation labels, and scoped Evidence supported safe low-risk planning. |

The score drop from 78 to 74 is an important result: adding text without relationships made the
context harder to use.

## Changes driven by blind evaluation

- Application label and observed purpose are explicit.
- Cross-channel DOM/CDP events are timestamped before drain and assigned one ordered sequence.
- Context events retain target view, request ID, method, path, status, and mutation count.
- `StateChange` is described as a DOM mutation rather than a verified business transition.
- Product card structure binds product, description, price, and Add action.
- `menu_item_count`, `cart_item_count`, and `cart_subtotal` are separate facts.
- Session user, selected store, and cart state have dedicated context fields.
- Endpoints distinguish `staticallyDiscovered` from `runtimeObserved`.
- Views declare `operationKind`, `mutatesState`, and an expected observable effect.
- Evidence summaries carry timestamp and related AOM object IDs.

## Final no-context understanding

The isolated evaluator correctly identified:

- PlateRun is an Electron food ordering application.
- Mina Chen is authenticated.
- the current screen is Browse restaurants.
- Tokyo Ramen Lab is selected with three correctly paired products and prices.
- the cart is empty with a `$0.00` subtotal.
- login was followed by successful address and order retrieval.
- search, cart navigation, order navigation, and one product add can be planned using stable view IDs.

It did not confuse menu count with cart count, static endpoints with runtime calls, or historical
login controls with current views.

## Remaining boundary

The context is not yet a verified Phase 3 capability. It lacks:

- a real post-action snapshot proving an Add action changed cart count and subtotal
- target screen IDs for navigation outcomes
- search result to query causality
- cart line-item structure
- Gateway permission and confirmation decisions

`tests/integration/capture-cart-analysis-bundle.mjs` was added to capture a real add-to-cart
before/event/after bundle. Its live run was blocked by local process authorization quota on
2026-06-25, so no successful cart trace is claimed.

## Artifacts

- `docs/traces/2026-06-25-phase2-baseline/`
- `docs/traces/2026-06-25-phase2-iteration2/`
- `docs/traces/2026-06-25-phase2-iteration3/`
