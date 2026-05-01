use crate::video::motion_v2::build_motion_sequence_v2;
use crate::video::script_parser::{parse_script, script_to_prompt};
use crate::video::types::{SceneInput, SceneRenderPlan};

#[derive(Debug, Clone)]
pub struct MotionFrame {
    pub prompt: String,
    pub beat_label: String,
}

pub fn build_motion_sequence(
    scene: &SceneInput,
    plan: Option<&SceneRenderPlan>,
) -> Vec<MotionFrame> {
    let parsed = parse_script(&scene.visual_script);
    let strict_prompt = script_to_prompt(&scene.visual_script);
    let character_clause = if parsed.characters.is_empty() {
        None
    } else {
        Some(format!(
            "keep the same subject identity across frames: {}",
            parsed.characters.join(", ")
        ))
    };
    let environment_clause = if parsed.environment.is_empty() {
        None
    } else {
        Some(format!(
            "keep the same environment continuity: {}",
            parsed.environment.join(", ")
        ))
    };
    let motion_hint = plan
        .map(|item| item.shot_plan.motion_hint.clone())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "motivated cinematic motion".to_string());
    let camera_hint = plan
        .map(|item| {
            item.style_profile
                .camera_language
                .clone()
                .unwrap_or_default()
        })
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "cinematic camera".to_string());
    let beats = build_motion_sequence_v2(scene)
        .into_iter()
        .map(|frame| (frame.beat_label, frame.prompt))
        .collect::<Vec<_>>();

    beats
        .into_iter()
        .map(|(beat_label, beat_prompt)| {
            let mut parts = vec![
                strict_prompt.clone(),
                scene.visual_script.clone(),
                format!("motion beat: {beat_label}"),
                beat_prompt,
                format!("motion style: {motion_hint}"),
                format!("camera language: {camera_hint}"),
                "continuous action, same shot progression, temporal continuity".to_string(),
            ];
            if let Some(clause) = &character_clause {
                parts.push(clause.clone());
            }
            if let Some(clause) = &environment_clause {
                parts.push(clause.clone());
            }
            MotionFrame {
                prompt: parts.join(", "),
                beat_label,
            }
        })
        .collect()
}

pub fn build_motion_sequence_from_prompt(
    base_prompt: &str,
    motion_hint: Option<&str>,
    camera_hint: Option<&str>,
) -> Vec<MotionFrame> {
    let motion_hint = motion_hint
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("motivated cinematic motion");
    let camera_hint = camera_hint
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("cinematic camera");
    let beats = [
        ("start", "beginning of the action, subject gathers motion"),
        (
            "develop",
            "motion develops through the body and environment",
        ),
        (
            "advance",
            "clear mid-action progression with continuous movement",
        ),
        (
            "peak",
            "motion reaches a visible peak without changing identity",
        ),
        (
            "resolve",
            "motion resolves while keeping the same scene continuity",
        ),
    ];
    beats
        .into_iter()
        .map(|(beat_label, beat_prompt)| MotionFrame {
            prompt: format!(
                "{base_prompt}, motion beat: {beat_label}, {beat_prompt}, motion style: {motion_hint}, camera language: {camera_hint}, continuous action, same subject, same environment, temporal continuity"
            ),
            beat_label: beat_label.to_string(),
        })
        .collect()
}

