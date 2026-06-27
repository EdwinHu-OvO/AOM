import { attachElectronAnalyzer, launchElectronForHandoff } from "@aom/electron-probe";
import { agentPayload, analyzeSession } from "./analysis.js";
import { actionForCapability, actionForView } from "./actions.js";
import { resolveLaunchTarget } from "./paths.js";
import { collectStatic } from "./static.js";
import type { AgentSession } from "./types.js";

export class AgentInteractionService {
  private readonly sessions = new Map<string, AgentSession>();

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
    return this.executeAndAnalyze(session, action);
  }

  async invokeView(input: InvokeViewInput): Promise<unknown> {
    const session = this.requireSession(input.sessionId);
    const before = await analyzeSession(session);
    const action = actionForView(before, session.targetId, input);
    return this.executeAndAnalyze(session, action);
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

  private async executeAndAnalyze(session: AgentSession, action: Parameters<AgentSession["runtime"]["probe"]["executeAction"]>[0]) {
    const result = await session.runtime.probe.executeAction(action);
    await wait(500);
    const events = await session.runtime.probe.drainEvents();
    const after = await session.runtime.probe.collectRuntimeSnapshot();
    return { actionResult: result, eventCount: events.length, analysis: agentPayload(await analyzeSession(session, after, events)) };
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
    return { ...this.describe(session), analysis: agentPayload(analysis) };
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

interface InvokeInput extends SessionInput {
  capabilityId: string;
  inputs?: Record<string, unknown>;
}

interface InvokeViewInput extends SessionInput {
  viewId?: string;
  label?: string;
  action?: string;
  value?: string;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
