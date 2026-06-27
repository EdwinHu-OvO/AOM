use aom_analysis_core::AnalysisInput;
use aom_analysis_server::AnalysisService;
use std::{env, fs, path::PathBuf};

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = env::args().collect();
    if args.len() != 3 {
        return Err("usage: aom-analyze-bundle <input.json> <output-directory>".into());
    }
    let input: AnalysisInput = serde_json::from_slice(&fs::read(&args[1])?)?;
    let service = AnalysisService::ingest(input);
    let output = PathBuf::from(&args[2]);
    fs::create_dir_all(&output)?;
    fs::write(
        output.join("graph.json"),
        serde_json::to_vec_pretty(service.snapshot())?,
    )?;
    fs::write(
        output.join("context-pack.json"),
        serde_json::to_vec_pretty(&service.context_pack())?,
    )?;
    fs::write(
        output.join("capabilities.json"),
        serde_json::to_vec_pretty(&service.capabilities())?,
    )?;
    println!("{}", output.display());
    Ok(())
}
