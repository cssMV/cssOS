use super::*;
use anyhow::Result;
use serde_json::json;

fn stage_target_lang(stage: &str, commands: &serde_json::Value, ui_lang: &str) -> String {
    stage
        .split('.')
        .nth(1)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
        .unwrap_or_else(|| primary_lang(commands, ui_lang))
}

fn stage_output_paths(
    ctx: &EngineCtx,
    stage: &str,
    lang: &str,
) -> (std::path::PathBuf, Option<std::path::PathBuf>) {
    if stage.starts_with("lyrics_timing.") {
        (
            ctx.run_dir.join(format!("./lyrics_timed/{lang}.json")),
            None,
        )
    } else if stage.starts_with("lyrics_primary.") || stage.starts_with("lyrics_adapt.") {
        let primary_sync = if stage.starts_with("lyrics_primary.") {
            Some(lyrics_json_path(&ctx.run_dir))
        } else {
            None
        };
        (
            ctx.run_dir.join(format!("./lyrics/{lang}.json")),
            primary_sync,
        )
    } else {
        (lyrics_json_path(&ctx.run_dir), None)
    }
}

fn lyric_draft_for_lang(commands: &serde_json::Value, lang: &str) -> Option<String> {
    commands
        .pointer(&format!("/lyrics/lyric_drafts/{lang}"))
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn split_draft_lines(text: &str) -> Vec<String> {
    text.lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .map(ToString::to_string)
        .collect()
}

fn stage_adaptation_mode(commands: &serde_json::Value, lang: &str) -> Option<String> {
    commands
        .pointer(&format!("/lyrics/adaptation_mode/{lang}"))
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn extract_semantic_anchors(text: &str) -> Vec<String> {
    let lowered = text.trim().to_lowercase();
    let mut anchors = Vec::new();
    let push = |anchors: &mut Vec<String>, value: &str| {
        if !anchors.iter().any(|existing| existing == value) {
            anchors.push(value.to_string());
        }
    };
    let mappings = [
        ("夜", "night"),
        ("风", "wind"),
        ("光", "light"),
        ("心", "heart"),
        ("梦", "dream"),
        ("爱", "love"),
        ("雨", "rain"),
        ("月", "moon"),
        ("火", "fire"),
        ("海", "sea"),
        ("天空", "sky"),
        ("回声", "echo"),
        ("night", "night"),
        ("wind", "wind"),
        ("light", "light"),
        ("heart", "heart"),
        ("dream", "dream"),
        ("love", "love"),
        ("rain", "rain"),
        ("moon", "moon"),
        ("fire", "fire"),
        ("sea", "sea"),
        ("sky", "sky"),
        ("echo", "echo"),
    ];
    for (needle, label) in mappings {
        if lowered.contains(needle) {
            push(&mut anchors, label);
        }
    }
    if anchors.is_empty() {
        for token in lowered
            .split(|ch: char| !ch.is_alphanumeric())
            .filter(|token| token.len() >= 3)
            .take(2)
        {
            push(&mut anchors, token);
        }
    }
    if anchors.is_empty() {
        anchors.push("memory".to_string());
        anchors.push("name".to_string());
    }
    anchors
}

fn anchor_pair(text: &str) -> (String, String) {
    let anchors = extract_semantic_anchors(text);
    let first = anchors
        .first()
        .cloned()
        .unwrap_or_else(|| "memory".to_string());
    let second = anchors.get(1).cloned().unwrap_or_else(|| first.clone());
    (first, second)
}

fn line_variant_seed(text: &str) -> usize {
    text.chars().fold(0usize, |acc, ch| {
        acc.wrapping_mul(131).wrapping_add(ch as usize)
    })
}

fn line_tail_hint(text: &str) -> String {
    let joined = text
        .split(|ch: char| {
            !ch.is_alphanumeric()
                && !matches!(
                    ch,
                    '夜' | '风' | '光' | '心' | '梦' | '爱' | '雨' | '月' | '火' | '海'
                )
        })
        .filter(|token| !token.trim().is_empty())
        .rev()
        .take(2)
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect::<Vec<_>>()
        .join(" ");
    if joined.trim().is_empty() {
        "your name".to_string()
    } else {
        joined
    }
}

fn auto_translate_line(text: &str, target_lang: &str) -> String {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    let (anchor_a, anchor_b) = anchor_pair(trimmed);
    let tail = line_tail_hint(trimmed);
    let variant = line_variant_seed(trimmed) % 3;
    match target_lang {
        "en" => match variant {
            0 => format!("Between {anchor_a} and {anchor_b}, I keep {tail} alive tonight"),
            1 => format!("When the {anchor_a} meets the {anchor_b}, I still call {tail}"),
            _ => format!("Under the {anchor_a} and {anchor_b}, I sing {tail} back to life"),
        },
        "ja" => match variant {
            0 => format!("{anchor_a}と{anchor_b}のあいだで 今夜も{tail}を歌っている"),
            1 => format!("{anchor_a}が{anchor_b}に触れるたび まだ{tail}を呼んでいる"),
            _ => format!("{anchor_a}と{anchor_b}の下で 消えない{tail}を抱いて歌う"),
        },
        "ko" => match variant {
            0 => format!("{anchor_a}과 {anchor_b} 사이에서 오늘도 {tail}을 노래해"),
            1 => format!("{anchor_a}이 {anchor_b}에 닿을 때마다 아직 {tail}을 불러"),
            _ => format!("{anchor_a} 아래 {anchor_b} 곁에서 지워지지 않는 {tail}을 안고 노래해"),
        },
        "es" => match variant {
            0 => format!("Entre {anchor_a} y {anchor_b}, todavía canto {tail} esta noche"),
            1 => format!("Cuando {anchor_a} toca {anchor_b}, vuelvo a llamar {tail}"),
            _ => format!("Bajo {anchor_a} y {anchor_b}, sostengo {tail} y lo hago canción"),
        },
        "fr" => match variant {
            0 => format!("Entre {anchor_a} et {anchor_b}, je chante encore {tail} ce soir"),
            1 => format!("Quand {anchor_a} rejoint {anchor_b}, j'appelle encore {tail}"),
            _ => format!("Sous {anchor_a} et {anchor_b}, je garde {tail} vivant dans ma voix"),
        },
        "de" => match variant {
            0 => format!(
                "Zwischen {anchor_a} und {anchor_b} singe ich {tail} noch immer in die Nacht"
            ),
            1 => format!("Wenn {anchor_a} auf {anchor_b} trifft, rufe ich wieder {tail}"),
            _ => format!(
                "Unter {anchor_a} und {anchor_b} halte ich {tail} in meinem Gesang lebendig"
            ),
        },
        _ => format!("[{}] {}", target_lang, trimmed),
    }
}

fn auto_translate_video_script(
    source_value: &serde_json::Value,
    target_lang: &str,
) -> Option<serde_json::Value> {
    let script = source_value.get("video_script")?.as_array()?;
    Some(serde_json::Value::Array(
        script
            .iter()
            .map(|entry| {
                let mut item = entry.clone();
                if let Some(obj) = item.as_object_mut() {
                    for key in ["summary", "shot_prompt"] {
                        if let Some(text) = obj.get(key).and_then(|value| value.as_str()) {
                            obj.insert(
                                key.to_string(),
                                json!(auto_translate_line(text, target_lang)),
                            );
                        }
                    }
                }
                item
            })
            .collect(),
    ))
}

fn adapt_lyrics_to_language(
    primary_value: &serde_json::Value,
    target_lang: &str,
    commands: &serde_json::Value,
) -> serde_json::Value {
    let mut adapted = primary_value.clone();
    let draft_lines = lyric_draft_for_lang(commands, target_lang)
        .map(|text| split_draft_lines(&text))
        .unwrap_or_default();
    let auto_mode = stage_adaptation_mode(commands, target_lang).unwrap_or_else(|| {
        if draft_lines.is_empty() {
            "songwrite_adapt".to_string()
        } else {
            "lyric_draft".to_string()
        }
    });
    if let Some(obj) = adapted.as_object_mut() {
        obj.insert("lang".to_string(), json!(target_lang));
        obj.insert(
            "translation_of".to_string(),
            json!(primary_value
                .get("lang")
                .and_then(|value| value.as_str())
                .unwrap_or("")),
        );
        obj.insert("adaptation_mode".to_string(), json!(auto_mode.clone()));
        if let Some(script) = auto_translate_video_script(primary_value, target_lang) {
            obj.insert("video_script".to_string(), script);
        }
        if let Some(script) = primary_value
            .get("preview_script")
            .and_then(|value| value.as_array())
        {
            obj.insert(
                "preview_script".to_string(),
                serde_json::Value::Array(
                    script
                        .iter()
                        .map(|line| {
                            line.as_str()
                                .map(|value| json!(auto_translate_line(value, target_lang)))
                                .unwrap_or_else(|| line.clone())
                        })
                        .collect(),
                ),
            );
        }
        if let Some(lines) = obj.get_mut("lines").and_then(|value| value.as_array_mut()) {
            for (index, line) in lines.iter_mut().enumerate() {
                if let Some(item) = line.as_object_mut() {
                    let original = item
                        .get("text")
                        .and_then(|value| value.as_str())
                        .unwrap_or("")
                        .to_string();
                    let translated = draft_lines
                        .get(index)
                        .cloned()
                        .unwrap_or_else(|| auto_translate_line(&original, target_lang));
                    item.insert("source_text".to_string(), json!(original));
                    item.insert("text".to_string(), json!(translated));
                }
            }
        }
    }
    adapted
}

fn write_timed_lyrics_json(source: &serde_json::Value) -> serde_json::Value {
    let mut timed = source.clone();
    let mut derived_lines = Vec::new();
    let lines = source
        .get("lines")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    for (index, line) in lines.iter().enumerate() {
        let start_s = line
            .get("start_s")
            .and_then(|value| value.as_f64())
            .or_else(|| line.get("t").and_then(|value| value.as_f64()))
            .unwrap_or_else(|| index as f64 * 3.0);
        let end_s = line
            .get("end_s")
            .and_then(|value| value.as_f64())
            .or_else(|| {
                lines.get(index + 1).and_then(|next| {
                    next.get("start_s")
                        .and_then(|value| value.as_f64())
                        .or_else(|| next.get("t").and_then(|value| value.as_f64()))
                })
            })
            .unwrap_or(
                start_s
                    + estimated_line_duration(
                        line.get("text")
                            .and_then(|value| value.as_str())
                            .unwrap_or(""),
                    ) as f64,
            )
            .max(start_s + 0.4);
        let mut item = line.clone();
        if let Some(obj) = item.as_object_mut() {
            obj.insert(
                "start_s".to_string(),
                json!((start_s * 100.0).round() / 100.0),
            );
            obj.insert("end_s".to_string(), json!((end_s * 100.0).round() / 100.0));
            obj.insert("t".to_string(), json!((start_s * 100.0).round() / 100.0));
        }
        derived_lines.push(item);
    }
    if let Some(obj) = timed.as_object_mut() {
        obj.insert("schema".to_string(), json!("css.lyrics.timed.v1"));
        obj.insert("lines".to_string(), serde_json::Value::Array(derived_lines));
    }
    timed
}

fn creative_string(commands: &serde_json::Value, key: &str) -> Option<String> {
    commands
        .get("creative")
        .and_then(|value| value.get(key))
        .and_then(|value| value.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToString::to_string)
}

fn creative_section_form(commands: &serde_json::Value) -> Vec<String> {
    commands
        .get("creative")
        .and_then(|value| value.get("section_form"))
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(|item| item.as_str())
                .map(str::trim)
                .filter(|item| !item.is_empty())
                .map(ToString::to_string)
                .collect::<Vec<_>>()
        })
        .filter(|items| !items.is_empty())
        .unwrap_or_else(|| {
            vec![
                "Verse 1".to_string(),
                "Verse 2".to_string(),
                "Chorus 1".to_string(),
                "Verse 3".to_string(),
                "Verse 4".to_string(),
                "Chorus 2".to_string(),
                "Bridge".to_string(),
                "Chorus 3".to_string(),
                "Chorus 4".to_string(),
                "Outro".to_string(),
            ]
        })
}

