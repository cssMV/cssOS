use std::path::Path;

use anyhow::Result;

use crate::video::backend::types::SceneInput;
use crate::video::temporal_latent::types::{
    LatentFrameToken, TemporalDecoderMetrics, TemporalRenderConfig,
};
use crate::video::video_model::condition::ConditionInput;
use crate::video::video_model::pipeline::generate_video_with_condition_to_path;
use crate::video::video_model::types::VideoCondition;

fn summarize_motion_window(latents: &[LatentFrameToken]) -> String {
    if latents.is_empty() {
        return "continuous motion with persistent identity and uninterrupted world state"
            .to_string();
    }
    let mut highlights = latents
        .iter()
        .step_by((latents.len() / 6).max(1))
        .map(|latent| latent.state_delta_prompt.trim())
        .filter(|value| !value.is_empty())
        .take(6)
        .collect::<Vec<_>>();
    highlights.dedup();
    if highlights.is_empty() {
        "continuous motion with persistent identity and uninterrupted world state".to_string()
    } else {
        highlights.join(" ; ")
    }
}

pub fn render_scene_longform_temporal_video(
    scene: &SceneInput,
    config: &TemporalRenderConfig,
    rendered_latents: &[LatentFrameToken],
    output_path: &Path,
    bootstrap_state_summary: Option<&str>,
) -> Result<TemporalDecoderMetrics> {
    let continuity_prompt = bootstrap_state_summary
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("same world state carried from previous continuous segment");
    let prompt = format!(
        "{script}. CONTINUITY LOCK: {continuity}. LONG-FORM TEMPORAL DIRECTIVE: generate continuous motion for the full scene duration as one latent video rollout, not as still-image interpolation. MOTION ARC: {motion_arc}. Preserve identity, costume, geography, lighting logic, and camera inertia across the whole section.",
        script = scene.visual_script,
        continuity = continuity_prompt,
        motion_arc = summarize_motion_window(rendered_latents),
    );
    let condition = ConditionInput {
        prompt,
        characters: vec![],
        actions: vec![],
        environment: vec![],
        camera: None,
        style: scene.style_hint.clone(),
        trajectories: vec![],
        scene_3d: None,
    };
    let base = VideoCondition {
        prompt: scene.visual_script.clone(),
        duration: scene.duration_secs,
        fps: config.fps as usize,
    };
    let _ = generate_video_with_condition_to_path(condition, base, output_path)?;
    Ok(TemporalDecoderMetrics {
        mode: "longform_latent_video_backend_v1".to_string(),
        frame_count: ((scene.duration_secs.max(0.1) * config.fps.max(1) as f32).round() as usize)
            .max(1),
        fps: config.fps,
        clip_duration_secs: scene.duration_secs.max(0.0),
        overlap_duration_secs: 0.0,
        latent_hold_ratio: 0.0,
        used_motion_interpolation: false,
    })
}
