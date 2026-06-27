pub(crate) fn structural_group(raw_id: &str) -> Option<String> {
    let mut parts = vec![];
    for part in raw_id.split(" > ") {
        parts.push(part);
        if part.starts_with("article") {
            return Some(parts.join(" > "));
        }
    }
    None
}
