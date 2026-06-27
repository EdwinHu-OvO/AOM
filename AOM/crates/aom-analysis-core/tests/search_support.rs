use aom_analysis_core::AnalysisInput;
use aom_protocol_rs::{
    RawArtifactDescriptor, RawEvent, RawEventSource, RawEventType, RawRef, RawRuntimeNode,
    RawRuntimeSnapshot, RawStaticNode, RawStaticSnapshot,
};
use serde_json::json;
use std::collections::BTreeMap;

pub fn search_input() -> AnalysisInput {
    AnalysisInput {
        target_id: "target:search".into(),
        static_snapshot: static_snapshot(),
        before: snapshot(10, "4 open now", "Tokyo Ramen Lab"),
        events: events(),
        after: Some(snapshot(20, "1 open now", "Tokyo Ramen Lab")),
        analyzer_evidence: vec![],
    }
}

fn static_snapshot() -> RawStaticSnapshot {
    RawStaticSnapshot {
        snapshot_id: "static:search".into(),
        target_id: "target:search".into(),
        platform: "electron".into(),
        timestamp: 1,
        adapter_id: "adapter:electron-artifact".into(),
        artifacts: vec![RawArtifactDescriptor {
            artifact_id: "artifact:app".into(),
            kind: "application_bundle".into(),
            locator: "Search.app".into(),
            format: None,
            digest: None,
            metadata: BTreeMap::new(),
        }],
        nodes: vec![RawStaticNode {
            raw_id: "static:endpoint:stores".into(),
            kind: "api_endpoint".into(),
            label: Some("/api/stores".into()),
            artifact_id: "artifact:app".into(),
            artifact_offset: None,
            attributes: BTreeMap::new(),
            evidence_ids: vec!["evidence:static:stores".into()],
        }],
        edges: vec![],
        evidence_ids: vec!["evidence:static".into()],
    }
}

fn snapshot(timestamp: u64, count: &str, store: &str) -> RawRuntimeSnapshot {
    RawRuntimeSnapshot {
        snapshot_id: format!("runtime:{timestamp}"),
        target_id: "target:search".into(),
        platform: "electron".into(),
        timestamp,
        nodes: vec![
            node("dom:title", None, Some("Restaurants"), "h2", None),
            node(
                "dom:search",
                Some("input"),
                Some("Search food or restaurants"),
                "input",
                Some("text"),
            ),
            node("dom:count", None, Some(count), "strong", None),
            node(
                "dom:store",
                Some("button"),
                Some(store),
                "button",
                Some("submit"),
            ),
        ],
        evidence_ids: vec![format!("evidence:runtime:{timestamp}")],
    }
}

fn node(
    raw_id: &str,
    role: Option<&str>,
    label: Option<&str>,
    tag: &str,
    input_type: Option<&str>,
) -> RawRuntimeNode {
    let mut attributes = BTreeMap::from([("tagName".into(), json!(tag))]);
    if let Some(input_type) = input_type {
        attributes.insert("inputType".into(), json!(input_type));
    }
    RawRuntimeNode {
        raw_id: raw_id.into(),
        kind: "dom_element".into(),
        role: role.map(str::to_string),
        label: label.map(str::to_string),
        value: None,
        attributes,
        children: vec![],
    }
}

fn events() -> Vec<RawEvent> {
    vec![
        event(
            1,
            RawEventType::SurfaceTextInput,
            Some("dom:search"),
            BTreeMap::from([("value".into(), json!("ramen"))]),
        ),
        event(
            2,
            RawEventType::NetworkRequest,
            None,
            BTreeMap::from([(
                "metadata".into(),
                json!({
                    "requestId": "search",
                    "url": "http://127.0.0.1/api/stores?search=ramen",
                    "method": "GET"
                }),
            )]),
        ),
        event(
            3,
            RawEventType::NetworkResponse,
            None,
            BTreeMap::from([(
                "metadata".into(),
                json!({
                    "requestId": "search",
                    "url": "http://127.0.0.1/api/stores?search=ramen",
                    "status": 200
                }),
            )]),
        ),
        event(
            4,
            RawEventType::StateChange,
            None,
            BTreeMap::from([("mutationCount".into(), json!(3))]),
        ),
    ]
}

fn event(
    sequence: u64,
    event_type: RawEventType,
    subject: Option<&str>,
    payload: BTreeMap<String, serde_json::Value>,
) -> RawEvent {
    RawEvent {
        event_id: format!("event:search:{sequence}"),
        target_id: "target:search".into(),
        platform: "electron".into(),
        timestamp: 30 + sequence,
        sequence,
        event_type,
        source: RawEventSource {
            adapter_id: "adapter:electron".into(),
            probe_id: "probe:electron".into(),
            source_type: "dynamic".into(),
        },
        subject: subject.map(|raw_id| RawRef {
            raw_id: raw_id.into(),
            kind: Some("dom_element".into()),
            label: Some("Search food or restaurants".into()),
        }),
        object: None,
        payload,
        evidence_ids: vec![format!("evidence:event:search:{sequence}")],
    }
}
