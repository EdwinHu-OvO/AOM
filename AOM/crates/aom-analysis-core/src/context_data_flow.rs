use crate::{label, AOMGraphSnapshot, ContextDataFlow};
use aom_protocol_rs::AOMEdgeType;

pub(crate) fn context_data_flows(graph: &AOMGraphSnapshot) -> Vec<ContextDataFlow> {
    graph
        .edges
        .iter()
        .filter(|edge| {
            matches!(
                edge.edge_type,
                AOMEdgeType::FlowsTo
                    | AOMEdgeType::DerivesFrom
                    | AOMEdgeType::RendersAs
                    | AOMEdgeType::Updates
            )
        })
        .filter_map(|edge| {
            let from = graph.nodes.iter().find(|node| node.id == edge.from)?;
            let to = graph.nodes.iter().find(|node| node.id == edge.to)?;
            Some(ContextDataFlow {
                from_id: from.id.clone(),
                from_label: label(from),
                to_id: to.id.clone(),
                to_label: label(to),
                relation: relation_name(&edge.edge_type).into(),
                confidence: edge.confidence,
            })
        })
        .take(40)
        .collect()
}

fn relation_name(edge_type: &AOMEdgeType) -> &'static str {
    match edge_type {
        AOMEdgeType::FlowsTo => "flows_to",
        AOMEdgeType::DerivesFrom => "derives_from",
        AOMEdgeType::RendersAs => "renders_as",
        AOMEdgeType::Updates => "updates",
        _ => "relation",
    }
}
