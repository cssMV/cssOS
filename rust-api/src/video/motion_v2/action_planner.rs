use crate::video::types::SceneInput;

use super::action_parser::{detect_action, ActionType};

#[derive(Debug, Clone)]
pub struct MotionFrame {
    pub prompt: String,
    pub beat_label: String,
}

pub fn build_motion_sequence_v2(scene: &SceneInput) -> Vec<MotionFrame> {
    match detect_action(&scene.visual_script) {
        ActionType::Riding => riding_sequence(scene),
        ActionType::Walking => walking_sequence(scene),
        ActionType::Building => building_sequence(scene),
        ActionType::Sitting => sitting_sequence(scene),
        ActionType::Running => running_sequence(scene),
        ActionType::Unknown => fallback_sequence(scene),
    }
}

fn riding_sequence(scene: &SceneInput) -> Vec<MotionFrame> {
    let base = &scene.visual_script;
    vec![
        frame("mount-prep", format!("{base}, preparing to mount horse")),
        frame("mount", format!("{base}, mounting horse, one foot up")),
        frame("seat", format!("{base}, sitting on horse, holding reins")),
        frame("start", format!("{base}, horse starting to move forward")),
        frame("ride", format!("{base}, riding fast, dynamic motion")),
    ]
}

fn walking_sequence(scene: &SceneInput) -> Vec<MotionFrame> {
    let base = &scene.visual_script;
    vec![
        frame("stand", format!("{base}, standing still")),
        frame("step-start", format!("{base}, starting to walk")),
        frame("mid-step", format!("{base}, mid walking step")),
        frame(
            "carry",
            format!("{base}, walking forward, continuous motion"),
        ),
    ]
}

fn building_sequence(scene: &SceneInput) -> Vec<MotionFrame> {
    let base = &scene.visual_script;
    vec![
        frame("prep", format!("{base}, robotic arms preparing parts")),
        frame("torso", format!("{base}, assembling torso structure")),
        frame("limbs", format!("{base}, attaching limbs")),
        frame("seal", format!("{base}, finishing assembly")),
    ]
}

fn sitting_sequence(scene: &SceneInput) -> Vec<MotionFrame> {
    let base = &scene.visual_script;
    vec![
        frame("approach", format!("{base}, approaching the seat")),
        frame("lower", format!("{base}, lowering into the seated pose")),
        frame("settle", format!("{base}, seated and settling posture")),
        frame("hold", format!("{base}, seated hold with subtle motion")),
    ]
}

fn running_sequence(scene: &SceneInput) -> Vec<MotionFrame> {
    let base = &scene.visual_script;
    vec![
        frame("prep", format!("{base}, preparing to run")),
        frame("launch", format!("{base}, starting to run")),
        frame("sprint", format!("{base}, mid sprint")),
        frame("full-speed", format!("{base}, full speed running")),
    ]
}

fn fallback_sequence(scene: &SceneInput) -> Vec<MotionFrame> {
    let base = &scene.visual_script;
    vec![
        frame("initial", format!("{base}, initial state")),
        frame("develop", format!("{base}, developing scene")),
        frame("peak", format!("{base}, peak moment")),
    ]
}

fn frame(label: &str, prompt: String) -> MotionFrame {
    MotionFrame {
        prompt,
        beat_label: label.to_string(),
    }
}

#[cfg(test)]
mod tests {
    use crate::video::types::{SceneEntities, SceneInput};

    use super::build_motion_sequence_v2;

    #[test]
    fn riding_sequence_has_progression() {
        let scene = SceneInput {
            id: 1,
            section_type: "verse".to_string(),
            text_block: String::new(),
            visual_script: "骑士在夕阳战场骑马前进".to_string(),
            duration_secs: 10.0,
            entities: SceneEntities::default(),
            reference_media_paths: Vec::new(),
        };
        let frames = build_motion_sequence_v2(&scene);
        assert_eq!(frames.len(), 5);
        assert!(frames[0].prompt.contains("preparing"));
        assert!(frames[4].prompt.contains("riding fast"));
    }
}
