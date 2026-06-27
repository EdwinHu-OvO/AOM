use crate::{AOMGraphSnapshot, ContextEndpoint, ContextEvidenceItem};
use aom_protocol_rs::{AOMNode, AOMNodeType};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};

pub(crate) fn context_endpoints(graph: &AOMGraphSnapshot) -> Vec<ContextEndpoint> {
    let mut endpoints: BTreeMap<String, ContextEndpoint> = BTreeMap::new();
    for node in graph
        .nodes
        .iter()
        .filter(|node| node.node_type == AOMNodeType::ApiEndpoint)
    {
        let path = label(node);
        let entry = endpoints.entry(path.clone()).or_insert(ContextEndpoint {
            id: node.id.clone(),
            path,
            statically_discovered: false,
            runtime_observed: false,
            observed_methods: vec![],
            observed_statuses: vec![],
        });
        entry.statically_discovered |= bool_feature(node, "staticallyDiscovered");
        entry.runtime_observed |= bool_feature(node, "runtimeObserved");
        if let Some(method) = string_feature(node, "method") {
            entry.observed_methods.push(method);
        }
        if let Some(status) = node.features.get("status").and_then(Value::as_u64) {
            entry.observed_statuses.push(status as u16);
        }
    }
    for endpoint in endpoints.values_mut() {
        endpoint.observed_methods = unique(endpoint.observed_methods.clone());
        endpoint.observed_statuses.sort_unstable();
        endpoint.observed_statuses.dedup();
    }
    endpoints.into_values().collect()
}

pub(crate) fn contained_nodes<'a>(
    graph: &'a AOMGraphSnapshot,
    container: &str,
    node_type: AOMNodeType,
) -> Vec<&'a AOMNode> {
    let ids: BTreeSet<_> = graph
        .edges
        .iter()
        .filter(|edge| edge.from == container)
        .map(|edge| edge.to.as_str())
        .collect();
    graph
        .nodes
        .iter()
        .filter(|node| node.node_type == node_type && ids.contains(node.id.as_str()))
        .collect()
}

pub(crate) fn current_evidence(
    graph: &AOMGraphSnapshot,
    app: &AOMNode,
    screen: &AOMNode,
    views: &[&AOMNode],
    facts: &[&AOMNode],
) -> Vec<ContextEvidenceItem> {
    let ids = std::iter::once(app)
        .chain(std::iter::once(screen))
        .chain(views.iter().copied())
        .chain(facts.iter().copied())
        .flat_map(|node| node.evidence_ids.iter())
        .collect::<BTreeSet<_>>();
    graph
        .evidence
        .iter()
        .filter(|evidence| ids.contains(&evidence.evidence_id))
        .map(|evidence| ContextEvidenceItem {
            summary: evidence.summary.clone(),
            kind: format!("{:?}", evidence.kind).to_lowercase(),
            timestamp: evidence.timestamp,
            object_ids: std::iter::once(app)
                .chain(std::iter::once(screen))
                .chain(views.iter().copied())
                .chain(facts.iter().copied())
                .filter(|node| node.evidence_ids.contains(&evidence.evidence_id))
                .map(|node| node.id.clone())
                .collect(),
        })
        .filter(|evidence| !evidence.object_ids.is_empty())
        .take(12)
        .collect()
}

pub(crate) fn find_node<'a>(graph: &'a AOMGraphSnapshot, id: &str) -> &'a AOMNode {
    graph
        .nodes
        .iter()
        .find(|node| node.id == id)
        .expect("node id must resolve")
}

pub(crate) fn label(node: &AOMNode) -> String {
    node.label.clone().unwrap_or_else(|| node.id.clone())
}

pub(crate) fn string_feature(node: &AOMNode, key: &str) -> Option<String> {
    node.features
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn bool_feature(node: &AOMNode, key: &str) -> bool {
    node.features
        .get(key)
        .and_then(Value::as_bool)
        .unwrap_or(false)
}

fn unique(values: Vec<String>) -> Vec<String> {
    values
        .into_iter()
        .collect::<BTreeSet<_>>()
        .into_iter()
        .collect()
}
