use crate::{
    AOMCapability, AOMEdge, AOMNode, ArtifactInspection, EvidenceRef, GatewayDecision,
    GatewayRequest, GatewayResponse, RawAction, RawActionResult, RawEvent, RawRuntimeSnapshot,
    RawStaticSnapshot, TargetDescriptor,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ProtocolMessageKind {
    Request,
    Response,
    Event,
    Snapshot,
    Action,
    ActionResult,
    TargetStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case", tag = "payloadType", content = "payload")]
pub enum ProtocolPayload {
    TargetDescriptor(TargetDescriptor),
    ArtifactInspection(ArtifactInspection),
    RawEvent(RawEvent),
    RawStaticSnapshot(RawStaticSnapshot),
    RawRuntimeSnapshot(RawRuntimeSnapshot),
    RawAction(RawAction),
    RawActionResult(RawActionResult),
    AomNode(AOMNode),
    AomEdge(AOMEdge),
    AomCapability(AOMCapability),
    EvidenceRef(EvidenceRef),
    GatewayRequest(GatewayRequest),
    GatewayDecision(GatewayDecision),
    GatewayResponse(GatewayResponse),
    Json(Value),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ProtocolMessage {
    pub message_id: String,
    pub kind: ProtocolMessageKind,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub correlation_id: Option<String>,
    pub payload: ProtocolPayload,
}
