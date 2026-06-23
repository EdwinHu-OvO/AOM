use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PermissionLevel {
    ReadOnly,
    Observe,
    SafeAction,
    SensitiveAction,
    DebugInternal,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct Requester {
    #[serde(rename = "type")]
    pub requester_type: String,
    pub id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayRequest {
    pub request_id: String,
    pub session_id: String,
    pub target_id: String,
    pub method: String,
    #[serde(default)]
    pub params: BTreeMap<String, Value>,
    pub requester: Requester,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum GatewayDecisionKind {
    Allow,
    Deny,
    Redact,
    RequireConfirmation,
    Downgrade,
    Sandbox,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayDecision {
    pub request_id: String,
    pub decision: GatewayDecisionKind,
    pub reason: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub effective_params: Option<BTreeMap<String, Value>>,
    pub audit_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayError {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct GatewayResponse {
    pub request_id: String,
    pub ok: bool,
    pub decision: GatewayDecision,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<GatewayError>,
}

