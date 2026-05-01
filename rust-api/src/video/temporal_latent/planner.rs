use std::path::PathBuf;

use crate::video::backend::types::SceneInput as BackendSceneInput;
use crate::video::direct_render::camera::build_camera_plan;
use crate::video::layout::build_layout_block;
use crate::video::shot_sequence::build_shot_sequence;
use crate::video::style::build_style_block;
use crate::video::validation::relation::build_relation_prompt;

use super::types::{
    SpacetimePatchSpec, TemporalConditioning, TemporalLatentPlan, TemporalRenderConfig,
};

pub fn build_temporal_latent_plan(
    scene: &BackendSceneInput,
    config: &TemporalRenderConfig,
) -> TemporalLatentPlan {
    let mut conditioning = TemporalConditioning::from_scene(scene);
    let camera = build_camera_plan(&scene.visual_script, scene.section_type.as_deref());
    let (_, style_block) = build_style_block(scene.style_hint.as_deref());
    let layout_block = build_layout_block(&scene.visual_script, "single-subject continuity");
    conditioning.camera_prompt = format!("{}, {}", camera.camera_prompt, style_block);
    let continuity_first = prefers_single_camera_rollout(&scene.visual_script);
    let target_patch_count = config.patch_count_for_duration(scene.duration_secs, continuity_first);
    let rollout_patches = if continuity_first {
        build_single_camera_rollout(
            scene,
            &conditioning,
            &layout_block,
            &camera.camera_prompt,
            target_patch_count,
        )
    } else {
        let shot_count = (target_patch_count / 2).clamp(4, 24);
        let shot_sequence = build_shot_sequence(&scene.visual_script, shot_count);
        build_multi_shot_rollout(scene, &conditioning, &layout_block, &shot_sequence)
    };

    TemporalLatentPlan {
        conditioning,
        duration_secs: scene.duration_secs,
        fps: config.fps,
        width: config.width,
        height: config.height,
        spacetime_patches: rollout_patches,
        output_path: PathBuf::from(format!("output/scene_{}_temporal_latent.mp4", scene.id)),
        report_path: PathBuf::from(format!(
            "output/scene_{}_temporal_latent.report.json",
            scene.id
        )),
    }
}

fn prefers_single_camera_rollout(script: &str) -> bool {
    let s = script.to_lowercase();
    s.contains("缓慢推近")
        || s.contains("推近")
        || s.contains("特写")
        || s.contains("黑色背景")
        || s.contains("坐在钢琴前")
        || s.contains("注视前方")
}

fn build_single_camera_rollout(
    scene: &BackendSceneInput,
    conditioning: &TemporalConditioning,
    layout_block: &str,
    camera_prompt: &str,
    target_patch_count: usize,
) -> Vec<SpacetimePatchSpec> {
    let base_micro_steps = [
        "body fully still, seated pose locked, hands resting at the keys",
        "tiny finger movement begins on the piano keys, shoulders still",
        "slight wrist motion, same seated posture, same framing",
        "small head inclination forward, fingers continuing subtle motion",
        "tiny breathing motion in shoulders and chest, same camera distance",
        "slight hand shift across neighboring keys, same body alignment",
        "micro-expression remains neutral, chin changes only slightly",
        "very small continuation of piano motion, same pose family",
        "slow emotional hold, fingers easing to a pause, same composition",
    ];
    let micro_steps =
        build_rollout_micro_steps(scene, &base_micro_steps, target_patch_count.max(1));
    let step = (scene.duration_secs.max(1.0) / micro_steps.len() as f32).max(0.16);
    let mut rollout_patches = Vec::with_capacity(micro_steps.len());
    let mut prev_motion = scene.visual_script.clone();

    for (index, micro_motion) in micro_steps.iter().enumerate() {
        let phase = if micro_steps.len() <= 1 {
            0.0
        } else {
            index as f32 / (micro_steps.len() - 1) as f32
        };
        let relation_prompt = build_relation_prompt(&prev_motion, micro_motion);
        let prompt = format!(
            "SCENE SCRIPT: {script}. IDENTITY LOCK: {identity}. ENVIRONMENT LOCK: {environment}. \
             CAMERA LOCK: {camera}. LAYOUT: {layout}. RELATION CONTINUITY: {relation}. \
             This is frame {index} of a single continuous shot. \
             Keep the same exact performer, same piano, same background, same composition, same lens, same light. \
             Only advance by one tiny motion delta: {motion}. \
             Temporal phase={phase:.2}. No reframing, no scene reset, no shot change, no new pose family.",
            script = scene.visual_script,
            identity = conditioning.identity_prompt,
            environment = conditioning.environment_prompt,
            camera = camera_prompt,
            layout = layout_block,
            relation = relation_prompt,
            index = index,
            motion = micro_motion,
            phase = phase,
        );
        rollout_patches.push(SpacetimePatchSpec {
            index,
            timestamp_secs: index as f32 * step,
            patch_strength: 1.0,
            patch_grid: (0, index as u32),
            total_patch_grid: (1, micro_steps.len() as u32),
            motion_phase: phase,
            state_delta_prompt: micro_motion.clone(),
            prompt,
            latent_state_path: PathBuf::from(format!(
                "output/scene_{}_latent_{:02}.state.json",
                scene.id, index
            )),
            output_path: PathBuf::from(format!(
                "output/scene_{}_latent_{:02}.png",
                scene.id, index
            )),
        });
        prev_motion = micro_motion.clone();
    }

    rollout_patches
}

