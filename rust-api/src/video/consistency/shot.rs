use crate::video::types::SceneInput;

use super::{ShotPlan, ShotType, StyleProfile};

pub fn plan_shots(scenes: &[SceneInput], style: &StyleProfile) -> Vec<ShotPlan> {
    scenes
        .iter()
        .enumerate()
        .map(|(index, scene)| {
            let section = scene.section_type.to_ascii_lowercase();
            let primary_shot = match section.as_str() {
                "chorus" => ShotType::Tracking,
                "bridge" => ShotType::Aerial,
                "intro" | "outro" => ShotType::Wide,
                "verse" => ShotType::Medium,
                _ => ShotType::Static,
            };
            let motion_hint = match section.as_str() {
                "chorus" => "surge-forward".to_string(),
                "bridge" => "pivot-and-rise".to_string(),
                "outro" => "slow-release".to_string(),
                _ => style
                    .camera_language
                    .clone()
                    .unwrap_or_else(|| "steady-narrative".to_string()),
            };
            let transition_hint = if index == 0 {
                "cold-open".to_string()
            } else if section == "chorus" {
                "impact-match-cut".to_string()
            } else if section == "bridge" {
                "contrast-pivot".to_string()
            } else {
                "motivated-continuity".to_string()
            };
            ShotPlan {
                scene_id: scene.id,
                primary_shot,
                motion_hint,
                transition_hint,
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use crate::video::consistency::{normalize_style, ShotType};
    use crate::video::types::{ProjectStyleInput, SceneEntities, SceneInput};

    use super::plan_shots;

    #[test]
    fn chorus_prefers_tracking() {
        let scenes = vec![SceneInput {
            id: 1,
            section_type: "chorus".into(),
            text_block: "sing".into(),
            visual_script: "camera charges into the crowd".into(),
            duration_secs: 9.0,
            entities: SceneEntities::default(),
            reference_media_paths: vec![],
        }];
        let style = normalize_style(&ProjectStyleInput {
            genre: "epic".into(),
            color_palette: None,
            visual_tone: None,
            camera_language: None,
        });
        let plans = plan_shots(&scenes, &style);
        assert_eq!(plans[0].primary_shot, ShotType::Tracking);
        assert_eq!(plans[0].transition_hint, "cold-open");
    }
}
