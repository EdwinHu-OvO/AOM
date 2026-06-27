use crate::{edge, json_map, node, stable_id, EvidenceManager};
use aom_protocol_rs::{AOMEdge, AOMEdgeType, AOMNode, AOMNodeType};
use serde_json::{json, Value};

pub(crate) struct CapabilitySpec<'a> {
    pub key: &'a str,
    pub label: &'a str,
    pub description: &'a str,
    pub risk: &'a str,
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn add_capability(
    spec: CapabilitySpec,
    target_id: &str,
    timestamp: u64,
    app_id: &str,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
    link: impl FnOnce(&str, &str, &mut Vec<AOMEdge>),
) {
    let id = stable_id(target_id, &AOMNodeType::Capability, spec.key);
    let evidence_id = evidence.inferred(
        target_id,
        timestamp,
        format!("Capability inferred: {}", spec.label),
        collect_related_evidence(nodes),
    );
    nodes.push(node(
        id.clone(),
        AOMNodeType::Capability,
        Some(spec.label.into()),
        json_map([
            ("description", json!(spec.description)),
            ("riskLevel", json!(spec.risk)),
        ]),
        vec![evidence_id.clone()],
        0.75,
    ));
    edges.push(edge(
        app_id,
        &id,
        AOMEdgeType::Contains,
        vec![evidence_id.clone()],
        0.9,
    ));
    link(&id, &evidence_id, edges);
}

pub(crate) fn add_storage(
    target_id: &str,
    timestamp: u64,
    key: &str,
    label: &str,
    nodes: &mut Vec<AOMNode>,
    evidence: &mut EvidenceManager,
) -> (String, String) {
    let id = stable_id(target_id, &AOMNodeType::StorageKey, key);
    let evidence_id = evidence.inferred(
        target_id,
        timestamp,
        format!("Logical storage key inferred: {key}"),
        collect_related_evidence(nodes),
    );
    nodes.push(node(
        id.clone(),
        AOMNodeType::StorageKey,
        Some(label.into()),
        json_map([("key", json!(key)), ("scope", json!("logical_state"))]),
        vec![evidence_id.clone()],
        0.7,
    ));
    (id, evidence_id)
}

pub(crate) fn endpoint(nodes: &[AOMNode], path: &str) -> Option<String> {
    nodes
        .iter()
        .find(|node| {
            node.node_type == AOMNodeType::ApiEndpoint && node.label.as_deref() == Some(path)
        })
        .map(|node| node.id.clone())
}

pub(crate) fn has_fact(nodes: &[AOMNode], kind: &str) -> bool {
    nodes.iter().any(|node| {
        node.node_type == AOMNodeType::DataObject
            && node.features.get("kind").and_then(Value::as_str) == Some(kind)
    })
}

fn collect_related_evidence(nodes: &[AOMNode]) -> Vec<String> {
    nodes
        .iter()
        .flat_map(|node| node.evidence_ids.iter().cloned())
        .take(12)
        .collect()
}
