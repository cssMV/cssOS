#[derive(Debug, Clone)]
pub struct RelationState {
    pub relation: String,
}

pub fn init_relation_state(relation: &str) -> RelationState {
    RelationState {
        relation: relation.to_string(),
    }
}

pub fn build_relation_prompt(prev_relation: &str, current_relation: &str) -> String {
    format!(
        "SAME RELATIONSHIP as previous frame, previous relation: {prev}, current relation: {curr}, maintain spatial continuity, maintain emotional continuity, no sudden position change, no character swap",
        prev = prev_relation,
        curr = current_relation
    )
}
