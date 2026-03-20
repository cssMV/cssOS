use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq)]
pub struct RuntimeUpdate {
    #[serde(default)]
    pub emitted_events: Vec<crate::event_engine::types::EngineEvent>,
    #[serde(default)]
    pub logs: Vec<String>,
}

impl RuntimeUpdate {
    pub fn merge(&mut self, other: RuntimeUpdate) {
        self.emitted_events.extend(other.emitted_events);
        self.logs.extend(other.logs);
    }
}
