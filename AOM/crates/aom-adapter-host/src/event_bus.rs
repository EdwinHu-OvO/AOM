use crate::{AdapterError, AdapterResult};
use aom_protocol_rs::RawEvent;
use std::collections::{BTreeMap, VecDeque};

#[derive(Debug, Default)]
pub struct RawEventBus {
    events: BTreeMap<String, VecDeque<RawEvent>>,
    last_sequence: BTreeMap<String, u64>,
}

impl RawEventBus {
    pub fn publish(&mut self, event: RawEvent) -> AdapterResult<()> {
        self.publish_batch(vec![event])
    }

    pub fn publish_batch(&mut self, events: Vec<RawEvent>) -> AdapterResult<()> {
        let mut sequences = self.last_sequence.clone();
        for event in &events {
            validate_sequence(&mut sequences, event)?;
        }
        for event in events {
            self.events
                .entry(event.target_id.clone())
                .or_default()
                .push_back(event);
        }
        self.last_sequence = sequences;
        Ok(())
    }

    pub fn drain_target(&mut self, target_id: &str) -> Vec<RawEvent> {
        self.events
            .remove(target_id)
            .unwrap_or_default()
            .into_iter()
            .collect()
    }

    pub fn len(&self) -> usize {
        self.events.values().map(VecDeque::len).sum()
    }

    pub fn is_empty(&self) -> bool {
        self.events.is_empty()
    }
}

fn validate_sequence(sequences: &mut BTreeMap<String, u64>, event: &RawEvent) -> AdapterResult<()> {
    if let Some(previous) = sequences.get(&event.target_id) {
        if event.sequence <= *previous {
            return Err(AdapterError::InvalidSequence {
                target_id: event.target_id.clone(),
                previous: *previous,
                received: event.sequence,
            });
        }
    }
    sequences.insert(event.target_id.clone(), event.sequence);
    Ok(())
}
