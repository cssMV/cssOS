use axum::{extract::Path, Json};
use serde::{Deserialize, Serialize};

use crate::cssapi::error::ApiError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineVersionInfo {
    pub version: String,
    pub description: String,
    pub supports_langs: bool,
    pub supports_voices: bool,
    pub supports_outputs: bool,
    pub outputs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineInfo {
    pub name: String,
    pub versions: Vec<EngineVersionInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnginesListResponse {
    pub schema: &'static str,
    pub engines: Vec<EngineInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineGetResponse {
    pub schema: &'static str,
    pub engine: EngineInfo,
}

fn outputs_for(name: &str, version: &str) -> Vec<String> {
    match (name, version) {
        ("cssmv", "v1.0") => vec!["audio_only".into(), "mv".into()],
        ("cssmv", "v2.0") => vec!["audio_only".into(), "mv".into(), "karaoke_mv".into()],
        ("cssmv", "v3.0") => vec![
            "audio_only".into(),
            "mv".into(),
            "karaoke_mv".into(),
            "instrumental".into(),
            "market_pack".into(),
        ],
        _ => vec!["mv".into()],
    }
}

fn description_for(name: &str, version: &str) -> String {
    match (name, version) {
        ("cssmv", "v1.0") => "cssMV baseline generator".into(),
        ("cssmv", "v2.0") => "cssMV enhanced generator".into(),
        ("cssmv", "v3.0") => "cssMV cinematic generator".into(),
        _ => format!("{} {}", name, version),
    }
}

pub fn list_engines() -> Vec<EngineInfo> {
    use std::collections::BTreeMap;

    let reg = crate::engine_registry::defaults::default_registry();
    let mut grouped: BTreeMap<String, Vec<String>> = BTreeMap::new();

    for d in reg.list_publicly_selectable() {
        grouped
            .entry(d.id.name.0.clone())
            .or_default()
            .push(d.id.version.0.clone());
    }

    grouped
        .into_iter()
        .map(|(name, mut versions)| {
            versions.sort();
            versions.dedup();
            let versions = versions
                .into_iter()
                .map(|version| EngineVersionInfo {
                    description: description_for(&name, &version),
                    supports_langs: true,
                    supports_voices: true,
                    supports_outputs: true,
                    outputs: outputs_for(&name, &version),
                    version,
                })
                .collect::<Vec<_>>();
            EngineInfo { name, versions }
        })
        .collect()
}

pub fn find_engine(engine: &str) -> Option<EngineInfo> {
    list_engines().into_iter().find(|e| e.name == engine)
}

pub async fn api_list_engines() -> Json<EnginesListResponse> {
    Json(EnginesListResponse {
        schema: "cssapi.public.engines.v1",
        engines: list_engines(),
    })
}

pub async fn api_get_engine(
    Path(engine): Path<String>,
) -> Result<Json<EngineGetResponse>, ApiError> {
    let engine_info = find_engine(&engine).ok_or_else(|| {
        ApiError::not_found("ENGINE_NOT_FOUND", &format!("engine '{engine}' not found"))
    })?;
    Ok(Json(EngineGetResponse {
        schema: "cssapi.public.engine.v1",
        engine: engine_info,
    }))
}

#[cfg(test)]
mod tests {
    use super::{find_engine, list_engines};

    #[test]
    fn public_engine_list_is_sorted_and_cssmv_present() {
        let engines = list_engines();
        assert!(!engines.is_empty());
        let names = engines.iter().map(|e| e.name.as_str()).collect::<Vec<_>>();
        let mut sorted = names.clone();
        sorted.sort();
        assert_eq!(names, sorted);
        assert!(find_engine("cssmv").is_some());
    }

    #[test]
    fn unknown_engine_returns_none() {
        assert!(find_engine("missing-engine").is_none());
    }
}
