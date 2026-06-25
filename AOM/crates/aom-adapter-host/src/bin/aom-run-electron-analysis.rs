use aom_adapter_host::{AdapterHost, AnalyzerProcessConfig, AnalyzerRegistry};
use aom_protocol_rs::{TargetDescriptor, TargetPlatform};
use serde_json::json;
use std::{env, path::PathBuf};

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 3 {
        return Err(
            "usage: aom-run-electron-analysis <analyzer-js> <artifact> [executable]".into(),
        );
    }
    let analyzer = PathBuf::from(&args[1]);
    let artifact = args[2].clone();
    let executable = args.get(3).cloned();
    let target_id = "target:electron-cli".to_string();
    let target = TargetDescriptor {
        target_id: target_id.clone(),
        platform: TargetPlatform::Electron,
        app_name: Some("Electron target".to_string()),
        package_name: None,
        process_name: None,
        connection: None,
        security_profile: Some("local-development".to_string()),
    };
    let registry = AnalyzerRegistry::new(AnalyzerProcessConfig {
        program: PathBuf::from("node"),
        args: vec![analyzer.display().to_string()],
    });
    let mut host = AdapterHost::default();
    registry.connect_target(&mut host, target, Some(artifact), executable.clone())?;
    let static_snapshot = host.collect_static_snapshot(&target_id)?;
    let runtime = executable
        .map(|_| host.collect_runtime_snapshot(&target_id))
        .transpose()?;
    println!(
        "{}",
        serde_json::to_string_pretty(&json!({
            "targetId": target_id,
            "static": {
                "adapterId": static_snapshot.adapter_id,
                "artifacts": static_snapshot.artifacts.len(),
                "nodes": static_snapshot.nodes.len(),
                "edges": static_snapshot.edges.len(),
            },
            "runtime": runtime.map(|snapshot| json!({
                "nodes": snapshot.nodes.len(),
                "evidenceIds": snapshot.evidence_ids,
            })),
            "evidenceRecords": host.evidence.list().len(),
        }))?
    );
    Ok(())
}
