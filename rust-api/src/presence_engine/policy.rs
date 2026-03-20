use crate::presence_engine::state::PresenceState;
use crate::presence_engine::types::{PresenceKind, PresencePerceptionKind};

pub fn can_characters_address_viewer(state: &PresenceState) -> bool {
    state.profile.can_be_addressed
        && matches!(
            state.profile.perception,
            PresencePerceptionKind::Seen
                | PresencePerceptionKind::Addressed
                | PresencePerceptionKind::Integrated
        )
}

pub fn can_affect_relationships(state: &PresenceState) -> bool {
    state.profile.can_change_relationships
}

pub fn can_be_remembered(state: &PresenceState) -> bool {
    state.profile.can_be_remembered
}

pub fn is_diegetic_entity(state: &PresenceState) -> bool {
    matches!(
        state.profile.kind,
        PresenceKind::Participant | PresenceKind::DiegeticCharacter
    )
}
