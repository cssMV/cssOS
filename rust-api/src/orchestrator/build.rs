use serde_json::json;
use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::dag_v3::{
    CreativeBrief, CreativeIntent, DagBuilder, DagExecutionPlan, InputKind, ProjectMode,
    SourceAsset, VersionMatrix,
};
use crate::engine_registry::defaults::default_registry;

use super::normalize::{normalize_engine, normalize_version_matrix};
use super::request::{CreateMvApiRequest, InputRequest};

#[derive(Debug, Clone)]
struct ZeroInputBlueprint {
    title: String,
    style: String,
    mood: String,
    tempo: String,
    prompt: String,
    lyrics_prompt: String,
    video_prompt: String,
    section_form: Vec<String>,
    duration_s: f64,
}

fn select_zero_input_blueprint(req: &CreateMvApiRequest) -> Option<ZeroInputBlueprint> {
    if !matches!(req.input, InputRequest::Click) {
        return None;
    }

    let mut hasher = DefaultHasher::new();
    req.engine.name.hash(&mut hasher);
    req.engine.version.hash(&mut hasher);
    req.creative.title.hash(&mut hasher);
    req.creative.style.hash(&mut hasher);
    req.creative.mood.hash(&mut hasher);
    req.creative.tempo.hash(&mut hasher);
    let now_nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos() as u64)
        .unwrap_or(0);
    now_nanos.hash(&mut hasher);
    let mut seed = hasher.finish();

    let next_index = |seed_ref: &mut u64, len: usize| -> usize {
        *seed_ref = seed_ref
            .wrapping_mul(6364136223846793005)
            .wrapping_add(1442695040888963407);
        ((*seed_ref >> 16) as usize) % len.max(1)
    };
    let pick = |seed_ref: &mut u64, items: &[&str]| -> String {
        items[next_index(seed_ref, items.len())].to_string()
    };

    let worlds = [
        "glass ocean",
        "moonlit train",
        "cloud temple",
        "neon rain avenue",
        "desert mirror city",
        "winter rooftop garden",
        "golden harbor dusk",
        "ruined observatory",
    ];
    let lights = [
        "aurora light",
        "cathedral haze",
        "electric dawn",
        "silver storm light",
        "lantern shimmer",
        "afterimage glow",
    ];
    let motions = [
        "voices rising out of distance",
        "a crowd folding toward one pulse",
        "two figures crossing from symmetry into devotion",
        "bodies scattering and converging around one answer",
        "a solitary lead drawing the frame into orbit",
    ];
    let emotional_axes = [
        "luminous", "yearning", "epic", "electric", "tender", "haunting", "ecstatic",
    ];
    let styles = [
        "cinematic electro-pop",
        "dream-pop anthem",
        "mythic electronic orchestral",
        "future-soul cinematic pop",
        "art-pop widescreen ballad",
        "sacred synth drama",
    ];
    let callbacks = [
        "the opening horizon",
        "the first window reflection",
        "the original stair of light",
        "the first distant silhouette",
        "the opening weather-stained street",
        "the first sacred threshold",
    ];
    let duo_switches = [
        "let two figures shift from equals to lead-and-answer",
        "turn the duet from mirrored balance into one guiding the other",
        "move the pair from side-by-side symmetry into a clear emotional lead",
    ];
    let group_switches = [
        "let the group move from scattered space into a converging center and then release",
        "draw the crowd from loose edges into a single core before opening the frame again",
        "stage the ensemble as spread, gathered, then released back into air",
    ];
    let title_prefixes = [
        "Glass", "Moon", "Cloud", "Neon", "Silver", "Golden", "Velvet", "Mirror",
    ];
    let title_suffixes = [
        "Afterlight",
        "Communion",
        "Horizon",
        "Cathedral",
        "Pulse",
        "Bloom",
        "Signal",
        "Return",
    ];
    let tempos = ["96", "104", "110", "118", "124", "128"];

    let world = pick(&mut seed, &worlds);
    let light = pick(&mut seed, &lights);
    let motion = pick(&mut seed, &motions);
    let mood = pick(&mut seed, &emotional_axes);
    let style = pick(&mut seed, &styles);
    let callback = pick(&mut seed, &callbacks);
    let duo_switch = pick(&mut seed, &duo_switches);
    let group_switch = pick(&mut seed, &group_switches);
    let title = format!(
        "{} {}",
        pick(&mut seed, &title_prefixes),
        pick(&mut seed, &title_suffixes)
    );
    let section_form = vec![
        "Verse 1".to_string(),
        "Verse 2".to_string(),
        "Chorus 1".to_string(),
        "Verse 3".to_string(),
        "Verse 4".to_string(),
        "Chorus 2".to_string(),
        "Bridge".to_string(),
        "Chorus 3".to_string(),
        "Chorus 4".to_string(),
        "Outro".to_string(),
    ];
    let tempo = pick(&mut seed, &tempos);
    let lyric_lines_per_section = 5.0;
    let duration_s = ((section_form.len() as f64) * lyric_lines_per_section * 3.2)
        .max(96.0)
        .min(240.0);

    Some(ZeroInputBlueprint {
        title,
        style,
        mood,
        tempo,
        prompt: format!(
            "A complete original MV born from a single click: {world}, {light}, {motion}."
        ),
        lyrics_prompt: format!(
            "Write a fully original song in the Jingdian ten-section opera template: Verse 1, Verse 2, Chorus 1, Verse 3, Verse 4, Chorus 2, Bridge, Chorus 3, Chorus 4, Outro. Every section must contain 4 main narrative lines plus 1 response line in the civilization's original-language incantation. Make it singable, vivid, and storyboard-friendly. Do not use stock phrases or templates. Invent fresh imagery around {world} and {light}. Make the ending explicitly answer {callback}."
        ),
        video_prompt: format!(
            "Create an original MV in {world} with {light}. Start in distance, build to a chorus-driven visual expansion, {duo_switch}, {group_switch}, and end with a direct visual callback to {callback}."
        ),
        section_form,
        duration_s,
    })
}

