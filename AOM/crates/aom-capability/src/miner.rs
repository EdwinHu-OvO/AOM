use crate::{
    feature_str, plan_for, risk_from_node, CapabilityAutomationPolicy, CapabilityAvailability,
    ExecutableCapability,
};
use aom_analysis_core::AOMGraphSnapshot;
use aom_protocol_rs::{AOMCapability, AOMNodeType, CapabilityRiskLevel};

pub fn mine_capabilities(graph: &AOMGraphSnapshot) -> Vec<ExecutableCapability> {
    let mut capabilities = graph
        .nodes
        .iter()
        .filter(|node| node.node_type == AOMNodeType::Capability)
        .filter_map(|node| {
            let name = node.label.clone()?;
            let mut base = AOMCapability {
                id: node.id.clone(),
                name: name.clone(),
                description: feature_str(node, "description").unwrap_or("").into(),
                input_slots: vec![],
                action_summary: vec![],
                expected_effects: vec![],
                risk_level: risk_from_node(node),
                confidence: node.confidence,
                evidence_ids: node.evidence_ids.clone(),
            };
            let plan = plan_for(&name, &base, graph);
            base.input_slots = plan.slots;
            base.action_summary = plan.steps.iter().map(|step| step.summary.clone()).collect();
            base.expected_effects = plan
                .effects
                .iter()
                .map(|effect| effect.summary.clone())
                .collect();
            Some(ExecutableCapability {
                availability: availability(base.confidence, plan.has_target),
                automation: automation(&base.risk_level, base.confidence, plan.has_target),
                capability: base,
                action_plan: plan.steps,
                expected_effects: plan.effects,
                reasons: plan.reasons,
            })
        })
        .collect::<Vec<_>>();
    capabilities.sort_by(|left, right| left.capability.name.cmp(&right.capability.name));
    capabilities
}

fn availability(confidence: f64, has_target: bool) -> CapabilityAvailability {
    if confidence < 0.7 {
        CapabilityAvailability::LowConfidence
    } else if !has_target {
        CapabilityAvailability::MissingTarget
    } else {
        CapabilityAvailability::Available
    }
}

fn automation(
    risk: &CapabilityRiskLevel,
    confidence: f64,
    has_target: bool,
) -> CapabilityAutomationPolicy {
    let can_auto_execute =
        matches!(risk, CapabilityRiskLevel::Low) && confidence >= 0.75 && has_target;
    let reason = if can_auto_execute {
        "low-risk capability with sufficient confidence and a concrete target".into()
    } else if !matches!(risk, CapabilityRiskLevel::Low) {
        "medium/high risk capability requires Gateway policy before execution".into()
    } else if confidence < 0.75 {
        "low confidence capability must not auto-execute".into()
    } else {
        "capability has no concrete action target in the current graph".into()
    };
    CapabilityAutomationPolicy {
        risk_level: risk.clone(),
        can_auto_execute,
        reason,
    }
}
