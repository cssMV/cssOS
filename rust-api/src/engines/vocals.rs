use super::*;
use anyhow::Result;
use serde_json::{json, Value};
use std::f32::consts::PI;

const SAMPLE_RATE: u32 = 48_000;
const TWO_PI: f32 = PI * 2.0;

#[derive(Clone)]
struct VocalCue {
    start_sec: f32,
    duration_sec: f32,
    text: String,
    section: String,
    section_kind: SectionKind,
    phrase_order: usize,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum SectionKind {
    Intro,
    Verse,
    Chorus,
    Bridge,
    Outro,
    OperaScene,
    TriptychPart,
    Generic,
}

struct StereoGuide {
    left: Vec<f32>,
    right: Vec<f32>,
}

#[derive(Clone, Copy)]
struct MusicCueHint {
    tempo_bpm: f32,
    root_hz: f32,
    energy: f32,
    style_brightness: f32,
    phrase_role: PhraseRoleHint,
    guide_topline_lift: f32,
    lead_presence_gain: f32,
    backing_presence_gain: f32,
    diction_gain: f32,
}

#[derive(Clone, Copy)]
struct CreativeVocalProfile {
    dynamic_range: f32,
    section_contrast: f32,
    melodic_contour: MelodicContourMode,
    articulation_bias: f32,
    register_bias: f32,
    ambience_depth: f32,
    instrumentation_bias: f32,
    theatrical_bias: f32,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum MelodicContourMode {
    Grounded,
    Arched,
    Ascending,
    Wave,
}

#[derive(Clone, Copy)]
struct PhraseRoleHint {
    role: VocalPhraseRole,
    variation: VocalVariationRole,
    cadence: VocalCadenceIntent,
}

#[derive(Clone)]
struct VocalFocusEvent {
    start_sec: f32,
    duration_sec: f32,
    strength: f32,
    section: String,
    token: String,
}

#[derive(Clone)]
struct VocalCadenceAnchorEvent {
    start_sec: f32,
    duration_sec: f32,
    strength: f32,
    section: String,
    token: String,
    role: String,
    cadence: String,
    cue_index: usize,
    phrase_order: usize,
}

#[derive(Clone)]
struct VocalReplyHarmonyWindowEvent {
    start_sec: f32,
    duration_sec: f32,
    strength: f32,
    section: String,
    token: String,
    role: String,
    cadence: String,
    cue_index: usize,
    phrase_order: usize,
    bass_duck: f32,
    sub_duck: f32,
    pad_duck: f32,
    strings_duck: f32,
    strings_settle_gain: f32,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum VocalPhraseRole {
    Setup,
    Statement,
    Response,
    Lift,
    Release,
    Resolve,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum VocalVariationRole {
    Primary,
    Repeat,
    Answer,
    Development,
}

#[derive(Clone, Copy, PartialEq, Eq)]
enum VocalCadenceIntent {
    Open,
    Half,
    Authentic,
    Plagal,
    Deceptive,
    Resolved,
}

impl StereoGuide {
    fn new(frames: usize) -> Self {
        Self {
            left: vec![0.0; frames],
            right: vec![0.0; frames],
        }
    }

    fn add(&mut self, idx: usize, l: f32, r: f32) {
        if idx >= self.left.len() || idx >= self.right.len() {
            return;
        }
        self.left[idx] = (self.left[idx] + l).clamp(-1.0, 1.0);
        self.right[idx] = (self.right[idx] + r).clamp(-1.0, 1.0);
    }
}

pub async fn run(ctx: &EngineCtx, commands: &serde_json::Value, ui_lang: &str) -> Result<()> {
    let lang = primary_lang(commands, ui_lang);
    let voice = commands
        .get("vocals")
        .and_then(|x| x.get("voice"))
        .and_then(|x| x.as_str())
        .or_else(|| {
            commands
                .get("vocals")
                .and_then(|x| x.get("voices"))
                .and_then(|x| x.as_array())
                .and_then(|a| a.first())
                .and_then(|x| x.as_str())
        })
        .unwrap_or("female")
        .to_string();
    let lyrics = lyrics_json_path(&ctx.run_dir);
    let out = vocals_wav_path(&ctx.run_dir);
    let lead_guide = lead_vocal_guide_wav_path(&ctx.run_dir);
    let backing_guide = backing_vocal_guide_wav_path(&ctx.run_dir);
    let lead_singing = lead_singing_voice_wav_path(&ctx.run_dir);
    let backing_singing = backing_singing_voice_wav_path(&ctx.run_dir);
    let vocal_master = vocal_master_wav_path(&ctx.run_dir);
    validate_lyrics_json_input(&lyrics).await?;

    if let Some(cmdline) = env_cmd("CSS_VOCALS_CMD") {
        run_cmd(
            &cmdline,
            &ctx.run_dir,
            &[
                ("CSS_LANG", lang.clone()),
                ("CSS_VOICE", voice.clone()),
                ("CSS_LYRICS_JSON", lyrics.to_string_lossy().to_string()),
                ("CSS_OUT_WAV", out.to_string_lossy().to_string()),
                (
                    "CSS_LEAD_GUIDE_WAV",
                    lead_guide.to_string_lossy().to_string(),
                ),
                (
                    "CSS_BACKING_GUIDE_WAV",
                    backing_guide.to_string_lossy().to_string(),
                ),
                (
                    "CSS_LEAD_SINGING_WAV",
                    lead_singing.to_string_lossy().to_string(),
                ),
                (
                    "CSS_BACKING_SINGING_WAV",
                    backing_singing.to_string_lossy().to_string(),
                ),
                (
                    "CSS_VOCAL_MASTER_WAV",
                    vocal_master.to_string_lossy().to_string(),
                ),
                ("CSS_TITLE_HINT", title_hint(commands)),
            ],
        )
        .await?;
        validate_wav_output(&out, 4096).await?;
        ensure_parent(&lead_guide).await?;
        if tokio::fs::metadata(&lead_guide).await.is_err() {
            tokio::fs::copy(&out, &lead_guide).await?;
        }
        if tokio::fs::metadata(&backing_guide).await.is_err() {
            tokio::fs::copy(&out, &backing_guide).await?;
        }
        write_vocal_plan(&ctx.run_dir, &lang, &voice, &lyrics, commands).await?;
        let qc = crate::quality_config::load_quality_config();
        let gate = crate::quality_gates::gate_audio_duration(&out, qc.min_audio_duration_s).await?;
        if !gate.ok {
            return Err(crate::quality_gates::fail_gate(gate));
        }
        return Ok(());
    }

    let lyrics_raw = tokio::fs::read_to_string(&lyrics).await?;
    let lyrics_json: Value = serde_json::from_str(&lyrics_raw)?;
    let cues = build_vocal_cues(&lyrics_json);
    let music_hints = load_music_cue_hints(&ctx.run_dir, cues.len()).await;
    let creative_profile = load_creative_vocal_profile(commands);
    let total_duration = cues
        .last()
        .map(|cue| cue.start_sec + cue.duration_sec)
        .unwrap_or(1.0)
        .max(1.0)
        + 0.6;
    let total_frames = (total_duration * SAMPLE_RATE as f32).ceil() as usize;
    let (mut lead_bus, mut backing_bus) = render_vocal_guides(
        &cues,
        &music_hints,
        total_frames,
        &voice,
        &lang,
        title_hint(commands).as_str(),
        creative_profile,
    );
    let (mut lead_singing_bus, mut backing_singing_bus) = render_singing_voices(
        &cues,
        &music_hints,
        total_frames,
        &voice,
        &lang,
        title_hint(commands).as_str(),
        creative_profile,
    );
    apply_guide_master(&mut lead_bus.left, &mut lead_bus.right, 0.9);
    apply_guide_master(&mut backing_bus.left, &mut backing_bus.right, 0.78);
    apply_guide_master(
        &mut lead_singing_bus.left,
        &mut lead_singing_bus.right,
        0.96,
    );
    apply_guide_master(
        &mut backing_singing_bus.left,
        &mut backing_singing_bus.right,
        0.86,
    );

    let lead_wav = interleaved_wav(&lead_bus.left, &lead_bus.right);
    let backing_wav = interleaved_wav(&backing_bus.left, &backing_bus.right);
    let lead_singing_wav = interleaved_wav(&lead_singing_bus.left, &lead_singing_bus.right);
    let backing_singing_wav =
        interleaved_wav(&backing_singing_bus.left, &backing_singing_bus.right);
    let vocal_mix = sum_guides(&lead_singing_bus, &backing_singing_bus);
    let vocal_master_mix = sum_guides(&vocal_mix, &sum_guides(&lead_bus, &backing_bus));
    let full_mix = vocal_mix;
    let full_wav = interleaved_wav(&full_mix.left, &full_mix.right);
    let vocal_master_wav = interleaved_wav(&vocal_master_mix.left, &vocal_master_mix.right);

    ensure_parent(&out).await?;
    tokio::fs::write(&lead_guide, lead_wav).await?;
    tokio::fs::write(&backing_guide, backing_wav).await?;
    tokio::fs::write(&lead_singing, lead_singing_wav).await?;
    tokio::fs::write(&backing_singing, backing_singing_wav).await?;
    tokio::fs::write(&vocal_master, vocal_master_wav).await?;
    tokio::fs::write(&out, full_wav).await?;
    write_vocal_plan(&ctx.run_dir, &lang, &voice, &lyrics, commands).await?;

    validate_wav_output(&lead_guide, 4096).await?;
    validate_wav_output(&backing_guide, 4096).await?;
    validate_wav_output(&lead_singing, 4096).await?;
    validate_wav_output(&backing_singing, 4096).await?;
    validate_wav_output(&vocal_master, 4096).await?;
    validate_wav_output(&out, 4096).await?;
    let qc = crate::quality_config::load_quality_config();
    let gate = crate::quality_gates::gate_audio_duration(&out, qc.min_audio_duration_s).await?;
    if !gate.ok {
        return Err(crate::quality_gates::fail_gate(gate));
    }
    Ok(())
}

async fn write_vocal_plan(
    run_dir: &std::path::Path,
    lang: &str,
    voice: &str,
    lyrics_path: &std::path::Path,
    commands: &Value,
) -> Result<()> {
    let lyrics_raw = tokio::fs::read_to_string(lyrics_path).await?;
    let lyrics_json: Value = serde_json::from_str(&lyrics_raw)?;
    let cues = build_vocal_cues(&lyrics_json);
    let music_hints = load_music_cue_hints(run_dir, cues.len()).await;
    let focus_events = build_vocal_focus_events(&cues, &music_hints);
    let cadence_anchors = build_vocal_cadence_anchors(&cues, &music_hints);
    let reply_harmony_windows = build_vocal_reply_harmony_windows(&cues, &music_hints);
    write_json(
        &run_dir.join("./build/vocals.plan.json"),
        &json!({
            "schema": "css.vocals.plan.v1",
            "lang": lang,
            "voice": voice,
            "title_hint": title_hint(commands),
            "leadGuidePath": "./build/vocals/lead_vocal_guide.wav",
            "backingGuidePath": "./build/vocals/backing_vocal_guide.wav",
            "leadSingingPath": "./build/vocals/lead_singing_voice.wav",
            "backingSingingPath": "./build/vocals/backing_singing_voice.wav",
            "vocalMasterPath": "./build/vocals/vocal_master.wav",
            "mixPath": "./build/vocals.wav",
            "focusEvents": focus_events.iter().map(|event| json!({
                "startSec": event.start_sec,
                "durationSec": event.duration_sec,
                "strength": event.strength,
                "section": event.section,
                "token": event.token
            })).collect::<Vec<_>>(),
            "cadenceAnchors": cadence_anchors.iter().map(|anchor| json!({
                "startSec": anchor.start_sec,
                "durationSec": anchor.duration_sec,
                "strength": anchor.strength,
                "section": anchor.section,
                "token": anchor.token,
                "role": anchor.role,
                "cadence": anchor.cadence,
                "cueIndex": anchor.cue_index,
                "phraseOrder": anchor.phrase_order
            })).collect::<Vec<_>>(),
            "replyHarmonyWindows": reply_harmony_windows.iter().map(|window| json!({
                "startSec": window.start_sec,
                "durationSec": window.duration_sec,
                "strength": window.strength,
                "section": window.section,
                "token": window.token,
                "role": window.role,
                "cadence": window.cadence,
                "cueIndex": window.cue_index,
                "phraseOrder": window.phrase_order,
                "bassDuck": window.bass_duck,
                "subDuck": window.sub_duck,
                "padDuck": window.pad_duck,
                "stringsDuck": window.strings_duck,
                "stringsSettleGain": window.strings_settle_gain
            })).collect::<Vec<_>>(),
            "cues": cues.iter().enumerate().map(|(idx, cue)| json!({
                "cueId": format!("vocal_{:03}", idx + 1),
                "section": cue.section,
                "startSec": cue.start_sec,
                "durationSec": cue.duration_sec,
                "text": cue.text
            })).collect::<Vec<_>>()
        }),
    )
    .await?;
    sync_reply_harmony_into_music_plan(run_dir, &reply_harmony_windows).await
}

async fn sync_reply_harmony_into_music_plan(
    run_dir: &std::path::Path,
    windows: &[VocalReplyHarmonyWindowEvent],
) -> Result<()> {
    let music_plan_path = run_dir.join("./build/music.plan.json");
    let raw = match tokio::fs::read_to_string(&music_plan_path).await {
        Ok(raw) => raw,
        Err(_) => return Ok(()),
    };
    let mut parsed: Value = match serde_json::from_str(&raw) {
        Ok(parsed) => parsed,
        Err(_) => return Ok(()),
    };
    merge_reply_harmony_windows_into_music_plan(&mut parsed, windows);
    write_json(&music_plan_path, &parsed).await
}

fn merge_reply_harmony_windows_into_music_plan(
    plan: &mut Value,
    windows: &[VocalReplyHarmonyWindowEvent],
) {
    let window_values = windows
        .iter()
        .map(reply_harmony_window_json)
        .collect::<Vec<_>>();
    if let Some(object) = plan.as_object_mut() {
        object.insert(
            "replyHarmonyWindows".to_string(),
            Value::Array(window_values.clone()),
        );
    } else {
        return;
    }

    if let Some(cues) = plan.get_mut("cues").and_then(|value| value.as_array_mut()) {
        for (cue_index, cue) in cues.iter_mut().enumerate() {
            let scoped = windows
                .iter()
                .filter(|window| window.cue_index == cue_index)
                .map(reply_harmony_window_json)
                .collect::<Vec<_>>();
            if let Some(object) = cue.as_object_mut() {
                object.insert(
                    "replyHarmonyWindows".to_string(),
                    Value::Array(scoped.clone()),
                );
                object.insert("replyHarmonyWindowCount".to_string(), json!(scoped.len()));
            }
        }
    }

    if let Some(phrases) = plan
        .get_mut("phrases")
        .and_then(|value| value.as_array_mut())
    {
        for phrase in phrases.iter_mut() {
            let section = phrase
                .get("section")
                .and_then(|value| value.as_str())
                .unwrap_or("");
            let phrase_order = phrase
                .get("phraseOrder")
                .or_else(|| phrase.get("phrase_order"))
                .and_then(|value| value.as_u64())
                .map(|value| value as usize);
            let scoped = windows
                .iter()
                .filter(|window| {
                    normalize_section_key(&window.section) == normalize_section_key(section)
                        && phrase_order
                            .map(|order| order == window.phrase_order)
                            .unwrap_or(true)
                })
                .map(reply_harmony_window_json)
                .collect::<Vec<_>>();
            if let Some(object) = phrase.as_object_mut() {
                object.insert(
                    "replyHarmonyWindows".to_string(),
                    Value::Array(scoped.clone()),
                );
                object.insert("replyHarmonyWindowCount".to_string(), json!(scoped.len()));
            }
        }
    }
}

fn reply_harmony_window_json(window: &VocalReplyHarmonyWindowEvent) -> Value {
    json!({
        "startSec": window.start_sec,
        "durationSec": window.duration_sec,
        "strength": window.strength,
        "section": window.section,
        "token": window.token,
        "role": window.role,
        "cadence": window.cadence,
        "cueIndex": window.cue_index,
        "phraseOrder": window.phrase_order,
        "bassDuck": window.bass_duck,
        "subDuck": window.sub_duck,
        "padDuck": window.pad_duck,
        "stringsDuck": window.strings_duck,
        "stringsSettleGain": window.strings_settle_gain
    })
}

fn build_vocal_cues(lyrics_json: &Value) -> Vec<VocalCue> {
    let mut cues = Vec::new();
    let mut cursor = 0.0_f32;
    let mut section_orders = std::collections::BTreeMap::<String, usize>::new();
    if let Some(lines) = lyrics_json.get("lines").and_then(|v| v.as_array()) {
        for line in lines {
            let (text, start_override) = match line {
                Value::String(text) => (text.trim().to_string(), None),
                Value::Object(map) => (
                    map.get("text")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .trim()
                        .to_string(),
                    map.get("t").and_then(|v| v.as_f64()).map(|v| v as f32),
                ),
                _ => continue,
            };
            if text.is_empty() || is_non_sung_meta_line(&text) {
                continue;
            }
            let duration = estimate_vocal_duration(&text);
            let section = text
                .split(':')
                .next()
                .map(str::trim)
                .filter(|section| !section.is_empty())
                .unwrap_or("Line")
                .to_string();
            let section_kind = classify_section(&text);
            let section_key = normalize_section_key(&section);
            let phrase_order = *section_orders.get(&section_key).unwrap_or(&0);
            let start_sec = start_override.unwrap_or(cursor);
            cues.push(VocalCue {
                start_sec,
                duration_sec: duration,
                text,
                section,
                section_kind,
                phrase_order,
            });
            section_orders.insert(section_key, phrase_order + 1);
            cursor = start_sec + duration;
        }
    }
    if cues.is_empty() {
        cues.push(VocalCue {
            start_sec: 0.0,
            duration_sec: 24.0,
            text: "cssMV guide".to_string(),
            section: "Intro".to_string(),
            section_kind: SectionKind::Intro,
            phrase_order: 0,
        });
    }
    cues
}

fn is_non_sung_meta_line(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return true;
    }
    (trimmed.starts_with('[') && trimmed.ends_with(']'))
        || (trimmed.starts_with('《') && trimmed.ends_with('》'))
}

fn estimate_vocal_duration(text: &str) -> f32 {
    let syllables = text.chars().filter(|ch| !ch.is_whitespace()).count() as f32;
    (2.0 + syllables * 0.07).clamp(2.4, 8.0)
}

async fn load_music_cue_hints(run_dir: &std::path::Path, count: usize) -> Vec<MusicCueHint> {
    let path = run_dir.join("./build/music.plan.json");
    let fallback = MusicCueHint {
        tempo_bpm: 88.0,
        root_hz: 220.0,
        energy: 0.5,
        style_brightness: 0.4,
        phrase_role: PhraseRoleHint {
            role: VocalPhraseRole::Statement,
            variation: VocalVariationRole::Primary,
            cadence: VocalCadenceIntent::Open,
        },
        guide_topline_lift: 0.0,
        lead_presence_gain: 1.0,
        backing_presence_gain: 1.0,
        diction_gain: 1.0,
    };
    let raw = match tokio::fs::read_to_string(&path).await {
        Ok(raw) => raw,
        Err(_) => return vec![fallback; count.max(1)],
    };
    let parsed: Value = match serde_json::from_str(&raw) {
        Ok(parsed) => parsed,
        Err(_) => return vec![fallback; count.max(1)],
    };
    let cue_items = parsed
        .get("cues")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    let phrase_items = parsed
        .get("phrases")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();
    let mut phrase_by_section_order = std::collections::BTreeMap::<String, Vec<Value>>::new();
    for item in phrase_items {
        let section = item
            .get("section")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .trim();
        if section.is_empty() {
            continue;
        }
        phrase_by_section_order
            .entry(normalize_section_key(section))
            .or_default()
            .push(item);
    }

    let mut cue_section_orders = std::collections::BTreeMap::<String, usize>::new();
    let mut hints = cue_items
        .iter()
        .map(|item| {
            let section = item
                .get("section")
                .and_then(|value| value.as_str())
                .unwrap_or("")
                .trim();
            let section_key = normalize_section_key(section);
            let phrase_order = *cue_section_orders.get(&section_key).unwrap_or(&0);
            let phrase_item = phrase_by_section_order
                .get(&section_key)
                .and_then(|items| items.get(phrase_order.min(items.len().saturating_sub(1))));
            cue_section_orders.insert(section_key, phrase_order + 1);
            build_music_cue_hint(item, phrase_item, fallback)
        })
        .collect::<Vec<_>>();
    if hints.is_empty() {
        hints.push(fallback);
    }
    while hints.len() < count.max(1) {
        let last = *hints.last().unwrap_or(&fallback);
        hints.push(last);
    }
    hints
}

fn render_vocal_guides(
    cues: &[VocalCue],
    hints: &[MusicCueHint],
    total_frames: usize,
    voice: &str,
    lang: &str,
    title_hint: &str,
    creative_profile: CreativeVocalProfile,
) -> (StereoGuide, StereoGuide) {
    let mut lead = StereoGuide::new(total_frames);
    let mut backing = StereoGuide::new(total_frames);
    let voice_bias = voice_bias(voice);
    let lang_bias = language_bias(lang);
    let title_bias = title_hint
        .bytes()
        .fold(0_u32, |acc, b| acc.wrapping_add(b as u32)) as f32;

    for (cue_index, cue) in cues.iter().enumerate() {
        let hint = hints.get(cue_index).copied().unwrap_or(MusicCueHint {
            tempo_bpm: 88.0,
            root_hz: 220.0,
            energy: 0.5,
            style_brightness: 0.4,
            phrase_role: PhraseRoleHint {
                role: VocalPhraseRole::Statement,
                variation: VocalVariationRole::Primary,
                cadence: VocalCadenceIntent::Open,
            },
            guide_topline_lift: 0.0,
            lead_presence_gain: 1.0,
            backing_presence_gain: 1.0,
            diction_gain: 1.0,
        });
        let start_frame = (cue.start_sec * SAMPLE_RATE as f32).floor() as usize;
        let frame_count = (cue.duration_sec * SAMPLE_RATE as f32).ceil() as usize;
        let phrase_units = extract_phrase_units(&cue.text, hint.phrase_role);
        let windows = build_phrase_unit_windows(cue.duration_sec, &phrase_units);
        let section_profile = apply_creative_profile_to_section(
            section_profile(cue.section_kind),
            cue.section_kind,
            creative_profile,
        );
        let base_freq = 176.0
            + voice_bias
            + lang_bias
            + (title_bias % 24.0)
            + section_profile.base_lift
            + hint.guide_topline_lift
            + creative_profile.register_bias;
        let backing_interval = section_profile.backing_interval;
        let phrase_gap_frames = (SAMPLE_RATE as f32 * 0.028) as usize;

        for frame_offset in 0..frame_count {
            let idx = start_frame + frame_offset;
            if idx >= total_frames {
                break;
            }
            let local_t = frame_offset as f32 / SAMPLE_RATE as f32;
            let (phrase, window, note_t) = locate_phrase_unit(local_t, &phrase_units, &windows);
            let phrase_pos = (note_t / window.duration_sec.max(0.001)).clamp(0.0, 1.0);
            let is_last_unit = windows
                .last()
                .map(|last| (window.start_sec - last.start_sec).abs() < 0.0001)
                .unwrap_or(false);
            let contour = phrase_melodic_contour(section_profile.contour, phrase_pos);
            let line_arc = cue_shape(cue_index, cues.len(), phrase_pos)
                * (section_profile.arc_width + hint.guide_topline_lift.abs() * 0.03);
            let char_bias = melody_degree(phrase.anchor) * (0.28 + phrase.emphasis * 0.22)
                + phrase.semantic_peak;
            let response_relax = if hint.phrase_role.role == VocalPhraseRole::Response {
                -0.8
            } else {
                0.0
            };
            let resolve_focus = if hint.phrase_role.role == VocalPhraseRole::Resolve {
                0.9
            } else {
                0.0
            };
            let cadence_tail = guide_cadence_tail_offset(
                hint.phrase_role,
                is_last_unit,
                phrase_pos,
                phrase.semantic_peak,
                phrase.tail_hold,
            ) + creative_phrase_end_motion(
                creative_profile,
                cue.section_kind,
                hint.phrase_role,
                phrase_pos,
                is_last_unit,
            );
            let freq = (base_freq
                + char_bias
                + contour
                + line_arc
                + response_relax
                + resolve_focus
                + cadence_tail)
                * 2.0_f32.powf(phrase.interval / 12.0);
            let phrase_frames = (window.duration_sec * SAMPLE_RATE as f32).max(1.0) as usize;
            let local_phrase_frame = ((note_t * SAMPLE_RATE as f32).floor() as usize)
                .min(phrase_frames.saturating_sub(1));
            let gap_zone = phrase_gap_frames > 0
                && local_phrase_frame
                    >= phrase_frames.saturating_sub(phrase_gap_frames.min(phrase_frames));
            let mut env = adsr(
                note_t,
                window.duration_sec,
                section_profile.attack,
                section_profile.decay,
                section_profile.sustain,
                section_profile.release,
            );
            if gap_zone {
                env *= 0.2 + phrase.release_weight * 0.14 + phrase.tail_hold * 0.08;
            }
            env *= lyric_clarity_envelope(note_t, window.duration_sec, phrase);
            let vibrato_depth = 0.0025 + section_profile.energy * 0.0032;
            let vibrato_rate = 4.4 + cue_index as f32 * 0.17 + section_profile.energy * 1.4;
            let vibrato = 1.0 + (TWO_PI * vibrato_rate * local_t).sin() * vibrato_depth;
            let lead_core = vocal_formant(
                freq * vibrato,
                note_t,
                env,
                (0.44 + section_profile.energy * 0.08) * phrase.onset_punch,
            );
            let lead_air = vocal_formant(
                freq * 2.0 * vibrato,
                note_t,
                env,
                (0.12 + section_profile.brightness * 0.08 + phrase.emphasis * 0.03)
                    * phrase.onset_punch
                    * (1.0 + phrase.semantic_peak * 0.04),
            );
            let lead_octave = vocal_formant(
                freq * 0.5 * vibrato,
                note_t,
                env * 0.64,
                (0.09 + section_profile.weight * 0.06) * phrase.tail_hold,
            );
            let backing_root = vocal_formant(
                freq * 0.5 * vibrato,
                note_t,
                env * 0.72,
                (0.18 + section_profile.weight * 0.04) * phrase.tail_hold,
            );
            let backing_fifth = vocal_formant(
                freq * 2.0_f32.powf(backing_interval / 12.0) * vibrato,
                note_t,
                env * 0.58,
                0.12 + section_profile.energy * 0.04,
            );
            let backing_third = vocal_formant(
                freq * 2.0_f32.powf(section_profile.third_interval / 12.0) * vibrato,
                note_t,
                env * 0.44,
                0.08 + section_profile.brightness * 0.03,
            );
            let pan = ((cue.start_sec + local_t) * (0.56 + section_profile.motion * 0.24)).sin()
                * (0.05 + section_profile.motion * 0.05);
            let lead_presence = hint.lead_presence_gain;
            let backing_presence = hint.backing_presence_gain;

            lead.add(
                idx,
                (lead_core + lead_air * (0.9 - pan) + lead_octave * 0.72) * lead_presence,
                (lead_core * 0.98 + lead_air * (1.02 + pan) + lead_octave * 0.66) * lead_presence,
            );
            backing.add(
                idx,
                (backing_root * (0.8 - pan) + backing_fifth * 0.76 + backing_third * 0.64)
                    * backing_presence,
                (backing_root * (0.78 + pan) + backing_fifth * 0.82 + backing_third * 0.58)
                    * backing_presence,
            );
        }
    }

    (lead, backing)
}

fn render_singing_voices(
    cues: &[VocalCue],
    hints: &[MusicCueHint],
    total_frames: usize,
    voice: &str,
    lang: &str,
    title_hint: &str,
    creative_profile: CreativeVocalProfile,
) -> (StereoGuide, StereoGuide) {
    let mut lead = StereoGuide::new(total_frames);
    let mut backing = StereoGuide::new(total_frames);
    let voice_bias = voice_bias(voice);
    let lang_bias = language_bias(lang);
    let title_bias = title_hint
        .bytes()
        .fold(0_u32, |acc, b| acc.wrapping_add(b as u32)) as f32;

    for (cue_index, cue) in cues.iter().enumerate() {
        let hint = hints.get(cue_index).copied().unwrap_or(MusicCueHint {
            tempo_bpm: 88.0,
            root_hz: 220.0,
            energy: 0.5,
            style_brightness: 0.4,
            phrase_role: PhraseRoleHint {
                role: VocalPhraseRole::Statement,
                variation: VocalVariationRole::Primary,
                cadence: VocalCadenceIntent::Open,
            },
            guide_topline_lift: 0.0,
            lead_presence_gain: 1.0,
            backing_presence_gain: 1.0,
            diction_gain: 1.0,
        });
        let start_frame = (cue.start_sec * SAMPLE_RATE as f32).floor() as usize;
        let frame_count = (cue.duration_sec * SAMPLE_RATE as f32).ceil() as usize;
        let phrase_units = extract_phrase_units(&cue.text, hint.phrase_role);
        let target_pulse = (60.0 / hint.tempo_bpm.max(56.0) * 0.75).clamp(0.16, 0.62);
        let _pulse = phrase_pulse_for_duration(
            cue.duration_sec,
            phrase_units.len(),
            target_pulse * 0.82,
            target_pulse,
        );
        let windows = build_phrase_unit_windows(cue.duration_sec, &phrase_units);
        let section_profile = apply_creative_profile_to_section(
            section_profile(cue.section_kind),
            cue.section_kind,
            creative_profile,
        );
        let base_freq = (hint.root_hz * 0.5).clamp(120.0, 420.0)
            + voice_bias
            + lang_bias
            + (title_bias % 12.0)
            + creative_profile.register_bias;

        for frame_offset in 0..frame_count {
            let idx = start_frame + frame_offset;
            if idx >= total_frames {
                break;
            }
            let local_t = frame_offset as f32 / SAMPLE_RATE as f32;
            let (phrase, window, note_t) = locate_phrase_unit(local_t, &phrase_units, &windows);
            let phrase_pos = (note_t / window.duration_sec.max(0.001)).clamp(0.0, 1.0);
            let is_last_unit = windows
                .last()
                .map(|last| (window.start_sec - last.start_sec).abs() < 0.0001)
                .unwrap_or(false);
            let contour = phrase_melodic_contour(section_profile.contour, phrase_pos);
            let degree_bias = melody_degree(phrase.anchor)
                * (0.2 + hint.energy * 0.12 + phrase.emphasis * 0.08)
                + phrase.semantic_peak;
            let section_lift = if cue.section_kind == SectionKind::Chorus {
                6.0
            } else {
                0.0
            };
            let role_lift = hint.guide_topline_lift;
            let cadence_tail = guide_cadence_tail_offset(
                hint.phrase_role,
                is_last_unit,
                phrase_pos,
                phrase.semantic_peak,
                phrase.tail_hold,
            ) + creative_phrase_end_motion(
                creative_profile,
                cue.section_kind,
                hint.phrase_role,
                phrase_pos,
                is_last_unit,
            );
            let cadence_diction = cadence_tail_diction_boost(
                hint.phrase_role,
                is_last_unit,
                phrase_pos,
                phrase.semantic_peak,
            );
            let cadence_hold = cadence_tail_envelope_hold(
                hint.phrase_role,
                is_last_unit,
                phrase_pos,
                phrase.tail_hold,
            );
            let freq = (base_freq
                + contour
                + degree_bias
                + cue_shape(cue_index, cues.len(), phrase_pos) * section_profile.arc_width
                + section_lift
                + role_lift
                + cadence_tail)
                * 2.0_f32.powf(phrase.interval / 12.0);
            let mut env = adsr(
                note_t,
                window.duration_sec,
                (0.02 + (1.0 - hint.energy) * 0.02).max(0.016),
                0.12,
                0.74 + hint.energy * 0.12,
                0.13 + phrase.release_weight * 0.04 + (phrase.tail_hold - 1.0).max(0.0) * 0.04,
            );
            env *= lyric_clarity_envelope(note_t, window.duration_sec, phrase);
            if hint.phrase_role.role == VocalPhraseRole::Release {
                env *= 0.92;
            } else if hint.phrase_role.role == VocalPhraseRole::Resolve {
                env *= 1.04;
            }
            env *= cadence_hold;
            let vibrato = 1.0
                + (TWO_PI * (4.8 + hint.energy * 2.0) * local_t).sin()
                    * (0.003 + hint.energy * 0.004);
            let chest = vocal_formant(
                freq * vibrato,
                note_t,
                env,
                (0.54 + hint.energy * 0.08)
                    * phrase.onset_punch
                    * (1.0 + phrase.semantic_peak * 0.03),
            );
            let presence = vocal_formant(
                freq * 2.0 * vibrato,
                note_t,
                env,
                (0.16 + hint.style_brightness * 0.06 + phrase.emphasis * 0.04)
                    * phrase.onset_punch
                    * (1.0 + phrase.semantic_peak * 0.05),
            );
            let head = vocal_formant(
                freq * 4.0 * vibrato,
                note_t,
                env * 0.78,
                (0.05 + hint.style_brightness * 0.04) * phrase.tail_hold,
            );
            let harmony = vocal_formant(
                freq * 2.0_f32.powf((section_profile.third_interval + 12.0) / 12.0) * vibrato,
                note_t,
                env * 0.62,
                (0.1 + hint.energy * 0.04) * phrase.tail_hold,
            );
            let low_double = vocal_formant(
                freq * 0.5 * vibrato,
                note_t,
                env * 0.72,
                (0.11 + section_profile.weight * 0.05) * phrase.tail_hold,
            );
            let diction = diction_transient(
                note_t,
                window.duration_sec,
                phrase.emphasis * phrase.onset_punch * (1.0 + phrase.semantic_peak * 0.08),
            ) * hint.diction_gain
                * cadence_diction;
            let pan = ((cue.start_sec + local_t) * 0.43).sin() * 0.06;
            lead.add(
                idx,
                (chest + presence * (0.92 - pan) + head * 0.7 + diction) * hint.lead_presence_gain,
                (chest * 0.98 + presence * (1.02 + pan) + head * 0.64 + diction * 0.92)
                    * hint.lead_presence_gain,
            );
            backing.add(
                idx,
                (harmony * (0.84 - pan) + low_double * 0.72) * hint.backing_presence_gain,
                (harmony * (0.8 + pan) + low_double * 0.68) * hint.backing_presence_gain,
            );
        }
    }
    (lead, backing)
}

fn sum_guides(lead: &StereoGuide, backing: &StereoGuide) -> StereoGuide {
    let mut summed = StereoGuide::new(lead.left.len().min(backing.left.len()));
    for idx in 0..summed.left.len() {
        summed.left[idx] = (lead.left[idx] * 0.98 + backing.left[idx] * 0.56).clamp(-1.0, 1.0);
        summed.right[idx] = (lead.right[idx] * 0.98 + backing.right[idx] * 0.56).clamp(-1.0, 1.0);
    }
    summed
}

fn apply_guide_master(left: &mut [f32], right: &mut [f32], target_peak: f32) {
    for idx in 0..left.len().min(right.len()) {
        let mid = (left[idx] + right[idx]) * 0.5;
        let side = (left[idx] - right[idx]) * 0.5 * 0.9;
        left[idx] = soft_clip(mid * 1.18 + side);
        right[idx] = soft_clip(mid * 1.18 - side);
    }
    normalize_peak(left, right, target_peak);
}

fn normalize_peak(left: &mut [f32], right: &mut [f32], target_peak: f32) {
    let mut peak = 0.0001_f32;
    for idx in 0..left.len().min(right.len()) {
        peak = peak.max(left[idx].abs()).max(right[idx].abs());
    }
    let gain = (target_peak / peak).clamp(0.25, 6.0);
    for idx in 0..left.len().min(right.len()) {
        left[idx] = soft_clip(left[idx] * gain);
        right[idx] = soft_clip(right[idx] * gain);
    }
}

fn soft_clip(sample: f32) -> f32 {
    let drive = sample * 1.12;
    (drive / (1.0 + drive.abs())).clamp(-1.0, 1.0)
}

fn adsr(t: f32, duration: f32, attack: f32, decay: f32, sustain: f32, release: f32) -> f32 {
    let attack_time = duration * attack;
    let decay_time = duration * decay;
    let release_time = duration * release;
    let sustain_end = (duration - release_time).max(attack_time + decay_time);
    if t < attack_time.max(0.001) {
        return (t / attack_time.max(0.001)).clamp(0.0, 1.0);
    }
    if t < attack_time + decay_time {
        let decay_pos = (t - attack_time) / decay_time.max(0.001);
        return 1.0 + (sustain - 1.0) * decay_pos.clamp(0.0, 1.0);
    }
    if t < sustain_end {
        return sustain;
    }
    let release_pos = (t - sustain_end) / release_time.max(0.001);
    sustain * (1.0 - release_pos.clamp(0.0, 1.0))
}

fn vocal_formant(freq: f32, t: f32, env: f32, gain: f32) -> f32 {
    let fundamental = (TWO_PI * freq * t).sin() * 0.46;
    let second = (TWO_PI * freq * 2.0 * t).sin() * 0.18;
    let third = (TWO_PI * freq * 3.0 * t).sin() * 0.08;
    let breath = (TWO_PI * freq * 0.5 * t).sin() * 0.12;
    (fundamental + second + third + breath) * env * gain
}

fn melody_degree(ch: char) -> f32 {
    match (ch as u32) % 8 {
        0 => 0.0,
        1 => 2.0,
        2 => 4.0,
        3 => 7.0,
        4 => 9.0,
        5 => 12.0,
        6 => 7.0,
        _ => 4.0,
    }
}

#[derive(Clone, Copy)]
struct PhraseUnit {
    anchor: char,
    interval: f32,
    emphasis: f32,
    release_weight: f32,
    timing_weight: f32,
    onset_punch: f32,
    tail_hold: f32,
    semantic_peak: f32,
}

impl PhraseUnit {
    fn fallback() -> Self {
        Self {
            anchor: 'a',
            interval: 0.0,
            emphasis: 0.5,
            release_weight: 0.5,
            timing_weight: 1.0,
            onset_punch: 1.0,
            tail_hold: 1.0,
            semantic_peak: 0.0,
        }
    }
}

#[derive(Clone, Copy)]
struct SectionProfile {
    base_lift: f32,
    contour: &'static [f32],
    scale_steps: &'static [f32],
    energy: f32,
    brightness: f32,
    weight: f32,
    motion: f32,
    arc_width: f32,
    attack: f32,
    decay: f32,
    sustain: f32,
    release: f32,
    backing_interval: f32,
    third_interval: f32,
}

#[derive(Clone, Copy)]
struct VocalPhraseShaping {
    guide_topline_lift: f32,
    lead_presence_gain: f32,
    backing_presence_gain: f32,
    diction_gain: f32,
}

#[derive(Clone, Copy)]
struct LexicalDeliveryProfile {
    emphasis_gain: f32,
    timing_gain: f32,
    onset_gain: f32,
    tail_gain: f32,
}

#[derive(Clone, Copy)]
struct SemanticDeliveryProfile {
    emphasis_gain: f32,
    pitch_lift: f32,
    onset_gain: f32,
    tail_gain: f32,
}

fn load_creative_vocal_profile(commands: &Value) -> CreativeVocalProfile {
    let creative = commands.get("creative").cloned().unwrap_or(Value::Null);
    let arrangement_density = creative
        .get("arrangement_density")
        .and_then(|value| value.as_f64())
        .unwrap_or(0.6) as f32;
    let humanization = creative
        .get("humanization")
        .and_then(|value| value.as_f64())
        .unwrap_or(0.35) as f32;
    let dynamic_blob = format!(
        "{} {}",
        creative
            .get("dynamics_curve")
            .and_then(|value| value.as_str())
            .unwrap_or(""),
        creative
            .get("expression_cc_bias")
            .and_then(|value| value.as_str())
            .unwrap_or("")
    )
    .to_ascii_lowercase();
    let section_blob = format!(
        "{} {}",
        creative
            .get("section_form")
            .and_then(|value| value.as_str())
            .unwrap_or(""),
        creative
            .get("inspiration_notes")
            .and_then(|value| value.as_str())
            .unwrap_or("")
    )
    .to_ascii_lowercase();
    let melodic_blob = format!(
        "{} {}",
        creative
            .get("vocal_style")
            .and_then(|value| value.as_str())
            .unwrap_or(""),
        creative
            .get("prompt")
            .and_then(|value| value.as_str())
            .unwrap_or("")
    )
    .to_ascii_lowercase();
    let articulation_blob = creative
        .get("articulation_bias")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let register_blob = creative
        .get("voicing_register")
        .and_then(|value| value.as_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let ambience_blob = format!(
        "{} {}",
        creative
            .get("ambience")
            .and_then(|value| value.as_str())
            .unwrap_or(""),
        creative
            .get("licensed_style_pack")
            .and_then(|value| value.as_str())
            .unwrap_or("")
    )
    .to_ascii_lowercase();
    let instrumentation_blob = format!(
        "{} {} {}",
        creative
            .get("instrumentation")
            .and_then(|value| value.as_str())
            .unwrap_or(""),
        creative
            .get("instrument")
            .and_then(|value| value.as_str())
            .unwrap_or(""),
        creative
            .get("ensemble_style")
            .and_then(|value| value.as_str())
            .unwrap_or("")
    )
    .to_ascii_lowercase();
    CreativeVocalProfile {
        dynamic_range: ((arrangement_density * 0.58_f32)
            + (humanization * 0.16_f32)
            + if dynamic_blob.contains("surge") || dynamic_blob.contains("bloom") {
                0.18_f32
            } else {
                0.08_f32
            })
        .clamp(0.0_f32, 1.0_f32),
        section_contrast: (if section_blob.contains("contrast")
            || section_blob.contains("trilogy")
            || section_blob.contains("opera")
        {
            0.82_f32
        } else {
            0.56_f32
        })
        .clamp(0.0_f32, 1.0_f32),
        melodic_contour: if melodic_blob.contains("ascending") || melodic_blob.contains("rise") {
            MelodicContourMode::Ascending
        } else if melodic_blob.contains("wave") || melodic_blob.contains("call") {
            MelodicContourMode::Wave
        } else if melodic_blob.contains("grounded") || melodic_blob.contains("chant") {
            MelodicContourMode::Grounded
        } else {
            MelodicContourMode::Arched
        },
        articulation_bias: if articulation_blob.contains("accent")
            || articulation_blob.contains("punch")
        {
            1.0
        } else if articulation_blob.contains("legato") || articulation_blob.contains("flowing") {
            -1.0
        } else {
            0.0
        },
        register_bias: if register_blob.contains("wide") {
            4.0
        } else if register_blob.contains("high") {
            7.0
        } else if register_blob.contains("low") {
            -6.0
        } else {
            0.0
        },
        ambience_depth: if ambience_blob.contains("cathedral") || ambience_blob.contains("hall") {
            1.0
        } else if ambience_blob.contains("mist") || ambience_blob.contains("smoke") {
            0.72
        } else if ambience_blob.contains("dry") || ambience_blob.contains("close") {
            -0.5
        } else {
            0.18
        },
        instrumentation_bias: if instrumentation_blob.contains("guzheng")
            || instrumentation_blob.contains("erhu")
            || instrumentation_blob.contains("pipa")
        {
            -0.35
        } else if instrumentation_blob.contains("strings")
            || instrumentation_blob.contains("orchestra")
            || instrumentation_blob.contains("symph")
        {
            0.28
        } else if instrumentation_blob.contains("synth") || instrumentation_blob.contains("electro")
        {
            0.18
        } else {
            0.0
        },
        theatrical_bias: if dynamic_blob.contains("theatrical")
            || section_blob.contains("opera")
            || ambience_blob.contains("cathedral")
        {
            0.82
        } else {
            0.24
        },
    }
}

fn classify_section(text: &str) -> SectionKind {
    let lower = text.to_ascii_lowercase();
    if lower.contains("intro") {
        SectionKind::Intro
    } else if lower.contains("chorus") {
        SectionKind::Chorus
    } else if lower.contains("bridge") {
        SectionKind::Bridge
    } else if lower.contains("outro") {
        SectionKind::Outro
    } else if lower.contains("verse") {
        SectionKind::Verse
    } else if lower.contains("场") || lower.contains("幕") || lower.contains("歌剧") {
        SectionKind::OperaScene
    } else if lower.contains("part") || lower.contains("三部曲") {
        SectionKind::TriptychPart
    } else {
        SectionKind::Generic
    }
}

fn normalize_section_key(value: &str) -> String {
    value
        .split(':')
        .next()
        .unwrap_or(value)
        .trim()
        .to_ascii_lowercase()
}

fn phrase_role_hint_from_plan_phrase(
    role: Option<&Value>,
    variation: Option<&Value>,
    cadence: Option<&Value>,
) -> PhraseRoleHint {
    let role = match role.and_then(|value| value.as_str()).unwrap_or("statement") {
        "setup" => VocalPhraseRole::Setup,
        "response" => VocalPhraseRole::Response,
        "lift" => VocalPhraseRole::Lift,
        "release" => VocalPhraseRole::Release,
        "resolve" => VocalPhraseRole::Resolve,
        _ => VocalPhraseRole::Statement,
    };
    let variation = match variation
        .and_then(|value| value.as_str())
        .unwrap_or("primary")
    {
        "repeat" => VocalVariationRole::Repeat,
        "answer" => VocalVariationRole::Answer,
        "development" => VocalVariationRole::Development,
        _ => VocalVariationRole::Primary,
    };
    let cadence = match cadence.and_then(|value| value.as_str()).unwrap_or("open") {
        "half" => VocalCadenceIntent::Half,
        "authentic" => VocalCadenceIntent::Authentic,
        "plagal" => VocalCadenceIntent::Plagal,
        "deceptive" => VocalCadenceIntent::Deceptive,
        "resolved" => VocalCadenceIntent::Resolved,
        _ => VocalCadenceIntent::Open,
    };
    PhraseRoleHint {
        role,
        variation,
        cadence,
    }
}

fn vocal_phrase_shaping(hint: PhraseRoleHint) -> VocalPhraseShaping {
    let mut shaping = match hint.role {
        VocalPhraseRole::Setup => VocalPhraseShaping {
            guide_topline_lift: -2.0,
            lead_presence_gain: 0.92,
            backing_presence_gain: 0.92,
            diction_gain: 0.96,
        },
        VocalPhraseRole::Response => VocalPhraseShaping {
            guide_topline_lift: -1.5,
            lead_presence_gain: 0.9,
            backing_presence_gain: 1.14,
            diction_gain: 0.98,
        },
        VocalPhraseRole::Lift => VocalPhraseShaping {
            guide_topline_lift: 2.5,
            lead_presence_gain: 1.08,
            backing_presence_gain: 0.92,
            diction_gain: 1.06,
        },
        VocalPhraseRole::Release => VocalPhraseShaping {
            guide_topline_lift: -3.0,
            lead_presence_gain: 0.84,
            backing_presence_gain: 0.88,
            diction_gain: 1.02,
        },
        VocalPhraseRole::Resolve => VocalPhraseShaping {
            guide_topline_lift: 1.5,
            lead_presence_gain: 1.12,
            backing_presence_gain: 0.82,
            diction_gain: 1.1,
        },
        VocalPhraseRole::Statement => VocalPhraseShaping {
            guide_topline_lift: 0.0,
            lead_presence_gain: 1.0,
            backing_presence_gain: 1.0,
            diction_gain: 1.0,
        },
    };

    match hint.variation {
        VocalVariationRole::Answer => {
            shaping.guide_topline_lift -= 1.0;
            shaping.lead_presence_gain *= 0.94;
            shaping.backing_presence_gain *= 1.08;
        }
        VocalVariationRole::Development => {
            shaping.guide_topline_lift += 1.2;
            shaping.lead_presence_gain *= 1.04;
            shaping.diction_gain *= 1.04;
        }
        VocalVariationRole::Repeat => {
            shaping.lead_presence_gain *= 1.03;
            shaping.backing_presence_gain *= 0.94;
        }
        VocalVariationRole::Primary => {}
    }

    match hint.cadence {
        VocalCadenceIntent::Authentic
        | VocalCadenceIntent::Plagal
        | VocalCadenceIntent::Resolved => {
            shaping.guide_topline_lift += 1.0;
            shaping.lead_presence_gain *= 1.04;
            shaping.backing_presence_gain *= 0.9;
            shaping.diction_gain *= 1.06;
        }
        VocalCadenceIntent::Half | VocalCadenceIntent::Deceptive => {
            shaping.guide_topline_lift += 0.6;
            shaping.backing_presence_gain *= 1.06;
        }
        VocalCadenceIntent::Open => {}
    }

    shaping
}

fn build_music_cue_hint(
    cue_item: &Value,
    phrase_item: Option<&Value>,
    fallback: MusicCueHint,
) -> MusicCueHint {
    let phrase_role = phrase_role_hint_from_plan_phrase(
        phrase_item.and_then(|item| item.get("role")),
        phrase_item.and_then(|item| item.get("variationRole")),
        phrase_item
            .and_then(|item| item.get("cadenceIntent"))
            .or_else(|| {
                phrase_item
                    .and_then(|item| item.get("constraints"))
                    .and_then(|constraints| constraints.get("cadenceBias"))
            }),
    );
    let phrasing = vocal_phrase_shaping(phrase_role);
    MusicCueHint {
        tempo_bpm: cue_item
            .get("tempoBpm")
            .and_then(|v| v.as_f64())
            .unwrap_or(fallback.tempo_bpm as f64) as f32,
        root_hz: cue_item
            .get("rootHz")
            .and_then(|v| v.as_f64())
            .unwrap_or(fallback.root_hz as f64) as f32,
        energy: match cue_item
            .get("energy")
            .and_then(|v| v.as_str())
            .unwrap_or("medium")
        {
            "low" => 0.24,
            "high" => 0.72,
            "peak" => 1.0,
            _ => 0.5,
        },
        style_brightness: match cue_item.get("style").and_then(|v| v.as_str()).unwrap_or("") {
            "guofeng-ensemble" => 0.34,
            "strings-cinematic" => 0.46,
            "piano-led" => 0.28,
            _ => fallback.style_brightness.max(0.58),
        },
        phrase_role,
        guide_topline_lift: phrasing.guide_topline_lift,
        lead_presence_gain: phrasing.lead_presence_gain,
        backing_presence_gain: phrasing.backing_presence_gain,
        diction_gain: phrasing.diction_gain,
    }
}

fn section_profile(kind: SectionKind) -> SectionProfile {
    const INTRO_CONTOUR: &[f32] = &[0.0, 1.0, 2.5, 1.2];
    const VERSE_CONTOUR: &[f32] = &[0.0, 1.5, 3.0, 2.4, 1.2];
    const CHORUS_CONTOUR: &[f32] = &[3.0, 5.0, 7.0, 9.0, 6.0];
    const BRIDGE_CONTOUR: &[f32] = &[1.0, 2.5, 4.0, 5.0, 3.0];
    const OUTRO_CONTOUR: &[f32] = &[2.0, 1.0, 0.0, -1.0];
    const OPERA_CONTOUR: &[f32] = &[0.0, 4.0, 7.0, 9.0, 6.0, 3.0];
    const TRIPTYCH_CONTOUR: &[f32] = &[0.0, 2.0, 4.0, 6.0, 8.0, 5.0];
    const INTRO_SCALE: &[f32] = &[0.0, 2.0, 4.0, 7.0];
    const VERSE_SCALE: &[f32] = &[0.0, 2.0, 4.0, 5.0, 7.0];
    const CHORUS_SCALE: &[f32] = &[0.0, 4.0, 7.0, 9.0, 12.0];
    const BRIDGE_SCALE: &[f32] = &[0.0, 2.0, 5.0, 7.0, 9.0];
    match kind {
        SectionKind::Intro => SectionProfile {
            base_lift: -10.0,
            contour: INTRO_CONTOUR,
            scale_steps: INTRO_SCALE,
            energy: 0.28,
            brightness: 0.34,
            weight: 0.24,
            motion: 0.2,
            arc_width: 0.7,
            attack: 0.09,
            decay: 0.15,
            sustain: 0.64,
            release: 0.2,
            backing_interval: 7.0,
            third_interval: 4.0,
        },
        SectionKind::Verse => SectionProfile {
            base_lift: -2.0,
            contour: VERSE_CONTOUR,
            scale_steps: VERSE_SCALE,
            energy: 0.42,
            brightness: 0.4,
            weight: 0.36,
            motion: 0.3,
            arc_width: 0.92,
            attack: 0.07,
            decay: 0.12,
            sustain: 0.68,
            release: 0.16,
            backing_interval: 7.0,
            third_interval: 4.0,
        },
        SectionKind::Chorus => SectionProfile {
            base_lift: 12.0,
            contour: CHORUS_CONTOUR,
            scale_steps: CHORUS_SCALE,
            energy: 0.88,
            brightness: 0.76,
            weight: 0.62,
            motion: 0.48,
            arc_width: 1.12,
            attack: 0.04,
            decay: 0.1,
            sustain: 0.82,
            release: 0.14,
            backing_interval: 12.0,
            third_interval: 7.0,
        },
        SectionKind::Bridge => SectionProfile {
            base_lift: 4.0,
            contour: BRIDGE_CONTOUR,
            scale_steps: BRIDGE_SCALE,
            energy: 0.54,
            brightness: 0.46,
            weight: 0.4,
            motion: 0.34,
            arc_width: 0.82,
            attack: 0.06,
            decay: 0.13,
            sustain: 0.7,
            release: 0.16,
            backing_interval: 7.0,
            third_interval: 4.0,
        },
        SectionKind::Outro => SectionProfile {
            base_lift: -6.0,
            contour: OUTRO_CONTOUR,
            scale_steps: INTRO_SCALE,
            energy: 0.24,
            brightness: 0.28,
            weight: 0.26,
            motion: 0.16,
            arc_width: 0.62,
            attack: 0.08,
            decay: 0.14,
            sustain: 0.58,
            release: 0.24,
            backing_interval: 7.0,
            third_interval: 4.0,
        },
        SectionKind::OperaScene => SectionProfile {
            base_lift: 18.0,
            contour: OPERA_CONTOUR,
            scale_steps: CHORUS_SCALE,
            energy: 0.96,
            brightness: 0.68,
            weight: 0.74,
            motion: 0.56,
            arc_width: 1.18,
            attack: 0.04,
            decay: 0.09,
            sustain: 0.84,
            release: 0.12,
            backing_interval: 12.0,
            third_interval: 7.0,
        },
        SectionKind::TriptychPart => SectionProfile {
            base_lift: 8.0,
            contour: TRIPTYCH_CONTOUR,
            scale_steps: VERSE_SCALE,
            energy: 0.72,
            brightness: 0.5,
            weight: 0.54,
            motion: 0.42,
            arc_width: 0.98,
            attack: 0.05,
            decay: 0.11,
            sustain: 0.74,
            release: 0.16,
            backing_interval: 7.0,
            third_interval: 4.0,
        },
        SectionKind::Generic => SectionProfile {
            base_lift: 0.0,
            contour: VERSE_CONTOUR,
            scale_steps: VERSE_SCALE,
            energy: 0.46,
            brightness: 0.4,
            weight: 0.38,
            motion: 0.3,
            arc_width: 0.88,
            attack: 0.07,
            decay: 0.12,
            sustain: 0.68,
            release: 0.16,
            backing_interval: 7.0,
            third_interval: 4.0,
        },
    }
}

fn apply_creative_profile_to_section(
    mut profile: SectionProfile,
    kind: SectionKind,
    creative: CreativeVocalProfile,
) -> SectionProfile {
    let contrast = creative.section_contrast;
    let dynamic = creative.dynamic_range;
    profile.energy = (profile.energy + dynamic * 0.18).clamp(0.0, 1.0);
    profile.arc_width = (profile.arc_width + contrast * 0.18).clamp(0.52, 1.34);
    profile.motion = (profile.motion + contrast * 0.12).clamp(0.08, 0.72);
    profile.brightness = (profile.brightness + dynamic * 0.08).clamp(0.18, 0.9);
    profile.weight = (profile.weight + dynamic * 0.06).clamp(0.18, 0.92);
    profile.attack = (profile.attack - creative.articulation_bias * 0.01).clamp(0.03, 0.12);
    profile.release = (profile.release + dynamic * 0.04 + creative.ambience_depth.max(0.0) * 0.03)
        .clamp(0.1, 0.34);
    profile.base_lift += creative.instrumentation_bias * 1.8;
    profile.arc_width = (profile.arc_width + creative.theatrical_bias * 0.06).clamp(0.52, 1.42);
    match (creative.melodic_contour, kind) {
        (MelodicContourMode::Ascending, SectionKind::Chorus | SectionKind::Bridge) => {
            profile.base_lift += 3.5;
            profile.arc_width = (profile.arc_width + 0.08).clamp(0.52, 1.4);
        }
        (MelodicContourMode::Grounded, SectionKind::Verse | SectionKind::Intro) => {
            profile.base_lift -= 2.0;
            profile.motion = (profile.motion - 0.06).clamp(0.08, 0.72);
        }
        (MelodicContourMode::Wave, _) => {
            profile.motion = (profile.motion + 0.08).clamp(0.08, 0.78);
        }
        _ => {}
    }
    profile
}

fn extract_phrase_units(text: &str, role_hint: PhraseRoleHint) -> Vec<PhraseUnit> {
    let normalized = text.replace(['《', '》', '[', ']', '(', ')'], " ").replace(
        [
            '：', ':', '，', ',', '。', '.', '！', '!', '？', '?', '/', '／', ';',
        ],
        "|",
    );
    let mut out = Vec::new();
    let chunks = normalized
        .split('|')
        .flat_map(split_phrase_chunk)
        .collect::<Vec<_>>();
    let scale = scale_for_text(text);
    for (index, trimmed) in chunks.iter().enumerate() {
        let anchor = trimmed
            .chars()
            .find(|ch| !ch.is_whitespace())
            .unwrap_or('a');
        let lexical = lexical_delivery_profile(trimmed, index, chunks.len());
        let semantic = semantic_delivery_profile(trimmed, index, chunks.len());
        let emphasis = (estimate_phrase_emphasis(trimmed, index, chunks.len())
            * lexical.emphasis_gain
            * semantic.emphasis_gain)
            .clamp(0.24, 1.06);
        let release_weight =
            (estimate_release_weight(trimmed) * lexical.tail_gain * semantic.tail_gain)
                .clamp(0.24, 1.22);
        let interval =
            stable_phrase_interval(trimmed, scale, index, chunks.len(), semantic.pitch_lift);
        let (timing_weight, onset_punch, tail_hold) =
            phrase_unit_delivery(index, chunks.len(), role_hint, emphasis, release_weight);
        out.push(PhraseUnit {
            anchor,
            interval,
            emphasis,
            release_weight,
            timing_weight: (timing_weight * lexical.timing_gain).clamp(0.56, 1.72),
            onset_punch: (onset_punch * lexical.onset_gain * semantic.onset_gain).clamp(0.76, 1.6),
            tail_hold: (tail_hold * lexical.tail_gain * semantic.tail_gain).clamp(0.76, 1.68),
            semantic_peak: semantic.pitch_lift,
        });
    }
    if out.is_empty() {
        out.push(PhraseUnit::fallback());
    }
    out
}

fn phrase_melodic_contour(contour: &[f32], pos: f32) -> f32 {
    if contour.is_empty() {
        return 0.0;
    }
    if contour.len() == 1 {
        return contour[0];
    }
    let scaled = pos.clamp(0.0, 1.0) * (contour.len() - 1) as f32;
    let idx = scaled.floor() as usize;
    let next = (idx + 1).min(contour.len() - 1);
    let frac = scaled - idx as f32;
    contour[idx] + (contour[next] - contour[idx]) * frac
}

fn guide_cadence_tail_offset(
    hint: PhraseRoleHint,
    is_last_unit: bool,
    phrase_pos: f32,
    semantic_peak: f32,
    tail_hold: f32,
) -> f32 {
    if !is_last_unit {
        return 0.0;
    }
    let tail_progress = ((phrase_pos - 0.48) / 0.52).clamp(0.0, 1.0);
    if tail_progress <= 0.0 {
        return 0.0;
    }
    let semantic_weight = semantic_peak.max(0.0).min(2.4);
    let hold_weight = (tail_hold - 1.0).max(0.0).min(0.6);
    match (hint.role, hint.cadence) {
        (
            VocalPhraseRole::Resolve,
            VocalCadenceIntent::Authentic
            | VocalCadenceIntent::Resolved
            | VocalCadenceIntent::Plagal,
        ) => -(1.4 + semantic_weight * 0.55 + hold_weight * 1.1) * tail_progress,
        (
            VocalPhraseRole::Release,
            VocalCadenceIntent::Authentic
            | VocalCadenceIntent::Resolved
            | VocalCadenceIntent::Plagal,
        ) => -(1.0 + semantic_weight * 0.38 + hold_weight * 0.86) * tail_progress,
        (VocalPhraseRole::Resolve, VocalCadenceIntent::Half | VocalCadenceIntent::Deceptive) => {
            -(0.46 + semantic_weight * 0.18) * tail_progress
        }
        _ => 0.0,
    }
}

fn creative_phrase_end_motion(
    creative: CreativeVocalProfile,
    kind: SectionKind,
    hint: PhraseRoleHint,
    phrase_pos: f32,
    is_last_unit: bool,
) -> f32 {
    if !is_last_unit {
        return 0.0;
    }
    let tail_progress = ((phrase_pos - 0.5) / 0.5).clamp(0.0, 1.0);
    if tail_progress <= 0.0 {
        return 0.0;
    }
    let contrast_boost = creative.section_contrast * 0.9;
    let dynamic_boost = creative.dynamic_range * 0.85;
    match (hint.role, hint.cadence) {
        (
            VocalPhraseRole::Resolve | VocalPhraseRole::Release,
            VocalCadenceIntent::Authentic
            | VocalCadenceIntent::Resolved
            | VocalCadenceIntent::Plagal,
        ) => {
            let section_bias = match kind {
                SectionKind::Chorus => 1.2 + creative.theatrical_bias * 0.18,
                SectionKind::Bridge => 0.9 + creative.section_contrast * 0.12,
                SectionKind::Outro => 1.0,
                _ => 0.62,
            };
            let contour_bias = match creative.melodic_contour {
                MelodicContourMode::Ascending => -0.9,
                MelodicContourMode::Wave => -0.55,
                MelodicContourMode::Grounded => -0.18,
                MelodicContourMode::Arched => -0.42,
            };
            contour_bias * tail_progress * (section_bias + contrast_boost + dynamic_boost)
        }
        _ => 0.0,
    }
}

fn cadence_tail_diction_boost(
    hint: PhraseRoleHint,
    is_last_unit: bool,
    phrase_pos: f32,
    semantic_peak: f32,
) -> f32 {
    if !is_last_unit {
        return 1.0;
    }
    let tail_progress = ((phrase_pos - 0.4) / 0.6).clamp(0.0, 1.0);
    if tail_progress <= 0.0 {
        return 1.0;
    }
    let semantic_weight = semantic_peak.max(0.0).min(2.0);
    match (hint.role, hint.cadence) {
        (
            VocalPhraseRole::Resolve | VocalPhraseRole::Release,
            VocalCadenceIntent::Authentic
            | VocalCadenceIntent::Resolved
            | VocalCadenceIntent::Plagal,
        ) => 1.0 + tail_progress * (0.08 + semantic_weight * 0.03),
        _ => 1.0,
    }
}

fn cadence_tail_envelope_hold(
    hint: PhraseRoleHint,
    is_last_unit: bool,
    phrase_pos: f32,
    tail_hold: f32,
) -> f32 {
    if !is_last_unit {
        return 1.0;
    }
    let tail_progress = ((phrase_pos - 0.46) / 0.54).clamp(0.0, 1.0);
    if tail_progress <= 0.0 {
        return 1.0;
    }
    let hold_weight = (tail_hold - 1.0).max(0.0).min(0.6);
    match (hint.role, hint.cadence) {
        (
            VocalPhraseRole::Resolve,
            VocalCadenceIntent::Authentic
            | VocalCadenceIntent::Resolved
            | VocalCadenceIntent::Plagal,
        ) => 1.0 + tail_progress * (0.12 + hold_weight * 0.18),
        (
            VocalPhraseRole::Release,
            VocalCadenceIntent::Authentic
            | VocalCadenceIntent::Resolved
            | VocalCadenceIntent::Plagal,
        ) => 1.0 + tail_progress * (0.08 + hold_weight * 0.14),
        _ => 1.0,
    }
}

fn cue_shape(cue_index: usize, total: usize, phrase_pos: f32) -> f32 {
    if total <= 1 {
        return (phrase_pos - 0.5) * 1.5;
    }
    let progress = cue_index as f32 / (total.saturating_sub(1)) as f32;
    let arc = if progress < 0.55 {
        progress * 5.0
    } else {
        (1.0 - progress) * 4.0
    };
    arc + (phrase_pos - 0.5) * 2.0
}

fn split_phrase_chunk(chunk: &str) -> Vec<String> {
    let trimmed = chunk.trim();
    if trimmed.is_empty() {
        return Vec::new();
    }
    if trimmed.chars().any(|ch| ch.is_ascii_whitespace()) {
        return trimmed
            .split_whitespace()
            .map(str::trim)
            .filter(|part| !part.is_empty())
            .map(str::to_string)
            .collect();
    }
    trimmed
        .chars()
        .filter(|ch| !ch.is_whitespace())
        .map(|ch| ch.to_string())
        .collect()
}

fn scale_for_text(text: &str) -> &'static [f32] {
    section_profile(classify_section(text)).scale_steps
}

fn stable_phrase_interval(
    text: &str,
    scale: &[f32],
    index: usize,
    total: usize,
    semantic_peak: f32,
) -> f32 {
    if scale.is_empty() {
        return 0.0;
    }
    let weight = text.chars().filter(|ch| !ch.is_whitespace()).count() + index;
    let mut scale_index = weight % scale.len();
    if total > 1 && index + 1 == total {
        scale_index = scale.len().saturating_sub(1).min(2);
    }
    (scale[scale_index] + semantic_peak).clamp(-2.0, 16.0)
}

fn estimate_phrase_emphasis(text: &str, index: usize, total: usize) -> f32 {
    let density = text.chars().filter(|ch| !ch.is_whitespace()).count() as f32;
    let edge_bonus = if total > 1 && index + 1 == total {
        0.18
    } else {
        0.0
    };
    (0.34 + density.min(6.0) * 0.06 + edge_bonus).clamp(0.28, 0.92)
}

fn estimate_release_weight(text: &str) -> f32 {
    let ending = text.chars().last().unwrap_or('a');
    if matches!(
        ending,
        'a' | 'o' | 'e' | 'i' | 'u' | 'y' | '啊' | '哦' | '呜' | '衣'
    ) {
        0.8
    } else {
        0.42
    }
}

fn lexical_delivery_profile(text: &str, index: usize, total: usize) -> LexicalDeliveryProfile {
    let normalized = text.trim().to_ascii_lowercase();
    let is_light = is_light_function_word(text, &normalized);
    let open_tail = has_open_tail(text, &normalized);
    let content_focus = is_content_focus_word(text, &normalized, index, total);

    let mut profile = LexicalDeliveryProfile {
        emphasis_gain: 1.0,
        timing_gain: 1.0,
        onset_gain: 1.0,
        tail_gain: 1.0,
    };

    if is_light {
        profile.emphasis_gain *= 0.72;
        profile.timing_gain *= 0.78;
        profile.onset_gain *= 0.84;
        profile.tail_gain *= 0.82;
    }
    if open_tail {
        profile.timing_gain *= 1.08;
        profile.tail_gain *= 1.22;
    }
    if content_focus {
        profile.emphasis_gain *= 1.18;
        profile.timing_gain *= 1.08;
        profile.onset_gain *= 1.16;
        if index + 1 == total.max(1) {
            profile.tail_gain *= 1.16;
        }
    }

    profile
}

fn semantic_delivery_profile(text: &str, index: usize, total: usize) -> SemanticDeliveryProfile {
    let normalized = text.trim().to_ascii_lowercase();
    let emotional = is_emotional_focus_word(text, &normalized);
    let imagery = is_imagery_focus_word(text, &normalized);
    let motion = is_motion_focus_word(text, &normalized);
    let ending_focus = is_line_ending_focus_word(text, &normalized, index, total);

    let mut profile = SemanticDeliveryProfile {
        emphasis_gain: 1.0,
        pitch_lift: 0.0,
        onset_gain: 1.0,
        tail_gain: 1.0,
    };

    if imagery {
        profile.emphasis_gain *= 1.12;
        profile.pitch_lift += 1.4;
        profile.onset_gain *= 1.08;
    }
    if emotional {
        profile.emphasis_gain *= 1.18;
        profile.pitch_lift += 1.0;
        profile.onset_gain *= 1.14;
        profile.tail_gain *= 1.08;
    }
    if motion {
        profile.emphasis_gain *= 1.06;
        profile.pitch_lift += 0.6;
        profile.onset_gain *= 1.12;
    }
    if ending_focus {
        profile.emphasis_gain *= 1.1;
        profile.pitch_lift += 0.8;
        profile.tail_gain *= 1.18;
    }

    profile
}

fn is_light_function_word(text: &str, normalized: &str) -> bool {
    if matches!(
        normalized,
        "the"
            | "a"
            | "an"
            | "to"
            | "of"
            | "in"
            | "on"
            | "and"
            | "for"
            | "with"
            | "at"
            | "by"
            | "from"
            | "is"
            | "are"
            | "be"
            | "my"
            | "your"
    ) {
        return true;
    }
    matches!(
        text,
        "的" | "了"
            | "呢"
            | "啊"
            | "呀"
            | "吗"
            | "吧"
            | "着"
            | "在"
            | "与"
            | "和"
            | "把"
            | "被"
            | "の"
            | "は"
            | "が"
            | "を"
            | "に"
            | "へ"
            | "と"
            | "も"
            | "で"
            | "ね"
            | "よ"
            | "か"
    )
}

fn has_open_tail(text: &str, normalized: &str) -> bool {
    if normalized
        .chars()
        .last()
        .map(|ch| matches!(ch, 'a' | 'o' | 'e' | 'i' | 'u' | 'y'))
        .unwrap_or(false)
    {
        return true;
    }
    matches!(
        text.chars().last().unwrap_or(' '),
        '啊' | '呀'
            | '哦'
            | '喔'
            | '呜'
            | '衣'
            | '爱'
            | '海'
            | '开'
            | '来'
            | '归'
            | '辉'
            | 'の'
            | 'よ'
            | 'ね'
    )
}

fn is_content_focus_word(text: &str, normalized: &str, index: usize, total: usize) -> bool {
    if is_light_function_word(text, normalized) {
        return false;
    }
    let char_len = text.chars().filter(|ch| !ch.is_whitespace()).count();
    let latin_content = normalized.chars().all(|ch| ch.is_ascii_alphabetic()) && char_len >= 4;
    let cjk_content = text.chars().any(|ch| !ch.is_ascii()) && char_len >= 2;
    latin_content || cjk_content || (index + 1 == total.max(1) && char_len >= 1)
}

fn is_emotional_focus_word(text: &str, normalized: &str) -> bool {
    matches!(
        normalized,
        "love"
            | "heart"
            | "dream"
            | "fire"
            | "light"
            | "grace"
            | "glory"
            | "hope"
            | "tears"
            | "sorrow"
            | "joy"
            | "desire"
            | "faith"
    ) || text.contains('爱')
        || text.contains('心')
        || text.contains('梦')
        || text.contains('光')
        || text.contains('火')
        || text.contains('泪')
        || text.contains('情')
        || text.contains('愿')
        || text.contains('望')
        || text.contains('魂')
        || text.contains('祈')
        || text.contains('恋')
}

fn is_imagery_focus_word(text: &str, normalized: &str) -> bool {
    matches!(
        normalized,
        "moon"
            | "river"
            | "sea"
            | "sky"
            | "star"
            | "wind"
            | "snow"
            | "cloud"
            | "sun"
            | "rain"
            | "mountain"
            | "flower"
            | "shadow"
    ) || text.contains('月')
        || text.contains('河')
        || text.contains('海')
        || text.contains('天')
        || text.contains('星')
        || text.contains('风')
        || text.contains('雪')
        || text.contains('云')
        || text.contains('雨')
        || text.contains('山')
        || text.contains('花')
        || text.contains('夜')
        || text.contains('霞')
}

fn is_motion_focus_word(text: &str, normalized: &str) -> bool {
    matches!(
        normalized,
        "run" | "rise" | "fall" | "turn" | "fly" | "burn" | "break" | "hold" | "call" | "drift"
    ) || text.contains('去')
        || text.contains('来')
        || text.contains('归')
        || text.contains('落')
        || text.contains('起')
        || text.contains('飞')
        || text.contains('行')
        || text.contains('开')
        || text.contains('转')
        || text.contains('回')
        || text.contains('望')
}

fn is_line_ending_focus_word(text: &str, normalized: &str, index: usize, total: usize) -> bool {
    index + 1 == total.max(1)
        && !is_light_function_word(text, normalized)
        && (is_emotional_focus_word(text, normalized)
            || is_imagery_focus_word(text, normalized)
            || is_content_focus_word(text, normalized, index, total))
}

fn phrase_pulse_for_duration(
    duration_sec: f32,
    phrase_count: usize,
    min_pulse: f32,
    max_pulse: f32,
) -> f32 {
    let count = phrase_count.max(1) as f32;
    (duration_sec / count).clamp(min_pulse, max_pulse)
}

#[derive(Clone, Copy)]
struct PhraseUnitWindow {
    start_sec: f32,
    duration_sec: f32,
}

fn phrase_unit_delivery(
    index: usize,
    total: usize,
    hint: PhraseRoleHint,
    emphasis: f32,
    release_weight: f32,
) -> (f32, f32, f32) {
    let first = index == 0;
    let last = index + 1 == total.max(1);
    let mut timing_weight: f32 = 1.0;
    let mut onset_punch: f32 = 1.0 + emphasis * 0.12;
    let mut tail_hold: f32 = 1.0 + release_weight * 0.1;

    match hint.role {
        VocalPhraseRole::Statement => {
            if first {
                timing_weight *= 0.84;
                onset_punch *= 1.16;
            }
            if last {
                timing_weight *= 1.12;
                tail_hold *= 1.12;
            }
        }
        VocalPhraseRole::Response => {
            if first {
                timing_weight *= 0.78;
                onset_punch *= 0.96;
            }
            if last {
                timing_weight *= 1.22;
                tail_hold *= 1.18;
            }
        }
        VocalPhraseRole::Lift => {
            timing_weight *= if last { 1.06 } else { 0.9 };
            onset_punch *= 1.14;
        }
        VocalPhraseRole::Release => {
            timing_weight *= if last { 1.28 } else { 1.04 };
            onset_punch *= 0.9;
            tail_hold *= 1.22;
        }
        VocalPhraseRole::Resolve => {
            if first {
                timing_weight *= 0.92;
            }
            if last {
                timing_weight *= 1.34;
                onset_punch *= 1.08;
                tail_hold *= 1.34;
            }
        }
        VocalPhraseRole::Setup => {
            timing_weight *= if first { 0.88 } else { 0.98 };
            onset_punch *= 1.04;
        }
    }

    match hint.variation {
        VocalVariationRole::Answer => {
            if !last {
                timing_weight *= 0.92;
            }
            tail_hold *= 1.06;
        }
        VocalVariationRole::Development => {
            onset_punch *= 1.08;
            if last {
                timing_weight *= 1.1;
            }
        }
        VocalVariationRole::Repeat => {
            onset_punch *= 1.03;
        }
        VocalVariationRole::Primary => {}
    }

    match hint.cadence {
        VocalCadenceIntent::Authentic
        | VocalCadenceIntent::Plagal
        | VocalCadenceIntent::Resolved => {
            if last {
                timing_weight *= 1.16;
                tail_hold *= 1.16;
            }
        }
        VocalCadenceIntent::Half | VocalCadenceIntent::Deceptive => {
            if last {
                timing_weight *= 1.08;
            }
        }
        VocalCadenceIntent::Open => {}
    }

    (
        timing_weight.clamp(0.62, 1.6),
        onset_punch.clamp(0.82, 1.4),
        tail_hold.clamp(0.82, 1.5),
    )
}

fn build_phrase_unit_windows(duration_sec: f32, units: &[PhraseUnit]) -> Vec<PhraseUnitWindow> {
    if units.is_empty() {
        return vec![PhraseUnitWindow {
            start_sec: 0.0,
            duration_sec: duration_sec.max(0.2),
        }];
    }
    let total_weight = units
        .iter()
        .map(|unit| unit.timing_weight.max(0.1))
        .sum::<f32>()
        .max(0.1);
    let mut windows = Vec::with_capacity(units.len());
    let mut cursor = 0.0;
    for (index, unit) in units.iter().enumerate() {
        let mut span = duration_sec * (unit.timing_weight.max(0.1) / total_weight);
        if index + 1 == units.len() {
            span = (duration_sec - cursor).max(0.06);
        }
        windows.push(PhraseUnitWindow {
            start_sec: cursor,
            duration_sec: span.max(0.06),
        });
        cursor += span;
    }
    windows
}

fn build_vocal_focus_events(cues: &[VocalCue], hints: &[MusicCueHint]) -> Vec<VocalFocusEvent> {
    let mut events = Vec::new();
    for (cue_index, cue) in cues.iter().enumerate() {
        let hint = hints.get(cue_index).copied().unwrap_or(MusicCueHint {
            tempo_bpm: 88.0,
            root_hz: 220.0,
            energy: 0.5,
            style_brightness: 0.4,
            phrase_role: PhraseRoleHint {
                role: VocalPhraseRole::Statement,
                variation: VocalVariationRole::Primary,
                cadence: VocalCadenceIntent::Open,
            },
            guide_topline_lift: 0.0,
            lead_presence_gain: 1.0,
            backing_presence_gain: 1.0,
            diction_gain: 1.0,
        });
        let units = extract_phrase_units(&cue.text, hint.phrase_role);
        let windows = build_phrase_unit_windows(cue.duration_sec, &units);
        let tokens = cue
            .text
            .replace(['《', '》', '[', ']', '(', ')'], " ")
            .replace(
                [
                    '：', ':', '，', ',', '。', '.', '！', '!', '？', '?', '/', '／', ';',
                ],
                "|",
            )
            .split('|')
            .flat_map(split_phrase_chunk)
            .collect::<Vec<_>>();
        for ((unit, window), token) in units.iter().zip(windows.iter()).zip(tokens.iter()) {
            let strength = (unit.semantic_peak * 0.18
                + (unit.onset_punch - 1.0).max(0.0) * 0.9
                + (unit.tail_hold - 1.0).max(0.0) * 0.45)
                .clamp(0.0, 1.0);
            if strength < 0.18 {
                continue;
            }
            events.push(VocalFocusEvent {
                start_sec: cue.start_sec + window.start_sec,
                duration_sec: window.duration_sec,
                strength,
                section: cue.section.clone(),
                token: token.clone(),
            });
        }
    }
    events
}

fn build_vocal_cadence_anchors(
    cues: &[VocalCue],
    hints: &[MusicCueHint],
) -> Vec<VocalCadenceAnchorEvent> {
    let mut anchors = Vec::new();
    for (cue_index, cue) in cues.iter().enumerate() {
        let hint = hints.get(cue_index).copied().unwrap_or(MusicCueHint {
            tempo_bpm: 88.0,
            root_hz: 220.0,
            energy: 0.5,
            style_brightness: 0.4,
            phrase_role: PhraseRoleHint {
                role: VocalPhraseRole::Statement,
                variation: VocalVariationRole::Primary,
                cadence: VocalCadenceIntent::Open,
            },
            guide_topline_lift: 0.0,
            lead_presence_gain: 1.0,
            backing_presence_gain: 1.0,
            diction_gain: 1.0,
        });
        if !matches!(
            (hint.phrase_role.role, hint.phrase_role.cadence),
            (VocalPhraseRole::Resolve, VocalCadenceIntent::Authentic)
                | (VocalPhraseRole::Resolve, VocalCadenceIntent::Plagal)
                | (VocalPhraseRole::Resolve, VocalCadenceIntent::Resolved)
                | (VocalPhraseRole::Release, VocalCadenceIntent::Authentic)
                | (VocalPhraseRole::Release, VocalCadenceIntent::Plagal)
                | (VocalPhraseRole::Release, VocalCadenceIntent::Resolved)
        ) {
            continue;
        }
        let units = extract_phrase_units(&cue.text, hint.phrase_role);
        let windows = build_phrase_unit_windows(cue.duration_sec, &units);
        let tokens = cue
            .text
            .replace(['《', '》', '[', ']', '(', ')'], " ")
            .replace(
                [
                    '：', ':', '，', ',', '。', '.', '！', '!', '？', '?', '/', '／', ';',
                ],
                "|",
            )
            .split('|')
            .flat_map(split_phrase_chunk)
            .collect::<Vec<_>>();
        let Some((unit, window, token)) = units
            .last()
            .zip(windows.last())
            .zip(tokens.last())
            .map(|((unit, window), token)| (unit, window, token))
        else {
            continue;
        };
        let strength = ((unit.semantic_peak - 1.0).max(0.0) * 0.5
            + (unit.tail_hold - 1.0).max(0.0) * 0.9
            + (unit.onset_punch - 1.0).max(0.0) * 0.3
            + match hint.phrase_role.cadence {
                VocalCadenceIntent::Authentic | VocalCadenceIntent::Resolved => 0.22,
                VocalCadenceIntent::Plagal => 0.16,
                _ => 0.0,
            })
        .clamp(0.0, 1.0);
        if strength < 0.24 {
            continue;
        }
        anchors.push(VocalCadenceAnchorEvent {
            start_sec: cue.start_sec + window.start_sec,
            duration_sec: window.duration_sec,
            strength,
            section: cue.section.clone(),
            token: token.clone(),
            role: vocal_phrase_role_label(hint.phrase_role.role).to_string(),
            cadence: vocal_cadence_intent_label(hint.phrase_role.cadence).to_string(),
            cue_index,
            phrase_order: cue.phrase_order,
        });
    }
    anchors
}

fn build_vocal_reply_harmony_windows(
    cues: &[VocalCue],
    hints: &[MusicCueHint],
) -> Vec<VocalReplyHarmonyWindowEvent> {
    let mut windows_out = Vec::new();
    for (cue_index, cue) in cues.iter().enumerate() {
        let hint = hints.get(cue_index).copied().unwrap_or(MusicCueHint {
            tempo_bpm: 88.0,
            root_hz: 220.0,
            energy: 0.5,
            style_brightness: 0.4,
            phrase_role: PhraseRoleHint {
                role: VocalPhraseRole::Statement,
                variation: VocalVariationRole::Primary,
                cadence: VocalCadenceIntent::Open,
            },
            guide_topline_lift: 0.0,
            lead_presence_gain: 1.0,
            backing_presence_gain: 1.0,
            diction_gain: 1.0,
        });
        let units = extract_phrase_units(&cue.text, hint.phrase_role);
        let windows = build_phrase_unit_windows(cue.duration_sec, &units);
        let tokens = cue
            .text
            .replace(['《', '》', '[', ']', '(', ')'], " ")
            .replace(
                [
                    '：', ':', '，', ',', '。', '.', '！', '!', '？', '?', '/', '／', ';',
                ],
                "|",
            )
            .split('|')
            .flat_map(split_phrase_chunk)
            .collect::<Vec<_>>();
        for ((unit, window), token) in units.iter().zip(windows.iter()).zip(tokens.iter()) {
            let strength = (unit.semantic_peak * 0.16
                + (unit.onset_punch - 1.0).max(0.0) * 0.72
                + (unit.tail_hold - 1.0).max(0.0) * 0.36)
                .clamp(0.0, 1.0);
            if strength < 0.18 {
                continue;
            }
            let profile = reply_harmony_space_from_phrase_unit(hint.phrase_role, unit, strength);
            windows_out.push(VocalReplyHarmonyWindowEvent {
                start_sec: cue.start_sec + window.start_sec + window.duration_sec,
                duration_sec: (window.duration_sec * 1.35 + 0.04).clamp(0.12, 0.72),
                strength,
                section: cue.section.clone(),
                token: token.clone(),
                role: vocal_phrase_role_label(hint.phrase_role.role).to_string(),
                cadence: vocal_cadence_intent_label(hint.phrase_role.cadence).to_string(),
                cue_index,
                phrase_order: cue.phrase_order,
                bass_duck: profile.bass_duck,
                sub_duck: profile.sub_duck,
                pad_duck: profile.pad_duck,
                strings_duck: profile.strings_duck,
                strings_settle_gain: profile.strings_settle_gain,
            });
        }
    }
    windows_out
}

fn reply_harmony_space_from_phrase_unit(
    hint: PhraseRoleHint,
    unit: &PhraseUnit,
    strength: f32,
) -> VocalReplyHarmonyWindowEvent {
    let reply_motion = ((unit.semantic_peak - 1.0).abs() * 0.46
        + (unit.onset_punch - 1.0).max(0.0) * 0.84
        + (unit.tail_hold - 1.0).max(0.0) * 0.54
        + strength * 0.4)
        .clamp(0.0, 1.2);
    let settle_bias: f32 = match hint.cadence {
        VocalCadenceIntent::Authentic | VocalCadenceIntent::Resolved => 1.0,
        VocalCadenceIntent::Plagal => 0.82,
        VocalCadenceIntent::Half => 0.38,
        VocalCadenceIntent::Deceptive | VocalCadenceIntent::Open => 0.18,
    };
    let guide_bias: f32 = match hint.cadence {
        VocalCadenceIntent::Half => 0.74,
        VocalCadenceIntent::Deceptive => 0.62,
        VocalCadenceIntent::Open => 0.56,
        VocalCadenceIntent::Authentic | VocalCadenceIntent::Resolved => 0.18,
        VocalCadenceIntent::Plagal => 0.22,
    };
    let role_bias: f32 = match hint.role {
        VocalPhraseRole::Resolve | VocalPhraseRole::Release => 1.0,
        VocalPhraseRole::Response => 0.72,
        VocalPhraseRole::Lift => 0.54,
        VocalPhraseRole::Setup => 0.44,
        VocalPhraseRole::Statement => 0.48,
    };
    let stable_space = reply_motion * settle_bias * role_bias;
    let guide_space = reply_motion * guide_bias * role_bias;

    VocalReplyHarmonyWindowEvent {
        start_sec: 0.0,
        duration_sec: 0.0,
        strength,
        section: String::new(),
        token: String::new(),
        role: String::new(),
        cadence: String::new(),
        cue_index: 0,
        phrase_order: 0,
        bass_duck: (1.0 - stable_space * 0.16 - guide_space * 0.04).clamp(0.82, 1.0),
        sub_duck: (1.0 - stable_space * 0.12 - guide_space * 0.03).clamp(0.86, 1.0),
        pad_duck: (1.0 - stable_space * 0.1 - guide_space * 0.12).clamp(0.8, 1.0),
        strings_duck: (1.0 - stable_space * 0.04 - guide_space * 0.1).clamp(0.84, 1.0),
        strings_settle_gain: (1.0 + stable_space * 0.12 - guide_space * 0.04).clamp(0.96, 1.14),
    }
}

fn vocal_phrase_role_label(role: VocalPhraseRole) -> &'static str {
    match role {
        VocalPhraseRole::Setup => "setup",
        VocalPhraseRole::Statement => "statement",
        VocalPhraseRole::Response => "response",
        VocalPhraseRole::Lift => "lift",
        VocalPhraseRole::Release => "release",
        VocalPhraseRole::Resolve => "resolve",
    }
}

fn vocal_cadence_intent_label(cadence: VocalCadenceIntent) -> &'static str {
    match cadence {
        VocalCadenceIntent::Open => "open",
        VocalCadenceIntent::Half => "half",
        VocalCadenceIntent::Authentic => "authentic",
        VocalCadenceIntent::Plagal => "plagal",
        VocalCadenceIntent::Deceptive => "deceptive",
        VocalCadenceIntent::Resolved => "resolved",
    }
}

fn locate_phrase_unit<'a>(
    local_t: f32,
    units: &'a [PhraseUnit],
    windows: &[PhraseUnitWindow],
) -> (PhraseUnit, PhraseUnitWindow, f32) {
    if units.is_empty() || windows.is_empty() {
        let fallback = PhraseUnit::fallback();
        let window = PhraseUnitWindow {
            start_sec: 0.0,
            duration_sec: 0.24,
        };
        return (fallback, window, 0.0);
    }
    for (unit, window) in units.iter().zip(windows.iter()) {
        let end = window.start_sec + window.duration_sec;
        if local_t < end || std::ptr::eq(window, windows.last().unwrap_or(window)) {
            let note_t = (local_t - window.start_sec).clamp(0.0, window.duration_sec);
            return (*unit, *window, note_t);
        }
    }
    let unit = *units.last().unwrap_or(&PhraseUnit::fallback());
    let window = *windows.last().unwrap_or(&PhraseUnitWindow {
        start_sec: 0.0,
        duration_sec: 0.24,
    });
    let note_t = (local_t - window.start_sec).clamp(0.0, window.duration_sec);
    (unit, window, note_t)
}

