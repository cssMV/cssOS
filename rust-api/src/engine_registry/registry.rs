use std::collections::BTreeMap;

use crate::engine_registry::types::*;

#[derive(Debug, Clone, Default)]
pub struct EngineRegistry {
    items: BTreeMap<EngineId, EngineDescriptor>,
}

impl EngineRegistry {
    pub fn new() -> Self {
        Self {
            items: BTreeMap::new(),
        }
    }

    pub fn register(&mut self, desc: EngineDescriptor) {
        self.items.insert(desc.id.clone(), desc);
    }

    pub fn get(&self, id: &EngineId) -> Option<&EngineDescriptor> {
        self.items.get(id)
    }

    pub fn list(&self) -> Vec<&EngineDescriptor> {
        self.items.values().collect()
    }

    pub fn list_by_name_version(
        &self,
        name: &EngineName,
        version: &EngineVersion,
    ) -> Vec<&EngineDescriptor> {
        self.items
            .values()
            .filter(|x| &x.id.name == name && &x.id.version == version)
            .collect()
    }

    pub fn list_publicly_selectable(&self) -> Vec<&EngineDescriptor> {
        self.items
            .values()
            .filter(|x| x.publicly_selectable)
            .collect()
    }
}
