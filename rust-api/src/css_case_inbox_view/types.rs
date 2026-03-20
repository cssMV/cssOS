use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InboxKind {
    Pending,
    HighRisk,
    FrozenUntilReview,
    EscalatedToManual,
    UpdatedToday,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseInboxView {
    pub inbox: InboxKind,
    pub label: String,
    pub total: usize,
    #[serde(default)]
    pub rows: Vec<crate::css_case_query_engine::types::CaseQueryRow>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InboxRequest {
    pub inbox: InboxKind,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offset: Option<usize>,
}
