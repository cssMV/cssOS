use super::*;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::BTreeSet;

fn parse_ass_ts_to_s(ts: &str) -> Option<f64> {
    let mut it = ts.trim().split(':');
    let h = it.next()?.trim().parse::<f64>().ok()?;
    let m = it.next()?.trim().parse::<f64>().ok()?;
    let s = it.next()?.trim().parse::<f64>().ok()?;
    Some(h * 3600.0 + m * 60.0 + s)
}

fn ass_ts(secs: f64) -> String {
    let t = if secs.is_finite() && secs >= 0.0 {
        secs
    } else {
        0.0
    };
    let cs = (t * 100.0).round() as u64;
    let h = cs / 360000;
    let m = (cs / 6000) % 60;
    let s = (cs / 100) % 60;
    let c = cs % 100;
    format!("{h}:{m:02}:{s:02}.{c:02}")
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubtitlesAlignReport {
    pub changed: bool,
    pub delta_s_before: f64,
    pub delta_s_after: f64,
    pub max_delta_s: f64,
    pub subtitles_duration_before_s: f64,
    pub subtitles_duration_after_s: f64,
    pub audio_duration_s: f64,
    pub scale: f64,
}

pub async fn auto_align_to_audio_once(
    ass_path: &std::path::Path,
    audio_path: &std::path::Path,
    max_delta_s: f64,
) -> Result<SubtitlesAlignReport> {
    let raw = tokio::fs::read_to_string(ass_path).await?;
    let audio_dur = crate::quality_gates::media_duration_seconds(audio_path).await?;
    if !audio_dur.is_finite() || audio_dur <= 0.0 {
        return Ok(SubtitlesAlignReport {
            changed: false,
            delta_s_before: f64::MAX,
            delta_s_after: f64::MAX,
            max_delta_s,
            subtitles_duration_before_s: 0.0,
            subtitles_duration_after_s: 0.0,
            audio_duration_s: audio_dur,
            scale: 1.0,
        });
    }

    let mut parsed: Vec<(usize, f64, f64)> = Vec::new();
    let mut lines: Vec<String> = raw.lines().map(|s| s.to_string()).collect();
    let mut min_start = f64::MAX;
    let mut max_end = 0.0f64;

    for (idx, line) in lines.iter().enumerate() {
        if !line.starts_with("Dialogue:") {
            continue;
        }
        let rest = line.trim_start_matches("Dialogue:").trim();
        let parts: Vec<&str> = rest.splitn(10, ',').collect();
        if parts.len() < 10 {
            continue;
        }
        let Some(start) = parse_ass_ts_to_s(parts[1]) else {
            continue;
        };
        let Some(end) = parse_ass_ts_to_s(parts[2]) else {
            continue;
        };
        min_start = min_start.min(start);
        max_end = max_end.max(end);
        parsed.push((idx, start, end));
    }

    if parsed.is_empty() || min_start == f64::MAX || max_end <= min_start {
        return Ok(SubtitlesAlignReport {
            changed: false,
            delta_s_before: f64::MAX,
            delta_s_after: f64::MAX,
            max_delta_s,
            subtitles_duration_before_s: 0.0,
            subtitles_duration_after_s: 0.0,
            audio_duration_s: audio_dur,
            scale: 1.0,
        });
    }

    let sub_dur_before = (max_end - min_start).max(0.0);
    let delta_before = (sub_dur_before - audio_dur).abs();
    if delta_before <= max_delta_s {
        return Ok(SubtitlesAlignReport {
            changed: false,
            delta_s_before: delta_before,
            delta_s_after: delta_before,
            max_delta_s,
            subtitles_duration_before_s: sub_dur_before,
            subtitles_duration_after_s: sub_dur_before,
            audio_duration_s: audio_dur,
            scale: 1.0,
        });
    }

    // Lightweight retime: keep order, normalize timeline to start at 0, and scale to audio duration.
    let scale = (audio_dur / sub_dur_before).clamp(0.5, 2.0);
    let mut max_end_after = 0.0f64;
    for (idx, start, end) in parsed {
        let new_start = ((start - min_start).max(0.0) * scale).max(0.0);
        let mut new_end = ((end - min_start).max(0.0) * scale).max(new_start + 0.01);
        if new_end > audio_dur {
            new_end = audio_dur.max(new_start + 0.01);
        }
        max_end_after = max_end_after.max(new_end);

        let line = &lines[idx];
        let rest = line.trim_start_matches("Dialogue:").trim();
        let parts: Vec<&str> = rest.splitn(10, ',').collect();
        if parts.len() < 10 {
            continue;
        }
        let rebuilt = format!(
            "Dialogue: {},{},{},{},{},{},{},{},{},{}",
            parts[0].trim(),
            ass_ts(new_start),
            ass_ts(new_end),
            parts[3],
            parts[4],
            parts[5],
            parts[6],
            parts[7],
            parts[8],
            parts[9]
        );
        lines[idx] = rebuilt;
    }

    let rewritten = format!("{}\n", lines.join("\n"));
    tokio::fs::write(ass_path, rewritten).await?;
    validate_ass_output(ass_path).await?;

    let sub_dur_after = max_end_after.max(0.0);
    let delta_after = (sub_dur_after - audio_dur).abs();
    Ok(SubtitlesAlignReport {
        changed: true,
        delta_s_before: delta_before,
        delta_s_after: delta_after,
        max_delta_s,
        subtitles_duration_before_s: sub_dur_before,
        subtitles_duration_after_s: sub_dur_after,
        audio_duration_s: audio_dur,
        scale,
    })
}

fn normalize_manifest_code(value: &str) -> Option<String> {
    let normalized = value
        .trim()
        .to_lowercase()
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric() || *ch == '-' || *ch == '_')
        .collect::<String>();
    if normalized.is_empty() {
        None
    } else {
        Some(normalized)
    }
}

