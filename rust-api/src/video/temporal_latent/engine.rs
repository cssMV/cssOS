use std::fs;
use std::path::Path;

use anyhow::{bail, Context, Result};

use crate::video::backend::types::SceneInput as BackendSceneInput;
use crate::video::temporal_backend::render_scene_longform_temporal_video;
use crate::video::temporal_renderer::{render_temporal_video_with_profile, TemporalRenderProfile};

use super::codec::{encode_plan_to_latents, latent_report_paths};
use super::planner::build_temporal_latent_plan;
use super::sampler::sample_spacetime_latents;
use super::types::{
    TemporalDecoderMetrics, TemporalLatentReport, TemporalRenderConfig,
    TemporalStateContinuityMetrics,
};

#[derive(Debug, Clone)]
pub struct TemporalSceneOutcome {
    pub output_path: String,
    pub final_state_summary: String,
}

pub fn render_scene_temporal_latent(api_key: &str, scene: &BackendSceneInput) -> Result<String> {
    render_scene_temporal_latent_with_config(api_key, scene, &TemporalRenderConfig::default())
}

pub fn render_scene_temporal_latent_with_config(
    api_key: &str,
    scene: &BackendSceneInput,
    config: &TemporalRenderConfig,
) -> Result<String> {
    Ok(render_scene_temporal_latent_with_bootstrap(api_key, scene, config, None)?.output_path)
}

pub fn render_scene_temporal_latent_with_bootstrap(
    api_key: &str,
    scene: &BackendSceneInput,
    config: &TemporalRenderConfig,
    bootstrap_state_summary: Option<String>,
) -> Result<TemporalSceneOutcome> {
    let mut plan = build_temporal_latent_plan(scene, config);
    plan.conditioning.bootstrap_state_summary = bootstrap_state_summary;

    let mut notes = vec![
        "Temporal latent engine v1 uses a self-hosted latent plan, latent codec, and spacetime sampler."
            .to_string(),
        "Current decoder is self-hosted ffmpeg temporal interpolation, not a third-party video model."
            .to_string(),
        "Execution is continuity-first and does not fall back to direct image-anchor rendering."
            .to_string(),
    ];

    let fallback_used = false;
    let latent_tokens = encode_plan_to_latents(&plan)?;
    for latent in &latent_tokens {
        if let Some(parent) = latent.output_path.parent() {
            fs::create_dir_all(parent)?;
        }
    }
    let rendered_latents = match sample_spacetime_latents(api_key, &latent_tokens) {
        Ok(sampled) => sampled,
        Err(err) => {
            notes.push(format!(
                "Latent sampling failed in temporal latent sampler without direct-render fallback: {}",
                err
            ));
            let report = TemporalLatentReport {
                scene_id: scene.id,
                renderer: "temporal_latent_v1".to_string(),
                duration_secs: plan.duration_secs,
                fps: plan.fps,
                width: plan.width,
                height: plan.height,
                patch_count: latent_tokens.len(),
                output_path: plan.output_path.to_string_lossy().to_string(),
                fallback_used,
                latent_token_count: latent_tokens.len(),
                latent_state_artifact_count: latent_tokens.len(),
                unified_latent_representation: true,
                decoder_metrics: TemporalDecoderMetrics {
                    mode: "latent_rollout_decoder_v1".to_string(),
                    frame_count: 0,
                    fps: plan.fps,
                    clip_duration_secs: 0.0,
                    overlap_duration_secs: 0.0,
                    latent_hold_ratio: 0.0,
                    used_motion_interpolation: false,
                },
                state_continuity: TemporalStateContinuityMetrics::from_latents(&latent_tokens),
                notes,
            };
            write_report(&plan.report_path, &report)?;
            bail!("temporal latent sampler failed: {err}");
        }
    };
    let rendered_frames = latent_report_paths(&rendered_latents);
    let state_continuity = TemporalStateContinuityMetrics::from_latents(&rendered_latents);
    let backend_mode = std::env::var("CSS_TEMPORAL_VIDEO_BACKEND")
        .unwrap_or_else(|_| "longform_latent".to_string())
        .trim()
        .to_ascii_lowercase();
    let decoder_metrics = if matches!(
        backend_mode.as_str(),
        "compat" | "compat_minterpolate" | "ffmpeg_compat"
    ) {
        notes.push(
            "Temporal decoder compatibility mode is enabled; ffmpeg motion interpolation remains active for this run."
                .to_string(),
        );
        let profile = TemporalRenderProfile {
            width: plan.width,
            height: plan.height,
            fps: plan.fps,
            enable_motion_interpolation: true,
        };
        render_temporal_video_with_profile(
            &rendered_frames,
            plan.duration_secs,
            &plan.output_path,
            &profile,
        )
        .context("decoding temporal latent frames into compatibility video")?
    } else {
        notes.push(
            "Formal temporal chain is using the long-form latent video backend without ffmpeg motion interpolation."
                .to_string(),
        );
        render_scene_longform_temporal_video(
            scene,
            config,
            &rendered_latents,
            &plan.output_path,
            plan.conditioning.bootstrap_state_summary.as_deref(),
        )
        .context("decoding temporal latent plan with long-form latent video backend")?
    };

    let report = TemporalLatentReport {
        scene_id: scene.id,
        renderer: "temporal_latent_v1".to_string(),
        duration_secs: plan.duration_secs,
        fps: plan.fps,
        width: plan.width,
        height: plan.height,
        patch_count: rendered_frames.len(),
        output_path: plan.output_path.to_string_lossy().to_string(),
        fallback_used,
        latent_token_count: latent_tokens.len(),
        latent_state_artifact_count: rendered_latents.len(),
        unified_latent_representation: true,
        decoder_metrics,
        state_continuity,
        notes,
    };
    write_report(&plan.report_path, &report)?;

    let final_state_summary = rendered_latents
        .last()
        .map(|latent| {
            format!(
                "scene={} carried_forward latent_step={} patch={:?}/{:?} phase={:.2} delta={}",
                scene.id,
                latent.index,
                latent.patch_grid,
                latent.total_patch_grid,
                latent.motion_phase,
                latent.state_delta_prompt
            )
        })
        .unwrap_or_else(|| format!("scene={} finished without latent state", scene.id));

    Ok(TemporalSceneOutcome {
        output_path: plan.output_path.to_string_lossy().to_string(),
        final_state_summary,
    })
}

fn write_report(path: &Path, report: &TemporalLatentReport) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, serde_json::to_vec_pretty(report)?)?;
    Ok(())
}
