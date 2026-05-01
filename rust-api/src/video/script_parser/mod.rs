pub mod parser;
pub mod prompt_builder;

pub use parser::parse_script;
pub use prompt_builder::build_strict_prompt;

pub fn script_to_prompt(script: &str) -> String {
    let parsed = parse_script(script);
    build_strict_prompt(&parsed)
}

#[cfg(test)]
mod tests {
    use super::script_to_prompt;

    #[test]
    fn script_to_prompt_contains_core_constraints() {
        let prompt = script_to_prompt("骑士在夕阳战场骑马前进，远处城墙燃烧");
        assert!(prompt.contains("male knight"));
        assert!(prompt.contains("battlefield"));
        assert!(prompt.contains("sunset lighting"));
    }
}
