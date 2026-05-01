use std::fs;

use anyhow::{anyhow, Result};

use crate::data_pipeline::schema::RawVideoRecord;

pub fn scan_local_video_dir(root: &str) -> Result<Vec<RawVideoRecord>> {
    let mut out = Vec::new();

    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        if !path.is_file() {
            continue;
        }

        let ext = path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();

        if !["mp4", "mov", "mkv", "webm"].contains(&ext.as_str()) {
            continue;
        }

        let id = path
            .file_stem()
            .and_then(|s| s.to_str())
            .ok_or_else(|| anyhow!("invalid filename"))?
            .to_string();

        out.push(RawVideoRecord {
            id: id.clone(),
            source_uri: format!("file://{}", path.display()),
            local_path: path.to_string_lossy().to_string(),
        });
    }

    Ok(out)
}
