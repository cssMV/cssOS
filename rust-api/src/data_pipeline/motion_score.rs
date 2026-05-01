use std::process::Command;

use anyhow::{anyhow, Result};

pub fn compute_motion_score(video_path: &str) -> Result<f32> {
    let output = Command::new("ffmpeg")
        .args([
            "-i",
            video_path,
            "-vf",
            "tblend=all_mode=difference",
            "-f",
            "null",
            "-",
        ])
        .output()?;

    if !output.status.success() {
        return Err(anyhow!("ffmpeg motion score failed"));
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    Ok(stderr.len() as f32)
}
