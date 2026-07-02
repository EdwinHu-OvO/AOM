import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export interface AuditRecord {
  auditId: string;
  timestamp: string;
  kind: "mcp_tool_call";
  toolName: string;
  sessionId?: string;
  ok: boolean;
  durationMs: number;
  arguments: Record<string, unknown>;
  summary: Record<string, unknown>;
  error?: string;
}

export class AuditRecorder {
  constructor(private readonly filePath = defaultAuditPath()) {}

  record(input: {
    toolName: string;
    args: Record<string, unknown>;
    ok: boolean;
    durationMs: number;
    result?: unknown;
    error?: unknown;
  }): void {
    const foundSessionId = sessionId(input.args);
    const record: AuditRecord = {
      auditId: `audit:mcp:${Date.now()}:${Math.random().toString(16).slice(2)}`,
      timestamp: new Date().toISOString(),
      kind: "mcp_tool_call",
      toolName: input.toolName,
      ok: input.ok,
      durationMs: input.durationMs,
      arguments: summarizeArgs(input.args),
      summary: summarizeResult(input.result),
      ...(foundSessionId ? { sessionId: foundSessionId } : {}),
      ...(input.error ? { error: errorMessage(input.error) } : {}),
    };
    mkdirSync(path.dirname(this.filePath), { recursive: true });
    appendFileSync(this.filePath, `${JSON.stringify(record)}\n`);
  }
}

export function defaultAuditPath(): string {
  return process.env.AOM_AUDIT_LOG
    ?? path.resolve(new URL("../../../../logs/aom-audit.jsonl", import.meta.url).pathname);
}

function summarizeArgs(args: Record<string, unknown>): Record<string, unknown> {
  const keys = [
    "sessionId",
    "capabilityId",
    "viewId",
    "label",
    "rawId",
    "action",
    "appPath",
    "artifactLocator",
    "executablePath",
    "timeoutMs",
    "task",
    "windowId",
    "offset",
    "limit",
    "maxSteps",
    "defaultLimit",
    "avoidCollisions",
  ];
  const summary: Record<string, unknown> = {};
  for (const key of keys) {
    if (args[key] !== undefined) summary[key] = args[key];
  }
  if (typeof args.cdpUrl === "string") summary.cdpUrl = redactUrl(args.cdpUrl);
  if (args.inputs && typeof args.inputs === "object") summary.inputs = args.inputs;
  if (Array.isArray(args.requests)) summary.requests = args.requests;
  return summary;
}

function summarizeResult(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const result = value as Record<string, unknown>;
  if (Array.isArray(value)) return { type: "capabilities", capabilities: capabilityNames(value) };
  if (Array.isArray(result.nodes) && Array.isArray(result.edges)) {
    return graphSummary(result);
  }
  if (result.actionResult && typeof result.actionResult === "object") {
    return {
      type: "action",
      actionResult: actionResultSummary(result.actionResult),
      eventCount: result.eventCount,
      contextDelta: contextDeltaSummary(result.contextDelta),
      nextCallChain: callChainSummary(result.nextCallChain),
      analysis: analysisSummary(result.analysis),
    };
  }
  if (result.chainId && Array.isArray(result.steps)) {
    return { type: "call_chain", callChain: callChainSummary(result) };
  }
  if (result.outcome && result.currentGraphId) {
    return {
      type: "context_delta",
      contextDelta: contextDeltaSummary(result),
      nextCallChain: callChainSummary(result.nextCallChain),
    };
  }
  if (result.graphSummary || result.contextPack || result.capabilities) {
    return { type: "analysis", ...analysisSummary(result), nextCallChain: callChainSummary(result.nextCallChain) };
  }
  if (result.strategy === "agent_directed_multi_cursor_windows" && Array.isArray(result.windows)) {
    return {
      type: "context_windows",
      graphId: result.graphId,
      task: result.task,
      collisionPolicy: result.collisionPolicy,
      cursorCount: Array.isArray(result.cursors) ? result.cursors.length : undefined,
      windows: result.windows.map(windowSummary),
      nextCallChain: callChainSummary(result.nextCallChain),
    };
  }
  if (Array.isArray(result.windows)) {
    return {
      type: "context_route",
      pageSummary: result.pageSummary,
      routedBy: result.routedBy,
      windows: result.windows.map(windowSummary),
      handleCount: Array.isArray(result.handles) ? result.handles.length : undefined,
      lastContextDelta: contextDeltaSummary(result.lastContextDelta),
      nextCallChain: callChainSummary(result.nextCallChain),
    };
  }
  if (result.window && result.beforeSummary && result.afterSummary) {
    return {
      type: "context_window",
      window: windowSummary(result),
      nextCallChain: callChainSummary(result.nextCallChain),
    };
  }
  if (result.analysis) {
    return {
      ...pick(result, ["sessionId", "targetId", "lifecycle", "cdpUrl", "processId", "detached", "targetRetained"]),
      analysis: analysisSummary(result.analysis),
      nextCallChain: callChainSummary(result.nextCallChain),
    };
  }
  if (Array.isArray(result.nodes)) return { type: "runtime_snapshot", nodeCount: result.nodes.length };
  if (Array.isArray(result.sessions)) return { type: "status", sessionCount: result.sessions.length };
  return pick(result, ["sessionId", "targetId", "lifecycle", "cdpUrl", "processId", "detached", "targetRetained", "readiness"]);
}

