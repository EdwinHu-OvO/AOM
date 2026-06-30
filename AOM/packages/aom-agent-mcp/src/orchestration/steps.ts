import type { AnalysisOutput, ExecutableCapability } from "../analysis/types.js";
import type { ContextDelta, RecommendedTarget } from "../context/delta.js";
import { inferCapabilityInputs, isExecutable, scoreCapability } from "./intent.js";
import type { CallChainStep, CallChainToolName } from "./types.js";

export function verifiedFollowUpSteps(
  sessionId: string,
  analysis: AnalysisOutput,
  delta: ContextDelta | undefined,
  task: string | undefined,
): CallChainStep[] {
  const target = delta?.capabilities.recommendedTargets[0];
  if (target) {
    return [
      targetStep(sessionId, target, {
        reason: "The latest contextDelta verified the previous effect and exposed a concrete follow-up target.",
        expectedOutcome: "AOM dispatches the next action without repeating the already verified action.",
        stopIf: "The action result is failed/no_change or the target is no longer present in the current graph.",
      }),
      contextDeltaStep(sessionId, "Read the semantic diff for this follow-up action before deciding whether the user task is complete."),
      routeStep(sessionId, task ?? delta?.outcome.nextStepHint, "Refresh compact windows after following the verified delta recommendation."),
    ];
  }
  const openCapability = analysis.capabilities.find((item) =>
    isExecutable(item) && /open|view|detail|result|content|video/i.test(item.capability.name)
  );
  if (!openCapability) {
    return [
      routeStep(sessionId, task ?? delta?.outcome.nextStepHint, "The last action was verified; route current context toward the recommended next step."),
      contextWindowStep(sessionId, "ui:main", task, 0, "Expand main content to choose a concrete follow-up target."),
    ];
  }
  return [
    invokeCapabilityStep(sessionId, openCapability, undefined, {
      reason: "The last action was verified and a current open/view capability is available.",
      expectedOutcome: "AOM opens or inspects a result/content target.",
      stopIf: "The capability reports missing_target, failed, or no_change.",
    }),
    contextDeltaStep(sessionId, "Verify whether opening the target changed the screen or data-flow graph."),
  ];
}

export function recoverySteps(
  sessionId: string,
  delta: ContextDelta | undefined,
  task: string | undefined,
): CallChainStep[] {
  return [
    routeStep(
      sessionId,
      task ?? delta?.outcome.nextStepHint,
      "The previous action failed or produced no graph change; inspect current routed context before retrying.",
    ),
    contextWindowStep(
      sessionId,
      "ui:primary_actions",
      task,
      0,
      "Expand primary actions to select a different graph-backed target if the previous target was stale or inert.",
    ),
  ];
}

export function observationSteps(sessionId: string, task: string | undefined): CallChainStep[] {
  return [
    routeStep(sessionId, task, "Get task-routed UI, capability, event, and data-flow windows before invoking an action."),
    contextWindowStep(sessionId, "dataflow:all", task, 0, "Keep evidence-linked data-flow visible while planning the next tool call."),
  ];
}

export function capabilityFirstStep(
  sessionId: string,
  analysis: AnalysisOutput,
  task: string,
): CallChainStep | undefined {
  const best = analysis.capabilities
    .filter(isExecutable)
    .map((capability) => ({ capability, score: scoreCapability(capability, task) }))
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)[0]?.capability;
  return best
    ? invokeCapabilityStep(sessionId, best, inferCapabilityInputs(best, task), {
        reason: "A current executable capability matches the user task; use capability-level action before falling back to raw views.",
        expectedOutcome: "AOM executes the graph-backed capability plan and returns a contextDelta for verification.",
        stopIf: "contextDelta.outcome is verified, failed, or no_change; regenerate the call chain before any retry.",
      })
    : undefined;
}

export function dedupeSteps(steps: CallChainStep[]): CallChainStep[] {
  const seen = new Set<string>();
  const result: CallChainStep[] = [];
  for (const item of steps) {
    const key = `${item.toolName}:${JSON.stringify(item.arguments)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const order = result.length + 1;
    result.push({
      ...item,
      order,
      stepId: `step:${order}:${item.toolName.replace("aom.", "")}`,
      ...(order > 1 ? { runAfter: [result[order - 2]!.stepId] } : {}),
    });
  }
  return result;
}

function targetStep(
  sessionId: string,
  target: RecommendedTarget,
  meta: Pick<CallChainStep, "reason" | "expectedOutcome" | "stopIf">,
): CallChainStep {
  if (target.toolName === "aom.invoke_capability") {
    return step("aom.invoke_capability", {
      sessionId,
      capabilityId: target.capabilityId ?? target.label ?? "open_content_result",
    }, meta);
  }
  return step("aom.invoke_view", {
    sessionId,
    action: target.action,
    ...(target.viewId ? { viewId: target.viewId } : {}),
    ...(target.label && !target.viewId ? { label: target.label } : {}),
  }, meta);
}

function invokeCapabilityStep(
  sessionId: string,
  capability: ExecutableCapability,
  inputs: Record<string, unknown> | undefined,
  meta: Pick<CallChainStep, "reason" | "expectedOutcome" | "stopIf">,
): CallChainStep {
  return step("aom.invoke_capability", {
    sessionId,
    capabilityId: capability.capability.name,
    ...(inputs && Object.keys(inputs).length > 0 ? { inputs } : {}),
  }, meta);
}

function routeStep(sessionId: string, task: string | undefined, reason: string): CallChainStep {
  return step("aom.route_context", { sessionId, ...(task ? { task } : {}), limit: 8 }, {
    reason,
    expectedOutcome: "Compact routed windows with current UI, capabilities, recent events, and data-flow hints.",
    stopIf: "The returned lastContextDelta already verifies the current subgoal and offers concrete recommendedTargets.",
  });
}

function contextWindowStep(
  sessionId: string,
  windowId: string,
  task: string | undefined,
  offset: number,
  reason: string,
): CallChainStep {
  return step("aom.context_window", {
    sessionId,
    windowId,
    offset,
    limit: 12,
    ...(task ? { task } : {}),
  }, {
    reason,
    expectedOutcome: "A focused sliding window with summaries around the exact items.",
    stopIf: "The exact items do not contain a plausible target; route context again with a narrower task.",
  });
}

function contextDeltaStep(sessionId: string, reason: string): CallChainStep {
  return step("aom.context_delta", { sessionId }, {
    reason,
    expectedOutcome: "Latest semantic diff with outcome status and recommendedTargets.",
    stopIf: "outcome.status is failed/no_change; do not repeat the previous invoke target.",
  });
}

function step(
  toolName: CallChainToolName,
  args: Record<string, unknown>,
  meta: Pick<CallChainStep, "reason" | "expectedOutcome" | "stopIf">,
): CallChainStep {
  return {
    stepId: "",
    order: 0,
    toolName,
    arguments: args,
    reason: meta.reason,
    ...(meta.expectedOutcome ? { expectedOutcome: meta.expectedOutcome } : {}),
    ...(meta.stopIf ? { stopIf: meta.stopIf } : {}),
  };
}
