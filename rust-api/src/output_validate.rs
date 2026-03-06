use crate::run_state::{GateMeta, RunState};
use std::path::{Path, PathBuf};
use std::process::Command;

fn file_len_ok(p: &Path) -> Result<u64, String> {
    let md = std::fs::metadata(p).map_err(|e| format!("MISSING:{}:{e}", p.display()))?;
    if md.len() == 0 {
        return Err(format!("EMPTY:{}", p.display()));
    }
    Ok(md.len())
}

#[derive(Debug, Clone)]
pub struct GateFail {
    pub meta: GateMeta,
    pub message: String,
}

impl GateFail {
    pub fn new(code: &str, message: String) -> Self {
        let meta = GateMeta {
            gate_code: code.to_string(),
            ..Default::default()
        };
        Self { meta, message }
    }
    pub fn with_base(mut self, base_stage: &str, base_s: f64) -> Self {
        self.meta.base_stage = Some(base_stage.to_string());
        self.meta.base_s = Some(base_s);
        self
    }
    pub fn with_got(mut self, got_s: f64) -> Self {
        self.meta.got_s = Some(got_s);
        self
    }
    pub fn with_ratio(mut self, min_ratio: f64) -> Self {
        self.meta.min_ratio = Some(min_ratio);
        self
    }
    pub fn with_min_duration(mut self, min_d: f64) -> Self {
        self.meta.min_duration_s = Some(min_d);
        self
    }
    pub fn with_file(mut self, file: &str, bytes: Option<u64>) -> Self {
        self.meta.file = Some(file.to_string());
        self.meta.file_bytes = bytes;
        self
    }
}

impl std::fmt::Display for GateFail {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

impl std::error::Error for GateFail {}

fn ffprobe_duration_s(p: &Path) -> Result<f64, String> {
    let out = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=nw=1:nk=1")
        .arg(p.as_os_str())
        .output()
        .map_err(|e| format!("FFPROBE_SPAWN:{}:{e}", p.display()))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        let stdout = String::from_utf8_lossy(&out.stdout);
        return Err(format!("FFPROBE_FAIL:{}:{}", p.display(), format!("{}{}", stdout, stderr).trim()));
    }

    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    let d: f64 = s.parse().map_err(|_| format!("FFPROBE_PARSE:{}:{}", p.display(), s))?;
    if !d.is_finite() || d <= 0.0 {
        return Err(format!("DURATION_BAD:{}:{}", p.display(), d));
    }
    Ok(d)
}

fn is_video_shot(stage: &str) -> bool {
    stage.starts_with("video_shot_") || stage.starts_with("video.shot:")
}

fn needs_audio_gate(stage: &str) -> bool {
    matches!(stage, "music" | "vocals" | "mix")
}

fn needs_video_gate(stage: &str) -> bool {
    matches!(stage, "video_assemble" | "video" | "render")
}

fn stage_primary_duration_s(st: &RunState, stage: &str) -> Result<Option<f64>, String> {
    let Some(rec) = st.stages.get(stage) else { return Ok(None) };
    let Some(p) = rec.outputs.first() else { return Ok(None) };
    file_len_ok(p)?;
    Ok(Some(ffprobe_duration_s(p)?))
}

fn max_opt(a: Option<f64>, b: Option<f64>) -> Option<f64> {
    match (a, b) {
        (Some(x), Some(y)) => Some(x.max(y)),
        (Some(x), None) => Some(x),
        (None, Some(y)) => Some(y),
        (None, None) => None,
    }
}

fn ratio_ok(got: f64, want: f64, min_ratio: f64) -> bool {
    if want <= 0.0 {
        return true;
    }
    got + 1e-6 >= want * min_ratio
}

fn validate_one(stage: &str, p: &Path, st: &RunState) -> Result<(), GateFail> {
    let len = file_len_ok(p).map_err(|e| GateFail::new("FILE_INVALID", e).with_file(&p.display().to_string(), None))?;

    let audio_min = st.commands.audio.min_duration_s.max(0.0);
    let video_min = st.commands.video.min_duration_s.max(0.0);

    if needs_audio_gate(stage) {
        let d = ffprobe_duration_s(p)
            .map_err(|e| GateFail::new("FFPROBE_FAIL", e).with_file(&p.display().to_string(), Some(len)))?;
        if d + 1e-6 < audio_min {
            return Err(
                GateFail::new(
                    "AUDIO_TOO_SHORT",
                    format!("AUDIO_TOO_SHORT:{}:dur_s={}:min_s={}", p.display(), d, audio_min),
                )
                .with_file(&p.display().to_string(), Some(len))
                .with_got(d)
                .with_min_duration(audio_min),
            );
        }
        return Ok(());
    }

    if needs_video_gate(stage) {
        let d = ffprobe_duration_s(p)
            .map_err(|e| GateFail::new("FFPROBE_FAIL", e).with_file(&p.display().to_string(), Some(len)))?;
        if d + 1e-6 < video_min {
            return Err(
                GateFail::new(
                    "VIDEO_TOO_SHORT",
                    format!("VIDEO_TOO_SHORT:{}:dur_s={}:min_s={}", p.display(), d, video_min),
                )
                .with_file(&p.display().to_string(), Some(len))
                .with_got(d)
                .with_min_duration(video_min),
            );
        }
        return Ok(());
    }

    if is_video_shot(stage) {
        let _ = ffprobe_duration_s(p)
            .map_err(|e| GateFail::new("FFPROBE_FAIL", e).with_file(&p.display().to_string(), Some(len)))?;
    }

    Ok(())
}

