use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use tokio::process::Command;

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

fn contains_cjk_text(input: &str) -> bool {
    input.chars().any(|ch| matches!(ch as u32, 0x3400..=0x9FFF | 0x3040..=0x30FF | 0xAC00..=0xD7AF))
}

fn trim_title_punctuation(value: &str) -> String {
    value
        .trim()
        .trim_matches(|ch: char| ch.is_whitespace() || "·-–—,:;|/()[]{}<>".contains(ch))
        .trim()
        .to_string()
}

fn split_display_title_lines(title: &str) -> Vec<String> {
    let raw = title.split_whitespace().collect::<Vec<_>>().join(" ");
    let raw = raw.trim();
    if raw.is_empty() {
        return vec![];
    }
    let explicit = raw
        .split(|ch| matches!(ch, '\n' | '|' | '｜' | '/'))
        .map(trim_title_punctuation)
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>();
    if explicit.len() >= 2 {
        return explicit.into_iter().take(2).collect();
    }
    let has_latin = raw.chars().any(|ch| ch.is_ascii_alphabetic());
    let has_cjk = contains_cjk_text(raw);
    if has_latin && has_cjk {
        let latin = trim_title_punctuation(
            &raw.chars()
                .map(|ch| if contains_cjk_text(&ch.to_string()) { ' ' } else { ch })
                .collect::<String>(),
        );
        let cjk = trim_title_punctuation(
            &raw.chars()
                .map(|ch| if ch.is_ascii_alphanumeric() || ch.is_ascii_punctuation() || ch.is_whitespace() { ' ' } else { ch })
                .collect::<String>(),
        );
        let mut out = Vec::new();
        if !latin.is_empty() {
            out.push(latin);
        }
        if !cjk.is_empty() {
            out.push(cjk);
        }
        if !out.is_empty() {
            return out;
        }
    }
    vec![raw.to_string()]
}

pub fn extract_title_from_lyrics_value(v: &Value) -> Option<String> {
    [
        v.get("title").and_then(|value| value.as_str()),
        v.get("song_title").and_then(|value| value.as_str()),
        v.get("meta")
            .and_then(|value| value.get("title"))
            .and_then(|value| value.as_str()),
    ]
    .into_iter()
    .flatten()
    .map(str::trim)
    .find(|value| !value.is_empty())
    .map(ToString::to_string)
}

fn title_ass_events(title: Option<&str>) -> String {
    let Some(title) = title.map(str::trim).filter(|value| !value.is_empty()) else {
        return String::new();
    };
    let lines = split_display_title_lines(title);
    if lines.is_empty() {
        return String::new();
    }
    let mut out = String::new();
    let first = escape_karaoke_text(&lines[0]);
    if lines.len() == 1 {
        out.push_str(&format!(
            "Dialogue: 3,0:00:00.15,0:00:03.80,TitleLatin,,0,0,0,,{{\\fad(150,220)\\blur0.6}}{}\n",
            first
        ));
        return out;
    }
    let second = escape_karaoke_text(&lines[1]);
    out.push_str(&format!(
        "Dialogue: 3,0:00:00.15,0:00:03.80,TitleLatin,,0,0,0,,{{\\fad(150,220)\\blur0.6}}{}\n",
        first
    ));
    out.push_str(&format!(
        "Dialogue: 3,0:00:00.34,0:00:03.80,TitleCjk,,0,0,0,,{{\\fad(180,220)\\blur0.8}}{}\n",
        second
    ));
    out
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

fn normalize_style_token(value: &str) -> String {
    value
        .chars()
        .filter(|ch| ch.is_ascii_alphanumeric())
        .collect::<String>()
}

fn karaoke_style_name(cue: &KaraokeCueTiming) -> &'static str {
    let section = cue
        .section
        .as_deref()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let summary = cue
        .scene_summary
        .as_deref()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let prompt = cue
        .shot_prompt
        .as_deref()
        .unwrap_or_default()
        .to_ascii_lowercase();
    let composite = format!("{section} {summary} {prompt}");
    if composite.contains("chorus") || composite.contains("hook") || composite.contains("anthem") {
        "Chorus"
    } else if composite.contains("bridge")
        || composite.contains("lift")
        || composite.contains("break")
    {
        "Bridge"
    } else if composite.contains("outro")
        || composite.contains("ending")
        || composite.contains("epilogue")
    {
        "Outro"
    } else if composite.contains("awakening")
        || composite.contains("memory")
        || composite.contains("reveal")
        || composite.contains("觉醒")
        || composite.contains("记忆")
    {
        "Reveal"
    } else {
        "Verse"
    }
}

