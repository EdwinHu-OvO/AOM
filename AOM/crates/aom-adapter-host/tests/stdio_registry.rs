use aom_adapter_host::{AdapterHost, AnalyzerProcessConfig, AnalyzerRegistry};
use aom_protocol_rs::{RawAction, RawActionType};
use aom_protocol_rs::{TargetDescriptor, TargetPlatform};
use std::collections::BTreeMap;
use std::{
    fs,
    path::PathBuf,
    time::{SystemTime, UNIX_EPOCH},
};

#[test]
fn registry_routes_generic_web_and_attaches_stdio_adapter() {
    let fixture = TempFixture::new();
    fs::write(fixture.root.join("index.html"), "<html></html>").unwrap();
    fs::write(fixture.root.join("app.js"), "fetch('/api/test')").unwrap();
    let script = fake_analyzer_script();
    let registry = AnalyzerRegistry::new(AnalyzerProcessConfig {
        program: PathBuf::from("node"),
        args: vec!["-e".to_string(), script],
    });
    let mut host = AdapterHost::default();
    let target = TargetDescriptor {
        target_id: "target:registry-web".to_string(),
        platform: TargetPlatform::Web,
        app_name: Some("Registry Web".to_string()),
        package_name: None,
        process_name: None,
        connection: None,
        security_profile: None,
    };

    registry
        .connect_target(
            &mut host,
            target,
            Some(fixture.root.display().to_string()),
            None,
        )
        .unwrap();
    let snapshot = host.collect_static_snapshot("target:registry-web").unwrap();

    assert_eq!(snapshot.adapter_id, "adapter:web-artifact");
    assert!(host.evidence.get("evidence:fake-static").is_some());
}

#[test]
fn registry_falls_back_to_generic_adapter_for_unknown_files() {
    let fixture = TempFixture::new();
    let binary = fixture.root.join("unknown.bin");
    fs::write(&binary, [0_u8, 1, 2, 3]).unwrap();
    let registry = AnalyzerRegistry::new(AnalyzerProcessConfig {
        program: PathBuf::from("node"),
        args: vec!["-e".to_string(), fake_analyzer_script()],
    });
    let mut host = AdapterHost::default();
    let target = TargetDescriptor {
        target_id: "target:registry-unknown".to_string(),
        platform: TargetPlatform::DebugMock,
        app_name: None,
        package_name: None,
        process_name: None,
        connection: None,
        security_profile: None,
    };
    registry
        .connect_target(&mut host, target, Some(binary.display().to_string()), None)
        .unwrap();

    let snapshot = host
        .collect_static_snapshot("target:registry-unknown")
        .unwrap();
    assert_eq!(snapshot.adapter_id, "adapter:generic-artifact");
}

#[test]
fn stdio_runtime_proxy_routes_snapshot_events_and_actions() {
    let fixture = TempFixture::new();
    fs::write(fixture.root.join("index.html"), "<html></html>").unwrap();
    let registry = AnalyzerRegistry::new(AnalyzerProcessConfig {
        program: PathBuf::from("node"),
        args: vec!["-e".to_string(), fake_analyzer_script()],
    });
    let mut host = AdapterHost::default();
    let target = TargetDescriptor {
        target_id: "target:registry-runtime".to_string(),
        platform: TargetPlatform::Electron,
        app_name: Some("Registry Runtime".to_string()),
        package_name: None,
        process_name: None,
        connection: None,
        security_profile: None,
    };
    registry
        .connect_target(
            &mut host,
            target,
            Some(fixture.root.display().to_string()),
            Some("fake-electron".to_string()),
        )
        .unwrap();

    let snapshot = host
        .collect_runtime_snapshot("target:registry-runtime")
        .unwrap();
    let events = host.poll_events("target:registry-runtime").unwrap();
    let result = host
        .execute_action(&RawAction {
            action_id: "action:stdio".to_string(),
            target_id: "target:registry-runtime".to_string(),
            action_type: RawActionType::Scroll,
            target_raw_id: None,
            params: BTreeMap::new(),
        })
        .unwrap();

    assert_eq!(snapshot.nodes.len(), 1);
    assert_eq!(events.len(), 1);
    assert!(result.ok);
    assert!(host.evidence.get("evidence:fake-runtime").is_some());
    assert!(host.evidence.get("evidence:fake-action").is_some());
}

