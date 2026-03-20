use crate::immersion_engine::types::{
    ImmersionConstraintLevel, ImmersionMode, PresenceAnchor, PresenceRole,
};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ImmersionState {
    pub mode: ImmersionMode,
    pub presence_role: PresenceRole,
    pub constraint_level: ImmersionConstraintLevel,
    pub anchor: PresenceAnchor,

    #[serde(default)]
    pub inside_story_world: bool,

    #[serde(default)]
    pub can_move_freely: bool,

    #[serde(default)]
    pub can_affect_story: bool,
}

impl Default for ImmersionState {
    fn default() -> Self {
        Self {
            mode: ImmersionMode::FlatScreen,
            presence_role: PresenceRole::InvisibleObserver,
            constraint_level: ImmersionConstraintLevel::Strict,
            anchor: PresenceAnchor {
                scene_id: "unknown".into(),
                location_id: None,
                near_character_id: None,
            },
            inside_story_world: false,
            can_move_freely: false,
            can_affect_story: false,
        }
    }
}
