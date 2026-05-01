#[derive(Debug, Clone)]
pub struct InteractionPlan {
    pub characters: Vec<String>,
    pub relation: String,
    pub pose_hint: String,
    pub composition_hint: String,
}

pub fn build_interaction_plan(script: &str) -> InteractionPlan {
    let s = script.to_lowercase();

    let mut characters = Vec::new();
    if s.contains("骑士") || s.contains("knight") {
        characters.push("male knight".to_string());
    }
    if s.contains("女主") || s.contains("woman") || s.contains("female") || s.contains("公主") {
        characters.push("female lead".to_string());
    }

    let relation = if (s.contains("对视") || s.contains("凝视")) && characters.len() >= 2 {
        "two characters facing each other with emotional tension".to_string()
    } else if s.contains("拥抱") && characters.len() >= 2 {
        "two characters embracing".to_string()
    } else if s.contains("追逐") && characters.len() >= 2 {
        "one character chasing another".to_string()
    } else if characters.len() >= 2 {
        "two characters in the same scene".to_string()
    } else {
        "single-character or weak interaction".to_string()
    };

    let pose_hint = if relation.contains("facing each other") {
        "full body or waist-up, eye contact, opposing positions".to_string()
    } else if relation.contains("embracing") {
        "close body distance, emotional physical contact".to_string()
    } else if relation.contains("chasing") {
        "dynamic forward motion, distance between characters".to_string()
    } else {
        "clear readable body pose".to_string()
    };

    let composition_hint = if characters.len() >= 2 {
        "both characters must be visible in the frame".to_string()
    } else {
        "main subject centered and clearly visible".to_string()
    };

    InteractionPlan {
        characters,
        relation,
        pose_hint,
        composition_hint,
    }
}