fn expected_storyboard_entries(commands: &serde_json::Value) -> usize {
    let video_shots_n = commands
        .pointer("/video/shots_n")
        .and_then(|value| value.as_u64())
        .map(|value| value.max(1) as usize);
    let segment_count = commands
        .pointer("/video/segments")
        .and_then(|value| value.as_array())
        .map(|items| items.len())
        .filter(|count| *count > 0);
    let section_count = {
        let count = creative_section_form(commands).len();
        (count > 0).then_some(count)
    };
    video_shots_n
        .or(segment_count)
        .or(section_count)
        .unwrap_or(1)
}

fn requested_duration_s(commands: &serde_json::Value) -> Option<f64> {
    commands
        .get("creative")
        .and_then(|value| value.get("duration_s"))
        .and_then(|value| value.as_f64())
}

fn estimate_total_line_duration_s(lines: &[String]) -> f64 {
    lines
        .iter()
        .map(|line| estimated_line_duration(line) as f64)
        .sum::<f64>()
        .max(8.0)
}

fn section_incantation(motif: &str, callback: &str) -> String {
    let root = motif
        .split_whitespace()
        .take(3)
        .collect::<Vec<_>>()
        .join("-");
    let answer = callback
        .split_whitespace()
        .take(3)
        .collect::<Vec<_>>()
        .join("-");
    format!("ZAI-{root}-ORI :: NAA-{answer}-VA")
}

