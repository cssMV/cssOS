use crate::event_engine::types::{EngineEvent, EventKind};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventRouteTarget {
    StoryEngine,
    SceneScheduler,
    InteractionEngine,
    CharacterEngine,
    DialogueEngine,
    RelationshipEngine,
    EmotionEngine,
    MemoryEngine,
    WorldEngine,
    ObjectEngine,
    PhysicsEngine,
    NavigationEngine,
    CameraEngine,
    ImmersionEngine,
    PresenceEngine,
    SceneSemanticsEngine,
}

pub fn route_event(ev: &EngineEvent) -> Vec<EventRouteTarget> {
    match ev.kind {
        EventKind::InteractionReceived => vec![EventRouteTarget::InteractionEngine],
        EventKind::IntentResolved => vec![
            EventRouteTarget::StoryEngine,
            EventRouteTarget::CharacterEngine,
            EventRouteTarget::DialogueEngine,
        ],
        EventKind::DialogueResponded => vec![
            EventRouteTarget::MemoryEngine,
            EventRouteTarget::EmotionEngine,
            EventRouteTarget::RelationshipEngine,
        ],
        EventKind::ObjectChanged => vec![
            EventRouteTarget::WorldEngine,
            EventRouteTarget::NavigationEngine,
            EventRouteTarget::StoryEngine,
        ],
        EventKind::StoryNodeEntered => vec![
            EventRouteTarget::SceneScheduler,
            EventRouteTarget::CameraEngine,
            EventRouteTarget::SceneSemanticsEngine,
            EventRouteTarget::ImmersionEngine,
            EventRouteTarget::PresenceEngine,
        ],
        EventKind::SceneSemanticsUpdated => vec![
            EventRouteTarget::CameraEngine,
            EventRouteTarget::DialogueEngine,
            EventRouteTarget::ImmersionEngine,
        ],
        _ => vec![],
    }
}
