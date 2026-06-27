use crate::{
    add_field, edge, json_map, link_inputs_to_requests, link_responses_to_ui, link_storage_to_ui,
    message_fields, EvidenceManager, Surface,
};
use aom_protocol_rs::{AOMEdge, AOMEdgeType, AOMNode, RawEvent, RawEventType};
use serde_json::{json, Value};

#[allow(clippy::too_many_arguments)]
pub(crate) fn add_data_flows(
    target_id: &str,
    timestamp: u64,
    events: &[RawEvent],
    current: &Surface,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) {
    let inputs = input_fields(target_id, events, current, nodes, edges, evidence);
    let messages = message_fields(target_id, events, nodes, edges, evidence);
    link_inputs_to_requests(&inputs, &messages, edges);
    link_responses_to_ui(
        target_id, timestamp, &messages, current, nodes, edges, evidence,
    );
    link_storage_to_ui(nodes, edges);
}

#[derive(Clone)]
pub(crate) struct FlowField {
    pub id: String,
    pub evidence_id: String,
    pub value: Option<String>,
    pub label: String,
}

#[derive(Clone)]
pub(crate) struct FlowNode {
    pub id: String,
    pub evidence_id: String,
}

#[derive(Clone, Default)]
pub(crate) struct FlowMessage {
    pub request_message: Option<FlowNode>,
    pub response_message: Option<FlowNode>,
    pub fields: Vec<FlowField>,
}

fn input_fields(
    target_id: &str,
    events: &[RawEvent],
    current: &Surface,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) -> Vec<FlowField> {
    let mut fields = vec![];
    for event in events
        .iter()
        .filter(|event| event.event_type == RawEventType::SurfaceTextInput)
    {
        let Some(value) = event.payload.get("value").and_then(Value::as_str) else {
            continue;
        };
        let label = event
            .subject
            .as_ref()
            .and_then(|subject| subject.label.clone())
            .unwrap_or_else(|| "Text input".into());
        let (id, evidence_id) = add_field(
            target_id,
            event.timestamp,
            &format!("input:{}:{}", event.event_id, label),
            &format!("{label} value"),
            json_map([
                ("fieldKind", json!("input_value")),
                ("valuePreview", json!(value)),
            ]),
            event.evidence_ids.clone(),
            nodes,
            evidence,
        );
        if let Some(view_id) = event
            .subject
            .as_ref()
            .and_then(|subject| current.raw_to_view.get(&subject.raw_id))
        {
            edges.push(edge(
                view_id,
                &id,
                AOMEdgeType::Writes,
                vec![evidence_id.clone()],
                0.9,
            ));
        }
        fields.push(FlowField {
            id,
            evidence_id,
            value: Some(value.into()),
            label,
        });
    }
    fields
}
