use std::collections::{BTreeMap, BTreeSet};

use crate::video::types::SceneInput;

use super::CharacterProfile;

pub fn build_character_profiles(scenes: &[SceneInput]) -> Vec<CharacterProfile> {
    let mut profiles: BTreeMap<String, CharacterProfile> = BTreeMap::new();
    for scene in scenes {
        for raw_name in &scene.entities.characters {
            let normalized = normalize_character_id(raw_name);
            if normalized.is_empty() {
                continue;
            }
            let entry = profiles
                .entry(normalized.clone())
                .or_insert_with(|| CharacterProfile {
                    id: normalized.clone(),
                    display_name: raw_name.trim().to_string(),
                    outfit: infer_outfit(scene),
                    accessories: Vec::new(),
                    visual_keywords: Vec::new(),
                });
            if entry.outfit.is_none() {
                entry.outfit = infer_outfit(scene);
            }
            merge_unique(&mut entry.accessories, scene.entities.props.iter().cloned());
            merge_unique(
                &mut entry.visual_keywords,
                scene
                    .visual_script
                    .split(|ch: char| !(ch.is_alphanumeric() || ch == '-'))
                    .filter(|token| token.len() >= 4)
                    .map(|token| token.to_ascii_lowercase()),
            );
        }
    }
    profiles.into_values().collect()
}

fn normalize_character_id(value: &str) -> String {
    value
        .trim()
        .to_ascii_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string()
}

fn infer_outfit(scene: &SceneInput) -> Option<String> {
    let text = format!(
        "{} {}",
        scene.text_block.to_ascii_lowercase(),
        scene.visual_script.to_ascii_lowercase()
    );
    ["hat", "cloak", "armor", "dress", "coat", "uniform"]
        .iter()
        .find(|token| text.contains(**token))
        .map(|token| token.to_string())
}

fn merge_unique(target: &mut Vec<String>, values: impl IntoIterator<Item = String>) {
    let mut seen = target.iter().cloned().collect::<BTreeSet<_>>();
    for value in values {
        let cleaned = value.trim().to_string();
        if cleaned.is_empty() || !seen.insert(cleaned.clone()) {
            continue;
        }
        target.push(cleaned);
    }
}

#[cfg(test)]
mod tests {
    use crate::video::types::{SceneEntities, SceneInput};

    use super::build_character_profiles;

    #[test]
    fn repeated_characters_merge_into_one_profile() {
        let scenes = vec![
            SceneInput {
                id: 1,
                section_type: "verse".into(),
                text_block: "A gunslinger appears".into(),
                visual_script: "The cowboy in a hat enters the dusty town".into(),
                duration_secs: 10.0,
                entities: SceneEntities {
                    characters: vec!["Dolores".into()],
                    location: Some("town".into()),
                    props: vec!["hat".into()],
                },
                reference_media_paths: vec![],
            },
            SceneInput {
                id: 2,
                section_type: "chorus".into(),
                text_block: "Dolores sings".into(),
                visual_script: "Dolores raises the silver pistol".into(),
                duration_secs: 8.0,
                entities: SceneEntities {
                    characters: vec!["dolores".into()],
                    location: Some("street".into()),
                    props: vec!["pistol".into()],
                },
                reference_media_paths: vec![],
            },
        ];
        let profiles = build_character_profiles(&scenes);
        assert_eq!(profiles.len(), 1);
        assert_eq!(profiles[0].id, "dolores");
        assert!(profiles[0].accessories.contains(&"hat".to_string()));
        assert!(profiles[0].accessories.contains(&"pistol".to_string()));
    }
}
