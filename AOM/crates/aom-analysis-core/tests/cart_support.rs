use aom_analysis_core::AnalysisInput;
use aom_protocol_rs::{
    RawEvent, RawEventSource, RawEventType, RawRef, RawRuntimeNode, RawRuntimeSnapshot,
    RawStaticSnapshot,
};
use serde_json::json;
use std::collections::BTreeMap;

pub fn add_to_cart_input() -> AnalysisInput {
    AnalysisInput {
        target_id: "target:cart".into(),
        static_snapshot: RawStaticSnapshot {
            snapshot_id: "static:cart".into(),
            target_id: "target:cart".into(),
            platform: "electron".into(),
            timestamp: 1,
            adapter_id: "adapter:electron-artifact".into(),
            artifacts: vec![],
            nodes: vec![],
            edges: vec![],
            evidence_ids: vec![],
        },
        before: snapshot(10, "0", "$0.00"),
        events: events(),
        after: Some(snapshot(20, "1", "$17.80")),
        analyzer_evidence: vec![],
    }
}

fn snapshot(timestamp: u64, count: &str, subtotal: &str) -> RawRuntimeSnapshot {
    RawRuntimeSnapshot {
        snapshot_id: format!("runtime:{timestamp}"),
        target_id: "target:cart".into(),
        platform: "electron".into(),
        timestamp,
        nodes: vec![
            node("dom:title", None, Some("Restaurants"), "h2", None),
            node("dom:store", None, Some("Tokyo Ramen Lab"), "h1", None),
            node(
                "dom:html > body > main > section > article:nth-of-type(1) > strong",
                None,
                Some("Tonkotsu Ramen"),
                "strong",
                None,
            ),
            node(
                "dom:html > body > main > section > article:nth-of-type(1) > b",
                None,
                Some("$13.80"),
                "b",
                None,
            ),
            node(
                "dom:add",
                Some("button"),
                Some("Add Tonkotsu Ramen"),
                "button",
                Some("submit"),
            ),
            node(
                "dom:html > body > main > button",
                Some("button"),
                Some("Open cart"),
                "button",
                Some("submit"),
            ),
            node(
                "dom:html > body > main > button > span",
                None,
                Some(count),
                "span",
                None,
            ),
            node(
                "dom:html > body > main > button > strong",
                None,
                Some(subtotal),
                "strong",
                None,
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
            RawEventType::SurfaceClick,
            Some("dom:add"),
            BTreeMap::new(),
        ),
        event(
            2,
            RawEventType::StateChange,
            None,
            BTreeMap::from([("mutationCount".into(), json!(2))]),
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
        event_id: format!("event:cart:{sequence}"),
        target_id: "target:cart".into(),
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
            label: Some("Add Tonkotsu Ramen".into()),
        }),
        object: None,
        payload,
        evidence_ids: vec![format!("evidence:event:cart:{sequence}")],
    }
}
