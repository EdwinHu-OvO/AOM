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
    "action",
    "appPath",
    "artifactLocator",
    "executablePath",
    "timeoutMs",
  ];
  const summary: Record<string, unknown> = {};
  for (const key of keys) {
    if (args[key] !== undefined) summary[key] = args[key];
  }
  if (typeof args.cdpUrl === "string") summary.cdpUrl = redactUrl(args.cdpUrl);
  if (args.inputs && typeof args.inputs === "object") summary.inputs = args.inputs;
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
      analysis: analysisSummary(result.analysis),
    };
  }
  if (result.graphSummary || result.contextPack || result.capabilities) {
    return { type: "analysis", ...analysisSummary(result) };
  }
  if (Array.isArray(result.nodes)) return { type: "runtime_snapshot", nodeCount: result.nodes.length };
  if (Array.isArray(result.sessions)) return { type: "status", sessionCount: result.sessions.length };
  return pick(result, ["sessionId", "targetId", "lifecycle", "cdpUrl", "processId", "detached", "targetRetained"]);
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
  return summary;
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
