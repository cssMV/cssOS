mod composer;
mod consistency;
mod contracts;
mod error;
mod scene_renderer;
mod thumbnail;

use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

pub use consistency::{
    ArcTimelineBeat, CharacterProfile, ContinuityScore, NormalizedStyleProfile, ShotPlan,
    build_arc_timeline, build_character_profiles, build_scene_continuity_memory, normalize_style,
    plan_shots,
};
pub use contracts::{
    ComposeResult, MusicInput, ProjectInput, SceneEntities, SceneInput, StyleProfile,
    ThumbnailRequest, ThumbnailResult, VideoProjectResult, VideoSourceDiagnostic,
};

use composer::MVComposer;
use consistency::score_continuity;
use error::VideoEngineError;
use scene_renderer::SceneRenderer;
use thumbnail::ThumbnailGenerator;

pub fn build_video_project(input: ProjectInput) -> Result<VideoProjectResult> {
    validate_input(&input)?;

    let root_dir = PathBuf::from("target")
        .join("cssmv-video-engine")
        .join(slugify(&input.project_id));
    let scene_dir = root_dir.join("scenes");
    let thumbnail_dir = root_dir.join("thumbnail");
    let compose_dir = root_dir.join("compose");

    if root_dir.exists() {
        fs::remove_dir_all(&root_dir)
            .with_context(|| format!("failed to clear stale project dir {}", root_dir.display()))?;
    }
    fs::create_dir_all(&scene_dir)
        .with_context(|| format!("failed to create scene dir {}", scene_dir.display()))?;
    fs::create_dir_all(&thumbnail_dir)
        .with_context(|| format!("failed to create thumbnail dir {}", thumbnail_dir.display()))?;
    fs::create_dir_all(&compose_dir)
        .with_context(|| format!("failed to create compose dir {}", compose_dir.display()))?;

    log_step("consistency", "building character profiles");
    let character_profiles = build_character_profiles(&input.scenes);
    log_step("consistency", "normalizing style");
    let normalized_style = normalize_style(&input.style_profile, &input.scenes);
    log_step("director", "building arc timeline");
    let arc_timeline = build_arc_timeline(&input.scenes);
    log_step("consistency", "planning shots");
    let shot_plans = plan_shots(
        &input.scenes,
        &arc_timeline,
        &normalized_style,
        &input.style_profile,
    );

    let thumbnail_generator = ThumbnailGenerator::new();
    log_step("thumbnail", "generating project thumbnail");
    let thumbnail = thumbnail_generator.generate(
        &input.thumbnail,
        &input.scenes,
        &normalized_style,
        &thumbnail_dir,
    )?;

    let renderer = SceneRenderer::new();
    let mut scene_results = Vec::with_capacity(input.scenes.len());
    for scene in &input.scenes {
        let previous_shot = shot_plans
            .iter()
            .filter(|plan| plan.scene_id < scene.id)
            .max_by_key(|plan| plan.scene_id);
        let next_shot = shot_plans
            .iter()
            .filter(|plan| plan.scene_id > scene.id)
            .min_by_key(|plan| plan.scene_id);
        let timeline_beat = arc_timeline
            .iter()
            .find(|beat| beat.scene_id == scene.id)
            .context("missing arc timeline beat for scene")?;
        let shot = shot_plans
            .iter()
            .find(|plan| plan.scene_id == scene.id)
            .context("missing shot plan for scene")?;
        log_step("scene-render", &format!("rendering scene {}", scene.id));
        scene_results.push(renderer.render_scene(
            scene,
            timeline_beat,
            previous_shot,
            next_shot,
            &character_profiles,
            &normalized_style,
            &input.style_profile,
            shot,
            &scene_dir,
        )?);
    }

    let composer = MVComposer::new();
    log_step("compose", "building final mv");
    let compose_result = composer.compose(
        &input.scenes,
        &arc_timeline,
        &shot_plans,
        &scene_results
            .iter()
            .map(|scene| scene.video_path.clone())
            .collect::<Vec<_>>(),
        &input.music,
        &compose_dir,
    )?;

    log_step("consistency", "scoring continuity");
    let continuity_scores = score_continuity(
        &input.scenes,
        &character_profiles,
        &normalized_style,
        &input.style_profile,
        &shot_plans,
    );
    let scene_source_diagnostics = build_scene_source_diagnostics(&input.scenes);
    let video_source_mode = infer_video_source_mode(&scene_source_diagnostics);

    Ok(VideoProjectResult {
        thumbnail,
        scene_video_paths: scene_results
            .iter()
            .map(|scene| scene.video_path.to_string_lossy().to_string())
            .collect(),
        compose_result,
        video_source_mode,
        scene_source_diagnostics,
        continuity_scores,
        character_profiles,
        normalized_style,
        arc_timeline,
        shot_plans,
    })
}

fn validate_input(input: &ProjectInput) -> Result<()> {
    if input.scenes.is_empty() {
        return Err(VideoEngineError::EmptyScenes.into());
    }
    if input.music.duration_secs <= 0.0 {
        return Err(anyhow::anyhow!("music.duration_secs must be positive"));
    }
    if !Path::new(&input.music.audio_path).exists() {
        return Err(VideoEngineError::MissingAudioPath {
            path: input.music.audio_path.clone(),
        }
        .into());
    }
    for scene in &input.scenes {
        if scene.duration_secs <= 0.0 {
            return Err(VideoEngineError::InvalidSceneDuration {
                scene_id: scene.id.to_string(),
                duration_secs: scene.duration_secs,
            }
            .into());
        }
    }
    Ok(())
}

fn slugify(value: &str) -> String {
    let slug = value
        .chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() {
                ch.to_ascii_lowercase()
            } else {
                '-'
            }
        })
        .collect::<String>();
    slug.trim_matches('-').to_string()
}

fn log_step(step: &str, message: &str) {
    eprintln!("[cssmv-video-engine][{step}] {message}");
}

fn build_scene_source_diagnostics(scenes: &[SceneInput]) -> Vec<VideoSourceDiagnostic> {
    scenes
        .iter()
        .map(|scene| {
            let reference_media_count = scene
                .reference_media_paths
                .iter()
                .filter(|path| Path::new(path.as_str()).exists())
                .count();
            let source_mode = if reference_media_count > 0 {
                "reference_media"
            } else if allow_synthetic_video_inputs() {
                "synthetic_allowed"
            } else {
                "synthetic_forbidden"
            };
            VideoSourceDiagnostic {
                scene_id: scene.id,
                source_mode: source_mode.to_string(),
                reference_media_count,
            }
        })
        .collect()
}

fn infer_video_source_mode(diagnostics: &[VideoSourceDiagnostic]) -> String {
    if diagnostics
        .iter()
        .all(|entry| entry.source_mode == "reference_media")
    {
        "reference_media".to_string()
    } else if diagnostics
        .iter()
        .any(|entry| entry.source_mode == "synthetic_allowed")
    {
        "synthetic_allowed".to_string()
    } else {
        "synthetic_forbidden".to_string()
    }
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
