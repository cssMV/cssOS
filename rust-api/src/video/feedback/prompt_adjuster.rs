use super::RenderScore;

pub fn adjust_prompt(original_prompt: &str, score: &RenderScore) -> String {
    let mut additions = Vec::new();
    if score.character_consistency < 0.5 {
        additions.push("same face, same costume, consistent character identity");
    }
    if score.style_consistency < 0.5 {
        additions.push("cinematic lighting, cohesive film still grade, unified style");
    }
    if score.script_alignment < 0.5 {
        additions.push("follow the scene script exactly, reinforce the location and action");
    }
    if score.visual_quality < 0.5 {
        additions.push("high detail, sharp focus, realistic anatomy, production-quality image");
    }
    if additions.is_empty() {
        return original_prompt.to_string();
    }
    format!("{original_prompt}, {}", additions.join(", "))
}