fn karaoke_word_fx(style: &str, word_index: usize, total_words: usize) -> &'static str {
    let is_last = total_words > 0 && word_index + 1 == total_words;
    match style {
        "Chorus" if is_last => "{\\bord3.2\\shad1.2\\fscx108\\fscy108}",
        "Reveal" if is_last => "{\\bord3.0\\1c&H00FFF8D8&\\2c&H0070FFD5&}",
        "Bridge" if word_index == 0 => "{\\i1\\fsp1}",
        "Outro" if is_last => "{\\alpha&H10&\\fsp2}",
        _ => "",
    }
}

fn karaoke_word_emphasis_fx(word: &str, style: &str) -> &'static str {
    let lower = word.trim().to_ascii_lowercase();
    if lower.is_empty() {
        return "";
    }
    if lower.contains('!') || lower == "fire" || lower == "rise" || lower == "醒" || lower == "光"
    {
        return match style {
            "Chorus" => "{\\1c&H00F6FFE8&\\bord3.6\\shad1.4}",
            "Reveal" => "{\\1c&H00FFF8D8&\\2c&H0070FFD5&\\bord3.4}",
            _ => "{\\bord3.0}",
        };
    }
    if lower == "no" || lower == "not" || lower == "never" || lower == "无" || lower == "不" {
        return "{\\i1\\alpha&H08&}";
    }
    if lower == "world" || lower == "memory" || lower == "命运" || lower == "世界" {
        return "{\\fsp1\\bord2.8}";
    }
    ""
}

fn karaoke_word_rhythm_fx(
    word_index: usize,
    total_words: usize,
    word_duration_s: f64,
    style: &str,
) -> String {
    let quick = word_duration_s <= 0.16;
    let held = word_duration_s >= 0.42;
    let first = word_index == 0;
    let last = total_words > 0 && word_index + 1 == total_words;
    if held {
        return match style {
            "Chorus" => "{\\fscx112\\fscy112\\bord3.4}".to_string(),
            "Reveal" => "{\\fscx108\\fscy108\\blur0.4}".to_string(),
            _ => "{\\fscx104\\fscy104}".to_string(),
        };
    }
    if quick {
        return match style {
            "Bridge" => "{\\fsp1.4\\fscx96\\fscy96}".to_string(),
            "Chorus" => "{\\fsp0.8\\fscx98\\fscy98}".to_string(),
            _ => "{\\fsp0.6}".to_string(),
        };
    }
    if first {
        return "{\\fscx103\\fscy103}".to_string();
    }
    if last {
        return "{\\alpha&H04&}".to_string();
    }
    String::new()
}

fn karaoke_word_weight(word: &str, total_words: usize, word_index: usize) -> f64 {
    let trimmed = word.trim();
    if trimmed.is_empty() {
        return 1.0;
    }
    let char_weight = trimmed.chars().count().max(1) as f64;
    let mut weight = char_weight;
    if trimmed.ends_with('!') || trimmed.ends_with('?') {
        weight += 1.8;
    }
    if trimmed.ends_with('…') || trimmed.ends_with('.') || trimmed.ends_with('。') {
        weight += 1.1;
    }
    let lower = trimmed.to_ascii_lowercase();
    if [
        "love", "fire", "light", "alive", "rise", "fall", "stay", "heart", "dream",
    ]
    .contains(&lower.as_str())
        || ["爱", "火", "光", "醒", "梦", "心", "你", "我"]
            .iter()
            .any(|token| trimmed.contains(token))
    {
        weight += 1.4;
    }
    if total_words > 0 && word_index + 1 == total_words {
        weight += 0.8;
    }
    weight.max(0.8)
}

fn karaoke_word_color_flow_fx(style: &str, word_index: usize, total_words: usize) -> String {
    if total_words == 0 {
        return String::new();
    }
    let progress = word_index as f32 / total_words.max(1) as f32;
    match style {
        "Chorus" if progress < 0.34 => "{\\1c&H00E8FFF4&}".to_string(),
        "Chorus" if progress < 0.67 => "{\\1c&H00C8FFB8&}".to_string(),
        "Chorus" => "{\\1c&H008CFF86&}".to_string(),
        "Reveal" if progress < 0.5 => "{\\1c&H00FFF2CF&}".to_string(),
        "Reveal" => "{\\1c&H00C5FFF0&}".to_string(),
        "Bridge" if progress > 0.66 => "{\\1c&H0096D5FF&}".to_string(),
        "Outro" if word_index + 1 == total_words => "{\\alpha&H12&\\1c&H00E0D8FF&}".to_string(),
        _ => String::new(),
    }
}

fn karaoke_word_gradient_fx(
    style: &str,
    word_index: usize,
    total_words: usize,
    word_duration_s: f64,
) -> String {
    if total_words == 0 {
        return String::new();
    }
    let tail_word = word_index + 1 == total_words;
    let heavy_hold = word_duration_s >= 0.48;
    match style {
        "Chorus" if heavy_hold && tail_word => "{\\bord4.0\\blur0.6\\1c&H007BFF84&}".to_string(),
        "Chorus" if heavy_hold => "{\\bord3.4\\blur0.4\\1c&H00A8FF9C&}".to_string(),
        "Reveal" if heavy_hold => "{\\bord3.6\\blur0.7\\1c&H00FFF0C5&}".to_string(),
        "Bridge" if word_index == 0 => "{\\i1\\blur0.4\\1c&H00FFC98A&}".to_string(),
        "Outro" if tail_word => "{\\alpha&H10&\\blur0.8\\1c&H00E6D8FF&}".to_string(),
        _ => String::new(),
    }
}

