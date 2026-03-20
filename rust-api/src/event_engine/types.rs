use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventDomain {
    Story,
    Scene,
    Interaction,
    Character,
    Dialogue,
    Relationship,
    Emotion,
    Memory,
    World,
    Object,
    Physics,
    Navigation,
    Camera,
    Immersion,
    Presence,
    Semantics,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventKind {
    StoryNodeEntered,
    StoryBranchResolved,
    SceneActivated,
    SceneCompleted,
    InteractionReceived,
    IntentResolved,
    CharacterActionRequested,
    CharacterActionResolved,
    DialogueRequested,
    DialogueResponded,
    RelationshipChanged,
    EmotionChanged,
    MemoryWritten,
    WorldChanged,
    ObjectChanged,
    PhysicsMoved,
    NavigationPlanned,
    CameraPlanned,
    ImmersionChanged,
    PresenceChanged,
    SceneSemanticsUpdated,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Default)]
pub struct EventId(pub String);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct EventMeta {
    pub ts: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scene_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub actor_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub target_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EngineEvent {
    pub id: EventId,
    pub domain: EventDomain,
    pub kind: EventKind,
    pub meta: EventMeta,
    #[serde(default)]
    pub payload: serde_json::Value,
}