#[allow(dead_code)]
fn motion_beats_for_scene(scene: &SceneInput, actions: &[String]) -> Vec<(String, String)> {
    if actions.iter().any(|item| item.contains("riding a horse")) {
        return vec![
            (
                "mount-prep".to_string(),
                "the rider approaches the horse and prepares to mount".to_string(),
            ),
            (
                "mount".to_string(),
                "the rider mounts the horse and gathers momentum".to_string(),
            ),
            (
                "stride".to_string(),
                "the horse starts moving with a clear forward stride".to_string(),
            ),
            (
                "gallop".to_string(),
                "the horse accelerates and the cape trails in motion".to_string(),
            ),
            (
                "drive".to_string(),
                "the rider drives forward into the scene with continuous motion".to_string(),
            ),
        ];
    }

    if actions
        .iter()
        .any(|item| item.contains("playing the piano"))
    {
        return vec![
            (
                "settle".to_string(),
                "the subject settles at the piano bench and prepares the hands".to_string(),
            ),
            (
                "touch".to_string(),
                "the fingers move toward the keys and make first contact".to_string(),
            ),
            (
                "phrase-rise".to_string(),
                "the hands move through a measured musical phrase".to_string(),
            ),
            (
                "phrase-peak".to_string(),
                "the performance reaches an expressive peak with visible hand motion".to_string(),
            ),
            (
                "release".to_string(),
                "the hands release the keys and hold the final pose".to_string(),
            ),
        ];
    }

    if actions.iter().any(|item| item.contains("being assembled")) {
        return vec![
            (
                "skeleton".to_string(),
                "mechanical arms position the exposed frame for assembly".to_string(),
            ),
            (
                "material-begin".to_string(),
                "synthetic material begins to cover the frame in a visible pass".to_string(),
            ),
            (
                "material-rise".to_string(),
                "the body gains visible form as the assembly continues".to_string(),
            ),
            (
                "seal".to_string(),
                "the assembly seals the outer surface and facial structure".to_string(),
            ),
            (
                "completion".to_string(),
                "the figure reaches near-complete form in the same assembly rig".to_string(),
            ),
        ];
    }

    if actions.iter().any(|item| item.contains("running")) {
        return vec![
            (
                "launch".to_string(),
                "the subject launches into motion from a grounded stance".to_string(),
            ),
            (
                "stride-1".to_string(),
                "the running motion is clearly visible with forward propulsion".to_string(),
            ),
            (
                "stride-2".to_string(),
                "the subject maintains continuous running momentum".to_string(),
            ),
            (
                "surge".to_string(),
                "the motion surges toward the camera or across the frame".to_string(),
            ),
            (
                "carry".to_string(),
                "the running action carries through the end of the shot".to_string(),
            ),
        ];
    }

    let base_action = if actions.is_empty() {
        scene.visual_script.clone()
    } else {
        actions.join(", ")
    };
    vec![
        (
            "start".to_string(),
            format!("{base_action}, beginning of the action"),
        ),
        (
            "develop".to_string(),
            format!("{base_action}, action developing naturally"),
        ),
        (
            "advance".to_string(),
            format!("{base_action}, action advancing through the middle beat"),
        ),
        (
            "peak".to_string(),
            format!("{base_action}, action reaching a visible peak"),
        ),
        (
            "resolve".to_string(),
            format!("{base_action}, action resolving while keeping continuity"),
        ),
    ]
}

#[cfg(test)]
mod tests {
    use crate::video::consistency::{ShotPlan, ShotType, StyleProfile};
    use crate::video::types::{SceneEntities, SceneInput, SceneRenderPlan};

    use super::build_motion_sequence;

    #[test]
    fn builds_specialized_horse_motion_sequence() {
        let scene = SceneInput {
            id: 7,
            section_type: "verse".to_string(),
            text_block: String::new(),
            visual_script: "骑士在夕阳战场骑马前进".to_string(),
            duration_secs: 8.0,
            entities: SceneEntities {
                characters: vec!["knight".to_string()],
                location: Some("battlefield".to_string()),
                props: vec!["horse".to_string()],
            },
            reference_media_paths: Vec::new(),
        };
        let plan = SceneRenderPlan {
            output_path: "out.mp4".to_string(),
            shot_plan: ShotPlan {
                scene_id: 7,
                primary_shot: ShotType::Tracking,
                motion_hint: "tracking push".to_string(),
                transition_hint: "cut".to_string(),
            },
            style_profile: StyleProfile {
                genre: "epic".to_string(),
                color_palette: None,
                visual_tone: None,
                camera_language: Some("slow tracking".to_string()),
                style_tokens: Vec::new(),
            },
            character_profiles: Vec::new(),
            reference_media_path: None,
            consistency_tokens: Vec::new(),
        };

        let frames = build_motion_sequence(&scene, Some(&plan));
        assert_eq!(frames.len(), 5);
        assert!(frames[0].prompt.contains("prepares to mount"));
        assert!(frames[3].prompt.contains("accelerates"));
    }
}
