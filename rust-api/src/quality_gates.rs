use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::Path;
use tokio::process::Command;

fn parse_ass_ts_to_s(ts: &str) -> Option<f64> {
    // ASS timestamp: h:mm:ss.cs
    let mut it = ts.trim().split(':');
    let h = it.next()?.trim().parse::<f64>().ok()?;
    let m = it.next()?.trim().parse::<f64>().ok()?;
    let s = it.next()?.trim().parse::<f64>().ok()?;
    Some(h * 3600.0 + m * 60.0 + s)
}

fn ass_dialogue_span_seconds(raw: &str) -> Option<(f64, f64)> {
    let mut min_start = f64::MAX;
    let mut max_end = 0.0f64;
    let mut seen = false;
    for line in raw.lines() {
        if !line.starts_with("Dialogue:") {
            continue;
        }
        // Dialogue: Layer, Start, End, Style, Name, ...
        let rest = line.trim_start_matches("Dialogue:").trim();
        let mut parts = rest.splitn(4, ',');
        let _layer = parts.next();
        let start = parts.next();
        let end = parts.next();
        if let (Some(start), Some(end)) = (start, end) {
            let parsed_start = parse_ass_ts_to_s(start);
            let parsed_end = parse_ass_ts_to_s(end);
            if let (Some(s0), Some(s1)) = (parsed_start, parsed_end) {
                min_start = min_start.min(s0);
                max_end = max_end.max(s1);
                seen = true;
            }
        }
    }
    if seen {
        Some((min_start, max_end))
    } else {
        None
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateResult {
    pub ok: bool,
    pub code: String,
    pub reason: String,
    #[serde(default)]
    pub metrics: Value,
}

impl GateResult {
    pub fn pass(code: &str, metrics: Value) -> Self {
        Self {
            ok: true,
            code: code.to_string(),
            reason: String::new(),
            metrics,
        }
    }

    pub fn fail(code: &str, reason: &str, metrics: Value) -> Self {
        Self {
            ok: false,
            code: code.to_string(),
            reason: reason.to_string(),
            metrics,
        }
    }
}

#[derive(Debug, Clone)]
pub struct GateError {
    pub code: String,
    pub reason: String,
    pub metrics: Value,
}

impl std::fmt::Display for GateError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.reason)
    }
}

impl std::error::Error for GateError {}

pub fn fail_gate(g: GateResult) -> anyhow::Error {
    GateError {
        code: g.code,
        reason: g.reason,
        metrics: g.metrics,
    }
    .into()
}

fn ffprobe_bin() -> String {
    std::env::var("CSS_FFPROBE").unwrap_or_else(|_| "ffprobe".to_string())
}

fn ffmpeg_bin() -> String {
    std::env::var("CSS_FFMPEG").unwrap_or_else(|_| "ffmpeg".to_string())
}

