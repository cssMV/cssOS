use super::*;
use super::{music_mp3_path, transcode_wav_to_mp3};
use crate::audio_provider::{
    apply_delivery_readiness_gate as apply_audio_provider_delivery_readiness_gate,
    apply_publish_ack_and_reconcile as apply_audio_provider_publish_ack_and_reconcile,
    build_delivery_dashboard_feed as build_audio_provider_delivery_dashboard_feed,
    build_provider_archive_builder, build_provider_arrangement_stems_plan,
    build_provider_cue_sheet, build_provider_deliverables_manifest,
    build_provider_delivery_metadata, build_provider_export_policy, build_provider_midi_draft,
    build_provider_package_layout, build_provider_phrase_map, build_provider_render_queue,
    build_provider_requeue_execution, build_provider_stem_naming_convention, build_publish_handoff,
    build_publish_retry_policy as build_audio_provider_publish_retry_policy,
    dispatch_downstream_delivery as dispatch_audio_provider_downstream_delivery,
    dispatch_publish_handoff as dispatch_audio_provider_publish_handoff,
    dispatch_render_handoff as dispatch_audio_provider_render_handoff,
    evaluate_publish_state_machine as evaluate_audio_provider_publish_state_machine,
    execute as execute_audio_provider,
    execute_publish_state_machine as execute_audio_provider_publish_state_machine,
    execute_render as execute_audio_provider_render,
    execute_render_handoff as execute_audio_provider_render_handoff, materialize_export_package,
    plan_from_commands, reconcile_delivery as reconcile_audio_provider_delivery,
    run_job_worker as run_audio_provider_job_worker,
    sync_provider_receipt as sync_audio_provider_receipt,
    update_publish_ledger as update_audio_provider_publish_ledger,
    watch_provider_artifacts as watch_audio_provider_artifacts, write_dry_run_plan,
    write_provider_archive_builder, write_provider_arrangement_stems_plan,
    write_provider_artifact_watcher_report, write_provider_cue_sheet,
    write_provider_deliverables_manifest, write_provider_delivery_dashboard_feed,
    write_provider_delivery_metadata, write_provider_delivery_readiness_gate,
    write_provider_delivery_summary, write_provider_downstream_delivery_report,
    write_provider_export_policy, write_provider_job_worker_report, write_provider_midi_draft,
    write_provider_package_layout, write_provider_phrase_map,
    write_provider_publish_executor_report, write_provider_publish_handoff,
    write_provider_publish_ledger, write_provider_publish_notification_report,
    write_provider_publish_retry_policy, write_provider_publish_state_machine,
    write_provider_queue_dispatch_report, write_provider_receipt_sync,
    write_provider_reconciliation_report, write_provider_render_queue,
    write_provider_requeue_execution, write_provider_stem_naming_convention, CueSegment,
    ProviderArrangementStemsPlan, ProviderPlan, ProviderVendor,
};
use crate::music_composition::{
    build_composition_layer_plan, CompositionLayerPlan, CompositionSectionInput,
    CompositionSectionPlan, HarmonyProgressionFrame,
};
use anyhow::Result;
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::f32::consts::PI;

const SAMPLE_RATE: u32 = 48_000;
const TWO_PI: f32 = PI * 2.0;

#[derive(Debug, Clone)]
struct PhraseSegment {
    start_sec: f32,
    duration_sec: f32,
    section: String,
    energy: SegmentEnergy,
    tempo_bpm: f32,
    root_hz: f32,
    progression: &'static [ChordFrame],
    counter_pattern: &'static [i32],
    style: ArrangementStyle,
    adapter_hint: ExternalAdapterHint,
    rhythm_hint: Option<ExternalRhythmHint>,
    phrase_hint: Option<ExternalPhraseHint>,
    melody_hint: Option<ExternalMelodyHint>,
}

#[derive(Debug, Clone)]
struct VocalFocusHint {
    start_sec: f32,
    duration_sec: f32,
    strength: f32,
    section: Option<String>,
    token: Option<String>,
}

#[derive(Debug, Clone)]
struct VocalCadenceAnchorHint {
    start_sec: f32,
    duration_sec: f32,
    strength: f32,
    cue_index: usize,
    phrase_order: usize,
    role: Option<String>,
    cadence: Option<String>,
}

#[derive(Debug, Clone)]
struct VocalReplyHarmonyWindowHint {
    start_sec: f32,
    duration_sec: f32,
    strength: f32,
    section: Option<String>,
    token: Option<String>,
    role: Option<String>,
    cadence: Option<String>,
    cue_index: usize,
    phrase_order: usize,
    bass_duck: f32,
    sub_duck: f32,
    pad_duck: f32,
    strings_duck: f32,
    strings_settle_gain: f32,
}

#[derive(Debug, Clone, Default)]
struct VocalPlanHints {
    focus_events: Vec<VocalFocusHint>,
    cadence_anchors: Vec<VocalCadenceAnchorHint>,
    reply_harmony_windows: Vec<VocalReplyHarmonyWindowHint>,
}

#[derive(Debug, Clone)]
struct ExternalRhythmHint {
    groove_template: Option<String>,
    syncopation: Option<String>,
    swing: Option<String>,
    micro_timing_ms: Option<f32>,
    activity_profile: Vec<String>,
    bar_accent_pattern: Vec<Vec<String>>,
    push_pull_profile: Vec<String>,
}

#[derive(Debug, Clone)]
struct ExternalPhraseHint {
    role: Option<String>,
    variation_role: Option<String>,
    cadence_intent: Option<String>,
}

#[derive(Debug, Clone)]
struct ExternalMelodyHint {
    contour: Option<String>,
    phrase_function: Option<String>,
    hook_strength: Option<f32>,
    target_degrees: Vec<i32>,
    register_anchor: Option<String>,
    motion_bias: Option<String>,
    leap_budget: Option<u8>,
    landing_tone: Option<String>,
    ornamentation: Option<String>,
    repetition_window_bars: Option<u8>,
    counterline_role: Option<String>,
    lyric_stress_map: Vec<String>,
    climax_bar: Option<u8>,
    antecedent_phrase_id: Option<String>,
    note_grouping: Vec<u8>,
    hook_restatement_passes: Vec<ExternalRestatementPassHint>,
}

#[derive(Debug, Clone)]
struct ExternalRestatementPassHint {
    order: u8,
    role: String,
    register_bias: String,
    sustain_bias: String,
    landing_move: String,
}

#[derive(Debug, Clone, Copy)]
struct CreativeMotionProfile {
    dynamic_range: f32,
    section_contrast: f32,
    melodic_contour: MelodicContourMode,
    instrumentation_bias: f32,
    ambience_depth: f32,
    theatrical_bias: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MelodicContourMode {
    Grounded,
    Arched,
    Ascending,
    Wave,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum SegmentEnergy {
    Low,
    Medium,
    High,
    Peak,
}

#[derive(Debug, Clone, Copy)]
struct ChordFrame {
    root_shift: i32,
    intervals: &'static [i32],
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ArrangementStyle {
    Piano,
    Strings,
    Synth,
    Guofeng,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum ExternalAdapterHint {
    Internal,
    Kontakt,
    Spitfire,
    EastWest,
    Custom,
}

#[derive(Debug, Clone, Copy)]
struct StyleProfile {
    pad_gain: f32,
    lead_gain: f32,
    counter_gain: f32,
    bass_gain: f32,
    drum_gain: f32,
    shimmer_gain: f32,
    strings_gain: f32,
    pluck_gain: f32,
    counter_lane_gain: f32,
    sub_gain: f32,
    percussion_gain: f32,
    impact_gain: f32,
    choir_gain: f32,
}

struct StereoBuffer {
    left: Vec<f32>,
    right: Vec<f32>,
}

impl StereoBuffer {
    fn new(frames: usize) -> Self {
        Self {
            left: vec![0.0_f32; frames],
            right: vec![0.0_f32; frames],
        }
    }

    fn add(&mut self, idx: usize, left: f32, right: f32) {
        if idx >= self.left.len() || idx >= self.right.len() {
            return;
        }
        self.left[idx] = (self.left[idx] + left).clamp(-1.0, 1.0);
        self.right[idx] = (self.right[idx] + right).clamp(-1.0, 1.0);
    }
}

struct StemRenderBundle {
    mix: StereoBuffer,
    pad: StereoBuffer,
    lead: StereoBuffer,
    bass: StereoBuffer,
    drums: StereoBuffer,
    fx: StereoBuffer,
    strings: StereoBuffer,
    plucks: StereoBuffer,
    counter: StereoBuffer,
    sub: StereoBuffer,
    percussion: StereoBuffer,
    impacts: StereoBuffer,
    choir: StereoBuffer,
}

impl StemRenderBundle {
    fn new(frames: usize) -> Self {
        Self {
            mix: StereoBuffer::new(frames),
            pad: StereoBuffer::new(frames),
            lead: StereoBuffer::new(frames),
            bass: StereoBuffer::new(frames),
            drums: StereoBuffer::new(frames),
            fx: StereoBuffer::new(frames),
            strings: StereoBuffer::new(frames),
            plucks: StereoBuffer::new(frames),
            counter: StereoBuffer::new(frames),
            sub: StereoBuffer::new(frames),
            percussion: StereoBuffer::new(frames),
            impacts: StereoBuffer::new(frames),
            choir: StereoBuffer::new(frames),
        }
    }
}

pub async fn run(ctx: &EngineCtx, commands: &serde_json::Value, ui_lang: &str) -> Result<()> {
    // W1749 (111E ①) — faithful imported audio short-circuit.
    // When the run carries `import_audio` (a user-uploaded MIDI/MusicXML/audio
    // source, already rendered to an asset URL) we honor it verbatim instead of
    // re-composing via the provider: download the asset and transcode it into
    // ./build/music.wav (this stage's expected artifact). Downstream stages
    // (mix / subtitles / video) consume music.wav unchanged. Absent import →
    // fall through to the normal generation path below, byte-for-byte as before.
    if let Some(imp) = commands.get("import_audio") {
        let url = imp
            .get("url")
            .and_then(|v| v.as_str())
            .map(str::trim)
            .filter(|s| !s.is_empty());
        // Skip the provider whenever an import URL is present. `skip_stages` is
        // advisory: honor an explicit list if given, else default to skipping.
        let skip_music = imp
            .get("skip_stages")
            .and_then(|v| v.as_array())
            .map(|a| a.iter().any(|s| s.as_str() == Some("music")))
            .unwrap_or(true);
        if let (Some(url), true) = (url, skip_music) {
            let out = music_wav_path(&ctx.run_dir);
            if let Some(parent) = out.parent() {
                tokio::fs::create_dir_all(parent).await?;
            }
            let src = ctx.run_dir.join("./build/import_audio.src");
            // Resolve the asset to local bytes. Uploaded sources are relative
            // paths (e.g. /uploads/midi/<user>/<file>.mp3) that live on THIS
            // machine's public dir — read them straight from disk (no HTTP, no
            // auth round-trip). Only genuinely remote http(s) URLs are fetched.
            let mut resolved_from_disk = false;
            if !url.starts_with("http://") && !url.starts_with("https://") {
                let public_dir = std::env::var("CSSOS_PUBLIC_DIR")
                    .unwrap_or_else(|_| "/srv/cssos/repo/public".into());
                let rel = url.trim_start_matches('/').split('?').next().unwrap_or("");
                let disk = std::path::Path::new(&public_dir).join(rel);
                if tokio::fs::metadata(&disk).await.is_ok() {
                    tokio::fs::copy(&disk, &src).await.map_err(|e| {
                        anyhow::anyhow!("import_audio disk copy {disk:?} failed: {e}")
                    })?;
                    resolved_from_disk = true;
                }
            }
            if !resolved_from_disk {
                // Absolute URL, or a relative asset not found on disk → HTTP.
                let full = if url.starts_with("http://") || url.starts_with("https://") {
                    url.to_string()
                } else {
                    let base = std::env::var("APP_BASE_URL").unwrap_or_default();
                    format!("{}/{}", base.trim_end_matches('/'), url.trim_start_matches('/'))
                };
                let bytes = reqwest::Client::new()
                    .get(&full)
                    .send()
                    .await
                    .map_err(|e| anyhow::anyhow!("import_audio download {full} failed: {e}"))?
                    .error_for_status()
                    .map_err(|e| anyhow::anyhow!("import_audio http status {full}: {e}"))?
                    .bytes()
                    .await
                    .map_err(|e| anyhow::anyhow!("import_audio read body failed: {e}"))?;
                tokio::fs::write(&src, &bytes).await?;
            }
            // Normalize to 48k stereo pcm_s16le WAV — identical container to the
            // provider/default output, so nothing downstream needs to change.
            let status = tokio::process::Command::new(&ctx.ffmpeg)
                .arg("-y")
                .arg("-hide_banner")
                .arg("-loglevel")
                .arg("error")
                .arg("-i")
                .arg(&src)
                .arg("-ac")
                .arg("2")
                .arg("-ar")
                .arg("48000")
                .arg("-c:a")
                .arg("pcm_s16le")
                .arg(&out)
                .status()
                .await
                .map_err(|e| anyhow::anyhow!("spawn ffmpeg for import_audio: {e}"))?;
            if !status.success() {
                return Err(anyhow::anyhow!(
                    "import_audio transcode failed: exit={:?}",
                    status.code()
                ));
            }
            let _ = tokio::fs::remove_file(&src).await;
            eprintln!(
                "[music] 111E ① import_audio short-circuit: {} -> {}",
                url,
                out.display()
            );
            return Ok(());
        }
    }
    let lang = primary_lang(commands, ui_lang);
    let lyrics = lyrics_json_path(&ctx.run_dir);
    let out = music_wav_path(&ctx.run_dir);
    let provider_plan = plan_from_commands(commands);
    let provider_plan_path = ctx.run_dir.join("./build/audio_provider_plan.json");
    validate_lyrics_json_input(&lyrics).await?;
    write_dry_run_plan(&provider_plan_path, &provider_plan)?;
    let lyrics_json = tokio::fs::read_to_string(&lyrics).await?;
    let parsed: Value = serde_json::from_str(&lyrics_json)?;
    let title = parsed
        .get("title")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("cssMV");
    let rhythm_hints = load_external_rhythm_hints(&ctx.run_dir, commands, &parsed);
    let phrase_hints = load_external_phrase_hints(&ctx.run_dir, commands, &parsed);
    let melody_hints = load_external_melody_hints(&ctx.run_dir, commands, &parsed);
    let arrangement = plan_arrangement_with_hints(
        &parsed,
        commands,
        title,
        &rhythm_hints,
        &phrase_hints,
        &melody_hints,
    );
    let vocal_plan_hints = load_vocal_plan_hints(&ctx.run_dir);
    let music_plan_path = ctx.run_dir.join("./build/music.plan.json");
    let music_diagnostics_path = ctx.run_dir.join("./build/music.diagnostics.json");
    let cue_sheet_path = ctx.run_dir.join("./build/audio_provider_cue_sheet.json");
    let composition_sections = arrangement
        .iter()
        .map(|segment| CompositionSectionInput {
            section: segment.section.clone(),
            start_sec: segment.start_sec,
            duration_sec: segment.duration_sec,
            tempo_bpm: segment.tempo_bpm,
            root_hz: segment.root_hz,
            energy: segment_energy_label(segment.energy).to_string(),
            style: arrangement_style_label(segment.style).to_string(),
        })
        .collect::<Vec<_>>();
    let composition_layer = build_composition_layer_plan(title, &composition_sections);
    let cue_sheet = build_provider_cue_sheet(
        &provider_plan,
        &arrangement_to_cues(&arrangement, commands, &parsed, Some(&composition_layer)),
    );
    write_json(
        &music_plan_path,
        &build_music_plan_json(
            title,
            &arrangement,
            commands,
            &provider_plan,
            Some(&composition_layer),
        ),
    )
    .await?;
    write_json(
        &music_diagnostics_path,
        &build_music_diagnostics_json(title, &arrangement, &provider_plan),
    )
    .await?;
    write_provider_cue_sheet(&cue_sheet_path, &cue_sheet)?;
    let midi_draft_path = ctx.run_dir.join("./build/audio_provider_midi_draft.json");
    let midi_draft =
        build_provider_midi_draft(&provider_plan, &cue_sheet, Some(&composition_layer));
    write_provider_midi_draft(&midi_draft_path, &midi_draft)?;
    let phrase_map_path = ctx.run_dir.join("./build/audio_provider_phrase_map.json");
    let phrase_map =
        build_provider_phrase_map(&provider_plan, &cue_sheet, Some(&composition_layer));
    write_provider_phrase_map(&phrase_map_path, &phrase_map)?;
    let stems_plan_path = ctx.run_dir.join("./build/audio_provider_stems_plan.json");
    let stems_plan = apply_composition_stem_activation_plan(
        build_provider_arrangement_stems_plan(&provider_plan, &cue_sheet, Some(&composition_layer)),
        &composition_layer,
    );
    write_provider_arrangement_stems_plan(&stems_plan_path, &stems_plan)?;
    let render_queue_path = ctx.run_dir.join("./build/audio_provider_render_queue.json");
    let render_queue = build_provider_render_queue(&provider_plan, &cue_sheet);
    write_provider_render_queue(&render_queue_path, &render_queue)?;
    let deliverables_manifest_path = ctx
        .run_dir
        .join("./build/audio_provider_deliverables_manifest.json");
    let deliverables_manifest = build_provider_deliverables_manifest(&provider_plan, &cue_sheet);
    write_provider_deliverables_manifest(&deliverables_manifest_path, &deliverables_manifest)?;
    let export_policy_path = ctx
        .run_dir
        .join("./build/audio_provider_export_policy.json");
    let export_policy = build_provider_export_policy(&provider_plan, &cue_sheet);
    write_provider_export_policy(&export_policy_path, &export_policy)?;
    let package_layout_path = ctx
        .run_dir
        .join("./build/audio_provider_package_layout.json");
    let package_layout = build_provider_package_layout(&provider_plan, &cue_sheet);
    write_provider_package_layout(&package_layout_path, &package_layout)?;
    let stem_naming_path = ctx.run_dir.join("./build/audio_provider_stem_naming.json");
    let stem_naming = build_provider_stem_naming_convention(&provider_plan, &cue_sheet);
    write_provider_stem_naming_convention(&stem_naming_path, &stem_naming)?;
    let delivery_metadata_path = ctx
        .run_dir
        .join("./build/audio_provider_delivery_metadata.json");
    let delivery_metadata = build_provider_delivery_metadata(&provider_plan, &cue_sheet);
    write_provider_delivery_metadata(&delivery_metadata_path, &delivery_metadata)?;
    let archive_builder_path = ctx
        .run_dir
        .join("./build/audio_provider_archive_builder.json");
    let archive_builder = build_provider_archive_builder(&provider_plan, &cue_sheet);
    write_provider_archive_builder(&archive_builder_path, &archive_builder)?;
    let mut provider_exec = execute_audio_provider(&ctx.run_dir.join("./build"), &provider_plan)?;
    provider_exec.midi_draft_path = Some(midi_draft_path.clone());
    provider_exec.phrase_map_path = Some(phrase_map_path.clone());
    provider_exec.stems_plan_path = Some(stems_plan_path.clone());
    provider_exec.render_queue_path = Some(render_queue_path.clone());
    provider_exec.deliverables_manifest_path = Some(deliverables_manifest_path.clone());
    provider_exec.export_policy_path = Some(export_policy_path.clone());
    provider_exec.package_layout_path = Some(package_layout_path.clone());
    provider_exec.delivery_metadata_path = Some(delivery_metadata_path.clone());
    provider_exec.archive_builder_path = Some(archive_builder_path.clone());

    if let Some(cmdline) = env_cmd("CSS_MUSIC_CMD") {
        run_cmd(
            &cmdline,
            &ctx.run_dir,
            &[
                ("CSS_LANG", lang),
                ("CSS_LYRICS_JSON", lyrics.to_string_lossy().to_string()),
                ("CSS_OUT_WAV", out.to_string_lossy().to_string()),
                ("CSS_TITLE_HINT", title_hint(commands)),
                (
                    "CSS_AUDIO_PROVIDER_VENDOR",
                    provider_plan.vendor_name().to_string(),
                ),
                ("CSS_AUDIO_PROVIDER_PACK", provider_plan.pack.clone()),
                ("CSS_AUDIO_PROVIDER_PRESET", provider_plan.preset.clone()),
                (
                    "CSS_AUDIO_PROVIDER_ARTICULATION",
                    provider_plan.articulation.clone(),
                ),
                ("CSS_AUDIO_PROVIDER_URI", provider_plan.adapter_uri.clone()),
                ("CSS_AUDIO_PROVIDER_STYLE", provider_plan.style_hint.clone()),
                (
                    "CSS_AUDIO_PROVIDER_PLAN_JSON",
                    provider_plan_path.to_string_lossy().to_string(),
                ),
                (
                    "CSS_AUDIO_PROVIDER_PAYLOAD_JSON",
                    provider_exec.payload_path.to_string_lossy().to_string(),
                ),
                (
                    "CSS_AUDIO_PROVIDER_RENDER_CMD",
                    provider_exec.render_cmdline.clone().unwrap_or_default(),
                ),
                (
                    "CSS_AUDIO_PROVIDER_CUE_SHEET_JSON",
                    cue_sheet_path.to_string_lossy().to_string(),
                ),
                (
                    "CSS_AUDIO_PROVIDER_MIDI_DRAFT_JSON",
                    midi_draft_path.to_string_lossy().to_string(),
                ),
                (
                    "CSS_AUDIO_PROVIDER_PHRASE_MAP_JSON",
                    phrase_map_path.to_string_lossy().to_string(),
                ),
                (
                    "CSS_AUDIO_PROVIDER_STEMS_PLAN_JSON",
                    stems_plan_path.to_string_lossy().to_string(),
                ),
                (
                    "CSS_AUDIO_PROVIDER_RENDER_QUEUE_JSON",
                    render_queue_path.to_string_lossy().to_string(),
                ),
                (
                    "CSS_AUDIO_PROVIDER_DELIVERABLES_MANIFEST_JSON",
                    deliverables_manifest_path.to_string_lossy().to_string(),
                ),
                (
                    "CSS_AUDIO_PROVIDER_EXPORT_POLICY_JSON",
                    export_policy_path.to_string_lossy().to_string(),
                ),
                (
                    "CSS_AUDIO_PROVIDER_PACKAGE_LAYOUT_JSON",
                    package_layout_path.to_string_lossy().to_string(),
                ),
                (
                    "CSS_AUDIO_PROVIDER_STEM_NAMING_JSON",
                    stem_naming_path.to_string_lossy().to_string(),
                ),
                (
                    "CSS_AUDIO_PROVIDER_DELIVERY_METADATA_JSON",
                    delivery_metadata_path.to_string_lossy().to_string(),
                ),
                (
                    "CSS_AUDIO_PROVIDER_ARCHIVE_BUILDER_JSON",
                    archive_builder_path.to_string_lossy().to_string(),
                ),
            ],
        )
        .await?;
        validate_wav_output(&out, 4096).await?;
        enforce_music_quality(&out, &ctx.run_dir).await?;
        transcode_wav_to_mp3(&ctx.ffmpeg, &out, &music_mp3_path(&ctx.run_dir)).await?;
        finalize_export_packager(
            ctx,
            &stem_naming,
            &delivery_metadata,
            &package_layout,
            &archive_builder,
            &render_queue,
        )
        .await?;
        return Ok(());
    }

    if execute_audio_provider_render(&ctx.run_dir.join("./build"), &out, &provider_exec).await? {
        validate_wav_output(&out, 4096).await?;
        enforce_music_quality(&out, &ctx.run_dir).await?;
        transcode_wav_to_mp3(&ctx.ffmpeg, &out, &music_mp3_path(&ctx.run_dir)).await?;
        finalize_export_packager(
            ctx,
            &stem_naming,
            &delivery_metadata,
            &package_layout,
            &archive_builder,
            &render_queue,
        )
        .await?;
        return Ok(());
    }

    ensure_parent(&out).await?;
    let rendered = render_arrangement_bundle(&arrangement, &vocal_plan_hints);
    tokio::fs::write(&out, rendered.mix).await?;
    write_rendered_stems(&ctx.run_dir, &rendered.stems).await?;

    validate_wav_output(&out, 4096).await?;
    enforce_music_quality(&out, &ctx.run_dir).await?;
    transcode_wav_to_mp3(&ctx.ffmpeg, &out, &music_mp3_path(&ctx.run_dir)).await?;
    finalize_export_packager(
        ctx,
        &stem_naming,
        &delivery_metadata,
        &package_layout,
        &archive_builder,
        &render_queue,
    )
    .await?;
    Ok(())
}

async fn enforce_music_quality(out: &std::path::Path, run_dir: &std::path::Path) -> Result<()> {
    let qc = crate::quality_config::load_quality_config();
    let diagnostics_path = run_dir.join("./build/music.audio_qc.json");
    let duration_gate =
        crate::quality_gates::gate_audio_duration(out, qc.min_audio_duration_s).await?;
    if !duration_gate.ok {
        return Err(crate::quality_gates::fail_gate(duration_gate));
    }
    let loudness_gate = crate::quality_gates::gate_audio_not_silent(out, -20.0).await?;
    if !loudness_gate.ok {
        return Err(crate::quality_gates::fail_gate(loudness_gate));
    }
    let lead_stem = music_stems_dir(run_dir).join("lead.wav");
    let lead_gate = crate::quality_gates::gate_audio_stem_ready(
        &lead_stem,
        qc.min_audio_duration_s * 0.7,
        -24.0,
    )
    .await?;
    if !lead_gate.ok {
        return Err(crate::quality_gates::fail_gate(lead_gate));
    }
    let melody_gate = crate::quality_gates::gate_audio_melodic_presence(
        &lead_stem,
        qc.min_melodic_voiced_ratio,
        qc.min_melodic_pitch_classes,
        qc.min_melodic_repeat_score,
    )
    .await?;
    let hook_gate = crate::quality_gates::gate_audio_hook_signature(
        &lead_stem,
        (qc.min_melodic_voiced_ratio + 0.08).min(0.7),
        qc.min_melodic_pitch_classes.max(3),
        (qc.min_melodic_repeat_score + 0.14).min(0.75),
    )
    .await?;
    write_json(
        &diagnostics_path,
        &json!({
            "schema": "css.music.audio_qc.v1",
            "mixDuration": duration_gate,
            "mixLoudness": loudness_gate,
            "leadStemReadiness": lead_gate,
            "leadMelodicPresence": melody_gate.clone(),
            "leadHookSignature": hook_gate.clone()
        }),
    )
    .await?;
    if !melody_gate.ok {
        return Err(crate::quality_gates::fail_gate(melody_gate));
    }
    if !hook_gate.ok {
        return Err(crate::quality_gates::fail_gate(hook_gate));
    }
    Ok(())
}

async fn write_rendered_stems(run_dir: &std::path::Path, stems: &RenderedStems) -> Result<()> {
    let stem_dir = music_stems_dir(run_dir);
    tokio::fs::create_dir_all(&stem_dir).await?;
    let stem_defs = [
        ("pad", &stems.pad),
        ("lead", &stems.lead),
        ("bass", &stems.bass),
        ("drums", &stems.drums),
        ("fx", &stems.fx),
        ("strings", &stems.strings),
        ("plucks", &stems.plucks),
        ("counter", &stems.counter),
        ("sub", &stems.sub),
        ("percussion", &stems.percussion),
        ("impacts", &stems.impacts),
        ("choir", &stems.choir),
    ];
    for (name, wav) in stem_defs {
        tokio::fs::write(stem_dir.join(format!("{name}.wav")), wav).await?;
    }
    write_json(
        &run_dir.join("./build/music.stems.json"),
        &json!({
            "schema": "css.music.stems.v1",
            "stems": [
                { "name": "pad", "path": "./build/stems/pad.wav", "role": "harmony_bed" },
                { "name": "lead", "path": "./build/stems/lead.wav", "role": "primary_motif" },
                { "name": "bass", "path": "./build/stems/bass.wav", "role": "low_end_foundation" },
                { "name": "drums", "path": "./build/stems/drums.wav", "role": "rhythm_drive" },
                { "name": "fx", "path": "./build/stems/fx.wav", "role": "shimmer_and_lift" },
                { "name": "strings", "path": "./build/stems/strings.wav", "role": "cinematic_string_section" },
                { "name": "plucks", "path": "./build/stems/plucks.wav", "role": "arpeggio_and_pluck_motion" },
                { "name": "counter", "path": "./build/stems/counter.wav", "role": "counter_melody_and_inner_voice" },
                { "name": "sub", "path": "./build/stems/sub.wav", "role": "sub_bass_foundation" },
                { "name": "percussion", "path": "./build/stems/percussion.wav", "role": "hat_and_tom_motion" },
                { "name": "impacts", "path": "./build/stems/impacts.wav", "role": "downbeat_hits_and_risers" },
                { "name": "choir", "path": "./build/stems/choir.wav", "role": "choir_and_vocal_haze" }
            ]
        }),
    )
    .await?;
    Ok(())
}

async fn finalize_export_packager(
    ctx: &EngineCtx,
    stem_naming: &crate::audio_provider::ProviderStemNamingConvention,
    delivery_metadata: &crate::audio_provider::ProviderDeliveryMetadata,
    package_layout: &crate::audio_provider::ProviderPackageLayout,
    archive_builder: &crate::audio_provider::ProviderArchiveBuilder,
    render_queue: &crate::audio_provider::ProviderRenderQueue,
) -> Result<()> {
    let summary = materialize_export_package(
        &ctx.run_dir,
        stem_naming,
        delivery_metadata,
        package_layout,
        archive_builder,
        render_queue,
    )?;
    let summary_path = ctx
        .run_dir
        .join("./build/audio_provider_delivery_summary.json");
    write_provider_delivery_summary(&summary_path, &summary)?;
    if summary.handoff_request_path.is_some() {
        let handoff_path = ctx
            .run_dir
            .join("./build/audio_provider_render_handoff.json");
        let handoff_raw = std::fs::read_to_string(&handoff_path)?;
        let handoff: crate::audio_provider::ProviderRenderHandoff =
            serde_json::from_str(&handoff_raw)?;
        let requeue_execution =
            build_provider_requeue_execution(&ctx.run_dir.join("./build"), &handoff)?;
        let requeue_path = ctx
            .run_dir
            .join("./build/audio_provider_requeue_execution.json");
        write_provider_requeue_execution(&requeue_path, &requeue_execution)?;
        let dispatch_report =
            dispatch_audio_provider_render_handoff(&ctx.run_dir.join("./build"), &handoff).await?;
        let dispatch_report_path = ctx
            .run_dir
            .join("./build/audio_provider_queue_dispatch.json");
        write_provider_queue_dispatch_report(&dispatch_report_path, &dispatch_report)?;
        let worker_report =
            run_audio_provider_job_worker(&ctx.run_dir.join("./build"), &handoff, &dispatch_report)
                .await?;
        let worker_report_path = ctx
            .run_dir
            .join("./build/audio_provider_job_worker_report.json");
        write_provider_job_worker_report(&worker_report_path, &worker_report)?;
        let reconciliation = reconcile_audio_provider_delivery(
            &ctx.run_dir,
            stem_naming,
            delivery_metadata,
            package_layout,
            archive_builder,
            render_queue,
            &worker_report,
        )?;
        let reconciliation_path = ctx
            .run_dir
            .join("./build/audio_provider_reconciliation_report.json");
        write_provider_reconciliation_report(&reconciliation_path, &reconciliation)?;
        let watcher_report = watch_audio_provider_artifacts(
            &ctx.run_dir,
            stem_naming,
            delivery_metadata,
            package_layout,
            archive_builder,
            render_queue,
            &worker_report,
        )
        .await?;
        let watcher_report_path = ctx
            .run_dir
            .join("./build/audio_provider_artifact_watcher_report.json");
        write_provider_artifact_watcher_report(&watcher_report_path, &watcher_report)?;
        let readiness_gate = apply_audio_provider_delivery_readiness_gate(
            &ctx.run_dir.join("./build"),
            package_layout,
        )?;
        let readiness_gate_path = ctx
            .run_dir
            .join("./build/audio_provider_delivery_readiness_gate.json");
        write_provider_delivery_readiness_gate(&readiness_gate_path, &readiness_gate)?;
        let publish_handoff = if readiness_gate.ready_for_delivery {
            Some(build_publish_handoff(
                &ctx.run_dir.join("./build"),
                package_layout,
            )?)
        } else {
            None
        };
        let publish_notification_report = if let Some(publish_handoff) = publish_handoff.as_ref() {
            let publish_handoff_path = ctx
                .run_dir
                .join("./build/audio_provider_publish_handoff.json");
            write_provider_publish_handoff(&publish_handoff_path, &publish_handoff)?;
            let mut report = dispatch_audio_provider_publish_handoff(
                &ctx.run_dir.join("./build"),
                &publish_handoff,
            )
            .await?;
            if report.publish_handoff_path.is_none() {
                report.publish_handoff_path =
                    Some(publish_handoff_path.to_string_lossy().to_string());
            }
            report
        } else {
            crate::audio_provider::ProviderPublishNotificationReport {
                triggered: false,
                backend: "gate".to_string(),
                target: String::new(),
                accepted: false,
                status: "awaiting_assets".to_string(),
                publish_handoff_path: None,
                receipt_path: None,
                message: "publish handoff skipped because delivery is not ready yet".to_string(),
            }
        };
        let publish_notification_report_path = ctx
            .run_dir
            .join("./build/audio_provider_publish_notification_report.json");
        write_provider_publish_notification_report(
            &publish_notification_report_path,
            &publish_notification_report,
        )?;
        let publish_ledger = update_audio_provider_publish_ledger(
            &ctx.run_dir.join("./build"),
            publish_handoff.as_ref(),
            &publish_notification_report,
        )?;
        let publish_ledger_path = ctx
            .run_dir
            .join("./build/audio_provider_publish_ledger.json");
        write_provider_publish_ledger(&publish_ledger_path, &publish_ledger)?;
        let publish_state_machine = evaluate_audio_provider_publish_state_machine(
            &publish_ledger,
            publish_handoff.as_ref(),
            &publish_notification_report,
        );
        let publish_state_machine_path = ctx
            .run_dir
            .join("./build/audio_provider_publish_state_machine.json");
        write_provider_publish_state_machine(&publish_state_machine_path, &publish_state_machine)?;
        let publish_retry_policy =
            build_audio_provider_publish_retry_policy(&publish_state_machine);
        let publish_retry_policy_path = ctx
            .run_dir
            .join("./build/audio_provider_publish_retry_policy.json");
        write_provider_publish_retry_policy(&publish_retry_policy_path, &publish_retry_policy)?;
        let publish_executor_report = execute_audio_provider_publish_state_machine(
            &ctx.run_dir.join("./build"),
            &publish_state_machine,
            &publish_retry_policy,
        )
        .await?;
        let publish_executor_report_path = ctx
            .run_dir
            .join("./build/audio_provider_publish_executor_report.json");
        write_provider_publish_executor_report(
            &publish_executor_report_path,
            &publish_executor_report,
        )?;
        let reconciled_publish_state = apply_audio_provider_publish_ack_and_reconcile(
            &ctx.run_dir.join("./build"),
            &publish_ledger,
            &publish_state_machine,
            &publish_executor_report,
        )?;
        write_provider_publish_state_machine(
            &publish_state_machine_path,
            &reconciled_publish_state,
        )?;
        let downstream_delivery_report = dispatch_audio_provider_downstream_delivery(
            &ctx.run_dir.join("./build"),
            publish_handoff.as_ref(),
            &reconciled_publish_state,
            &publish_executor_report,
        )
        .await?;
        let downstream_delivery_report_path = ctx
            .run_dir
            .join("./build/audio_provider_downstream_delivery_report.json");
        write_provider_downstream_delivery_report(
            &downstream_delivery_report_path,
            &downstream_delivery_report,
        )?;
        let receipt_sync =
            sync_audio_provider_receipt(&ctx.run_dir.join("./build"), &downstream_delivery_report)?;
        let receipt_sync_path = ctx.run_dir.join("./build/audio_provider_receipt_sync.json");
        write_provider_receipt_sync(&receipt_sync_path, &receipt_sync)?;
        let delivery_dashboard_feed = build_audio_provider_delivery_dashboard_feed(
            publish_handoff.as_ref(),
            &reconciled_publish_state,
            &publish_executor_report,
            &downstream_delivery_report,
            &receipt_sync,
        );
        let delivery_dashboard_feed_path = ctx
            .run_dir
            .join("./build/audio_provider_delivery_dashboard_feed.json");
        write_provider_delivery_dashboard_feed(
            &delivery_dashboard_feed_path,
            &delivery_dashboard_feed,
        )?;
        let _ =
            execute_audio_provider_render_handoff(&ctx.run_dir.join("./build"), &requeue_execution)
                .await;
    }
    Ok(())
}

fn plan_arrangement(lyrics_json: &Value, commands: &Value, title: &str) -> Vec<PhraseSegment> {
    plan_arrangement_with_hints(
        lyrics_json,
        commands,
        title,
        &BTreeMap::new(),
        &BTreeMap::new(),
        &BTreeMap::new(),
    )
}

fn plan_arrangement_with_hints(
    lyrics_json: &Value,
    commands: &Value,
    title: &str,
    rhythm_hints: &BTreeMap<String, ExternalRhythmHint>,
    phrase_hints: &BTreeMap<String, Vec<ExternalPhraseHint>>,
    melody_hints: &BTreeMap<String, Vec<ExternalMelodyHint>>,
) -> Vec<PhraseSegment> {
    let line_entries = lyric_entries(lyrics_json);
    let total_duration = estimated_total_duration(&line_entries);
    let target_duration_s = detect_target_duration_s(commands, lyrics_json);
    let mood_seed = title
        .bytes()
        .fold(0u32, |acc, byte| acc.wrapping_add(byte as u32));
    let roots = [146.83_f32, 164.81, 196.0, 220.0, 246.94, 293.66];
    let progressions: [&[ChordFrame]; 6] = [
        &[
            ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7, 11],
            },
            ChordFrame {
                root_shift: 5,
                intervals: &[0, 4, 7, 12],
            },
            ChordFrame {
                root_shift: 9,
                intervals: &[0, 3, 7, 10],
            },
            ChordFrame {
                root_shift: 7,
                intervals: &[0, 4, 7, 11],
            },
        ],
        &[
            ChordFrame {
                root_shift: 0,
                intervals: &[0, 3, 7, 10],
            },
            ChordFrame {
                root_shift: 7,
                intervals: &[0, 3, 7, 12],
            },
            ChordFrame {
                root_shift: 5,
                intervals: &[0, 5, 9, 12],
            },
            ChordFrame {
                root_shift: 10,
                intervals: &[0, 4, 7, 11],
            },
        ],
        &[
            ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7, 12],
            },
            ChordFrame {
                root_shift: 9,
                intervals: &[0, 3, 7, 12],
            },
            ChordFrame {
                root_shift: 5,
                intervals: &[0, 4, 9, 12],
            },
            ChordFrame {
                root_shift: 7,
                intervals: &[0, 4, 7, 12],
            },
        ],
        &[
            ChordFrame {
                root_shift: 0,
                intervals: &[0, 5, 9, 12],
            },
            ChordFrame {
                root_shift: 2,
                intervals: &[0, 3, 7, 10],
            },
            ChordFrame {
                root_shift: 7,
                intervals: &[0, 4, 7, 11],
            },
            ChordFrame {
                root_shift: 9,
                intervals: &[0, 3, 7, 12],
            },
        ],
        &[
            ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7, 11],
            },
            ChordFrame {
                root_shift: 7,
                intervals: &[0, 4, 7, 12],
            },
            ChordFrame {
                root_shift: 5,
                intervals: &[0, 3, 7, 10],
            },
            ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7, 12],
            },
        ],
        &[
            ChordFrame {
                root_shift: 0,
                intervals: &[0, 3, 7, 12],
            },
            ChordFrame {
                root_shift: 8,
                intervals: &[0, 3, 7, 10],
            },
            ChordFrame {
                root_shift: 5,
                intervals: &[0, 4, 7, 11],
            },
            ChordFrame {
                root_shift: 10,
                intervals: &[0, 4, 7, 12],
            },
        ],
    ];
    let style = detect_arrangement_style(commands, lyrics_json);
    let adapter_hint = external_adapter_hint_from_plan(&plan_from_commands(commands));
    let base_tempo = detect_tempo_bpm(commands, lyrics_json);
    let creative_motion = detect_creative_motion_profile(commands, lyrics_json);

    let preserve_timestamps = line_entries.iter().any(|entry| entry.t.is_some());
    let grouped_entries = group_entries_by_section(&line_entries);
    let mut cursor = 0.0_f32;
    let mut segments = Vec::new();
    let mut section_occurrences: BTreeMap<String, usize> = BTreeMap::new();
    for (index, entry) in grouped_entries.iter().enumerate() {
        let mut duration = entry.duration_sec;
        if !preserve_timestamps {
            duration = duration.clamp(3.6, 18.0);
        }
        let section = entry.section.clone();
        let section_key = normalize_section_key(&section);
        let occurrence = *section_occurrences.get(&section_key).unwrap_or(&0);
        let energy = adjust_segment_energy(
            detect_energy(index, grouped_entries.len(), &section),
            &section,
            creative_motion,
        );
        let root_index = ((mood_seed as usize) + index) % roots.len();
        let chord_index = ((mood_seed as usize / 3) + index) % progressions.len();
        segments.push(PhraseSegment {
            start_sec: if preserve_timestamps {
                entry.start_sec
            } else {
                cursor
            },
            duration_sec: duration,
            section,
            energy,
            tempo_bpm: tempo_for_segment(
                base_tempo * (1.0 + creative_motion.section_contrast * 0.04),
                energy,
            ),
            root_hz: adjusted_root_hz(roots[root_index], &section_key, creative_motion),
            progression: progressions[chord_index],
            counter_pattern: counter_pattern_for_section(&entry.summary_text, style),
            style,
            adapter_hint,
            rhythm_hint: rhythm_hints.get(&section_key).cloned(),
            phrase_hint: phrase_hints
                .get(&section_key)
                .and_then(|hints| hints.get(occurrence))
                .cloned(),
            melody_hint: melody_hints
                .get(&section_key)
                .and_then(|hints| hints.get(occurrence))
                .cloned(),
        });
        section_occurrences.insert(section_key, occurrence + 1);
        cursor = if preserve_timestamps {
            (entry.start_sec + duration).max(cursor)
        } else {
            cursor + duration
        };
    }

    let segments = if segments.is_empty() {
        vec![PhraseSegment {
            start_sec: 0.0,
            duration_sec: target_duration_s.max(total_duration).max(1.0),
            section: "Intro".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: tempo_for_segment(
                base_tempo * (1.0 + creative_motion.section_contrast * 0.04),
                SegmentEnergy::Medium,
            ),
            root_hz: adjusted_root_hz(196.0, "intro", creative_motion),
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7, 11],
            }],
            counter_pattern: counter_pattern_for_section("Intro", style),
            style,
            adapter_hint,
            rhythm_hint: rhythm_hints.get("intro").cloned(),
            phrase_hint: phrase_hints
                .get("intro")
                .and_then(|hints| hints.first())
                .cloned(),
            melody_hint: melody_hints
                .get("intro")
                .and_then(|hints| hints.first())
                .cloned(),
        }]
    } else {
        align_segments_to_duration(segments, target_duration_s, preserve_timestamps)
    };
    enforce_arrangement_melodic_identity(segments)
}

fn enforce_arrangement_melodic_identity(mut segments: Vec<PhraseSegment>) -> Vec<PhraseSegment> {
    let hook_seed = segments
        .iter()
        .find(|segment| is_hook_section(segment))
        .and_then(|segment| {
            segment
                .melody_hint
                .as_ref()
                .filter(|hint| hint.target_degrees.len() >= 4)
                .map(|hint| hint.target_degrees.clone())
        })
        .unwrap_or_else(|| vec![1, 3, 5, 6, 8, 6, 5, 3]);
    let total = segments.len();
    for (index, segment) in segments.iter_mut().enumerate() {
        let strengthened = strengthen_melody_hint(
            segment,
            index,
            total,
            &hook_seed,
            segment.melody_hint.clone(),
        );
        segment.melody_hint = Some(strengthened);
    }
    segments
}

fn strengthen_melody_hint(
    segment: &PhraseSegment,
    index: usize,
    total: usize,
    hook_seed: &[i32],
    existing: Option<ExternalMelodyHint>,
) -> ExternalMelodyHint {
    let lower = segment.section.to_ascii_lowercase();
    let phrase_role = segment
        .phrase_hint
        .as_ref()
        .and_then(|hint| hint.role.as_deref())
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let variation_role = segment
        .phrase_hint
        .as_ref()
        .and_then(|hint| hint.variation_role.as_deref())
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let cadence_intent = segment
        .phrase_hint
        .as_ref()
        .and_then(|hint| hint.cadence_intent.as_deref())
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let is_hook = lower.contains("chorus") || phrase_role == "release";
    let is_bridge = lower.contains("bridge") || phrase_role == "lift";
    let is_outro = lower.contains("outro") || (index + 1 == total && phrase_role == "resolve");
    let is_answer = variation_role == "answer";
    let is_repeat = variation_role == "repeat";
    let is_cadence =
        phrase_role == "resolve" || matches!(cadence_intent.as_str(), "authentic" | "plagal");

    let phrase_function = if is_hook {
        "hook"
    } else if is_bridge {
        "lift"
    } else if is_outro || is_cadence {
        "cadence"
    } else if is_answer {
        "answer"
    } else {
        "statement"
    };
    let hook_strength = if is_hook {
        0.96
    } else if is_outro {
        0.84
    } else if is_bridge {
        0.78
    } else if is_repeat {
        0.76
    } else if is_answer {
        0.68
    } else {
        0.58
    };
    let register_anchor = if is_hook {
        "high"
    } else if is_bridge {
        "mid_high"
    } else {
        "mid"
    };
    let motion_bias = if is_hook {
        "balanced_lift"
    } else if is_bridge {
        "contrast_leap"
    } else {
        "stepwise"
    };
    let leap_budget = if is_hook {
        5
    } else if is_bridge {
        7
    } else {
        4
    };
    let landing_tone = if is_outro || is_cadence {
        "tonic"
    } else if is_bridge {
        "suspended"
    } else if is_hook {
        "third"
    } else {
        "fifth"
    };
    let counterline_role = if is_hook {
        "octave_doubles"
    } else if is_bridge {
        "echo_answer"
    } else if is_answer || is_repeat {
        "call_response"
    } else {
        "none"
    };
    let repetition_window_bars = if is_hook || is_repeat || is_outro {
        2
    } else {
        3
    };
    let default_degrees = if is_outro {
        build_outro_callback_degrees(hook_seed)
    } else if is_hook {
        hook_seed.to_vec()
    } else if is_bridge {
        vec![5, 6, 8, 6, 5, 4, 3, 2]
    } else if is_answer {
        vec![5, 4, 3, 2, 3, 2, 1, 1]
    } else if is_repeat {
        build_repeat_degrees(hook_seed)
    } else {
        vec![1, 2, 3, 5, 3, 2, 1, 1]
    };
    let climax_bar = if is_hook {
        6
    } else if is_bridge {
        5
    } else if is_outro {
        4
    } else {
        3
    };
    let default_stress = build_default_lyric_stress_map(phrase_function, 4);
    let default_note_grouping = if is_hook {
        vec![4, 4, 3, 5]
    } else if is_bridge {
        vec![2, 3, 3, 2]
    } else if is_outro || is_cadence {
        vec![4, 2, 2]
    } else {
        vec![3, 3, 2]
    };
    let default_restatement_passes = if is_hook {
        vec![
            ExternalRestatementPassHint {
                order: 1,
                role: "main statement".to_string(),
                register_bias: "mid".to_string(),
                sustain_bias: "balanced".to_string(),
                landing_move: "land on hook root".to_string(),
            },
            ExternalRestatementPassHint {
                order: 2,
                role: "amplified restatement".to_string(),
                register_bias: "higher".to_string(),
                sustain_bias: "longer".to_string(),
                landing_move: "overshoot then resolve".to_string(),
            },
            ExternalRestatementPassHint {
                order: 3,
                role: "tail echo".to_string(),
                register_bias: "mid-high".to_string(),
                sustain_bias: "long tail".to_string(),
                landing_move: "glide into cadence".to_string(),
            },
        ]
    } else if is_bridge {
        vec![
            ExternalRestatementPassHint {
                order: 1,
                role: "deconstruction".to_string(),
                register_bias: "upper-mid".to_string(),
                sustain_bias: "clipped".to_string(),
                landing_move: "avoid root".to_string(),
            },
            ExternalRestatementPassHint {
                order: 2,
                role: "answer".to_string(),
                register_bias: "mid".to_string(),
                sustain_bias: "stretched".to_string(),
                landing_move: "prepare return".to_string(),
            },
        ]
    } else if is_outro || is_cadence {
        vec![
            ExternalRestatementPassHint {
                order: 1,
                role: "recall".to_string(),
                register_bias: "mid-low".to_string(),
                sustain_bias: "gentle".to_string(),
                landing_move: "touch the hook outline".to_string(),
            },
            ExternalRestatementPassHint {
                order: 2,
                role: "fade".to_string(),
                register_bias: "lower".to_string(),
                sustain_bias: "long".to_string(),
                landing_move: "dissolve cadence".to_string(),
            },
        ]
    } else {
        vec![
            ExternalRestatementPassHint {
                order: 1,
                role: "seed".to_string(),
                register_bias: "mid-low".to_string(),
                sustain_bias: "short".to_string(),
                landing_move: "defer cadence".to_string(),
            },
            ExternalRestatementPassHint {
                order: 2,
                role: "echo".to_string(),
                register_bias: "same register".to_string(),
                sustain_bias: "trimmed".to_string(),
                landing_move: "leave open".to_string(),
            },
        ]
    };

    let mut hint = existing.unwrap_or(ExternalMelodyHint {
        contour: None,
        phrase_function: None,
        hook_strength: None,
        target_degrees: Vec::new(),
        register_anchor: None,
        motion_bias: None,
        leap_budget: None,
        landing_tone: None,
        ornamentation: None,
        repetition_window_bars: None,
        counterline_role: None,
        lyric_stress_map: Vec::new(),
        climax_bar: None,
        antecedent_phrase_id: None,
        note_grouping: Vec::new(),
        hook_restatement_passes: Vec::new(),
    });

    if hint.target_degrees.len() < 4 {
        hint.target_degrees = default_degrees;
    } else if is_hook && !starts_with_same_motif(&hint.target_degrees, hook_seed) {
        hint.target_degrees = hook_seed.to_vec();
    }
    if is_hook || hint.phrase_function.is_none() {
        hint.phrase_function = Some(phrase_function.to_string());
    }
    hint.hook_strength = Some(hint.hook_strength.unwrap_or(0.0).max(hook_strength));
    if hint.register_anchor.is_none() {
        hint.register_anchor = Some(register_anchor.to_string());
    }
    if is_hook || is_bridge || hint.motion_bias.is_none() {
        hint.motion_bias = Some(motion_bias.to_string());
    }
    hint.leap_budget = Some(hint.leap_budget.unwrap_or(0).max(leap_budget));
    if is_outro || is_cadence || hint.landing_tone.is_none() {
        hint.landing_tone = Some(landing_tone.to_string());
    }
    if is_hook || is_bridge || is_answer || is_repeat || hint.counterline_role.is_none() {
        hint.counterline_role = Some(counterline_role.to_string());
    }
    hint.repetition_window_bars = Some(
        hint.repetition_window_bars
            .map(|value| value.min(repetition_window_bars))
            .unwrap_or(repetition_window_bars),
    );
    if hint.lyric_stress_map.is_empty() {
        hint.lyric_stress_map = default_stress;
    }
    if hint.note_grouping.is_empty() {
        hint.note_grouping = default_note_grouping;
    }
    if hint.hook_restatement_passes.is_empty() {
        hint.hook_restatement_passes = default_restatement_passes;
    }
    hint.climax_bar = Some(hint.climax_bar.unwrap_or(climax_bar).max(climax_bar));
    if (is_answer || is_repeat || is_outro) && hint.antecedent_phrase_id.is_none() {
        hint.antecedent_phrase_id = Some("primary_hook_callback".to_string());
    }
    if hint.ornamentation.is_none() {
        hint.ornamentation = Some(
            if is_hook {
                "belt_accent"
            } else if is_bridge {
                "neighbor"
            } else {
                "none"
            }
            .to_string(),
        );
    }
    hint
}

fn build_repeat_degrees(hook_seed: &[i32]) -> Vec<i32> {
    if hook_seed.len() >= 4 {
        let motif = hook_seed[..4].to_vec();
        [motif.clone(), motif].concat()
    } else {
        vec![1, 3, 5, 6, 1, 3, 5, 3]
    }
}

fn build_outro_callback_degrees(hook_seed: &[i32]) -> Vec<i32> {
    let mut callback = if hook_seed.len() >= 4 {
        vec![hook_seed[0], hook_seed[1], hook_seed[2], hook_seed[1]]
    } else {
        vec![1, 3, 5, 3]
    };
    callback.extend([2, 1, 1, 1]);
    callback
}

fn build_default_lyric_stress_map(phrase_function: &str, bars: usize) -> Vec<String> {
    (0..bars.max(2))
        .map(|index| {
            let last = index + 1 == bars.max(2);
            match phrase_function {
                "hook" => {
                    if last || index % 2 == 1 {
                        "lift"
                    } else {
                        "hold"
                    }
                }
                "answer" => {
                    if last {
                        "settle"
                    } else {
                        "answer"
                    }
                }
                "cadence" => {
                    if last {
                        "settle"
                    } else {
                        "hold"
                    }
                }
                _ => "hold",
            }
            .to_string()
        })
        .collect()
}

fn starts_with_same_motif(candidate: &[i32], motif: &[i32]) -> bool {
    let len = candidate.len().min(motif.len()).min(4);
    len >= 2 && candidate[..len] == motif[..len]
}

fn is_hook_section(segment: &PhraseSegment) -> bool {
    segment.section.to_ascii_lowercase().contains("chorus")
        || segment
            .phrase_hint
            .as_ref()
            .and_then(|hint| hint.role.as_deref())
            .map(|role| role.eq_ignore_ascii_case("release"))
            .unwrap_or(false)
}

fn load_external_rhythm_hints(
    run_dir: &std::path::Path,
    commands: &Value,
    lyrics_json: &Value,
) -> BTreeMap<String, ExternalRhythmHint> {
    let inline_plan = commands
        .get("creative")
        .and_then(|creative| {
            creative
                .get("music_plan")
                .or_else(|| creative.get("musicPlan"))
        })
        .or_else(|| lyrics_json.get("musicPlan"))
        .or_else(|| lyrics_json.get("music_plan"));
    if let Some(plan) = inline_plan {
        let hints = extract_rhythm_hints_from_plan(plan);
        if !hints.is_empty() {
            return hints;
        }
    }

    if let Some(path) = env_cmd("CSS_MUSIC_PLAN_JSON") {
        if let Ok(raw) = std::fs::read_to_string(&path) {
            if let Ok(plan) = serde_json::from_str::<Value>(&raw) {
                let hints = extract_rhythm_hints_from_plan(&plan);
                if !hints.is_empty() {
                    return hints;
                }
            }
        }
    }

    let default_path = run_dir.join("./build/music.plan.json");
    if default_path.exists() {
        if let Ok(raw) = std::fs::read_to_string(default_path) {
            if let Ok(plan) = serde_json::from_str::<Value>(&raw) {
                return extract_rhythm_hints_from_plan(&plan);
            }
        }
    }

    BTreeMap::new()
}

fn load_external_phrase_hints(
    run_dir: &std::path::Path,
    commands: &Value,
    lyrics_json: &Value,
) -> BTreeMap<String, Vec<ExternalPhraseHint>> {
    let inline_plan = commands
        .get("creative")
        .and_then(|creative| {
            creative
                .get("music_plan")
                .or_else(|| creative.get("musicPlan"))
        })
        .or_else(|| lyrics_json.get("musicPlan"))
        .or_else(|| lyrics_json.get("music_plan"));
    if let Some(plan) = inline_plan {
        let hints = extract_phrase_hints_from_plan(plan);
        if !hints.is_empty() {
            return hints;
        }
    }

    if let Some(path) = env_cmd("CSS_MUSIC_PLAN_JSON") {
        if let Ok(raw) = std::fs::read_to_string(&path) {
            if let Ok(plan) = serde_json::from_str::<Value>(&raw) {
                let hints = extract_phrase_hints_from_plan(&plan);
                if !hints.is_empty() {
                    return hints;
                }
            }
        }
    }

    let default_path = run_dir.join("./build/music.plan.json");
    if default_path.exists() {
        if let Ok(raw) = std::fs::read_to_string(default_path) {
            if let Ok(plan) = serde_json::from_str::<Value>(&raw) {
                return extract_phrase_hints_from_plan(&plan);
            }
        }
    }

    BTreeMap::new()
}

fn load_external_melody_hints(
    run_dir: &std::path::Path,
    commands: &Value,
    lyrics_json: &Value,
) -> BTreeMap<String, Vec<ExternalMelodyHint>> {
    let inline_plan = commands
        .get("creative")
        .and_then(|creative| {
            creative
                .get("music_plan")
                .or_else(|| creative.get("musicPlan"))
        })
        .or_else(|| lyrics_json.get("musicPlan"))
        .or_else(|| lyrics_json.get("music_plan"));
    if let Some(plan) = inline_plan {
        let hints = extract_melody_hints_from_plan(plan);
        if !hints.is_empty() {
            return hints;
        }
    }

    if let Some(path) = env_cmd("CSS_MUSIC_PLAN_JSON") {
        if let Ok(raw) = std::fs::read_to_string(&path) {
            if let Ok(plan) = serde_json::from_str::<Value>(&raw) {
                let hints = extract_melody_hints_from_plan(&plan);
                if !hints.is_empty() {
                    return hints;
                }
            }
        }
    }

    let default_path = run_dir.join("./build/music.plan.json");
    if default_path.exists() {
        if let Ok(raw) = std::fs::read_to_string(default_path) {
            if let Ok(plan) = serde_json::from_str::<Value>(&raw) {
                return extract_melody_hints_from_plan(&plan);
            }
        }
    }

    BTreeMap::new()
}

fn load_vocal_plan_hints(run_dir: &std::path::Path) -> VocalPlanHints {
    let path = run_dir.join("./build/vocals.plan.json");
    let raw = match std::fs::read_to_string(path) {
        Ok(raw) => raw,
        Err(_) => return VocalPlanHints::default(),
    };
    let parsed: Value = match serde_json::from_str(&raw) {
        Ok(parsed) => parsed,
        Err(_) => return VocalPlanHints::default(),
    };
    let focus_events = parsed
        .get("focusEvents")
        .and_then(|value| value.as_array())
        .into_iter()
        .flatten()
        .filter_map(|item| {
            let start_sec = item.get("startSec").and_then(|value| value.as_f64())? as f32;
            let duration_sec = item.get("durationSec").and_then(|value| value.as_f64())? as f32;
            let strength = item.get("strength").and_then(|value| value.as_f64())? as f32;
            Some(VocalFocusHint {
                start_sec,
                duration_sec,
                strength: strength.clamp(0.0, 1.0),
                section: item
                    .get("section")
                    .and_then(|value| value.as_str())
                    .map(str::to_string),
                token: item
                    .get("token")
                    .and_then(|value| value.as_str())
                    .map(str::to_string),
            })
        })
        .collect();
    let cadence_anchors = parsed
        .get("cadenceAnchors")
        .and_then(|value| value.as_array())
        .into_iter()
        .flatten()
        .filter_map(|item| {
            let start_sec = item.get("startSec").and_then(|value| value.as_f64())? as f32;
            let duration_sec = item.get("durationSec").and_then(|value| value.as_f64())? as f32;
            let strength = item.get("strength").and_then(|value| value.as_f64())? as f32;
            Some(VocalCadenceAnchorHint {
                start_sec,
                duration_sec,
                strength: strength.clamp(0.0, 1.0),
                cue_index: item
                    .get("cueIndex")
                    .and_then(|value| value.as_u64())
                    .map(|value| value as usize)
                    .unwrap_or(0),
                phrase_order: item
                    .get("phraseOrder")
                    .and_then(|value| value.as_u64())
                    .map(|value| value as usize)
                    .unwrap_or(0),
                role: item
                    .get("role")
                    .and_then(|value| value.as_str())
                    .map(str::to_string),
                cadence: item
                    .get("cadence")
                    .and_then(|value| value.as_str())
                    .map(str::to_string),
            })
        })
        .collect();
    let reply_harmony_windows = parsed
        .get("replyHarmonyWindows")
        .and_then(|value| value.as_array())
        .into_iter()
        .flatten()
        .filter_map(|item| {
            let start_sec = item.get("startSec").and_then(|value| value.as_f64())? as f32;
            let duration_sec = item.get("durationSec").and_then(|value| value.as_f64())? as f32;
            let strength = item.get("strength").and_then(|value| value.as_f64())? as f32;
            Some(VocalReplyHarmonyWindowHint {
                start_sec,
                duration_sec,
                strength: strength.clamp(0.0, 1.0),
                section: item
                    .get("section")
                    .and_then(|value| value.as_str())
                    .map(str::to_string),
                token: item
                    .get("token")
                    .and_then(|value| value.as_str())
                    .map(str::to_string),
                role: item
                    .get("role")
                    .and_then(|value| value.as_str())
                    .map(str::to_string),
                cadence: item
                    .get("cadence")
                    .and_then(|value| value.as_str())
                    .map(str::to_string),
                cue_index: item
                    .get("cueIndex")
                    .and_then(|value| value.as_u64())
                    .map(|value| value as usize)
                    .unwrap_or(0),
                phrase_order: item
                    .get("phraseOrder")
                    .and_then(|value| value.as_u64())
                    .map(|value| value as usize)
                    .unwrap_or(0),
                bass_duck: item
                    .get("bassDuck")
                    .and_then(|value| value.as_f64())
                    .map(|value| value as f32)
                    .unwrap_or(1.0)
                    .clamp(0.0, 1.0),
                sub_duck: item
                    .get("subDuck")
                    .and_then(|value| value.as_f64())
                    .map(|value| value as f32)
                    .unwrap_or(1.0)
                    .clamp(0.0, 1.0),
                pad_duck: item
                    .get("padDuck")
                    .and_then(|value| value.as_f64())
                    .map(|value| value as f32)
                    .unwrap_or(1.0)
                    .clamp(0.0, 1.0),
                strings_duck: item
                    .get("stringsDuck")
                    .and_then(|value| value.as_f64())
                    .map(|value| value as f32)
                    .unwrap_or(1.0)
                    .clamp(0.0, 1.0),
                strings_settle_gain: item
                    .get("stringsSettleGain")
                    .and_then(|value| value.as_f64())
                    .map(|value| value as f32)
                    .unwrap_or(1.0)
                    .clamp(0.0, 2.0),
            })
        })
        .collect();
    VocalPlanHints {
        focus_events,
        cadence_anchors,
        reply_harmony_windows,
    }
}

fn extract_rhythm_hints_from_plan(plan: &Value) -> BTreeMap<String, ExternalRhythmHint> {
    let mut grouped: BTreeMap<String, ExternalRhythmHint> = BTreeMap::new();
    for phrase in plan
        .get("phrases")
        .and_then(|value| value.as_array())
        .into_iter()
        .flatten()
    {
        let section = phrase
            .get("section")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .trim();
        if section.is_empty() {
            continue;
        }
        let groove = phrase.get("groove").unwrap_or(&Value::Null);
        let entry = grouped
            .entry(normalize_section_key(section))
            .or_insert_with(|| ExternalRhythmHint {
                groove_template: None,
                syncopation: None,
                swing: None,
                micro_timing_ms: None,
                activity_profile: Vec::new(),
                bar_accent_pattern: Vec::new(),
                push_pull_profile: Vec::new(),
            });
        if entry.syncopation.is_none() {
            entry.syncopation = groove
                .get("syncopation")
                .and_then(|value| value.as_str())
                .map(str::to_string);
        }
        if entry.swing.is_none() {
            entry.swing = groove
                .get("swing")
                .and_then(|value| value.as_str())
                .map(str::to_string);
        }
        if entry.micro_timing_ms.is_none() {
            entry.micro_timing_ms = groove
                .get("microTimingMs")
                .and_then(|value| value.as_f64())
                .map(|value| value as f32);
        }
        if entry.groove_template.is_none() {
            entry.groove_template = groove
                .get("activityProfile")
                .and_then(|value| value.as_array())
                .and_then(|activity| activity.iter().any(|v| v == "burst").then_some("anthem"))
                .map(str::to_string)
                .or_else(|| {
                    groove
                        .get("pushPullProfile")
                        .and_then(|value| value.as_array())
                        .and_then(|items| {
                            items.iter().any(|v| v == "laid_back").then_some("floating")
                        })
                        .map(str::to_string)
                });
        }
        entry.activity_profile.extend(
            groove
                .get("activityProfile")
                .and_then(|value| value.as_array())
                .into_iter()
                .flatten()
                .filter_map(|value| value.as_str().map(str::to_string)),
        );
        entry.bar_accent_pattern.extend(
            groove
                .get("barAccentPattern")
                .and_then(|value| value.as_array())
                .into_iter()
                .flatten()
                .map(|bar| {
                    bar.as_array()
                        .into_iter()
                        .flatten()
                        .filter_map(|value| value.as_str().map(str::to_string))
                        .collect::<Vec<_>>()
                })
                .filter(|bar| !bar.is_empty()),
        );
        entry.push_pull_profile.extend(
            groove
                .get("pushPullProfile")
                .and_then(|value| value.as_array())
                .into_iter()
                .flatten()
                .filter_map(|value| value.as_str().map(str::to_string)),
        );
    }
    grouped
}

fn extract_phrase_hints_from_plan(plan: &Value) -> BTreeMap<String, Vec<ExternalPhraseHint>> {
    let mut grouped: BTreeMap<String, Vec<ExternalPhraseHint>> = BTreeMap::new();
    for phrase in plan
        .get("phrases")
        .and_then(|value| value.as_array())
        .into_iter()
        .flatten()
    {
        let section = phrase
            .get("section")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .trim();
        if section.is_empty() {
            continue;
        }
        let hint = ExternalPhraseHint {
            role: phrase
                .get("role")
                .and_then(|value| value.as_str())
                .map(str::to_string),
            variation_role: phrase
                .get("variationRole")
                .and_then(|value| value.as_str())
                .map(str::to_string),
            cadence_intent: phrase
                .get("cadenceIntent")
                .and_then(|value| value.as_str())
                .or_else(|| {
                    phrase
                        .get("constraints")
                        .and_then(|value| value.get("cadenceBias"))
                        .and_then(|value| value.as_str())
                })
                .map(str::to_string),
        };
        if hint.role.is_none() && hint.variation_role.is_none() && hint.cadence_intent.is_none() {
            continue;
        }
        grouped
            .entry(normalize_section_key(section))
            .or_default()
            .push(hint);
    }
    grouped
}

fn extract_melody_hints_from_plan(plan: &Value) -> BTreeMap<String, Vec<ExternalMelodyHint>> {
    let mut grouped: BTreeMap<String, Vec<ExternalMelodyHint>> = BTreeMap::new();
    for phrase in plan
        .get("phrases")
        .and_then(|value| value.as_array())
        .into_iter()
        .flatten()
    {
        let section = phrase
            .get("section")
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .trim();
        if section.is_empty() {
            continue;
        }
        let melody = phrase.get("melody").unwrap_or(&Value::Null);
        let hint = ExternalMelodyHint {
            contour: melody
                .get("contour")
                .and_then(|value| value.as_str())
                .map(str::to_string),
            phrase_function: melody
                .get("phraseFunction")
                .and_then(|value| value.as_str())
                .map(str::to_string),
            hook_strength: melody
                .get("hookStrength")
                .and_then(|value| value.as_f64())
                .map(|value| value as f32),
            target_degrees: melody
                .get("targetDegrees")
                .and_then(|value| value.as_array())
                .into_iter()
                .flatten()
                .filter_map(|value| value.as_i64().map(|entry| entry as i32))
                .collect(),
            register_anchor: melody
                .get("registerAnchor")
                .and_then(|value| value.as_str())
                .map(str::to_string),
            motion_bias: melody
                .get("motionBias")
                .and_then(|value| value.as_str())
                .map(str::to_string),
            leap_budget: melody
                .get("leapBudget")
                .and_then(|value| value.as_u64())
                .map(|value| value as u8),
            landing_tone: melody
                .get("landingTone")
                .and_then(|value| value.as_str())
                .map(str::to_string),
            ornamentation: melody
                .get("ornamentation")
                .and_then(|value| value.as_str())
                .map(str::to_string),
            repetition_window_bars: melody
                .get("repetitionWindowBars")
                .and_then(|value| value.as_u64())
                .map(|value| value as u8),
            counterline_role: melody
                .get("counterlineRole")
                .and_then(|value| value.as_str())
                .map(str::to_string),
            lyric_stress_map: melody
                .get("lyricStressMap")
                .and_then(|value| value.as_array())
                .into_iter()
                .flatten()
                .filter_map(|value| value.as_str().map(str::to_string))
                .collect(),
            note_grouping: melody
                .get("noteGrouping")
                .and_then(|value| value.as_array())
                .into_iter()
                .flatten()
                .filter_map(|value| value.as_u64().map(|entry| entry as u8))
                .collect(),
            hook_restatement_passes: melody
                .get("hookRestatementPasses")
                .and_then(|value| value.as_array())
                .into_iter()
                .flatten()
                .filter_map(|value| {
                    let object = value.as_object()?;
                    Some(ExternalRestatementPassHint {
                        order: object
                            .get("order")
                            .and_then(|entry| entry.as_u64())
                            .unwrap_or(1) as u8,
                        role: object
                            .get("role")
                            .and_then(|entry| entry.as_str())
                            .unwrap_or("")
                            .to_string(),
                        register_bias: object
                            .get("registerBias")
                            .and_then(|entry| entry.as_str())
                            .unwrap_or("")
                            .to_string(),
                        sustain_bias: object
                            .get("sustainBias")
                            .and_then(|entry| entry.as_str())
                            .unwrap_or("")
                            .to_string(),
                        landing_move: object
                            .get("landingMove")
                            .and_then(|entry| entry.as_str())
                            .unwrap_or("")
                            .to_string(),
                    })
                })
                .collect(),
            climax_bar: melody
                .get("climaxBar")
                .and_then(|value| value.as_u64())
                .map(|value| value as u8),
            antecedent_phrase_id: melody
                .get("antecedentPhraseId")
                .and_then(|value| value.as_str())
                .map(str::to_string),
        };
        let has_data = hint.contour.is_some()
            || hint.phrase_function.is_some()
            || hint.hook_strength.is_some()
            || !hint.target_degrees.is_empty()
            || hint.register_anchor.is_some()
            || hint.motion_bias.is_some()
            || hint.leap_budget.is_some()
            || hint.landing_tone.is_some()
            || hint.ornamentation.is_some()
            || hint.repetition_window_bars.is_some()
            || hint.counterline_role.is_some()
            || !hint.lyric_stress_map.is_empty()
            || !hint.note_grouping.is_empty()
            || !hint.hook_restatement_passes.is_empty()
            || hint.climax_bar.is_some()
            || hint.antecedent_phrase_id.is_some();
        if !has_data {
            continue;
        }
        grouped
            .entry(normalize_section_key(section))
            .or_default()
            .push(hint);
    }
    grouped
}

fn vocal_space_profile(time_sec: f32, hints: &[VocalFocusHint]) -> VocalSpaceProfile {
    let mut counter_duck = 1.0_f32;
    let mut pluck_duck = 1.0_f32;
    let mut strings_duck = 1.0_f32;
    for hint in hints {
        let end = hint.start_sec + hint.duration_sec;
        if time_sec < hint.start_sec || time_sec > end {
            continue;
        }
        let pos = ((time_sec - hint.start_sec) / hint.duration_sec.max(0.001)).clamp(0.0, 1.0);
        let center_weight = 1.0 - ((pos - 0.5).abs() * 2.0).clamp(0.0, 1.0);
        let tail_support = ((pos - 0.58) / 0.42).clamp(0.0, 1.0);
        counter_duck = counter_duck
            .min((1.0 - hint.strength * (0.34 + center_weight * 0.18)).clamp(0.46, 1.0));
        pluck_duck =
            pluck_duck.min((1.0 - hint.strength * (0.18 + center_weight * 0.28)).clamp(0.56, 1.0));
        let strings_focus_duck = 1.0 - hint.strength * (0.08 + center_weight * 0.08);
        let strings_tail_bloom = 0.98 + hint.strength * tail_support * 0.1;
        let strings_role_gain = strings_focus_duck.max(strings_tail_bloom);
        strings_duck = strings_duck.min(strings_role_gain.clamp(0.82, 1.04));
    }
    VocalSpaceProfile {
        strings_duck,
        pluck_duck,
        counter_duck,
    }
}

fn vocal_hit_space_profile(time_sec: f32, hints: &[VocalFocusHint]) -> VocalHitSpaceProfile {
    let mut pluck_hit_gate = 1.0_f32;
    let mut percussion_hit_gate = 1.0_f32;
    let mut counter_hit_gate = 1.0_f32;
    for hint in hints {
        let end = hint.start_sec + hint.duration_sec;
        if time_sec < hint.start_sec || time_sec > end {
            continue;
        }
        let pos = ((time_sec - hint.start_sec) / hint.duration_sec.max(0.001)).clamp(0.0, 1.0);
        let center_weight = 1.0 - ((pos - 0.5).abs() * 2.0).clamp(0.0, 1.0);
        let edge_weight = ((pos - 0.5).abs() * 2.0).clamp(0.0, 1.0);
        counter_hit_gate = counter_hit_gate
            .min((1.0 - hint.strength * (0.48 + center_weight * 0.34)).clamp(0.28, 1.0));
        pluck_hit_gate = pluck_hit_gate
            .min((1.0 - hint.strength * (0.22 + center_weight * 0.42)).clamp(0.36, 1.0));
        percussion_hit_gate = percussion_hit_gate.min(
            (1.0 - hint.strength * (0.12 + center_weight * 0.22 + edge_weight * 0.04))
                .clamp(0.48, 1.0),
        );
    }
    VocalHitSpaceProfile {
        pluck_hit_gate,
        percussion_hit_gate,
        counter_hit_gate,
    }
}

fn vocal_harmony_space_profile(
    time_sec: f32,
    hints: &[VocalFocusHint],
) -> VocalHarmonySpaceProfile {
    let mut bass_duck = 1.0_f32;
    let mut sub_duck = 1.0_f32;
    let mut pad_duck = 1.0_f32;
    let mut chord_motion_hold = 0.0_f32;
    let mut bass_root_hold = 0.0_f32;
    let mut harmonic_density = 1.0_f32;
    for hint in hints {
        let end = hint.start_sec + hint.duration_sec;
        if time_sec < hint.start_sec || time_sec > end {
            continue;
        }
        let pos = ((time_sec - hint.start_sec) / hint.duration_sec.max(0.001)).clamp(0.0, 1.0);
        let center_weight = 1.0 - ((pos - 0.5).abs() * 2.0).clamp(0.0, 1.0);
        bass_duck =
            bass_duck.min((1.0 - hint.strength * (0.1 + center_weight * 0.16)).clamp(0.78, 1.0));
        sub_duck =
            sub_duck.min((1.0 - hint.strength * (0.08 + center_weight * 0.12)).clamp(0.82, 1.0));
        pad_duck =
            pad_duck.min((1.0 - hint.strength * (0.04 + center_weight * 0.08)).clamp(0.88, 1.0));
        chord_motion_hold =
            chord_motion_hold.max((hint.strength * (0.34 + center_weight * 0.46)).clamp(0.0, 0.9));
        bass_root_hold =
            bass_root_hold.max((hint.strength * (0.42 + center_weight * 0.4)).clamp(0.0, 0.94));
        harmonic_density = harmonic_density
            .min((1.0 - hint.strength * (0.1 + center_weight * 0.22)).clamp(0.62, 1.0));
    }
    VocalHarmonySpaceProfile {
        bass_duck,
        sub_duck,
        pad_duck,
        chord_motion_hold,
        bass_root_hold,
        harmonic_density,
    }
}

fn vocal_focus_strength_at_time(time_sec: f32, hints: &[VocalFocusHint]) -> f32 {
    let mut strength = 0.0_f32;
    for hint in hints {
        let end = hint.start_sec + hint.duration_sec;
        if time_sec < hint.start_sec || time_sec > end {
            continue;
        }
        let pos = ((time_sec - hint.start_sec) / hint.duration_sec.max(0.001)).clamp(0.0, 1.0);
        let center_weight = 1.0 - ((pos - 0.5).abs() * 2.0).clamp(0.0, 1.0);
        strength = strength.max((hint.strength * (0.46 + center_weight * 0.54)).clamp(0.0, 1.0));
    }
    strength
}

fn focus_held_chord_index(
    local_t: f32,
    chord_span: f32,
    progression_len: usize,
    hold_strength: f32,
) -> usize {
    let safe_len = progression_len.max(1);
    let base_chord_index = ((local_t / chord_span).floor() as usize) % safe_len;
    if hold_strength <= 0.0 || base_chord_index == 0 {
        return base_chord_index;
    }
    let chord_phase = (local_t % chord_span) / chord_span.max(0.001);
    if chord_phase < hold_strength.clamp(0.0, 0.98) * 0.55 {
        base_chord_index.saturating_sub(1)
    } else {
        base_chord_index
    }
}

fn cadence_target_chord_index(segment: &PhraseSegment) -> usize {
    let cadence = cadence_intent_label(segment);
    let len = segment.progression.len().max(1);
    if len == 1 {
        return 0;
    }
    match cadence {
        "authentic" | "resolved" | "plagal" => len - 1,
        "half" => len.saturating_sub(2).max(1),
        "deceptive" => len.saturating_sub(2),
        _ => len - 1,
    }
}

fn cadence_anchor_strength_at_time(time_sec: f32, hints: &[VocalCadenceAnchorHint]) -> f32 {
    let mut strength = 0.0_f32;
    for hint in hints {
        let end = hint.start_sec + hint.duration_sec;
        if time_sec < hint.start_sec || time_sec > end {
            continue;
        }
        let pos = ((time_sec - hint.start_sec) / hint.duration_sec.max(0.001)).clamp(0.0, 1.0);
        let tail_weight = ((pos - 0.32) / 0.68).clamp(0.0, 1.0);
        strength = strength.max((hint.strength * (0.52 + tail_weight * 0.48)).clamp(0.0, 1.0));
    }
    strength
}

fn cadence_anchor_target_chord_index(
    segment: &PhraseSegment,
    hint: &VocalCadenceAnchorHint,
) -> usize {
    let len = segment.progression.len().max(1);
    if len == 1 {
        return 0;
    }
    match hint.cadence.as_deref().unwrap_or("") {
        "authentic" | "resolved" | "plagal" => len - 1,
        "half" => len.saturating_sub(2).max(1),
        "deceptive" => len.saturating_sub(2),
        _ => cadence_target_chord_index(segment),
    }
}

fn cadence_anchor_for_segment_time<'a>(
    segment: &PhraseSegment,
    time_sec: f32,
    hints: &'a [VocalCadenceAnchorHint],
) -> Option<&'a VocalCadenceAnchorHint> {
    let segment_end = segment.start_sec + segment.duration_sec;
    hints.iter().find(|hint| {
        let hint_end = hint.start_sec + hint.duration_sec;
        hint.start_sec >= segment.start_sec - 0.001
            && hint_end <= segment_end + 0.001
            && time_sec >= hint.start_sec
            && time_sec <= hint_end
    })
}

fn phrase_end_cadence_profile(
    segment: &PhraseSegment,
    local_t: f32,
    focus_strength: f32,
    cadence_anchor: Option<&VocalCadenceAnchorHint>,
) -> PhraseEndCadenceProfile {
    let role = phrase_role_label(segment);
    let cadence = cadence_intent_label(segment);
    let end_progress = (local_t / segment.duration_sec.max(0.001)).clamp(0.0, 1.0);
    let end_weight = ((end_progress - 0.68) / 0.32).clamp(0.0, 1.0);
    let role_weight: f32 = match role {
        "resolve" => 1.0,
        "release" => 0.92,
        "lift" => 0.34,
        _ => 0.18,
    };
    let cadence_weight: f32 = match cadence {
        "authentic" | "resolved" => 1.0,
        "plagal" => 0.84,
        "half" => 0.42,
        "deceptive" => 0.3,
        _ => 0.18,
    };
    let anchor_strength = cadence_anchor.map(|hint| hint.strength).unwrap_or(0.0);
    let explicit_settle = (anchor_strength * (0.66 + end_weight * 0.34)).clamp(0.0, 1.0);
    let inferred_settle =
        (focus_strength * end_weight * role_weight.max(cadence_weight)).clamp(0.0, 1.0);
    let settle = inferred_settle.max(explicit_settle);
    let target_chord_index = cadence_anchor
        .map(|hint| cadence_anchor_target_chord_index(segment, hint))
        .unwrap_or_else(|| cadence_target_chord_index(segment));
    PhraseEndCadenceProfile {
        target_chord_index,
        chord_settle: settle,
        bass_settle: (settle * 1.12).clamp(0.0, 1.0),
        density_scale: (1.0 - settle * 0.28).clamp(0.62, 1.0),
        strings_settle_gain: (1.0 + settle * 0.2).clamp(1.0, 1.22),
        choir_settle_gain: (1.0 + settle * 0.24).clamp(1.0, 1.26),
        atmosphere_settle_gain: (1.0 - settle * 0.16).clamp(0.78, 1.0),
        shimmer_trim: (1.0 - settle * 0.22).clamp(0.72, 1.0),
    }
}

fn guofeng_tail_release_profile(
    segment: &PhraseSegment,
    local_t: f32,
    cadence: &PhraseEndCadenceProfile,
) -> GuofengTailReleaseProfile {
    if segment.style != ArrangementStyle::Guofeng {
        return GuofengTailReleaseProfile {
            pluck_gate: 1.0,
            counter_gate: 1.0,
            frame_tail: cadence.chord_settle,
        };
    }
    let role = phrase_role_label(segment);
    let cadence_intent = cadence_intent_label(segment);
    let tail_progress = (local_t / segment.duration_sec.max(0.1)).clamp(0.0, 1.0);
    let tail_window = ((tail_progress - 0.72) / 0.28).clamp(0.0, 1.0);
    let release_weight = if matches!(role, "resolve" | "release")
        || matches!(cadence_intent, "authentic" | "resolved" | "plagal")
    {
        cadence.chord_settle.max(cadence.bass_settle * 0.92)
    } else {
        cadence.chord_settle * 0.42
    };
    let pluck_gate = (1.0 - tail_window * release_weight * 2.2).clamp(0.04, 1.0);
    let counter_gate = (1.0 - tail_window * release_weight * 0.62).clamp(0.18, 1.0);
    let frame_tail =
        (cadence.chord_settle * 0.68 + tail_window * release_weight * 0.32).clamp(0.0, 1.0);
    GuofengTailReleaseProfile {
        pluck_gate,
        counter_gate,
        frame_tail,
    }
}

fn phrase_breath_profile(segment: &PhraseSegment, local_t: f32) -> PhraseBreathProfile {
    let progress = (local_t / segment.duration_sec.max(0.001)).clamp(0.0, 1.0);
    if !(0.14..=0.82).contains(&progress) {
        return PhraseBreathProfile {
            pluck_gate: 1.0,
            counter_gate: 1.0,
            percussion_gate: 1.0,
            counter_fill_gain: 1.0,
        };
    }

    let role = phrase_role_label(segment);
    let variation = phrase_variation_label(segment);
    let (center, width, strength): (f32, f32, f32) = match role {
        "response" => (0.46_f32, 0.13_f32, 1.0_f32),
        "setup" => (0.42_f32, 0.11_f32, 0.82_f32),
        "lift" => (0.54_f32, 0.1_f32, 0.68_f32),
        "resolve" | "release" => (0.5_f32, 0.09_f32, 0.44_f32),
        _ => (0.48_f32, 0.11_f32, 0.58_f32),
    };
    let variation_lift: f32 = match variation {
        "answer" | "call-response" => 0.12_f32,
        "repeat" => 0.06_f32,
        "develop" | "variation" => 0.08_f32,
        _ => 0.0_f32,
    };
    let strength = (strength + variation_lift).clamp(0.0, 1.08);
    let distance = ((progress - center).abs() / width.max(0.04)).clamp(0.0, 1.0);
    let breath_focus = (1.0 - distance).powf(1.7);
    let approach = ((center - progress) / width.max(0.04)).clamp(0.0, 1.0);
    let release = ((progress - center) / width.max(0.04)).clamp(0.0, 1.0);

    let pluck_gate = (1.0 - strength * (breath_focus * 0.52 + approach * 0.16)).clamp(0.34, 1.0);
    let counter_gate = (1.0 - strength * (breath_focus * 0.22 + approach * 0.06)).clamp(0.58, 1.0);
    let percussion_gate =
        (1.0 - strength * (breath_focus * 0.36 + approach * 0.1)).clamp(0.42, 1.0);
    let counter_fill_gain =
        (1.0 + strength * release * (0.16 + breath_focus * 0.1)).clamp(1.0, 1.24);

    PhraseBreathProfile {
        pluck_gate,
        counter_gate,
        percussion_gate,
        counter_fill_gain,
    }
}

fn token_focus_breath_profile(
    segment: &PhraseSegment,
    time_sec: f32,
    hints: &[VocalFocusHint],
) -> PhraseBreathProfile {
    let mut profile = PhraseBreathProfile {
        pluck_gate: 1.0,
        counter_gate: 1.0,
        percussion_gate: 1.0,
        counter_fill_gain: 1.0,
    };
    let segment_key = normalize_section_key(&segment.section);

    for hint in hints {
        if let Some(section) = hint.section.as_deref() {
            if normalize_section_key(section) != segment_key {
                continue;
            }
        }
        let token = hint.token.as_deref().unwrap_or("");
        let token_bias = token_breath_bias(token);
        let pre_start = hint.start_sec - hint.duration_sec.max(0.045) * 0.42 - 0.016;
        let post_end = hint.start_sec + hint.duration_sec * 1.34 + 0.04;
        if time_sec < pre_start || time_sec > post_end {
            continue;
        }

        let focus_start = hint.start_sec;
        let focus_end = hint.start_sec + hint.duration_sec;
        let approach_span = (focus_start - pre_start).max(0.02);
        let release_span = (post_end - focus_end).max(0.02);
        let strength = (hint.strength * token_bias).clamp(0.0, 1.0);

        if time_sec <= focus_start {
            let pos = ((time_sec - pre_start) / approach_span).clamp(0.0, 1.0);
            let weight = pos.powf(1.4);
            profile.pluck_gate = profile
                .pluck_gate
                .min((1.0 - strength * (0.18 + weight * 0.34)).clamp(0.44, 1.0));
            profile.percussion_gate = profile
                .percussion_gate
                .min((1.0 - strength * (0.1 + weight * 0.22)).clamp(0.58, 1.0));
            profile.counter_gate = profile
                .counter_gate
                .min((1.0 - strength * (0.06 + weight * 0.1)).clamp(0.72, 1.0));
        } else if time_sec <= focus_end {
            let pos = ((time_sec - focus_start) / hint.duration_sec.max(0.02)).clamp(0.0, 1.0);
            let center = 1.0 - ((pos - 0.5).abs() * 2.0).clamp(0.0, 1.0);
            profile.pluck_gate = profile
                .pluck_gate
                .min((1.0 - strength * (0.26 + center * 0.28)).clamp(0.36, 1.0));
            profile.percussion_gate = profile
                .percussion_gate
                .min((1.0 - strength * (0.14 + center * 0.18)).clamp(0.52, 1.0));
            profile.counter_gate = profile
                .counter_gate
                .min((1.0 - strength * (0.1 + center * 0.16)).clamp(0.66, 1.0));
        } else {
            let pos = ((time_sec - focus_end) / release_span).clamp(0.0, 1.0);
            let weight = (1.0 - (pos - 0.32).abs() / 0.32).clamp(0.0, 1.0).powf(1.4);
            profile.counter_fill_gain = profile
                .counter_fill_gain
                .max((1.0 + strength * (0.08 + weight * 0.18)).clamp(1.0, 1.24));
            profile.counter_gate = profile
                .counter_gate
                .min((1.0 - strength * (0.02 + (1.0 - weight) * 0.04)).clamp(0.84, 1.0));
            profile.pluck_gate = profile.pluck_gate.min((0.94 + pos * 0.08).clamp(0.9, 1.0));
        }
    }

    profile
}

fn token_breath_bias(token: &str) -> f32 {
    let trimmed = token.trim();
    if trimmed.is_empty() {
        return 0.88;
    }
    if trimmed.chars().count() <= 1 {
        return 0.92;
    }
    if matches!(
        trimmed,
        "啊" | "呀" | "吧" | "呢" | "吗" | "哦" | "诶" | "哎" | "啦" | "呀呀"
    ) {
        return 0.84;
    }
    if trimmed.contains("却")
        || trimmed.contains("但")
        || trimmed.contains(" still")
        || trimmed.contains(" again")
        || trimmed.contains("come")
    {
        return 1.06;
    }
    1.0
}

fn token_focus_lane_breath_profile(
    segment: &PhraseSegment,
    time_sec: f32,
    hints: &[VocalFocusHint],
) -> LaneBreathProfile {
    let mut profile = LaneBreathProfile {
        bass_emphasis: 1.0,
        kick_gate: 1.0,
        wood_gate: 1.0,
        frame_gate: 1.0,
        shaker_gate: 1.0,
        wood_role_gain: 1.0,
        frame_role_gain: 1.0,
        shaker_role_gain: 1.0,
    };
    let segment_key = normalize_section_key(&segment.section);

    for hint in hints {
        if let Some(section) = hint.section.as_deref() {
            if normalize_section_key(section) != segment_key {
                continue;
            }
        }
        let token_bias = token_breath_bias(hint.token.as_deref().unwrap_or(""));
        let pre_start = hint.start_sec - hint.duration_sec.max(0.05) * 0.44 - 0.018;
        let post_end = hint.start_sec + hint.duration_sec * 1.42 + 0.05;
        if time_sec < pre_start || time_sec > post_end {
            continue;
        }

        let focus_start = hint.start_sec;
        let focus_end = hint.start_sec + hint.duration_sec;
        let strength = (hint.strength * token_bias).clamp(0.0, 1.0);
        let guofeng_bias = if segment.style == ArrangementStyle::Guofeng {
            1.0
        } else {
            0.72
        };

        if time_sec <= focus_start {
            let pos =
                ((time_sec - pre_start) / (focus_start - pre_start).max(0.02)).clamp(0.0, 1.0);
            let weight = pos.powf(1.35);
            profile.kick_gate = profile
                .kick_gate
                .min((1.0 - strength * guofeng_bias * (0.06 + weight * 0.12)).clamp(0.78, 1.0));
            profile.bass_emphasis = profile
                .bass_emphasis
                .min((1.0 - strength * guofeng_bias * (0.04 + weight * 0.1)).clamp(0.82, 1.0));
            profile.wood_gate = profile
                .wood_gate
                .min((1.0 - strength * guofeng_bias * (0.16 + weight * 0.28)).clamp(0.48, 1.0));
            profile.frame_gate = profile
                .frame_gate
                .min((1.0 - strength * guofeng_bias * (0.12 + weight * 0.2)).clamp(0.58, 1.0));
            profile.shaker_gate = profile
                .shaker_gate
                .min((1.0 - strength * guofeng_bias * (0.18 + weight * 0.3)).clamp(0.42, 1.0));
            profile.wood_role_gain = profile
                .wood_role_gain
                .min((1.0 - strength * guofeng_bias * (0.18 + weight * 0.22)).clamp(0.34, 1.0));
            profile.frame_role_gain = profile
                .frame_role_gain
                .min((0.96 + strength * guofeng_bias * (0.04 + weight * 0.1)).clamp(0.9, 1.14));
            profile.shaker_role_gain = profile
                .shaker_role_gain
                .min((1.0 - strength * guofeng_bias * (0.24 + weight * 0.28)).clamp(0.26, 1.0));
        } else if time_sec <= focus_end {
            let pos = ((time_sec - focus_start) / hint.duration_sec.max(0.02)).clamp(0.0, 1.0);
            let center = 1.0 - ((pos - 0.5).abs() * 2.0).clamp(0.0, 1.0);
            profile.kick_gate = profile
                .kick_gate
                .min((1.0 - strength * guofeng_bias * (0.08 + center * 0.1)).clamp(0.76, 1.0));
            profile.bass_emphasis = profile
                .bass_emphasis
                .min((1.0 - strength * guofeng_bias * (0.06 + center * 0.12)).clamp(0.78, 1.0));
            profile.wood_gate = profile
                .wood_gate
                .min((1.0 - strength * guofeng_bias * (0.2 + center * 0.22)).clamp(0.4, 1.0));
            profile.frame_gate = profile
                .frame_gate
                .min((1.0 - strength * guofeng_bias * (0.16 + center * 0.18)).clamp(0.5, 1.0));
            profile.shaker_gate = profile
                .shaker_gate
                .min((1.0 - strength * guofeng_bias * (0.22 + center * 0.24)).clamp(0.36, 1.0));
            profile.wood_role_gain = profile
                .wood_role_gain
                .min((1.0 - strength * guofeng_bias * (0.26 + center * 0.24)).clamp(0.18, 1.0));
            profile.frame_role_gain = profile.frame_role_gain.min(
                (0.88 + strength * guofeng_bias * (0.02 + (1.0 - center) * 0.08)).clamp(0.82, 1.02),
            );
            profile.shaker_role_gain = profile
                .shaker_role_gain
                .min((1.0 - strength * guofeng_bias * (0.3 + center * 0.28)).clamp(0.14, 1.0));
        } else {
            let pos = ((time_sec - focus_end) / (post_end - focus_end).max(0.02)).clamp(0.0, 1.0);
            let rebound = (1.0 - (pos - 0.28).abs() / 0.28).clamp(0.0, 1.0).powf(1.3);
            profile.wood_gate = profile
                .wood_gate
                .min((0.92 + rebound * 0.12).clamp(0.88, 1.0));
            profile.frame_gate = profile
                .frame_gate
                .min((0.9 + rebound * 0.1).clamp(0.86, 1.0));
            profile.shaker_gate = profile
                .shaker_gate
                .min((0.86 + rebound * 0.14).clamp(0.82, 1.0));
            profile.kick_gate = profile
                .kick_gate
                .min((0.94 + rebound * 0.05).clamp(0.92, 1.0));
            profile.bass_emphasis = profile
                .bass_emphasis
                .min((0.95 + rebound * 0.05).clamp(0.92, 1.0));
            profile.wood_role_gain = profile
                .wood_role_gain
                .min((0.92 + rebound * 0.22).clamp(0.9, 1.16));
            profile.frame_role_gain = profile
                .frame_role_gain
                .min((0.88 + rebound * 0.08).clamp(0.84, 1.0));
            profile.shaker_role_gain = profile
                .shaker_role_gain
                .min((0.78 + rebound * 0.1).clamp(0.74, 0.94));
        }
    }

    profile
}

fn token_focus_reply_routing_profile(
    segment: &PhraseSegment,
    time_sec: f32,
    hints: &[VocalFocusHint],
) -> TokenReplyRoutingProfile {
    let mut profile = TokenReplyRoutingProfile {
        pluck_reply_gain: 1.0,
        counter_reply_gain: 1.0,
        lead_gap_fill_gain: 1.0,
    };
    let segment_key = normalize_section_key(&segment.section);
    let role = phrase_role_label(segment);
    let variation = phrase_variation_label(segment);

    for hint in hints {
        if let Some(section) = hint.section.as_deref() {
            if normalize_section_key(section) != segment_key {
                continue;
            }
        }
        let token_bias = token_breath_bias(hint.token.as_deref().unwrap_or(""));
        let focus_end = hint.start_sec + hint.duration_sec;
        let reply_end = focus_end + hint.duration_sec.max(0.06) * 1.6 + 0.05;
        if time_sec < focus_end || time_sec > reply_end {
            continue;
        }
        let pos = ((time_sec - focus_end) / (reply_end - focus_end).max(0.02)).clamp(0.0, 1.0);
        let reply_weight = (1.0 - (pos - 0.28).abs() / 0.28).clamp(0.0, 1.0).powf(1.35);
        let strength = (hint.strength * token_bias).clamp(0.0, 1.0);

        let (pluck_bias, counter_bias, lead_bias): (f32, f32, f32) = match role {
            "response" => (0.18, 0.36, 0.1),
            "setup" => (0.32, 0.16, 0.14),
            "lift" => (0.14, 0.18, 0.3),
            "resolve" | "release" => (0.08, 0.14, 0.18),
            _ => (0.24, 0.22, 0.14),
        };
        let variation_lift = match variation {
            "answer" | "call-response" => (0.0_f32, 0.08_f32, 0.0_f32),
            "development" => (0.02_f32, 0.04_f32, 0.06_f32),
            "repeat" => (0.06_f32, 0.0_f32, 0.0_f32),
            _ => (0.0_f32, 0.0_f32, 0.0_f32),
        };

        profile.pluck_reply_gain = profile.pluck_reply_gain.max(
            (1.0 + strength * reply_weight * (pluck_bias + variation_lift.0)).clamp(1.0, 1.22),
        );
        profile.counter_reply_gain = profile.counter_reply_gain.max(
            (1.0 + strength * reply_weight * (counter_bias + variation_lift.1)).clamp(1.0, 1.28),
        );
        profile.lead_gap_fill_gain = profile
            .lead_gap_fill_gain
            .max((1.0 + strength * reply_weight * (lead_bias + variation_lift.2)).clamp(1.0, 1.18));
    }

    profile
}

fn token_focus_reply_pitch_profile(
    segment: &PhraseSegment,
    time_sec: f32,
    hints: &[VocalFocusHint],
    chord_frame: &ChordFrame,
    lead_interval: i32,
    counter_interval: i32,
    pluck_interval: i32,
) -> TokenReplyPitchProfile {
    let mut profile = TokenReplyPitchProfile {
        counter_semitone_offset: 0.0,
        pluck_semitone_offset: 0.0,
        lead_semitone_offset: 0.0,
    };
    let segment_key = normalize_section_key(&segment.section);
    let role = phrase_role_label(segment);
    let variation = phrase_variation_label(segment);
    let cadence = cadence_intent_label(segment);

    for hint in hints {
        if let Some(section) = hint.section.as_deref() {
            if normalize_section_key(section) != segment_key {
                continue;
            }
        }
        let token_bias = token_breath_bias(hint.token.as_deref().unwrap_or(""));
        let focus_end = hint.start_sec + hint.duration_sec;
        let reply_end = focus_end + hint.duration_sec.max(0.06) * 1.6 + 0.05;
        if time_sec < focus_end || time_sec > reply_end {
            continue;
        }
        let pos = ((time_sec - focus_end) / (reply_end - focus_end).max(0.02)).clamp(0.0, 1.0);
        let reply_weight = (1.0 - (pos - 0.32).abs() / 0.32).clamp(0.0, 1.0).powf(1.2);
        let strength = (hint.strength * token_bias).clamp(0.0, 1.0);

        let (pluck_base, counter_base, lead_base): (f32, f32, f32) = match role {
            "response" => (0.08, -0.72, -0.22),
            "setup" => (0.68, 0.18, 0.32),
            "lift" => (0.32, 0.26, 0.74),
            "resolve" | "release" => (-0.26, -0.82, -0.54),
            _ => (0.16, -0.18, 0.08),
        };
        let (pluck_var, counter_var, lead_var): (f32, f32, f32) = match variation {
            "answer" | "call-response" => (-0.06, -0.28, -0.1),
            "development" => (0.12, 0.08, 0.18),
            "repeat" => (0.08, -0.04, 0.0),
            _ => (0.0, 0.0, 0.0),
        };
        let scale = strength * reply_weight;
        let counter_target = (counter_base + counter_var) * scale;
        let pluck_target = (pluck_base + pluck_var) * scale;
        let lead_target = (lead_base + lead_var) * scale;

        let stable_strength: f32 = match cadence {
            "authentic" | "resolved" => 0.74,
            "plagal" => 0.62,
            "half" => 0.22,
            "deceptive" | "open" => 0.12,
            _ => 0.18,
        };
        let guide_strength: f32 = match cadence {
            "half" => 0.62,
            "deceptive" => 0.56,
            "open" => 0.44,
            "authentic" | "resolved" => 0.12,
            "plagal" => 0.16,
            _ => 0.22,
        };
        let counter_pull =
            cadence_voice_adjustment(counter_interval, cadence, chord_frame.intervals, "counter")
                * if matches!(role, "resolve" | "release") {
                    stable_strength.max(0.48)
                } else {
                    stable_strength.max(guide_strength * 0.8)
                };
        let pluck_pull =
            cadence_voice_adjustment(pluck_interval, cadence, chord_frame.intervals, "pluck")
                * if matches!(role, "setup" | "lift") {
                    guide_strength.max(0.34)
                } else {
                    stable_strength.max(guide_strength * 0.72)
                };
        let lead_pull =
            cadence_voice_adjustment(lead_interval, cadence, chord_frame.intervals, "lead")
                * if matches!(role, "resolve" | "release") {
                    stable_strength.max(0.52)
                } else {
                    guide_strength.max(0.26)
                };

        let counter_total = counter_target + counter_pull * scale;
        let pluck_total = pluck_target + pluck_pull * scale;
        let lead_total = lead_target + lead_pull * scale;

        if counter_total.abs() > profile.counter_semitone_offset.abs() {
            profile.counter_semitone_offset = counter_total.clamp(-1.1, 0.8);
        }
        if pluck_total.abs() > profile.pluck_semitone_offset.abs() {
            profile.pluck_semitone_offset = pluck_total.clamp(-0.6, 1.0);
        }
        if lead_total.abs() > profile.lead_semitone_offset.abs() {
            profile.lead_semitone_offset = lead_total.clamp(-0.8, 0.9);
        }
    }

    profile
}

fn cadence_voice_adjustment(
    current_interval: i32,
    cadence: &str,
    chord_intervals: &[i32],
    voice: &str,
) -> f32 {
    let stable_targets = stable_cadence_targets(chord_intervals, voice);
    let guide_targets = guide_cadence_targets(chord_intervals, voice);
    let preferred_targets = match cadence {
        "authentic" | "resolved" | "plagal" => &stable_targets,
        "half" | "deceptive" | "open" => &guide_targets,
        _ => &stable_targets,
    };
    nearest_interval_adjustment(current_interval, preferred_targets)
}

fn stable_cadence_targets(chord_intervals: &[i32], voice: &str) -> Vec<i32> {
    let mut targets = vec![0];
    for interval in chord_intervals.iter().copied() {
        if !targets.contains(&interval) {
            targets.push(interval);
        }
    }
    if voice == "pluck" {
        let upper: Vec<i32> = targets.iter().map(|value| value + 12).collect();
        targets.extend(upper);
    }
    targets
}

fn guide_cadence_targets(chord_intervals: &[i32], voice: &str) -> Vec<i32> {
    let third = if chord_intervals.contains(&3) { 3 } else { 4 };
    let seventh = if chord_intervals.contains(&10) {
        10
    } else if chord_intervals.contains(&11) {
        11
    } else if third == 3 {
        10
    } else {
        11
    };
    let mut targets = vec![third, seventh, 2, 9];
    if voice == "pluck" || voice == "lead" {
        targets.push(third + 12);
    }
    targets.sort_unstable();
    targets.dedup();
    targets
}

fn nearest_interval_adjustment(current_interval: i32, targets: &[i32]) -> f32 {
    let mut best = 0_i32;
    let mut best_abs = i32::MAX;
    for target in targets {
        for octave in -1..=1 {
            let candidate = *target + octave * 12;
            let delta = candidate - current_interval;
            let delta_abs = delta.abs();
            if delta_abs < best_abs {
                best = delta;
                best_abs = delta_abs;
            }
        }
    }
    (best.clamp(-2, 2)) as f32
}

fn token_reply_harmony_space_profile(
    segment: &PhraseSegment,
    pitch: &TokenReplyPitchProfile,
) -> TokenReplyHarmonySpaceProfile {
    let cadence = cadence_intent_label(segment);
    let role = phrase_role_label(segment);
    let reply_motion = pitch
        .counter_semitone_offset
        .abs()
        .max(pitch.pluck_semitone_offset.abs())
        .max(pitch.lead_semitone_offset.abs())
        .clamp(0.0, 1.2);
    let settle_bias: f32 = match cadence {
        "authentic" | "resolved" => 1.0,
        "plagal" => 0.82,
        "half" => 0.38,
        "deceptive" | "open" => 0.18,
        _ => 0.24,
    };
    let guide_bias: f32 = match cadence {
        "half" => 0.74,
        "deceptive" => 0.62,
        "open" => 0.56,
        "authentic" | "resolved" => 0.18,
        "plagal" => 0.22,
        _ => 0.28,
    };
    let role_bias: f32 = match role {
        "resolve" | "release" => 1.0,
        "response" => 0.72,
        "lift" => 0.54,
        "setup" => 0.44,
        _ => 0.48,
    };
    let stable_space = reply_motion * settle_bias * role_bias;
    let guide_space = reply_motion * guide_bias * role_bias;

    TokenReplyHarmonySpaceProfile {
        bass_duck: (1.0 - stable_space * 0.16 - guide_space * 0.04).clamp(0.82, 1.0),
        sub_duck: (1.0 - stable_space * 0.12 - guide_space * 0.03).clamp(0.86, 1.0),
        pad_duck: (1.0 - stable_space * 0.1 - guide_space * 0.12).clamp(0.8, 1.0),
        strings_duck: (1.0 - stable_space * 0.04 - guide_space * 0.1).clamp(0.84, 1.0),
        strings_settle_gain: (1.0 + stable_space * 0.12 - guide_space * 0.04).clamp(0.96, 1.14),
    }
}

fn reply_harmony_window_profile(
    segment: &PhraseSegment,
    time_sec: f32,
    hints: &[VocalReplyHarmonyWindowHint],
) -> Option<TokenReplyHarmonySpaceProfile> {
    let segment_key = normalize_section_key(&segment.section);
    let role = phrase_role_label(segment);
    let cadence = cadence_intent_label(segment);
    hints.iter().find_map(|hint| {
        if let Some(section) = hint.section.as_deref() {
            if normalize_section_key(section) != segment_key {
                return None;
            }
        }
        if let Some(hint_role) = hint.role.as_deref() {
            if hint_role != role {
                return None;
            }
        }
        if let Some(hint_cadence) = hint.cadence.as_deref() {
            if hint_cadence != cadence {
                return None;
            }
        }
        let end = hint.start_sec + hint.duration_sec;
        if time_sec < hint.start_sec || time_sec > end {
            return None;
        }
        let pos = ((time_sec - hint.start_sec) / hint.duration_sec.max(0.001)).clamp(0.0, 1.0);
        let center = (1.0 - ((pos - 0.34).abs() / 0.34))
            .clamp(0.0, 1.0)
            .powf(1.15);
        let strength = (hint.strength * (0.58 + center * 0.42)).clamp(0.0, 1.0);
        Some(TokenReplyHarmonySpaceProfile {
            bass_duck: (1.0 - (1.0 - hint.bass_duck) * strength).clamp(0.0, 1.0),
            sub_duck: (1.0 - (1.0 - hint.sub_duck) * strength).clamp(0.0, 1.0),
            pad_duck: (1.0 - (1.0 - hint.pad_duck) * strength).clamp(0.0, 1.0),
            strings_duck: (1.0 - (1.0 - hint.strings_duck) * strength).clamp(0.0, 1.0),
            strings_settle_gain: (1.0 + (hint.strings_settle_gain - 1.0) * strength)
                .clamp(0.0, 2.0),
        })
    })
}

fn normalize_section_key(value: &str) -> String {
    value
        .split(':')
        .next()
        .unwrap_or(value)
        .trim()
        .to_ascii_lowercase()
}

#[derive(Debug, Clone)]
struct LyricEntry {
    t: Option<f32>,
    section: String,
    text: String,
    estimated_duration: f32,
}

const ENGINE_MAX_DURATION_S_F32: f32 = 31_536_000.0;

fn lyric_entries(lyrics_json: &Value) -> Vec<LyricEntry> {
    let mut entries = Vec::new();
    if let Some(lines) = lyrics_json.get("lines").and_then(|v| v.as_array()) {
        for line in lines {
            match line {
                Value::String(text) => {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() && !is_non_sung_meta_line(trimmed) {
                        entries.push(LyricEntry {
                            t: None,
                            section: "Verse".to_string(),
                            text: trimmed.to_string(),
                            estimated_duration: estimated_line_duration(trimmed),
                        });
                    }
                }
                Value::Object(map) => {
                    let text = map
                        .get("text")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .trim()
                        .to_string();
                    if !text.is_empty() && !is_non_sung_meta_line(&text) {
                        entries.push(LyricEntry {
                            t: map.get("t").and_then(|v| v.as_f64()).map(|v| v as f32),
                            section: map
                                .get("section")
                                .and_then(|v| v.as_str())
                                .map(str::trim)
                                .filter(|value| !value.is_empty())
                                .unwrap_or("Verse")
                                .to_string(),
                            estimated_duration: estimated_line_duration(&text),
                            text,
                        });
                    }
                }
                _ => {}
            }
        }
    }
    entries
}

fn is_non_sung_meta_line(text: &str) -> bool {
    let trimmed = text.trim();
    if trimmed.is_empty() {
        return true;
    }
    let is_bracket_only = trimmed.starts_with('[') && trimmed.ends_with(']');
    if is_bracket_only {
        return true;
    }
    let is_title_only = trimmed.starts_with('《') && trimmed.ends_with('》');
    if is_title_only {
        return true;
    }
    false
}

fn estimated_line_duration(text: &str) -> f32 {
    let char_count = text.chars().filter(|c| !c.is_whitespace()).count() as f32;
    (1.8 + char_count * 0.09).clamp(2.1, 6.8)
}

fn estimated_total_duration(entries: &[LyricEntry]) -> f32 {
    let sum: f32 = entries.iter().map(|entry| entry.estimated_duration).sum();
    sum.clamp(8.0, ENGINE_MAX_DURATION_S_F32)
}

#[derive(Debug, Clone)]
struct SectionEntry {
    section: String,
    start_sec: f32,
    duration_sec: f32,
    summary_text: String,
}

fn group_entries_by_section(entries: &[LyricEntry]) -> Vec<SectionEntry> {
    if entries.is_empty() {
        return Vec::new();
    }

    let mut grouped = Vec::new();
    let mut index = 0usize;
    let mut inferred_cursor = 0.0_f32;

    while index < entries.len() {
        let current = &entries[index];
        let section = current.section.clone();
        let start_index = index;
        let mut end_index = index;
        while end_index + 1 < entries.len() && entries[end_index + 1].section == section {
            end_index += 1;
        }
        let slice = &entries[start_index..=end_index];
        let start_sec = slice
            .first()
            .and_then(|entry| entry.t)
            .unwrap_or(inferred_cursor);
        let fallback_total = slice
            .iter()
            .map(|entry| entry.estimated_duration)
            .sum::<f32>()
            .max(3.6);
        let duration_sec =
            if let Some(next_t) = entries.get(end_index + 1).and_then(|entry| entry.t) {
                (next_t - start_sec).max(3.6)
            } else {
                let last_end = slice
                    .last()
                    .and_then(|entry| entry.t.map(|t| t + entry.estimated_duration))
                    .unwrap_or(start_sec + fallback_total);
                (last_end - start_sec).max(3.6)
            };
        let summary_text = slice
            .iter()
            .take(2)
            .map(|entry| entry.text.clone())
            .collect::<Vec<_>>()
            .join(" ");
        grouped.push(SectionEntry {
            section,
            start_sec,
            duration_sec,
            summary_text,
        });
        inferred_cursor = start_sec + duration_sec;
        index = end_index + 1;
    }

    grouped
}

fn detect_target_duration_s(commands: &Value, lyrics_json: &Value) -> f32 {
    let requested = commands
        .get("creative")
        .and_then(|v| v.get("duration_s"))
        .and_then(|v| v.as_f64())
        .or_else(|| {
            lyrics_json
                .get("creative")
                .and_then(|v| v.get("duration_s"))
                .and_then(|v| v.as_f64())
        });

    if let Some(requested) = requested {
        return (requested as f32).clamp(1.0, ENGINE_MAX_DURATION_S_F32);
    }

    let entries = lyric_entries(lyrics_json);
    if entries.is_empty() {
        return 96.0;
    }

    let timestamp_total = entries
        .iter()
        .filter_map(|entry| entry.t.map(|t| t + entry.estimated_duration))
        .fold(0.0_f32, f32::max);
    let estimated_total = estimated_total_duration(&entries);
    let section_bonus = detect_section_form(commands, lyrics_json).len() as f32 * 0.8;
    timestamp_total
        .max(estimated_total + section_bonus)
        .clamp(1.0, ENGINE_MAX_DURATION_S_F32)
}

fn align_segments_to_duration(
    mut segments: Vec<PhraseSegment>,
    target_duration_s: f32,
    preserve_timestamps: bool,
) -> Vec<PhraseSegment> {
    if segments.is_empty() {
        return segments;
    }
    if preserve_timestamps {
        extend_segments_to_target(&mut segments, target_duration_s);
        return segments;
    }

    let current_total = arrangement_total_duration(&segments).max(1.0);
    let ratio = (target_duration_s / current_total).clamp(0.75, 8.0);
    let mut cursor = 0.0_f32;
    for segment in &mut segments {
        segment.start_sec = cursor;
        segment.duration_sec = (segment.duration_sec * ratio).clamp(2.4, 22.0);
        cursor += segment.duration_sec;
    }
    extend_segments_to_target(&mut segments, target_duration_s);
    segments
}

fn extend_segments_to_target(segments: &mut Vec<PhraseSegment>, target_duration_s: f32) {
    let mut cursor = arrangement_total_duration(segments);
    if cursor >= target_duration_s {
        return;
    }
    let chorus_template = segments
        .iter()
        .rev()
        .find(|segment| segment.section.to_ascii_lowercase().contains("chorus"))
        .cloned()
        .unwrap_or_else(|| segments.last().cloned().expect("segments not empty"));

    while cursor < target_duration_s {
        let remaining = target_duration_s - cursor;
        let mut next = chorus_template.clone();
        next.start_sec = cursor;
        next.duration_sec = remaining.min(16.0).max(6.0);
        next.section = if remaining <= 16.0 {
            "Outro".to_string()
        } else {
            "Chorus Reprise".to_string()
        };
        if remaining <= 20.0 {
            next.energy = SegmentEnergy::Peak;
        }
        cursor += next.duration_sec;
        segments.push(next);
    }
}

fn arrangement_total_duration(segments: &[PhraseSegment]) -> f32 {
    segments
        .last()
        .map(|segment| segment.start_sec + segment.duration_sec)
        .unwrap_or(0.0)
}

fn arrangement_to_cues(
    segments: &[PhraseSegment],
    commands: &Value,
    lyrics_json: &Value,
    composition_layer: Option<&CompositionLayerPlan>,
) -> Vec<CueSegment> {
    let density = detect_arrangement_density(commands, lyrics_json);
    let dynamics_curve = detect_dynamics_curve(commands, lyrics_json);
    let section_form = detect_section_form(commands, lyrics_json);
    let articulation_bias = detect_articulation_bias(commands, lyrics_json);
    let mut bar_cursor = 1_u32;
    segments
        .iter()
        .enumerate()
        .map(|(index, segment)| {
            let bar_len_sec = bars_for_segment(segment);
            let bar_start = bar_cursor;
            let bar_end = bar_start + bar_len_sec.saturating_sub(1);
            bar_cursor = bar_end + 1;
            let composition_section = composition_layer.and_then(|plan| plan.sections.get(index));
            let contour = composition_section
                .and_then(|section| section.phrase_skeleton.rhythm_cells.first().cloned())
                .unwrap_or_else(|| contour_label(segment.energy, &dynamics_curve).to_string());
            let articulation = composition_section
                .map(composition_articulation_label)
                .unwrap_or_else(|| provider_articulation_label(segment, &articulation_bias));
            let chord_slots = composition_section
                .map(|section| {
                    section
                        .progression_frames
                        .iter()
                        .map(progression_frame_label)
                        .collect::<Vec<_>>()
                })
                .filter(|frames| !frames.is_empty())
                .unwrap_or_else(|| chord_slots_for_segment(segment));
            let note_density = composition_section
                .map(composition_note_density)
                .unwrap_or_else(|| note_density_for_segment(segment, density));
            CueSegment {
                start_sec: segment.start_sec,
                duration_sec: segment.duration_sec,
                section_name: resolve_section_name(
                    &segment.section,
                    section_form.get(index).map(String::as_str),
                ),
                energy: energy_label(segment.energy).to_string(),
                contour,
                articulation,
                root_hz: segment.root_hz,
                bar_start,
                bar_end,
                chord_slots,
                velocity_curve: velocity_curve_for_segment(segment, &dynamics_curve),
                note_density,
            }
        })
        .collect()
}

fn progression_frame_label(frame: &HarmonyProgressionFrame) -> String {
    format!("{}:{}", frame.numeral, frame.chord_target)
}

fn composition_note_density(section: &CompositionSectionPlan) -> f32 {
    let active_lane_count = section.stem_activations.len() as f32;
    let high_density_lanes = section
        .stem_activations
        .iter()
        .filter(|lane| matches!(lane.density.as_str(), "high" | "medium"))
        .count() as f32;
    (0.24 + active_lane_count * 0.04 + high_density_lanes * 0.08).clamp(0.25, 1.0)
}

fn composition_articulation_label(section: &CompositionSectionPlan) -> String {
    let lower = section.section.to_lowercase();
    if lower.contains("chorus") || lower.contains("reprise") {
        "marcato".to_string()
    } else if lower.contains("bridge") {
        "legato-accent".to_string()
    } else {
        "legato".to_string()
    }
}

fn apply_composition_stem_activation_plan(
    mut stems_plan: ProviderArrangementStemsPlan,
    composition_layer: &CompositionLayerPlan,
) -> ProviderArrangementStemsPlan {
    for stem in &mut stems_plan.stems {
        stem.parts.retain(|part| {
            composition_stem_part_active(
                part.role.as_str(),
                part.section_name.as_str(),
                part.bar_start,
                composition_layer,
            )
        });
        stem.phrase_count = stem.parts.len();
        if let Some(first) = stem.parts.first() {
            stem.bar_start = first.bar_start;
            stem.start_sec = first.start_sec;
        }
        if let Some(last) = stem.parts.last() {
            stem.bar_end = last.bar_end;
            stem.end_sec = last.end_sec;
        }
    }
    stems_plan.stems.retain(|stem| !stem.parts.is_empty());
    stems_plan
}

fn composition_stem_part_active(
    role: &str,
    section_name: &str,
    bar_start: u32,
    composition_layer: &CompositionLayerPlan,
) -> bool {
    let Some(section) = composition_layer
        .sections
        .iter()
        .find(|section| section.section.eq_ignore_ascii_case(section_name))
    else {
        return true;
    };
    let Some(lane) = section
        .stem_activations
        .iter()
        .find(|lane| lane.stem.eq_ignore_ascii_case(role))
    else {
        return true;
    };
    lane.active_bars.iter().any(|bar| *bar as u32 == bar_start)
}

fn detect_arrangement_density(commands: &Value, lyrics_json: &Value) -> f32 {
    (commands
        .get("creative")
        .and_then(|v| v.get("arrangement_density"))
        .and_then(|v| v.as_f64())
        .or_else(|| {
            lyrics_json
                .get("creative")
                .and_then(|v| v.get("arrangement_density"))
                .and_then(|v| v.as_f64())
        })
        .unwrap_or(0.6) as f32)
        .clamp(0.2, 1.0)
}

fn detect_dynamics_curve(commands: &Value, lyrics_json: &Value) -> String {
    commands
        .get("creative")
        .and_then(|v| v.get("dynamics_curve"))
        .and_then(|v| v.as_str())
        .or_else(|| {
            lyrics_json
                .get("creative")
                .and_then(|v| v.get("dynamics_curve"))
                .and_then(|v| v.as_str())
        })
        .unwrap_or("")
        .trim()
        .to_string()
}

fn detect_section_form(commands: &Value, lyrics_json: &Value) -> Vec<String> {
    commands
        .get("creative")
        .and_then(|v| v.get("section_form"))
        .and_then(|v| v.as_str())
        .or_else(|| {
            lyrics_json
                .get("creative")
                .and_then(|v| v.get("section_form"))
                .and_then(|v| v.as_str())
        })
        .unwrap_or("")
        .split(',')
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .map(|s| s.to_ascii_lowercase())
        .collect()
}

fn detect_articulation_bias(commands: &Value, lyrics_json: &Value) -> String {
    commands
        .get("creative")
        .and_then(|v| v.get("articulation_bias"))
        .and_then(|v| v.as_str())
        .or_else(|| {
            lyrics_json
                .get("creative")
                .and_then(|v| v.get("articulation_bias"))
                .and_then(|v| v.as_str())
        })
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase()
}

fn bars_for_segment(segment: &PhraseSegment) -> u32 {
    let beats = (segment.duration_sec * segment.tempo_bpm / 60.0).max(1.0);
    let bars = (beats / 4.0).round().max(1.0) as u32;
    bars.max(2)
}

fn chord_slots_for_segment(segment: &PhraseSegment) -> Vec<String> {
    segment
        .progression
        .iter()
        .map(|frame| roman_numeral_for_shift(frame.root_shift).to_string())
        .collect()
}

fn roman_numeral_for_shift(root_shift: i32) -> &'static str {
    match root_shift.rem_euclid(12) {
        0 => "I",
        2 => "II",
        3 => "IIIb",
        4 => "III",
        5 => "IV",
        7 => "V",
        8 => "VIb",
        9 => "VI",
        10 => "VIIb",
        11 => "VII",
        _ => "I",
    }
}

fn velocity_curve_for_segment(segment: &PhraseSegment, dynamics_curve: &str) -> Vec<u8> {
    let base = match segment.energy {
        SegmentEnergy::Low => 42_u8,
        SegmentEnergy::Medium => 58_u8,
        SegmentEnergy::High => 78_u8,
        SegmentEnergy::Peak => 94_u8,
    };
    let lift = match segment.style {
        ArrangementStyle::Piano => [0_u8, 6, 10, 14],
        ArrangementStyle::Strings => [4_u8, 10, 16, 20],
        ArrangementStyle::Synth => [8_u8, 14, 20, 24],
        ArrangementStyle::Guofeng => [2_u8, 8, 12, 18],
    };
    let curve_lift: u8 = if dynamics_curve.to_ascii_lowercase().contains("soft") {
        0
    } else if dynamics_curve.to_ascii_lowercase().contains("explosive")
        || dynamics_curve.to_ascii_lowercase().contains("impact")
    {
        12
    } else {
        4
    };
    lift.into_iter()
        .map(|step| {
            base.saturating_add(step)
                .saturating_add(curve_lift)
                .min(116)
        })
        .collect()
}

fn note_density_for_segment(segment: &PhraseSegment, arrangement_density: f32) -> f32 {
    let style_bias: f32 = match segment.style {
        ArrangementStyle::Piano => 0.08,
        ArrangementStyle::Strings => 0.14,
        ArrangementStyle::Synth => 0.22,
        ArrangementStyle::Guofeng => 0.12,
    };
    let energy_bias: f32 = match segment.energy {
        SegmentEnergy::Low => 0.22,
        SegmentEnergy::Medium => 0.44,
        SegmentEnergy::High => 0.68,
        SegmentEnergy::Peak => 0.86,
    };
    ((energy_bias + style_bias) * (0.65 + arrangement_density)).clamp(0.18, 1.0)
}

fn resolve_section_name(section: &str, override_name: Option<&str>) -> String {
    let lower = override_name.unwrap_or(section).to_ascii_lowercase();
    if lower.contains("pre-chorus") {
        "pre-chorus".to_string()
    } else if lower.contains("chorus") {
        "chorus".to_string()
    } else if lower.contains("bridge") {
        "bridge".to_string()
    } else if lower.contains("outro") || lower.contains("reprise") || lower.contains("final") {
        "outro".to_string()
    } else if lower.contains("intro") {
        "intro".to_string()
    } else {
        "verse".to_string()
    }
}

fn energy_label(energy: SegmentEnergy) -> &'static str {
    match energy {
        SegmentEnergy::Low => "low",
        SegmentEnergy::Medium => "medium",
        SegmentEnergy::High => "high",
        SegmentEnergy::Peak => "peak",
    }
}

fn contour_label(energy: SegmentEnergy, dynamics_curve: &str) -> &'static str {
    let lower = dynamics_curve.to_ascii_lowercase();
    if lower.contains("explosive") || lower.contains("impact") {
        return "climactic";
    }
    if lower.contains("rise") || lower.contains("arc") {
        return "rising";
    }
    if lower.contains("pulse") {
        return "driving";
    }
    match energy {
        SegmentEnergy::Low => "rising",
        SegmentEnergy::Medium => "flowing",
        SegmentEnergy::High => "wide",
        SegmentEnergy::Peak => "climactic",
    }
}

fn provider_articulation_label(segment: &PhraseSegment, articulation_bias: &str) -> String {
    if articulation_bias.contains("pizz") {
        return match segment.adapter_hint {
            ExternalAdapterHint::Kontakt => "pizzicato-pluck".to_string(),
            ExternalAdapterHint::Spitfire | ExternalAdapterHint::EastWest => {
                "pizzicato".to_string()
            }
            ExternalAdapterHint::Custom => "custom-pizzicato".to_string(),
            ExternalAdapterHint::Internal => "pizzicato".to_string(),
        };
    }
    if articulation_bias.contains("stacc") {
        return match segment.adapter_hint {
            ExternalAdapterHint::Kontakt => "tight-staccato".to_string(),
            ExternalAdapterHint::Spitfire => "short-spiccato".to_string(),
            ExternalAdapterHint::EastWest => "marc-staccato".to_string(),
            ExternalAdapterHint::Custom => "custom-staccato".to_string(),
            ExternalAdapterHint::Internal => "staccato".to_string(),
        };
    }
    if articulation_bias.contains("sustain") {
        return match segment.adapter_hint {
            ExternalAdapterHint::Kontakt => "long-sustain".to_string(),
            ExternalAdapterHint::Spitfire => "long-sustain".to_string(),
            ExternalAdapterHint::EastWest => "sus-vib".to_string(),
            ExternalAdapterHint::Custom => "custom-sustain".to_string(),
            ExternalAdapterHint::Internal => "sustain".to_string(),
        };
    }
    match segment.adapter_hint {
        ExternalAdapterHint::Kontakt => match segment.energy {
            SegmentEnergy::Low | SegmentEnergy::Medium => "performance-legato".to_string(),
            SegmentEnergy::High => "tight-staccato".to_string(),
            SegmentEnergy::Peak => "long-sustain".to_string(),
        },
        ExternalAdapterHint::Spitfire => match segment.energy {
            SegmentEnergy::Low | SegmentEnergy::Medium => "long-legato".to_string(),
            SegmentEnergy::High => "short-spiccato".to_string(),
            SegmentEnergy::Peak => "long-sustain".to_string(),
        },
        ExternalAdapterHint::EastWest => match segment.energy {
            SegmentEnergy::Low | SegmentEnergy::Medium => "slur-legato".to_string(),
            SegmentEnergy::High => "marc-staccato".to_string(),
            SegmentEnergy::Peak => "sus-vib".to_string(),
        },
        ExternalAdapterHint::Custom => "custom-hybrid".to_string(),
        ExternalAdapterHint::Internal => segment
            .section
            .to_ascii_lowercase()
            .contains("chorus")
            .then_some("staccato")
            .unwrap_or("legato")
            .to_string(),
    }
}

fn detect_energy(index: usize, total: usize, text: &str) -> SegmentEnergy {
    let lower = text.to_ascii_lowercase();
    if lower.contains("chorus 3")
        || lower.contains("chorus 4")
        || lower.contains("final")
        || index + 1 == total
    {
        SegmentEnergy::Peak
    } else if lower.contains("chorus") || lower.contains("drop") {
        SegmentEnergy::High
    } else if lower.contains("bridge") || lower.contains("pre-chorus") || lower.contains("rise") {
        SegmentEnergy::Medium
    } else if index == 0 {
        SegmentEnergy::Low
    } else {
        SegmentEnergy::Medium
    }
}

fn adjust_segment_energy(
    base: SegmentEnergy,
    section: &str,
    creative: CreativeMotionProfile,
) -> SegmentEnergy {
    let lower = section.to_ascii_lowercase();
    if creative.section_contrast + creative.theatrical_bias * 0.2 > 0.72 && lower.contains("chorus")
    {
        return SegmentEnergy::Peak;
    }
    if creative.dynamic_range + creative.ambience_depth.max(0.0) * 0.12 > 0.72
        && lower.contains("bridge")
    {
        return SegmentEnergy::High;
    }
    base
}

fn adjusted_root_hz(base: f32, section_key: &str, creative: CreativeMotionProfile) -> f32 {
    let lift = match (creative.melodic_contour, section_key) {
        (MelodicContourMode::Ascending, key) if key.contains("chorus") => 1.1225,
        (MelodicContourMode::Ascending, key) if key.contains("bridge") => 1.0594,
        (MelodicContourMode::Grounded, key) if key.contains("verse") || key.contains("intro") => {
            0.9439
        }
        (MelodicContourMode::Wave, key) if key.contains("bridge") => 1.0293,
        _ => 1.0,
    };
    let instrumentation = if creative.instrumentation_bias < -0.2 {
        0.9715
    } else if creative.instrumentation_bias > 0.2 {
        1.0293
    } else {
        1.0
    };
    base * lift * instrumentation
}

fn detect_arrangement_style(commands: &Value, lyrics_json: &Value) -> ArrangementStyle {
    let creative = commands
        .get("creative")
        .or_else(|| lyrics_json.get("creative"))
        .cloned()
        .unwrap_or(Value::Null);
    let blob = [
        creative
            .get("instrument")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
        creative.get("genre").and_then(|v| v.as_str()).unwrap_or(""),
        creative.get("mood").and_then(|v| v.as_str()).unwrap_or(""),
        creative
            .get("ambience")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
        creative
            .get("instrumentation")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
        creative
            .get("ensemble_style")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
        creative
            .get("licensed_style_pack")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
        creative
            .get("inspiration_notes")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
        creative
            .get("prompt")
            .and_then(|v| v.as_str())
            .unwrap_or(""),
    ]
    .join(" ")
    .to_ascii_lowercase();

    if blob.contains("gufeng")
        || blob.contains("gu feng")
        || blob.contains("guzheng")
        || blob.contains("erhu")
        || blob.contains("pipa")
        || blob.contains("dizi")
        || blob.contains("chinese")
    {
        ArrangementStyle::Guofeng
    } else if blob.contains("orchestra")
        || blob.contains("orchestral")
        || blob.contains("strings")
        || blob.contains("cinematic")
        || blob.contains("symph")
    {
        ArrangementStyle::Strings
    } else if blob.contains("synth")
        || blob.contains("electro")
        || blob.contains("electronic")
        || blob.contains("edm")
        || blob.contains("hyperpop")
    {
        ArrangementStyle::Synth
    } else if blob.contains("piano") || blob.contains("ballad") || blob.contains("acoustic") {
        ArrangementStyle::Piano
    } else {
        ArrangementStyle::Synth
    }
}

fn detect_creative_motion_profile(commands: &Value, lyrics_json: &Value) -> CreativeMotionProfile {
    let creative = commands
        .get("creative")
        .or_else(|| lyrics_json.get("creative"))
        .cloned()
        .unwrap_or(Value::Null);
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
    CreativeMotionProfile {
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
        instrumentation_bias: if instrumentation_blob.contains("guzheng")
            || instrumentation_blob.contains("erhu")
            || instrumentation_blob.contains("pipa")
        {
            -0.35
        } else if instrumentation_blob.contains("strings")
            || instrumentation_blob.contains("orchestra")
            || instrumentation_blob.contains("symph")
        {
            0.26
        } else if instrumentation_blob.contains("synth") || instrumentation_blob.contains("electro")
        {
            0.16
        } else {
            0.0
        },
        ambience_depth: if ambience_blob.contains("cathedral") || ambience_blob.contains("hall") {
            1.0
        } else if ambience_blob.contains("mist") || ambience_blob.contains("smoke") {
            0.72
        } else if ambience_blob.contains("dry") || ambience_blob.contains("close") {
            -0.4
        } else {
            0.12
        },
        theatrical_bias: if dynamic_blob.contains("theatrical")
            || section_blob.contains("opera")
            || ambience_blob.contains("cathedral")
        {
            0.82
        } else {
            0.22
        },
    }
}

fn external_adapter_hint_from_plan(plan: &ProviderPlan) -> ExternalAdapterHint {
    match plan.vendor {
        ProviderVendor::Internal => ExternalAdapterHint::Internal,
        ProviderVendor::Kontakt => ExternalAdapterHint::Kontakt,
        ProviderVendor::Spitfire => ExternalAdapterHint::Spitfire,
        ProviderVendor::Eastwest => ExternalAdapterHint::EastWest,
        ProviderVendor::Custom => ExternalAdapterHint::Custom,
    }
}

fn detect_tempo_bpm(commands: &Value, lyrics_json: &Value) -> f32 {
    commands
        .get("creative")
        .and_then(|v| v.get("tempo_bpm"))
        .and_then(|v| v.as_f64())
        .or_else(|| {
            lyrics_json
                .get("creative")
                .and_then(|v| v.get("tempo_bpm"))
                .and_then(|v| v.as_f64())
        })
        .map(|v| v as f32)
        .unwrap_or(88.0)
        .clamp(54.0, 168.0)
}

fn tempo_for_segment(base_tempo: f32, energy: SegmentEnergy) -> f32 {
    let lift = match energy {
        SegmentEnergy::Low => -10.0,
        SegmentEnergy::Medium => 0.0,
        SegmentEnergy::High => 10.0,
        SegmentEnergy::Peak => 16.0,
    };
    (base_tempo + lift).clamp(54.0, 176.0)
}

fn counter_pattern_for_section(section: &str, style: ArrangementStyle) -> &'static [i32] {
    let lower = section.to_ascii_lowercase();
    if lower.contains("chorus") {
        match style {
            ArrangementStyle::Piano => &[12, 9, 7, 9, 12, 14, 12, 9],
            ArrangementStyle::Strings => &[7, 9, 11, 12, 11, 9, 7, 5],
            ArrangementStyle::Synth => &[12, 7, 14, 11, 12, 16, 14, 11],
            ArrangementStyle::Guofeng => &[7, 10, 12, 10, 14, 12, 10, 7],
        }
    } else if lower.contains("bridge") {
        &[5, 8, 10, 8, 7, 5, 3, 5]
    } else {
        match style {
            ArrangementStyle::Piano => &[4, 7, 9, 7, 5, 4],
            ArrangementStyle::Strings => &[7, 5, 4, 5, 7, 9],
            ArrangementStyle::Synth => &[7, 11, 9, 7, 5, 4],
            ArrangementStyle::Guofeng => &[5, 7, 10, 7, 5, 2],
        }
    }
}

struct RenderedStems {
    pad: Vec<u8>,
    lead: Vec<u8>,
    bass: Vec<u8>,
    drums: Vec<u8>,
    fx: Vec<u8>,
    strings: Vec<u8>,
    plucks: Vec<u8>,
    counter: Vec<u8>,
    sub: Vec<u8>,
    percussion: Vec<u8>,
    impacts: Vec<u8>,
    choir: Vec<u8>,
}

struct RenderedArrangementBundle {
    mix: Vec<u8>,
    stems: RenderedStems,
}

#[derive(Clone, Copy)]
struct VocalSpaceProfile {
    strings_duck: f32,
    pluck_duck: f32,
    counter_duck: f32,
}

#[derive(Clone, Copy)]
struct VocalHitSpaceProfile {
    pluck_hit_gate: f32,
    percussion_hit_gate: f32,
    counter_hit_gate: f32,
}

#[derive(Clone, Copy)]
struct VocalHarmonySpaceProfile {
    bass_duck: f32,
    sub_duck: f32,
    pad_duck: f32,
    chord_motion_hold: f32,
    bass_root_hold: f32,
    harmonic_density: f32,
}

#[derive(Clone, Copy)]
struct PhraseEndCadenceProfile {
    target_chord_index: usize,
    chord_settle: f32,
    bass_settle: f32,
    density_scale: f32,
    strings_settle_gain: f32,
    choir_settle_gain: f32,
    atmosphere_settle_gain: f32,
    shimmer_trim: f32,
}

#[derive(Debug, Clone, Copy)]
struct GuofengTailReleaseProfile {
    pluck_gate: f32,
    counter_gate: f32,
    frame_tail: f32,
}

#[derive(Debug, Clone, Copy)]
struct PhraseBreathProfile {
    pluck_gate: f32,
    counter_gate: f32,
    percussion_gate: f32,
    counter_fill_gain: f32,
}

#[derive(Debug, Clone, Copy)]
struct LaneBreathProfile {
    bass_emphasis: f32,
    kick_gate: f32,
    wood_gate: f32,
    frame_gate: f32,
    shaker_gate: f32,
    wood_role_gain: f32,
    frame_role_gain: f32,
    shaker_role_gain: f32,
}

#[derive(Debug, Clone, Copy)]
struct TokenReplyRoutingProfile {
    pluck_reply_gain: f32,
    counter_reply_gain: f32,
    lead_gap_fill_gain: f32,
}

#[derive(Debug, Clone, Copy)]
struct TokenReplyPitchProfile {
    counter_semitone_offset: f32,
    pluck_semitone_offset: f32,
    lead_semitone_offset: f32,
}

#[derive(Debug, Clone, Copy)]
struct TokenReplyHarmonySpaceProfile {
    bass_duck: f32,
    sub_duck: f32,
    pad_duck: f32,
    strings_duck: f32,
    strings_settle_gain: f32,
}

fn render_arrangement_bundle(
    segments: &[PhraseSegment],
    vocal_plan_hints: &VocalPlanHints,
) -> RenderedArrangementBundle {
    let total_duration = arrangement_total_duration(segments).max(8.0) + 0.8;
    let total_frames = (total_duration * SAMPLE_RATE as f32).ceil() as usize;
    let mut bundle = StemRenderBundle::new(total_frames);

    for segment in segments {
        render_segment(segment, &mut bundle, vocal_plan_hints);
    }

    apply_master_glue(&mut bundle.mix.left, &mut bundle.mix.right);
    apply_master_reverb(&mut bundle.mix.left, &mut bundle.mix.right);
    apply_master_reverb(&mut bundle.pad.left, &mut bundle.pad.right);
    apply_master_reverb(&mut bundle.fx.left, &mut bundle.fx.right);
    apply_master_reverb(&mut bundle.strings.left, &mut bundle.strings.right);
    apply_master_reverb(&mut bundle.choir.left, &mut bundle.choir.right);
    normalize_stereo_peak(&mut bundle.mix.left, &mut bundle.mix.right, 0.94);
    normalize_stereo_peak(&mut bundle.pad.left, &mut bundle.pad.right, 0.86);
    normalize_stereo_peak(&mut bundle.lead.left, &mut bundle.lead.right, 0.86);
    normalize_stereo_peak(&mut bundle.bass.left, &mut bundle.bass.right, 0.88);
    normalize_stereo_peak(&mut bundle.drums.left, &mut bundle.drums.right, 0.9);
    normalize_stereo_peak(&mut bundle.fx.left, &mut bundle.fx.right, 0.82);
    normalize_stereo_peak(&mut bundle.strings.left, &mut bundle.strings.right, 0.84);
    normalize_stereo_peak(&mut bundle.plucks.left, &mut bundle.plucks.right, 0.82);
    normalize_stereo_peak(&mut bundle.counter.left, &mut bundle.counter.right, 0.82);
    normalize_stereo_peak(&mut bundle.sub.left, &mut bundle.sub.right, 0.92);
    normalize_stereo_peak(
        &mut bundle.percussion.left,
        &mut bundle.percussion.right,
        0.82,
    );
    normalize_stereo_peak(&mut bundle.impacts.left, &mut bundle.impacts.right, 0.86);
    normalize_stereo_peak(&mut bundle.choir.left, &mut bundle.choir.right, 0.8);

    RenderedArrangementBundle {
        mix: interleaved_wav(&bundle.mix.left, &bundle.mix.right, SAMPLE_RATE),
        stems: RenderedStems {
            pad: interleaved_wav(&bundle.pad.left, &bundle.pad.right, SAMPLE_RATE),
            lead: interleaved_wav(&bundle.lead.left, &bundle.lead.right, SAMPLE_RATE),
            bass: interleaved_wav(&bundle.bass.left, &bundle.bass.right, SAMPLE_RATE),
            drums: interleaved_wav(&bundle.drums.left, &bundle.drums.right, SAMPLE_RATE),
            fx: interleaved_wav(&bundle.fx.left, &bundle.fx.right, SAMPLE_RATE),
            strings: interleaved_wav(&bundle.strings.left, &bundle.strings.right, SAMPLE_RATE),
            plucks: interleaved_wav(&bundle.plucks.left, &bundle.plucks.right, SAMPLE_RATE),
            counter: interleaved_wav(&bundle.counter.left, &bundle.counter.right, SAMPLE_RATE),
            sub: interleaved_wav(&bundle.sub.left, &bundle.sub.right, SAMPLE_RATE),
            percussion: interleaved_wav(
                &bundle.percussion.left,
                &bundle.percussion.right,
                SAMPLE_RATE,
            ),
            impacts: interleaved_wav(&bundle.impacts.left, &bundle.impacts.right, SAMPLE_RATE),
            choir: interleaved_wav(&bundle.choir.left, &bundle.choir.right, SAMPLE_RATE),
        },
    }
}

fn render_arrangement_wav(segments: &[PhraseSegment]) -> Vec<u8> {
    render_arrangement_bundle(segments, &VocalPlanHints::default()).mix
}

fn render_segment(
    segment: &PhraseSegment,
    bundle: &mut StemRenderBundle,
    vocal_plan_hints: &VocalPlanHints,
) {
    let start_frame = (segment.start_sec * SAMPLE_RATE as f32).floor() as usize;
    let frame_count = (segment.duration_sec * SAMPLE_RATE as f32).ceil() as usize;
    let beat_hz = segment.tempo_bpm / 60.0;
    let beat_period = 1.0 / beat_hz.max(0.5);
    let subdivisions = subdivision_count(segment);
    let note_duration = segment.duration_sec / subdivisions as f32;
    let lead_pattern = lead_pattern(segment);
    let style_profile = style_profile(segment.style, segment.energy, segment.adapter_hint);
    let arrangement_motion = arrangement_motion_profile(segment);
    let section_roles = section_role_profile(segment);
    let phrase_roles = phrase_role_profile(segment);
    let chord_span = (segment.duration_sec / segment.progression.len().max(1) as f32).max(0.6);

    for frame_offset in 0..frame_count {
        let idx = start_frame + frame_offset;
        if idx >= bundle.mix.left.len() || idx >= bundle.mix.right.len() {
            break;
        }

        let local_t = frame_offset as f32 / SAMPLE_RATE as f32;
        let time_sec = segment.start_sec + local_t;
        let focus_strength = vocal_focus_strength_at_time(time_sec, &vocal_plan_hints.focus_events);
        let anchor_strength =
            cadence_anchor_strength_at_time(time_sec, &vocal_plan_hints.cadence_anchors);
        let cadence_anchor =
            cadence_anchor_for_segment_time(segment, time_sec, &vocal_plan_hints.cadence_anchors);
        let vocal_space = vocal_space_profile(time_sec, &vocal_plan_hints.focus_events);
        let vocal_hit_space = vocal_hit_space_profile(time_sec, &vocal_plan_hints.focus_events);
        let vocal_harmony_space =
            vocal_harmony_space_profile(time_sec, &vocal_plan_hints.focus_events);
        let phrase_end_cadence = phrase_end_cadence_profile(
            segment,
            local_t,
            focus_strength.max(anchor_strength),
            cadence_anchor,
        );
        let phrase_breath = phrase_breath_profile(segment, local_t);
        let token_breath =
            token_focus_breath_profile(segment, time_sec, &vocal_plan_hints.focus_events);
        let lane_breath =
            token_focus_lane_breath_profile(segment, time_sec, &vocal_plan_hints.focus_events);
        let token_reply =
            token_focus_reply_routing_profile(segment, time_sec, &vocal_plan_hints.focus_events);
        let rhythm_motion = rhythm_motion_for_time(segment, local_t, beat_period);
        let rhythm_hits = rhythm_hit_profile_for_time(segment, local_t, beat_period);
        let mut rhythm_lanes = rhythm_lane_profile_for_time(segment, local_t, beat_period);
        rhythm_lanes.kick_gate *= lane_breath.kick_gate;
        rhythm_lanes.wood_gate *= lane_breath.wood_gate;
        rhythm_lanes.frame_gate *= lane_breath.frame_gate;
        rhythm_lanes.shaker_gate *= lane_breath.shaker_gate;
        rhythm_lanes.bass_emphasis *= lane_breath.bass_emphasis;
        rhythm_lanes.wood_gate *= lane_breath.wood_role_gain;
        rhythm_lanes.frame_gate *= lane_breath.frame_role_gain;
        rhythm_lanes.shaker_gate *= lane_breath.shaker_role_gain;
        let note_index = (local_t / note_duration).floor() as usize;
        let timing_profile = restatement_timing_profile(
            segment.melody_hint.as_ref(),
            note_index,
            subdivisions,
            note_duration,
            sustain_for_energy(segment.energy),
        );
        let effective_note_duration = (note_duration * timing_profile.duration_scale)
            .clamp(note_duration * 0.55, note_duration * 1.35);
        let note_t = (local_t + rhythm_motion.push_offset_sec + timing_profile.push_sec).max(0.0)
            % effective_note_duration;
        let note_progress = (note_t / effective_note_duration.max(0.001)).clamp(0.0, 1.0);
        let note_env = adsr(
            note_t,
            effective_note_duration,
            timing_profile.attack,
            timing_profile.decay,
            timing_profile.sustain,
            timing_profile.release,
        );
        let restatement_gate = restatement_gate_profile(
            segment.melody_hint.as_ref(),
            note_index,
            subdivisions,
            note_progress,
        );

        let held_chord_index = focus_held_chord_index(
            local_t,
            chord_span,
            segment.progression.len(),
            vocal_harmony_space.chord_motion_hold,
        );
        let held_bass_chord_index = focus_held_chord_index(
            local_t,
            chord_span,
            segment.progression.len(),
            vocal_harmony_space.bass_root_hold,
        );
        let chord_index = if phrase_end_cadence.chord_settle > 0.18 {
            phrase_end_cadence.target_chord_index
        } else {
            held_chord_index
        };
        let bass_chord_index = if phrase_end_cadence.bass_settle > 0.14 {
            select_bass_chord_index_for_step(
                segment,
                held_bass_chord_index,
                phrase_end_cadence.target_chord_index,
                note_index,
                subdivisions,
            )
        } else {
            select_bass_chord_index_for_step(
                segment,
                held_bass_chord_index,
                held_bass_chord_index,
                note_index,
                subdivisions,
            )
        };
        let chord_frame = segment.progression[chord_index];
        let bass_chord_frame = segment.progression[bass_chord_index];
        let chord_root = segment.root_hz * 2.0_f32.powf(chord_frame.root_shift as f32 / 12.0);
        let bass_root = segment.root_hz * 2.0_f32.powf(bass_chord_frame.root_shift as f32 / 12.0);
        let guofeng_tail_release =
            guofeng_tail_release_profile(segment, local_t, &phrase_end_cadence);
        let lead_degree =
            select_lead_degree_for_step(segment, &lead_pattern, note_index, subdivisions);
        let melody_support = melody_support_profile(segment, note_index, subdivisions);
        let counterline_motion =
            counterline_motion_profile(segment, note_index, note_duration, subdivisions);
        let counter_interval = select_counter_interval_for_step(
            segment,
            &chord_frame,
            lead_degree,
            note_index,
            note_duration,
            subdivisions,
        );
        let pluck_pulse = note_duration.max(0.08) * 0.5;
        let pluck_note_index = (local_t / pluck_pulse).floor() as usize;
        let pluck_interval = select_pluck_interval_for_step(
            segment,
            &chord_frame,
            &lead_pattern,
            pluck_note_index,
            subdivisions.saturating_mul(2),
        );
        let counter_local_t = (local_t + counterline_motion.counter_push_sec).max(0.0);
        let pluck_local_t = (local_t + counterline_motion.pluck_push_sec).max(0.0);
        let token_reply_pitch = token_focus_reply_pitch_profile(
            segment,
            time_sec,
            &vocal_plan_hints.focus_events,
            &chord_frame,
            lead_degree,
            counter_interval,
            pluck_interval,
        );
        let token_reply_harmony = reply_harmony_window_profile(
            segment,
            time_sec,
            &vocal_plan_hints.reply_harmony_windows,
        )
        .unwrap_or_else(|| token_reply_harmony_space_profile(segment, &token_reply_pitch));
        let lead_freq = chord_root
            * 2.0_f32.powf((lead_degree as f32 + token_reply_pitch.lead_semitone_offset) / 12.0);
        let lead = lead_voice(lead_freq, note_t, note_env, segment.energy)
            * token_reply.lead_gap_fill_gain
            * restatement_gate.lead_gate
            * restatement_gate.lead_gain;
        let counter = counter_voice(
            chord_root,
            segment.counter_pattern,
            counter_local_t,
            note_duration,
            segment.energy,
            segment.style,
            guofeng_tail_release.counter_gate,
            token_reply_pitch.counter_semitone_offset,
        ) * vocal_hit_space.counter_hit_gate
            * counterline_motion.counter_step_gate
            * phrase_breath.counter_gate.min(token_breath.counter_gate)
            * phrase_breath
                .counter_fill_gain
                .max(token_breath.counter_fill_gain)
            * token_reply.counter_reply_gain
            * melody_support.counter_gain
            * restatement_gate.counter_duck;
        let chord = pad_voice(
            chord_root,
            chord_frame.intervals,
            local_t,
            segment.energy,
            segment.style,
            vocal_harmony_space.harmonic_density * phrase_end_cadence.density_scale,
        ) * vocal_harmony_space.pad_duck
            * token_reply_harmony.pad_duck
            * melody_support.pad_duck;
        let strings = strings_voice(
            chord_root,
            chord_frame.intervals,
            local_t,
            segment.energy,
            segment.style,
            phrase_end_cadence.chord_settle,
        ) * token_reply_harmony.strings_duck
            * token_reply_harmony.strings_settle_gain
            * melody_support.strings_gain;
        let plucks = pluck_voice(
            chord_root,
            &lead_pattern,
            pluck_local_t,
            note_duration,
            segment.energy,
            segment.style,
            guofeng_tail_release.pluck_gate,
            token_reply_pitch.pluck_semitone_offset,
        ) * rhythm_hits.pluck_gate
            * counterline_motion.pluck_step_gate
            * phrase_breath.pluck_gate.min(token_breath.pluck_gate)
            * vocal_hit_space.pluck_hit_gate
            * rhythm_hits.pluck_emphasis
            * token_reply.pluck_reply_gain
            * melody_support.pluck_gain
            * restatement_gate.pluck_duck;
        let bass = bass_voice(
            bass_root,
            local_t + rhythm_motion.push_offset_sec * 0.4,
            beat_period,
            segment.energy,
            segment.style,
            phrase_end_cadence.bass_settle,
        ) * rhythm_lanes.bass_gate
            * vocal_harmony_space.bass_duck
            * token_reply_harmony.bass_duck
            * rhythm_lanes.bass_emphasis
            * melody_support.bass_duck
            * restatement_gate.bass_duck;
        let sub = sub_bass_voice(
            bass_root,
            local_t + rhythm_motion.push_offset_sec * 0.25,
            beat_period,
            segment.energy,
            segment.style,
            phrase_end_cadence.bass_settle,
        ) * rhythm_lanes.bass_gate
            * vocal_harmony_space.sub_duck
            * token_reply_harmony.sub_duck
            * (0.92 + rhythm_lanes.bass_emphasis * 0.1)
            * melody_support.bass_duck
            * restatement_gate.bass_duck;
        let drum = drum_voice(
            local_t,
            beat_period,
            segment.energy,
            segment.style,
            &rhythm_lanes,
        ) * rhythm_motion.accent_gain
            * rhythm_hits.drum_gate
            * restatement_gate.percussion_duck;
        let percussion = percussion_voice(
            local_t,
            beat_period,
            segment.energy,
            segment.style,
            &rhythm_lanes,
            guofeng_tail_release.frame_tail,
        ) * rhythm_motion.percussion_gain
            * vocal_hit_space.percussion_hit_gate
            * phrase_breath
                .percussion_gate
                .min(token_breath.percussion_gate)
            * rhythm_hits.percussion_gate
            * melody_support.percussion_gate
            * restatement_gate.percussion_duck;
        let shimmer = atmosphere_tail_voice(
            lead_freq,
            note_t,
            note_env,
            segment.energy,
            segment.style,
            phrase_end_cadence.chord_settle,
        );
        let choir = choir_voice(
            chord_root,
            chord_frame.intervals,
            local_t,
            segment.energy,
            segment.style,
            phrase_end_cadence.chord_settle,
        );
        let impact = impact_voice(
            local_t,
            beat_period,
            segment.energy,
            segment.style,
            phrase_end_cadence.chord_settle,
        ) * rhythm_lanes.impact_gate;

        let stereo_sway = ((segment.start_sec + local_t) * 0.41).sin() * 0.12;
        let strings_l = strings
            * style_profile.strings_gain
            * arrangement_motion.strings_gain
            * section_roles.strings_gain
            * phrase_roles.strings_gain
            * phrase_end_cadence.strings_settle_gain
            * vocal_space.strings_duck;
        let strings_r = strings
            * (style_profile.strings_gain
                * arrangement_motion.strings_gain
                * section_roles.strings_gain
                * phrase_roles.strings_gain
                * phrase_end_cadence.strings_settle_gain
                * vocal_space.strings_duck
                * 0.94);
        let plucks_l = plucks
            * style_profile.pluck_gain
            * arrangement_motion.pluck_gain
            * section_roles.pluck_gain
            * phrase_roles.pluck_gain
            * vocal_space.pluck_duck;
        let plucks_r = plucks
            * (style_profile.pluck_gain
                * arrangement_motion.pluck_gain
                * section_roles.pluck_gain
                * phrase_roles.pluck_gain
                * vocal_space.pluck_duck
                * 0.9);
        let pad_l = (chord * style_profile.pad_gain) + strings_l * 0.36 + plucks_l * 0.22;
        let pad_r = (chord * (style_profile.pad_gain * 0.92)) + strings_r * 0.34 + plucks_r * 0.18;
        let counter_l = counter
            * style_profile.counter_lane_gain
            * section_roles.counter_gain
            * phrase_roles.counter_gain
            * vocal_space.counter_duck;
        let counter_r = counter
            * (style_profile.counter_lane_gain
                * section_roles.counter_gain
                * phrase_roles.counter_gain
                * vocal_space.counter_duck
                * 1.04);
        let lead_total = lead
            * (style_profile.lead_gain
                * rhythm_motion.lead_gain
                * section_roles.lead_gain
                * phrase_roles.lead_gain)
            + counter
                * style_profile.counter_gain
                * section_roles.counter_gain
                * phrase_roles.counter_gain
                * vocal_space.counter_duck
                * 0.76
            + plucks * 0.08;
        let lead_l = lead_total;
        let lead_r = lead
            * (style_profile.lead_gain * section_roles.lead_gain * phrase_roles.lead_gain * 0.94)
            + counter
                * (style_profile.counter_gain
                    * section_roles.counter_gain
                    * phrase_roles.counter_gain
                    * vocal_space.counter_duck
                    * 0.82)
            + plucks * 0.06;
        let bass_l =
            bass * style_profile.bass_gain * section_roles.bass_gain * phrase_roles.bass_gain;
        let bass_r = bass
            * (style_profile.bass_gain * section_roles.bass_gain * phrase_roles.bass_gain * 0.92);
        let sub_l = sub * style_profile.sub_gain * section_roles.bass_gain * phrase_roles.bass_gain;
        let sub_r = sub
            * (style_profile.sub_gain * section_roles.bass_gain * phrase_roles.bass_gain * 0.94);
        let impact_l = impact * style_profile.impact_gain * (0.8 - stereo_sway * 0.6);
        let impact_r = impact * style_profile.impact_gain * (0.76 + stereo_sway * 0.6);
        let perc_l = percussion
            * style_profile.percussion_gain
            * arrangement_motion.percussion_gain
            * section_roles.percussion_gain
            * phrase_roles.percussion_gain
            * (0.82 - stereo_sway);
        let perc_r = percussion
            * style_profile.percussion_gain
            * arrangement_motion.percussion_gain
            * section_roles.percussion_gain
            * phrase_roles.percussion_gain
            * (0.78 + stereo_sway);
        let drum_l = drum * style_profile.drum_gain * (0.84 - stereo_sway) + impact_l * 0.46;
        let drum_r = drum * style_profile.drum_gain * (0.72 + stereo_sway) + impact_r * 0.42;
        let choir_l = choir
            * style_profile.choir_gain
            * arrangement_motion.choir_gain
            * section_roles.choir_gain
            * phrase_roles.choir_gain
            * phrase_end_cadence.choir_settle_gain;
        let choir_r = choir
            * (style_profile.choir_gain
                * arrangement_motion.choir_gain
                * section_roles.choir_gain
                * phrase_roles.choir_gain
                * phrase_end_cadence.choir_settle_gain
                * 1.06);
        let fx_l = (shimmer
            * arrangement_motion.atmosphere_gain
            * section_roles.atmosphere_gain
            * phrase_roles.atmosphere_gain
            * phrase_end_cadence.atmosphere_settle_gain
            + choir
                * 0.42
                * arrangement_motion.choir_gain
                * section_roles.choir_gain
                * phrase_roles.choir_gain
                * phrase_end_cadence.choir_settle_gain
            + impact * 0.12)
            * style_profile.shimmer_gain
            * phrase_end_cadence.shimmer_trim;
        let fx_r = (shimmer
            * 1.2
            * arrangement_motion.atmosphere_gain
            * section_roles.atmosphere_gain
            * phrase_roles.atmosphere_gain
            * phrase_end_cadence.atmosphere_settle_gain
            + choir
                * 0.5
                * arrangement_motion.choir_gain
                * section_roles.choir_gain
                * phrase_roles.choir_gain
                * phrase_end_cadence.choir_settle_gain
            + impact * 0.16)
            * style_profile.shimmer_gain
            * phrase_end_cadence.shimmer_trim;

        bundle.pad.add(idx, pad_l, pad_r);
        bundle.lead.add(idx, lead_l, lead_r);
        bundle
            .bass
            .add(idx, bass_l + sub_l * 0.22, bass_r + sub_r * 0.22);
        bundle.drums.add(idx, drum_l, drum_r);
        bundle.fx.add(idx, fx_l, fx_r);
        bundle.strings.add(idx, strings_l, strings_r);
        bundle.plucks.add(idx, plucks_l, plucks_r);
        bundle.counter.add(idx, counter_l, counter_r);
        bundle.sub.add(idx, sub_l, sub_r);
        bundle.percussion.add(idx, perc_l, perc_r);
        bundle.impacts.add(idx, impact_l, impact_r);
        bundle.choir.add(idx, choir_l, choir_r);
        bundle.mix.add(
            idx,
            pad_l
                + strings_l
                + plucks_l
                + bass_l
                + sub_l
                + lead_l
                + counter_l
                + drum_l
                + perc_l
                + impact_l
                + choir_l
                + fx_l,
            pad_r
                + strings_r
                + plucks_r
                + bass_r
                + sub_r
                + lead_r
                + counter_r
                + drum_r
                + perc_r
                + impact_r
                + choir_r
                + fx_r,
        );
    }
}

struct ArrangementMotionProfile {
    strings_gain: f32,
    pluck_gain: f32,
    percussion_gain: f32,
    choir_gain: f32,
    atmosphere_gain: f32,
}

struct SectionRoleProfile {
    lead_gain: f32,
    counter_gain: f32,
    bass_gain: f32,
    strings_gain: f32,
    pluck_gain: f32,
    percussion_gain: f32,
    choir_gain: f32,
    atmosphere_gain: f32,
}

struct PhraseRoleProfile {
    lead_gain: f32,
    counter_gain: f32,
    bass_gain: f32,
    strings_gain: f32,
    pluck_gain: f32,
    percussion_gain: f32,
    choir_gain: f32,
    atmosphere_gain: f32,
}

struct MelodySupportProfile {
    counter_gain: f32,
    pluck_gain: f32,
    strings_gain: f32,
    pad_duck: f32,
    bass_duck: f32,
    percussion_gate: f32,
}

struct CounterlineMotionProfile {
    counter_step_gate: f32,
    pluck_step_gate: f32,
    counter_push_sec: f32,
    pluck_push_sec: f32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum CounterlineRhythmTemplate {
    LateEcho,
    OffbeatAnswer,
    StrongDouble,
    HookDouble,
    HookPickup,
    CadenceSuspension,
    RippleAnswer,
    Neutral,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum CounterlinePatternFamily {
    EchoTail,
    AnswerOffbeat,
    HookSupport,
    CadenceHold,
    Ripple,
    Neutral,
}

fn counterline_pattern_family(template: CounterlineRhythmTemplate) -> CounterlinePatternFamily {
    match template {
        CounterlineRhythmTemplate::LateEcho => CounterlinePatternFamily::EchoTail,
        CounterlineRhythmTemplate::OffbeatAnswer => CounterlinePatternFamily::AnswerOffbeat,
        CounterlineRhythmTemplate::StrongDouble
        | CounterlineRhythmTemplate::HookDouble
        | CounterlineRhythmTemplate::HookPickup => CounterlinePatternFamily::HookSupport,
        CounterlineRhythmTemplate::CadenceSuspension => CounterlinePatternFamily::CadenceHold,
        CounterlineRhythmTemplate::RippleAnswer => CounterlinePatternFamily::Ripple,
        CounterlineRhythmTemplate::Neutral => CounterlinePatternFamily::Neutral,
    }
}

fn counterline_template_pulse(
    template: CounterlineRhythmTemplate,
    cycle_pos: usize,
    cycle_steps: usize,
) -> f32 {
    if cycle_steps == 0 {
        return 1.0;
    }
    match template {
        CounterlineRhythmTemplate::LateEcho => {
            if cycle_pos >= cycle_steps.saturating_sub(1) {
                1.14
            } else if cycle_pos >= cycle_steps / 2 {
                0.9
            } else {
                0.48
            }
        }
        CounterlineRhythmTemplate::OffbeatAnswer => {
            if cycle_pos == cycle_steps.saturating_sub(1) {
                1.18
            } else if cycle_pos % 2 == 1 {
                1.0
            } else {
                0.62
            }
        }
        CounterlineRhythmTemplate::StrongDouble => {
            if cycle_pos == 0 {
                1.16
            } else {
                0.72
            }
        }
        CounterlineRhythmTemplate::HookDouble => {
            if cycle_pos == 0 {
                1.2
            } else if cycle_pos == cycle_steps.saturating_sub(1) {
                0.94
            } else {
                0.66
            }
        }
        CounterlineRhythmTemplate::HookPickup => {
            if cycle_pos == cycle_steps.saturating_sub(1) {
                1.22
            } else if cycle_pos % 2 == 1 {
                0.86
            } else {
                0.42
            }
        }
        CounterlineRhythmTemplate::CadenceSuspension => {
            if cycle_pos >= cycle_steps.saturating_sub(2) {
                1.12
            } else {
                0.52
            }
        }
        CounterlineRhythmTemplate::RippleAnswer => {
            if cycle_pos % 2 == 1 {
                0.96
            } else {
                0.7
            }
        }
        CounterlineRhythmTemplate::Neutral => 0.88,
    }
}

fn counterline_pattern_family_gate(
    family: CounterlinePatternFamily,
    cycle_pos: usize,
    cycle_steps: usize,
) -> f32 {
    if cycle_steps == 0 {
        return 1.0;
    }
    match family {
        CounterlinePatternFamily::EchoTail => {
            if cycle_pos >= cycle_steps.saturating_sub(1) {
                1.16
            } else if cycle_pos >= cycle_steps / 2 {
                0.84
            } else {
                0.42
            }
        }
        CounterlinePatternFamily::AnswerOffbeat => {
            if cycle_pos % 2 == 1 {
                1.12
            } else if cycle_pos >= cycle_steps.saturating_sub(2) {
                0.94
            } else {
                0.54
            }
        }
        CounterlinePatternFamily::HookSupport => {
            if cycle_pos == 0 || cycle_pos == cycle_steps.saturating_sub(1) {
                1.1
            } else if cycle_pos % 2 == 0 {
                0.72
            } else {
                0.9
            }
        }
        CounterlinePatternFamily::CadenceHold => {
            if cycle_pos >= cycle_steps.saturating_sub(2) {
                1.18
            } else if cycle_pos >= cycle_steps / 2 {
                0.68
            } else {
                0.34
            }
        }
        CounterlinePatternFamily::Ripple => {
            if cycle_pos % 2 == 1 {
                1.02
            } else {
                0.74
            }
        }
        CounterlinePatternFamily::Neutral => 0.9,
    }
}

fn counterline_pattern_family_cycle_steps(
    family: CounterlinePatternFamily,
    total_steps: usize,
) -> usize {
    let total = total_steps.max(1);
    match family {
        CounterlinePatternFamily::EchoTail | CounterlinePatternFamily::CadenceHold => {
            (total / 2).max(2)
        }
        CounterlinePatternFamily::AnswerOffbeat | CounterlinePatternFamily::Ripple => {
            (total / 4).max(2)
        }
        CounterlinePatternFamily::HookSupport => (total / 4).max(2),
        CounterlinePatternFamily::Neutral => (total / 2).max(2),
    }
}

fn counterline_pattern_family_cycle_position(
    family: CounterlinePatternFamily,
    note_index: usize,
    total_steps: usize,
) -> usize {
    let cycle = counterline_pattern_family_cycle_steps(family, total_steps).max(1);
    note_index % cycle
}

fn counterline_pattern_family_pulse(
    family: CounterlinePatternFamily,
    cycle_pos: usize,
    cycle_steps: usize,
) -> f32 {
    if cycle_steps == 0 {
        return 1.0;
    }
    match family {
        CounterlinePatternFamily::EchoTail => {
            if cycle_pos >= cycle_steps.saturating_sub(1) {
                1.14
            } else {
                0.56
            }
        }
        CounterlinePatternFamily::AnswerOffbeat => {
            if cycle_pos % 2 == 1 {
                1.08
            } else {
                0.62
            }
        }
        CounterlinePatternFamily::HookSupport => {
            if cycle_pos == 0 {
                1.16
            } else if cycle_pos == cycle_steps.saturating_sub(1) {
                0.96
            } else {
                0.74
            }
        }
        CounterlinePatternFamily::CadenceHold => {
            if cycle_pos >= cycle_steps.saturating_sub(2) {
                1.18
            } else {
                0.48
            }
        }
        CounterlinePatternFamily::Ripple => {
            if cycle_pos % 2 == 1 {
                1.02
            } else {
                0.82
            }
        }
        CounterlinePatternFamily::Neutral => 0.92,
    }
}

fn counterline_template_cycle_steps(
    template: CounterlineRhythmTemplate,
    total_steps: usize,
) -> usize {
    let total = total_steps.max(1);
    match template {
        CounterlineRhythmTemplate::LateEcho
        | CounterlineRhythmTemplate::OffbeatAnswer
        | CounterlineRhythmTemplate::CadenceSuspension => (total / 2).max(2),
        CounterlineRhythmTemplate::StrongDouble
        | CounterlineRhythmTemplate::HookDouble
        | CounterlineRhythmTemplate::HookPickup
        | CounterlineRhythmTemplate::RippleAnswer => (total / 4).max(2),
        CounterlineRhythmTemplate::Neutral => (total / 2).max(2),
    }
}

fn counterline_template_entry_offset(
    template: CounterlineRhythmTemplate,
    total_steps: usize,
) -> usize {
    let cycle = counterline_template_cycle_steps(template, total_steps).max(1);
    match template {
        CounterlineRhythmTemplate::LateEcho => cycle / 2,
        CounterlineRhythmTemplate::OffbeatAnswer => cycle.saturating_sub(2).min(cycle - 1),
        CounterlineRhythmTemplate::StrongDouble | CounterlineRhythmTemplate::HookDouble => 0,
        CounterlineRhythmTemplate::HookPickup => cycle.saturating_sub(1),
        CounterlineRhythmTemplate::CadenceSuspension => cycle.saturating_sub(2).min(cycle - 1),
        CounterlineRhythmTemplate::RippleAnswer => 1.min(cycle - 1),
        CounterlineRhythmTemplate::Neutral => 0,
    }
}

fn counterline_template_cycle_position(
    template: CounterlineRhythmTemplate,
    note_index: usize,
    total_steps: usize,
) -> usize {
    let cycle = counterline_template_cycle_steps(template, total_steps);
    let cycle = cycle.max(1);
    let entry_offset = counterline_template_entry_offset(template, total_steps) % cycle;
    (note_index + cycle - entry_offset) % cycle
}

fn arrangement_motion_profile(segment: &PhraseSegment) -> ArrangementMotionProfile {
    if segment.style != ArrangementStyle::Guofeng {
        return ArrangementMotionProfile {
            strings_gain: 1.0,
            pluck_gain: 1.0,
            percussion_gain: 1.0,
            choir_gain: 1.0,
            atmosphere_gain: 1.0,
        };
    }
    let lower = segment.section.to_ascii_lowercase();
    if lower.contains("chorus") {
        ArrangementMotionProfile {
            strings_gain: 1.12,
            pluck_gain: 1.04,
            percussion_gain: 1.18,
            choir_gain: 1.28,
            atmosphere_gain: 0.94,
        }
    } else if lower.contains("bridge") {
        ArrangementMotionProfile {
            strings_gain: 0.88,
            pluck_gain: 0.82,
            percussion_gain: 0.76,
            choir_gain: 0.62,
            atmosphere_gain: 1.22,
        }
    } else if lower.contains("outro") {
        ArrangementMotionProfile {
            strings_gain: 0.74,
            pluck_gain: 0.72,
            percussion_gain: 0.54,
            choir_gain: 0.38,
            atmosphere_gain: 1.18,
        }
    } else {
        ArrangementMotionProfile {
            strings_gain: 0.82,
            pluck_gain: 1.14,
            percussion_gain: 0.84,
            choir_gain: 0.42,
            atmosphere_gain: 1.02,
        }
    }
}

fn section_role_profile(segment: &PhraseSegment) -> SectionRoleProfile {
    let lower = segment.section.to_ascii_lowercase();
    if lower.contains("pre-chorus") {
        SectionRoleProfile {
            lead_gain: 0.98,
            counter_gain: 0.64,
            bass_gain: 1.04,
            strings_gain: 0.92,
            pluck_gain: 0.88,
            percussion_gain: 1.06,
            choir_gain: 0.54,
            atmosphere_gain: 1.02,
        }
    } else if lower.contains("chorus") {
        SectionRoleProfile {
            lead_gain: 1.26,
            counter_gain: 0.34,
            bass_gain: 1.08,
            strings_gain: 1.02,
            pluck_gain: 0.64,
            percussion_gain: 1.08,
            choir_gain: 1.12,
            atmosphere_gain: 0.82,
        }
    } else if lower.contains("bridge") {
        SectionRoleProfile {
            lead_gain: 1.0,
            counter_gain: 0.84,
            bass_gain: 0.88,
            strings_gain: 0.62,
            pluck_gain: 0.38,
            percussion_gain: 0.58,
            choir_gain: 0.42,
            atmosphere_gain: 1.08,
        }
    } else if lower.contains("outro") || lower.contains("reprise") || lower.contains("final") {
        SectionRoleProfile {
            lead_gain: 0.72,
            counter_gain: 0.34,
            bass_gain: 0.78,
            strings_gain: 0.58,
            pluck_gain: 0.42,
            percussion_gain: 0.36,
            choir_gain: 0.28,
            atmosphere_gain: 1.18,
        }
    } else if lower.contains("intro") {
        SectionRoleProfile {
            lead_gain: 0.56,
            counter_gain: 0.22,
            bass_gain: 0.64,
            strings_gain: 0.48,
            pluck_gain: 0.3,
            percussion_gain: 0.18,
            choir_gain: 0.16,
            atmosphere_gain: 1.14,
        }
    } else {
        SectionRoleProfile {
            lead_gain: 1.08,
            counter_gain: 0.56,
            bass_gain: 0.96,
            strings_gain: 0.66,
            pluck_gain: 0.92,
            percussion_gain: 0.82,
            choir_gain: 0.24,
            atmosphere_gain: 0.86,
        }
    }
}

fn phrase_role_label(segment: &PhraseSegment) -> &str {
    segment
        .phrase_hint
        .as_ref()
        .and_then(|hint| hint.role.as_deref())
        .unwrap_or_else(|| {
            let lower = segment.section.to_ascii_lowercase();
            if lower.contains("intro") {
                "setup"
            } else if lower.contains("pre-chorus") {
                "lift"
            } else if lower.contains("outro") {
                "release"
            } else if lower.contains("bridge") {
                "response"
            } else if lower.contains("chorus reprise") || lower.contains("final") {
                "resolve"
            } else {
                "statement"
            }
        })
}

fn phrase_variation_label(segment: &PhraseSegment) -> &str {
    segment
        .phrase_hint
        .as_ref()
        .and_then(|hint| hint.variation_role.as_deref())
        .unwrap_or_else(|| {
            let lower = segment.section.to_ascii_lowercase();
            if lower.contains("bridge") {
                "development"
            } else if lower.contains("reprise") || lower.contains("response") {
                "answer"
            } else {
                "primary"
            }
        })
}

fn cadence_intent_label(segment: &PhraseSegment) -> &str {
    segment
        .phrase_hint
        .as_ref()
        .and_then(|hint| hint.cadence_intent.as_deref())
        .unwrap_or_else(|| {
            let lower = segment.section.to_ascii_lowercase();
            if lower.contains("outro") || lower.contains("final") {
                "resolved"
            } else if lower.contains("pre-chorus") {
                "half"
            } else {
                "open"
            }
        })
}

fn phrase_role_profile(segment: &PhraseSegment) -> PhraseRoleProfile {
    let role = phrase_role_label(segment);
    let variation = phrase_variation_label(segment);
    let cadence = cadence_intent_label(segment);
    let mut profile = match role {
        "setup" => PhraseRoleProfile {
            lead_gain: 0.92,
            counter_gain: 0.72,
            bass_gain: 0.9,
            strings_gain: 0.84,
            pluck_gain: 1.14,
            percussion_gain: 0.82,
            choir_gain: 0.72,
            atmosphere_gain: 0.96,
        },
        "response" => PhraseRoleProfile {
            lead_gain: 1.08,
            counter_gain: 0.84,
            bass_gain: 0.94,
            strings_gain: 0.72,
            pluck_gain: 0.78,
            percussion_gain: 0.84,
            choir_gain: 0.82,
            atmosphere_gain: 0.9,
        },
        "lift" => PhraseRoleProfile {
            lead_gain: 1.14,
            counter_gain: 0.72,
            bass_gain: 1.06,
            strings_gain: 1.12,
            pluck_gain: 0.96,
            percussion_gain: 1.08,
            choir_gain: 1.02,
            atmosphere_gain: 0.9,
        },
        "release" => PhraseRoleProfile {
            lead_gain: 0.88,
            counter_gain: 0.68,
            bass_gain: 0.82,
            strings_gain: 0.76,
            pluck_gain: 0.74,
            percussion_gain: 0.64,
            choir_gain: 0.72,
            atmosphere_gain: 1.02,
        },
        "resolve" => PhraseRoleProfile {
            lead_gain: 1.28,
            counter_gain: 0.48,
            bass_gain: 0.88,
            strings_gain: 0.88,
            pluck_gain: 0.68,
            percussion_gain: 0.72,
            choir_gain: 0.94,
            atmosphere_gain: 0.74,
        },
        _ => PhraseRoleProfile {
            lead_gain: 1.18,
            counter_gain: 0.58,
            bass_gain: 1.0,
            strings_gain: 0.82,
            pluck_gain: 0.84,
            percussion_gain: 0.9,
            choir_gain: 0.88,
            atmosphere_gain: 0.8,
        },
    };

    if variation == "answer" {
        profile.lead_gain *= 1.04;
        profile.counter_gain *= 0.92;
        profile.pluck_gain *= 0.82;
        profile.atmosphere_gain *= 0.92;
    } else if variation == "development" {
        profile.counter_gain *= 0.96;
        profile.strings_gain *= 0.98;
        profile.percussion_gain *= 0.96;
        profile.choir_gain *= 0.92;
    } else if variation == "repeat" {
        profile.lead_gain *= 1.06;
        profile.pluck_gain *= 0.84;
    }

    if cadence == "authentic" || cadence == "resolved" || cadence == "plagal" {
        profile.lead_gain *= 1.08;
        profile.counter_gain *= 0.8;
        profile.percussion_gain *= 0.84;
        profile.atmosphere_gain *= 0.86;
    } else if cadence == "half" || cadence == "deceptive" {
        profile.bass_gain *= 1.04;
        profile.percussion_gain *= 0.98;
        profile.atmosphere_gain *= 0.98;
    }

    profile
}

fn build_music_plan_json(
    title: &str,
    arrangement: &[PhraseSegment],
    commands: &Value,
    provider_plan: &ProviderPlan,
    composition_layer_override: Option<&CompositionLayerPlan>,
) -> Value {
    let composition_layer = composition_layer_override.cloned().unwrap_or_else(|| {
        let composition_sections = arrangement
            .iter()
            .map(|segment| CompositionSectionInput {
                section: segment.section.clone(),
                start_sec: segment.start_sec,
                duration_sec: segment.duration_sec,
                tempo_bpm: segment.tempo_bpm,
                root_hz: segment.root_hz,
                energy: segment_energy_label(segment.energy).to_string(),
                style: arrangement_style_label(segment.style).to_string(),
            })
            .collect::<Vec<_>>();
        build_composition_layer_plan(title, &composition_sections)
    });
    let style = arrangement
        .first()
        .map(|segment| arrangement_style_label(segment.style))
        .unwrap_or("synth");
    let work_type = commands
        .get("creative")
        .and_then(|creative| creative.get("work_type"))
        .and_then(|value| value.as_str())
        .unwrap_or("single");
    let structure_tree = commands
        .get("creative")
        .and_then(|creative| creative.get("structure_tree"))
        .cloned()
        .unwrap_or_else(|| json!([]));
    let cues = arrangement
        .iter()
        .enumerate()
        .map(|(index, segment)| {
            json!({
                "cueId": format!("cue_{:03}", index + 1),
                "label": segment.section,
                "targetSceneId": format!("scene_{:03}", index + 1),
                "section": segment.section,
                "startSec": segment.start_sec,
                "durationSec": segment.duration_sec,
                "tempoBpm": segment.tempo_bpm,
                "rootHz": segment.root_hz,
                "bars": ((segment.duration_sec / 2.0).round() as i64).max(4),
                "energy": segment_energy_label(segment.energy),
                "style": arrangement_style_label(segment.style),
                "arrangementHint": format!(
                    "{} arrangement at {:.0} BPM with {}",
                    arrangement_style_label(segment.style),
                    segment.tempo_bpm,
                    provider_plan.vendor_name()
                ),
                "structureRole": match work_type {
                    "triptych" => "part",
                    "opera" => "scene",
                    _ => "section"
                }
            })
        })
        .collect::<Vec<_>>();
    let preview_segments = arrangement
        .iter()
        .map(|segment| {
            json!({
                "section": segment.section,
                "title": segment.section,
                "startSec": segment.start_sec,
                "durationSec": segment.duration_sec,
                "tempoBpm": segment.tempo_bpm,
                "rootHz": segment.root_hz,
                "bars": ((segment.duration_sec / 2.0).round() as i64).max(4),
                "energy": segment_energy_label(segment.energy),
                "audioCue": format!(
                    "{} · {} BPM · {}",
                    arrangement_style_label(segment.style),
                    segment.tempo_bpm.round(),
                    provider_plan.pack
                )
            })
        })
        .collect::<Vec<_>>();
    let preview_script = arrangement
        .iter()
        .map(|segment| {
            format!(
                "{} · {:.1}s-{:.1}s · {} energy · melodic lead, vocal-ready phrasing, scene-bound progression",
                segment.section,
                segment.start_sec,
                segment.start_sec + segment.duration_sec,
                segment_energy_label(segment.energy)
            )
        })
        .collect::<Vec<_>>();
    json!({
        "schema": "css.music.plan.v1",
        "title": title,
        "compositionLayer": composition_layer,
        "planned_work_type": work_type,
        "strategy": if arrangement.len() <= 4 { "full_song" } else { "hybrid" },
        "structureSummary": format!(
            "{} arrangement with multi-part accompaniment, grouped stems, and cue-driven progression for {}.",
            arrangement_style_label(arrangement.first().map(|segment| segment.style).unwrap_or(ArrangementStyle::Synth)),
            title
        ),
        "tracks": [
            { "trackId": "track_pad", "label": "Harmony Bed", "instrument": style, "stemPath": "./build/stems/pad.wav", "bus": "harmony", "layers": ["strings", "pads", "plucks"] },
            { "trackId": "track_lead", "label": "Primary Motif", "instrument": "lead", "stemPath": "./build/stems/lead.wav", "bus": "motif", "layers": ["lead", "counter", "octave doubles"] },
            { "trackId": "track_bass", "label": "Bass Foundation", "instrument": "bass", "stemPath": "./build/stems/bass.wav", "bus": "low_end", "layers": ["sub", "low ostinato"] },
            { "trackId": "track_drums", "label": "Rhythm Drive", "instrument": "drums", "stemPath": "./build/stems/drums.wav", "bus": "rhythm", "layers": ["kick", "snare", "hats", "impacts"] },
            { "trackId": "track_fx", "label": "Lift & Shimmer", "instrument": "fx", "stemPath": "./build/stems/fx.wav", "bus": "fx", "layers": ["choir haze", "sparkle", "riser"] },
            { "trackId": "track_strings", "label": "String Ensemble", "instrument": "strings", "stemPath": "./build/stems/strings.wav", "bus": "harmony", "layers": ["violins", "violas", "celli"] },
            { "trackId": "track_plucks", "label": "Pluck Motion", "instrument": "plucks", "stemPath": "./build/stems/plucks.wav", "bus": "harmony", "layers": ["harp", "guzheng", "synth pluck"] },
            { "trackId": "track_counter", "label": "Counter Line", "instrument": "counter", "stemPath": "./build/stems/counter.wav", "bus": "motif", "layers": ["inner melody", "call-response"] },
            { "trackId": "track_sub", "label": "Sub Bass", "instrument": "sub", "stemPath": "./build/stems/sub.wav", "bus": "low_end", "layers": ["sub sine", "low sustain"] },
            { "trackId": "track_percussion", "label": "Percussion Detail", "instrument": "percussion", "stemPath": "./build/stems/percussion.wav", "bus": "rhythm", "layers": ["hats", "toms", "ticks"] },
            { "trackId": "track_impacts", "label": "Impact Hits", "instrument": "impacts", "stemPath": "./build/stems/impacts.wav", "bus": "fx", "layers": ["downbeats", "trailers", "drops"] },
            { "trackId": "track_choir", "label": "Choir Bed", "instrument": "choir", "stemPath": "./build/stems/choir.wav", "bus": "harmony", "layers": ["ahh", "ohh", "air"] }
        ],
        "cues": cues,
        "previewSegments": preview_segments,
        "previewScript": preview_script,
        "structureTree": structure_tree,
        "vocalDesign": {
            "leadPresence": "soft_human_lead",
            "harmonyPresence": "supporting_harmony_bed",
            "requiresMelodicLeadStem": true,
            "preferredHost": "diffsinger_or_equivalent"
        },
        "provider": {
            "vendor": provider_plan.vendor_name(),
            "pack": provider_plan.pack,
            "preset": provider_plan.preset,
            "style_hint": provider_plan.style_hint
        }
    })
}

fn build_music_diagnostics_json(
    title: &str,
    arrangement: &[PhraseSegment],
    provider_plan: &ProviderPlan,
) -> Value {
    let section_reports = arrangement
        .iter()
        .enumerate()
        .map(|(index, segment)| {
            let hint = segment.melody_hint.as_ref();
            let phrase_function = hint
                .and_then(|hint| hint.phrase_function.as_deref())
                .unwrap_or("statement");
            let hook_strength = hint.and_then(|hint| hint.hook_strength).unwrap_or(0.0);
            let repetition_window = hint
                .and_then(|hint| hint.repetition_window_bars)
                .unwrap_or(4);
            let antecedent = hint
                .and_then(|hint| hint.antecedent_phrase_id.as_deref())
                .unwrap_or("");
            let motif_locked = hint
                .map(|hint| hint.target_degrees.len() >= 4)
                .unwrap_or(false);
            let tail_callback = !antecedent.is_empty();
            let section_score = (hook_strength * 0.42
                + if phrase_function == "hook" { 0.22 } else { 0.0 }
                + if motif_locked { 0.18 } else { 0.0 }
                + if repetition_window <= 2 { 0.12 } else { 0.0 }
                + if tail_callback { 0.06 } else { 0.0 })
            .clamp(0.0, 1.0);
            json!({
                "index": index + 1,
                "section": segment.section,
                "startSec": segment.start_sec,
                "durationSec": segment.duration_sec,
                "phraseFunction": phrase_function,
                "hookStrength": hook_strength,
                "motifLocked": motif_locked,
                "repetitionWindowBars": repetition_window,
                "tailCallback": tail_callback,
                "recognitionScore": section_score
            })
        })
        .collect::<Vec<_>>();
    let strongest_hook = section_reports
        .iter()
        .max_by(|left, right| {
            let left_score = left
                .get("recognitionScore")
                .and_then(|value| value.as_f64())
                .unwrap_or(0.0);
            let right_score = right
                .get("recognitionScore")
                .and_then(|value| value.as_f64())
                .unwrap_or(0.0);
            left_score
                .partial_cmp(&right_score)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .cloned()
        .unwrap_or_else(|| json!({}));
    let hook_score = strongest_hook
        .get("recognitionScore")
        .and_then(|value| value.as_f64())
        .unwrap_or(0.0);
    let recognizable_hook = hook_score >= 0.82
        && section_reports.iter().any(|entry| {
            entry.get("phraseFunction").and_then(|value| value.as_str()) == Some("hook")
        })
        && section_reports.iter().any(|entry| {
            entry
                .get("tailCallback")
                .and_then(|value| value.as_bool())
                .unwrap_or(false)
        });
    let mut issues = Vec::new();
    if !section_reports
        .iter()
        .any(|entry| entry.get("phraseFunction").and_then(|value| value.as_str()) == Some("hook"))
    {
        issues.push("no_phrase_marked_as_hook");
    }
    if !section_reports.iter().any(|entry| {
        entry
            .get("repetitionWindowBars")
            .and_then(|value| value.as_u64())
            .map(|value| value <= 2)
            .unwrap_or(false)
    }) {
        issues.push("no_tight_hook_repetition_window");
    }
    if !section_reports.iter().any(|entry| {
        entry
            .get("tailCallback")
            .and_then(|value| value.as_bool())
            .unwrap_or(false)
    }) {
        issues.push("no_tail_callback_detected");
    }
    json!({
        "schema": "css.music.diagnostics.v1",
        "title": title,
        "melodyControlMode": "hard_constrained",
        "recognizableHook": recognizable_hook,
        "hookScore": hook_score,
        "strongestHookSection": strongest_hook.get("section").and_then(|value| value.as_str()).unwrap_or(""),
        "provider": {
            "vendor": provider_plan.vendor_name(),
            "pack": provider_plan.pack,
            "preset": provider_plan.preset
        },
        "issues": issues,
        "sections": section_reports
    })
}

fn arrangement_style_label(style: ArrangementStyle) -> &'static str {
    match style {
        ArrangementStyle::Piano => "piano-led",
        ArrangementStyle::Strings => "strings-cinematic",
        ArrangementStyle::Synth => "synth-pop",
        ArrangementStyle::Guofeng => "guofeng-ensemble",
    }
}

fn segment_energy_label(energy: SegmentEnergy) -> &'static str {
    match energy {
        SegmentEnergy::Low => "low",
        SegmentEnergy::Medium => "medium",
        SegmentEnergy::High => "high",
        SegmentEnergy::Peak => "peak",
    }
}

fn sustain_for_energy(energy: SegmentEnergy) -> f32 {
    match energy {
        SegmentEnergy::Low => 0.68,
        SegmentEnergy::Medium => 0.62,
        SegmentEnergy::High => 0.56,
        SegmentEnergy::Peak => 0.5,
    }
}

fn subdivision_count(segment: &PhraseSegment) -> usize {
    let bars = (segment.duration_sec / 1.9).round() as usize;
    let cap = if segment.style == ArrangementStyle::Piano {
        10
    } else {
        12
    };
    let mut subdivisions = bars.clamp(4, cap);
    if let Some(hint) = segment.rhythm_hint.as_ref() {
        match hint.syncopation.as_deref() {
            Some("high") => subdivisions += 2,
            Some("medium") => subdivisions += 1,
            _ => {}
        }
        match hint.groove_template.as_deref() {
            Some("anthem") | Some("pulse") => subdivisions += 1,
            Some("floating") => subdivisions = subdivisions.saturating_sub(1),
            _ => {}
        }
        if hint
            .activity_profile
            .iter()
            .any(|entry| entry == "burst" || entry == "push")
        {
            subdivisions += 1;
        }
    }
    subdivisions.clamp(4, cap + 3)
}

struct RhythmMotion {
    accent_gain: f32,
    percussion_gain: f32,
    lead_gain: f32,
    push_offset_sec: f32,
}

struct RhythmHitProfile {
    drum_gate: f32,
    percussion_gate: f32,
    pluck_gate: f32,
    pluck_emphasis: f32,
}

struct RhythmLaneProfile {
    bass_gate: f32,
    bass_emphasis: f32,
    kick_gate: f32,
    snare_gate: f32,
    top_gate: f32,
    wood_gate: f32,
    frame_gate: f32,
    shaker_gate: f32,
    impact_gate: f32,
}

fn rhythm_motion_for_time(segment: &PhraseSegment, local_t: f32, beat_period: f32) -> RhythmMotion {
    let Some(hint) = segment.rhythm_hint.as_ref() else {
        return RhythmMotion {
            accent_gain: 1.0,
            percussion_gain: 1.0,
            lead_gain: 1.0,
            push_offset_sec: 0.0,
        };
    };
    let bar_count = bars_for_segment(segment).max(1) as usize;
    let bar_duration = (segment.duration_sec / bar_count as f32).max(beat_period);
    let bar_index = ((local_t / bar_duration).floor() as usize).min(bar_count.saturating_sub(1));
    let within_bar = local_t - (bar_index as f32 * bar_duration);
    let accent_gain = accent_gain_for_bar(
        hint.bar_accent_pattern.get(bar_index),
        within_bar,
        beat_period,
    );
    let push_offset_sec =
        push_offset_for_bar(hint.push_pull_profile.get(bar_index), hint.micro_timing_ms);
    let activity_gain = match hint
        .activity_profile
        .get(bar_index)
        .map(|value| value.as_str())
    {
        Some("burst") => 1.2,
        Some("drive") | Some("push") => 1.12,
        Some("build") | Some("develop") => 1.06,
        Some("hold") => 0.94,
        _ => 1.0,
    };

    RhythmMotion {
        accent_gain: accent_gain * activity_gain,
        percussion_gain: (accent_gain * 1.06 * activity_gain).clamp(0.88, 1.34),
        lead_gain: (0.96 + (accent_gain - 1.0) * 0.45).clamp(0.9, 1.18),
        push_offset_sec,
    }
}

fn rhythm_hit_profile_for_time(
    segment: &PhraseSegment,
    local_t: f32,
    beat_period: f32,
) -> RhythmHitProfile {
    let bar_count = bars_for_segment(segment).max(1) as usize;
    let bar_duration = (segment.duration_sec / bar_count as f32).max(beat_period);
    let bar_index = ((local_t / bar_duration).floor() as usize).min(bar_count.saturating_sub(1));
    let within_bar = local_t - (bar_index as f32 * bar_duration);
    let hint = segment.rhythm_hint.as_ref();
    let activity = hint
        .and_then(|value| value.activity_profile.get(bar_index))
        .map(String::as_str);
    let accents = hint.and_then(|value| value.bar_accent_pattern.get(bar_index));
    let drum_steps = drum_steps_for_bar(segment.style, segment.energy, activity, accents);
    let percussion_steps =
        percussion_steps_for_bar(segment.style, segment.energy, activity, accents);
    let pluck_steps = pluck_steps_for_bar(segment.style, segment.energy, activity, accents);

    RhythmHitProfile {
        drum_gate: gate_for_steps(
            within_bar,
            bar_duration,
            &drum_steps,
            if segment.style == ArrangementStyle::Guofeng {
                0.082
            } else {
                0.068
            },
        ),
        percussion_gate: gate_for_steps(
            within_bar,
            bar_duration,
            &percussion_steps,
            if segment.style == ArrangementStyle::Guofeng {
                0.055
            } else {
                0.048
            },
        ),
        pluck_gate: gate_for_steps(
            within_bar,
            bar_duration,
            &pluck_steps,
            if segment.style == ArrangementStyle::Guofeng {
                0.09
            } else {
                0.07
            },
        ),
        pluck_emphasis: emphasis_for_steps(within_bar, bar_duration, &pluck_steps),
    }
}

fn rhythm_lane_profile_for_time(
    segment: &PhraseSegment,
    local_t: f32,
    beat_period: f32,
) -> RhythmLaneProfile {
    let bar_count = bars_for_segment(segment).max(1) as usize;
    let bar_duration = (segment.duration_sec / bar_count as f32).max(beat_period);
    let bar_index = ((local_t / bar_duration).floor() as usize).min(bar_count.saturating_sub(1));
    let within_bar = local_t - (bar_index as f32 * bar_duration);
    let hint = segment.rhythm_hint.as_ref();
    let activity = hint
        .and_then(|value| value.activity_profile.get(bar_index))
        .map(String::as_str);
    let accents = hint.and_then(|value| value.bar_accent_pattern.get(bar_index));
    let kick_steps = kick_steps_for_bar(segment.style, segment.energy, activity, accents);
    let snare_steps = snare_steps_for_bar(segment.style, segment.energy, activity, accents);
    let top_steps = percussion_steps_for_bar(segment.style, segment.energy, activity, accents);
    let bass_steps = bass_steps_for_bar(segment.style, segment.energy, activity, accents);
    let wood_steps = wood_steps_for_bar(segment.style, segment.energy, activity, accents);
    let frame_steps = frame_steps_for_bar(segment.style, segment.energy, activity, accents);
    let shaker_steps = shaker_steps_for_bar(segment.style, segment.energy, activity, accents);
    let impact_steps = impact_steps_for_bar(segment.style, segment.energy, activity, accents);

    RhythmLaneProfile {
        bass_gate: gate_for_steps(within_bar, bar_duration, &bass_steps, 0.11),
        bass_emphasis: emphasis_for_steps(within_bar, bar_duration, &bass_steps),
        kick_gate: gate_for_steps(within_bar, bar_duration, &kick_steps, 0.09),
        snare_gate: gate_for_steps(within_bar, bar_duration, &snare_steps, 0.08),
        top_gate: gate_for_steps(within_bar, bar_duration, &top_steps, 0.058),
        wood_gate: gate_for_steps(within_bar, bar_duration, &wood_steps, 0.058),
        frame_gate: gate_for_steps(within_bar, bar_duration, &frame_steps, 0.072),
        shaker_gate: gate_for_steps(within_bar, bar_duration, &shaker_steps, 0.044),
        impact_gate: gate_for_steps(within_bar, bar_duration, &impact_steps, 0.11),
    }
}

fn drum_steps_for_bar(
    style: ArrangementStyle,
    energy: SegmentEnergy,
    activity: Option<&str>,
    accents: Option<&Vec<String>>,
) -> Vec<usize> {
    let mut steps = match (style, energy) {
        (ArrangementStyle::Guofeng, SegmentEnergy::Low) => vec![0, 4],
        (ArrangementStyle::Guofeng, SegmentEnergy::Medium) => vec![0, 3, 4, 6],
        (ArrangementStyle::Guofeng, _) => vec![0, 2, 4, 6],
        (_, SegmentEnergy::Low) => vec![0, 4],
        (_, SegmentEnergy::Medium) => vec![0, 3, 4, 6],
        (_, SegmentEnergy::High) => vec![0, 2, 4, 6],
        (_, SegmentEnergy::Peak) => vec![0, 2, 4, 5, 6],
    };
    match activity {
        Some("burst") => steps.extend([1, 5, 7]),
        Some("drive") | Some("push") => steps.extend([2, 6]),
        Some("build") | Some("develop") => steps.extend([3, 7]),
        Some("hold") => {
            steps.retain(|step| matches!(*step, 0 | 4));
        }
        _ => {}
    }
    append_accent_steps(&mut steps, accents);
    normalize_steps(steps)
}

fn kick_steps_for_bar(
    style: ArrangementStyle,
    energy: SegmentEnergy,
    activity: Option<&str>,
    accents: Option<&Vec<String>>,
) -> Vec<usize> {
    let mut steps = match (style, energy) {
        (ArrangementStyle::Guofeng, SegmentEnergy::Low) => vec![0],
        (ArrangementStyle::Guofeng, _) => vec![0, 4],
        (_, SegmentEnergy::Low) => vec![0],
        (_, SegmentEnergy::Medium) => vec![0, 4],
        (_, SegmentEnergy::High) | (_, SegmentEnergy::Peak) => vec![0, 2, 4, 6],
    };
    match activity {
        Some("burst") => steps.extend([1, 5]),
        Some("drive") | Some("push") => steps.extend([2, 6]),
        Some("hold") => steps.retain(|step| matches!(*step, 0 | 4)),
        _ => {}
    }
    append_accent_steps(&mut steps, accents);
    normalize_steps(steps)
}

fn snare_steps_for_bar(
    style: ArrangementStyle,
    energy: SegmentEnergy,
    activity: Option<&str>,
    accents: Option<&Vec<String>>,
) -> Vec<usize> {
    let mut steps = match style {
        ArrangementStyle::Guofeng => vec![3, 7],
        ArrangementStyle::Piano => vec![4],
        ArrangementStyle::Strings => vec![3, 7],
        ArrangementStyle::Synth => vec![2, 6],
    };
    match activity {
        Some("burst") | Some("build") => steps.extend([5, 7]),
        Some("hold") if energy == SegmentEnergy::Low => steps = vec![6],
        _ => {}
    }
    if let Some(accents) = accents {
        steps.extend(
            accents
                .iter()
                .filter(|token| matches!(token.as_str(), "2" | "4" | "and-4"))
                .filter_map(|token| accent_step(token)),
        );
    }
    normalize_steps(steps)
}

fn bass_steps_for_bar(
    style: ArrangementStyle,
    energy: SegmentEnergy,
    activity: Option<&str>,
    accents: Option<&Vec<String>>,
) -> Vec<usize> {
    let mut steps = match (style, energy) {
        (_, SegmentEnergy::Low) => vec![0],
        (ArrangementStyle::Guofeng, SegmentEnergy::Medium) => vec![0, 4],
        (ArrangementStyle::Guofeng, _) => vec![0, 2, 4, 6],
        (_, SegmentEnergy::Medium) => vec![0, 4],
        (_, SegmentEnergy::High) | (_, SegmentEnergy::Peak) => vec![0, 2, 4, 6],
    };
    match activity {
        Some("burst") => steps.extend([1, 5]),
        Some("drive") | Some("push") => steps.extend([2, 6]),
        Some("build") | Some("develop") => steps.extend([3, 7]),
        Some("hold") => steps.retain(|step| matches!(*step, 0 | 4)),
        _ => {}
    }
    append_accent_steps(&mut steps, accents);
    normalize_steps(steps)
}

fn wood_steps_for_bar(
    style: ArrangementStyle,
    energy: SegmentEnergy,
    activity: Option<&str>,
    accents: Option<&Vec<String>>,
) -> Vec<usize> {
    if style != ArrangementStyle::Guofeng {
        return Vec::new();
    }
    let mut steps = vec![1, 5];
    if energy != SegmentEnergy::Low {
        steps.extend([3, 7]);
    }
    if matches!(activity, Some("burst") | Some("drive") | Some("push")) {
        steps.extend([2, 6]);
    }
    append_accent_steps(&mut steps, accents);
    normalize_steps(steps)
}

fn frame_steps_for_bar(
    style: ArrangementStyle,
    _energy: SegmentEnergy,
    activity: Option<&str>,
    accents: Option<&Vec<String>>,
) -> Vec<usize> {
    if style != ArrangementStyle::Guofeng {
        return Vec::new();
    }
    let mut steps = vec![0, 4];
    if matches!(activity, Some("build") | Some("burst")) {
        steps.push(6);
    }
    append_accent_steps(&mut steps, accents);
    normalize_steps(steps)
}

fn shaker_steps_for_bar(
    style: ArrangementStyle,
    energy: SegmentEnergy,
    activity: Option<&str>,
    accents: Option<&Vec<String>>,
) -> Vec<usize> {
    let mut steps = match style {
        ArrangementStyle::Guofeng => vec![1, 3, 5, 7],
        ArrangementStyle::Piano => vec![2, 6],
        ArrangementStyle::Strings => vec![1, 3, 5, 7],
        ArrangementStyle::Synth => vec![1, 2, 3, 5, 6, 7],
    };
    if matches!(activity, Some("burst")) || energy == SegmentEnergy::Peak {
        steps.extend([0, 4]);
    }
    if matches!(activity, Some("hold")) {
        steps.retain(|step| step % 2 == 1);
    }
    append_accent_steps(&mut steps, accents);
    normalize_steps(steps)
}

fn impact_steps_for_bar(
    _style: ArrangementStyle,
    energy: SegmentEnergy,
    activity: Option<&str>,
    accents: Option<&Vec<String>>,
) -> Vec<usize> {
    if !matches!(energy, SegmentEnergy::High | SegmentEnergy::Peak) {
        return Vec::new();
    }
    let mut steps = vec![0];
    if matches!(activity, Some("burst") | Some("build")) {
        steps.push(4);
    }
    if let Some(accents) = accents {
        steps.extend(
            accents
                .iter()
                .filter(|token| matches!(token.as_str(), "1" | "3"))
                .filter_map(|token| accent_step(token)),
        );
    }
    normalize_steps(steps)
}

fn percussion_steps_for_bar(
    style: ArrangementStyle,
    energy: SegmentEnergy,
    activity: Option<&str>,
    accents: Option<&Vec<String>>,
) -> Vec<usize> {
    let mut steps = match style {
        ArrangementStyle::Guofeng => vec![1, 3, 5, 7],
        ArrangementStyle::Piano => vec![2, 6],
        ArrangementStyle::Strings => vec![1, 3, 5, 7],
        ArrangementStyle::Synth => vec![1, 2, 3, 5, 6, 7],
    };
    match activity {
        Some("burst") => steps.extend([0, 4]),
        Some("drive") | Some("push") => steps.extend([2, 6]),
        Some("build") | Some("develop") => steps.extend([3, 7]),
        Some("hold") if energy == SegmentEnergy::Low => steps = vec![3, 7],
        _ => {}
    }
    append_accent_steps(&mut steps, accents);
    normalize_steps(steps)
}

fn pluck_steps_for_bar(
    style: ArrangementStyle,
    energy: SegmentEnergy,
    activity: Option<&str>,
    accents: Option<&Vec<String>>,
) -> Vec<usize> {
    let mut steps = match style {
        ArrangementStyle::Guofeng => vec![0, 2, 4, 6],
        ArrangementStyle::Piano => vec![0, 4],
        ArrangementStyle::Strings => vec![0, 2, 5, 7],
        ArrangementStyle::Synth => vec![0, 2, 4, 5, 6],
    };
    match activity {
        Some("burst") => steps.extend([1, 3, 5, 7]),
        Some("drive") | Some("push") => steps.extend([1, 5]),
        Some("build") | Some("develop") => steps.extend([3, 7]),
        Some("hold") => {
            steps.retain(|step| matches!(*step, 0 | 4));
        }
        _ => {}
    }
    if energy == SegmentEnergy::Peak {
        steps.extend([2, 6]);
    }
    append_accent_steps(&mut steps, accents);
    normalize_steps(steps)
}

fn append_accent_steps(steps: &mut Vec<usize>, accents: Option<&Vec<String>>) {
    let Some(accents) = accents else {
        return;
    };
    steps.extend(accents.iter().filter_map(|token| accent_step(token)));
}

fn accent_step(token: &str) -> Option<usize> {
    match token {
        "1" => Some(0),
        "2" => Some(2),
        "3" => Some(4),
        "4" => Some(6),
        "and-2" => Some(3),
        "and-3" => Some(5),
        "and-4" => Some(7),
        _ => None,
    }
}

fn normalize_steps(mut steps: Vec<usize>) -> Vec<usize> {
    steps.retain(|step| *step < 8);
    steps.sort_unstable();
    steps.dedup();
    if steps.is_empty() {
        vec![0, 4]
    } else {
        steps
    }
}

fn gate_for_steps(within_bar: f32, bar_duration: f32, steps: &[usize], width: f32) -> f32 {
    if steps.is_empty() {
        return 0.0;
    }
    let step_duration = bar_duration / 8.0;
    let window = (step_duration * width).max(0.018);
    let nearest = steps
        .iter()
        .map(|step| (within_bar - (*step as f32 * step_duration)).abs())
        .fold(f32::MAX, f32::min);
    if nearest > window {
        0.0
    } else {
        (1.0 - (nearest / window)).powf(1.6)
    }
}

fn emphasis_for_steps(within_bar: f32, bar_duration: f32, steps: &[usize]) -> f32 {
    if steps.is_empty() {
        return 0.86;
    }
    let step_duration = bar_duration / 8.0;
    let nearest = steps
        .iter()
        .map(|step| (within_bar - (*step as f32 * step_duration)).abs())
        .fold(f32::MAX, f32::min);
    let focus = (1.0 - (nearest / step_duration.max(0.02)).clamp(0.0, 1.0)).powf(1.4);
    (0.82 + focus * 0.36).clamp(0.82, 1.18)
}

fn accent_gain_for_bar(pattern: Option<&Vec<String>>, within_bar: f32, beat_period: f32) -> f32 {
    let Some(pattern) = pattern else {
        return 1.0;
    };
    let pulse_positions = pattern
        .iter()
        .filter_map(|token| accent_position(token, beat_period))
        .collect::<Vec<_>>();
    if pulse_positions.is_empty() {
        return 1.0;
    }
    let nearest = pulse_positions
        .iter()
        .map(|pulse| (within_bar - pulse).abs())
        .fold(f32::MAX, f32::min);
    if nearest <= beat_period * 0.08 {
        1.22
    } else if nearest <= beat_period * 0.16 {
        1.1
    } else {
        1.0
    }
}

fn accent_position(token: &str, beat_period: f32) -> Option<f32> {
    match token {
        "1" => Some(0.0),
        "2" => Some(beat_period),
        "3" => Some(beat_period * 2.0),
        "4" => Some(beat_period * 3.0),
        "and-2" => Some(beat_period * 1.5),
        "and-3" => Some(beat_period * 2.5),
        "and-4" => Some(beat_period * 3.5),
        _ => None,
    }
}

fn push_offset_for_bar(profile: Option<&String>, micro_timing_ms: Option<f32>) -> f32 {
    let amount = micro_timing_ms.unwrap_or(0.0) / 1000.0;
    match profile.map(|value| value.as_str()) {
        Some("laid_back") => amount,
        Some("pushed") => -amount,
        _ => 0.0,
    }
}

fn lead_pattern(segment: &PhraseSegment) -> Vec<i32> {
    let legacy = default_lead_pattern(segment);
    let Some(hint) = segment.melody_hint.as_ref() else {
        return legacy;
    };
    if hint.target_degrees.is_empty() {
        return legacy;
    }

    let target_len = legacy.len().max(1);
    let register_offset = register_anchor_offset(hint.register_anchor.as_deref());
    let mut pattern: Vec<i32> = (0..target_len)
        .map(|index| {
            let degree = hint.target_degrees[index % hint.target_degrees.len()];
            degree_to_semitone(degree) + register_offset
        })
        .collect();

    let leap_limit = melody_leap_limit(hint);
    smooth_melodic_motion(&mut pattern, leap_limit, hint.motion_bias.as_deref());
    apply_hook_repetition(&mut pattern, hint);
    apply_hook_restatement(&mut pattern, hint);
    apply_note_grouping(&mut pattern, hint);
    apply_structured_note_groups(&mut pattern, hint);
    apply_structured_restatement_passes(&mut pattern, hint);
    apply_climax_shape(&mut pattern, hint);
    apply_tail_callback(&mut pattern, hint);
    apply_landing_tone(&mut pattern, hint);
    apply_singable_phrase_shape(&mut pattern, hint);
    pattern
}

fn default_lead_pattern(segment: &PhraseSegment) -> Vec<i32> {
    let lower = segment.section.to_ascii_lowercase();
    if lower.contains("chorus") {
        vec![0, 4, 7, 11, 7, 4, 12, 11]
    } else if lower.contains("bridge") {
        vec![0, 3, 5, 8, 10, 8, 5, 3]
    } else if segment.energy == SegmentEnergy::Low {
        vec![0, 2, 4, 7, 4, 2]
    } else {
        vec![0, 4, 5, 7, 9, 7, 5, 4]
    }
}

fn degree_to_semitone(degree: i32) -> i32 {
    let normalized = if degree == 0 { 1 } else { degree };
    let degree_index = normalized.abs() - 1;
    let octave = degree_index.div_euclid(7);
    let scale_degree = degree_index.rem_euclid(7);
    let major_scale = [0, 2, 4, 5, 7, 9, 11];
    let semitone = major_scale[scale_degree as usize] + octave * 12;
    if normalized < 0 {
        -semitone
    } else {
        semitone
    }
}

fn register_anchor_offset(anchor: Option<&str>) -> i32 {
    match anchor.unwrap_or("").trim().to_ascii_lowercase().as_str() {
        "low" => -12,
        "mid_low" | "midlow" => -5,
        "mid_high" | "midhigh" => 5,
        "high" => 12,
        _ => 0,
    }
}

fn melody_leap_limit(hint: &ExternalMelodyHint) -> i32 {
    if let Some(limit) = hint.leap_budget {
        return limit.max(3) as i32;
    }
    match hint.motion_bias.as_deref().unwrap_or("").trim() {
        "stepwise" => 4,
        "balanced" | "balanced_lift" => 7,
        "contrast_leap" => 10,
        "leaping" | "wide" => 12,
        _ => 7,
    }
}

fn smooth_melodic_motion(pattern: &mut [i32], leap_limit: i32, motion_bias: Option<&str>) {
    if pattern.len() < 2 {
        return;
    }
    let limit = leap_limit.max(2);
    let stepwise = matches!(
        motion_bias.unwrap_or("").trim(),
        "stepwise" | "stepwise_rise"
    );
    for index in 1..pattern.len() {
        let previous = pattern[index - 1];
        let mut current = pattern[index];
        while current - previous > 12 {
            current -= 12;
        }
        while previous - current > 12 {
            current += 12;
        }
        let difference = current - previous;
        if difference.abs() > limit {
            current = previous + difference.signum() * limit;
        }
        if stepwise && difference.abs() > 4 {
            current = previous + difference.signum() * 2;
        }
        pattern[index] = current;
    }
}

fn apply_hook_repetition(pattern: &mut [i32], hint: &ExternalMelodyHint) {
    if pattern.len() < 6 {
        return;
    }
    let hook_strength = hint.hook_strength.unwrap_or(0.0);
    let repetition_window = hint.repetition_window_bars.unwrap_or(4);
    if hook_strength < 0.8 && repetition_window > 2 {
        return;
    }
    let motif_len = pattern.len().min(4).max(2);
    let repeat_start = (pattern.len() / 2).min(pattern.len().saturating_sub(motif_len + 1));
    for offset in 0..motif_len {
        pattern[repeat_start + offset] = pattern[offset];
    }
    if hook_strength >= 0.9 {
        let final_start = pattern.len().saturating_sub(motif_len + 1);
        for offset in 0..motif_len {
            pattern[final_start + offset] = pattern[offset];
        }
    }
}

fn apply_hook_restatement(pattern: &mut [i32], hint: &ExternalMelodyHint) {
    if pattern.len() < 6 {
        return;
    }
    let hook_strength = hint.hook_strength.unwrap_or(0.0);
    if hook_strength < 0.84 {
        return;
    }
    let motif_len = pattern.len().min(4).max(2);
    let restatement_start = pattern
        .len()
        .saturating_sub(motif_len + if hook_strength >= 0.92 { 1 } else { 2 });
    let lift = match hint
        .landing_tone
        .as_deref()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "dominant" | "fifth" | "half" | "suspended" => 2,
        "tonic" | "resolve" | "resolved" | "authentic" => 5,
        _ => {
            if hook_strength >= 0.92 {
                4
            } else {
                2
            }
        }
    };
    for offset in 0..motif_len {
        let source = pattern[offset];
        let target = source
            + if offset + 1 == motif_len {
                lift
            } else {
                (lift / 2).max(1)
            };
        let current = pattern[restatement_start + offset];
        pattern[restatement_start + offset] = smooth_degree_toward(current, target, 4);
    }
}

fn apply_note_grouping(pattern: &mut [i32], hint: &ExternalMelodyHint) {
    if pattern.len() < 5 {
        return;
    }
    let hook_strength = hint.hook_strength.unwrap_or(0.0);
    let stress_map = if hint.lyric_stress_map.is_empty() {
        Vec::new()
    } else {
        hint.lyric_stress_map
            .iter()
            .map(|value| value.trim().to_ascii_lowercase())
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>()
    };
    if stress_map.is_empty() && hook_strength < 0.88 {
        return;
    }
    let anchors = if stress_map.is_empty() {
        vec!["lift".to_string(), "hold".to_string()]
    } else {
        stress_map
    };
    for (group_index, stress) in anchors.iter().enumerate() {
        let center = (((group_index + 1) * pattern.len()) / (anchors.len() + 1))
            .min(pattern.len().saturating_sub(2))
            .max(1);
        match stress.as_str() {
            "hold" => {
                let held = smooth_degree_toward(pattern[center], pattern[center - 1], 2);
                pattern[center] = held;
                pattern[center + 1] = held;
            }
            "lift" => {
                let base = pattern[center - 1];
                pattern[center] = base + 2;
                pattern[center + 1] = pattern[center] + if hook_strength >= 0.9 { 2 } else { 1 };
            }
            "answer" | "release" => {
                let target = pattern[center - 1] - if hook_strength >= 0.9 { 3 } else { 2 };
                pattern[center] = smooth_degree_toward(pattern[center], target, 3);
                pattern[center + 1] = smooth_degree_toward(pattern[center + 1], target - 1, 3);
            }
            _ => {}
        }
    }
    smooth_melodic_motion(
        pattern,
        melody_leap_limit(hint),
        hint.motion_bias.as_deref(),
    );
}

fn apply_tail_callback(pattern: &mut [i32], hint: &ExternalMelodyHint) {
    if pattern.len() < 6 || hint.antecedent_phrase_id.is_none() {
        return;
    }
    let motif_len = pattern.len().min(3).max(2);
    let callback_start = pattern.len().saturating_sub(motif_len + 1);
    for offset in 0..motif_len {
        let source = pattern[offset];
        let destination = pattern[callback_start + offset];
        pattern[callback_start + offset] = smooth_degree_toward(destination, source, 3);
    }
}

fn apply_singable_phrase_shape(pattern: &mut [i32], hint: &ExternalMelodyHint) {
    if pattern.len() < 4 {
        return;
    }
    let hook_strength = hint.hook_strength.unwrap_or(0.0);
    let phrase_function = hint
        .phrase_function
        .as_deref()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let pass_count = hint.hook_restatement_passes.len().max(1);
    let span = (pattern.len() / pass_count).max(2);

    for chunk in pattern.chunks_mut(span) {
        if chunk.len() < 2 {
            continue;
        }
        let high = chunk.iter().copied().max().unwrap_or(chunk[0]);
        let low = chunk.iter().copied().min().unwrap_or(chunk[0]);
        let center = chunk.len() / 2;

        if hook_strength >= 0.86 || phrase_function == "hook" {
            if center > 0 {
                chunk[center] = smooth_degree_toward(chunk[center], high, 2);
                chunk[center - 1] = smooth_degree_toward(chunk[center - 1], chunk[center], 1);
            }
            if center + 1 < chunk.len() {
                chunk[center + 1] = smooth_degree_toward(chunk[center + 1], chunk[center], 1);
            }
        }

        for idx in 1..chunk.len() {
            let previous = chunk[idx - 1];
            let current = chunk[idx];
            if (current - previous).abs() == 1 {
                chunk[idx] = previous;
            }
        }

        if chunk.len() >= 3 {
            chunk[0] = smooth_degree_toward(chunk[0], low.max(chunk[1] - 2), 2);
            let last = chunk.len() - 1;
            chunk[last] = smooth_degree_toward(chunk[last], chunk[last - 1], 2);
        }
    }

    reinforce_memorable_motif_cells(pattern, hint);
    smooth_melodic_motion(pattern, melody_leap_limit(hint).min(5), Some("stepwise"));
}

fn reinforce_memorable_motif_cells(pattern: &mut [i32], hint: &ExternalMelodyHint) {
    if pattern.len() < 6 {
        return;
    }
    let hook_strength = hint.hook_strength.unwrap_or(0.0);
    let phrase_function = hint
        .phrase_function
        .as_deref()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    if hook_strength < 0.84 && phrase_function != "hook" {
        return;
    }

    let cell_len = pattern.len().min(4).max(2);
    let motif = pattern[..cell_len].to_vec();
    let last_start = pattern.len().saturating_sub(cell_len);
    let phrase_role = hint
        .phrase_function
        .as_deref()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();

    for offset in 0..cell_len {
        let source = motif[offset];
        let target_index = last_start + offset;
        let target = if phrase_role.contains("answer") {
            source - if offset + 1 == cell_len { 2 } else { 1 }
        } else if phrase_role.contains("echo") || phrase_role.contains("tail") {
            source - if offset == 0 { 1 } else { 2 }
        } else {
            source
        };
        pattern[target_index] = smooth_degree_toward(pattern[target_index], target, 2);
    }

    if pattern.len() >= 8 {
        let midpoint = pattern.len() / 2;
        let pivot = midpoint
            .saturating_sub(1)
            .min(pattern.len().saturating_sub(2));
        pattern[pivot] = smooth_degree_toward(pattern[pivot], motif[0], 2);
        pattern[pivot + 1] = smooth_degree_toward(pattern[pivot + 1], motif[1 % motif.len()], 2);
    }

    if pattern.len() >= 10 {
        let anchor_windows = [pattern.len() / 3, (pattern.len() * 2) / 3];
        for window_start in anchor_windows {
            let start = window_start
                .saturating_sub(1)
                .min(pattern.len().saturating_sub(cell_len));
            for offset in 0..cell_len.min(3) {
                let idx = start + offset;
                let source = motif[offset % motif.len()];
                let echoed = if phrase_role.contains("answer") {
                    source
                        - if offset == cell_len.saturating_sub(1) {
                            2
                        } else {
                            1
                        }
                } else if phrase_role.contains("echo") || phrase_role.contains("tail") {
                    source - 1
                } else {
                    source
                };
                pattern[idx] = smooth_degree_toward(pattern[idx], echoed, 2);
                if idx > 0 {
                    pattern[idx - 1] = smooth_degree_toward(pattern[idx - 1], pattern[idx], 2);
                }
            }
        }
    }
}

fn apply_structured_note_groups(pattern: &mut [i32], hint: &ExternalMelodyHint) {
    if pattern.len() < 5 || hint.note_grouping.is_empty() {
        return;
    }
    let total_weight: usize = hint
        .note_grouping
        .iter()
        .map(|value| usize::from((*value).max(1)))
        .sum();
    if total_weight == 0 {
        return;
    }
    let mut cursor = 0usize;
    for (index, group_size) in hint.note_grouping.iter().enumerate() {
        let span = ((pattern.len() * usize::from((*group_size).max(1))) / total_weight)
            .max(1)
            .min(pattern.len().saturating_sub(cursor));
        if span == 0 {
            break;
        }
        let start = cursor;
        let end = (cursor + span).min(pattern.len());
        let accent_index = start.min(pattern.len().saturating_sub(1));
        if index == 0 {
            pattern[accent_index] += 1;
        } else if *group_size >= 4 {
            pattern[accent_index] += 2;
        } else if *group_size <= 2 && end > start + 1 {
            pattern[end - 1] = smooth_degree_toward(pattern[end - 1], pattern[start] - 1, 2);
        }
        if end > start + 2 {
            let release_index = end - 1;
            pattern[release_index] =
                smooth_degree_toward(pattern[release_index], pattern[start], 3);
        }
        cursor = end;
        if cursor >= pattern.len() {
            break;
        }
    }
}

fn apply_structured_restatement_passes(pattern: &mut [i32], hint: &ExternalMelodyHint) {
    if pattern.len() < 6 || hint.hook_restatement_passes.is_empty() {
        return;
    }
    let motif_source = pattern[..pattern.len().min(4).max(2)].to_vec();
    let pass_count = hint.hook_restatement_passes.len().max(1);
    for (index, pass) in hint.hook_restatement_passes.iter().enumerate() {
        let start = ((index * pattern.len()) / pass_count).min(pattern.len().saturating_sub(1));
        let end = (((index + 1) * pattern.len()) / pass_count)
            .max(start + 1)
            .min(pattern.len());
        rewrite_restatement_pass_phrase(pattern, start, end, &motif_source, pass);
        shape_restatement_pass(pattern, start, end, pass);
        reinforce_restatement_sentence_role(pattern, start, end, pass, &motif_source);
    }
    smooth_melodic_motion(
        pattern,
        melody_leap_limit(hint),
        hint.motion_bias.as_deref(),
    );
}

#[derive(Debug, Clone, Copy)]
struct RestatementTimingProfile {
    duration_scale: f32,
    attack: f32,
    decay: f32,
    sustain: f32,
    release: f32,
    push_sec: f32,
}

#[derive(Debug, Clone, Copy)]
struct RestatementGateProfile {
    lead_gate: f32,
    lead_gain: f32,
    counter_duck: f32,
    pluck_duck: f32,
    bass_duck: f32,
    percussion_duck: f32,
}

fn restatement_timing_profile(
    hint: Option<&ExternalMelodyHint>,
    note_index: usize,
    subdivisions: usize,
    note_duration: f32,
    base_sustain: f32,
) -> RestatementTimingProfile {
    let mut profile = RestatementTimingProfile {
        duration_scale: 1.0,
        attack: 0.08,
        decay: 0.12,
        sustain: base_sustain,
        release: 0.18,
        push_sec: 0.0,
    };
    let Some(hint) = hint else {
        return profile;
    };
    let passes = &hint.hook_restatement_passes;
    if passes.is_empty() || subdivisions == 0 {
        return profile;
    }
    let pass_count = passes.len().max(1);
    let segment_index =
        ((note_index * pass_count) / subdivisions).min(pass_count.saturating_sub(1));
    let pass = &passes[segment_index];
    let role = pass.role.to_ascii_lowercase();
    let sustain_bias = pass.sustain_bias.to_ascii_lowercase();
    let landing_move = pass.landing_move.to_ascii_lowercase();
    let emphasizes_resolution =
        landing_move.contains("resolve") || landing_move.contains("cadence");
    let prepares_return = landing_move.contains("return") || landing_move.contains("prepare");
    let leaves_open = landing_move.contains("avoid")
        || landing_move.contains("defer")
        || landing_move.contains("open");
    let glides_or_overshoots = landing_move.contains("glide") || landing_move.contains("overshoot");

    if sustain_bias.contains("long") || sustain_bias.contains("stretched") {
        profile.duration_scale = 1.18;
        profile.attack = 0.05;
        profile.decay = 0.1;
        profile.sustain = (base_sustain + 0.16).clamp(0.35, 0.94);
        profile.release = 0.26;
    } else if sustain_bias.contains("clipped")
        || sustain_bias.contains("short")
        || sustain_bias.contains("trimmed")
    {
        profile.duration_scale = 0.78;
        profile.attack = 0.04;
        profile.decay = 0.08;
        profile.sustain = (base_sustain - 0.22).clamp(0.12, 0.72);
        profile.release = 0.12;
    } else if sustain_bias.contains("gentle") {
        profile.duration_scale = 1.08;
        profile.attack = 0.07;
        profile.sustain = (base_sustain + 0.08).clamp(0.3, 0.9);
        profile.release = 0.22;
    }

    if role.contains("answer") {
        profile.duration_scale *= 1.1;
        profile.push_sec -= note_duration * 0.045;
        profile.attack = profile.attack.min(0.05);
        profile.sustain = (profile.sustain + 0.08).clamp(0.32, 0.95);
        profile.release = (profile.release + 0.09).clamp(0.08, 0.36);
    } else if role.contains("tail") || role.contains("echo") {
        profile.push_sec += note_duration * 0.07;
        profile.duration_scale *= 0.86;
        profile.sustain = (profile.sustain - 0.04).clamp(0.14, 0.9);
        profile.release = (profile.release + 0.09).clamp(0.08, 0.36);
    } else if role.contains("deconstruction") {
        profile.push_sec -= note_duration * 0.04;
        profile.duration_scale *= 0.7;
        profile.sustain = (profile.sustain - 0.22).clamp(0.1, 0.72);
        profile.release = (profile.release - 0.04).clamp(0.06, 0.22);
    } else if role.contains("amplified") {
        profile.duration_scale *= 1.18;
        profile.attack = profile.attack.min(0.035);
        profile.sustain = (profile.sustain + 0.12).clamp(0.35, 0.97);
        profile.push_sec -= note_duration * 0.03;
        profile.release = (profile.release + 0.05).clamp(0.1, 0.36);
    } else if role.contains("fade") {
        profile.push_sec += note_duration * 0.04;
        profile.sustain = (profile.sustain - 0.16).clamp(0.1, 0.68);
    }

    if emphasizes_resolution {
        profile.duration_scale *= 1.06;
        profile.sustain = (profile.sustain + 0.04).clamp(0.22, 0.97);
        profile.release = (profile.release + 0.05).clamp(0.08, 0.36);
        profile.push_sec += note_duration * 0.02;
    } else if prepares_return {
        profile.attack = profile.attack.min(0.045);
        profile.duration_scale *= 1.03;
        profile.push_sec -= note_duration * 0.015;
    } else if leaves_open {
        profile.duration_scale *= 0.92;
        profile.sustain = (profile.sustain - 0.06).clamp(0.1, 0.9);
        profile.release = (profile.release - 0.02).clamp(0.06, 0.32);
    }

    if glides_or_overshoots {
        profile.attack = profile.attack.min(0.04);
        profile.duration_scale *= 1.04;
        profile.push_sec -= note_duration * 0.02;
        profile.release = (profile.release + 0.03).clamp(0.08, 0.34);
    }

    profile
}

fn landing_sentence_weight(landing_move: &str, note_progress: f32) -> (f32, f32, f32) {
    let progress = note_progress.clamp(0.0, 1.0);
    if landing_move.contains("resolve") || landing_move.contains("cadence") {
        let pickup = ((0.28 - progress) / 0.18).clamp(0.0, 1.0);
        let tail = ((0.98 - progress) / 0.26).clamp(0.0, 1.0);
        return (
            (0.9 + pickup * 0.16 + tail * 0.18).clamp(0.9, 1.24),
            (1.02 + tail * 0.08).clamp(1.02, 1.1),
            0.92,
        );
    }
    if landing_move.contains("return") || landing_move.contains("prepare") {
        let pickup = ((0.42 - progress) / 0.2).clamp(0.0, 1.0);
        return (
            (0.94 + pickup * 0.18).clamp(0.94, 1.14),
            (1.0 + pickup * 0.05).clamp(1.0, 1.05),
            0.96,
        );
    }
    if landing_move.contains("glide") || landing_move.contains("overshoot") {
        let front = ((0.36 - progress) / 0.18).clamp(0.0, 1.0);
        let tail = ((0.92 - progress) / 0.22).clamp(0.0, 1.0);
        return (
            (0.92 + front * 0.12 + tail * 0.12).clamp(0.92, 1.16),
            (1.01 + tail * 0.06).clamp(1.01, 1.07),
            0.94,
        );
    }
    if landing_move.contains("avoid")
        || landing_move.contains("defer")
        || landing_move.contains("open")
    {
        let clipped = ((0.56 - progress) / 0.18).clamp(0.0, 1.0);
        return (
            (0.8 + clipped * 0.18).clamp(0.8, 0.98),
            (0.94 + clipped * 0.02).clamp(0.94, 0.96),
            1.04,
        );
    }
    (1.0, 1.0, 1.0)
}

fn landing_ducking_weight(landing_move: &str, note_progress: f32) -> (f32, f32, f32, f32) {
    let progress = note_progress.clamp(0.0, 1.0);
    if landing_move.contains("resolve") || landing_move.contains("cadence") {
        let tail_focus = ((1.0 - progress) / 0.22).clamp(0.0, 1.0);
        return (
            (0.8 - tail_focus * 0.18).clamp(0.56, 0.8),
            (0.76 - tail_focus * 0.2).clamp(0.5, 0.76),
            (0.88 - tail_focus * 0.12).clamp(0.68, 0.88),
            (0.82 - tail_focus * 0.18).clamp(0.56, 0.82),
        );
    }
    if landing_move.contains("return") || landing_move.contains("prepare") {
        let pickup = ((0.86 - progress) / 0.26).clamp(0.0, 1.0);
        return (
            (0.86 - pickup * 0.14).clamp(0.66, 0.86),
            (0.84 - pickup * 0.16).clamp(0.62, 0.84),
            (0.92 - pickup * 0.08).clamp(0.76, 0.92),
            (0.9 - pickup * 0.1).clamp(0.74, 0.9),
        );
    }
    if landing_move.contains("glide") || landing_move.contains("overshoot") {
        let tail = ((0.96 - progress) / 0.24).clamp(0.0, 1.0);
        return (
            (0.84 - tail * 0.14).clamp(0.64, 0.84),
            (0.8 - tail * 0.16).clamp(0.58, 0.8),
            (0.9 - tail * 0.08).clamp(0.74, 0.9),
            (0.86 - tail * 0.12).clamp(0.68, 0.86),
        );
    }
    if landing_move.contains("avoid")
        || landing_move.contains("defer")
        || landing_move.contains("open")
    {
        return (1.02, 1.04, 0.98, 1.0);
    }
    (1.0, 1.0, 1.0, 1.0)
}

fn pass_role_ducking_weight(role: &str, note_progress: f32) -> (f32, f32, f32, f32) {
    let progress = note_progress.clamp(0.0, 1.0);
    if role.contains("main statement") {
        let apex = (1.0 - ((progress - 0.5).abs() / 0.5)).clamp(0.0, 1.0);
        return (
            (0.86 - apex * 0.16).clamp(0.64, 0.86),
            (0.82 - apex * 0.18).clamp(0.58, 0.82),
            (0.92 - apex * 0.08).clamp(0.76, 0.92),
            (0.9 - apex * 0.1).clamp(0.72, 0.9),
        );
    }
    if role.contains("answer") {
        let tail = ((1.0 - progress) / 0.28).clamp(0.0, 1.0);
        return (
            (0.8 - tail * 0.16).clamp(0.58, 0.8),
            (0.76 - tail * 0.18).clamp(0.52, 0.76),
            (0.9 - tail * 0.08).clamp(0.72, 0.9),
            (0.88 - tail * 0.1).clamp(0.7, 0.88),
        );
    }
    if role.contains("tail") || role.contains("echo") {
        let fade = ((1.0 - progress) / 0.22).clamp(0.0, 1.0);
        return (
            (0.74 - fade * 0.16).clamp(0.5, 0.74),
            (0.7 - fade * 0.18).clamp(0.46, 0.7),
            (0.86 - fade * 0.08).clamp(0.66, 0.86),
            (0.8 - fade * 0.12).clamp(0.58, 0.8),
        );
    }
    (1.0, 1.0, 1.0, 1.0)
}

fn restatement_gate_profile(
    hint: Option<&ExternalMelodyHint>,
    note_index: usize,
    subdivisions: usize,
    note_progress: f32,
) -> RestatementGateProfile {
    let mut profile = RestatementGateProfile {
        lead_gate: 1.0,
        lead_gain: 1.0,
        counter_duck: 1.0,
        pluck_duck: 1.0,
        bass_duck: 1.0,
        percussion_duck: 1.0,
    };
    let Some(hint) = hint else {
        return profile;
    };
    let passes = &hint.hook_restatement_passes;
    if passes.is_empty() || subdivisions == 0 {
        return profile;
    }
    let pass_count = passes.len().max(1);
    let segment_index =
        ((note_index * pass_count) / subdivisions).min(pass_count.saturating_sub(1));
    let pass = &passes[segment_index];
    let role = pass.role.to_ascii_lowercase();
    let sustain_bias = pass.sustain_bias.to_ascii_lowercase();
    let landing_move = pass.landing_move.to_ascii_lowercase();
    let progress = note_progress.clamp(0.0, 1.0);

    if sustain_bias.contains("clipped")
        || sustain_bias.contains("short")
        || sustain_bias.contains("trimmed")
    {
        let cutoff = ((0.58 - progress) / 0.18).clamp(0.0, 1.0);
        profile.lead_gate *= (0.14 + cutoff * 0.86).clamp(0.12, 1.0);
    } else if sustain_bias.contains("long")
        || sustain_bias.contains("stretched")
        || sustain_bias.contains("tail")
    {
        let tail_hold = ((0.94 - progress) / 0.3).clamp(0.0, 1.0);
        profile.lead_gate *= (0.36 + tail_hold * 0.64).clamp(0.34, 1.0);
    }

    if role.contains("amplified") {
        profile.lead_gain *= 1.3;
        let front_hold = ((0.96 - progress) / 0.28).clamp(0.0, 1.0);
        profile.lead_gate *= (0.4 + front_hold * 0.7).clamp(0.38, 1.0);
        profile.counter_duck *= 0.42;
        profile.pluck_duck *= 0.38;
        profile.bass_duck *= 0.7;
        profile.percussion_duck *= 0.72;
    } else if role.contains("answer") {
        profile.lead_gain *= 1.18;
        let hold = ((0.92 - progress) / 0.24).clamp(0.0, 1.0);
        profile.lead_gate *= (0.3 + hold * 0.74).clamp(0.28, 1.0);
        profile.counter_duck *= 0.54;
        profile.pluck_duck *= 0.5;
        profile.bass_duck *= 0.78;
        profile.percussion_duck *= 0.82;
    } else if role.contains("tail") || role.contains("echo") {
        let late_hold = ((0.98 - progress) / 0.36).clamp(0.0, 1.0);
        profile.lead_gate *= (0.32 + late_hold * 0.68).clamp(0.3, 1.0);
        profile.lead_gain *= 1.08;
        profile.counter_duck *= 0.44;
        profile.pluck_duck *= 0.4;
        profile.bass_duck *= 0.8;
        profile.percussion_duck *= 0.72;
    } else if role.contains("deconstruction") {
        let chopped = ((0.52 - progress) / 0.16).clamp(0.0, 1.0);
        profile.lead_gate *= (0.1 + chopped * 0.9).clamp(0.08, 1.0);
        profile.lead_gain *= 0.94;
        profile.counter_duck *= 0.6;
        profile.pluck_duck *= 0.54;
        profile.bass_duck *= 0.86;
        profile.percussion_duck *= 0.76;
    } else if role.contains("recall") {
        profile.lead_gain *= 1.04;
        profile.counter_duck *= 0.68;
        profile.pluck_duck *= 0.62;
        profile.bass_duck *= 0.9;
        profile.percussion_duck *= 0.88;
    } else if role.contains("fade") {
        let fade_tail = ((0.62 - progress) / 0.2).clamp(0.0, 1.0);
        profile.lead_gate *= (0.08 + fade_tail * 0.92).clamp(0.06, 1.0);
        profile.lead_gain *= 0.86;
        profile.counter_duck *= 0.74;
        profile.pluck_duck *= 0.7;
        profile.bass_duck *= 0.94;
        profile.percussion_duck *= 0.8;
    } else if role.contains("seed") {
        let pickup = ((0.48 - progress) / 0.18).clamp(0.0, 1.0);
        profile.lead_gate *= (0.12 + pickup * 0.88).clamp(0.1, 1.0);
        profile.lead_gain *= 0.92;
        profile.counter_duck *= 0.78;
        profile.pluck_duck *= 0.74;
        profile.percussion_duck *= 0.9;
    }

    if landing_move.contains("resolve") || landing_move.contains("cadence") {
        let late_hold = ((0.98 - progress) / 0.24).clamp(0.0, 1.0);
        profile.lead_gate *= (0.4 + late_hold * 0.6).clamp(0.38, 1.0);
        profile.lead_gain *= 1.04;
        profile.counter_duck *= 0.92;
        profile.pluck_duck *= 0.9;
        profile.percussion_duck *= 0.92;
    } else if landing_move.contains("return") || landing_move.contains("prepare") {
        let front_hold = ((0.88 - progress) / 0.22).clamp(0.0, 1.0);
        profile.lead_gate *= (0.34 + front_hold * 0.66).clamp(0.32, 1.0);
        profile.lead_gain *= 1.02;
    } else if landing_move.contains("avoid")
        || landing_move.contains("defer")
        || landing_move.contains("open")
    {
        profile.lead_gain *= 0.96;
        profile.counter_duck *= 1.04;
        profile.pluck_duck *= 1.06;
    }

    let (gate_weight, gain_weight, duck_weight) = landing_sentence_weight(&landing_move, progress);
    profile.lead_gate *= gate_weight;
    profile.lead_gain *= gain_weight;
    profile.counter_duck *= duck_weight;
    profile.pluck_duck *= duck_weight;
    profile.bass_duck *= duck_weight.min(1.02);
    profile.percussion_duck *= duck_weight.min(1.01);
    let (counter_weight, pluck_weight, bass_weight, percussion_weight) =
        landing_ducking_weight(&landing_move, progress);
    profile.counter_duck *= counter_weight;
    profile.pluck_duck *= pluck_weight;
    profile.bass_duck *= bass_weight;
    profile.percussion_duck *= percussion_weight;
    let (role_counter_weight, role_pluck_weight, role_bass_weight, role_percussion_weight) =
        pass_role_ducking_weight(&role, progress);
    profile.counter_duck *= role_counter_weight;
    profile.pluck_duck *= role_pluck_weight;
    profile.bass_duck *= role_bass_weight;
    profile.percussion_duck *= role_percussion_weight;

    profile
}

fn rewrite_restatement_pass_phrase(
    pattern: &mut [i32],
    start: usize,
    end: usize,
    motif_source: &[i32],
    pass: &ExternalRestatementPassHint,
) {
    if start >= end || motif_source.is_empty() {
        return;
    }
    let role = pass.role.to_ascii_lowercase();
    let register_shift = restatement_register_shift(&pass.register_bias);
    let span_len = end - start;

    for offset in 0..span_len {
        let idx = start + offset;
        let source = motif_source[offset % motif_source.len()];
        let restated = restated_motif_value(source, motif_source, offset, span_len, &role);
        pattern[idx] = smooth_degree_toward(pattern[idx], restated + register_shift, 5);
    }
}

fn restated_motif_value(
    source: i32,
    motif_source: &[i32],
    offset: usize,
    span_len: usize,
    role: &str,
) -> i32 {
    if role.contains("amplified") {
        let rise = if span_len > 0 && offset + 1 >= span_len {
            5
        } else {
            2
        };
        source + rise
    } else if role.contains("tail") || role.contains("echo") {
        let mirrored = motif_source[motif_source.len() - 1 - (offset % motif_source.len())];
        mirrored - if offset + 1 >= span_len { 2 } else { 1 }
    } else if role.contains("answer") {
        let answer_index = (offset + 1).min(motif_source.len().saturating_sub(1));
        motif_source[answer_index] - 2
    } else if role.contains("deconstruction") {
        let fragment = motif_source[offset % motif_source.len()];
        fragment + if offset % 2 == 0 { 1 } else { -2 }
    } else if role.contains("recall") {
        source - 1
    } else if role.contains("fade") {
        source - 2
    } else if role.contains("seed") {
        source - if offset + 1 >= span_len { 1 } else { 0 }
    } else {
        source
    }
}

fn apply_climax_shape(pattern: &mut [i32], hint: &ExternalMelodyHint) {
    if pattern.is_empty() {
        return;
    }
    let hook_strength = hint.hook_strength.unwrap_or(0.0);
    let should_lift = hook_strength >= 0.85 || hint.phrase_function.as_deref() == Some("hook");
    if !should_lift {
        return;
    }
    let climax_index = if let Some(climax_bar) = hint.climax_bar {
        ((climax_bar.saturating_sub(1) as usize).min(pattern.len().saturating_sub(1)))
            .max(pattern.len() / 2)
    } else {
        ((pattern.len() as f32 * 0.7).floor() as usize).min(pattern.len().saturating_sub(1))
    };
    let anchor = pattern[climax_index];
    let target = anchor + if hook_strength >= 0.92 { 7 } else { 5 };
    if target > pattern.iter().copied().max().unwrap_or(anchor) {
        pattern[climax_index] = target;
    }
}

fn apply_landing_tone(pattern: &mut [i32], hint: &ExternalMelodyHint) {
    let Some(last) = pattern.last_mut() else {
        return;
    };
    let target = match hint
        .landing_tone
        .as_deref()
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase()
        .as_str()
    {
        "tonic" | "authentic" | "resolve" | "resolved" => Some(0),
        "third" | "mediant" => Some(4),
        "fifth" | "dominant" | "half" => Some(7),
        "submediant" | "deceptive" => Some(9),
        "suspended" | "subdominant" => Some(5),
        _ => None,
    };
    let Some(target) = target else {
        return;
    };
    let register_floor = ((*last as f32) / 12.0).floor() as i32 * 12;
    let mut candidate = register_floor + target;
    while candidate - *last > 6 {
        candidate -= 12;
    }
    while *last - candidate > 6 {
        candidate += 12;
    }
    *last = candidate;
}

fn align_interval_to_pitch_class(reference: i32, target_pitch_class: i32) -> i32 {
    let mut candidate = ((reference as f32) / 12.0).floor() as i32 * 12 + target_pitch_class;
    while candidate - reference > 6 {
        candidate -= 12;
    }
    while reference - candidate > 6 {
        candidate += 12;
    }
    candidate
}

fn smooth_degree_toward(current: i32, target: i32, max_step: i32) -> i32 {
    let difference = target - current;
    if difference.abs() <= max_step {
        target
    } else {
        current + difference.signum() * max_step
    }
}

fn shape_restatement_pass(
    pattern: &mut [i32],
    start: usize,
    end: usize,
    pass: &ExternalRestatementPassHint,
) {
    if start >= end || end > pattern.len() {
        return;
    }

    let role = pass.role.to_ascii_lowercase();
    let sustain = pass.sustain_bias.to_ascii_lowercase();
    let landing = pass.landing_move.to_ascii_lowercase();
    let register_shift = restatement_register_shift(&pass.register_bias);
    let span_len = end - start;
    let head_anchor = pattern[start];
    let last_index = end - 1;
    let previous_head = if start >= 2 {
        Some(pattern[start - 2])
    } else {
        None
    };

    for offset in 0..span_len {
        let idx = start + offset;
        let progress = if span_len <= 1 {
            0.0
        } else {
            offset as f32 / (span_len - 1) as f32
        };
        let mut target = pattern[idx] + register_shift;
        target += restatement_role_curve_delta(&role, progress, register_shift);
        pattern[idx] = smooth_degree_toward(pattern[idx], target, 4);
        if offset > 0 && sustain.contains("long") {
            pattern[idx] = smooth_degree_toward(pattern[idx], pattern[idx - 1], 1);
        } else if sustain.contains("clipped")
            || sustain.contains("short")
            || sustain.contains("trimmed")
        {
            let accent = if offset % 2 == 0 { 1 } else { -1 };
            pattern[idx] += accent;
        }
    }

    if role.contains("echo") || role.contains("tail") {
        let echo_len = span_len.min(3);
        for offset in 0..echo_len {
            let source_index = start.saturating_sub(echo_len) + offset;
            if source_index < start {
                let idx = start + offset;
                let source = pattern[source_index];
                pattern[idx] = smooth_degree_toward(pattern[idx], source + register_shift, 3);
            }
        }
    } else if role.contains("recall") {
        for offset in 0..span_len.min(2) {
            let idx = start + offset;
            pattern[idx] = smooth_degree_toward(pattern[idx], head_anchor + register_shift, 2);
        }
    } else if role.contains("deconstruction") && span_len >= 3 {
        for offset in 1..span_len.saturating_sub(1) {
            let idx = start + offset;
            let polarity = if offset % 2 == 0 { -1 } else { 1 };
            pattern[idx] = smooth_degree_toward(pattern[idx], head_anchor + polarity * 2, 3);
        }
    } else if role.contains("answer") {
        if let Some(answer_target) = previous_head {
            pattern[last_index] = smooth_degree_toward(pattern[last_index], answer_target, 3);
        }
    }

    let landing_target =
        landing_target_for_pass(pattern, start, end, &role, &landing, register_shift);
    pattern[last_index] = smooth_degree_toward(pattern[last_index], landing_target, 3);
    apply_restatement_phrase_punctuation(pattern, start, end, &role, &landing, register_shift);

    if sustain.contains("long tail") && span_len >= 2 {
        let penultimate = pattern[last_index - 1];
        pattern[last_index] = smooth_degree_toward(pattern[last_index], penultimate, 1);
    }
}

fn reinforce_restatement_sentence_role(
    pattern: &mut [i32],
    start: usize,
    end: usize,
    pass: &ExternalRestatementPassHint,
    motif_source: &[i32],
) {
    if end <= start || end > pattern.len() {
        return;
    }
    let role = pass.role.to_ascii_lowercase();
    let span_len = end - start;
    let last_index = end - 1;
    let head_anchor = pattern[start];

    if role.contains("main statement") {
        let apex_index = start + (span_len / 2).min(span_len.saturating_sub(1));
        let motif_peak = motif_source.iter().copied().max().unwrap_or(head_anchor);
        pattern[start] = smooth_degree_toward(pattern[start], head_anchor, 1);
        pattern[apex_index] = smooth_degree_toward(pattern[apex_index], motif_peak + 2, 2);
        if apex_index > start {
            pattern[apex_index - 1] =
                smooth_degree_toward(pattern[apex_index - 1], pattern[apex_index] - 1, 2);
        }
        pattern[last_index] = smooth_degree_toward(pattern[last_index], head_anchor + 1, 2);
    } else if role.contains("answer") {
        let answer_floor = motif_source
            .iter()
            .copied()
            .min()
            .unwrap_or(head_anchor)
            .min(head_anchor);
        pattern[start] = smooth_degree_toward(pattern[start], head_anchor + 1, 2);
        for idx in (start + 1)..end {
            let progress = (idx - start) as f32 / span_len.max(1) as f32;
            let target = if progress < 0.5 {
                head_anchor
            } else {
                answer_floor - 1
            };
            pattern[idx] = smooth_degree_toward(pattern[idx], target, 2);
        }
        pattern[last_index] = smooth_degree_toward(pattern[last_index], answer_floor - 1, 2);
    } else if role.contains("echo") || role.contains("tail") {
        let echo_source = motif_source
            .iter()
            .rev()
            .copied()
            .take(span_len.max(2))
            .collect::<Vec<_>>();
        for (offset, idx) in (start..end).enumerate() {
            let mirrored = echo_source
                .get(offset.min(echo_source.len().saturating_sub(1)))
                .copied()
                .unwrap_or(head_anchor);
            let release_target = mirrored - 2 - (offset as i32 / 2);
            pattern[idx] = smooth_degree_toward(pattern[idx], release_target, 2);
        }
        if span_len >= 2 {
            pattern[last_index - 1] =
                smooth_degree_toward(pattern[last_index - 1], pattern[last_index] + 1, 1);
        }
    }
}

fn restatement_register_shift(register_bias: &str) -> i32 {
    let register = register_bias.trim().to_ascii_lowercase();
    if register.contains("mid-high") || register.contains("upper-mid") {
        1
    } else if register.contains("high") {
        2
    } else if register.contains("mid-low") {
        -1
    } else if register.contains("low") {
        -2
    } else {
        0
    }
}

fn restatement_role_curve_delta(role: &str, progress: f32, register_shift: i32) -> i32 {
    let direction = if register_shift < 0 { -1 } else { 1 };
    if role.contains("amplified") {
        if progress >= 0.75 {
            3 * direction
        } else if progress >= 0.4 {
            2 * direction
        } else {
            direction
        }
    } else if role.contains("main statement") {
        if progress >= 0.66 {
            1
        } else {
            0
        }
    } else if role.contains("tail") || role.contains("echo") {
        if progress >= 0.66 {
            -1
        } else {
            0
        }
    } else if role.contains("deconstruction") {
        if progress >= 0.5 {
            -2
        } else {
            1
        }
    } else if role.contains("answer") {
        if progress >= 0.66 {
            -2
        } else {
            0
        }
    } else if role.contains("fade") {
        -1
    } else if role.contains("recall") {
        if progress >= 0.5 {
            -1
        } else {
            0
        }
    } else if role.contains("seed") {
        if progress <= 0.33 {
            1
        } else {
            0
        }
    } else {
        0
    }
}

fn landing_target_for_pass(
    pattern: &[i32],
    start: usize,
    end: usize,
    role: &str,
    landing: &str,
    register_shift: i32,
) -> i32 {
    let last_index = end - 1;
    let head_anchor = pattern[start];
    if landing.contains("overshoot") {
        head_anchor + register_shift + 4
    } else if landing.contains("glide") {
        pattern[last_index.saturating_sub(1)] - 1
    } else if landing.contains("dissolve") {
        pattern[last_index.saturating_sub(1)] - 2
    } else if landing.contains("avoid root") {
        head_anchor + 2
    } else if landing.contains("prepare return") {
        head_anchor + 1
    } else if landing.contains("hook root") {
        head_anchor
    } else if landing.contains("touch the hook outline") {
        head_anchor + register_shift
    } else if landing.contains("defer cadence") || landing.contains("leave open") {
        head_anchor + 2
    } else if role.contains("answer") {
        head_anchor - 1
    } else {
        pattern[last_index]
    }
}

fn apply_restatement_phrase_punctuation(
    pattern: &mut [i32],
    start: usize,
    end: usize,
    role: &str,
    landing: &str,
    register_shift: i32,
) {
    if end <= start || end > pattern.len() {
        return;
    }
    let last_index = end - 1;
    let head_anchor = pattern[start];
    if end - start >= 2 {
        let penultimate_index = last_index - 1;
        if landing.contains("resolve")
            || landing.contains("cadence")
            || landing.contains("hook root")
        {
            let penultimate_target = pattern[last_index] + 2;
            pattern[penultimate_index] =
                smooth_degree_toward(pattern[penultimate_index], penultimate_target, 2);
            pattern[last_index] = smooth_degree_toward(pattern[last_index], head_anchor, 2);
        } else if landing.contains("return") || landing.contains("prepare") {
            let penultimate_target = head_anchor + register_shift + 2;
            let landing_target = head_anchor + register_shift + 1;
            pattern[penultimate_index] =
                smooth_degree_toward(pattern[penultimate_index], penultimate_target, 2);
            pattern[last_index] = smooth_degree_toward(pattern[last_index], landing_target, 2);
        } else if landing.contains("glide") || landing.contains("overshoot") {
            let penultimate_target = head_anchor + register_shift + 3;
            pattern[penultimate_index] =
                smooth_degree_toward(pattern[penultimate_index], penultimate_target, 2);
        } else if landing.contains("avoid")
            || landing.contains("defer")
            || landing.contains("open")
            || landing.contains("dissolve")
        {
            let penultimate_target = head_anchor + register_shift + 1;
            let landing_target = head_anchor + register_shift + 2;
            pattern[penultimate_index] =
                smooth_degree_toward(pattern[penultimate_index], penultimate_target, 2);
            pattern[last_index] = smooth_degree_toward(pattern[last_index], landing_target, 2);
        }
    }

    if end - start >= 3 {
        let antepenultimate_index = last_index - 2;
        if role.contains("answer") {
            let answer_pickup = head_anchor + register_shift + 1;
            pattern[antepenultimate_index] =
                smooth_degree_toward(pattern[antepenultimate_index], answer_pickup, 2);
        } else if role.contains("echo") || role.contains("tail") || role.contains("fade") {
            let echo_release = pattern[last_index] + 1;
            pattern[antepenultimate_index] =
                smooth_degree_toward(pattern[antepenultimate_index], echo_release, 2);
        } else if role.contains("amplified") {
            let apex_pickup = head_anchor + register_shift + 3;
            pattern[antepenultimate_index] =
                smooth_degree_toward(pattern[antepenultimate_index], apex_pickup, 2);
        }
    }
}

fn cadence_target_pitch_class(cadence: &str, voice: &str) -> Option<i32> {
    match cadence {
        "authentic" | "resolved" => match voice {
            "counter" => Some(4),
            "pluck" => Some(7),
            "bass" => Some(0),
            _ => Some(0),
        },
        "plagal" => match voice {
            "counter" => Some(5),
            "pluck" => Some(9),
            "bass" => Some(5),
            _ => Some(5),
        },
        "half" => Some(7),
        "deceptive" => match voice {
            "counter" => Some(4),
            "pluck" | "bass" => Some(9),
            _ => Some(9),
        },
        "open" => match voice {
            "counter" => Some(2),
            "pluck" | "bass" => Some(7),
            _ => Some(2),
        },
        _ => None,
    }
}

fn closest_chord_interval(reference: i32, intervals: &[i32], octave_lift: i32) -> i32 {
    let source = if intervals.is_empty() {
        &[0, 4, 7][..]
    } else {
        intervals
    };
    let mut best = reference;
    let mut best_distance = i32::MAX;
    for interval in source {
        for octave in -1..=2 {
            let candidate = interval + octave_lift + octave * 12;
            let distance = (candidate - reference).abs();
            if distance < best_distance {
                best = candidate;
                best_distance = distance;
            }
        }
    }
    best
}

fn counterline_role_label(segment: &PhraseSegment) -> &str {
    segment
        .melody_hint
        .as_ref()
        .and_then(|hint| hint.counterline_role.as_deref())
        .unwrap_or("none")
}

fn counterline_phrase_function_label(segment: &PhraseSegment) -> &str {
    segment
        .melody_hint
        .as_ref()
        .and_then(|hint| hint.phrase_function.as_deref())
        .unwrap_or("statement")
}

fn counterline_hook_strength(segment: &PhraseSegment) -> f32 {
    segment
        .melody_hint
        .as_ref()
        .and_then(|hint| hint.hook_strength)
        .unwrap_or(0.0)
}

fn select_counter_interval_for_step(
    segment: &PhraseSegment,
    chord_frame: &ChordFrame,
    lead_degree: i32,
    note_index: usize,
    note_duration: f32,
    subdivisions: usize,
) -> i32 {
    let pattern = if segment.counter_pattern.is_empty() {
        &[0, 4, 7, 4][..]
    } else {
        segment.counter_pattern
    };
    let counter_note_index =
        (note_index as f32 * (subdivisions as f32 / pattern.len() as f32)).floor() as usize;
    let mut interval = pattern[counter_note_index % pattern.len()];
    let total_steps = subdivisions.max(1);
    let step = note_index % total_steps;
    let cadence = cadence_intent_label(segment);
    let role = counterline_role_label(segment);

    if let Some(hint) = segment.melody_hint.as_ref() {
        if hint.antecedent_phrase_id.is_some() && step >= total_steps / 2 {
            let answer_target = match role {
                "call_response" => {
                    closest_chord_interval(lead_degree + 2, chord_frame.intervals, 12)
                }
                _ => closest_chord_interval(lead_degree - 3, chord_frame.intervals, 0),
            };
            interval = smooth_degree_toward(interval, answer_target, 5);
        }
        match role {
            "octave_doubles" => {
                let support_target =
                    closest_chord_interval(lead_degree - 12, chord_frame.intervals, 0);
                interval = smooth_degree_toward(interval, support_target, 4);
            }
            "echo_answer" => {
                let support_target =
                    closest_chord_interval(lead_degree - 7, chord_frame.intervals, 0);
                interval = smooth_degree_toward(interval, support_target, 4);
            }
            "call_response" => {
                let response_target =
                    closest_chord_interval(lead_degree + 4, chord_frame.intervals, 12);
                interval = smooth_degree_toward(interval, response_target, 5);
            }
            _ => {}
        }
    }

    if step >= total_steps.saturating_sub(2) {
        if let Some(target_pc) = cadence_target_pitch_class(cadence, "counter") {
            let target = align_interval_to_pitch_class(interval, target_pc);
            interval = if step == total_steps.saturating_sub(1) {
                target
            } else {
                smooth_degree_toward(interval, target, 3)
            };
        }
    }

    let _ = note_duration;
    interval
}

fn select_pluck_interval_for_step(
    segment: &PhraseSegment,
    chord_frame: &ChordFrame,
    lead_pattern: &[i32],
    note_index: usize,
    subdivisions: usize,
) -> i32 {
    let len = lead_pattern.len().max(1);
    let mut interval = lead_pattern[note_index % len] + 12;
    let total_steps = subdivisions.max(1);
    let step = note_index % total_steps;
    let cadence = cadence_intent_label(segment);
    let role = counterline_role_label(segment);

    if let Some(hint) = segment.melody_hint.as_ref() {
        if hint.antecedent_phrase_id.is_some() && step >= total_steps / 2 {
            let motif_idx = step % len.min(4).max(2);
            let echoed = match role {
                "call_response" => lead_pattern[motif_idx] + 7,
                "octave_doubles" => lead_pattern[motif_idx] + 12,
                _ => lead_pattern[motif_idx] + 12,
            };
            let support_target = closest_chord_interval(
                echoed,
                chord_frame.intervals,
                if role == "call_response" { 0 } else { 12 },
            );
            interval = smooth_degree_toward(interval, support_target, 4);
        }
    }

    if step >= total_steps.saturating_sub(2) {
        if let Some(target_pc) = cadence_target_pitch_class(cadence, "pluck") {
            let target = align_interval_to_pitch_class(interval, target_pc);
            interval = if step == total_steps.saturating_sub(1) {
                target
            } else {
                smooth_degree_toward(interval, target, 3)
            };
        }
    } else {
        let support_target = match role {
            "call_response" => {
                closest_chord_interval(lead_pattern[step % len] + 7, chord_frame.intervals, 0)
            }
            "echo_answer" => closest_chord_interval(interval, chord_frame.intervals, 7),
            _ => closest_chord_interval(interval, chord_frame.intervals, 12),
        };
        interval = smooth_degree_toward(interval, support_target, 5);
    }

    interval
}

fn select_bass_chord_index_for_step(
    segment: &PhraseSegment,
    held_index: usize,
    target_index: usize,
    note_index: usize,
    subdivisions: usize,
) -> usize {
    let cadence = cadence_intent_label(segment);
    let total_steps = subdivisions.max(1);
    let step = note_index % total_steps;
    let max_index = segment.progression.len().saturating_sub(1);
    let role = counterline_role_label(segment);

    if step >= total_steps.saturating_sub(2) {
        return match cadence {
            "deceptive" => target_index.min(max_index),
            "half" => held_index.min(max_index),
            _ => target_index.min(max_index),
        };
    }

    if segment
        .melody_hint
        .as_ref()
        .and_then(|hint| hint.antecedent_phrase_id.as_ref())
        .is_some()
        && step >= total_steps / 2
    {
        if role == "call_response" {
            return target_index.min(max_index);
        }
        return held_index.min(max_index);
    }

    held_index.min(max_index)
}

fn select_lead_degree_for_step(
    segment: &PhraseSegment,
    pattern: &[i32],
    note_index: usize,
    _subdivisions: usize,
) -> i32 {
    if pattern.is_empty() {
        return 0;
    }
    let len = pattern.len();
    let idx = note_index % len;
    let mut degree = pattern[idx];
    let cadence = cadence_intent_label(segment);
    let steps_remaining = len.saturating_sub(idx + 1);

    if let Some(hint) = segment.melody_hint.as_ref() {
        if hint.antecedent_phrase_id.is_some() && len >= 6 {
            let motif_len = (len / 2).clamp(2, 4);
            let consequent_start = len.saturating_sub(motif_len + 2);
            if idx >= consequent_start && idx < consequent_start + motif_len {
                let motif_idx = idx - consequent_start;
                let source = pattern[motif_idx];
                degree = smooth_degree_toward(source, degree, 4);
            }
        }
    }

    if steps_remaining == 1 {
        let landing = pattern[len - 1];
        let approach_target = match cadence {
            "authentic" | "resolved" | "plagal" => smooth_degree_toward(degree, landing, 2),
            "half" => align_interval_to_pitch_class(degree, 7),
            "deceptive" => align_interval_to_pitch_class(degree, 9),
            _ => smooth_degree_toward(degree, landing, 4),
        };
        degree = approach_target;
    } else if steps_remaining == 0 {
        degree = match cadence {
            "half" => align_interval_to_pitch_class(degree, 7),
            "deceptive" => align_interval_to_pitch_class(degree, 9),
            "open" if degree.rem_euclid(12) == 0 => degree + 2,
            _ => degree,
        };
    }

    degree
}

fn melody_support_profile(
    segment: &PhraseSegment,
    note_index: usize,
    subdivisions: usize,
) -> MelodySupportProfile {
    let total_steps = subdivisions.max(1);
    let step = note_index % total_steps;
    let cadence = cadence_intent_label(segment);
    let mut profile = MelodySupportProfile {
        counter_gain: 1.0,
        pluck_gain: 1.0,
        strings_gain: 1.0,
        pad_duck: 1.0,
        bass_duck: 1.0,
        percussion_gate: 1.0,
    };

    if let Some(hint) = segment.melody_hint.as_ref() {
        let strong_hook = hint.hook_strength.unwrap_or(0.0) >= 0.84
            || hint.phrase_function.as_deref() == Some("hook");
        if strong_hook {
            profile.counter_gain *= 0.8;
            profile.strings_gain *= 0.86;
            profile.pad_duck *= 0.78;
            profile.bass_duck *= 0.9;
            profile.percussion_gate *= 0.9;
        }
        if hint.antecedent_phrase_id.is_some() && step >= total_steps / 2 {
            profile.counter_gain *= 0.78;
            profile.pluck_gain *= 0.84;
            profile.strings_gain *= 0.9;
            profile.pad_duck *= 0.92;
            profile.bass_duck *= 0.94;
        }
    }

    let final_window_start = total_steps.saturating_sub(2);
    if step >= final_window_start {
        match cadence {
            "authentic" | "resolved" | "plagal" => {
                profile.counter_gain *= 0.62;
                profile.pluck_gain *= 0.68;
                profile.strings_gain *= 0.78;
                profile.pad_duck *= 0.84;
                profile.bass_duck *= 0.9;
                profile.percussion_gate *= 0.74;
            }
            "half" => {
                profile.counter_gain *= 0.74;
                profile.pluck_gain *= 0.76;
                profile.strings_gain *= 0.88;
                profile.pad_duck *= 0.9;
                profile.percussion_gate *= 0.86;
            }
            "deceptive" => {
                profile.counter_gain *= 0.7;
                profile.pluck_gain *= 0.74;
                profile.strings_gain *= 0.84;
                profile.pad_duck *= 0.88;
                profile.bass_duck *= 0.92;
                profile.percussion_gate *= 0.82;
            }
            _ => {}
        }
    }

    profile
}

fn counterline_motion_profile(
    segment: &PhraseSegment,
    note_index: usize,
    note_duration: f32,
    subdivisions: usize,
) -> CounterlineMotionProfile {
    let total_steps = subdivisions.max(1);
    let step = note_index % total_steps;
    let second_half = step >= total_steps / 2;
    let role = counterline_role_label(segment);
    let rhythm_template = counterline_rhythm_template(segment);
    let pattern_family = counterline_pattern_family(rhythm_template);
    let cycle_steps = counterline_template_cycle_steps(rhythm_template, total_steps);
    let cycle_pos = counterline_template_cycle_position(rhythm_template, note_index, total_steps);
    let cycle_pulse = counterline_template_pulse(rhythm_template, cycle_pos, cycle_steps);
    let family_gate = counterline_pattern_family_gate(pattern_family, cycle_pos, cycle_steps);
    let family_cycle_steps = counterline_pattern_family_cycle_steps(pattern_family, total_steps);
    let family_cycle_pos =
        counterline_pattern_family_cycle_position(pattern_family, note_index, total_steps);
    let family_pulse =
        counterline_pattern_family_pulse(pattern_family, family_cycle_pos, family_cycle_steps);
    let mut profile = CounterlineMotionProfile {
        counter_step_gate: 1.0,
        pluck_step_gate: 1.0,
        counter_push_sec: 0.0,
        pluck_push_sec: 0.0,
    };
    let eighth_step = total_steps.max(2) / 2;
    let response_offbeat = eighth_step > 0 && step % eighth_step == eighth_step / 2;
    let strong_beat = step % eighth_step == 0;

    match rhythm_template {
        CounterlineRhythmTemplate::LateEcho => {
            if !second_half {
                profile.counter_step_gate *= 0.2;
                profile.pluck_step_gate *= 0.16;
            } else {
                let cycle_late = cycle_pos >= cycle_steps.saturating_sub(1);
                profile.counter_step_gate *= if cycle_late {
                    1.04
                } else if strong_beat {
                    0.38
                } else {
                    0.72
                };
                profile.pluck_step_gate *= if response_offbeat || cycle_late {
                    0.92
                } else {
                    0.22
                };
                profile.counter_push_sec += note_duration * 0.1;
                profile.pluck_push_sec += note_duration * 0.06;
            }
        }
        CounterlineRhythmTemplate::OffbeatAnswer => {
            if !second_half {
                profile.counter_step_gate *= if strong_beat { 0.5 } else { 0.24 };
                profile.pluck_step_gate *= if strong_beat { 0.36 } else { 0.14 };
            } else {
                let cycle_pickup = cycle_pos == cycle_steps.saturating_sub(1);
                profile.counter_step_gate *= if response_offbeat || cycle_pickup {
                    1.22
                } else {
                    0.64
                };
                profile.pluck_step_gate *= if response_offbeat || cycle_pickup {
                    1.08
                } else {
                    0.48
                };
                profile.counter_push_sec -= note_duration * 0.04;
                profile.pluck_push_sec += note_duration * 0.03;
            }
        }
        CounterlineRhythmTemplate::StrongDouble => {
            let cycle_downbeat = cycle_pos == 0;
            profile.counter_step_gate *= if strong_beat && cycle_downbeat {
                1.18
            } else {
                0.68
            };
            profile.pluck_step_gate *= if strong_beat && cycle_downbeat {
                0.82
            } else {
                0.34
            };
            profile.counter_push_sec -= note_duration * 0.03;
            profile.pluck_push_sec += note_duration * 0.02;
        }
        CounterlineRhythmTemplate::HookDouble => {
            let cycle_downbeat = cycle_pos == 0;
            let cycle_pickup = cycle_pos == cycle_steps.saturating_sub(1);
            profile.counter_step_gate *= if cycle_downbeat {
                1.26
            } else if response_offbeat || cycle_pickup {
                0.94
            } else {
                0.42
            };
            profile.pluck_step_gate *= if cycle_downbeat || cycle_pickup {
                0.94
            } else if response_offbeat {
                0.74
            } else {
                0.28
            };
            profile.counter_push_sec -= note_duration * 0.05;
            profile.pluck_push_sec += note_duration * 0.01;
        }
        CounterlineRhythmTemplate::HookPickup => {
            let cycle_pickup = cycle_pos == cycle_steps.saturating_sub(1);
            profile.counter_step_gate *= if cycle_pickup || response_offbeat {
                1.18
            } else if strong_beat {
                0.48
            } else {
                0.24
            };
            profile.pluck_step_gate *= if cycle_pickup {
                0.92
            } else if response_offbeat {
                0.72
            } else {
                0.2
            };
            profile.counter_push_sec -= note_duration * 0.06;
            profile.pluck_push_sec += note_duration * 0.02;
        }
        CounterlineRhythmTemplate::CadenceSuspension => {
            let final_window = step >= total_steps.saturating_sub(2);
            if !second_half {
                profile.counter_step_gate *= 0.18;
                profile.pluck_step_gate *= 0.12;
            } else {
                let cycle_late = cycle_pos >= cycle_steps.saturating_sub(2);
                profile.counter_step_gate *= if final_window {
                    1.12
                } else if cycle_late || response_offbeat {
                    0.82
                } else {
                    0.34
                };
                profile.pluck_step_gate *= if final_window {
                    0.18
                } else if cycle_late {
                    0.36
                } else {
                    0.14
                };
                profile.counter_push_sec += note_duration * 0.12;
                profile.pluck_push_sec += note_duration * 0.08;
            }
        }
        CounterlineRhythmTemplate::RippleAnswer => {
            let ripple_step = cycle_pos % 2 == 1;
            profile.counter_step_gate *= if ripple_step || response_offbeat {
                0.96
            } else if strong_beat {
                0.56
            } else {
                0.3
            };
            profile.pluck_step_gate *= if ripple_step {
                0.54
            } else if response_offbeat {
                0.42
            } else {
                0.2
            };
            profile.counter_push_sec -= note_duration * 0.02;
            profile.pluck_push_sec += note_duration * 0.01;
        }
        CounterlineRhythmTemplate::Neutral => {
            if role == "call_response" && second_half {
                profile.counter_step_gate *= 0.92;
                profile.pluck_step_gate *= 0.76;
            }
        }
    }

    match pattern_family {
        CounterlinePatternFamily::EchoTail => {
            profile.counter_step_gate *= cycle_pulse * family_gate * family_pulse * 0.96;
            profile.pluck_step_gate *= (cycle_pulse * family_gate * family_pulse).clamp(0.55, 0.96);
        }
        CounterlinePatternFamily::AnswerOffbeat => {
            profile.counter_step_gate *= cycle_pulse * family_gate * family_pulse * 1.04;
            profile.pluck_step_gate *= (cycle_pulse * family_gate * family_pulse).clamp(0.62, 1.1);
        }
        CounterlinePatternFamily::HookSupport => {
            profile.counter_step_gate *= cycle_pulse * family_gate * family_pulse * 1.08;
            profile.pluck_step_gate *= (cycle_pulse * family_gate * family_pulse).clamp(0.68, 1.12);
        }
        CounterlinePatternFamily::CadenceHold => {
            profile.counter_step_gate *= cycle_pulse * family_gate * family_pulse;
            profile.pluck_step_gate *= (cycle_pulse * family_gate * family_pulse).clamp(0.45, 0.86);
        }
        CounterlinePatternFamily::Ripple => {
            profile.counter_step_gate *= cycle_pulse * family_gate * family_pulse;
            profile.pluck_step_gate *= (cycle_pulse * family_gate * family_pulse).clamp(0.58, 0.92);
        }
        CounterlinePatternFamily::Neutral => {
            profile.counter_step_gate *= cycle_pulse * family_gate * family_pulse;
            profile.pluck_step_gate *= (cycle_pulse * family_gate * family_pulse).clamp(0.55, 1.08);
        }
    }

    profile
}

fn counterline_rhythm_template(segment: &PhraseSegment) -> CounterlineRhythmTemplate {
    let role = counterline_role_label(segment);
    let phrase_function = counterline_phrase_function_label(segment);
    let hook_strength = counterline_hook_strength(segment);
    let cadence = cadence_intent_label(segment);
    match role {
        "echo_answer" => {
            if matches!(cadence, "half" | "open") || matches!(phrase_function, "lift" | "cadence") {
                CounterlineRhythmTemplate::CadenceSuspension
            } else {
                CounterlineRhythmTemplate::LateEcho
            }
        }
        "call_response" => {
            if phrase_function == "hook" || hook_strength >= 0.92 {
                CounterlineRhythmTemplate::HookPickup
            } else {
                CounterlineRhythmTemplate::OffbeatAnswer
            }
        }
        "octave_doubles" => {
            if phrase_function == "hook" || hook_strength >= 0.88 {
                CounterlineRhythmTemplate::HookDouble
            } else {
                CounterlineRhythmTemplate::StrongDouble
            }
        }
        _ => {
            if matches!(phrase_function, "answer" | "lift") {
                CounterlineRhythmTemplate::RippleAnswer
            } else {
                CounterlineRhythmTemplate::Neutral
            }
        }
    }
}

fn lead_voice(freq: f32, t: f32, env: f32, energy: SegmentEnergy) -> f32 {
    let vibrato_rate = match energy {
        SegmentEnergy::Low => 4.3,
        SegmentEnergy::Medium => 4.8,
        SegmentEnergy::High => 5.4,
        SegmentEnergy::Peak => 5.9,
    };
    let vibrato_depth = match energy {
        SegmentEnergy::Low => 0.0025,
        SegmentEnergy::Medium => 0.0032,
        SegmentEnergy::High => 0.004,
        SegmentEnergy::Peak => 0.0048,
    };
    let mod_freq = freq * (1.0 + (TWO_PI * vibrato_rate * t).sin() * vibrato_depth);
    let fundamental = (TWO_PI * mod_freq * t).sin();
    let octave = (TWO_PI * mod_freq * 2.0 * t).sin() * 0.32;
    let super_octave = (TWO_PI * mod_freq * 4.0 * t).sin() * 0.08;
    let breath = (TWO_PI * mod_freq * 0.5 * t).sin() * 0.18;
    (fundamental * 0.52 + octave + super_octave + breath) * env * 0.48
}

fn counter_voice(
    root_hz: f32,
    pattern: &[i32],
    local_t: f32,
    note_duration: f32,
    energy: SegmentEnergy,
    style: ArrangementStyle,
    tail_gate: f32,
    semitone_offset: f32,
) -> f32 {
    let tail_gate = tail_gate.clamp(0.0, 1.0);
    let note_index = (local_t / note_duration.max(0.1)).floor() as usize;
    let interval = pattern[note_index % pattern.len()];
    let note_t = local_t % note_duration.max(0.1);
    let env = adsr(note_t, note_duration.max(0.1), 0.12, 0.14, 0.52, 0.2);
    let freq = root_hz * 2.0_f32.powf((interval as f32 + semitone_offset) / 12.0);
    match style {
        ArrangementStyle::Piano => {
            ((TWO_PI * freq * note_t).sin() * 0.4 + (TWO_PI * freq * 2.0 * note_t).sin() * 0.12)
                * env
                * 0.24
        }
        ArrangementStyle::Strings => {
            ((TWO_PI * freq * note_t).sin() * 0.32
                + (TWO_PI * freq * 1.5 * note_t).sin() * 0.18
                + (TWO_PI * freq * 2.0 * note_t).sin() * 0.08)
                * env
                * 0.22
        }
        ArrangementStyle::Synth => {
            ((TWO_PI * freq * note_t).sin().signum() * 0.18
                + (TWO_PI * freq * 2.0 * note_t).sin() * 0.14
                + (TWO_PI * freq * 0.5 * note_t).sin() * 0.09)
                * env
                * 0.26
        }
        ArrangementStyle::Guofeng => {
            (low_dizi_counter_voice(freq, note_t) + bamboo_air_voice(freq, note_t) * 0.32)
                * env
                * tail_gate
                * if energy == SegmentEnergy::Peak {
                    0.28
                } else {
                    0.22
                }
        }
    }
}

fn strings_voice(
    root_hz: f32,
    intervals: &[i32],
    t: f32,
    energy: SegmentEnergy,
    style: ArrangementStyle,
    settle: f32,
) -> f32 {
    let mut sum = 0.0_f32;
    let long_bow = settle.clamp(0.0, 1.0);
    let bow_rate = match style {
        ArrangementStyle::Guofeng => 0.16 - long_bow * 0.11,
        _ => 0.18 - long_bow * 0.09,
    };
    let bow_depth = match style {
        ArrangementStyle::Guofeng => 0.0034 - long_bow * 0.0025,
        _ => 0.004 - long_bow * 0.0026,
    };
    let bow_motion = 1.0 + (TWO_PI * bow_rate.max(0.05) * t).sin() * bow_depth.max(0.0006);
    for (idx, interval) in intervals.iter().enumerate() {
        let octave_lift = if idx % 2 == 0 { 12.0 } else { 24.0 };
        let freq = root_hz * 2.0_f32.powf((*interval as f32 + octave_lift) / 12.0) * bow_motion;
        let phase = idx as f32 * 0.37;
        let (core, under, rasp) = match style {
            ArrangementStyle::Guofeng => {
                let silk = (TWO_PI * freq * t + phase).sin() * (0.096 + long_bow * 0.034);
                let veil = (TWO_PI * freq * (0.34 - long_bow * 0.12).max(0.14) * t + phase * 0.44)
                    .sin()
                    * (0.084 + long_bow * 0.052);
                let scrape = (TWO_PI * freq * 1.08 * t + phase * 0.14).sin()
                    * (0.018 - long_bow * 0.015).max(0.0012);
                let drag = (TWO_PI * freq * (0.16 - long_bow * 0.06).max(0.06) * t + phase * 0.18)
                    .sin()
                    * (0.012 + long_bow * 0.03);
                (silk + drag, veil, scrape)
            }
            _ => {
                let core = (TWO_PI * freq * t + phase).sin() * (0.11 + long_bow * 0.03);
                let under = (TWO_PI * freq * (0.5 - long_bow * 0.08).max(0.28) * t + phase * 0.5)
                    .sin()
                    * (0.08 + long_bow * 0.03);
                let rasp = (TWO_PI * freq * 1.5 * t + phase * 0.2).sin()
                    * (0.03 - long_bow * 0.018).max(0.006);
                (core, under, rasp)
            }
        };
        sum += core + under + rasp;
    }
    let energy_gain = match energy {
        SegmentEnergy::Low => 0.58,
        SegmentEnergy::Medium => 0.66,
        SegmentEnergy::High => 0.76,
        SegmentEnergy::Peak => 0.88,
    };
    let style_gain = match style {
        ArrangementStyle::Piano => 0.72,
        ArrangementStyle::Strings => 1.0,
        ArrangementStyle::Synth => 0.78,
        ArrangementStyle::Guofeng => 0.72,
    };
    let settle_gain = match style {
        ArrangementStyle::Guofeng => 1.0 + long_bow * 0.1,
        _ => 1.0 + long_bow * 0.06,
    };
    sum * energy_gain * style_gain * settle_gain
}

fn pluck_voice(
    root_hz: f32,
    pattern: &[i32],
    local_t: f32,
    note_duration: f32,
    energy: SegmentEnergy,
    style: ArrangementStyle,
    tail_gate: f32,
    semitone_offset: f32,
) -> f32 {
    let tail_gate = tail_gate.clamp(0.0, 1.0);
    let pulse = note_duration.max(0.08) * 0.5;
    let note_index = (local_t / pulse).floor() as usize;
    let note_t = local_t % pulse;
    let interval = pattern[note_index % pattern.len()];
    let env = adsr(note_t, pulse, 0.01, 0.08, 0.28, 0.38);
    let freq = root_hz * 2.0_f32.powf((interval as f32 + 12.0 + semitone_offset) / 12.0);
    let (bright, metallic, pick) = match style {
        ArrangementStyle::Guofeng => {
            let guzheng = guzheng_pluck_voice(freq, note_t);
            let string = (TWO_PI * freq * note_t).sin() * 0.18;
            let nail = (TWO_PI * freq * 3.4 * note_t).sin() * 0.05;
            (guzheng, string, nail)
        }
        _ => (
            (TWO_PI * freq * note_t).sin() * 0.34,
            (TWO_PI * freq * 2.0 * note_t).sin() * 0.12,
            (TWO_PI * freq * 3.0 * note_t).sin() * 0.06,
        ),
    };
    let style_gain = match style {
        ArrangementStyle::Guofeng => 1.22,
        ArrangementStyle::Piano => 0.72,
        ArrangementStyle::Strings => 0.8,
        ArrangementStyle::Synth => 0.92,
    };
    let energy_gain = match energy {
        SegmentEnergy::Low => 0.34,
        SegmentEnergy::Medium => 0.42,
        SegmentEnergy::High => 0.5,
        SegmentEnergy::Peak => 0.56,
    };
    (bright + metallic + pick)
        * env
        * style_gain
        * energy_gain
        * match style {
            ArrangementStyle::Guofeng => tail_gate,
            _ => 1.0,
        }
}

fn pad_voice(
    root_hz: f32,
    intervals: &[i32],
    t: f32,
    energy: SegmentEnergy,
    style: ArrangementStyle,
    density: f32,
) -> f32 {
    let mut sum = 0.0_f32;
    let movement = 1.0 + (TWO_PI * 0.12 * t).sin() * 0.003;
    for (idx, interval) in intervals.iter().enumerate() {
        let include = match idx {
            0 => 1.0,
            1 => (density + 0.16).clamp(0.0, 1.0),
            2 => density.clamp(0.0, 1.0),
            _ => (density - 0.18).clamp(0.0, 1.0),
        };
        if include <= 0.01 {
            continue;
        }
        let freq = root_hz * 2.0_f32.powf(*interval as f32 / 12.0) * movement;
        let pan_phase = idx as f32 * 0.7;
        match style {
            ArrangementStyle::Piano => {
                sum += (TWO_PI * freq * t + pan_phase).sin() * 0.12 * include;
                sum += (TWO_PI * freq * 2.0 * t + pan_phase * 0.3).sin() * 0.03 * include;
            }
            ArrangementStyle::Strings => {
                sum += (TWO_PI * freq * t + pan_phase).sin() * 0.14 * include;
                sum += (TWO_PI * freq * 0.5 * t + pan_phase * 0.5).sin() * 0.1 * include;
                sum += (TWO_PI * freq * 1.5 * t + pan_phase * 0.2).sin() * 0.05 * include;
            }
            ArrangementStyle::Synth => {
                sum += (TWO_PI * freq * t + pan_phase).sin().signum() * 0.09 * include;
                sum += (TWO_PI * freq * 0.5 * t + pan_phase * 0.5).sin() * 0.12 * include;
                sum += (TWO_PI * freq * 2.0 * t + pan_phase * 0.1).sin() * 0.04 * include;
            }
            ArrangementStyle::Guofeng => {
                sum += (TWO_PI * freq * t + pan_phase).sin() * 0.1 * include;
                sum += (TWO_PI * freq * 2.0 * t + pan_phase * 0.2).sin() * 0.06 * include;
                sum += (TWO_PI * freq * 3.0 * t + pan_phase * 0.35).sin() * 0.025 * include;
            }
        }
    }
    let energy_gain = match energy {
        SegmentEnergy::Low => 0.72,
        SegmentEnergy::Medium => 0.78,
        SegmentEnergy::High => 0.86,
        SegmentEnergy::Peak => 0.92,
    };
    sum * energy_gain
}

fn bass_voice(
    root_hz: f32,
    t: f32,
    beat_period: f32,
    energy: SegmentEnergy,
    style: ArrangementStyle,
    settle: f32,
) -> f32 {
    let tail_settle = settle.clamp(0.0, 1.0);
    let pulse_span = match style {
        ArrangementStyle::Guofeng => beat_period * (0.82 + tail_settle * 0.28),
        _ => beat_period * 0.82,
    };
    let pulse_pos = t % beat_period;
    let env = (1.0 - (pulse_pos / pulse_span.clamp(0.18, beat_period * 1.2)).clamp(0.0, 1.0)).powf(
        match style {
            ArrangementStyle::Guofeng => 1.5 + tail_settle * 0.28,
            _ => 1.7,
        },
    );
    let freq = root_hz * 0.5;
    let (sub, growl) = match style {
        ArrangementStyle::Piano => (
            (TWO_PI * freq * t).sin() * 0.23,
            (TWO_PI * freq * 2.0 * t).sin() * 0.04,
        ),
        ArrangementStyle::Strings => (
            (TWO_PI * freq * t).sin() * 0.24,
            (TWO_PI * freq * 1.5 * t).sin() * 0.05,
        ),
        ArrangementStyle::Synth => (
            (TWO_PI * freq * t).sin() * 0.26,
            (TWO_PI * freq * 1.5 * t).sin().signum() * 0.08,
        ),
        ArrangementStyle::Guofeng => {
            let body = (TWO_PI * freq * (1.0 - tail_settle * 0.04).max(0.92) * t).sin() * 0.18;
            let wood = (TWO_PI * freq * 1.38 * t).sin() * (0.05 - tail_settle * 0.024).max(0.015);
            let bloom = (TWO_PI * freq * (0.42 - tail_settle * 0.12).max(0.16) * t).sin()
                * (0.028 + tail_settle * 0.02);
            (body + bloom, wood)
        }
    };
    let gain = match energy {
        SegmentEnergy::Low => 0.62,
        SegmentEnergy::Medium => 0.74,
        SegmentEnergy::High => 0.88,
        SegmentEnergy::Peak => 0.98,
    };
    (sub + growl) * env * gain
}

fn sub_bass_voice(
    root_hz: f32,
    t: f32,
    beat_period: f32,
    energy: SegmentEnergy,
    style: ArrangementStyle,
    settle: f32,
) -> f32 {
    let tail_settle = settle.clamp(0.0, 1.0);
    let pulse_pos = t % (beat_period * 2.0).max(0.22);
    let env = (1.0
        - (pulse_pos / (beat_period * (1.55 + tail_settle * 0.3)).max(0.18)).clamp(0.0, 1.0))
    .powf(match style {
        ArrangementStyle::Guofeng => 1.62 + tail_settle * 0.2,
        _ => 1.8,
    });
    let freq = (root_hz * 0.25).max(32.0);
    let sine = (TWO_PI * freq * t).sin() * 0.42;
    let weight = (TWO_PI * freq * 0.5 * t).sin() * 0.12;
    let style_gain = match style {
        ArrangementStyle::Guofeng => 0.72 - tail_settle * 0.08,
        ArrangementStyle::Piano => 0.76,
        ArrangementStyle::Strings => 0.86,
        ArrangementStyle::Synth => 1.0,
    };
    let energy_gain = match energy {
        SegmentEnergy::Low => 0.46,
        SegmentEnergy::Medium => 0.58,
        SegmentEnergy::High => 0.72,
        SegmentEnergy::Peak => 0.82,
    };
    (sine + weight) * env * style_gain * energy_gain
}

fn drum_voice(
    t: f32,
    beat_period: f32,
    energy: SegmentEnergy,
    style: ArrangementStyle,
    lanes: &RhythmLaneProfile,
) -> f32 {
    let beat_pos = t % beat_period;
    let kick = kick_voice(beat_pos, style) * lanes.kick_gate;

    let hat_period = beat_period / 2.0;
    let hat_pos = t % hat_period;
    let hat = top_rhythm_voice(hat_pos, style) * lanes.top_gate;

    let snare_offset = beat_period * 0.5;
    let snare_pos = (t + beat_period - snare_offset) % beat_period;
    let snare = snare_family_voice(snare_pos, style) * lanes.snare_gate;

    let gain = match energy {
        SegmentEnergy::Low => 0.45,
        SegmentEnergy::Medium => 0.58,
        SegmentEnergy::High => 0.72,
        SegmentEnergy::Peak => 0.84,
    };
    let percussion_color = match style {
        ArrangementStyle::Piano => 0.7,
        ArrangementStyle::Strings => 0.82,
        ArrangementStyle::Synth => 1.0,
        ArrangementStyle::Guofeng => 0.76,
    };
    (kick + hat + snare) * gain * percussion_color
}

fn percussion_voice(
    t: f32,
    beat_period: f32,
    energy: SegmentEnergy,
    style: ArrangementStyle,
    lanes: &RhythmLaneProfile,
    settle: f32,
) -> f32 {
    if style == ArrangementStyle::Guofeng {
        let tail_settle = settle.clamp(0.0, 1.0);
        let wood_period = (beat_period / 2.0).max(0.12);
        let wood_pos = t % wood_period;
        let wood = board_hit_voice(wood_pos, tail_settle) * lanes.wood_gate;
        let frame_period = (beat_period * 2.0).max(0.28);
        let frame_pos = t % frame_period;
        let frame = frame_drum_voice(frame_pos, tail_settle) * lanes.frame_gate;
        let shaker_period = (beat_period / 4.0).max(0.08);
        let shaker_pos = t % shaker_period;
        let shaker = shaker_voice(shaker_pos) * lanes.shaker_gate * (1.0 - tail_settle * 0.2);
        let energy_gain = match energy {
            SegmentEnergy::Low => 0.22,
            SegmentEnergy::Medium => 0.34,
            SegmentEnergy::High => 0.48,
            SegmentEnergy::Peak => 0.58,
        };
        return (wood + frame + shaker) * energy_gain * (1.0 - tail_settle * 0.08);
    }
    let hat_period = (beat_period / 4.0).max(0.08);
    let hat_pos = t % hat_period;
    let hat = shaker_voice(hat_pos) * 1.2 * lanes.top_gate;

    let tom_period = (beat_period * 2.0).max(0.3);
    let tom_pos = t % tom_period;
    let tom = rim_or_tom_voice(tom_pos, style) * lanes.snare_gate;

    let style_gain = match style {
        ArrangementStyle::Guofeng => 0.82,
        ArrangementStyle::Piano => 0.58,
        ArrangementStyle::Strings => 0.72,
        ArrangementStyle::Synth => 0.94,
    };
    let energy_gain = match energy {
        SegmentEnergy::Low => 0.28,
        SegmentEnergy::Medium => 0.42,
        SegmentEnergy::High => 0.6,
        SegmentEnergy::Peak => 0.72,
    };
    (hat + tom) * style_gain * energy_gain
}

fn shimmer_voice(freq: f32, t: f32, env: f32, energy: SegmentEnergy, settle: f32) -> f32 {
    let rate = match energy {
        SegmentEnergy::Low => 0.0,
        SegmentEnergy::Medium => 0.4,
        SegmentEnergy::High => 0.8,
        SegmentEnergy::Peak => 1.2,
    };
    if rate == 0.0 {
        0.0
    } else {
        let haze = settle.clamp(0.0, 1.0);
        let pulse = ((TWO_PI * rate * (1.0 - haze * 0.55).max(0.18) * t).sin() * 0.5 + 0.5)
            * (1.0 - haze * 0.5)
            + haze * 0.42;
        let mist = (TWO_PI * freq * (2.2 + haze * 0.4) * t).sin() * (0.05 + haze * 0.04);
        ((TWO_PI * freq * 3.0 * t).sin() * pulse + mist) * env * 0.18
    }
}

fn atmosphere_tail_voice(
    freq: f32,
    t: f32,
    env: f32,
    energy: SegmentEnergy,
    style: ArrangementStyle,
    settle: f32,
) -> f32 {
    let haze = settle.clamp(0.0, 1.0);
    let base = shimmer_voice(freq, t, env, energy, settle);
    match style {
        ArrangementStyle::Guofeng => {
            let smoke = (TWO_PI * freq * (0.94 + haze * 0.12) * t).sin() * (0.068 + haze * 0.056);
            let tail_air =
                (TWO_PI * freq * (0.16 - haze * 0.06).max(0.05) * t).sin() * (0.05 + haze * 0.058);
            let dust =
                (TWO_PI * freq * (0.07 - haze * 0.02).max(0.03) * t).sin() * (0.022 + haze * 0.035);
            (base * (1.0 - haze * 0.38) + smoke + tail_air + dust) * (0.88 + haze * 0.07)
        }
        _ => base,
    }
}

fn choir_voice(
    root_hz: f32,
    intervals: &[i32],
    t: f32,
    energy: SegmentEnergy,
    style: ArrangementStyle,
    settle: f32,
) -> f32 {
    let vowel_hold = settle.clamp(0.0, 1.0);
    if style == ArrangementStyle::Guofeng {
        let density = match energy {
            SegmentEnergy::Low => 0.0,
            SegmentEnergy::Medium => 0.08,
            SegmentEnergy::High => 0.12,
            SegmentEnergy::Peak => 0.18,
        };
        if density <= 0.0 {
            return 0.0;
        }
        let mut sum = 0.0_f32;
        for (idx, interval) in intervals.iter().enumerate() {
            let voice_presence = match idx {
                0 => 1.0,
                1 => (0.76 - vowel_hold * 0.12).clamp(0.42, 0.8),
                _ => (0.52 - vowel_hold * 0.2).clamp(0.18, 0.52),
            };
            if voice_presence <= 0.0 {
                continue;
            }
            let freq = root_hz * 2.0_f32.powf((*interval as f32 + 7.0) / 12.0);
            let detune = 1.0 + (idx as f32 * 0.002);
            let airy = (TWO_PI * freq * detune * t).sin() * (0.048 - vowel_hold * 0.016).max(0.018);
            let haze = (TWO_PI * freq * (0.34 - vowel_hold * 0.12).max(0.14) * detune * t).sin()
                * (0.054 + vowel_hold * 0.054);
            let tail = (TWO_PI * freq * (0.18 - vowel_hold * 0.06).max(0.08) * detune * t).sin()
                * (0.02 + vowel_hold * 0.036);
            let breath = (TWO_PI * freq * (0.1 - vowel_hold * 0.03).max(0.05) * detune * t).sin()
                * (0.01 + vowel_hold * 0.02);
            sum += (airy + haze + tail + breath) * voice_presence;
        }
        return sum * density * 0.54 * (0.96 + vowel_hold * 0.02);
    }
    let density = match energy {
        SegmentEnergy::Low => 0.0,
        SegmentEnergy::Medium => 0.16,
        SegmentEnergy::High => 0.22,
        SegmentEnergy::Peak => 0.3,
    };
    if density <= 0.0 {
        return 0.0;
    }
    let mut sum = 0.0_f32;
    for (idx, interval) in intervals.iter().enumerate() {
        let freq = root_hz * 2.0_f32.powf((*interval as f32 + 12.0) / 12.0);
        let detune = 1.0 + (idx as f32 * 0.0035);
        let ah = (TWO_PI * freq * detune * t).sin() * (0.12 - vowel_hold * 0.03).max(0.07);
        let oh = (TWO_PI * freq * (0.5 - vowel_hold * 0.14).max(0.22) * detune * t).sin()
            * (0.08 + vowel_hold * 0.05);
        sum += ah + oh;
    }
    let color = match style {
        ArrangementStyle::Guofeng => 0.88,
        ArrangementStyle::Strings => 1.0,
        ArrangementStyle::Synth => 0.92,
        ArrangementStyle::Piano => 0.76,
    };
    sum * density * color * (1.0 + vowel_hold * 0.1)
}

fn impact_voice(
    t: f32,
    beat_period: f32,
    energy: SegmentEnergy,
    style: ArrangementStyle,
    settle: f32,
) -> f32 {
    if !matches!(energy, SegmentEnergy::High | SegmentEnergy::Peak) {
        return 0.0;
    }
    let tail_settle = settle.clamp(0.0, 1.0);
    let impact_pos = t % (beat_period * 2.0).max(0.25);
    let env = (1.0 - (impact_pos / (0.22 + tail_settle * 0.04)).clamp(0.0, 1.0)).powf(3.6);
    let low = (TWO_PI * (58.0 - impact_pos * 90.0).max(28.0) * impact_pos).sin() * 0.3;
    let crack = (TWO_PI * 2500.0 * impact_pos).sin() * (0.06 - tail_settle * 0.022).max(0.018);
    let style_gain = match style {
        ArrangementStyle::Guofeng => 0.74 - tail_settle * 0.14,
        ArrangementStyle::Strings => 0.9,
        ArrangementStyle::Synth => 1.0,
        ArrangementStyle::Piano => 0.62,
    };
    (low + crack) * env * style_gain
}

fn kick_voice(t: f32, style: ArrangementStyle) -> f32 {
    let env = (1.0 - (t / 0.16).clamp(0.0, 1.0)).powf(3.2);
    let pitch = 82.0 - t * 180.0;
    let body = (TWO_PI * pitch.max(34.0) * t).sin();
    let click = (TWO_PI * 2400.0 * t).sin() * 0.05;
    let gain = if style == ArrangementStyle::Piano {
        0.28
    } else {
        0.42
    };
    (body + click) * env * gain
}

fn snare_family_voice(t: f32, style: ArrangementStyle) -> f32 {
    let env = (1.0 - (t / 0.12).clamp(0.0, 1.0)).powf(2.4);
    match style {
        ArrangementStyle::Synth => clap_voice(t) * env * 0.9 + rim_voice(t) * env * 0.55,
        ArrangementStyle::Guofeng => rim_voice(t) * env * 0.72,
        _ => rim_voice(t) * env * 0.84,
    }
}

fn top_rhythm_voice(t: f32, style: ArrangementStyle) -> f32 {
    let env = (1.0 - (t / 0.045).clamp(0.0, 1.0)).powf(1.6);
    let gain = match style {
        ArrangementStyle::Piano => 0.02,
        ArrangementStyle::Strings => 0.035,
        ArrangementStyle::Synth => 0.06,
        ArrangementStyle::Guofeng => 0.028,
    };
    shaker_voice(t) * env * gain * 1.8
}

fn rim_voice(t: f32) -> f32 {
    ((TWO_PI * 1850.0 * t).sin() + (TWO_PI * 2450.0 * t).sin() * 0.42) * 0.08
}

fn clap_voice(t: f32) -> f32 {
    let a = ((TWO_PI * 1900.0 * t).sin() + (TWO_PI * 2600.0 * t).sin() * 0.5) * 0.05;
    let b_pos = (t - 0.012).max(0.0);
    let b = ((TWO_PI * 2200.0 * b_pos).sin() + (TWO_PI * 3200.0 * b_pos).sin() * 0.3) * 0.04;
    a + b
}

fn board_hit_voice(t: f32, settle: f32) -> f32 {
    let tail_settle = settle.clamp(0.0, 1.0);
    let env =
        (1.0 - (t / (0.035 + tail_settle * 0.015)).clamp(0.0, 1.0)).powf(2.1 + tail_settle * 0.4);
    let knock = (TWO_PI * 1680.0 * t).sin();
    let edge = (TWO_PI * 2380.0 * t).sin() * (0.35 - tail_settle * 0.16).max(0.08);
    let air = (TWO_PI * 980.0 * t).sin() * (0.012 + tail_settle * 0.014);
    (knock + edge + air) * env * (0.06 - tail_settle * 0.012)
}

fn frame_drum_voice(t: f32, settle: f32) -> f32 {
    let tail_settle = settle.clamp(0.0, 1.0);
    let env =
        (1.0 - (t / (0.18 + tail_settle * 0.08)).clamp(0.0, 1.0)).powf(1.7 + tail_settle * 0.22);
    let body = (TWO_PI * 132.0 * t).sin() * (0.1 + tail_settle * 0.015);
    let skin = (TWO_PI * 214.0 * t).sin() * (0.2 - tail_settle * 0.08).max(0.08);
    let bloom = (TWO_PI * 72.0 * t).sin() * (0.012 + tail_settle * 0.022);
    (body + skin + bloom) * env * (0.1 - tail_settle * 0.014)
}

fn shaker_voice(t: f32) -> f32 {
    let env = (1.0 - (t / 0.025).clamp(0.0, 1.0)).powf(1.7);
    ((TWO_PI * 5200.0 * t).sin() + (TWO_PI * 6800.0 * t).sin() * 0.24) * env * 0.025
}

fn rim_or_tom_voice(t: f32, style: ArrangementStyle) -> f32 {
    let env = (1.0 - (t / 0.16).clamp(0.0, 1.0)).powf(2.2);
    match style {
        ArrangementStyle::Synth => ((TWO_PI * 220.0 * t).sin() + clap_voice(t) * 0.4) * env * 0.1,
        _ => (TWO_PI * 180.0 * t).sin() * env * 0.12,
    }
}

fn guzheng_pluck_voice(freq: f32, t: f32) -> f32 {
    let sweep = 1.0 + (TWO_PI * 7.0 * t).sin() * 0.01;
    let fundamental = (TWO_PI * freq * sweep * t).sin() * 0.28;
    let shimmer = (TWO_PI * freq * 2.0 * sweep * t).sin() * 0.12;
    let silk = (TWO_PI * freq * 3.2 * sweep * t).sin() * 0.06;
    fundamental + shimmer + silk
}

fn low_dizi_counter_voice(freq: f32, t: f32) -> f32 {
    let hollow = (TWO_PI * freq * t).sin() * 0.2;
    let breath = (TWO_PI * freq * 0.5 * t).sin() * 0.08;
    let edge = (TWO_PI * freq * 1.8 * t).sin() * 0.04;
    hollow + breath + edge
}

fn bamboo_air_voice(freq: f32, t: f32) -> f32 {
    ((TWO_PI * freq * 2.6 * t).sin() + (TWO_PI * freq * 3.4 * t).sin() * 0.4) * 0.05
}

fn adsr(t: f32, duration: f32, attack: f32, decay: f32, sustain: f32, release: f32) -> f32 {
    if duration <= 0.0 {
        return 0.0;
    }
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

fn apply_master_reverb(left: &mut [f32], right: &mut [f32]) {
    let taps = [
        (SAMPLE_RATE as usize / 17, 0.18_f32),
        (SAMPLE_RATE as usize / 11, 0.11_f32),
        (SAMPLE_RATE as usize / 7, 0.07_f32),
    ];
    for (delay, gain) in taps {
        for idx in delay..left.len() {
            left[idx] = (left[idx] + left[idx - delay] * gain).clamp(-1.0, 1.0);
            right[idx] = (right[idx] + right[idx - delay] * gain).clamp(-1.0, 1.0);
        }
    }
}

fn apply_master_glue(left: &mut [f32], right: &mut [f32]) {
    for idx in 0..left.len().min(right.len()) {
        let mid = (left[idx] + right[idx]) * 0.5;
        let side = (left[idx] - right[idx]) * 0.5 * 1.1;
        let saturated_mid = soft_clip(mid * 1.24);
        let saturated_side = soft_clip(side * 1.1);
        left[idx] = soft_clip(saturated_mid + saturated_side);
        right[idx] = soft_clip(saturated_mid - saturated_side);
    }
}

fn normalize_stereo_peak(left: &mut [f32], right: &mut [f32], target_peak: f32) {
    let mut peak = 0.0_f32;
    for idx in 0..left.len().min(right.len()) {
        peak = peak.max(left[idx].abs()).max(right[idx].abs());
    }
    if peak <= 0.0001 {
        return;
    }
    let gain = (target_peak / peak).clamp(0.25, 6.0);
    for idx in 0..left.len().min(right.len()) {
        left[idx] = soft_clip(left[idx] * gain);
        right[idx] = soft_clip(right[idx] * gain);
    }
}

fn soft_clip(sample: f32) -> f32 {
    let drive = sample * 1.18;
    (drive / (1.0 + drive.abs())).clamp(-1.0, 1.0)
}

fn style_profile(
    style: ArrangementStyle,
    energy: SegmentEnergy,
    adapter_hint: ExternalAdapterHint,
) -> StyleProfile {
    let energy_lift = match energy {
        SegmentEnergy::Low => 0.0,
        SegmentEnergy::Medium => 0.04,
        SegmentEnergy::High => 0.08,
        SegmentEnergy::Peak => 0.12,
    };
    let mut profile = match style {
        ArrangementStyle::Piano => StyleProfile {
            pad_gain: 0.72 + energy_lift,
            lead_gain: 1.08,
            counter_gain: 0.52,
            bass_gain: 0.62,
            drum_gain: 0.42,
            shimmer_gain: 0.18,
            strings_gain: 0.54,
            pluck_gain: 0.56,
            counter_lane_gain: 0.48,
            sub_gain: 0.5,
            percussion_gain: 0.34,
            impact_gain: 0.3,
            choir_gain: 0.18,
        },
        ArrangementStyle::Strings => StyleProfile {
            pad_gain: 0.82 + energy_lift,
            lead_gain: 1.1,
            counter_gain: 0.42,
            bass_gain: 0.7,
            drum_gain: 0.5,
            shimmer_gain: 0.18,
            strings_gain: 0.68,
            pluck_gain: 0.32,
            counter_lane_gain: 0.42,
            sub_gain: 0.56,
            percussion_gain: 0.34,
            impact_gain: 0.44,
            choir_gain: 0.24,
        },
        ArrangementStyle::Synth => StyleProfile {
            pad_gain: 0.74 + energy_lift,
            lead_gain: 1.24,
            counter_gain: 0.42,
            bass_gain: 0.74,
            drum_gain: 0.68,
            shimmer_gain: 0.18,
            strings_gain: 0.4,
            pluck_gain: 0.56,
            counter_lane_gain: 0.4,
            sub_gain: 0.68,
            percussion_gain: 0.44,
            impact_gain: 0.56,
            choir_gain: 0.16,
        },
        ArrangementStyle::Guofeng => StyleProfile {
            pad_gain: 0.58 + energy_lift,
            lead_gain: 1.22,
            counter_gain: 0.42,
            bass_gain: 0.52,
            drum_gain: 0.34,
            shimmer_gain: 0.16,
            strings_gain: 0.42,
            pluck_gain: 0.84,
            counter_lane_gain: 0.4,
            sub_gain: 0.4,
            percussion_gain: 0.36,
            impact_gain: 0.22,
            choir_gain: 0.14,
        },
    };
    match adapter_hint {
        ExternalAdapterHint::Internal => {}
        ExternalAdapterHint::Kontakt => {
            profile.pad_gain += 0.04;
            profile.counter_gain += 0.05;
            profile.strings_gain += 0.06;
        }
        ExternalAdapterHint::Spitfire => {
            profile.pad_gain += 0.08;
            profile.shimmer_gain += 0.04;
            profile.strings_gain += 0.1;
            profile.choir_gain += 0.06;
        }
        ExternalAdapterHint::EastWest => {
            profile.pad_gain += 0.06;
            profile.bass_gain += 0.05;
            profile.sub_gain += 0.04;
        }
        ExternalAdapterHint::Custom => {
            profile.lead_gain += 0.03;
            profile.counter_gain += 0.03;
            profile.pluck_gain += 0.04;
            profile.percussion_gain += 0.04;
        }
    }
    profile
}

fn interleaved_wav(left: &[f32], right: &[f32], sample_rate: u32) -> Vec<u8> {
    let frames = left.len().min(right.len());
    let data_size = (frames * 2 * 2) as u32;
    let mut out = Vec::with_capacity(44 + data_size as usize);
    out.extend_from_slice(b"RIFF");
    out.extend_from_slice(&(36 + data_size).to_le_bytes());
    out.extend_from_slice(b"WAVEfmt ");
    out.extend_from_slice(&16u32.to_le_bytes());
    out.extend_from_slice(&1u16.to_le_bytes());
    out.extend_from_slice(&2u16.to_le_bytes());
    out.extend_from_slice(&sample_rate.to_le_bytes());
    out.extend_from_slice(&(sample_rate * 4).to_le_bytes());
    out.extend_from_slice(&4u16.to_le_bytes());
    out.extend_from_slice(&16u16.to_le_bytes());
    out.extend_from_slice(b"data");
    out.extend_from_slice(&data_size.to_le_bytes());
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
    fn arrangement_prefers_timed_lines_when_present() {
        let lyrics = serde_json::json!({
            "schema": "css.lyrics.v1",
            "lang": "zh",
            "title": "Afterglow",
            "lines": [
                { "t": 0.0, "text": "Verse 1: 夜风将星火拢进掌心" },
                { "t": 3.2, "text": "Chorus 1: 海面忽然长出霓虹合唱" },
                { "t": 7.4, "text": "Bridge: 所有倒影开始逆流" }
            ]
        });

        let commands = serde_json::json!({
            "creative": {
                "instrument": "orchestral strings",
                "tempo_bpm": 92
            }
        });
        let segments = plan_arrangement(&lyrics, &commands, "Afterglow");

        assert!(segments.len() >= 3);
        assert!((segments[1].start_sec - 3.2).abs() < 0.05);
        assert!(segments[1].duration_sec >= 4.0);
        assert_eq!(segments[1].energy, SegmentEnergy::High);
        assert_eq!(segments[2].energy, SegmentEnergy::Peak);
        assert_eq!(segments[0].style, ArrangementStyle::Strings);
        assert_eq!(segments[0].adapter_hint, ExternalAdapterHint::Internal);
        assert!(segments[0].progression.len() >= 4);
        assert!(arrangement_total_duration(&segments) >= 120.0);
    }

    #[test]
    fn arrangement_estimates_duration_from_plain_lines() {
        let lyrics = serde_json::json!({
            "schema": "css.lyrics.v1",
            "lang": "en",
            "title": "Silver Pulse",
            "lines": [
                "Verse 1: signal in the rain",
                "Pre-Chorus: keep the wires awake",
                "Chorus: let the skyline sing"
            ]
        });

        let commands = serde_json::json!({
            "creative": {
                "instrument": "synth bass",
                "tempo_bpm": 110
            }
        });
        let segments = plan_arrangement(&lyrics, &commands, "Silver Pulse");

        assert!(segments.len() >= 3);
        assert!(segments[0].duration_sec >= 2.1);
        assert!(segments[1].start_sec > segments[0].start_sec);
        assert_eq!(segments[2].energy, SegmentEnergy::Peak);
        assert_eq!(segments[0].style, ArrangementStyle::Synth);
        assert!(segments[2].tempo_bpm > segments[0].tempo_bpm);
        let total = arrangement_total_duration(&segments);
        assert!(total >= 120.0);
        assert!(total <= 186.5);
    }

    #[test]
    fn rendered_wav_is_stereo_and_nontrivial() {
        let segments = vec![
            PhraseSegment {
                start_sec: 0.0,
                duration_sec: 2.6,
                section: "Verse 1".to_string(),
                energy: SegmentEnergy::Low,
                tempo_bpm: 84.0,
                root_hz: 196.0,
                progression: &[ChordFrame {
                    root_shift: 0,
                    intervals: &[0, 4, 7, 11],
                }],
                counter_pattern: &[4, 7, 9, 7, 5, 4],
                style: ArrangementStyle::Piano,
                adapter_hint: ExternalAdapterHint::Internal,
                rhythm_hint: None,
                phrase_hint: None,
                melody_hint: None,
            },
            PhraseSegment {
                start_sec: 2.6,
                duration_sec: 3.0,
                section: "Chorus 1".to_string(),
                energy: SegmentEnergy::Peak,
                tempo_bpm: 118.0,
                root_hz: 246.94,
                progression: &[ChordFrame {
                    root_shift: 0,
                    intervals: &[0, 3, 7, 10],
                }],
                counter_pattern: &[12, 7, 14, 11, 12, 16, 14, 11],
                style: ArrangementStyle::Synth,
                adapter_hint: ExternalAdapterHint::Internal,
                rhythm_hint: None,
                phrase_hint: None,
                melody_hint: None,
            },
        ];

        let wav = render_arrangement_wav(&segments);

        assert!(wav.len() > 44 + 4096);
        assert_eq!(&wav[0..4], b"RIFF");
        assert_eq!(&wav[8..12], b"WAVE");
        let channels = u16::from_le_bytes([wav[22], wav[23]]);
        assert_eq!(channels, 2);
    }

    #[test]
    fn detects_guofeng_style_from_creative_hints() {
        let lyrics = serde_json::json!({
            "schema": "css.lyrics.v1",
            "lang": "zh",
            "title": "云宫",
            "creative": {
                "genre": "Chinese GuFeng",
                "instrument": "guzheng and dizi",
                "tempo_bpm": 86
            },
            "lines": ["Verse 1: 云阙之上风起", "Chorus: 霞光落进长河"]
        });
        let commands = serde_json::json!({
            "creative": {
                "genre": "Chinese GuFeng",
                "instrument": "guzheng and dizi",
                "tempo_bpm": 86
            }
        });

        let segments = plan_arrangement(&lyrics, &commands, "云宫");

        assert_eq!(segments[0].style, ArrangementStyle::Guofeng);
        assert_eq!(segments[0].counter_pattern, &[5, 7, 10, 7, 5, 2]);
    }

    #[test]
    fn detects_external_adapter_hint_from_creative_fields() {
        let lyrics = serde_json::json!({
            "schema": "css.lyrics.v1",
            "lang": "en",
            "title": "Titanium Bloom",
            "creative": {
                "genre": "cinematic electronic",
                "external_audio_adapter": "spitfire",
                "licensed_style_pack": "spitfire/symphonic-core"
            },
            "lines": ["Verse 1: silver fire", "Chorus: break the skyline"]
        });
        let commands = serde_json::json!({
            "creative": {
                "external_audio_adapter": "spitfire",
                "licensed_style_pack": "spitfire/symphonic-core"
            }
        });

        let segments = plan_arrangement(&lyrics, &commands, "Titanium Bloom");

        assert_eq!(segments[0].adapter_hint, ExternalAdapterHint::Spitfire);
    }

    #[test]
    fn arrangement_exports_midi_ready_cues() {
        let lyrics = serde_json::json!({
            "schema": "css.lyrics.v1",
            "lang": "en",
            "title": "Glass Horizon",
            "lines": ["Verse 1: silver water", "Chorus: brighter than dawn"]
        });
        let commands = serde_json::json!({
            "creative": {
                "instrument": "orchestral strings",
                "external_audio_adapter": "spitfire",
                "licensed_style_pack": "spitfire/bbcso",
                "tempo_bpm": 96,
                "duration_s": 180
            }
        });

        let segments = plan_arrangement(&lyrics, &commands, "Glass Horizon");
        let cues = arrangement_to_cues(&segments, &commands, &lyrics);

        assert!(!cues.is_empty());
        assert!(cues[0].bar_end >= cues[0].bar_start);
        assert!(!cues[0].chord_slots.is_empty());
        assert_eq!(cues[0].velocity_curve.len(), 4);
        assert!(cues[0].note_density > 0.0);
    }

    #[test]
    fn arrangement_respects_explicit_longform_duration_within_limit() {
        let lyrics = serde_json::json!({
            "schema": "css.lyrics.v1",
            "lang": "zh",
            "title": "River of Glass",
            "lines": ["Verse 1: 清晨翻涌", "Chorus: 星河回声"]
        });
        let commands = serde_json::json!({
            "creative": {
                "instrument": "cinematic strings",
                "duration_s": 420,
                "tempo_bpm": 96
            }
        });

        let segments = plan_arrangement(&lyrics, &commands, "River of Glass");
        let total = arrangement_total_duration(&segments);

        assert!(total >= 400.0);
        assert!(total <= 420.5);
    }

    #[test]
    fn external_music_plan_rhythm_hints_attach_to_matching_sections() {
        let lyrics = serde_json::json!({
            "schema": "css.lyrics.v1",
            "lang": "en",
            "title": "Signal Bloom",
            "lines": ["Chorus 1: brighter than dawn"]
        });
        let commands = serde_json::json!({
            "creative": {
                "tempo_bpm": 108
            }
        });
        let music_plan = serde_json::json!({
            "phrases": [{
                "section": "Chorus 1",
                "groove": {
                    "syncopation": "high",
                    "swing": "straight",
                    "microTimingMs": 14,
                    "activityProfile": ["drive", "burst"],
                    "barAccentPattern": [["1", "2"], ["1", "and-4"]],
                    "pushPullProfile": ["centered", "pushed"]
                }
            }]
        });

        let hints = extract_rhythm_hints_from_plan(&music_plan);
        let phrase_hints = BTreeMap::new();
        let segments = plan_arrangement_with_hints(
            &lyrics,
            &commands,
            "Signal Bloom",
            &hints,
            &phrase_hints,
            &BTreeMap::new(),
        );

        assert!(!segments.is_empty());
        let hint = segments[0].rhythm_hint.as_ref().expect("rhythm hint");
        assert_eq!(hint.syncopation.as_deref(), Some("high"));
        assert_eq!(hint.activity_profile.len(), 2);
        assert_eq!(
            hint.push_pull_profile.last().map(String::as_str),
            Some("pushed")
        );
    }

    #[test]
    fn burst_activity_opens_more_hits_than_hold_activity() {
        let burst = drum_steps_for_bar(
            ArrangementStyle::Guofeng,
            SegmentEnergy::High,
            Some("burst"),
            Some(&vec!["1".to_string(), "and-4".to_string()]),
        );
        let hold = drum_steps_for_bar(
            ArrangementStyle::Guofeng,
            SegmentEnergy::High,
            Some("hold"),
            Some(&vec!["1".to_string()]),
        );
        let pluck = pluck_steps_for_bar(
            ArrangementStyle::Guofeng,
            SegmentEnergy::Medium,
            Some("drive"),
            Some(&vec!["2".to_string(), "and-4".to_string()]),
        );

        assert!(burst.len() > hold.len());
        assert!(hold.iter().all(|step| matches!(*step, 0 | 4)));
        assert!(pluck.contains(&2));
        assert!(pluck.contains(&7));
    }

    #[test]
    fn lane_step_distribution_separates_kick_snare_and_guofeng_percussion_roles() {
        let kick = kick_steps_for_bar(
            ArrangementStyle::Synth,
            SegmentEnergy::High,
            Some("drive"),
            Some(&vec!["1".to_string(), "3".to_string()]),
        );
        let snare = snare_steps_for_bar(
            ArrangementStyle::Synth,
            SegmentEnergy::High,
            Some("drive"),
            Some(&vec!["2".to_string(), "4".to_string()]),
        );
        let wood = wood_steps_for_bar(
            ArrangementStyle::Guofeng,
            SegmentEnergy::Medium,
            Some("drive"),
            Some(&vec!["and-4".to_string()]),
        );
        let frame = frame_steps_for_bar(
            ArrangementStyle::Guofeng,
            SegmentEnergy::Medium,
            Some("build"),
            Some(&vec!["1".to_string()]),
        );

        assert!(kick.contains(&0));
        assert!(kick.contains(&4));
        assert!(snare.contains(&2));
        assert!(snare.contains(&6));
        assert!(wood.iter().any(|step| *step % 2 == 1));
        assert!(frame.contains(&0));
    }

    #[test]
    fn section_role_profiles_shift_lead_and_support_across_form() {
        let verse = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 3.0,
            section: "Verse 1".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 96.0,
            root_hz: 196.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7, 11],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: None,
            melody_hint: None,
        };
        let chorus = PhraseSegment {
            section: "Chorus 1".to_string(),
            ..verse.clone()
        };
        let bridge = PhraseSegment {
            section: "Bridge".to_string(),
            ..verse.clone()
        };
        let outro = PhraseSegment {
            section: "Outro".to_string(),
            ..verse.clone()
        };

        let verse_role = section_role_profile(&verse);
        let chorus_role = section_role_profile(&chorus);
        let bridge_role = section_role_profile(&bridge);
        let outro_role = section_role_profile(&outro);

        assert!(chorus_role.lead_gain > verse_role.lead_gain);
        assert!(chorus_role.choir_gain > verse_role.choir_gain);
        assert!(bridge_role.counter_gain > chorus_role.counter_gain);
        assert!(bridge_role.atmosphere_gain > verse_role.atmosphere_gain);
        assert!(outro_role.percussion_gain < verse_role.percussion_gain);
        assert!(verse_role.pluck_gain > chorus_role.pluck_gain);
    }

    #[test]
    fn external_phrase_hints_attach_by_section_occurrence() {
        let lyrics = serde_json::json!({
            "schema": "css.lyrics.v1",
            "lang": "zh",
            "title": "云潮",
            "lines": ["Chorus 1: 山雨将来", "Chorus 1: 风过长街", "Chorus 1: 月落归舟"]
        });
        let commands = serde_json::json!({
            "creative": {
                "tempo_bpm": 92
            }
        });
        let music_plan = serde_json::json!({
            "phrases": [
                { "section": "Chorus 1", "role": "statement", "variationRole": "primary", "cadenceIntent": "open" },
                { "section": "Chorus 1", "role": "response", "variationRole": "answer", "cadenceIntent": "half" },
                { "section": "Chorus 1", "role": "resolve", "variationRole": "repeat", "cadenceIntent": "authentic" }
            ]
        });

        let rhythm_hints = BTreeMap::new();
        let phrase_hints = extract_phrase_hints_from_plan(&music_plan);
        let segments = plan_arrangement_with_hints(
            &lyrics,
            &commands,
            "云潮",
            &rhythm_hints,
            &phrase_hints,
            &BTreeMap::new(),
        );

        assert!(segments.len() >= 3);
        assert_eq!(
            segments[0]
                .phrase_hint
                .as_ref()
                .and_then(|hint| hint.role.as_deref()),
            Some("statement")
        );
        assert_eq!(
            segments[1]
                .phrase_hint
                .as_ref()
                .and_then(|hint| hint.variation_role.as_deref()),
            Some("answer")
        );
        assert_eq!(
            segments[2]
                .phrase_hint
                .as_ref()
                .and_then(|hint| hint.cadence_intent.as_deref()),
            Some("authentic")
        );
    }

    #[test]
    fn phrase_role_profiles_shift_lead_and_support_inside_same_section() {
        let base = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 3.0,
            section: "Chorus 1".to_string(),
            energy: SegmentEnergy::High,
            tempo_bpm: 104.0,
            root_hz: 220.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7, 11],
            }],
            counter_pattern: &[0, 4, 7, 9],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: None,
            melody_hint: None,
        };
        let statement = PhraseSegment {
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("statement".to_string()),
                variation_role: Some("primary".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: None,
            ..base.clone()
        };
        let response = PhraseSegment {
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("half".to_string()),
            }),
            melody_hint: None,
            ..base.clone()
        };
        let resolve = PhraseSegment {
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("resolve".to_string()),
                variation_role: Some("repeat".to_string()),
                cadence_intent: Some("authentic".to_string()),
            }),
            melody_hint: None,
            ..base
        };

        let statement_role = phrase_role_profile(&statement);
        let response_role = phrase_role_profile(&response);
        let resolve_role = phrase_role_profile(&resolve);

        assert!(response_role.counter_gain > statement_role.counter_gain);
        assert!(response_role.lead_gain < statement_role.lead_gain);
        assert!(resolve_role.lead_gain > response_role.lead_gain);
        assert!(resolve_role.percussion_gain < response_role.percussion_gain);
        assert!(statement_role.pluck_gain > resolve_role.pluck_gain);
    }

    #[test]
    fn vocal_focus_window_ducks_support_layers() {
        let hints = vec![VocalFocusHint {
            start_sec: 1.0,
            duration_sec: 0.5,
            strength: 0.8,
            section: None,
            token: None,
        }];

        let center = vocal_space_profile(1.22, &hints);
        let tail = vocal_space_profile(1.44, &hints);
        let outside = vocal_space_profile(2.1, &hints);

        assert!(center.counter_duck < center.pluck_duck);
        assert!(center.pluck_duck < outside.pluck_duck);
        assert!(center.counter_duck < outside.counter_duck);
        assert!(tail.strings_duck > center.strings_duck);
    }

    #[test]
    fn vocal_focus_window_gates_hits_by_role_priority() {
        let hints = vec![VocalFocusHint {
            start_sec: 1.0,
            duration_sec: 0.5,
            strength: 0.85,
            section: None,
            token: None,
        }];

        let center = vocal_hit_space_profile(1.25, &hints);
        let outside = vocal_hit_space_profile(2.0, &hints);

        assert!(center.counter_hit_gate < center.pluck_hit_gate);
        assert!(center.pluck_hit_gate < center.percussion_hit_gate);
        assert!(center.counter_hit_gate < outside.counter_hit_gate);
        assert!(center.pluck_hit_gate < outside.pluck_hit_gate);
        assert!(center.percussion_hit_gate < outside.percussion_hit_gate);
    }

    #[test]
    fn vocal_focus_window_stabilizes_bass_and_harmony_motion() {
        let hints = vec![VocalFocusHint {
            start_sec: 1.0,
            duration_sec: 0.5,
            strength: 0.9,
            section: None,
            token: None,
        }];

        let center = vocal_harmony_space_profile(1.24, &hints);
        let outside = vocal_harmony_space_profile(2.0, &hints);

        assert!(center.bass_duck < outside.bass_duck);
        assert!(center.sub_duck < outside.sub_duck);
        assert!(center.pad_duck < outside.pad_duck);
        assert!(center.chord_motion_hold > outside.chord_motion_hold);
        assert!(center.bass_root_hold > outside.bass_root_hold);
        assert!(center.harmonic_density < outside.harmonic_density);
    }

    #[test]
    fn focus_window_holds_bass_roots_and_thins_harmony_density() {
        let held_index = focus_held_chord_index(1.1, 1.0, 4, 0.8);
        let released_index = focus_held_chord_index(1.72, 1.0, 4, 0.8);
        let open_pad = pad_voice(
            220.0,
            &[0, 4, 7, 11],
            0.24,
            SegmentEnergy::Medium,
            ArrangementStyle::Strings,
            1.0,
        )
        .abs();
        let thinned_pad = pad_voice(
            220.0,
            &[0, 4, 7, 11],
            0.24,
            SegmentEnergy::Medium,
            ArrangementStyle::Strings,
            0.62,
        )
        .abs();

        assert_eq!(held_index, 0);
        assert_eq!(released_index, 1);
        assert!(thinned_pad < open_pad);
    }

    #[test]
    fn phrase_end_cadence_settles_terminal_chord_for_resolve_focus() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus 1".to_string(),
            energy: SegmentEnergy::High,
            tempo_bpm: 104.0,
            root_hz: 220.0,
            progression: &[
                ChordFrame {
                    root_shift: 7,
                    intervals: &[0, 4, 7],
                },
                ChordFrame {
                    root_shift: 9,
                    intervals: &[0, 3, 7],
                },
                ChordFrame {
                    root_shift: 0,
                    intervals: &[0, 4, 7, 11],
                },
            ],
            counter_pattern: &[0, 4, 7, 9],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("resolve".to_string()),
                variation_role: Some("repeat".to_string()),
                cadence_intent: Some("authentic".to_string()),
            }),
            melody_hint: None,
        };

        let late = phrase_end_cadence_profile(&segment, 3.56, 0.86, None);
        let early = phrase_end_cadence_profile(&segment, 1.2, 0.2, None);

        assert_eq!(late.target_chord_index, 2);
        assert!(late.chord_settle > 0.5);
        assert!(late.bass_settle >= late.chord_settle);
        assert!(late.density_scale < early.density_scale);
        assert!(late.chord_settle > early.chord_settle);
    }

    #[test]
    fn release_cadence_prefers_terminal_fall_when_focus_arrives_at_tail() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 3.6,
            section: "Outro".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 88.0,
            root_hz: 196.0,
            progression: &[
                ChordFrame {
                    root_shift: 5,
                    intervals: &[0, 3, 7],
                },
                ChordFrame {
                    root_shift: 2,
                    intervals: &[0, 3, 7, 10],
                },
                ChordFrame {
                    root_shift: 0,
                    intervals: &[0, 4, 7, 11],
                },
            ],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Strings,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("release".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("resolved".to_string()),
            }),
            melody_hint: None,
        };

        let tail_focus = phrase_end_cadence_profile(&segment, 3.18, 0.74, None);
        let no_focus = phrase_end_cadence_profile(&segment, 3.18, 0.0, None);

        assert_eq!(tail_focus.target_chord_index, 2);
        assert!(tail_focus.chord_settle > no_focus.chord_settle);
        assert!(tail_focus.density_scale < 1.0);
    }

    #[test]
    fn cadence_anchor_prefers_explicit_terminal_target() {
        let segment = PhraseSegment {
            start_sec: 4.0,
            duration_sec: 3.2,
            section: "Chorus 2".to_string(),
            energy: SegmentEnergy::High,
            tempo_bpm: 108.0,
            root_hz: 220.0,
            progression: &[
                ChordFrame {
                    root_shift: 9,
                    intervals: &[0, 3, 7],
                },
                ChordFrame {
                    root_shift: 5,
                    intervals: &[0, 3, 7],
                },
                ChordFrame {
                    root_shift: 0,
                    intervals: &[0, 4, 7, 11],
                },
            ],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("resolve".to_string()),
                variation_role: Some("repeat".to_string()),
                cadence_intent: Some("half".to_string()),
            }),
            melody_hint: None,
        };
        let anchor = VocalCadenceAnchorHint {
            start_sec: 6.62,
            duration_sec: 0.42,
            strength: 0.86,
            cue_index: 4,
            phrase_order: 2,
            role: Some("resolve".to_string()),
            cadence: Some("authentic".to_string()),
        };

        let profile = phrase_end_cadence_profile(&segment, 2.78, 0.18, Some(&anchor));

        assert_eq!(profile.target_chord_index, 2);
        assert!(profile.chord_settle > 0.5);
    }

    #[test]
    fn cadence_anchor_strength_lifts_tail_settle_beyond_focus_inference() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 3.8,
            section: "Outro".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 90.0,
            root_hz: 196.0,
            progression: &[
                ChordFrame {
                    root_shift: 5,
                    intervals: &[0, 3, 7],
                },
                ChordFrame {
                    root_shift: 2,
                    intervals: &[0, 3, 7, 10],
                },
                ChordFrame {
                    root_shift: 0,
                    intervals: &[0, 4, 7, 11],
                },
            ],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Strings,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("release".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("resolved".to_string()),
            }),
            melody_hint: None,
        };
        let anchor = VocalCadenceAnchorHint {
            start_sec: 3.12,
            duration_sec: 0.46,
            strength: 0.92,
            cue_index: 6,
            phrase_order: 0,
            role: Some("release".to_string()),
            cadence: Some("resolved".to_string()),
        };

        let anchored = phrase_end_cadence_profile(&segment, 3.28, 0.08, Some(&anchor));
        let inferred = phrase_end_cadence_profile(&segment, 3.28, 0.08, None);

        assert!(anchored.chord_settle > inferred.chord_settle);
        assert!(anchored.bass_settle >= anchored.chord_settle);
        assert!(anchored.density_scale < inferred.density_scale);
    }

    #[test]
    fn cadence_anchor_shapes_long_tail_orchestration_toward_landing() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 3.8,
            section: "Outro".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 90.0,
            root_hz: 196.0,
            progression: &[
                ChordFrame {
                    root_shift: 5,
                    intervals: &[0, 3, 7],
                },
                ChordFrame {
                    root_shift: 2,
                    intervals: &[0, 3, 7, 10],
                },
                ChordFrame {
                    root_shift: 0,
                    intervals: &[0, 4, 7, 11],
                },
            ],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Strings,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("release".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("resolved".to_string()),
            }),
            melody_hint: None,
        };
        let anchor = VocalCadenceAnchorHint {
            start_sec: 3.12,
            duration_sec: 0.46,
            strength: 0.92,
            cue_index: 6,
            phrase_order: 0,
            role: Some("release".to_string()),
            cadence: Some("resolved".to_string()),
        };

        let anchored = phrase_end_cadence_profile(&segment, 3.28, 0.08, Some(&anchor));
        let inferred = phrase_end_cadence_profile(&segment, 3.28, 0.08, None);

        assert!(anchored.strings_settle_gain > inferred.strings_settle_gain);
        assert!(anchored.choir_settle_gain > inferred.choir_settle_gain);
        assert!(anchored.atmosphere_settle_gain < inferred.atmosphere_settle_gain);
        assert!(anchored.shimmer_trim < inferred.shimmer_trim);
    }

    #[test]
    fn cadence_settle_changes_tail_figure_motion_for_strings_choir_and_shimmer() {
        let strings_open = strings_voice(
            220.0,
            &[0, 4, 7, 11],
            1.24,
            SegmentEnergy::Medium,
            ArrangementStyle::Strings,
            0.0,
        )
        .abs();
        let strings_settled = strings_voice(
            220.0,
            &[0, 4, 7, 11],
            1.24,
            SegmentEnergy::Medium,
            ArrangementStyle::Strings,
            0.92,
        )
        .abs();
        let choir_open = choir_voice(
            220.0,
            &[0, 4, 7, 11],
            1.24,
            SegmentEnergy::Medium,
            ArrangementStyle::Strings,
            0.0,
        )
        .abs();
        let choir_settled = choir_voice(
            220.0,
            &[0, 4, 7, 11],
            1.24,
            SegmentEnergy::Medium,
            ArrangementStyle::Strings,
            0.92,
        )
        .abs();
        let shimmer_open = shimmer_voice(440.0, 0.18, 0.86, SegmentEnergy::High, 0.0).abs();
        let shimmer_settled = shimmer_voice(440.0, 0.18, 0.86, SegmentEnergy::High, 0.92).abs();

        assert!((strings_settled - strings_open).abs() > 0.002);
        assert!((choir_settled - choir_open).abs() > 0.002);
        assert!((shimmer_settled - shimmer_open).abs() > 0.002);
    }

    #[test]
    fn guofeng_tail_cadence_uses_softer_choir_and_smokier_atmosphere_motion() {
        let guofeng_strings = strings_voice(
            220.0,
            &[0, 4, 7, 11],
            1.36,
            SegmentEnergy::Medium,
            ArrangementStyle::Guofeng,
            0.94,
        )
        .abs();
        let standard_strings = strings_voice(
            220.0,
            &[0, 4, 7, 11],
            1.36,
            SegmentEnergy::Medium,
            ArrangementStyle::Strings,
            0.94,
        )
        .abs();
        let guofeng_choir = choir_voice(
            220.0,
            &[0, 4, 7, 11],
            1.36,
            SegmentEnergy::Medium,
            ArrangementStyle::Guofeng,
            0.94,
        )
        .abs();
        let standard_choir = choir_voice(
            220.0,
            &[0, 4, 7, 11],
            1.36,
            SegmentEnergy::Medium,
            ArrangementStyle::Strings,
            0.94,
        )
        .abs();
        let guofeng_air = atmosphere_tail_voice(
            440.0,
            0.2,
            0.86,
            SegmentEnergy::High,
            ArrangementStyle::Guofeng,
            0.94,
        )
        .abs();
        let standard_air = atmosphere_tail_voice(
            440.0,
            0.2,
            0.86,
            SegmentEnergy::High,
            ArrangementStyle::Strings,
            0.94,
        )
        .abs();

        assert!((guofeng_strings - standard_strings).abs() > 0.004);
        assert!(guofeng_choir < standard_choir);
        assert!((guofeng_air - standard_air).abs() > 0.004);
    }

    #[test]
    fn guofeng_terminal_settle_pushes_drag_bow_and_tail_smoke_more_than_open_state() {
        let strings_open = strings_voice(
            196.0,
            &[0, 4, 7],
            1.72,
            SegmentEnergy::Medium,
            ArrangementStyle::Guofeng,
            0.08,
        )
        .abs();
        let strings_settled = strings_voice(
            196.0,
            &[0, 4, 7],
            1.72,
            SegmentEnergy::Medium,
            ArrangementStyle::Guofeng,
            0.96,
        )
        .abs();
        let choir_open = choir_voice(
            196.0,
            &[0, 4, 7],
            1.72,
            SegmentEnergy::High,
            ArrangementStyle::Guofeng,
            0.08,
        )
        .abs();
        let choir_settled = choir_voice(
            196.0,
            &[0, 4, 7],
            1.72,
            SegmentEnergy::High,
            ArrangementStyle::Guofeng,
            0.96,
        )
        .abs();
        let air_open = atmosphere_tail_voice(
            392.0,
            0.24,
            0.84,
            SegmentEnergy::High,
            ArrangementStyle::Guofeng,
            0.08,
        )
        .abs();
        let air_settled = atmosphere_tail_voice(
            392.0,
            0.24,
            0.84,
            SegmentEnergy::High,
            ArrangementStyle::Guofeng,
            0.96,
        )
        .abs();

        assert!((strings_settled - strings_open).abs() > 0.003);
        assert!(choir_settled < choir_open);
        assert!((air_settled - air_open).abs() > 0.004);
    }

    #[test]
    fn guofeng_bass_tail_settle_reduces_attack_and_holds_bloom() {
        let bass_open = bass_voice(
            110.0,
            0.18,
            0.52,
            SegmentEnergy::Medium,
            ArrangementStyle::Guofeng,
            0.06,
        )
        .abs();
        let bass_settled = bass_voice(
            110.0,
            0.18,
            0.52,
            SegmentEnergy::Medium,
            ArrangementStyle::Guofeng,
            0.94,
        )
        .abs();
        let sub_open = sub_bass_voice(
            110.0,
            0.34,
            0.52,
            SegmentEnergy::Medium,
            ArrangementStyle::Guofeng,
            0.06,
        )
        .abs();
        let sub_settled = sub_bass_voice(
            110.0,
            0.34,
            0.52,
            SegmentEnergy::Medium,
            ArrangementStyle::Guofeng,
            0.94,
        )
        .abs();

        assert!((bass_settled - bass_open).abs() > 0.003);
        assert!(sub_settled < sub_open);
    }

    #[test]
    fn guofeng_percussion_tail_settle_makes_frame_and_board_more_breathed() {
        let board_open = board_hit_voice(0.018, 0.04).abs();
        let board_settled = board_hit_voice(0.018, 0.94).abs();
        let frame_open = frame_drum_voice(0.09, 0.04).abs();
        let frame_settled = frame_drum_voice(0.09, 0.94).abs();
        assert!((board_settled - board_open).abs() > 0.003);
        assert!((frame_settled - frame_open).abs() > 0.001);
    }

    #[test]
    fn guofeng_tail_release_profile_makes_pluck_stop_before_counter() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Outro".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 88.0,
            root_hz: 196.0,
            progression: &[
                ChordFrame {
                    root_shift: 5,
                    intervals: &[0, 3, 7],
                },
                ChordFrame {
                    root_shift: 2,
                    intervals: &[0, 3, 7, 10],
                },
                ChordFrame {
                    root_shift: 0,
                    intervals: &[0, 4, 7, 11],
                },
            ],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("resolve".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("resolved".to_string()),
            }),
            melody_hint: None,
        };
        let cadence = phrase_end_cadence_profile(&segment, 3.54, 0.82, None);
        let profile = guofeng_tail_release_profile(&segment, 3.54, &cadence);

        assert!(profile.pluck_gate < profile.counter_gate);
        assert!(profile.pluck_gate < 0.45);
        assert!(profile.frame_tail > cadence.chord_settle * 0.8);
    }

    #[test]
    fn guofeng_tail_release_changes_pluck_counter_and_frame_in_different_orders() {
        let pluck_open = pluck_voice(
            220.0,
            &[0, 4, 7, 11],
            1.82,
            0.42,
            SegmentEnergy::Medium,
            ArrangementStyle::Guofeng,
            1.0,
            0.0,
        )
        .abs();
        let pluck_stopped = pluck_voice(
            220.0,
            &[0, 4, 7, 11],
            1.82,
            0.42,
            SegmentEnergy::Medium,
            ArrangementStyle::Guofeng,
            0.18,
            0.0,
        )
        .abs();
        let counter_open = counter_voice(
            220.0,
            &[0, 4, 7, 4],
            1.82,
            0.42,
            SegmentEnergy::Medium,
            ArrangementStyle::Guofeng,
            1.0,
            0.0,
        )
        .abs();
        let counter_late = counter_voice(
            220.0,
            &[0, 4, 7, 4],
            1.82,
            0.42,
            SegmentEnergy::Medium,
            ArrangementStyle::Guofeng,
            0.52,
            0.0,
        )
        .abs();
        let frame_open = frame_drum_voice(0.09, 0.18).abs();
        let frame_tail = frame_drum_voice(0.09, 0.86).abs();

        assert!(pluck_stopped < pluck_open);
        assert!(counter_late < counter_open);
        assert!(pluck_stopped < counter_late);
        assert!((frame_tail - frame_open).abs() > 0.001);
    }

    #[test]
    fn phrase_breath_profile_makes_pluck_yield_before_counter_at_internal_gap() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus 1".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 92.0,
            root_hz: 220.0,
            progression: &[
                ChordFrame {
                    root_shift: 0,
                    intervals: &[0, 4, 7],
                },
                ChordFrame {
                    root_shift: 5,
                    intervals: &[0, 4, 7, 11],
                },
            ],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: None,
        };

        let profile = phrase_breath_profile(&segment, 1.84);
        assert!(profile.pluck_gate < profile.counter_gate);
        assert!(profile.percussion_gate < profile.counter_gate);
        assert!(profile.pluck_gate < 0.62);
    }

    #[test]
    fn phrase_breath_profile_lets_counter_fill_after_gap_more_than_pluck() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Verse".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 86.0,
            root_hz: 196.0,
            progression: &[
                ChordFrame {
                    root_shift: 0,
                    intervals: &[0, 4, 7],
                },
                ChordFrame {
                    root_shift: 2,
                    intervals: &[0, 3, 7, 10],
                },
            ],
            counter_pattern: &[0, 3, 5, 7],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("half".to_string()),
            }),
            melody_hint: None,
        };

        let near_gap = phrase_breath_profile(&segment, 1.84);
        let after_gap = phrase_breath_profile(&segment, 2.12);

        assert!(after_gap.counter_fill_gain > 1.0);
        assert!(after_gap.counter_fill_gain > near_gap.counter_fill_gain);
        assert!(after_gap.pluck_gate > near_gap.pluck_gate);
    }

    #[test]
    fn token_focus_breath_profile_ducks_before_keyword_window() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus 1".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 90.0,
            root_hz: 220.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: None,
        };
        let hints = vec![VocalFocusHint {
            start_sec: 1.8,
            duration_sec: 0.36,
            strength: 0.9,
            section: Some("Chorus 1".to_string()),
            token: Some("回家".to_string()),
        }];

        let before = token_focus_breath_profile(&segment, 1.74, &hints);
        let outside = token_focus_breath_profile(&segment, 1.1, &hints);

        assert!(before.pluck_gate < outside.pluck_gate);
        assert!(before.percussion_gate < outside.percussion_gate);
        assert!(before.counter_gate <= outside.counter_gate);
    }

    #[test]
    fn token_focus_breath_profile_boosts_counter_after_keyword_release() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Verse".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 86.0,
            root_hz: 196.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 3, 7],
            }],
            counter_pattern: &[0, 3, 5, 7],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("half".to_string()),
            }),
            melody_hint: None,
        };
        let hints = vec![VocalFocusHint {
            start_sec: 1.5,
            duration_sec: 0.28,
            strength: 0.84,
            section: Some("Verse".to_string()),
            token: Some("却还".to_string()),
        }];

        let inside = token_focus_breath_profile(&segment, 1.62, &hints);
        let after = token_focus_breath_profile(&segment, 1.88, &hints);

        assert!(after.counter_fill_gain > inside.counter_fill_gain);
        assert!(after.counter_fill_gain > 1.0);
        assert!(after.pluck_gate >= inside.pluck_gate);
    }

    #[test]
    fn token_focus_lane_breath_ducks_guofeng_wood_frame_and_shaker_before_keyword() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus 1".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 92.0,
            root_hz: 220.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: None,
        };
        let hints = vec![VocalFocusHint {
            start_sec: 1.8,
            duration_sec: 0.34,
            strength: 0.92,
            section: Some("Chorus 1".to_string()),
            token: Some("回家".to_string()),
        }];

        let before = token_focus_lane_breath_profile(&segment, 1.74, &hints);
        let outside = token_focus_lane_breath_profile(&segment, 1.1, &hints);

        assert!(before.wood_gate < outside.wood_gate);
        assert!(before.frame_gate < outside.frame_gate);
        assert!(before.shaker_gate < outside.shaker_gate);
        assert!(before.kick_gate <= outside.kick_gate);
    }

    #[test]
    fn token_focus_lane_breath_recovers_low_end_after_keyword_release() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Verse".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 86.0,
            root_hz: 196.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 3, 7],
            }],
            counter_pattern: &[0, 3, 5, 7],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("half".to_string()),
            }),
            melody_hint: None,
        };
        let hints = vec![VocalFocusHint {
            start_sec: 1.5,
            duration_sec: 0.28,
            strength: 0.84,
            section: Some("Verse".to_string()),
            token: Some("却还".to_string()),
        }];

        let inside = token_focus_lane_breath_profile(&segment, 1.6, &hints);
        let after = token_focus_lane_breath_profile(&segment, 1.9, &hints);

        assert!(after.kick_gate >= inside.kick_gate);
        assert!(after.bass_emphasis >= inside.bass_emphasis);
        assert!(after.wood_gate >= inside.wood_gate);
    }

    #[test]
    fn token_focus_lane_role_routing_prefers_frame_over_wood_before_keyword() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus 1".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 92.0,
            root_hz: 220.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: None,
        };
        let hints = vec![VocalFocusHint {
            start_sec: 1.8,
            duration_sec: 0.34,
            strength: 0.92,
            section: Some("Chorus 1".to_string()),
            token: Some("回家".to_string()),
        }];

        let before = token_focus_lane_breath_profile(&segment, 1.74, &hints);

        assert!(before.frame_role_gain > before.wood_role_gain);
        assert!(before.frame_role_gain > before.shaker_role_gain);
    }

    #[test]
    fn token_focus_lane_role_routing_returns_wood_before_frame_after_keyword() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Verse".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 86.0,
            root_hz: 196.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 3, 7],
            }],
            counter_pattern: &[0, 3, 5, 7],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("half".to_string()),
            }),
            melody_hint: None,
        };
        let hints = vec![VocalFocusHint {
            start_sec: 1.5,
            duration_sec: 0.28,
            strength: 0.84,
            section: Some("Verse".to_string()),
            token: Some("却还".to_string()),
        }];

        let after = token_focus_lane_breath_profile(&segment, 1.9, &hints);

        assert!(after.wood_role_gain > after.frame_role_gain);
        assert!(after.wood_role_gain > after.shaker_role_gain);
    }

    #[test]
    fn token_reply_routing_prefers_counter_fill_for_response_answer() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus 1".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 92.0,
            root_hz: 220.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: None,
        };
        let hints = vec![VocalFocusHint {
            start_sec: 1.8,
            duration_sec: 0.34,
            strength: 0.92,
            section: Some("Chorus 1".to_string()),
            token: Some("回家".to_string()),
        }];

        let reply = token_focus_reply_routing_profile(&segment, 2.2, &hints);
        assert!(reply.counter_reply_gain > reply.pluck_reply_gain);
        assert!(reply.counter_reply_gain > reply.lead_gap_fill_gain);
    }

    #[test]
    fn token_reply_routing_prefers_pluck_fill_for_setup_phrase() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Verse".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 86.0,
            root_hz: 196.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 3, 7],
            }],
            counter_pattern: &[0, 3, 5, 7],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("setup".to_string()),
                variation_role: Some("primary".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: None,
        };
        let hints = vec![VocalFocusHint {
            start_sec: 1.4,
            duration_sec: 0.26,
            strength: 0.8,
            section: Some("Verse".to_string()),
            token: Some("风起".to_string()),
        }];

        let reply = token_focus_reply_routing_profile(&segment, 1.78, &hints);
        assert!(reply.pluck_reply_gain > reply.counter_reply_gain);
        assert!(reply.pluck_reply_gain >= reply.lead_gap_fill_gain);
    }

    #[test]
    fn token_reply_pitch_prefers_counter_falling_answer_for_response_phrase() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus 1".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 92.0,
            root_hz: 220.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: None,
        };
        let hints = vec![VocalFocusHint {
            start_sec: 1.8,
            duration_sec: 0.34,
            strength: 0.92,
            section: Some("Chorus 1".to_string()),
            token: Some("回家".to_string()),
        }];

        let pitch = token_focus_reply_pitch_profile(
            &segment,
            2.2,
            &hints,
            &ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            },
            7,
            9,
            12,
        );
        assert!(pitch.counter_semitone_offset < 0.0);
        assert!(pitch.counter_semitone_offset < pitch.lead_semitone_offset);
        assert!(pitch.pluck_semitone_offset >= -0.1);
    }

    #[test]
    fn token_reply_pitch_prefers_pluck_lift_for_setup_phrase() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Verse".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 86.0,
            root_hz: 196.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 3, 7],
            }],
            counter_pattern: &[0, 3, 5, 7],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("setup".to_string()),
                variation_role: Some("primary".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: None,
        };
        let hints = vec![VocalFocusHint {
            start_sec: 1.4,
            duration_sec: 0.26,
            strength: 0.8,
            section: Some("Verse".to_string()),
            token: Some("风起".to_string()),
        }];

        let pitch = token_focus_reply_pitch_profile(
            &segment,
            1.78,
            &hints,
            &ChordFrame {
                root_shift: 0,
                intervals: &[0, 3, 7],
            },
            4,
            3,
            12,
        );
        assert!(pitch.pluck_semitone_offset > 0.0);
        assert!(pitch.pluck_semitone_offset > pitch.counter_semitone_offset);
    }

    #[test]
    fn token_reply_pitch_aligns_resolve_phrase_to_stable_cadence_tones() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Outro".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 84.0,
            root_hz: 196.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7, 11],
            }],
            counter_pattern: &[0, 4, 7, 11],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("resolve".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("authentic".to_string()),
            }),
            melody_hint: None,
        };
        let hints = vec![VocalFocusHint {
            start_sec: 3.2,
            duration_sec: 0.28,
            strength: 0.88,
            section: Some("Outro".to_string()),
            token: Some("归".to_string()),
        }];

        let open = token_focus_reply_pitch_profile(
            &segment,
            3.5,
            &hints,
            &ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7, 11],
            },
            6,
            6,
            13,
        );
        assert!(open.counter_semitone_offset < 0.0);
        assert!(open.pluck_semitone_offset <= 0.0);
    }

    #[test]
    fn token_reply_pitch_uses_guidetone_lift_more_for_open_than_resolved_setup() {
        let hints = vec![VocalFocusHint {
            start_sec: 1.4,
            duration_sec: 0.26,
            strength: 0.8,
            section: Some("Verse".to_string()),
            token: Some("风起".to_string()),
        }];
        let setup_open = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Verse".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 86.0,
            root_hz: 196.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 3, 7],
            }],
            counter_pattern: &[0, 3, 5, 7],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("setup".to_string()),
                variation_role: Some("primary".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: None,
        };
        let setup_resolved = PhraseSegment {
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("setup".to_string()),
                variation_role: Some("primary".to_string()),
                cadence_intent: Some("resolved".to_string()),
            }),
            melody_hint: None,
            ..setup_open.clone()
        };

        let open_pitch = token_focus_reply_pitch_profile(
            &setup_open,
            1.78,
            &hints,
            &ChordFrame {
                root_shift: 0,
                intervals: &[0, 3, 7],
            },
            4,
            3,
            12,
        );
        let resolved_pitch = token_focus_reply_pitch_profile(
            &setup_resolved,
            1.78,
            &hints,
            &ChordFrame {
                root_shift: 0,
                intervals: &[0, 3, 7],
            },
            4,
            3,
            12,
        );

        assert!(open_pitch.pluck_semitone_offset >= resolved_pitch.pluck_semitone_offset);
    }

    #[test]
    fn token_reply_harmony_space_ducks_low_end_more_for_resolved_reply_motion() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Outro".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 84.0,
            root_hz: 196.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7, 11],
            }],
            counter_pattern: &[0, 4, 7, 11],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("resolve".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("resolved".to_string()),
            }),
            melody_hint: None,
        };
        let settled = token_reply_harmony_space_profile(
            &segment,
            &TokenReplyPitchProfile {
                counter_semitone_offset: -0.9,
                pluck_semitone_offset: -0.3,
                lead_semitone_offset: -0.4,
            },
        );
        let open = token_reply_harmony_space_profile(
            &segment,
            &TokenReplyPitchProfile {
                counter_semitone_offset: -0.1,
                pluck_semitone_offset: 0.0,
                lead_semitone_offset: 0.0,
            },
        );

        assert!(settled.bass_duck < open.bass_duck);
        assert!(settled.sub_duck < open.sub_duck);
        assert!(settled.strings_settle_gain > open.strings_settle_gain);
    }

    #[test]
    fn token_reply_harmony_space_lets_open_setup_keep_more_low_end_than_resolved_setup() {
        let setup_open = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Verse".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 86.0,
            root_hz: 196.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 3, 7],
            }],
            counter_pattern: &[0, 3, 5, 7],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("setup".to_string()),
                variation_role: Some("primary".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: None,
        };
        let setup_resolved = PhraseSegment {
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("setup".to_string()),
                variation_role: Some("primary".to_string()),
                cadence_intent: Some("resolved".to_string()),
            }),
            melody_hint: None,
            ..setup_open.clone()
        };
        let pitch = TokenReplyPitchProfile {
            counter_semitone_offset: 0.1,
            pluck_semitone_offset: 0.46,
            lead_semitone_offset: 0.22,
        };

        let open_space = token_reply_harmony_space_profile(&setup_open, &pitch);
        let resolved_space = token_reply_harmony_space_profile(&setup_resolved, &pitch);

        assert!(open_space.pad_duck < 1.0);
        assert!(open_space.strings_duck < resolved_space.strings_duck);
        assert!(open_space.bass_duck >= resolved_space.bass_duck);
    }

    #[test]
    fn load_vocal_plan_hints_reads_reply_harmony_windows() {
        let unique = format!(
            "cssos-reply-harmony-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        );
        let run_dir = std::env::temp_dir().join(unique);
        std::fs::create_dir_all(run_dir.join("./build")).unwrap();
        std::fs::write(
            run_dir.join("./build/vocals.plan.json"),
            serde_json::to_string(&json!({
                "focusEvents": [],
                "cadenceAnchors": [],
                "replyHarmonyWindows": [{
                    "startSec": 1.2,
                    "durationSec": 0.36,
                    "strength": 0.82,
                    "section": "Chorus 1",
                    "token": "回家",
                    "role": "response",
                    "cadence": "open",
                    "cueIndex": 1,
                    "phraseOrder": 0,
                    "bassDuck": 0.9,
                    "subDuck": 0.92,
                    "padDuck": 0.86,
                    "stringsDuck": 0.88,
                    "stringsSettleGain": 1.06
                }]
            }))
            .unwrap(),
        )
        .unwrap();

        let hints = load_vocal_plan_hints(&run_dir);
        assert_eq!(hints.reply_harmony_windows.len(), 1);
        let window = &hints.reply_harmony_windows[0];
        assert_eq!(window.section.as_deref(), Some("Chorus 1"));
        assert_eq!(window.role.as_deref(), Some("response"));
        assert_eq!(window.cadence.as_deref(), Some("open"));
        assert!(window.pad_duck < 1.0);
        assert!(window.strings_settle_gain > 1.0);
        let _ = std::fs::remove_dir_all(run_dir);
    }

    #[test]
    fn reply_harmony_window_profile_prefers_explicit_sidecar_window() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus 1".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 92.0,
            root_hz: 220.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: None,
        };
        let explicit = reply_harmony_window_profile(
            &segment,
            1.34,
            &[VocalReplyHarmonyWindowHint {
                start_sec: 1.2,
                duration_sec: 0.36,
                strength: 0.82,
                section: Some("Chorus 1".to_string()),
                token: Some("回家".to_string()),
                role: Some("response".to_string()),
                cadence: Some("open".to_string()),
                cue_index: 1,
                phrase_order: 0,
                bass_duck: 0.9,
                sub_duck: 0.92,
                pad_duck: 0.86,
                strings_duck: 0.88,
                strings_settle_gain: 1.06,
            }],
        )
        .unwrap();

        assert!(explicit.pad_duck < 1.0);
        assert!(explicit.bass_duck < 1.0);
        assert!(explicit.strings_settle_gain > 1.0);
    }

    #[test]
    fn lead_pattern_uses_melody_hint_targets_and_landing_tone() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus 1".to_string(),
            energy: SegmentEnergy::High,
            tempo_bpm: 104.0,
            root_hz: 220.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7, 11],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("release".to_string()),
                variation_role: Some("repeat".to_string()),
                cadence_intent: Some("authentic".to_string()),
            }),
            melody_hint: Some(ExternalMelodyHint {
                contour: Some("soaring_arc".to_string()),
                phrase_function: Some("hook".to_string()),
                hook_strength: Some(0.94),
                target_degrees: vec![1, 2, 3, 5],
                register_anchor: Some("mid_high".to_string()),
                motion_bias: Some("stepwise".to_string()),
                leap_budget: Some(4),
                landing_tone: Some("tonic".to_string()),
                ornamentation: Some("glide_turn".to_string()),
                repetition_window_bars: Some(2),
                counterline_role: Some("octave_doubles".to_string()),
                lyric_stress_map: vec!["hold".to_string(), "lift".to_string()],
                climax_bar: Some(3),
                antecedent_phrase_id: None,
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
        };

        let pattern = lead_pattern(&segment);

        assert!(pattern.len() >= 4);
        assert_eq!(pattern[0], 5);
        assert_eq!(*pattern.last().unwrap(), 12);
        assert_eq!(pattern[3], pattern[0]);
        assert_eq!(pattern[5], pattern[2]);
        assert!(pattern[4] > pattern[2]);
        assert!(pattern[4] - pattern[3] >= 5);
        assert!(pattern.windows(2).enumerate().all(|(index, window)| {
            let leap = (window[1] - window[0]).abs();
            if index == 3 {
                leap <= 12
            } else {
                leap <= 7
            }
        }));
    }

    #[test]
    fn lead_pattern_falls_back_to_legacy_shape_without_melody_targets() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Bridge".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 92.0,
            root_hz: 196.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 3, 7, 10],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Strings,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("lift".to_string()),
                variation_role: Some("development".to_string()),
                cadence_intent: Some("half".to_string()),
            }),
            melody_hint: Some(ExternalMelodyHint {
                contour: Some("lift_then_fall".to_string()),
                phrase_function: Some("lift".to_string()),
                hook_strength: Some(0.48),
                target_degrees: vec![],
                register_anchor: Some("mid".to_string()),
                motion_bias: Some("balanced_lift".to_string()),
                leap_budget: Some(6),
                landing_tone: Some("dominant".to_string()),
                ornamentation: Some("neighbor".to_string()),
                repetition_window_bars: Some(4),
                counterline_role: Some("echo_answer".to_string()),
                lyric_stress_map: vec!["hold".to_string()],
                climax_bar: Some(2),
                antecedent_phrase_id: Some("phrase_a".to_string()),
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
        };

        assert_eq!(lead_pattern(&segment), vec![0, 3, 5, 8, 10, 8, 5, 3]);
    }

    #[test]
    fn melody_support_profile_ducks_consequent_and_cadence_layers() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus 1".to_string(),
            energy: SegmentEnergy::High,
            tempo_bpm: 104.0,
            root_hz: 220.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7, 11],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("release".to_string()),
                variation_role: Some("repeat".to_string()),
                cadence_intent: Some("authentic".to_string()),
            }),
            melody_hint: Some(ExternalMelodyHint {
                contour: Some("soaring_arc".to_string()),
                phrase_function: Some("hook".to_string()),
                hook_strength: Some(0.94),
                target_degrees: vec![1, 2, 3, 5],
                register_anchor: Some("mid_high".to_string()),
                motion_bias: Some("stepwise".to_string()),
                leap_budget: Some(4),
                landing_tone: Some("tonic".to_string()),
                ornamentation: Some("glide_turn".to_string()),
                repetition_window_bars: Some(2),
                counterline_role: Some("octave_doubles".to_string()),
                lyric_stress_map: vec!["hold".to_string(), "lift".to_string()],
                climax_bar: Some(3),
                antecedent_phrase_id: Some("verse_a".to_string()),
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
        };

        let early = melody_support_profile(&segment, 1, 8);
        let late = melody_support_profile(&segment, 7, 8);

        assert!(late.counter_gain < early.counter_gain);
        assert!(late.pluck_gain < early.pluck_gain);
        assert!(late.pad_duck < early.pad_duck);
        assert!(late.percussion_gate < early.percussion_gate);
    }

    #[test]
    fn accompaniment_note_selection_follows_answer_and_cadence() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus 1".to_string(),
            energy: SegmentEnergy::High,
            tempo_bpm: 104.0,
            root_hz: 220.0,
            progression: &[
                ChordFrame {
                    root_shift: 0,
                    intervals: &[0, 4, 7],
                },
                ChordFrame {
                    root_shift: 5,
                    intervals: &[0, 4, 7],
                },
            ],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("authentic".to_string()),
            }),
            melody_hint: Some(ExternalMelodyHint {
                contour: Some("soaring_arc".to_string()),
                phrase_function: Some("hook".to_string()),
                hook_strength: Some(0.9),
                target_degrees: vec![1, 3, 5, 6, 5, 3, 2, 1],
                register_anchor: Some("mid".to_string()),
                motion_bias: Some("balanced".to_string()),
                leap_budget: Some(7),
                landing_tone: Some("authentic".to_string()),
                ornamentation: Some("glide_turn".to_string()),
                repetition_window_bars: Some(2),
                counterline_role: Some("echo_answer".to_string()),
                lyric_stress_map: vec!["hold".to_string()],
                climax_bar: Some(2),
                antecedent_phrase_id: Some("phrase_a".to_string()),
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
        };
        let pattern = lead_pattern(&segment);
        let late_lead = select_lead_degree_for_step(&segment, &pattern, 7, 8);
        let early_counter = select_counter_interval_for_step(
            &segment,
            &segment.progression[0],
            pattern[1],
            1,
            0.5,
            8,
        );
        let late_counter = select_counter_interval_for_step(
            &segment,
            &segment.progression[1],
            late_lead,
            7,
            0.5,
            8,
        );
        let late_pluck =
            select_pluck_interval_for_step(&segment, &segment.progression[1], &pattern, 15, 16);
        let late_bass_index = select_bass_chord_index_for_step(&segment, 0, 1, 7, 8);

        assert_ne!(late_counter, early_counter);
        assert_eq!(late_pluck.rem_euclid(12), 7);
        assert_eq!(late_bass_index, 1);
    }

    #[test]
    fn call_response_counterline_routes_to_brighter_answer_motion() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Bridge".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 96.0,
            root_hz: 220.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: Some(ExternalMelodyHint {
                contour: Some("lift_then_fall".to_string()),
                phrase_function: Some("answer".to_string()),
                hook_strength: Some(0.7),
                target_degrees: vec![1, 2, 3, 5, 4, 3, 2, 1],
                register_anchor: Some("mid".to_string()),
                motion_bias: Some("balanced".to_string()),
                leap_budget: Some(5),
                landing_tone: Some("open".to_string()),
                ornamentation: Some("lean".to_string()),
                repetition_window_bars: Some(2),
                counterline_role: Some("call_response".to_string()),
                lyric_stress_map: vec!["hold".to_string()],
                climax_bar: Some(2),
                antecedent_phrase_id: Some("phrase_a".to_string()),
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
        };
        let pattern = lead_pattern(&segment);
        let late_lead = select_lead_degree_for_step(&segment, &pattern, 6, 8);
        let answer_counter = select_counter_interval_for_step(
            &segment,
            &segment.progression[0],
            late_lead,
            6,
            0.5,
            8,
        );
        let answer_pluck =
            select_pluck_interval_for_step(&segment, &segment.progression[0], &pattern, 12, 16);
        let answer_bass_index = select_bass_chord_index_for_step(&segment, 0, 0, 6, 8);

        assert!(answer_counter >= late_lead);
        assert!(answer_pluck.rem_euclid(12) == 0 || answer_pluck.rem_euclid(12) == 7);
        assert_eq!(answer_bass_index, 0);
    }

    #[test]
    fn counterline_motion_profile_changes_density_by_role() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Verse".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: 92.0,
            root_hz: 220.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: Some(ExternalMelodyHint {
                contour: Some("lift_then_fall".to_string()),
                phrase_function: Some("answer".to_string()),
                hook_strength: Some(0.72),
                target_degrees: vec![1, 2, 3, 5, 4, 3, 2, 1],
                register_anchor: Some("mid".to_string()),
                motion_bias: Some("balanced".to_string()),
                leap_budget: Some(5),
                landing_tone: Some("open".to_string()),
                ornamentation: Some("lean".to_string()),
                repetition_window_bars: Some(2),
                counterline_role: Some("echo_answer".to_string()),
                lyric_stress_map: vec!["hold".to_string()],
                climax_bar: Some(2),
                antecedent_phrase_id: Some("phrase_a".to_string()),
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
        };

        let early = counterline_motion_profile(&segment, 1, 0.5, 8);
        let late = counterline_motion_profile(&segment, 6, 0.5, 8);

        assert!(early.counter_step_gate < late.counter_step_gate);
        assert!(early.pluck_step_gate < late.pluck_step_gate);
        assert!(late.counter_push_sec > 0.0);
        assert!(late.pluck_push_sec > 0.0);
    }

    #[test]
    fn call_response_counterline_prefers_late_offbeats() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus".to_string(),
            energy: SegmentEnergy::High,
            tempo_bpm: 108.0,
            root_hz: 261.63,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("chorus".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("half".to_string()),
            }),
            melody_hint: Some(ExternalMelodyHint {
                contour: Some("soaring_arc".to_string()),
                phrase_function: Some("answer".to_string()),
                hook_strength: Some(0.91),
                target_degrees: vec![5, 6, 1, 2, 3, 2, 1, 7],
                register_anchor: Some("mid_high".to_string()),
                motion_bias: Some("lift".to_string()),
                leap_budget: Some(6),
                landing_tone: Some("half".to_string()),
                ornamentation: Some("glide_turn".to_string()),
                repetition_window_bars: Some(2),
                counterline_role: Some("call_response".to_string()),
                lyric_stress_map: vec!["push".to_string()],
                climax_bar: Some(2),
                antecedent_phrase_id: Some("phrase_intro".to_string()),
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
        };

        let late_strong = counterline_motion_profile(&segment, 4, 0.5, 8);
        let late_offbeat = counterline_motion_profile(&segment, 6, 0.5, 8);

        assert!(late_offbeat.counter_step_gate > late_strong.counter_step_gate);
        assert!(late_offbeat.pluck_step_gate > late_strong.pluck_step_gate);
    }

    #[test]
    fn counterline_template_library_changes_entry_cycle() {
        assert_eq!(
            counterline_template_cycle_steps(CounterlineRhythmTemplate::StrongDouble, 16),
            4
        );
        assert_eq!(
            counterline_template_cycle_position(CounterlineRhythmTemplate::StrongDouble, 5, 16),
            1
        );
        assert_eq!(
            counterline_template_cycle_steps(CounterlineRhythmTemplate::OffbeatAnswer, 16),
            8
        );
        assert_eq!(
            counterline_template_cycle_position(CounterlineRhythmTemplate::OffbeatAnswer, 15, 16),
            1
        );
        assert_eq!(
            counterline_template_cycle_steps(CounterlineRhythmTemplate::HookPickup, 16),
            4
        );
        assert_eq!(
            counterline_template_cycle_position(CounterlineRhythmTemplate::HookPickup, 3, 16),
            0
        );
        assert_eq!(
            counterline_template_cycle_steps(CounterlineRhythmTemplate::CadenceSuspension, 16),
            8
        );
        assert_eq!(
            counterline_template_cycle_position(
                CounterlineRhythmTemplate::CadenceSuspension,
                6,
                16
            ),
            0
        );
    }

    #[test]
    fn counterline_pattern_family_groups_templates_into_behavior_buckets() {
        assert_eq!(
            counterline_pattern_family(CounterlineRhythmTemplate::LateEcho),
            CounterlinePatternFamily::EchoTail
        );
        assert_eq!(
            counterline_pattern_family(CounterlineRhythmTemplate::OffbeatAnswer),
            CounterlinePatternFamily::AnswerOffbeat
        );
        assert_eq!(
            counterline_pattern_family(CounterlineRhythmTemplate::HookPickup),
            CounterlinePatternFamily::HookSupport
        );
        assert_eq!(
            counterline_pattern_family(CounterlineRhythmTemplate::CadenceSuspension),
            CounterlinePatternFamily::CadenceHold
        );
    }

    #[test]
    fn counterline_pattern_family_gate_changes_cycle_accents() {
        let echo_early = counterline_pattern_family_gate(CounterlinePatternFamily::EchoTail, 1, 8);
        let echo_late = counterline_pattern_family_gate(CounterlinePatternFamily::EchoTail, 7, 8);
        let answer_even =
            counterline_pattern_family_gate(CounterlinePatternFamily::AnswerOffbeat, 2, 8);
        let answer_offbeat =
            counterline_pattern_family_gate(CounterlinePatternFamily::AnswerOffbeat, 3, 8);
        assert!(echo_late > echo_early);
        assert!(answer_offbeat > answer_even);
    }

    #[test]
    fn counterline_pattern_family_pulse_changes_family_cycle_shape() {
        let hook_downbeat =
            counterline_pattern_family_pulse(CounterlinePatternFamily::HookSupport, 0, 4);
        let hook_mid =
            counterline_pattern_family_pulse(CounterlinePatternFamily::HookSupport, 1, 4);
        let cadence_early =
            counterline_pattern_family_pulse(CounterlinePatternFamily::CadenceHold, 0, 4);
        let cadence_late =
            counterline_pattern_family_pulse(CounterlinePatternFamily::CadenceHold, 3, 4);
        assert!(hook_downbeat > hook_mid);
        assert!(cadence_late > cadence_early);
    }

    #[test]
    fn counterline_rhythm_template_selection_uses_role_phrase_and_cadence_context() {
        let hook_double = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus".to_string(),
            energy: SegmentEnergy::High,
            tempo_bpm: 108.0,
            root_hz: 261.63,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("release".to_string()),
                variation_role: Some("repeat".to_string()),
                cadence_intent: Some("authentic".to_string()),
            }),
            melody_hint: Some(ExternalMelodyHint {
                contour: Some("soaring_arc".to_string()),
                phrase_function: Some("hook".to_string()),
                hook_strength: Some(0.94),
                target_degrees: vec![1, 3, 5, 6],
                register_anchor: Some("high".to_string()),
                motion_bias: Some("balanced_lift".to_string()),
                leap_budget: Some(4),
                landing_tone: Some("tonic".to_string()),
                ornamentation: Some("belt_accent".to_string()),
                repetition_window_bars: Some(2),
                counterline_role: Some("octave_doubles".to_string()),
                lyric_stress_map: vec!["lift".to_string()],
                climax_bar: Some(2),
                antecedent_phrase_id: None,
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
        };
        let hook_pickup = PhraseSegment {
            melody_hint: Some(ExternalMelodyHint {
                counterline_role: Some("call_response".to_string()),
                phrase_function: Some("hook".to_string()),
                hook_strength: Some(0.95),
                contour: Some("soaring_arc".to_string()),
                target_degrees: vec![1, 2, 3, 5],
                register_anchor: Some("mid_high".to_string()),
                motion_bias: Some("balanced_lift".to_string()),
                leap_budget: Some(5),
                landing_tone: Some("dominant".to_string()),
                ornamentation: Some("glide_turn".to_string()),
                repetition_window_bars: Some(2),
                lyric_stress_map: vec!["lift".to_string()],
                climax_bar: Some(2),
                antecedent_phrase_id: Some("phrase_a".to_string()),
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
            ..hook_double.clone()
        };
        let cadence_suspend = PhraseSegment {
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("half".to_string()),
            }),
            melody_hint: Some(ExternalMelodyHint {
                counterline_role: Some("echo_answer".to_string()),
                phrase_function: Some("answer".to_string()),
                hook_strength: Some(0.62),
                contour: Some("answering_fall".to_string()),
                target_degrees: vec![5, 4, 3, 2],
                register_anchor: Some("mid".to_string()),
                motion_bias: Some("stepwise".to_string()),
                leap_budget: Some(3),
                landing_tone: Some("dominant".to_string()),
                ornamentation: Some("neighbor".to_string()),
                repetition_window_bars: Some(3),
                lyric_stress_map: vec!["answer".to_string()],
                climax_bar: Some(2),
                antecedent_phrase_id: Some("phrase_b".to_string()),
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
            ..hook_double.clone()
        };
        let ripple_answer = PhraseSegment {
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: Some(ExternalMelodyHint {
                counterline_role: Some("none".to_string()),
                phrase_function: Some("answer".to_string()),
                hook_strength: Some(0.54),
                contour: Some("answering_fall".to_string()),
                target_degrees: vec![3, 2, 1, 6],
                register_anchor: Some("mid".to_string()),
                motion_bias: Some("stepwise".to_string()),
                leap_budget: Some(2),
                landing_tone: Some("third".to_string()),
                ornamentation: Some("none".to_string()),
                repetition_window_bars: Some(4),
                lyric_stress_map: vec!["answer".to_string()],
                climax_bar: Some(1),
                antecedent_phrase_id: Some("phrase_c".to_string()),
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
            ..hook_double.clone()
        };

        assert_eq!(
            counterline_rhythm_template(&hook_double),
            CounterlineRhythmTemplate::HookDouble
        );
        assert_eq!(
            counterline_rhythm_template(&hook_pickup),
            CounterlineRhythmTemplate::HookPickup
        );
        assert_eq!(
            counterline_rhythm_template(&cadence_suspend),
            CounterlineRhythmTemplate::CadenceSuspension
        );
        assert_eq!(
            counterline_rhythm_template(&ripple_answer),
            CounterlineRhythmTemplate::RippleAnswer
        );
    }

    #[test]
    fn hook_pickup_and_cadence_suspension_change_entry_and_gate_profile() {
        let hook_pickup = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus".to_string(),
            energy: SegmentEnergy::High,
            tempo_bpm: 108.0,
            root_hz: 261.63,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("release".to_string()),
                variation_role: Some("repeat".to_string()),
                cadence_intent: Some("open".to_string()),
            }),
            melody_hint: Some(ExternalMelodyHint {
                contour: Some("soaring_arc".to_string()),
                phrase_function: Some("hook".to_string()),
                hook_strength: Some(0.95),
                target_degrees: vec![1, 2, 3, 5],
                register_anchor: Some("mid_high".to_string()),
                motion_bias: Some("balanced_lift".to_string()),
                leap_budget: Some(5),
                landing_tone: Some("dominant".to_string()),
                ornamentation: Some("glide_turn".to_string()),
                repetition_window_bars: Some(2),
                counterline_role: Some("call_response".to_string()),
                lyric_stress_map: vec!["lift".to_string()],
                climax_bar: Some(2),
                antecedent_phrase_id: Some("phrase_hook".to_string()),
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
        };
        let cadence_suspend = PhraseSegment {
            phrase_hint: Some(ExternalPhraseHint {
                role: Some("response".to_string()),
                variation_role: Some("answer".to_string()),
                cadence_intent: Some("half".to_string()),
            }),
            melody_hint: Some(ExternalMelodyHint {
                counterline_role: Some("echo_answer".to_string()),
                phrase_function: Some("answer".to_string()),
                hook_strength: Some(0.62),
                contour: Some("answering_fall".to_string()),
                target_degrees: vec![5, 4, 3, 2],
                register_anchor: Some("mid".to_string()),
                motion_bias: Some("stepwise".to_string()),
                leap_budget: Some(3),
                landing_tone: Some("dominant".to_string()),
                ornamentation: Some("neighbor".to_string()),
                repetition_window_bars: Some(3),
                lyric_stress_map: vec!["answer".to_string()],
                climax_bar: Some(2),
                antecedent_phrase_id: Some("phrase_answer".to_string()),
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
            ..hook_pickup.clone()
        };

        let pickup_before_entry = counterline_motion_profile(&hook_pickup, 2, 0.5, 8);
        let pickup_entry = counterline_motion_profile(&hook_pickup, 3, 0.5, 8);
        let cadence_early = counterline_motion_profile(&cadence_suspend, 2, 0.5, 8);
        let cadence_late = counterline_motion_profile(&cadence_suspend, 7, 0.5, 8);

        assert!(pickup_entry.counter_step_gate > pickup_before_entry.counter_step_gate);
        assert!(pickup_entry.counter_push_sec < 0.0);
        assert!(cadence_late.counter_step_gate > cadence_early.counter_step_gate);
        assert!(cadence_late.pluck_step_gate < cadence_late.counter_step_gate);
    }

    #[test]
    fn lead_pattern_groups_hold_and_lift_into_clearer_hook_cells() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus".to_string(),
            energy: SegmentEnergy::High,
            tempo_bpm: 108.0,
            root_hz: 261.63,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: None,
            melody_hint: Some(ExternalMelodyHint {
                contour: Some("soaring_arc".to_string()),
                phrase_function: Some("hook".to_string()),
                hook_strength: Some(0.94),
                target_degrees: vec![1, 2, 3, 5],
                register_anchor: Some("mid_high".to_string()),
                motion_bias: Some("balanced_lift".to_string()),
                leap_budget: Some(5),
                landing_tone: Some("tonic".to_string()),
                ornamentation: Some("belt_accent".to_string()),
                repetition_window_bars: Some(2),
                counterline_role: Some("octave_doubles".to_string()),
                lyric_stress_map: vec!["lift".to_string(), "hold".to_string()],
                climax_bar: Some(2),
                antecedent_phrase_id: Some("phrase_a".to_string()),
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
        };

        let pattern = lead_pattern(&segment);
        assert!(pattern.len() >= 6);
        assert!(pattern.windows(2).any(|window| window[0] == window[1]));
        assert!(pattern[pattern.len() - 2] >= pattern[1]);
    }

    #[test]
    fn lead_pattern_restates_hook_with_variation_not_just_exact_copy() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus".to_string(),
            energy: SegmentEnergy::High,
            tempo_bpm: 108.0,
            root_hz: 261.63,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Guofeng,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: None,
            melody_hint: Some(ExternalMelodyHint {
                contour: Some("soaring_arc".to_string()),
                phrase_function: Some("hook".to_string()),
                hook_strength: Some(0.96),
                target_degrees: vec![1, 3, 5, 6],
                register_anchor: Some("high".to_string()),
                motion_bias: Some("balanced_lift".to_string()),
                leap_budget: Some(5),
                landing_tone: Some("resolve".to_string()),
                ornamentation: Some("belt_accent".to_string()),
                repetition_window_bars: Some(2),
                counterline_role: Some("octave_doubles".to_string()),
                lyric_stress_map: vec!["lift".to_string(), "release".to_string()],
                climax_bar: Some(3),
                antecedent_phrase_id: Some("phrase_a".to_string()),
                note_grouping: vec![],
                hook_restatement_passes: vec![],
            }),
        };

        let pattern = lead_pattern(&segment);
        let motif_len = pattern.len().min(4).max(2);
        let tail = &pattern[pattern.len() - motif_len - 1..pattern.len() - 1];
        assert_ne!(&pattern[..motif_len], tail);
        assert!(tail
            .iter()
            .zip(pattern.iter())
            .any(|(tail_note, head_note)| tail_note > head_note));
    }

    #[test]
    fn lead_pattern_shapes_restatement_pass_roles_into_distinct_tail_motion() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus".to_string(),
            energy: SegmentEnergy::High,
            tempo_bpm: 110.0,
            root_hz: 261.63,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Synth,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: None,
            melody_hint: Some(ExternalMelodyHint {
                contour: Some("soaring_arc".to_string()),
                phrase_function: Some("hook".to_string()),
                hook_strength: Some(0.97),
                target_degrees: vec![1, 3, 5, 6],
                register_anchor: Some("mid_high".to_string()),
                motion_bias: Some("balanced_lift".to_string()),
                leap_budget: Some(6),
                landing_tone: Some("resolve".to_string()),
                ornamentation: Some("belt_accent".to_string()),
                repetition_window_bars: Some(2),
                counterline_role: Some("octave_doubles".to_string()),
                lyric_stress_map: vec!["lift".to_string(), "hold".to_string()],
                climax_bar: Some(3),
                antecedent_phrase_id: Some("phrase_hook".to_string()),
                note_grouping: vec![4, 4, 3, 5],
                hook_restatement_passes: vec![
                    ExternalRestatementPassHint {
                        order: 1,
                        role: "main statement".to_string(),
                        register_bias: "mid".to_string(),
                        sustain_bias: "balanced".to_string(),
                        landing_move: "land on hook root".to_string(),
                    },
                    ExternalRestatementPassHint {
                        order: 2,
                        role: "amplified restatement".to_string(),
                        register_bias: "higher".to_string(),
                        sustain_bias: "longer".to_string(),
                        landing_move: "overshoot then resolve".to_string(),
                    },
                    ExternalRestatementPassHint {
                        order: 3,
                        role: "tail echo".to_string(),
                        register_bias: "mid-high".to_string(),
                        sustain_bias: "long tail".to_string(),
                        landing_move: "glide into cadence".to_string(),
                    },
                ],
            }),
        };

        let pattern = lead_pattern(&segment);
        let third = pattern.len() / 3;
        let amplified_peak = pattern[third..(third * 2)]
            .iter()
            .copied()
            .max()
            .unwrap_or(0);
        let tail_start = third * 2;
        assert!(amplified_peak >= pattern[0] + 2);
        assert!(pattern[tail_start] >= pattern[tail_start.saturating_sub(1)] - 1);
        assert!(pattern[pattern.len() - 1] <= pattern[pattern.len() - 2]);
    }

    #[test]
    fn lead_pattern_gives_answer_and_echo_passes_distinct_phrase_shapes() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Bridge".to_string(),
            energy: SegmentEnergy::High,
            tempo_bpm: 112.0,
            root_hz: 261.63,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Strings,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: None,
            melody_hint: Some(ExternalMelodyHint {
                contour: Some("arched_hook_apex".to_string()),
                phrase_function: Some("hook".to_string()),
                hook_strength: Some(0.95),
                target_degrees: vec![1, 3, 5, 6],
                register_anchor: Some("mid".to_string()),
                motion_bias: Some("balanced".to_string()),
                leap_budget: Some(6),
                landing_tone: Some("resolve".to_string()),
                ornamentation: Some("belt_accent".to_string()),
                repetition_window_bars: Some(2),
                counterline_role: Some("hook_doubles".to_string()),
                lyric_stress_map: vec!["lift".to_string(), "release".to_string()],
                climax_bar: Some(3),
                antecedent_phrase_id: Some("phrase_bridge".to_string()),
                note_grouping: vec![3, 3, 2],
                hook_restatement_passes: vec![
                    ExternalRestatementPassHint {
                        order: 1,
                        role: "deconstruction".to_string(),
                        register_bias: "upper-mid".to_string(),
                        sustain_bias: "clipped".to_string(),
                        landing_move: "avoid root".to_string(),
                    },
                    ExternalRestatementPassHint {
                        order: 2,
                        role: "answer".to_string(),
                        register_bias: "mid".to_string(),
                        sustain_bias: "stretched".to_string(),
                        landing_move: "prepare return".to_string(),
                    },
                    ExternalRestatementPassHint {
                        order: 3,
                        role: "tail echo".to_string(),
                        register_bias: "mid-high".to_string(),
                        sustain_bias: "long tail".to_string(),
                        landing_move: "glide into cadence".to_string(),
                    },
                ],
            }),
        };

        let pattern = lead_pattern(&segment);
        let third = pattern.len() / 3;
        let deconstruction = &pattern[..third];
        let answer = &pattern[third..third * 2];
        let echo = &pattern[third * 2..];
        assert!(deconstruction
            .windows(2)
            .any(|window| window[0] != window[1]));
        assert!(answer.last().copied().unwrap_or_default() <= answer[0] + 2);
        assert!(echo.last().copied().unwrap_or_default() <= echo[0]);
    }

    #[test]
    fn restatement_timing_profile_varies_duration_and_release_by_pass_role() {
        let hint = ExternalMelodyHint {
            contour: Some("arched_hook_apex".to_string()),
            phrase_function: Some("hook".to_string()),
            hook_strength: Some(0.95),
            target_degrees: vec![1, 3, 5, 6],
            register_anchor: Some("mid".to_string()),
            motion_bias: Some("balanced".to_string()),
            leap_budget: Some(6),
            landing_tone: Some("resolve".to_string()),
            ornamentation: Some("belt_accent".to_string()),
            repetition_window_bars: Some(2),
            counterline_role: Some("hook_doubles".to_string()),
            lyric_stress_map: vec!["lift".to_string(), "release".to_string()],
            climax_bar: Some(3),
            antecedent_phrase_id: Some("phrase_bridge".to_string()),
            note_grouping: vec![3, 3, 2],
            hook_restatement_passes: vec![
                ExternalRestatementPassHint {
                    order: 1,
                    role: "deconstruction".to_string(),
                    register_bias: "upper-mid".to_string(),
                    sustain_bias: "clipped".to_string(),
                    landing_move: "avoid root".to_string(),
                },
                ExternalRestatementPassHint {
                    order: 2,
                    role: "answer".to_string(),
                    register_bias: "mid".to_string(),
                    sustain_bias: "stretched".to_string(),
                    landing_move: "prepare return".to_string(),
                },
                ExternalRestatementPassHint {
                    order: 3,
                    role: "tail echo".to_string(),
                    register_bias: "mid-high".to_string(),
                    sustain_bias: "long tail".to_string(),
                    landing_move: "glide into cadence".to_string(),
                },
            ],
        };

        let deconstruction = restatement_timing_profile(Some(&hint), 0, 9, 0.5, 0.52);
        let answer = restatement_timing_profile(Some(&hint), 4, 9, 0.5, 0.52);
        let echo = restatement_timing_profile(Some(&hint), 8, 9, 0.5, 0.52);

        assert!(deconstruction.duration_scale < 1.0);
        assert!(answer.duration_scale > 1.0);
        assert!(echo.release > answer.release);
        assert!(deconstruction.push_sec < 0.0);
        assert!(echo.push_sec > 0.0);
    }

    #[test]
    fn restatement_gate_profile_pushes_hook_lane_forward_by_pass_role() {
        let hint = ExternalMelodyHint {
            contour: Some("arched_hook_apex".to_string()),
            phrase_function: Some("hook".to_string()),
            hook_strength: Some(0.95),
            target_degrees: vec![1, 3, 5, 6],
            register_anchor: Some("mid".to_string()),
            motion_bias: Some("balanced".to_string()),
            leap_budget: Some(6),
            landing_tone: Some("resolve".to_string()),
            ornamentation: Some("belt_accent".to_string()),
            repetition_window_bars: Some(2),
            counterline_role: Some("hook_doubles".to_string()),
            lyric_stress_map: vec!["lift".to_string(), "release".to_string()],
            climax_bar: Some(3),
            antecedent_phrase_id: Some("phrase_bridge".to_string()),
            note_grouping: vec![3, 3, 2],
            hook_restatement_passes: vec![
                ExternalRestatementPassHint {
                    order: 1,
                    role: "amplified restatement".to_string(),
                    register_bias: "upper-mid".to_string(),
                    sustain_bias: "stretched".to_string(),
                    landing_move: "lift into apex".to_string(),
                },
                ExternalRestatementPassHint {
                    order: 2,
                    role: "deconstruction".to_string(),
                    register_bias: "mid".to_string(),
                    sustain_bias: "clipped".to_string(),
                    landing_move: "avoid root".to_string(),
                },
                ExternalRestatementPassHint {
                    order: 3,
                    role: "tail echo".to_string(),
                    register_bias: "mid-high".to_string(),
                    sustain_bias: "long tail".to_string(),
                    landing_move: "glide into cadence".to_string(),
                },
            ],
        };

        let amplified = restatement_gate_profile(Some(&hint), 1, 9, 0.34);
        let deconstruction = restatement_gate_profile(Some(&hint), 4, 9, 0.74);
        let echo = restatement_gate_profile(Some(&hint), 8, 9, 0.82);

        assert!(amplified.lead_gain > deconstruction.lead_gain);
        assert!(amplified.counter_duck < deconstruction.counter_duck);
        assert!(deconstruction.lead_gate < amplified.lead_gate);
        assert!(echo.pluck_duck < 0.7);
        assert!(echo.percussion_duck < 1.0);
    }

    #[test]
    fn restatement_gate_profile_ducks_support_more_for_answer_and_echo_tails() {
        let hint = ExternalMelodyHint {
            contour: Some("arched_hook_apex".to_string()),
            phrase_function: Some("hook".to_string()),
            hook_strength: Some(0.95),
            target_degrees: vec![1, 3, 5, 6],
            register_anchor: Some("mid".to_string()),
            motion_bias: Some("balanced".to_string()),
            leap_budget: Some(6),
            landing_tone: Some("resolve".to_string()),
            ornamentation: Some("belt_accent".to_string()),
            repetition_window_bars: Some(2),
            counterline_role: Some("hook_doubles".to_string()),
            lyric_stress_map: vec!["lift".to_string(), "release".to_string()],
            climax_bar: Some(3),
            antecedent_phrase_id: Some("phrase_bridge".to_string()),
            note_grouping: vec![3, 3, 2],
            hook_restatement_passes: vec![
                ExternalRestatementPassHint {
                    order: 1,
                    role: "main statement".to_string(),
                    register_bias: "mid".to_string(),
                    sustain_bias: "balanced".to_string(),
                    landing_move: "land on hook root".to_string(),
                },
                ExternalRestatementPassHint {
                    order: 2,
                    role: "answer".to_string(),
                    register_bias: "mid".to_string(),
                    sustain_bias: "stretched".to_string(),
                    landing_move: "prepare return".to_string(),
                },
                ExternalRestatementPassHint {
                    order: 3,
                    role: "tail echo".to_string(),
                    register_bias: "mid-high".to_string(),
                    sustain_bias: "long tail".to_string(),
                    landing_move: "glide into cadence".to_string(),
                },
            ],
        };

        let statement = restatement_gate_profile(Some(&hint), 1, 9, 0.22);
        let answer = restatement_gate_profile(Some(&hint), 4, 9, 0.82);
        let echo = restatement_gate_profile(Some(&hint), 8, 9, 0.92);

        assert!(answer.counter_duck < statement.counter_duck);
        assert!(answer.pluck_duck < statement.pluck_duck);
        assert!(echo.counter_duck < answer.counter_duck);
        assert!(echo.pluck_duck < answer.pluck_duck);
    }

    #[test]
    fn landing_move_changes_restatement_sentence_weight() {
        let resolve_hint = ExternalMelodyHint {
            contour: Some("arched_hook_apex".to_string()),
            phrase_function: Some("hook".to_string()),
            hook_strength: Some(0.92),
            target_degrees: vec![1, 3, 5, 6],
            register_anchor: Some("mid".to_string()),
            motion_bias: Some("balanced".to_string()),
            leap_budget: Some(5),
            landing_tone: Some("resolve".to_string()),
            ornamentation: Some("belt_accent".to_string()),
            repetition_window_bars: Some(2),
            counterline_role: Some("hook_doubles".to_string()),
            lyric_stress_map: vec!["lift".to_string(), "release".to_string()],
            climax_bar: Some(3),
            antecedent_phrase_id: Some("phrase_hook".to_string()),
            note_grouping: vec![3, 3, 2],
            hook_restatement_passes: vec![ExternalRestatementPassHint {
                order: 1,
                role: "tail echo".to_string(),
                register_bias: "mid-high".to_string(),
                sustain_bias: "long tail".to_string(),
                landing_move: "glide into cadence".to_string(),
            }],
        };
        let open_hint = ExternalMelodyHint {
            hook_restatement_passes: vec![ExternalRestatementPassHint {
                order: 1,
                role: "tail echo".to_string(),
                register_bias: "mid-high".to_string(),
                sustain_bias: "long tail".to_string(),
                landing_move: "leave open".to_string(),
            }],
            ..resolve_hint.clone()
        };

        let resolve_timing = restatement_timing_profile(Some(&resolve_hint), 0, 1, 0.5, 0.52);
        let open_timing = restatement_timing_profile(Some(&open_hint), 0, 1, 0.5, 0.52);
        let resolve_gate = restatement_gate_profile(Some(&resolve_hint), 0, 1, 0.82);
        let open_gate = restatement_gate_profile(Some(&open_hint), 0, 1, 0.82);

        assert!(resolve_timing.release > open_timing.release);
        assert!(resolve_timing.duration_scale > open_timing.duration_scale);
        assert!(resolve_gate.pluck_duck < open_gate.pluck_duck);
        assert!(resolve_gate.percussion_duck < open_gate.percussion_duck);
    }

    #[test]
    fn shape_restatement_pass_punctuates_resolve_and_open_endings_differently() {
        let resolve_pass = ExternalRestatementPassHint {
            order: 1,
            role: "answer".to_string(),
            register_bias: "mid".to_string(),
            sustain_bias: "stretched".to_string(),
            landing_move: "glide into cadence".to_string(),
        };
        let open_pass = ExternalRestatementPassHint {
            landing_move: "leave open".to_string(),
            ..resolve_pass.clone()
        };

        let mut resolve_pattern = vec![0, 2, 4, 5];
        let mut open_pattern = vec![0, 2, 4, 5];
        shape_restatement_pass(&mut resolve_pattern, 0, 4, &resolve_pass);
        shape_restatement_pass(&mut open_pattern, 0, 4, &open_pass);

        assert!(resolve_pattern[2] >= open_pattern[2]);
        assert!(resolve_pattern[3] < open_pattern[3]);
    }

    #[test]
    fn lead_pattern_prefers_repeatable_singable_cells_over_constant_zigzag() {
        let segment = PhraseSegment {
            start_sec: 0.0,
            duration_sec: 4.0,
            section: "Chorus".to_string(),
            energy: SegmentEnergy::High,
            tempo_bpm: 108.0,
            root_hz: 261.63,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7],
            }],
            counter_pattern: &[0, 4, 7, 4],
            style: ArrangementStyle::Synth,
            adapter_hint: ExternalAdapterHint::Internal,
            rhythm_hint: None,
            phrase_hint: None,
            melody_hint: Some(ExternalMelodyHint {
                contour: Some("soaring_arc".to_string()),
                phrase_function: Some("hook".to_string()),
                hook_strength: Some(0.96),
                target_degrees: vec![1, 2, 3, 5, 6],
                register_anchor: Some("mid_high".to_string()),
                motion_bias: Some("balanced_lift".to_string()),
                leap_budget: Some(6),
                landing_tone: Some("resolve".to_string()),
                ornamentation: Some("belt_accent".to_string()),
                repetition_window_bars: Some(2),
                counterline_role: Some("octave_doubles".to_string()),
                lyric_stress_map: vec![
                    "lift".to_string(),
                    "hold".to_string(),
                    "release".to_string(),
                ],
                climax_bar: Some(3),
                antecedent_phrase_id: Some("phrase_hook".to_string()),
                note_grouping: vec![3, 3, 2],
                hook_restatement_passes: vec![],
            }),
        };

        let pattern = lead_pattern(&segment);
        let repeated_pairs = pattern
            .windows(2)
            .filter(|window| window[0] == window[1])
            .count();
        let large_jumps = pattern
            .windows(2)
            .filter(|window| (window[1] - window[0]).abs() > 5)
            .count();

        assert!(repeated_pairs >= 2);
        assert!(large_jumps <= 1);
    }
}
