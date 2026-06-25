use crate::{AdapterError, AdapterResult};
use aom_protocol_rs::{
    ArtifactInspection, EvidenceRef, RawAction, RawActionResult, RawEvent, RawRuntimeSnapshot,
    RawStaticSnapshot,
};
use std::collections::BTreeMap;

pub trait StaticAnalysisAdapter: Send {
    fn adapter_id(&self) -> &str;
    fn target_id(&self) -> &str;
    fn accepts(&self, inspection: &ArtifactInspection) -> bool {
        inspection.recommended_adapter.as_deref() == Some(self.adapter_id())
    }
    fn collect_static_snapshot(&mut self) -> AdapterResult<RawStaticSnapshot>;
    fn drain_evidence(&mut self) -> Vec<EvidenceRef> {
        vec![]
    }
}

pub trait RuntimeProbe: Send {
    fn probe_id(&self) -> &str;
    fn target_id(&self) -> &str;
    fn collect_runtime_snapshot(&mut self) -> AdapterResult<RawRuntimeSnapshot>;
    fn drain_events(&mut self) -> AdapterResult<Vec<RawEvent>>;
    fn execute_action(&mut self, action: &RawAction) -> AdapterResult<RawActionResult>;
    fn drain_evidence(&mut self) -> Vec<EvidenceRef> {
        vec![]
    }
}

#[derive(Default)]
pub struct StaticAdapterManager {
    adapters: BTreeMap<String, Box<dyn StaticAnalysisAdapter>>,
}

impl StaticAdapterManager {
    pub fn attach(&mut self, adapter: Box<dyn StaticAnalysisAdapter>) -> AdapterResult<()> {
        let target_id = adapter.target_id().to_string();
        if self.adapters.contains_key(&target_id) {
            return Err(AdapterError::DuplicateStaticAdapter(target_id));
        }
        self.adapters.insert(target_id, adapter);
        Ok(())
    }

    pub fn get_mut(
        &mut self,
        target_id: &str,
    ) -> AdapterResult<&mut (dyn StaticAnalysisAdapter + '_)> {
        match self.adapters.get_mut(target_id) {
            Some(adapter) => Ok(adapter.as_mut()),
            None => Err(AdapterError::StaticAdapterNotFound(target_id.to_string())),
        }
    }

    pub fn accepts(&self, target_id: &str, inspection: &ArtifactInspection) -> AdapterResult<bool> {
        self.adapters
            .get(target_id)
            .map(|adapter| adapter.accepts(inspection))
            .ok_or_else(|| AdapterError::StaticAdapterNotFound(target_id.to_string()))
    }

    pub fn detach(&mut self, target_id: &str) -> Option<Box<dyn StaticAnalysisAdapter>> {
        self.adapters.remove(target_id)
    }
}

#[derive(Default)]
pub struct RuntimeProbeManager {
    probes: BTreeMap<String, Box<dyn RuntimeProbe>>,
}

impl RuntimeProbeManager {
    pub fn attach(&mut self, probe: Box<dyn RuntimeProbe>) -> AdapterResult<()> {
        let target_id = probe.target_id().to_string();
        if self.probes.contains_key(&target_id) {
            return Err(AdapterError::DuplicateProbe(target_id));
        }
        self.probes.insert(target_id, probe);
        Ok(())
    }

    pub fn get_mut(&mut self, target_id: &str) -> AdapterResult<&mut (dyn RuntimeProbe + '_)> {
        match self.probes.get_mut(target_id) {
            Some(probe) => Ok(probe.as_mut()),
            None => Err(AdapterError::ProbeNotFound(target_id.to_string())),
        }
    }

    pub fn detach(&mut self, target_id: &str) -> Option<Box<dyn RuntimeProbe>> {
        self.probes.remove(target_id)
    }
}
