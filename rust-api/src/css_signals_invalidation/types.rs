use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "snake_case")]
pub enum InvalidationSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InvalidationEventKind {
    CreditChanged,
    DisputeOpened,
    DisputeResolved,
    PenaltyActivated,
    PenaltyReleased,
    ReviewOpened,
    ReviewClosed,
    DealStatusChanged,
    OwnershipChanged,
    ModerationChanged,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub struct InvalidationTarget {
    pub subject_kind: InvalidationSubjectKind,
    pub subject_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalsInvalidationEvent {
    pub event_id: String,
    pub event_kind: InvalidationEventKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub catalog_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub deal_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ownership_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub source_system: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InvalidationResult {
    #[serde(default)]
    pub targets: Vec<InvalidationTarget>,
    pub invalidated_count: usize,
}
