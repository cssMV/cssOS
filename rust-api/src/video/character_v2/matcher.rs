use crate::video::character_v2::types::CharacterCandidate;

pub fn select_best(candidates: &[CharacterCandidate]) -> Option<CharacterCandidate> {
    candidates
        .iter()
        .max_by(|a, b| {
            a.score
                .partial_cmp(&b.score)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .cloned()
}
