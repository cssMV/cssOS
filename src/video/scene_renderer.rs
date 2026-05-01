use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::process::Command;
use std::process::Stdio;

use anyhow::{Context, Result, anyhow};

use crate::video::consistency::{
    ArcTimelineBeat, CharacterContinuityMemory, NormalizedStyleProfile, ShotPlan,
    build_scene_continuity_memory, resolve_scene_quality,
};
use crate::video::contracts::{CharacterProfile, SceneInput, StyleProfile};
use crate::video::error::VideoEngineError;

#[derive(Debug, Clone)]
pub struct SceneRenderResult {
    pub video_path: PathBuf,
}

#[derive(Debug, Clone)]
pub struct SceneRenderer {
    ffmpeg_bin: String,
    ffprobe_bin: String,
}

impl Default for SceneRenderer {
    fn default() -> Self {
        Self::new()
    }
}

impl SceneRenderer {
    pub fn new() -> Self {
        Self {
            ffmpeg_bin: "ffmpeg".to_string(),
            ffprobe_bin: "ffprobe".to_string(),
        }
    }

    pub fn render_scene(
        &self,
        scene: &SceneInput,
        timeline_beat: &ArcTimelineBeat,
        previous_shot: Option<&ShotPlan>,
        next_shot: Option<&ShotPlan>,
        character_profiles: &[CharacterProfile],
        style: &NormalizedStyleProfile,
        style_input: &StyleProfile,
        shot: &ShotPlan,
        output_dir: &Path,
    ) -> Result<SceneRenderResult> {
        ensure_ffmpeg_exists(&self.ffmpeg_bin)?;
        ensure_ffprobe_exists(&self.ffprobe_bin)?;

        if scene.duration_secs <= 0.0 {
            return Err(VideoEngineError::InvalidSceneDuration {
                scene_id: scene.id.to_string(),
                duration_secs: scene.duration_secs,
            }
            .into());
        }

        fs::create_dir_all(output_dir).with_context(|| {
            format!(
                "failed to create scene output dir: {}",
                output_dir.display()
            )
        })?;

        let output_path = output_dir.join(format!("scene_{:03}.mp4", scene.id));
        let continuity_memory = build_scene_continuity_memory(scene, character_profiles);
        render_dynamic_video(
            &self.ffmpeg_bin,
            &self.ffprobe_bin,
            &output_path,
            scene.duration_secs,
            scene_render_seed(scene, style, shot),
            scene,
            timeline_beat,
            previous_shot,
            next_shot,
            &continuity_memory,
            style_input,
            shot,
            &scene.visual_script,
            &style.visual_tone,
            "scene renderer",
            1280,
            720,
        )?;

        Ok(SceneRenderResult {
            video_path: output_path,
        })
    }
}

