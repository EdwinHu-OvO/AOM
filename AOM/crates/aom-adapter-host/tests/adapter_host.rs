use aom_adapter_host::{
    AdapterError, AdapterHost, AdapterResult, RuntimeProbe, StaticAnalysisAdapter,
};
use aom_protocol_rs::{
    RawAction, RawActionResult, RawEvent, RawEventSource, RawEventType, RawRuntimeSnapshot,
    RawStaticSnapshot, TargetConnection, TargetDescriptor, TargetPlatform,
};
use std::collections::BTreeMap;

struct FakeProbe {
    target_id: String,
    events: Vec<RawEvent>,
}

impl StaticAnalysisAdapter for FakeProbe {
    fn adapter_id(&self) -> &str {
        "adapter:fake-electron"
    }

    fn target_id(&self) -> &str {
        &self.target_id
    }

    fn collect_static_snapshot(&mut self) -> AdapterResult<RawStaticSnapshot> {
        Ok(RawStaticSnapshot {
            snapshot_id: "snapshot:static:001".to_string(),
            target_id: self.target_id.clone(),
            platform: "electron".to_string(),
            timestamp: 1,
            adapter_id: "adapter:fake-static".to_string(),
            artifacts: vec![],
            nodes: vec![],
            edges: vec![],
            evidence_ids: vec!["evidence:static:001".to_string()],
        })
    }
}

impl RuntimeProbe for FakeProbe {
    fn probe_id(&self) -> &str {
        "probe:fake-electron"
    }

    fn target_id(&self) -> &str {
        &self.target_id
    }

    fn collect_runtime_snapshot(&mut self) -> AdapterResult<RawRuntimeSnapshot> {
        Ok(RawRuntimeSnapshot {
            snapshot_id: "snapshot:runtime:001".to_string(),
            target_id: self.target_id.clone(),
            platform: "electron".to_string(),
            timestamp: 2,
            nodes: vec![],
            evidence_ids: vec!["evidence:runtime:001".to_string()],
        })
    }

    fn drain_events(&mut self) -> AdapterResult<Vec<RawEvent>> {
        Ok(self.events.drain(..).collect())
    }

    fn execute_action(&mut self, action: &RawAction) -> AdapterResult<RawActionResult> {
        Ok(RawActionResult {
            action_id: action.action_id.clone(),
            target_id: action.target_id.clone(),
            ok: true,
            error_code: None,
            message: None,
            evidence_ids: vec!["evidence:action:001".to_string()],
        })
    }
}

fn target() -> TargetDescriptor {
    TargetDescriptor {
        target_id: "target:platerun-electron".to_string(),
        platform: TargetPlatform::Electron,
        app_name: Some("PlateRun".to_string()),
        package_name: None,
        process_name: Some("Electron".to_string()),
        connection: Some(TargetConnection {
            cdp_url: Some("http://127.0.0.1:9222".to_string()),
            ..TargetConnection::default()
        }),
        security_profile: Some("local-development".to_string()),
    }
}

fn event_for(target_id: &str, sequence: u64) -> RawEvent {
    RawEvent {
        event_id: format!("event:{sequence}"),
        target_id: target_id.to_string(),
        platform: "electron".to_string(),
        timestamp: sequence,
        sequence,
        event_type: RawEventType::SurfaceClick,
        source: RawEventSource {
            adapter_id: "adapter:host".to_string(),
            probe_id: "probe:fake-electron".to_string(),
            source_type: "dynamic".to_string(),
        },
        subject: None,
        object: None,
        payload: BTreeMap::new(),
        evidence_ids: vec![format!("evidence:event:{sequence}")],
    }
}

fn event(sequence: u64) -> RawEvent {
    event_for("target:platerun-electron", sequence)
}

#[test]
fn adapter_host_routes_snapshots_events_and_actions() {
    let mut host = AdapterHost::default();
    host.register_target(target()).unwrap();
    host.attach_static_adapter(Box::new(FakeProbe {
        target_id: "target:platerun-electron".to_string(),
        events: vec![],
    }))
    .unwrap();
    host.attach_runtime_probe(Box::new(FakeProbe {
        target_id: "target:platerun-electron".to_string(),
        events: vec![event(1), event(2)],
    }))
    .unwrap();

    let static_snapshot = host
        .collect_static_snapshot("target:platerun-electron")
        .unwrap();
    let runtime_snapshot = host
        .collect_runtime_snapshot("target:platerun-electron")
        .unwrap();
    let events = host.poll_events("target:platerun-electron").unwrap();
    let action = RawAction {
        action_id: "action:001".to_string(),
        target_id: "target:platerun-electron".to_string(),
        action_type: aom_protocol_rs::RawActionType::Click,
        target_raw_id: Some("dom:#checkout".to_string()),
        params: BTreeMap::new(),
    };
    let result = host.execute_action(&action).unwrap();

    assert_eq!(static_snapshot.adapter_id, "adapter:fake-static");
    assert_eq!(runtime_snapshot.platform, "electron");
    assert_eq!(events.len(), 2);
    assert!(result.ok);
}

#[test]
fn event_bus_rejects_non_monotonic_probe_sequences() {
    let mut host = AdapterHost::default();
    host.register_target(target()).unwrap();
    host.attach_runtime_probe(Box::new(FakeProbe {
        target_id: "target:platerun-electron".to_string(),
        events: vec![event(2), event(1)],
    }))
    .unwrap();

    let error = host.poll_events("target:platerun-electron").unwrap_err();
    assert!(matches!(error, AdapterError::InvalidSequence { .. }));
    assert!(host.events.is_empty());
}

#[test]
fn event_bus_commits_batches_atomically_and_drains_by_target() {
    let mut bus = aom_adapter_host::RawEventBus::default();
    bus.publish(event_for("target:one", 1)).unwrap();
    bus.publish(event_for("target:two", 1)).unwrap();

    let error = bus
        .publish_batch(vec![event_for("target:one", 2), event_for("target:one", 1)])
        .unwrap_err();

    assert!(matches!(error, AdapterError::InvalidSequence { .. }));
    assert_eq!(bus.drain_target("target:one").len(), 1);
    assert_eq!(bus.drain_target("target:two").len(), 1);
}
