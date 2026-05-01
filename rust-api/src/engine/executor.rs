use anyhow::{anyhow, Context, Result};

use crate::engine::context::ContentContext;
use crate::engine::pipeline::PipelineStep;
use crate::video::backend::{
    external::ExternalVideoBackend, local::LocalVideoBackend, router::VideoRouter, RenderOptions,
};
use crate::video::composer::compose_mv;
use crate::video::consistency::{build_character_profiles, normalize_style, plan_shots};
use crate::video::render_adapter::{
    build_render_plan, CharacterLockLite, CharacterProfileLite, DirectorPlanLite,
    HighlightPlanLite, MemoryPlanLite, RenderAdapterInput, SceneCharacterPromptLite,
    SceneDirectionLite, SceneMemoryLite, TransitionDirectiveLite,
};
use crate::video::scene_renderer::render_scene_video;
use crate::video::types::{ProjectInput, SceneRenderPlan};

pub struct DirectorStep;
pub struct MemoryStep;
pub struct CharacterStep;
pub struct RenderAdapterStep;
pub struct RenderStep;
pub struct ComposeStep;

impl PipelineStep for DirectorStep {
    fn name(&self) -> &'static str {
        "Director"
    }

    fn execute(&self, ctx: &mut ContentContext) -> Result<()> {
        if ctx.director_plan.is_some() {
            return Ok(());
        }
        let style = normalize_style(&ctx.style_profile);
        let shots = plan_shots(&ctx.scenes, &style);
        let scene_directions = ctx
            .scenes
            .iter()
            .map(|scene| {
                let shot = shots.iter().find(|plan| plan.scene_id == scene.id);
                SceneDirectionLite {
                    scene_id: scene.id,
                    emotion: scene.section_type.clone(),
                    emotion_intensity: if scene.section_type.eq_ignore_ascii_case("chorus") {
                        0.9
                    } else {
                        0.65
                    },
                    narrative_role: scene.section_type.clone(),
                    rhythm_density: if scene.section_type.eq_ignore_ascii_case("bridge") {
                        "contrast".to_string()
                    } else {
                        "steady".to_string()
                    },
                    recommended_shot_changes: if scene.duration_secs > 10.0 { 2 } else { 1 },
                    camera_hint: shot
                        .map(|item| format!("{:?}", item.primary_shot).to_ascii_lowercase())
                        .unwrap_or_else(|| "medium".to_string()),
                    motion_hint: shot
                        .map(|item| item.motion_hint.clone())
                        .unwrap_or_else(|| "motivated movement".to_string()),
                    visual_focus: scene
                        .entities
                        .location
                        .clone()
                        .unwrap_or_else(|| "lead subject".to_string()),
                    priority: if scene.section_type.eq_ignore_ascii_case("chorus") {
                        1.0
                    } else {
                        0.7
                    },
                }
            })
            .collect::<Vec<_>>();
        let transition_plan = ctx
            .scenes
            .windows(2)
            .map(|pair| TransitionDirectiveLite {
                from_scene_id: pair[0].id,
                to_scene_id: pair[1].id,
                transition: "motivated-cut".to_string(),
                reason: "default sequential transition".to_string(),
            })
            .collect::<Vec<_>>();
        let highlight_plan = HighlightPlanLite {
            hero_scene_ids: ctx.scenes.iter().take(2).map(|scene| scene.id).collect(),
            thumbnail_candidate_scene_ids: ctx
                .scenes
                .iter()
                .take(3)
                .map(|scene| scene.id)
                .collect(),
            climax_scene_ids: ctx
                .scenes
                .iter()
                .filter(|scene| scene.section_type.eq_ignore_ascii_case("chorus"))
                .map(|scene| scene.id)
                .collect(),
        };
        ctx.director_plan = Some(DirectorPlanLite {
            scene_directions,
            transition_plan,
            highlight_plan,
        });
        Ok(())
    }
}