pub fn gate_stage_outputs(st: &RunState, stage: &str) -> Result<(), GateFail> {
    let rec = st
        .stages
        .get(stage)
        .ok_or_else(|| GateFail::new("STAGE_NOT_FOUND", "STAGE_NOT_FOUND".to_string()))?;
    if rec.outputs.is_empty() {
        return Ok(());
    }
    let audio_ratio = st.commands.audio.min_match_ratio.clamp(0.01, 1.0);
    let video_ratio = st.commands.video.min_match_ratio.clamp(0.01, 1.0);

    for p in &rec.outputs {
        validate_one(stage, p, st)?;
    }

    if stage == "mix" {
        let mix_d = stage_primary_duration_s(st, "mix")
            .map_err(|e| GateFail::new("FFPROBE_FAIL", e))?
            .unwrap_or(0.0);
        let vocals_d = stage_primary_duration_s(st, "vocals").map_err(|e| GateFail::new("FFPROBE_FAIL", e))?;
        let music_d = stage_primary_duration_s(st, "music").map_err(|e| GateFail::new("FFPROBE_FAIL", e))?;
        if let Some(base) = max_opt(vocals_d, music_d) {
            if !ratio_ok(mix_d, base, audio_ratio) {
                return Err(
                    GateFail::new(
                        "MIX_TOO_SHORT",
                        format!("MIX_TOO_SHORT:mix_s={}:base_s={}:min_ratio={}", mix_d, base, audio_ratio),
                    )
                    .with_base("max(vocals,music)", base)
                    .with_got(mix_d)
                    .with_ratio(audio_ratio),
                );
            }
        }
    }

    if stage == "video_assemble" {
        let vid_d = stage_primary_duration_s(st, "video_assemble")
            .map_err(|e| GateFail::new("FFPROBE_FAIL", e))?
            .unwrap_or(0.0);
        if let Some(mix_d) = stage_primary_duration_s(st, "mix").map_err(|e| GateFail::new("FFPROBE_FAIL", e))? {
            if !ratio_ok(vid_d, mix_d, video_ratio) {
                return Err(
                    GateFail::new(
                        "VIDEO_TOO_SHORT",
                        format!("VIDEO_TOO_SHORT:video_s={}:base_s={}:min_ratio={}", vid_d, mix_d, video_ratio),
                    )
                    .with_base("mix", mix_d)
                    .with_got(vid_d)
                    .with_ratio(video_ratio),
                );
            }
        }
    }

    if stage == "render" {
        let out_d = stage_primary_duration_s(st, "render")
            .map_err(|e| GateFail::new("FFPROBE_FAIL", e))?
            .unwrap_or(0.0);
        let mix_d = stage_primary_duration_s(st, "mix").map_err(|e| GateFail::new("FFPROBE_FAIL", e))?;
        let vid_d =
            stage_primary_duration_s(st, "video_assemble").map_err(|e| GateFail::new("FFPROBE_FAIL", e))?;
        if let Some(base) = max_opt(mix_d, vid_d) {
            if !ratio_ok(out_d, base, video_ratio) {
                return Err(
                    GateFail::new(
                        "RENDER_TOO_SHORT",
                        format!("RENDER_TOO_SHORT:render_s={}:base_s={}:min_ratio={}", out_d, base, video_ratio),
                    )
                    .with_base("max(mix,video_assemble)", base)
                    .with_got(out_d)
                    .with_ratio(video_ratio),
                );
            }
        }
    }

    Ok(())
}

pub fn validate_stage_outputs_compat(stage: &str, outputs: &[PathBuf], st: &RunState) -> Result<(), GateFail> {
    if st.stages.contains_key(stage) {
        return gate_stage_outputs(st, stage);
    }
    if outputs.is_empty() {
        return Ok(());
    }
    for p in outputs {
        validate_one(stage, p, st)?;
    }
    Ok(())
}

pub fn is_critical_stage(stage: &str) -> bool {
    matches!(
        stage,
        "lyrics" | "music" | "vocals" | "mix" | "video_plan" | "video_assemble" | "video" | "render"
    ) || stage.starts_with("video_shot_")
        || stage.starts_with("video.shot:")
}