async fn ffprobe_json(path: &Path, entries: &str) -> Result<Value> {
    let out = Command::new(ffprobe_bin())
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg(entries)
        .arg("-of")
        .arg("json")
        .arg(path)
        .output()
        .await?;
    if !out.status.success() {
        return Err(anyhow!(
            "ffprobe failed: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(serde_json::from_slice(&out.stdout)?)
}

pub async fn media_duration_seconds(path: &Path) -> Result<f64> {
    let v = ffprobe_json(path, "format=duration").await?;
    let dur = v
        .get("format")
        .and_then(|x| x.get("duration"))
        .and_then(|x| x.as_str())
        .ok_or_else(|| anyhow!("missing duration"))?
        .parse::<f64>()?;
    Ok(dur)
}

pub async fn gate_audio_duration(path: &Path, min_s: f64) -> Result<GateResult> {
    let dur = media_duration_seconds(path).await?;
    let metrics = json!({ "duration_s": dur, "min_s": min_s });
    if dur >= min_s {
        Ok(GateResult::pass("AUDIO_DURATION_OK", metrics))
    } else {
        Ok(GateResult::fail(
            "AUDIO_DURATION_TOO_SHORT",
            &format!("audio duration {}s < {}s", dur, min_s),
            metrics,
        ))
    }
}

pub async fn gate_video_duration(path: &Path, min_s: f64) -> Result<GateResult> {
    let dur = media_duration_seconds(path).await?;
    let metrics = json!({ "duration_s": dur, "min_s": min_s });
    if dur >= min_s {
        Ok(GateResult::pass("VIDEO_DURATION_OK", metrics))
    } else {
        Ok(GateResult::fail(
            "VIDEO_DURATION_TOO_SHORT",
            &format!("video duration {}s < {}s", dur, min_s),
            metrics,
        ))
    }
}

pub async fn gate_lyrics_nonempty_lines(path: &Path, min_lines: usize) -> Result<GateResult> {
    let raw = tokio::fs::read(path).await?;
    let v: Value = serde_json::from_slice(&raw)?;
    let lines = v
        .get("lines")
        .and_then(|x| x.as_array())
        .ok_or_else(|| anyhow!("lyrics missing lines"))?;

    let nonempty = lines
        .iter()
        .filter(|x| {
            x.get("text")
                .and_then(|y| y.as_str())
                .map(|s| !s.trim().is_empty())
                .unwrap_or(false)
        })
        .count();

    let metrics = json!({ "nonempty_lines": nonempty, "min_lines": min_lines });
    if nonempty >= min_lines {
        Ok(GateResult::pass("LYRICS_NONEMPTY_OK", metrics))
    } else {
        Ok(GateResult::fail(
            "LYRICS_NONEMPTY_TOO_FEW",
            &format!("lyrics nonempty lines {} < {}", nonempty, min_lines),
            metrics,
        ))
    }
}

pub async fn gate_subtitles_coverage(path: &Path, min_dialogues: usize) -> Result<GateResult> {
    let raw = tokio::fs::read_to_string(path).await?;
    let dialogues = raw.lines().filter(|l| l.starts_with("Dialogue:")).count();
    let metrics = json!({ "dialogue_lines": dialogues, "min_dialogues": min_dialogues });

    if dialogues >= min_dialogues {
        Ok(GateResult::pass("SUBTITLES_COVERAGE_OK", metrics))
    } else {
        Ok(GateResult::fail(
            "SUBTITLES_COVERAGE_TOO_LOW",
            &format!("subtitle dialogue lines {} < {}", dialogues, min_dialogues),
            metrics,
        ))
    }
}

pub async fn gate_audio_not_silent(path: &Path, min_peak_db: f64) -> Result<GateResult> {
    let out = Command::new(ffmpeg_bin())
        .arg("-v")
        .arg("info")
        .arg("-i")
        .arg(path)
        .arg("-af")
        .arg("volumedetect")
        .arg("-f")
        .arg("null")
        .arg("-")
        .output()
        .await?;

    let stderr = String::from_utf8_lossy(&out.stderr);
    let mut max_volume_db: Option<f64> = None;

    for line in stderr.lines() {
        if let Some(pos) = line.find("max_volume:") {
            let tail = line[pos + "max_volume:".len()..].trim();
            let tail = tail.trim_end_matches(" dB").trim();
            if let Ok(v) = tail.parse::<f64>() {
                max_volume_db = Some(v);
                break;
            }
        }
    }

    let peak = max_volume_db.unwrap_or(-999.0);
    let metrics = json!({ "max_volume_db": peak, "min_peak_db": min_peak_db });

    if peak >= min_peak_db {
        Ok(GateResult::pass("AUDIO_NOT_SILENT_OK", metrics))
    } else {
        Ok(GateResult::fail(
            "AUDIO_TOO_SILENT",
            &format!("audio peak {} dB < {} dB", peak, min_peak_db),
            metrics,
        ))
    }
}

pub async fn gate_av_duration_delta(
    video_path: &Path,
    audio_path: &Path,
    max_delta_s: f64,
) -> Result<GateResult> {
    let video_dur = media_duration_seconds(video_path).await?;
    let audio_dur = media_duration_seconds(audio_path).await?;
    let delta = (video_dur - audio_dur).abs();
    let metrics = json!({
        "video_duration_s": video_dur,
        "audio_duration_s": audio_dur,
        "delta_s": delta,
        "max_delta_s": max_delta_s
    });

    if delta <= max_delta_s {
        Ok(GateResult::pass("AV_DURATION_DELTA_OK", metrics))
    } else {
        Ok(GateResult::fail(
            "AV_DURATION_DELTA_TOO_LARGE",
            &format!("av duration delta {}s > {}s", delta, max_delta_s),
            metrics,
        ))
    }
}

pub async fn gate_subtitles_audio_delta(
    ass_path: &Path,
    audio_path: &Path,
    max_delta_s: f64,
) -> Result<GateResult> {
    let raw = tokio::fs::read_to_string(ass_path).await?;
    let (start_s, end_s) = ass_dialogue_span_seconds(&raw)
        .ok_or_else(|| anyhow!("no parseable Dialogue span in subtitles"))?;
    let sub_dur = (end_s - start_s).max(0.0);
    let audio_dur = media_duration_seconds(audio_path).await?;
    let delta = (sub_dur - audio_dur).abs();
    let metrics = json!({
        "subtitles_duration_s": sub_dur,
        "audio_duration_s": audio_dur,
        "delta_s": delta,
        "max_delta_s": max_delta_s
    });
    if delta <= max_delta_s {
        Ok(GateResult::pass("SUBTITLES_AUDIO_DELTA_OK", metrics))
    } else {
        Ok(GateResult::fail(
            "SUBTITLES_AUDIO_DELTA_TOO_LARGE",
            &format!("subtitles/audio delta {}s > {}s", delta, max_delta_s),
            metrics,
        ))
    }
}
