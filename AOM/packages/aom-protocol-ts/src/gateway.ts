import type { JsonValue } from "./raw.js";

export type PermissionLevel =
  | "read_only"
  | "observe"
  | "safe_action"
  | "sensitive_action"
  | "debug_internal";

export interface Requester {
  type: string;
  id: string;
}

export interface GatewayRequest {
  requestId: string;
  sessionId: string;
  targetId: string;
  method: string;
  params: Record<string, JsonValue>;
  requester: Requester;
}

export type GatewayDecisionKind =
  | "allow"
  | "deny"
  | "redact"
  | "require_confirmation"
  | "downgrade"
  | "sandbox";

export interface GatewayDecision {
  requestId: string;
  decision: GatewayDecisionKind;
  reason: string;
  effectiveParams?: Record<string, JsonValue>;
  auditId: string;
}

export interface GatewayError {
  code: string;
  message: string;
}

export interface GatewayResponse {
  requestId: string;
  ok: boolean;
  decision: GatewayDecision;
  result?: JsonValue;
  error?: GatewayError;
}

