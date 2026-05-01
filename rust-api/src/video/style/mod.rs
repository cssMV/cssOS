pub mod profile;
pub mod prompt;

use self::profile::{build_style_profile, StyleProfile};
use self::prompt::build_style_prompt;

pub fn build_style_block(style_hint: Option<&str>) -> (StyleProfile, String) {
    let profile = build_style_profile(style_hint);
    let prompt = build_style_prompt(&profile);
    (profile, prompt)
}
