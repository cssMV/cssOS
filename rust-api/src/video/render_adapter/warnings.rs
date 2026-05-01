use serde::{Deserialize, Serialize};

use super::scene_spec::SceneRenderSpec;
use super::thumbnail::ThumbnailRenderSpec;
use super::types::RenderAdapterInput;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderWarning {
    pub scope: String,
    pub scene_id: Option<u32>,
    pub level: String,
    pub message: String,
}

pub fn collect_warnings(
    input: &RenderAdapterInput,
    scene_specs: &[SceneRenderSpec],
    thumbnail_spec: &ThumbnailRenderSpec,
) -> Vec<RenderWarning> {
    let mut warnings = Vec::new();
    for scene in &input.scenes {
        if !input
            .director_plan
            .scene_directions
            .iter()
            .any(|item| item.scene_id == scene.id)
        {
            warnings.push(RenderWarning {
                scope: "scene".to_string(),
                scene_id: Some(scene.id),
                level: "warn".to_string(),
                message: "missing director data; fallback camera rules applied".to_string(),
            });
        }
        if !input
            .memory_plan
            .scene_memories
            .iter()
            .any(|item| item.scene_id == scene.id)
        {
            warnings.push(RenderWarning {
                scope: "scene".to_string(),
                scene_id: Some(scene.id),
                level: "warn".to_string(),
                message: "missing memory data; continuity tokens downgraded".to_string(),
            });
        }
        if scene.entities.characters.iter().any(|character| {
            !input
                .character_lock
                .profiles
                .iter()
                .any(|profile| profile.id == *character)
        }) {
            warnings.push(RenderWarning {
                scope: "scene".to_string(),
                scene_id: Some(scene.id),
                level: "warn".to_string(),
                message: "character lock missing for one or more scene characters".to_string(),
            });
        }
    }
    if input.thumbnail.enabled && thumbnail_spec.scene_ids.is_empty() {
        warnings.push(RenderWarning {
            scope: "project".to_string(),
            scene_id: None,
            level: "warn".to_string(),
            message: "thumbnail enabled but no candidate scenes were selected".to_string(),
        });
    }
    for spec in scene_specs {
        if spec.continuity_tokens.is_empty() {
            warnings.push(RenderWarning {
                scope: "scene".to_string(),
                scene_id: Some(spec.scene_id),
                level: "info".to_string(),
                message: "scene spec has weak continuity signals".to_string(),
            });
        }
    }
    warnings.extend(
        input
            .memory_plan
            .warnings
            .iter()
            .map(|warning| RenderWarning {
                scope: "scene".to_string(),
                scene_id: Some(warning.scene_id),
                level: warning.level.clone(),
                message: warning.message.clone(),
            }),
    );
    warnings
}
