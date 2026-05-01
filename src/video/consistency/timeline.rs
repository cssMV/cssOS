use crate::video::contracts::{ArcTimelineBeat, SceneInput};

fn infer_section_role(section_type: &str) -> &'static str {
    let lower = section_type.to_lowercase();
    if lower.contains("chorus") {
        "chorus"
    } else if lower.contains("bridge") {
        "bridge"
    } else if lower.contains("outro") || lower.contains("ending") {
        "outro"
    } else if lower.contains("intro") {
        "intro"
    } else {
        "verse"
    }
}

pub fn build_arc_timeline(scenes: &[SceneInput]) -> Vec<ArcTimelineBeat> {
    let total_duration: f32 = scenes
        .iter()
        .map(|scene| scene.duration_secs.max(0.0))
        .sum();
    let chorus_scene_ids: Vec<usize> = scenes
        .iter()
        .filter(|scene| infer_section_role(&scene.section_type) == "chorus")
        .map(|scene| scene.id)
        .collect();
    let primary_explosion_scene = chorus_scene_ids
        .iter()
        .enumerate()
        .max_by(|(left_idx, _), (right_idx, _)| {
            let left_score = (*left_idx + 1) as i32;
            let right_score = (*right_idx + 1) as i32;
            left_score.cmp(&right_score)
        })
        .map(|(_, scene_id)| *scene_id);
    let secondary_explosion_scene = chorus_scene_ids
        .iter()
        .copied()
        .filter(|scene_id| Some(*scene_id) != primary_explosion_scene)
        .next_back();

    let mut running = 0.0_f32;
    scenes
        .iter()
        .enumerate()
        .map(|(index, scene)| {
            let start_secs = running;
            let end_secs = start_secs + scene.duration_secs;
            running = end_secs;
            let role = infer_section_role(&scene.section_type);
            let progress_ratio = if total_duration > 0.0 {
                ((start_secs + end_secs) * 0.5) / total_duration
            } else {
                0.0
            };
            let explosion_rank = chorus_scene_ids
                .iter()
                .position(|scene_id| *scene_id == scene.id)
                .map(|pos| pos + 1)
                .unwrap_or(0);
            let is_primary_explosion = Some(scene.id) == primary_explosion_scene;
            let is_secondary_explosion = Some(scene.id) == secondary_explosion_scene;
            let is_resolution = role == "outro"
                || (role == "verse" && progress_ratio >= 0.82)
                || (role == "bridge" && progress_ratio >= 0.9);
            let is_aftershock = progress_ratio > 0.62
                && !is_primary_explosion
                && !is_secondary_explosion
                && !is_resolution
                && (role == "chorus" || role == "bridge" || role == "verse");
            let energy_phase = if role == "chorus" && is_primary_explosion {
                "main_explosion"
            } else if role == "chorus" && is_secondary_explosion {
                "secondary_explosion"
            } else if is_aftershock {
                "aftershock"
            } else if is_resolution {
                "resolution"
            } else if role == "chorus" {
                "chorus_lift"
            } else if role == "bridge" {
                "reality_turn"
            } else if role == "outro" {
                "afterglow"
            } else if role == "intro" {
                "awakening"
            } else if progress_ratio < 0.33 {
                "setup_drive"
            } else if progress_ratio < 0.7 {
                "mid_lift"
            } else {
                "late_release"
            };
            let impact_weight = if is_primary_explosion {
                1.0
            } else if is_secondary_explosion {
                0.82
            } else if is_aftershock {
                0.68
            } else if role == "bridge" {
                0.72
            } else {
                0.45
            };
            let stability_weight = if is_resolution {
                0.94
            } else if is_aftershock {
                0.78
            } else if role == "verse" {
                0.82
            } else if role == "chorus" {
                0.58
            } else {
                0.7
            };
            ArcTimelineBeat {
                scene_id: scene.id,
                section_role: role.to_string(),
                sequence_index: index + 1,
                start_secs,
                end_secs,
                progress_ratio,
                energy_phase: energy_phase.to_string(),
                explosion_rank,
                is_primary_explosion,
                is_secondary_explosion,
                is_aftershock,
                is_resolution,
                impact_weight,
                stability_weight,
            }
        })
        .collect()
}
