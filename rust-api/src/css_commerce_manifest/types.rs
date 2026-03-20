use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CommerceOfferKind {
    Listen,
    Stream,
    Preview,
    Purchase,
    Buyout,
    License,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CommerceAssetUnit {
    FinalMv,
    KaraokeMv,
    AudioOnly,
    Instrumental,
    VocalsOnly,
    MultiVersionBundle,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommerceOffer {
    pub offer_id: String,
    pub kind: CommerceOfferKind,
    pub asset_unit: CommerceAssetUnit,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voice: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub price_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommerceSplit {
    pub party: String,
    pub basis_points: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommerceRights {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_id: Option<String>,
    #[serde(default)]
    pub commercial_use_allowed: bool,
    #[serde(default)]
    pub resale_allowed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommerceMetadata {
    pub run_id: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub engine_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub engine_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssCommerceManifest {
    pub metadata: CommerceMetadata,
    #[serde(default)]
    pub offers: Vec<CommerceOffer>,
    #[serde(default)]
    pub splits: Vec<CommerceSplit>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rights: Option<CommerceRights>,
}
