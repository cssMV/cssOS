use serde_json::json;

use crate::dag_v3::{
    CreativeBrief, CreativeIntent, DagBuilder, DagExecutionPlan, InputKind, ProjectMode,
    SourceAsset, VersionMatrix,
};
use crate::engine_registry::defaults::default_registry;

use super::normalize::{normalize_engine, normalize_version_matrix};
use super::request::{CreateMvApiRequest, InputRequest};

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
    let default_prompt = match &req.input {
        InputRequest::Click => "A new original song and MV".to_string(),
        InputRequest::Text { text } => text.clone(),
        InputRequest::Voice { .. } => "Voice inspired song and MV".to_string(),
    };

    let title = req
        .creative
        .title
        .clone()
        .unwrap_or_else(|| "Untitled".into());

    CreativeBrief {
        title,
        style: req.creative.style.clone().unwrap_or_else(|| "pop".into()),
        mood: req.creative.mood.clone().unwrap_or_else(|| "dreamy".into()),
        tempo: req.creative.tempo.clone().unwrap_or_else(|| "100".into()),
        prompt: default_prompt.clone(),
        visual_prompt: default_prompt,
    }
}

pub fn build_run_commands(req: &CreateMvApiRequest) -> serde_json::Value {
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
        "input": input_json,
        "creative": {
            "title": req.creative.title,
            "style": req.creative.style,
            "mood": req.creative.mood,
            "tempo": req.creative.tempo,
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