fn lyric_clarity_envelope(note_t: f32, pulse: f32, phrase: PhraseUnit) -> f32 {
    let start =
        (1.0 - (note_t / (pulse * 0.11).max(0.001)).clamp(0.0, 1.0)) * phrase.emphasis * 0.22;
    let tail_start = (pulse * (0.78 + phrase.release_weight * 0.08)).min(pulse);
    let tail = if note_t > tail_start {
        let release_pos = ((note_t - tail_start) / (pulse - tail_start).max(0.001)).clamp(0.0, 1.0);
        (1.0 - release_pos) * (0.1 + phrase.release_weight * 0.12)
    } else {
        0.0
    };
    (1.0 + start + tail).clamp(0.82, 1.34)
}

fn diction_transient(note_t: f32, pulse: f32, emphasis: f32) -> f32 {
    let window = (pulse * 0.045).max(0.006);
    if note_t > window {
        return 0.0;
    }
    let env = (1.0 - (note_t / window).clamp(0.0, 1.0)).powf(1.8);
    ((TWO_PI * 2400.0 * note_t).sin() + (TWO_PI * 4200.0 * note_t).sin() * 0.5)
        * env
        * (0.018 + emphasis * 0.012)
}

fn voice_bias(voice: &str) -> f32 {
    let lower = voice.to_ascii_lowercase();
    if lower.contains("male") || lower.contains("baritone") {
        -28.0
    } else if lower.contains("alto") {
        -8.0
    } else {
        0.0
    }
}

