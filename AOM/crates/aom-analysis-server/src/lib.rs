use aom_analysis_core::{
    build_context_pack, query, AOMContextPack, AOMGraphSnapshot, AnalysisInput, AnalysisQuery,
    EvidenceKind, Normalizer,
};
use aom_capability::{mine_capabilities, ExecutableCapability};
use aom_protocol_rs::{AOMNode, AOMNodeType};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisVerification {
    pub verified: bool,
    pub verified_evidence_count: usize,
    pub verified_capability_count: usize,
    pub issues: Vec<String>,
}

pub struct AnalysisService {
    graph: AOMGraphSnapshot,
}

impl AnalysisService {
    pub fn ingest(input: AnalysisInput) -> Self {
        Self {
            graph: Normalizer::normalize(input),
        }
    }

    pub fn snapshot(&self) -> &AOMGraphSnapshot {
        &self.graph
    }

    pub fn query(&self, request: &AnalysisQuery) -> Vec<&AOMNode> {
        query(&self.graph, request)
    }

    pub fn capabilities(&self) -> Vec<ExecutableCapability> {
        mine_capabilities(&self.graph)
    }

    pub fn observe(&mut self, input: AnalysisInput) -> &AOMGraphSnapshot {
        self.graph = Normalizer::normalize(input);
        &self.graph
    }

    pub fn verify(&self) -> AnalysisVerification {
        let issues = graph_issues(&self.graph);
        AnalysisVerification {
            verified: issues.is_empty(),
            verified_evidence_count: self
                .graph
                .evidence
                .iter()
                .filter(|record| record.kind == EvidenceKind::Verified)
                .count(),
            verified_capability_count: verified_capability_count(&self.graph),
            issues,
        }
    }

    pub fn context_pack(&self) -> AOMContextPack {
        build_context_pack(&self.graph)
    }

    pub fn explain(&self, object_id: &str) -> Vec<String> {
        let evidence_ids = self
            .graph
            .nodes
            .iter()
            .find(|node| node.id == object_id)
            .map(|node| node.evidence_ids.as_slice())
            .unwrap_or_default();
        self.graph
            .evidence
            .iter()
            .filter(|record| evidence_ids.contains(&record.evidence_id))
            .map(|record| record.summary.clone())
            .collect()
    }
}

fn verified_capability_count(graph: &AOMGraphSnapshot) -> usize {
    graph
        .edges
        .iter()
        .filter(|edge| {
            edge.edge_type == aom_protocol_rs::AOMEdgeType::Updates
                && edge.evidence_ids.iter().any(|id| {
                    graph.evidence.iter().any(|record| {
                        record.evidence_id == *id && record.kind == EvidenceKind::Verified
                    })
                })
        })
        .count()
}

fn graph_issues(graph: &AOMGraphSnapshot) -> Vec<String> {
    let mut issues = vec![];
    let evidence_ids = graph
        .evidence
        .iter()
        .map(|record| record.evidence_id.as_str())
        .collect::<std::collections::BTreeSet<_>>();
    for node in &graph.nodes {
        for evidence_id in &node.evidence_ids {
            if !evidence_ids.contains(evidence_id.as_str()) {
                issues.push(format!(
                    "node {} references missing evidence {}",
                    node.id, evidence_id
                ));
            }
        }
    }
    for edge in &graph.edges {
        for evidence_id in &edge.evidence_ids {
            if !evidence_ids.contains(evidence_id.as_str()) {
                issues.push(format!(
                    "edge {} references missing evidence {}",
                    edge.id, evidence_id
                ));
            }
        }
    }
    if !graph
        .nodes
        .iter()
        .any(|node| node.node_type == AOMNodeType::Capability)
    {
        issues.push("graph has no capability nodes".into());
    }
    issues
}
