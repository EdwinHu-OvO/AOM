use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RawEventType {
    SurfaceSnapshot,
    SurfaceClick,
    SurfaceTextInput,
    Lifecycle,
    Navigation,
    NetworkRequest,
    NetworkResponse,
    StorageRead,
    StorageWrite,
    StateChange,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RawEventSource {
    pub adapter_id: String,
    pub probe_id: String,
    pub source_type: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RawRef {
    pub raw_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kind: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RawEvent {
    pub event_id: String,
    pub target_id: String,
    pub platform: String,
    pub timestamp: u64,
    pub sequence: u64,
    #[serde(rename = "type")]
    pub event_type: RawEventType,
    pub source: RawEventSource,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject: Option<RawRef>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub object: Option<RawRef>,
    #[serde(default)]
    pub payload: BTreeMap<String, Value>,
    #[serde(default)]
    pub evidence_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RawRuntimeSnapshot {
    pub snapshot_id: String,
    pub target_id: String,
    pub platform: String,
    pub timestamp: u64,
    #[serde(default)]
    pub nodes: Vec<Value>,
    #[serde(default)]
    pub evidence_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum RawActionType {
    Click,
    SetText,
    Scroll,
    Back,
    WaitFor,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RawAction {
    pub action_id: String,
    pub target_id: String,
    #[serde(rename = "type")]
    pub action_type: RawActionType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_raw_id: Option<String>,
    #[serde(default)]
    pub params: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RawActionResult {
    pub action_id: String,
    pub target_id: String,
    pub ok: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error_code: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(default)]
    pub evidence_ids: Vec<String>,
}