fn karaoke_word_stage_glow_fx(
    word: &str,
    style: &str,
    word_index: usize,
    total_words: usize,
    word_duration_s: f64,
) -> String {
    let lower = word.trim().to_ascii_lowercase();
    if lower.is_empty() || total_words == 0 {
        return String::new();
    }
    let progress = word_index as f32 / total_words.max(1) as f32;
    let heavy = word_duration_s >= 0.4;
    let awakening = [
        "wake", "alive", "rise", "light", "memory", "醒", "光", "记忆", "命运",
    ]
    .iter()
    .any(|token| lower.contains(token) || word.contains(token));
    let intimate = ["you", "me", "heart", "stay", "你", "我", "心", "爱"]
        .iter()
        .any(|token| lower.contains(token) || word.contains(token));
    match style {
        "Chorus" if awakening && heavy => {
            "{\\t(0,120,\\blur0.7\\bord4.2)\\t(120,260,\\blur0.2\\bord3.1)\\1c&H007BFF84&}"
                .to_string()
        }
        "Reveal" if awakening => {
            "{\\t(0,160,\\fscx114\\fscy114)\\1c&H00FFF3D8&\\2c&H00C7FFF6&}".to_string()
        }
        "Bridge" if intimate && heavy => {
            "{\\t(0,140,\\alpha&H02&)\\1c&H00FFD0A2&\\fsp1.4}".to_string()
        }
        "Outro" if progress > 0.58 => {
            "{\\t(0,180,\\alpha&H12&)\\blur1.0\\1c&H00DCCEFF&}".to_string()
        }
        _ => String::new(),
    }
}

fn karaoke_word_pulse_flash_fx(
    style: &str,
    word_index: usize,
    total_words: usize,
    word_duration_s: f64,
) -> String {
    if total_words == 0 {
        return String::new();
    }
    let progress = word_index as f32 / total_words.max(1) as f32;
    let held = word_duration_s >= 0.42;
    match style {
        "Chorus" if held && progress > 0.45 => {
            "{\\t(0,90,\\fscx122\\fscy122)\\t(90,220,\\fscx104\\fscy104)\\3c&H0032FF76&}"
                .to_string()
        }
        "Reveal" if held => {
            "{\\t(0,110,\\bord4.8\\blur0.8)\\t(110,240,\\bord3.2\\blur0.3)\\3c&H00FFF2CF&}"
                .to_string()
        }
        "Bridge" if progress < 0.34 => {
            "{\\t(0,120,\\fsp2.2)\\t(120,240,\\fsp0.6)\\1c&H00FFD39A&}".to_string()
        }
        "Outro" if progress > 0.72 => {
            "{\\t(0,180,\\alpha&H16&)\\t(180,320,\\alpha&H08&)\\1c&H00D9CEFF&}".to_string()
        }
        _ => String::new(),
    }
}

fn karaoke_word_spotlight_fx(
    style: &str,
    word: &str,
    word_index: usize,
    total_words: usize,
    word_duration_s: f64,
) -> String {
    if total_words == 0 {
        return String::new();
    }
    let lower = word.trim().to_ascii_lowercase();
    let progress = word_index as f32 / total_words.max(1) as f32;
    let held = word_duration_s >= 0.40;
    let decisive = [
        "wake", "rise", "light", "break", "name", "醒", "起", "光", "破", "名",
    ]
    .iter()
    .any(|token| lower.contains(token) || word.contains(token));
    match style {
        "Chorus" if decisive && held => {
            "{\\t(0,120,\\bord5.2\\blur1.1\\fscx126\\fscy126)\\t(120,280,\\bord3.6\\blur0.4\\fscx106\\fscy106)\\3c&H002BFF75&}".to_string()
        }
        "Reveal" if decisive => {
            "{\\t(0,160,\\alpha&H02&\\fscx118\\fscy118)\\t(160,320,\\alpha&H10&\\fscx104\\fscy104)\\1c&H00FFF4D8&\\2c&H00AFFFF1&}".to_string()
        }
        "Bridge" if progress > 0.5 && held => {
            "{\\t(0,140,\\fsp2.6\\blur0.9)\\t(140,320,\\fsp0.9\\blur0.3)\\1c&H00FFD9AB&}".to_string()
        }
        "Outro" if progress > 0.72 => {
            "{\\t(0,220,\\alpha&H12&\\blur1.2)\\t(220,360,\\alpha&H04&\\blur0.6)\\1c&H00E6D8FF&}".to_string()
        }
        _ => String::new(),
    }
}

