pub fn source_panel(
    source_system: &str,
    source_id: &str,
    raw: serde_json::Value,
) -> crate::css_inspector_view::types::InspectorSourcePanel {
    crate::css_inspector_view::types::InspectorSourcePanel {
        source_system: source_system.to_string(),
        source_id: source_id.to_string(),
        raw,
    }
}

pub fn empty_replay_panel() -> crate::css_inspector_view::types::InspectorReplayPanel {
    crate::css_inspector_view::types::InspectorReplayPanel { deltas: vec![] }
}
