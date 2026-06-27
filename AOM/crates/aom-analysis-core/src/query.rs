use crate::AOMGraphSnapshot;
use aom_protocol_rs::{AOMNode, AOMNodeType};

#[derive(Debug, Clone, Default)]
pub struct AnalysisQuery {
    pub node_type: Option<AOMNodeType>,
    pub text: Option<String>,
}

pub fn query<'a>(graph: &'a AOMGraphSnapshot, query: &AnalysisQuery) -> Vec<&'a AOMNode> {
    graph
        .nodes
        .iter()
        .filter(|node| {
            query
                .node_type
                .as_ref()
                .is_none_or(|node_type| &node.node_type == node_type)
        })
        .filter(|node| {
            query.text.as_ref().is_none_or(|text| {
                let needle = text.to_lowercase();
                node.label
                    .as_deref()
                    .unwrap_or_default()
                    .to_lowercase()
                    .contains(&needle)
                    || node
                        .features
                        .values()
                        .any(|value| value.to_string().to_lowercase().contains(&needle))
            })
        })
        .collect()
}
