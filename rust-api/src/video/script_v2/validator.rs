use super::parser::ParsedScript;

pub fn validate_frame(prompt: &str, parsed: &ParsedScript) -> bool {
    let normalized = prompt.to_ascii_lowercase();

    for item in &parsed.characters {
        if !normalized.contains(&item.to_ascii_lowercase()) {
            return false;
        }
    }
    for item in &parsed.actions {
        if !normalized.contains(&item.to_ascii_lowercase()) {
            return false;
        }
    }
    for item in &parsed.environment {
        if !normalized.contains(&item.to_ascii_lowercase()) {
            return false;
        }
    }
    if !parsed.props.is_empty()
        && !parsed
            .props
            .iter()
            .any(|item| normalized.contains(&item.to_ascii_lowercase()))
    {
        return false;
    }
    true
}

pub fn build_strict_prompt_v2(script: &str, parsed: &ParsedScript) -> String {
    let mut parts = vec![
        format!("MUST include character: {}", parsed.characters.join(", ")),
        format!("MUST include action: {}", parsed.actions.join(", ")),
        format!(
            "MUST include environment: {}",
            parsed.environment.join(", ")
        ),
    ];
    if !parsed.props.is_empty() {
        parts.push(format!("MUST include props: {}", parsed.props.join(", ")));
    }
    if !parsed.lighting.is_empty() {
        parts.push(format!(
            "MUST include lighting: {}",
            parsed.lighting.join(", ")
        ));
    }
    parts.push(script.to_string());
    parts.push(
        "cinematic, realistic, full composition, no missing subject, no empty frame".to_string(),
    );
    parts.join(", ")
}

#[cfg(test)]
mod tests {
    use super::{build_strict_prompt_v2, validate_frame};
    use crate::video::script_v2::parser::parse_script_v2;

    #[test]
    fn strict_prompt_passes_validator() {
        let parsed = parse_script_v2("机械臂正在组装一名男性仿生人");
        let prompt = build_strict_prompt_v2("机械臂正在组装一名男性仿生人", &parsed);
        assert!(validate_frame(&prompt, &parsed));
    }
}
