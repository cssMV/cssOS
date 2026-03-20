use super::*;
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
    ProviderPlan, ProviderVendor,
};
use anyhow::Result;
use serde_json::Value;
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
}

pub async fn run(ctx: &EngineCtx, commands: &serde_json::Value, ui_lang: &str) -> Result<()> {
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
    let arrangement = plan_arrangement(&parsed, commands, title);
    let cue_sheet_path = ctx.run_dir.join("./build/audio_provider_cue_sheet.json");
    let cue_sheet = build_provider_cue_sheet(
        &provider_plan,
        &arrangement_to_cues(&arrangement, commands, &parsed),
    );
    write_provider_cue_sheet(&cue_sheet_path, &cue_sheet)?;
    let midi_draft_path = ctx.run_dir.join("./build/audio_provider_midi_draft.json");
    let midi_draft = build_provider_midi_draft(&provider_plan, &cue_sheet);
    write_provider_midi_draft(&midi_draft_path, &midi_draft)?;
    let phrase_map_path = ctx.run_dir.join("./build/audio_provider_phrase_map.json");
    let phrase_map = build_provider_phrase_map(&provider_plan, &cue_sheet);
    write_provider_phrase_map(&phrase_map_path, &phrase_map)?;
    let stems_plan_path = ctx.run_dir.join("./build/audio_provider_stems_plan.json");
    let stems_plan = build_provider_arrangement_stems_plan(&provider_plan, &cue_sheet);
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
        let qc = crate::quality_config::load_quality_config();
        let gate = crate::quality_gates::gate_audio_duration(&out, qc.min_audio_duration_s).await?;
        if !gate.ok {
            return Err(crate::quality_gates::fail_gate(gate));
        }
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
        let qc = crate::quality_config::load_quality_config();
        let gate = crate::quality_gates::gate_audio_duration(&out, qc.min_audio_duration_s).await?;
        if !gate.ok {
            return Err(crate::quality_gates::fail_gate(gate));
        }
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
    let wav = render_arrangement_wav(&arrangement);
    tokio::fs::write(&out, wav).await?;

    validate_wav_output(&out, 4096).await?;
    let qc = crate::quality_config::load_quality_config();
    let gate = crate::quality_gates::gate_audio_duration(&out, qc.min_audio_duration_s).await?;
    if !gate.ok {
        return Err(crate::quality_gates::fail_gate(gate));
    }
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

    let preserve_timestamps = line_entries.iter().any(|entry| entry.t.is_some());
    let mut cursor = 0.0_f32;
    let mut segments = Vec::new();
    for (index, entry) in line_entries.iter().enumerate() {
        let mut duration = if let Some(next_t) = line_entries.get(index + 1).and_then(|next| next.t)
        {
            entry
                .t
                .map(|t| (next_t - t).max(1.8))
                .unwrap_or(entry.estimated_duration)
        } else {
            entry.estimated_duration
        };
        duration = duration.clamp(1.8, 8.5);
        let section = entry.text.clone();
        let energy = detect_energy(index, line_entries.len(), &section);
        let root_index = ((mood_seed as usize) + index) % roots.len();
        let chord_index = ((mood_seed as usize / 3) + index) % progressions.len();
        segments.push(PhraseSegment {
            start_sec: cursor,
            duration_sec: duration,
            section,
            energy,
            tempo_bpm: tempo_for_segment(base_tempo, energy),
            root_hz: roots[root_index],
            progression: progressions[chord_index],
            counter_pattern: counter_pattern_for_section(&entry.text, style),
            style,
            adapter_hint,
        });
        cursor += duration;
    }

    if segments.is_empty() {
        vec![PhraseSegment {
            start_sec: 0.0,
            duration_sec: target_duration_s.max(total_duration).max(120.0),
            section: "Intro".to_string(),
            energy: SegmentEnergy::Medium,
            tempo_bpm: base_tempo,
            root_hz: 196.0,
            progression: &[ChordFrame {
                root_shift: 0,
                intervals: &[0, 4, 7, 11],
            }],
            counter_pattern: counter_pattern_for_section("Intro", style),
            style,
            adapter_hint,
        }]
    } else {
        align_segments_to_duration(segments, target_duration_s, preserve_timestamps)
    }
}

#[derive(Debug, Clone)]
struct LyricEntry {
    t: Option<f32>,
    text: String,
    estimated_duration: f32,
}

