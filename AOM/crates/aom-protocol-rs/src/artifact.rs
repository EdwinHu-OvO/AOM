use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ArtifactContainerType {
    Directory,
    MacAppBundle,
    Pe,
    MachO,
    Elf,
    Zip,
    Asar,
    Apk,
    AppImage,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum WebRuntimeFamily {
    Electron,
    Cef,
    WebView2,
    Nwjs,
    Tauri,
    QtWebEngine,
    GenericWeb,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeCandidate {
    pub runtime: WebRuntimeFamily,
    pub confidence: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactDetectionEvidence {
    pub evidence_id: String,
    pub detector: String,
    pub kind: String,
    pub value: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locator: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ArtifactInspection {
    pub inspection_id: String,
    pub input_locator: String,
    pub container_type: ArtifactContainerType,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub architecture: Option<String>,
    #[serde(default)]
    pub runtime_candidates: Vec<RuntimeCandidate>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub recommended_adapter: Option<String>,
    #[serde(default)]
    pub evidence: Vec<ArtifactDetectionEvidence>,
}