fn stage_target_lang(stage: &str, commands: &serde_json::Value, ui_lang: &str) -> String {
    stage
        .split('.')
        .nth(1)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| primary_lang(commands, ui_lang))
}

fn stage_lyrics_source_path(ctx: &EngineCtx, stage: &str, lang: &str) -> std::path::PathBuf {
    if stage.starts_with("subtitles.") || stage.starts_with("karaoke_ass.") {
        let timed = ctx.run_dir.join(format!("./lyrics_timed/{lang}.json"));
        if timed.exists() {
            return timed;
        }
        let versioned = ctx.run_dir.join(format!("./lyrics/{lang}.json"));
        if versioned.exists() {
            return versioned;
        }
    }
    lyrics_json_path(&ctx.run_dir)
}

fn stage_subtitle_output_path(ctx: &EngineCtx, stage: &str, lang: &str) -> std::path::PathBuf {
    if stage.starts_with("subtitles.") || stage.starts_with("karaoke_ass.") {
        ctx.run_dir.join(format!("./subtitles/{lang}.ass"))
    } else {
        subtitles_ass_path(&ctx.run_dir)
    }
}

fn stage_karaoke_output_path(ctx: &EngineCtx, stage: &str, lang: &str) -> std::path::PathBuf {
    if stage.starts_with("karaoke_ass.") {
        ctx.run_dir.join(format!("./karaoke/{lang}.ass"))
    } else {
        ctx.run_dir.join("./build/karaoke.ass")
    }
}

fn collect_requested_languages(commands: &serde_json::Value, ui_lang: &str) -> Vec<String> {
    let primary = primary_lang(commands, ui_lang);
    let mut ordered = Vec::new();
    let mut seen = BTreeSet::new();
    let push = |value: &str, ordered: &mut Vec<String>, seen: &mut BTreeSet<String>| {
        if let Some(lang) = normalize_manifest_code(value) {
            if seen.insert(lang.clone()) {
                ordered.push(lang);
            }
        }
    };
    push(&primary, &mut ordered, &mut seen);
    for pointer in [
        "/lyrics/track_languages",
        "/commands/lyrics/track_languages",
        "/lyrics/additional_languages",
        "/commands/lyrics/additional_languages",
    ] {
        if let Some(values) = commands.pointer(pointer).and_then(|value| value.as_array()) {
            for value in values {
                if let Some(lang) = value.as_str() {
                    push(lang, &mut ordered, &mut seen);
                }
            }
        }
    }
    ordered
}

