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
  return action(targetId, actionType(step), rawReference, paramsForStep(capability, step, inputs));
}

export function actionForView(
  analysis: AnalysisOutput,
  targetId: string,
  input: { viewId?: string; label?: string; rawId?: string; action?: string; value?: string },
): RawAction {
  const view = analysis.graph.nodes.find((node) =>
    node.type === "view"
      && (
        node.id === input.viewId
        || node.label === input.label
        || featureString(node.features, "rawReference") === input.rawId
      )
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
  capability: ExecutableCapability,
  step: CapabilityActionStep,
  inputs: Record<string, unknown>,
): RawAction["params"] {
  if (step.kind !== "set_text") return {};
  const slot = step.inputSlot ?? capability.capability.inputSlots[0]?.name ?? "query";
  const value = inputValue(inputs, slot);
  if (typeof value !== "string") throw new Error(`missing_input: ${slot}`);
  return {
    value,
    ...(shouldSubmitWithEnter(capability, step) ? { submitKey: "Enter" } : {}),
  };
}

function action(
  targetId: string,
  type: RawAction["type"],
  targetRawId: string,
  params: RawAction["params"],
): RawAction {
  return { actionId: `action:mcp:${Date.now()}`, targetId, type, targetRawId, params };
}

function inputValue(inputs: Record<string, unknown>, slot: string): unknown {
  const aliases = [
    slot,
    normalizeKey(slot),
    "query",
    "keyword",
    "text",
    "input",
    "value",
    "text input",
    "text_input",
    "search",
    "search query",
    "search_query",
  ];
  for (const alias of aliases) {
    if (inputs[alias] !== undefined) return inputs[alias];
  }
  const normalizedSlot = normalizeKey(slot);
  return Object.entries(inputs).find(([key]) => normalizeKey(key) === normalizedSlot)?.[1];
}

function normalizeKey(value: string): string {
  return value.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function shouldSubmitWithEnter(capability: ExecutableCapability, step: CapabilityActionStep): boolean {
  const name = capability.capability.name.toLowerCase();
  const summary = `${step.summary} ${capability.capability.description ?? ""}`.toLowerCase();
  return /search|query|find/.test(name) || /search|query|搜索/.test(summary);
}
