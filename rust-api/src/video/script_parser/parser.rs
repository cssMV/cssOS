use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
pub struct ParsedScene {
    pub characters: Vec<String>,
    pub actions: Vec<String>,
    pub environment: Vec<String>,
    pub time: Vec<String>,
    pub mood: Vec<String>,
    pub negatives: Vec<String>,
}

pub fn parse_script(script: &str) -> ParsedScene {
    let mut scene = ParsedScene::default();
    let source = script.to_lowercase();
    let contains = |patterns: &[&str]| patterns.iter().any(|pattern| source.contains(pattern));

    if contains(&["骑士", "knight"]) {
        scene.characters.push("male knight".into());
    }
    if contains(&["仿生人", "android", "humanoid robot", "robotic human"]) {
        scene.characters.push("android".into());
    }
    if contains(&["女人", "女子", "女性", "woman", "female"]) {
        scene.characters.push("female character".into());
        scene.negatives.push("no male character".into());
    }
    if contains(&["男人", "男子", "男性", "man", "male"])
        && !scene.characters.iter().any(|item| item == "male knight")
    {
        scene.characters.push("male character".into());
        scene.negatives.push("no female character".into());
    }
    if contains(&["骑马", "ride a horse", "riding a horse", "horseback"]) {
        scene.actions.push("riding a horse".into());
    }
    if contains(&["走", "walk", "walking"]) {
        scene.actions.push("walking forward".into());
    }
    if contains(&["奔跑", "run", "running"]) {
        scene.actions.push("running".into());
    }
    if contains(&[
        "组装",
        "assembling",
        "assemble",
        "constructing",
        "construction",
    ]) {
        scene.actions.push("being assembled".into());
    }
    if contains(&["弹琴", "钢琴", "piano", "playing keys"]) {
        scene.actions.push("playing the piano".into());
    }
    if contains(&["战场", "battlefield"]) {
        scene.environment.push("battlefield".into());
    }
    if contains(&["城墙", "castle wall", "city wall"]) {
        scene.environment.push("castle wall".into());
    }
    if contains(&["黑色背景", "black background", "dark void", "dark space"]) {
        scene.environment.push("black void background".into());
    }
    if contains(&["钢琴", "piano"]) {
        scene.environment.push("piano".into());
    }
    if contains(&["机械马", "robotic horse", "mechanical horse"]) {
        scene.characters.push("robotic horse".into());
        scene.environment.push("vast dark space".into());
        scene.negatives.push("no rider".into());
        scene.negatives.push("no extra human".into());
    }
    if contains(&["机械臂", "mechanical arm", "robotic arm"]) {
        scene.environment.push("mechanical assembly rig".into());
    }
    if contains(&["沙漠", "desert"]) {
        scene.environment.push("desert".into());
    }
    if contains(&["夕阳", "sunset", "dusk", "golden hour"]) {
        scene.time.push("sunset lighting".into());
    }
    if contains(&["夜", "night", "moonlight"]) {
        scene.time.push("night scene".into());
    }
    if contains(&["清晨", "dawn", "sunrise"]) {
        scene.time.push("dawn light".into());
    }
    if contains(&["燃烧", "火", "burning", "flames", "fire"]) {
        scene.mood.push("fire and destruction".into());
    }
    if contains(&["悲伤", "悲壮", "sorrow", "tragic"]) {
        scene.mood.push("tragic mood".into());
    }
    if contains(&["史诗", "epic"]) {
        scene.mood.push("epic atmosphere".into());
    }
    if contains(&["冷光", "cold light", "cold lighting"]) {
        scene.mood.push("cold clinical light".into());
    }
    if contains(&["聚光灯", "spotlight"]) {
        scene.mood.push("hard spotlight contrast".into());
    }
    if contains(&["面无表情", "emotionless", "expressionless"]) {
        scene.mood.push("emotionless expression".into());
    }
    if contains(&["帽", "hat", "cowboy hat"]) {
        scene.negatives.push("no hat".into());
        scene.negatives.push("no cowboy hat".into());
    }
    if contains(&["独自", "solo", "alone", "单独"]) {
        scene.negatives.push("single subject only".into());
    }
    if scene.characters.iter().any(|item| item == "android")
        && scene
            .characters
            .iter()
            .any(|item| item == "female character")
    {
        scene
            .characters
            .retain(|item| item != "android" && item != "female character");
        scene.characters.push("female android".into());
        scene.negatives.push("no male android".into());
        scene.negatives.push("no hat".into());
        scene.negatives.push("no cowboy hat".into());
    }
    if scene.characters.iter().any(|item| item == "android")
        && scene.characters.iter().any(|item| item == "male character")
    {
        scene
            .characters
            .retain(|item| item != "android" && item != "male character");
        scene.characters.push("male android".into());
        scene.negatives.push("no female android".into());
    }
    if scene.characters.iter().any(|item| item == "robotic horse") {
        scene.negatives.push("horse must be fully visible".into());
    }

    scene
}

#[cfg(test)]
mod tests {
    use super::parse_script;

    #[test]
    fn parses_knight_battlefield_script() {
        let parsed = parse_script("骑士在夕阳战场骑马前进，披风飞扬，远处城墙燃烧");
        assert!(parsed.characters.iter().any(|item| item == "male knight"));
        assert!(parsed.actions.iter().any(|item| item == "riding a horse"));
        assert!(parsed.environment.iter().any(|item| item == "battlefield"));
        assert!(parsed.environment.iter().any(|item| item == "castle wall"));
        assert!(parsed.time.iter().any(|item| item == "sunset lighting"));
        assert!(parsed
            .mood
            .iter()
            .any(|item| item == "fire and destruction"));
    }

    #[test]
    fn parses_female_android_without_hat_constraints() {
        let parsed = parse_script("白色仿生人女性坐在钢琴前，面无表情，冷光，黑色背景");
        assert!(parsed
            .characters
            .iter()
            .any(|item| item == "female android"));
        assert!(parsed.negatives.iter().any(|item| item == "no hat"));
        assert!(parsed.negatives.iter().any(|item| item == "no cowboy hat"));
    }
}