fn language_bias(lang: &str) -> f32 {
    match lang.to_ascii_lowercase().as_str() {
        "zh" | "zh-cn" | "zh-tw" => 6.0,
        "ja" => 12.0,
        "en" => 0.0,
        _ => 2.0,
    }
}

fn interleaved_wav(left: &[f32], right: &[f32]) -> Vec<u8> {
    let frames = left.len().min(right.len());
    let channels = 2u16;
    let bits_per_sample = 16u16;
    let byte_rate = SAMPLE_RATE * channels as u32 * (bits_per_sample as u32 / 8);
    let block_align = channels * (bits_per_sample / 8);
    let data_len = frames as u32 * block_align as u32;
    let riff_len = 36 + data_len;
    let mut out = Vec::with_capacity((44 + data_len) as usize);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&riff_len.to_le_bytes());
    out.extend_from_slice(b"WAVE");
    out.extend_from_slice(b"fmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&channels.to_le_bytes());
    out.extend_from_slice(&SAMPLE_RATE.to_le_bytes());
    out.extend_from_slice(&byte_rate.to_le_bytes());
    out.extend_from_slice(&block_align.to_le_bytes());
    out.extend_from_slice(&bits_per_sample.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_len.to_le_bytes());
    for idx in 0..frames {
        let l = (left[idx].clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
        let r = (right[idx].clamp(-1.0, 1.0) * i16::MAX as f32) as i16;
        out.extend_from_slice(&l.to_le_bytes());
        out.extend_from_slice(&r.to_le_bytes());
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_vocal_cues_tracks_phrase_order_inside_same_section() {
        let lyrics = serde_json::json!({
            "schema": "css.lyrics.v1",
            "lang": "zh",
            "lines": [
                "Chorus 1: 第一行",
                "Chorus 1: 第二行",
                "Verse 1: 第三行",
                "Chorus 1: 第四行"
            ]
        });

        let cues = build_vocal_cues(&lyrics);

        assert_eq!(cues[0].phrase_order, 0);
        assert_eq!(cues[1].phrase_order, 1);
        assert_eq!(cues[2].phrase_order, 0);
        assert_eq!(cues[3].phrase_order, 2);
    }

    #[test]
    fn vocal_phrase_shaping_shifts_lead_backing_and_diction_by_role() {
        let statement = vocal_phrase_shaping(PhraseRoleHint {
            role: VocalPhraseRole::Statement,
            variation: VocalVariationRole::Primary,
            cadence: VocalCadenceIntent::Open,
        });
        let response = vocal_phrase_shaping(PhraseRoleHint {
            role: VocalPhraseRole::Response,
            variation: VocalVariationRole::Answer,
            cadence: VocalCadenceIntent::Half,
        });
        let resolve = vocal_phrase_shaping(PhraseRoleHint {
            role: VocalPhraseRole::Resolve,
            variation: VocalVariationRole::Repeat,
            cadence: VocalCadenceIntent::Authentic,
        });

        assert!(response.lead_presence_gain < statement.lead_presence_gain);
        assert!(response.backing_presence_gain > statement.backing_presence_gain);
        assert!(resolve.lead_presence_gain > response.lead_presence_gain);
        assert!(resolve.diction_gain > statement.diction_gain);
        assert!(response.guide_topline_lift < resolve.guide_topline_lift);
    }

    #[test]
    fn phrase_role_changes_unit_timing_distribution() {
        let statement_units = extract_phrase_units(
            "Chorus 1: 长风 过岸 月落",
            PhraseRoleHint {
                role: VocalPhraseRole::Statement,
                variation: VocalVariationRole::Primary,
                cadence: VocalCadenceIntent::Open,
            },
        );
        let response_units = extract_phrase_units(
            "Chorus 1: 长风 过岸 月落",
            PhraseRoleHint {
                role: VocalPhraseRole::Response,
                variation: VocalVariationRole::Answer,
                cadence: VocalCadenceIntent::Half,
            },
        );
        let resolve_units = extract_phrase_units(
            "Chorus 1: 长风 过岸 月落",
            PhraseRoleHint {
                role: VocalPhraseRole::Resolve,
                variation: VocalVariationRole::Repeat,
                cadence: VocalCadenceIntent::Authentic,
            },
        );

        assert!(
            statement_units.first().unwrap().timing_weight
                < statement_units.last().unwrap().timing_weight
        );
        assert!(
            response_units.last().unwrap().timing_weight
                > statement_units.last().unwrap().timing_weight
        );
        assert!(
            response_units.first().unwrap().onset_punch
                < statement_units.first().unwrap().onset_punch
        );
        assert!(
            resolve_units.last().unwrap().tail_hold >= statement_units.last().unwrap().tail_hold
        );
    }

    #[test]
    fn phrase_windows_give_more_time_to_resolving_tail() {
        let units = extract_phrase_units(
            "Chorus 1: 云 开 月 明",
            PhraseRoleHint {
                role: VocalPhraseRole::Resolve,
                variation: VocalVariationRole::Repeat,
                cadence: VocalCadenceIntent::Resolved,
            },
        );
        let windows = build_phrase_unit_windows(2.4, &units);

        assert_eq!(windows.len(), units.len());
        assert!(windows.last().unwrap().duration_sec > windows.first().unwrap().duration_sec);
        let total = windows
            .iter()
            .map(|window| window.duration_sec)
            .sum::<f32>();
        assert!((total - 2.4).abs() < 0.001);
    }

    #[test]
    fn lexical_delivery_biases_content_words_and_open_tails() {
        let light = lexical_delivery_profile("的", 0, 3);
        let content = lexical_delivery_profile("长河", 1, 3);
        let open_tail = lexical_delivery_profile("归", 2, 3);

        assert!(light.timing_gain < 1.0);
        assert!(light.onset_gain < 1.0);
        assert!(content.emphasis_gain > 1.0);
        assert!(content.onset_gain > 1.0);
        assert!(open_tail.tail_gain > 1.0);
    }

    #[test]
    fn semantic_delivery_lifts_imagery_and_emotional_keywords() {
        let plain = semantic_delivery_profile("石阶", 0, 3);
        let imagery = semantic_delivery_profile("月光", 1, 3);
        let emotional = semantic_delivery_profile("心火", 2, 3);

        assert!(imagery.pitch_lift > plain.pitch_lift);
        assert!(imagery.emphasis_gain > plain.emphasis_gain);
        assert!(emotional.onset_gain > plain.onset_gain);
        assert!(emotional.tail_gain >= plain.tail_gain);
    }

    #[test]
    fn semantic_phrase_units_push_keyword_peaks_and_tails() {
        let plain_units = extract_phrase_units(
            "Verse 1: 石阶 风声 月光",
            PhraseRoleHint {
                role: VocalPhraseRole::Statement,
                variation: VocalVariationRole::Primary,
                cadence: VocalCadenceIntent::Open,
            },
        );
        let semantic_units = extract_phrase_units(
            "Verse 1: 石阶 心火 月光",
            PhraseRoleHint {
                role: VocalPhraseRole::Resolve,
                variation: VocalVariationRole::Repeat,
                cadence: VocalCadenceIntent::Authentic,
            },
        );

        assert!(
            semantic_units[semantic_units.len() - 1].semantic_peak
                >= plain_units[plain_units.len() - 1].semantic_peak
        );
        assert!(semantic_units[1].onset_punch >= plain_units[1].onset_punch);
        assert!(
            semantic_units[semantic_units.len() - 1].tail_hold
                >= plain_units[plain_units.len() - 1].tail_hold
        );
    }

    #[test]
    fn vocal_focus_events_follow_semantic_units() {
        let cues = vec![VocalCue {
            start_sec: 0.0,
            duration_sec: 2.4,
            text: "Chorus 1: 月光 心火 归".to_string(),
            section: "Chorus 1".to_string(),
            section_kind: SectionKind::Chorus,
            phrase_order: 0,
        }];
        let hints = vec![MusicCueHint {
            tempo_bpm: 96.0,
            root_hz: 220.0,
            energy: 0.8,
            style_brightness: 0.5,
            phrase_role: PhraseRoleHint {
                role: VocalPhraseRole::Resolve,
                variation: VocalVariationRole::Repeat,
                cadence: VocalCadenceIntent::Authentic,
            },
            guide_topline_lift: 1.0,
            lead_presence_gain: 1.0,
            backing_presence_gain: 1.0,
            diction_gain: 1.0,
        }];

        let events = build_vocal_focus_events(&cues, &hints);

        assert!(!events.is_empty());
        assert!(events.iter().any(|event| event.token.contains("心火")
            || event.token.contains("月光")
            || event.token.contains("归")));
        assert!(events.iter().any(|event| event.strength > 0.3));
    }

    #[test]
    fn cadence_anchors_export_resolve_tail_token() {
        let cues = vec![VocalCue {
            start_sec: 0.0,
            duration_sec: 2.6,
            text: "Chorus 1: 月光 心火 归".to_string(),
            section: "Chorus 1".to_string(),
            section_kind: SectionKind::Chorus,
            phrase_order: 2,
        }];
        let hints = vec![MusicCueHint {
            tempo_bpm: 96.0,
            root_hz: 220.0,
            energy: 0.8,
            style_brightness: 0.5,
            phrase_role: PhraseRoleHint {
                role: VocalPhraseRole::Resolve,
                variation: VocalVariationRole::Repeat,
                cadence: VocalCadenceIntent::Authentic,
            },
            guide_topline_lift: 1.0,
            lead_presence_gain: 1.0,
            backing_presence_gain: 1.0,
            diction_gain: 1.0,
        }];

        let anchors = build_vocal_cadence_anchors(&cues, &hints);

        assert_eq!(anchors.len(), 1);
        let anchor = &anchors[0];
        assert_eq!(anchor.section, "Chorus 1");
        assert_eq!(anchor.token, "归");
        assert_eq!(anchor.role, "resolve");
        assert_eq!(anchor.cadence, "authentic");
        assert_eq!(anchor.cue_index, 0);
        assert_eq!(anchor.phrase_order, 2);
        assert!(anchor.duration_sec > 0.0);
        assert!(anchor.strength > 0.24);
    }

    #[test]
    fn cadence_anchors_ignore_open_statement_phrases() {
        let cues = vec![VocalCue {
            start_sec: 0.0,
            duration_sec: 2.2,
            text: "Verse 1: 风 过 石阶".to_string(),
            section: "Verse 1".to_string(),
            section_kind: SectionKind::Verse,
            phrase_order: 0,
        }];
        let hints = vec![MusicCueHint {
            tempo_bpm: 84.0,
            root_hz: 196.0,
            energy: 0.45,
            style_brightness: 0.35,
            phrase_role: PhraseRoleHint {
                role: VocalPhraseRole::Statement,
                variation: VocalVariationRole::Primary,
                cadence: VocalCadenceIntent::Open,
            },
            guide_topline_lift: 0.0,
            lead_presence_gain: 1.0,
            backing_presence_gain: 1.0,
            diction_gain: 1.0,
        }];

        let anchors = build_vocal_cadence_anchors(&cues, &hints);

        assert!(anchors.is_empty());
    }

    #[test]
    fn reply_harmony_windows_export_duck_and_settle_fields_for_resolve_phrase() {
        let cues = vec![VocalCue {
            start_sec: 0.0,
            duration_sec: 3.8,
            text: "灯火 落下 归舟".to_string(),
            section: "Outro".to_string(),
            section_kind: SectionKind::Outro,
            phrase_order: 1,
        }];
        let hints = vec![MusicCueHint {
            tempo_bpm: 84.0,
            root_hz: 196.0,
            energy: 0.62,
            style_brightness: 0.34,
            phrase_role: PhraseRoleHint {
                role: VocalPhraseRole::Resolve,
                variation: VocalVariationRole::Answer,
                cadence: VocalCadenceIntent::Resolved,
            },
            guide_topline_lift: 0.0,
            lead_presence_gain: 1.0,
            backing_presence_gain: 1.0,
            diction_gain: 1.0,
        }];

        let windows = build_vocal_reply_harmony_windows(&cues, &hints);

        assert!(!windows.is_empty());
        let strongest = windows
            .iter()
            .max_by(|a, b| a.strength.partial_cmp(&b.strength).unwrap())
            .unwrap();
        assert_eq!(strongest.section, "Outro");
        assert_eq!(strongest.role, "resolve");
        assert_eq!(strongest.cadence, "resolved");
        assert!(strongest.bass_duck < 1.0);
        assert!(strongest.pad_duck < 1.0);
        assert!(strongest.strings_settle_gain >= 1.0);
    }

    #[test]
    fn reply_harmony_windows_keep_more_low_end_for_open_setup_than_resolved_setup() {
        let cues = vec![VocalCue {
            start_sec: 0.0,
            duration_sec: 3.4,
            text: "风起 又回身".to_string(),
            section: "Verse".to_string(),
            section_kind: SectionKind::Verse,
            phrase_order: 0,
        }];
        let base_hint = MusicCueHint {
            tempo_bpm: 86.0,
            root_hz: 196.0,
            energy: 0.5,
            style_brightness: 0.4,
            phrase_role: PhraseRoleHint {
                role: VocalPhraseRole::Setup,
                variation: VocalVariationRole::Primary,
                cadence: VocalCadenceIntent::Open,
            },
            guide_topline_lift: 0.0,
            lead_presence_gain: 1.0,
            backing_presence_gain: 1.0,
            diction_gain: 1.0,
        };
        let resolved_hint = MusicCueHint {
            phrase_role: PhraseRoleHint {
                role: VocalPhraseRole::Setup,
                variation: VocalVariationRole::Primary,
                cadence: VocalCadenceIntent::Resolved,
            },
            ..base_hint
        };

        let open_windows = build_vocal_reply_harmony_windows(&cues, &[base_hint]);
        let resolved_windows = build_vocal_reply_harmony_windows(&cues, &[resolved_hint]);
        let open = open_windows
            .iter()
            .max_by(|a, b| a.strength.partial_cmp(&b.strength).unwrap())
            .unwrap();
        let resolved = resolved_windows
            .iter()
            .max_by(|a, b| a.strength.partial_cmp(&b.strength).unwrap())
            .unwrap();

        assert!(open.bass_duck >= resolved.bass_duck);
        assert!(open.strings_duck < resolved.strings_duck);
    }

    #[test]
    fn merge_reply_harmony_windows_into_music_plan_populates_top_level_cues_and_phrases() {
        let mut plan = json!({
            "schema": "css.music.plan.v1",
            "cues": [
                { "cueId": "cue_001", "section": "Verse" },
                { "cueId": "cue_002", "section": "Chorus 1" }
            ],
            "phrases": [
                { "section": "Verse", "phraseOrder": 0 },
                { "section": "Chorus 1", "phraseOrder": 1 }
            ]
        });
        let windows = vec![
            VocalReplyHarmonyWindowEvent {
                start_sec: 1.2,
                duration_sec: 0.32,
                strength: 0.82,
                section: "Verse".to_string(),
                token: "风起".to_string(),
                role: "setup".to_string(),
                cadence: "open".to_string(),
                cue_index: 0,
                phrase_order: 0,
                bass_duck: 0.94,
                sub_duck: 0.96,
                pad_duck: 0.88,
                strings_duck: 0.9,
                strings_settle_gain: 0.98,
            },
            VocalReplyHarmonyWindowEvent {
                start_sec: 4.6,
                duration_sec: 0.38,
                strength: 0.9,
                section: "Chorus 1".to_string(),
                token: "回家".to_string(),
                role: "response".to_string(),
                cadence: "half".to_string(),
                cue_index: 1,
                phrase_order: 1,
                bass_duck: 0.9,
                sub_duck: 0.92,
                pad_duck: 0.86,
                strings_duck: 0.88,
                strings_settle_gain: 1.04,
            },
        ];

        merge_reply_harmony_windows_into_music_plan(&mut plan, &windows);

        assert_eq!(
            plan.get("replyHarmonyWindows")
                .and_then(|value| value.as_array())
                .map(|items| items.len()),
            Some(2)
        );
        assert_eq!(
            plan.get("cues")
                .and_then(|value| value.as_array())
                .and_then(|items| items.get(1))
                .and_then(|item| item.get("replyHarmonyWindowCount"))
                .and_then(|value| value.as_u64()),
            Some(1)
        );
        assert_eq!(
            plan.get("phrases")
                .and_then(|value| value.as_array())
                .and_then(|items| items.get(0))
                .and_then(|item| item.get("replyHarmonyWindowCount"))
                .and_then(|value| value.as_u64()),
            Some(1)
        );
    }

    #[test]
    fn guide_cadence_tail_drops_resolve_and_release_phrase_end() {
        let resolve_drop = guide_cadence_tail_offset(
            PhraseRoleHint {
                role: VocalPhraseRole::Resolve,
                variation: VocalVariationRole::Repeat,
                cadence: VocalCadenceIntent::Authentic,
            },
            true,
            0.92,
            1.2,
            1.38,
        );
        let release_drop = guide_cadence_tail_offset(
            PhraseRoleHint {
                role: VocalPhraseRole::Release,
                variation: VocalVariationRole::Answer,
                cadence: VocalCadenceIntent::Resolved,
            },
            true,
            0.9,
            0.8,
            1.28,
        );
        let statement_flat = guide_cadence_tail_offset(
            PhraseRoleHint {
                role: VocalPhraseRole::Statement,
                variation: VocalVariationRole::Primary,
                cadence: VocalCadenceIntent::Open,
            },
            true,
            0.92,
            1.2,
            1.38,
        );

        assert!(resolve_drop < release_drop);
        assert!(release_drop < 0.0);
        assert_eq!(statement_flat, 0.0);
    }

    #[test]
    fn guide_cadence_tail_only_engages_on_last_unit_tail() {
        let tail_drop = guide_cadence_tail_offset(
            PhraseRoleHint {
                role: VocalPhraseRole::Resolve,
                variation: VocalVariationRole::Repeat,
                cadence: VocalCadenceIntent::Authentic,
            },
            true,
            0.88,
            1.0,
            1.34,
        );
        let mid_phrase = guide_cadence_tail_offset(
            PhraseRoleHint {
                role: VocalPhraseRole::Resolve,
                variation: VocalVariationRole::Repeat,
                cadence: VocalCadenceIntent::Authentic,
            },
            true,
            0.26,
            1.0,
            1.34,
        );
        let not_last = guide_cadence_tail_offset(
            PhraseRoleHint {
                role: VocalPhraseRole::Resolve,
                variation: VocalVariationRole::Repeat,
                cadence: VocalCadenceIntent::Authentic,
            },
            false,
            0.92,
            1.0,
            1.34,
        );

        assert!(tail_drop < 0.0);
        assert_eq!(mid_phrase, 0.0);
        assert_eq!(not_last, 0.0);
    }

    #[test]
    fn singing_and_guide_share_tail_cadence_drop_logic() {
        let hint = PhraseRoleHint {
            role: VocalPhraseRole::Resolve,
            variation: VocalVariationRole::Repeat,
            cadence: VocalCadenceIntent::Resolved,
        };
        let singing_tail = guide_cadence_tail_offset(hint, true, 0.94, 1.1, 1.36);
        let guide_tail = guide_cadence_tail_offset(hint, true, 0.94, 1.1, 1.36);

        assert!(singing_tail < 0.0);
        assert_eq!(singing_tail, guide_tail);
    }

    #[test]
    fn cadence_tail_diction_boost_sharpens_resolve_and_release_endings() {
        let resolve_boost = cadence_tail_diction_boost(
            PhraseRoleHint {
                role: VocalPhraseRole::Resolve,
                variation: VocalVariationRole::Repeat,
                cadence: VocalCadenceIntent::Authentic,
            },
            true,
            0.9,
            1.1,
        );
        let release_boost = cadence_tail_diction_boost(
            PhraseRoleHint {
                role: VocalPhraseRole::Release,
                variation: VocalVariationRole::Answer,
                cadence: VocalCadenceIntent::Resolved,
            },
            true,
            0.92,
            0.8,
        );
        let statement_flat = cadence_tail_diction_boost(
            PhraseRoleHint {
                role: VocalPhraseRole::Statement,
                variation: VocalVariationRole::Primary,
                cadence: VocalCadenceIntent::Open,
            },
            true,
            0.92,
            1.1,
        );

        assert!(resolve_boost > 1.0);
        assert!(release_boost > 1.0);
        assert_eq!(statement_flat, 1.0);
    }

    #[test]
    fn cadence_tail_envelope_hold_stabilizes_terminal_tail() {
        let resolve_hold = cadence_tail_envelope_hold(
            PhraseRoleHint {
                role: VocalPhraseRole::Resolve,
                variation: VocalVariationRole::Repeat,
                cadence: VocalCadenceIntent::Resolved,
            },
            true,
            0.94,
            1.36,
        );
        let release_hold = cadence_tail_envelope_hold(
            PhraseRoleHint {
                role: VocalPhraseRole::Release,
                variation: VocalVariationRole::Answer,
                cadence: VocalCadenceIntent::Authentic,
            },
            true,
            0.9,
            1.28,
        );
        let mid_flat = cadence_tail_envelope_hold(
            PhraseRoleHint {
                role: VocalPhraseRole::Resolve,
                variation: VocalVariationRole::Repeat,
                cadence: VocalCadenceIntent::Resolved,
            },
            true,
            0.24,
            1.36,
        );

        assert!(resolve_hold > 1.0);
        assert!(release_hold > 1.0);
        assert_eq!(mid_flat, 1.0);
    }

    #[test]
    fn cadence_tail_helpers_ignore_non_terminal_units() {
        let diction = cadence_tail_diction_boost(
            PhraseRoleHint {
                role: VocalPhraseRole::Resolve,
                variation: VocalVariationRole::Repeat,
                cadence: VocalCadenceIntent::Resolved,
            },
            false,
            0.92,
            1.0,
        );
        let hold = cadence_tail_envelope_hold(
            PhraseRoleHint {
                role: VocalPhraseRole::Release,
                variation: VocalVariationRole::Answer,
                cadence: VocalCadenceIntent::Authentic,
            },
            false,
            0.92,
            1.3,
        );

        assert_eq!(diction, 1.0);
        assert_eq!(hold, 1.0);
    }
}
