use crate::{AdapterError, AdapterResult};
use aom_protocol_rs::TargetDescriptor;
use std::collections::BTreeMap;

#[derive(Debug, Default)]
pub struct TargetManager {
    targets: BTreeMap<String, TargetDescriptor>,
}

impl TargetManager {
    pub fn register(&mut self, target: TargetDescriptor) -> AdapterResult<()> {
        if self.targets.contains_key(&target.target_id) {
            return Err(AdapterError::DuplicateTarget(target.target_id));
        }
        self.targets.insert(target.target_id.clone(), target);
        Ok(())
    }

    pub fn get(&self, target_id: &str) -> AdapterResult<&TargetDescriptor> {
        self.targets
            .get(target_id)
            .ok_or_else(|| AdapterError::TargetNotFound(target_id.to_string()))
    }

    pub fn list(&self) -> Vec<&TargetDescriptor> {
        self.targets.values().collect()
    }

    pub fn remove(&mut self, target_id: &str) -> Option<TargetDescriptor> {
        self.targets.remove(target_id)
    }
}
