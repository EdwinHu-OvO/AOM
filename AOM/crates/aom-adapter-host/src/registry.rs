use crate::{
    AdapterError, AdapterHost, AdapterResult, SharedAnalyzerClient, StdioAnalyzerClient,
    StdioRuntimeProbe, StdioStaticAdapter,
};
use aom_protocol_rs::{AnalyzerReady, AnalyzerReply, AnalyzerSessionConfig, TargetDescriptor};
use std::{
    path::PathBuf,
    sync::{Arc, Mutex},
};

#[derive(Debug, Clone)]
pub struct AnalyzerProcessConfig {
    pub program: PathBuf,
    pub args: Vec<String>,
}

pub struct AnalyzerRegistry {
    electron: AnalyzerProcessConfig,
}

impl AnalyzerRegistry {
    pub fn new(electron: AnalyzerProcessConfig) -> Self {
        Self { electron }
    }

    pub fn connect_target(
        &self,
        host: &mut AdapterHost,
        target: TargetDescriptor,
        artifact_locator: Option<String>,
        executable_path: Option<String>,
    ) -> AdapterResult<()> {
        let inspection = artifact_locator
            .as_ref()
            .map(|locator| host.inspect_artifact(locator))
            .transpose()?;
        let adapter_id = inspection
            .as_ref()
            .and_then(|value| value.recommended_adapter.clone())
            .or_else(|| {
                artifact_locator
                    .as_ref()
                    .map(|_| "adapter:generic-artifact".to_string())
            });
        let config = AnalyzerSessionConfig {
            target: target.clone(),
            artifact_locator,
            executable_path: executable_path.clone(),
            adapter_id: adapter_id.clone(),
        };
        let (client, ready) =
            StdioAnalyzerClient::spawn(&self.electron.program, &self.electron.args, config)?;
        let ready = match ready {
            AnalyzerReply::Ready(value) => value,
            reply => {
                return Err(AdapterError::UnexpectedReply {
                    expected: "ready".to_string(),
                    received: format!("{reply:?}"),
                })
            }
        };
        host.register_target(target.clone())?;
        host.evidence.insert_all(ready.evidence.clone());
        let shared: SharedAnalyzerClient = Arc::new(Mutex::new(client));
        attach_static(host, &target.target_id, adapter_id, &ready, &shared)?;
        attach_runtime(host, &target.target_id, executable_path, &ready, shared)?;
        Ok(())
    }
}

fn attach_static(
    host: &mut AdapterHost,
    target_id: &str,
    adapter_id: Option<String>,
    ready: &AnalyzerReady,
    client: &SharedAnalyzerClient,
) -> AdapterResult<()> {
    if let Some(adapter_id) = ready.adapter_id.clone().or(adapter_id) {
        host.attach_static_adapter(Box::new(StdioStaticAdapter::new(
            target_id.to_string(),
            adapter_id,
            Arc::clone(client),
        )))?;
    }
    Ok(())
}

fn attach_runtime(
    host: &mut AdapterHost,
    target_id: &str,
    executable_path: Option<String>,
    ready: &AnalyzerReady,
    client: SharedAnalyzerClient,
) -> AdapterResult<()> {
    if executable_path.is_some() {
        let probe_id = ready
            .probe_id
            .clone()
            .ok_or_else(|| AdapterError::Analyzer {
                code: "probe_not_ready".to_string(),
                message: "analyzer did not return a runtime probe".to_string(),
            })?;
        host.attach_runtime_probe(Box::new(StdioRuntimeProbe::new(
            target_id.to_string(),
            probe_id,
            client,
        )))?;
    }
    Ok(())
}
