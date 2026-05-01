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

#[derive(Debug, Clone)]
struct MelodicPresenceMetrics {
    sample_rate_hz: u32,
    analyzed_frames: usize,
    active_frames: usize,
    voiced_frames: usize,
    voiced_ratio: f64,
    pitch_class_count: usize,
    repeat_score: f64,
    median_pitch_hz: f64,
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

pub async fn gate_lyrics_storyboard_script(path: &Path, min_entries: usize) -> Result<GateResult> {
    let raw = tokio::fs::read(path).await?;
    let v: Value = serde_json::from_slice(&raw)?;
    let entries = v
        .get("video_script")
        .or_else(|| v.get("preview_script"))
        .and_then(|x| x.as_array())
        .ok_or_else(|| anyhow!("lyrics missing video_script entries"))?;

    let usable = entries
        .iter()
        .filter(|item| {
            item.get("shot_prompt")
                .or_else(|| item.get("scene_prompt"))
                .or_else(|| item.get("summary"))
                .and_then(|value| value.as_str())
                .map(|text| !text.trim().is_empty())
                .unwrap_or(false)
        })
        .count();

    let metrics = json!({ "video_script_entries": usable, "min_entries": min_entries });
    if usable >= min_entries {
        Ok(GateResult::pass("LYRICS_STORYBOARD_SCRIPT_OK", metrics))
    } else {
        Ok(GateResult::fail(
            "LYRICS_STORYBOARD_SCRIPT_MISSING",
            &format!("video script entries {} < {}", usable, min_entries),
            metrics,
        ))
    }
}

fn char_script_ratio(text: &str, lang: &str) -> f64 {
    let meaningful: Vec<char> = text.chars().filter(|ch| !ch.is_whitespace()).collect();
    if meaningful.is_empty() {
        return 0.0;
    }
    let matching = meaningful
        .iter()
        .filter(|ch| match lang {
            "zh" => ('\u{4e00}'..='\u{9fff}').contains(&**ch),
            "ja" => {
                ('\u{3040}'..='\u{30ff}').contains(&**ch)
                    || ('\u{4e00}'..='\u{9fff}').contains(&**ch)
            }
            "ko" => ('\u{ac00}'..='\u{d7af}').contains(&**ch),
            "en" | "fr" | "de" | "es" => ch.is_ascii_alphabetic(),
            _ => ch.is_alphabetic(),
        })
        .count();
    matching as f64 / meaningful.len() as f64
}

fn extract_concept_anchors(text: &str) -> Vec<String> {
    let lowered = text.trim().to_lowercase();
    let mut anchors = Vec::new();
    let push = |anchors: &mut Vec<String>, value: &str| {
        if !anchors.iter().any(|existing| existing == value) {
            anchors.push(value.to_string());
        }
    };
    let mappings = [
        ("夜", "night"),
        ("night", "night"),
        ("风", "wind"),
        ("wind", "wind"),
        ("光", "light"),
        ("light", "light"),
        ("心", "heart"),
        ("heart", "heart"),
        ("梦", "dream"),
        ("dream", "dream"),
        ("爱", "love"),
        ("love", "love"),
        ("雨", "rain"),
        ("rain", "rain"),
        ("月", "moon"),
        ("moon", "moon"),
        ("火", "fire"),
        ("fire", "fire"),
        ("海", "sea"),
        ("sea", "sea"),
        ("天空", "sky"),
        ("sky", "sky"),
        ("回声", "echo"),
        ("echo", "echo"),
    ];
    for (needle, label) in mappings {
        if lowered.contains(needle) {
            push(&mut anchors, label);
        }
    }
    anchors
}

pub async fn gate_lyrics_language_adapted(
    path: &Path,
    target_lang: &str,
    primary_lang: &str,
    min_delta_ratio: f64,
) -> Result<GateResult> {
    let raw = tokio::fs::read(path).await?;
    let v: Value = serde_json::from_slice(&raw)?;
    let lines = v
        .get("lines")
        .and_then(|x| x.as_array())
        .ok_or_else(|| anyhow!("lyrics missing lines"))?;

    let mut compared = 0usize;
    let mut changed = 0usize;
    let mut source_backfilled = 0usize;
    let mut anchor_hits = 0usize;
    let mut script_text = String::new();
    for line in lines {
        let text = line
            .get("text")
            .and_then(|value| value.as_str())
            .map(str::trim)
            .unwrap_or("");
        let source = line
            .get("source_text")
            .and_then(|value| value.as_str())
            .map(str::trim)
            .unwrap_or("");
        if !text.is_empty() {
            if !script_text.is_empty() {
                script_text.push(' ');
            }
            script_text.push_str(text);
        }
        if !text.is_empty() && !source.is_empty() {
            compared += 1;
            if text != source {
                changed += 1;
            } else {
                source_backfilled += 1;
            }
            let source_anchors = extract_concept_anchors(source);
            let target_anchors = extract_concept_anchors(text);
            if source_anchors.is_empty()
                || source_anchors
                    .iter()
                    .any(|anchor| target_anchors.iter().any(|candidate| candidate == anchor))
            {
                anchor_hits += 1;
            }
        }
    }

    let delta_ratio = if compared == 0 {
        0.0
    } else {
        changed as f64 / compared as f64
    };
    let script_ratio = char_script_ratio(&script_text, target_lang);
    let anchor_ratio = if compared == 0 {
        0.0
    } else {
        anchor_hits as f64 / compared as f64
    };
    let metrics = json!({
        "target_lang": target_lang,
        "primary_lang": primary_lang,
        "compared_lines": compared,
        "changed_lines": changed,
        "source_backfilled_lines": source_backfilled,
        "anchor_hits": anchor_hits,
        "anchor_ratio": anchor_ratio,
        "delta_ratio": delta_ratio,
        "min_delta_ratio": min_delta_ratio,
        "script_ratio": script_ratio
    });

    let same_lang = target_lang == primary_lang;
    let script_ok = if same_lang {
        true
    } else if matches!(target_lang, "zh" | "ja" | "ko") {
        script_ratio >= 0.2
    } else {
        script_ratio >= 0.55
    };
    let ok = same_lang || (delta_ratio >= min_delta_ratio && script_ok && anchor_ratio >= 0.5);
    if ok {
        Ok(GateResult::pass("LYRICS_LANGUAGE_ADAPTED_OK", metrics))
    } else {
        Ok(GateResult::fail(
            "LYRICS_LANGUAGE_ADAPTED_WEAK",
            &format!(
                "adapted lyrics for {} did not diverge enough from {} or lacked target-language script cues",
                target_lang, primary_lang
            ),
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

pub async fn gate_audio_stem_ready(
    path: &Path,
    min_duration_s: f64,
    min_peak_db: f64,
) -> Result<GateResult> {
    if tokio::fs::metadata(path).await.is_err() {
        return Ok(GateResult::fail(
            "AUDIO_STEM_MISSING",
            &format!("required audio stem missing at {}", path.display()),
            json!({ "path": path.display().to_string() }),
        ));
    }

    let duration_gate = gate_audio_duration(path, min_duration_s).await?;
    if !duration_gate.ok {
        return Ok(GateResult::fail(
            "AUDIO_STEM_TOO_SHORT",
            &duration_gate.reason,
            json!({
                "path": path.display().to_string(),
                "duration": duration_gate.metrics
            }),
        ));
    }

    let loudness_gate = gate_audio_not_silent(path, min_peak_db).await?;
    if !loudness_gate.ok {
        return Ok(GateResult::fail(
            "AUDIO_STEM_TOO_WEAK",
            &loudness_gate.reason,
            json!({
                "path": path.display().to_string(),
                "loudness": loudness_gate.metrics
            }),
        ));
    }

    Ok(GateResult::pass(
        "AUDIO_STEM_READY_OK",
        json!({
            "path": path.display().to_string(),
            "duration": duration_gate.metrics,
            "loudness": loudness_gate.metrics
        }),
    ))
}

async fn decode_audio_mono_pcm(path: &Path, sample_rate_hz: u32) -> Result<Vec<f32>> {
    let out = Command::new(ffmpeg_bin())
        .arg("-v")
        .arg("error")
        .arg("-i")
        .arg(path)
        .arg("-ac")
        .arg("1")
        .arg("-ar")
        .arg(sample_rate_hz.to_string())
        .arg("-f")
        .arg("s16le")
        .arg("-")
        .output()
        .await?;
    if !out.status.success() {
        return Err(anyhow!(
            "ffmpeg pcm decode failed: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(out
        .stdout
        .chunks_exact(2)
        .map(|bytes| i16::from_le_bytes([bytes[0], bytes[1]]) as f32 / i16::MAX as f32)
        .collect())
}

fn estimate_fundamental_hz(frame: &[f32], sample_rate_hz: u32) -> Option<(f64, f64)> {
    if frame.len() < 256 {
        return None;
    }
    let energy = frame
        .iter()
        .map(|sample| (*sample as f64) * (*sample as f64))
        .sum::<f64>()
        / frame.len() as f64;
    if energy.sqrt() < 0.01 {
        return None;
    }
    let min_lag = (sample_rate_hz as f64 / 640.0).floor() as usize;
    let max_lag = (sample_rate_hz as f64 / 80.0).ceil() as usize;
    let zero_lag = frame
        .iter()
        .map(|sample| (*sample as f64) * (*sample as f64))
        .sum::<f64>();
    if zero_lag <= 1e-9 {
        return None;
    }
    let mut best_lag = 0usize;
    let mut best_score = 0.0_f64;
    for lag in min_lag..max_lag.min(frame.len().saturating_sub(1)) {
        let mut corr = 0.0_f64;
        for index in 0..frame.len().saturating_sub(lag) {
            corr += frame[index] as f64 * frame[index + lag] as f64;
        }
        let normalized = corr / zero_lag;
        if normalized > best_score {
            best_score = normalized;
            best_lag = lag;
        }
    }
    if best_lag == 0 || best_score < 0.5 {
        return None;
    }
    Some((sample_rate_hz as f64 / best_lag as f64, best_score))
}

fn melodic_presence_metrics(samples: &[f32], sample_rate_hz: u32) -> MelodicPresenceMetrics {
    let frame_len = ((sample_rate_hz as f64 * 0.05).round() as usize).max(256);
    let hop_len = (frame_len / 2).max(128);
    let mut analyzed_frames = 0usize;
    let mut active_frames = 0usize;
    let mut voiced_frames = 0usize;
    let mut voiced_pitch_classes = std::collections::BTreeSet::new();
    let mut quantized_sequence = Vec::new();
    let mut pitch_values_hz = Vec::new();

    let mut start = 0usize;
    while start + frame_len <= samples.len() {
        analyzed_frames += 1;
        let frame = &samples[start..start + frame_len];
        let rms = (frame
            .iter()
            .map(|sample| (*sample as f64) * (*sample as f64))
            .sum::<f64>()
            / frame.len() as f64)
            .sqrt();
        if rms >= 0.01 {
            active_frames += 1;
            if let Some((pitch_hz, confidence)) = estimate_fundamental_hz(frame, sample_rate_hz) {
                if confidence >= 0.55 {
                    voiced_frames += 1;
                    pitch_values_hz.push(pitch_hz);
                    let midi = 69.0 + 12.0 * (pitch_hz / 440.0).log2();
                    let quantized = midi.round() as i32;
                    voiced_pitch_classes.insert(((quantized % 12) + 12) % 12);
                    if quantized_sequence.last().copied() != Some(quantized) {
                        quantized_sequence.push(quantized);
                    }
                }
            }
        }
        start += hop_len;
    }

    let voiced_ratio = if active_frames == 0 {
        0.0
    } else {
        voiced_frames as f64 / active_frames as f64
    };
    let repeat_score = repeated_motif_score(&quantized_sequence);
    let median_pitch_hz = if pitch_values_hz.is_empty() {
        0.0
    } else {
        pitch_values_hz
            .sort_by(|left, right| left.partial_cmp(right).unwrap_or(std::cmp::Ordering::Equal));
        pitch_values_hz[pitch_values_hz.len() / 2]
    };
    MelodicPresenceMetrics {
        sample_rate_hz,
        analyzed_frames,
        active_frames,
        voiced_frames,
        voiced_ratio,
        pitch_class_count: voiced_pitch_classes.len(),
        repeat_score,
        median_pitch_hz,
    }
}

fn repeated_motif_score(quantized_sequence: &[i32]) -> f64 {
    if quantized_sequence.len() < 6 {
        return 0.0;
    }
    let motif_len = quantized_sequence.len().min(4).max(3);
    let motif = &quantized_sequence[..motif_len];
    let mut best = 0usize;
    for window_start in 1..=quantized_sequence.len().saturating_sub(motif_len) {
        let candidate = &quantized_sequence[window_start..window_start + motif_len];
        let matches = motif
            .iter()
            .zip(candidate.iter())
            .filter(|(left, right)| (*left - *right).abs() <= 1)
            .count();
        best = best.max(matches);
    }
    best as f64 / motif_len as f64
}

pub async fn gate_audio_melodic_presence(
    path: &Path,
    min_voiced_ratio: f64,
    min_pitch_classes: usize,
    min_repeat_score: f64,
) -> Result<GateResult> {
    let samples = decode_audio_mono_pcm(path, 16_000).await?;
    let metrics = melodic_presence_metrics(&samples, 16_000);
    let payload = json!({
        "sample_rate_hz": metrics.sample_rate_hz,
        "analyzed_frames": metrics.analyzed_frames,
        "active_frames": metrics.active_frames,
        "voiced_frames": metrics.voiced_frames,
        "voiced_ratio": metrics.voiced_ratio,
        "pitch_class_count": metrics.pitch_class_count,
        "repeat_score": metrics.repeat_score,
        "median_pitch_hz": metrics.median_pitch_hz,
        "min_voiced_ratio": min_voiced_ratio,
        "min_pitch_classes": min_pitch_classes,
        "min_repeat_score": min_repeat_score
    });
    let ok = metrics.voiced_ratio >= min_voiced_ratio
        && metrics.pitch_class_count >= min_pitch_classes
        && metrics.repeat_score >= min_repeat_score;
    if ok {
        Ok(GateResult::pass("AUDIO_MELODIC_PRESENCE_OK", payload))
    } else {
        Ok(GateResult::fail(
            "AUDIO_MELODIC_PRESENCE_WEAK",
            &format!(
                "melodic presence weak: voiced_ratio {:.3}, pitch_classes {}, repeat_score {:.3}",
                metrics.voiced_ratio, metrics.pitch_class_count, metrics.repeat_score
            ),
            payload,
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn adapted_lyrics_gate_detects_changed_lines() {
        let dir = tempfile::tempdir().expect("tempdir");
        let ok_path = dir.path().join("lyrics_ok.json");
        tokio::fs::write(
            &ok_path,
            serde_json::to_vec(&json!({
                "lines": [
                    { "text": "still singing, 夜光", "source_text": "夜光" },
                    { "text": "still singing, 心跳", "source_text": "心跳" }
                ]
            }))
            .expect("json"),
        )
        .await
        .expect("write");
        let ok_gate = gate_lyrics_language_adapted(&ok_path, "en", "zh", 0.6)
            .await
            .expect("gate");
        assert!(ok_gate.ok);

        let weak_path = dir.path().join("lyrics_weak.json");
        tokio::fs::write(
            &weak_path,
            serde_json::to_vec(&json!({
                "lines": [
                    { "text": "夜光", "source_text": "夜光" },
                    { "text": "心跳", "source_text": "心跳" }
                ]
            }))
            .expect("json"),
        )
        .await
        .expect("write");
        let weak_gate = gate_lyrics_language_adapted(&weak_path, "en", "zh", 0.6)
            .await
            .expect("gate");
        assert!(!weak_gate.ok);
    }
}

pub async fn gate_audio_hook_signature(
    path: &Path,
    min_voiced_ratio: f64,
    min_pitch_classes: usize,
    min_repeat_score: f64,
) -> Result<GateResult> {
    let samples = decode_audio_mono_pcm(path, 16_000).await?;
    if samples.len() < 1600 {
        return Ok(GateResult::fail(
            "AUDIO_HOOK_SIGNATURE_WEAK",
            "hook signature window too short to analyze",
            json!({ "samples": samples.len() }),
        ));
    }
    let start = samples.len() / 4;
    let end = (samples.len() * 3 / 4).max(start + 1);
    let metrics = melodic_presence_metrics(&samples[start..end], 16_000);
    let payload = json!({
        "window": "middle_half",
        "sample_rate_hz": metrics.sample_rate_hz,
        "analyzed_frames": metrics.analyzed_frames,
        "active_frames": metrics.active_frames,
        "voiced_frames": metrics.voiced_frames,
        "voiced_ratio": metrics.voiced_ratio,
        "pitch_class_count": metrics.pitch_class_count,
        "repeat_score": metrics.repeat_score,
        "median_pitch_hz": metrics.median_pitch_hz,
        "min_voiced_ratio": min_voiced_ratio,
        "min_pitch_classes": min_pitch_classes,
        "min_repeat_score": min_repeat_score
    });
    let ok = metrics.voiced_ratio >= min_voiced_ratio
        && metrics.pitch_class_count >= min_pitch_classes
        && metrics.repeat_score >= min_repeat_score;
    if ok {
        Ok(GateResult::pass("AUDIO_HOOK_SIGNATURE_OK", payload))
    } else {
        Ok(GateResult::fail(
            "AUDIO_HOOK_SIGNATURE_WEAK",
            &format!(
                "hook signature weak: voiced_ratio {:.3}, pitch_classes {}, repeat_score {:.3}",
                metrics.voiced_ratio, metrics.pitch_class_count, metrics.repeat_score
            ),
            payload,
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
