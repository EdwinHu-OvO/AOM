use crate::{AOMGraphSnapshot, ContextEvent};
use aom_protocol_rs::{AOMEdgeType, AOMNodeType};
use serde_json::Value;

pub(crate) fn context_events(graph: &AOMGraphSnapshot) -> Vec<ContextEvent> {
    let mut events = graph
        .nodes
        .iter()
        .filter(|node| node.node_type == AOMNodeType::Event)
        .map(|node| {
            let target_view_id = graph
                .edges
                .iter()
                .find(|edge| edge.to == node.id && edge.edge_type == AOMEdgeType::Triggers)
                .map(|edge| edge.from.clone());
            let target_view_label = target_view_id.as_ref().and_then(|id| {
                graph
                    .nodes
                    .iter()
                    .find(|candidate| candidate.id == *id)
                    .and_then(|candidate| candidate.label.clone())
            });
            ContextEvent {
                sequence: u64_feature(node, "sequence").unwrap_or_default(),
                timestamp: u64_feature(node, "timestamp").unwrap_or_default(),
                event_type: string_feature(node, "eventType").unwrap_or_else(|| "Unknown".into()),
                label: node.label.clone().unwrap_or_else(|| node.id.clone()),
                target_view_id,
                target_view_label,
                request_id: string_feature(node, "requestId"),
                method: string_feature(node, "method"),
                path: string_feature(node, "path"),
                status: u64_feature(node, "status").map(|value| value as u16),
                mutation_count: u64_feature(node, "mutationCount"),
            }
        })
        .collect::<Vec<_>>();
    events.sort_by_key(|event| (event.sequence, event.timestamp));
    events
}

fn string_feature(node: &aom_protocol_rs::AOMNode, key: &str) -> Option<String> {
    node.features
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_string)
}

fn u64_feature(node: &aom_protocol_rs::AOMNode, key: &str) -> Option<u64> {
    node.features.get(key).and_then(Value::as_u64)
}
