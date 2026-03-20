use crate::presence_engine::types::{
    NarrativeAcknowledgement, PresenceKind, PresencePerceptionKind, PresenceProfile,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PresenceState {
    pub profile: PresenceProfile,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_scene: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub perceived_by: Option<Vec<String>>,
}

impl Default for PresenceState {
    fn default() -> Self {
        Self {
            profile: PresenceProfile {
                kind: PresenceKind::InvisibleObserver,
                perception: PresencePerceptionKind::Unnoticed,
                acknowledgement: NarrativeAcknowledgement::None,
                can_be_addressed: false,
                can_change_relationships: false,
                can_be_remembered: false,
            },
            current_scene: None,
            perceived_by: None,
        }
    }
}
