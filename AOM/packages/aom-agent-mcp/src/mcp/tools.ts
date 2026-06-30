import type { ToolDefinition } from "./types.js";

export const tools: ToolDefinition[] = [
  {
    name: "aom.launch_for_handoff",
    description: [
      "Launch a debuggable app and attach AOM without closing it later.",
      "Returns compact readiness/analysis summary only; do not expect full context here.",
      "After this succeeds, prefer aom.route_context for task planning instead of reading the full launch analysis.",
      "The returned readiness only means AOM can observe/analyze; still verify action effects after execution.",
    ].join(" "),
    inputSchema: objectSchema({
      sessionId: stringSchema("Stable AOM session id. Defaults to platerun."),
      appPath: stringSchema("Optional .app directory path. AOM resolves Contents/MacOS automatically."),
      executablePath: stringSchema("Optional packaged app executable path."),
      timeoutMs: numberSchema("Launch and runtime readiness timeout in milliseconds."),
    }),
  },
  {
    name: "aom.attach_existing",
    description: [
      "Attach to an already-running debuggable app by CDP URL without owning or closing it.",
      "Returns compact readiness/analysis summary only; call aom.route_context for planning.",
      "After attach, call aom.route_context with the user task to get compact UI/data-flow windows.",
      "Do not relaunch or close a user-owned app through AOM.",
    ].join(" "),
    inputSchema: objectSchema({
      sessionId: stringSchema("Stable AOM session id."),
      cdpUrl: stringSchema("CDP http/ws endpoint."),
      appPath: stringSchema("Optional .app directory path for read-only static analysis."),
      artifactLocator: stringSchema("Optional app artifact path for read-only static analysis."),
    }, ["cdpUrl"]),
  },
  {
    name: "aom.snapshot",
    description: [
      "Debug tool: collect the raw runtime snapshot for an active AOM session.",
      "This can be large and low-level. Prefer aom.route_context or aom.context_window for normal task planning.",
      "Use snapshot only when you need raw node values/attributes that are not present in context windows.",
    ].join(" "),
    inputSchema: sessionSchema(),
  },
  {
    name: "aom.context_pack",
    description: [
      "Legacy/debug context: return the full AnalysisService context pack, capabilities, data flows, and graph summary.",
      "This may be large and can distract planning agents. Prefer aom.route_context first.",
      "Use this when route_context/context_window is insufficient or when auditing full context.",
    ].join(" "),
    inputSchema: sessionSchema(),
  },
  {
    name: "aom.route_context",
    description: [
      "Preferred planning entry after launch/attach and after every meaningful action.",
      "Return multiple task-routed windows; each window is beforeSummary + exact items + afterSummary.",
      "Use this to understand current UI, capabilities, recent effects, and data-flow hints without loading the full graph.",
      "If the previous action returned contextDelta, combine that delta outcome with this current-state view before planning.",
      "If lastContextDelta.outcome is verified, follow its recommendedTargets/recommendedNext before retrying the same action.",
      "For search/navigation tasks, inspect ui:primary_actions, ui:header, and dataflow:all before invoking actions.",
    ].join(" "),
    inputSchema: objectSchema({
      sessionId: stringSchema("Active AOM session id."),
      task: stringSchema("User task goal, e.g. 'search 科技资讯' or 'open profile'. Helps route UI/data-flow/event windows."),
      limit: numberSchema("Maximum exact items per returned window. Keep small for planning; use context_window to expand."),
    }, ["sessionId"]),
  },
  {
    name: "aom.context_window",
    description: [
      "Expand one routed sliding window by windowId/offset/limit.",
      "Use this after aom.route_context when a needed item is summarized outside the exact window.",
      "Data-flow windows are first-class; use dataflow:all to inspect evidence-linked flow without loading the full graph.",
    ].join(" "),
    inputSchema: objectSchema({
      sessionId: stringSchema("Active AOM session id."),
      windowId: stringSchema("Window id from route_context, e.g. ui:primary_actions, ui:header, ui:main, dataflow:all, event:recent, capability:all."),
      task: stringSchema("Optional user task goal for relevance metadata."),
      offset: numberSchema("Start offset within the window source."),
      limit: numberSchema("Maximum exact items in this window. Defaults to 12."),
    }, ["sessionId"]),
  },
  {
    name: "aom.context_delta",
    description: [
      "Return the latest semantic context diff for a session.",
      "Use this after invoke_capability/invoke_view when the action result was too large or when you need to know what changed.",
      "The delta preserves causal evidence: changed UI nodes, network endpoints, data-flow edges, capability changes, outcome status, and recommended next actions.",
      "For search tasks, if outcome.status is verified and nextStepHint says results loaded, stop repeating search and invoke one recommendedTargets entry.",
    ].join(" "),
    inputSchema: sessionSchema(),
  },
  {
    name: "aom.call_chain",
    description: [
      "Return only AOM's current dynamic tool-call chain recommendation.",
      "This tool does not execute anything and does not hide other AOM tools; it only proposes the next small sequence.",
      "Call it after every meaningful tool result before continuing autonomous work, because every invoke/route/window call can change the best chain.",
      "If the chain starts with invoke_* and that call verifies an effect, regenerate the chain instead of repeating prior actions.",
      "Use this when the agent is looping, unsure which context window to open, or choosing between capability and view invocation.",
    ].join(" "),
    inputSchema: objectSchema({
      sessionId: stringSchema("Active AOM session id."),
      task: stringSchema("Optional user task goal. Stored as the session planning task when present."),
      maxSteps: numberSchema("Maximum suggested steps to return. Defaults to 4, capped at 8."),
    }, ["sessionId"]),
  },
  {
    name: "aom.analysis_graph",
    description: [
      "Debug/explanation tool: return the full current AOM graph from AnalysisService.",
      "Prefer route_context/context_window for normal operation. Use analysis_graph for subgraph debugging, evidence tracing, or validator failures.",
      "Do not choose executable targets from graph text alone; use invoke_capability or graph-backed invoke_view.",
    ].join(" "),
    inputSchema: sessionSchema(),
  },
  {
    name: "aom.capabilities",
    description: [
      "List current executable capabilities and risk metadata.",
      "Prefer invoking by stable capability name when possible, because LLM-generated ids may include current view ids and can become stale after UI changes.",
      "If a capability disappears or becomes unknown, call route_context/capabilities again before retrying.",
    ].join(" "),
    inputSchema: sessionSchema(),
  },
  {
    name: "aom.invoke_capability",
    description: [
      "Invoke a current AOM executable capability using its graph-backed action plan.",
      "Use this before low-level invoke_view when a matching capability exists.",
      "Pass capabilityId as a stable name like search_content when available, or a full capability id from the latest route_context/context_pack/capabilities result.",
      "Inspect contextDelta.outcome first: it explains what changed, whether the effect was verified, and what to do next.",
      "The normal response is intentionally compact and does not include full contextPack; use route_context/context_delta next.",
      "actionResult.ok means the low-level action was dispatched, not that the user task succeeded; use contextDelta plus route_context to verify before retrying.",
    ].join(" "),
    inputSchema: objectSchema({
      sessionId: stringSchema("Active AOM session id."),
      capabilityId: stringSchema("Capability name or id. Prefer stable names like search_content/add_to_cart over stale LLM ids when possible."),
      inputs: {
        type: "object",
        description:
          "Capability inputs. Text capabilities accept aliases such as { query }, { text }, { text_input }, or the declared slot name. add_to_cart can use { product }.",
        additionalProperties: true,
      },
    }, ["sessionId", "capabilityId"]),
  },
  {
    name: "aom.invoke_view",
    description: [
      "Low-level fallback: invoke a current-screen AOM view by viewId, exact label, or rawId.",
      "Use only when no suitable capability exists or when deliberately probing a graph-backed view.",
      "Prefer viewId/rawId from the latest route_context/context_window/context_pack; labels can be ambiguous.",
      "Inspect contextDelta.outcome after the action. If it says the intended effect is verified, move to the recommended next action instead of repeating the same click/text.",
      "The normal response is intentionally compact and does not include full contextPack; use route_context/context_delta next.",
      "actionResult.ok only means the click/text action was dispatched. Verify effect via contextDelta and route_context before deciding the task is complete.",
    ].join(" "),
    inputSchema: objectSchema({
      sessionId: stringSchema("Active AOM session id."),
      viewId: stringSchema("AOM view id from the latest context window or contextPack.currentScreen.views."),
      label: stringSchema("Exact current view label when viewId is not known. Avoid if multiple views share the label."),
      rawId: stringSchema("Raw DOM reference from a runtime snapshot or context view rawReference."),
      action: stringSchema("Action type, usually click or set_text."),
      value: stringSchema("Text value for set_text."),
    }, ["sessionId"]),
  },
  {
    name: "aom.detach",
    description: [
      "Detach AOM from a session. Handoff-launched apps keep running for the user.",
      "Use when the task is done or when handing control back to the user. Detach is not a quit command.",
    ].join(" "),
    inputSchema: sessionSchema(),
  },
  {
    name: "aom.session_status",
    description: "List active AOM sessions and their readiness summary. Use to recover session ids before planning.",
    inputSchema: objectSchema({}),
  },
];

function sessionSchema(): ToolDefinition["inputSchema"] {
  return objectSchema({ sessionId: stringSchema("Active AOM session id.") }, ["sessionId"]);
}

function objectSchema(
  properties: Record<string, unknown>,
  required?: string[],
): ToolDefinition["inputSchema"] {
  return { type: "object", properties, ...(required ? { required } : {}) };
}

function stringSchema(description: string): Record<string, string> {
  return { type: "string", description };
}

function numberSchema(description: string): Record<string, string> {
  return { type: "number", description };
}
