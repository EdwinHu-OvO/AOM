use crate::{stable_id, AnalysisInput, EvidenceManager};
use aom_protocol_rs::{AOMEdge, AOMEdgeType, AOMNode, AOMNodeType};
use serde_json::Value;
use std::collections::BTreeMap;

pub(crate) fn add_static_endpoints(
    input: &AnalysisInput,
    app_id: &str,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) {
    for raw in input
        .static_snapshot
        .nodes
        .iter()
        .filter(|node| node.kind == "api_endpoint")
    {
        let path = raw.label.clone().unwrap_or_else(|| raw.raw_id.clone());
        let id = stable_id(&input.target_id, &AOMNodeType::ApiEndpoint, &path);
        let evidence_id = evidence.observed(
            &input.target_id,
            input.static_snapshot.timestamp,
            format!("Static API endpoint observed: {path}"),
            raw.evidence_ids.clone(),
        );
        nodes.push(node(
            id.clone(),
            AOMNodeType::ApiEndpoint,
            Some(path),
            BTreeMap::from([("staticallyDiscovered".into(), Value::Bool(true))]),
            vec![evidence_id.clone()],
            0.9,
        ));
        edges.push(edge(
            app_id,
            &id,
            AOMEdgeType::Contains,
            vec![evidence_id],
            1.0,
        ));
    }
}

pub(crate) fn node(
    id: String,
    node_type: AOMNodeType,
    label: Option<String>,
    features: BTreeMap<String, Value>,
    evidence_ids: Vec<String>,
    confidence: f64,
) -> AOMNode {
    AOMNode {
        id,
        node_type,
        label,
        features,
        evidence_ids,
        confidence,
    }
}

pub(crate) fn edge(
    from: &str,
    to: &str,
    edge_type: AOMEdgeType,
    evidence_ids: Vec<String>,
    confidence: f64,
) -> AOMEdge {
    let key = format!("{from}|{to}|{edge_type:?}");
    let hash = key.bytes().fold(0xcbf29ce484222325_u64, |hash, byte| {
        (hash ^ u64::from(byte)).wrapping_mul(0x100000001b3)
    });
    AOMEdge {
        id: format!("edge:{hash:016x}"),
        from: from.to_string(),
        to: to.to_string(),
        edge_type,
        confidence,
        evidence_ids,
    }
}

pub(crate) fn json_map<const N: usize>(entries: [(&str, Value); N]) -> BTreeMap<String, Value> {
    entries
        .into_iter()
        .map(|(key, value)| (key.to_string(), value))
        .collect()
}

pub(crate) fn deduplicate(nodes: &mut Vec<AOMNode>, edges: &mut Vec<AOMEdge>) {
    let mut merged: BTreeMap<String, AOMNode> = BTreeMap::new();
    for candidate in nodes.drain(..) {
        match merged.get_mut(&candidate.id) {
            Some(existing) => {
                existing.features.extend(candidate.features);
                existing.evidence_ids.extend(candidate.evidence_ids);
                existing.evidence_ids.sort();
                existing.evidence_ids.dedup();
                existing.confidence = existing.confidence.max(candidate.confidence);
                if existing.label.is_none() {
                    existing.label = candidate.label;
                }
            }
            None => {
                merged.insert(candidate.id.clone(), candidate);
            }
        }
    }
    nodes.extend(merged.into_values());
    let mut merged_edges: BTreeMap<String, AOMEdge> = BTreeMap::new();
    for candidate in edges.drain(..) {
        match merged_edges.get_mut(&candidate.id) {
            Some(existing) => {
                existing.evidence_ids.extend(candidate.evidence_ids);
                existing.evidence_ids.sort();
                existing.evidence_ids.dedup();
                existing.confidence = existing.confidence.max(candidate.confidence);
            }
            None => {
                merged_edges.insert(candidate.id.clone(), candidate);
            }
        }
    }
    edges.extend(merged_edges.into_values());
}