fn section_lyric_lines(section: &str, motif: &str, mood: &str, callback: &str) -> Vec<String> {
    let lower = section.to_ascii_lowercase();
    let mut lines = if lower.contains("chorus 4") {
        vec![
            format!("Call every witness back beneath the {motif}"),
            format!("Let the broken crown answer in a {mood} blaze"),
            format!("Turn the last refrain until the wound becomes a gate"),
            format!("Sing the callback plain so the first scar learns my name"),
        ]
    } else if lower.contains("chorus 3") {
        vec![
            format!("Raise the {motif} higher than the law that named me"),
            format!("Gather the scattered breath into one {mood} choir"),
            format!("Let the city bow and hear the answer crossing back"),
            format!("Drive the hook again until the iron doors remember"),
        ]
    } else if lower.contains("chorus 2") {
        vec![
            format!("Lift the {motif} until the chamber floods with fire"),
            format!("Make the {mood} crowd circle closer to the lead"),
            format!("Push the vow across the glass until the dark replies"),
            format!("Open every throat and let the skyline sing surrender"),
        ]
    } else if lower.contains("chorus 1") {
        vec![
            format!("Lift me where the {motif} turns from ash to signal"),
            format!("We sing the {mood} pressure till the rafters answer back"),
            format!("Every watching body leans toward the widening flame"),
            format!("The first refrain arrives and names the hidden axis"),
        ]
    } else if lower.contains("bridge") {
        vec![
            "Break the mirrored route and show the seam beneath the script".to_string(),
            format!("Bend every line of light back toward {callback}"),
            format!("Let the {mood} fault split open and reveal the buried will"),
            "Hold one breath above the void before the final answer lands".to_string(),
        ]
    } else if lower.contains("outro") {
        vec![
            format!("Now I return and call the {callback} by its truest light"),
            format!("The {motif} opens again, and this time it answers me"),
            format!("The {mood} silence bows and leaves the gate unlocked"),
            "What once was written shuts behind the singer who walked out".to_string(),
        ]
    } else if lower.contains("verse 4") {
        vec![
            format!("I wear the {motif} like weather over uncovered steel"),
            format!("A {mood} vow keeps striking where the old command once stood"),
            "Every corridor that trapped me now repeats my chosen cadence".to_string(),
            format!("The watching throne grows smaller each time I sing {callback}"),
        ]
    } else if lower.contains("verse 3") {
        vec![
            format!("I count the hidden gears beneath the {motif} horizon"),
            format!("The {mood} pulse no longer asks permission to survive"),
            "Two shadows change their balance and the lead walks through the center".to_string(),
            format!("Every sealed instruction frays when I pronounce {callback}"),
        ]
    } else if lower.contains("verse 2") {
        vec![
            format!("I trace the first wound sleeping underneath the {motif}"),
            format!("A {mood} current climbs my spine and rewrites how I stand"),
            "The room still thinks it owns me, but the floor begins to listen".to_string(),
            format!("One glance toward {callback} makes the watchers lose their rhythm"),
        ]
    } else {
        vec![
            format!("I walk the edge where the {motif} keeps breathing"),
            format!("A {mood} pulse keeps moving through my chest"),
            "The script around my body flickers, but it does not hold".to_string(),
            format!("Far off, {callback} waits like a name I almost remember"),
        ]
    };
    lines.push(section_incantation(motif, callback));
    lines
}

