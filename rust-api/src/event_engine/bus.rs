use crate::event_engine::types::EngineEvent;

#[derive(Debug, Clone, Default)]
pub struct EventBus {
    pub queue: Vec<EngineEvent>,
    pub history: Vec<EngineEvent>,
}

impl EventBus {
    pub fn publish(&mut self, ev: EngineEvent) {
        self.queue.push(ev.clone());
        self.history.push(ev);
    }

    pub fn pop(&mut self) -> Option<EngineEvent> {
        if self.queue.is_empty() {
            None
        } else {
            Some(self.queue.remove(0))
        }
    }

    pub fn all(&self) -> &[EngineEvent] {
        &self.history
    }
}
