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
  observedAt?: number;
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
    return [...this.queuedEvents.splice(0), ...domEvents]
      .sort((left, right) => {
        const timeOrder = (left.observedAt ?? 0) - (right.observedAt ?? 0);
        return timeOrder || eventPriority(left.type) - eventPriority(right.type);
      })
      .map((event) => this.toRawEvent(event));
  }

  async executeAction(action: RawAction): Promise<RawActionResult> {
    await this.initialize();
    if (action.targetId !== this.targetId) {
      return this.result(action, false, "target_mismatch");
    }
    try {
      if (action.type === "click") {
        await this.click(action);
      } else {
        await this.evaluate(this.actionExpression(action), true);
        await this.afterAction(action);
      }
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
      this.queuedEvents.push({
        type: "navigation",
        observedAt: Date.now(),
        url: JSON.stringify(params),
      });
    });
    this.client.on("Network.requestWillBeSent", (params) => {
      this.queuedEvents.push({
        type: "network_request",
        observedAt: Date.now(),
        metadata: summarizeNetworkRequest(params),
      });
    });
    this.client.on("Network.responseReceived", (params) => {
      this.queuedEvents.push({
        type: "network_response",
        observedAt: Date.now(),
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
      if (!["type", "observedAt", "rawId", "label"].includes(key) && value !== undefined) {
        payload[key] = value;
      }
    }
    return {
      eventId: `event:${this.targetId}:${sequence}`,
      targetId: this.targetId,
      platform: "electron",
      timestamp: event.observedAt ?? Date.now(),
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
        return `(() => { const element = document.querySelector(${encodedSelector}); if (!element) throw new Error("target_not_found"); element.focus?.(); const rect = element.getBoundingClientRect(); return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height }; })()`;
      case "set_text":
        return `(() => { const element = document.querySelector(${encodedSelector}); if (!element || !("value" in element)) throw new Error("target_not_editable"); element.focus?.(); const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), "value"); descriptor?.set ? descriptor.set.call(element, ${encodedValue}) : element.value = ${encodedValue}; element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: ${encodedValue} })); element.dispatchEvent(new Event("change", { bubbles: true })); return true; })()`;
      case "scroll":
        return `(() => { scrollBy(0, ${Number(action.params.deltaY ?? 500)}); return true; })()`;
      case "back":
        return `(() => { history.back(); return true; })()`;
      case "wait_for":
        return `new Promise((resolve, reject) => { const until = Date.now() + ${Number(action.params.timeoutMs ?? 5000)}; const poll = () => document.querySelector(${encodedSelector}) ? resolve(true) : Date.now() >= until ? reject(new Error("wait_timeout")) : setTimeout(poll, 50); poll(); })`;
    }
  }

  private async click(action: RawAction): Promise<void> {
    const rect = await this.evaluate<ElementRect>(this.actionExpression(action), true);
    if (rect && Number.isFinite(rect.x) && Number.isFinite(rect.y) && rect.width > 0 && rect.height > 0) {
      await this.client.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: rect.x,
        y: rect.y,
        button: "left",
        clickCount: 1,
      });
      await this.client.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: rect.x,
        y: rect.y,
        button: "left",
        clickCount: 1,
      });
      return;
    }
    await this.evaluate(this.domClickFallbackExpression(action), true);
  }

  private domClickFallbackExpression(action: RawAction): string {
    const selector = action.targetRawId?.replace(/^dom:/, "") ?? String(action.params.selector ?? "");
    const encodedSelector = JSON.stringify(selector);
    return `(() => { const element = document.querySelector(${encodedSelector}); if (!element) throw new Error("target_not_found"); element.focus?.(); element.click(); return true; })()`;
  }

  private async afterAction(action: RawAction): Promise<void> {
    if (action.type !== "set_text" || typeof action.params.submitKey !== "string") return;
    await this.dispatchKey(action.params.submitKey);
  }

  private async dispatchKey(key: string): Promise<void> {
    const event = keyEvent(key);
    await this.client.send("Input.dispatchKeyEvent", { type: "rawKeyDown", ...event });
    await this.client.send("Input.dispatchKeyEvent", { type: "keyUp", ...event });
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

interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function keyEvent(key: string): Record<string, JsonValue> {
  if (key === "Enter") {
    return { key: "Enter", code: "Enter", windowsVirtualKeyCode: 13, nativeVirtualKeyCode: 13 };
  }
  return { key, code: key };
}

function eventPriority(type: RawEventType): number {
  if (type === "surface_text_input" || type === "surface_click") return 0;
  if (type === "network_request") return 1;
  if (type === "network_response") return 2;
  return 3;
}
