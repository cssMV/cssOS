pub mod relation;
pub mod shot_validator;

pub use relation::{build_relation_prompt, init_relation_state, RelationState};
pub use shot_validator::validate_shot;
