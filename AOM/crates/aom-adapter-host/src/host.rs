use crate::{
    ActionExecutor, AdapterResult, ArtifactParser, EvidenceStore, RawEventBus, RuntimeProbe,
    RuntimeProbeManager, SnapshotCollector, StaticAdapterManager, StaticAnalysisAdapter,
    TargetManager,
};
use aom_protocol_rs::{
    ArtifactInspection, RawAction, RawActionResult, RawEvent, RawRuntimeSnapshot,
    RawStaticSnapshot, TargetDescriptor,
};
use std::path::Path;

#[derive(Default)]
pub struct AdapterHost {
    pub targets: TargetManager,
    pub static_adapters: StaticAdapterManager,
    pub runtime_probes: RuntimeProbeManager,
    pub events: RawEventBus,
    pub evidence: EvidenceStore,
    pub artifact_parser: ArtifactParser,
}

impl AdapterHost {
    pub fn register_target(&mut self, target: TargetDescriptor) -> AdapterResult<()> {
        self.targets.register(target)
    }

    pub fn attach_static_adapter(
        &mut self,
        adapter: Box<dyn StaticAnalysisAdapter>,
    ) -> AdapterResult<()> {
        self.targets.get(adapter.target_id())?;
        self.static_adapters.attach(adapter)
    }

    pub fn attach_runtime_probe(&mut self, probe: Box<dyn RuntimeProbe>) -> AdapterResult<()> {
        self.targets.get(probe.target_id())?;
        self.runtime_probes.attach(probe)
    }

    pub fn inspect_artifact(&self, locator: impl AsRef<Path>) -> AdapterResult<ArtifactInspection> {
        self.artifact_parser.inspect(locator)
    }

    pub fn collect_static_snapshot(&mut self, target_id: &str) -> AdapterResult<RawStaticSnapshot> {
        self.targets.get(target_id)?;
        let snapshot = SnapshotCollector::collect_static(&mut self.static_adapters, target_id)?;
        self.evidence
            .insert_all(self.static_adapters.get_mut(target_id)?.drain_evidence());
        Ok(snapshot)
    }

    pub fn collect_runtime_snapshot(
        &mut self,
        target_id: &str,
    ) -> AdapterResult<RawRuntimeSnapshot> {
        self.targets.get(target_id)?;
        let snapshot = SnapshotCollector::collect_runtime(&mut self.runtime_probes, target_id)?;
        self.capture_runtime_evidence(target_id)?;
        Ok(snapshot)
    }

    pub fn execute_action(&mut self, action: &RawAction) -> AdapterResult<RawActionResult> {
        self.targets.get(&action.target_id)?;
        let result = ActionExecutor::execute(&mut self.runtime_probes, action)?;
        self.capture_runtime_evidence(&action.target_id)?;
        Ok(result)
    }

    pub fn poll_events(&mut self, target_id: &str) -> AdapterResult<Vec<RawEvent>> {
        self.targets.get(target_id)?;
        let events = self.runtime_probes.get_mut(target_id)?.drain_events()?;
        self.capture_runtime_evidence(target_id)?;
        self.events.publish_batch(events)?;
        Ok(self.events.drain_target(target_id))
    }

    fn capture_runtime_evidence(&mut self, target_id: &str) -> AdapterResult<()> {
        self.evidence
            .insert_all(self.runtime_probes.get_mut(target_id)?.drain_evidence());
        Ok(())
    }
}
