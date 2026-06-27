use aom_protocol_rs::{RawEvent, RawEventSource, RawEventType};
use serde_json::json;
use std::collections::BTreeMap;

pub fn events() -> Vec<RawEvent> {
    vec![
        network_event(
            3,
            RawEventType::NetworkResponse,
            json!({"requestId":"addresses","url":"http://127.0.0.1/api/addresses","status":200}),
        ),
        network_event(
            1,
            RawEventType::NetworkRequest,
            json!({"requestId":"login","url":"http://127.0.0.1/api/login","method":"POST"}),
        ),
        network_event(
            2,
            RawEventType::NetworkResponse,
            json!({"requestId":"login","url":"http://127.0.0.1/api/login","status":200}),
        ),
    ]
}

fn network_event(sequence: u64, event_type: RawEventType, metadata: serde_json::Value) -> RawEvent {
    RawEvent {
        event_id: format!("event:{sequence}"),
        target_id: "target:test".into(),
        platform: "electron".into(),
        timestamp: sequence + 3,
        sequence,
        event_type,
        source: RawEventSource {
            adapter_id: "adapter:electron".into(),
            probe_id: "probe:electron".into(),
            source_type: "dynamic".into(),
        },
        subject: None,
        object: None,
        payload: BTreeMap::from([("metadata".into(), metadata)]),
        evidence_ids: vec![format!("evidence:event:{sequence}")],
    }
}
