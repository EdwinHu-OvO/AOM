import type { RawAction } from "@aom/protocol";
import type { AnalysisOutput, CapabilityActionStep, ExecutableCapability } from "../analysis/types.js";

export function actionForCapability(
  analysis: AnalysisOutput,
  targetId: string,
  capabilityId: string,
  inputs: Record<string, unknown> = {},
): RawAction {
  const capability = findCapability(analysis, capabilityId);
  if (!capability) throw new Error(`unknown_capability: ${capabilityId}`);
  const step = actionStep(capability);
  if (!step) throw new Error(`capability_has_no_action_step: ${capabilityId}`);
  const targetNodeId = productTarget(analysis, capability, inputs) ?? step.targetNodeId;
  const rawReference = rawReferenceForNode(analysis, targetNodeId);
  if (!rawReference) throw new Error(`capability_target_missing_raw_reference: ${capabilityId}`);
  return action(targetId, actionType(step), rawReference, paramsForStep(step, inputs));
}

export function actionForView(
  analysis: AnalysisOutput,
  targetId: string,
  input: { viewId?: string; label?: string; action?: string; value?: string },
): RawAction {
  const view = analysis.graph.nodes.find((node) =>
    node.type === "view" && (node.id === input.viewId || node.label === input.label)
  );
  if (!view) throw new Error("view_not_found");
  const rawReference = featureString(view.features, "rawReference");
  if (!rawReference) throw new Error("view_missing_raw_reference");
  const actionName = input.action ?? (input.value !== undefined ? "set_text" : "click");
  return action(
    targetId,
    actionName as RawAction["type"],
    rawReference,
    input.value === undefined ? {} : { value: input.value },
  );
}

function findCapability(
  analysis: AnalysisOutput,
  capabilityId: string,
): ExecutableCapability | undefined {
  return analysis.capabilities.find((item) =>
    item.capability.name === capabilityId || item.capability.id === capabilityId
  );
}

function actionStep(capability: ExecutableCapability): CapabilityActionStep | undefined {
  return capability.actionPlan.find((step) => step.kind === "click" || step.kind === "set_text");
}

function productTarget(
  analysis: AnalysisOutput,
  capability: ExecutableCapability,
  inputs: Record<string, unknown>,
): string | undefined {
  if (capability.capability.name !== "add_to_cart" || typeof inputs.product !== "string") {
    return undefined;
  }
  const context = analysis.contextPack as {
    currentScreen?: { productGroups?: Array<{ name: string; actionViewId?: string }> };
  };
  return context.currentScreen?.productGroups?.find((group) =>
    typeof inputs.product === "string"
      && group.name.toLowerCase().includes(inputs.product.toLowerCase())
  )?.actionViewId;
}

function rawReferenceForNode(
  analysis: AnalysisOutput,
  nodeId: string | undefined,
): string | undefined {
  const node = analysis.graph.nodes.find((item) => item.id === nodeId);
  return node ? featureString(node.features, "rawReference") : undefined;
}

function featureString(features: Record<string, unknown>, key: string): string | undefined {
  const value = features[key];
  return typeof value === "string" ? value : undefined;
}

function actionType(step: CapabilityActionStep): RawAction["type"] {
  return step.kind === "set_text" ? "set_text" : "click";
}

function paramsForStep(
  step: CapabilityActionStep,
  inputs: Record<string, unknown>,
): RawAction["params"] {
  if (step.kind !== "set_text") return {};
  const value = inputs[step.inputSlot ?? "query"];
  if (typeof value !== "string") throw new Error(`missing_input: ${step.inputSlot ?? "query"}`);
  return { value };
}

function action(
  targetId: string,
  type: RawAction["type"],
  targetRawId: string,
  params: RawAction["params"],
): RawAction {
  return { actionId: `action:mcp:${Date.now()}`, targetId, type, targetRawId, params };
}
