use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum DeliveryPolicyAuditAction {
    #[serde(alias = "create_version")]
    Created,
    #[serde(alias = "activate_version")]
    Activated,
    #[serde(alias = "switch_active_version")]
    Switched,
    #[serde(alias = "compare_versions")]
    Compared,
    #[serde(alias = "rollback_version")]
    RolledBack,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryPolicyAuditRecord {
    pub policy_audit_id: String,
    pub actor_user_id: String,
    pub action: DeliveryPolicyAuditAction,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_policy_version_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_policy_version_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDeliveryPolicyAuditRequest {
    pub actor_user_id: String,
    pub action: DeliveryPolicyAuditAction,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub from_policy_version_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub to_policy_version_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryPolicyAuditQueryRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action: Option<DeliveryPolicyAuditAction>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub policy_version_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub policy_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
}

pub type DeliveryPolicyAuditCreateRequest = CreateDeliveryPolicyAuditRequest;
