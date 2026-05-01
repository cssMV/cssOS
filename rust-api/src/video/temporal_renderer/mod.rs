use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{anyhow, Context, Result};

use crate::video::temporal_latent::types::TemporalDecoderMetrics;

#[derive(Debug, Clone)]
pub struct TemporalRenderProfile {
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub enable_motion_interpolation: bool,
}

impl Default for TemporalRenderProfile {
    fn default() -> Self {
        Self {
            width: 1280,
            height: 720,
            fps: 24,
            enable_motion_interpolation: false,
        }
    }
}

pub fn render_temporal_video(
    frames: &[PathBuf],
    duration_secs: f32,
    output_path: &Path,
) -> Result<()> {
    let _ = render_temporal_video_with_profile(
        frames,
        duration_secs,
        output_path,
        &TemporalRenderProfile::default(),
    )?;
    Ok(())
}

pub fn render_temporal_video_with_profile(
    frames: &[PathBuf],
    duration_secs: f32,
    output_path: &Path,
    profile: &TemporalRenderProfile,
) -> Result<TemporalDecoderMetrics> {
    if frames.is_empty() {
        return Err(anyhow!("cannot render temporal video without frames"));
    }

    let fps = profile.fps.max(12);
    let total_duration = duration_secs.max(1.0);
    let frame_count = frames.len();
    let rollout_overlap = if frame_count > 1 {
        (total_duration / (frame_count as f32 * 3.8)).clamp(0.08, 0.18)
    } else {
        0.0
    };
    let patch_hold_duration = if frame_count > 1 {
        (total_duration + rollout_overlap * (frame_count as f32 - 1.0)) / frame_count as f32
    } else {
        total_duration
    };
    let hold_frames = (patch_hold_duration * fps as f32).round().max(1.0) as u32;
    let motion_fps = fps.saturating_mul(2).max(24);

    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error");

    for frame in frames {
        cmd.arg("-loop")
            .arg("1")
            .arg("-t")
            .arg(format!("{:.3}", patch_hold_duration))
            .arg("-i")
            .arg(frame);
    }

    let mut filter = String::new();
    for (index, _frame) in frames.iter().enumerate() {
        let rollout_progress = if frame_count <= 1 {
            0.0
        } else {
            index as f32 / (frame_count - 1) as f32
        };
        let drift_x = ((rollout_progress - 0.5) * 0.08).clamp(-0.04, 0.04);
        let drift_y = ((0.5 - rollout_progress) * 0.06).clamp(-0.03, 0.03);
        let zoom_end = 1.0 + 0.012 + rollout_progress * 0.01;
        filter.push_str(&format!(
            "[{index}:v]scale={sw}:{sh}:force_original_aspect_ratio=increase,crop={w}:{h},zoompan=z='min(zoom+0.0015,{zoom_end:.4})':x='iw*0.5-(iw/zoom/2)+iw*{drift_x:.4}':y='ih*0.5-(ih/zoom/2)+ih*{drift_y:.4}':d={hold_frames}:s={w}x{h}:fps={fps},trim=duration={patch_hold_duration:.3},setpts=PTS-STARTPTS,format=yuv420p[v{index}];",
            index = index,
            sw = profile.width + 192,
            sh = profile.height + 108,
            w = profile.width,
            h = profile.height,
            zoom_end = zoom_end,
            drift_x = drift_x,
            drift_y = drift_y,
            hold_frames = hold_frames,
            fps = fps,
            patch_hold_duration = patch_hold_duration,
        ));
    }

    if frame_count == 1 {
        filter.push_str("[v0]format=yuv420p[outv]");
    } else {
        let mut concat_inputs = String::new();
        for index in 0..frame_count {
            concat_inputs.push_str(&format!("[v{}]", index));
        }
        if profile.enable_motion_interpolation {
            filter.push_str(&format!(
                "{concat_inputs}concat=n={frame_count}:v=1:a=0[rollout];\
                 [rollout]minterpolate=fps={motion_fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=none,\
                 fps={fps},trim=duration={total_duration:.3},setpts=PTS-STARTPTS,format=yuv420p[finalv]",
                concat_inputs = concat_inputs,
                frame_count = frame_count,
                motion_fps = motion_fps,
                fps = fps,
                total_duration = total_duration,
            ));
        } else {
            filter.push_str(&format!(
                "{concat_inputs}concat=n={frame_count}:v=1:a=0[concatv];\
                 [concatv]fps={fps},trim=duration={total_duration:.3},setpts=PTS-STARTPTS,format=yuv420p[finalv]",
                concat_inputs = concat_inputs,
                frame_count = frame_count,
                fps = fps,
                total_duration = total_duration,
            ));
        }
    }

    let mapped = if frame_count == 1 {
        "[outv]"
    } else {
        "[finalv]"
    };
    let output = cmd
        .arg("-filter_complex")
        .arg(filter)
        .arg("-map")
        .arg(mapped)
        .arg("-r")
        .arg(fps.to_string())
        .arg("-c:v")
        .arg("libx264")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-movflags")
        .arg("+faststart")
        .arg(output_path)
        .output()
        .context("rendering temporal video with ffmpeg")?;

    if !output.status.success() {
        return Err(anyhow!(
            "ffmpeg temporal render failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(TemporalDecoderMetrics {
        mode: "state_preserving_rollout_decoder_v2".to_string(),
        frame_count,
        fps,
        clip_duration_secs: patch_hold_duration,
        overlap_duration_secs: rollout_overlap,
        latent_hold_ratio: (patch_hold_duration / total_duration).clamp(0.0, 1.0),
        used_motion_interpolation: frame_count > 1 && profile.enable_motion_interpolation,
    })
}

pub fn render_temporal_rollout_from_segments(
    segments: &[PathBuf],
    output_path: &Path,
    profile: &TemporalRenderProfile,
) -> Result<TemporalDecoderMetrics> {
    if segments.is_empty() {
        return Err(anyhow!("cannot render temporal rollout without segments"));
    }

    let fps = profile.fps.max(12);
    let segment_count = segments.len();
    let scene_overlap = if segment_count > 1 { 0.18 } else { 0.0 };
    let motion_fps = fps.saturating_mul(2).max(24);

    let mut durations = Vec::with_capacity(segment_count);
    for segment in segments {
        durations.push(probe_video_duration(segment)?);
    }

    let total_duration =
        durations.iter().sum::<f32>() - scene_overlap * segment_count.saturating_sub(1) as f32;
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error");

    for segment in segments {
        cmd.arg("-i").arg(segment);
    }

    let mut filter = String::new();
    let mut concat_inputs = String::new();
    for (index, duration) in durations.iter().enumerate() {
        let trim_start = if index == 0 { 0.0 } else { scene_overlap * 0.5 };
        let trim_end = if index + 1 == segment_count {
            *duration
        } else {
            (*duration - scene_overlap * 0.5).max(trim_start + 0.2)
        };
        filter.push_str(&format!(
            "[{index}:v]fps={fps},scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},\
             trim=start={trim_start:.3}:end={trim_end:.3},setpts=PTS-STARTPTS,format=yuv420p[s{index}];",
            index = index,
            fps = fps,
            w = profile.width,
            h = profile.height,
            trim_start = trim_start,
            trim_end = trim_end,
        ));
        concat_inputs.push_str(&format!("[s{}]", index));
    }

    if segment_count == 1 {
        filter.push_str("[s0]format=yuv420p[masterv]");
    } else {
        if profile.enable_motion_interpolation {
            filter.push_str(&format!(
                "{concat_inputs}concat=n={segment_count}:v=1:a=0[rollout];\
                 [rollout]minterpolate=fps={motion_fps}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:scd=none,\
                 fps={fps},trim=duration={total_duration:.3},setpts=PTS-STARTPTS,format=yuv420p[masterv]",
                concat_inputs = concat_inputs,
                segment_count = segment_count,
                motion_fps = motion_fps,
                fps = fps,
                total_duration = total_duration.max(0.2),
            ));
        } else {
            filter.push_str(&format!(
                "{concat_inputs}concat=n={segment_count}:v=1:a=0[concatv];\
                 [concatv]fps={fps},trim=duration={total_duration:.3},setpts=PTS-STARTPTS,format=yuv420p[masterv]",
                concat_inputs = concat_inputs,
                segment_count = segment_count,
                fps = fps,
                total_duration = total_duration.max(0.2),
            ));
        }
    }

    let output = cmd
        .arg("-filter_complex")
        .arg(filter)
        .arg("-map")
        .arg("[masterv]")
        .arg("-r")
        .arg(fps.to_string())
        .arg("-c:v")
        .arg("libx264")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-movflags")
        .arg("+faststart")
        .arg(output_path)
        .output()
        .context("rendering temporal rollout master video with ffmpeg")?;

    if !output.status.success() {
        return Err(anyhow!(
            "ffmpeg temporal rollout master render failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    Ok(TemporalDecoderMetrics {
        mode: "state_preserving_rollout_master_decoder_v1".to_string(),
        frame_count: segment_count,
        fps,
        clip_duration_secs: if segment_count == 0 {
            0.0
        } else {
            total_duration.max(0.0) / segment_count as f32
        },
        overlap_duration_secs: scene_overlap,
        latent_hold_ratio: 1.0 / segment_count.max(1) as f32,
        used_motion_interpolation: segment_count > 1 && profile.enable_motion_interpolation,
    })
}

fn probe_video_duration(path: &Path) -> Result<f32> {
    let output = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(path)
        .output()
        .with_context(|| format!("probing video duration for {}", path.display()))?;

    if !output.status.success() {
        return Err(anyhow!(
            "ffprobe duration probe failed for {}: {}",
            path.display(),
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let duration = stdout
        .trim()
        .parse::<f32>()
        .with_context(|| format!("parsing ffprobe duration for {}", path.display()))?;
    Ok(duration.max(0.2))
}
