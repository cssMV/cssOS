use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum MigrationSubjectKind {
    Catalog,
    Auction,
    Deal,
    Ownership,
    UserFlow,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PolicyMigrationStatus {
    Planned,
    DryRunPassed,
    DryRunBlocked,
    Applied,
    Rejected,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PolicyMigrationPlan {
    pub migration_id: String,
    pub subject_kind: MigrationSubjectKind,
    pub subject_id: String,
    pub from_version_id: String,
    pub to_version_id: String,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requested_by_user_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PolicyMigrationRecord {
    pub migration_id: String,
    pub subject_kind: MigrationSubjectKind,
    pub subject_id: String,
    pub from_version_id: String,
    pub to_version_id: String,
    pub status: PolicyMigrationStatus,
    pub reason: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub requested_by_user_id: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct MigrationDecision {
    pub allowed: bool,
    pub code: String,
    pub message: String,
}
