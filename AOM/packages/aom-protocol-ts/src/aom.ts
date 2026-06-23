import type { JsonValue } from "./raw.js";

export interface EvidenceRef {
  evidenceId: string;
  sourceEventId: string;
  summary?: string;
}

export type AOMNodeType =
  | "app"
  | "screen"
  | "view"
  | "api_endpoint"
  | "storage_key"
  | "data_object"
  | "capability"
  | "event";

export interface AOMNode {
  id: string;
  type: AOMNodeType;
  label?: string;
  features: Record<string, JsonValue>;
  evidenceIds: string[];
  confidence: number;
}

export type AOMEdgeType =
  | "contains"
  | "triggers"
  | "navigates_to"
  | "requests"
  | "reads"
  | "writes"
  | "has_effect"
  | "observed_before";

export interface AOMEdge {
  id: string;
  from: string;
  to: string;
  type: AOMEdgeType;
  confidence: number;
  evidenceIds: string[];
}

export type CapabilityRiskLevel = "low" | "medium" | "high";

export interface CapabilityInputSlot {
  name: string;
  dataKind: string;
  required: boolean;
  sensitive: boolean;
}

export interface AOMCapability {
  id: string;
  name: string;
  description: string;
  inputSlots: CapabilityInputSlot[];
  actionSummary: string[];
  expectedEffects: string[];
  riskLevel: CapabilityRiskLevel;
  confidence: number;
  evidenceIds: string[];
}

