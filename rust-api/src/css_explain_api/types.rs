use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ExplainAudience {
    Operator,
    User,
    Api,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExplainByAuditRequest {
    pub audit_id: String,
    pub audience: ExplainAudience,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExplainByReviewRequest {
    pub review_id: String,
    pub audience: ExplainAudience,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExplainBySubjectRequest {
    pub subject_kind: String,
    pub subject_id: String,
    pub audience: ExplainAudience,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExplainResponse {
    pub audience: ExplainAudience,
    pub summary: String,
    #[serde(default)]
    pub reasons: Vec<String>,
    #[serde(default)]
    pub outcomes: Vec<String>,
    #[serde(default)]
    pub suggested_actions: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rule_audit_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub review_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_kind: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subject_id: Option<String>,
}
