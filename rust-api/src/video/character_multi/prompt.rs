use super::profiles::{LockedCharacter, MultiCharacterSet};

pub fn build_multi_character_prompt(set: &MultiCharacterSet, scene_script: &str) -> String {
    let mut blocks = Vec::new();
    for character in &set.characters {
        blocks.push(character_block(character));
    }

    let composition = if set.characters.len() >= 2 {
        "all named characters must be visible, readable body poses, clear interaction, no missing character"
    } else {
        "main subject must be clearly visible, full readable pose"
    };

    format!(
        "{characters}, scene script: {script}, {composition}, consistent identity, same faces, same costumes, cinematic realism, no cropped important subject",
        characters = blocks.join(", "),
        script = scene_script,
        composition = composition
    )
}

fn character_block(character: &LockedCharacter) -> String {
    match &character.anchor_path {
        Some(anchor) => format!(
            "character {}: {}, same as reference {}",
            character.role_id, character.base_prompt, anchor
        ),
        None => format!("character {}: {}", character.role_id, character.base_prompt),
    }
}
