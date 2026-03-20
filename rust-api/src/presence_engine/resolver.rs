use crate::immersion_engine::state::ImmersionState;
use crate::immersion_engine::types::{ImmersionMode, PresenceRole as ImmersionPresenceRole};
use crate::presence_engine::types::{
    NarrativeAcknowledgement, PresenceKind, PresencePerceptionKind, PresenceProfile,
};

pub fn resolve_presence_from_immersion(immersion: &ImmersionState) -> PresenceProfile {
    match (&immersion.mode, &immersion.presence_role) {
        (ImmersionMode::FlatScreen, _) | (ImmersionMode::Cinema3d, _) => PresenceProfile {
            kind: PresenceKind::None,
            perception: PresencePerceptionKind::Unnoticed,
            acknowledgement: NarrativeAcknowledgement::None,
            can_be_addressed: false,
            can_change_relationships: false,
            can_be_remembered: false,
        },
        (ImmersionMode::Immersive360, _) => PresenceProfile {
            kind: PresenceKind::InvisibleObserver,
            perception: PresencePerceptionKind::Unnoticed,
            acknowledgement: NarrativeAcknowledgement::Implicit,
            can_be_addressed: false,
            can_change_relationships: false,
            can_be_remembered: false,
        },
        (ImmersionMode::SpatialObserver, ImmersionPresenceRole::InvisibleObserver) => {
            PresenceProfile {
                kind: PresenceKind::InvisibleObserver,
                perception: PresencePerceptionKind::Unnoticed,
                acknowledgement: NarrativeAcknowledgement::Implicit,
                can_be_addressed: false,
                can_change_relationships: false,
                can_be_remembered: false,
            }
        }
        (ImmersionMode::SpatialObserver, ImmersionPresenceRole::Witness) => PresenceProfile {
            kind: PresenceKind::Witness,
            perception: PresencePerceptionKind::Seen,
            acknowledgement: NarrativeAcknowledgement::Explicit,
            can_be_addressed: true,
            can_change_relationships: false,
            can_be_remembered: true,
        },
        (ImmersionMode::SpatialParticipant, ImmersionPresenceRole::Companion) => PresenceProfile {
            kind: PresenceKind::Companion,
            perception: PresencePerceptionKind::Addressed,
            acknowledgement: NarrativeAcknowledgement::Explicit,
            can_be_addressed: true,
            can_change_relationships: true,
            can_be_remembered: true,
        },
        (ImmersionMode::SpatialParticipant, ImmersionPresenceRole::Participant) => {
            PresenceProfile {
                kind: PresenceKind::Participant,
                perception: PresencePerceptionKind::Integrated,
                acknowledgement: NarrativeAcknowledgement::Structural,
                can_be_addressed: true,
                can_change_relationships: true,
                can_be_remembered: true,
            }
        }
        _ => PresenceProfile {
            kind: PresenceKind::VisibleObserver,
            perception: PresencePerceptionKind::Seen,
            acknowledgement: NarrativeAcknowledgement::Explicit,
            can_be_addressed: true,
            can_change_relationships: false,
            can_be_remembered: true,
        },
    }
}
