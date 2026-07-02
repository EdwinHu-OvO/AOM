import { attachElectronAnalyzer, launchElectronForHandoff } from "@aom/electron-probe";
import type { AOMRuntimeConfig } from "../config.js";
import { buildContextDelta, type ContextDeltaCause } from "../context/delta.js";
import { contextWindows, type ContextWindowsInput } from "../context/multi-windows.js";
import { contextWindow, routeContext } from "../context/windows.js";
import { loadAomConfig } from "../config.js";
import { agentPayload, analyzeSession, compactAgentPayload } from "./analysis.js";
import { actionForCapability, actionForView } from "./actions.js";
import { buildCallChain, type CallChainInput } from "../orchestration/call-chain.js";
import { resolveLaunchTarget } from "./paths.js";
import { collectStatic } from "./static.js";
import type { AgentSession } from "./types.js";

export class AgentInteractionService {
  private readonly sessions = new Map<string, AgentSession>();

  constructor(private readonly config: AOMRuntimeConfig = loadAomConfig()) {}

  async launchForHandoff(input: LaunchInput = {}): Promise<unknown> {
    const sessionId = input.sessionId ?? "platerun";
    const targetId = input.targetId ?? `target:${sessionId}`;
    const target = resolveLaunchTarget(input);
    const runtime = await launchElectronForHandoff({
      targetId,
      executablePath: target.executablePath,
      timeoutMs: input.timeoutMs ?? 20_000,
    });
    const statics = await collectStatic(targetId, target.artifactLocator);
    const session = this.setSession({
      sessionId,
      targetId,
      lifecycle: "launch_for_handoff",
      runtime,
      staticSnapshot: statics.staticSnapshot,
      analyzerEvidence: statics.evidence,
      config: this.config,
      ...(runtime.cdpUrl ? { cdpUrl: runtime.cdpUrl } : {}),
      ...(runtime.processId ? { processId: runtime.processId } : {}),
      ...(target.artifactLocator ? { artifactLocator: target.artifactLocator } : {}),
    });
    const analysis = await analyzeSession(session);
    return this.sessionPayload(session, analysis);
  }

  async attachExisting(input: AttachInput): Promise<unknown> {
    const sessionId = input.sessionId ?? "attached";
    const targetId = input.targetId ?? `target:${sessionId}`;
    const runtime = await attachElectronAnalyzer({ targetId, cdpUrl: input.cdpUrl });
    const statics = await collectStatic(targetId, input.artifactLocator ?? input.appPath);
    const session = this.setSession({
      sessionId,
      targetId,
      lifecycle: "attach_existing",
      runtime,
      staticSnapshot: statics.staticSnapshot,
      analyzerEvidence: statics.evidence,
      config: this.config,
      ...(runtime.cdpUrl ? { cdpUrl: runtime.cdpUrl } : {}),
      ...(runtime.processId ? { processId: runtime.processId } : {}),
      ...(input.artifactLocator || input.appPath
        ? { artifactLocator: input.artifactLocator ?? input.appPath }
        : {}),
    });
    const analysis = await analyzeSession(session);
    return this.sessionPayload(session, analysis);
  }

  async snapshot(input: SessionInput): Promise<unknown> {
    return this.requireSession(input.sessionId).runtime.probe.collectRuntimeSnapshot();
  }

  async contextPack(input: SessionInput): Promise<unknown> {
    const session = this.requireSession(input.sessionId);
    const analysis = await analyzeSession(session);
    return {
      ...agentPayload(analysis),
      nextCallChain: this.refreshCallChain(session, analysis),
    };
  }

  async routeContext(input: ContextRouteInput): Promise<unknown> {
    const session = this.requireSession(input.sessionId);
    const deltaTask = session.lastDelta?.outcome.nextStepHint;
    const routeInput = input.task || !deltaTask ? input : { ...input, task: deltaTask };
    if (routeInput.task) session.lastTask = routeInput.task;
    const analysis = await analyzeSession(session);
    const routed = routeContext(
      analysis,
      routeInput,
    );
    const nextCallChain = this.refreshCallChain(session, analysis, routeInput.task);
    return {
      ...routed,
      ...(session.lastDelta ? { lastContextDelta: compactDelta(session.lastDelta) } : {}),
      nextCallChain,
    };
  }

