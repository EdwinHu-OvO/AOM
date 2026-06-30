import type { AnalysisOutput } from "../analysis/types.js";
import type { ContextDelta } from "../context/delta.js";
import { clampStepLimit, normalized, stableHash } from "./intent.js";
import {
  capabilityFirstStep,
  dedupeSteps,
  observationSteps,
  recoverySteps,
  verifiedFollowUpSteps,
} from "./steps.js";
import type { CallChainPlan, CallChainStep } from "./types.js";
export type { CallChainInput, CallChainPlan, CallChainStep, CallChainToolName } from "./types.js";

export function buildCallChain(input: {
  sessionId: string;
  analysis: AnalysisOutput;
  lastDelta?: ContextDelta;
  task?: string;
  maxSteps?: number;
}): CallChainPlan {
  const maxSteps = clampStepLimit(input.maxSteps);
  const task = normalized(input.task);
  const steps = plannedSteps(input.sessionId, input.analysis, input.lastDelta, task);
  const deduped = dedupeSteps(steps).slice(0, maxSteps);
  const status = statusFor(deduped, input.lastDelta, task);
  const lastOutcome = input.lastDelta?.outcome;
  return {
    chainId: `callchain:${input.analysis.graph.graphId}:${stableHash([
      input.sessionId,
      task ?? "",
      lastOutcome?.status ?? "",
      lastOutcome?.nextStepHint ?? "",
      deduped.map((step) => `${step.toolName}:${JSON.stringify(step.arguments)}`).join("|"),
    ].join("\n"))}`,
    generatedAt: new Date().toISOString(),
    graphId: input.analysis.graph.graphId,
    currentScreenId: input.analysis.graph.currentScreenId,
    status,
    basis: {
      strategy: "dynamic_call_chain",
      ...(task ? { task } : {}),
      ...(lastOutcome
        ? {
            lastOutcome: {
              status: lastOutcome.status,
              summary: lastOutcome.summary,
              ...(lastOutcome.nextStepHint ? { nextStepHint: lastOutcome.nextStepHint } : {}),
            },
          }
        : {}),
    },
    summary: summaryFor(status, deduped, input.lastDelta),
    steps: deduped,
    invalidatesWhen: [
      "After any invoke_* action, because the runtime graph and contextDelta may change.",
      "After route_context/context_window reveals a better target than the planned one.",
      "When graphId/currentScreenId differs from this plan.",
    ],
    allInterfacesRemainAvailable: true,
    debugHints: [
      "This is a suggested call chain only; it does not execute tools or hide lower-level AOM interfaces.",
      "Regenerate aom.call_chain after every meaningful tool result before continuing autonomous work.",
      "If a planned invoke step returns failed/no_change, stop the chain and route context instead of retrying the same target.",
    ],
  };
}

function plannedSteps(
  sessionId: string,
  analysis: AnalysisOutput,
  lastDelta: ContextDelta | undefined,
  task: string | undefined,
): CallChainStep[] {
  const lastStatus = lastDelta?.outcome.status;
  if (lastStatus === "verified") return verifiedFollowUpSteps(sessionId, analysis, lastDelta, task);
  if (lastStatus === "failed" || lastStatus === "no_change") return recoverySteps(sessionId, lastDelta, task);
  const steps: CallChainStep[] = [];
  const capabilityStep = task ? capabilityFirstStep(sessionId, analysis, task) : undefined;
  if (capabilityStep) steps.push(capabilityStep);
  steps.push(...observationSteps(sessionId, task));
  return steps;
}

function statusFor(
  steps: CallChainStep[],
  delta: ContextDelta | undefined,
  task: string | undefined,
): CallChainPlan["status"] {
  if (steps.length === 0) return "blocked";
  if (!task && !delta) return "needs_observation";
  return "ready";
}

function summaryFor(
  status: CallChainPlan["status"],
  steps: CallChainStep[],
  delta: ContextDelta | undefined,
): string {
  if (status === "blocked") return "AOM cannot propose a safe next call from the current graph; inspect route_context manually.";
  if (delta?.outcome.status === "verified" && steps[0]?.toolName.startsWith("aom.invoke")) {
    return "Previous effect is verified; follow the concrete recommended target, then re-read the delta.";
  }
  if (delta?.outcome.status === "failed" || delta?.outcome.status === "no_change") {
    return "Previous action did not produce a trustworthy effect; refresh routed context before trying another target.";
  }
  if (steps[0]?.toolName === "aom.invoke_capability") {
    return "A matching current capability is available; invoke it, then use contextDelta to decide the next chain.";
  }
  return "Observe routed context first, then expand the smallest relevant window before acting.";
}
