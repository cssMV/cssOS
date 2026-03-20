use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OwnershipScope {
    pub work_structure: crate::css_rights_engine::types::RightsWorkStructure,
    pub unit: crate::css_rights_engine::types::RightsUnit,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub unit_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OwnershipRecord {
    pub ownership_id: String,
    pub owner_user_id: String,
    pub scope: OwnershipScope,
    #[serde(default)]
    pub priceless: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buyout_price_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    #[serde(default)]
    pub resale_enabled: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OwnershipTransferIntent {
    pub intent_id: String,
    pub buyer_user_id: String,
    pub ownership_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offered_price_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum OwnershipTransferDecision {
    Allow,
    Deny,
    RequiresOwnerApproval,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct OwnershipTransferDecisionResult {
    pub decision: OwnershipTransferDecision,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum TransferIntentStatus {
    Pending,
    Accepted,
    Rejected,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct StoredOwnershipTransferIntent {
    pub intent_id: String,
    pub buyer_user_id: String,
    pub ownership_id: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub offered_price_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
    pub status: TransferIntentStatus,
    pub created_at: String,
}
