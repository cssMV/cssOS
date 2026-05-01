use crate::run_state::{Artifact, RunState};
use crate::schema_keys::{
    ordered_keys_stable_first, present_keys_ordered, stable_keys_v46, stable_keys_v46_vec,
};
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use tokio::fs as tokio_fs;

pub fn file_ok(p: &PathBuf) -> bool {
    std::fs::metadata(p)
        .map(|m| m.is_file() && m.len() > 0)
        .unwrap_or(false)
}

pub fn file_ok_at(root: &Path, p: &PathBuf) -> bool {
    let abs = if p.is_absolute() {
        p.clone()
    } else {
        root.join(p)
    };
    file_ok(&abs)
}

pub fn outputs_ok(outputs: &[PathBuf]) -> bool {
    outputs.iter().all(file_ok)
}

pub fn outputs_ok_at(root: &Path, outputs: &[PathBuf]) -> bool {
    outputs.iter().all(|p| file_ok_at(root, p))
}

fn should_publish_artifact_path(path: &Path) -> bool {
    let lower = path.to_string_lossy().to_ascii_lowercase();
    !(lower.ends_with(".wav") || lower.ends_with(".flac"))
}

fn guess_mime(path: &Path) -> Option<String> {
    let s = path.to_string_lossy().to_lowercase();
    if s.ends_with(".mp4") {
        return Some("video/mp4".into());
    }
    if s.ends_with(".wav") {
        return Some("audio/wav".into());
    }
    if s.ends_with(".mp3") {
        return Some("audio/mpeg".into());
    }
    if s.ends_with(".json") {
        return Some("application/json".into());
    }
    if s.ends_with(".ass") {
        return Some("text/x-ssa".into());
    }
    if s.ends_with(".srt") {
        return Some("application/x-subrip".into());
    }
    None
}

fn guess_kind(path: &Path) -> String {
    let s = path.to_string_lossy().to_lowercase();
    if s.ends_with(".mp4") {
        return "video".into();
    }
    if s.ends_with(".wav") {
        return "audio".into();
    }
    if s.ends_with(".mp3") {
        return "audio".into();
    }
    if s.ends_with(".ass") || s.ends_with(".srt") {
        return "subtitles".into();
    }
    if s.ends_with(".json") {
        return "json".into();
    }
    "file".into()
}

pub fn rebuild_artifacts(run_dir: &Path, st: &RunState) -> Vec<Artifact> {
    fn is_allowed_default(rel: &Path) -> bool {
        let s = rel.to_string_lossy();
        s == "build/final_mv.mp4"
            || s == "build/subtitles.ass"
            || s == "build/lyrics.json"
            || s == "build/music.mp3"
            || s == "build/vocals.mp3"
            || s == "build/mix.mp3"
            || s == "build/master.mp3"
    }

    fn is_allowed_extended(rel: &Path) -> bool {
        let s = rel.to_string_lossy();
        if is_allowed_default(rel) {
            return true;
        }
        s == "build/music.mp3"
            || s == "build/vocals.mp3"
            || s == "build/mix.mp3"
            || s == "build/master.mp3"
            || s == "build/video/video.mp4"
    }

    fn include_extended() -> bool {
        match std::env::var("CSS_ARTIFACTS_EXTENDED") {
            Ok(v) => v == "1" || v.to_lowercase() == "true",
            Err(_) => false,
        }
    }

    fn kind_rank(kind: &str, rel: &Path) -> i32 {
        let s = rel.to_string_lossy();
        if s == "build/final_mv.mp4" {
            return 0;
        }
        match kind {
            "subtitles" => 1,
            "json" => 2,
            "audio" => 3,
            "video" => 4,
            _ => 9,
        }
    }

    let ext = include_extended();
    let allow = |p: &Path| {
        if ext {
            is_allowed_extended(p)
        } else {
            is_allowed_default(p)
        }
    };

    let mut seen = BTreeSet::<String>::new();
    let mut items: Vec<Artifact> = Vec::new();

    for (stage, rec) in &st.stages {
        for rel in &rec.outputs {
            if !allow(rel) {
                continue;
            }
            if !should_publish_artifact_path(rel) {
                continue;
            }
            let abs = run_dir.join(rel);
            if !file_ok(&abs) {
                continue;
            }
            let key = rel.to_string_lossy().to_string();
            if !seen.insert(key) {
                continue;
            }
            let kind = guess_kind(rel);
            items.push(Artifact {
                kind,
                path: rel.clone(),
                stage: stage.clone(),
                mime: guess_mime(&abs),
            });
        }
    }

    items.sort_by(|a, b| {
        let ra = kind_rank(&a.kind, &a.path);
        let rb = kind_rank(&b.kind, &b.path);
        if ra != rb {
            return ra.cmp(&rb);
        }
        a.path.to_string_lossy().cmp(&b.path.to_string_lossy())
    });

    items
}

pub fn artifacts_index(st: &RunState) -> Vec<Artifact> {
    rebuild_artifacts(&st.config.out_dir, st)
}

pub fn build_artifacts_index(st: &mut RunState) {
    st.artifacts = rebuild_artifacts(&st.config.out_dir, st);
}

