use crate::{
    build_browse_state, build_cart_state, build_product_groups, build_session_state,
    contained_nodes, context_capability_verifications, context_data_flows, context_endpoints,
    context_events, current_evidence, diff_nodes, find_node, label, observed_purpose,
    string_feature, verify_transition, AOMContextPack, AOMGraphSnapshot, ContextApplication,
    ContextFact, ContextScreen, ContextTransition, ContextView,
};
use aom_protocol_rs::{AOMNode, AOMNodeType};
use serde_json::Value;

pub fn build_context_pack(graph: &AOMGraphSnapshot) -> AOMContextPack {
    let app = graph
        .nodes
        .iter()
        .find(|node| node.node_type == AOMNodeType::App)
        .expect("normalized graph must contain an app");
    let current = find_node(graph, &graph.current_screen_id);
    let current_views = contained_nodes(graph, &current.id, AOMNodeType::View);
    let current_facts = contained_nodes(graph, &current.id, AOMNodeType::DataObject);
    let previous = graph
        .previous_screen_id
        .as_ref()
        .map(|id| find_node(graph, id));
    let transition = previous.map(|screen| {
        let mut previous_objects = contained_nodes(graph, &screen.id, AOMNodeType::View);
        previous_objects.extend(contained_nodes(graph, &screen.id, AOMNodeType::DataObject));
        let mut current_objects = current_views.clone();
        current_objects.extend(current_facts.clone());
        let diff = diff_nodes(&previous_objects, &current_objects);
        let verification = verify_transition(graph, screen, current);
        ContextTransition {
            from_screen: label(screen),
            to_screen: label(current),
            observed_events: context_events(graph),
            added_objects: diff.added_node_ids.len(),
            removed_objects: diff.removed_node_ids.len(),
            verified: verification.0,
            verification_confidence: verification.1,
            verification_reasons: verification.2,
        }
    });
    let product_groups = build_product_groups(graph, &current_facts, &current_views);
    AOMContextPack {
        target_id: graph.target_id.clone(),
        application: ContextApplication {
            id: app.id.clone(),
            label: label(app),
            platform: string_feature(app, "platform").unwrap_or_else(|| "unknown".into()),
            static_component_count: graph
                .nodes
                .iter()
                .find(|node| node.id == app.id)
                .and_then(|node| node.features.get("staticNodeCount"))
                .and_then(Value::as_u64)
                .unwrap_or(0) as usize,
            observed_purpose: observed_purpose(graph),
        },
        current_screen: ContextScreen {
            id: current.id.clone(),
            label: label(current),
            confidence: current.confidence,
            views: current_views.iter().map(context_view).collect(),
            state_facts: current_facts
                .iter()
                .filter(|node| include_context_fact(node))
                .map(context_fact)
                .collect(),
            product_groups,
        },
        session: build_session_state(graph, &current_facts),
        browse: build_browse_state(&current_facts),
        cart: build_cart_state(&current_facts),
        transition,
        endpoints: context_endpoints(graph),
        data_flows: context_data_flows(graph),
        capability_verifications: context_capability_verifications(graph),
        evidence_summary: current_evidence(graph, app, current, &current_views, &current_facts),
        limitations: vec![
            "Relations marked below 1.0 confidence are deterministic inferences from observations, not direct application declarations.".into(),
            "Stable IDs are scoped to this target and semantic screen/view keys; major UI relabeling may create new identities.".into(),
            "This context describes observed structure and effects, not business capabilities or permission decisions.".into(),
        ],
    }
}

fn context_fact(node: &&AOMNode) -> ContextFact {
    ContextFact {
        id: node.id.clone(),
        kind: string_feature(node, "kind").unwrap_or_else(|| "visible_text".into()),
        label: label(node),
        confidence: node.confidence,
        currently_visible: true,
    }
}

fn include_context_fact(node: &&AOMNode) -> bool {
    matches!(
        string_feature(node, "kind").as_deref(),
        Some(
            "user_name"
                | "delivery_address"
                | "selected_store"
                | "menu_item_count"
                | "cart_item_count"
                | "cart_subtotal"
                | "open_store_count"
                | "state"
        )
    )
}

fn context_view(node: &&AOMNode) -> ContextView {
    let label = label(node);
    let (operation_kind, mutates_state, expected_effect) = view_semantics(&label);
    ContextView {
        id: node.id.clone(),
        role: string_feature(node, "role").unwrap_or_else(|| "view".into()),
        label,
        actions: node
            .features
            .get("actions")
            .and_then(Value::as_array)
            .into_iter()
            .flatten()
            .filter_map(Value::as_str)
            .map(str::to_string)
            .collect(),
        raw_reference: string_feature(node, "rawReference"),
        operation_kind,
        mutates_state,
        expected_effect,
    }
}

fn view_semantics(label: &str) -> (String, bool, Option<String>) {
    if let Some(product) = label.strip_prefix("Add ") {
        return (
            "state_change".into(),
            true,
            Some(format!(
                "Cart item count should increase after adding {product}"
            )),
        );
    }
    if label.starts_with("Search ") {
        return (
            "query".into(),
            false,
            Some("Visible restaurant or product results should update".into()),
        );
    }
    if ["Open cart", "Orders", "Addresses", "Browse"].contains(&label) {
        return (
            "navigation".into(),
            false,
            Some(format!("Current screen should navigate from {label}")),
        );
    }
    (
        "selection".into(),
        false,
        Some("Visible selection or menu content should update".into()),
    )
}
