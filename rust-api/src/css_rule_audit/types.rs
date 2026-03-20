use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuleAuditDecision {
    Allow,
    Deny,
    Restrict,
    Freeze,
    ReviewRequired,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuleCheckResult {
    pub rule_key: String,
    pub rule_value: String,
    pub matched: bool,
    pub outcome: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CssRuleAuditRecord {
    pub audit_id: String,
    pub actor_user_id: String,
    pub action: String,
    pub subject_kind: String,
    pub subject_id: String,
    pub policy_version_id: String,
    #[serde(default)]
    pub checks: Vec<RuleCheckResult>,
    pub final_decision: RuleAuditDecision,
    pub final_code: String,
    pub final_message: String,
    pub source_system: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct RuleAuditAppendRequest {
    pub actor_user_id: String,
    pub action: String,
    pub subject_kind: String,
    pub subject_id: String,
    pub policy_version_id: String,
    #[serde(default)]
    pub checks: Vec<RuleCheckResult>,
    pub final_decision: RuleAuditDecision,
    pub final_code: String,
    pub final_message: String,
    pub source_system: String,
}
