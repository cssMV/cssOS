use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneInput {
    pub id: u32,
    pub section_type: Option<String>,
    pub style_hint: Option<String>,
    pub visual_script: String,
    pub duration_secs: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderOptions {
    pub prefer_local: bool,
    pub allow_external: bool,
    pub external_provider: Option<String>,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
}

impl Default for RenderOptions {
    fn default() -> Self {
        Self {
            prefer_local: true,
            allow_external: false,
            external_provider: None,
            width: 1280,
            height: 720,
            fps: 12,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderResult {
    pub scene_id: u32,
    pub backend: String,
    pub output_path: String,
}
