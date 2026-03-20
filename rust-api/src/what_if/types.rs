use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum WhatIfInjectionKind {
    ReplaceEvent,
    InsertEvent,
    ReplaceChoice,
    ReplaceIntent,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct WhatIfCursor {
    pub event_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WhatIfInjection {
    pub kind: WhatIfInjectionKind,
    pub cursor: WhatIfCursor,
    pub injected_event: crate::event_engine::types::EngineEvent,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WhatIfRequest {
    pub run_id: String,
    pub injection: WhatIfInjection,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WhatIfResult {
    pub source_run_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    pub cursor_event_index: usize,
    pub original_total_events: usize,
    pub simulated_total_events: usize,
    pub snapshot: crate::film_runtime::snapshot::FilmRuntimeSnapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct WhatIfComparison {
    pub result: WhatIfResult,
    pub diff: crate::runtime_diff::types::BranchDiffResult,
}