fn karaoke_word_emotion_flow_fx(
    word: &str,
    style: &str,
    word_index: usize,
    total_words: usize,
    word_duration_s: f64,
) -> String {
    if total_words == 0 {
        return String::new();
    }
    let lower = word.trim().to_ascii_lowercase();
    let progress = word_index as f32 / total_words.max(1) as f32;
    let held = word_duration_s >= 0.36;
    let emphatic = lower.contains('!') || lower.contains('?');
    let intimate = ["love", "heart", "stay", "near", "你", "我", "爱", "心"]
        .iter()
        .any(|token| lower.contains(token) || word.contains(token));
    let awakening = ["fire", "light", "rise", "wake", "alive", "光", "醒", "火"]
        .iter()
        .any(|token| lower.contains(token) || word.contains(token));
    match style {
        "Chorus" if emphatic || awakening => {
            "{\\t(0,120,\\fscx118\\fscy118)\\t(120,280,\\fscx102\\fscy102)\\1c&H0075FF78&\\bord4.2}"
                .to_string()
        }
        "Chorus" if held && progress > 0.45 => {
            "{\\t(0,160,\\fscx112\\fscy112)\\1c&H0090FF82&\\blur0.5}".to_string()
        }
        "Reveal" if intimate => {
            "{\\t(0,140,\\fscx110\\fscy110)\\1c&H00FFF3DA&\\2c&H00B4FFF0&}".to_string()
        }
        "Bridge" if held => "{\\t(0,160,\\fscx108\\fscy108)\\1c&H00FFD39A&\\fsp1.2}".to_string(),
        "Outro" if progress > 0.6 => {
            "{\\t(0,180,\\alpha&H08&)\\1c&H00E2D8FF&\\blur0.8}".to_string()
        }
        _ => String::new(),
    }
}

fn esc_ass(s: &str) -> String {
    s.replace("{", "\\{")
        .replace("}", "\\}")
        .replace("\n", "\\N")
}