fn split_section_form(raw: Option<&str>) -> Vec<String> {
    raw.unwrap_or("")
        .split(|ch| matches!(ch, ',' | '|' | '/' | '>' | ';' | '\n'))
        .map(|part| part.trim())
        .filter(|part| !part.is_empty())
        .map(|part| part.to_string())
        .collect()
}

fn build_visual_prompt(req: &CreateMvApiRequest) -> String {
    if let Some(blueprint) = select_zero_input_blueprint(req) {
        return blueprint.video_prompt;
    }
    match &req.input {
        InputRequest::Click => "A new original song and MV".to_string(),
        InputRequest::Text { text } => text.clone(),
        InputRequest::Voice { .. } => "Voice inspired song and MV".to_string(),
    }
}

fn synthesize_video_segments(
    title: &str,
    visual_prompt: &str,
    mood: &str,
    section_form: &[String],
    duration_s: f64,
) -> Vec<serde_json::Value> {
    let sections = if section_form.is_empty() {
        vec![
            "Intro".to_string(),
            "Verse 1".to_string(),
            "Chorus 1".to_string(),
            "Bridge".to_string(),
        ]
    } else {
        section_form.to_vec()
    };
    let safe_duration = duration_s.max(0.2);
    let base = safe_duration / sections.len() as f64;

    sections
        .iter()
        .enumerate()
        .map(|(index, section)| {
            let start_s = base * index as f64;
            let end_s = if index + 1 == sections.len() {
                safe_duration
            } else {
                (base * (index as f64 + 1.0)).min(safe_duration)
            };
            let transition = if index + 1 == sections.len() {
                "fade"
            } else if section.to_ascii_lowercase().contains("chorus") {
                "match"
            } else {
                "cut"
            };
            json!({
                "scene_id": format!("scene_{:03}", index + 1),
                "shot_id": format!("video_shot_{:03}", index),
                "label": section,
                "start_s": start_s,
                "end_s": end_s,
                "duration_s": (end_s - start_s).max(1.0),
                "transition_to_next": transition,
                "subtitle_text": format!("{section} · {title} · {mood}"),
                "prompt": format!("{visual_prompt} | section: {section} | mood: {mood}"),
                "motif_callback": if index + 1 == sections.len() { "direct_opening_response" } else if section.to_ascii_lowercase().contains("bridge") { "pre_closing_recall" } else { "forward_motion" },
                "relationship_arc": if section.to_ascii_lowercase().contains("chorus") {
                    if index + 1 == sections.len().saturating_sub(1) {
                        "gathered_release"
                    } else {
                        "equals_to_lead_and_group_converge"
                    }
                } else if section.to_ascii_lowercase().contains("bridge") {
                    "relationship_turn"
                } else if index + 1 == sections.len() {
                    "answered_release"
                } else {
                    "setup_distance"
                }
            })
        })
        .collect()
}

pub fn build_intent(req: &CreateMvApiRequest, matrix: &VersionMatrix) -> CreativeIntent {
    let source_assets = match &req.input {
        InputRequest::Click => vec![],
        InputRequest::Text { .. } => vec![SourceAsset {
            kind: InputKind::Text,
            path: "inline:text".into(),
            lang: None,
        }],
        InputRequest::Voice { voice_url } => vec![SourceAsset {
            kind: InputKind::Voice,
            path: voice_url.clone(),
            lang: None,
        }],
    };

    CreativeIntent {
        mode: ProjectMode::FromScratch,
        primary_lang: matrix.primary_lang.clone(),
        target_langs: matrix.langs.clone(),
        target_voices: matrix.voices.clone(),
        outputs: matrix.outputs.clone(),
        karaoke: matrix
            .outputs
            .iter()
            .any(|x| matches!(x, crate::dag_v3::OutputKind::KaraokeMv)),
        auto_mv: true,
        market_ready: matrix
            .outputs
            .iter()
            .any(|x| matches!(x, crate::dag_v3::OutputKind::MarketPack)),
        source_assets,
    }
}

