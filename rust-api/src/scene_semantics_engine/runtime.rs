use crate::scene_semantics_engine::planner::{plan_scene_semantics, SceneSemanticPlanningInput};
use crate::scene_semantics_engine::state::{SceneSemanticState, SceneSemanticStateStore};

#[derive(Debug, Clone)]
pub struct SceneSemanticsEngine {
    pub state: SceneSemanticStateStore,
}

impl SceneSemanticsEngine {
    pub fn new(state: SceneSemanticStateStore) -> Self {
        Self { state }
    }

    pub fn set_scene_semantics(&mut self, scene: SceneSemanticState) {
        if let Some(existing) = self.state.get_mut(&scene.scene_id) {
            *existing = scene;
            return;
        }
        self.state.items.push(scene);
    }

    pub fn plan_and_set(&mut self, input: SceneSemanticPlanningInput) {
        let out = plan_scene_semantics(&input);
        self.set_scene_semantics(out);
    }
}

#[cfg(test)]
mod tests {
    use crate::scene_semantics_engine::planner::{
        plan_scene_semantics, SceneSemanticPlanningInput,
    };
    use crate::scene_semantics_engine::types::{SceneMood, SceneSemanticKind, SceneTensionLevel};

    #[test]
    fn v141_confession_tags_plan_romantic_confession_scene() {
        let out = plan_scene_semantics(&SceneSemanticPlanningInput {
            scene_id: "scene_confession_rooftop".into(),
            tags: vec!["confession".into(), "love".into()],
            dominant_relationship: None,
            dominant_emotion: None,
        });

        assert_eq!(out.semantic, SceneSemanticKind::Confession);
        assert_eq!(out.tension, SceneTensionLevel::Soft);
        assert_eq!(out.mood, SceneMood::Romantic);
    }
}