pub fn purge_lossless_artifacts(run_dir: &Path) {
    fn walk_and_purge(dir: &Path) {
        let entries = match std::fs::read_dir(dir) {
            Ok(entries) => entries,
            Err(_) => return,
        };
        for entry in entries.flatten() {
            let path = entry.path();
            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,
                Err(_) => continue,
            };
            if file_type.is_dir() {
                walk_and_purge(&path);
                continue;
            }
            if !file_type.is_file() {
                continue;
            }
            let lower = path.to_string_lossy().to_ascii_lowercase();
            if lower.ends_with(".wav") || lower.ends_with(".flac") {
                let _ = std::fs::remove_file(&path);
            }
        }
    }

    let final_mv_exists = run_dir.join("build/final_mv.mp4").is_file();
    let public_mp3_exists = run_dir.join("build/mix.mp3").is_file();
    if !final_mv_exists && !public_mp3_exists {
        return;
    }
    walk_and_purge(run_dir);
}

fn stable_mime_for_path(p: &Path) -> &'static str {
    let s = p.to_string_lossy().to_lowercase();
    if s.ends_with(".mp4") {
        "video/mp4"
    } else if s.ends_with(".wav") {
        "audio/wav"
    } else if s.ends_with(".mp3") {
        "audio/mpeg"
    } else if s.ends_with(".json") {
        "application/json"
    } else if s.ends_with(".ass") {
        "text/x-ssa"
    } else if s.ends_with(".srt") {
        "application/x-subrip"
    } else {
        "application/octet-stream"
    }
}

fn artifact_value(kind: &str, rel_path: &str, mime: &str, bytes: u64) -> Value {
    serde_json::json!({
        "kind": kind,
        "path": rel_path,
        "mime": mime,
        "bytes": bytes
    })
}

async fn record_if_exists(st: &mut RunState, run_dir: &Path, key: &str, rel: &str, kind: &str) {
    let rel_path = PathBuf::from(rel);
    if !should_publish_artifact_path(&rel_path) {
        return;
    }
    let full = run_dir.join(&rel_path);
    let md = match tokio_fs::metadata(&full).await {
        Ok(v) => v,
        Err(_) => return,
    };
    if !md.is_file() || md.len() == 0 {
        return;
    }
    let mime = stable_mime_for_path(&full);
    st.set_artifact_path(key, artifact_value(kind, rel, mime, md.len()));
}

pub async fn record_stage_artifacts(st: &mut RunState, run_dir: &Path, stage: &str) {
    match stage {
        "lyrics" | "lyrics_gen" => {
            record_if_exists(st, run_dir, "lyrics.json", "./build/lyrics.json", "lyrics").await;
            record_if_exists(
                st,
                run_dir,
                "lyrics.json",
                "./build/lyrics/lyrics.primary.json",
                "lyrics",
            )
            .await;
        }
        "music" => {
            record_if_exists(st, run_dir, "music.mp3", "./build/music.mp3", "audio").await;
        }
        "vocals" | "vocals_align" => {
            record_if_exists(st, run_dir, "vocals.mp3", "./build/vocals.mp3", "audio").await;
            record_if_exists(
                st,
                run_dir,
                "vocal.master.mp3",
                "./build/vocals/vocal_master.mp3",
                "audio",
            )
            .await;
            record_if_exists(
                st,
                run_dir,
                "lead.singing.mp3",
                "./build/vocals/lead_singing_voice.mp3",
                "audio",
            )
            .await;
            record_if_exists(
                st,
                run_dir,
                "backing.singing.mp3",
                "./build/vocals/backing_singing_voice.mp3",
                "audio",
            )
            .await;
        }
        "mix" => {
            record_if_exists(st, run_dir, "mix.mp3", "./build/mix.mp3", "audio").await;
            record_if_exists(st, run_dir, "master.mp3", "./build/master.mp3", "audio").await;
        }
        "subtitles" => {
            record_if_exists(
                st,
                run_dir,
                "subtitles.ass",
                "./build/subtitles.ass",
                "subtitles",
            )
            .await;
            record_if_exists(
                st,
                run_dir,
                "subtitles.ass",
                "./build/subtitles/subtitles.ass",
                "subtitles",
            )
            .await;
        }
        "video_assemble" => {
            record_if_exists(st, run_dir, "video.mp4", "./build/video/video.mp4", "video").await;
        }
        "render" => {
            record_if_exists(st, run_dir, "final.mv", "./build/final_mv.mp4", "mv").await;
            record_if_exists(st, run_dir, "final.mv", "./build/final/final_mv.mp4", "mv").await;
        }
        _ => {}
    }
}

pub fn stable_artifact_keys() -> Vec<String> {
    stable_keys_v46_vec()
}

pub fn stable_order_map() -> BTreeMap<String, usize> {
    let mut m = BTreeMap::new();
    for (i, k) in stable_keys_v46().iter().enumerate() {
        m.insert((*k).to_string(), i);
    }
    m
}

pub fn stable_sort_keys(mut keys: Vec<String>) -> Vec<String> {
    let set: BTreeSet<String> = keys.drain(..).collect();
    ordered_keys_stable_first(stable_keys_v46(), &set)
}

pub fn stable_present_keys(present: &BTreeSet<String>) -> Vec<String> {
    present_keys_ordered(stable_keys_v46(), present)
}
