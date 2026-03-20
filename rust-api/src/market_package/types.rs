use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PackageAssetKind {
    FinalMv,
    KaraokeMv,
    AudioOnly,
    Instrumental,
    VocalsOnly,
    LyricsText,
    SubtitlesAss,
    CoverImage,
    TrailerPreview,
    MetadataJson,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageAsset {
    pub kind: PackageAssetKind,
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lang: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub voice: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PackageMetadata {
    pub run_id: String,
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub author_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub engine_name: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub engine_version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricingMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub list_price_cents: Option<i64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub currency: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RightsMetadata {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub copyright_notice: Option<String>,
    #[serde(default)]
    pub commercial_use_allowed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketPackage {
    pub metadata: PackageMetadata,
    #[serde(default)]
    pub assets: Vec<PackageAsset>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pricing: Option<PricingMetadata>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rights: Option<RightsMetadata>,
}
