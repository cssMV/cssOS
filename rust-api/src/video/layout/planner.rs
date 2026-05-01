#[derive(Debug, Clone)]
pub struct LayoutPlan {
    pub subject_position: String,
    pub secondary_position: Option<String>,
    pub depth_layers: String,
    pub focus: String,
}

pub fn build_layout_plan(script: &str, relation: &str) -> LayoutPlan {
    let s = script.to_lowercase();

    let mut subject_position = "center".to_string();
    let mut secondary_position = None;
    let mut depth_layers = "foreground subject, background environment".to_string();
    let mut focus = "main subject".to_string();

    if relation.contains("facing each other") {
        subject_position = "left side of frame".to_string();
        secondary_position = Some("right side of frame".to_string());
        depth_layers = "two characters in midground, environment in background".to_string();
        focus = "both characters equally".to_string();
    }

    if relation.contains("chasing") {
        subject_position = "front moving subject".to_string();
        secondary_position = Some("rear chasing subject".to_string());
        depth_layers = "foreground runner, midground chaser, blurred background".to_string();
        focus = "leading character".to_string();
    }

    if s.contains("凝视") || s.contains("特写") || s.contains("close-up") {
        subject_position = "center frame close-up".to_string();
        secondary_position = None;
        depth_layers = "face in foreground, blurred background".to_string();
        focus = "facial expression".to_string();
    }

    LayoutPlan {
        subject_position,
        secondary_position,
        depth_layers,
        focus,
    }
}
