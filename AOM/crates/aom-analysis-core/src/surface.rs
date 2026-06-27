use crate::{
    classify_screen, edge, json_map, node, normalize_facts, stable_id, view_descriptor,
    view_features, view_label, EvidenceManager,
};
use aom_protocol_rs::{AOMEdge, AOMEdgeType, AOMNode, AOMNodeType, RawRuntimeSnapshot};
use serde_json::{json, Value};
use std::collections::BTreeMap;

pub(crate) struct Surface {
    pub screen: AOMNode,
    pub views: Vec<AOMNode>,
    pub facts: Vec<AOMNode>,
    pub raw_to_view: BTreeMap<String, String>,
}

pub(crate) fn normalize_surface(
    target_id: &str,
    snapshot: &RawRuntimeSnapshot,
    evidence: &mut EvidenceManager,
) -> Surface {
    let (screen_key, screen_label, confidence) = classify_screen(&snapshot.nodes);
    let screen_id = stable_id(target_id, &AOMNodeType::Screen, &screen_key);
    let screen_evidence = evidence.observed(
        target_id,
        snapshot.timestamp,
        format!("Runtime surface classified as {screen_label}"),
        snapshot.evidence_ids.clone(),
    );
    let mut descriptors: Vec<_> = snapshot.nodes.iter().filter_map(view_descriptor).collect();
    descriptors.sort_by(|left, right| {
        left.0
            .cmp(&right.0)
            .then(left.1.raw_id.cmp(&right.1.raw_id))
    });
    let mut counts = BTreeMap::new();
    let mut views = vec![];
    let facts = normalize_facts(target_id, &screen_key, snapshot, evidence);
    let mut raw_to_view = BTreeMap::new();
    for (descriptor, raw) in descriptors {
        let ordinal = counts.entry(descriptor.clone()).or_insert(0_usize);
        *ordinal += 1;
        let id = stable_id(
            target_id,
            &AOMNodeType::View,
            &format!("{screen_key}|{descriptor}|{ordinal}"),
        );
        raw_to_view.insert(raw.raw_id.clone(), id.clone());
        let view_evidence = evidence.observed(
            target_id,
            snapshot.timestamp,
            format!("Interactive view observed: {descriptor}"),
            snapshot.evidence_ids.clone(),
        );
        views.push(node(
            id,
            AOMNodeType::View,
            Some(view_label(raw)),
            view_features(raw),
            vec![view_evidence],
            0.9,
        ));
    }
    Surface {
        screen: node(
            screen_id,
            AOMNodeType::Screen,
            Some(screen_label),
            json_map([
                ("semanticKey", json!(screen_key)),
                ("runtimeNodeCount", json!(snapshot.nodes.len())),
            ]),
            vec![screen_evidence],
            confidence,
        ),
        views,
        facts,
        raw_to_view,
    }
}

pub(crate) fn add_surface(
    app_id: &str,
    surface: &Surface,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
) {
    nodes.push(surface.screen.clone());
    edges.push(edge(
        app_id,
        &surface.screen.id,
        AOMEdgeType::Contains,
        surface.screen.evidence_ids.clone(),
        1.0,
    ));
    for view in &surface.views {
        nodes.push(view.clone());
        edges.push(edge(
            &surface.screen.id,
            &view.id,
            AOMEdgeType::Contains,
            view.evidence_ids.clone(),
            1.0,
        ));
    }
    for fact in &surface.facts {
        nodes.push(fact.clone());
        edges.push(edge(
            &surface.screen.id,
            &fact.id,
            AOMEdgeType::Contains,
            fact.evidence_ids.clone(),
            1.0,
        ));
    }
    add_structure_edges(surface, edges);
}

fn add_structure_edges(surface: &Surface, edges: &mut Vec<AOMEdge>) {
    let mut groups: BTreeMap<&str, Vec<&AOMNode>> = BTreeMap::new();
    for node in surface.views.iter().chain(surface.facts.iter()) {
        if let Some(group) = string_feature(node, "structureGroup") {
            groups.entry(group).or_default().push(node);
        }
    }
    for members in groups.into_values() {
        let Some(product) = members
            .iter()
            .find(|node| string_feature(node, "kind") == Some("product"))
        else {
            continue;
        };
        let product_id = product.id.clone();
        let product_evidence = product.evidence_ids.clone();
        for member in members {
            if member.id != product_id {
                edges.push(edge(
                    &product_id,
                    &member.id,
                    AOMEdgeType::Contains,
                    product_evidence.clone(),
                    0.95,
                ));
            }
        }
    }
}

fn string_feature<'a>(node: &'a AOMNode, key: &str) -> Option<&'a str> {
    node.features.get(key).and_then(Value::as_str)
}
