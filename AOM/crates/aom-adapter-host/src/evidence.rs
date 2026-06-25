use aom_protocol_rs::EvidenceRef;
use std::collections::BTreeMap;

#[derive(Debug, Default)]
pub struct EvidenceStore {
    records: BTreeMap<String, EvidenceRef>,
}

impl EvidenceStore {
    pub fn insert_all(&mut self, evidence: Vec<EvidenceRef>) {
        for record in evidence {
            self.records.insert(record.evidence_id.clone(), record);
        }
    }

    pub fn get(&self, evidence_id: &str) -> Option<&EvidenceRef> {
        self.records.get(evidence_id)
    }

    pub fn list(&self) -> Vec<&EvidenceRef> {
        self.records.values().collect()
    }
}
