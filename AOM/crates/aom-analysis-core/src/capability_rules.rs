use crate::{add_capability, add_storage, edge, CapabilitySpec, EvidenceManager};
use aom_protocol_rs::{AOMEdge, AOMEdgeType, AOMNode};

#[allow(clippy::too_many_arguments)]
pub(crate) fn add_login_capability(
    target_id: &str,
    timestamp: u64,
    app_id: &str,
    current_screen_id: &str,
    login_endpoint: Option<String>,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) {
    let (storage, storage_evidence) = add_storage(
        target_id,
        timestamp,
        "session.authenticated",
        "Authenticated session",
        nodes,
        evidence,
    );
    edges.push(edge(
        current_screen_id,
        &storage,
        AOMEdgeType::Reads,
        vec![storage_evidence],
        0.8,
    ));
    add_capability(
        CapabilitySpec {
            key: "login",
            label: "login",
            description: "Authenticate the user and establish an application session",
            risk: "medium",
        },
        target_id,
        timestamp,
        app_id,
        nodes,
        edges,
        evidence,
        |capability, evidence_id, edges| {
            if let Some(endpoint) = login_endpoint {
                edges.push(edge(
                    capability,
                    &endpoint,
                    AOMEdgeType::Requests,
                    vec![evidence_id.to_string()],
                    0.9,
                ));
            }
            edges.push(edge(
                capability,
                &storage,
                AOMEdgeType::Writes,
                vec![evidence_id.to_string()],
                0.9,
            ));
        },
    );
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn add_search_capability(
    target_id: &str,
    timestamp: u64,
    app_id: &str,
    stores_endpoint: Option<String>,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) {
    let (storage, _) = add_storage(
        target_id,
        timestamp,
        "search.query",
        "Search query",
        nodes,
        evidence,
    );
    add_capability(
        CapabilitySpec {
            key: "search_product",
            label: "search_product",
            description: "Search visible restaurants or products",
            risk: "low",
        },
        target_id,
        timestamp,
        app_id,
        nodes,
        edges,
        evidence,
        |capability, evidence_id, edges| {
            edges.push(edge(
                capability,
                &storage,
                AOMEdgeType::Writes,
                vec![evidence_id.to_string()],
                0.85,
            ));
            if let Some(endpoint) = stores_endpoint {
                edges.push(edge(
                    capability,
                    &endpoint,
                    AOMEdgeType::Requests,
                    vec![evidence_id.to_string()],
                    0.8,
                ));
            }
        },
    );
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn add_detail_capability(
    target_id: &str,
    timestamp: u64,
    app_id: &str,
    detail_view_id: String,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) {
    add_capability(
        CapabilitySpec {
            key: "view_product_detail",
            label: "view_product_detail",
            description: "Open a product or restaurant detail surface",
            risk: "low",
        },
        target_id,
        timestamp,
        app_id,
        nodes,
        edges,
        evidence,
        |capability, evidence_id, edges| {
            edges.push(edge(
                capability,
                &detail_view_id,
                AOMEdgeType::Triggers,
                vec![evidence_id.to_string()],
                0.75,
            ));
        },
    );
}
