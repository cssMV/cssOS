use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FilmRuntimeSnapshot {
    pub status: crate::film_runtime::types::RuntimeStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_story_node: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_scene: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub camera_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub immersion_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub presence_kind: Option<String>,
    pub event_history_len: usize,
}
