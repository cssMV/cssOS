use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PresenceKind {
    None,
    InvisibleObserver,
    VisibleObserver,
    Witness,
    Companion,
    Participant,
    DiegeticCharacter,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PresencePerceptionKind {
    Unnoticed,
    Sensed,
    Seen,
    Addressed,
    Integrated,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NarrativeAcknowledgement {
    None,
    Implicit,
    Explicit,
    Structural,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PresenceProfile {
    pub kind: PresenceKind,
    pub perception: PresencePerceptionKind,
    pub acknowledgement: NarrativeAcknowledgement,

    #[serde(default)]
    pub can_be_addressed: bool,

    #[serde(default)]
    pub can_change_relationships: bool,

    #[serde(default)]
    pub can_be_remembered: bool,
}
