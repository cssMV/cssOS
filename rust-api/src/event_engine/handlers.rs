use crate::event_engine::types::EngineEvent;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct EventHandleResult {
    #[serde(default)]
    pub emitted: Vec<EngineEvent>,
}

pub trait EventHandler {
    fn handle_event(&mut self, ev: &EngineEvent) -> EventHandleResult;
}
