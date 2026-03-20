use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeMode {
    PassivePlayback,
    InteractiveFilm,
    SpatialFilm,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeTickReason {
    Frame,
    EventDriven,
    UserInteraction,
    SceneTransition,
    StoryAdvance,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeStatus {
    Initializing,
    Running,
    Paused,
    Completed,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeConfig {
    pub mode: RuntimeMode,
    #[serde(default)]
    pub fixed_tick_ms: u64,
    #[serde(default)]
    pub preserve_story_focus: bool,
    #[serde(default)]
    pub allow_spatial_interaction: bool,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            mode: RuntimeMode::InteractiveFilm,
            fixed_tick_ms: 33,
            preserve_story_focus: true,
            allow_spatial_interaction: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeCameraMode {
    Cinematic,
    DialogueTwoShot,
    OverShoulder,
    FollowCharacter,
    WideScene,
}
