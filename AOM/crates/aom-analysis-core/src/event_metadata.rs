use crate::json_map;
use aom_protocol_rs::{RawEvent, RawEventType};
use serde_json::{json, Value};
use std::collections::BTreeMap;

pub(crate) struct EndpointObservation {
    pub path: String,
    pub features: BTreeMap<String, Value>,
}

pub(crate) fn event_features(raw: &RawEvent) -> BTreeMap<String, Value> {
    let mut features = json_map([
        ("sequence", json!(raw.sequence)),
        ("timestamp", json!(raw.timestamp)),
        ("eventType", json!(format!("{:?}", raw.event_type))),
    ]);
    if let Some(metadata) = raw.payload.get("metadata").and_then(Value::as_object) {
        for key in ["requestId", "method", "status"] {
            if let Some(value) = metadata.get(key) {
                features.insert(key.into(), value.clone());
            }
        }
        if let Some(path) = metadata
            .get("url")
            .and_then(Value::as_str)
            .and_then(url_path)
        {
            features.insert("path".into(), json!(path));
        }
    }
    if let Some(value) = raw.payload.get("mutationCount") {
        features.insert("mutationCount".into(), value.clone());
    }
    features
}

pub(crate) fn endpoint_observation(event: &RawEvent) -> Option<EndpointObservation> {
    if !matches!(
        event.event_type,
        RawEventType::NetworkRequest | RawEventType::NetworkResponse
    ) {
        return None;
    }
    let metadata = event.payload.get("metadata")?.as_object()?;
    let path = metadata
        .get("url")
        .and_then(Value::as_str)
        .and_then(url_path)?;
    Some(EndpointObservation {
        path,
        features: metadata
            .iter()
            .map(|(key, value)| (key.clone(), value.clone()))
            .collect(),
    })
}

pub(crate) fn event_label(event: &RawEvent) -> String {
    if let Some(metadata) = event.payload.get("metadata").and_then(Value::as_object) {
        let path = metadata
            .get("url")
            .and_then(Value::as_str)
            .and_then(url_path);
        if let (Some(method), Some(path)) = (
            metadata.get("method").and_then(Value::as_str),
            path.as_deref(),
        ) {
            return format!("{method} {path}");
        }
        if let (Some(status), Some(path)) = (
            metadata.get("status").and_then(Value::as_u64),
            path.as_deref(),
        ) {
            return format!("{status} response from {path}");
        }
    }
    if event.event_type == RawEventType::StateChange {
        if let Some(count) = event.payload.get("mutationCount").and_then(Value::as_u64) {
            return format!("DOM mutation observed ({count} records)");
        }
    }
    match event.event_type {
        RawEventType::SurfaceClick => "User click",
        RawEventType::SurfaceTextInput => "User text input",
        RawEventType::Navigation => "Navigation",
        RawEventType::NetworkRequest => "Network request",
        RawEventType::NetworkResponse => "Network response",
        RawEventType::StateChange => "Application state change",
        _ => "Runtime event",
    }
    .to_string()
}

fn url_path(url: &str) -> Option<String> {
    url.split("://")
        .nth(1)?
        .split_once('/')
        .map(|(_, value)| format!("/{}", value.split(['?', '#']).next().unwrap_or(value)))
}
