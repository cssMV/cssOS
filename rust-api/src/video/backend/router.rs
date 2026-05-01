use anyhow::{anyhow, Result};

use super::external::ExternalVideoBackend;
use super::local::LocalVideoBackend;
use super::types::{RenderOptions, RenderResult, SceneInput};

pub trait VideoBackend: Send + Sync {
    fn name(&self) -> &'static str;
    fn render_scene(&self, scene: &SceneInput, options: &RenderOptions) -> Result<RenderResult>;
    fn is_available(&self) -> bool;
}

pub struct VideoRouter {
    local: LocalVideoBackend,
    external: Option<ExternalVideoBackend>,
}

impl VideoRouter {
    pub fn new(local: LocalVideoBackend, external: Option<ExternalVideoBackend>) -> Self {
        Self { local, external }
    }

    pub fn render_scene(
        &self,
        scene: &SceneInput,
        options: &RenderOptions,
    ) -> Result<RenderResult> {
        if options.prefer_local || !options.allow_external {
            return self.local.render_scene(scene, options);
        }

        if let Some(external) = &self.external {
            if external.is_available() {
                if let Ok(result) = external.render_scene(scene, options) {
                    return Ok(result);
                }
            }
        }

        self.local.render_scene(scene, options)
    }

    pub fn render_all(
        &self,
        scenes: &[SceneInput],
        options: &RenderOptions,
    ) -> Result<Vec<RenderResult>> {
        let mut results = Vec::with_capacity(scenes.len());
        for scene in scenes {
            results.push(self.render_scene(scene, options)?);
        }
        if results.is_empty() {
            return Err(anyhow!("no scene rendered"));
        }
        Ok(results)
    }
}
