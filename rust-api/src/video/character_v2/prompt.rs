use crate::video::character_v2::types::CharacterProfile;

pub fn build_character_prompt(profile: &CharacterProfile, scene_prompt: &str) -> String {
    if let Some(anchor) = profile.anchor_path.as_ref() {
        format!(
            "{}, same character as reference image {}, identical face, consistent identity, {}",
            profile.base_prompt, anchor, scene_prompt
        )
    } else {
        format!(
            "{}, same character, identical face, consistent identity, {}",
            profile.base_prompt, scene_prompt
        )
    }
}
