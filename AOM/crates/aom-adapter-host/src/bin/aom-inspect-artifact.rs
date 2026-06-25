use aom_adapter_host::ArtifactParser;

fn main() {
    let Some(locator) = std::env::args().nth(1) else {
        eprintln!("usage: aom-inspect-artifact <file-or-directory>");
        std::process::exit(2);
    };

    match ArtifactParser.inspect(&locator) {
        Ok(inspection) => {
            println!(
                "{}",
                serde_json::to_string_pretty(&inspection)
                    .expect("artifact inspection should serialize")
            );
        }
        Err(error) => {
            eprintln!("artifact inspection failed: {error}");
            std::process::exit(1);
        }
    }
}
