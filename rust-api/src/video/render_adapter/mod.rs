pub mod composition;
pub mod prompt;
pub mod scene_spec;
pub mod thumbnail;
pub mod types;
pub mod warnings;

pub use composition::{build_composition_hints, CompositionRenderHints};
pub use scene_spec::{build_scene_spec, SceneRenderSpec};
pub use thumbnail::{build_thumbnail_spec, ThumbnailRenderSpec};
pub use types::*;
pub use warnings::{collect_warnings, RenderWarning};

use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderPlan {
    pub thumbnail_spec: ThumbnailRenderSpec,
    pub scene_specs: Vec<SceneRenderSpec>,
    pub composition_hints: CompositionRenderHints,
    pub warnings: Vec<RenderWarning>,
}

pub fn build_render_plan(input: RenderAdapterInput) -> Result<RenderPlan> {
    let thumbnail_spec = build_thumbnail_spec(&input)?;
    let mut scene_specs = Vec::with_capacity(input.scenes.len());
    for scene in &input.scenes {
        scene_specs.push(build_scene_spec(&input, scene)?);
    }
    let composition_hints = build_composition_hints(&input);
    let warnings = collect_warnings(&input, &scene_specs, &thumbnail_spec);
    Ok(RenderPlan {
        thumbnail_spec,
        scene_specs,
        composition_hints,
        warnings,
    })
}
