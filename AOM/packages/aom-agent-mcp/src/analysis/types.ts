import type {
  AOMCapability,
  AOMEdge,
  AOMNode,
  EvidenceRef,
  RawEvent,
  RawRuntimeSnapshot,
  RawStaticSnapshot,
} from "@aom/protocol";
import type { CapabilityRecognitionTrace } from "../capability/types.js";

export interface AnalysisInput {
  targetId: string;
  staticSnapshot: RawStaticSnapshot;
  before: RawRuntimeSnapshot;
  events: RawEvent[];
  after?: RawRuntimeSnapshot;
  analyzerEvidence: EvidenceRef[];
}

export interface AnalysisOutput {
  graph: {
    graphId: string;
    targetId: string;
    currentScreenId: string;
    nodes: AOMNode[];
    edges: AOMEdge[];
    evidence: unknown[];
  };
  contextPack: Record<string, unknown>;
  capabilities: ExecutableCapability[];
  verification: Record<string, unknown>;
  recognition?: CapabilityRecognitionTrace;
  readiness?: AnalysisReadiness;
}

export interface ExecutableCapability {
  capability: AOMCapability;
  availability: "available" | "low_confidence" | "missing_target";
  actionPlan: CapabilityActionStep[];
  expectedEffects: unknown[];
  automation: {
    riskLevel: "low" | "medium" | "high";
    canAutoExecute: boolean;
    reason: string;
  };
  reasons: string[];
}

export interface CapabilityActionStep {
  stepId: string;
  kind: "set_text" | "click" | "observe" | "verify";
  summary: string;
  targetNodeId?: string;
  targetLabel?: string;
  inputSlot?: string;
  params: Record<string, unknown>;
}

export interface AnalysisReadiness {
  runtimeReady: boolean;
  analysisReady: boolean;
  semanticReady: boolean;
  capabilityReady: boolean;
  status: "ready" | "semantic_pending" | "semantic_failed" | "no_capability";
  reason: string;
}
