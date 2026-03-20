use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum CacheSubjectKind {
    User,
    Catalog,
    Deal,
    Ownership,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CssSignalsCacheEntry {
    pub cache_id: String,
    pub subject_kind: CacheSubjectKind,
    pub subject_id: String,
    pub signals_bundle: crate::css_signals_hub::types::SignalsBundle,
    pub generated_at: String,
    pub expires_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SignalsCacheResult {
    pub hit: bool,
    pub entry: CssSignalsCacheEntry,
}
