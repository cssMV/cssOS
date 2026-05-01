use anyhow::Result;

use super::router::VideoBackend;
use super::types::{RenderOptions, RenderResult, SceneInput};

pub struct LocalVideoBackend {
    pub api_key: String,
}

impl LocalVideoBackend {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }
}

impl VideoBackend for LocalVideoBackend {
    fn name(&self) -> &'static str {
        "local"
    }

    fn render_scene(&self, scene: &SceneInput, _options: &RenderOptions) -> Result<RenderResult> {
        let output_path = crate::video::render_local::render_scene_local(&self.api_key, scene)?;
        Ok(RenderResult {
            scene_id: scene.id,
            backend: self.name().to_string(),
            output_path,
        })
    }

    fn is_available(&self) -> bool {
        true
    }
}