pub(crate) fn render_dynamic_video(
    ffmpeg_bin: &str,
    ffprobe_bin: &str,
    output_path: &Path,
    duration_secs: f32,
    seed: u64,
    scene: &SceneInput,
    timeline_beat: &ArcTimelineBeat,
    previous_shot: Option<&ShotPlan>,
    next_shot: Option<&ShotPlan>,
    continuity_memory: &CharacterContinuityMemory,
    style_input: &StyleProfile,
    shot: &ShotPlan,
    visual_script: &str,
    visual_tone: &str,
    step_label: &str,
    width: u32,
    height: u32,
) -> Result<()> {
    ensure_ffmpeg_exists(ffmpeg_bin)?;
    ensure_ffprobe_exists(ffprobe_bin)?;

    if duration_secs <= 0.0 {
        return Err(anyhow!("duration must be positive for {step_label}"));
    }

    let arc_role = timeline_beat.section_role.as_str();
    let visual_source = derive_visual_source_profile(
        scene,
        visual_script,
        visual_tone,
        style_input,
        shot_size_seed_hint(shot.shot_size.as_str()),
        width,
        height,
    )?;
    let hue = (((seed % 360) as f32) - 180.0) + visual_source.hue_bias;
    let quality = resolve_scene_quality(scene, style_input);
    let performance_focus = quality.performance_focus.unwrap_or(0.64);
    let continuity_priority = quality.continuity_priority.unwrap_or(0.72);
    let cut_density = quality.cut_density.unwrap_or(0.5);
    let memory_stability =
        ((continuity_memory.framing_stability + continuity_priority) * 0.5).clamp(0.0, 1.0);
    let recurring_cast_count = continuity_memory.recurring_characters.len() as f32;
    let protagonist_priority = continuity_memory.protagonist_priority;
    let continuity_anchor = continuity_memory
        .anchor_location
        .as_deref()
        .or(continuity_memory.anchor_prop.as_deref())
        .unwrap_or("neutral-anchor");
    let focal_character = continuity_memory
        .focal_character
        .as_deref()
        .unwrap_or("ensemble");
    let shot_size = shot.shot_size.as_str();
    let shot_distance = continuity_memory.shot_distance_preference.as_str();
    let ensemble_mode = continuity_memory.ensemble_mode.as_str();
    let relationship_mode = continuity_memory.relationship_mode.as_str();
    let relationship_arc = shot.relationship_arc.as_str();
    let formation_balance = continuity_memory.formation_balance;
    let relationship_drift = match relationship_mode {
        "lead-support" => {
            if timeline_beat.is_primary_explosion {
                0.12
            } else if timeline_beat.is_secondary_explosion {
                0.08
            } else if beat_is_release_like(arc_role, timeline_beat) {
                -0.03
            } else {
                0.05
            }
        }
        "paired-equals" => {
            if timeline_beat.is_primary_explosion {
                0.03
            } else {
                0.0
            }
        }
        "triangle-led" => {
            if timeline_beat.is_primary_explosion {
                -0.045
            } else if beat_is_release_like(arc_role, timeline_beat) {
                0.028
            } else {
                -0.015
            }
        }
        "ensemble-led" => {
            if timeline_beat.is_primary_explosion {
                -0.075
            } else if beat_is_release_like(arc_role, timeline_beat) {
                0.04
            } else {
                -0.028
            }
        }
        _ => 0.0,
    };
    let formation_phase = match relationship_arc {
        "equals_to_lead" => "dominant_offset",
        "balanced_to_turn" => "rotating_pair",
        "lead_to_release" => "open_release",
        "scatter_to_center" => "collapse_to_center",
        "center_release" => "open_release",
        "ensemble_breath" => "breathing_arc",
        "solo_release" => "solo_release",
        _ => match ensemble_mode {
            "group" => {
                if timeline_beat.is_primary_explosion {
                    "collapse_to_center"
                } else if beat_is_release_like(arc_role, timeline_beat) {
                    "open_release"
                } else {
                    "breathing_arc"
                }
            }
            "duo" => {
                if relationship_mode == "lead-support" && timeline_beat.is_primary_explosion {
                    "dominant_offset"
                } else if relationship_mode == "paired-equals" {
                    "balanced_pair"
                } else {
                    "rotating_pair"
                }
            }
            "solo" => "solo_hold",
            _ => "environmental",
        },
    };
    let current_family = shot_family_label(shot_size);
    let previous_family = previous_shot
        .map(|plan| shot_family_label(plan.shot_size.as_str()))
        .unwrap_or("none");
    let next_family = next_shot
        .map(|plan| shot_family_label(plan.shot_size.as_str()))
        .unwrap_or("none");
    let family_continuity = if previous_family == current_family && next_family == current_family {
        1.0
    } else if previous_family == current_family || next_family == current_family {
        0.7
    } else {
        0.22
    };
    let family_transition_energy = if previous_family != "none" && previous_family != current_family
    {
        0.18
    } else if next_family != "none" && next_family != current_family {
        0.12
    } else {
        0.0
    };
    let focal_hash = focal_character.chars().fold(0_u64, |acc, ch| {
        acc.wrapping_mul(97).wrapping_add(ch as u64)
    });
    let anchor_hash = continuity_anchor.chars().fold(0_u64, |acc, ch| {
        acc.wrapping_mul(131).wrapping_add(ch as u64)
    });
    let base_anchor_x = match continuity_memory.composition_preference.as_str() {
        "ensemble_arc" => 0.26,
        "hero_center" | "center_duo" => 0.44,
        "left_anchor" => 0.32,
        _ => 0.35,
    };
    let base_anchor_y = if continuity_memory.composition_preference == "ensemble_arc" {
        0.3
    } else if continuity_memory.composition_preference == "center_duo" {
        0.4
    } else {
        0.35
    };
    let ensemble_anchor_shift = match ensemble_mode {
        "group" => -0.04,
        "duo" => 0.012,
        "solo" => 0.03,
        _ => 0.0,
    } + match relationship_mode {
        "lead-support" => 0.022,
        "paired-equals" => 0.0,
        "triangle-led" => -0.014,
        "ensemble-led" => -0.022,
        _ => 0.0,
    };
    let anchor_bias_x = base_anchor_x + ((anchor_hash % 18) as f32 / 100.0)
        - protagonist_priority * 0.04
        + ensemble_anchor_shift
        + (continuity_memory.focal_center_bias - 0.48)
        + ((focal_hash % 7) as f32 / 400.0)
        - family_transition_energy * 0.025
        - formation_balance * 0.018;
    let anchor_bias_x = anchor_bias_x + relationship_drift;
    let anchor_bias_y = base_anchor_y + (((anchor_hash / 7) % 18) as f32 / 100.0)
        - protagonist_priority * 0.03
        + ((focal_hash / 11 % 5) as f32 / 500.0)
        - family_transition_energy * 0.018
        - formation_balance * 0.01;
    let relationship_reframe = match relationship_mode {
        "lead-support" => {
            if arc_role == "chorus" {
                0.08
            } else if arc_role == "bridge" {
                0.04
            } else {
                0.03
            }
        }
        "paired-equals" => {
            if arc_role == "chorus" {
                0.02
            } else {
                0.0
            }
        }
        "triangle-led" => {
            if beat_is_release_like(arc_role, timeline_beat) {
                -0.035
            } else {
                -0.015
            }
        }
        "ensemble-led" => {
            if beat_is_release_like(arc_role, timeline_beat) {
                -0.06
            } else {
                -0.025
            }
        }
        _ => 0.0,
    } + match relationship_arc {
        "equals_to_lead" => 0.055,
        "balanced_to_turn" => 0.026,
        "lead_to_release" => -0.032,
        "scatter_to_center" => -0.052,
        "center_release" => -0.06,
        "ensemble_breath" => -0.015,
        "solo_release" => -0.022,
        _ => 0.0,
    };
    let saturation = 1.0 + ((seed % 25) as f32 / 100.0) + (performance_focus - 0.5) * 0.18
        - (memory_stability - 0.5) * 0.08
        + recurring_cast_count.min(2.0) * 0.015
        + visual_source.saturation_bias;
    let contrast = 1.05 + ((seed % 10) as f32 / 100.0) + visual_source.contrast_bias;
    let director_motion = quality.motion_intensity.unwrap_or_else(|| {
        if shot.motion_intensity > 0.0 {
            shot.motion_intensity
        } else {
            0.55
        }
    });
    let chorus_impact = quality.chorus_impact.unwrap_or(0.65);
    let speed = match arc_role {
        "chorus" => {
            if timeline_beat.is_primary_explosion {
                0.24 + director_motion * 0.24 + cut_density * 0.08
            } else {
                0.18 + director_motion * 0.22 + cut_density * 0.06
            }
        }
        "bridge" => 0.1 + director_motion * 0.1 + (1.0 - continuity_priority) * 0.04,
        "outro" => 0.05 + (1.0 - memory_stability) * 0.03 + performance_focus * 0.02,
        _ => 0.12 + director_motion * 0.16 + cut_density * 0.04 - memory_stability * 0.025,
    };
    let speed = match ensemble_mode {
        "group" => speed * 0.78,
        "duo" => speed * 0.88,
        "solo" => speed * 1.08,
        _ => speed,
    };
    let speed = match shot_size {
        "tight-close" => speed * 1.06,
        "two-shot" => speed * 0.94,
        "ensemble-wide" | "aerial" => speed * 0.9,
        _ => speed,
    };
    let shot_family_switch = match (ensemble_mode, shot_size) {
        ("solo", "tight-close") => 0.22,
        ("solo", "close-medium") | ("solo", "medium") => 0.18,
        ("duo", "two-shot") => 0.14,
        ("group", "ensemble-wide") => 0.12,
        ("group", "aerial") => 0.16,
        _ => 0.08,
    } + family_transition_energy * 0.4
        - family_continuity * 0.05;
    let speed = (speed - protagonist_priority * 0.02).max(0.035);
    let shot_switch_density = match shot_size {
        "tight-close" => 0.84,
        "medium" | "close-medium" => 0.7,
        "two-shot" => 0.58,
        "ensemble-wide" => 0.42,
        "aerial" | "establishing" => 0.36,
        _ => 0.52,
    } + match ensemble_mode {
        "solo" => 0.08,
        "duo" => 0.02,
        "group" => -0.04,
        _ => 0.0,
    } + family_transition_energy * 0.16
        - family_continuity * 0.08
        - formation_balance * 0.06;
    let shot_switch_density = shot_switch_density
        + match formation_phase {
            "dominant_offset" => 0.08,
            "rotating_pair" => 0.05,
            "breathing_arc" => 0.02,
            "collapse_to_center" => -0.03,
            "open_release" => -0.05,
            "solo_release" => -0.04,
            _ => 0.0,
        };
    let crop_scale = match shot_distance {
        "wide_ensemble" => 0.97 + ((seed % 4) as f32 / 100.0),
        "wide_release" => 0.93 + memory_stability * 0.03 + ((seed % 3) as f32 / 100.0),
        "medium_duo" => 0.9 + memory_stability * 0.02 + ((seed % 5) as f32 / 100.0),
        "hero_medium" => 0.85 + ((seed % 5) as f32 / 100.0),
        "close_pressure" => 0.78 + ((seed % 4) as f32 / 100.0),
        "hero_close" | "close_intro" => 0.75 + ((seed % 5) as f32 / 100.0),
        _ => match arc_role {
            "chorus" => 0.82 + ((seed % 5) as f32 / 100.0),
            "bridge" => 0.9 + ((seed % 4) as f32 / 100.0),
            "outro" => 0.94 + memory_stability * 0.03 + ((seed % 3) as f32 / 100.0),
            _ => 0.88 + memory_stability * 0.025 + ((seed % 6) as f32 / 100.0),
        },
    };
    let shot_family_pulse = match (ensemble_mode, shot_size) {
        ("solo", "tight-close") => shot_family_switch,
        ("solo", "close-medium") | ("solo", "medium") => shot_family_switch * 0.82,
        ("duo", "two-shot") => shot_family_switch * 0.6,
        ("group", "ensemble-wide") => shot_family_switch * 0.5,
        ("group", "aerial") => shot_family_switch * 0.42,
        _ => 0.0,
    } + family_transition_energy * 0.08
        - family_continuity * 0.04;
    let crop_w = ((width as f32) * crop_scale).round() as u32;
    let crop_h = ((height as f32) * crop_scale).round() as u32;
    let motion_amplitude = match ensemble_mode {
        "group" => 0.09,
        "duo" => 0.135,
        "solo" => 0.21,
        _ => 0.16,
    } - protagonist_priority * 0.03
        + match shot_size {
            "tight-close" => 0.03,
            "two-shot" => 0.0,
            "ensemble-wide" | "aerial" => -0.02,
            _ => 0.0,
        }
        - family_continuity * 0.012
        - formation_balance * 0.018;
    let motion_amplitude = motion_amplitude
        + match relationship_mode {
            "lead-support" => 0.018,
            "paired-equals" => 0.0,
            "triangle-led" => -0.01,
            "ensemble-led" => -0.018,
            _ => 0.0,
        };
    let motion_amplitude = motion_amplitude
        + match formation_phase {
            "dominant_offset" => 0.03,
            "rotating_pair" => 0.018,
            "breathing_arc" => 0.008,
            "collapse_to_center" => -0.02,
            "open_release" => -0.026,
            "solo_release" => -0.03,
            _ => 0.0,
        };
    let lateral_bias = match ensemble_mode {
        "group" => 0.06,
        "duo" => 0.11,
        "solo" => 0.18,
        _ => 0.12,
    } + match relationship_mode {
        "lead-support" => 0.035,
        "paired-equals" => 0.012,
        "triangle-led" => -0.01,
        "ensemble-led" => -0.016,
        _ => 0.0,
    };
    let vertical_bias = match shot_distance {
        "wide_ensemble" | "wide_release" => 0.05,
        "medium_duo" => 0.08,
        "hero_medium" => 0.1,
        "close_pressure" | "hero_close" | "close_intro" => 0.13,
        _ => 0.09,
    } - formation_balance * 0.018;
    let formation_fx = match relationship_mode {
        "lead-support" => "unsharp=7:7:1.0:5:5:0.42,",
        "paired-equals" => "tmix=frames=2:weights='1 1',",
        "triangle-led" => "gblur=sigma=0.22,",
        "ensemble-led" => "minterpolate=fps=30:mi_mode=blend,",
        _ => "",
    };
    let formation_phase_fx = match formation_phase {
        "dominant_offset" => "unsharp=5:5:0.72:3:3:0.28,",
        "rotating_pair" => "tmix=frames=2:weights='1 1',",
        "collapse_to_center" => "gblur=sigma=0.18,",
        "open_release" => "tmix=frames=3:weights='1 2 1',",
        "breathing_arc" => "minterpolate=fps=30:mi_mode=blend,",
        "solo_release" => "tmix=frames=3:weights='1 2 1',gblur=sigma=0.18,",
        _ => "",
    };
    let (crop_x, crop_y) = match arc_role {
        "chorus" => (
            format!(
                "(iw-{crop_w})*({:.3}+{:.3}*sin(t*{speed:.3}*1.8))",
                anchor_bias_x + relationship_reframe,
                (motion_amplitude + lateral_bias * 0.35 + shot_family_pulse * 0.22).max(0.04)
            ),
            format!(
                "(ih-{crop_h})*({anchor_bias_y:.3}+{:.3}*cos(t*{speed:.3}*1.4))",
                (motion_amplitude + vertical_bias * 0.22 + shot_family_pulse * 0.18).max(0.04)
            ),
        ),
        "bridge" => (
            format!(
                "(iw-{crop_w})*({:.3}+{:.3}*sin(t*{speed:.3}*0.85))",
                anchor_bias_x + relationship_reframe * 0.72,
                ((motion_amplitude * 0.82) + lateral_bias * 0.24 + shot_family_pulse * 0.16)
                    .max(0.05)
            ),
            format!(
                "(ih-{crop_h})*({anchor_bias_y:.3}+{:.3}*sin(t*{speed:.3}*0.55))",
                ((motion_amplitude * 0.78) + vertical_bias * 0.18 + shot_family_pulse * 0.13)
                    .max(0.05)
            ),
        ),
        "outro" => (
            format!(
                "(iw-{crop_w})*({:.3}+{:.3}*cos(t*{speed:.3}*0.45))",
                anchor_bias_x + relationship_reframe * 0.4,
                ((motion_amplitude * 0.65) + lateral_bias * 0.12 + shot_family_pulse * 0.1)
                    .max(0.04)
            ),
            format!(
                "(ih-{crop_h})*({anchor_bias_y:.3}+{:.3}*cos(t*{speed:.3}*0.35))",
                ((motion_amplitude * 0.65) + vertical_bias * 0.12 + shot_family_pulse * 0.08)
                    .max(0.04)
            ),
        ),
        _ => (
            format!(
                "(iw-{crop_w})*({:.3}+{:.3}*sin(t*{speed:.3}))",
                anchor_bias_x + relationship_reframe * 0.55,
                (motion_amplitude + lateral_bias * 0.16 + shot_family_pulse * 0.12).max(0.05)
            ),
            format!(
                "(ih-{crop_h})*({anchor_bias_y:.3}+{:.3}*cos(t*{speed:.3}))",
                (motion_amplitude + vertical_bias * 0.14 + shot_family_pulse * 0.1).max(0.05)
            ),
        ),
    };
    let grain = if !visual_source.grain.is_empty() {
        visual_source.grain.as_str()
    } else if visual_tone.to_lowercase().contains("dream") {
        "noise=alls=18:allf=t+u"
    } else if arc_role == "bridge" {
        "noise=alls=10:allf=t+u"
    } else if continuity_priority >= 0.84 {
        "noise=alls=5:allf=t+u"
    } else if chorus_impact >= 0.8 {
        "noise=alls=12:allf=t+u"
    } else {
        "noise=alls=8:allf=t+u"
    };
    let shot_family_fx = match (ensemble_mode, shot_size) {
        ("solo", "tight-close") => "unsharp=9:9:1.15:5:5:0.55,",
        ("solo", "close-medium") | ("solo", "medium") => "unsharp=7:7:0.95:5:5:0.4,",
        ("duo", "two-shot") => "tmix=frames=2:weights='1 1',gblur=sigma=0.28,",
        ("group", "ensemble-wide") => "minterpolate=fps=30:mi_mode=blend,gblur=sigma=0.22,",
        ("group", "aerial") => "tmix=frames=3:weights='1 2 1',gblur=sigma=0.48,",
        _ => "",
    };
    let family_memory_fx = if family_continuity >= 0.9 {
        "minterpolate=fps=30:mi_mode=blend,"
    } else if family_transition_energy >= 0.16 {
        "tmix=frames=2:weights='1 1',"
    } else {
        ""
    };
    let focal_memory_fx = if continuity_memory.focal_character.is_some() && family_continuity >= 0.7
    {
        "colorbalance=rs=0.008:gs=0.004:bs=-0.004,"
    } else if continuity_memory.focal_character.is_some() {
        "eq=contrast=1.03,"
    } else {
        ""
    };
    let brightness = match arc_role {
        "chorus" => {
            if timeline_beat.is_primary_explosion {
                0.06 + performance_focus * 0.02
            } else {
                0.04
            }
        }
        "bridge" => -0.01 + performance_focus * 0.005,
        "outro" => 0.015 + memory_stability * 0.01,
        _ => {
            if chorus_impact >= 0.8 {
                0.04
            } else {
                0.0
            }
        }
    } + (shot_switch_density - 0.5) * 0.018;
    let director_gamma = match arc_role {
        "chorus" => 1.1,
        "bridge" => 1.04,
        "outro" => 1.0,
        _ => {
            if director_motion >= 0.8 {
                1.08
            } else {
                1.02
            }
        }
    };
    let director_gamma = director_gamma
        + match ensemble_mode {
            "solo" => 0.04,
            "duo" => 0.015,
            "group" => -0.02,
            _ => 0.0,
        }
        + match shot_size {
            "tight-close" => 0.03,
            "ensemble-wide" | "aerial" => -0.02,
            _ => 0.0,
        };
    let base_input = match &visual_source.input {
        VisualInputSource::Lavfi(spec) if !spec.is_empty() => spec.clone(),
        _ => match shot_size {
            "tight-close" => format!("mandelbrot=size={}x{}:rate=30", width, height),
            "two-shot" => format!("testsrc2=size={}x{}:rate=30", width, height),
            "ensemble-wide" => {
                format!(
                    "life=size={}x{}:rate=30:random_seed={}",
                    width,
                    height,
                    seed % 10_000
                )
            }
            "aerial" => format!("cellauto=size={}x{}:rate=30:rule=110", width, height),
            _ => match arc_role {
                "chorus" => format!("testsrc2=size={}x{}:rate=30", width, height),
                "bridge" => format!("cellauto=size={}x{}:rate=30:rule=110", width, height),
                "outro" => format!("mandelbrot=size={}x{}:rate=30", width, height),
                _ => format!(
                    "life=size={}x{}:rate=30:random_seed={}",
                    width,
                    height,
                    seed % 10_000
                ),
            },
        },
    };
    let ensemble_fx = match ensemble_mode {
        "solo" => "unsharp=7:7:1.0:5:5:0.5,",
        "duo" => "tmix=frames=2:weights='1 1',",
        "group" => "minterpolate=fps=30:mi_mode=blend,",
        _ => "",
    };
    let shot_fx = match shot_size {
        "tight-close" => "unsharp=7:7:1.1:5:5:0.5,",
        "two-shot" => "gblur=sigma=0.3,tmix=frames=2:weights='1 1',",
        "ensemble-wide" => "gblur=sigma=0.2,minterpolate=fps=30:mi_mode=blend,",
        "aerial" => "gblur=sigma=0.45,tmix=frames=2:weights='1 1',",
        "establishing" => "gblur=sigma=0.15,",
        _ => "",
    };
    let extra_fx = match arc_role {
        "chorus" => {
            if timeline_beat.is_primary_explosion {
                "unsharp=7:7:1.0:5:5:0.5,tmix=frames=2:weights='1 1',"
            } else {
                "unsharp=5:5:0.8:3:3:0.4,"
            }
        }
        "bridge" => {
            if cut_density >= 0.65 {
                "gblur=sigma=0.9,colorbalance=rs=0.01:gs=0.005:bs=-0.006,"
            } else {
                "gblur=sigma=0.8,"
            }
        }
        "outro" => "tmix=frames=3:weights='1 2 1',",
        _ => {
            if memory_stability >= 0.84 {
                "minterpolate=fps=30:mi_mode=blend,colorbalance=rs=0.01:gs=0.005:bs=-0.005,"
            } else {
                ""
            }
        }
    };
    let vf = format!(
        "fps=30,scale={width}:{height},crop={crop_w}:{crop_h}:{crop_x}:{crop_y},scale={width}:{height},{family_memory_fx}{focal_memory_fx}{formation_fx}{formation_phase_fx}{ensemble_fx}{shot_family_fx}{shot_fx}{visual_source_fx}{extra_fx}eq=saturation={saturation:.3}:contrast={contrast:.3}:brightness={brightness:.3}:gamma={director_gamma:.3},hue=h={hue:.3},{grain},setsar=1,format=yuv420p",
        visual_source_fx = visual_source.fx
    );

    let mut command = Command::new(ffmpeg_bin);
    command.arg("-y");
    match &visual_source.input {
        VisualInputSource::VideoFile(path) => {
            command.arg("-stream_loop").arg("-1").arg("-i").arg(path);
        }
        VisualInputSource::ImageFile(path) => {
            command.arg("-loop").arg("1").arg("-i").arg(path);
        }
        _ => {
            command.arg("-f").arg("lavfi").arg("-i").arg(&base_input);
        }
    }
    let output = command
        .args([
            "-t",
            &format!("{duration_secs:.3}"),
            "-vf",
            &vf,
            "-pix_fmt",
            "yuv420p",
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-movflags",
            "+faststart",
        ])
        .arg(output_path)
        .output()
        .with_context(|| format!("failed to spawn ffmpeg for {step_label}"))?;

    if !output.status.success() {
        return Err(VideoEngineError::FfmpegCommandFailed {
            step: step_label.to_string(),
            message: stderr_summary(&output.stderr),
        }
        .into());
    }

    validate_playable_video(ffprobe_bin, output_path, duration_secs)?;
    Ok(())
}

