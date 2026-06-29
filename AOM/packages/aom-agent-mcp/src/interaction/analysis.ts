import type { RawEvent, RawRuntimeSnapshot } from "@aom/protocol";
import { runAnalysis } from "../analysis/bridge.js";
import type { AnalysisOutput, AnalysisReadiness } from "../analysis/types.js";
import { recognizeCapabilities } from "../capability/llm.js";
import type { AgentSession } from "./types.js";

export async function analyzeSession(
  session: AgentSession,
  after?: RawRuntimeSnapshot,
  events: RawEvent[] = [],
): Promise<AnalysisOutput> {
  const current = after ?? await session.runtime.probe.collectRuntimeSnapshot();
  const before = session.lastSnapshot ?? current;
  const analysis = await runAnalysis({
    targetId: session.targetId,
    staticSnapshot: session.staticSnapshot,
    before,
    events,
    after: current,
    analyzerEvidence: session.analyzerEvidence,
  });
  const recognition = await recognizeCapabilities(
    analysis,
    session.config?.capabilityRecognizer,
  );
  if (recognition) analysis.recognition = recognition;
  analysis.readiness = readinessFor(analysis);
  session.lastSnapshot = current;
  session.lastAnalysis = analysis;
  return analysis;
}

export function agentPayload(analysis: AnalysisOutput): Record<string, unknown> {
  return {
    source: "rust_analysis_service",
    graphSummary: graphSummary(analysis),
    contextPack: analysis.contextPack,
    capabilities: analysis.capabilities,
    verification: analysis.verification,
    recognition: analysis.recognition,
    readiness: analysis.readiness,
  };
}

export function compactAgentPayload(analysis: AnalysisOutput): Record<string, unknown> {
  const context = analysis.contextPack as {
    currentScreen?: { views?: unknown[]; stateFacts?: unknown[] };
    endpoints?: unknown[];
    dataFlows?: unknown[];
  };
  return {
    source: "rust_analysis_service",
    graphSummary: graphSummary(analysis),
    contextSummary: {
      currentViewCount: context.currentScreen?.views?.length ?? 0,
      stateFactCount: context.currentScreen?.stateFacts?.length ?? 0,
      endpointCount: context.endpoints?.length ?? 0,
      dataFlowCount: context.dataFlows?.length ?? 0,
    },
    capabilities: analysis.capabilities.map((item) => {
      const firstStep = item.actionPlan.find((step) => step.kind === "click" || step.kind === "set_text");
      return {
        id: item.capability.id,
        name: item.capability.name,
        availability: item.availability,
        riskLevel: item.capability.riskLevel,
        confidence: item.capability.confidence,
        inputSlots: item.capability.inputSlots,
        actions: item.actionPlan.map((step) => step.kind),
        targetNodeId: firstStep?.targetNodeId,
        targetLabel: firstStep?.targetLabel,
      };
    }),
    verification: analysis.verification,
    recognition: analysis.recognition,
    readiness: analysis.readiness,
    fullContextHint: "Use aom.route_context for compact windows or aom.context_pack for full debug context.",
  };
}

function readinessFor(analysis: AnalysisOutput): AnalysisReadiness {
  const availableCapabilities = analysis.capabilities.filter((item) =>
    item.availability === "available" || item.availability === "low_confidence"
  );
  const capabilityReady = availableCapabilities.length > 0;
  const recognition = analysis.recognition;
  if (capabilityReady) {
    return {
      runtimeReady: true,
      analysisReady: true,
      semanticReady: true,
      capabilityReady: true,
      status: "ready",
      reason: `${availableCapabilities.length} executable capabilities are available`,
    };
  }
  if (recognition?.error) {
    return {
      runtimeReady: true,
      analysisReady: true,
      semanticReady: true,
      capabilityReady: false,
      status: "semantic_failed",
      reason: recognition.error,
    };
  }
  if (recognition) {
    return {
      runtimeReady: true,
      analysisReady: true,
      semanticReady: true,
      capabilityReady: false,
      status: "no_capability",
      reason: recognition.rejected.length > 0
        ? "semantic recognition completed, but no candidate passed validation"
        : "semantic recognition completed without capability candidates",
    };
  }
  return {
    runtimeReady: true,
    analysisReady: true,
    semanticReady: true,
    capabilityReady: false,
    status: "no_capability",
    reason: "deterministic analysis found no executable capabilities",
  };
}

function counts(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((items, value) => {
    items[value] = (items[value] ?? 0) + 1;
    return items;
  }, {});
}

function graphSummary(analysis: AnalysisOutput): Record<string, unknown> {
  return {
    graphId: analysis.graph.graphId,
    currentScreenId: analysis.graph.currentScreenId,
    nodeCount: analysis.graph.nodes.length,
    edgeCount: analysis.graph.edges.length,
    evidenceCount: analysis.graph.evidence.length,
    nodeTypes: counts(analysis.graph.nodes.map((node) => node.type)),
    edgeTypes: counts(analysis.graph.edges.map((edge) => edge.type)),
  };
}
