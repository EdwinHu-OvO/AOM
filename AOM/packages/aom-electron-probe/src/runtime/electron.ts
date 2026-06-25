import type {
  JsonValue,
  RawAction,
  RawActionResult,
  RawEvent,
  RawEventType,
  RawRuntimeNode,
  RawRuntimeSnapshot,
} from "@aom/protocol";
import type { CdpClient, RuntimeProbe } from "../types.js";
import type { AnalyzerToolDescriptor } from "../analyzer/tool.js";
import {
  drainDomEventsExpression,
  installObserverExpression,
  runtimeSnapshotExpression,
} from "./dom-script.js";
import {
  summarizeNetworkRequest,
  summarizeNetworkResponse,
} from "./network.js";

interface EvaluationResult<T> {
  result: { value?: T };
  exceptionDetails?: {
    text?: string;
    exception?: { description?: string; value?: unknown };
  };
}

interface ProbeEvent {
  type: RawEventType;
  rawId?: string;
  label?: string;
  [key: string]: JsonValue | undefined;
}

export class ElectronRuntimeProbe implements RuntimeProbe {
  readonly probeId = "probe:electron-cdp";
  readonly tool: AnalyzerToolDescriptor | undefined;
  private sequence = 0;
  private initialized = false;
  private readonly queuedEvents: ProbeEvent[] = [];

  constructor(
    readonly targetId: string,
    private readonly client: CdpClient,
    tool?: AnalyzerToolDescriptor,
  ) {
    this.tool = tool;
  }

  async collectRuntimeSnapshot(): Promise<RawRuntimeSnapshot> {
    await this.initialize();
    const nodes = await this.evaluate<RawRuntimeNode[]>(runtimeSnapshotExpression);
    const evidenceId = `evidence:runtime:snapshot:${Date.now()}`;
    return {
      snapshotId: `snapshot:runtime:${Date.now()}`,
      targetId: this.targetId,
      platform: "electron",
      timestamp: Date.now(),
      nodes,
      evidenceIds: [evidenceId],
    };
  }

  async drainEvents(): Promise<RawEvent[]> {
    await this.initialize();
    const domEvents = await this.evaluate<ProbeEvent[]>(drainDomEventsExpression);
    return [...this.queuedEvents.splice(0), ...domEvents].map((event) => this.toRawEvent(event));
  }

  async executeAction(action: RawAction): Promise<RawActionResult> {
    await this.initialize();
    if (action.targetId !== this.targetId) {
      return this.result(action, false, "target_mismatch");
    }
    try {
      await this.evaluate(this.actionExpression(action), true);
      return this.result(action, true);
    } catch (error) {
      return this.result(action, false, error instanceof Error ? error.message : "action_failed");
    }
  }

  private async initialize(): Promise<void> {
    if (this.initialized) return;
    await Promise.all([
      this.client.send("Runtime.enable"),
      this.client.send("Page.enable"),
      this.client.send("Network.enable"),
    ]);
    await this.client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: installObserverExpression,
    });
    await this.evaluate(installObserverExpression);
    this.client.on("Page.frameNavigated", (params) => {
      this.queuedEvents.push({ type: "navigation", url: JSON.stringify(params) });
    });
    this.client.on("Network.requestWillBeSent", (params) => {
      this.queuedEvents.push({
        type: "network_request",
        metadata: summarizeNetworkRequest(params),
      });
    });
    this.client.on("Network.responseReceived", (params) => {
      this.queuedEvents.push({
        type: "network_response",
        metadata: summarizeNetworkResponse(params),
      });
    });
    this.initialized = true;
  }

  private async evaluate<T>(expression: string, awaitPromise = false): Promise<T> {
    const response = await this.client.send<EvaluationResult<T>>("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise,
    });
    if (response.exceptionDetails) {
      const detail = response.exceptionDetails.exception?.description
        ?? response.exceptionDetails.text
        ?? String(response.exceptionDetails.exception?.value ?? "runtime_evaluation_failed");
      throw new Error(detail);
    }
    return response.result.value as T;
  }

  private toRawEvent(event: ProbeEvent): RawEvent {
    const sequence = ++this.sequence;
    const evidenceId = `evidence:event:${this.targetId}:${sequence}`;
    const payload: Record<string, JsonValue> = {};
    for (const [key, value] of Object.entries(event)) {
      if (!["type", "rawId", "label"].includes(key) && value !== undefined) {
        payload[key] = value;
      }
    }
    return {
      eventId: `event:${this.targetId}:${sequence}`,
      targetId: this.targetId,
      platform: "electron",
      timestamp: Date.now(),
      sequence,
      type: event.type,
      source: { adapterId: "adapter:electron", probeId: this.probeId, sourceType: "dynamic" },
      ...(event.rawId
        ? {
            subject: {
              rawId: event.rawId,
              kind: "dom_element",
              ...(event.label ? { label: event.label } : {}),
            },
          }
        : {}),
      payload,
      evidenceIds: [evidenceId],
    };
  }

  private actionExpression(action: RawAction): string {
    const selector = action.targetRawId?.replace(/^dom:/, "") ?? String(action.params.selector ?? "");
    const encodedSelector = JSON.stringify(selector);
    const encodedValue = JSON.stringify(String(action.params.value ?? ""));
    switch (action.type) {
      case "click":
        return `(() => { const element = document.querySelector(${encodedSelector}); if (!element) throw new Error("target_not_found"); element.click(); return true; })()`;
      case "set_text":
        return `(() => { const element = document.querySelector(${encodedSelector}); if (!element || !("value" in element)) throw new Error("target_not_editable"); element.value = ${encodedValue}; element.dispatchEvent(new Event("input", { bubbles: true })); return true; })()`;
      case "scroll":
        return `(() => { scrollBy(0, ${Number(action.params.deltaY ?? 500)}); return true; })()`;
      case "back":
        return `(() => { history.back(); return true; })()`;
      case "wait_for":
        return `new Promise((resolve, reject) => { const until = Date.now() + ${Number(action.params.timeoutMs ?? 5000)}; const poll = () => document.querySelector(${encodedSelector}) ? resolve(true) : Date.now() >= until ? reject(new Error("wait_timeout")) : setTimeout(poll, 50); poll(); })`;
    }
  }

  private result(action: RawAction, ok: boolean, message?: string): RawActionResult {
    if (ok) {
      return {
        actionId: action.actionId,
        targetId: action.targetId,
        ok: true,
        evidenceIds: [`evidence:action:${action.actionId}`],
      };
    }
    return {
      actionId: action.actionId,
      targetId: action.targetId,
      ok: false,
      errorCode: message ?? "action_failed",
      ...(message === undefined ? {} : { message }),
      evidenceIds: [`evidence:action:${action.actionId}`],
    };
  }
}