pub(crate) fn validate_playable_video(
    ffprobe_bin: &str,
    path: &Path,
    expected_duration_secs: f32,
) -> Result<()> {
    if !path.exists() {
        return Err(VideoEngineError::MissingOutputPath {
            path: path.to_path_buf(),
        }
        .into());
    }
    let metadata = fs::metadata(path)
        .with_context(|| format!("failed to read video metadata: {}", path.display()))?;
    if metadata.len() < 8_000 {
        return Err(VideoEngineError::OutputTooSmall {
            path: path.to_path_buf(),
        }
        .into());
    }
    let actual = probe_media_duration(ffprobe_bin, path)?;
    if (actual - expected_duration_secs).abs() > 0.12 {
        return Err(anyhow!(
            "rendered video duration mismatch for {}: expected {:.3}s, got {:.3}s",
            path.display(),
            expected_duration_secs,
            actual
        ));
    }
    Ok(())
}

pub(crate) fn probe_media_duration(ffprobe_bin: &str, path: &Path) -> Result<f32> {
    ensure_ffprobe_exists(ffprobe_bin)?;
    let output = Command::new(ffprobe_bin)
        .args([
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
        ])
        .arg(path)
        .output()
        .with_context(|| format!("failed to run ffprobe for {}", path.display()))?;
    if !output.status.success() {
        return Err(VideoEngineError::FfmpegCommandFailed {
            step: "ffprobe".to_string(),
            message: stderr_summary(&output.stderr),
        }
        .into());
    }
    let raw = String::from_utf8_lossy(&output.stdout);
    let parsed = raw
        .trim()
        .parse::<f32>()
        .with_context(|| format!("failed to parse ffprobe duration for {}", path.display()))?;
    Ok(parsed)
}

