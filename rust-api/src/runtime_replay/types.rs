use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReplayCursor {
    pub event_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReplayMode {
    Full,
    UntilCursor,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReplayRequest {
    pub run_id: String,
    pub mode: ReplayMode,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cursor: Option<ReplayCursor>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ReplayResult {
    pub run_id: String,
    pub applied_events: usize,
    pub total_events: usize,
    pub replayable: bool,
    pub snapshot: crate::film_runtime::snapshot::FilmRuntimeSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct ReplayManifest {
    pub replayable: bool,
    pub total_events: usize,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub latest_checkpoint_event_index: Option<usize>,
}
