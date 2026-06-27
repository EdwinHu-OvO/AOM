use crate::GraphDiff;
use aom_protocol_rs::AOMNode;
use std::collections::{BTreeMap, BTreeSet};

pub fn diff_nodes(before: &[&AOMNode], after: &[&AOMNode]) -> GraphDiff {
    let left = by_id(before);
    let right = by_id(after);
    let left_ids: BTreeSet<_> = left.keys().cloned().collect();
    let right_ids: BTreeSet<_> = right.keys().cloned().collect();
    let retained: Vec<_> = left_ids.intersection(&right_ids).cloned().collect();
    GraphDiff {
        added_node_ids: right_ids.difference(&left_ids).cloned().collect(),
        removed_node_ids: left_ids.difference(&right_ids).cloned().collect(),
        changed_node_ids: retained
            .iter()
            .filter(|id| left.get(*id) != right.get(*id))
            .cloned()
            .collect(),
        retained_node_ids: retained,
    }
}

fn by_id<'a>(nodes: &[&'a AOMNode]) -> BTreeMap<String, &'a AOMNode> {
    nodes.iter().map(|node| (node.id.clone(), *node)).collect()
}
