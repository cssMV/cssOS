use std::fs;

use anyhow::Result;
use serde::Serialize;

use crate::video::openai_client::generate_image;

use super::types::LatentFrameToken;

#[derive(Debug, Serialize)]
struct LatentStateArtifact<'a> {
    index: usize,
    timestamp_secs: f32,
    patch_grid: (u32, u32),
    total_patch_grid: (u32, u32),
    motion_phase: f32,
    state_delta_prompt: &'a str,
    prior_state_summary: &'a str,
    conditioning_summary: &'a str,
    render_preview_path: String,
}

pub fn sample_spacetime_latents(
    api_key: &str,
    latents: &[LatentFrameToken],
) -> Result<Vec<LatentFrameToken>> {
    let mut sampled = Vec::with_capacity(latents.len());
    let mut prev_prompt = String::new();
    let mut prev_state_summary = String::new();

    for latent in latents {
        let prompt = if prev_prompt.is_empty() {
            format!(
                "{prompt}. SPACETIME PATCH ROOT. Build the initial latent state for a continuous video rollout. \
                 Preserve world continuity and initialize a stable actor/world manifold. \
                 Patch={patch:?}/{grid:?}. Phase={phase:.2}. State delta={delta}. \
                 Strength={strength:.2}. Prior state={prior_state}. {conditioning}",
                prompt = latent.prompt,
                patch = latent.patch_grid,
                grid = latent.total_patch_grid,
                phase = latent.motion_phase,
                delta = latent.state_delta_prompt,
                strength = latent.strength,
                prior_state = latent.prior_state_summary,
                conditioning = latent.conditioning_summary,
            )
        } else {
            format!(
                "{prompt}. SPACETIME PATCH STEP. Previous latent prompt: {prev}. Previous latent state: {prev_state}. \
                 Maintain same actor, same world, same light, same camera trajectory, and same scene geometry. \
                 This patch is a direct continuation in latent space, not a new static anchor and not a reset. \
                 Advance only by the requested state delta while preserving identity, costume, pose family, framing, and environment continuity. \
                 Patch={patch:?}/{grid:?}. Phase={phase:.2}. State delta={delta}. \
                 No jump cut, no scene reset, no new composition. Strength={strength:.2}. {conditioning}",
                prompt = latent.prompt,
                prev = prev_prompt,
                prev_state = prev_state_summary,
                patch = latent.patch_grid,
                grid = latent.total_patch_grid,
                phase = latent.motion_phase,
                delta = latent.state_delta_prompt,
                strength = latent.strength,
                conditioning = latent.conditioning_summary,
            )
        };

        if let Some(parent) = latent.latent_state_path.parent() {
            fs::create_dir_all(parent)?;
        }
        let state_artifact = LatentStateArtifact {
            index: latent.index,
            timestamp_secs: latent.timestamp_secs,
            patch_grid: latent.patch_grid,
            total_patch_grid: latent.total_patch_grid,
            motion_phase: latent.motion_phase,
            state_delta_prompt: &latent.state_delta_prompt,
            prior_state_summary: &latent.prior_state_summary,
            conditioning_summary: &latent.conditioning_summary,
            render_preview_path: latent.output_path.to_string_lossy().to_string(),
        };
        fs::write(
            &latent.latent_state_path,
            serde_json::to_vec_pretty(&state_artifact)?,
        )?;
        generate_image(
            api_key,
            &prompt,
            latent.output_path.to_string_lossy().as_ref(),
        )?;

        let mut next = latent.clone();
        next.prompt = prompt.clone();
        sampled.push(next);
        prev_prompt = prompt;
        prev_state_summary = format!(
            "latent_step={} patch={:?}/{:?} phase={:.2} delta={}",
            latent.index,
            latent.patch_grid,
            latent.total_patch_grid,
            latent.motion_phase,
            latent.state_delta_prompt
        );
    }

    Ok(sampled)
}
