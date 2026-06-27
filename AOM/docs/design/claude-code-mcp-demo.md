# Claude Code MCP Demo

## Goal

Use Claude Code as the Phase 5 Agent host while keeping AOM provider-neutral.

Claude Code talks to `@aom/agent-mcp` over stdio MCP. The MCP server calls AOM's
`AgentInteractionService`, which manages target lifecycle and delegates Electron runtime work to
`@aom/electron-probe`.

## Build

```text
cd /Users/edwinh/Desktop/AOM/AOM
pnpm build
```

## Claude Code Server Command

Use this command from the AOM workspace:

```text
node /Users/edwinh/Desktop/AOM/AOM/packages/aom-agent-mcp/dist/bin/aom-mcp-server.js
```

Useful environment override:

```text
AOM_TARGET_APP_EXECUTABLE=/Users/edwinh/Desktop/AOM/targetAPP/release/mac-arm64/PlateRun.app/Contents/MacOS/PlateRun
```

## Demo Flow

1. `aom.launch_for_handoff`
   - starts PlateRun with `--remote-debugging-port=<port>`
   - returns `sessionId`, `cdpUrl`, `processId`, and initial context

2. `aom.context_pack`
   - returns Rust AnalysisService context, graph summary, data flows, capabilities, and verification

3. `aom.analysis_graph`
   - returns the full current AOM graph when the Agent needs to inspect exact nodes, edges, and
     Evidence instead of guessing from visible labels

4. `aom.capabilities`
   - returns `search_product`, `add_to_cart`, `login`, and `view_product_detail` when recognized
   - includes slots, action plan, expected effects, risk metadata, availability, and reasons

5. `aom.invoke_capability`
   - executes the Capability Layer action plan for a current capability
   - `add_to_cart` accepts `inputs.product`, such as `{ "product": "Tonkotsu Ramen" }`

6. `aom.invoke_view`
   - invokes a specific current-screen AOM view by `viewId` or exact label when the capability is
     too coarse

7. `aom.detach`
   - detaches AOM
   - handoff-launched PlateRun remains available to the user

8. `aom.attach_existing`
   - later reattaches to the returned `cdpUrl`

## Current Boundary

This is a Phase 5 demo surface, not the final Safety Gateway.

- Capability discovery is still MVP-recognizer based.
- Context pack and graph come from Rust AnalysisService via a bridge, not MCP-local shortcuts.
- Data flow is an evidence-linked MVP data-flow graph, not complete app data lineage.
- P5 does not enforce Phase 4 safety policy. Risk metadata is visible to the Agent and user, but
  execution blocking/confirmation belongs to the future Gateway.
- High-fidelity dynamic control requires `launch_for_handoff` or an existing CDP endpoint.
- Already-running apps without CDP still require future OS-level fallback adapters.

## Task Prompt For Ordering Demo

Use a prompt that forces the Agent to plan from AOM context instead of browsing by trial and error:

```text
Use AOM to help me place a PlateRun order.

Rules:
- First call aom.context_pack and read graphSummary, currentScreen, productGroups, cart, dataFlows, capabilities, and verification.
- If you are unsure which node to operate, call aom.analysis_graph and inspect current-screen view nodes and evidence.
- Choose products only from productGroups.
- To add an item, call aom.invoke_capability with capabilityId "add_to_cart" and inputs.product.
- After adding, call aom.context_pack and verify cart.itemCount or cart.total changed.
- Open the cart by invoking the graph view/capability that AOM marks as current and relevant.
- Before any final purchase/checkout action, ask me for explicit confirmation as a product rule.
- Do not solve this by repeatedly clicking navigation buttons.
```
