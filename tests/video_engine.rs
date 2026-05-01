use std::fs;
use std::path::PathBuf;
use std::process::Command;

use cssmv_video_engine::video::{
    ProjectInput, SceneEntities, SceneInput, StyleProfile, build_arc_timeline,
    build_character_profiles, build_scene_continuity_memory, build_video_project, normalize_style,
    plan_shots,
};
use tempfile::tempdir;

fn ffmpeg_available() -> bool {
    Command::new("ffmpeg")
        .arg("-version")
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn sample_input(audio_path: String) -> ProjectInput {
    serde_json::from_str(&format!(
        r#"{{
          "project_id": "ticket-demo",
          "project_prompt": "A cinematic emerald anthem",
          "music": {{
            "audio_path": "{audio_path}",
            "duration_secs": 12.0
          }},
          "thumbnail": {{
            "enabled": true,
            "duration_secs": 4.0
          }},
          "style_profile": {{
            "genre": "epic",
            "color_palette": "emerald-gold",
            "visual_tone": "luminous fantasy",
            "camera_language": "gliding cinematic motion"
          }},
          "scenes": [
            {{
              "id": 1,
              "section_type": "verse",
              "text_block": "Rise from the quiet field",
              "visual_script": "A hero wakes under a green aurora",
              "duration_secs": 6.0,
              "entities": {{
                "characters": ["Aria"],
                "location": "moonlit field",
                "props": ["lantern"]
              }}
            }},
            {{
              "id": 2,
              "section_type": "chorus",
              "text_block": "Sing the city into light",
              "visual_script": "The chorus opens into a radiant skyline with gliding camera movement",
              "duration_secs": 6.0,
              "entities": {{
                "characters": ["Aria", "Choir"],
                "location": "emerald skyline",
                "props": ["banner", "light shards"]
              }}
            }}
          ]
        }}"#
    ))
    .expect("sample input should parse")
}

fn build_test_audio(path: &PathBuf, duration_secs: f32) {
    let status = Command::new("ffmpeg")
        .args([
            "-y",
            "-f",
            "lavfi",
            "-i",
            &format!("sine=frequency=440:duration={duration_secs:.3}"),
            "-c:a",
            "pcm_s16le",
        ])
        .arg(path)
        .status()
        .expect("ffmpeg should spawn");
    assert!(status.success(), "ffmpeg failed to build test audio");
}

fn build_test_image(path: &PathBuf) {
    let status = Command::new("ffmpeg")
        .args([
            "-y",
            "-f",
            "lavfi",
            "-i",
            "color=c=#2f4f4f:s=1280x720:d=1",
            "-frames:v",
            "1",
        ])
        .arg(path)
        .status()
        .expect("ffmpeg should spawn for image");
    assert!(status.success(), "ffmpeg failed to build test image");
}

#[test]
fn builds_consistency_outputs_without_ffmpeg_work() {
    let input = sample_input("tests/fixtures/example.wav".to_string());
    assert_eq!(input.thumbnail.duration_secs, 4.0);
    assert_eq!(input.scenes.len(), 2);
}

#[test]
fn continuity_and_shot_rules_separate_duo_hierarchy_from_group_release() {
    let scenes = vec![
        SceneInput {
            id: 1,
            section_type: "chorus".to_string(),
            text_block: "The lead and companion collide under the lights".to_string(),
            visual_script: "A lead voice pulls the duo toward the center".to_string(),
            duration_secs: 6.0,
            entities: SceneEntities {
                characters: vec!["Aria".to_string(), "Choir".to_string()],
                location: "emerald skyline".to_string(),
                props: vec!["banner".to_string()],
            },
            reference_media_paths: Vec::new(),
            director: None,
            quality: None,
        },
        SceneInput {
            id: 2,
            section_type: "outro".to_string(),
            text_block: "The crowd opens into the horizon".to_string(),
            visual_script: "The group loosens and releases into wide air".to_string(),
            duration_secs: 6.0,
            entities: SceneEntities {
                characters: vec![
                    "Aria".to_string(),
                    "Choir".to_string(),
                    "Witness".to_string(),
                    "Drifter".to_string(),
                ],
                location: "open frontier".to_string(),
                props: vec!["light shards".to_string()],
            },
            reference_media_paths: Vec::new(),
            director: None,
            quality: None,
        },
    ];

    let profiles = build_character_profiles(&scenes);
    let duo_memory = build_scene_continuity_memory(&scenes[0], &profiles);
    let group_memory = build_scene_continuity_memory(&scenes[1], &profiles);
    assert_eq!(duo_memory.relationship_mode, "paired-equals");
    assert_eq!(group_memory.relationship_mode, "ensemble-led");
    assert!(group_memory.formation_balance > duo_memory.formation_balance);

    let style_input = StyleProfile {
        genre: "epic".to_string(),
        color_palette: Some("emerald-gold".to_string()),
        visual_tone: Some("luminous fantasy".to_string()),
        camera_language: Some("gliding cinematic motion".to_string()),
        quality_profile: None,
    };
    let normalized_style = normalize_style(&style_input, &scenes);
    let timeline = build_arc_timeline(&scenes);
    let shot_plans = plan_shots(&scenes, &timeline, &normalized_style, &style_input);
    assert_eq!(shot_plans[0].ensemble_mode, "duo");
    assert_eq!(shot_plans[1].ensemble_mode, "group");
    assert_eq!(shot_plans[0].shot_size, "two-shot");
    assert_eq!(shot_plans[1].shot_size, "ensemble-wide");
    assert_eq!(shot_plans[0].relationship_arc, "equals_to_lead");
    assert_eq!(shot_plans[1].relationship_arc, "center_release");
}

