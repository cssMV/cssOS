use crate::immersion_engine::state::ImmersionState;
use crate::immersion_engine::types::{ImmersionConstraintLevel, ImmersionMode, PresenceRole};

pub fn allow_free_movement(state: &ImmersionState) -> bool {
    if !state.can_move_freely {
        return false;
    }

    matches!(
        (&state.mode, &state.constraint_level),
        (
            ImmersionMode::SpatialParticipant,
            ImmersionConstraintLevel::Guided
        ) | (
            ImmersionMode::SpatialParticipant,
            ImmersionConstraintLevel::Open
        ) | (
            ImmersionMode::SpatialObserver,
            ImmersionConstraintLevel::Open
        )
    )
}

pub fn allow_story_influence(state: &ImmersionState) -> bool {
    matches!(state.mode, ImmersionMode::SpatialParticipant) && state.can_affect_story
}

pub fn preserve_director_focus(state: &ImmersionState) -> bool {
    !matches!(state.constraint_level, ImmersionConstraintLevel::Open)
}

pub fn characters_can_notice_viewer(state: &ImmersionState) -> bool {
    matches!(
        state.presence_role,
        PresenceRole::Witness | PresenceRole::Companion | PresenceRole::Participant
    )
}
