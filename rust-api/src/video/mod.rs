pub mod backend;
pub mod cache;
pub mod character_multi;
pub mod character_v2;
pub mod composer;
pub mod consistency;
pub mod direct_render;
pub mod duration;
pub mod engine;
pub mod error;
pub mod executor;
pub mod feedback;
pub mod ffmpeg;
pub mod graph;
pub mod hw;
pub mod layout;
pub mod motion;
pub mod motion_v2;
pub mod openai_client;
pub mod prompt_builder;
pub mod render;
pub mod render_adapter;
pub mod render_local;
pub mod renderer;
pub mod scene_renderer;
pub mod script_parser;
pub mod script_v2;
pub mod shot_sequence;
pub mod storyboard;
pub mod style;
pub mod subtitles;
pub mod temporal;
pub mod temporal_backend;
pub mod temporal_latent;
pub mod temporal_renderer;
pub mod thumbnail;
pub mod types;
pub mod validation;
pub mod variant;
pub mod video_model;

#[allow(unused_imports)]
pub use error::VideoError;
#[allow(unused_imports)]
pub use executor::{AssembleResult, PlanResult, RenderShotResult, VideoExecutor};
#[allow(unused_imports)]
pub use types::{
    ComposeResult, MusicInput, ProjectInput, ProjectStyleInput, SceneEntities, SceneInput,
    SceneRenderPlan, ThumbnailInput, ThumbnailVideoResult, VideoProjectResult,
};

use std::fs;
use std::path::PathBuf;

use anyhow::{anyhow, Result};

use self::consistency::{build_character_profiles, normalize_style, plan_shots, score_continuity};
use self::scene_renderer::render_scene_video;
use self::thumbnail::{generate_thumbnail_video, project_output_root};
use self::types::VideoProjectResult as EngineVideoProjectResult;

pub fn build_video_project(input: ProjectInput) -> Result<EngineVideoProjectResult> {
    validate_project_input(&input)?;
    let character_profiles = build_character_profiles(&input.scenes);
    let style_profile = normalize_style(&input.style_profile);
    let shot_plans = plan_shots(&input.scenes, &style_profile);

    let root = project_output_root(&input.project_id)?;
    let scenes_dir = root.join("scenes");
    fs::create_dir_all(&scenes_dir)?;

    let thumbnail = generate_thumbnail_video(&input)?;
    let mut scene_video_paths = Vec::with_capacity(input.scenes.len());
    for scene in &input.scenes {
        let shot_plan = shot_plans
            .iter()
            .find(|plan| plan.scene_id == scene.id)
            .cloned()
            .ok_or_else(|| anyhow!("missing shot plan for scene {}", scene.id))?;
        let output_path = scenes_dir.join(format!("scene_{:03}.mp4", scene.id));
        let reference_media_path = scene
            .reference_media_paths
            .iter()
            .find(|path| PathBuf::from(path).exists())
            .cloned()
            .or_else(|| {
                input
                    .reference_media_paths
                    .iter()
                    .find(|path| PathBuf::from(path).exists())
                    .cloned()
            });
        let plan = types::SceneRenderPlan {
            output_path: output_path.to_string_lossy().to_string(),
            shot_plan,
            style_profile: style_profile.clone(),
            character_profiles: character_profiles.clone(),
            reference_media_path,
            consistency_tokens: style_profile.style_tokens.clone(),
        };
        scene_video_paths.push(render_scene_video(scene, &plan)?);
    }

    let compose_output = root.join("final_mv.mp4");
    let compose_result = composer::compose_mv(
        &scene_video_paths,
        &input.music.audio_path,
        input.music.duration_secs,
        &compose_output.to_string_lossy(),
    )?;
    let continuity_scores = score_continuity(
        &input.scenes,
        &shot_plans,
        &style_profile,
        &character_profiles,
    );

    Ok(EngineVideoProjectResult {
        thumbnail,
        scene_video_paths,
        compose_result,
        continuity_scores,
    })
}

fn validate_project_input(input: &ProjectInput) -> Result<()> {
    if input.project_id.trim().is_empty() {
        return Err(anyhow!("project_id must not be empty"));
    }
    if input.music.duration_secs <= 0.0 {
        return Err(anyhow!("music.duration_secs must be positive"));
    }
    if input.scenes.is_empty() {
        return Err(anyhow!("at least one scene is required"));
    }
    for scene in &input.scenes {
        if scene.duration_secs <= 0.0 {
            return Err(anyhow!("scene {} duration_secs must be positive", scene.id));
        }
        if scene.visual_script.trim().is_empty() {
            return Err(anyhow!(
                "scene {} visual_script must not be empty",
                scene.id
            ));
        }
    }
    Ok(())
}
