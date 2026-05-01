use anyhow::Result;

#[derive(Debug, Clone)]
pub struct SemanticLabels {
    pub motion_type: String,
    pub camera_type: String,
    pub scene_type: String,
    pub emotion: String,
}

pub fn classify_motion(filename: &str) -> String {
    let lower = filename.to_lowercase();

    if lower.contains("run") {
        return "running".into();
    }
    if lower.contains("walk") {
        return "walking".into();
    }
    if lower.contains("fight") {
        return "fighting".into();
    }

    "unknown".into()
}

pub fn classify_camera(filename: &str) -> String {
    let lower = filename.to_lowercase();

    if lower.contains("close") {
        return "close_up".into();
    }
    if lower.contains("wide") {
        return "wide_shot".into();
    }
    if lower.contains("pan") {
        return "pan".into();
    }

    "static".into()
}

pub fn classify_scene(filename: &str) -> String {
    let lower = filename.to_lowercase();

    if lower.contains("city") {
        return "city".into();
    }
    if lower.contains("room") {
        return "indoor".into();
    }
    if lower.contains("battle") {
        return "battlefield".into();
    }

    "unknown".into()
}

pub fn classify_emotion(filename: &str) -> String {
    let lower = filename.to_lowercase();

    if lower.contains("sad") {
        return "sad".into();
    }
    if lower.contains("happy") {
        return "happy".into();
    }
    if lower.contains("epic") {
        return "epic".into();
    }

    "neutral".into()
}

pub fn build_semantic_labels(path: &str) -> Result<SemanticLabels> {
    Ok(SemanticLabels {
        motion_type: classify_motion(path),
        camera_type: classify_camera(path),
        scene_type: classify_scene(path),
        emotion: classify_emotion(path),
    })
}
