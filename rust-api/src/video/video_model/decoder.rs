use std::fs;
use std::path::Path;
use std::process::Command;

use anyhow::Result;

use crate::video::video_model::renderer::render_latent_to_frames;
use crate::video::video_model::types::LatentVideo;

pub fn decode_video(latent: &LatentVideo) -> Result<String> {
    decode_video_to_path(latent, Path::new("output/final.mp4"), 24)
}

pub fn decode_video_to_path(
    latent: &LatentVideo,
    output_path: &Path,
    fps: usize,
) -> Result<String> {
    let frames = render_latent_to_frames(latent)?;
    let frames_dir = output_path
        .parent()
        .unwrap_or_else(|| Path::new("output"))
        .join(format!(
            "{}_frames",
            output_path
                .file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("final")
        ));
    fs::create_dir_all(&frames_dir)?;

    for (index, frame) in frames.iter().enumerate() {
        let path = frames_dir.join(format!("frame_{:04}.png", index));
        frame.save(&path)?;
    }

    if let Some(parent) = output_path.parent() {
        fs::create_dir_all(parent)?;
    }
    let fps_string = fps.max(1).to_string();
    let input_pattern = frames_dir
        .join("frame_%04d.png")
        .to_string_lossy()
        .to_string();
    let output_string = output_path.to_string_lossy().to_string();
    Command::new("ffmpeg")
        .args([
            "-y",
            "-framerate",
            fps_string.as_str(),
            "-i",
            input_pattern.as_str(),
            "-pix_fmt",
            "yuv420p",
            output_string.as_str(),
        ])
        .output()?;

    Ok(output_path.to_string_lossy().to_string())
}