  async contextWindow(input: ContextWindowInput): Promise<unknown> {
    const session = this.requireSession(input.sessionId);
    if (input.task) session.lastTask = input.task;
    const analysis = await analyzeSession(session);
    return {
      ...contextWindow(analysis, input),
      nextCallChain: this.refreshCallChain(session, analysis, input.task),
    };
  }

  async contextWindows(input: ContextWindowsServiceInput): Promise<unknown> {
    const session = this.requireSession(input.sessionId);
    if (input.task) session.lastTask = input.task;
    const analysis = await analyzeSession(session);
    session.contextCursors ??= new Map();
    return {
      ...contextWindows(analysis, input, session.contextCursors),
      nextCallChain: this.refreshCallChain(session, analysis, input.task),
    };
  }

  async contextDelta(input: SessionInput): Promise<unknown> {
    const session = this.requireSession(input.sessionId);
    const delta = session.lastDelta;
    if (!delta) throw new Error(`context_delta_not_available: ${input.sessionId}`);
    return {
      ...delta,
      ...(session.lastAnalysis ? { nextCallChain: this.refreshCallChain(session, session.lastAnalysis) } : {}),
    };
  }

  async callChain(input: CallChainInput): Promise<unknown> {
    const session = this.requireSession(input.sessionId);
    if (input.task) session.lastTask = input.task;
    const analysis = await analyzeSession(session);
    return this.refreshCallChain(session, analysis, input.task, input.maxSteps);
  }

  async capabilities(input: SessionInput): Promise<unknown> {
    const session = this.requireSession(input.sessionId);
    const analysis = await analyzeSession(session);
    this.refreshCallChain(session, analysis);
    return analysis.capabilities;
  }

  async analysisGraph(input: SessionInput): Promise<unknown> {
    const session = this.requireSession(input.sessionId);
    const analysis = await analyzeSession(session);
    this.refreshCallChain(session, analysis);
    return analysis.graph;
  }

  async invokeCapability(input: InvokeInput): Promise<unknown> {
    const session = this.requireSession(input.sessionId);
    const before = await analyzeSession(session);
    const action = actionForCapability(before, session.targetId, input.capabilityId, input.inputs);
    const capability = before.capabilities.find((item) =>
      item.capability.name === input.capabilityId || item.capability.id === input.capabilityId
    );
    const firstStep = capability?.actionPlan.find((step) => step.kind === "click" || step.kind === "set_text");
    return this.executeAndAnalyze(session, action, before, {
      toolName: "aom.invoke_capability",
      capabilityName: capability?.capability.name ?? input.capabilityId,
      actionType: action.type,
      ...(firstStep?.targetNodeId ? { targetNodeId: firstStep.targetNodeId } : {}),
      ...(firstStep?.targetLabel ? { targetLabel: firstStep.targetLabel } : {}),
      ...(input.inputs ? { inputSummary: summarizeInputs(input.inputs) } : {}),
    });
  }

  async invokeView(input: InvokeViewInput): Promise<unknown> {
    const session = this.requireSession(input.sessionId);
    const before = await analyzeSession(session);
    const action = actionForView(before, session.targetId, input);
    return this.executeAndAnalyze(session, action, before, {
      toolName: "aom.invoke_view",
      actionType: action.type,
      ...(input.viewId ? { targetNodeId: input.viewId } : {}),
      ...(input.label ? { targetLabel: input.label } : {}),
      ...(input.value !== undefined ? { inputSummary: summarizeInputs({ value: input.value }) } : {}),
    });
  }

  async detach(input: SessionInput): Promise<unknown> {
    const session = this.requireSession(input.sessionId);
    await session.runtime.close();
    this.sessions.delete(input.sessionId);
    return {
      sessionId: input.sessionId,
      detached: true,
      lifecycle: session.lifecycle,
      cdpUrl: session.cdpUrl,
      targetRetained: true,
    };
  }

  status(): unknown {
    return { sessions: [...this.sessions.values()].map((session) => this.describe(session)) };
  }

