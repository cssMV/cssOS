use anyhow::{anyhow, Result};
use serde_json::Value;
use std::path::{Path, PathBuf};
use tokio::fs;

fn ass_header() -> String {
    let mut s = String::new();
    s.push_str("[Script Info]\n");
    s.push_str("ScriptType: v4.00+\n");
    s.push_str("Collisions: Normal\n");
    s.push_str("PlayResX: 1280\n");
    s.push_str("PlayResY: 720\n");
    s.push_str("WrapStyle: 2\n");
    s.push_str("ScaledBorderAndShadow: yes\n");
    s.push('\n');
    s.push_str("[V4+ Styles]\n");
    s.push_str("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n");
    s.push_str("Style: Default,Arial,44,&H00FFFFFF,&H000000FF,&H00101010,&H00000000,0,0,0,0,100,100,0,0,1,2,0,2,80,80,60,1\n");
    s.push('\n');
    s.push_str("[Events]\n");
    s.push_str("Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n");
    s
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

fn esc_ass_text(s: &str) -> String {
    s.replace('\n', "\\N").replace('\r', "")
}

fn extract_lines(lyrics_json: &Value) -> Vec<String> {
    if let Some(arr) = lyrics_json.get("lines").and_then(|v| v.as_array()) {
        let mut out = Vec::new();
        for it in arr {
            if let Some(t) = it.get("text").and_then(|x| x.as_str()) {
                let t = t.trim();
                if !t.is_empty() {
                    out.push(t.to_string());
                }
            } else if let Some(t) = it.as_str() {
                let t = t.trim();
                if !t.is_empty() {
                    out.push(t.to_string());
                }
            }
        }
        if !out.is_empty() {
            return out;
        }
    }

    if let Some(s) = lyrics_json.get("text").and_then(|v| v.as_str()) {
        let mut out = Vec::new();
        for line in s.lines() {
            let t = line.trim();
            if !t.is_empty() {
                out.push(t.to_string());
            }
        }
        if !out.is_empty() {
            return out;
        }
    }

    Vec::new()
}

pub async fn write_ass_from_run(
    run_dir: &Path,
    _ui_lang: &str,
    duration_s: f64,
    out_rel: &Path,
) -> Result<PathBuf> {
    let out_abs = run_dir.join(out_rel);
    if let Some(p) = out_abs.parent() {
        fs::create_dir_all(p).await.ok();
    }

    let lyrics_path = run_dir.join("build/lyrics.json");
    let lines = if let Ok(s) = fs::read_to_string(&lyrics_path).await {
        if let Ok(v) = serde_json::from_str::<Value>(&s) {
            extract_lines(&v)
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    let mut events = String::new();
    let mut header = ass_header();

    let mut use_lines = lines;
    if use_lines.is_empty() {
        use_lines.push("cssMV".to_string());
    }

    let n = use_lines.len().max(1) as f64;
    let total = if duration_s.is_finite() && duration_s > 0.5 {
        duration_s
    } else {
        8.0
    };
    let step = (total / n).max(0.8);

    for (i, t) in use_lines.iter().enumerate() {
        let st = (i as f64) * step;
        let ed = ((i as f64) * step + step).min(total);
        let st_s = ass_ts(st);
        let ed_s = ass_ts(ed);
        events.push_str(&format!(
            "Dialogue: 0,{},{},Default,,0,0,0,,{}\n",
            st_s,
            ed_s,
            esc_ass_text(t)
        ));
    }

    header.push_str(&events);

    let body = header;
    crate::run_state_io::atomic_write_text(&out_abs, &body).await?;

    if fs::metadata(&out_abs)
        .await
        .map(|m| m.len() > 0)
        .unwrap_or(false)
    {
        Ok(out_rel.to_path_buf())
    } else {
        Err(anyhow!("subtitles.ass empty"))
    }
}
