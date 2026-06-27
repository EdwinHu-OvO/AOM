use aom_protocol_rs::{
    AOMEdge, AOMNode, EvidenceRef, RawEvent, RawRuntimeSnapshot, RawStaticSnapshot,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum EvidenceKind {
    Observed,
    Inferred,
    Verified,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisEvidence {
    pub evidence_id: String,
    pub target_id: String,
    pub kind: EvidenceKind,
    pub summary: String,
    pub timestamp: u64,
    #[serde(default)]
    pub source_ids: Vec<String>,
    #[serde(default)]
    pub derived_from: Vec<String>,
    #[serde(default)]
    pub metadata: BTreeMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisInput {
    pub target_id: String,
    pub static_snapshot: RawStaticSnapshot,
    pub before: RawRuntimeSnapshot,
    #[serde(default)]
    pub events: Vec<RawEvent>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub after: Option<RawRuntimeSnapshot>,
    #[serde(default)]
    pub analyzer_evidence: Vec<EvidenceRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AOMGraphSnapshot {
    pub graph_id: String,
    pub target_id: String,
    pub generated_at: u64,
    pub current_screen_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_screen_id: Option<String>,
    pub nodes: Vec<AOMNode>,
    pub edges: Vec<AOMEdge>,
    pub evidence: Vec<AnalysisEvidence>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Default)]
#[serde(rename_all = "camelCase")]
pub struct GraphDiff {
    pub added_node_ids: Vec<String>,
    pub removed_node_ids: Vec<String>,
    pub retained_node_ids: Vec<String>,
    pub changed_node_ids: Vec<String>,
}