fn escape_karaoke_text(s: &str) -> String {
    esc_ass(s).replace("\\N", " ")
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KaraokeWordTiming {
    pub text: String,
    pub start_s: f64,
    pub end_s: f64,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub emotion: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub emphasis: Option<f32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub pause_after_s: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KaraokeCueTiming {
    pub cue_id: String,
    pub text: String,
    pub start_s: f64,
    pub end_s: f64,
    pub section: Option<String>,
    pub scene_summary: Option<String>,
    pub shot_prompt: Option<String>,
    pub words: Vec<KaraokeWordTiming>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KaraokeAlignReport {
    pub changed: bool,
    pub cue_count: usize,
    pub word_count: usize,
    pub aligned_word_count: usize,
    pub audio_path: String,
}

fn normalize_timed_lyric_lines(v: &Value) -> Vec<(f64, Option<f64>, Option<String>, String)> {
    let mut out = Vec::new();
    let raw_lines = v
        .get("lines")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();
    for it in raw_lines {
        let start_s = it
            .get("start_s")
            .or_else(|| it.get("t"))
            .and_then(|x| x.as_f64())
            .unwrap_or(0.0)
            .max(0.0);
        let end_s = it.get("end_s").and_then(|x| x.as_f64());
        let section = it
            .get("section")
            .and_then(|x| x.as_str())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        let text = it
            .get("text")
            .and_then(|x| x.as_str())
            .unwrap_or("")
            .trim()
            .to_string();
        if !text.is_empty() {
            out.push((start_s, end_s, section, text));
        }
    }
    out.sort_by(|left, right| {
        left.0
            .partial_cmp(&right.0)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    out
}

fn section_video_script_map(
    v: &Value,
) -> std::collections::HashMap<String, (f64, f64, Option<String>, Option<String>)> {
    let mut out = std::collections::HashMap::new();
    let Some(items) = v.get("video_script").and_then(|x| x.as_array()) else {
        return out;
    };
    for item in items {
        let Some(section) = item
            .get("section")
            .and_then(|x| x.as_str())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
        else {
            continue;
        };
        let start_s = item.get("start_s").and_then(|x| x.as_f64()).unwrap_or(0.0);
        let end_s = item
            .get("end_s")
            .and_then(|x| x.as_f64())
            .unwrap_or(start_s + 2.0);
        let summary = item
            .get("summary")
            .and_then(|x| x.as_str())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        let shot_prompt = item
            .get("shot_prompt")
            .and_then(|x| x.as_str())
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty());
        out.insert(
            section,
            (
                start_s.max(0.0),
                end_s.max(start_s + 0.1),
                summary,
                shot_prompt,
            ),
        );
    }
    out
}

fn split_words_for_karaoke(text: &str) -> Vec<String> {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    let has_space_tokens = trimmed
        .split_whitespace()
        .filter(|part| !part.trim().is_empty())
        .count()
        > 1;
    if has_space_tokens {
        return trimmed
            .split_whitespace()
            .map(|part| part.trim_matches(|ch: char| ch.is_whitespace()).to_string())
            .filter(|part| !part.is_empty())
            .collect();
    }

    let mut out = Vec::new();
    let mut buffer = String::new();
    for ch in trimmed.chars() {
        if ch.is_ascii_alphanumeric() {
            buffer.push(ch);
            continue;
        }
        if !buffer.is_empty() {
            out.push(buffer.clone());
            buffer.clear();
        }
        if !ch.is_whitespace() {
            out.push(ch.to_string());
        }
    }
    if !buffer.is_empty() {
        out.push(buffer);
    }
    out.into_iter()
        .filter(|part| !part.trim().is_empty())
        .collect()
}

fn build_word_timings(text: &str, start_s: f64, end_s: f64) -> Vec<KaraokeWordTiming> {
    let words = split_words_for_karaoke(text);
    if words.is_empty() {
        return Vec::new();
    }
    let total_span = (end_s - start_s).max(0.12);
    let gap_budget = build_performance_gap_budget(&words, total_span);
    let total_weight = words
        .iter()
        .enumerate()
        .map(|(index, word)| karaoke_word_weight(word, words.len(), index))
        .sum::<f64>()
        .max(1.0);
    let voiced_span = (total_span - gap_budget.iter().sum::<f64>()).max(words.len() as f64 * 0.04);
    let mut cursor = start_s;
    let mut out = Vec::new();
    for (index, word) in words.iter().enumerate() {
        let weight = karaoke_word_weight(word, words.len(), index);
        let slice = if index + 1 == words.len() {
            end_s.max(cursor + 0.04)
        } else {
            cursor + voiced_span * (weight / total_weight)
        };
        let word_end = slice.max(cursor + 0.04).min(end_s.max(cursor + 0.04));
        let pause_after_s = gap_budget.get(index).copied().unwrap_or(0.0);
        out.push(KaraokeWordTiming {
            text: word.clone(),
            start_s: cursor.max(0.0),
            end_s: word_end.max(cursor + 0.04),
            emotion: Some(classify_karaoke_word_emotion(word, words.len(), index)),
            emphasis: Some(classify_karaoke_word_emphasis(word, words.len(), index)),
            pause_after_s: (pause_after_s > 0.0).then_some(pause_after_s),
        });
        cursor = (word_end + pause_after_s).min(end_s);
    }
    if let Some(last) = out.last_mut() {
        last.end_s = end_s.max(last.start_s + 0.04);
        last.pause_after_s = None;
    }
    out
}

fn build_performance_gap_budget(words: &[String], total_span: f64) -> Vec<f64> {
    if words.is_empty() {
        return Vec::new();
    }
    let mut weights = vec![0.0_f64; words.len()];
    for (index, word) in words.iter().enumerate() {
        if index + 1 == words.len() {
            continue;
        }
        let trimmed = word.trim();
        if trimmed.is_empty() {
            continue;
        }
        let mut weight = 0.0_f64;
        if trimmed.ends_with(',') || trimmed.ends_with('，') || trimmed.ends_with('、') {
            weight += 1.0;
        }
        if trimmed.ends_with(';')
            || trimmed.ends_with('；')
            || trimmed.ends_with(':')
            || trimmed.ends_with('：')
        {
            weight += 1.4;
        }
        if trimmed.ends_with('.')
            || trimmed.ends_with('。')
            || trimmed.ends_with('!')
            || trimmed.ends_with('！')
        {
            weight += 1.8;
        }
        if trimmed.ends_with('?') || trimmed.ends_with('？') || trimmed.ends_with('…') {
            weight += 2.1;
        }
        if trimmed.len() >= 8 {
            weight += 0.2;
        }
        weights[index] = weight;
    }
    let total_weight = weights.iter().sum::<f64>();
    if total_weight <= 0.0 {
        return weights;
    }
    let total_gap_budget = (total_span * 0.22).min(total_weight * 0.12);
    weights
        .into_iter()
        .map(|weight| {
            if weight <= 0.0 {
                0.0
            } else {
                total_gap_budget * (weight / total_weight)
            }
        })
        .collect()
}

fn classify_karaoke_word_emotion(word: &str, total_words: usize, word_index: usize) -> String {
    let lower = word.trim().to_ascii_lowercase();
    if ["love", "heart", "stay", "near", "你", "我", "爱", "心"]
        .iter()
        .any(|token| lower.contains(token) || word.contains(token))
    {
        return "intimate".to_string();
    }
    if ["fire", "light", "rise", "wake", "alive", "光", "醒", "火"]
        .iter()
        .any(|token| lower.contains(token) || word.contains(token))
    {
        return "ignite".to_string();
    }
    if total_words > 0 && word_index + 1 == total_words {
        return "resolve".to_string();
    }
    if word_index == 0 {
        return "lift".to_string();
    }
    "flow".to_string()
}

fn classify_karaoke_word_emphasis(word: &str, total_words: usize, word_index: usize) -> f32 {
    let mut emphasis = karaoke_word_weight(word, total_words, word_index) as f32 / 4.0;
    if word_index == 0 {
        emphasis += 0.08;
    }
    if total_words > 0 && word_index + 1 == total_words {
        emphasis += 0.12;
    }
    emphasis.clamp(0.18, 1.0)
}

async fn decode_audio_mono_pcm(path: &Path, sample_rate_hz: u32) -> anyhow::Result<Vec<f32>> {
    let out = Command::new(std::env::var("CSS_FFMPEG").unwrap_or_else(|_| "ffmpeg".to_string()))
        .arg("-v")
        .arg("error")
        .arg("-i")
        .arg(path)
        .arg("-ac")
        .arg("1")
        .arg("-ar")
        .arg(sample_rate_hz.to_string())
        .arg("-f")
        .arg("f32le")
        .arg("-")
        .output()
        .await?;
    if !out.status.success() {
        return Err(anyhow::anyhow!(
            "ffmpeg pcm decode failed: {}",
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(out
        .stdout
        .chunks_exact(4)
        .map(|bytes| f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
        .collect())
}

fn rms_windows(
    samples: &[f32],
    sample_rate_hz: u32,
    frame_ms: f64,
    hop_ms: f64,
) -> Vec<(f64, f64)> {
    let frame = ((sample_rate_hz as f64 * frame_ms / 1000.0).round() as usize).max(128);
    let hop = ((sample_rate_hz as f64 * hop_ms / 1000.0).round() as usize).max(64);
    let mut out = Vec::new();
    let mut start = 0usize;
    while start + frame <= samples.len() {
        let slice = &samples[start..start + frame];
        let rms = (slice
            .iter()
            .map(|sample| (*sample as f64) * (*sample as f64))
            .sum::<f64>()
            / slice.len() as f64)
            .sqrt();
        let center_s = (start + frame / 2) as f64 / sample_rate_hz as f64;
        out.push((center_s, rms));
        start += hop;
    }
    out
}

fn retime_words_by_energy(
    words: &[KaraokeWordTiming],
    windows: &[(f64, f64)],
    cue_start_s: f64,
    cue_end_s: f64,
) -> Vec<KaraokeWordTiming> {
    if words.is_empty() {
        return Vec::new();
    }
    let active: Vec<(f64, f64)> = windows
        .iter()
        .copied()
        .filter(|(time_s, _)| *time_s >= cue_start_s && *time_s <= cue_end_s)
        .collect();
    if active.len() < words.len().max(2) {
        return words.to_vec();
    }
    let mut weights = vec![0.0_f64; words.len()];
    for (time_s, energy) in &active {
        let pos = ((*time_s - cue_start_s) / (cue_end_s - cue_start_s).max(0.12)).clamp(0.0, 0.999);
        let slot = ((pos * words.len() as f64).floor() as usize).min(words.len() - 1);
        weights[slot] += *energy;
    }
    let fallback_weight = 1.0 / words.len() as f64;
    let total_weight = weights
        .iter()
        .map(|weight| {
            if *weight > 1e-6 {
                *weight
            } else {
                fallback_weight
            }
        })
        .sum::<f64>()
        .max(1e-6);
    let gap_budget = words
        .iter()
        .map(|word| word.pause_after_s.unwrap_or(0.0))
        .collect::<Vec<_>>();
    let voiced_span = ((cue_end_s - cue_start_s).max(0.12) - gap_budget.iter().sum::<f64>())
        .max(words.len() as f64 * 0.04);
    let mut cursor = cue_start_s;
    let mut out = Vec::new();
    for (index, word) in words.iter().enumerate() {
        let weight = if weights[index] > 1e-6 {
            weights[index]
        } else {
            fallback_weight
        };
        let word_end = if index + 1 == words.len() {
            cue_end_s
        } else {
            cursor + voiced_span * (weight / total_weight)
        };
        let pause_after_s = gap_budget.get(index).copied().unwrap_or(0.0);
        out.push(KaraokeWordTiming {
            text: word.text.clone(),
            start_s: cursor.max(cue_start_s),
            end_s: word_end
                .max(cursor + 0.04)
                .min(cue_end_s.max(cursor + 0.04)),
            emotion: word.emotion.clone(),
            emphasis: word.emphasis,
            pause_after_s: (pause_after_s > 0.0).then_some(pause_after_s),
        });
        cursor = out
            .last()
            .map(|item| (item.end_s + pause_after_s).min(cue_end_s))
            .unwrap_or(cursor);
    }
    if let Some(last) = out.last_mut() {
        last.end_s = cue_end_s.max(last.start_s + 0.04);
        last.pause_after_s = None;
    }
    out
}

pub async fn force_align_karaoke_timeline_to_vocals(
    timeline: &mut [KaraokeCueTiming],
    vocal_wav: &Path,
) -> anyhow::Result<KaraokeAlignReport> {
    let samples = decode_audio_mono_pcm(vocal_wav, 16_000).await?;
    let windows = rms_windows(&samples, 16_000, 28.0, 12.0);
    let cue_count = timeline.len();
    let mut word_count = 0usize;
    let mut aligned_word_count = 0usize;
    for cue in timeline.iter_mut() {
        word_count += cue.words.len();
        if cue.words.len() < 2 {
            continue;
        }
        let retimed = retime_words_by_energy(&cue.words, &windows, cue.start_s, cue.end_s);
        if retimed.len() == cue.words.len() {
            aligned_word_count += retimed.len();
            cue.words = retimed;
        }
    }
    Ok(KaraokeAlignReport {
        changed: aligned_word_count > 0,
        cue_count,
        word_count,
        aligned_word_count,
        audio_path: vocal_wav.display().to_string(),
    })
}

pub fn build_karaoke_timeline_from_lyrics_value(v: &Value) -> Vec<KaraokeCueTiming> {
    let timed_lines = normalize_timed_lyric_lines(v);
    let section_map = section_video_script_map(v);
    let mut out = Vec::new();

    for (index, (start_s, explicit_end_s, section, text)) in timed_lines.iter().enumerate() {
        let fallback_end = timed_lines
            .get(index + 1)
            .map(|next| next.0)
            .unwrap_or_else(|| {
                section
                    .as_ref()
                    .and_then(|key| section_map.get(key).map(|entry| entry.1))
                    .unwrap_or(start_s + 2.4)
            });
        let section_end = section
            .as_ref()
            .and_then(|key| section_map.get(key).map(|entry| entry.1))
            .unwrap_or(fallback_end);
        let end_s = explicit_end_s
            .unwrap_or(fallback_end.min(section_end))
            .max(start_s + 0.12);
        let scene_summary = section
            .as_ref()
            .and_then(|key| section_map.get(key).and_then(|entry| entry.2.clone()));
        let shot_prompt = section
            .as_ref()
            .and_then(|key| section_map.get(key).and_then(|entry| entry.3.clone()));
        out.push(KaraokeCueTiming {
            cue_id: format!("cue_{index:03}"),
            text: text.clone(),
            start_s: *start_s,
            end_s,
            section: section.clone(),
            scene_summary,
            shot_prompt,
            words: build_word_timings(text, *start_s, end_s),
        });
    }

    out
}

pub fn write_karaoke_timeline_from_lyrics_json(
    lyrics_json: &Path,
    out_json: &Path,
) -> anyhow::Result<Vec<KaraokeCueTiming>> {
    let v: Value = serde_json::from_str(&std::fs::read_to_string(lyrics_json)?)?;
    let timeline = build_karaoke_timeline_from_lyrics_value(&v);
    if let Some(parent) = out_json.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(out_json, serde_json::to_vec_pretty(&timeline)?)?;
    Ok(timeline)
}

pub fn write_karaoke_ass_from_timeline(
    timeline: &[KaraokeCueTiming],
    out_ass: &Path,
    title: Option<&str>,
) -> anyhow::Result<()> {
    let header = r#"[Script Info]
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,HengShanMaoBiCaoShu,54,&H00D4FFF6,&H00FFF8C4,&H00141414,&H80000000,0,0,0,0,100,100,0,0,1,2.2,0.8,2,60,60,48,1
Style: Verse,HengShanMaoBiCaoShu,54,&H00D4FFF6,&H00FFF8C4,&H00141414,&H80000000,0,0,0,0,100,100,0,0,1,2.2,0.8,2,60,60,48,1
Style: Chorus,HengShanMaoBiCaoShu,58,&H00F6FFE8,&H0080FF9F,&H00101010,&H80000000,1,0,0,0,100,100,0.6,0,1,2.6,1.0,2,54,54,44,1
Style: Bridge,HengShanMaoBiCaoShu,52,&H00FFE5C1,&H00FFB56B,&H00161616,&H80000000,0,1,0,0,100,100,0.4,0,1,2.4,0.8,2,64,64,52,1
Style: Outro,HengShanMaoBiCaoShu,50,&H00E2E2FF,&H00B7A6FF,&H00181820,&H80000000,0,0,0,0,100,100,0.2,0,1,2.2,0.8,2,70,70,60,1
Style: Reveal,HengShanMaoBiCaoShu,56,&H00FFF8D8,&H0070FFD5,&H00121212,&H80000000,1,0,0,0,100,100,0.5,0,1,2.8,1.0,2,56,56,46,1
Style: TitleLatin,Syne,54,&H00F8FFF8,&H00D6FFF2,&H00100E12,&H44000000,1,0,0,0,100,100,8,0,1,3.4,0.8,8,86,86,88,1
Style: TitleCjk,HengShanMaoBiCaoShu,60,&H00FFF4D9,&H00D5FFF2,&H00100E12,&H44000000,1,0,0,0,100,100,4,0,1,3.6,1.0,8,86,86,132,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"#;
    let mut body = String::new();
    body.push_str(&title_ass_events(title));
    for cue in timeline {
        let text = if cue.words.is_empty() {
            escape_karaoke_text(&cue.text)
        } else {
            let style_name = karaoke_style_name(cue);
            let total_words = cue.words.len();
            cue.words
                .iter()
                .enumerate()
                .map(|(word_index, word)| {
                    let dur_cs = ((word.end_s - word.start_s).max(0.04) * 100.0).round() as i64;
                    let rhythm_fx = karaoke_word_rhythm_fx(
                        word_index,
                        total_words,
                        (word.end_s - word.start_s).max(0.0),
                        style_name,
                    );
                    let color_flow_fx =
                        karaoke_word_color_flow_fx(style_name, word_index, total_words);
                    let gradient_fx = karaoke_word_gradient_fx(
                        style_name,
                        word_index,
                        total_words,
                        (word.end_s - word.start_s).max(0.0),
                    );
                    let emotion_fx = karaoke_word_emotion_flow_fx(
                        &word.text,
                        style_name,
                        word_index,
                        total_words,
                        (word.end_s - word.start_s).max(0.0),
                    );
                    let stage_glow_fx = karaoke_word_stage_glow_fx(
                        &word.text,
                        style_name,
                        word_index,
                        total_words,
                        (word.end_s - word.start_s).max(0.0),
                    );
                    let pulse_flash_fx = karaoke_word_pulse_flash_fx(
                        style_name,
                        word_index,
                        total_words,
                        (word.end_s - word.start_s).max(0.0),
                    );
                    let spotlight_fx = karaoke_word_spotlight_fx(
                        style_name,
                        &word.text,
                        word_index,
                        total_words,
                        (word.end_s - word.start_s).max(0.0),
                    );
                    format!(
                        "{}{}{}{}{}{}{}{}{}{{\\kf{}}}{}",
                        karaoke_word_fx(style_name, word_index, total_words),
                        karaoke_word_emphasis_fx(&word.text, style_name),
                        rhythm_fx,
                        color_flow_fx,
                        gradient_fx,
                        emotion_fx,
                        stage_glow_fx,
                        pulse_flash_fx,
                        spotlight_fx,
                        dur_cs.max(1),
                        escape_karaoke_text(&word.text)
                    )
                })
                .collect::<Vec<_>>()
                .join("")
        };
        body.push_str(&format!(
            "Dialogue: 0,{},{},{},,0,0,0,,{}\n",
            fmt_ts(cue.start_s),
            fmt_ts(cue.end_s),
            normalize_style_token(karaoke_style_name(cue)),
            text
        ));
    }
    if body.is_empty() {
        body.push_str("Dialogue: 0,0:00:00.00,0:00:05.00,Default,,0,0,0,,{\\kf500}...\n");
    }
    if let Some(parent) = out_ass.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(out_ass, format!("{}{}", header, body))?;
    Ok(())
}

pub fn write_ass_from_lyrics_json(lyrics_json: &Path, out_ass: &Path) -> anyhow::Result<()> {
    let v: Value = serde_json::from_str(&std::fs::read_to_string(lyrics_json)?)?;
    let title = extract_title_from_lyrics_value(&v);
    let mut lines: Vec<(f64, f64, String)> = build_karaoke_timeline_from_lyrics_value(&v)
        .into_iter()
        .map(|cue| (cue.start_s, cue.end_s, cue.text))
        .collect();
    if lines.is_empty() {
        if let Some(arr) = v.get("segments").and_then(|x| x.as_array()) {
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
    }

    let header = r#"[Script Info]
ScriptType: v4.00+
WrapStyle: 2
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,HengShanMaoBiCaoShu,54,&H00FFFFFF,&H000000FF,&H00202020,&H80000000,0,0,0,0,100,100,0,0,1,2.2,0.8,2,60,60,48,1
Style: TitleLatin,Syne,54,&H00F8FFF8,&H00D6FFF2,&H00100E12,&H44000000,1,0,0,0,100,100,8,0,1,3.4,0.8,8,86,86,88,1
Style: TitleCjk,HengShanMaoBiCaoShu,60,&H00FFF4D9,&H00D5FFF2,&H00100E12,&H44000000,1,0,0,0,100,100,4,0,1,3.6,1.0,8,86,86,132,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"#;

    let mut body = String::new();
    body.push_str(&title_ass_events(title.as_deref()));
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
