mod support;

use aom_capability::{mine_capabilities, CapabilityAvailability};
use aom_protocol_rs::CapabilityRiskLevel;
use support::{graph, graph_with_checkout, graph_with_login};

#[test]
fn search_product_declares_keyword_plan_and_expected_effects() {
    let graph = graph(0.75);
    let capabilities = mine_capabilities(&graph);
    let search = capabilities
        .iter()
        .find(|item| item.capability.name == "search_product")
        .unwrap();

    assert_eq!(search.availability, CapabilityAvailability::Available);
    assert_eq!(search.capability.risk_level, CapabilityRiskLevel::Low);
    assert!(search.automation.can_auto_execute);
    assert!(search
        .capability
        .input_slots
        .iter()
        .any(|slot| slot.name == "keyword" && slot.required));
    assert!(search
        .action_plan
        .iter()
        .any(|step| step.input_slot.as_deref() == Some("keyword")));
    assert!(search
        .expected_effects
        .iter()
        .any(|effect| effect.summary.contains("/api/stores")));
}

#[test]
fn add_to_cart_carries_verified_cart_effect() {
    let graph = graph(0.75);
    let add = mine_capabilities(&graph)
        .into_iter()
        .find(|item| item.capability.name == "add_to_cart")
        .unwrap();

    assert_eq!(add.availability, CapabilityAvailability::Available);
    assert!(add.automation.can_auto_execute);
    assert!(add
        .expected_effects
        .iter()
        .any(|effect| effect.evidence_ids == vec!["evidence:cart:verified"]));
}

#[test]
fn low_confidence_capability_is_not_auto_executable() {
    let graph = graph(0.64);
    let add = mine_capabilities(&graph)
        .into_iter()
        .find(|item| item.capability.name == "add_to_cart")
        .unwrap();

    assert_eq!(add.availability, CapabilityAvailability::LowConfidence);
    assert!(!add.automation.can_auto_execute);
}

#[test]
fn historical_login_is_not_currently_available() {
    let graph = graph_with_login(false);
    let login = mine_capabilities(&graph)
        .into_iter()
        .find(|item| item.capability.name == "login")
        .unwrap();

    assert_eq!(login.availability, CapabilityAvailability::MissingTarget);
    assert!(!login.automation.can_auto_execute);
    assert!(login
        .action_plan
        .iter()
        .find(|step| step.step_id == "login.submit")
        .unwrap()
        .target_node_id
        .is_none());
}

#[test]
fn checkout_prepare_is_high_risk_and_not_auto_executable() {
    let graph = graph_with_checkout();
    let checkout = mine_capabilities(&graph)
        .into_iter()
        .find(|item| item.capability.name == "checkout_prepare")
        .unwrap();

    assert_eq!(checkout.availability, CapabilityAvailability::Available);
    assert_eq!(checkout.capability.risk_level, CapabilityRiskLevel::High);
    assert!(!checkout.automation.can_auto_execute);
    assert!(checkout
        .action_plan
        .iter()
        .any(|step| step.target_label.as_deref() == Some("Place order")));
}