fn lyric_entries(lyrics_json: &Value) -> Vec<LyricEntry> {
    let mut entries = Vec::new();
    if let Some(lines) = lyrics_json.get("lines").and_then(|v| v.as_array()) {
        for line in lines {
            match line {
                Value::String(text) => {
                    let trimmed = text.trim();
                    if !trimmed.is_empty() {
                        entries.push(LyricEntry {
                            t: None,
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
                    if !text.is_empty() {
                        entries.push(LyricEntry {
                            t: map.get("t").and_then(|v| v.as_f64()).map(|v| v as f32),
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

fn estimated_line_duration(text: &str) -> f32 {
    let char_count = text.chars().filter(|c| !c.is_whitespace()).count() as f32;
    (1.8 + char_count * 0.09).clamp(2.1, 6.8)
}

fn estimated_total_duration(entries: &[LyricEntry]) -> f32 {
    let sum: f32 = entries.iter().map(|entry| entry.estimated_duration).sum();
    sum.clamp(8.0, 48.0)
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
        })
        .unwrap_or(180.0) as f32;

    requested.clamp(120.0, 600.0)
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
            CueSegment {
                start_sec: segment.start_sec,
                duration_sec: segment.duration_sec,
                section_name: resolve_section_name(
                    &segment.section,
                    section_form.get(index).map(String::as_str),
                ),
                energy: energy_label(segment.energy).to_string(),
                contour: contour_label(segment.energy, &dynamics_curve).to_string(),
                articulation: provider_articulation_label(segment, &articulation_bias),
                root_hz: segment.root_hz,
                bar_start,
                bar_end,
                chord_slots: chord_slots_for_segment(segment),
                velocity_curve: velocity_curve_for_segment(segment, &dynamics_curve),
                note_density: note_density_for_segment(segment, density),
            }
        })
        .collect()
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

fn render_arrangement_wav(segments: &[PhraseSegment]) -> Vec<u8> {
    let total_duration = arrangement_total_duration(segments).max(8.0) + 0.8;
    let total_frames = (total_duration * SAMPLE_RATE as f32).ceil() as usize;
    let mut left = vec![0.0_f32; total_frames];
    let mut right = vec![0.0_f32; total_frames];

    for segment in segments {
        render_segment(segment, &mut left, &mut right);
    }

    apply_master_reverb(&mut left, &mut right);
    interleaved_wav(&left, &right, SAMPLE_RATE)
}

fn render_segment(segment: &PhraseSegment, left: &mut [f32], right: &mut [f32]) {
    let start_frame = (segment.start_sec * SAMPLE_RATE as f32).floor() as usize;
    let frame_count = (segment.duration_sec * SAMPLE_RATE as f32).ceil() as usize;
    let beat_hz = segment.tempo_bpm / 60.0;
    let beat_period = 1.0 / beat_hz.max(0.5);
    let subdivisions = subdivision_count(segment);
    let note_duration = segment.duration_sec / subdivisions as f32;
    let lead_pattern = lead_pattern(segment);
    let style_profile = style_profile(segment.style, segment.energy, segment.adapter_hint);
    let chord_span = (segment.duration_sec / segment.progression.len().max(1) as f32).max(0.6);

    for frame_offset in 0..frame_count {
        let idx = start_frame + frame_offset;
        if idx >= left.len() || idx >= right.len() {
            break;
        }

        let local_t = frame_offset as f32 / SAMPLE_RATE as f32;
        let note_index = (local_t / note_duration).floor() as usize;
        let note_t = local_t % note_duration;
        let note_env = adsr(
            note_t,
            note_duration,
            0.08,
            0.12,
            sustain_for_energy(segment.energy),
            0.18,
        );

        let chord_index =
            ((local_t / chord_span).floor() as usize) % segment.progression.len().max(1);
        let chord_frame = segment.progression[chord_index];
        let chord_root = segment.root_hz * 2.0_f32.powf(chord_frame.root_shift as f32 / 12.0);
        let lead_degree = lead_pattern[note_index % lead_pattern.len()];
        let lead_freq = chord_root * 2.0_f32.powf(lead_degree as f32 / 12.0);
        let lead = lead_voice(lead_freq, note_t, note_env, segment.energy);
        let counter = counter_voice(
            chord_root,
            segment.counter_pattern,
            local_t,
            note_duration,
            segment.energy,
            segment.style,
        );

        let chord = pad_voice(
            chord_root,
            chord_frame.intervals,
            local_t,
            segment.energy,
            segment.style,
        );
        let bass = bass_voice(
            chord_root,
            local_t,
            beat_period,
            segment.energy,
            segment.style,
        );
        let drum = drum_voice(local_t, beat_period, segment.energy, segment.style);
        let shimmer = shimmer_voice(lead_freq, note_t, note_env, segment.energy);

        let stereo_sway = ((segment.start_sec + local_t) * 0.41).sin() * 0.12;
        let l = chord * style_profile.pad_gain
            + bass * style_profile.bass_gain
            + lead * style_profile.lead_gain
            + counter * style_profile.counter_gain
            + shimmer * style_profile.shimmer_gain
            + drum * style_profile.drum_gain * (0.84 - stereo_sway);
        let r = chord * (style_profile.pad_gain * 0.92)
            + bass * (style_profile.bass_gain * 0.92)
            + lead * (style_profile.lead_gain * 0.94)
            + counter * (style_profile.counter_gain * 1.06)
            + shimmer * (style_profile.shimmer_gain * 1.2)
            + drum * style_profile.drum_gain * (0.72 + stereo_sway);
        left[idx] = (left[idx] + l).clamp(-1.0, 1.0);
        right[idx] = (right[idx] + r).clamp(-1.0, 1.0);
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
    bars.clamp(4, cap)
}

fn lead_pattern(segment: &PhraseSegment) -> &'static [i32] {
    let lower = segment.section.to_ascii_lowercase();
    if lower.contains("chorus") {
        &[0, 4, 7, 11, 7, 4, 12, 11]
    } else if lower.contains("bridge") {
        &[0, 3, 5, 8, 10, 8, 5, 3]
    } else if segment.energy == SegmentEnergy::Low {
        &[0, 2, 4, 7, 4, 2]
    } else {
        &[0, 4, 5, 7, 9, 7, 5, 4]
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
    let breath = (TWO_PI * mod_freq * 0.5 * t).sin() * 0.18;
    (fundamental * 0.52 + octave + breath) * env * 0.42
}

fn counter_voice(
    root_hz: f32,
    pattern: &[i32],
    local_t: f32,
    note_duration: f32,
    energy: SegmentEnergy,
    style: ArrangementStyle,
) -> f32 {
    let note_index = (local_t / note_duration.max(0.1)).floor() as usize;
    let interval = pattern[note_index % pattern.len()];
    let note_t = local_t % note_duration.max(0.1);
    let env = adsr(note_t, note_duration.max(0.1), 0.12, 0.14, 0.52, 0.2);
    let freq = root_hz * 2.0_f32.powf(interval as f32 / 12.0);
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
            ((TWO_PI * freq * note_t).sin() * 0.26
                + (TWO_PI * freq * 2.0 * note_t).sin() * 0.11
                + (TWO_PI * freq * 3.0 * note_t).sin() * 0.05)
                * env
                * if energy == SegmentEnergy::Peak {
                    0.28
                } else {
                    0.22
                }
        }
    }
}

fn pad_voice(
    root_hz: f32,
    intervals: &[i32],
    t: f32,
    energy: SegmentEnergy,
    style: ArrangementStyle,
) -> f32 {
    let mut sum = 0.0_f32;
    let movement = 1.0 + (TWO_PI * 0.12 * t).sin() * 0.003;
    for (idx, interval) in intervals.iter().enumerate() {
        let freq = root_hz * 2.0_f32.powf(*interval as f32 / 12.0) * movement;
        let pan_phase = idx as f32 * 0.7;
        match style {
            ArrangementStyle::Piano => {
                sum += (TWO_PI * freq * t + pan_phase).sin() * 0.12;
                sum += (TWO_PI * freq * 2.0 * t + pan_phase * 0.3).sin() * 0.03;
            }
            ArrangementStyle::Strings => {
                sum += (TWO_PI * freq * t + pan_phase).sin() * 0.14;
                sum += (TWO_PI * freq * 0.5 * t + pan_phase * 0.5).sin() * 0.1;
                sum += (TWO_PI * freq * 1.5 * t + pan_phase * 0.2).sin() * 0.05;
            }
            ArrangementStyle::Synth => {
                sum += (TWO_PI * freq * t + pan_phase).sin().signum() * 0.09;
                sum += (TWO_PI * freq * 0.5 * t + pan_phase * 0.5).sin() * 0.12;
                sum += (TWO_PI * freq * 2.0 * t + pan_phase * 0.1).sin() * 0.04;
            }
            ArrangementStyle::Guofeng => {
                sum += (TWO_PI * freq * t + pan_phase).sin() * 0.1;
                sum += (TWO_PI * freq * 2.0 * t + pan_phase * 0.2).sin() * 0.06;
                sum += (TWO_PI * freq * 3.0 * t + pan_phase * 0.35).sin() * 0.025;
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
) -> f32 {
    let pulse_pos = t % beat_period;
    let env = (1.0 - (pulse_pos / (beat_period * 0.82)).clamp(0.0, 1.0)).powf(1.7);
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
        ArrangementStyle::Guofeng => (
            (TWO_PI * freq * t).sin() * 0.2,
            (TWO_PI * freq * 2.0 * t).sin() * 0.06,
        ),
    };
    let gain = match energy {
        SegmentEnergy::Low => 0.62,
        SegmentEnergy::Medium => 0.74,
        SegmentEnergy::High => 0.88,
        SegmentEnergy::Peak => 0.98,
    };
    (sub + growl) * env * gain
}

fn drum_voice(t: f32, beat_period: f32, energy: SegmentEnergy, style: ArrangementStyle) -> f32 {
    let beat_pos = t % beat_period;
    let kick_env = (1.0 - (beat_pos / 0.16).clamp(0.0, 1.0)).powf(3.2);
    let kick_pitch = 82.0 - beat_pos * 180.0;
    let kick = (TWO_PI * kick_pitch.max(34.0) * beat_pos).sin()
        * kick_env
        * if style == ArrangementStyle::Piano {
            0.28
        } else {
            0.42
        };

    let hat_period = beat_period / 2.0;
    let hat_pos = t % hat_period;
    let hat_env = (1.0 - (hat_pos / 0.045).clamp(0.0, 1.0)).powf(1.6);
    let hat = ((TWO_PI * 6200.0 * hat_pos).sin() + (TWO_PI * 7800.0 * hat_pos).sin() * 0.6)
        * hat_env
        * match style {
            ArrangementStyle::Piano => 0.02,
            ArrangementStyle::Strings => 0.035,
            ArrangementStyle::Synth => 0.06,
            ArrangementStyle::Guofeng => 0.028,
        };

    let snare_offset = beat_period * 0.5;
    let snare_pos = (t + beat_period - snare_offset) % beat_period;
    let snare_env = (1.0 - (snare_pos / 0.12).clamp(0.0, 1.0)).powf(2.4);
    let snare = ((TWO_PI * 180.0 * snare_pos).sin() * 0.18
        + (TWO_PI * 3300.0 * snare_pos).sin() * 0.07)
        * snare_env;

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

fn shimmer_voice(freq: f32, t: f32, env: f32, energy: SegmentEnergy) -> f32 {
    let rate = match energy {
        SegmentEnergy::Low => 0.0,
        SegmentEnergy::Medium => 0.4,
        SegmentEnergy::High => 0.8,
        SegmentEnergy::Peak => 1.2,
    };
    if rate == 0.0 {
        0.0
    } else {
        (TWO_PI * freq * 3.0 * t).sin() * ((TWO_PI * rate * t).sin() * 0.5 + 0.5) * env * 0.18
    }
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
            lead_gain: 0.88,
            counter_gain: 0.44,
            bass_gain: 0.5,
            drum_gain: 0.34,
            shimmer_gain: 0.12,
        },
        ArrangementStyle::Strings => StyleProfile {
            pad_gain: 0.86 + energy_lift,
            lead_gain: 0.82,
            counter_gain: 0.5,
            bass_gain: 0.58,
            drum_gain: 0.42,
            shimmer_gain: 0.16,
        },
        ArrangementStyle::Synth => StyleProfile {
            pad_gain: 0.92 + energy_lift,
            lead_gain: 0.94,
            counter_gain: 0.56,
            bass_gain: 0.7,
            drum_gain: 0.62,
            shimmer_gain: 0.22,
        },
        ArrangementStyle::Guofeng => StyleProfile {
            pad_gain: 0.74 + energy_lift,
            lead_gain: 0.9,
            counter_gain: 0.52,
            bass_gain: 0.46,
            drum_gain: 0.3,
            shimmer_gain: 0.18,
        },
    };
    match adapter_hint {
        ExternalAdapterHint::Internal => {}
        ExternalAdapterHint::Kontakt => {
            profile.pad_gain += 0.04;
            profile.counter_gain += 0.05;
        }
        ExternalAdapterHint::Spitfire => {
            profile.pad_gain += 0.08;
            profile.shimmer_gain += 0.04;
        }
        ExternalAdapterHint::EastWest => {
            profile.pad_gain += 0.06;
            profile.bass_gain += 0.05;
        }
        ExternalAdapterHint::Custom => {
            profile.lead_gain += 0.03;
            profile.counter_gain += 0.03;
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
}