fn section_scene_summary(section: &str, motif: &str, mood: &str, callback: &str) -> String {
    let lower = section.to_ascii_lowercase();
    if lower.contains("intro") {
        format!("A distant opening frame introduces the {motif} under a {mood} hush.")
    } else if lower.contains("chorus") {
        format!("The frame opens wide as bodies and light gather around the {motif}.")
    } else if lower.contains("bridge") {
        format!("Reality bends and every camera line starts pointing back toward {callback}.")
    } else if lower.contains("outro") {
        format!("Return to the first image and answer {callback} with a changed gaze.")
    } else {
        format!("Follow the lead through a {mood} movement where the {motif} keeps breathing.")
    }
}

fn section_camera_plan(section: &str) -> &'static str {
    let lower = section.to_ascii_lowercase();
    if lower.contains("intro") {
        "opening wide shot, slow push-in, centered lead silhouette"
    } else if lower.contains("chorus") {
        "wider performance frame, moving camera, visible depth layers and background motion"
    } else if lower.contains("bridge") {
        "tenser medium shot, compressed frame, pressure building toward a turn"
    } else if lower.contains("outro") {
        "returning callback frame, calmer composition, emotionally resolved close-medium"
    } else if lower.contains("verse 1") {
        "close-medium two-shot, readable face and body language, controlled lateral drift"
    } else if lower.contains("verse 2") {
        "medium shot opening into more lead space, background story elements becoming visible"
    } else {
        "cinematic medium-wide shot with readable lead figure and grounded environment"
    }
}

