use crate::scene_semantics_engine::types::{SceneMood, SceneSemanticKind, SceneTensionLevel};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SceneSemanticState {
    pub scene_id: String,
    pub semantic: SceneSemanticKind,
    pub tension: SceneTensionLevel,
    pub mood: SceneMood,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct SceneSemanticStateStore {
    pub items: Vec<SceneSemanticState>,
}

impl SceneSemanticStateStore {
    pub fn get(&self, scene_id: &str) -> Option<&SceneSemanticState> {
        self.items.iter().find(|x| x.scene_id == scene_id)
    }

    pub fn get_mut(&mut self, scene_id: &str) -> Option<&mut SceneSemanticState> {
        self.items.iter_mut().find(|x| x.scene_id == scene_id)
    }
}
