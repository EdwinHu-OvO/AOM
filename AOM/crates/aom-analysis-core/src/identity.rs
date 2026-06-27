use aom_protocol_rs::AOMNodeType;

pub fn stable_id(target_id: &str, node_type: &AOMNodeType, key: &str) -> String {
    let namespace = node_type_name(node_type);
    let canonical = format!("{target_id}|{namespace}|{}", normalize(key));
    format!("aom:{namespace}:{:016x}", fnv1a(canonical.as_bytes()))
}

pub fn normalize(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                ' '
            }
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join("-")
}

fn node_type_name(node_type: &AOMNodeType) -> &'static str {
    match node_type {
        AOMNodeType::App => "app",
        AOMNodeType::Screen => "screen",
        AOMNodeType::View => "view",
        AOMNodeType::ApiEndpoint => "api",
        AOMNodeType::StorageKey => "storage",
        AOMNodeType::DataField => "field",
        AOMNodeType::Message => "message",
        AOMNodeType::DataObject => "data",
        AOMNodeType::Capability => "capability",
        AOMNodeType::Event => "event",
    }
}

fn fnv1a(bytes: &[u8]) -> u64 {
    let mut hash = 0xcbf29ce484222325_u64;
    for byte in bytes {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    hash
}
