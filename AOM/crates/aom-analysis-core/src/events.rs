use crate::{
    edge, endpoint_observation, event_features, event_label, node, stable_id, EvidenceManager,
    Surface,
};
use aom_protocol_rs::{AOMEdge, AOMEdgeType, AOMNode, AOMNodeType, RawEvent, RawEventType};
use serde_json::Value;
use std::collections::BTreeMap;

#[allow(clippy::too_many_arguments)]
pub(crate) fn add_events(
    target_id: &str,
    events: &[RawEvent],
    before: &Surface,
    current: &Surface,
    app_id: &str,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) {
    let mut previous_event: Option<String> = None;
    let mut requests = BTreeMap::new();
    for raw in events {
        let event_id = stable_id(target_id, &AOMNodeType::Event, &raw.event_id);
        let evidence_id = evidence.observed(
            target_id,
            raw.timestamp,
            format!("Runtime event observed: {:?}", raw.event_type),
            raw.evidence_ids.clone(),
        );
        nodes.push(node(
            event_id.clone(),
            AOMNodeType::Event,
            Some(event_label(raw)),
            event_features(raw),
            vec![evidence_id.clone()],
            1.0,
        ));
        edges.push(edge(
            app_id,
            &event_id,
            AOMEdgeType::Contains,
            vec![evidence_id.clone()],
            1.0,
        ));
        link_subject(raw, before, current, &event_id, &evidence_id, edges);
        link_endpoint(target_id, raw, &event_id, &evidence_id, nodes, edges);
        link_request_response(raw, &event_id, &evidence_id, &mut requests, edges);
        if matches!(raw.event_type, RawEventType::StateChange) {
            edges.push(edge(
                &event_id,
                &current.screen.id,
                AOMEdgeType::HasEffect,
                vec![evidence_id.clone()],
                0.75,
            ));
        }
        if let Some(previous) = &previous_event {
            edges.push(edge(
                previous,
                &event_id,
                AOMEdgeType::ObservedBefore,
                vec![evidence_id],
                1.0,
            ));
        }
        previous_event = Some(event_id);
    }
}

fn link_request_response(
    raw: &RawEvent,
    event_id: &str,
    evidence_id: &str,
    requests: &mut BTreeMap<String, String>,
    edges: &mut Vec<AOMEdge>,
) {
    let Some(request_id) = raw
        .payload
        .get("metadata")
        .and_then(Value::as_object)
        .and_then(|metadata| metadata.get("requestId"))
        .and_then(Value::as_str)
    else {
        return;
    };
    match raw.event_type {
        RawEventType::NetworkRequest => {
            requests.insert(request_id.to_string(), event_id.to_string());
        }
        RawEventType::NetworkResponse => {
            if let Some(request_event) = requests.get(request_id) {
                edges.push(edge(
                    request_event,
                    event_id,
                    AOMEdgeType::HasEffect,
                    vec![evidence_id.to_string()],
                    1.0,
                ));
            }
        }
        _ => {}
    }
}

fn link_subject(
    raw: &RawEvent,
    before: &Surface,
    current: &Surface,
    event_id: &str,
    evidence_id: &str,
    edges: &mut Vec<AOMEdge>,
) {
    let Some(subject) = &raw.subject else { return };
    let Some(view_id) = before
        .raw_to_view
        .get(&subject.raw_id)
        .or_else(|| current.raw_to_view.get(&subject.raw_id))
    else {
        return;
    };
    edges.push(edge(
        view_id,
        event_id,
        AOMEdgeType::Triggers,
        vec![evidence_id.to_string()],
        0.95,
    ));
}

fn link_endpoint(
    target_id: &str,
    raw: &RawEvent,
    event_id: &str,
    evidence_id: &str,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
) {
    let Some(endpoint) = endpoint_observation(raw) else {
        return;
    };
    let endpoint_id = stable_id(target_id, &AOMNodeType::ApiEndpoint, &endpoint.path);
    nodes.push(node(
        endpoint_id.clone(),
        AOMNodeType::ApiEndpoint,
        Some(endpoint.path),
        endpoint
            .features
            .into_iter()
            .chain([("runtimeObserved".into(), Value::Bool(true))])
            .collect(),
        vec![evidence_id.to_string()],
        1.0,
    ));
    edges.push(edge(
        event_id,
        &endpoint_id,
        AOMEdgeType::Requests,
        vec![evidence_id.to_string()],
        1.0,
    ));
}
