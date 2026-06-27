use aom_analysis_core::AOMGraphSnapshot;
use aom_protocol_rs::{AOMEdgeType, AOMNode, AOMNodeType, CapabilityRiskLevel};
use serde_json::Value;

pub(crate) fn feature_str<'a>(node: &'a AOMNode, key: &str) -> Option<&'a str> {
    node.features.get(key).and_then(Value::as_str)
}

pub(crate) fn risk_from_node(node: &AOMNode) -> CapabilityRiskLevel {
    match feature_str(node, "riskLevel") {
        Some("high") => CapabilityRiskLevel::High,
        Some("medium") => CapabilityRiskLevel::Medium,
        _ => CapabilityRiskLevel::Low,
    }
}

pub(crate) fn node_label(node: &AOMNode) -> &str {
    node.label.as_deref().unwrap_or("")
}

pub(crate) fn current_view_starts<'a>(
    graph: &'a AOMGraphSnapshot,
    prefix: &str,
) -> Option<&'a AOMNode> {
    current_views(graph).find(|node| {
        is_interactive(node)
            && node
                .label
                .as_deref()
                .is_some_and(|label| label.starts_with(prefix))
    })
}

pub(crate) fn current_view_exact<'a>(
    graph: &'a AOMGraphSnapshot,
    label: &str,
) -> Option<&'a AOMNode> {
    current_views(graph).find(|node| is_interactive(node) && node.label.as_deref() == Some(label))
}

pub(crate) fn current_view_matching<'a>(
    graph: &'a AOMGraphSnapshot,
    mut predicate: impl FnMut(&'a AOMNode) -> bool,
) -> Option<&'a AOMNode> {
    current_views(graph).find(|node| is_interactive(node) && predicate(node))
}

pub(crate) fn storage<'a>(graph: &'a AOMGraphSnapshot, key: &str) -> Option<&'a AOMNode> {
    graph.nodes.iter().find(|node| {
        node.node_type == AOMNodeType::StorageKey
            && feature_str(node, "key").is_some_and(|value| value == key)
    })
}

pub(crate) fn endpoint<'a>(graph: &'a AOMGraphSnapshot, path: &str) -> Option<&'a AOMNode> {
    graph.nodes.iter().find(|node| {
        node.node_type == AOMNodeType::ApiEndpoint && node.label.as_deref() == Some(path)
    })
}

pub(crate) fn verified_update_evidence(
    graph: &AOMGraphSnapshot,
    from: &str,
    to: &str,
) -> Vec<String> {
    graph
        .edges
        .iter()
        .filter(|edge| edge.from == from && edge.to == to && edge.edge_type == AOMEdgeType::Updates)
        .flat_map(|edge| edge.evidence_ids.iter().cloned())
        .collect()
}

fn current_views(graph: &AOMGraphSnapshot) -> impl Iterator<Item = &AOMNode> {
    graph.nodes.iter().filter(|node| {
        node.node_type == AOMNodeType::View
            && graph.edges.iter().any(|edge| {
                edge.edge_type == AOMEdgeType::Contains
                    && edge.from == graph.current_screen_id
                    && edge.to == node.id
            })
    })
}

fn is_interactive(node: &AOMNode) -> bool {
    node.features
        .get("actions")
        .and_then(Value::as_array)
        .is_some_and(|actions| !actions.is_empty())
}
