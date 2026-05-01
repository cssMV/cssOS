use std::fs;
use std::path::{Path, PathBuf};

use anyhow::Result;

use crate::video::ShotPlan;
use crate::video::consistency::CharacterContinuityMemory;
use crate::video::consistency::NormalizedStyleProfile;
use crate::video::contracts::{
    ArcTimelineBeat, DirectorGuidance, QualityProfile, SceneEntities, SceneInput, StyleProfile,
    ThumbnailRequest, ThumbnailResult,
};
use crate::video::error::VideoEngineError;
use crate::video::scene_renderer::render_dynamic_video;

#[derive(Debug, Clone)]
pub struct ThumbnailGenerator {
    ffmpeg_bin: String,
    ffprobe_bin: String,
}

impl Default for ThumbnailGenerator {
    fn default() -> Self {
        Self::new()
    }
}

impl ThumbnailGenerator {
    pub fn new() -> Self {
        Self {
            ffmpeg_bin: "ffmpeg".to_string(),
            ffprobe_bin: "ffprobe".to_string(),
        }
    }

    pub fn generate(
        &self,
        request: &ThumbnailRequest,
        scenes: &[SceneInput],
        style: &NormalizedStyleProfile,
        output_dir: &Path,
    ) -> Result<ThumbnailResult> {
        if !request.enabled {
            return Ok(ThumbnailResult {
                enabled: false,
                generated: false,
                video_path: None,
                duration_secs: None,
                source_scene_ids: Vec::new(),
            });
        }

        if !(3.0..=5.0).contains(&request.duration_secs) {
            return Err(VideoEngineError::InvalidThumbnailDuration {
                requested_secs: request.duration_secs,
            }
            .into());
        }

        let selected = pick_representative_scenes(scenes);
        let combined_script = selected
            .iter()
            .map(|scene| scene.visual_script.as_str())
            .collect::<Vec<_>>()
            .join(" | ");

        fs::create_dir_all(output_dir)?;
        let output_path = output_dir.join("thumbnail.mp4");
        let thumbnail_scene = SceneInput {
            id: 0,
            section_type: "thumbnail".to_string(),
            text_block: "thumbnail montage".to_string(),
            visual_script: combined_script.clone(),
            duration_secs: request.duration_secs,
            entities: SceneEntities::default(),
            reference_media_paths: selected
                .iter()
                .flat_map(|scene| scene.reference_media_paths.iter().cloned())
                .collect(),
            director: Some(DirectorGuidance {
                emotional_beat: Some("peak".to_string()),
                energy_profile: Some("high".to_string()),
                shot_type: Some("wide".to_string()),
                camera_move: Some("glide".to_string()),
                camera_language: Some(style.camera_language.clone()),
                director_notes: vec!["thumbnail highlight reel".to_string()],
            }),
            quality: Some(QualityProfile {
                motion_intensity: Some(0.82),
                cut_density: Some(0.78),
                continuity_priority: Some(0.7),
                performance_focus: Some(0.66),
                chorus_impact: Some(0.9),
                avoid_static_frames: Some(true),
            }),
        };
        let thumbnail_shot = ShotPlan {
            scene_id: 0,
            shot_size: "wide".to_string(),
            shot_distance_preference: "wide_ensemble".to_string(),
            ensemble_mode: "group".to_string(),
            movement: "glide".to_string(),
            pacing: "surging".to_string(),
            lens_profile: "28mm".to_string(),
            director_intent: "thumbnail peak montage".to_string(),
            motion_intensity: 0.82,
            transition_style: "flash-cut".to_string(),
            transition_secs: 0.18,
            motif_target_scene_id: None,
            motif_callback_style: "impact-hook".to_string(),
            relationship_arc: "scatter_to_center".to_string(),
        };
        let thumbnail_timeline = ArcTimelineBeat {
            scene_id: 0,
            section_role: "chorus".to_string(),
            sequence_index: 1,
            start_secs: 0.0,
            end_secs: request.duration_secs,
            progress_ratio: 0.5,
            energy_phase: "main_explosion".to_string(),
            explosion_rank: 1,
            is_primary_explosion: true,
            is_secondary_explosion: false,
            is_aftershock: false,
            is_resolution: false,
            impact_weight: 1.0,
            stability_weight: 0.62,
        };
        let thumbnail_continuity = CharacterContinuityMemory {
            recurring_characters: Vec::new(),
            focal_character: None,
            anchor_location: None,
            anchor_prop: None,
            framing_stability: 0.62,
            composition_preference: "hero_center".to_string(),
            shot_distance_preference: "wide_ensemble".to_string(),
            ensemble_mode: "group".to_string(),
            focal_center_bias: 0.48,
            relationship_mode: "ensemble-led".to_string(),
            formation_balance: 0.72,
            protagonist_priority: 0.72,
        };
        render_dynamic_video(
            &self.ffmpeg_bin,
            &self.ffprobe_bin,
            &output_path,
            request.duration_secs,
            style.consistency_seed ^ 0xA11CE5EED,
            &thumbnail_scene,
            &thumbnail_timeline,
            None,
            None,
            &thumbnail_continuity,
            &StyleProfile {
                genre: style.genre.clone(),
                color_palette: Some(style.color_palette.clone()),
                visual_tone: Some(style.visual_tone.clone()),
                camera_language: Some(style.camera_language.clone()),
                quality_profile: Some(QualityProfile {
                    motion_intensity: Some(0.82),
                    cut_density: Some(0.78),
                    continuity_priority: Some(0.7),
                    performance_focus: Some(0.66),
                    chorus_impact: Some(0.9),
                    avoid_static_frames: Some(true),
                }),
            },
            &thumbnail_shot,
            &combined_script,
            &style.visual_tone,
            "thumbnail generator",
            854,
            480,
        )?;

        Ok(ThumbnailResult {
            enabled: true,
            generated: true,
            video_path: Some(path_to_string(&output_path)),
            duration_secs: Some(request.duration_secs),
            source_scene_ids: selected.iter().map(|scene| scene.id).collect(),
        })
    }
}

fn pick_representative_scenes(scenes: &[SceneInput]) -> Vec<&SceneInput> {
    let mut refs: Vec<&SceneInput> = scenes.iter().collect();
    refs.sort_by(|left, right| {
        right
            .duration_secs
            .partial_cmp(&left.duration_secs)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(left.id.cmp(&right.id))
    });
    refs.into_iter().take(2).collect()
}

fn path_to_string(path: &PathBuf) -> String {
    path.to_string_lossy().to_string()
}
