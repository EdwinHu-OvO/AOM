use crate::{AdapterError, AdapterResult, RuntimeProbeManager};
use aom_protocol_rs::{RawAction, RawActionResult};

pub struct ActionExecutor;

impl ActionExecutor {
    pub fn execute(
        probes: &mut RuntimeProbeManager,
        action: &RawAction,
    ) -> AdapterResult<RawActionResult> {
        let probe = probes.get_mut(&action.target_id)?;
        if probe.target_id() != action.target_id {
            return Err(AdapterError::TargetMismatch {
                expected: probe.target_id().to_string(),
                received: action.target_id.clone(),
            });
        }
        probe.execute_action(action)
    }
}
