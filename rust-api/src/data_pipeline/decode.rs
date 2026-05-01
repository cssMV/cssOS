use std::process::Command;

use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoProbe {
    pub duration_sec: f32,
    pub width: u32,
    pub height: u32,
    pub fps: f32,
}

pub fn ffprobe_video(path: &str) -> Result<VideoProbe> {
    let output = Command::new("ffprobe")
        .args([
            "-v",
            "error",
            "-select_streams",
            "v:0",
            "-show_entries",
            "stream=width,height,r_frame_rate:format=duration",
            "-of",
            "default=noprint_wrappers=1",
            path,
        ])
        .output()?;

    if !output.status.success() {
        return Err(anyhow!("ffprobe failed"));
    }

    let text = String::from_utf8_lossy(&output.stdout);
    let mut width = 0u32;
    let mut height = 0u32;
    let mut duration = 0.0f32;
    let mut fps = 0.0f32;

    for line in text.lines() {
        if let Some(v) = line.strip_prefix("width=") {
            width = v.parse()?;
        } else if let Some(v) = line.strip_prefix("height=") {
            height = v.parse()?;
        } else if let Some(v) = line.strip_prefix("duration=") {
            duration = v.parse()?;
        } else if let Some(v) = line.strip_prefix("r_frame_rate=") {
            let parts: Vec<&str> = v.split('/').collect();
            if parts.len() == 2 {
                let num: f32 = parts[0].parse()?;
                let den: f32 = parts[1].parse()?;
                if den > 0.0 {
                    fps = num / den;
                }
            }
        }
    }

    Ok(VideoProbe {
        duration_sec: duration,
        width,
        height,
        fps,
    })
}
