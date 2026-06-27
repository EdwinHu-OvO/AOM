use aom_analysis_core::{AnalysisInput, AnalysisQuery};
use aom_analysis_server::AnalysisService;
use aom_capability::CapabilityAvailability;
use aom_protocol_rs::{
    AOMNodeType, CapabilityRiskLevel, RawRuntimeNode, RawRuntimeSnapshot, RawStaticSnapshot,
};
use serde_json::json;
use std::collections::BTreeMap;

#[test]
fn exposes_phase_two_service_api_surface() {
    let mut service = AnalysisService::ingest(input("Mina Chen"));

    assert!(!service.snapshot().nodes.is_empty());
    let capabilities = service.capabilities();
    let add_to_cart = capabilities
        .iter()
        .find(|item| item.capability.name == "add_to_cart")
        .unwrap();
    assert_eq!(add_to_cart.availability, CapabilityAvailability::Available);
    assert_eq!(add_to_cart.capability.risk_level, CapabilityRiskLevel::Low);
    assert!(add_to_cart.automation.can_auto_execute);
    assert!(add_to_cart
        .action_plan
        .iter()
        .any(|step| step.summary.contains("Click product add control")));
    assert!(!service
        .query(&AnalysisQuery {
            node_type: Some(AOMNodeType::Capability),
            text: Some("login".into()),
        })
        .is_empty());
    assert!(service.verify().verified);

    service.observe(input("Kai Ito"));
    assert!(!service
        .explain(&service.snapshot().current_screen_id)
        .is_empty());
    assert_eq!(
        service.context_pack().session.user_name.as_deref(),
        Some("Kai Ito")
    );
}

fn input(user: &str) -> AnalysisInput {
    AnalysisInput {
        target_id: "target:server".into(),
        static_snapshot: RawStaticSnapshot {
            snapshot_id: "static:server".into(),
            target_id: "target:server".into(),
            platform: "electron".into(),
            timestamp: 1,
            adapter_id: "adapter:electron-artifact".into(),
            artifacts: vec![],
            nodes: vec![],
            edges: vec![],
            evidence_ids: vec![],
        },
        before: snapshot(2, user),
        events: vec![],
        after: None,
        analyzer_evidence: vec![],
    }
}

fn snapshot(timestamp: u64, user: &str) -> RawRuntimeSnapshot {
    RawRuntimeSnapshot {
        snapshot_id: format!("runtime:{timestamp}"),
        target_id: "target:server".into(),
        platform: "electron".into(),
        timestamp,
        nodes: vec![
            node("dom:brand", None, Some("PlateRun"), "span"),
            node("dom:restaurants", None, Some("Restaurants"), "h2"),
            node("dom:header > span", None, Some(user), "span"),
            node("dom:cart", Some("button"), Some("Open cart"), "button"),
            node(
                "dom:add",
                Some("button"),
                Some("Add Tonkotsu Ramen"),
                "button",
            ),
        ],
        evidence_ids: vec![format!("evidence:runtime:{timestamp}")],
    }
}

fn node(raw_id: &str, role: Option<&str>, label: Option<&str>, tag: &str) -> RawRuntimeNode {
    RawRuntimeNode {
        raw_id: raw_id.into(),
        kind: "dom_element".into(),
        role: role.map(str::to_string),
        label: label.map(str::to_string),
        value: None,
        attributes: BTreeMap::from([("tagName".into(), json!(tag))]),
        children: vec![],
    }
}