fn section_shot_prompt(section: &str, motif: &str, mood: &str, callback: &str) -> String {
    let lower = section.to_ascii_lowercase();
    if lower.contains("intro") {
        format!(
            "Music video shot brief for {section}. Subject: single lead performer. Camera: {}. Lighting: {} cinematic light with soft contrast. Environment: motif-driven world built around {}. Directing goals: keep a real human figure readable, preserve facial detail, preserve costume texture, avoid abstract graphics, avoid posterized line-art, avoid symbolic test patterns. relationship_arc=solo_hold callback_hint={}",
            section_camera_plan(section),
            mood,
            motif,
            callback
        )
    } else if lower.contains("chorus") {
        format!(
            "Music video shot brief for {section}. Subject: lead performer with surrounding crowd energy. Camera: {}. Lighting: bold stage-scale {} light with motivated highlights and practical depth cues. Environment: large playable world around {} with believable foreground, midground, and background separation. Directing goals: show visible bodies, readable faces, kinetic staging, strong parallax, real scene depth, and crowd motion without collapsing into illustration or texture-only imagery. relationship_arc=scatter_to_center callback_hint={}",
            section_camera_plan(section),
            mood,
            motif,
            callback
        )
    } else if lower.contains("bridge") {
        format!(
            "Music video shot brief for {section}. Subject: emotionally pressured lead figure. Camera: {}. Lighting: moody {} contrast with grounded practical sources. Environment: tense world bending toward {} while staying physically readable. Directing goals: increase dramatic pressure, keep the lead centered in a believable place, show real surfaces and dimensional space, avoid graphic outlines and synthetic pattern fields. relationship_arc=lead_to_release callback_hint={}",
            section_camera_plan(section),
            mood,
            callback,
            callback
        )
    } else if lower.contains("outro") {
        format!(
            "Music video shot brief for {section}. Subject: returning lead performer answering the opening image. Camera: {}. Lighting: resolved {} glow with human skin detail and gentle separation from background. Environment: visual callback to {} and {}. Directing goals: make the ending feel like the same world and same person as the opening, with calmer motion, cleaner composition, and emotionally clear eye-line. relationship_arc=solo_release callback_hint={}",
            section_camera_plan(section),
            mood,
            motif,
            callback,
            callback
        )
    } else if lower.contains("verse 1") {
        format!(
            "Music video shot brief for {section}. Subject: lead performer and one supporting presence. Camera: {}. Lighting: {} atmospheric realism. Environment: grounded setting shaped by {}. Directing goals: readable faces, clear blocking, subtle relationship shift from balance to lead, cinematic but believable wardrobe and architecture, no abstract overlays. relationship_arc=equals_to_lead callback_hint={}",
            section_camera_plan(section),
            mood,
            motif,
            callback
        )
    } else if lower.contains("verse 2") {
        format!(
            "Music video shot brief for {section}. Subject: lead performer taking more of the frame. Camera: {}. Lighting: {} realism with controlled contrast. Environment: story world around {} opening up behind the lead. Directing goals: stronger subject separation, more usable negative space, grounded physical location, and visible scene details instead of symbolic abstraction. relationship_arc=center_release callback_hint={}",
            section_camera_plan(section),
            mood,
            motif,
            callback
        )
    } else {
        format!(
            "Music video shot brief for {section}. Subject: readable human performer within a believable cinematic environment. Camera: {}. Lighting: {} tone. Environment: world built around {} with real scale, texture, and depth. Directing goals: preserve the body, face, costume, location, and motion as coherent live-action style imagery; avoid abstract graphics, line-art, and placeholder patterns. relationship_arc=forward_motion callback_hint={}",
            section_camera_plan(section),
            mood,
            motif,
            callback
        )
    }
}

