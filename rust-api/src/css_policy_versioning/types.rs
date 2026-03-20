use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PolicyVersionRef {
    pub version_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssPolicyVersion {
    pub version_id: String,
    pub version_name: String,
    #[serde(default)]
    pub is_default: bool,
    pub policy_bundle: crate::css_policy_engine::types::CssPolicyBundle,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PolicyBindingSubjectKind {
    Catalog,
    Auction,
    Deal,
    Ownership,
    UserFlow,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyBinding {
    pub binding_id: String,
    pub subject_kind: PolicyBindingSubjectKind,
    pub subject_id: String,
    pub version_id: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PolicyResolveResult {
    pub version: CssPolicyVersion,
    pub resolved_by: String,
}
