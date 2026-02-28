use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};

pub fn compute_video_cache_key(compiled: &serde_json::Value) -> String {
    let mut hasher = Sha256::new();
    let bytes = serde_json::to_vec(compiled).unwrap_or_default();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

pub fn cache_path(base: &Path, key: &str) -> PathBuf {
    base.join("video_cache").join(format!("{key}.mp4"))
}