#[test]
fn resolution_shot_targets_opening_for_explicit_callback() {
    let scenes = vec![
        SceneInput {
            id: 1,
            section_type: "verse".to_string(),
            text_block: "A lantern glows in the field".to_string(),
            visual_script: "Aria opens alone under a green aurora".to_string(),
            duration_secs: 4.0,
            entities: SceneEntities {
                characters: vec!["Aria".to_string()],
                location: "moonlit field".to_string(),
                props: vec!["lantern".to_string()],
            },
            reference_media_paths: Vec::new(),
            director: None,
            quality: None,
        },
        SceneInput {
            id: 2,
            section_type: "chorus".to_string(),
            text_block: "The city answers in full light".to_string(),
            visual_script: "The chorus expands into an emerald skyline".to_string(),
            duration_secs: 4.0,
            entities: SceneEntities {
                characters: vec!["Aria".to_string(), "Choir".to_string()],
                location: "emerald skyline".to_string(),
                props: vec!["banner".to_string()],
            },
            reference_media_paths: Vec::new(),
            director: None,
            quality: None,
        },
        SceneInput {
            id: 3,
            section_type: "outro".to_string(),
            text_block: "The lantern returns at dawn".to_string(),
            visual_script: "Aria returns to the first field with softer light".to_string(),
            duration_secs: 4.0,
            entities: SceneEntities {
                characters: vec!["Aria".to_string()],
                location: "moonlit field".to_string(),
                props: vec!["lantern".to_string()],
            },
            reference_media_paths: Vec::new(),
            director: None,
            quality: None,
        },
    ];

    let style_input = StyleProfile {
        genre: "epic".to_string(),
        color_palette: Some("emerald-gold".to_string()),
        visual_tone: Some("luminous fantasy".to_string()),
        camera_language: Some("gliding cinematic motion".to_string()),
        quality_profile: None,
    };
    let normalized_style = normalize_style(&style_input, &scenes);
    let timeline = build_arc_timeline(&scenes);
    let shot_plans = plan_shots(&scenes, &timeline, &normalized_style, &style_input);
    let outro = shot_plans
        .iter()
        .find(|shot| shot.scene_id == 3)
        .expect("outro shot should exist");

    assert_eq!(outro.motif_target_scene_id, Some(1));
    assert_eq!(outro.motif_callback_style, "direct-closing-response");
    assert_eq!(outro.relationship_arc, "solo_release");
}

#[test]
fn builds_end_to_end_video_project() {
    if !ffmpeg_available() {
        return;
    }

    let temp = tempdir().expect("temp dir");
    let audio_path = temp.path().join("music.wav");
    let image_path = temp.path().join("reference.jpg");
    build_test_audio(&audio_path, 12.0);
    build_test_image(&image_path);

    let mut input = sample_input(audio_path.to_string_lossy().to_string());
    for scene in &mut input.scenes {
        scene.reference_media_paths = vec![image_path.to_string_lossy().to_string()];
    }
    let result = build_video_project(input).expect("video project should build");

    assert_eq!(result.scene_video_paths.len(), 2);
    assert!(PathBuf::from(&result.compose_result.final_video_path).exists());
    assert!(result.compose_result.matched);
    assert!(result.thumbnail.generated);
    assert_eq!(result.continuity_scores.len(), 2);
    assert_eq!(result.arc_timeline.len(), 2);
    assert_ne!(result.shot_plans[0].movement, result.shot_plans[1].movement);
    assert_ne!(
        result.shot_plans[0].transition_style,
        result.shot_plans[1].transition_style
    );
    assert_eq!(result.shot_plans[0].ensemble_mode, "solo");
    assert_eq!(result.shot_plans[1].ensemble_mode, "duo");
    assert_eq!(result.shot_plans[0].shot_distance_preference, "hero_close");
    assert_eq!(result.shot_plans[1].shot_distance_preference, "medium_duo");
    assert_eq!(result.shot_plans[0].shot_size, "close-medium");
    assert_eq!(result.shot_plans[1].shot_size, "two-shot");
    assert_eq!(result.shot_plans[0].relationship_arc, "solo_hold");
    assert_eq!(result.shot_plans[1].relationship_arc, "equals_to_lead");
    assert_eq!(result.shot_plans[1].motif_callback_style, "impact-hook");
    assert!(result.arc_timeline[1].is_primary_explosion);
    assert!(result.arc_timeline[1].impact_weight > result.arc_timeline[0].impact_weight);
    assert!(result.arc_timeline[0].stability_weight > result.arc_timeline[1].stability_weight);

    let metadata = fs::metadata(&result.compose_result.final_video_path).expect("final mv exists");
    assert!(metadata.len() > 8_000);
}
