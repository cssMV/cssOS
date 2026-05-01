use crate::video::shot_sequence::ShotKind;

pub fn validate_shot(prompt: &str, shot: &ShotKind) -> bool {
    let prompt = prompt.to_ascii_lowercase();

    match shot {
        ShotKind::Wide => prompt.contains("wide") || prompt.contains("full environment"),
        ShotKind::Medium => prompt.contains("medium shot") || prompt.contains("waist"),
        ShotKind::CloseUp => prompt.contains("close-up") || prompt.contains("face"),
        ShotKind::Tracking => prompt.contains("tracking") || prompt.contains("dynamic motion"),
        ShotKind::PushIn => prompt.contains("push-in") || prompt.contains("slow push"),
    }
}

#[cfg(test)]
mod tests {
    use super::validate_shot;
    use crate::video::shot_sequence::ShotKind;

    #[test]
    fn validates_close_up_prompt() {
        assert!(validate_shot(
            "close-up shot, face-focused framing, shallow depth of field",
            &ShotKind::CloseUp
        ));
    }

    #[test]
    fn rejects_wrong_shot_prompt() {
        assert!(!validate_shot(
            "wide shot, full environment visible",
            &ShotKind::PushIn
        ));
    }
}