fn build_rollout_micro_steps(
    scene: &BackendSceneInput,
    base_micro_steps: &[&str],
    target_patch_count: usize,
) -> Vec<String> {
    let scene_hint = if scene.visual_script.contains("钢琴") {
        "hands continue musical motion while posture remains within the same family"
    } else if scene.visual_script.contains("奔跑") || scene.visual_script.contains("跑") {
        "gait advances by one physically plausible stride while camera continuity is preserved"
    } else if scene.visual_script.contains("装配") {
        "assembly motion advances by one tiny industrial step while subject identity stays locked"
    } else if scene.visual_script.contains("特写") || scene.visual_script.contains("注视") {
        "facial muscles and gaze evolve by one subtle emotional increment without reframing"
    } else {
        "motion advances by one small continuous delta without changing pose family or scene geometry"
    };
    let total = target_patch_count.max(base_micro_steps.len()).max(1);
    (0..total)
        .map(|index| {
            let phase = if total <= 1 {
                0.0
            } else {
                index as f32 / (total - 1) as f32
            };
            let base = base_micro_steps[index % base_micro_steps.len()];
            let stage = if phase < 0.2 {
                "bootstrap"
            } else if phase < 0.45 {
                "carry"
            } else if phase < 0.7 {
                "develop"
            } else if phase < 0.9 {
                "resolve"
            } else {
                "hold"
            };
            format!("{base}; rollout stage={stage}; {scene_hint}; temporal phase={phase:.2}")
        })
        .collect()
}

