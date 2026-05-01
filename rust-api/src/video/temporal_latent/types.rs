use std::path::PathBuf;

use serde::{Deserialize, Serialize};

use crate::video::backend::types::SceneInput as BackendSceneInput;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemporalConditioning {
    pub scene_id: u32,
    pub section_type: Option<String>,
    pub style_hint: Option<String>,
    pub narrative_prompt: String,
    pub identity_prompt: String,
    pub environment_prompt: String,
    pub camera_prompt: String,
    pub motion_prompt: String,
    pub bootstrap_state_summary: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpacetimePatchSpec {
    pub index: usize,
    pub timestamp_secs: f32,
    pub patch_strength: f32,
    pub patch_grid: (u32, u32),
    pub total_patch_grid: (u32, u32),
    pub motion_phase: f32,
    pub state_delta_prompt: String,
    pub prompt: String,
    pub latent_state_path: PathBuf,
    pub output_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LatentFrameToken {
    pub index: usize,
    pub timestamp_secs: f32,
    pub prompt: String,
    pub conditioning_summary: String,
    pub prior_state_summary: String,
    pub patch_grid: (u32, u32),
    pub total_patch_grid: (u32, u32),
    pub motion_phase: f32,
    pub state_delta_prompt: String,
    pub latent_state_path: PathBuf,
    pub output_path: PathBuf,
    pub strength: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemporalLatentPlan {
    pub conditioning: TemporalConditioning,
    pub duration_secs: f32,
    pub fps: u32,
    pub width: u32,
    pub height: u32,
    pub spacetime_patches: Vec<SpacetimePatchSpec>,
    pub output_path: PathBuf,
    pub report_path: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemporalDecoderMetrics {
    pub mode: String,
    pub frame_count: usize,
    pub fps: u32,
    pub clip_duration_secs: f32,
    pub overlap_duration_secs: f32,
    pub latent_hold_ratio: f32,
    pub used_motion_interpolation: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemporalStateContinuityMetrics {
    pub patch_count: usize,
    pub monotonic_phase_ratio: f32,
    pub phase_backtrack_count: usize,
    pub conditioned_step_ratio: f32,
    pub unique_patch_ratio: f32,
    pub mean_state_delta_chars: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TemporalLatentReport {
    pub scene_id: u32,
    pub renderer: String,
    pub duration_secs: f32,
    pub fps: u32,
    pub width: u32,
    pub height: u32,
    pub patch_count: usize,
    pub output_path: String,
    pub fallback_used: bool,
    pub latent_token_count: usize,
    pub latent_state_artifact_count: usize,
    pub unified_latent_representation: bool,
    pub decoder_metrics: TemporalDecoderMetrics,
    pub state_continuity: TemporalStateContinuityMetrics,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct TemporalRenderConfig {
    pub fps: u32,
    pub width: u32,
    pub height: u32,
    pub target_patch_span_secs: f32,
    pub min_patch_count: usize,
    pub max_patch_count: usize,
}

impl Default for TemporalRenderConfig {
    fn default() -> Self {
        Self {
            fps: 24,
            width: 1280,
            height: 720,
            target_patch_span_secs: 0.75,
            min_patch_count: 12,
            max_patch_count: 240,
        }
    }
}

impl TemporalRenderConfig {
    pub fn patch_count_for_duration(&self, duration_secs: f32, continuity_first: bool) -> usize {
        let span = self.target_patch_span_secs.clamp(0.15, 12.0);
        let mut patch_count = (duration_secs.max(1.0) / span).ceil() as usize;
        if continuity_first {
            patch_count = patch_count.max(16);
        }
        patch_count.clamp(
            self.min_patch_count.max(1),
            self.max_patch_count.max(self.min_patch_count.max(1)),
        )
    }
}

impl TemporalConditioning {
    pub fn from_scene(scene: &BackendSceneInput) -> Self {
        Self {
            scene_id: scene.id,
            section_type: scene.section_type.clone(),
            style_hint: scene.style_hint.clone(),
            narrative_prompt: scene.visual_script.clone(),
            identity_prompt: "consistent character identity, same face, same costumes".to_string(),
            environment_prompt: "same environment continuity, preserved world geometry".to_string(),
            camera_prompt: "cinematic camera motion, coherent shot progression".to_string(),
            motion_prompt: "continuous temporal motion, physically plausible movement".to_string(),
            bootstrap_state_summary: None,
        }
    }
}

impl TemporalStateContinuityMetrics {
    pub fn from_latents(latents: &[LatentFrameToken]) -> Self {
        if latents.is_empty() {
            return Self {
                patch_count: 0,
                monotonic_phase_ratio: 1.0,
                phase_backtrack_count: 0,
                conditioned_step_ratio: 0.0,
                unique_patch_ratio: 0.0,
                mean_state_delta_chars: 0.0,
            };
        }

        let mut monotonic_steps = 0usize;
        let mut phase_backtrack_count = 0usize;
        let mut conditioned_steps = 0usize;
        let mut unique_patches = std::collections::BTreeSet::new();
        let mut total_delta_chars = 0usize;

        for (index, latent) in latents.iter().enumerate() {
            unique_patches.insert(latent.patch_grid);
            total_delta_chars += latent.state_delta_prompt.chars().count();

            if !latent.prior_state_summary.trim().is_empty() {
                conditioned_steps += 1;
            }

            if let Some(prev) = index.checked_sub(1).and_then(|i| latents.get(i)) {
                if latent.motion_phase >= prev.motion_phase {
                    monotonic_steps += 1;
                } else {
                    phase_backtrack_count += 1;
                }
            }
        }

        let transition_count = latents.len().saturating_sub(1);
        let monotonic_phase_ratio = if transition_count == 0 {
            1.0
        } else {
            monotonic_steps as f32 / transition_count as f32
        };

        Self {
            patch_count: latents.len(),
            monotonic_phase_ratio,
            phase_backtrack_count,
            conditioned_step_ratio: conditioned_steps as f32 / latents.len() as f32,
            unique_patch_ratio: unique_patches.len() as f32 / latents.len() as f32,
            mean_state_delta_chars: total_delta_chars as f32 / latents.len() as f32,
        }
    }
}
