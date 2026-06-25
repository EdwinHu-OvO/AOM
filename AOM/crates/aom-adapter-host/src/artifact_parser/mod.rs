mod fingerprint;
mod format;

use crate::{AdapterError, AdapterResult};
use aom_protocol_rs::{ArtifactDetectionEvidence, ArtifactInspection};
use std::{
    fs,
    io::Read,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const MAX_ENTRIES: usize = 4096;
const MAX_DEPTH: usize = 8;
const MAX_HEADER_BYTES: usize = 65_536;
const MAX_SAMPLED_TEXT_BYTES: usize = 2_097_152;

#[derive(Debug, Default)]
pub struct ArtifactParser;

impl ArtifactParser {
    pub fn inspect(&self, locator: impl AsRef<Path>) -> AdapterResult<ArtifactInspection> {
        let path = locator.as_ref();
        let header = read_prefix(path, MAX_HEADER_BYTES)?;
        let format = format::detect_format(path, &header);
        let observations = collect_observations(path)?;
        let fingerprint = fingerprint::fingerprint(&observations.locators, &observations.text);
        let mut evidence = vec![ArtifactDetectionEvidence {
            evidence_id: "evidence:artifact:format:1".to_string(),
            detector: "container-magic".to_string(),
            kind: "container".to_string(),
            value: format.reason,
            locator: Some(path.display().to_string()),
        }];
        evidence.extend(fingerprint.evidence);

        Ok(ArtifactInspection {
            inspection_id: format!("inspection:{}", unix_millis()),
            input_locator: path.display().to_string(),
            container_type: format.container_type,
            architecture: format.architecture,
            runtime_candidates: fingerprint.candidates,
            recommended_adapter: fingerprint.recommended_adapter,
            evidence,
        })
    }
}

struct Observations {
    locators: Vec<String>,
    text: String,
}

fn collect_observations(path: &Path) -> AdapterResult<Observations> {
    let mut files = Vec::new();
    if path.is_dir() {
        visit(path, 0, &mut files)?;
    } else {
        files.push(path.to_path_buf());
    }

    let locators = files
        .iter()
        .map(|file| file.display().to_string().replace('\\', "/"))
        .collect();
    let mut text = String::new();
    let mut remaining = MAX_SAMPLED_TEXT_BYTES;
    for file in files {
        if remaining == 0 || !should_sample(&file) {
            continue;
        }
        let bytes = read_prefix(&file, remaining.min(262_144))?;
        remaining = remaining.saturating_sub(bytes.len());
        text.push_str(&String::from_utf8_lossy(&bytes));
        text.push('\n');
    }
    Ok(Observations { locators, text })
}

fn visit(path: &Path, depth: usize, files: &mut Vec<PathBuf>) -> AdapterResult<()> {
    if depth > MAX_DEPTH || files.len() >= MAX_ENTRIES {
        return Ok(());
    }
    let entries = fs::read_dir(path).map_err(|error| artifact_read_error(path, error))?;
    for entry in entries {
        if files.len() >= MAX_ENTRIES {
            break;
        }
        let entry = entry.map_err(|error| artifact_read_error(path, error))?;
        let entry_path = entry.path();
        let file_type = entry
            .file_type()
            .map_err(|error| artifact_read_error(&entry_path, error))?;
        if file_type.is_dir() {
            visit(&entry_path, depth + 1, files)?;
        } else if file_type.is_file() {
            files.push(entry_path);
        }
    }
    Ok(())
}

fn read_prefix(path: &Path, limit: usize) -> AdapterResult<Vec<u8>> {
    if path.is_dir() {
        return Ok(Vec::new());
    }
    let file = fs::File::open(path).map_err(|error| artifact_read_error(path, error))?;
    let mut bytes = Vec::new();
    file.take(limit as u64)
        .read_to_end(&mut bytes)
        .map_err(|error| artifact_read_error(path, error))?;
    Ok(bytes)
}

fn should_sample(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|extension| extension.to_str())
            .unwrap_or_default()
            .to_ascii_lowercase()
            .as_str(),
        "asar" | "dll" | "exe" | "html" | "js" | "json" | "mjs" | "pak" | "so"
    )
}

fn artifact_read_error(path: &Path, error: std::io::Error) -> AdapterError {
    AdapterError::ArtifactRead {
        locator: path.display().to_string(),
        message: error.to_string(),
    }
}

fn unix_millis() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}
