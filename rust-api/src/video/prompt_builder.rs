use crate::video::script_parser::script_to_prompt;
use crate::video::types::{SceneInput, SceneRenderPlan};

pub fn build_scene_prompt(scene: &SceneInput, plan: Option<&SceneRenderPlan>) -> String {
    let mut parts = vec![
        "draw a cinematic film still for a music video".to_string(),
        format!("scene type: {}", scene.section_type),
        format!("visual script: {}", scene.visual_script.trim()),
        format!(
            "script constraints: {}",
            script_to_prompt(&scene.visual_script)
        ),
    ];
    if !scene.entities.characters.is_empty() {
        parts.push(format!(
            "characters: {}",
            scene.entities.characters.join(", ")
        ));
    }
    if let Some(location) = scene.entities.location.as_ref() {
        parts.push(format!("location: {}", location));
    }
    if !scene.entities.props.is_empty() {
        parts.push(format!("props: {}", scene.entities.props.join(", ")));
    }
    if let Some(plan) = plan {
        parts.push(format!("camera shot: {:?}", plan.shot_plan.primary_shot));
        parts.push(format!("motion hint: {}", plan.shot_plan.motion_hint));
        parts.push(format!(
            "transition hint: {}",
            plan.shot_plan.transition_hint
        ));
        if let Some(tone) = plan.style_profile.visual_tone.as_ref() {
            parts.push(format!("visual tone: {}", tone));
        }
        if let Some(palette) = plan.style_profile.color_palette.as_ref() {
            parts.push(format!("palette: {}", palette));
        }
        if let Some(camera_language) = plan.style_profile.camera_language.as_ref() {
            parts.push(format!("camera language: {}", camera_language));
        }
        if !plan.character_profiles.is_empty() {
            let lock = plan
                .character_profiles
                .iter()
                .map(|profile| {
                    let accessories = if profile.accessories.is_empty() {
                        "".to_string()
                    } else {
                        format!(" accessories {}", profile.accessories.join("/"))
                    };
                    format!(
                        "{} {} {}{}",
                        profile.display_name,
                        profile
                            .outfit
                            .clone()
                            .unwrap_or_else(|| "signature outfit".to_string()),
                        profile.visual_keywords.join(" "),
                        accessories
                    )
                })
                .collect::<Vec<_>>()
                .join("; ");
            parts.push(format!("character lock: {}", lock));
        }
    }
    parts.push(
        "keep identity, wardrobe, lighting direction, and environment consistent across frames"
            .to_string(),
    );
    parts.push(
        "high detail, grounded anatomy, realistic scene layout, cinematic lighting, no text, no watermark"
            .to_string(),
    );
    parts.join(", ")
}