pub fn build_brief(req: &CreateMvApiRequest) -> CreativeBrief {
    let zero_input = select_zero_input_blueprint(req);
    let default_prompt = match &req.input {
        InputRequest::Click => zero_input
            .as_ref()
            .map(|item| item.prompt.clone())
            .unwrap_or_else(|| "A new original song and MV".to_string()),
        InputRequest::Text { text } => text.clone(),
        InputRequest::Voice { .. } => "Voice inspired song and MV".to_string(),
    };

    let title = req
        .creative
        .title
        .clone()
        .or_else(|| zero_input.as_ref().map(|item| item.title.clone()))
        .unwrap_or_else(|| "Untitled".into());

    CreativeBrief {
        title,
        style: req
            .creative
            .style
            .clone()
            .or_else(|| zero_input.as_ref().map(|item| item.style.clone()))
            .unwrap_or_else(|| "pop".into()),
        mood: req
            .creative
            .mood
            .clone()
            .or_else(|| zero_input.as_ref().map(|item| item.mood.clone()))
            .unwrap_or_else(|| "dreamy".into()),
        tempo: req
            .creative
            .tempo
            .clone()
            .or_else(|| zero_input.as_ref().map(|item| item.tempo.clone()))
            .unwrap_or_else(|| "100".into()),
        prompt: default_prompt.clone(),
        visual_prompt: default_prompt,
    }
}

pub fn build_run_commands(req: &CreateMvApiRequest) -> serde_json::Value {
    let zero_input = select_zero_input_blueprint(req);
    let visual_prompt = zero_input
        .as_ref()
        .map(|item| item.video_prompt.clone())
        .unwrap_or_else(|| build_visual_prompt(req));
    let title = req
        .creative
        .title
        .clone()
        .or_else(|| zero_input.as_ref().map(|item| item.title.clone()))
        .unwrap_or_else(|| "Untitled".into());
    let style = req
        .creative
        .style
        .clone()
        .or_else(|| zero_input.as_ref().map(|item| item.style.clone()))
        .unwrap_or_else(|| "pop".into());
    let mood = req
        .creative
        .mood
        .clone()
        .or_else(|| zero_input.as_ref().map(|item| item.mood.clone()))
        .unwrap_or_else(|| "dreamy".into());
    let tempo = req
        .creative
        .tempo
        .clone()
        .or_else(|| zero_input.as_ref().map(|item| item.tempo.clone()))
        .unwrap_or_else(|| "100".into());
    let section_form = split_section_form(req.creative.style.as_deref())
        .into_iter()
        .filter(|part| {
            let lower = part.to_ascii_lowercase();
            lower.contains("intro")
                || lower.contains("verse")
                || lower.contains("chorus")
                || lower.contains("bridge")
                || lower.contains("outro")
                || lower.contains("hook")
        })
        .collect::<Vec<_>>();
    let section_form = if section_form.is_empty() {
        zero_input
            .as_ref()
            .map(|item| item.section_form.clone())
            .unwrap_or_else(|| {
                vec![
                    "Intro".to_string(),
                    "Verse 1".to_string(),
                    "Chorus 1".to_string(),
                    "Bridge".to_string(),
                    "Outro".to_string(),
                ]
            })
    } else {
        section_form
    };
    let duration_s = zero_input
        .as_ref()
        .map(|item| item.duration_s)
        .unwrap_or(12.0);
    let lyrics_prompt = zero_input
        .as_ref()
        .map(|item| item.lyrics_prompt.clone())
        .unwrap_or_else(|| match &req.input {
            InputRequest::Click => {
                "Write a complete original song with hook, verses, bridge, and ending.".to_string()
            }
            InputRequest::Text { text } => text.clone(),
            InputRequest::Voice { .. } => "Voice inspired song and MV".to_string(),
        });
    let creative_prompt = zero_input
        .as_ref()
        .map(|item| item.prompt.clone())
        .unwrap_or_else(|| match &req.input {
            InputRequest::Click => "A new original song and MV".to_string(),
            InputRequest::Text { text } => text.clone(),
            InputRequest::Voice { .. } => "Voice inspired song and MV".to_string(),
        });
    let segments =
        synthesize_video_segments(&title, &visual_prompt, &mood, &section_form, duration_s);
    let input_json = match &req.input {
        InputRequest::Click => json!({ "type": "click" }),
        InputRequest::Text { text } => json!({ "type": "text", "text": text }),
        InputRequest::Voice { voice_url } => json!({ "type": "voice", "voice_url": voice_url }),
    };

    json!({
        "engine": {
            "name": req.engine.name,
            "version": req.engine.version,
        },
        "dag_version": "v3",
        "title_hint": title,
        "input": input_json,
        "lyrics": {
            "primary_lang": req.versions.primary_lang.clone().unwrap_or_else(|| "en".to_string()),
            "prompt": lyrics_prompt
        },
        "creative": {
            "title": title,
            "style": style,
            "mood": mood,
            "tempo": tempo,
            "prompt": creative_prompt,
            "lyrics_prompt": lyrics_prompt,
            "video_prompt": visual_prompt,
            "section_form": section_form,
            "duration_s": duration_s,
            "work_type": "single",
            "structure_plan": {
                "workType": "single",
                "targetSceneCount": segments.len(),
                "targetDurationSec": duration_s,
                "primaryDelivery": "karaoke_mv"
            }
        },
        "video": {
            "duration_s": duration_s,
            "segments": segments
        },
        "matrix": {
            "langs": req.versions.langs,
            "voices": req.versions.voices,
            "outputs": req.versions.outputs,
            "primary_lang": req.versions.primary_lang,
            "primary_voice": req.versions.primary_voice,
        }
    })
}