fn collect_requested_voice_tracks(commands: &serde_json::Value) -> Vec<String> {
    let mut ordered = Vec::new();
    let mut seen = BTreeSet::new();
    for pointer in ["/creative/voice_tracks", "/commands/creative/voice_tracks"] {
        if let Some(values) = commands.pointer(pointer).and_then(|value| value.as_array()) {
            for value in values {
                if let Some(voice) = value.as_str().and_then(normalize_manifest_code) {
                    if seen.insert(voice.clone()) {
                        ordered.push(voice);
                    }
                }
            }
        }
    }
    if ordered.is_empty() {
        ordered.push("lead_default".to_string());
    }
    ordered
}

fn build_subtitle_track_entry(
    run_dir: &std::path::Path,
    kind: &str,
    language: &str,
    voice_lane: Option<&str>,
    path: &str,
    is_original: bool,
    billable_units: usize,
) -> serde_json::Value {
    let exists = run_dir.join(path.trim_start_matches("./")).exists();
    json!({
        "trackId": format!("{}.{}{}", kind, language, voice_lane.map(|voice| format!(".{voice}")).unwrap_or_default()),
        "kind": kind,
        "language": language,
        "voiceLane": voice_lane,
        "path": if exists { serde_json::Value::String(path.to_string()) } else { serde_json::Value::Null },
        "status": if exists { "available" } else { "requested" },
        "isOriginal": is_original,
        "burnIn": false,
        "billableBoostKind": if billable_units > 0 { "language" } else { "" },
        "billableUnits": billable_units,
    })
}

fn build_voice_delivery_entry(
    run_dir: &std::path::Path,
    language: &str,
    voice_lane: &str,
    billable_units: usize,
) -> serde_json::Value {
    let mix_path = format!("./mix/{language}/{voice_lane}.wav");
    let vocals_path = format!("./vocals/{language}/{voice_lane}.wav");
    let mv_path = format!("./render/{language}/{voice_lane}/final_mv.mp4");
    json!({
        "voiceLane": voice_lane,
        "language": language,
        "billableBoostKind": if billable_units > 0 { "voice" } else { "" },
        "billableUnits": billable_units,
        "mixPath": if run_dir.join(mix_path.trim_start_matches("./")).exists() { serde_json::Value::String(mix_path) } else { serde_json::Value::Null },
        "vocalsPath": if run_dir.join(vocals_path.trim_start_matches("./")).exists() { serde_json::Value::String(vocals_path) } else { serde_json::Value::Null },
        "mvPath": if run_dir.join(mv_path.trim_start_matches("./")).exists() { serde_json::Value::String(mv_path) } else { serde_json::Value::Null },
    })
}

fn voice_lane_matches_language(voice_lane: &str, language: &str) -> bool {
    voice_lane == format!("{language}_lead")
        || voice_lane.starts_with(&format!("{language}_"))
        || voice_lane == language
}

fn language_voice_bindings(
    requested_languages: &[String],
    requested_voice_tracks: &[String],
) -> Vec<serde_json::Value> {
    requested_languages
        .iter()
        .map(|language| {
            let matching = requested_voice_tracks
                .iter()
                .filter(|voice_lane| voice_lane_matches_language(voice_lane, language))
                .cloned()
                .collect::<Vec<_>>();
            let effective = if matching.is_empty() {
                vec![format!("{language}_lead")]
            } else {
                matching
            };
            json!({
                "language": language,
                "voiceTracks": effective,
            })
        })
        .collect()
}

