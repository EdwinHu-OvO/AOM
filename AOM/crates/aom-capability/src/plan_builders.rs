use crate::{node_label, CapabilityActionStep, CapabilityExpectedEffect, CapabilityStepKind};
use aom_protocol_rs::{AOMNode, CapabilityInputSlot};
use serde_json::json;
use std::collections::BTreeMap;

pub(crate) struct CapabilityPlan {
    pub slots: Vec<CapabilityInputSlot>,
    pub steps: Vec<CapabilityActionStep>,
    pub effects: Vec<CapabilityExpectedEffect>,
    pub has_target: bool,
    pub reasons: Vec<String>,
}

pub(crate) fn slot(
    name: &str,
    data_kind: &str,
    required: bool,
    sensitive: bool,
) -> CapabilityInputSlot {
    CapabilityInputSlot {
        name: name.into(),
        data_kind: data_kind.into(),
        required,
        sensitive,
    }
}

pub(crate) fn step_for(
    id: &str,
    kind: CapabilityStepKind,
    summary: &str,
    target: Option<&AOMNode>,
    input: Option<&str>,
) -> CapabilityActionStep {
    step(
        id,
        kind,
        summary,
        target.map(|node| node.id.as_str()),
        target.map(node_label),
        input,
    )
}

pub(crate) fn step(
    id: &str,
    kind: CapabilityStepKind,
    summary: &str,
    target_id: Option<&str>,
    target_label: Option<&str>,
    input: Option<&str>,
) -> CapabilityActionStep {
    CapabilityActionStep {
        step_id: id.into(),
        kind,
        summary: summary.into(),
        target_node_id: target_id.map(str::to_string),
        target_label: target_label.map(str::to_string),
        input_slot: input.map(str::to_string),
        params: BTreeMap::from([("transportNeutral".into(), json!(true))]),
    }
}

pub(crate) fn effect(
    summary: &str,
    target: Option<&AOMNode>,
    evidence_ids: Vec<String>,
) -> CapabilityExpectedEffect {
    CapabilityExpectedEffect {
        summary: summary.into(),
        target_node_id: target.map(|node| node.id.clone()),
        target_label: target.and_then(|node| node.label.clone()),
        evidence_ids,
    }
}
