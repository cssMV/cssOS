use super::*;
use anyhow::Result;
use serde::{Deserialize, Serialize};

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

pub async fn run(ctx: &EngineCtx, commands: &serde_json::Value, ui_lang: &str) -> Result<()> {
    let lang = primary_lang(commands, ui_lang);
    let lyrics = lyrics_json_path(&ctx.run_dir);
    let out = subtitles_ass_path(&ctx.run_dir);

    if let Some(cmdline) = env_cmd("CSS_SUBTITLES_CMD") {
        run_cmd(
            &cmdline,
            &ctx.run_dir,
            &[
                ("CSS_LANG", lang.clone()),
                ("CSS_LYRICS_JSON", lyrics.to_string_lossy().to_string()),
                ("CSS_OUT_ASS", out.to_string_lossy().to_string()),
                ("CSS_TITLE_HINT", title_hint(commands)),
            ],
        )
        .await?;
        validate_ass_output(&out).await?;
        return Ok(());
    }

    write_stub_ass(&out, &lang).await?;
    validate_ass_output(&out).await?;
    Ok(())
}
