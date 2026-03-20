use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ImmersionMode {
    FlatScreen,
    Cinema3d,
    Immersive360,
    SpatialObserver,
    SpatialParticipant,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PresenceRole {
    InvisibleObserver,
    Witness,
    Companion,
    Participant,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum ImmersionConstraintLevel {
    Strict,
    Guided,
    Open,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PresenceAnchor {
    pub scene_id: String,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub location_id: Option<String>,

    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub near_character_id: Option<String>,
}
