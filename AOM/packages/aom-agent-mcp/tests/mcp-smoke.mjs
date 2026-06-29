import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { strict as assert } from "node:assert";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { runAnalysis } from "../dist/analysis/bridge.js";
import { recognizeCapabilities } from "../dist/capability/llm.js";
import { validateCandidates } from "../dist/capability/validate.js";
import { buildContextDelta } from "../dist/context/delta.js";
import { contextWindow, routeContext } from "../dist/context/windows.js";
import { actionForCapability, actionForView } from "../dist/interaction/actions.js";
import { compactAgentPayload } from "../dist/interaction/analysis.js";

const auditFile = path.join(mkdtempSync(path.join(tmpdir(), "aom-audit-")), "audit.jsonl");
const child = spawn(
  process.execPath,
  ["dist/bin/aom-mcp-server.js"],
  {
    cwd: new URL("..", import.meta.url),
    stdio: ["pipe", "pipe", "inherit"],
    env: { ...process.env, AOM_AUDIT_LOG: auditFile },
  },
);
const replies = createInterface({ input: child.stdout, crlfDelay: Infinity })[Symbol.asyncIterator]();

try {
  const initialized = await request(1, "initialize", {});
  assert.equal(initialized.result.serverInfo.name, "aom-mcp-server");

  const listed = await request(2, "tools/list", {});
  const toolNames = listed.result.tools.map((tool) => tool.name);
  assert.ok(toolNames.includes("aom.launch_for_handoff"));
  assert.ok(toolNames.includes("aom.context_pack"));
  assert.ok(toolNames.includes("aom.route_context"));
  assert.ok(toolNames.includes("aom.context_window"));
  assert.ok(toolNames.includes("aom.context_delta"));
  assert.ok(toolNames.includes("aom.analysis_graph"));
  assert.ok(toolNames.includes("aom.detach"));
  assert.ok(toolNames.includes("aom.invoke_capability"));
  assert.ok(toolNames.includes("aom.invoke_view"));

  const status = await request(3, "tools/call", {
    name: "aom.session_status",
    arguments: {},
  });
  assert.equal(status.result.content[0].type, "text");
  assert.match(status.result.content[0].text, /"sessions"/);
  const auditRecord = JSON.parse(readFileSync(auditFile, "utf8").trim());
  assert.equal(auditRecord.toolName, "aom.session_status");
  assert.equal(auditRecord.ok, true);
  const missingDelta = await request(4, "tools/call", {
    name: "aom.context_delta",
    arguments: { sessionId: "missing-session" },
  });
  assert.equal(missingDelta.error.code, -32603);
  assert.match(missingDelta.error.message, /unknown_session/);

  const analysis = await runAnalysis(fixtureInput());
  const screen = analysis.contextPack.currentScreen;
  assert.ok(screen.productGroups.some((item) => item.name === "Tonkotsu Ramen"));
  assert.equal(analysis.contextPack.cart.itemCount, 0);
  assert.ok(analysis.contextPack.dataFlows.length > 0);
  assert.ok(analysis.capabilities.some((item) => item.capability.name === "add_to_cart"));
  const routed = routeContext(analysis, { task: "search ramen and inspect result data flow", limit: 3 });
  assert.ok(routed.pageSummary.dataFlowPreserved, "routed context should preserve data-flow availability");
  assert.ok(routed.routedBy.selectedWindowIds.includes("dataflow:all"));
  assert.ok(routed.routedBy.selectedWindowIds.includes("ui:header"));
  assert.ok(routed.windows.every((item) => item.beforeSummary && item.window && item.afterSummary));
  const dataFlowWindow = contextWindow(analysis, { windowId: "dataflow:all", offset: 0, limit: 2 });
  assert.equal(dataFlowWindow.kind, "data_flow");
  assert.ok(dataFlowWindow.window.items.length <= 2);
  assert.ok(dataFlowWindow.handles.next || dataFlowWindow.scope.total <= 2);
  const mainWindow = contextWindow(analysis, { windowId: "ui:main", offset: 0, limit: 2 });
  assert.ok(Array.isArray(mainWindow.window.repeatedGroups));
  const clampedMainWindow = contextWindow(analysis, { windowId: "ui:main", offset: 999, limit: 2 });
  assert.ok(
    clampedMainWindow.scope.total === 0 || clampedMainWindow.window.items.length > 0,
    "out-of-range context windows should clamp to a non-empty final page",
  );
  const compact = compactAgentPayload(analysis);
  assert.ok(!("contextPack" in compact), "compact agent payload must not include the full context pack");
  assert.ok(compact.contextSummary.dataFlowCount > 0);
  const afterSearch = structuredClone(analysis);
  afterSearch.graph.graphId = "graph:fixture:after-search";
  afterSearch.graph.nodes.push({
    id: "aom:view:search-result-1",
    type: "view",
    label: "Ramen technology review",
    features: { role: "link", actions: ["click"], rawReference: "dom:#result-1" },
    evidenceIds: ["evidence:search-result"],
    confidence: 0.9,
  });
  afterSearch.graph.nodes.push({
    id: "aom:api:search",
    type: "api_endpoint",
    label: "GET /x/web-interface/wbi/search/all/v2",
    features: { method: "GET", path: "/x/web-interface/wbi/search/all/v2" },
    evidenceIds: ["evidence:search-request"],
    confidence: 0.95,
  });
  afterSearch.graph.edges.push({
    id: "aom:edge:search-request",
    from: "aom:view:search-box",
    to: "aom:api:search",
    type: "requests",
    confidence: 0.9,
    evidenceIds: ["evidence:search-request"],
  });
  afterSearch.graph.edges.push({
    id: "aom:edge:search-renders-result",
    from: "aom:api:search",
    to: "aom:view:search-result-1",
    type: "renders_as",
    confidence: 0.74,
    evidenceIds: ["evidence:search-result"],
  });
  const delta = buildContextDelta({
    before: analysis,
    after: afterSearch,
    cause: {
      toolName: "aom.invoke_capability",
      capabilityName: "search_content",
      inputSummary: { query: "科技资讯" },
    },
    actionResult: { actionId: "action:test", targetId: "target:fixture", ok: true, evidenceIds: [] },
    eventCount: 3,
  });
  assert.equal(delta.outcome.status, "verified");
  assert.match(delta.outcome.nextStepHint, /Open a relevant result/);
  assert.ok(delta.ui.added.some((item) => item.label === "Ramen technology review"));
  assert.ok(delta.network.requests.some((item) => item.path === "/x/web-interface/wbi/search/all/v2"));
  assert.ok(delta.dataFlow.addedEdges.some((item) => item.id === "aom:edge:search-renders-result"));
  assert.ok(delta.capabilities.recommendedNext.includes("open_content_result"));
  assert.ok(delta.capabilities.recommendedTargets.some((item) =>
    item.toolName === "aom.invoke_view" && item.viewId === "aom:view:search-result-1"
  ));
  const noChangeDelta = buildContextDelta({
    before: analysis,
    after: structuredClone(analysis),
    cause: { toolName: "aom.invoke_view", actionType: "click", targetLabel: "No-op" },
    actionResult: { actionId: "action:noop", targetId: "target:fixture", ok: true, evidenceIds: [] },
    eventCount: 0,
  });
  assert.equal(noChangeDelta.outcome.status, "no_change");
  assert.equal(noChangeDelta.capabilities.recommendedNext.length, 0);
  const failedDelta = buildContextDelta({
    before: analysis,
    after: structuredClone(analysis),
    cause: { toolName: "aom.invoke_view", actionType: "click", targetLabel: "Missing" },
    actionResult: {
      actionId: "action:failed",
      targetId: "target:fixture",
      ok: false,
      errorCode: "target_not_found",
      evidenceIds: [],
    },
    eventCount: 0,
  });
  assert.equal(failedDelta.outcome.status, "failed");
  assert.match(failedDelta.outcome.summary, /dispatch failed/);

  const addView = screen.views.find((item) => item.label === "Add Tonkotsu Ramen");
  assert.ok(addView.rawReference);
  assert.equal(
    actionForView(analysis, "target:fixture", { rawId: addView.rawReference }).targetRawId,
    addView.rawReference,
  );
  const validated = validateCandidates(analysis, [{
    name: "open_menu_item",
    targetViewId: addView.id,
    action: "click",
    confidence: 0.82,
    reason: "view is an Add button for a visible menu item",
  }], {
    enabled: true,
    provider: "openai_compatible",
    baseUrl: "http://127.0.0.1:9/v1",
    model: "fake",
  });
  assert.equal(validated.accepted.length, 1);
  const searchCapabilityAction = actionForCapability(
    analysis,
    "target:fixture",
    "search_product",
    { text_input: "ramen" },
  );
  assert.equal(searchCapabilityAction.params.value, "ramen");
  assert.equal(searchCapabilityAction.params.submitKey, "Enter");
  const viewAction = actionForView(analysis, "target:fixture", { rawId: addView.rawReference });
  assert.equal(viewAction.targetRawId, addView.rawReference);

  process.env.AOM_TEST_LLM_KEY = "inline-test-key";
  const restoreFetch = fakeRecognizerFetch(addView.id, (headers, callCount) => {
    assert.equal(headers.authorization, "Bearer inline-test-key");
    assert.equal(headers["x-extra-key"], "inline-test-key");
    if (callCount === 2) assert.ok(true);
  });
  const recognizerAnalysis = structuredClone(analysis);
  const trace = await recognizeCapabilities(recognizerAnalysis, {
    enabled: true,
    provider: "openai_compatible",
    baseUrl: "http://127.0.0.1:9/v1",
    model: "fake-qwen",
    apiKey: "inline-test-key",
    headers: { "x-extra-key": "$AOM_TEST_LLM_KEY" },
    timeoutMs: 1000,
  });
  restoreFetch();
  assert.equal(trace.accepted, 1);
  assert.equal(trace.repairAttempts, 1);
  assert.ok(recognizerAnalysis.capabilities.some((item) =>
    item.capability.name === "open_menu_item"
  ));

  const restoreLegacyFetch = fakeRecognizerFetch(addView.id, (headers) => {
    assert.equal(headers.authorization, "Bearer literal-legacy-key");
  }, { needsRepair: false });
  await recognizeCapabilities(structuredClone(analysis), {
    enabled: true,
    provider: "openai_compatible",
    baseUrl: "http://127.0.0.1:9/v1",
    model: "fake-qwen",
    apiKeyEnv: "literal-legacy-key",
    timeoutMs: 1000,
  });
  restoreLegacyFetch();
} finally {
  child.stdin.end();
  child.kill();
}

function fakeRecognizerFetch(targetViewId, assertHeaders, options = { needsRepair: true }) {
  const original = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = async (url, init) => {
    callCount += 1;
    assert.equal(String(url), "http://127.0.0.1:9/v1/chat/completions");
    assertHeaders(Object.fromEntries(new Headers(init.headers).entries()), callCount);
    const body = JSON.parse(String(init.body));
    assert.equal(body.model, "fake-qwen");
    return new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify(options.needsRepair && callCount === 1
            ? { candidates: [{ target_view_id: targetViewId, operation: "tap" }] }
            : {
              capabilities: [{
                capability: "open_menu_item",
                target_view_id: targetViewId,
                operation: "tap",
                score: "83%",
                why: "visible Add button is a concrete menu action",
              }],
            }),
        },
      }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  return () => {
    globalThis.fetch = original;
  };
}

function fixtureInput() {
  return JSON.parse(readFileSync(
    new URL("../../../docs/traces/2026-06-25-phase2-iteration3/raw-bundle.json", import.meta.url),
    "utf8",
  ));
}

async function request(id, method, params) {
  child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
  const reply = await replies.next();
  if (reply.done) throw new Error("mcp server exited before reply");
  return JSON.parse(reply.value);
}
