use crate::event_engine::bus::EventBus;
use crate::event_engine::routing::{route_event, EventRouteTarget};
use crate::event_engine::types::{EngineEvent, EventId, EventMeta};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct RoutedEvent {
    pub event_id: String,
    #[serde(default)]
    pub targets: Vec<EventRouteTarget>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct EventEngineState {
    #[serde(default)]
    pub history: Vec<EngineEvent>,
    #[serde(default)]
    pub last_routed: Vec<RoutedEvent>,
}

pub struct EventEngine {
    pub bus: EventBus,
}

impl EventEngine {
    pub fn new() -> Self {
        Self {
            bus: EventBus::default(),
        }
    }

    pub fn publish(&mut self, ev: EngineEvent) {
        self.bus.publish(ev);
    }

    pub fn publish_simple(
        &mut self,
        id: impl Into<String>,
        domain: crate::event_engine::types::EventDomain,
        kind: crate::event_engine::types::EventKind,
        meta: EventMeta,
        payload: serde_json::Value,
    ) {
        self.publish(EngineEvent {
            id: EventId(id.into()),
            domain,
            kind,
            meta,
            payload,
        });
    }

    pub fn drain_once(&mut self) -> Vec<EngineEvent> {
        let mut emitted = Vec::new();
        while let Some(ev) = self.bus.pop() {
            let _targets = route_event(&ev);
            emitted.push(ev);
        }
        emitted
    }

    pub fn snapshot(&self) -> EventEngineState {
        let last_routed = self
            .bus
            .history
            .iter()
            .map(|ev| RoutedEvent {
                event_id: ev.id.0.clone(),
                targets: route_event(ev),
            })
            .collect();
        EventEngineState {
            history: self.bus.history.clone(),
            last_routed,
        }
    }
}

#[cfg(test)]
mod tests {
    use crate::event_engine::routing::{route_event, EventRouteTarget};
    use crate::event_engine::runtime::EventEngine;
    use crate::event_engine::types::{EngineEvent, EventDomain, EventId, EventKind, EventMeta};

    fn ev(id: &str, domain: EventDomain, kind: EventKind) -> EngineEvent {
        EngineEvent {
            id: EventId(id.to_string()),
            domain,
            kind,
            meta: EventMeta {
                ts: "2026-03-12T00:00:00Z".into(),
                scene_id: None,
                branch_id: None,
                actor_id: None,
                target_id: None,
            },
            payload: serde_json::json!({}),
        }
    }

    #[test]
    fn v142_event_bus_queue_history_and_routes_work() {
        let mut engine = EventEngine::new();
        let ev1 = ev(
            "ev_1",
            EventDomain::Interaction,
            EventKind::InteractionReceived,
        );
        let ev2 = ev("ev_2", EventDomain::Interaction, EventKind::IntentResolved);
        let ev3 = ev("ev_3", EventDomain::Story, EventKind::StoryNodeEntered);

        engine.publish(ev1.clone());
        engine.publish(ev2.clone());
        engine.publish(ev3.clone());

        assert_eq!(engine.bus.queue.len(), 3);
        assert_eq!(engine.bus.all().len(), 3);

        let drained = engine.drain_once();
        assert_eq!(drained.len(), 3);
        assert!(engine.bus.queue.is_empty());

        assert_eq!(route_event(&ev1), vec![EventRouteTarget::InteractionEngine]);
        assert_eq!(
            route_event(&ev2),
            vec![
                EventRouteTarget::StoryEngine,
                EventRouteTarget::CharacterEngine,
                EventRouteTarget::DialogueEngine
            ]
        );
        assert_eq!(
            route_event(&ev3),
            vec![
                EventRouteTarget::SceneScheduler,
                EventRouteTarget::CameraEngine,
                EventRouteTarget::SceneSemanticsEngine,
                EventRouteTarget::ImmersionEngine,
                EventRouteTarget::PresenceEngine
            ]
        );
    }
}
