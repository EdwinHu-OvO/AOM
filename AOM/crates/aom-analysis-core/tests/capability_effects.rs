mod cart_support;

use aom_analysis_core::{build_context_pack, EvidenceKind, Normalizer};
use aom_protocol_rs::{AOMEdgeType, AOMNodeType};
use cart_support::add_to_cart_input;

#[test]
fn add_to_cart_verifies_cart_mutation_effect() {
    let graph = Normalizer::normalize(add_to_cart_input());
    let capability = graph
        .nodes
        .iter()
        .find(|node| {
            node.node_type == AOMNodeType::Capability
                && node.label.as_deref() == Some("add_to_cart")
        })
        .unwrap();
    let cart_storage = graph
        .nodes
        .iter()
        .find(|node| {
            node.node_type == AOMNodeType::StorageKey
                && node.features.get("key").and_then(|value| value.as_str()) == Some("cart.items")
        })
        .unwrap();
    let update_edge = graph
        .edges
        .iter()
        .find(|edge| {
            edge.from == capability.id
                && edge.to == cart_storage.id
                && edge.edge_type == AOMEdgeType::Updates
        })
        .unwrap();
    assert!(update_edge.confidence >= 0.9);
    assert!(update_edge.evidence_ids.iter().any(|id| {
        graph
            .evidence
            .iter()
            .any(|record| record.evidence_id == *id && record.kind == EvidenceKind::Verified)
    }));

    let context = build_context_pack(&graph);
    let verification = context
        .capability_verifications
        .iter()
        .find(|item| item.capability_label == "add_to_cart")
        .unwrap();
    assert!(verification.verified);
    assert_eq!(verification.target_state_label, "Cart items");
    assert!(verification
        .reasons
        .iter()
        .any(|reason| reason.contains("add_to_cart updated cart.items")));
}
