mod search_support;

use aom_analysis_core::{build_context_pack, Normalizer};
use aom_protocol_rs::{AOMEdgeType, AOMNodeType};
use search_support::search_input;

#[test]
fn search_input_links_field_level_data_flow() {
    let graph = Normalizer::normalize(search_input());
    let input_field = graph
        .nodes
        .iter()
        .find(|node| field_kind(node) == Some("input_value"))
        .unwrap();
    let query_field = graph
        .nodes
        .iter()
        .find(|node| field_kind(node) == Some("request_query"))
        .unwrap();
    let request_message = graph
        .nodes
        .iter()
        .find(|node| message_kind(node) == Some("request"))
        .unwrap();
    let response_message = graph
        .nodes
        .iter()
        .find(|node| message_kind(node) == Some("response"))
        .unwrap();

    assert!(has_edge(
        &graph,
        &input_field.id,
        &query_field.id,
        AOMEdgeType::FlowsTo
    ));
    assert!(has_edge(
        &graph,
        &query_field.id,
        &request_message.id,
        AOMEdgeType::FlowsTo
    ));
    assert!(has_edge(
        &graph,
        &request_message.id,
        &response_message.id,
        AOMEdgeType::FlowsTo
    ));
    assert!(graph
        .edges
        .iter()
        .any(|edge| edge.from == response_message.id && edge.edge_type == AOMEdgeType::RendersAs));
    let context = build_context_pack(&graph);
    assert!(context
        .data_flows
        .iter()
        .any(|flow| flow.from_label.contains("Search") && flow.to_label.contains("query")));
}

fn field_kind(node: &aom_protocol_rs::AOMNode) -> Option<&str> {
    if node.node_type != AOMNodeType::DataField {
        return None;
    }
    node.features
        .get("fieldKind")
        .and_then(|value| value.as_str())
}

fn message_kind(node: &aom_protocol_rs::AOMNode) -> Option<&str> {
    if node.node_type != AOMNodeType::Message {
        return None;
    }
    node.features
        .get("messageKind")
        .and_then(|value| value.as_str())
}

fn has_edge(
    graph: &aom_analysis_core::AOMGraphSnapshot,
    from: &str,
    to: &str,
    edge_type: AOMEdgeType,
) -> bool {
    graph
        .edges
        .iter()
        .any(|edge| edge.from == from && edge.to == to && edge.edge_type == edge_type)
}
