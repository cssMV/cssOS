use crate::dag_v3::artifacts::{ArtifactDef, ArtifactIndex};
use crate::dag_v3::stage::StageDef;

pub fn register_artifacts(stages: &[StageDef]) -> ArtifactIndex {
    let mut items = Vec::<ArtifactDef>::new();
    for st in stages {
        for out in &st.outputs {
            if let Some(a) = classify_output(st, out) {
                items.push(a);
            }
        }
    }
    ArtifactIndex { items }
}

fn classify_output(st: &StageDef, out: &str) -> Option<ArtifactDef> {
    let stable_key = if out.ends_with("/final_mv.mp4") {
        "final.mv"
    } else if out.ends_with("/karaoke_mv.mp4") {
        "karaoke.mv"
    } else if out.ends_with("/audio_only.wav") {
        "audio_only.wav"
    } else if out.ends_with("render/instrumental.wav") {
        "instrumental.wav"
    } else if out.starts_with("lyrics/") && out.ends_with(".json") {
        "lyrics.json"
    } else if out.starts_with("subtitles/") && out.ends_with(".ass") {
        "subtitles.ass"
    } else if out == "video/video.mp4" {
        "video.mp4"
    } else if out == "cover/cover.png" {
        "cover.png"
    } else if out == "publish/metadata.json" {
        "metadata.json"
    } else {
        return None;
    };

    Some(ArtifactDef {
        stable_key: stable_key.to_string(),
        path: out.to_string(),
        mime: mime_of(out),
        version: st.version.clone(),
        stage: Some(st.name.0.clone()),
    })
}

fn mime_of(path: &str) -> String {
    if path.ends_with(".mp4") {
        "video/mp4".into()
    } else if path.ends_with(".wav") {
        "audio/wav".into()
    } else if path.ends_with(".json") {
        "application/json".into()
    } else if path.ends_with(".ass") {
        "text/x-ass".into()
    } else if path.ends_with(".png") {
        "image/png".into()
    } else {
        "application/octet-stream".into()
    }
}
