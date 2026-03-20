use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseQuerySubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseQueryStatusKind {
    Open,
    Resolved,
    Dismissed,
    Released,
    EscalatedToManual,
    FrozenUntilReview,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseQueryRiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseQuerySortBy {
    UpdatedAt,
    Status,
    RiskLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CaseQuerySortOrder {
    Asc,
    Desc,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseQueryRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<CaseQueryStatusKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_kind: Option<CaseQuerySubjectKind>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub risk_level: Option<CaseQueryRiskLevel>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub closed_like: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_after: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_before: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_review: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_freeze: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub has_escalate: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sort_by: Option<CaseQuerySortBy>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sort_order: Option<CaseQuerySortOrder>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offset: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseQueryRow {
    pub case_id: String,
    pub subject_kind: CaseQuerySubjectKind,
    pub subject_id: String,
    pub status: CaseQueryStatusKind,
    pub status_label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub risk_level: Option<CaseQueryRiskLevel>,
    pub is_closed_like: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<String>,
    pub has_review: bool,
    pub has_freeze: bool,
    pub has_escalate: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub one_line_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseQueryResponse {
    pub total: usize,
    #[serde(default)]
    pub rows: Vec<CaseQueryRow>,
}
