#[derive(Debug, Clone)]
pub struct LockedCharacter {
    pub role_id: String,
    pub base_prompt: String,
    pub anchor_path: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct MultiCharacterSet {
    pub characters: Vec<LockedCharacter>,
}

impl MultiCharacterSet {
    pub fn find(&self, role_id: &str) -> Option<&LockedCharacter> {
        self.characters
            .iter()
            .find(|character| character.role_id == role_id)
    }
}

pub fn build_multi_character_set(script: &str) -> MultiCharacterSet {
    let s = script.to_lowercase();
    let mut characters = Vec::new();

    if s.contains("骑士") || s.contains("knight") || s.contains("男主") {
        characters.push(LockedCharacter {
            role_id: "male_lead".to_string(),
            base_prompt: "male knight, long dark hair, scar on face, medieval armor, same identity"
                .to_string(),
            anchor_path: None,
        });
    }

    if s.contains("女主") || s.contains("公主") || s.contains("woman") || s.contains("female") {
        characters.push(LockedCharacter {
            role_id: "female_lead".to_string(),
            base_prompt:
                "female lead, long flowing hair, elegant face, dramatic clothing, same identity"
                    .to_string(),
            anchor_path: None,
        });
    }

    if s.contains("机器人") || s.contains("android") || s.contains("仿生人") {
        characters.push(LockedCharacter {
            role_id: "android_lead".to_string(),
            base_prompt:
                "android humanoid, white synthetic body, sleek mechanical details, same identity"
                    .to_string(),
            anchor_path: None,
        });
    }

    MultiCharacterSet { characters }
}
