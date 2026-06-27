use crate::{AnalysisEvidence, EvidenceKind};
use aom_protocol_rs::EvidenceRef;
use std::collections::BTreeMap;

#[derive(Debug, Default)]
pub struct EvidenceManager {
    records: BTreeMap<String, AnalysisEvidence>,
}

impl EvidenceManager {
    pub fn import(&mut self, target_id: &str, timestamp: u64, refs: &[EvidenceRef]) {
        for source in refs {
            self.records.insert(
                source.evidence_id.clone(),
                AnalysisEvidence {
                    evidence_id: source.evidence_id.clone(),
                    target_id: target_id.to_string(),
                    kind: EvidenceKind::Observed,
                    summary: source
                        .summary
                        .clone()
                        .unwrap_or_else(|| source.source_event_id.clone()),
                    timestamp,
                    source_ids: vec![source.source_event_id.clone()],
                    derived_from: vec![],
                    metadata: source.metadata.clone(),
                },
            );
        }
    }

    pub fn observed(
        &mut self,
        target_id: &str,
        timestamp: u64,
        summary: impl Into<String>,
        source_ids: Vec<String>,
    ) -> String {
        self.insert(
            target_id,
            timestamp,
            EvidenceKind::Observed,
            summary,
            source_ids,
            vec![],
        )
    }

    pub fn inferred(
        &mut self,
        target_id: &str,
        timestamp: u64,
        summary: impl Into<String>,
        derived_from: Vec<String>,
    ) -> String {
        self.insert(
            target_id,
            timestamp,
            EvidenceKind::Inferred,
            summary,
            vec![],
            derived_from,
        )
    }

    pub fn verified(
        &mut self,
        target_id: &str,
        timestamp: u64,
        summary: impl Into<String>,
        derived_from: Vec<String>,
    ) -> String {
        self.insert(
            target_id,
            timestamp,
            EvidenceKind::Verified,
            summary,
            vec![],
            derived_from,
        )
    }

    pub fn into_records(self) -> Vec<AnalysisEvidence> {
        self.records.into_values().collect()
    }

    fn insert(
        &mut self,
        target_id: &str,
        timestamp: u64,
        kind: EvidenceKind,
        summary: impl Into<String>,
        source_ids: Vec<String>,
        derived_from: Vec<String>,
    ) -> String {
        let summary = summary.into();
        let key = format!("{target_id}|{timestamp}|{summary}|{:?}", kind);
        let evidence_id = format!("evidence:analysis:{:016x}", stable_hash(key.as_bytes()));
        self.records.insert(
            evidence_id.clone(),
            AnalysisEvidence {
                evidence_id: evidence_id.clone(),
                target_id: target_id.to_string(),
                kind,
                summary,
                timestamp,
                source_ids,
                derived_from,
                metadata: BTreeMap::new(),
            },
        );
        evidence_id
    }
}

fn stable_hash(bytes: &[u8]) -> u64 {
    bytes.iter().fold(0xcbf29ce484222325_u64, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    })
}
