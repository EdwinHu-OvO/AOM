use crate::{
    add_to_cart_plan, checkout_plan, detail_plan, empty_plan, login_plan, search_plan,
    CapabilityPlan,
};
use aom_analysis_core::AOMGraphSnapshot;
use aom_protocol_rs::AOMCapability;

pub(crate) fn plan_for(
    name: &str,
    base: &AOMCapability,
    graph: &AOMGraphSnapshot,
) -> CapabilityPlan {
    match name {
        "login" => login_plan(graph),
        "search_product" => search_plan(graph),
        "view_product_detail" => detail_plan(graph),
        "add_to_cart" => add_to_cart_plan(base, graph),
        "checkout_prepare" => checkout_plan(graph),
        _ => empty_plan(),
    }
}
