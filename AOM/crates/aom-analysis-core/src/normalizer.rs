use crate::{
    add_capabilities_and_storage, add_data_flows, add_events, add_static_endpoints, add_surface,
    deduplicate, edge, node, normalize_surface, stable_id, verify_capability_effects,
    verify_transition_nodes, AOMGraphSnapshot, EvidenceManager,
};
use aom_protocol_rs::{AOMEdgeType, AOMNodeType};
use serde_json::json;

pub struct Normalizer;

impl Normalizer {
    pub fn normalize(input: crate::AnalysisInput) -> AOMGraphSnapshot {
        let timestamp = input
            .after
            .as_ref()
            .map_or(input.before.timestamp, |item| item.timestamp);
        let mut evidence = EvidenceManager::default();
        evidence.import(&input.target_id, timestamp, &input.analyzer_evidence);
        let app_id = stable_id(&input.target_id, &AOMNodeType::App, "application");
        let app_evidence = evidence.observed(
            &input.target_id,
            input.static_snapshot.timestamp,
            "Application artifact and component graph observed",
            input.static_snapshot.evidence_ids.clone(),
        );
        let app_label = application_label(&input);
        let mut nodes = vec![node(
            app_id.clone(),
            AOMNodeType::App,
            Some(app_label),
            crate::json_map([
                ("platform", json!(input.static_snapshot.platform)),
                ("staticNodeCount", json!(input.static_snapshot.nodes.len())),
            ]),
            vec![app_evidence],
            1.0,
        )];
        let mut edges = vec![];
        add_static_endpoints(&input, &app_id, &mut nodes, &mut edges, &mut evidence);
        let before = normalize_surface(&input.target_id, &input.before, &mut evidence);
        let after = input
            .after
            .as_ref()
            .map(|snapshot| normalize_surface(&input.target_id, snapshot, &mut evidence));
        let current = after.as_ref().unwrap_or(&before);
        add_surface(&app_id, &before, &mut nodes, &mut edges);
        if let Some(after) = &after {
            add_surface(&app_id, after, &mut nodes, &mut edges);
        }
        let mut ordered_events = input.events.clone();
        ordered_events.sort_by_key(|event| (event.sequence, event.timestamp));
        add_events(
            &input.target_id,
            &ordered_events,
            &before,
            current,
            &app_id,
            &mut nodes,
            &mut edges,
            &mut evidence,
        );
        if before.screen.id != current.screen.id {
            let event_evidence = ordered_events
                .iter()
                .flat_map(|event| event.evidence_ids.clone())
                .collect::<Vec<_>>();
            let transition_evidence = evidence.inferred(
                &input.target_id,
                timestamp,
                format!(
                    "Screen transition inferred from ordered snapshots: {} -> {}",
                    before.screen.label.as_deref().unwrap_or("unknown"),
                    current.screen.label.as_deref().unwrap_or("unknown")
                ),
                event_evidence.clone(),
            );
            edges.push(edge(
                &before.screen.id,
                &current.screen.id,
                AOMEdgeType::NavigatesTo,
                vec![transition_evidence],
                0.85,
            ));
            let verification = verify_transition_nodes(&nodes, &before.screen, &current.screen);
            if verification.0 {
                let verified_evidence = evidence.verified(
                    &input.target_id,
                    timestamp,
                    format!(
                        "Screen transition verified: {} -> {}",
                        before.screen.label.as_deref().unwrap_or("unknown"),
                        current.screen.label.as_deref().unwrap_or("unknown")
                    ),
                    event_evidence,
                );
                edges.push(edge(
                    &before.screen.id,
                    &current.screen.id,
                    AOMEdgeType::NavigatesTo,
                    vec![verified_evidence],
                    verification.1,
                ));
            }
        }
        add_capabilities_and_storage(
            &input.target_id,
            timestamp,
            &app_id,
            &current.screen.id,
            &mut nodes,
            &mut edges,
            &mut evidence,
        );
        verify_capability_effects(
            &input.target_id,
            timestamp,
            &before,
            current,
            &ordered_events,
            &nodes,
            &mut edges,
            &mut evidence,
        );
        add_data_flows(
            &input.target_id,
            timestamp,
            &ordered_events,
            current,
            &mut nodes,
            &mut edges,
            &mut evidence,
        );
        deduplicate(&mut nodes, &mut edges);
        AOMGraphSnapshot {
            graph_id: format!("graph:{}:{timestamp}", input.target_id),
            target_id: input.target_id,
            generated_at: timestamp,
            current_screen_id: current.screen.id.clone(),
            previous_screen_id: after.as_ref().map(|_| before.screen.id),
            nodes,
            edges,
            evidence: evidence.into_records(),
        }
    }
}

fn application_label(input: &crate::AnalysisInput) -> String {
    input
        .before
        .nodes
        .iter()
        .chain(
            input
                .after
                .iter()
                .flat_map(|snapshot| snapshot.nodes.iter()),
        )
        .filter_map(|node| node.label.as_deref())
        .map(str::trim)
        .find(|label| !label.is_empty() && label.len() <= 40)
        .unwrap_or(&input.target_id)
        .to_string()
}
