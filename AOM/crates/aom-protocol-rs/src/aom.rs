use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct EvidenceRef {
    pub evidence_id: String,
    pub source_event_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub source_locator: Option<String>,
    #[serde(default)]
    pub metadata: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AOMNodeType {
    App,
    Screen,
    View,
    ApiEndpoint,
    StorageKey,
    DataField,
    Message,
    DataObject,
    Capability,
    Event,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AOMNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: AOMNodeType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    #[serde(default)]
    pub features: BTreeMap<String, Value>,
    #[serde(default)]
    pub evidence_ids: Vec<String>,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AOMEdgeType {
    Contains,
    Triggers,
    NavigatesTo,
    Requests,
    Reads,
    Writes,
    FlowsTo,
    DerivesFrom,
    RendersAs,
    Updates,
    HasEffect,
    ObservedBefore,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AOMEdge {
    pub id: String,
    pub from: String,
    pub to: String,
    #[serde(rename = "type")]
    pub edge_type: AOMEdgeType,
    pub confidence: f64,
    #[serde(default)]
    pub evidence_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityRiskLevel {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityInputSlot {
    pub name: String,
    pub data_kind: String,
    pub required: bool,
    #[serde(default)]
    pub sensitive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AOMCapability {
    pub id: String,
    pub name: String,
    pub description: String,
    #[serde(default)]
    pub input_slots: Vec<CapabilityInputSlot>,
    #[serde(default)]
    pub action_summary: Vec<String>,
    #[serde(default)]
    pub expected_effects: Vec<String>,
    pub risk_level: CapabilityRiskLevel,
    pub confidence: f64,
    #[serde(default)]
    pub evidence_ids: Vec<String>,
}
