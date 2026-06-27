import { createInterface } from "node:readline";
import { AgentInteractionService } from "../interaction/service.js";
import { AuditRecorder } from "./audit.js";
import { tools } from "./tools.js";
import type { JsonRpcRequest, ToolCallParams } from "./types.js";
import { textResult } from "./types.js";

export class AOMMcpServer {
  constructor(
    private readonly service = new AgentInteractionService(),
    private readonly audit = new AuditRecorder(),
  ) {}

  start(): void {
    const lines = createInterface({ input: process.stdin, crlfDelay: Infinity });
    lines.on("line", (line) => {
      void this.handleLine(line);
    });
  }

  private async handleLine(line: string): Promise<void> {
    if (!line.trim()) return;
    let request: JsonRpcRequest;
    try {
      request = JSON.parse(line) as JsonRpcRequest;
    } catch (error) {
      this.writeError(null, -32700, errorMessage(error));
      return;
    }
    if (request.id === undefined) return;
    try {
      const result = await this.dispatch(request);
      this.write({ jsonrpc: "2.0", id: request.id, result });
    } catch (error) {
      this.writeError(request.id, -32603, errorMessage(error));
    }
  }

  private async dispatch(request: JsonRpcRequest): Promise<unknown> {
    switch (request.method) {
      case "initialize":
        return {
          protocolVersion: "2024-11-05",
          capabilities: { tools: {} },
          serverInfo: { name: "aom-mcp-server", version: "0.1.0" },
        };
      case "ping":
        return {};
      case "tools/list":
        return { tools };
      case "tools/call": {
        const call = parseToolCall(request.params);
        return textResult(await this.auditToolCall(call));
      }
      case "shutdown":
        return {};
      default:
        throw new Error(`unsupported_method: ${request.method}`);
    }
  }

  private callTool(call: ToolCallParams): Promise<unknown> | unknown {
    const args = call.arguments ?? {};
    switch (call.name) {
      case "aom.launch_for_handoff":
        return this.service.launchForHandoff(args);
      case "aom.attach_existing":
        return this.service.attachExisting(requireAttach(args));
      case "aom.snapshot":
        return this.service.snapshot(requireSession(args));
      case "aom.context_pack":
        return this.service.contextPack(requireSession(args));
      case "aom.capabilities":
        return this.service.capabilities(requireSession(args));
      case "aom.analysis_graph":
        return this.service.analysisGraph(requireSession(args));
      case "aom.invoke_capability":
        return this.service.invokeCapability(requireInvoke(args));
      case "aom.invoke_view":
        return this.service.invokeView(requireViewInvoke(args));
      case "aom.detach":
        return this.service.detach(requireSession(args));
      case "aom.session_status":
        return this.service.status();
      default:
        throw new Error(`unknown_tool: ${call.name}`);
    }
  }

  private async auditToolCall(call: ToolCallParams): Promise<unknown> {
    const start = Date.now();
    const args = call.arguments ?? {};
    try {
      const result = await this.callTool(call);
      this.audit.record({
        toolName: call.name,
        args,
        ok: true,
        durationMs: Date.now() - start,
        result,
      });
      return result;
    } catch (error) {
      this.audit.record({
        toolName: call.name,
        args,
        ok: false,
        durationMs: Date.now() - start,
        error,
      });
      throw error;
    }
  }

  private write(message: unknown): void {
    process.stdout.write(`${JSON.stringify(message)}\n`);
  }

  private writeError(id: JsonRpcRequest["id"], code: number, message: string): void {
    this.write({ jsonrpc: "2.0", id, error: { code, message } });
  }
}

function parseToolCall(params: unknown): ToolCallParams {
  if (!params || typeof params !== "object") throw new Error("tools_call_params_required");
  const call = params as ToolCallParams;
  if (!call.name) throw new Error("tool_name_required");
  return call;
}

function requireSession(args: Record<string, unknown>): { sessionId: string } {
  return { sessionId: String(args.sessionId ?? "platerun") };
}

function requireInvoke(args: Record<string, unknown>): {
  sessionId: string;
  capabilityId: string;
  inputs?: Record<string, unknown>;
} {
  if (!args.capabilityId) throw new Error("capabilityId_required");
  const inputs = args.inputs && typeof args.inputs === "object"
    ? args.inputs as Record<string, unknown>
    : undefined;
  return {
    sessionId: String(args.sessionId ?? "platerun"),
    capabilityId: String(args.capabilityId),
    ...(inputs ? { inputs } : {}),
  };
}

function requireViewInvoke(args: Record<string, unknown>): {
  sessionId: string;
  viewId?: string;
  label?: string;
  action?: string;
  value?: string;
} {
  const sessionId = String(args.sessionId ?? "platerun");
  return {
    sessionId,
    ...(typeof args.viewId === "string" ? { viewId: args.viewId } : {}),
    ...(typeof args.label === "string" ? { label: args.label } : {}),
    ...(typeof args.action === "string" ? { action: args.action } : {}),
    ...(typeof args.value === "string" ? { value: args.value } : {}),
  };
}

function requireAttach(args: Record<string, unknown>): {
  sessionId: string;
  cdpUrl: string;
  appPath?: string;
  artifactLocator?: string;
} {
  if (typeof args.cdpUrl !== "string") throw new Error("cdpUrl_required");
  return {
    sessionId: String(args.sessionId ?? "attached"),
    cdpUrl: args.cdpUrl,
    ...(typeof args.appPath === "string" ? { appPath: args.appPath } : {}),
    ...(typeof args.artifactLocator === "string" ? { artifactLocator: args.artifactLocator } : {}),
  };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
