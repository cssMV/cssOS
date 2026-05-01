use std::path::PathBuf;

use anyhow::Result;

use super::types::{LatentFrameToken, TemporalConditioning, TemporalLatentPlan};

pub fn encode_plan_to_latents(plan: &TemporalLatentPlan) -> Result<Vec<LatentFrameToken>> {
    let mut tokens = Vec::with_capacity(plan.spacetime_patches.len());
    let mut prior_state_summary = plan
        .conditioning
        .bootstrap_state_summary
        .clone()
        .unwrap_or_else(|| {
            format!(
                "scene={} bootstrap temporal state, no prior latent decoded yet",
                plan.conditioning.scene_id
            )
        });
    for patch in &plan.spacetime_patches {
        tokens.push(LatentFrameToken {
            index: patch.index,
            timestamp_secs: patch.timestamp_secs,
            prompt: patch.prompt.clone(),
            conditioning_summary: summarize_conditioning(&plan.conditioning),
            prior_state_summary: prior_state_summary.clone(),
            patch_grid: patch.patch_grid,
            total_patch_grid: patch.total_patch_grid,
            motion_phase: patch.motion_phase,
            state_delta_prompt: patch.state_delta_prompt.clone(),
            latent_state_path: patch.latent_state_path.clone(),
            output_path: patch.output_path.clone(),
            strength: patch.patch_strength,
        });
        prior_state_summary = format!(
            "scene={} latent_step={} patch={:?}/{:?} phase={:.2} delta={}",
            plan.conditioning.scene_id,
            patch.index,
            patch.patch_grid,
            patch.total_patch_grid,
            patch.motion_phase,
            patch.state_delta_prompt
        );
    }
    Ok(tokens)
}

fn summarize_conditioning(conditioning: &TemporalConditioning) -> String {
    format!(
        "scene={} section={:?} style={:?} identity={} environment={} camera={} motion={} bootstrap={}",
        conditioning.scene_id,
        conditioning.section_type,
        conditioning.style_hint,
        conditioning.identity_prompt,
        conditioning.environment_prompt,
        conditioning.camera_prompt,
        conditioning.motion_prompt,
        conditioning
            .bootstrap_state_summary
            .as_deref()
            .unwrap_or("fresh_scene_bootstrap")
    )
}

pub fn latent_report_paths(latents: &[LatentFrameToken]) -> Vec<PathBuf> {
    latents
        .iter()
        .map(|token| token.output_path.clone())
        .collect()
}
