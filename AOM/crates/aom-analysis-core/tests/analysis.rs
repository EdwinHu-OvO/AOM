mod search_support;
mod support;

use aom_analysis_core::{build_context_pack, EvidenceKind, Normalizer};
use aom_protocol_rs::{AOMEdgeType, AOMNodeType};
use search_support::search_input;
use support::{after_snapshot, input};

#[test]
fn semantic_view_ids_survive_raw_path_changes() {
    let first = Normalizer::normalize(input("dom:first", None));
    let second = Normalizer::normalize(input("dom:second", None));
    let first_id = first
        .nodes
        .iter()
        .find(|node| node.label.as_deref() == Some("Sign in"))
        .unwrap()
        .id
        .clone();
    let second_id = second
        .nodes
        .iter()
        .find(|node| node.label.as_deref() == Some("Sign in"))
        .unwrap()
        .id
        .clone();

    assert_eq!(first_id, second_id);
}

#[test]
fn context_pack_explains_and_verifies_login_transition() {
    let graph = Normalizer::normalize(input("dom:login", Some(after_snapshot())));
    let context = build_context_pack(&graph);
    let transition = context.transition.unwrap();
    let login = context
        .endpoints
        .iter()
        .find(|endpoint| endpoint.path == "/api/login")
        .unwrap();

    assert_eq!(context.application.label, "PlateRun");
    assert!(context.application.observed_purpose.contains("food orders"));
    assert_eq!(context.current_screen.label, "Browse restaurants");
    assert!(context
        .current_screen
        .state_facts
        .iter()
        .any(|fact| fact.label == "Mina Chen"));
    assert!(context.session.authenticated);
    assert_eq!(context.session.user_name.as_deref(), Some("Mina Chen"));
    assert_eq!(
        context.browse.selected_store.as_deref(),
        Some("Tokyo Ramen Lab")
    );
    assert_eq!(context.browse.menu_item_count, Some(3));
    assert_eq!(context.cart.item_count, Some(0));
    assert_eq!(context.cart.subtotal.as_deref(), Some("$0.00"));
    assert_eq!(context.current_screen.product_groups.len(), 1);
    assert_eq!(
        context.current_screen.product_groups[0].price.as_deref(),
        Some("$13.80")
    );
    assert!(context.current_screen.product_groups[0]
        .action_view_id
        .is_some());
    let add_product = context
        .current_screen
        .views
        .iter()
        .find(|view| view.label == "Add Tonkotsu Ramen")
        .unwrap();
    assert!(add_product.mutates_state);
    assert_eq!(add_product.operation_kind, "state_change");
    assert!(add_product
        .expected_effect
        .as_deref()
        .is_some_and(|effect| effect.contains("Cart item count")));
    assert!(login.statically_discovered);
    assert!(login.runtime_observed);
    assert_eq!(login.observed_methods, vec!["POST"]);
    assert_eq!(login.observed_statuses, vec![200]);
    assert!(transition.verified);
    assert_eq!(transition.verification_confidence, 1.0);
    assert!(graph
        .evidence
        .iter()
        .any(|record| record.kind == EvidenceKind::Verified));
    assert!(graph
        .nodes
        .iter()
        .any(|node| node.node_type == AOMNodeType::Capability
            && node.label.as_deref() == Some("login")));
    assert!(graph
        .nodes
        .iter()
        .any(|node| node.node_type == AOMNodeType::StorageKey
            && node.features.get("key").and_then(|value| value.as_str()) == Some("cart.items")));
    assert!(graph
        .edges
        .iter()
        .any(|edge| edge.edge_type == AOMEdgeType::Reads));
    assert!(graph
        .edges
        .iter()
        .any(|edge| edge.edge_type == AOMEdgeType::Writes));
    assert_eq!(
        transition
            .observed_events
            .iter()
            .map(|event| event.sequence)
            .collect::<Vec<_>>(),
        vec![1, 2, 3]
    );
}

#[test]
fn search_input_links_view_endpoint_diff_and_capability() {
    let graph = Normalizer::normalize(search_input());
    let search_view = graph
        .nodes
        .iter()
        .find(|node| node.label.as_deref() == Some("Search food or restaurants"))
        .unwrap();
    let stores = graph
        .nodes
        .iter()
        .find(|node| {
            node.node_type == AOMNodeType::ApiEndpoint
                && node.label.as_deref() == Some("/api/stores")
        })
        .unwrap();
    let search_event = graph
        .nodes
        .iter()
        .find(|node| node.label.as_deref() == Some("User text input"))
        .unwrap();
    let state_event = graph
        .nodes
        .iter()
        .find(|node| node.label.as_deref() == Some("DOM mutation observed (3 records)"))
        .unwrap();

    assert!(
        stores
            .features
            .get("runtimeObserved")
            .and_then(|value| value.as_bool())
            == Some(true)
    );
    assert!(graph.edges.iter().any(|edge| {
        edge.from == search_view.id
            && edge.to == search_event.id
            && edge.edge_type == AOMEdgeType::Triggers
    }));
    assert!(graph
        .edges
        .iter()
        .any(|edge| { edge.to == stores.id && edge.edge_type == AOMEdgeType::Requests }));
    assert!(graph
        .edges
        .iter()
        .any(|edge| { edge.from == state_event.id && edge.edge_type == AOMEdgeType::HasEffect }));
    assert!(graph.nodes.iter().any(|node| {
        node.node_type == AOMNodeType::Capability && node.label.as_deref() == Some("search_product")
    }));
    assert!(graph.nodes.iter().any(|node| {
        node.node_type == AOMNodeType::StorageKey
            && node.features.get("key").and_then(|value| value.as_str()) == Some("search.query")
    }));
}
