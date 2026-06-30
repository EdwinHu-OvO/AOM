import type { ContextDelta } from "../context/delta.js";

export type CallChainToolName =
  | "aom.route_context"
  | "aom.context_window"
  | "aom.context_delta"
  | "aom.invoke_capability"
  | "aom.invoke_view";

export interface CallChainInput {
  sessionId: string;
  task?: string;
  maxSteps?: number;
}

export interface CallChainStep {
  stepId: string;
  order: number;
  toolName: CallChainToolName;
  arguments: Record<string, unknown>;
  reason: string;
  expectedOutcome?: string;
  stopIf?: string;
  runAfter?: string[];
}

export interface CallChainPlan {
  chainId: string;
  generatedAt: string;
  graphId: string;
  currentScreenId: string;
  status: "ready" | "blocked" | "done" | "needs_observation";
  basis: {
    strategy: "dynamic_call_chain";
    task?: string;
    lastOutcome?: {
      status: ContextDelta["outcome"]["status"];
      summary: string;
      nextStepHint?: string;
    };
  };
  summary: string;
  steps: CallChainStep[];
  invalidatesWhen: string[];
  allInterfacesRemainAvailable: true;
  debugHints: string[];
}
