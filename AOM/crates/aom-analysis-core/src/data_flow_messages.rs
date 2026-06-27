use crate::{add_field, add_message, edge, json_map, EvidenceManager, FlowField, FlowMessage};
use aom_protocol_rs::{AOMEdge, AOMEdgeType, AOMNode, RawEvent, RawEventType};
use serde_json::json;
use std::collections::BTreeMap;

pub(crate) fn message_fields(
    target_id: &str,
    events: &[RawEvent],
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) -> Vec<FlowMessage> {
    let mut messages: BTreeMap<String, FlowMessage> = BTreeMap::new();
    for event in events {
        if !matches!(
            event.event_type,
            RawEventType::NetworkRequest | RawEventType::NetworkResponse
        ) {
            continue;
        }
        let Some(metadata) = event
            .payload
            .get("metadata")
            .and_then(serde_json::Value::as_object)
        else {
            continue;
        };
        let Some(request_id) = metadata
            .get("requestId")
            .and_then(serde_json::Value::as_str)
        else {
            continue;
        };
        let Some(url) = metadata.get("url").and_then(serde_json::Value::as_str) else {
            continue;
        };
        let path = url_path(url);
        let entry = messages
            .entry(request_id.into())
            .or_insert_with(FlowMessage::default);
        if event.event_type == RawEventType::NetworkRequest {
            add_request_fields(
                target_id, event, request_id, url, &path, entry, nodes, edges, evidence,
            );
        } else {
            entry.response_message = Some(add_message(
                target_id, event, "response", &path, nodes, evidence,
            ));
        }
    }
    let messages = messages.into_values().collect::<Vec<_>>();
    for message in &messages {
        if let (Some(request), Some(response)) =
            (&message.request_message, &message.response_message)
        {
            edges.push(edge(
                &request.id,
                &response.id,
                AOMEdgeType::FlowsTo,
                vec![request.evidence_id.clone(), response.evidence_id.clone()],
                0.95,
            ));
        }
    }
    messages
}

#[allow(clippy::too_many_arguments)]
fn add_request_fields(
    target_id: &str,
    event: &RawEvent,
    request_id: &str,
    url: &str,
    path: &str,
    entry: &mut FlowMessage,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) {
    entry.request_message = Some(add_message(
        target_id, event, "request", path, nodes, evidence,
    ));
    for (key, value) in query_pairs(url) {
        let (field, field_evidence) = add_field(
            target_id,
            event.timestamp,
            &format!("request:{request_id}:{path}:{key}"),
            &format!("request query {key}"),
            json_map([
                ("fieldKind", json!("request_query")),
                ("name", json!(key)),
                ("valuePreview", json!(value)),
            ]),
            event.evidence_ids.clone(),
            nodes,
            evidence,
        );
        if let Some(request) = &entry.request_message {
            edges.push(edge(
                &field,
                &request.id,
                AOMEdgeType::FlowsTo,
                vec![field_evidence.clone(), request.evidence_id.clone()],
                0.9,
            ));
        }
        entry.fields.push(FlowField {
            id: field,
            evidence_id: field_evidence,
            value: Some(value),
            label: key,
        });
    }
}

fn url_path(url: &str) -> String {
    url.split("://")
        .nth(1)
        .and_then(|value| value.split_once('/').map(|(_, path)| path))
        .map(|path| format!("/{}", path.split(['?', '#']).next().unwrap_or(path)))
        .unwrap_or_else(|| url.into())
}

fn query_pairs(url: &str) -> Vec<(String, String)> {
    let Some(query) = url.split_once('?').map(|(_, query)| query) else {
        return vec![];
    };
    query
        .split('&')
        .filter_map(|pair| {
            let (key, value) = pair.split_once('=')?;
            Some((key.to_string(), value.to_string()))
        })
        .collect()
}
