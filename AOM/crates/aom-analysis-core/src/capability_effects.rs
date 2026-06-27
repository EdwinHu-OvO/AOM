use crate::{edge, EvidenceManager, Surface};
use aom_protocol_rs::{AOMEdge, AOMEdgeType, AOMNode, AOMNodeType, RawEvent, RawEventType};
use serde_json::Value;

pub(crate) fn verify_capability_effects(
    target_id: &str,
    timestamp: u64,
    before: &Surface,
    current: &Surface,
    events: &[RawEvent],
    nodes: &[AOMNode],
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) {
    verify_add_to_cart(
        target_id, timestamp, before, current, events, nodes, edges, evidence,
    );
}

#[allow(clippy::too_many_arguments)]
fn verify_add_to_cart(
    target_id: &str,
    timestamp: u64,
    before: &Surface,
    current: &Surface,
    events: &[RawEvent],
    nodes: &[AOMNode],
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) {
    let add_click = events.iter().find(|event| {
        event.event_type == RawEventType::SurfaceClick
            && event
                .subject
                .as_ref()
                .and_then(|subject| subject.label.as_deref())
                .is_some_and(|label| label.starts_with("Add "))
    });
    let before_count = cart_count(&before.facts);
    let after_count = cart_count(&current.facts);
    let count_increased = before_count
        .zip(after_count)
        .is_some_and(|(left, right)| right > left);
    let mutation_seen = events
        .iter()
        .any(|event| event.event_type == RawEventType::StateChange);
    if add_click.is_none() || !count_increased {
        return;
    }
    let Some(capability) = find_node(nodes, AOMNodeType::Capability, "add_to_cart") else {
        return;
    };
    let Some(storage) = nodes.iter().find(|node| {
        node.node_type == AOMNodeType::StorageKey
            && node.features.get("key").and_then(Value::as_str) == Some("cart.items")
    }) else {
        return;
    };
    let mut derived_from = add_click
        .into_iter()
        .flat_map(|event| event.evidence_ids.clone())
        .collect::<Vec<_>>();
    if mutation_seen {
        derived_from.extend(
            events
                .iter()
                .filter(|event| event.event_type == RawEventType::StateChange)
                .flat_map(|event| event.evidence_ids.clone()),
        );
    }
    derived_from.extend(
        current
            .facts
            .iter()
            .filter(|fact| fact_kind(fact) == Some("cart_item_count"))
            .flat_map(|fact| fact.evidence_ids.clone()),
    );
    let evidence_id = evidence.verified(
        target_id,
        timestamp,
        "Capability effect verified: add_to_cart updated cart.items",
        derived_from,
    );
    edges.push(edge(
        &capability.id,
        &storage.id,
        AOMEdgeType::Updates,
        vec![evidence_id],
        if mutation_seen { 0.95 } else { 0.85 },
    ));
}

fn find_node<'a>(nodes: &'a [AOMNode], node_type: AOMNodeType, label: &str) -> Option<&'a AOMNode> {
    nodes
        .iter()
        .find(|node| node.node_type == node_type && node.label.as_deref() == Some(label))
}

fn cart_count(nodes: &[AOMNode]) -> Option<u64> {
    nodes
        .iter()
        .find(|node| fact_kind(node) == Some("cart_item_count"))
        .and_then(|node| node.label.as_deref())
        .and_then(|label| label.parse().ok())
}

fn fact_kind(node: &AOMNode) -> Option<&str> {
    node.features.get("kind").and_then(Value::as_str)
}
