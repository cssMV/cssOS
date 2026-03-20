use serde::{Deserialize, Serialize};

use crate::dag_v3::matrix::VersionKey;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArtifactDef {
    pub stable_key: String,
    pub path: String,
    pub mime: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<VersionKey>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub stage: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ArtifactIndex {
    pub items: Vec<ArtifactDef>,
}

impl ArtifactIndex {
    pub fn stable_keys(&self) -> Vec<String> {
        let mut xs: Vec<String> = self.items.iter().map(|x| x.stable_key.clone()).collect();
        xs.sort();
        xs.dedup();
        xs
    }
}

pub fn collect_artifacts_from_stages(stages: &[crate::dag_v3::stage::StageDef]) -> ArtifactIndex {
    let mut items = Vec::new();
    for s in stages {
        for p in &s.outputs {
            let mime = if p.ends_with(".mp4") {
                "video/mp4"
            } else if p.ends_with(".wav") {
                "audio/wav"
            } else if p.ends_with(".ass") {
                "text/x-ass"
            } else if p.ends_with(".json") {
                "application/json"
            } else {
                "application/octet-stream"
            };
            items.push(ArtifactDef {
                stable_key: stable_key_for_stage(&s.name.0, p),
                path: p.clone(),
                mime: mime.to_string(),
                version: s.version.clone(),
                stage: Some(s.name.0.clone()),
            });
        }
    }
    ArtifactIndex { items }
}

pub fn stable_key_for_stage(stage: &str, path: &str) -> String {
    if stage.starts_with("render_mv.") {
        return stage.replacen("render_mv", "final.mv", 1);
    }
    if stage.starts_with("render_karaoke_mv.") {
        return stage.replacen("render_karaoke_mv", "karaoke.mv", 1);
    }
    if stage.starts_with("mix.") {
        return stage.replacen("mix", "mix.wav", 1);
    }
    if stage.starts_with("subtitles.") {
        return stage.replacen("subtitles", "subtitles.ass", 1);
    }
    if stage.starts_with("lyrics_primary.") || stage.starts_with("lyrics_adapt.") {
        return format!(
            "lyrics.json.{}",
            stage.split('.').next_back().unwrap_or("en")
        );
    }
    if path.ends_with("/video.mp4") {
        return "video.mp4".to_string();
    }
    if path.ends_with("/cover.png") {
        return "cover.png".to_string();
    }
    stage.to_string()
}
