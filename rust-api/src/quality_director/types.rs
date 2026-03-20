use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ReleaseReadiness {
    InternalOnly,
    PreviewReady,
    DemoReady,
    PromoReady,
    MarketReady,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum QualityBlockerLevel {
    None,
    Soft,
    Hard,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct QualityBlocker {
    pub dimension: String,
    pub level: QualityBlockerLevel,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct QualityDirectorReport {
    pub readiness: ReleaseReadiness,
    pub blocker_level: QualityBlockerLevel,
    #[serde(default)]
    pub blockers: Vec<QualityBlocker>,
    pub score: i32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub headline: Option<String>,
}