impl PipelineStep for MemoryStep {
    fn name(&self) -> &'static str {
        "Memory"
    }

    fn execute(&self, ctx: &mut ContentContext) -> Result<()> {
        if ctx.memory_plan.is_some() {
            return Ok(());
        }
        let scene_memories = ctx
            .scenes
            .iter()
            .enumerate()
            .map(|(index, scene)| SceneMemoryLite {
                scene_id: scene.id,
                inherited_from_scene_id: index.checked_sub(1).map(|i| ctx.scenes[i].id),
                story_phase: scene.section_type.clone(),
                memory_summary: scene.visual_script.clone(),
                active_characters: scene
                    .entities
                    .characters
                    .iter()
                    .map(
                        |character| crate::video::render_adapter::CharacterStateLite {
                            character_id: character.clone(),
                            emotional_state: Some(scene.section_type.clone()),
                            physical_state: None,
                            wardrobe_state: None,
                            action_state: Some("performing".to_string()),
                        },
                    )
                    .collect(),
                active_location: scene.entities.location.as_ref().map(|location| {
                    crate::video::render_adapter::LocationStateLite {
                        location_id: location.clone(),
                        atmosphere: Some("cinematic".to_string()),
                        time_of_day: None,
                        weather: None,
                        damage_state: None,
                    }
                }),
                active_props: scene
                    .entities
                    .props
                    .iter()
                    .map(|prop| crate::video::render_adapter::PropStateLite {
                        prop_id: prop.clone(),
                        owner: None,
                        condition: None,
                        relevance: Some("active".to_string()),
                    })
                    .collect(),
            })
            .collect();
        ctx.memory_plan = Some(MemoryPlanLite {
            scene_memories,
            carry_over_bindings: Vec::new(),
            warnings: Vec::new(),
        });
        Ok(())
    }
}

impl PipelineStep for CharacterStep {
    fn name(&self) -> &'static str {
        "CharacterLock"
    }

    fn execute(&self, ctx: &mut ContentContext) -> Result<()> {
        if ctx.character_lock.is_some() {
            return Ok(());
        }
        let profiles = build_character_profiles(&ctx.scenes)
            .into_iter()
            .map(|profile| CharacterProfileLite {
                id: profile.id,
                base_prompt: format!(
                    "{} {}",
                    profile.display_name,
                    profile
                        .outfit
                        .unwrap_or_else(|| "signature look".to_string())
                ),
                anchor_images: Vec::new(),
            })
            .collect::<Vec<_>>();
        let scene_prompts = ctx
            .scenes
            .iter()
            .map(|scene| SceneCharacterPromptLite {
                scene_id: scene.id,
                prompts: scene
                    .entities
                    .characters
                    .iter()
                    .map(|character| format!("same character {}, consistent wardrobe", character))
                    .collect(),
            })
            .collect::<Vec<_>>();
        ctx.character_lock = Some(CharacterLockLite {
            profiles,
            scene_prompts,
        });
        Ok(())
    }
}

impl PipelineStep for RenderAdapterStep {
    fn name(&self) -> &'static str {
        "RenderAdapter"
    }

    fn execute(&self, ctx: &mut ContentContext) -> Result<()> {
        let input = RenderAdapterInput {
            project_id: ctx.project_id.clone(),
            project_prompt: ctx.prompt.clone(),
            music: crate::video::render_adapter::MusicInput {
                audio_path: ctx.music_path.clone(),
                duration_secs: ctx.music_duration_secs,
            },
            thumbnail: crate::video::render_adapter::ThumbnailInput {
                enabled: ctx.thumbnail.enabled,
                duration_secs: ctx.thumbnail.duration_secs,
            },
            scenes: ctx
                .scenes
                .iter()
                .map(|scene| crate::video::render_adapter::SceneInput {
                    id: scene.id,
                    section_type: scene.section_type.clone(),
                    text_block: scene.text_block.clone(),
                    visual_script: scene.visual_script.clone(),
                    duration_secs: scene.duration_secs,
                    entities: crate::video::render_adapter::SceneEntities {
                        characters: scene.entities.characters.clone(),
                        location: scene.entities.location.clone(),
                        props: scene.entities.props.clone(),
                    },
                })
                .collect(),
            director_plan: ctx
                .director_plan
                .clone()
                .context("director plan missing before render adapter")?,
            memory_plan: ctx
                .memory_plan
                .clone()
                .context("memory plan missing before render adapter")?,
            character_lock: ctx
                .character_lock
                .clone()
                .context("character lock missing before render adapter")?,
            style_profile: crate::video::render_adapter::ProjectStyleInput {
                genre: ctx.style_profile.genre.clone(),
                color_palette: ctx.style_profile.color_palette.clone(),
                visual_tone: ctx.style_profile.visual_tone.clone(),
                camera_language: ctx.style_profile.camera_language.clone(),
            },
        };
        ctx.render_plan = Some(build_render_plan(input)?);
        Ok(())
    }
}

