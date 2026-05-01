use std::fs;

use anyhow::Result;

use crate::data_pipeline::schema::{ClipRecord, FilterResult};

pub fn filter_clip_basic(clip: &ClipRecord) -> Result<FilterResult> {
    let mut reasons = Vec::new();

    let meta = fs::metadata(&clip.clip_path)?;
    if meta.len() < 100_000 {
        reasons.push("file_too_small".to_string());
    }

    if clip.width < 256 || clip.height < 256 {
        reasons.push("resolution_too_low".to_string());
    }

    if clip.end_sec - clip.start_sec < 2.0 {
        reasons.push("duration_too_short".to_string());
    }

    Ok(FilterResult {
        clip_id: clip.clip_id.clone(),
        accepted: reasons.is_empty(),
        reasons,
    })
}