fn ensure_ffmpeg_exists(ffmpeg_bin: &str) -> Result<()> {
    let status = Command::new(ffmpeg_bin)
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    match status {
        Ok(found) if found.success() => Ok(()),
        _ => Err(VideoEngineError::FfmpegUnavailable.into()),
    }
}

fn ensure_ffprobe_exists(ffprobe_bin: &str) -> Result<()> {
    let status = Command::new(ffprobe_bin)
        .arg("-version")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
    match status {
        Ok(found) if found.success() => Ok(()),
        _ => Err(VideoEngineError::FfprobeUnavailable.into()),
    }
}

fn truncate_chars(value: &str, limit: usize) -> String {
    value.chars().take(limit).collect()
}

fn scene_render_seed(scene: &SceneInput, style: &NormalizedStyleProfile, shot: &ShotPlan) -> u64 {
    let mut hasher = DefaultHasher::new();
    scene.id.hash(&mut hasher);
    scene.section_type.hash(&mut hasher);
    scene.visual_script.hash(&mut hasher);
    scene.text_block.hash(&mut hasher);
    style.consistency_seed.hash(&mut hasher);
    style.genre.hash(&mut hasher);
    shot.lens_profile.hash(&mut hasher);
    shot.movement.hash(&mut hasher);
    hasher.finish()
}

