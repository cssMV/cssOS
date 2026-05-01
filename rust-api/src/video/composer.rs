use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{anyhow, Context, Result};

use crate::video::types::ComposeResult;

use super::thumbnail::probe_duration;

pub fn compose_mv(
    scene_video_paths: &[String],
    audio_path: &str,
    target_duration_secs: f32,
    output_path: &str,
) -> Result<ComposeResult> {
    if scene_video_paths.is_empty() {
        return Err(anyhow!("compose_mv requires at least one scene video"));
    }
    let output = PathBuf::from(output_path);
    fs::create_dir_all(output.parent().unwrap_or_else(|| Path::new(".")))?;
    let silent_path = output.with_extension("silent.mp4");
    let list_path = output.with_extension("concat.txt");
    let list_body = scene_video_paths
        .iter()
        .map(|path| format!("file '{}'\n", path.replace('\'', "'\\''")))
        .collect::<String>();
    fs::write(&list_path, list_body)?;

    run_ffmpeg(&[
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        list_path.to_string_lossy().as_ref(),
        "-c",
        "copy",
        silent_path.to_string_lossy().as_ref(),
    ])?;

    let silent_duration = probe_duration(&silent_path)?;
    if (silent_duration - target_duration_secs).abs() > 0.1 {
        let speed = (silent_duration / target_duration_secs.max(0.1)).clamp(0.85, 1.15);
        let adjusted_path = output.with_extension("adjusted.mp4");
        run_ffmpeg(&[
            "-y",
            "-hide_banner",
            "-loglevel",
            "error",
            "-i",
            silent_path.to_string_lossy().as_ref(),
            "-vf",
            &format!("setpts=PTS/{:.6}", 1.0 / speed),
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            adjusted_path.to_string_lossy().as_ref(),
        ])?;
        fs::rename(adjusted_path, &silent_path)?;
    }

    run_ffmpeg(&[
        "-y",
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        silent_path.to_string_lossy().as_ref(),
        "-i",
        audio_path,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-shortest",
        output.to_string_lossy().as_ref(),
    ])?;

    let video_duration_secs = probe_duration(&output)?;
    let audio_duration_secs = probe_duration(Path::new(audio_path))?;
    Ok(evaluate_duration_match(
        output.to_string_lossy().to_string(),
        video_duration_secs,
        audio_duration_secs,
        target_duration_secs,
    ))
}

pub(crate) fn evaluate_duration_match(
    output_path: String,
    video_duration_secs: f32,
    audio_duration_secs: f32,
    target_duration_secs: f32,
) -> ComposeResult {
    let duration_delta_secs = (video_duration_secs - target_duration_secs).abs();
    ComposeResult {
        output_path,
        video_duration_secs,
        audio_duration_secs,
        duration_delta_secs,
        matched: duration_delta_secs < 0.1
            && (audio_duration_secs - target_duration_secs).abs() < 0.1,
    }
}

fn run_ffmpeg(args: &[&str]) -> Result<()> {
    let output = Command::new("ffmpeg")
        .args(args)
        .output()
        .with_context(|| format!("running ffmpeg with args {:?}", args))?;
    if !output.status.success() {
        return Err(anyhow!(
            "ffmpeg failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::evaluate_duration_match;

    #[test]
    fn duration_matching_respects_threshold() {
        let matched = evaluate_duration_match("mv.mp4".into(), 20.04, 20.02, 20.0);
        assert!(matched.matched);
        let mismatched = evaluate_duration_match("mv.mp4".into(), 20.22, 20.01, 20.0);
        assert!(!mismatched.matched);
        assert!(mismatched.duration_delta_secs > 0.1);
    }
}
