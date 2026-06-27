use crate::{json_map, node, stable_id, structural_group, EvidenceManager};
use aom_protocol_rs::{AOMNode, AOMNodeType, RawRuntimeNode, RawRuntimeSnapshot};
use serde_json::{json, Value};
use std::collections::BTreeMap;

pub(crate) fn normalize_facts(
    target_id: &str,
    screen_key: &str,
    snapshot: &RawRuntimeSnapshot,
    evidence: &mut EvidenceManager,
) -> Vec<AOMNode> {
    let mut seen = BTreeMap::new();
    let mut facts = vec![];
    for raw in snapshot.nodes.iter().filter(|node| node.role.is_none()) {
        let Some(label) = raw
            .label
            .as_deref()
            .map(str::trim)
            .filter(|value| !value.is_empty())
        else {
            continue;
        };
        if label.len() > 160 {
            continue;
        }
        let kind = fact_kind(label, raw);
        if kind == "decorative" {
            continue;
        }
        let key = format!("{kind}|{label}");
        if seen.insert(key.clone(), true).is_some() {
            continue;
        }
        let evidence_id = evidence.observed(
            target_id,
            snapshot.timestamp,
            format!("Visible state fact observed: {kind}={label}"),
            snapshot.evidence_ids.clone(),
        );
        facts.push(node(
            stable_id(
                target_id,
                &AOMNodeType::DataObject,
                &format!("{screen_key}|{key}"),
            ),
            AOMNodeType::DataObject,
            Some(label.to_string()),
            json_map([
                ("kind", json!(kind)),
                ("rawReference", json!(raw.raw_id)),
                (
                    "structureGroup",
                    structural_group(&raw.raw_id)
                        .map(Value::String)
                        .unwrap_or(Value::Null),
                ),
                (
                    "tagName",
                    raw.attributes
                        .get("tagName")
                        .cloned()
                        .unwrap_or(Value::Null),
                ),
            ]),
            vec![evidence_id],
            0.85,
        ));
    }
    facts
}

fn fact_kind(label: &str, node: &RawRuntimeNode) -> &'static str {
    let tag = node
        .attributes
        .get("tagName")
        .and_then(Value::as_str)
        .unwrap_or("");
    let raw_id = node.raw_id.as_str();
    if raw_id.contains("> main > button >") && label.starts_with('$') {
        "cart_subtotal"
    } else if raw_id.contains("> main > button >") && label.parse::<u64>().is_ok() {
        "cart_item_count"
    } else if label.to_lowercase().contains("delivery") {
        "delivery"
    } else if label.starts_with('$') {
        "price"
    } else if label.ends_with(" items") {
        "menu_item_count"
    } else if label.ends_with(" open now") {
        "open_store_count"
    } else if raw_id.contains("header") && label.starts_with("Home:") {
        "delivery_address"
    } else if raw_id.contains("header") && looks_like_person_name(label) {
        "user_name"
    } else if tag == "h1" && raw_id.contains("> section > section >") {
        "selected_store"
    } else if tag == "strong" && structural_group(raw_id).is_some() {
        "product"
    } else if tag == "p" && structural_group(raw_id).is_some() {
        "product_description"
    } else if tag == "span" && structural_group(raw_id).is_some() {
        "product_badge"
    } else if ["h1", "h2", "strong"].contains(&tag) {
        "entity"
    } else if label.contains(':') {
        "state"
    } else if ["p", "span", "b"].contains(&tag) {
        "visible_text"
    } else {
        "decorative"
    }
}

fn looks_like_person_name(label: &str) -> bool {
    let words = label.split_whitespace().collect::<Vec<_>>();
    (2..=3).contains(&words.len())
        && words
            .iter()
            .all(|word| word.chars().all(|character| character.is_alphabetic()))
}
