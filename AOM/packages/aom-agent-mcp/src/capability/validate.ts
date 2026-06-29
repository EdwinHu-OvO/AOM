import type { AOMNode } from "@aom/protocol";
import type { AnalysisOutput, ExecutableCapability } from "../analysis/types.js";
import type { LlmRecognizerConfig } from "../config.js";
import type { CapabilityCandidate } from "./types.js";

export function validateCandidates(
  analysis: AnalysisOutput,
  candidates: CapabilityCandidate[],
  config: LlmRecognizerConfig,
): { accepted: ExecutableCapability[]; rejected: Array<{ name: string; reason: string }> } {
  const accepted: ExecutableCapability[] = [];
  const rejected: Array<{ name: string; reason: string }> = [];
  for (const candidate of candidates.slice(0, config.maxCandidates ?? 8)) {
    const result = validateCandidate(analysis, candidate, config);
    if (typeof result === "string") rejected.push({ name: candidate.name || "unknown", reason: result });
    else accepted.push(result);
  }
  return { accepted, rejected };
}

function validateCandidate(
  analysis: AnalysisOutput,
  candidate: CapabilityCandidate,
  config: LlmRecognizerConfig,
): ExecutableCapability | string {
  if (!candidate.name || candidate.confidence < (config.minConfidence ?? 0.5)) {
    return "candidate confidence or name is missing";
  }
  const view = findCurrentView(analysis, candidate);
  if (!view) return "target view is not present on the current screen";
  const action = candidate.action ?? "click";
  const actions = arrayFeature(view, "actions");
  if (!actions.includes(action)) return `target view does not support ${action}`;
  if (typeof view.features.rawReference !== "string") return "target view has no rawReference";
  const slotName = candidate.inputSlot ?? candidate.inputSlots?.[0]?.name;
  if (action === "set_text" && !slotName) return "set_text candidate needs an input slot";
  const risk = riskFor(candidate.name);
  const confidence = Math.min(0.95, Math.max(0, candidate.confidence));
  return {
    capability: {
      id: `capability:llm:${slug(candidate.name)}:${view.id}`,
      name: candidate.name,
      description: candidate.description ?? candidate.reason,
      inputSlots: inputSlots(candidate),
      actionSummary: [`${action} ${view.label ?? view.id}`],
      expectedEffects: [candidate.expectedEffect ?? "Visible app state should change after action"],
      riskLevel: risk,
      confidence,
      evidenceIds: view.evidenceIds,
    },
    availability: confidence < 0.7 ? "low_confidence" : "available",
    actionPlan: [{
      stepId: `${candidate.name}.invoke`,
      kind: action,
      summary: `${action} ${view.label ?? candidate.targetLabel ?? view.id}`,
      targetNodeId: view.id,
      ...(slotName ? { inputSlot: slotName } : {}),
      ...(view.label ? { targetLabel: view.label } : {}),
      params: { recognizer: "llm", transportNeutral: true },
    }],
    expectedEffects: [{
      summary: candidate.expectedEffect ?? "Visible app state should change after action",
      targetNodeId: view.id,
      evidenceIds: view.evidenceIds,
      ...(view.label ? { targetLabel: view.label } : {}),
    }],
    automation: {
      riskLevel: risk,
      canAutoExecute: risk === "low" && confidence >= 0.75,
      reason: "LLM candidate validated against current AOM graph target and action support",
    },
    reasons: [`llm: ${candidate.reason}`, `validated target view ${view.id}`],
  };
}

function findCurrentView(analysis: AnalysisOutput, candidate: CapabilityCandidate): AOMNode | undefined {
  const current = analysis.graph.currentScreenId;
  const currentViewIds = new Set(analysis.graph.edges
    .filter((edge) => edge.type === "contains" && edge.from === current)
    .map((edge) => edge.to));
  return analysis.graph.nodes.find((node) =>
    node.type === "view"
      && currentViewIds.has(node.id)
      && (node.id === candidate.targetViewId || node.label === candidate.targetLabel)
  );
}

function arrayFeature(node: AOMNode, key: string): string[] {
  const value = node.features[key];
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function inputSlots(candidate: CapabilityCandidate): ExecutableCapability["capability"]["inputSlots"] {
  return (candidate.inputSlots ?? []).map((slot) => ({
    name: slot.name,
    dataKind: slot.dataKind ?? "text",
    required: slot.required ?? true,
    sensitive: slot.sensitive ?? false,
  }));
}

function riskFor(name: string): "low" | "medium" | "high" {
  const lowered = name.toLowerCase();
  if (/(delete|pay|purchase|checkout|submit_order)/.test(lowered)) return "high";
  if (/(login|auth|account|profile_edit)/.test(lowered)) return "medium";
  return "low";
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_\-\u4e00-\u9fff]+/gu, "-").replace(/^-|-$/g, "");
}
