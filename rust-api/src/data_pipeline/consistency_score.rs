use std::fs;
use std::path::PathBuf;
use std::process::Command;

use anyhow::{anyhow, Result};
use image::Pixel;

fn ensure_tmp_dir() -> Result<PathBuf> {
    let dir = PathBuf::from("data/tmp");
    fs::create_dir_all(&dir)?;
    Ok(dir)
}

pub fn temporal_consistency_score(frame1: &str, frame2: &str) -> Result<f32> {
    let first = image::open(frame1)?.to_rgb8();
    let second = image::open(frame2)?.to_rgb8();
    let width = first.width().min(second.width());
    let height = first.height().min(second.height());
    let mut diff = 0.0f32;

    for y in 0..height {
        for x in 0..width {
            let p1 = first.get_pixel(x, y).channels();
            let p2 = second.get_pixel(x, y).channels();
            diff += (p1[0] as f32 - p2[0] as f32).abs();
            diff += (p1[1] as f32 - p2[1] as f32).abs();
            diff += (p1[2] as f32 - p2[2] as f32).abs();
        }
    }

    Ok(diff)
}

pub fn is_temporally_stable(video_path: &str) -> Result<bool> {
    let tmp_dir = ensure_tmp_dir()?;
    let pattern = tmp_dir.join("consistency_%02d.png");
    let output = pattern
        .to_str()
        .ok_or_else(|| anyhow!("invalid consistency output path"))?;

    let status = Command::new("ffmpeg")
        .args(["-y", "-i", video_path, "-vf", "fps=5", output])
        .status()?;

    if !status.success() {
        return Err(anyhow!("ffmpeg consistency extraction failed"));
    }

    let frame1 = tmp_dir.join("consistency_01.png");
    let frame2 = tmp_dir.join("consistency_02.png");
    let score = temporal_consistency_score(
        frame1
            .to_str()
            .ok_or_else(|| anyhow!("invalid consistency frame1 path"))?,
        frame2
            .to_str()
            .ok_or_else(|| anyhow!("invalid consistency frame2 path"))?,
    )?;

    Ok(score < 5_000.0)
}
