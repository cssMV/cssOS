use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{Context, Result};

use crate::video::contracts::{ArcTimelineBeat, ComposeResult, MusicInput, SceneInput, ShotPlan};
use crate::video::error::VideoEngineError;
use crate::video::scene_renderer::probe_media_duration;

#[derive(Debug, Clone)]
pub struct MVComposer {
    ffmpeg_bin: String,
    ffprobe_bin: String,
}

impl Default for MVComposer {
    fn default() -> Self {
        Self::new()
    }
}

impl MVComposer {
    pub fn new() -> Self {
        Self {
            ffmpeg_bin: "ffmpeg".to_string(),
            ffprobe_bin: "ffprobe".to_string(),
        }
    }

    pub fn compose(
        &self,
        scenes: &[SceneInput],
        timeline: &[ArcTimelineBeat],
        shot_plans: &[ShotPlan],
        scene_video_paths: &[PathBuf],
        music: &MusicInput,
        output_dir: &Path,
    ) -> Result<ComposeResult> {
        if scene_video_paths.is_empty() {
            return Err(VideoEngineError::EmptyScenes.into());
        }
        let audio_path = Path::new(&music.audio_path);
        if !audio_path.exists() {
            return Err(VideoEngineError::MissingAudioPath {
                path: music.audio_path.clone(),
            }
            .into());
        }

        let actual_audio_duration = probe_media_duration(&self.ffprobe_bin, audio_path)?;
        let audio_delta = (actual_audio_duration - music.duration_secs).abs();
        if audio_delta > 0.1 {
            return Err(VideoEngineError::AudioDurationMismatch {
                expected_secs: music.duration_secs,
                actual_secs: actual_audio_duration,
            }
            .into());
        }

        let scene_total: f32 = scene_video_paths
            .iter()
            .map(|path| probe_media_duration(&self.ffprobe_bin, path))
            .collect::<Result<Vec<_>>>()?
            .into_iter()
            .sum();
        let duration_delta = (scene_total - music.duration_secs).abs();
        if duration_delta > 0.1 {
            return Err(VideoEngineError::SceneDurationMismatch {
                expected_secs: music.duration_secs,
                actual_secs: scene_total,
            }
            .into());
        }

        fs::create_dir_all(output_dir).with_context(|| {
            format!(
                "failed to create composer output dir: {}",
                output_dir.display()
            )
        })?;
        let concat_silent_path = output_dir.join("mv_silent.mp4");
        let final_path = output_dir.join("mv_final.mp4");
        let mut concat_command = Command::new(&self.ffmpeg_bin);
        concat_command.arg("-y");
        for path in scene_video_paths {
            concat_command.arg("-i").arg(path);
        }
        let mut prepared_inputs = String::new();
        let mut filter_parts = Vec::new();
        let mut accumulated_impact = 0.0_f32;
        let mut accumulated_stability = 0.0_f32;
        let primary_explosion_index = timeline
            .iter()
            .position(|entry| entry.is_primary_explosion)
            .unwrap_or(scene_video_paths.len().saturating_sub(1));
        let secondary_explosion_index = timeline
            .iter()
            .position(|entry| entry.is_secondary_explosion)
            .unwrap_or(primary_explosion_index);
        let pre_primary_index = primary_explosion_index.saturating_sub(1);
        let post_primary_index =
            (primary_explosion_index + 1).min(scene_video_paths.len().saturating_sub(1));
        let pre_secondary_index = secondary_explosion_index.saturating_sub(1);
        let post_secondary_index =
            (secondary_explosion_index + 1).min(scene_video_paths.len().saturating_sub(1));
        let resolution_index = timeline
            .iter()
            .position(|entry| entry.is_resolution)
            .unwrap_or(scene_video_paths.len().saturating_sub(1));
        for index in 0..scene_video_paths.len() {
            let scene = scenes.get(index);
            let beat =
                scene.and_then(|item| timeline.iter().find(|entry| entry.scene_id == item.id));
            let shot =
                scene.and_then(|item| shot_plans.iter().find(|plan| plan.scene_id == item.id));
            let section_role = beat
                .map(|entry| entry.section_role.as_str())
                .unwrap_or("verse");
            let impact_weight = beat.map(|entry| entry.impact_weight).unwrap_or(0.45);
            let stability_weight = beat.map(|entry| entry.stability_weight).unwrap_or(0.72);
            let motion_intensity = shot.map(|plan| plan.motion_intensity).unwrap_or(0.55);
            accumulated_impact += impact_weight;
            accumulated_stability += stability_weight;
            let arc_progress = (index as f32 + 1.0) / scene_video_paths.len() as f32;
            let average_impact = accumulated_impact / (index as f32 + 1.0);
            let average_stability = accumulated_stability / (index as f32 + 1.0);
            let buildup_curve = if primary_explosion_index > 0 && index <= primary_explosion_index {
                (index as f32 / primary_explosion_index as f32).clamp(0.0, 1.0)
            } else {
                0.0
            };
            let aftershock_curve = if index > primary_explosion_index {
                ((index - primary_explosion_index) as f32
                    / (scene_video_paths
                        .len()
                        .saturating_sub(primary_explosion_index)
                        .max(1) as f32))
                    .clamp(0.0, 1.0)
            } else {
                0.0
            };
            let release_curve = if beat.map(|entry| entry.is_aftershock).unwrap_or(false) {
                0.65 + aftershock_curve * 0.25
            } else if beat.map(|entry| entry.is_resolution).unwrap_or(false) {
                0.82 + aftershock_curve * 0.18
            } else {
                aftershock_curve * 0.45
            };
            let local_pressure = if index == pre_primary_index && index < primary_explosion_index {
                1.0
            } else if primary_explosion_index >= 2 && index + 2 == primary_explosion_index {
                0.65
            } else {
                0.0
            };
            let local_release = if index == post_primary_index && index > primary_explosion_index {
                1.0
            } else if index == post_primary_index + 1 && index > primary_explosion_index {
                0.55
            } else {
                0.0
            };
            let secondary_pressure = if secondary_explosion_index != primary_explosion_index
                && index == pre_secondary_index
                && index < secondary_explosion_index
            {
                0.72
            } else if secondary_explosion_index != primary_explosion_index
                && secondary_explosion_index >= 2
                && index + 2 == secondary_explosion_index
            {
                0.42
            } else {
                0.0
            };
            let secondary_release = if secondary_explosion_index != primary_explosion_index
                && index == post_secondary_index
                && index > secondary_explosion_index
            {
                0.68
            } else if secondary_explosion_index != primary_explosion_index
                && index == post_secondary_index + 1
                && index > secondary_explosion_index
            {
                0.36
            } else {
                0.0
            };
            let chapter_recall = if beat.map(|entry| entry.is_resolution).unwrap_or(false) {
                0.28 + (secondary_release * 0.16)
            } else if index > secondary_explosion_index
                && secondary_explosion_index != primary_explosion_index
            {
                0.12
            } else {
                0.0
            };
            let same_role_echo = timeline
                .iter()
                .enumerate()
                .filter(|(timeline_index, entry)| {
                    *timeline_index != index && entry.section_role == section_role
                })
                .map(|(timeline_index, _)| {
                    let distance = (timeline_index as isize - index as isize).unsigned_abs() as f32;
                    (1.0 / (1.0 + distance)).clamp(0.0, 1.0)
                })
                .fold(0.0_f32, f32::max);
            let targeted_callback = shot
                .and_then(|plan| plan.motif_target_scene_id)
                .and_then(|target_scene_id| {
                    scenes
                        .iter()
                        .position(|scene| scene.id == target_scene_id)
                        .map(|target_index| {
                            let distance =
                                (index as isize - target_index as isize).unsigned_abs() as f32;
                            let callback_weight = shot
                                .map(|plan| match plan.motif_callback_style.as_str() {
                                    "direct-closing-response" => 0.56,
                                    "chapter-echo" => 0.34,
                                    "impact-hook" => 0.22,
                                    _ => 0.14,
                                })
                                .unwrap_or(0.14);
                            callback_weight + (1.0 / (1.0 + distance)).clamp(0.0, 1.0) * 0.16
                        })
                })
                .unwrap_or(0.0);
            let motif_return = if beat.map(|entry| entry.is_resolution).unwrap_or(false) {
                0.28 + same_role_echo * 0.12 + targeted_callback
            } else if index > primary_explosion_index && same_role_echo > 0.0 {
                0.08 + same_role_echo * 0.12 + targeted_callback * 0.4
            } else if index == resolution_index.saturating_sub(1) {
                0.12 + same_role_echo * 0.08 + targeted_callback * 0.55
            } else {
                same_role_echo * 0.05 + targeted_callback * 0.25
            };
            let chapter_counterpoint = if index < primary_explosion_index {
                local_pressure * 0.16 + secondary_pressure * 0.1
            } else if index > primary_explosion_index {
                local_release * 0.14 + secondary_release * 0.11 + motif_return * 0.08
            } else {
                0.06 + impact_weight * 0.08
            };
            let transition_density = (impact_weight * 0.48)
                + ((1.0 - stability_weight) * 0.22)
                + (motion_intensity * 0.18)
                + ((1.0 - shot.map(|plan| plan.transition_secs).unwrap_or(0.28)).clamp(0.0, 1.0)
                    * 0.12)
                + buildup_curve * 0.1
                + local_pressure * 0.16
                + secondary_pressure * 0.1
                - release_curve * 0.08
                - local_release * 0.14
                - secondary_release * 0.08
                - chapter_recall * 0.06
                - motif_return * 0.05
                + chapter_counterpoint * 0.04;
            let speed_feel = (average_impact * 0.45)
                + ((1.0 - average_stability) * 0.3)
                + (motion_intensity * 0.25)
                + buildup_curve * 0.12
                + local_pressure * 0.12
                + secondary_pressure * 0.08
                - release_curve * 0.07
                - local_release * 0.1
                - secondary_release * 0.06
                - chapter_recall * 0.08
                - motif_return * 0.06
                + chapter_counterpoint * 0.05;
            let fade_in_duration = if index == 0 {
                0.0
            } else if beat
                .map(|entry| entry.is_secondary_explosion)
                .unwrap_or(false)
            {
                0.08
            } else if beat.map(|entry| entry.is_aftershock).unwrap_or(false) {
                0.22
            } else if beat.map(|entry| entry.is_resolution).unwrap_or(false) {
                0.34
            } else {
                shot.map(|plan| (plan.transition_secs * 0.55).min(0.28))
                    .unwrap_or(0.12)
            } + (0.08 * stability_weight)
                - (0.06 * impact_weight)
                - (transition_density * 0.06)
                + (release_curve * 0.05)
                - (buildup_curve * 0.04)
                + (local_release * 0.06)
                + (secondary_release * 0.035)
                - (local_pressure * 0.05)
                - (secondary_pressure * 0.03);
            let fade_in_duration = fade_in_duration + (chapter_recall * 0.04);
            let fade_in_duration =
                fade_in_duration + (motif_return * 0.03) - (chapter_counterpoint * 0.02);
            let fade_out_duration = if index + 1 == scene_video_paths.len() {
                0.0
            } else if beat
                .map(|entry| entry.is_secondary_explosion)
                .unwrap_or(false)
            {
                0.12
            } else if beat.map(|entry| entry.is_aftershock).unwrap_or(false) {
                0.26
            } else if beat.map(|entry| entry.is_resolution).unwrap_or(false) {
                0.42
            } else {
                shot.map(|plan| plan.transition_secs.min(0.42))
                    .unwrap_or(0.18)
            } + (0.1 * average_stability)
                - (0.08 * average_impact)
                - (transition_density * 0.08)
                + (release_curve * 0.08)
                + (local_release * 0.11)
                + (secondary_release * 0.065)
                - (local_pressure * 0.06)
                - (secondary_pressure * 0.04);
            let fade_out_duration = fade_out_duration + (chapter_recall * 0.07);
            let fade_out_duration =
                fade_out_duration + (motif_return * 0.05) + (chapter_counterpoint * 0.015);
            let fade_in_duration = fade_in_duration.clamp(0.0, 0.42);
            let fade_out_duration = fade_out_duration.clamp(0.0, 0.58);
            let clip_duration = probe_media_duration(&self.ffprobe_bin, &scene_video_paths[index])?;
            let fade_out_start = if fade_out_duration > 0.0 {
                (clip_duration - fade_out_duration).max(0.0)
            } else {
                0.0
            };
            let brightness = match shot.map(|plan| plan.transition_style.as_str()) {
                Some("flash-cut") => 0.05,
                Some("lift-fade") => 0.025,
                Some("smash-dissolve") => -0.015,
                _ => 0.0,
            } + if beat
                .map(|entry| entry.is_secondary_explosion)
                .unwrap_or(false)
            {
                0.02
            } else if beat.map(|entry| entry.is_aftershock).unwrap_or(false) {
                -0.005
            } else if beat.map(|entry| entry.is_resolution).unwrap_or(false) {
                0.012
            } else {
                0.0
            } + (impact_weight - 0.45) * 0.06
                - (stability_weight - 0.7) * 0.025
                + (arc_progress - 0.5) * 0.018
                + buildup_curve * 0.025
                + local_pressure * 0.03
                - release_curve * 0.03
                - local_release * 0.045
                + secondary_pressure * 0.02
                - secondary_release * 0.03
                - chapter_recall * 0.028
                + motif_return * 0.018
                + chapter_counterpoint * 0.012;
            let saturation: f32 = match shot.map(|plan| plan.transition_style.as_str()) {
                Some("flash-cut") => 1.08_f32,
                Some("smash-dissolve") => 0.94_f32,
                Some("long-fade") => 0.96_f32,
                _ => 1.0_f32,
            } * if let Some(entry) = beat {
                if entry.is_secondary_explosion {
                    1.05
                } else if entry.is_aftershock {
                    0.97
                } else if entry.is_resolution {
                    0.95
                } else {
                    1.0
                }
            } else {
                1.0
            } + (average_impact - 0.5) * 0.08
                - (average_stability - 0.7) * 0.05
                + buildup_curve * 0.045
                + local_pressure * 0.04
                - release_curve * 0.06
                - local_release * 0.075
                + secondary_pressure * 0.03
                - secondary_release * 0.05
                - chapter_recall * 0.065
                + motif_return * 0.05
                + chapter_counterpoint * 0.018;
            let saturation = saturation.clamp(0.86, 1.16);
            let density_fx = if targeted_callback >= 0.5 {
                "tmix=frames=4:weights='1 2 2 1',gblur=sigma=0.24,colorbalance=rs=0.014:gs=0.006:bs=-0.006,"
            } else if motif_return >= 0.28 {
                "tmix=frames=4:weights='1 2 2 1',gblur=sigma=0.18,colorbalance=rs=0.01:gs=0.004:bs=-0.004,"
            } else if transition_density >= 0.9 || local_pressure >= 0.9 {
                "tmix=frames=2:weights='1 1',unsharp=7:7:1.0:5:5:0.45,"
            } else if secondary_pressure >= 0.68 {
                "tmix=frames=2:weights='1 1',unsharp=5:5:0.72:3:3:0.3,"
            } else if chapter_recall >= 0.26 {
                "tmix=frames=4:weights='1 2 2 1',gblur=sigma=0.22,"
            } else if transition_density >= 0.82 || buildup_curve >= 0.8 {
                "tmix=frames=2:weights='1 1',unsharp=5:5:0.8:3:3:0.35,"
            } else if transition_density >= 0.62 {
                "unsharp=5:5:0.65:3:3:0.25,"
            } else if local_release >= 0.9 {
                "tmix=frames=4:weights='1 2 2 1',"
            } else if secondary_release >= 0.6 {
                "tmix=frames=3:weights='1 1 1',"
            } else if average_stability >= 0.84 || release_curve >= 0.72 {
                "tmix=frames=3:weights='1 2 1',"
            } else {
                ""
            };
            let pace_gamma: f32 = if targeted_callback >= 0.5 {
                0.95_f32
            } else if motif_return >= 0.28 {
                0.97_f32
            } else if speed_feel >= 0.92 || local_pressure >= 0.9 {
                1.18_f32
            } else if secondary_pressure >= 0.68 {
                1.11_f32
            } else if chapter_recall >= 0.26 {
                0.95_f32
            } else if speed_feel >= 0.86 {
                1.15_f32
            } else if speed_feel >= 0.8 {
                1.12_f32
            } else if speed_feel >= 0.68 {
                1.07_f32
            } else if local_release >= 0.9 {
                0.94_f32
            } else if secondary_release >= 0.6 {
                0.96_f32
            } else if average_stability >= 0.84 || release_curve >= 0.72 {
                0.97_f32
            } else {
                1.02_f32
            };
            let mut filter = format!("[{index}:v:0]");
            if fade_in_duration > 0.0 {
                filter.push_str(&format!("fade=t=in:st=0:d={fade_in_duration:.3}:alpha=0,"));
            }
            if fade_out_duration > 0.0 {
                filter.push_str(&format!(
                    "fade=t=out:st={fade_out_start:.3}:d={fade_out_duration:.3}:alpha=0,"
                ));
            }
            if !density_fx.is_empty() {
                filter.push_str(density_fx);
            }
            if brightness != 0.0 {
                filter.push_str(&format!(
                    "eq=brightness={brightness:.3}:saturation={saturation:.3}:gamma={pace_gamma:.3},"
                ));
            } else if (saturation - 1.0).abs() > 0.001 || (pace_gamma - 1.0).abs() > 0.001 {
                filter.push_str(&format!(
                    "eq=saturation={saturation:.3}:gamma={pace_gamma:.3},"
                ));
            }
            filter.push_str(&format!("setpts=PTS-STARTPTS[v{index}]"));
            filter_parts.push(filter);
            prepared_inputs.push_str(&format!("[v{index}]"));
        }
        let concat_filter = format!(
            "{};{}concat=n={}:v=1:a=0[v]",
            filter_parts.join(";"),
            prepared_inputs,
            scene_video_paths.len()
        );
        concat_command
            .args([
                "-filter_complex",
                &concat_filter,
                "-map",
                "[v]",
                "-c:v",
                "libx264",
                "-pix_fmt",
                "yuv420p",
                "-an",
                "-movflags",
                "+faststart",
            ])
            .arg(&concat_silent_path);

        run_ffmpeg(&self.ffmpeg_bin, "compose concat", &mut concat_command)?;

        run_ffmpeg(
            &self.ffmpeg_bin,
            "compose mux",
            Command::new(&self.ffmpeg_bin)
                .args(["-y", "-i"])
                .arg(&concat_silent_path)
                .args(["-i"])
                .arg(audio_path)
                .args([
                    "-map",
                    "0:v:0",
                    "-map",
                    "1:a:0",
                    "-c:v",
                    "copy",
                    "-c:a",
                    "aac",
                    "-t",
                    &format!("{:.3}", music.duration_secs),
                    "-movflags",
                    "+faststart",
                ])
                .arg(&final_path),
        )?;

        let output_duration_secs = probe_media_duration(&self.ffprobe_bin, &final_path)?;
        let final_delta = (output_duration_secs - music.duration_secs).abs();
        if final_delta > 0.1 {
            return Err(VideoEngineError::SceneDurationMismatch {
                expected_secs: music.duration_secs,
                actual_secs: output_duration_secs,
            }
            .into());
        }

        Ok(ComposeResult {
            final_video_path: final_path.to_string_lossy().to_string(),
            matched: final_delta < 0.1,
            duration_delta_secs: final_delta,
            output_duration_secs,
            music_duration_secs: music.duration_secs,
        })
    }
}

fn run_ffmpeg(ffmpeg_bin: &str, step: &str, command: &mut Command) -> Result<()> {
    let output = command
        .output()
        .with_context(|| format!("failed to spawn ffmpeg for {step}"))?;
    if !output.status.success() {
        return Err(VideoEngineError::FfmpegCommandFailed {
            step: step.to_string(),
            message: String::from_utf8_lossy(&output.stderr)
                .chars()
                .take(800)
                .collect::<String>(),
        }
        .into());
    }
    let _ = ffmpeg_bin;
    Ok(())
}
