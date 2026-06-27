use aom_analysis_core::{AOMGraphSnapshot, AnalysisEvidence, EvidenceKind};
use aom_protocol_rs::{AOMEdge, AOMEdgeType, AOMNode, AOMNodeType};
use serde_json::{json, Value};
use std::collections::BTreeMap;

pub fn graph(capability_confidence: f64) -> AOMGraphSnapshot {
    let screen = node("aom:screen:browse", AOMNodeType::Screen, "Browse", [], 0.9);
    let search = node(
        "aom:capability:search",
        AOMNodeType::Capability,
        "search_product",
        [
            ("description", json!("Search products")),
            ("riskLevel", json!("low")),
        ],
        capability_confidence,
    );
    let add = node(
        "aom:capability:add",
        AOMNodeType::Capability,
        "add_to_cart",
        [
            ("description", json!("Add product")),
            ("riskLevel", json!("low")),
        ],
        capability_confidence,
    );
    let search_view = node(
        "aom:view:search",
        AOMNodeType::View,
        "Search food or restaurants",
        [("actions", json!(["set_text", "wait_for"]))],
        0.9,
    );
    let add_view = node(
        "aom:view:add",
        AOMNodeType::View,
        "Add Tonkotsu Ramen",
        [("actions", json!(["click"]))],
        0.9,
    );
    let stores = node(
        "aom:endpoint:stores",
        AOMNodeType::ApiEndpoint,
        "/api/stores",
        [],
        0.9,
    );
    let query = node(
        "aom:storage:search",
        AOMNodeType::StorageKey,
        "Search query",
        [("key", json!("search.query"))],
        0.7,
    );
    let cart = node(
        "aom:storage:cart",
        AOMNodeType::StorageKey,
        "Cart items",
        [("key", json!("cart.items"))],
        0.7,
    );
    AOMGraphSnapshot {
        graph_id: "graph:capability".into(),
        target_id: "target:capability".into(),
        generated_at: 1,
        current_screen_id: "aom:screen:browse".into(),
        previous_screen_id: None,
        edges: vec![
            edge(&screen.id, &search_view.id, AOMEdgeType::Contains),
            edge(&screen.id, &add_view.id, AOMEdgeType::Contains),
            edge(&search.id, &query.id, AOMEdgeType::Writes),
            edge(&search.id, &stores.id, AOMEdgeType::Requests),
            edge(&add.id, &cart.id, AOMEdgeType::Updates),
        ],
        nodes: vec![
            screen,
            search,
            add,
            search_view,
            add_view,
            stores,
            query,
            cart,
        ],
        evidence: vec![AnalysisEvidence {
            evidence_id: "evidence:cart:verified".into(),
            target_id: "target:capability".into(),
            kind: EvidenceKind::Verified,
            summary: "Capability effect verified: add_to_cart updated cart.items".into(),
            timestamp: 1,
            source_ids: vec![],
            derived_from: vec![],
            metadata: BTreeMap::new(),
        }],
    }
}

pub fn graph_with_login(current_login: bool) -> AOMGraphSnapshot {
    let mut graph = graph(0.75);
    let login = node(
        "aom:capability:login",
        AOMNodeType::Capability,
        "login",
        [
            ("description", json!("Authenticate")),
            ("riskLevel", json!("medium")),
        ],
        0.75,
    );
    let login_view = node(
        "aom:view:login",
        AOMNodeType::View,
        "Sign in",
        [("actions", json!(["click"]))],
        0.9,
    );
    graph.nodes.push(login);
    graph.nodes.push(login_view.clone());
    if current_login {
        graph.edges.push(edge(
            "aom:screen:browse",
            &login_view.id,
            AOMEdgeType::Contains,
        ));
    }
    graph
}

pub fn graph_with_checkout() -> AOMGraphSnapshot {
    let mut graph = graph(0.75);
    let checkout = node(
        "aom:capability:checkout",
        AOMNodeType::Capability,
        "checkout_prepare",
        [
            ("description", json!("Prepare order")),
            ("riskLevel", json!("high")),
        ],
        0.75,
    );
    let checkout_view = node(
        "aom:view:checkout",
        AOMNodeType::View,
        "Place order",
        [("actions", json!(["click"]))],
        0.9,
    );
    let orders = node(
        "aom:endpoint:orders",
        AOMNodeType::ApiEndpoint,
        "/api/orders",
        [],
        0.9,
    );
    graph
        .nodes
        .extend([checkout, checkout_view.clone(), orders]);
    graph.edges.push(edge(
        "aom:screen:browse",
        &checkout_view.id,
        AOMEdgeType::Contains,
    ));
    graph
}

fn node<const N: usize>(
    id: &str,
    node_type: AOMNodeType,
    label: &str,
    features: [(&str, Value); N],
    confidence: f64,
) -> AOMNode {
    AOMNode {
        id: id.into(),
        node_type,
        label: Some(label.into()),
        features: features
            .into_iter()
            .map(|(key, value)| (key.to_string(), value))
            .collect(),
        evidence_ids: vec![format!("evidence:{id}")],
        confidence,
    }
}

fn edge(from: &str, to: &str, edge_type: AOMEdgeType) -> AOMEdge {
    AOMEdge {
        id: format!("edge:{from}:{to}"),
        from: from.into(),
        to: to.into(),
        edge_type,
        confidence: 0.9,
        evidence_ids: vec!["evidence:cart:verified".into()],
    }
}
