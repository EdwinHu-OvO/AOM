import { attachElectronAnalyzer, launchElectronForHandoff } from "@aom/electron-probe";
import type { AOMRuntimeConfig } from "../config.js";
import { buildContextDelta, type ContextDeltaCause } from "../context/delta.js";
import { contextWindow, routeContext } from "../context/windows.js";
import { loadAomConfig } from "../config.js";
import { agentPayload, analyzeSession, compactAgentPayload } from "./analysis.js";
import { actionForCapability, actionForView } from "./actions.js";
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
    return this.sessionPayload(session, await analyzeSession(session));
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
    return this.sessionPayload(session, await analyzeSession(session));
  }

  async snapshot(input: SessionInput): Promise<unknown> {
    return this.requireSession(input.sessionId).runtime.probe.collectRuntimeSnapshot();
  }

  async contextPack(input: SessionInput): Promise<unknown> {
    return agentPayload(await analyzeSession(this.requireSession(input.sessionId)));
  }

  async routeContext(input: ContextRouteInput): Promise<unknown> {
    const session = this.requireSession(input.sessionId);
    const deltaTask = session.lastDelta?.outcome.nextStepHint;
    const routeInput = input.task || !deltaTask ? input : { ...input, task: deltaTask };
    const routed = routeContext(
      await analyzeSession(session),
      routeInput,
    );
    return {
      ...routed,
      ...(session.lastDelta ? { lastContextDelta: compactDelta(session.lastDelta) } : {}),
    };
  }

  async contextWindow(input: ContextWindowInput): Promise<unknown> {
    return contextWindow(await analyzeSession(this.requireSession(input.sessionId)), input);
  }

  async contextDelta(input: SessionInput): Promise<unknown> {
    const delta = this.requireSession(input.sessionId).lastDelta;
    if (!delta) throw new Error(`context_delta_not_available: ${input.sessionId}`);
    return delta;
  }

  async capabilities(input: SessionInput): Promise<unknown> {
    return (await analyzeSession(this.requireSession(input.sessionId))).capabilities;
  }

  async analysisGraph(input: SessionInput): Promise<unknown> {
    return (await analyzeSession(this.requireSession(input.sessionId))).graph;
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
    return {
      actionResult: result,
      eventCount: events.length,
      contextDelta,
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
    return { ...this.describe(session), analysis: compactAgentPayload(analysis) };
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
