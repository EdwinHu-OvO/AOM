use crate::{
    add_cart_capability, add_checkout_capability, add_detail_capability, add_login_capability,
    add_search_capability, endpoint, has_fact, EvidenceManager,
};
use aom_protocol_rs::{AOMEdge, AOMNode};

pub(crate) fn add_capabilities_and_storage(
    target_id: &str,
    timestamp: u64,
    app_id: &str,
    current_screen_id: &str,
    nodes: &mut Vec<AOMNode>,
    edges: &mut Vec<AOMEdge>,
    evidence: &mut EvidenceManager,
) {
    let labels = nodes
        .iter()
        .filter_map(|node| node.label.as_deref())
        .collect::<Vec<_>>();
    let has_user = has_fact(nodes, "user_name");
    let has_cart =
        has_fact(nodes, "cart_item_count") || labels.iter().any(|label| *label == "Open cart");
    let has_search = labels.iter().any(|label| label.starts_with("Search "));
    let has_add = labels.iter().any(|label| label.starts_with("Add "));
    let detail_view_id = detail_view_id(nodes);
    let checkout_view_id = checkout_view_id(nodes);
    let login_endpoint = endpoint(nodes, "/api/login");
    let stores_endpoint = endpoint(nodes, "/api/stores");
    let orders_endpoint = endpoint(nodes, "/api/orders");

    if has_user || login_endpoint.is_some() {
        add_login_capability(
            target_id,
            timestamp,
            app_id,
            current_screen_id,
            login_endpoint,
            nodes,
            edges,
            evidence,
        );
    }
    if has_search {
        add_search_capability(
            target_id,
            timestamp,
            app_id,
            stores_endpoint,
            nodes,
            edges,
            evidence,
        );
    }
    if let Some(detail_view_id) = detail_view_id {
        add_detail_capability(
            target_id,
            timestamp,
            app_id,
            detail_view_id,
            nodes,
            edges,
            evidence,
        );
    }
    if has_cart || has_add {
        add_cart_capability(
            target_id,
            timestamp,
            app_id,
            current_screen_id,
            has_add,
            nodes,
            edges,
            evidence,
        );
    }
    if let Some(checkout_view_id) = checkout_view_id {
        add_checkout_capability(
            target_id,
            timestamp,
            app_id,
            checkout_view_id,
            orders_endpoint,
            nodes,
            edges,
            evidence,
        );
    }
}

fn detail_view_id(nodes: &[AOMNode]) -> Option<String> {
    let detail_labels = nodes
        .iter()
        .filter(|node| {
            node.features
                .get("kind")
                .and_then(|value| value.as_str())
                .is_some_and(|kind| matches!(kind, "entity" | "selected_store" | "product"))
        })
        .filter_map(|node| node.label.as_deref())
        .collect::<Vec<_>>();
    nodes
        .iter()
        .find(|node| {
            node.features
                .get("actions")
                .and_then(|value| value.as_array())
                .is_some_and(|actions| {
                    actions
                        .iter()
                        .any(|action| action.as_str() == Some("click"))
                })
                && node
                    .label
                    .as_deref()
                    .is_some_and(|label| detail_labels.contains(&label))
        })
        .map(|node| node.id.clone())
}

fn checkout_view_id(nodes: &[AOMNode]) -> Option<String> {
    nodes
        .iter()
        .find(|node| {
            node.label
                .as_deref()
                .is_some_and(|label| label == "Place order" || label == "Checkout")
        })
        .map(|node| node.id.clone())
}
