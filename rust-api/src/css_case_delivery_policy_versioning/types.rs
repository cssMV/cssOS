use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryPolicyVersionRecord {
    pub policy_version_id: String,
    pub policy_name: String,
    pub version: i64,
    pub config: crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicyConfig,
    #[serde(alias = "active")]
    pub is_active: bool,
    pub created_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub activated_at: Option<String>,

    // Legacy-kept compatibility field for older inspector/trace callers.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_by: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateDeliveryPolicyVersionRequest {
    pub policy_name: String,
    pub config: crate::css_case_delivery_policy_engine::types::CssCaseDeliveryPolicyConfig,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivateDeliveryPolicyVersionRequest {
    pub policy_version_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryPolicyConfigDiffItem {
    pub field: String,
    pub before: String,
    pub after: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryPolicyVersionDiff {
    pub from_policy_version_id: String,
    pub to_policy_version_id: String,
    #[serde(default)]
    pub changes: Vec<DeliveryPolicyConfigDiffItem>,
}

// Legacy-kept view types for existing callers.

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryPolicyVersionTimelineItem {
    pub policy_version_id: String,
    pub version: String,
    pub event: String,
    pub occurred_at: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryPolicyFieldDiff {
    pub field_path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub before: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub after: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeliveryPolicyCompareResult {
    pub from_policy_id: String,
    pub from_version: i32,
    pub to_policy_id: String,
    pub to_version: i32,
    #[serde(default)]
    pub diffs: Vec<DeliveryPolicyFieldDiff>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCaseDeliveryPolicyVersioningView {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub active: Option<DeliveryPolicyVersionRecord>,
    #[serde(default)]
    pub versions: Vec<DeliveryPolicyVersionRecord>,
    #[serde(default)]
    pub timeline: Vec<DeliveryPolicyVersionTimelineItem>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct DeliveryPolicyVersioningRequest {}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompareDeliveryPolicyVersionsRequest {
    pub left_policy_version_id: String,
    pub right_policy_version_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_user_id: Option<String>,
}

pub type DeliveryPolicyVersionDiff = CssCaseDeliveryPolicyVersionDiff;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LegacyCompareDeliveryPolicyVersionsRequest {
    pub from_policy_id: String,
    pub to_policy_id: String,
}
