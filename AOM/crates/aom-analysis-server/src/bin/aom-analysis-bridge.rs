use aom_analysis_core::AnalysisInput;
use aom_analysis_server::AnalysisService;
use serde::Serialize;
use std::io::{self, Read};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct BridgeOutput {
    graph: aom_analysis_core::AOMGraphSnapshot,
    context_pack: aom_analysis_core::AOMContextPack,
    capabilities: Vec<aom_capability::ExecutableCapability>,
    verification: aom_analysis_server::AnalysisVerification,
}

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let mut input = Vec::new();
    io::stdin().read_to_end(&mut input)?;
    let analysis_input: AnalysisInput = serde_json::from_slice(&input)?;
    let service = AnalysisService::ingest(analysis_input);
    let output = BridgeOutput {
        graph: service.snapshot().clone(),
        context_pack: service.context_pack(),
        capabilities: service.capabilities(),
        verification: service.verify(),
    };
    println!("{}", serde_json::to_string(&output)?);
    Ok(())
}
