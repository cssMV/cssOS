use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{anyhow, Context, Result};

use crate::video::character_v2::{
    generate_character_consistent_images, CharacterProfile as StableCharacterProfile,
};
use crate::video::feedback::{render_with_feedback, RenderContext, SceneDirection};
use crate::video::motion::{render_scene_motion_video, render_scene_motion_video_from_prompt};
use crate::video::openai_client::generate_image;
use crate::video::types::{SceneInput, SceneRenderPlan, SceneRenderResult};

pub fn render_scene_with_openai(
    scene: &SceneInput,
    plan: &SceneRenderPlan,
) -> Result<SceneRenderResult> {
    let output_path = PathBuf::from(&plan.output_path);
    let video_path = render_scene_motion_video(scene, plan, &output_path)?;
    Ok(SceneRenderResult {
        scene_id: scene.id,
        video_path,
        success: true,
    })
}

pub fn render_scene_video_with_prompt(
    scene: &SceneInput,
    plan: &SceneRenderPlan,
    prompt: &str,
    max_attempts: u32,
) -> Result<String> {
    let output_path = PathBuf::from(&plan.output_path);
    let work_dir = output_path
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join(format!("scene_{:03}_variant_frames", scene.id));
    fs::create_dir_all(&work_dir)?;
    let _feedback = render_with_feedback(
        prompt,
        &RenderContext {
            scene_id: scene.id,
            visual_script: scene.visual_script.clone(),
            prompt: prompt.to_string(),
            output_dir: work_dir.to_string_lossy().to_string(),
            image_count: 4,
            character_profiles: plan.character_profiles.clone(),
            style_profile: plan.style_profile.clone(),
            scene_direction: SceneDirection {
                emotion: "cinematic".to_string(),
                visual_focus: plan.shot_plan.transition_hint.clone(),
                camera_hint: plan.shot_plan.motion_hint.clone(),
            },
        },
        max_attempts,
    )?;
    let _ = work_dir;
    render_scene_motion_video_from_prompt(scene, plan, prompt, &output_path)
}

fn generate_scene_images(
    scene: &SceneInput,
    plan: &SceneRenderPlan,
    base_prompt: &str,
    work_dir: &Path,
    count: usize,
) -> Result<Vec<PathBuf>> {
    if !scene.entities.characters.is_empty() {
        let api_key = std::env::var("OPENAI_API_KEY").context("OPENAI_API_KEY is required")?;
        let base_profile = plan
            .character_profiles
            .iter()
            .find(|profile| scene.entities.characters.iter().any(|id| id == &profile.id))
            .cloned();
        let mut profile = if let Some(profile) = base_profile {
            StableCharacterProfile {
                id: profile.id,
                base_prompt: format!(
                    "{} {} {}",
                    profile.display_name,
                    profile.outfit.unwrap_or_default(),
                    profile.visual_keywords.join(" ")
                )
                .trim()
                .to_string(),
                anchor_path: None,
            }
        } else {
            StableCharacterProfile {
                id: scene.entities.characters[0].clone(),
                base_prompt: scene.entities.characters.join(", "),
                anchor_path: None,
            }
        };
        let images =
            generate_character_consistent_images(&api_key, &mut profile, base_prompt, count)?;
        return Ok(images.into_iter().map(PathBuf::from).collect());
    }

    let mut paths = Vec::with_capacity(count);

    for index in 0..count {
        let motion_variant = match index {
            0 => "establishing frame",
            1 => "slight camera drift to the left",
            2 => "push-in toward the lead character",
            _ => "release frame with subtle motion continuation",
        };
        let prompt = format!(
            "{base_prompt}, frame {}/{} of the same shot, {}",
            index + 1,
            count,
            motion_variant
        );
        let feedback = render_with_feedback(
            &prompt,
            &RenderContext {
                scene_id: scene.id,
                visual_script: scene.visual_script.clone(),
                prompt: prompt.clone(),
                output_dir: work_dir.to_string_lossy().to_string(),
                image_count: 1,
                character_profiles: plan.character_profiles.clone(),
                style_profile: plan.style_profile.clone(),
                scene_direction: SceneDirection {
                    emotion: "cinematic".to_string(),
                    visual_focus: plan.shot_plan.transition_hint.clone(),
                    camera_hint: plan.shot_plan.motion_hint.clone(),
                },
            },
            3,
        )?;
        paths.push(PathBuf::from(feedback.best_output));
    }

    Ok(paths)
}

pub(crate) fn generate_image_with_openai(prompt: &str, output_path: &Path) -> Result<()> {
    let api_key = std::env::var("OPENAI_API_KEY").context("OPENAI_API_KEY is required")?;
    generate_image(&api_key, prompt, output_path.to_string_lossy().as_ref())?;
    Ok(())
}

fn images_to_video(images: &[PathBuf], duration_secs: f32, output_path: &Path) -> Result<()> {
    let per_image = (duration_secs / images.len().max(1) as f32).max(0.8);
    let mut cmd = Command::new("ffmpeg");
    cmd.arg("-y")
        .arg("-hide_banner")
        .arg("-loglevel")
        .arg("error");
    for image in images {
        cmd.arg("-loop")
            .arg("1")
            .arg("-t")
            .arg(format!("{per_image:.3}"))
            .arg("-i")
            .arg(image);
    }

    let fps = 24.0_f32;
    let mut filter = String::new();
    for index in 0..images.len() {
        let frames = (per_image * fps).round().max(1.0) as u32;
        filter.push_str(&format!(
            "[{index}:v]scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0015,1.12)':d={frames}:fps=24,format=yuv420p[v{index}];"
        ));
    }
    let concat_inputs = (0..images.len())
        .map(|index| format!("[v{index}]"))
        .collect::<String>();
    filter.push_str(&format!(
        "{concat_inputs}concat=n={}:v=1:a=0[outv]",
        images.len()
    ));

    cmd.arg("-filter_complex")
        .arg(filter)
        .arg("-map")
        .arg("[outv]")
        .arg("-t")
        .arg(format!("{duration_secs:.3}"))
        .arg("-c:v")
        .arg("libx264")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg(output_path);

    let output = cmd
        .output()
        .context("rendering scene video from generated images")?;
    if !output.status.success() {
        return Err(anyhow!(
            "ffmpeg image-to-video failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }
    Ok(())
}
