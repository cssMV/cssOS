pub mod planner;
pub mod prompt;

use self::planner::build_layout_plan;
use self::prompt::build_layout_prompt;

pub fn build_layout_block(script: &str, relation: &str) -> String {
    let plan = build_layout_plan(script, relation);
    build_layout_prompt(&plan)
}
