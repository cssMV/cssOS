use anyhow::{bail, Result};

use super::router::VideoBackend;
use super::types::{RenderOptions, RenderResult, SceneInput};

pub struct ExternalVideoBackend {
    pub provider: String,
    pub enabled: bool,
}

impl ExternalVideoBackend {
    pub fn new(provider: impl Into<String>, enabled: bool) -> Self {
        Self {
            provider: provider.into(),
            enabled,
        }
    }
}

impl VideoBackend for ExternalVideoBackend {
    fn name(&self) -> &'static str {
        "external"
    }

    fn render_scene(&self, scene: &SceneInput, _options: &RenderOptions) -> Result<RenderResult> {
        bail!(
            "external provider '{}' is reserved only and currently disabled for scene {}",
            self.provider,
            scene.id
        )
    }

    fn is_available(&self) -> bool {
        self.enabled
    }
}
