export interface CapabilityCandidate {
  name: string;
  description?: string;
  targetViewId?: string;
  targetLabel?: string;
  action?: "click" | "set_text";
  inputSlot?: string;
  inputSlots?: Array<{ name: string; dataKind?: string; required?: boolean; sensitive?: boolean }>;
  expectedEffect?: string;
  confidence: number;
  reason: string;
}

export interface CapabilityRecognitionTrace {
  provider: "openai_compatible";
  model: string;
  enabled: boolean;
  candidates: CapabilityCandidate[];
  accepted: number;
  rejected: Array<{ name: string; reason: string }>;
  repairAttempts?: number;
  error?: string;
}
