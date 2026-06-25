import type { AOMCapability, AOMEdge, AOMNode, EvidenceRef } from "./aom.js";
import type { ArtifactInspection } from "./artifact.js";
import type { GatewayDecision, GatewayRequest, GatewayResponse } from "./gateway.js";
import type {
  JsonValue,
  RawAction,
  RawActionResult,
  RawEvent,
  RawRuntimeSnapshot,
  RawStaticSnapshot,
} from "./raw.js";
import type { TargetDescriptor } from "./target.js";

export type ProtocolMessageKind =
  | "request"
  | "response"
  | "event"
  | "snapshot"
  | "action"
  | "action_result"
  | "target_status";

export type ProtocolPayload =
  | { payloadType: "target_descriptor"; payload: TargetDescriptor }
  | { payloadType: "artifact_inspection"; payload: ArtifactInspection }
  | { payloadType: "raw_event"; payload: RawEvent }
  | { payloadType: "raw_static_snapshot"; payload: RawStaticSnapshot }
  | { payloadType: "raw_runtime_snapshot"; payload: RawRuntimeSnapshot }
  | { payloadType: "raw_action"; payload: RawAction }
  | { payloadType: "raw_action_result"; payload: RawActionResult }
  | { payloadType: "aom_node"; payload: AOMNode }
  | { payloadType: "aom_edge"; payload: AOMEdge }
  | { payloadType: "aom_capability"; payload: AOMCapability }
  | { payloadType: "evidence_ref"; payload: EvidenceRef }
  | { payloadType: "gateway_request"; payload: GatewayRequest }
  | { payloadType: "gateway_decision"; payload: GatewayDecision }
  | { payloadType: "gateway_response"; payload: GatewayResponse }
  | { payloadType: "json"; payload: JsonValue };

export interface ProtocolMessage {
  messageId: string;
  kind: ProtocolMessageKind;
  correlationId?: string;
  payload: ProtocolPayload;
}

export function createProtocolMessage(
  messageId: string,
  kind: ProtocolMessageKind,
  payload: ProtocolPayload,
  correlationId?: string,
): ProtocolMessage {
  return correlationId === undefined
    ? { messageId, kind, payload }
    : { messageId, kind, payload, correlationId };
}
