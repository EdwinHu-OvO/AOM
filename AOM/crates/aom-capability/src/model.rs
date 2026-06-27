use aom_protocol_rs::{AOMCapability, CapabilityRiskLevel};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityAvailability {
    Available,
    LowConfidence,
    MissingTarget,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum CapabilityStepKind {
    SetText,
    Click,
    Observe,
    Verify,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityActionStep {
    pub step_id: String,
    pub kind: CapabilityStepKind,
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_node_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_label: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub input_slot: Option<String>,
    #[serde(default)]
    pub params: BTreeMap<String, Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityExpectedEffect {
    pub summary: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_node_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_label: Option<String>,
    #[serde(default)]
    pub evidence_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CapabilityAutomationPolicy {
    pub risk_level: CapabilityRiskLevel,
    pub can_auto_execute: bool,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ExecutableCapability {
    pub capability: AOMCapability,
    pub availability: CapabilityAvailability,
    pub action_plan: Vec<CapabilityActionStep>,
    pub expected_effects: Vec<CapabilityExpectedEffect>,
    pub automation: CapabilityAutomationPolicy,
    #[serde(default)]
    pub reasons: Vec<String>,
}
