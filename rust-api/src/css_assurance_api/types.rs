use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AssuranceSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AssuranceMeasureKind {
    TradeProtection,
    BuyerWarning,
    ManualReviewEnabled,
    FreezeProtection,
    ExtraRiskControl,
    ParticipationRestriction,
    OwnershipTransferRestriction,
    HighValueTradeGuard,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssuranceMeasureView {
    pub kind: AssuranceMeasureKind,
    pub enabled: bool,
    pub title: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserAssuranceView {
    pub user_id: String,

    #[serde(default)]
    pub measures: Vec<AssuranceMeasureView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CatalogAssuranceView {
    pub catalog_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_user_id: Option<String>,

    #[serde(default)]
    pub measures: Vec<AssuranceMeasureView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DealAssuranceView {
    pub deal_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub buyer_user_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub seller_user_id: Option<String>,

    #[serde(default)]
    pub measures: Vec<AssuranceMeasureView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OwnershipAssuranceView {
    pub ownership_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub owner_user_id: Option<String>,

    #[serde(default)]
    pub measures: Vec<AssuranceMeasureView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssuranceResponse<T> {
    pub subject_kind: AssuranceSubjectKind,
    pub data: T,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetUserAssuranceRequest {
    pub user_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetCatalogAssuranceRequest {
    pub catalog_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetDealAssuranceRequest {
    pub deal_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GetOwnershipAssuranceRequest {
    pub ownership_id: String,
}