fn build_default_lyrics(commands: &serde_json::Value, lang: &str) -> serde_json::Value {
    let title = title_hint(commands);
    let fallback_title = if title.trim().is_empty() {
        creative_string(commands, "title").unwrap_or_else(|| "Untitled".to_string())
    } else {
        title
    };
    let mood = creative_string(commands, "mood").unwrap_or_else(|| "dreamy".to_string());
    let lyric_prompt = creative_string(commands, "lyrics_prompt")
        .or_else(|| {
            commands
                .pointer("/lyrics/prompt")
                .and_then(|value| value.as_str())
                .map(str::to_string)
        })
        .or_else(|| creative_string(commands, "title"))
        .or_else(|| Some(fallback_title.clone()))
        .unwrap_or_else(|| "a luminous horizon".to_string());
    let motif_source = lyric_prompt
        .replace("Write lyrics themed around:", "")
        .replace("Generate a catchy chorus + verses about:", "")
        .replace(
            "Write a complete original song with hook, verses, bridge, and ending.",
            "",
        )
        .replace("Voice inspired song and MV", "")
        .trim()
        .to_string();
    let motif = motif_source
        .split(|ch: char| matches!(ch, ',' | '.' | ';' | '|' | ':'))
        .next()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or("horizon light")
        .to_lowercase();
    let callback = motif
        .split_whitespace()
        .take(4)
        .collect::<Vec<_>>()
        .join(" ");
    let sections = creative_section_form(commands);
    let mut current_t = 0.0_f64;
    let mut lines = Vec::new();
    let mut video_script = Vec::new();
    let mut preview_script = Vec::new();
    let mut section_line_map: Vec<(String, Vec<String>)> = Vec::new();

    for section in &sections {
        section_line_map.push((
            section.clone(),
            section_lyric_lines(section, &motif, &mood, &callback),
        ));
    }
    let raw_lines = section_line_map
        .iter()
        .flat_map(|(_, section_lines)| section_lines.iter().cloned())
        .collect::<Vec<_>>();
    let duration_s = requested_duration_s(commands)
        .unwrap_or_else(|| estimate_total_line_duration_s(&raw_lines) + sections.len() as f64 * 0.8)
        .max(12.0);
    let total_lines = raw_lines.len().max(5);
    let step = (duration_s / total_lines as f64).max(0.9);

    for (section, section_lines) in &section_line_map {
        let section_start_t = current_t;
        for line in section_lines {
            lines.push(json!({
                "t": (current_t * 100.0).round() / 100.0,
                "section": section,
                "text": line
            }));
            current_t += step;
        }
        let section_end_t = current_t;
        let scene_summary = section_scene_summary(section, &motif, &mood, &callback);
        let shot_prompt = section_shot_prompt(section, &motif, &mood, &callback);
        video_script.push(json!({
            "section": section,
            "start_s": (section_start_t * 100.0).round() / 100.0,
            "end_s": (section_end_t * 100.0).round() / 100.0,
            "summary": scene_summary,
            "shot_prompt": shot_prompt
        }));
        preview_script.push(format!(
            "{section} · {:.1}s-{:.1}s · {}",
            section_start_t, section_end_t, scene_summary
        ));
    }

    json!({
        "schema": "css.lyrics.v1",
        "lang": lang,
        "title": fallback_title,
        "section_form": sections,
        "creative": commands.get("creative").cloned().unwrap_or_else(|| json!({})),
        "music_plan": {
            "target_duration_s": duration_s,
            "callback_target": callback,
            "ending_strategy": "explicit_opening_response",
            "previewScript": preview_script
        },
        "video_script": video_script,
        "preview_script": preview_script,
        "lines": lines
    })
}

fn jingdian_section_count_ok(value: &serde_json::Value) -> bool {
    value
        .get("section_form")
        .and_then(|items| items.as_array())
        .map(|items| items.len() == 10)
        .unwrap_or(false)
}

