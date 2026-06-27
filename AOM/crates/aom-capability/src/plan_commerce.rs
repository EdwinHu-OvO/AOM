use crate::{
    current_view_exact, current_view_matching, current_view_starts, effect, endpoint, node_label,
    slot, step, step_for, storage, verified_update_evidence, CapabilityPlan, CapabilityStepKind,
};
use aom_analysis_core::AOMGraphSnapshot;
use aom_protocol_rs::AOMCapability;

pub(crate) fn detail_plan(graph: &AOMGraphSnapshot) -> CapabilityPlan {
    let detail_labels = graph
        .nodes
        .iter()
        .filter(|node| {
            node.features
                .get("kind")
                .and_then(|value| value.as_str())
                .is_some_and(|kind| matches!(kind, "entity" | "selected_store" | "product"))
        })
        .filter_map(|node| node.label.as_deref())
        .collect::<Vec<_>>();
    let store = current_view_matching(graph, |node| {
        node.label
            .as_deref()
            .is_some_and(|label| detail_labels.contains(&label))
    });
    CapabilityPlan {
        slots: vec![slot("item", "object_ref", false, false)],
        steps: vec![
            step_for(
                "detail.open",
                CapabilityStepKind::Click,
                "Open selected item detail",
                store,
                Some("item"),
            ),
            step(
                "detail.verify",
                CapabilityStepKind::Verify,
                "Verify detail screen or menu section is visible",
                None,
                None,
                None,
            ),
        ],
        effects: vec![effect(
            "Selected item or store detail should be visible",
            store,
            vec![],
        )],
        has_target: store.is_some(),
        reasons: vec![
            "view_product_detail is available when navigable product or store views are present"
                .into(),
        ],
    }
}

pub(crate) fn add_to_cart_plan(base: &AOMCapability, graph: &AOMGraphSnapshot) -> CapabilityPlan {
    let add = current_view_starts(graph, "Add ");
    let cart = storage(graph, "cart.items");
    let evidence = cart
        .map(|node| verified_update_evidence(graph, &base.id, &node.id))
        .unwrap_or_default();
    CapabilityPlan {
        slots: vec![slot("product", "object_ref", false, false)],
        steps: vec![
            step_for(
                "cart.add",
                CapabilityStepKind::Click,
                "Click product add control",
                add,
                Some("product"),
            ),
            step(
                "cart.observe",
                CapabilityStepKind::Observe,
                "Observe cart state change",
                None,
                cart.map(node_label),
                None,
            ),
            step(
                "cart.verify",
                CapabilityStepKind::Verify,
                "Verify cart.items changed",
                None,
                cart.map(node_label),
                None,
            ),
        ],
        effects: vec![effect(
            "cart.items should increase or update",
            cart,
            evidence,
        )],
        has_target: add.is_some() && cart.is_some(),
        reasons: vec!["add_to_cart is grounded by Add controls and cart.items storage".into()],
    }
}

pub(crate) fn checkout_plan(graph: &AOMGraphSnapshot) -> CapabilityPlan {
    let checkout =
        current_view_exact(graph, "Place order").or_else(|| current_view_exact(graph, "Checkout"));
    let orders = endpoint(graph, "/api/orders");
    CapabilityPlan {
        slots: vec![],
        steps: vec![
            step_for(
                "checkout.submit",
                CapabilityStepKind::Click,
                "Prepare order submission",
                checkout,
                None,
            ),
            step_for(
                "checkout.observe",
                CapabilityStepKind::Observe,
                "Observe order API request",
                orders,
                None,
            ),
            step(
                "checkout.verify",
                CapabilityStepKind::Verify,
                "Verify order preview or order response",
                None,
                None,
                None,
            ),
        ],
        effects: vec![effect(
            "Order request should be prepared but not auto-submitted",
            orders,
            vec![],
        )],
        has_target: checkout.is_some(),
        reasons: vec![
            "checkout_prepare is treated as high-risk and requires later Gateway confirmation"
                .into(),
        ],
    }
}
