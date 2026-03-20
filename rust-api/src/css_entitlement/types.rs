use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EntitlementGrant {
    pub grant_id: String,
    pub kind: crate::css_rights_engine::types::RightsGrantKind,
    pub target: crate::css_rights_engine::types::RightsTarget,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct EntitlementAccessRequest {
    pub user_id: String,
    pub kind: crate::css_rights_engine::types::RightsGrantKind,
    pub target: crate::css_rights_engine::types::RightsTarget,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct EntitlementAccessResult {
    pub allowed: bool,
    pub code: String,
    pub message: String,
}
