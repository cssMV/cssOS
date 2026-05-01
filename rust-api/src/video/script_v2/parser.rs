#[derive(Debug, Clone, Default)]
pub struct ParsedScript {
    pub characters: Vec<String>,
    pub actions: Vec<String>,
    pub environment: Vec<String>,
    pub props: Vec<String>,
    pub lighting: Vec<String>,
}

pub fn parse_script_v2(script: &str) -> ParsedScript {
    let s = script.to_lowercase();

    ParsedScript {
        characters: extract_characters(&s),
        actions: extract_actions(&s),
        environment: extract_environment(&s),
        props: extract_props(&s),
        lighting: extract_lighting(&s),
    }
}

fn extract_characters(s: &str) -> Vec<String> {
    let mut values = vec![];
    if s.contains("骑士") || s.contains("knight") {
        values.push("male knight".into());
    }
    if s.contains("机器人") || s.contains("android") || s.contains("仿生人") {
        values.push("android human".into());
    }
    if s.contains("女性") || s.contains("woman") || s.contains("female") {
        values.push("female character".into());
    }
    values
}

fn extract_actions(s: &str) -> Vec<String> {
    let mut values = vec![];
    if s.contains("骑马") || s.contains("riding") {
        values.push("riding horse".into());
    }
    if s.contains("奔跑") || s.contains("running") {
        values.push("running".into());
    }
    if s.contains("组装") || s.contains("assembling") {
        values.push("assembling body".into());
    }
    if s.contains("钢琴") || s.contains("piano") {
        values.push("playing piano".into());
    }
    values
}

fn extract_environment(s: &str) -> Vec<String> {
    let mut values = vec![];
    if s.contains("战场") || s.contains("battlefield") {
        values.push("battlefield".into());
    }
    if s.contains("黑暗空间") || s.contains("dark void") || s.contains("黑色背景") {
        values.push("dark void".into());
    }
    if s.contains("城墙") || s.contains("castle wall") {
        values.push("castle wall".into());
    }
    if s.contains("钢琴前") || s.contains("piano") {
        values.push("piano stage".into());
    }
    values
}

fn extract_props(s: &str) -> Vec<String> {
    let mut values = vec![];
    if s.contains("马") || s.contains("horse") {
        values.push("horse".into());
    }
    if s.contains("钢琴") || s.contains("piano") {
        values.push("piano".into());
    }
    if s.contains("机械臂") || s.contains("robotic arm") {
        values.push("robotic arm".into());
    }
    values
}

fn extract_lighting(s: &str) -> Vec<String> {
    let mut values = vec![];
    if s.contains("夕阳") || s.contains("sunset") {
        values.push("sunset lighting".into());
    }
    if s.contains("黑暗") || s.contains("dark") {
        values.push("dark lighting".into());
    }
    if s.contains("冷光") || s.contains("cold light") {
        values.push("cold lighting".into());
    }
    values
}

#[cfg(test)]
mod tests {
    use super::parse_script_v2;

    #[test]
    fn parses_core_visual_fields() {
        let parsed = parse_script_v2("骑士在夕阳战场骑马前进，远处城墙燃烧");
        assert!(parsed.characters.iter().any(|item| item == "male knight"));
        assert!(parsed.actions.iter().any(|item| item == "riding horse"));
        assert!(parsed.environment.iter().any(|item| item == "battlefield"));
        assert!(parsed.props.iter().any(|item| item == "horse"));
        assert!(parsed.lighting.iter().any(|item| item == "sunset lighting"));
    }
}
