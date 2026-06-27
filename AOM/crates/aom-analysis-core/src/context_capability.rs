use crate::{label, AOMGraphSnapshot, ContextCapabilityVerification, EvidenceKind};
use aom_protocol_rs::{AOMEdgeType, AOMNodeType};

pub(crate) fn context_capability_verifications(
    graph: &AOMGraphSnapshot,
) -> Vec<ContextCapabilityVerification> {
    graph
        .edges
        .iter()
        .filter(|edge| edge.edge_type == AOMEdgeType::Updates)
        .filter_map(|edge| {
            let capability = graph.nodes.iter().find(|node| node.id == edge.from)?;
            let target = graph.nodes.iter().find(|node| node.id == edge.to)?;
            if capability.node_type != AOMNodeType::Capability
                || target.node_type != AOMNodeType::StorageKey
            {
                return None;
            }
            let reasons = edge
                .evidence_ids
                .iter()
                .filter_map(|id| {
                    graph
                        .evidence
                        .iter()
                        .find(|record| record.evidence_id == *id)
                })
                .map(|record| record.summary.clone())
                .collect::<Vec<_>>();
            let verified = edge.evidence_ids.iter().any(|id| {
                graph.evidence.iter().any(|record| {
                    record.evidence_id == *id && record.kind == EvidenceKind::Verified
                })
            });
            Some(ContextCapabilityVerification {
                capability_id: capability.id.clone(),
                capability_label: label(capability),
                target_state_id: target.id.clone(),
                target_state_label: label(target),
                verified,
                confidence: edge.confidence,
                reasons,
                evidence_ids: edge.evidence_ids.clone(),
            })
        })
        .collect()
}
