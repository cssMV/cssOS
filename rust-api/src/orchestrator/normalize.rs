use crate::dag_v3::{LangCode, OutputKind, VersionMatrix, VoiceId};
use crate::engine_registry::resolver::EngineSelectionRequest;
use crate::engine_registry::types::{EngineName, EngineVersion};

use super::request::{EngineRequest, VersionsRequest};

pub fn normalize_engine(req: &EngineRequest) -> EngineSelectionRequest {
    EngineSelectionRequest {
        engine: Some(EngineName(req.name.clone())),
        version: Some(EngineVersion(req.version.clone())),
    }
}

pub fn parse_output_kind(s: &str) -> OutputKind {
    match s {
        "karaoke_mv" => OutputKind::KaraokeMv,
        "audio_only" => OutputKind::AudioOnly,
        "instrumental" => OutputKind::Instrumental,
        "preview_15s" => OutputKind::Preview15s,
        "preview_30s" => OutputKind::Preview30s,
        "market_pack" => OutputKind::MarketPack,
        _ => OutputKind::Mv,
    }
}

pub fn normalize_version_matrix(req: &VersionsRequest) -> VersionMatrix {
    let langs = if req.langs.is_empty() {
        vec![LangCode("en".into())]
    } else {
        req.langs.iter().cloned().map(LangCode).collect()
    };

    let voices = if req.voices.is_empty() {
        vec![VoiceId("female".into())]
    } else {
        req.voices.iter().cloned().map(VoiceId).collect()
    };

    let outputs = if req.outputs.is_empty() {
        vec![OutputKind::Mv]
    } else {
        req.outputs.iter().map(|x| parse_output_kind(x)).collect()
    };

    let primary_lang = req
        .primary_lang
        .clone()
        .map(LangCode)
        .unwrap_or_else(|| langs[0].clone());

    let primary_voice = req
        .primary_voice
        .clone()
        .map(VoiceId)
        .unwrap_or_else(|| voices[0].clone());

    VersionMatrix {
        primary_lang,
        primary_voice,
        langs,
        voices,
        outputs,
    }
}
