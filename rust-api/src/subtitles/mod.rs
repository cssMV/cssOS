pub mod ass;
use std::path::{Path, PathBuf};

fn env_f64(k: &str, d: f64) -> f64 {
    std::env::var(k)
        .ok()
        .and_then(|v| v.parse::<f64>().ok())
        .unwrap_or(d)
}

pub fn ensure_ass_from_state(out_dir: &Path, cssl: &str) -> std::io::Result<PathBuf> {
    let burnin = std::env::var("CSS_SUBTITLES_BURNIN").unwrap_or_else(|_| "0".to_string());
    if burnin != "0" {
        return Ok(out_dir.join("build/subtitles.ass"));
    }
    let duration_s = env_f64("CSS_VIDEO_DURATION_S", 12.0);
    let mut lines = Vec::<String>::new();
    for s in cssl.split('\n') {
        let t = s.trim();
        if !t.is_empty() {
            lines.push(t.to_string());
        }
    }
    if lines.is_empty() {
        lines.push(String::new());
    }
    let path = out_dir.join("build/subtitles.ass");
    ass::write_ass(&path, &lines, duration_s)?;
    Ok(path)
}

pub fn write_ass_stub(run_dir: &Path) -> anyhow::Result<PathBuf> {
    let out_dir = run_dir.join("build").join("subtitles");
    std::fs::create_dir_all(&out_dir)?;
    let path = out_dir.join("subtitles.ass");
    if path.exists() {
        return Ok(path);
    }
    let s = r#"[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,42,&H00FFFFFF,&H000000FF,&H00101010,&H64000000,-1,0,0,0,100,100,0,0,1,2,0,2,80,80,60,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,0:00:02.00,Default,,0,0,0,,cssMV demo subtitles
"#;
    crate::run_state_io::atomic_write_text(&path, s)?;
    Ok(path)
}
