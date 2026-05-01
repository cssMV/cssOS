use std::fs;
use std::path::{Path, PathBuf};

use anyhow::{Context, Result};

use crate::video::character_v2::{
    generate_character_consistent_images, CharacterProfile as StableCharacterProfile,
};
use crate::video::consistency::generate_best_frame;
use crate::video::temporal::{build_consistent_prompt, init_state};
use crate::video::types::{SceneInput, SceneRenderPlan};

use super::planner::{build_motion_sequence, build_motion_sequence_from_prompt};

pub fn generate_motion_frames(
    scene: &SceneInput,
    plan: &SceneRenderPlan,
    work_dir: &Path,
) -> Result<Vec<PathBuf>> {
    fs::create_dir_all(work_dir)?;
    let sequence = build_motion_sequence(scene, Some(plan));
    let api_key = std::env::var("OPENAI_API_KEY").context("OPENAI_API_KEY is required")?;
    let mut state = init_state(&scene.visual_script);
    let mut prev_prompt = scene.visual_script.clone();

    if !scene.entities.characters.is_empty() {
        let mut profile = stable_profile_for_scene(scene, plan);
        state.character_identity = profile.base_prompt.clone();
        let prompts = sequence
            .iter()
            .map(|frame| {
                let prompt = build_consistent_prompt(&prev_prompt, &frame.prompt, &state);
                prev_prompt = frame.prompt.clone();
                prompt
            })
            .collect::<Vec<_>>();
        let images = generate_character_consistent_sequence(
            &api_key,
            &mut profile,
            scene.id,
            &prompts,
            work_dir,
        )?;
        return Ok(images);
    }

    sequence
        .iter()
        .enumerate()
        .map(|(index, frame)| {
            let prompt = build_consistent_prompt(&prev_prompt, &frame.prompt, &state);
            prev_prompt = frame.prompt.clone();
            let stem = work_dir.join(format!(
                "scene_{:03}_motion_{:02}_{}.png",
                scene.id, index, frame.beat_label
            ));
            let expected_keywords = keyword_hints_for_frame(scene, &frame.prompt);
            let best = generate_best_frame(
                &api_key,
                &prompt,
                stem.with_extension("").to_string_lossy().as_ref(),
                &expected_keywords,
                3,
            )?;
            Ok(PathBuf::from(best))
        })
        .collect()
}

pub fn generate_motion_frames_from_prompt(
    scene: &SceneInput,
    plan: &SceneRenderPlan,
    base_prompt: &str,
    work_dir: &Path,
) -> Result<Vec<PathBuf>> {
    fs::create_dir_all(work_dir)?;
    let sequence = build_motion_sequence_from_prompt(
        base_prompt,
        Some(&plan.shot_plan.motion_hint),
        plan.style_profile.camera_language.as_deref(),
    );
    let api_key = std::env::var("OPENAI_API_KEY").context("OPENAI_API_KEY is required")?;
    let mut state = init_state(base_prompt);
    let mut prev_prompt = base_prompt.to_string();

    if !scene.entities.characters.is_empty() {
        let mut profile = stable_profile_for_scene(scene, plan);
        state.character_identity = profile.base_prompt.clone();
        let prompts = sequence
            .iter()
            .map(|frame| {
                let prompt = build_consistent_prompt(&prev_prompt, &frame.prompt, &state);
                prev_prompt = frame.prompt.clone();
                prompt
            })
            .collect::<Vec<_>>();
        return generate_character_consistent_sequence(
            &api_key,
            &mut profile,
            scene.id,
            &prompts,
            work_dir,
        );
    }

    sequence
        .iter()
        .enumerate()
        .map(|(index, frame)| {
            let prompt = build_consistent_prompt(&prev_prompt, &frame.prompt, &state);
            prev_prompt = frame.prompt.clone();
            let stem = work_dir.join(format!(
                "scene_{:03}_variant_motion_{:02}_{}.png",
                scene.id, index, frame.beat_label
            ));
            let expected_keywords = keyword_hints_for_frame(scene, &frame.prompt);
            let best = generate_best_frame(
                &api_key,
                &prompt,
                stem.with_extension("").to_string_lossy().as_ref(),
                &expected_keywords,
                3,
            )?;
            Ok(PathBuf::from(best))
        })
        .collect()
}

fn keyword_hints_for_frame<'a>(scene: &'a SceneInput, frame_prompt: &'a str) -> Vec<&'a str> {
    let mut keywords = Vec::new();
    for character in &scene.entities.characters {
        if !character.trim().is_empty() {
            keywords.push(character.as_str());
        }
    }
    if let Some(location) = &scene.entities.location {
        if !location.trim().is_empty() {
            keywords.push(location.as_str());
        }
    }
    if keywords.is_empty() && !frame_prompt.trim().is_empty() {
        keywords.push(frame_prompt);
    }
    keywords
}

fn stable_profile_for_scene(scene: &SceneInput, plan: &SceneRenderPlan) -> StableCharacterProfile {
    let base_profile = plan
        .character_profiles
        .iter()
        .find(|profile| scene.entities.characters.iter().any(|id| id == &profile.id))
        .cloned();
    if let Some(profile) = base_profile {
        return StableCharacterProfile {
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
        };
    }

    StableCharacterProfile {
        id: scene.entities.characters[0].clone(),
        base_prompt: scene.entities.characters.join(", "),
        anchor_path: None,
    }
}

fn generate_character_consistent_sequence(
    api_key: &str,
    profile: &mut StableCharacterProfile,
    scene_id: u32,
    prompts: &[String],
    work_dir: &Path,
) -> Result<Vec<PathBuf>> {
    let mut outputs = Vec::with_capacity(prompts.len());
    for (index, prompt) in prompts.iter().enumerate() {
        let best = generate_character_consistent_images(api_key, profile, prompt, 3)?
            .into_iter()
            .next()
            .context("character_v2 returned no best candidate")?;
        let source = PathBuf::from(best);
        let dest = work_dir.join(format!(
            "scene_{scene_id:03}_character_motion_{index:02}.png"
        ));
        if source != dest {
            fs::copy(&source, &dest).with_context(|| {
                format!(
                    "copying motion frame from {} to {}",
                    source.display(),
                    dest.display()
                )
            })?;
        }
        outputs.push(dest);
    }
    Ok(outputs)
}