pub fn build_execution_plan_from_api(
    req: &CreateMvApiRequest,
) -> anyhow::Result<(
    crate::engine_registry::resolver::EngineSelectionRequest,
    VersionMatrix,
    DagExecutionPlan,
)> {
    let registry = default_registry();
    let engine_selection = normalize_engine(&req.engine);
    let matrix = normalize_version_matrix(&req.versions);
    let intent = build_intent(req, &matrix);
    let brief = build_brief(req);

    let plan = DagBuilder::new_with_engine(
        intent,
        brief,
        matrix.clone(),
        registry,
        engine_selection.clone(),
    )
    .add_input_layer()
    .add_understanding_layer()
    .add_lyrics_layer()
    .add_music_layer()
    .add_video_layer()
    .add_sync_layer()
    .add_output_layer()
    .finalize()?;

    Ok((engine_selection, matrix, plan))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::orchestrator::request::{
        CreateMvApiRequest, CreativeRequest, EngineRequest, VersionsRequest,
    };

    #[test]
    fn build_run_commands_includes_video_segments() {
        let req = CreateMvApiRequest {
            engine: EngineRequest {
                name: "cssmv".into(),
                version: "v1".into(),
            },
            input: InputRequest::Text {
                text: "Neon skyline lovers".into(),
            },
            creative: CreativeRequest {
                title: Some("Neon Hearts".into()),
                style: Some("Intro, Verse 1, Chorus 1, Bridge".into()),
                mood: Some("uplifting".into()),
                tempo: Some("112".into()),
            },
            versions: VersionsRequest::default(),
        };

        let commands = build_run_commands(&req);
        let segments = commands["video"]["segments"].as_array().expect("segments");
        assert_eq!(segments.len(), 4);
        assert_eq!(segments[0]["label"].as_str(), Some("Intro"));
        assert_eq!(segments[2]["transition_to_next"].as_str(), Some("match"));
    }

    #[test]
    fn build_run_commands_click_produces_zero_input_mv_blueprint() {
        let req = CreateMvApiRequest {
            engine: EngineRequest {
                name: "cssmv".into(),
                version: "v1".into(),
            },
            input: InputRequest::Click,
            creative: CreativeRequest::default(),
            versions: VersionsRequest::default(),
        };

        let commands = build_run_commands(&req);
        let section_form = commands["creative"]["section_form"]
            .as_array()
            .expect("section form");
        let segments = commands["video"]["segments"].as_array().expect("segments");
        assert!(commands["creative"]["lyrics_prompt"]
            .as_str()
            .unwrap_or("")
            .contains("Do not use stock phrases or templates"));
        assert!(commands["creative"]["video_prompt"]
            .as_str()
            .unwrap_or("")
            .contains("direct visual callback"));
        assert!(commands["video"]["duration_s"].as_f64().unwrap_or(0.0) >= 1.0);
        assert_eq!(section_form.len(), 10);
        assert_eq!(segments.len(), section_form.len());
        assert!(segments.iter().any(|segment| {
            segment["relationship_arc"]
                .as_str()
                .unwrap_or("")
                .contains("equals_to_lead")
        }));
        assert_eq!(
            segments
                .last()
                .and_then(|segment| segment["motif_callback"].as_str()),
            Some("direct_opening_response")
        );
    }
}
