use crate::{
    current_view_exact, current_view_starts, effect, endpoint, node_label, slot, step, step_for,
    storage, CapabilityPlan, CapabilityStepKind,
};
use aom_analysis_core::AOMGraphSnapshot;

pub(crate) fn login_plan(graph: &AOMGraphSnapshot) -> CapabilityPlan {
    let button = current_view_exact(graph, "Sign in");
    let session = storage(graph, "session.authenticated");
    CapabilityPlan {
        slots: vec![
            slot("username", "text", true, false),
            slot("password", "secret", true, true),
        ],
        steps: vec![
            step(
                "login.username",
                CapabilityStepKind::SetText,
                "Fill username",
                None,
                None,
                Some("username"),
            ),
            step(
                "login.password",
                CapabilityStepKind::SetText,
                "Fill password",
                None,
                None,
                Some("password"),
            ),
            step_for(
                "login.submit",
                CapabilityStepKind::Click,
                "Submit login form",
                button,
                None,
            ),
            step(
                "login.verify",
                CapabilityStepKind::Verify,
                "Verify authenticated session",
                None,
                session.map(node_label),
                None,
            ),
        ],
        effects: vec![effect(
            "Authenticated session should become available",
            session,
            vec![],
        )],
        has_target: button.is_some(),
        reasons: vec!["login uses credential slots and writes session.authenticated".into()],
    }
}

pub(crate) fn search_plan(graph: &AOMGraphSnapshot) -> CapabilityPlan {
    let input = current_view_starts(graph, "Search ");
    let stores = endpoint(graph, "/api/stores");
    let query = storage(graph, "search.query");
    CapabilityPlan {
        slots: vec![slot("keyword", "text", true, false)],
        steps: vec![
            step_for(
                "search.keyword",
                CapabilityStepKind::SetText,
                "Enter search keyword",
                input,
                Some("keyword"),
            ),
            step_for(
                "search.observe",
                CapabilityStepKind::Observe,
                "Observe store search request",
                stores,
                None,
            ),
            step(
                "search.verify",
                CapabilityStepKind::Verify,
                "Verify result list changed",
                None,
                query.map(node_label),
                None,
            ),
        ],
        effects: vec![
            effect("search.query should update from keyword", query, vec![]),
            effect("/api/stores results should be observed", stores, vec![]),
        ],
        has_target: input.is_some(),
        reasons: vec![
            "search_product is grounded by Search UI text, /api/stores, or search.query".into(),
        ],
    }
}

pub(crate) fn empty_plan() -> CapabilityPlan {
    CapabilityPlan {
        slots: vec![],
        steps: vec![],
        effects: vec![],
        has_target: false,
        reasons: vec![],
    }
}
