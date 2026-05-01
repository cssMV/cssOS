use super::parser::ParsedScene;

pub fn build_strict_prompt(parsed: &ParsedScene) -> String {
    let mut prompt = Vec::new();

    if !parsed.characters.is_empty() {
        prompt.push(format!(
            "MUST include character: {}",
            parsed.characters.join(", ")
        ));
    }
    if !parsed.actions.is_empty() {
        prompt.push(format!("MUST show action: {}", parsed.actions.join(", ")));
    }
    if !parsed.environment.is_empty() {
        prompt.push(format!(
            "MUST include environment: {}",
            parsed.environment.join(", ")
        ));
    }
    if !parsed.time.is_empty() {
        prompt.push(parsed.time.join(", "));
    }
    if !parsed.mood.is_empty() {
        prompt.push(parsed.mood.join(", "));
    }
    if !parsed.negatives.is_empty() {
        prompt.push(format!("STRICTLY avoid: {}", parsed.negatives.join(", ")));
    }

    prompt.push("no missing subject, no empty scene".into());
    prompt.push("full body character visible when a character is present".into());
    prompt.push("match subject count exactly, do not invent extra people or props".into());
    prompt.push("cinematic composition, realistic lighting, grounded anatomy".into());

    prompt.join(", ")
}

#[cfg(test)]
mod tests {
    use super::build_strict_prompt;
    use crate::video::script_parser::parser::ParsedScene;

    #[test]
    fn builds_must_include_prompt() {
        let parsed = ParsedScene {
            characters: vec!["male knight".into()],
            actions: vec!["riding a horse".into()],
            environment: vec!["battlefield".into()],
            time: vec!["sunset lighting".into()],
            mood: vec!["fire and destruction".into()],
            negatives: vec!["no rider".into()],
        };
        let prompt = build_strict_prompt(&parsed);
        assert!(prompt.contains("MUST include character"));
        assert!(prompt.contains("MUST show action"));
        assert!(prompt.contains("MUST include environment"));
        assert!(prompt.contains("STRICTLY avoid"));
    }
}
