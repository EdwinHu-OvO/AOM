use crate::{
    AdapterError, AdapterResult, RuntimeProbe, StaticAnalysisAdapter, StdioAnalyzerClient,
};
use aom_protocol_rs::{
    AnalyzerCommand, AnalyzerReply, EvidenceRef, RawAction, RawActionResult, RawEvent,
    RawRuntimeSnapshot, RawStaticSnapshot,
};
use std::sync::{Arc, Mutex};

pub type SharedAnalyzerClient = Arc<Mutex<StdioAnalyzerClient>>;

pub struct StdioStaticAdapter {
    target_id: String,
    adapter_id: String,
    client: SharedAnalyzerClient,
    evidence: Vec<EvidenceRef>,
}

impl StdioStaticAdapter {
    pub fn new(target_id: String, adapter_id: String, client: SharedAnalyzerClient) -> Self {
        Self {
            target_id,
            adapter_id,
            client,
            evidence: vec![],
        }
    }
}

impl StaticAnalysisAdapter for StdioStaticAdapter {
    fn adapter_id(&self) -> &str {
        &self.adapter_id
    }

    fn target_id(&self) -> &str {
        &self.target_id
    }

    fn collect_static_snapshot(&mut self) -> AdapterResult<RawStaticSnapshot> {
        match request(&self.client, &AnalyzerCommand::CollectStatic)? {
            AnalyzerReply::StaticSnapshot(result) => {
                self.evidence.extend(result.evidence);
                Ok(result.value)
            }
            reply => Err(unexpected("static_snapshot", reply)),
        }
    }

    fn drain_evidence(&mut self) -> Vec<EvidenceRef> {
        self.evidence.drain(..).collect()
    }
}

pub struct StdioRuntimeProbe {
    target_id: String,
    probe_id: String,
    client: SharedAnalyzerClient,
    evidence: Vec<EvidenceRef>,
}

impl StdioRuntimeProbe {
    pub fn new(target_id: String, probe_id: String, client: SharedAnalyzerClient) -> Self {
        Self {
            target_id,
            probe_id,
            client,
            evidence: vec![],
        }
    }

    fn capture<T>(&mut self, result: aom_protocol_rs::AnalyzerResult<T>) -> T {
        self.evidence.extend(result.evidence);
        result.value
    }
}

impl RuntimeProbe for StdioRuntimeProbe {
    fn probe_id(&self) -> &str {
        &self.probe_id
    }

    fn target_id(&self) -> &str {
        &self.target_id
    }

    fn collect_runtime_snapshot(&mut self) -> AdapterResult<RawRuntimeSnapshot> {
        match request(&self.client, &AnalyzerCommand::CollectRuntime)? {
            AnalyzerReply::RuntimeSnapshot(result) => Ok(self.capture(result)),
            reply => Err(unexpected("runtime_snapshot", reply)),
        }
    }

    fn drain_events(&mut self) -> AdapterResult<Vec<RawEvent>> {
        match request(&self.client, &AnalyzerCommand::DrainEvents)? {
            AnalyzerReply::Events(result) => Ok(self.capture(result)),
            reply => Err(unexpected("events", reply)),
        }
    }

    fn execute_action(&mut self, action: &RawAction) -> AdapterResult<RawActionResult> {
        match request(
            &self.client,
            &AnalyzerCommand::ExecuteAction(action.clone()),
        )? {
            AnalyzerReply::ActionResult(result) => Ok(self.capture(result)),
            reply => Err(unexpected("action_result", reply)),
        }
    }

    fn drain_evidence(&mut self) -> Vec<EvidenceRef> {
        self.evidence.drain(..).collect()
    }
}

fn request(
    client: &SharedAnalyzerClient,
    command: &AnalyzerCommand,
) -> AdapterResult<AnalyzerReply> {
    client
        .lock()
        .map_err(|_| AdapterError::Transport("analyzer client lock poisoned".to_string()))?
        .request(command)
}

fn unexpected(expected: &str, reply: AnalyzerReply) -> AdapterError {
    AdapterError::UnexpectedReply {
        expected: expected.to_string(),
        received: format!("{reply:?}"),
    }
}
