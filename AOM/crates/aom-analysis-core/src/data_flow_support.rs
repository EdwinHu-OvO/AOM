use crate::{edge, json_map, node, stable_id, EvidenceManager, Surface};
use aom_protocol_rs::{AOMEdge, AOMEdgeType, AOMNode, AOMNodeType, RawEvent};
use serde_json::{json, Value};
use std::collections::BTreeMap;

use crate::data_flow::{FlowField, FlowMessage, FlowNode};

pub(crate) fn link_inputs_to_requests(
    inputs: &[FlowField],
    messages: &[FlowMessage],
    edges: &mut Vec<AOMEdge>,
) {
    for input in inputs {
        for message in messages {
            for field in &message.fields {
                let value_match = input.value.is_some() && input.value == field.value;
                let semantic_match = input.label.to_lowercase().contains("search")
                    && ["search", "q", "query"].contains(&field.label.as_str());
                if value_match || semantic_match {
                    edges.push(edge(
                        &input.id,
                        &field.id,
                        AOMEdgeType::FlowsTo,
                        vec![input.evidence_id.clone(), field.evidence_id.clone()],
                        0.9,
                    ));
                }
            }
        }
    }
}

pub(crate) fn link_responses_to_ui(
    target_id: &str,
    timestamp: u64,
    messages: &[FlowMessage],
    current: &Surface,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) {
    let response = messages
        .iter()
        .rev()
        .find_map(|message| message.response_message.clone());
    for fact in &current.facts {
        let kind = fact
            .features
            .get("kind")
            .and_then(Value::as_str)
            .unwrap_or("visible_text");
        let label = fact.label.clone().unwrap_or_else(|| fact.id.clone());
        let (field, field_evidence) = add_field(
            target_id,
            timestamp,
            &format!("ui:{kind}:{label}"),
            &format!("visible {kind}"),
            json_map([
                ("fieldKind", json!("rendered_fact")),
                ("factKind", json!(kind)),
            ]),
            fact.evidence_ids.clone(),
            nodes,
            evidence,
        );
        if let Some(response) = &response {
            edges.push(edge(
                &response.id,
                &field,
                AOMEdgeType::RendersAs,
                vec![response.evidence_id.clone(), field_evidence.clone()],
                0.65,
            ));
        }
        edges.push(edge(
            &field,
            &fact.id,
            AOMEdgeType::RendersAs,
            vec![field_evidence],
            0.95,
        ));
    }
}

pub(crate) fn link_storage_to_ui(nodes: &[AOMNode], edges: &mut Vec<AOMEdge>) {
    let storage = nodes
        .iter()
        .filter(|node| node.node_type == AOMNodeType::StorageKey)
        .collect::<Vec<_>>();
    let fields = nodes
        .iter()
        .filter(|node| node.node_type == AOMNodeType::DataField)
        .collect::<Vec<_>>();
    for store in storage {
        let Some(key) = store.features.get("key").and_then(Value::as_str) else {
            continue;
        };
        for field in &fields {
            let fact_kind = field.features.get("factKind").and_then(Value::as_str);
            let matches = match key {
                "session.authenticated" => fact_kind == Some("user_name"),
                "cart.items" => matches!(fact_kind, Some("cart_item_count" | "cart_subtotal")),
                "search.query" => fact_kind == Some("open_store_count"),
                _ => false,
            };
            if matches {
                edges.push(edge(
                    &store.id,
                    &field.id,
                    AOMEdgeType::RendersAs,
                    vec![field.evidence_ids.first().cloned().unwrap_or_default()],
                    0.7,
                ));
            }
        }
    }
}

pub(crate) fn add_message(
    target_id: &str,
    event: &RawEvent,
    kind: &str,
    path: &str,
    nodes: &mut Vec<AOMNode>,
    evidence: &mut EvidenceManager,
) -> FlowNode {
    let id = stable_id(
        target_id,
        &AOMNodeType::Message,
        &format!("{kind}:{}:{path}", event.event_id),
    );
    let evidence_id = evidence.observed(
        target_id,
        event.timestamp,
        format!("Network {kind} message observed for {path}"),
        event.evidence_ids.clone(),
    );
    nodes.push(node(
        id.clone(),
        AOMNodeType::Message,
        Some(format!("{kind} {path}")),
        json_map([("messageKind", json!(kind)), ("path", json!(path))]),
        vec![evidence_id.clone()],
        0.95,
    ));
    FlowNode { id, evidence_id }
}

pub(crate) fn add_field(
    target_id: &str,
    timestamp: u64,
    key: &str,
    label: &str,
    features: BTreeMap<String, Value>,
    source_ids: Vec<String>,
    nodes: &mut Vec<AOMNode>,
    evidence: &mut EvidenceManager,
) -> (String, String) {
    let id = stable_id(target_id, &AOMNodeType::DataField, key);
    let evidence_id = evidence.inferred(
        target_id,
        timestamp,
        format!("Data field inferred: {label}"),
        source_ids,
    );
    nodes.push(node(
        id.clone(),
        AOMNodeType::DataField,
        Some(label.into()),
        features,
        vec![evidence_id.clone()],
        0.75,
    ));
    (id, evidence_id)
}
