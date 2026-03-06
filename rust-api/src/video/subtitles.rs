use serde_json::Value;
use std::path::{Path, PathBuf};

fn file_ok(p: &Path) -> bool {
    std::fs::metadata(p)
        .map(|m| m.is_file() && m.len() > 0)
        .unwrap_or(false)
}

fn read_json(path: &Path) -> Option<Value> {
    let s = std::fs::read_to_string(path).ok()?;
    serde_json::from_str::<Value>(&s).ok()
}

fn collect_lines(v: &Value) -> Vec<String> {
    let mut out = Vec::<String>::new();

    if let Some(arr) = v.as_array() {
        for x in arr {
            if let Some(s) = x.as_str() {
                let t = s.trim();
                if !t.is_empty() {
                    out.push(t.to_string());
                }
                continue;
            }
            if let Some(s) = x.get("text").and_then(|t| t.as_str()) {
                let t = s.trim();
                if !t.is_empty() {
                    out.push(t.to_string());
                }
            }
        }
        if !out.is_empty() {
            return out;
        }
    }

    if let Some(lines) = v.get("lines").and_then(|x| x.as_array()) {
        for x in lines {
            if let Some(s) = x.get("text").and_then(|t| t.as_str()) {
                let t = s.trim();
                if !t.is_empty() {
                    out.push(t.to_string());
                }
            }
        }
        if !out.is_empty() {
            return out;
        }
    }

    if let Some(s) = v.get("text").and_then(|t| t.as_str()) {
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

    out
}

fn ass_time(t: f64) -> String {
    let mut x = if t.is_finite() { t } else { 0.0 };
    if x < 0.0 {
        x = 0.0;
    }
    let h = (x / 3600.0).floor() as u64;
    x -= (h as f64) * 3600.0;
    let m = (x / 60.0).floor() as u64;
    x -= (m as f64) * 60.0;
    let s = x.floor() as u64;
    let cs = ((x - (s as f64)) * 100.0).round() as u64;
    format!("{h}:{m:02}:{s:02}.{cs:02}")
}

fn ass_header(play_res_x: u32, play_res_y: u32) -> String {
    format!(
        "[Script Info]\nScriptType: v4.00+\nPlayResX: {x}\nPlayResY: {y}\nScaledBorderAndShadow: yes\nWrapStyle: 2\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,44,&H00FFFFFF,&H000000FF,&H001A1A1A,&H80000000,0,0,0,0,100,100,0,0,1,3,1,2,60,60,42,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n",
        x = play_res_x,
        y = play_res_y
    )
}

fn write_atomic(path: &Path, body: &str) -> std::io::Result<()> {
    let dir = path.parent().unwrap_or(Path::new("."));
    std::fs::create_dir_all(dir)?;
    let tmp = dir.join(format!(
        ".{}.tmp",
        path.file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("subtitles.ass")
    ));
    std::fs::write(&tmp, body.as_bytes())?;
    std::fs::rename(&tmp, path)?;
    Ok(())
}

fn esc_ass(s: &str) -> String {
    s.replace("{", "\\{")
        .replace("}", "\\}")
        .replace("\n", "\\N")
}

fn fmt_ts(t: f64) -> String {
    let mut x = t.max(0.0);
    let h = (x / 3600.0).floor() as i64;
    x -= (h as f64) * 3600.0;
    let m = (x / 60.0).floor() as i64;
    x -= (m as f64) * 60.0;
    let s = x.floor() as i64;
    let cs = ((x - (s as f64)) * 100.0).round() as i64;
    format!("{:01}:{:02}:{:02}.{:02}", h, m, s, cs)
}

pub fn write_ass_from_lyrics_json(lyrics_json: &Path, out_ass: &Path) -> anyhow::Result<()> {
    let v: Value = serde_json::from_str(&std::fs::read_to_string(lyrics_json)?)?;
    let mut lines: Vec<(f64, f64, String)> = Vec::new();

    if let Some(arr) = v.get("lines").and_then(|x| x.as_array()) {
        for it in arr {
            let s = it.get("start_s").and_then(|x| x.as_f64()).unwrap_or(0.0);
            let e = it.get("end_s").and_then(|x| x.as_f64()).unwrap_or(s + 2.0);
            let t = it
                .get("text")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            if !t.is_empty() {
                lines.push((s.max(0.0), e.max(s.max(0.0) + 0.01), t));
            }
        }
    } else if let Some(arr) = v.get("segments").and_then(|x| x.as_array()) {
        for it in arr {
            let s = it.get("start_s").and_then(|x| x.as_f64()).unwrap_or(0.0);
            let e = it.get("end_s").and_then(|x| x.as_f64()).unwrap_or(s + 2.0);
            let t = it
                .get("text")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            if !t.is_empty() {
                lines.push((s.max(0.0), e.max(s.max(0.0) + 0.01), t));
            }
        }
    }

    let header = r#"[Script Info]
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,54,&H00FFFFFF,&H000000FF,&H00202020,&H80000000,0,0,0,0,100,100,0,0,1,2.2,0.8,2,60,60,48,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"#;

    let mut body = String::new();
    for (i, (s, e, t)) in lines.iter().enumerate() {
        body.push_str(&format!(
            "Dialogue: 0,{},{},Default,,0,0,0,,{}\n",
            fmt_ts(*s),
            fmt_ts(*e),
            esc_ass(t)
        ));
        if i > 20000 {
            break;
        }
    }

    if body.is_empty() {
        body.push_str("Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,...\n");
    }

    if let Some(p) = out_ass.parent() {
        std::fs::create_dir_all(p)?;
    }
    std::fs::write(out_ass, format!("{}{}", header, body))?;
    Ok(())
}

pub fn default_ass_path(out_dir: &Path) -> PathBuf {
    out_dir.join("build").join("subtitles.ass")
}

pub fn ensure_ass_from_lyrics(
    run_dir: &Path,
    duration_s: f64,
    res_w: u32,
    res_h: u32,
) -> anyhow::Result<PathBuf> {
    let out = run_dir.join("build/subtitles.ass");
    if file_ok(&out) {
        return Ok(out);
    }

    let lyrics = run_dir.join("build/lyrics.json");
    let mut lines = Vec::<String>::new();
    if let Some(v) = read_json(&lyrics) {
        lines = collect_lines(&v);
    }
    if lines.is_empty() {
        lines.push("cssMV".to_string());
    }

    let total = if duration_s.is_finite() && duration_s > 0.1 {
        duration_s
    } else {
        30.0
    };

    let n = lines.len().max(1) as f64;
    let step = (total / n).max(1.0);

    let mut body = String::new();
    body.push_str(&ass_header(res_w, res_h));

    let mut t = 0.0;
    for s in lines {
        let start = t;
        let end = (t + step).min(total);
        t += step;
        let text = s
            .replace('\n', " ")
            .replace('\r', " ")
            .replace('{', "(")
            .replace('}', ")");

        body.push_str(&format!(
            "Dialogue: 0,{},{},Default,,0,0,0,,{}\n",
            ass_time(start),
            ass_time(end),
            text
        ));
    }

    write_atomic(&out, &body)?;
    Ok(out)
}
