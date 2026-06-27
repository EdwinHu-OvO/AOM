use crate::{AOMGraphSnapshot, ContextBrowse, ContextCart, ContextProduct, ContextSession};
use aom_protocol_rs::AOMNode;
use serde_json::Value;
use std::collections::BTreeMap;

pub(crate) fn build_session_state(graph: &AOMGraphSnapshot, facts: &[&AOMNode]) -> ContextSession {
    let user_name = fact_label(facts, "user_name");
    let authenticated = graph.previous_screen_id.is_some()
        && graph
            .nodes
            .iter()
            .any(|node| node.label.as_deref() == Some("200 response from /api/login"));
    ContextSession {
        authenticated,
        confidence: if authenticated && user_name.is_some() {
            0.95
        } else if authenticated {
            0.85
        } else {
            0.5
        },
        user_name,
    }
}

pub(crate) fn build_browse_state(facts: &[&AOMNode]) -> ContextBrowse {
    ContextBrowse {
        selected_store: fact_label(facts, "selected_store"),
        menu_item_count: fact_label(facts, "menu_item_count")
            .and_then(|label| label.split_whitespace().next()?.parse().ok()),
        confidence: 0.9,
    }
}

pub(crate) fn build_cart_state(facts: &[&AOMNode]) -> ContextCart {
    ContextCart {
        item_count: fact_label(facts, "cart_item_count").and_then(|label| label.parse().ok()),
        subtotal: fact_label(facts, "cart_subtotal"),
        confidence: 0.95,
    }
}

pub(crate) fn build_product_groups(
    graph: &AOMGraphSnapshot,
    facts: &[&AOMNode],
    views: &[&AOMNode],
) -> Vec<ContextProduct> {
    let mut groups: BTreeMap<String, Vec<&AOMNode>> = BTreeMap::new();
    for node in facts.iter().chain(views.iter()) {
        if let Some(group) = string_feature(node, "structureGroup") {
            groups.entry(group).or_default().push(node);
        }
    }
    groups
        .into_values()
        .filter_map(|members| product_from_group(graph, &members))
        .collect()
}

fn product_from_group(graph: &AOMGraphSnapshot, members: &[&AOMNode]) -> Option<ContextProduct> {
    let product = members
        .iter()
        .find(|node| string_feature(node, "kind").as_deref() == Some("product"))?;
    let action = members.iter().find(|node| {
        string_feature(node, "role").as_deref() == Some("button")
            && node
                .label
                .as_deref()
                .is_some_and(|label| label.starts_with("Add "))
    });
    Some(ContextProduct {
        name: product.label.clone()?,
        description: member_label(members, "product_description"),
        price: member_label(members, "price"),
        action_view_id: action.map(|node| node.id.clone()).filter(|id| {
            graph
                .edges
                .iter()
                .any(|edge| edge.from == product.id && edge.to == *id)
        }),
    })
}

fn fact_label(facts: &[&AOMNode], kind: &str) -> Option<String> {
    member_label(facts, kind)
}

fn member_label(nodes: &[&AOMNode], kind: &str) -> Option<String> {
    nodes
        .iter()
        .find(|node| string_feature(node, "kind").as_deref() == Some(kind))
        .and_then(|node| node.label.clone())
}

fn string_feature(node: &AOMNode, key: &str) -> Option<String> {
    node.features
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_string)
}
