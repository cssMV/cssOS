use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{anyhow, Context, Result};

use crate::video::types::{SceneInput, SceneRenderPlan};

pub mod generator;
pub mod planner;

use self::generator::{generate_motion_frames, generate_motion_frames_from_prompt};

pub fn render_scene_motion_video(
    scene: &SceneInput,
    plan: &SceneRenderPlan,
    output_path: &Path,
) -> Result<String> {
    let work_dir = output_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(format!("scene_{:03}_motion_frames", scene.id));
    let frames = generate_motion_frames(scene, plan, &work_dir)?;
    if frames.is_empty() {
        return Err(anyhow!("no motion frames generated for scene {}", scene.id));
    }
    frames_to_video(&frames, scene.duration_secs, output_path)?;
    Ok(output_path.to_string_lossy().to_string())
}

pub fn render_scene_motion_video_from_prompt(
    scene: &SceneInput,
    plan: &SceneRenderPlan,
    base_prompt: &str,
    output_path: &Path,
) -> Result<String> {
    let work_dir = output_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(format!("scene_{:03}_variant_motion_frames", scene.id));
    let frames = generate_motion_frames_from_prompt(scene, plan, base_prompt, &work_dir)?;
    if frames.is_empty() {
        return Err(anyhow!(
            "no prompt-driven motion frames generated for scene {}",
            scene.id
        ));
    }
    frames_to_video(&frames, scene.duration_secs, output_path)?;
    Ok(output_path.to_string_lossy().to_string())
}

pub fn frames_to_video(frames: &[PathBuf], duration_secs: f32, output_path: &Path) -> Result<()> {
    if frames.is_empty() {
        return Err(anyhow!("cannot render video without frames"));
    }
    let fps = ((frames.len() as f32) / duration_secs.max(0.5)).clamp(6.0, 24.0);
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error");
    for frame in frames {
        let per_frame = (1.0 / fps).max(0.04);
        cmd.arg("-loop")
            .arg("1")
            .arg("-t")
            .arg(format!("{per_frame:.3}"))
            .arg("-i")
            .arg(frame);
    }

    let mut filter = String::new();
    for index in 0..frames.len() {
        filter.push_str(&format!(
            "[{index}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,trim=duration={:.3},setpts=PTS-STARTPTS,format=yuv420p[v{index}];",
            (1.0 / fps).max(0.04)
        ));
    }
    let concat_inputs = (0..frames.len())
        .map(|index| format!("[v{index}]"))
        .collect::<String>();
    filter.push_str(&format!(
        "{concat_inputs}concat=n={}:v=1:a=0,trim=duration={duration_secs:.3}[outv]",
        frames.len()
    ));

    let output = cmd
        .arg("-filter_complex")
        .arg(filter)
        .arg("-map")
        .arg("[outv]")
        .arg("-r")
        .arg(format!("{fps:.3}"))
        .arg("-c:v")
        .arg("libx264")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-movflags")
        .arg("+faststart")
        .arg(output_path)
        .output()
        .context("rendering motion-frame video with ffmpeg")?;
    if !output.status.success() {
        return Err(anyhow!(
            "ffmpeg motion-frame render failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}
