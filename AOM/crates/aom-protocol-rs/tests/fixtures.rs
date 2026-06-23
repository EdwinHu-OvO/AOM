use aom_protocol_rs::{
    AOMCapability, AOMEdge, AOMEdgeType, AOMNode, AOMNodeType, CapabilityRiskLevel,
    GatewayDecision, GatewayDecisionKind, GatewayRequest, PermissionLevel, ProtocolMessage,
    ProtocolMessageKind, ProtocolPayload, RawAction, RawActionResult, RawActionType, RawEvent,
    RawEventType, RawRuntimeSnapshot,
};
use std::collections::BTreeMap;

fn fixture(name: &str) -> String {
    let path = format!("{}/../../tests/fixtures/{name}", env!("CARGO_MANIFEST_DIR"));
    std::fs::read_to_string(path).expect("fixture should be readable")
}

#[test]
fn raw_event_fixture_deserializes() {
    let event: RawEvent =
        serde_json::from_str(&fixture("raw-event.json")).expect("raw event fixture should parse");

    assert_eq!(event.event_type, RawEventType::SurfaceClick);
    assert_eq!(event.target_id, "target:platerun-electron");
    assert_eq!(event.evidence_ids, vec!["evidence:raw-click-001"]);
}

#[test]
fn gateway_request_fixture_deserializes() {
    let request: GatewayRequest = serde_json::from_str(&fixture("gateway-request.json"))
        .expect("gateway request fixture should parse");

    assert_eq!(request.method, "aom.invoke");
    assert_eq!(request.params["capabilityId"], "capability:search_product");
}

#[test]
fn permission_level_round_trips_as_snake_case() {
    let encoded = serde_json::to_string(&PermissionLevel::SafeAction).unwrap();
    assert_eq!(encoded, "\"safe_action\"");
    let decoded: PermissionLevel = serde_json::from_str(&encoded).unwrap();
    assert_eq!(decoded, PermissionLevel::SafeAction);
}

#[test]
fn protocol_message_wraps_gateway_request_without_transport_details() {
    let request: GatewayRequest = serde_json::from_str(&fixture("gateway-request.json")).unwrap();
    let message = ProtocolMessage {
        message_id: "message:001".to_string(),
        kind: ProtocolMessageKind::Request,
        correlation_id: None,
        payload: ProtocolPayload::GatewayRequest(request),
    };

    let encoded = serde_json::to_string(&message).unwrap();
    assert!(encoded.contains("\"payloadType\":\"gateway_request\""));
}

#[test]
fn protocol_payload_covers_phase_zero_objects() {
    let payloads = vec![
        ProtocolPayload::RawRuntimeSnapshot(RawRuntimeSnapshot {
            snapshot_id: "snapshot:001".to_string(),
            target_id: "target:platerun-electron".to_string(),
            platform: "electron".to_string(),
            timestamp: 1,
            nodes: vec![],
            evidence_ids: vec![],
        }),
        ProtocolPayload::RawAction(RawAction {
            action_id: "action:001".to_string(),
            target_id: "target:platerun-electron".to_string(),
            action_type: RawActionType::Click,
            target_raw_id: Some("raw:view:search-button".to_string()),
            params: BTreeMap::new(),
        }),
        ProtocolPayload::RawActionResult(RawActionResult {
            action_id: "action:001".to_string(),
            target_id: "target:platerun-electron".to_string(),
            ok: true,
            error_code: None,
            message: None,
            evidence_ids: vec![],
        }),
        ProtocolPayload::AomNode(AOMNode {
            id: "view:search-button".to_string(),
            node_type: AOMNodeType::View,
            label: Some("Search".to_string()),
            features: BTreeMap::new(),
            evidence_ids: vec![],
            confidence: 0.9,
        }),
        ProtocolPayload::AomEdge(AOMEdge {
            id: "edge:search-button-triggers-api".to_string(),
            from: "view:search-button".to_string(),
            to: "api:search".to_string(),
            edge_type: AOMEdgeType::Triggers,
            confidence: 0.8,
            evidence_ids: vec![],
        }),
        ProtocolPayload::AomCapability(AOMCapability {
            id: "capability:search_product".to_string(),
            name: "search_product".to_string(),
            description: "Search products by keyword".to_string(),
            input_slots: vec![],
            action_summary: vec![],
            expected_effects: vec![],
            risk_level: CapabilityRiskLevel::Low,
            confidence: 0.8,
            evidence_ids: vec![],
        }),
        ProtocolPayload::GatewayDecision(GatewayDecision {
            request_id: "request:001".to_string(),
            decision: GatewayDecisionKind::Allow,
            reason: "read-only request".to_string(),
            effective_params: None,
            audit_id: "audit:001".to_string(),
        }),
    ];

    for payload in payloads {
        let message = ProtocolMessage {
            message_id: "message:phase-zero".to_string(),
            kind: ProtocolMessageKind::Event,
            correlation_id: None,
            payload,
        };
        let encoded = serde_json::to_string(&message).unwrap();
        let decoded: ProtocolMessage = serde_json::from_str(&encoded).unwrap();
        assert_eq!(decoded.message_id, "message:phase-zero");
    }
}