  private async executeAndAnalyze(
    session: AgentSession,
    action: Parameters<AgentSession["runtime"]["probe"]["executeAction"]>[0],
    before: Awaited<ReturnType<typeof analyzeSession>>,
    cause: ContextDeltaCause,
  ) {
    const result = await session.runtime.probe.executeAction(action);
    await wait(500);
    const events = await session.runtime.probe.drainEvents();
    const after = await session.runtime.probe.collectRuntimeSnapshot();
    const analysis = await analyzeSession(session, after, events);
    const contextDelta = buildContextDelta({
      before,
      after: analysis,
      cause,
      actionResult: result,
      eventCount: events.length,
    });
    session.lastDelta = contextDelta;
    const nextCallChain = this.refreshCallChain(session, analysis);
    return {
      actionResult: result,
      eventCount: events.length,
      contextDelta,
      nextCallChain,
      analysis: compactAgentPayload(analysis),
    };
  }

  private setSession(session: AgentSession): AgentSession {
    const existing = this.sessions.get(session.sessionId);
    void existing?.runtime.close();
    this.sessions.set(session.sessionId, session);
    return session;
  }

  private requireSession(sessionId: string): AgentSession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`unknown_session: ${sessionId}`);
    return session;
  }

  private sessionPayload(session: AgentSession, analysis: Awaited<ReturnType<typeof analyzeSession>>) {
    return {
      ...this.describe(session),
      analysis: compactAgentPayload(analysis),
      nextCallChain: this.refreshCallChain(session, analysis),
    };
  }

  private refreshCallChain(
    session: AgentSession,
    analysis: Awaited<ReturnType<typeof analyzeSession>>,
    task?: string,
    maxSteps?: number,
  ) {
    if (task?.trim()) session.lastTask = task.trim();
    const chain = buildCallChain({
      sessionId: session.sessionId,
      analysis,
      ...(session.lastDelta ? { lastDelta: session.lastDelta } : {}),
      ...(session.lastTask ? { task: session.lastTask } : {}),
      ...(maxSteps ? { maxSteps } : {}),
    });
    session.lastCallChain = chain;
    return chain;
  }

  private describe(session: AgentSession): Record<string, unknown> {
    return {
      sessionId: session.sessionId,
      targetId: session.targetId,
      lifecycle: session.lifecycle,
      cdpUrl: session.cdpUrl,
      processId: session.processId,
      artifactLocator: session.artifactLocator,
      lastNodeCount: session.lastSnapshot?.nodes.length,
      readiness: session.lastAnalysis?.readiness,
      lastCallChain: session.lastCallChain
        ? {
            chainId: session.lastCallChain.chainId,
            status: session.lastCallChain.status,
            stepCount: session.lastCallChain.steps.length,
          }
        : undefined,
    };
  }
}

interface LaunchInput extends Partial<SessionInput> {
  targetId?: string;
  executablePath?: string;
  appPath?: string;
  timeoutMs?: number;
}

interface AttachInput extends Partial<SessionInput> {
  cdpUrl: string;
  targetId?: string;
  appPath?: string;
  artifactLocator?: string;
}

interface SessionInput { sessionId: string }

interface ContextRouteInput extends SessionInput {
  task?: string;
  limit?: number;
}

interface ContextWindowInput extends ContextRouteInput {
  windowId?: string;
  offset?: number;
}

interface ContextWindowsServiceInput extends SessionInput, ContextWindowsInput {}

interface InvokeInput extends SessionInput {
  capabilityId: string;
  inputs?: Record<string, unknown>;
}

interface InvokeViewInput extends SessionInput {
  viewId?: string;
  label?: string;
  rawId?: string;
  action?: string;
  value?: string;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function summarizeInputs(inputs: Record<string, unknown>): Record<string, unknown> {
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(inputs)) {
    summary[key] = typeof value === "string" && value.length > 80
      ? `${value.slice(0, 77)}...`
      : value;
  }
  return summary;
}

function compactDelta(delta: import("../context/delta.js").ContextDelta): Record<string, unknown> {
  return {
    previousGraphId: delta.previousGraphId,
    currentGraphId: delta.currentGraphId,
    cause: delta.cause,
    outcome: delta.outcome,
    recommendedNext: delta.capabilities.recommendedNext,
    recommendedTargets: delta.capabilities.recommendedTargets,
  };
}