fn build_multi_shot_rollout(
    scene: &BackendSceneInput,
    conditioning: &TemporalConditioning,
    layout_block: &str,
    shot_sequence: &[crate::video::shot_sequence::ShotBeat],
) -> Vec<SpacetimePatchSpec> {
    let rollout_len = shot_sequence
        .len()
        .saturating_mul(2)
        .saturating_sub(1)
        .max(1);
    let step = (scene.duration_secs.max(1.0) / rollout_len as f32).max(0.16);
    let mut prev_motion = scene.visual_script.clone();
    let mut rollout_patches = Vec::with_capacity(rollout_len);

    for (beat_idx, beat) in shot_sequence.iter().enumerate() {
        let phase = if rollout_len <= 1 {
            0.0
        } else {
            rollout_patches.len() as f32 / (rollout_len - 1) as f32
        };
        let relation_prompt = build_relation_prompt(&prev_motion, &beat.motion_prompt);
        let prompt = format!(
            "SCENE SCRIPT: {script}. IDENTITY LOCK: {identity}. ENVIRONMENT LOCK: {environment}. \
             CAMERA BASE: {camera}. CURRENT SHOT: {shot}. CURRENT MOTION: {motion}. \
             RELATION CONTINUITY: {relation}. LAYOUT: {layout}. \
             Render this as a coherent spacetime latent patch, preserving the same world and same performer. \
             This is a primary temporal anchor patch, with stable body pose and readable motion direction. \
             Temporal phase={phase:.2}. Advance motion only slightly from the previous moment; do not reset pose, do not jump camera, do not restage the scene.",
            script = scene.visual_script,
            identity = conditioning.identity_prompt,
            environment = conditioning.environment_prompt,
            camera = conditioning.camera_prompt,
            shot = beat.camera_prompt,
            motion = beat.motion_prompt,
            relation = relation_prompt,
            layout = layout_block,
            phase = phase,
        );
        rollout_patches.push(SpacetimePatchSpec {
            index: rollout_patches.len(),
            timestamp_secs: rollout_patches.len() as f32 * step,
            patch_strength: 1.0 + beat.index as f32 * 0.03,
            patch_grid: (beat.index as u32, 0),
            total_patch_grid: (shot_sequence.len() as u32, 2),
            motion_phase: phase,
            state_delta_prompt: beat.motion_prompt.clone(),
            prompt,
            latent_state_path: PathBuf::from(format!(
                "output/scene_{}_latent_{:02}.state.json",
                scene.id,
                rollout_patches.len()
            )),
            output_path: PathBuf::from(format!(
                "output/scene_{}_latent_{:02}.png",
                scene.id,
                rollout_patches.len()
            )),
        });

        if let Some(next) = shot_sequence.get(beat_idx + 1) {
            let bridge_phase = if rollout_len <= 1 {
                0.0
            } else {
                rollout_patches.len() as f32 / (rollout_len - 1) as f32
            };
            let bridge_prompt = format!(
                "SCENE SCRIPT: {script}. IDENTITY LOCK: {identity}. ENVIRONMENT LOCK: {environment}. \
                 CAMERA BASE: {camera}. CURRENT SHOT TRANSITION: from [{shot_a}] to [{shot_b}]. \
                 MOTION ROLLOUT: from [{motion_a}] into [{motion_b}]. \
                 RELATION CONTINUITY: {relation}. LAYOUT: {layout}. \
                 Render this as a transitional spacetime bridge patch inside one continuous rollout. \
                 The body pose, camera, and world state must stay between the prior rollout state and the next rollout state, \
                 not a reset, not a new pose family, not a new scene. \
                 Temporal phase={phase:.2}. Move only one small step forward from the prior rollout state.",
                script = scene.visual_script,
                identity = conditioning.identity_prompt,
                environment = conditioning.environment_prompt,
                camera = conditioning.camera_prompt,
                shot_a = beat.camera_prompt,
                shot_b = next.camera_prompt,
                motion_a = beat.motion_prompt,
                motion_b = next.motion_prompt,
                relation = build_relation_prompt(&beat.motion_prompt, &next.motion_prompt),
                layout = layout_block,
                phase = bridge_phase,
            );
            rollout_patches.push(SpacetimePatchSpec {
                index: rollout_patches.len(),
                timestamp_secs: rollout_patches.len() as f32 * step,
                patch_strength: 0.92 + beat.index as f32 * 0.02,
                patch_grid: (beat.index as u32, 1),
                total_patch_grid: (shot_sequence.len() as u32, 2),
                motion_phase: bridge_phase,
                state_delta_prompt: format!(
                    "bridge from {} into {}",
                    beat.motion_prompt, next.motion_prompt
                ),
                prompt: bridge_prompt,
                latent_state_path: PathBuf::from(format!(
                    "output/scene_{}_latent_{:02}.state.json",
                    scene.id,
                    rollout_patches.len()
                )),
                output_path: PathBuf::from(format!(
                    "output/scene_{}_latent_{:02}.png",
                    scene.id,
                    rollout_patches.len()
                )),
            });
        }

        prev_motion = beat.motion_prompt.clone();
    }

    rollout_patches
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn planner_builds_spacetime_patch_rollout() {
        let scene = BackendSceneInput {
            id: 1101,
            section_type: Some("intro".to_string()),
            style_hint: Some("cinematic_dark".to_string()),
            visual_script: "白色仿生人女性独自坐在钢琴前，镜头缓慢推近".to_string(),
            duration_secs: 4.0,
        };

        let plan = build_temporal_latent_plan(&scene, &TemporalRenderConfig::default());

        assert!(!plan.spacetime_patches.is_empty());
        assert_eq!(plan.spacetime_patches[0].patch_grid, (0, 0));
        assert_eq!(
            plan.spacetime_patches[0].total_patch_grid.1 as usize,
            plan.spacetime_patches.len()
        );
        assert!(plan.spacetime_patches[0]
            .prompt
            .contains("single continuous shot"));
    }
}
