use crate::{json_map, structural_group};
use aom_protocol_rs::RawRuntimeNode;
use serde_json::{json, Value};
use std::collections::BTreeMap;

pub(crate) fn classify_screen(nodes: &[RawRuntimeNode]) -> (String, String, f64) {
    let labels = nodes
        .iter()
        .filter_map(|node| node.label.as_deref())
        .map(str::to_lowercase)
        .collect::<Vec<_>>();
    let has_password = nodes
        .iter()
        .any(|node| node.attributes.get("inputType").and_then(Value::as_str) == Some("password"));
    if has_password && labels.iter().any(|label| label.contains("sign in")) {
        return ("authentication".into(), "Sign in".into(), 0.98);
    }
    for (needle, key, label) in [
        ("your cart", "cart", "Cart"),
        ("delivery addresses", "addresses", "Addresses"),
        ("order history", "orders", "Orders"),
        ("restaurants", "browse", "Browse restaurants"),
    ] {
        if labels.iter().any(|value| value.contains(needle)) {
            return (key.into(), label.into(), 0.92);
        }
    }
    ("unknown-surface".into(), "Application screen".into(), 0.45)
}

pub(crate) fn view_descriptor(node: &RawRuntimeNode) -> Option<(String, &RawRuntimeNode)> {
    let role = node.role.as_deref()?;
    if !["button", "input", "link", "select", "textbox"].contains(&role) {
        return None;
    }
    Some((
        format!(
            "{}|{}|{}",
            role,
            view_label(node),
            node.attributes
                .get("inputType")
                .and_then(Value::as_str)
                .unwrap_or("")
        ),
        node,
    ))
}

pub(crate) fn view_label(node: &RawRuntimeNode) -> String {
    node.label
        .as_deref()
        .filter(|label| !label.trim().is_empty())
        .map(str::to_string)
        .or_else(|| {
            node.attributes
                .get("inputType")
                .and_then(Value::as_str)
                .map(|kind| format!("{kind} input"))
        })
        .unwrap_or_else(|| node.role.clone().unwrap_or_else(|| "view".into()))
}

pub(crate) fn view_features(node: &RawRuntimeNode) -> BTreeMap<String, Value> {
    let role = node.role.clone().unwrap_or_else(|| "view".into());
    let actions = match role.as_str() {
        "button" | "link" => vec!["click"],
        "input" | "textbox" => vec!["set_text", "wait_for"],
        "select" => vec!["click"],
        _ => vec![],
    };
    let mut features = json_map([
        ("role", json!(role)),
        ("actions", json!(actions)),
        ("rawReference", json!(node.raw_id)),
        (
            "inputType",
            node.attributes
                .get("inputType")
                .cloned()
                .unwrap_or(Value::Null),
        ),
    ]);
    if let Some(group) = structural_group(&node.raw_id) {
        features.insert("structureGroup".into(), json!(group));
    }
    features
}
