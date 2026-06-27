use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AOMContextPack {
    pub target_id: String,
    pub application: ContextApplication,
    pub current_screen: ContextScreen,
    pub session: ContextSession,
    pub browse: ContextBrowse,
    pub cart: ContextCart,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub transition: Option<ContextTransition>,
    pub endpoints: Vec<ContextEndpoint>,
    pub data_flows: Vec<ContextDataFlow>,
    pub capability_verifications: Vec<ContextCapabilityVerification>,
    pub evidence_summary: Vec<ContextEvidenceItem>,
    pub limitations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextApplication {
    pub id: String,
    pub label: String,
    pub platform: String,
    pub static_component_count: usize,
    pub observed_purpose: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextScreen {
    pub id: String,
    pub label: String,
    pub confidence: f64,
    pub views: Vec<ContextView>,
    pub state_facts: Vec<ContextFact>,
    pub product_groups: Vec<ContextProduct>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextView {
    pub id: String,
    pub role: String,
    pub label: String,
    pub actions: Vec<String>,
    pub operation_kind: String,
    pub mutates_state: bool,
    pub expected_effect: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextFact {
    pub id: String,
    pub kind: String,
    pub label: String,
    pub confidence: f64,
    pub currently_visible: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextProduct {
    pub name: String,
    pub description: Option<String>,
    pub price: Option<String>,
    pub action_view_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextSession {
    pub authenticated: bool,
    pub user_name: Option<String>,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextBrowse {
    pub selected_store: Option<String>,
    pub menu_item_count: Option<u64>,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextCart {
    pub item_count: Option<u64>,
    pub subtotal: Option<String>,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextTransition {
    pub from_screen: String,
    pub to_screen: String,
    pub observed_events: Vec<ContextEvent>,
    pub added_objects: usize,
    pub removed_objects: usize,
    pub verified: bool,
    pub verification_confidence: f64,
    pub verification_reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextEvent {
    pub sequence: u64,
    pub timestamp: u64,
    pub event_type: String,
    pub label: String,
    pub target_view_id: Option<String>,
    pub target_view_label: Option<String>,
    pub request_id: Option<String>,
    pub method: Option<String>,
    pub path: Option<String>,
    pub status: Option<u16>,
    pub mutation_count: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextEndpoint {
    pub id: String,
    pub path: String,
    pub statically_discovered: bool,
    pub runtime_observed: bool,
    pub observed_methods: Vec<String>,
    pub observed_statuses: Vec<u16>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextDataFlow {
    pub from_id: String,
    pub from_label: String,
    pub to_id: String,
    pub to_label: String,
    pub relation: String,
    pub confidence: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextCapabilityVerification {
    pub capability_id: String,
    pub capability_label: String,
    pub target_state_id: String,
    pub target_state_label: String,
    pub verified: bool,
    pub confidence: f64,
    pub reasons: Vec<String>,
    pub evidence_ids: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ContextEvidenceItem {
    pub summary: String,
    pub kind: String,
    pub timestamp: u64,
    pub object_ids: Vec<String>,
}
