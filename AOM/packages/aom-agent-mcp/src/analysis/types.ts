import type {
  AOMCapability,
  AOMEdge,
  AOMNode,
  EvidenceRef,
  RawEvent,
  RawRuntimeSnapshot,
  RawStaticSnapshot,
} from "@aom/protocol";

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