function analysisSummary(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const analysis = value as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  if (analysis.graphSummary) summary.graphSummary = analysis.graphSummary;
  if (Array.isArray(analysis.capabilities)) summary.capabilities = capabilityNames(analysis.capabilities);
  const context = analysis.contextPack as { dataFlows?: unknown[] } | undefined;
  if (context?.dataFlows) summary.dataFlowCount = context.dataFlows.length;
  if (analysis.verification) summary.verification = analysis.verification;
  if (analysis.recognition) summary.recognition = recognitionSummary(analysis.recognition);
  if (analysis.readiness) summary.readiness = analysis.readiness;
  return summary;
}

function recognitionSummary(value: unknown): Record<string, unknown> {
  const recognition = value as Record<string, unknown>;
  return pick(recognition, ["provider", "model", "enabled", "accepted", "rejected", "repairAttempts", "error"]);
}

function windowSummary(value: unknown): Record<string, unknown> {
  const window = value as Record<string, unknown>;
  const exact = window.window as { items?: unknown[]; repeatedGroups?: unknown[] } | undefined;
  return {
    windowId: window.windowId,
    kind: window.kind,
    title: window.title,
    scope: window.scope,
    exactItemCount: exact?.items?.length,
    repeatedGroupCount: exact?.repeatedGroups?.length,
    before: (window.beforeSummary as Record<string, unknown> | undefined)?.summary,
    after: (window.afterSummary as Record<string, unknown> | undefined)?.summary,
  };
}

function contextDeltaSummary(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const delta = value as Record<string, unknown>;
  const ui = delta.ui as { added?: unknown[]; removed?: unknown[]; updated?: unknown[] } | undefined;
  const data = delta.data as { addedObjects?: unknown[]; updatedObjects?: unknown[] } | undefined;
  const network = delta.network as { requests?: unknown[]; responses?: unknown[] } | undefined;
  const dataFlow = delta.dataFlow as { addedEdges?: unknown[]; removedEdges?: unknown[] } | undefined;
  const capabilities = delta.capabilities as {
    added?: unknown[];
    removed?: unknown[];
    changed?: unknown[];
    recommendedNext?: unknown[];
    recommendedTargets?: unknown[];
  } | undefined;
  const outcome = delta.outcome as Record<string, unknown> | undefined;
  return {
    previousGraphId: delta.previousGraphId,
    currentGraphId: delta.currentGraphId,
    cause: delta.cause,
    outcome: outcome ? pick(outcome, ["status", "summary", "nextStepHint"]) : undefined,
    uiAdded: ui?.added?.length,
    uiRemoved: ui?.removed?.length,
    uiUpdated: ui?.updated?.length,
    dataAdded: data?.addedObjects?.length,
    dataUpdated: data?.updatedObjects?.length,
    networkRequests: network?.requests?.length,
    networkResponses: network?.responses?.length,
    dataFlowAdded: dataFlow?.addedEdges?.length,
    capabilityAdded: capabilities?.added?.length,
    capabilityRemoved: capabilities?.removed?.length,
    capabilityChanged: capabilities?.changed?.length,
    recommendedNext: capabilities?.recommendedNext,
    recommendedTargetCount: capabilities?.recommendedTargets?.length,
  };
}

function callChainSummary(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") return undefined;
  const chain = value as Record<string, unknown>;
  const steps = Array.isArray(chain.steps) ? chain.steps as Record<string, unknown>[] : [];
  return {
    chainId: chain.chainId,
    status: chain.status,
    graphId: chain.graphId,
    summary: chain.summary,
    stepCount: steps.length,
    tools: steps.map((item) => item.toolName),
    firstStep: steps[0]
      ? pick(steps[0], ["toolName", "arguments", "reason", "stopIf"])
      : undefined,
  };
}

function graphSummary(graph: Record<string, unknown>): Record<string, unknown> {
  return {
    type: "graph",
    graphId: graph.graphId,
    currentScreenId: graph.currentScreenId,
    nodeCount: Array.isArray(graph.nodes) ? graph.nodes.length : undefined,
    edgeCount: Array.isArray(graph.edges) ? graph.edges.length : undefined,
    evidenceCount: Array.isArray(graph.evidence) ? graph.evidence.length : undefined,
  };
}

function capabilityNames(items: unknown[]): string[] {
  return items.map((item) => {
    const capability = item && typeof item === "object"
      ? (item as { capability?: { name?: string; id?: string } }).capability
      : undefined;
    return capability?.name ?? capability?.id ?? "unknown";
  });
}

function actionResultSummary(value: unknown): Record<string, unknown> {
  const result = value as Record<string, unknown>;
  return pick(result, ["actionId", "targetId", "ok", "errorCode", "message"]);
}

function pick(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const key of keys) {
    if (source[key] !== undefined) result[key] = source[key];
  }
  return result;
}

function sessionId(args: Record<string, unknown>): string | undefined {
  return typeof args.sessionId === "string" ? args.sessionId : undefined;
}

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return url;
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