fn shot_family_label(shot_size: &str) -> &'static str {
    match shot_size {
        "tight-close" | "close-medium" | "medium" => "solo-close-family",
        "two-shot" => "duo-family",
        "ensemble-wide" | "aerial" | "establishing" => "group-wide-family",
        _ => "general-family",
    }
}

fn shot_size_seed_hint(shot_size: &str) -> &'static str {
    match shot_size {
        "tight-close" | "close-medium" | "medium" => "close",
        "two-shot" => "paired",
        "ensemble-wide" | "aerial" | "establishing" => "wide",
        _ => "general",
    }
}

fn beat_is_release_like(arc_role: &str, beat: &ArcTimelineBeat) -> bool {
    arc_role == "outro" || beat.is_aftershock || beat.is_resolution
}

fn allow_synthetic_video_inputs() -> bool {
    matches!(
        std::env::var("CSS_VIDEO_ALLOW_SYNTHETIC")
            .ok()
            .as_deref()
            .map(|value| value.trim().to_ascii_lowercase()),
        Some(value) if matches!(value.as_str(), "1" | "true" | "yes" | "on")
    )
}

#[derive(Debug, Clone)]
struct VisualSourceProfile {
    input: VisualInputSource,
    fx: String,
    grain: String,
    hue_bias: f32,
    saturation_bias: f32,
    contrast_bias: f32,
}

