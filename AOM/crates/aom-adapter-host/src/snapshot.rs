use crate::{AdapterResult, RuntimeProbeManager, StaticAdapterManager};
use aom_protocol_rs::{RawRuntimeSnapshot, RawStaticSnapshot};

pub struct SnapshotCollector;

impl SnapshotCollector {
    pub fn collect_static(
        adapters: &mut StaticAdapterManager,
        target_id: &str,
    ) -> AdapterResult<RawStaticSnapshot> {
        adapters.get_mut(target_id)?.collect_static_snapshot()
    }

    pub fn collect_runtime(
        probes: &mut RuntimeProbeManager,
        target_id: &str,
    ) -> AdapterResult<RawRuntimeSnapshot> {
        probes.get_mut(target_id)?.collect_runtime_snapshot()
    }
}
