use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SceneSemanticKind {
    Introduction,
    Exploration,
    Confession,
    Romance,
    Conflict,
    Betrayal,
    Suspense,
    Revelation,
    Escape,
    Chase,
    Mourning,
    Decision,
    Resolution,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SceneTensionLevel {
    Calm,
    Soft,
    Uncertain,
    Tense,
    Critical,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SceneMood {
    Warm,
    Lonely,
    Romantic,
    Fearful,
    Hostile,
    Hopeful,
    Tragic,
    Sacred,
    Mysterious,
    Urgent,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SceneCameraHint {
    Cinematic,
    DialogueTwoShot,
    OverShoulder,
    FollowCharacter,
    WideScene,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SceneSemanticDef {
    pub scene_id: String,
    pub semantic: SceneSemanticKind,
    pub tension: SceneTensionLevel,
    pub mood: SceneMood,
    #[serde(default)]
    pub tags: Vec<String>,
}
