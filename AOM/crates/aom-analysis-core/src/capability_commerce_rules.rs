use crate::{add_capability, add_storage, edge, CapabilitySpec, EvidenceManager};
use aom_protocol_rs::{AOMEdge, AOMEdgeType, AOMNode};

#[allow(clippy::too_many_arguments)]
pub(crate) fn add_cart_capability(
    target_id: &str,
    timestamp: u64,
    app_id: &str,
    current_screen_id: &str,
    has_add: bool,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) {
    let (storage, storage_evidence) = add_storage(
        target_id,
        timestamp,
        "cart.items",
        "Cart items",
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
    if has_add {
        add_capability(
            CapabilitySpec {
                key: "add_to_cart",
                label: "add_to_cart",
                description: "Add a selected menu item to the cart",
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
            },
        );
    }
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn add_checkout_capability(
    target_id: &str,
    timestamp: u64,
    app_id: &str,
    checkout_view_id: String,
    orders_endpoint: Option<String>,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) {
    add_capability(
        CapabilitySpec {
            key: "checkout_prepare",
            label: "checkout_prepare",
            description: "Prepare order submission from the cart review surface",
            risk: "high",
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
                &checkout_view_id,
                AOMEdgeType::Triggers,
                vec![evidence_id.to_string()],
                0.75,
            ));
            if let Some(endpoint) = orders_endpoint {
                edges.push(edge(
                    capability,
                    &endpoint,
                    AOMEdgeType::Requests,
                    vec![evidence_id.to_string()],
                    0.7,
                ));
            }
        },
    );
}
