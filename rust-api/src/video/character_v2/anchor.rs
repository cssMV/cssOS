use anyhow::Result;

use crate::video::character_v2::types::CharacterProfile;
use crate::video::openai_client::generate_image;

pub fn generate_anchor(api_key: &str, profile: &mut CharacterProfile) -> Result<String> {
    let path = format!("output/character_anchor_{}.png", profile.id);
    let prompt = format!(
        "{}, single character portrait, front view, clean face, consistent identity, cinematic lighting",
        profile.base_prompt
    );
    generate_image(api_key, &prompt, &path)?;
    profile.anchor_path = Some(path.clone());
    Ok(path)
}
