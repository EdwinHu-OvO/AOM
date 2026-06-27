import type {
  AnalyzerCommand,
  AnalyzerReply,
  AnalyzerSessionConfig,
  EvidenceRef,
} from "@aom/protocol";
import { analyzerEvidence } from "../analyzer/evidence.js";
import { ElectronArtifactAdapter } from "../artifact/electron.js";
import { GenericArtifactAdapter } from "../artifact/generic.js";
import { GenericWebArtifactAdapter } from "../artifact/web.js";
import type { RuntimeProbe, StaticAnalysisAdapter } from "../types.js";
import {
  createRuntimeSession,
  prepareAnalyzerConfig,
  type PreparedAnalyzerConfig,
} from "./lifecycle.js";
import type { PlaywrightElectronSession } from "../analyzer/playwright.js";

export class AnalyzerSession {
  private config: AnalyzerSessionConfig | undefined;
  private prepared: PreparedAnalyzerConfig | undefined;
  private staticAdapter: StaticAnalysisAdapter | undefined;
  private runtimeSession: PlaywrightElectronSession | undefined;

  async handle(command: AnalyzerCommand): Promise<AnalyzerReply> {
    try {
      switch (command.commandType) {
        case "initialize":
          return await this.initialize(command.data);
        case "collect_static":
          return this.collectStatic();
        case "collect_runtime":
          return this.collectRuntime();
        case "drain_events":
          return this.drainEvents();
        case "execute_action":
          return this.executeAction(command.data);
        case "shutdown":
          await this.close();
          return { replyType: "ack", data: { value: true, evidence: [] } };
      }
    } catch (error) {
      return {
        replyType: "error",
        data: {
          code: "analyzer_operation_failed",
          message: error instanceof Error ? error.message : String(error),
          retryable: false,
          evidence: this.evidence("error"),
        },
      };
    }
  }

  async close(): Promise<void> {
    await this.runtimeSession?.close();
    this.runtimeSession = undefined;
    await this.prepared?.cleanup();
    this.prepared = undefined;
  }

  private async initialize(config: AnalyzerSessionConfig): Promise<AnalyzerReply> {
    await this.close();
    this.prepared = await prepareAnalyzerConfig(config);
    this.config = this.prepared.config;
    this.staticAdapter = createStaticAdapter(this.config);
    this.runtimeSession = await createRuntimeSession(this.config);
    return {
      replyType: "ready",
      data: {
        ...(this.staticAdapter ? { adapterId: this.staticAdapter.adapterId } : {}),
        ...(this.runtimeSession ? { probeId: this.runtimeSession.probe.probeId } : {}),
        evidence: this.evidence("initialize"),
      },
    };
  }

  private async collectStatic(): Promise<AnalyzerReply> {
    if (!this.staticAdapter) throw new Error("static_adapter_not_initialized");
    const value = await this.staticAdapter.collectStaticSnapshot();
    const evidence = this.evidence("collect_static");
    value.evidenceIds = unique([...value.evidenceIds, ...ids(evidence)]);
    return { replyType: "static_snapshot", data: { value, evidence } };
  }

  private async collectRuntime(): Promise<AnalyzerReply> {
    const probe = this.probe();
    const value = await probe.collectRuntimeSnapshot();
    const evidence = this.evidence("collect_runtime");
    value.evidenceIds = unique([...value.evidenceIds, ...ids(evidence)]);
    return { replyType: "runtime_snapshot", data: { value, evidence } };
  }

  private async drainEvents(): Promise<AnalyzerReply> {
    const value = await this.probe().drainEvents();
    const evidence = this.evidence("drain_events");
    for (const event of value) {
      event.evidenceIds = unique([...event.evidenceIds, ...ids(evidence)]);
    }
    return { replyType: "events", data: { value, evidence } };
  }

  private async executeAction(
    action: Extract<AnalyzerCommand, { commandType: "execute_action" }>["data"],
  ): Promise<AnalyzerReply> {
    const value = await this.probe().executeAction(action);
    const evidence = this.evidence("execute_action");
    value.evidenceIds = unique([...value.evidenceIds, ...ids(evidence)]);
    return { replyType: "action_result", data: { value, evidence } };
  }

  private probe(): RuntimeProbe {
    if (!this.runtimeSession) throw new Error("runtime_probe_not_initialized");
    return this.runtimeSession.probe;
  }

  private evidence(operation: string): EvidenceRef[] {
    const config = this.config;
    if (!config) return [];
    const tools = operation === "collect_static"
      ? this.staticAdapter?.tools ?? []
      : ["collect_runtime", "drain_events", "execute_action"].includes(operation)
        ? this.runtimeSession ? [this.runtimeSession.tool] : []
        : [
            ...(this.staticAdapter?.tools ?? []),
            ...(this.runtimeSession ? [this.runtimeSession.tool] : []),
          ];
    const locator = config.target.connection?.cdpUrl
      ?? config.executablePath
      ?? config.artifactLocator
      ?? config.target.targetId;
    return analyzerEvidence(config.target.targetId, operation, locator, tools);
  }
}

function createStaticAdapter(
  config: AnalyzerSessionConfig,
): StaticAnalysisAdapter | undefined {
  if (!config.artifactLocator) return undefined;
  if (config.adapterId === "adapter:web-artifact") {
    return new GenericWebArtifactAdapter(config.target.targetId, config.artifactLocator);
  }
  if (config.adapterId === "adapter:generic-artifact") {
    return new GenericArtifactAdapter(config.target.targetId, config.artifactLocator);
  }
  return new ElectronArtifactAdapter(config.target.targetId, config.artifactLocator);
}

function ids(evidence: EvidenceRef[]): string[] {
  return evidence.map((item) => item.evidenceId);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