fn fake_analyzer_script() -> String {
    r#"
const readline = require("node:readline");
const rl = readline.createInterface({ input: process.stdin });
let adapterId = "adapter:generic-artifact";
rl.on("line", (line) => {
  const command = JSON.parse(line);
  if (command.commandType === "initialize") {
    adapterId = command.data.adapterId;
    console.log(JSON.stringify({ replyType: "ready", data: {
      adapterId,
      probeId: command.data.executablePath ? "probe:fake" : undefined,
      evidence: []
    }}));
  } else if (command.commandType === "collect_static") {
    console.log(JSON.stringify({ replyType: "static_snapshot", data: {
      value: {
        snapshotId: "snapshot:fake",
        targetId: "target:registry-web",
        platform: "web",
        timestamp: 1,
        adapterId,
        artifacts: [],
        nodes: [],
        edges: [],
        evidenceIds: ["evidence:fake-static"]
      },
      evidence: [{
        evidenceId: "evidence:fake-static",
        sourceEventId: "analyzer:collect_static",
        toolName: "fake-analyzer",
        toolVersion: "1",
        sourceLocator: "fixture",
        metadata: {}
      }]
    }}));
  } else if (command.commandType === "collect_runtime") {
    console.log(JSON.stringify({ replyType: "runtime_snapshot", data: {
      value: {
        snapshotId: "snapshot:runtime",
        targetId: "target:registry-runtime",
        platform: "electron",
        timestamp: 2,
        nodes: [{
          rawId: "dom:#root",
          kind: "dom_element",
          attributes: {},
          children: []
        }],
        evidenceIds: ["evidence:fake-runtime"]
      },
      evidence: [{
        evidenceId: "evidence:fake-runtime",
        sourceEventId: "analyzer:collect_runtime",
        toolName: "fake-runtime",
        toolVersion: "1",
        sourceLocator: "fixture",
        metadata: {}
      }]
    }}));
  } else if (command.commandType === "drain_events") {
    console.log(JSON.stringify({ replyType: "events", data: {
      value: [{
        eventId: "event:fake:1",
        targetId: "target:registry-runtime",
        platform: "electron",
        timestamp: 3,
        sequence: 1,
        type: "state_change",
        source: {
          adapterId: "adapter:electron",
          probeId: "probe:fake",
          sourceType: "dynamic"
        },
        payload: {},
        evidenceIds: ["evidence:fake-runtime"]
      }],
      evidence: []
    }}));
  } else if (command.commandType === "execute_action") {
    console.log(JSON.stringify({ replyType: "action_result", data: {
      value: {
        actionId: command.data.actionId,
        targetId: command.data.targetId,
        ok: true,
        evidenceIds: ["evidence:fake-action"]
      },
      evidence: [{
        evidenceId: "evidence:fake-action",
        sourceEventId: "analyzer:execute_action",
        toolName: "fake-runtime",
        toolVersion: "1",
        sourceLocator: "fixture",
        metadata: {}
      }]
    }}));
  } else if (command.commandType === "shutdown") {
    console.log(JSON.stringify({ replyType: "ack", data: {
      value: true,
      evidence: []
    }}));
    process.exit(0);
  }
});
"#
    .to_string()
}

struct TempFixture {
    root: PathBuf,
}

impl TempFixture {
    fn new() -> Self {
        let nonce = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!("aom-registry-{nonce}"));
        fs::create_dir_all(&root).unwrap();
        Self { root }
    }
}

impl Drop for TempFixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}
