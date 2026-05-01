use anyhow::{anyhow, Result};
use std::path::PathBuf;

use crate::video::backend::types::SceneInput;
use crate::video::character_multi::build_locked_multi_character_prompt;
use crate::video::layout::build_layout_block;
use crate::video::openai_client::generate_image;
use crate::video::shot_sequence::build_shot_sequence;
use crate::video::style::build_style_block;
use crate::video::temporal_renderer::render_temporal_video;
use crate::video::validation::{build_relation_prompt, init_relation_state, validate_shot};

pub mod camera;
pub mod interaction;

use self::camera::build_camera_plan;
use self::interaction::build_interaction_plan;

pub fn render_scene_direct(
    api_key: &str,
    scene: &SceneInput,
    section_type: Option<&str>,
) -> Result<String> {
    let interaction = build_interaction_plan(&scene.visual_script);
    let camera = build_camera_plan(&scene.visual_script, section_type);
    let shot_beats = build_shot_sequence(&scene.visual_script, 6);
    let locked_characters = build_locked_multi_character_prompt(api_key, &scene.visual_script)?;
    let (_style_profile, style_block) = build_style_block(scene.style_hint.as_deref());
    let mut paths = Vec::new();
    let mut relation_state = init_relation_state(&interaction.relation);
    for beat in shot_beats {
        let mut best_path = None::<PathBuf>;
        let mut last_attempt_path = None::<PathBuf>;
        for attempt in 0..3 {
            let relation_prompt =
                build_relation_prompt(&relation_state.relation, &interaction.relation);
            let prompt = format!(
                "{base}, {relation}, {style}",
                base = build_direct_prompt(
                    &scene.visual_script,
                    &locked_characters,
                    &interaction.relation,
                    &interaction.pose_hint,
                    &interaction.composition_hint,
                    &camera.camera_prompt,
                    &beat.camera_prompt,
                    &beat.motion_prompt,
                ),
                relation = relation_prompt,
                style = style_block,
            );
            let path = PathBuf::from(format!(
                "output/scene_{}_validated_{}_{}.png",
                scene.id, beat.index, attempt
            ));
            generate_image(api_key, &prompt, path.to_string_lossy().as_ref())?;
            last_attempt_path = Some(path.clone());
            if validate_shot(&prompt, &beat.shot) {
                best_path = Some(path);
                break;
            }
        }

        let final_path = best_path
            .or(last_attempt_path)
            .ok_or_else(|| anyhow!("no validated frame generated for scene {}", scene.id))?;
        relation_state.relation = interaction.relation.clone();
        paths.push(final_path);
    }

    if paths.is_empty() {
        return Err(anyhow!("no frames rendered"));
    }

    let output = format!("output/scene_{}_direct.mp4", scene.id);
    render_temporal_video(
        &paths,
        scene.duration_secs,
        PathBuf::from(&output).as_path(),
    )?;
    Ok(output)
}

fn build_direct_prompt(
    script: &str,
    locked_characters: &str,
    relation: &str,
    pose: &str,
    composition: &str,
    base_camera: &str,
    shot_camera: &str,
    motion: &str,
) -> String {
    let layout_block = build_layout_block(script, relation);
    format!(
        "{locked_characters}, MUST follow scene script: {script}, interaction: {relation}, pose: {pose}, composition: {composition}, {layout}, base camera language: {base_camera}, current shot plan: {shot_camera}, current motion stage: {motion}, MUST show environment clearly, cinematic, realistic, high detail, no empty frame, no missing subject, no incorrect positioning, no subject overlap confusion, no cropped important subject, same identities across all frames, same costumes, same world continuity, maintain spatial consistency across frames",
        locked_characters = locked_characters,
        script = script,
        relation = relation,
        pose = pose,
        composition = composition,
        layout = layout_block,
        base_camera = base_camera,
        shot_camera = shot_camera,
        motion = motion,
    )
}
