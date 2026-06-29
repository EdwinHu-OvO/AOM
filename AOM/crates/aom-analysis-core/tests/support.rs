#[path = "support_events.rs"]
mod support_events;

use aom_analysis_core::AnalysisInput;
use aom_protocol_rs::{
    RawArtifactDescriptor, RawRuntimeNode, RawRuntimeSnapshot, RawStaticNode, RawStaticSnapshot,
};
use serde_json::json;
use std::collections::BTreeMap;
use support_events::events;

pub fn input(raw_button_id: &str, after: Option<RawRuntimeSnapshot>) -> AnalysisInput {
    AnalysisInput {
        target_id: "target:test".into(),
        static_snapshot: static_snapshot(),
        before: before_snapshot(raw_button_id),
        events: after.as_ref().map_or_else(Vec::new, |_| events()),
        after,
        analyzer_evidence: vec![],
    }
}

pub fn runtime_input(nodes: Vec<RawRuntimeNode>) -> AnalysisInput {
    AnalysisInput {
        target_id: "target:test".into(),
        static_snapshot: static_snapshot(),
        before: runtime_snapshot(2, nodes),
        events: vec![],
        after: None,
        analyzer_evidence: vec![],
    }
}

pub fn node(raw_id: &str, role: Option<&str>, label: Option<&str>) -> RawRuntimeNode {
    runtime_node(raw_id, role, label, "a", None)
}

fn static_snapshot() -> RawStaticSnapshot {
    RawStaticSnapshot {
        snapshot_id: "static:1".into(),
        target_id: "target:test".into(),
        platform: "electron".into(),
        timestamp: 1,
        adapter_id: "adapter:electron-artifact".into(),
        artifacts: vec![RawArtifactDescriptor {
            artifact_id: "artifact:app".into(),
            kind: "application_bundle".into(),
            locator: "Test.app".into(),
            format: None,
            digest: None,
            metadata: BTreeMap::new(),
        }],
        nodes: vec![RawStaticNode {
            raw_id: "static:endpoint:login".into(),
            kind: "api_endpoint".into(),
            label: Some("/api/login".into()),
            artifact_id: "artifact:app".into(),
            artifact_offset: None,
            attributes: BTreeMap::new(),
            evidence_ids: vec!["evidence:static:login".into()],
        }],
        edges: vec![],
        evidence_ids: vec!["evidence:static".into()],
    }
}

fn before_snapshot(button_id: &str) -> RawRuntimeSnapshot {
    runtime_snapshot(
        2,
        vec![
            runtime_node("dom:brand", None, Some("PlateRun"), "span", None),
            runtime_node(
                "dom:phone",
                Some("input"),
                Some("Phone number"),
                "input",
                Some("text"),
            ),
            runtime_node(
                "dom:password",
                Some("input"),
                Some("Password"),
                "input",
                Some("password"),
            ),
            runtime_node(
                button_id,
                Some("button"),
                Some("Sign in"),
                "button",
                Some("submit"),
            ),
        ],
    )
}

pub fn after_snapshot() -> RawRuntimeSnapshot {
    runtime_snapshot(
        3,
        vec![
            runtime_node("dom:brand2", None, Some("PlateRun"), "span", None),
            runtime_node("dom:restaurants", None, Some("Restaurants"), "h2", None),
            runtime_node(
                "dom:html > body > main > header > div > span",
                None,
                Some("Mina Chen"),
                "span",
                None,
            ),
            runtime_node(
                "dom:html > body > main > section > section > h1",
                None,
                Some("Tokyo Ramen Lab"),
                "h1",
                None,
            ),
            runtime_node(
                "dom:html > body > main > section > strong",
                None,
                Some("3 items"),
                "strong",
                None,
            ),
            runtime_node(
                "dom:html > body > main > section > article:nth-of-type(1) > strong",
                None,
                Some("Tonkotsu Ramen"),
                "strong",
                None,
            ),
            runtime_node(
                "dom:html > body > main > section > article:nth-of-type(1) > p",
                None,
                Some("Pork broth"),
                "p",
                None,
            ),
            runtime_node(
                "dom:html > body > main > section > article:nth-of-type(1) > b",
                None,
                Some("$13.80"),
                "b",
                None,
            ),
            runtime_node(
                "dom:html > body > main > section > article:nth-of-type(1) > button",
                Some("button"),
                Some("Add Tonkotsu Ramen"),
                "button",
                Some("submit"),
            ),
            runtime_node(
                "dom:html > body > main > button",
                Some("button"),
                Some("Open cart"),
                "button",
                Some("submit"),
            ),
            runtime_node(
                "dom:html > body > main > button > span",
                None,
                Some("0"),
                "span",
                None,
            ),
            runtime_node(
                "dom:html > body > main > button > strong",
                None,
                Some("$0.00"),
                "strong",
                None,
            ),
            runtime_node(
                "dom:search",
                Some("input"),
                Some("Search food or restaurants"),
                "input",
                Some("text"),
            ),
        ],
    )
}

fn runtime_snapshot(timestamp: u64, nodes: Vec<RawRuntimeNode>) -> RawRuntimeSnapshot {
    RawRuntimeSnapshot {
        snapshot_id: format!("runtime:{timestamp}"),
        target_id: "target:test".into(),
        platform: "electron".into(),
        timestamp,
        nodes,
        evidence_ids: vec![format!("evidence:runtime:{timestamp}")],
    }
}

fn runtime_node(
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
