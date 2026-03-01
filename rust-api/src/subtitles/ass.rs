use std::path::Path;

fn ass_time(t: f64) -> String {
    let mut x = t;
    if x < 0.0 {
        x = 0.0;
    }
    let h = (x / 3600.0).floor() as i64;
    x -= (h as f64) * 3600.0;
    let m = (x / 60.0).floor() as i64;
    x -= (m as f64) * 60.0;
    let s = x.floor() as i64;
    let cs = ((x - (s as f64)) * 100.0).round() as i64;
    format!("{h}:{m:02}:{s:02}.{cs:02}")
}

pub fn write_ass(path: &Path, lines: &[String], duration_s: f64) -> std::io::Result<()> {
    let n = lines.len().max(1);
    let step = (duration_s / (n as f64)).max(0.6);
    let mut out = String::new();
    out.push_str("[Script Info]\n");
    out.push_str("ScriptType: v4.00+\n");
    out.push_str("WrapStyle: 2\n");
    out.push_str("ScaledBorderAndShadow: yes\n");
    out.push('\n');
    out.push_str("[V4+ Styles]\n");
    out.push_str("Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding\n");
    out.push_str("Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H80000000,&H80000000,0,0,0,0,100,100,0,0,1,2.5,0.8,2,60,60,48,1\n");
    out.push('\n');
    out.push_str("[Events]\n");
    out.push_str("Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text\n");
    for (i, line) in lines.iter().enumerate() {
        let t0 = (i as f64) * step;
        let t1 = ((i as f64) * step + step).min(duration_s.max(t0 + 0.6));
        let text = line.replace('\n', " ").replace('\r', " ");
        out.push_str(&format!(
            "Dialogue: 0,{},{},Default,,0,0,0,,{}\n",
            ass_time(t0),
            ass_time(t1),
            text
        ));
    }
    std::fs::create_dir_all(path.parent().unwrap_or_else(|| std::path::Path::new(".")))?;
    std::fs::write(path, out.as_bytes())
}

pub fn write_ass_minimal(out: &Path, text: &str, duration_s: f64) -> Result<(), String> {
    let dir = out.parent().ok_or_else(|| "no parent".to_string())?;
    std::fs::create_dir_all(dir).map_err(|e| format!("{e}"))?;

    let end = fmt_ass_time(duration_s.max(0.1));
    let body = format!(
        "[Script Info]
ScriptType: v4.00+
PlayResX: 1280
PlayResY: 720

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Arial,48,&H00FFFFFF,&H000000FF,&H00000000,&H80000000,0,0,0,0,100,100,0,0,1,3,0,2,60,60,40,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:00.00,{end},Default,,0,0,0,,{t}
",
        end = end,
        t = escape_ass(text)
    );

    std::fs::write(out, body).map_err(|e| format!("{e}"))?;
    Ok(())
}

fn escape_ass(s: &str) -> String {
    s.replace('\n', "\\N").replace('\r', "")
}

fn fmt_ass_time(sec: f64) -> String {
    let total = (sec * 100.0).round() as i64;
    let cs = total % 100;
    let s = (total / 100) % 60;
    let m = (total / 100) / 60 % 60;
    let h = (total / 100) / 3600;
    format!("{h}:{m:02}:{s:02}.{cs:02}")
}
