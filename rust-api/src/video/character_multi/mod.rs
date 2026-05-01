pub mod profiles;
pub mod prompt;

use anyhow::Result;

use crate::video::openai_client::generate_image;

pub use profiles::{build_multi_character_set, LockedCharacter, MultiCharacterSet};
pub use prompt::build_multi_character_prompt;

pub fn ensure_multi_character_anchors(api_key: &str, set: &mut MultiCharacterSet) -> Result<()> {
    for character in &mut set.characters {
        if character.anchor_path.is_none() {
            let path = format!("output/anchor_{}.png", character.role_id);
            let prompt = format!(
                "{}, single character portrait, front view, clean face, full detail, consistent identity, cinematic lighting",
                character.base_prompt
            );
            generate_image(api_key, &prompt, &path)?;
            character.anchor_path = Some(path);
        }
    }
    Ok(())
}

pub fn build_locked_multi_character_prompt(api_key: &str, scene_script: &str) -> Result<String> {
    let mut set = build_multi_character_set(scene_script);
    ensure_multi_character_anchors(api_key, &mut set)?;
    Ok(build_multi_character_prompt(&set, scene_script))
}
