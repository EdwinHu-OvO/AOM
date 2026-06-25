use crate::{
    EvidenceRef, RawAction, RawActionResult, RawEvent, RawRuntimeSnapshot, RawStaticSnapshot,
    TargetDescriptor,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzerSessionConfig {
    pub target: TargetDescriptor,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub artifact_locator: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executable_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adapter_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case", tag = "commandType", content = "data")]
pub enum AnalyzerCommand {
    Initialize(AnalyzerSessionConfig),
    CollectStatic,
    CollectRuntime,
    DrainEvents,
    ExecuteAction(RawAction),
    Shutdown,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzerReady {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adapter_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub probe_id: Option<String>,
    #[serde(default)]
    pub evidence: Vec<EvidenceRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzerResult<T> {
    pub value: T,
    #[serde(default)]
    pub evidence: Vec<EvidenceRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzerFailure {
    pub code: String,
    pub message: String,
    #[serde(default)]
    pub retryable: bool,
    #[serde(default)]
    pub evidence: Vec<EvidenceRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case", tag = "replyType", content = "data")]
pub enum AnalyzerReply {
    Ready(AnalyzerReady),
    StaticSnapshot(AnalyzerResult<RawStaticSnapshot>),
    RuntimeSnapshot(AnalyzerResult<RawRuntimeSnapshot>),
    Events(AnalyzerResult<Vec<RawEvent>>),
    ActionResult(AnalyzerResult<RawActionResult>),
    Ack(AnalyzerResult<bool>),
    Error(AnalyzerFailure),
}
