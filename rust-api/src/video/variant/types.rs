use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Variant {
    pub id: String,
    pub prompt: String,
}

#[derive(Debug, Clone)]
pub struct VariantResult {
    pub variant_id: String,
    pub output_path: String,
    pub score: f32,
}

#[derive(Debug, Clone)]
pub struct VariantConfig {
    pub variant_count: usize,
    pub max_attempts: u32,
}