fn jingdian_lines_ok(value: &serde_json::Value) -> bool {
    let Some(lines) = value.get("lines").and_then(|items| items.as_array()) else {
        return false;
    };
    if lines.len() != 50 {
        return false;
    }
    lines.iter().skip(4).step_by(5).all(|item| {
        item.as_object()
            .and_then(|obj| obj.get("text"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .contains("::")
    })
}

fn estimated_line_duration(text: &str) -> f32 {
    let char_count = text.chars().filter(|c| !c.is_whitespace()).count() as f32;
    (1.8 + char_count * 0.09).clamp(2.1, 6.8)
}

async fn normalize_to_jingdian_if_needed(
    out: &std::path::Path,
    commands: &serde_json::Value,
    lang: &str,
) -> Result<()> {
    let bytes = tokio::fs::read(out).await?;
    let existing: serde_json::Value = serde_json::from_slice(&bytes)?;
    if jingdian_section_count_ok(&existing) && jingdian_lines_ok(&existing) {
        return Ok(());
    }
    let normalized = build_default_lyrics(commands, lang);
    write_json(out, &normalized).await?;
    Ok(())
}

pub async fn run_stage(
    ctx: &EngineCtx,
    commands: &serde_json::Value,
    ui_lang: &str,
    stage: &str,
) -> Result<()> {
    let lang = stage_target_lang(stage, commands, ui_lang);
    let primary = primary_lang(commands, ui_lang);
    let (out, sync_primary_out) = stage_output_paths(ctx, stage, &lang);
    let prompt_json = ctx.run_dir.join("./build/lyrics_prompt.json");

    let prompt = json!({
        "schema": "css.lyrics.prompt.v1",
        "lang": lang,
        "stage": stage,
        "source_lang": primary,
        "title_hint": title_hint(commands),
        "ui_lang": ui_lang,
        "input": commands.get("input").cloned().unwrap_or_else(|| json!({}))
    });
    write_json(&prompt_json, &prompt).await?;

    if let Some(cmdline) = env_cmd("CSS_LYRICS_CMD") {
        let source_lyrics = if lang == primary {
            lyrics_json_path(&ctx.run_dir)
        } else {
            ctx.run_dir.join(format!("./lyrics/{primary}.json"))
        };
        run_cmd(
            &cmdline,
            &ctx.run_dir,
            &[
                ("CSS_STAGE_NAME", stage.to_string()),
                ("CSS_LANG", lang.clone()),
                ("CSS_TARGET_LANG", lang.clone()),
                ("CSS_SOURCE_LANG", primary.clone()),
                (
                    "CSS_SOURCE_LYRICS_JSON",
                    source_lyrics.to_string_lossy().to_string(),
                ),
                ("CSS_TITLE_HINT", title_hint(commands)),
                ("CSS_PROMPT_JSON", prompt_json.to_string_lossy().to_string()),
                ("CSS_OUT_JSON", out.to_string_lossy().to_string()),
            ],
        )
        .await?;
        if stage.starts_with("lyrics_timing.") {
            let bytes = tokio::fs::read(&out).await?;
            let source_value: serde_json::Value = serde_json::from_slice(&bytes)?;
            let timed = write_timed_lyrics_json(&source_value);
            write_json(&out, &timed).await?;
        } else if stage.starts_with("lyrics_adapt.") && lang != primary {
            if tokio::fs::metadata(&out).await.is_err() {
                let source_path = ctx.run_dir.join(format!("./lyrics/{primary}.json"));
                let source_bytes = tokio::fs::read(&source_path).await?;
                let source_value: serde_json::Value = serde_json::from_slice(&source_bytes)?;
                let adapted = adapt_lyrics_to_language(&source_value, &lang, commands);
                write_json(&out, &adapted).await?;
            }
        } else {
            normalize_to_jingdian_if_needed(&out, commands, &lang).await?;
        }
        if let Some(sync_path) = sync_primary_out.as_ref() {
            let bytes = tokio::fs::read(&out).await?;
            tokio::fs::write(sync_path, bytes).await?;
        }
        validate_lyrics_output(&out).await?;
        let qc = crate::quality_config::load_quality_config();
        let gate =
            crate::quality_gates::gate_lyrics_nonempty_lines(&out, qc.min_lyrics_nonempty_lines)
                .await?;
        if !gate.ok {
            return Err(crate::quality_gates::fail_gate(gate));
        }
        let storyboard_gate = crate::quality_gates::gate_lyrics_storyboard_script(
            &out,
            expected_storyboard_entries(commands),
        )
        .await?;
        if !storyboard_gate.ok {
            return Err(crate::quality_gates::fail_gate(storyboard_gate));
        }
        if stage.starts_with("lyrics_adapt.") && lang != primary {
            let adapt_gate = crate::quality_gates::gate_lyrics_language_adapted(
                &out,
                &lang,
                &primary,
                qc.min_adapted_lyrics_line_delta_ratio,
            )
            .await?;
            if !adapt_gate.ok {
                return Err(crate::quality_gates::fail_gate(adapt_gate));
            }
        }
        return Ok(());
    }

    let v = if stage.starts_with("lyrics_adapt.") && lang != primary {
        let source_path = ctx.run_dir.join(format!("./lyrics/{primary}.json"));
        let source_bytes = tokio::fs::read(&source_path).await?;
        let source_value: serde_json::Value = serde_json::from_slice(&source_bytes)?;
        adapt_lyrics_to_language(&source_value, &lang, commands)
    } else if stage.starts_with("lyrics_timing.") {
        let source_path = if lang == primary {
            ctx.run_dir.join(format!("./lyrics/{lang}.json"))
        } else {
            ctx.run_dir.join(format!("./lyrics/{lang}.json"))
        };
        let source_bytes = tokio::fs::read(&source_path).await?;
        let source_value: serde_json::Value = serde_json::from_slice(&source_bytes)?;
        write_timed_lyrics_json(&source_value)
    } else {
        build_default_lyrics(commands, &lang)
    };
    write_json(&out, &v).await?;
    if let Some(sync_path) = sync_primary_out.as_ref() {
        let bytes = tokio::fs::read(&out).await?;
        tokio::fs::write(sync_path, bytes).await?;
    }
    validate_lyrics_output(&out).await?;
    let qc = crate::quality_config::load_quality_config();
    let gate = crate::quality_gates::gate_lyrics_nonempty_lines(&out, qc.min_lyrics_nonempty_lines)
        .await?;
    if !gate.ok {
        return Err(crate::quality_gates::fail_gate(gate));
    }
    let storyboard_gate = crate::quality_gates::gate_lyrics_storyboard_script(
        &out,
        expected_storyboard_entries(commands),
    )
    .await?;
    if !storyboard_gate.ok {
        return Err(crate::quality_gates::fail_gate(storyboard_gate));
    }
    if stage.starts_with("lyrics_adapt.") && lang != primary {
        let adapt_gate = crate::quality_gates::gate_lyrics_language_adapted(
            &out,
            &lang,
            &primary,
            qc.min_adapted_lyrics_line_delta_ratio,
        )
        .await?;
        if !adapt_gate.ok {
            return Err(crate::quality_gates::fail_gate(adapt_gate));
        }
    }
    Ok(())
}

pub async fn run(ctx: &EngineCtx, commands: &serde_json::Value, ui_lang: &str) -> Result<()> {
    run_stage(ctx, commands, ui_lang, "lyrics").await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_lyrics_expand_click_into_full_song_shape() {
        let commands = json!({
            "title_hint": "Glass Ocean Aurora",
            "creative": {
                "title": "Glass Ocean Aurora",
                "mood": "luminous",
                "video_prompt": "Cinematic MV on a glass ocean under aurora light.",
                "section_form": ["Verse 1", "Verse 2", "Chorus 1", "Verse 3", "Verse 4"],
                "duration_s": 20.0
            },
            "video": {
                "duration_s": 20.0
            }
        });

        let lyrics = build_default_lyrics(&commands, "en");
        let lines = lyrics["lines"].as_array().expect("lines");
        assert_eq!(
            lyrics["music_plan"]["ending_strategy"].as_str(),
            Some("explicit_opening_response")
        );
        assert_eq!(
            lyrics["section_form"].as_array().map(|items| items.len()),
            Some(5)
        );
        assert_eq!(lines.len(), 25);
        assert_eq!(
            lyrics["video_script"].as_array().map(|items| items.len()),
            Some(5)
        );
        assert!(
            lyrics["preview_script"]
                .as_array()
                .map(|items| items.len())
                .unwrap_or(0)
                >= 5
        );
        assert!(lines[4]
            .get("text")
            .and_then(|item| item.as_str())
            .unwrap_or("")
            .contains("::"));
        assert!(lines
            .last()
            .and_then(|item| item.get("text"))
            .and_then(|item| item.as_str())
            .unwrap_or("")
            .contains("::"));
    }

    #[test]
    fn default_lyrics_without_section_form_use_jingdian_ten_sections() {
        let commands = json!({
            "title_hint": "Jingdian",
            "creative": {
                "title": "Jingdian",
                "mood": "ceremonial",
                "video_prompt": "Bronze city under eclipse flame.",
                "duration_s": 180.0
            }
        });

        let lyrics = build_default_lyrics(&commands, "zh");
        let sections = lyrics["section_form"].as_array().expect("section form");
        let lines = lyrics["lines"].as_array().expect("lines");
        assert_eq!(sections.len(), 10);
        assert_eq!(
            sections.first().and_then(|item| item.as_str()),
            Some("Verse 1")
        );
        assert_eq!(
            sections.last().and_then(|item| item.as_str()),
            Some("Outro")
        );
        assert_eq!(
            lyrics["video_script"].as_array().map(|items| items.len()),
            Some(10)
        );
        assert_eq!(lines.len(), 50);
        assert!(lines.chunks(5).all(|chunk| chunk.len() == 5));
        assert!(lines.iter().skip(4).step_by(5).all(|item| {
            item.get("text")
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .contains("::")
        }));
    }

    #[test]
    fn jingdian_normalizer_rejects_short_external_shape() {
        let malformed = json!({
            "section_form": ["Intro", "Verse 1", "Chorus 1"],
            "lines": [
                {"text": "a"},
                {"text": "b"},
                {"text": "c"}
            ]
        });
        assert!(!jingdian_section_count_ok(&malformed));
        assert!(!jingdian_lines_ok(&malformed));
    }

    #[test]
    fn adapt_lyrics_auto_translate_changes_line_text() {
        let source = json!({
            "lang": "zh",
            "video_script": [{ "summary": "夜风吹过", "shot_prompt": "夜色中的心和光" }],
            "preview_script": ["夜风吹过心海"],
            "lines": [
                { "text": "我在夜风里等你" },
                { "text": "心里的光还没有熄灭" }
            ]
        });
        let commands = json!({ "lyrics": {} });
        let adapted = adapt_lyrics_to_language(&source, "en", &commands);
        let lines = adapted["lines"].as_array().expect("lines");
        assert_eq!(adapted["lang"].as_str(), Some("en"));
        assert_ne!(lines[0]["text"].as_str(), Some("我在夜风里等你"));
        assert_eq!(lines[0]["source_text"].as_str(), Some("我在夜风里等你"));
        assert!(
            adapted["video_script"][0]["summary"]
                .as_str()
                .unwrap_or("")
                .contains("english")
                || adapted["video_script"][0]["summary"]
                    .as_str()
                    .unwrap_or("")
                    .contains("night")
        );
    }
}
