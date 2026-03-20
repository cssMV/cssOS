use crate::immersion_engine::state::ImmersionState;
use crate::presence_engine::resolver::resolve_presence_from_immersion;
use crate::presence_engine::state::PresenceState;

#[derive(Debug, Clone)]
pub struct PresenceEngine {
    pub state: PresenceState,
}

impl PresenceEngine {
    pub fn new(state: PresenceState) -> Self {
        Self { state }
    }

    pub fn sync_from_immersion(&mut self, immersion: &ImmersionState) {
        self.state.profile = resolve_presence_from_immersion(immersion);
    }

    pub fn set_scene(&mut self, scene_id: String) {
        self.state.current_scene = Some(scene_id);
    }

    pub fn set_perceived_by(&mut self, ids: Vec<String>) {
        self.state.perceived_by = Some(ids);
    }
}

#[cfg(test)]
mod tests {
    use crate::immersion_engine::state::ImmersionState;
    use crate::immersion_engine::types::{ImmersionMode, PresenceRole};
    use crate::presence_engine::policy::{
        can_affect_relationships, can_be_remembered, can_characters_address_viewer,
    };
    use crate::presence_engine::resolver::resolve_presence_from_immersion;
    use crate::presence_engine::types::PresenceKind;

    #[test]
    fn v140_spatial_observer_invisible_observer_stays_unaddressed() {
        let immersion = ImmersionState {
            mode: ImmersionMode::SpatialObserver,
            presence_role: PresenceRole::InvisibleObserver,
            ..ImmersionState::default()
        };
        let profile = resolve_presence_from_immersion(&immersion);
        let state = crate::presence_engine::state::PresenceState {
            profile,
            ..Default::default()
        };

        assert_eq!(state.profile.kind, PresenceKind::InvisibleObserver);
        assert!(!can_characters_address_viewer(&state));
        assert!(!can_be_remembered(&state));
    }

    #[test]
    fn v140_spatial_participant_companion_enables_relationship_presence() {
        let immersion = ImmersionState {
            mode: ImmersionMode::SpatialParticipant,
            presence_role: PresenceRole::Companion,
            ..ImmersionState::default()
        };
        let profile = resolve_presence_from_immersion(&immersion);
        let state = crate::presence_engine::state::PresenceState {
            profile,
            ..Default::default()
        };

        assert_eq!(state.profile.kind, PresenceKind::Companion);
        assert!(can_characters_address_viewer(&state));
        assert!(can_affect_relationships(&state));
        assert!(can_be_remembered(&state));
    }
}
