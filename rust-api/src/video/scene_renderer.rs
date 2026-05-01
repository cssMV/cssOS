use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{anyhow, Context, Result};

use crate::video::types::{SceneInput, SceneRenderPlan};

use super::openai_client::can_use_openai_image_pipeline;
use super::renderer::render_scene_with_openai;
use super::thumbnail::{probe_duration, render_reference_clip, validate_video_output};
use super::video_model::{
    selected_provider, unsupported_provider_reason, uses_self_hosted_default,
};

pub fn render_scene_video(scene: &SceneInput, plan: &SceneRenderPlan) -> Result<String> {
    if scene.duration_secs <= 0.0 {
        return Err(anyhow!("scene {} duration_secs must be positive", scene.id));
    }
    let output_path = PathBuf::from(&plan.output_path);
    fs::create_dir_all(output_path.parent().unwrap_or_else(|| Path::new(".")))?;

    if !uses_self_hosted_default() {
        if let Ok(renderer_cmd) = std::env::var("CSS_VIDEO_RENDER_CMD") {
            if !renderer_cmd.trim().is_empty() {
                run_external_renderer(&renderer_cmd, scene, plan, &output_path)?;
                validate_video_output(&output_path, scene.duration_secs, 0.5)?;
                ensure_non_trivial_playable_video(&output_path)?;
                return Ok(output_path.to_string_lossy().to_string());
            }
        }
        return Err(anyhow!(
            "{}; set CSS_VIDEO_MODEL_PROVIDER=self_hosted to use the native renderer",
            unsupported_provider_reason().unwrap_or_else(|| {
                format!(
                    "unsupported video provider '{}'",
                    selected_provider().as_str()
                )
            })
        ));
    }

    if can_use_openai_image_pipeline() {
        let result = render_scene_with_openai(scene, plan)?;
        validate_video_output(Path::new(&result.video_path), scene.duration_secs, 0.8)?;
        ensure_non_trivial_playable_video(Path::new(&result.video_path))?;
        return Ok(result.video_path);
    }

    if let Ok(renderer_cmd) = std::env::var("CSS_VIDEO_RENDER_CMD") {
        if !renderer_cmd.trim().is_empty() {
            run_external_renderer(&renderer_cmd, scene, plan, &output_path)?;
            validate_video_output(&output_path, scene.duration_secs, 0.5)?;
            ensure_non_trivial_playable_video(&output_path)?;
            return Ok(output_path.to_string_lossy().to_string());
        }
    }

    let source = plan
        .reference_media_path
        .as_ref()
        .map(PathBuf::from)
        .or_else(|| super::thumbnail::first_existing_path(&scene.reference_media_paths))
        .ok_or_else(|| {
            anyhow!(
                "scene {} has no reference media and no CSS_VIDEO_RENDER_CMD configured",
                scene.id
            )
        })?;

    render_reference_clip(&source, &output_path, scene.duration_secs, scene.id as u64)?;
    validate_video_output(&output_path, scene.duration_secs, 0.5)?;
    ensure_non_trivial_playable_video(&output_path)?;
    Ok(output_path.to_string_lossy().to_string())
}

fn run_external_renderer(
    renderer_cmd: &str,
    scene: &SceneInput,
    plan: &SceneRenderPlan,
    output_path: &Path,
) -> Result<()> {
    let payload_path = output_path.with_extension("scene-plan.json");
    let payload = serde_json::json!({
        "scene": scene,
        "plan": plan,
        "output_path": output_path,
    });
    fs::write(&payload_path, serde_json::to_vec_pretty(&payload)?)?;
    let status = Command::new("sh")
        .arg("-lc")
        .arg(renderer_cmd)
        .env("CSS_VIDEO_SCENE_PLAN", &payload_path)
        .env("CSS_VIDEO_OUTPUT_PATH", output_path)
        .status()
        .context("launching CSS_VIDEO_RENDER_CMD")?;
    if !status.success() {
        return Err(anyhow!(
            "external renderer failed for scene {} with status {:?}",
            scene.id,
            status.code()
        ));
    }
    Ok(())
}

fn ensure_non_trivial_playable_video(path: &Path) -> Result<()> {
    let duration = probe_duration(path)?;
    if duration <= 0.0 {
        return Err(anyhow!(
            "rendered scene video is not playable: {}",
            path.display()
        ));
    }
    let metadata = fs::metadata(path)?;
    if metadata.len() < 16_384 {
        return Err(anyhow!(
            "rendered scene video appears empty/trivial: {} bytes",
            metadata.len()
        ));
    }
    Ok(())
}
