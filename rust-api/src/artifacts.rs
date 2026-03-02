use crate::run_state::{Artifact, RunState};
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

pub fn file_ok(p: &PathBuf) -> bool {
    std::fs::metadata(p)
        .map(|m| m.is_file() && m.len() > 0)
        .unwrap_or(false)
}

pub fn file_ok_at(root: &Path, p: &PathBuf) -> bool {
    let abs = if p.is_absolute() { p.clone() } else { root.join(p) };
    file_ok(&abs)
}

pub fn outputs_ok(outputs: &[PathBuf]) -> bool {
    outputs.iter().all(file_ok)
}

pub fn outputs_ok_at(root: &Path, outputs: &[PathBuf]) -> bool {
    outputs.iter().all(|p| file_ok_at(root, p))
}

fn guess_mime(path: &Path) -> Option<String> {
    let s = path.to_string_lossy().to_lowercase();
    if s.ends_with(".mp4") {
        return Some("video/mp4".into());
    }
    if s.ends_with(".wav") {
        return Some("audio/wav".into());
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
        s == "build/final_mv.mp4" || s == "build/subtitles.ass" || s == "build/lyrics.json"
    }

    fn is_allowed_extended(rel: &Path) -> bool {
        let s = rel.to_string_lossy();
        if is_allowed_default(rel) {
            return true;
        }
        s == "build/music.wav" || s == "build/vocals.wav" || s == "build/video/video.mp4"
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
    let allow = |p: &Path| if ext { is_allowed_extended(p) } else { is_allowed_default(p) };

    let mut seen = BTreeSet::<String>::new();
    let mut items: Vec<Artifact> = Vec::new();

    for (stage, rec) in &st.stages {
        for rel in &rec.outputs {
            if !allow(rel) {
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
