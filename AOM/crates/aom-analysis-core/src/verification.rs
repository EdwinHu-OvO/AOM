use crate::AOMGraphSnapshot;
use aom_protocol_rs::{AOMNode, AOMNodeType};
use serde_json::Value;

pub(crate) fn observed_purpose(graph: &AOMGraphSnapshot) -> String {
    let labels = graph
        .nodes
        .iter()
        .filter_map(|node| node.label.as_deref())
        .map(str::to_lowercase)
        .collect::<Vec<_>>();
    let commerce_signals = [
        "restaurants",
        "cart",
        "orders",
        "/api/stores",
        "/api/orders",
    ]
    .into_iter()
    .filter(|needle| labels.iter().any(|label| label.contains(needle)))
    .count();
    if commerce_signals >= 2 {
        return "Browse restaurants and menus, manage delivery details, build a cart, and review or place food orders.".into();
    }
    "Observed desktop application with structured screens, controls, data, and API interactions."
        .into()
}

pub(crate) fn verify_transition(
    graph: &AOMGraphSnapshot,
    from: &AOMNode,
    to: &AOMNode,
) -> (bool, f64, Vec<String>) {
    verify_transition_nodes(&graph.nodes, from, to)
}

pub(crate) fn verify_transition_nodes(
    nodes: &[AOMNode],
    from: &AOMNode,
    to: &AOMNode,
) -> (bool, f64, Vec<String>) {
    let login_post = endpoint_nodes(nodes, "/api/login")
        .any(|node| string_feature(node, "method").is_some_and(|method| method == "POST"));
    let login_success = endpoint_nodes(nodes, "/api/login").any(|node| {
        node.features
            .get("status")
            .and_then(Value::as_u64)
            .is_some_and(|status| (200..300).contains(&status))
    });
    let screen_changed = from.id != to.id;
    let authenticated_fetch = nodes.iter().any(|node| {
        node.node_type == AOMNodeType::ApiEndpoint
            && matches!(
                node.label.as_deref(),
                Some("/api/addresses" | "/api/orders")
            )
            && node
                .features
                .get("status")
                .and_then(Value::as_u64)
                .is_some_and(|status| (200..300).contains(&status))
    });
    let reasons = [
        login_post.then_some("Observed POST /api/login".to_string()),
        login_success.then_some("Observed successful 2xx response from /api/login".to_string()),
        screen_changed.then_some(format!(
            "Observed screen change: {} -> {}",
            label(from),
            label(to)
        )),
        authenticated_fetch
            .then_some("Observed successful post-login address or order retrieval".to_string()),
    ]
    .into_iter()
    .flatten()
    .collect::<Vec<_>>();
    let score = [
        login_post,
        login_success,
        screen_changed,
        authenticated_fetch,
    ]
    .into_iter()
    .filter(|value| *value)
    .count();
    (score >= 3, score as f64 / 4.0, reasons)
}

fn label(node: &AOMNode) -> String {
    node.label.clone().unwrap_or_else(|| node.id.clone())
}

fn endpoint_nodes<'a>(nodes: &'a [AOMNode], path: &'a str) -> impl Iterator<Item = &'a AOMNode> {
    nodes.iter().filter(move |node| {
        node.node_type == AOMNodeType::ApiEndpoint && node.label.as_deref() == Some(path)
    })
}

fn string_feature(node: &AOMNode, key: &str) -> Option<String> {
    node.features
        .get(key)
        .and_then(Value::as_str)
        .map(str::to_string)
}