pub async fn run_stage(
    ctx: &EngineCtx,
    commands: &serde_json::Value,
    ui_lang: &str,
    stage: &str,
) -> Result<()> {
    let lang = stage_target_lang(stage, commands, ui_lang);
    let primary = primary_lang(commands, ui_lang);
    let requested_languages = collect_requested_languages(commands, ui_lang);
    let requested_voice_tracks = collect_requested_voice_tracks(commands);
    let language_voice_bindings =
        language_voice_bindings(&requested_languages, &requested_voice_tracks);
    let lyrics = stage_lyrics_source_path(ctx, stage, &lang);
    let out = stage_subtitle_output_path(ctx, stage, &lang);
    let mix = mix_wav_path(&ctx.run_dir);
    let karaoke_timeline = ctx.run_dir.join("./build/karaoke.timeline.json");
    let karaoke_align_report = ctx.run_dir.join("./build/karaoke.align.report.json");
    let karaoke_ass = stage_karaoke_output_path(ctx, stage, &lang);
    let subtitle_delivery = ctx.run_dir.join("./build/subtitles.delivery.json");
    let lead_singing = lead_singing_voice_wav_path(&ctx.run_dir);
    let vocal_master = vocal_master_wav_path(&ctx.run_dir);

    let align_vocal_path = if tokio::fs::metadata(&lead_singing).await.is_ok() {
        Some(lead_singing.clone())
    } else if tokio::fs::metadata(&vocal_master).await.is_ok() {
        Some(vocal_master.clone())
    } else {
        None
    };

    if let Some(cmdline) = env_cmd("CSS_SUBTITLES_CMD") {
        run_cmd(
            &cmdline,
            &ctx.run_dir,
            &[
                ("CSS_STAGE_NAME", stage.to_string()),
                ("CSS_LANG", lang.clone()),
                ("CSS_LYRICS_JSON", lyrics.to_string_lossy().to_string()),
                ("CSS_OUT_ASS", out.to_string_lossy().to_string()),
                ("CSS_TITLE_HINT", title_hint(commands)),
            ],
        )
        .await?;
        if tokio::fs::metadata(&lyrics).await.is_ok()
            && (stage == "subtitles"
                || stage.starts_with("karaoke_ass.")
                || stage.starts_with("subtitles."))
        {
            let title_value = tokio::fs::read_to_string(&lyrics)
                .await
                .ok()
                .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
                .and_then(|value| crate::video::subtitles::extract_title_from_lyrics_value(&value));
            let mut timeline = crate::video::subtitles::write_karaoke_timeline_from_lyrics_json(
                &lyrics,
                &karaoke_timeline,
            );
            if let (Ok(ref mut cues), Some(vocal_path)) = (&mut timeline, align_vocal_path.as_ref())
            {
                if let Ok(report) = crate::video::subtitles::force_align_karaoke_timeline_to_vocals(
                    cues, vocal_path,
                )
                .await
                {
                    tokio::fs::write(&karaoke_timeline, serde_json::to_vec_pretty(cues)?).await?;
                    write_json(&karaoke_align_report, &serde_json::to_value(&report)?).await?;
                }
            }
            if let Ok(ref cues) = timeline {
                crate::video::subtitles::write_karaoke_ass_from_timeline(
                    cues,
                    &karaoke_ass,
                    title_value.as_deref(),
                )?;
            }
        }
        if tokio::fs::metadata(&mix).await.is_ok() {
            let align_report = auto_align_to_audio_once(
                &out,
                &mix,
                crate::quality_config::load_quality_config().max_subtitles_audio_delta_s,
            )
            .await?;
            let align_report_json = serde_json::to_value(&align_report)?;
            write_json(
                &ctx.run_dir.join("./build/subtitles.align.report.json"),
                &align_report_json,
            )
            .await?;
        }
        validate_ass_output(&out).await?;
        return Ok(());
    }

    if tokio::fs::metadata(&lyrics).await.is_ok() {
        let title_value = tokio::fs::read_to_string(&lyrics)
            .await
            .ok()
            .and_then(|raw| serde_json::from_str::<Value>(&raw).ok())
            .and_then(|value| crate::video::subtitles::extract_title_from_lyrics_value(&value));
        crate::video::subtitles::write_ass_from_lyrics_json(&lyrics, &out)?;
        let mut timeline = crate::video::subtitles::write_karaoke_timeline_from_lyrics_json(
            &lyrics,
            &karaoke_timeline,
        );
        if let (Ok(ref mut cues), Some(vocal_path)) = (&mut timeline, align_vocal_path.as_ref()) {
            if let Ok(report) =
                crate::video::subtitles::force_align_karaoke_timeline_to_vocals(cues, vocal_path)
                    .await
            {
                tokio::fs::write(&karaoke_timeline, serde_json::to_vec_pretty(cues)?).await?;
                write_json(&karaoke_align_report, &serde_json::to_value(&report)?).await?;
            }
        }
        if let Ok(ref cues) = timeline {
            crate::video::subtitles::write_karaoke_ass_from_timeline(
                cues,
                &karaoke_ass,
                title_value.as_deref(),
            )?;
        }
    } else {
        write_stub_ass(&out, &lang).await?;
    }
    if stage == "subtitles" || stage.starts_with("subtitles.") || stage.starts_with("karaoke_ass.")
    {
        write_json(
            &subtitle_delivery,
            &json!({
            "schema": "css.subtitles.delivery.v2",
            "burnIn": false,
            "separateTracksRequired": true,
            "primaryLanguage": primary,
            "currentStageLanguage": lang,
            "requestedLanguages": requested_languages,
            "requestedVoiceTracks": requested_voice_tracks,
            "languageVoiceBindings": language_voice_bindings,
            "tracks": [
                { "kind": "ass_plain", "path": "./build/subtitles.ass" },
                { "kind": "ass_karaoke", "path": "./build/karaoke.ass" },
                { "kind": "karaoke_timeline", "path": "./build/karaoke.timeline.json" }
            ],
            "subtitleTracks": requested_languages.iter().enumerate().flat_map(|(index, language)| {
                let is_original = language == &lang;
                let billable_units = if index == 0 { 0 } else { 1 };
                let mut entries = vec![];
                if is_original {
                    entries.push(build_subtitle_track_entry(&ctx.run_dir, "ass_plain", language, None, "./build/subtitles.ass", true, 0));
                    entries.push(build_subtitle_track_entry(&ctx.run_dir, "ass_karaoke", language, None, "./build/karaoke.ass", true, 0));
                    entries.push(build_subtitle_track_entry(&ctx.run_dir, "karaoke_timeline", language, None, "./build/karaoke.timeline.json", true, 0));
                }
                entries.push(build_subtitle_track_entry(&ctx.run_dir, "lyrics_json", language, None, &format!("./lyrics/{language}.json"), is_original, billable_units));
                entries.push(build_subtitle_track_entry(&ctx.run_dir, "ass_plain_versioned", language, None, &format!("./subtitles/{language}.ass"), is_original, billable_units));
                entries.push(build_subtitle_track_entry(&ctx.run_dir, "ass_karaoke_versioned", language, None, &format!("./karaoke/{language}.ass"), is_original, billable_units));
                entries
            }).collect::<Vec<_>>(),
            "voiceDeliveries": language_voice_bindings.iter().flat_map(|binding| {
                let language = binding
                    .get("language")
                    .and_then(|value| value.as_str())
                    .unwrap_or_default()
                    .to_string();
                let effective = binding
                    .get("voiceTracks")
                    .and_then(|value| value.as_array())
                    .cloned()
                    .unwrap_or_default()
                    .into_iter()
                    .filter_map(|value| value.as_str().map(ToString::to_string))
                    .collect::<Vec<_>>();
                effective.into_iter().enumerate().map(move |(index, voice_lane)| {
                    build_voice_delivery_entry(&ctx.run_dir, &language, &voice_lane, if index == 0 { 0 } else { 1 })
                })
            }).collect::<Vec<_>>(),
        }),
        )
        .await?;
    }
    if tokio::fs::metadata(&mix).await.is_ok() {
        let align_report = auto_align_to_audio_once(
            &out,
            &mix,
            crate::quality_config::load_quality_config().max_subtitles_audio_delta_s,
        )
        .await?;
        let align_report_json = serde_json::to_value(&align_report)?;
        write_json(
            &ctx.run_dir.join("./build/subtitles.align.report.json"),
            &align_report_json,
        )
        .await?;
    }
    validate_ass_output(&out).await?;
    Ok(())
}

pub async fn run(ctx: &EngineCtx, commands: &serde_json::Value, ui_lang: &str) -> Result<()> {
    run_stage(ctx, commands, ui_lang, "subtitles").await
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn collect_requested_languages_accepts_direct_command_shape() {
        let commands = json!({
            "lyrics": {
                "primary_lang": "zh",
                "track_languages": ["zh", "en", "ja"],
                "additional_languages": ["en", "ja"]
            }
        });
        let langs = collect_requested_languages(&commands, "zh");
        assert_eq!(langs, vec!["zh", "en", "ja"]);
    }

    #[test]
    fn language_voice_bindings_lock_each_language_to_its_voice_lane() {
        let bindings = language_voice_bindings(
            &["zh".to_string(), "en".to_string(), "ja".to_string()],
            &[
                "zh_lead".to_string(),
                "en_lead".to_string(),
                "ja_lead".to_string(),
            ],
        );
        assert_eq!(bindings.len(), 3);
        assert_eq!(bindings[0]["voiceTracks"][0].as_str(), Some("zh_lead"));
        assert_eq!(bindings[1]["voiceTracks"][0].as_str(), Some("en_lead"));
        assert_eq!(bindings[2]["voiceTracks"][0].as_str(), Some("ja_lead"));
    }
}