#[derive(Debug, Clone)]
enum VisualInputSource {
    Lavfi(String),
    VideoFile(PathBuf),
    ImageFile(PathBuf),
}

fn derive_visual_source_profile(
    scene: &SceneInput,
    visual_script: &str,
    visual_tone: &str,
    style_input: &StyleProfile,
    shot_hint: &str,
    width: u32,
    height: u32,
) -> Result<VisualSourceProfile> {
    let corpus = format!(
        "{} {} {} {} {} {}",
        scene.text_block,
        visual_script,
        scene.entities.location,
        scene.entities.props.join(" "),
        style_input.genre,
        visual_tone
    )
    .to_lowercase();
    let is_city = corpus.contains("city")
        || corpus.contains("street")
        || corpus.contains("skyline")
        || corpus.contains("neon");
    let is_rain = corpus.contains("rain") || corpus.contains("storm") || corpus.contains("wet");
    let is_light = corpus.contains("light")
        || corpus.contains("glow")
        || corpus.contains("halo")
        || corpus.contains("aurora");
    let is_nature = corpus.contains("flower")
        || corpus.contains("forest")
        || corpus.contains("field")
        || corpus.contains("ocean");
    let is_crowd = corpus.contains("crowd")
        || corpus.contains("choir")
        || corpus.contains("group")
        || corpus.contains("audience");
    let is_fire = corpus.contains("fire") || corpus.contains("ember") || corpus.contains("burn");

    let input = match select_real_visual_asset(scene) {
        Some(source) => source,
        None if allow_synthetic_video_inputs() => VisualInputSource::Lavfi(if is_city && is_rain {
            format!("color=c=#18263a:size={}x{}:rate=30", width, height)
        } else if is_city {
            format!("color=c=#1d2940:size={}x{}:rate=30", width, height)
        } else if is_nature && is_light {
            format!("color=c=#35523d:size={}x{}:rate=30", width, height)
        } else if is_nature {
            format!("color=c=#284236:size={}x{}:rate=30", width, height)
        } else if is_crowd {
            format!("color=c=#40344a:size={}x{}:rate=30", width, height)
        } else if is_fire {
            format!("color=c=#6f5544:size={}x{}:rate=30", width, height)
        } else if shot_hint == "wide" {
            format!("color=c=#243246:size={}x{}:rate=30", width, height)
        } else {
            format!("color=c=#243246:size={}x{}:rate=30", width, height)
        }),
        None => {
            return Err(anyhow!(
                "video rendering requires real reference media; no reference image/video found for scene {}",
                scene.id
            ));
        }
    };

    let fx = if is_city && is_rain {
        "gblur=sigma=0.35,eq=contrast=1.05:saturation=0.96:brightness=-0.02,".to_string()
    } else if is_city {
        "unsharp=5:5:0.45:3:3:0.2,".to_string()
    } else if is_nature && is_light {
        "gblur=sigma=0.35,colorbalance=rs=0.012:gs=0.02:bs=-0.008,".to_string()
    } else if is_nature {
        "tmix=frames=2:weights='1 1',".to_string()
    } else if is_crowd {
        "minterpolate=fps=30:mi_mode=blend,".to_string()
    } else if is_fire {
        "unsharp=7:7:0.9:5:5:0.45,".to_string()
    } else {
        String::new()
    };

    let grain = if is_rain {
        "noise=alls=12:allf=t+u".to_string()
    } else if is_nature && visual_tone.to_lowercase().contains("dream") {
        "noise=alls=10:allf=t+u".to_string()
    } else {
        String::new()
    };

    let hue_bias = if is_city {
        -18.0
    } else if is_nature {
        14.0
    } else if is_fire {
        22.0
    } else {
        0.0
    };
    let saturation_bias = if is_light {
        0.06
    } else if is_rain {
        -0.04
    } else {
        0.0
    };
    let contrast_bias = if is_city || is_fire {
        0.06
    } else if is_nature {
        0.02
    } else {
        0.0
    };

    Ok(VisualSourceProfile {
        input,
        fx,
        grain,
        hue_bias,
        saturation_bias,
        contrast_bias,
    })
}

fn select_real_visual_asset(scene: &SceneInput) -> Option<VisualInputSource> {
    for raw in &scene.reference_media_paths {
        let candidate = PathBuf::from(raw);
        if !candidate.exists() {
            continue;
        }
        let ext = candidate
            .extension()
            .and_then(|value| value.to_str())
            .map(|value| value.to_ascii_lowercase())
            .unwrap_or_default();
        if matches!(ext.as_str(), "mp4" | "mov" | "m4v" | "webm") {
            return Some(VisualInputSource::VideoFile(candidate));
        }
        if matches!(ext.as_str(), "jpg" | "jpeg" | "png" | "webp") {
            return Some(VisualInputSource::ImageFile(candidate));
        }
    }
    None
}

fn stderr_summary(stderr: &[u8]) -> String {
    let text = String::from_utf8_lossy(stderr);
    let compact = text.trim();
    if compact.is_empty() {
        "ffmpeg returned a non-zero status without stderr".to_string()
    } else {
        truncate_chars(compact, 600)
    }
}
