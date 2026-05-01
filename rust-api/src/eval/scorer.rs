use std::fs;
use std::path::PathBuf;
use std::process::Command;

use anyhow::{anyhow, Result};

use crate::eval::consistency::identity_consistency_score;
use crate::eval::diversity::diversity_score;
use crate::eval::motion::motion_continuity_score;
use crate::eval::realism::realism_score;

#[derive(Debug, Clone)]
pub struct EvalResult {
    pub realism: f32,
    pub motion: f32,
    pub consistency: f32,
    pub diversity: f32,
    pub total: f32,
}

pub fn extract_frames(video_path: &str) -> Result<Vec<String>> {
    let output_dir = PathBuf::from("output/eval_frames");
    fs::create_dir_all(&output_dir)?;
    let pattern = output_dir.join("frame_%04d.png");
    let output_pattern = pattern
        .to_str()
        .ok_or_else(|| anyhow!("invalid evaluation frame pattern"))?;

    let status = Command::new("ffmpeg")
        .args(["-y", "-i", video_path, "-vf", "fps=8", output_pattern])
        .status()?;

    if !status.success() {
        return Err(anyhow!("ffmpeg frame extraction failed"));
    }

    let mut frames = fs::read_dir(&output_dir)?
        .filter_map(|entry| entry.ok())
        .map(|entry| entry.path())
        .filter(|path| path.extension().and_then(|s| s.to_str()) == Some("png"))
        .map(|path| path.to_string_lossy().to_string())
        .collect::<Vec<_>>();
    frames.sort();
    Ok(frames)
}

pub fn evaluate_video(frames: &[String]) -> Result<EvalResult> {
    if frames.is_empty() {
        return Err(anyhow!("no frames provided for evaluation"));
    }

    let mut realism_scores = Vec::new();
    let mut motion_scores = Vec::new();
    let mut consistency_scores = Vec::new();

    for index in 0..frames.len() {
        realism_scores.push(realism_score(&frames[index])?);

        if index > 0 {
            motion_scores.push(motion_continuity_score(&frames[index - 1], &frames[index])?);
            consistency_scores.push(identity_consistency_score(
                &frames[index - 1],
                &frames[index],
            )?);
        }
    }

    let realism = realism_scores.iter().sum::<f32>() / realism_scores.len() as f32;
    let motion = if motion_scores.is_empty() {
        0.0
    } else {
        motion_scores.iter().sum::<f32>() / motion_scores.len() as f32
    };
    let consistency = if consistency_scores.is_empty() {
        0.0
    } else {
        consistency_scores.iter().sum::<f32>() / consistency_scores.len() as f32
    };
    let diversity = diversity_score(&realism_scores)?;
    let total = realism * 0.35
        + (1.0 / (motion + 1.0)) * 0.25
        + (1.0 / (consistency + 1.0)) * 0.25
        + diversity * 0.15;

    Ok(EvalResult {
        realism,
        motion,
        consistency,
        diversity,
        total,
    })
}