impl PipelineStep for RenderStep {
    fn name(&self) -> &'static str {
        "Render"
    }

    fn execute(&self, ctx: &mut ContentContext) -> Result<()> {
        let render_plan = ctx
            .render_plan
            .as_ref()
            .context("render plan missing before render step")?;
        let api_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
        let local_backend = LocalVideoBackend::new(api_key);
        let external_backend = Some(ExternalVideoBackend::new("reserved", false));
        let router = VideoRouter::new(local_backend, external_backend);
        let backend_options = RenderOptions::default();
        let character_profiles = build_character_profiles(&ctx.scenes);
        let style_profile = normalize_style(&ctx.style_profile);
        let output_root = crate::video::thumbnail::project_output_root(&ctx.project_id)?;
        std::fs::create_dir_all(output_root.join("scenes"))?;
        let mut outputs = Vec::with_capacity(ctx.scenes.len());

        for scene in &ctx.scenes {
            let spec = render_plan
                .scene_specs
                .iter()
                .find(|spec| spec.scene_id == scene.id)
                .ok_or_else(|| anyhow!("missing scene spec for scene {}", scene.id))?;
            let plan = SceneRenderPlan {
                output_path: output_root
                    .join("scenes")
                    .join(format!("scene_{:03}.mp4", scene.id))
                    .to_string_lossy()
                    .to_string(),
                shot_plan: crate::video::consistency::ShotPlan {
                    scene_id: scene.id,
                    primary_shot: match spec.camera_plan.primary_shot.to_ascii_lowercase().as_str()
                    {
                        "wide" | "wide tracking" => crate::video::consistency::ShotType::Wide,
                        "tracking" => crate::video::consistency::ShotType::Tracking,
                        "closeup" | "close-up" => crate::video::consistency::ShotType::CloseUp,
                        "aerial" => crate::video::consistency::ShotType::Aerial,
                        "static" => crate::video::consistency::ShotType::Static,
                        _ => crate::video::consistency::ShotType::Medium,
                    },
                    motion_hint: spec.motion_plan.motion_hint.clone(),
                    transition_hint: spec
                        .transition_out
                        .clone()
                        .unwrap_or_else(|| "cut".to_string()),
                },
                style_profile: style_profile.clone(),
                character_profiles: character_profiles.clone(),
                reference_media_path: None,
                consistency_tokens: spec.continuity_tokens.clone(),
            };
            if crate::video::openai_client::can_use_openai_image_pipeline() {
                let backend_scene = crate::video::backend::types::SceneInput {
                    id: scene.id,
                    section_type: Some(scene.section_type.clone()),
                    style_hint: ctx.style_profile.visual_tone.clone().or_else(|| {
                        if ctx.style_profile.genre.trim().is_empty() {
                            None
                        } else {
                            Some(ctx.style_profile.genre.clone())
                        }
                    }),
                    visual_script: scene.visual_script.clone(),
                    duration_secs: scene.duration_secs,
                };
                let routed = router.render_scene(&backend_scene, &backend_options)?;
                outputs.push(routed.output_path);
            } else {
                outputs.push(render_scene_video(scene, &plan)?);
            }
        }

        ctx.scene_videos = outputs;
        Ok(())
    }
}

impl PipelineStep for ComposeStep {
    fn name(&self) -> &'static str {
        "Compose"
    }

    fn execute(&self, ctx: &mut ContentContext) -> Result<()> {
        let output_root = crate::video::thumbnail::project_output_root(&ctx.project_id)?;
        let final_video = output_root.join("final_mv.mp4");
        let result = compose_mv(
            &ctx.scene_videos,
            &ctx.music_path,
            ctx.music_duration_secs,
            &final_video.to_string_lossy(),
        )?;
        ctx.final_video = Some(result.output_path);
        Ok(())
    }
}

#[allow(dead_code)]
fn _project_input_from_context(ctx: &ContentContext) -> ProjectInput {
    ProjectInput {
        project_id: ctx.project_id.clone(),
        project_prompt: ctx.prompt.clone(),
        music: crate::video::types::MusicInput {
            audio_path: ctx.music_path.clone(),
            duration_secs: ctx.music_duration_secs,
        },
        thumbnail: ctx.thumbnail.clone(),
        style_profile: ctx.style_profile.clone(),
        reference_media_paths: Vec::new(),
        scenes: ctx.scenes.clone(),
    }
}
