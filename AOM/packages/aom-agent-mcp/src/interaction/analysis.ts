import type { RawEvent, RawRuntimeSnapshot } from "@aom/protocol";
import { runAnalysis } from "../analysis/bridge.js";
import type { AnalysisOutput } from "../analysis/types.js";
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
  session.lastSnapshot = current;
  session.lastAnalysis = analysis;
  return analysis;
}

export function agentPayload(analysis: AnalysisOutput): Record<string, unknown> {
  return {
    source: "rust_analysis_service",
    graphSummary: {
      graphId: analysis.graph.graphId,
      currentScreenId: analysis.graph.currentScreenId,
      nodeCount: analysis.graph.nodes.length,
      edgeCount: analysis.graph.edges.length,
      evidenceCount: analysis.graph.evidence.length,
      nodeTypes: counts(analysis.graph.nodes.map((node) => node.type)),
      edgeTypes: counts(analysis.graph.edges.map((edge) => edge.type)),
    },
    contextPack: analysis.contextPack,
    capabilities: analysis.capabilities,
    verification: analysis.verification,
  };
}

function counts(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((items, value) => {
    items[value] = (items[value] ?? 0) + 1;
    return items;
  }, {});
}
