use anyhow::{anyhow, Result};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::Command as StdCommand;
use tokio::process::Command;

mod custom;
mod eastwest;
mod kontakt;
mod spitfire;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderVendor {
    Internal,
    Kontakt,
    Spitfire,
    Eastwest,
    Custom,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPlan {
    pub vendor: ProviderVendor,
    pub pack: String,
    pub preset: String,
    pub articulation: String,
    pub adapter_uri: String,
    pub style_hint: String,
    pub target_duration_s: u32,
    pub tempo_bpm: u32,
    pub voicing_register: String,
    pub percussion_activity: f32,
    pub expression_cc_bias: String,
    pub humanization: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderExecution {
    pub vendor: ProviderVendor,
    pub payload_path: PathBuf,
    pub midi_draft_path: Option<PathBuf>,
    pub phrase_map_path: Option<PathBuf>,
    pub stems_plan_path: Option<PathBuf>,
    pub render_queue_path: Option<PathBuf>,
    pub deliverables_manifest_path: Option<PathBuf>,
    pub export_policy_path: Option<PathBuf>,
    pub package_layout_path: Option<PathBuf>,
    pub delivery_metadata_path: Option<PathBuf>,
    pub archive_builder_path: Option<PathBuf>,
    pub render_handoff_path: Option<PathBuf>,
    pub render_bin: Option<String>,
    pub render_args: Vec<String>,
    pub render_cmdline: Option<String>,
    pub payload: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderProfile {
    pub profile_name: String,
    pub engine_name: String,
    pub bus_layout: Vec<String>,
    pub default_mix_preset: String,
    pub dynamic_layers: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LibraryCatalogEntry {
    pub library_id: String,
    pub display_name: String,
    pub role: String,
    pub patch: String,
    pub mic_mix: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SectionTemplate {
    pub section_name: String,
    pub layer_roles: Vec<String>,
    pub intensity: String,
    pub contour: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KeyswitchBinding {
    pub articulation: String,
    pub keyswitch: String,
    pub midi_note: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CueSegment {
    pub start_sec: f32,
    pub duration_sec: f32,
    pub section_name: String,
    pub energy: String,
    pub contour: String,
    pub articulation: String,
    pub root_hz: f32,
    pub bar_start: u32,
    pub bar_end: u32,
    pub chord_slots: Vec<String>,
    pub velocity_curve: Vec<u8>,
    pub note_density: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCueSegment {
    pub start_sec: f32,
    pub duration_sec: f32,
    pub source_section: String,
    pub template_name: String,
    pub intensity: String,
    pub contour: String,
    pub layer_roles: Vec<String>,
    pub asset_patches: Vec<String>,
    pub keyswitches: Vec<String>,
    pub bar_start: u32,
    pub bar_end: u32,
    pub chord_slots: Vec<String>,
    pub velocity_curve: Vec<u8>,
    pub note_density: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCueSheet {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub target_duration_s: u32,
    pub cue_segments: Vec<ProviderCueSegment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMidiChannel {
    pub role: String,
    pub channel: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMidiPoint {
    pub time_sec: f32,
    pub value: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCcLane {
    pub cc: u8,
    pub label: String,
    pub points: Vec<ProviderMidiPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderAutomationLane {
    pub cc: u8,
    pub label: String,
    pub role: String,
    pub curve_kind: String,
    pub points: Vec<ProviderMidiPoint>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPhraseBlock {
    pub phrase_id: String,
    pub role: String,
    pub patch: String,
    pub articulation: String,
    pub channel: u8,
    pub bar_start: u32,
    pub bar_end: u32,
    pub start_sec: f32,
    pub end_sec: f32,
    pub note_count: usize,
    pub note_density: f32,
    pub contour: String,
    pub chord_slot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMidiEvent {
    pub event_type: String,
    pub time_sec: f32,
    pub channel: u8,
    pub note: u8,
    pub velocity: u8,
    pub duration_sec: Option<f32>,
    pub role: String,
    pub patch: String,
    pub articulation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMidiSegment {
    pub section_name: String,
    pub start_sec: f32,
    pub duration_sec: f32,
    pub bar_start: u32,
    pub bar_end: u32,
    pub events: Vec<ProviderMidiEvent>,
    pub cc_lanes: Vec<ProviderCcLane>,
    pub automation_lanes: Vec<ProviderAutomationLane>,
    pub phrase_map: Vec<ProviderPhraseBlock>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMidiDraft {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub target_duration_s: u32,
    pub tempo_bpm: u32,
    pub channels: Vec<ProviderMidiChannel>,
    pub segments: Vec<ProviderMidiSegment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPhraseMap {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub target_duration_s: u32,
    pub phrase_segments: Vec<ProviderMidiSegment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderStemPart {
    pub section_name: String,
    pub phrase_id: String,
    pub role: String,
    pub patch: String,
    pub articulation: String,
    pub channel: u8,
    pub bar_start: u32,
    pub bar_end: u32,
    pub start_sec: f32,
    pub end_sec: f32,
    pub note_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderStemTrack {
    pub stem_name: String,
    pub export_name: String,
    pub roles: Vec<String>,
    pub patch_set: Vec<String>,
    pub phrase_count: usize,
    pub bar_start: u32,
    pub bar_end: u32,
    pub start_sec: f32,
    pub end_sec: f32,
    pub parts: Vec<ProviderStemPart>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderArrangementStemsPlan {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub target_duration_s: u32,
    pub stems: Vec<ProviderStemTrack>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderRenderQueueItem {
    pub item_id: String,
    pub stem_name: String,
    pub export_name: String,
    pub profile_name: String,
    pub render_target: String,
    pub source_phrases: Vec<String>,
    pub source_roles: Vec<String>,
    pub patch_set: Vec<String>,
    pub bar_start: u32,
    pub bar_end: u32,
    pub start_sec: f32,
    pub end_sec: f32,
    pub preserve_isolated_stem: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderRenderQueue {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub preserve_stems: bool,
    pub queue_items: Vec<ProviderRenderQueueItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderDeliverableAsset {
    pub asset_type: String,
    pub stem_name: String,
    pub relative_path: String,
    pub optional: bool,
    pub purpose: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderDeliverablesManifest {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub preserve_stems: bool,
    pub final_mix_optional: bool,
    pub assets: Vec<ProviderDeliverableAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderExportRule {
    pub asset_type: String,
    pub package_name: String,
    pub relative_dir: String,
    pub naming_pattern: String,
    pub required: bool,
    pub keep_isolated: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderExportPolicy {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub preserve_stems: bool,
    pub preserve_vocals: bool,
    pub final_mix_optional: bool,
    pub export_rules: Vec<ProviderExportRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPackageAssetRef {
    pub asset_type: String,
    pub stem_name: String,
    pub relative_path: String,
    pub optional: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPackageBundle {
    pub package_name: String,
    pub relative_dir: String,
    pub package_format: String,
    pub purpose: String,
    pub include_assets: Vec<ProviderPackageAssetRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPackageLayout {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub root_dir: String,
    pub bundles: Vec<ProviderPackageBundle>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderStemNamingRule {
    pub asset_type: String,
    pub stem_name: String,
    pub channel_tag: String,
    pub filename_template: String,
    pub resolved_filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderStemNamingConvention {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub song_slug: String,
    pub rules: Vec<ProviderStemNamingRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderDeliveryMetadata {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub sample_rate_hz: u32,
    pub bit_depth: u16,
    pub loudness_target_lufs: f32,
    pub timecode_start: String,
    pub stems_interleaved_stereo: bool,
    pub include_bwf_timestamps: bool,
    pub package_notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderArchiveItem {
    pub bundle_name: String,
    pub archive_path: String,
    pub archive_format: String,
    pub source_dir: String,
    pub include_assets: Vec<ProviderPackageAssetRef>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderArchiveBuilder {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub root_dir: String,
    pub archive_items: Vec<ProviderArchiveItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderExportedFile {
    pub bundle_name: String,
    pub asset_type: String,
    pub stem_name: String,
    pub source_path: String,
    pub exported_path: String,
    pub method: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderMissingAsset {
    pub bundle_name: String,
    pub asset_type: String,
    pub stem_name: String,
    pub expected_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderArchiveOutput {
    pub bundle_name: String,
    pub archive_path: String,
    pub created: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderDeliverySummary {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub export_root: String,
    pub exported_files: Vec<ProviderExportedFile>,
    pub missing_assets: Vec<ProviderMissingAsset>,
    pub archives: Vec<ProviderArchiveOutput>,
    pub handoff_request_path: Option<String>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderRenderHandoffItem {
    pub request_id: String,
    pub bundle_name: String,
    pub asset_type: String,
    pub stem_name: String,
    pub render_target: String,
    pub expected_output_path: String,
    pub source_roles: Vec<String>,
    pub profile_name: String,
    pub priority: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderRenderHandoff {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub reason: String,
    pub queue_items: Vec<ProviderRenderHandoffItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderRequeueExecution {
    pub handoff_path: PathBuf,
    pub queue_path: PathBuf,
    pub summary_path: PathBuf,
    pub queue_items: Vec<ProviderRenderHandoffItem>,
    pub requeue_bin: Option<String>,
    pub requeue_args: Vec<String>,
    pub requeue_cmdline: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderQueueDispatchReport {
    pub backend: String,
    pub target: String,
    pub enqueued_count: usize,
    pub receipt_path: Option<String>,
    pub accepted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderWorkerJobStatus {
    pub request_id: String,
    pub asset_type: String,
    pub stem_name: String,
    pub backend: String,
    pub state: String,
    pub render_target: String,
    pub expected_output_path: String,
    pub receipt_path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderDeliveryStatus {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub backend: String,
    pub queue_target: String,
    pub total_jobs: usize,
    pub completed_jobs: usize,
    pub pending_jobs: usize,
    pub failed_jobs: usize,
    pub jobs: Vec<ProviderWorkerJobStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderJobWorkerReport {
    pub backend: String,
    pub queue_target: String,
    pub consumed_count: usize,
    pub completed_count: usize,
    pub pending_count: usize,
    pub failed_count: usize,
    pub status_path: String,
    pub receipt_dir: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderReconciliationReport {
    pub refreshed: bool,
    pub delivery_summary_path: String,
    pub delivery_status_path: String,
    pub missing_before: usize,
    pub missing_after: usize,
    pub archives_created: usize,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderArtifactWatcherReport {
    pub active: bool,
    pub watch_roots: Vec<String>,
    pub poll_interval_ms: u64,
    pub timeout_ms: u64,
    pub changes_detected: usize,
    pub reconciliation_runs: usize,
    pub last_reconciliation_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderReadinessCategory {
    pub category: String,
    pub required: usize,
    pub present: usize,
    pub ready: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderDeliveryReadinessGate {
    pub state: String,
    pub ready_for_delivery: bool,
    pub required_ratio: f32,
    pub achieved_ratio: f32,
    pub categories: Vec<ProviderReadinessCategory>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPublishBundle {
    pub package_name: String,
    pub relative_dir: String,
    pub package_format: String,
    pub required_assets: usize,
    pub present_assets: usize,
    pub archive_path: Option<String>,
    pub archive_created: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPublishHandoff {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub state: String,
    pub ready_for_delivery: bool,
    pub export_root: String,
    pub delivery_summary_path: String,
    pub delivery_status_path: String,
    pub package_layout_path: String,
    pub readiness_gate_path: String,
    pub bundles: Vec<ProviderPublishBundle>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPublishNotificationReport {
    pub triggered: bool,
    pub backend: String,
    pub target: String,
    pub accepted: bool,
    pub status: String,
    pub publish_handoff_path: Option<String>,
    pub receipt_path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPublishLedgerEntry {
    pub entry_id: String,
    pub state: String,
    pub ready_for_delivery: bool,
    pub triggered_notification: bool,
    pub notification_backend: String,
    pub notification_status: String,
    pub accepted: bool,
    pub export_root: String,
    pub publish_handoff_path: Option<String>,
    pub notification_report_path: String,
    pub archive_paths: Vec<String>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPublishLedger {
    pub vendor: ProviderVendor,
    pub profile_name: String,
    pub latest_state: String,
    pub ready_for_delivery: bool,
    pub entries: Vec<ProviderPublishLedgerEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPublishStateMachine {
    pub state: String,
    pub retry_attempt: usize,
    pub max_retries: usize,
    pub can_retry: bool,
    pub requires_manual_confirmation: bool,
    pub archive_complete: bool,
    pub publish_complete: bool,
    pub last_error: Option<String>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPublishRetryPolicy {
    pub state: String,
    pub should_retry: bool,
    pub next_retry_delay_s: u64,
    pub retry_attempt: usize,
    pub max_retries: usize,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPublishAckEvent {
    pub ack_type: String,
    pub accepted: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderPublishExecutorReport {
    pub executed: bool,
    pub action: String,
    pub accepted: bool,
    pub state: String,
    pub receipt_path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderDownstreamDeliveryReport {
    pub dispatched: bool,
    pub backend: String,
    pub target: String,
    pub accepted: bool,
    pub action: String,
    pub receipt_path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderReceiptSync {
    pub synced: bool,
    pub backend: String,
    pub job_id: Option<String>,
    pub publish_url: Option<String>,
    pub receipt_path: Option<String>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderDeliveryDashboardFeed {
    pub state: String,
    pub ready_for_delivery: bool,
    pub publish_complete: bool,
    pub backend: String,
    pub latest_action: String,
    pub job_id: Option<String>,
    pub publish_url: Option<String>,
    pub export_root: Option<String>,
    pub receipt_path: Option<String>,
    pub notes: Vec<String>,
}

impl ProviderPlan {
    pub fn vendor_name(&self) -> &'static str {
        match self.vendor {
            ProviderVendor::Internal => "internal",
            ProviderVendor::Kontakt => "kontakt",
            ProviderVendor::Spitfire => "spitfire",
            ProviderVendor::Eastwest => "eastwest",
            ProviderVendor::Custom => "custom",
        }
    }
}

pub fn plan_from_commands(commands: &Value) -> ProviderPlan {
    let creative = commands.get("creative").cloned().unwrap_or(Value::Null);
    let adapter_uri = creative
        .get("external_audio_adapter")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let pack_raw = creative
        .get("licensed_style_pack")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let instrumentation = creative
        .get("instrumentation")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let ensemble_style = creative
        .get("ensemble_style")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let target_duration_s = creative
        .get("duration_s")
        .and_then(|v| v.as_u64())
        .map(|v| v as u32)
        .unwrap_or(180)
        .clamp(120, 600);
    let tempo_bpm = creative
        .get("tempo_bpm")
        .and_then(|v| v.as_u64())
        .map(|v| v as u32)
        .unwrap_or(88)
        .clamp(40, 220);
    let voicing_register = creative
        .get("voicing_register")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let percussion_activity = (creative
        .get("percussion_activity")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.45) as f32)
        .clamp(0.0, 1.0);
    let expression_cc_bias = creative
        .get("expression_cc_bias")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    let humanization = (creative
        .get("humanization")
        .and_then(|v| v.as_f64())
        .unwrap_or(0.35) as f32)
        .clamp(0.0, 1.0);

    let combined = if pack_raw.is_empty() {
        adapter_uri.clone()
    } else if adapter_uri.is_empty() {
        pack_raw.clone()
    } else {
        format!("{adapter_uri} {pack_raw}")
    }
    .to_ascii_lowercase();

    let vendor = if combined.contains("kontakt") {
        ProviderVendor::Kontakt
    } else if combined.contains("spitfire") {
        ProviderVendor::Spitfire
    } else if combined.contains("eastwest") || combined.contains("hollywood orchestra") {
        ProviderVendor::Eastwest
    } else if combined.contains("custom://") || combined.contains("custom") {
        ProviderVendor::Custom
    } else {
        ProviderVendor::Internal
    };

    let pack = extract_pack_name(&pack_raw);
    let preset = infer_provider_preset(vendor, &instrumentation, &ensemble_style);
    let articulation = infer_provider_articulation(&ensemble_style, &instrumentation);
    let style_hint = [instrumentation, ensemble_style]
        .into_iter()
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join(" | ");

    ProviderPlan {
        vendor,
        pack,
        preset,
        articulation,
        adapter_uri,
        style_hint,
        target_duration_s,
        tempo_bpm,
        voicing_register,
        percussion_activity,
        expression_cc_bias,
        humanization,
    }
}

pub fn write_dry_run_plan(path: &Path, plan: &ProviderPlan) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(plan)?)?;
    Ok(())
}

pub fn execute(build_dir: &Path, plan: &ProviderPlan) -> Result<ProviderExecution> {
    std::fs::create_dir_all(build_dir)?;
    match plan.vendor {
        ProviderVendor::Internal => execute_internal(build_dir, plan),
        ProviderVendor::Kontakt => kontakt::execute(build_dir, plan),
        ProviderVendor::Spitfire => spitfire::execute(build_dir, plan),
        ProviderVendor::Eastwest => eastwest::execute(build_dir, plan),
        ProviderVendor::Custom => custom::execute(build_dir, plan),
    }
}

pub fn provider_profile(plan: &ProviderPlan) -> ProviderProfile {
    let style = plan.style_hint.to_ascii_lowercase();
    match plan.vendor {
        ProviderVendor::Kontakt => {
            if style.contains("guofeng") || style.contains("guzheng") || style.contains("pipa") {
                ProviderProfile {
                    profile_name: "kontakt-world-crossover".to_string(),
                    engine_name: "Kontakt 7".to_string(),
                    bus_layout: vec![
                        "lead".to_string(),
                        "plucked".to_string(),
                        "winds".to_string(),
                        "low-support".to_string(),
                    ],
                    default_mix_preset: "world-wide-stage".to_string(),
                    dynamic_layers: vec!["pp".to_string(), "mf".to_string(), "f".to_string()],
                }
            } else {
                ProviderProfile {
                    profile_name: "kontakt-studio-stack".to_string(),
                    engine_name: "Kontakt 7".to_string(),
                    bus_layout: vec![
                        "lead".to_string(),
                        "support".to_string(),
                        "bass".to_string(),
                        "perc".to_string(),
                    ],
                    default_mix_preset: "modern-wide".to_string(),
                    dynamic_layers: vec!["p".to_string(), "mf".to_string(), "ff".to_string()],
                }
            }
        }
        ProviderVendor::Spitfire => ProviderProfile {
            profile_name: "spitfire-film-score".to_string(),
            engine_name: "Spitfire Player".to_string(),
            bus_layout: vec![
                "strings-high".to_string(),
                "strings-low".to_string(),
                "brass".to_string(),
                "woods".to_string(),
                "perc".to_string(),
                "choir".to_string(),
            ],
            default_mix_preset: "air-lyndhurst".to_string(),
            dynamic_layers: vec![
                "pp".to_string(),
                "mp".to_string(),
                "mf".to_string(),
                "ff".to_string(),
            ],
        },
        ProviderVendor::Eastwest => ProviderProfile {
            profile_name: "eastwest-hollywood".to_string(),
            engine_name: "OPUS".to_string(),
            bus_layout: vec![
                "strings".to_string(),
                "brass".to_string(),
                "woods".to_string(),
                "perc".to_string(),
                "choir".to_string(),
                "synth-overlay".to_string(),
            ],
            default_mix_preset: "epic-stage".to_string(),
            dynamic_layers: vec!["p".to_string(), "mf".to_string(), "ff".to_string()],
        },
        ProviderVendor::Custom => ProviderProfile {
            profile_name: "custom-adapter-bridge".to_string(),
            engine_name: "Custom Adapter".to_string(),
            bus_layout: vec![
                "source-a".to_string(),
                "source-b".to_string(),
                "source-c".to_string(),
            ],
            default_mix_preset: "adapter-default".to_string(),
            dynamic_layers: vec!["base".to_string(), "lift".to_string(), "peak".to_string()],
        },
        ProviderVendor::Internal => ProviderProfile {
            profile_name: "internal-fallback".to_string(),
            engine_name: "cssMV Internal".to_string(),
            bus_layout: vec!["lead".to_string(), "pad".to_string(), "bass".to_string()],
            default_mix_preset: "fallback".to_string(),
            dynamic_layers: vec!["mid".to_string()],
        },
    }
}

pub fn map_provider_preset(plan: &ProviderPlan) -> String {
    let style = plan.style_hint.to_ascii_lowercase();
    match plan.vendor {
        ProviderVendor::Kontakt => match plan.preset.as_str() {
            "grand-piano" => "Noire::Pure Piano".to_string(),
            "world-ensemble" => "Kinetic Treats::World Ensemble".to_string(),
            "synth-stack" => "Analog Dreams::Wide Stack".to_string(),
            "choir" => "Choir Omnia::Classic Full".to_string(),
            "symphonic-strings" | "string-ensemble" => {
                if style.contains("legato") {
                    "Session Strings Pro 2::Cinematic Legato".to_string()
                } else if style.contains("staccato") {
                    "Session Strings Pro 2::Tight Staccato".to_string()
                } else {
                    "Session Strings Pro 2::Full Ensemble".to_string()
                }
            }
            _ => "Kontakt Factory Library::Core Studio".to_string(),
        },
        ProviderVendor::Spitfire => match plan.preset.as_str() {
            "choir" => "Eric Whitacre Choir::Full Choir".to_string(),
            "grand-piano" => "Originals Cinematic Soft Piano::Main".to_string(),
            "symphonic-strings" | "string-ensemble" => {
                if style.contains("legato") {
                    "BBCSO Strings::Long Legato".to_string()
                } else if style.contains("staccato") {
                    "BBCSO Strings::Short Tight".to_string()
                } else {
                    "BBCSO Strings::Core Ensemble".to_string()
                }
            }
            _ => "Albion One::Unified Orchestra".to_string(),
        },
        ProviderVendor::Eastwest => match plan.preset.as_str() {
            "choir" => "Hollywood Choirs::Epic Full".to_string(),
            "grand-piano" => "Pianos::Concert D".to_string(),
            "symphonic-strings" | "string-ensemble" => {
                if style.contains("legato") {
                    "Hollywood Strings::Expressive Legato".to_string()
                } else if style.contains("staccato") {
                    "Hollywood Strings::Marcato Shorts".to_string()
                } else {
                    "Hollywood Orchestra::Strings Main".to_string()
                }
            }
            "synth-stack" => "Forbidden Planet::Wide Hybrid".to_string(),
            _ => "Hollywood Orchestra Opus::Core Template".to_string(),
        },
        ProviderVendor::Custom => {
            if plan.pack.is_empty() {
                "custom::default-core".to_string()
            } else {
                format!("custom::{}", plan.pack)
            }
        }
        ProviderVendor::Internal => plan.preset.clone(),
    }
}

pub fn map_provider_articulation(plan: &ProviderPlan) -> String {
    match plan.vendor {
        ProviderVendor::Kontakt => match plan.articulation.as_str() {
            "legato" => "performance-legato".to_string(),
            "staccato" => "tight-staccato".to_string(),
            "pizzicato" => "pizzicato-pluck".to_string(),
            "sustain" => "long-sustain".to_string(),
            _ => "adaptive-hybrid".to_string(),
        },
        ProviderVendor::Spitfire => match plan.articulation.as_str() {
            "legato" => "long-legato".to_string(),
            "staccato" => "short-spiccato".to_string(),
            "pizzicato" => "pizzicato".to_string(),
            "sustain" => "long-sustain".to_string(),
            _ => "mix-articulations".to_string(),
        },
        ProviderVendor::Eastwest => match plan.articulation.as_str() {
            "legato" => "slur-legato".to_string(),
            "staccato" => "marc-staccato".to_string(),
            "pizzicato" => "pizzicato".to_string(),
            "sustain" => "sus-vib".to_string(),
            _ => "keyswitched-hybrid".to_string(),
        },
        ProviderVendor::Custom => {
            if plan.articulation.is_empty() {
                "adapter-default".to_string()
            } else {
                format!("custom-{}", plan.articulation)
            }
        }
        ProviderVendor::Internal => plan.articulation.clone(),
    }
}

pub fn library_catalog(plan: &ProviderPlan) -> Vec<LibraryCatalogEntry> {
    let style = plan.style_hint.to_ascii_lowercase();
    match plan.vendor {
        ProviderVendor::Kontakt => {
            if style.contains("guofeng") || style.contains("guzheng") || style.contains("pipa") {
                vec![
                    LibraryCatalogEntry {
                        library_id: "kontakt-world-plucked".to_string(),
                        display_name: "Kontakt World Plucked".to_string(),
                        role: "lead".to_string(),
                        patch: "Kinetic Treats::World Ensemble".to_string(),
                        mic_mix: "close-bright".to_string(),
                    },
                    LibraryCatalogEntry {
                        library_id: "kontakt-world-winds".to_string(),
                        display_name: "Kontakt World Winds".to_string(),
                        role: "winds".to_string(),
                        patch: "Discovery Series Asia::Expressive Winds".to_string(),
                        mic_mix: "mid-air".to_string(),
                    },
                ]
            } else {
                vec![
                    LibraryCatalogEntry {
                        library_id: "kontakt-strings".to_string(),
                        display_name: "Kontakt Session Strings".to_string(),
                        role: "support".to_string(),
                        patch: map_provider_preset(plan),
                        mic_mix: "stage-wide".to_string(),
                    },
                    LibraryCatalogEntry {
                        library_id: "kontakt-pulse".to_string(),
                        display_name: "Kontakt Pulse Layer".to_string(),
                        role: "bass".to_string(),
                        patch: "Analog Dreams::Wide Stack".to_string(),
                        mic_mix: "direct".to_string(),
                    },
                ]
            }
        }
        ProviderVendor::Spitfire => vec![
            LibraryCatalogEntry {
                library_id: "spitfire-main".to_string(),
                display_name: "Spitfire Main Orchestra".to_string(),
                role: "strings".to_string(),
                patch: map_provider_preset(plan),
                mic_mix: "tree-outriggers".to_string(),
            },
            LibraryCatalogEntry {
                library_id: "spitfire-choir".to_string(),
                display_name: "Spitfire Choir".to_string(),
                role: "choir".to_string(),
                patch: "Eric Whitacre Choir::Textured Ooh".to_string(),
                mic_mix: "hall-wide".to_string(),
            },
            LibraryCatalogEntry {
                library_id: "spitfire-perc".to_string(),
                display_name: "Spitfire Percussion".to_string(),
                role: "perc".to_string(),
                patch: "Hans Zimmer Percussion::Low Ensemble".to_string(),
                mic_mix: "far-punch".to_string(),
            },
        ],
        ProviderVendor::Eastwest => vec![
            LibraryCatalogEntry {
                library_id: "ew-strings".to_string(),
                display_name: "Hollywood Strings".to_string(),
                role: "strings".to_string(),
                patch: map_provider_preset(plan),
                mic_mix: "main-stage".to_string(),
            },
            LibraryCatalogEntry {
                library_id: "ew-brass".to_string(),
                display_name: "Hollywood Brass".to_string(),
                role: "brass".to_string(),
                patch: "Hollywood Brass::Heroic Ensemble".to_string(),
                mic_mix: "surround-wide".to_string(),
            },
            LibraryCatalogEntry {
                library_id: "ew-choir".to_string(),
                display_name: "Hollywood Choirs".to_string(),
                role: "choir".to_string(),
                patch: "Hollywood Choirs::Epic Full".to_string(),
                mic_mix: "main-hall".to_string(),
            },
        ],
        ProviderVendor::Custom => vec![LibraryCatalogEntry {
            library_id: "custom-primary".to_string(),
            display_name: "Custom Primary Source".to_string(),
            role: "adapter".to_string(),
            patch: map_provider_preset(plan),
            mic_mix: "adapter-default".to_string(),
        }],
        ProviderVendor::Internal => vec![LibraryCatalogEntry {
            library_id: "internal-core".to_string(),
            display_name: "cssMV Internal Core".to_string(),
            role: "fallback".to_string(),
            patch: plan.preset.clone(),
            mic_mix: "internal".to_string(),
        }],
    }
}

pub fn section_templates(plan: &ProviderPlan) -> Vec<SectionTemplate> {
    match plan.vendor {
        ProviderVendor::Kontakt => vec![
            SectionTemplate {
                section_name: "intro".to_string(),
                layer_roles: vec!["lead".to_string(), "support".to_string()],
                intensity: "low".to_string(),
                contour: "rising".to_string(),
            },
            SectionTemplate {
                section_name: "verse".to_string(),
                layer_roles: vec!["lead".to_string(), "bass".to_string()],
                intensity: "mid".to_string(),
                contour: "flowing".to_string(),
            },
            SectionTemplate {
                section_name: "chorus".to_string(),
                layer_roles: vec![
                    "lead".to_string(),
                    "support".to_string(),
                    "perc".to_string(),
                ],
                intensity: "high".to_string(),
                contour: "wide".to_string(),
            },
        ],
        ProviderVendor::Spitfire => vec![
            SectionTemplate {
                section_name: "intro".to_string(),
                layer_roles: vec!["strings-high".to_string(), "woods".to_string()],
                intensity: "pp".to_string(),
                contour: "cinematic-lift".to_string(),
            },
            SectionTemplate {
                section_name: "bridge".to_string(),
                layer_roles: vec!["strings-low".to_string(), "choir".to_string()],
                intensity: "mf".to_string(),
                contour: "suspended".to_string(),
            },
            SectionTemplate {
                section_name: "chorus".to_string(),
                layer_roles: vec![
                    "strings-high".to_string(),
                    "strings-low".to_string(),
                    "brass".to_string(),
                    "perc".to_string(),
                ],
                intensity: "ff".to_string(),
                contour: "wall-of-sound".to_string(),
            },
        ],
        ProviderVendor::Eastwest => vec![
            SectionTemplate {
                section_name: "verse".to_string(),
                layer_roles: vec!["strings".to_string(), "woods".to_string()],
                intensity: "p".to_string(),
                contour: "narrative".to_string(),
            },
            SectionTemplate {
                section_name: "pre-chorus".to_string(),
                layer_roles: vec!["strings".to_string(), "brass".to_string()],
                intensity: "mf".to_string(),
                contour: "lift".to_string(),
            },
            SectionTemplate {
                section_name: "chorus".to_string(),
                layer_roles: vec![
                    "strings".to_string(),
                    "brass".to_string(),
                    "perc".to_string(),
                    "choir".to_string(),
                ],
                intensity: "ff".to_string(),
                contour: "epic".to_string(),
            },
        ],
        ProviderVendor::Custom => vec![SectionTemplate {
            section_name: "full-song".to_string(),
            layer_roles: vec!["source-a".to_string(), "source-b".to_string()],
            intensity: "adaptive".to_string(),
            contour: "adapter-driven".to_string(),
        }],
        ProviderVendor::Internal => vec![SectionTemplate {
            section_name: "fallback".to_string(),
            layer_roles: vec!["lead".to_string(), "pad".to_string()],
            intensity: "mid".to_string(),
            contour: "steady".to_string(),
        }],
    }
}

pub fn keyswitch_map(plan: &ProviderPlan) -> Vec<KeyswitchBinding> {
    match plan.vendor {
        ProviderVendor::Kontakt => vec![
            KeyswitchBinding {
                articulation: "performance-legato".to_string(),
                keyswitch: "C0".to_string(),
                midi_note: 12,
            },
            KeyswitchBinding {
                articulation: "tight-staccato".to_string(),
                keyswitch: "D0".to_string(),
                midi_note: 14,
            },
            KeyswitchBinding {
                articulation: "pizzicato-pluck".to_string(),
                keyswitch: "E0".to_string(),
                midi_note: 16,
            },
            KeyswitchBinding {
                articulation: "long-sustain".to_string(),
                keyswitch: "F0".to_string(),
                midi_note: 17,
            },
        ],
        ProviderVendor::Spitfire => vec![
            KeyswitchBinding {
                articulation: "long-legato".to_string(),
                keyswitch: "C-1".to_string(),
                midi_note: 0,
            },
            KeyswitchBinding {
                articulation: "short-spiccato".to_string(),
                keyswitch: "D-1".to_string(),
                midi_note: 2,
            },
            KeyswitchBinding {
                articulation: "pizzicato".to_string(),
                keyswitch: "E-1".to_string(),
                midi_note: 4,
            },
            KeyswitchBinding {
                articulation: "long-sustain".to_string(),
                keyswitch: "F-1".to_string(),
                midi_note: 5,
            },
        ],
        ProviderVendor::Eastwest => vec![
            KeyswitchBinding {
                articulation: "slur-legato".to_string(),
                keyswitch: "C0".to_string(),
                midi_note: 12,
            },
            KeyswitchBinding {
                articulation: "marc-staccato".to_string(),
                keyswitch: "C#0".to_string(),
                midi_note: 13,
            },
            KeyswitchBinding {
                articulation: "pizzicato".to_string(),
                keyswitch: "D0".to_string(),
                midi_note: 14,
            },
            KeyswitchBinding {
                articulation: "sus-vib".to_string(),
                keyswitch: "F0".to_string(),
                midi_note: 17,
            },
        ],
        ProviderVendor::Custom => vec![KeyswitchBinding {
            articulation: map_provider_articulation(plan),
            keyswitch: "adapter".to_string(),
            midi_note: 0,
        }],
        ProviderVendor::Internal => vec![KeyswitchBinding {
            articulation: plan.articulation.clone(),
            keyswitch: "internal".to_string(),
            midi_note: 0,
        }],
    }
}

pub fn build_provider_cue_sheet(plan: &ProviderPlan, cues: &[CueSegment]) -> ProviderCueSheet {
    let profile = provider_profile(plan);
    let catalog = library_catalog(plan);
    let templates = section_templates(plan);
    let keys = keyswitch_map(plan);

    let cue_segments = cues
        .iter()
        .map(|cue| {
            let template = select_section_template(&templates, &cue.section_name);
            let asset_patches = template
                .layer_roles
                .iter()
                .map(|role| {
                    catalog
                        .iter()
                        .find(|entry| entry.role == *role)
                        .or_else(|| catalog.first())
                        .map(|entry| entry.patch.clone())
                        .unwrap_or_default()
                })
                .collect::<Vec<_>>();
            let keyswitches = keys
                .iter()
                .filter(|binding| binding.articulation == cue.articulation)
                .map(|binding| binding.keyswitch.clone())
                .collect::<Vec<_>>();

            ProviderCueSegment {
                start_sec: cue.start_sec,
                duration_sec: cue.duration_sec,
                source_section: cue.section_name.clone(),
                template_name: template.section_name.clone(),
                intensity: template.intensity.clone(),
                contour: if cue.contour.is_empty() {
                    template.contour.clone()
                } else {
                    cue.contour.clone()
                },
                layer_roles: template.layer_roles.clone(),
                asset_patches,
                keyswitches,
                bar_start: cue.bar_start,
                bar_end: cue.bar_end,
                chord_slots: cue.chord_slots.clone(),
                velocity_curve: cue.velocity_curve.clone(),
                note_density: cue.note_density,
            }
        })
        .collect::<Vec<_>>();

    ProviderCueSheet {
        vendor: plan.vendor,
        profile_name: profile.profile_name,
        target_duration_s: plan.target_duration_s,
        cue_segments,
    }
}

pub fn write_provider_cue_sheet(path: &Path, cue_sheet: &ProviderCueSheet) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(cue_sheet)?)?;
    Ok(())
}

pub fn build_provider_midi_draft(
    plan: &ProviderPlan,
    cue_sheet: &ProviderCueSheet,
) -> ProviderMidiDraft {
    let keys = keyswitch_map(plan);
    let channels = collect_role_channels(cue_sheet);
    let segments = cue_sheet
        .cue_segments
        .iter()
        .map(|segment| build_provider_midi_segment(segment, plan, &channels, &keys))
        .collect::<Vec<_>>();

    ProviderMidiDraft {
        vendor: cue_sheet.vendor,
        profile_name: cue_sheet.profile_name.clone(),
        target_duration_s: cue_sheet.target_duration_s,
        tempo_bpm: plan.tempo_bpm,
        channels,
        segments,
    }
}

pub fn write_provider_midi_draft(path: &Path, draft: &ProviderMidiDraft) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(draft)?)?;
    Ok(())
}

pub fn build_provider_phrase_map(
    plan: &ProviderPlan,
    cue_sheet: &ProviderCueSheet,
) -> ProviderPhraseMap {
    let draft = build_provider_midi_draft(plan, cue_sheet);
    ProviderPhraseMap {
        vendor: draft.vendor,
        profile_name: draft.profile_name,
        target_duration_s: draft.target_duration_s,
        phrase_segments: draft.segments,
    }
}

pub fn write_provider_phrase_map(path: &Path, phrase_map: &ProviderPhraseMap) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(phrase_map)?)?;
    Ok(())
}

pub fn build_provider_arrangement_stems_plan(
    plan: &ProviderPlan,
    cue_sheet: &ProviderCueSheet,
) -> ProviderArrangementStemsPlan {
    let phrase_map = build_provider_phrase_map(plan, cue_sheet);
    let stem_order = ["lead", "strings", "brass", "perc", "choir", "bass"];
    let stems = stem_order
        .iter()
        .filter_map(|stem_name| build_stem_track(stem_name, &phrase_map))
        .collect::<Vec<_>>();

    ProviderArrangementStemsPlan {
        vendor: phrase_map.vendor,
        profile_name: phrase_map.profile_name,
        target_duration_s: phrase_map.target_duration_s,
        stems,
    }
}

pub fn write_provider_arrangement_stems_plan(
    path: &Path,
    stems_plan: &ProviderArrangementStemsPlan,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(stems_plan)?)?;
    Ok(())
}

pub fn build_provider_render_queue(
    plan: &ProviderPlan,
    cue_sheet: &ProviderCueSheet,
) -> ProviderRenderQueue {
    let stems_plan = build_provider_arrangement_stems_plan(plan, cue_sheet);
    let queue_items = stems_plan
        .stems
        .iter()
        .map(|stem| ProviderRenderQueueItem {
            item_id: format!("render-{}", stem.stem_name),
            stem_name: stem.stem_name.clone(),
            export_name: stem.export_name.clone(),
            profile_name: stems_plan.profile_name.clone(),
            render_target: format!("stem://{}", stem.stem_name),
            source_phrases: stem
                .parts
                .iter()
                .map(|part| part.phrase_id.clone())
                .collect(),
            source_roles: stem.roles.clone(),
            patch_set: stem.patch_set.clone(),
            bar_start: stem.bar_start,
            bar_end: stem.bar_end,
            start_sec: stem.start_sec,
            end_sec: stem.end_sec,
            preserve_isolated_stem: true,
        })
        .collect::<Vec<_>>();

    ProviderRenderQueue {
        vendor: stems_plan.vendor,
        profile_name: stems_plan.profile_name,
        preserve_stems: true,
        queue_items,
    }
}

pub fn write_provider_render_queue(path: &Path, render_queue: &ProviderRenderQueue) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(render_queue)?)?;
    Ok(())
}

pub fn build_provider_deliverables_manifest(
    plan: &ProviderPlan,
    cue_sheet: &ProviderCueSheet,
) -> ProviderDeliverablesManifest {
    let stems_plan = build_provider_arrangement_stems_plan(plan, cue_sheet);
    let mut assets = stems_plan
        .stems
        .iter()
        .map(|stem| ProviderDeliverableAsset {
            asset_type: "isolated_stem".to_string(),
            stem_name: stem.stem_name.clone(),
            relative_path: format!("./build/stems/{}", stem.export_name),
            optional: false,
            purpose: "orchestral rehearsal and post-production stem".to_string(),
        })
        .collect::<Vec<_>>();
    assets.push(ProviderDeliverableAsset {
        asset_type: "vocal_guide".to_string(),
        stem_name: "lead_vocal_guide".to_string(),
        relative_path: "./build/vocals/lead_vocal_guide.wav".to_string(),
        optional: false,
        purpose: "guide vocal stem for singer rehearsal and orchestral alignment".to_string(),
    });
    assets.push(ProviderDeliverableAsset {
        asset_type: "vocal_guide".to_string(),
        stem_name: "backing_vocal_guide".to_string(),
        relative_path: "./build/vocals/backing_vocal_guide.wav".to_string(),
        optional: true,
        purpose: "optional harmony and backing vocal guide stem".to_string(),
    });
    assets.push(ProviderDeliverableAsset {
        asset_type: "mixdown_reference".to_string(),
        stem_name: "full_mix".to_string(),
        relative_path: "./build/music.wav".to_string(),
        optional: true,
        purpose: "reference mix only; isolated stems remain source of truth".to_string(),
    });
    assets.push(ProviderDeliverableAsset {
        asset_type: "session_manifest".to_string(),
        stem_name: "provider_session".to_string(),
        relative_path: "./build/audio_provider_stems_plan.json".to_string(),
        optional: false,
        purpose: "provider-side stem routing and export plan".to_string(),
    });
    assets.push(ProviderDeliverableAsset {
        asset_type: "session_manifest".to_string(),
        stem_name: "provider_render_queue".to_string(),
        relative_path: "./build/audio_provider_render_queue.json".to_string(),
        optional: false,
        purpose: "provider render queue for isolated stem export".to_string(),
    });
    assets.push(ProviderDeliverableAsset {
        asset_type: "lyric_sheet".to_string(),
        stem_name: "lyrics_and_cues".to_string(),
        relative_path: "./build/rehearsal/lyrics_and_cues.txt".to_string(),
        optional: false,
        purpose: "lyrics and cue markers for rehearsal and conductor reference".to_string(),
    });

    ProviderDeliverablesManifest {
        vendor: stems_plan.vendor,
        profile_name: stems_plan.profile_name,
        preserve_stems: true,
        final_mix_optional: true,
        assets,
    }
}

pub fn write_provider_deliverables_manifest(
    path: &Path,
    manifest: &ProviderDeliverablesManifest,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(manifest)?)?;
    Ok(())
}

pub fn build_provider_export_policy(
    plan: &ProviderPlan,
    cue_sheet: &ProviderCueSheet,
) -> ProviderExportPolicy {
    let manifest = build_provider_deliverables_manifest(plan, cue_sheet);
    let mut export_rules = manifest
        .assets
        .iter()
        .map(|asset| {
            let (package_name, relative_dir, keep_isolated, naming_pattern) =
                match asset.asset_type.as_str() {
                    "isolated_stem" => (
                        "isolated_stems",
                        "./exports/stems".to_string(),
                        true,
                        "{stem_name}.wav".to_string(),
                    ),
                    "vocal_guide" => (
                        "vocal_guides",
                        "./exports/vocals".to_string(),
                        true,
                        "{stem_name}.wav".to_string(),
                    ),
                    "mixdown_reference" => (
                        "reference_mix",
                        "./exports/reference".to_string(),
                        false,
                        "{stem_name}.wav".to_string(),
                    ),
                    "lyric_sheet" => (
                        "rehearsal_docs",
                        "./exports/rehearsal/docs".to_string(),
                        false,
                        "{stem_name}.txt".to_string(),
                    ),
                    _ => (
                        "session_data",
                        "./exports/session".to_string(),
                        false,
                        "{stem_name}.json".to_string(),
                    ),
                };

            ProviderExportRule {
                asset_type: asset.asset_type.clone(),
                package_name: package_name.to_string(),
                relative_dir,
                naming_pattern,
                required: !asset.optional,
                keep_isolated,
            }
        })
        .collect::<Vec<_>>();

    export_rules.sort_by(|a, b| a.package_name.cmp(&b.package_name));

    ProviderExportPolicy {
        vendor: manifest.vendor,
        profile_name: manifest.profile_name,
        preserve_stems: manifest.preserve_stems,
        preserve_vocals: true,
        final_mix_optional: manifest.final_mix_optional,
        export_rules,
    }
}

pub fn write_provider_export_policy(path: &Path, policy: &ProviderExportPolicy) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(policy)?)?;
    Ok(())
}

pub fn build_provider_package_layout(
    plan: &ProviderPlan,
    cue_sheet: &ProviderCueSheet,
) -> ProviderPackageLayout {
    let manifest = build_provider_deliverables_manifest(plan, cue_sheet);
    let stems_assets = package_assets(&manifest, &["isolated_stem"]);
    let vocal_assets = package_assets(&manifest, &["vocal_guide"]);
    let reference_assets = package_assets(&manifest, &["mixdown_reference"]);
    let session_assets = package_assets(&manifest, &["session_manifest"]);
    let rehearsal_docs = package_assets(&manifest, &["lyric_sheet"]);

    let mut bundles = Vec::new();
    bundles.push(ProviderPackageBundle {
        package_name: "isolated_stems".to_string(),
        relative_dir: "./exports/stems".to_string(),
        package_format: "folder".to_string(),
        purpose: "source-of-truth isolated instrumental stems kept separate through final delivery"
            .to_string(),
        include_assets: stems_assets.clone(),
    });
    bundles.push(ProviderPackageBundle {
        package_name: "vocal_guides".to_string(),
        relative_dir: "./exports/vocals".to_string(),
        package_format: "folder".to_string(),
        purpose: "lead and backing vocal guides for singer practice and orchestral alignment"
            .to_string(),
        include_assets: vocal_assets.clone(),
    });
    bundles.push(ProviderPackageBundle {
        package_name: "reference_mix".to_string(),
        relative_dir: "./exports/reference".to_string(),
        package_format: "folder".to_string(),
        purpose: "optional listening reference, never a replacement for isolated stems".to_string(),
        include_assets: reference_assets.clone(),
    });
    bundles.push(ProviderPackageBundle {
        package_name: "rehearsal_pack".to_string(),
        relative_dir: "./exports/rehearsal".to_string(),
        package_format: "zip".to_string(),
        purpose: "band and orchestra rehearsal package with stems, vocal guides, and cue documents"
            .to_string(),
        include_assets: combine_asset_refs(&[
            stems_assets.clone(),
            vocal_assets.clone(),
            rehearsal_docs.clone(),
            session_assets.clone(),
        ]),
    });
    bundles.push(ProviderPackageBundle {
        package_name: "film_post_pack".to_string(),
        relative_dir: "./exports/post".to_string(),
        package_format: "zip".to_string(),
        purpose: "film and episodic post-production package with isolated stems, vocal guides, and session manifests"
            .to_string(),
        include_assets: combine_asset_refs(&[
            stems_assets,
            vocal_assets,
            reference_assets,
            session_assets,
        ]),
    });

    ProviderPackageLayout {
        vendor: manifest.vendor,
        profile_name: manifest.profile_name,
        root_dir: "./exports".to_string(),
        bundles,
    }
}

pub fn write_provider_package_layout(path: &Path, layout: &ProviderPackageLayout) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(layout)?)?;
    Ok(())
}

pub fn build_provider_stem_naming_convention(
    plan: &ProviderPlan,
    cue_sheet: &ProviderCueSheet,
) -> ProviderStemNamingConvention {
    let manifest = build_provider_deliverables_manifest(plan, cue_sheet);
    let song_slug = format!(
        "{}-{}",
        plan.vendor_name(),
        sanitize_slug(&manifest.profile_name)
    );
    let rules = manifest
        .assets
        .iter()
        .map(|asset| {
            let extension = asset
                .relative_path
                .rsplit('.')
                .next()
                .filter(|ext| !ext.contains('/'))
                .unwrap_or("wav");
            let channel_tag = match asset.asset_type.as_str() {
                "isolated_stem" | "vocal_guide" | "mixdown_reference" => "stereo",
                _ => "meta",
            };
            let filename_template =
                format!("{song_slug}__{{asset_type}}__{{stem_name}}__{channel_tag}.{extension}");
            let resolved_filename = filename_template
                .replace("{asset_type}", &asset.asset_type)
                .replace("{stem_name}", &sanitize_slug(&asset.stem_name));

            ProviderStemNamingRule {
                asset_type: asset.asset_type.clone(),
                stem_name: asset.stem_name.clone(),
                channel_tag: channel_tag.to_string(),
                filename_template,
                resolved_filename,
            }
        })
        .collect();

    ProviderStemNamingConvention {
        vendor: manifest.vendor,
        profile_name: manifest.profile_name,
        song_slug,
        rules,
    }
}

pub fn write_provider_stem_naming_convention(
    path: &Path,
    naming: &ProviderStemNamingConvention,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(naming)?)?;
    Ok(())
}

pub fn build_provider_delivery_metadata(
    plan: &ProviderPlan,
    cue_sheet: &ProviderCueSheet,
) -> ProviderDeliveryMetadata {
    let profile = provider_profile(plan);
    let loudness_target_lufs = match plan.vendor {
        ProviderVendor::Spitfire | ProviderVendor::Eastwest => -20.0,
        ProviderVendor::Kontakt => -18.0,
        ProviderVendor::Custom => -19.0,
        ProviderVendor::Internal => -16.0,
    };

    ProviderDeliveryMetadata {
        vendor: cue_sheet.vendor,
        profile_name: cue_sheet.profile_name.clone(),
        sample_rate_hz: 48_000,
        bit_depth: 24,
        loudness_target_lufs,
        timecode_start: "01:00:00:00".to_string(),
        stems_interleaved_stereo: true,
        include_bwf_timestamps: true,
        package_notes: vec![
            "Preserve isolated stems through final delivery; do not collapse stems into a mandatory full mix.".to_string(),
            "Reference mix is optional and intended only for client review or rehearsal orientation.".to_string(),
            format!(
                "Provider profile '{}' should export rehearsal and post packages from the same stem source of truth.",
                profile.profile_name
            ),
        ],
    }
}

pub fn write_provider_delivery_metadata(
    path: &Path,
    metadata: &ProviderDeliveryMetadata,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(metadata)?)?;
    Ok(())
}

pub fn build_provider_archive_builder(
    plan: &ProviderPlan,
    cue_sheet: &ProviderCueSheet,
) -> ProviderArchiveBuilder {
    let layout = build_provider_package_layout(plan, cue_sheet);
    let archive_items = layout
        .bundles
        .iter()
        .filter(|bundle| bundle.package_format == "zip")
        .map(|bundle| ProviderArchiveItem {
            bundle_name: bundle.package_name.clone(),
            archive_path: format!(
                "{}/{}.zip",
                layout.root_dir.trim_end_matches('/'),
                bundle.package_name
            ),
            archive_format: bundle.package_format.clone(),
            source_dir: bundle.relative_dir.clone(),
            include_assets: bundle.include_assets.clone(),
        })
        .collect();

    ProviderArchiveBuilder {
        vendor: layout.vendor,
        profile_name: layout.profile_name,
        root_dir: layout.root_dir,
        archive_items,
    }
}

pub fn write_provider_archive_builder(
    path: &Path,
    archive_builder: &ProviderArchiveBuilder,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(archive_builder)?)?;
    Ok(())
}

pub fn materialize_export_package(
    run_dir: &Path,
    naming: &ProviderStemNamingConvention,
    metadata: &ProviderDeliveryMetadata,
    layout: &ProviderPackageLayout,
    archive_builder: &ProviderArchiveBuilder,
    render_queue: &ProviderRenderQueue,
) -> Result<ProviderDeliverySummary> {
    let export_root = run_dir.join(layout.root_dir.trim_start_matches("./"));
    std::fs::create_dir_all(&export_root)?;

    let naming_map = naming
        .rules
        .iter()
        .map(|rule| ((rule.asset_type.clone(), rule.stem_name.clone()), rule))
        .collect::<HashMap<_, _>>();

    let mut exported_files = Vec::new();
    let mut missing_assets = Vec::new();
    let mut notes = metadata.package_notes.clone();

    for bundle in &layout.bundles {
        let bundle_dir = run_dir.join(bundle.relative_dir.trim_start_matches("./"));
        std::fs::create_dir_all(&bundle_dir)?;

        for asset in &bundle.include_assets {
            let source = resolve_asset_source(run_dir, asset);
            let Some(source_path) = source else {
                missing_assets.push(ProviderMissingAsset {
                    bundle_name: bundle.package_name.clone(),
                    asset_type: asset.asset_type.clone(),
                    stem_name: asset.stem_name.clone(),
                    expected_path: asset.relative_path.clone(),
                });
                continue;
            };

            let fallback_name = default_export_name(asset);
            let file_name = naming_map
                .get(&(asset.asset_type.clone(), asset.stem_name.clone()))
                .map(|rule| rule.resolved_filename.clone())
                .unwrap_or(fallback_name);
            let target_path = bundle_dir.join(file_name);
            if target_path.exists() {
                std::fs::remove_file(&target_path)?;
            }
            let method = hardlink_or_copy(&source_path, &target_path)?;
            exported_files.push(ProviderExportedFile {
                bundle_name: bundle.package_name.clone(),
                asset_type: asset.asset_type.clone(),
                stem_name: asset.stem_name.clone(),
                source_path: source_path.to_string_lossy().to_string(),
                exported_path: target_path.to_string_lossy().to_string(),
                method,
            });
        }
    }

    let archives = archive_builder
        .archive_items
        .iter()
        .map(|item| {
            let source_dir = run_dir.join(item.source_dir.trim_start_matches("./"));
            let archive_path = run_dir.join(item.archive_path.trim_start_matches("./"));
            let created = if source_dir.exists() {
                create_zip_archive(&source_dir, &archive_path).unwrap_or(false)
            } else {
                false
            };
            ProviderArchiveOutput {
                bundle_name: item.bundle_name.clone(),
                archive_path: archive_path.to_string_lossy().to_string(),
                created,
            }
        })
        .collect::<Vec<_>>();

    if archives.iter().any(|item| !item.created) {
        notes.push(
            "Some archive bundles were not zipped because the platform zip command was unavailable or the source directory was empty."
                .to_string(),
        );
    }
    let handoff_request_path = if !missing_assets.is_empty() {
        let provisional_summary = ProviderDeliverySummary {
            vendor: layout.vendor,
            profile_name: layout.profile_name.clone(),
            export_root: export_root.to_string_lossy().to_string(),
            exported_files: exported_files.clone(),
            missing_assets: missing_assets.clone(),
            archives: archives.clone(),
            handoff_request_path: None,
            notes: notes.clone(),
        };
        let handoff = build_provider_render_handoff(render_queue, &provisional_summary);
        let handoff_path = run_dir.join("./build/audio_provider_render_handoff.json");
        write_provider_render_handoff(&handoff_path, &handoff)?;
        notes.push(format!(
            "{} deliverable assets are still missing and should be supplied by later render stages or external providers.",
            missing_assets.len()
        ));
        Some(handoff_path.to_string_lossy().to_string())
    } else {
        None
    };

    Ok(ProviderDeliverySummary {
        vendor: layout.vendor,
        profile_name: layout.profile_name.clone(),
        export_root: export_root.to_string_lossy().to_string(),
        exported_files,
        missing_assets,
        archives,
        handoff_request_path,
        notes,
    })
}

pub fn write_provider_delivery_summary(
    path: &Path,
    summary: &ProviderDeliverySummary,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(summary)?)?;
    Ok(())
}

pub fn build_provider_render_handoff(
    render_queue: &ProviderRenderQueue,
    summary: &ProviderDeliverySummary,
) -> ProviderRenderHandoff {
    let queue_items = summary
        .missing_assets
        .iter()
        .map(|missing| {
            let matched = render_queue.queue_items.iter().find(|item| {
                item.stem_name == missing.stem_name || matches_missing_role(item, missing)
            });
            let (render_target, source_roles) = if let Some(item) = matched {
                (item.render_target.clone(), item.source_roles.clone())
            } else {
                default_handoff_target(missing)
            };

            ProviderRenderHandoffItem {
                request_id: format!(
                    "handoff-{}-{}",
                    sanitize_slug(&missing.asset_type),
                    sanitize_slug(&missing.stem_name)
                ),
                bundle_name: missing.bundle_name.clone(),
                asset_type: missing.asset_type.clone(),
                stem_name: missing.stem_name.clone(),
                render_target,
                expected_output_path: missing.expected_path.clone(),
                source_roles,
                profile_name: summary.profile_name.clone(),
                priority: if missing.asset_type == "isolated_stem" {
                    "high".to_string()
                } else {
                    "medium".to_string()
                },
            }
        })
        .collect();

    ProviderRenderHandoff {
        vendor: summary.vendor,
        profile_name: summary.profile_name.clone(),
        reason: "missing deliverable assets detected during export packaging".to_string(),
        queue_items,
    }
}

pub fn write_provider_render_handoff(path: &Path, handoff: &ProviderRenderHandoff) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(handoff)?)?;
    Ok(())
}

pub fn build_provider_requeue_execution(
    build_dir: &Path,
    handoff: &ProviderRenderHandoff,
) -> Result<ProviderRequeueExecution> {
    std::fs::create_dir_all(build_dir)?;
    let queue_path = build_dir.join("audio_provider_requeue_queue.json");
    let summary_path = build_dir.join("audio_provider_requeue_summary.json");
    std::fs::write(
        &queue_path,
        serde_json::to_vec_pretty(&handoff.queue_items)?,
    )?;
    let summary = json!({
        "reason": handoff.reason,
        "profile_name": handoff.profile_name,
        "vendor": format!("{:?}", handoff.vendor).to_ascii_lowercase(),
        "queue_size": handoff.queue_items.len()
    });
    std::fs::write(&summary_path, serde_json::to_vec_pretty(&summary)?)?;

    let handoff_path = build_dir.join("audio_provider_render_handoff.json");
    let requeue_bin = std::env::var("CSS_AUDIO_PROVIDER_REQUEUE_BIN")
        .ok()
        .filter(|v| !v.trim().is_empty())
        .or_else(|| std::env::var("CSS_AUDIO_PROVIDER_RENDER_BIN").ok());
    let requeue_args = vec![
        "--handoff".to_string(),
        handoff_path.to_string_lossy().to_string(),
        "--queue".to_string(),
        queue_path.to_string_lossy().to_string(),
        "--summary".to_string(),
        summary_path.to_string_lossy().to_string(),
    ];
    let requeue_cmdline = requeue_bin
        .as_ref()
        .map(|bin| format_render_cmdline(bin, &requeue_args));

    Ok(ProviderRequeueExecution {
        handoff_path,
        queue_path,
        summary_path,
        queue_items: handoff.queue_items.clone(),
        requeue_bin,
        requeue_args,
        requeue_cmdline,
    })
}

pub fn write_provider_requeue_execution(
    path: &Path,
    execution: &ProviderRequeueExecution,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(execution)?)?;
    Ok(())
}

pub async fn execute_render_handoff(
    cwd: &Path,
    execution: &ProviderRequeueExecution,
) -> Result<bool> {
    let Some(bin) = execution.requeue_bin.clone() else {
        return Ok(false);
    };
    if execution.requeue_args.is_empty() || !env_truthy("CSS_AUDIO_PROVIDER_AUTO_REQUEUE") {
        return Ok(false);
    }
    let out = Command::new(&bin)
        .args(&execution.requeue_args)
        .current_dir(cwd)
        .output()
        .await?;
    if !out.status.success() {
        return Err(anyhow!(
            "audio provider requeue failed: status={:?}, stderr={}",
            out.status.code(),
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(true)
}

pub async fn dispatch_render_handoff(
    build_dir: &Path,
    handoff: &ProviderRenderHandoff,
) -> Result<ProviderQueueDispatchReport> {
    std::fs::create_dir_all(build_dir)?;
    let backend = std::env::var("CSS_AUDIO_PROVIDER_HANDOFF_BACKEND")
        .unwrap_or_else(|_| "local".to_string())
        .trim()
        .to_ascii_lowercase();
    match backend.as_str() {
        "redis" => dispatch_render_handoff_redis(build_dir, handoff).await,
        "webhook" => dispatch_render_handoff_webhook(build_dir, handoff).await,
        _ => dispatch_render_handoff_local(build_dir, handoff),
    }
}

pub fn write_provider_queue_dispatch_report(
    path: &Path,
    report: &ProviderQueueDispatchReport,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(report)?)?;
    Ok(())
}

pub fn write_provider_delivery_status(path: &Path, status: &ProviderDeliveryStatus) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(status)?)?;
    Ok(())
}

pub fn write_provider_job_worker_report(
    path: &Path,
    report: &ProviderJobWorkerReport,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(report)?)?;
    Ok(())
}

pub fn write_provider_reconciliation_report(
    path: &Path,
    report: &ProviderReconciliationReport,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(report)?)?;
    Ok(())
}

pub fn write_provider_artifact_watcher_report(
    path: &Path,
    report: &ProviderArtifactWatcherReport,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(report)?)?;
    Ok(())
}

pub fn write_provider_delivery_readiness_gate(
    path: &Path,
    gate: &ProviderDeliveryReadinessGate,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(gate)?)?;
    Ok(())
}

pub fn write_provider_publish_handoff(path: &Path, handoff: &ProviderPublishHandoff) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(handoff)?)?;
    Ok(())
}

pub fn write_provider_publish_notification_report(
    path: &Path,
    report: &ProviderPublishNotificationReport,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(report)?)?;
    Ok(())
}

pub fn write_provider_publish_ledger(path: &Path, ledger: &ProviderPublishLedger) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(ledger)?)?;
    Ok(())
}

pub fn write_provider_publish_state_machine(
    path: &Path,
    machine: &ProviderPublishStateMachine,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(machine)?)?;
    Ok(())
}

pub fn write_provider_publish_retry_policy(
    path: &Path,
    policy: &ProviderPublishRetryPolicy,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(policy)?)?;
    Ok(())
}

pub fn write_provider_publish_executor_report(
    path: &Path,
    report: &ProviderPublishExecutorReport,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(report)?)?;
    Ok(())
}

pub fn write_provider_downstream_delivery_report(
    path: &Path,
    report: &ProviderDownstreamDeliveryReport,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(report)?)?;
    Ok(())
}

pub fn write_provider_receipt_sync(path: &Path, sync: &ProviderReceiptSync) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(sync)?)?;
    Ok(())
}

pub fn write_provider_delivery_dashboard_feed(
    path: &Path,
    feed: &ProviderDeliveryDashboardFeed,
) -> Result<()> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, serde_json::to_vec_pretty(feed)?)?;
    Ok(())
}

pub async fn run_job_worker(
    build_dir: &Path,
    handoff: &ProviderRenderHandoff,
    dispatch_report: &ProviderQueueDispatchReport,
) -> Result<ProviderJobWorkerReport> {
    std::fs::create_dir_all(build_dir)?;
    let jobs = match dispatch_report.backend.as_str() {
        "redis" => collect_handoff_jobs_redis(&dispatch_report.target).await?,
        "webhook" => handoff.queue_items.clone(),
        _ => collect_handoff_jobs_local(build_dir)?,
    };

    let run_dir = build_dir.parent().unwrap_or(build_dir);
    let receipts_dir = build_dir.join("audio_provider_job_worker_receipts");
    std::fs::create_dir_all(&receipts_dir)?;

    let mut statuses = Vec::new();
    for job in jobs {
        statuses.push(
            process_worker_job(run_dir, &receipts_dir, &dispatch_report.backend, &job).await?,
        );
    }

    let completed_count = statuses
        .iter()
        .filter(|job| job.state == "completed")
        .count();
    let failed_count = statuses.iter().filter(|job| job.state == "failed").count();
    let pending_count = statuses
        .len()
        .saturating_sub(completed_count + failed_count);

    let status = ProviderDeliveryStatus {
        vendor: handoff.vendor,
        profile_name: handoff.profile_name.clone(),
        backend: dispatch_report.backend.clone(),
        queue_target: dispatch_report.target.clone(),
        total_jobs: statuses.len(),
        completed_jobs: completed_count,
        pending_jobs: pending_count,
        failed_jobs: failed_count,
        jobs: statuses,
    };
    let status_path = build_dir.join("audio_provider_delivery_status.json");
    write_provider_delivery_status(&status_path, &status)?;

    Ok(ProviderJobWorkerReport {
        backend: dispatch_report.backend.clone(),
        queue_target: dispatch_report.target.clone(),
        consumed_count: status.total_jobs,
        completed_count,
        pending_count,
        failed_count,
        status_path: status_path.to_string_lossy().to_string(),
        receipt_dir: receipts_dir.to_string_lossy().to_string(),
    })
}

pub fn reconcile_delivery(
    run_dir: &Path,
    naming: &ProviderStemNamingConvention,
    metadata: &ProviderDeliveryMetadata,
    layout: &ProviderPackageLayout,
    archive_builder: &ProviderArchiveBuilder,
    render_queue: &ProviderRenderQueue,
    worker_report: &ProviderJobWorkerReport,
) -> Result<ProviderReconciliationReport> {
    let build_dir = run_dir.join("build");
    std::fs::create_dir_all(&build_dir)?;
    let summary_path = build_dir.join("audio_provider_delivery_summary.json");
    let previous_summary = std::fs::read_to_string(&summary_path)
        .ok()
        .and_then(|raw| serde_json::from_str::<ProviderDeliverySummary>(&raw).ok());
    let missing_before = previous_summary
        .as_ref()
        .map(|summary| summary.missing_assets.len())
        .unwrap_or(0);

    let refreshed_summary = materialize_export_package(
        run_dir,
        naming,
        metadata,
        layout,
        archive_builder,
        render_queue,
    )?;
    write_provider_delivery_summary(&summary_path, &refreshed_summary)?;

    let delivery_status_path = build_dir.join("audio_provider_delivery_status.json");
    let mut delivery_status = std::fs::read_to_string(&delivery_status_path)
        .ok()
        .and_then(|raw| serde_json::from_str::<ProviderDeliveryStatus>(&raw).ok())
        .unwrap_or(ProviderDeliveryStatus {
            vendor: refreshed_summary.vendor,
            profile_name: refreshed_summary.profile_name.clone(),
            backend: worker_report.backend.clone(),
            queue_target: worker_report.queue_target.clone(),
            total_jobs: 0,
            completed_jobs: 0,
            pending_jobs: 0,
            failed_jobs: 0,
            jobs: Vec::new(),
        });

    for job in &mut delivery_status.jobs {
        let expected_path = PathBuf::from(&job.expected_output_path);
        if expected_path.exists() {
            job.state = "completed".to_string();
            job.message = "reconciled after worker writeback and export refresh".to_string();
        }
    }
    delivery_status.completed_jobs = delivery_status
        .jobs
        .iter()
        .filter(|job| job.state == "completed")
        .count();
    delivery_status.failed_jobs = delivery_status
        .jobs
        .iter()
        .filter(|job| job.state == "failed")
        .count();
    delivery_status.pending_jobs = delivery_status
        .jobs
        .len()
        .saturating_sub(delivery_status.completed_jobs + delivery_status.failed_jobs);
    delivery_status.total_jobs = delivery_status.jobs.len();
    write_provider_delivery_status(&delivery_status_path, &delivery_status)?;

    let archives_created = refreshed_summary
        .archives
        .iter()
        .filter(|archive| archive.created)
        .count();
    let missing_after = refreshed_summary.missing_assets.len();
    let mut notes = Vec::new();
    if missing_after < missing_before {
        notes.push(format!(
            "Delivery reconciliation reduced missing assets from {} to {}.",
            missing_before, missing_after
        ));
    } else if missing_after == 0 {
        notes.push("Delivery reconciliation resolved all previously missing assets.".to_string());
    } else {
        notes.push(format!(
            "Delivery reconciliation refreshed packaging, but {} assets still require render writeback.",
            missing_after
        ));
    }

    Ok(ProviderReconciliationReport {
        refreshed: true,
        delivery_summary_path: summary_path.to_string_lossy().to_string(),
        delivery_status_path: delivery_status_path.to_string_lossy().to_string(),
        missing_before,
        missing_after,
        archives_created,
        notes,
    })
}

pub async fn watch_provider_artifacts(
    run_dir: &Path,
    naming: &ProviderStemNamingConvention,
    metadata: &ProviderDeliveryMetadata,
    layout: &ProviderPackageLayout,
    archive_builder: &ProviderArchiveBuilder,
    render_queue: &ProviderRenderQueue,
    worker_report: &ProviderJobWorkerReport,
) -> Result<ProviderArtifactWatcherReport> {
    let build_dir = run_dir.join("build");
    std::fs::create_dir_all(&build_dir)?;
    let watch_enabled = std::env::var("CSS_AUDIO_PROVIDER_ARTIFACT_WATCHER")
        .ok()
        .map(|v| {
            !matches!(
                v.trim().to_ascii_lowercase().as_str(),
                "0" | "false" | "off" | "no"
            )
        })
        .unwrap_or(true);
    let poll_interval_ms = std::env::var("CSS_AUDIO_PROVIDER_ARTIFACT_WATCHER_POLL_MS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(250);
    let timeout_ms = std::env::var("CSS_AUDIO_PROVIDER_ARTIFACT_WATCHER_TIMEOUT_MS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(2_500);
    let watch_roots = artifact_watch_roots(run_dir, layout);

    if !watch_enabled || timeout_ms == 0 || watch_roots.is_empty() {
        return Ok(ProviderArtifactWatcherReport {
            active: false,
            watch_roots: watch_roots
                .iter()
                .map(|path| path.to_string_lossy().to_string())
                .collect(),
            poll_interval_ms,
            timeout_ms,
            changes_detected: 0,
            reconciliation_runs: 0,
            last_reconciliation_path: None,
        });
    }

    let mut baseline = scan_watch_roots(&watch_roots)?;
    let start = std::time::Instant::now();
    let mut changes_detected = 0usize;
    let mut reconciliation_runs = 0usize;
    let mut last_reconciliation_path = None;

    while start.elapsed().as_millis() < timeout_ms as u128 {
        tokio::time::sleep(tokio::time::Duration::from_millis(poll_interval_ms)).await;
        let snapshot = scan_watch_roots(&watch_roots)?;
        if snapshot != baseline {
            changes_detected += 1;
            baseline = snapshot;
            let reconciliation = reconcile_delivery(
                run_dir,
                naming,
                metadata,
                layout,
                archive_builder,
                render_queue,
                worker_report,
            )?;
            reconciliation_runs += 1;
            let reconciliation_path = build_dir.join(format!(
                "audio_provider_reconciliation_report.watch-{}.json",
                reconciliation_runs
            ));
            write_provider_reconciliation_report(&reconciliation_path, &reconciliation)?;
            last_reconciliation_path = Some(reconciliation_path.to_string_lossy().to_string());
        }
    }

    Ok(ProviderArtifactWatcherReport {
        active: true,
        watch_roots: watch_roots
            .iter()
            .map(|path| path.to_string_lossy().to_string())
            .collect(),
        poll_interval_ms,
        timeout_ms,
        changes_detected,
        reconciliation_runs,
        last_reconciliation_path,
    })
}

pub fn evaluate_delivery_readiness(
    summary: &ProviderDeliverySummary,
    layout: &ProviderPackageLayout,
) -> ProviderDeliveryReadinessGate {
    let required_ratio = std::env::var("CSS_AUDIO_PROVIDER_READY_RATIO")
        .ok()
        .and_then(|v| v.parse::<f32>().ok())
        .unwrap_or(1.0)
        .clamp(0.0, 1.0);

    let isolated_bundle = layout
        .bundles
        .iter()
        .find(|bundle| bundle.package_name == "isolated_stems");
    let vocal_bundle = layout
        .bundles
        .iter()
        .find(|bundle| bundle.package_name == "vocal_guides");
    let rehearsal_bundle = layout
        .bundles
        .iter()
        .find(|bundle| bundle.package_name == "rehearsal_pack");
    let post_bundle = layout
        .bundles
        .iter()
        .find(|bundle| bundle.package_name == "film_post_pack");

    let categories = vec![
        readiness_category(summary, isolated_bundle, "isolated_stems"),
        readiness_category(summary, vocal_bundle, "vocal_guides"),
        readiness_category(summary, rehearsal_bundle, "rehearsal_pack"),
        readiness_category(summary, post_bundle, "film_post_pack"),
    ];

    let required_total = categories
        .iter()
        .map(|cat| cat.required)
        .sum::<usize>()
        .max(1);
    let present_total = categories.iter().map(|cat| cat.present).sum::<usize>();
    let achieved_ratio = present_total as f32 / required_total as f32;
    let ready_for_delivery =
        achieved_ratio >= required_ratio && categories.iter().all(|cat| cat.ready);
    let state = if ready_for_delivery {
        "ready_for_delivery".to_string()
    } else {
        "awaiting_assets".to_string()
    };
    let mut notes = Vec::new();
    if ready_for_delivery {
        notes.push("All required delivery bundles reached the readiness threshold.".to_string());
    } else {
        notes.push(format!(
            "Delivery readiness is {:.0}% with threshold {:.0}%.",
            achieved_ratio * 100.0,
            required_ratio * 100.0
        ));
    }

    ProviderDeliveryReadinessGate {
        state,
        ready_for_delivery,
        required_ratio,
        achieved_ratio,
        categories,
        notes,
    }
}

pub fn apply_delivery_readiness_gate(
    build_dir: &Path,
    layout: &ProviderPackageLayout,
) -> Result<ProviderDeliveryReadinessGate> {
    let summary_path = build_dir.join("audio_provider_delivery_summary.json");
    let status_path = build_dir.join("audio_provider_delivery_status.json");
    let summary_raw = std::fs::read_to_string(&summary_path)?;
    let summary: ProviderDeliverySummary = serde_json::from_str(&summary_raw)?;
    let mut status = std::fs::read_to_string(&status_path)
        .ok()
        .and_then(|raw| serde_json::from_str::<ProviderDeliveryStatus>(&raw).ok())
        .unwrap_or(ProviderDeliveryStatus {
            vendor: summary.vendor,
            profile_name: summary.profile_name.clone(),
            backend: "internal".to_string(),
            queue_target: String::new(),
            total_jobs: 0,
            completed_jobs: 0,
            pending_jobs: 0,
            failed_jobs: 0,
            jobs: Vec::new(),
        });

    let gate = evaluate_delivery_readiness(&summary, layout);
    if gate.ready_for_delivery {
        for job in &mut status.jobs {
            if job.state != "failed" {
                job.state = "ready_for_delivery".to_string();
                job.message =
                    "delivery gate satisfied and package is ready for delivery".to_string();
            }
        }
        status.pending_jobs = 0;
    }
    write_provider_delivery_status(&status_path, &status)?;
    Ok(gate)
}

pub fn build_publish_handoff(
    build_dir: &Path,
    layout: &ProviderPackageLayout,
) -> Result<ProviderPublishHandoff> {
    let summary_path = build_dir.join("audio_provider_delivery_summary.json");
    let status_path = build_dir.join("audio_provider_delivery_status.json");
    let readiness_gate_path = build_dir.join("audio_provider_delivery_readiness_gate.json");
    let package_layout_path = build_dir.join("audio_provider_package_layout.json");

    let summary_raw = std::fs::read_to_string(&summary_path)?;
    let summary: ProviderDeliverySummary = serde_json::from_str(&summary_raw)?;
    let status_raw = std::fs::read_to_string(&status_path)?;
    let status: ProviderDeliveryStatus = serde_json::from_str(&status_raw)?;
    let gate_raw = std::fs::read_to_string(&readiness_gate_path)?;
    let gate: ProviderDeliveryReadinessGate = serde_json::from_str(&gate_raw)?;

    let bundles = layout
        .bundles
        .iter()
        .map(|bundle| {
            let required_assets = bundle
                .include_assets
                .iter()
                .filter(|asset| !asset.optional)
                .count();
            let present_assets = bundle
                .include_assets
                .iter()
                .filter(|asset| {
                    !asset.optional
                        && !summary.missing_assets.iter().any(|missing| {
                            missing.bundle_name == bundle.package_name
                                && missing.asset_type == asset.asset_type
                                && missing.stem_name == asset.stem_name
                        })
                })
                .count();
            let archive = summary
                .archives
                .iter()
                .find(|archive| archive.bundle_name == bundle.package_name);
            ProviderPublishBundle {
                package_name: bundle.package_name.clone(),
                relative_dir: bundle.relative_dir.clone(),
                package_format: bundle.package_format.clone(),
                required_assets,
                present_assets,
                archive_path: archive.map(|item| item.archive_path.clone()),
                archive_created: archive.map(|item| item.created).unwrap_or(false),
            }
        })
        .collect();

    let mut notes = gate.notes.clone();
    notes.push(format!(
        "Delivery status snapshot: completed={}, pending={}, failed={}.",
        status.completed_jobs, status.pending_jobs, status.failed_jobs
    ));

    Ok(ProviderPublishHandoff {
        vendor: summary.vendor,
        profile_name: summary.profile_name,
        state: gate.state.clone(),
        ready_for_delivery: gate.ready_for_delivery,
        export_root: summary.export_root,
        delivery_summary_path: summary_path.to_string_lossy().to_string(),
        delivery_status_path: status_path.to_string_lossy().to_string(),
        package_layout_path: package_layout_path.to_string_lossy().to_string(),
        readiness_gate_path: readiness_gate_path.to_string_lossy().to_string(),
        bundles,
        notes,
    })
}

pub async fn dispatch_publish_handoff(
    build_dir: &Path,
    handoff: &ProviderPublishHandoff,
) -> Result<ProviderPublishNotificationReport> {
    std::fs::create_dir_all(build_dir)?;
    let backend = std::env::var("CSS_AUDIO_PROVIDER_PUBLISH_BACKEND")
        .unwrap_or_else(|_| "local".to_string())
        .trim()
        .to_ascii_lowercase();
    match backend.as_str() {
        "webhook" => dispatch_publish_handoff_webhook(build_dir, handoff).await,
        "command" | "cmd" => dispatch_publish_handoff_command(build_dir, handoff).await,
        "off" | "none" => Ok(ProviderPublishNotificationReport {
            triggered: false,
            backend,
            target: String::new(),
            accepted: false,
            status: "disabled".to_string(),
            publish_handoff_path: None,
            receipt_path: None,
            message: "publish notification backend disabled".to_string(),
        }),
        _ => dispatch_publish_handoff_local(build_dir, handoff),
    }
}

pub fn update_publish_ledger(
    build_dir: &Path,
    handoff: Option<&ProviderPublishHandoff>,
    notification_report: &ProviderPublishNotificationReport,
) -> Result<ProviderPublishLedger> {
    std::fs::create_dir_all(build_dir)?;
    let ledger_path = build_dir.join("audio_provider_publish_ledger.json");
    let notification_report_path =
        build_dir.join("audio_provider_publish_notification_report.json");
    let existing = std::fs::read_to_string(&ledger_path)
        .ok()
        .and_then(|raw| serde_json::from_str::<ProviderPublishLedger>(&raw).ok());

    let summary = handoff
        .and_then(|handoff| std::fs::read_to_string(&handoff.delivery_summary_path).ok())
        .and_then(|raw| serde_json::from_str::<ProviderDeliverySummary>(&raw).ok());

    let entry = if let Some(handoff) = handoff {
        ProviderPublishLedgerEntry {
            entry_id: format!(
                "{}-{}-{}",
                sanitize_slug(handoff.profile_name.as_str()),
                sanitize_slug(handoff.state.as_str()),
                existing
                    .as_ref()
                    .map(|ledger| ledger.entries.len() + 1)
                    .unwrap_or(1)
            ),
            state: handoff.state.clone(),
            ready_for_delivery: handoff.ready_for_delivery,
            triggered_notification: notification_report.triggered,
            notification_backend: notification_report.backend.clone(),
            notification_status: notification_report.status.clone(),
            accepted: notification_report.accepted,
            export_root: handoff.export_root.clone(),
            publish_handoff_path: notification_report
                .publish_handoff_path
                .clone()
                .or_else(|| {
                    Some(
                        build_dir
                            .join("audio_provider_publish_handoff.json")
                            .to_string_lossy()
                            .to_string(),
                    )
                }),
            notification_report_path: notification_report_path.to_string_lossy().to_string(),
            archive_paths: summary
                .as_ref()
                .map(|summary| {
                    summary
                        .archives
                        .iter()
                        .filter(|archive| archive.created)
                        .map(|archive| archive.archive_path.clone())
                        .collect()
                })
                .unwrap_or_default(),
            notes: handoff
                .notes
                .iter()
                .cloned()
                .chain(std::iter::once(notification_report.message.clone()))
                .collect(),
        }
    } else {
        ProviderPublishLedgerEntry {
            entry_id: format!(
                "awaiting-assets-{}",
                existing
                    .as_ref()
                    .map(|ledger| ledger.entries.len() + 1)
                    .unwrap_or(1)
            ),
            state: "awaiting_assets".to_string(),
            ready_for_delivery: false,
            triggered_notification: notification_report.triggered,
            notification_backend: notification_report.backend.clone(),
            notification_status: notification_report.status.clone(),
            accepted: notification_report.accepted,
            export_root: build_dir.to_string_lossy().to_string(),
            publish_handoff_path: None,
            notification_report_path: notification_report_path.to_string_lossy().to_string(),
            archive_paths: Vec::new(),
            notes: vec![notification_report.message.clone()],
        }
    };

    let mut entries = existing.map(|ledger| ledger.entries).unwrap_or_default();
    entries.push(entry);
    if entries.len() > 64 {
        let drop_count = entries.len() - 64;
        entries.drain(0..drop_count);
    }

    let (vendor, profile_name, latest_state, ready_for_delivery) = if let Some(handoff) = handoff {
        (
            handoff.vendor,
            handoff.profile_name.clone(),
            handoff.state.clone(),
            handoff.ready_for_delivery,
        )
    } else if let Some(summary) = summary.as_ref() {
        (
            summary.vendor,
            summary.profile_name.clone(),
            "awaiting_assets".to_string(),
            false,
        )
    } else if let Some(existing) = std::fs::read_to_string(&ledger_path)
        .ok()
        .and_then(|raw| serde_json::from_str::<ProviderPublishLedger>(&raw).ok())
    {
        (
            existing.vendor,
            existing.profile_name,
            "awaiting_assets".to_string(),
            false,
        )
    } else {
        (
            ProviderVendor::Internal,
            "unknown".to_string(),
            "awaiting_assets".to_string(),
            false,
        )
    };

    let ledger = ProviderPublishLedger {
        vendor,
        profile_name,
        latest_state,
        ready_for_delivery,
        entries,
    };
    write_provider_publish_ledger(&ledger_path, &ledger)?;
    Ok(ledger)
}

pub fn evaluate_publish_state_machine(
    ledger: &ProviderPublishLedger,
    handoff: Option<&ProviderPublishHandoff>,
    notification_report: &ProviderPublishNotificationReport,
) -> ProviderPublishStateMachine {
    let max_retries = std::env::var("CSS_AUDIO_PROVIDER_PUBLISH_MAX_RETRIES")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .unwrap_or(3);
    let latest_entry = ledger.entries.last();
    let retry_attempt = latest_entry
        .map(|entry| {
            ledger
                .entries
                .iter()
                .filter(|candidate| {
                    candidate.notification_status == "failed"
                        && candidate.notification_backend == entry.notification_backend
                })
                .count()
        })
        .unwrap_or(0);
    let archive_complete = handoff
        .map(|handoff| {
            handoff
                .bundles
                .iter()
                .filter(|bundle| bundle.package_format == "zip")
                .all(|bundle| bundle.archive_created)
        })
        .unwrap_or(false);

    let (state, can_retry, requires_manual_confirmation, publish_complete, last_error, notes) =
        if !ledger.ready_for_delivery {
            (
                "awaiting_assets".to_string(),
                false,
                false,
                false,
                None,
                vec!["Delivery package is not ready for publish progression yet.".to_string()],
            )
        } else if notification_report.triggered && !notification_report.accepted {
            (
                "notification_failed".to_string(),
                retry_attempt < max_retries,
                retry_attempt >= max_retries,
                false,
                Some(notification_report.message.clone()),
                vec!["Downstream publish notification failed and needs recovery.".to_string()],
            )
        } else if archive_complete
            && std::env::var("CSS_AUDIO_PROVIDER_PUBLISH_MANUAL_CONFIRM")
                .ok()
                .map(|v| {
                    matches!(
                        v.trim().to_ascii_lowercase().as_str(),
                        "1" | "true" | "yes" | "on"
                    )
                })
                .unwrap_or(false)
        {
            (
                "awaiting_manual_confirmation".to_string(),
                false,
                true,
                false,
                None,
                vec![
                    "Archives are ready and waiting on a manual publish confirmation step."
                        .to_string(),
                ],
            )
        } else if archive_complete && notification_report.accepted {
            (
                "archived".to_string(),
                false,
                false,
                true,
                None,
                vec![
                    "Delivery archives are complete and publish handoff has been accepted."
                        .to_string(),
                ],
            )
        } else if notification_report.triggered {
            (
                "pending_notification".to_string(),
                false,
                false,
                false,
                None,
                vec![
                    "Publish handoff is ready but archive completion is still pending.".to_string(),
                ],
            )
        } else {
            (
                "ready_for_publish".to_string(),
                false,
                false,
                false,
                None,
                vec![
                    "Delivery is ready for publish, but no notification was triggered yet."
                        .to_string(),
                ],
            )
        };

    ProviderPublishStateMachine {
        state,
        retry_attempt,
        max_retries,
        can_retry,
        requires_manual_confirmation,
        archive_complete,
        publish_complete,
        last_error,
        notes,
    }
}

pub fn build_publish_retry_policy(
    machine: &ProviderPublishStateMachine,
) -> ProviderPublishRetryPolicy {
    let base_delay_s = std::env::var("CSS_AUDIO_PROVIDER_PUBLISH_RETRY_BASE_DELAY_S")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(30);
    let next_retry_delay_s = if machine.can_retry {
        base_delay_s.saturating_mul((machine.retry_attempt as u64).saturating_add(1))
    } else {
        0
    };
    let reason = match machine.state.as_str() {
        "notification_failed" if machine.can_retry => {
            "notification failed; retry is allowed under current publish policy".to_string()
        }
        "notification_failed" => {
            "notification failed and retry budget is exhausted; manual recovery required"
                .to_string()
        }
        "awaiting_manual_confirmation" => {
            "publish flow is paused for manual confirmation".to_string()
        }
        "archived" => "archives are complete and publish flow is stable".to_string(),
        _ => "no automatic publish retry is needed".to_string(),
    };

    ProviderPublishRetryPolicy {
        state: machine.state.clone(),
        should_retry: machine.can_retry,
        next_retry_delay_s,
        retry_attempt: machine.retry_attempt,
        max_retries: machine.max_retries,
        reason,
    }
}

pub async fn execute_publish_state_machine(
    build_dir: &Path,
    machine: &ProviderPublishStateMachine,
    retry_policy: &ProviderPublishRetryPolicy,
) -> Result<ProviderPublishExecutorReport> {
    std::fs::create_dir_all(build_dir)?;
    let manual_ack = read_publish_ack_event(build_dir, "manual_confirmation");
    let archive_ack = read_publish_ack_event(build_dir, "archive_completed");

    if let Some(ack) = archive_ack {
        return Ok(ProviderPublishExecutorReport {
            executed: true,
            action: "ingest_archive_ack".to_string(),
            accepted: ack.accepted,
            state: if ack.accepted {
                "published".to_string()
            } else {
                machine.state.clone()
            },
            receipt_path: Some(
                build_dir
                    .join("audio_provider_publish_ack.archive_completed.json")
                    .to_string_lossy()
                    .to_string(),
            ),
            message: ack.message,
        });
    }

    if machine.requires_manual_confirmation {
        if let Some(ack) = manual_ack {
            return Ok(ProviderPublishExecutorReport {
                executed: true,
                action: "ingest_manual_confirmation".to_string(),
                accepted: ack.accepted,
                state: if ack.accepted {
                    "archived".to_string()
                } else {
                    "awaiting_manual_confirmation".to_string()
                },
                receipt_path: Some(
                    build_dir
                        .join("audio_provider_publish_ack.manual_confirmation.json")
                        .to_string_lossy()
                        .to_string(),
                ),
                message: ack.message,
            });
        }
        return Ok(ProviderPublishExecutorReport {
            executed: false,
            action: "await_manual_confirmation".to_string(),
            accepted: false,
            state: machine.state.clone(),
            receipt_path: None,
            message: "publish state machine is waiting for manual confirmation ack".to_string(),
        });
    }

    if retry_policy.should_retry {
        let receipt_path = build_dir.join("audio_provider_publish_retry_execution.json");
        let receipt = json!({
            "state": machine.state,
            "retry_attempt": retry_policy.retry_attempt,
            "next_retry_delay_s": retry_policy.next_retry_delay_s,
            "reason": retry_policy.reason,
        });
        std::fs::write(&receipt_path, serde_json::to_vec_pretty(&receipt)?)?;
        return Ok(ProviderPublishExecutorReport {
            executed: true,
            action: "schedule_retry".to_string(),
            accepted: true,
            state: "pending_notification".to_string(),
            receipt_path: Some(receipt_path.to_string_lossy().to_string()),
            message: format!(
                "publish retry scheduled with {}s delay",
                retry_policy.next_retry_delay_s
            ),
        });
    }

    Ok(ProviderPublishExecutorReport {
        executed: false,
        action: "noop".to_string(),
        accepted: machine.publish_complete,
        state: machine.state.clone(),
        receipt_path: None,
        message: "publish state machine had no executor action to run".to_string(),
    })
}

pub fn apply_publish_ack_and_reconcile(
    build_dir: &Path,
    ledger: &ProviderPublishLedger,
    machine: &ProviderPublishStateMachine,
    executor_report: &ProviderPublishExecutorReport,
) -> Result<ProviderPublishStateMachine> {
    let mut updated = machine.clone();
    updated.notes.push(executor_report.message.clone());
    if let Some(receipt) = &executor_report.receipt_path {
        updated.notes.push(format!("executor receipt: {receipt}"));
    }

    match executor_report.state.as_str() {
        "published" => {
            updated.state = "published".to_string();
            updated.publish_complete = true;
            updated.requires_manual_confirmation = false;
            updated.can_retry = false;
            updated.last_error = None;
        }
        "archived" => {
            updated.state = "archived".to_string();
            updated.publish_complete = false;
            updated.requires_manual_confirmation = false;
            updated.can_retry = false;
            updated.last_error = None;
        }
        "pending_notification" => {
            updated.state = "pending_notification".to_string();
            updated.can_retry = false;
            updated.last_error = None;
        }
        _ => {
            if !executor_report.accepted && executor_report.action == "ingest_manual_confirmation" {
                updated.state = "awaiting_manual_confirmation".to_string();
            } else if executor_report.action == "schedule_retry" {
                updated.state = "pending_notification".to_string();
            }
        }
    }

    let mut refreshed_ledger = ledger.clone();
    refreshed_ledger.latest_state = updated.state.clone();
    refreshed_ledger.ready_for_delivery = updated.state != "awaiting_assets";
    write_provider_publish_ledger(
        &build_dir.join("audio_provider_publish_ledger.json"),
        &refreshed_ledger,
    )?;
    Ok(updated)
}

pub async fn dispatch_downstream_delivery(
    build_dir: &Path,
    handoff: Option<&ProviderPublishHandoff>,
    machine: &ProviderPublishStateMachine,
    executor_report: &ProviderPublishExecutorReport,
) -> Result<ProviderDownstreamDeliveryReport> {
    std::fs::create_dir_all(build_dir)?;
    let Some(handoff) = handoff else {
        return Ok(ProviderDownstreamDeliveryReport {
            dispatched: false,
            backend: "gate".to_string(),
            target: String::new(),
            accepted: false,
            action: executor_report.action.clone(),
            receipt_path: None,
            message: "downstream delivery skipped because publish handoff is unavailable"
                .to_string(),
        });
    };
    let backend = std::env::var("CSS_AUDIO_PROVIDER_DOWNSTREAM_BACKEND")
        .unwrap_or_else(|_| "local".to_string())
        .trim()
        .to_ascii_lowercase();
    match backend.as_str() {
        "webhook" => {
            dispatch_downstream_delivery_webhook(build_dir, handoff, machine, executor_report).await
        }
        "command" | "cmd" => {
            dispatch_downstream_delivery_command(build_dir, handoff, machine, executor_report).await
        }
        "off" | "none" => Ok(ProviderDownstreamDeliveryReport {
            dispatched: false,
            backend,
            target: String::new(),
            accepted: false,
            action: executor_report.action.clone(),
            receipt_path: None,
            message: "downstream delivery backend disabled".to_string(),
        }),
        _ => dispatch_downstream_delivery_local(build_dir, handoff, machine, executor_report),
    }
}

pub fn sync_provider_receipt(
    build_dir: &Path,
    downstream: &ProviderDownstreamDeliveryReport,
) -> Result<ProviderReceiptSync> {
    std::fs::create_dir_all(build_dir)?;
    let candidates = [
        build_dir.join("audio_provider_downstream_receipt.json"),
        build_dir.join("audio_provider_downstream_webhook_dispatch.json"),
        build_dir.join("audio_provider_downstream_command_dispatch.json"),
        build_dir.join("audio_provider_downstream_delivery_queue.json"),
    ];
    for path in candidates {
        if !path.exists() {
            continue;
        }
        let raw = std::fs::read_to_string(&path)?;
        let parsed: Value = serde_json::from_str(&raw).unwrap_or(Value::Null);
        let job_id = parsed
            .get("job_id")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let publish_url = parsed
            .get("publish_url")
            .or_else(|| parsed.get("url"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        return Ok(ProviderReceiptSync {
            synced: true,
            backend: downstream.backend.clone(),
            job_id,
            publish_url,
            receipt_path: Some(path.to_string_lossy().to_string()),
            message: "downstream receipt synchronized into cssMV".to_string(),
        });
    }

    Ok(ProviderReceiptSync {
        synced: false,
        backend: downstream.backend.clone(),
        job_id: None,
        publish_url: None,
        receipt_path: downstream.receipt_path.clone(),
        message: "no downstream receipt payload was available to sync yet".to_string(),
    })
}

pub fn build_delivery_dashboard_feed(
    handoff: Option<&ProviderPublishHandoff>,
    machine: &ProviderPublishStateMachine,
    executor: &ProviderPublishExecutorReport,
    downstream: &ProviderDownstreamDeliveryReport,
    receipt_sync: &ProviderReceiptSync,
) -> ProviderDeliveryDashboardFeed {
    ProviderDeliveryDashboardFeed {
        state: machine.state.clone(),
        ready_for_delivery: handoff.map(|h| h.ready_for_delivery).unwrap_or(false),
        publish_complete: machine.publish_complete,
        backend: downstream.backend.clone(),
        latest_action: executor.action.clone(),
        job_id: receipt_sync.job_id.clone(),
        publish_url: receipt_sync.publish_url.clone(),
        export_root: handoff.map(|h| h.export_root.clone()),
        receipt_path: receipt_sync.receipt_path.clone(),
        notes: machine
            .notes
            .iter()
            .cloned()
            .chain(std::iter::once(downstream.message.clone()))
            .chain(std::iter::once(receipt_sync.message.clone()))
            .collect(),
    }
}

fn read_publish_ack_event(build_dir: &Path, ack_type: &str) -> Option<ProviderPublishAckEvent> {
    let path = build_dir.join(format!("audio_provider_publish_ack.{ack_type}.json"));
    std::fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<ProviderPublishAckEvent>(&raw).ok())
}

fn dispatch_downstream_delivery_local(
    build_dir: &Path,
    handoff: &ProviderPublishHandoff,
    machine: &ProviderPublishStateMachine,
    executor_report: &ProviderPublishExecutorReport,
) -> Result<ProviderDownstreamDeliveryReport> {
    let queue_path = build_dir.join("audio_provider_downstream_delivery_queue.json");
    let payload = json!({
        "handoff": handoff,
        "publish_state_machine": machine,
        "publish_executor_report": executor_report,
    });
    std::fs::write(&queue_path, serde_json::to_vec_pretty(&payload)?)?;
    Ok(ProviderDownstreamDeliveryReport {
        dispatched: true,
        backend: "local".to_string(),
        target: queue_path.to_string_lossy().to_string(),
        accepted: true,
        action: executor_report.action.clone(),
        receipt_path: Some(queue_path.to_string_lossy().to_string()),
        message: "downstream delivery payload queued locally".to_string(),
    })
}

async fn dispatch_downstream_delivery_webhook(
    build_dir: &Path,
    handoff: &ProviderPublishHandoff,
    machine: &ProviderPublishStateMachine,
    executor_report: &ProviderPublishExecutorReport,
) -> Result<ProviderDownstreamDeliveryReport> {
    let webhook_url = std::env::var("CSS_AUDIO_PROVIDER_DOWNSTREAM_WEBHOOK_URL").map_err(|_| {
        anyhow!("missing CSS_AUDIO_PROVIDER_DOWNSTREAM_WEBHOOK_URL for downstream webhook backend")
    })?;
    let client = reqwest::Client::new();
    let payload = json!({
        "handoff": handoff,
        "publish_state_machine": machine,
        "publish_executor_report": executor_report,
    });
    let response = client.post(&webhook_url).json(&payload).send().await?;
    if !response.status().is_success() {
        return Err(anyhow!(
            "downstream webhook dispatch failed: status={}",
            response.status()
        ));
    }
    let receipt_path = build_dir.join("audio_provider_downstream_webhook_dispatch.json");
    let receipt = json!({
        "backend": "webhook",
        "url": webhook_url,
        "status": response.status().as_u16(),
        "state": machine.state,
        "action": executor_report.action,
    });
    std::fs::write(&receipt_path, serde_json::to_vec_pretty(&receipt)?)?;
    Ok(ProviderDownstreamDeliveryReport {
        dispatched: true,
        backend: "webhook".to_string(),
        target: webhook_url,
        accepted: true,
        action: executor_report.action.clone(),
        receipt_path: Some(receipt_path.to_string_lossy().to_string()),
        message: "downstream delivery payload sent to webhook".to_string(),
    })
}

async fn dispatch_downstream_delivery_command(
    build_dir: &Path,
    handoff: &ProviderPublishHandoff,
    machine: &ProviderPublishStateMachine,
    executor_report: &ProviderPublishExecutorReport,
) -> Result<ProviderDownstreamDeliveryReport> {
    let command_line = std::env::var("CSS_AUDIO_PROVIDER_DOWNSTREAM_CMD").map_err(|_| {
        anyhow!("missing CSS_AUDIO_PROVIDER_DOWNSTREAM_CMD for downstream command backend")
    })?;
    let payload_path = build_dir.join("audio_provider_downstream_delivery_payload.json");
    let payload = json!({
        "handoff": handoff,
        "publish_state_machine": machine,
        "publish_executor_report": executor_report,
    });
    std::fs::write(&payload_path, serde_json::to_vec_pretty(&payload)?)?;
    let status = Command::new("sh")
        .arg("-lc")
        .arg(&command_line)
        .env(
            "CSS_AUDIO_PROVIDER_DOWNSTREAM_PAYLOAD_JSON",
            payload_path.to_string_lossy().to_string(),
        )
        .env("CSS_AUDIO_PROVIDER_DOWNSTREAM_STATE", machine.state.clone())
        .env(
            "CSS_AUDIO_PROVIDER_DOWNSTREAM_ACTION",
            executor_report.action.clone(),
        )
        .status()
        .await?;
    let receipt_path = build_dir.join("audio_provider_downstream_command_dispatch.json");
    let receipt = json!({
        "backend": "command",
        "cmdline": command_line,
        "status": status.code(),
        "success": status.success(),
    });
    std::fs::write(&receipt_path, serde_json::to_vec_pretty(&receipt)?)?;
    Ok(ProviderDownstreamDeliveryReport {
        dispatched: true,
        backend: "command".to_string(),
        target: command_line,
        accepted: status.success(),
        action: executor_report.action.clone(),
        receipt_path: Some(receipt_path.to_string_lossy().to_string()),
        message: if status.success() {
            "downstream delivery command executed".to_string()
        } else {
            "downstream delivery command failed".to_string()
        },
    })
}

fn package_assets(
    manifest: &ProviderDeliverablesManifest,
    asset_types: &[&str],
) -> Vec<ProviderPackageAssetRef> {
    manifest
        .assets
        .iter()
        .filter(|asset| asset_types.iter().any(|kind| asset.asset_type == *kind))
        .map(|asset| ProviderPackageAssetRef {
            asset_type: asset.asset_type.clone(),
            stem_name: asset.stem_name.clone(),
            relative_path: asset.relative_path.clone(),
            optional: asset.optional,
        })
        .collect()
}

fn combine_asset_refs(groups: &[Vec<ProviderPackageAssetRef>]) -> Vec<ProviderPackageAssetRef> {
    groups
        .iter()
        .flat_map(|group| group.iter().cloned())
        .collect()
}

fn sanitize_slug(input: &str) -> String {
    let mut out = String::new();
    let mut last_dash = false;
    for ch in input.chars() {
        let normalized = if ch.is_ascii_alphanumeric() {
            Some(ch.to_ascii_lowercase())
        } else if matches!(ch, ' ' | '_' | '-' | '/' | ':' | '.') {
            Some('-')
        } else {
            None
        };
        if let Some(ch) = normalized {
            if ch == '-' {
                if !last_dash && !out.is_empty() {
                    out.push(ch);
                }
                last_dash = true;
            } else {
                out.push(ch);
                last_dash = false;
            }
        }
    }
    out.trim_matches('-').to_string()
}

fn resolve_asset_source(run_dir: &Path, asset: &ProviderPackageAssetRef) -> Option<PathBuf> {
    let primary = run_dir.join(asset.relative_path.trim_start_matches("./"));
    if primary.exists() {
        return Some(primary);
    }

    match (asset.asset_type.as_str(), asset.stem_name.as_str()) {
        ("vocal_guide", "lead_vocal_guide") => {
            let fallback = run_dir.join("build/vocals.wav");
            fallback.exists().then_some(fallback)
        }
        ("mixdown_reference", "full_mix") => {
            let fallback = run_dir.join("build/music.wav");
            fallback.exists().then_some(fallback)
        }
        ("lyric_sheet", "lyrics_and_cues") => {
            let lyrics_json = run_dir.join("build/lyrics.json");
            if lyrics_json.exists() {
                let target = run_dir.join("build/rehearsal/lyrics_and_cues.txt");
                if let Some(parent) = target.parent() {
                    let _ = std::fs::create_dir_all(parent);
                }
                let body = build_lyrics_and_cues_text(&lyrics_json).ok()?;
                std::fs::write(&target, body).ok()?;
                Some(target)
            } else {
                None
            }
        }
        _ => None,
    }
}

fn build_lyrics_and_cues_text(lyrics_json: &Path) -> Result<String> {
    let raw = std::fs::read_to_string(lyrics_json)?;
    let parsed: Value = serde_json::from_str(&raw)?;
    let title = parsed
        .get("title")
        .and_then(|v| v.as_str())
        .unwrap_or("cssMV");
    let lines = parsed
        .get("lines")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();
    let mut out = vec![format!("Title: {title}"), "Lyrics & Cue Sheet".to_string()];
    for line in lines {
        let t = line.get("t").and_then(|v| v.as_f64()).unwrap_or(0.0);
        let text = line
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .trim();
        if !text.is_empty() {
            out.push(format!("[{:06.2}s] {text}", t));
        }
    }
    Ok(out.join("\n"))
}

fn default_export_name(asset: &ProviderPackageAssetRef) -> String {
    let extension = asset
        .relative_path
        .rsplit('.')
        .next()
        .filter(|ext| !ext.contains('/'))
        .unwrap_or("dat");
    format!("{}.{}", sanitize_slug(&asset.stem_name), extension)
}

fn hardlink_or_copy(src: &Path, dst: &Path) -> Result<String> {
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent)?;
    }
    match std::fs::hard_link(src, dst) {
        Ok(_) => Ok("hardlink".to_string()),
        Err(_) => {
            std::fs::copy(src, dst)?;
            Ok("copy".to_string())
        }
    }
}

fn create_zip_archive(source_dir: &Path, archive_path: &Path) -> Result<bool> {
    if let Some(parent) = archive_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let file_name = archive_path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| anyhow!("invalid archive path: {}", archive_path.display()))?;
    let status = StdCommand::new("zip")
        .arg("-rq")
        .arg(file_name)
        .arg(".")
        .current_dir(source_dir)
        .status();

    match status {
        Ok(status) if status.success() => {
            let generated = source_dir.join(file_name);
            if generated.exists() {
                if archive_path.exists() {
                    std::fs::remove_file(archive_path)?;
                }
                match std::fs::rename(&generated, archive_path) {
                    Ok(_) => {}
                    Err(_) => {
                        std::fs::copy(&generated, archive_path)?;
                        let _ = std::fs::remove_file(&generated);
                    }
                }
                Ok(true)
            } else {
                Ok(false)
            }
        }
        Ok(_) => Ok(false),
        Err(_) => Ok(false),
    }
}

fn matches_missing_role(item: &ProviderRenderQueueItem, missing: &ProviderMissingAsset) -> bool {
    match (missing.asset_type.as_str(), missing.stem_name.as_str()) {
        ("vocal_guide", "lead_vocal_guide") => item.stem_name == "lead",
        ("vocal_guide", "backing_vocal_guide") => item.stem_name == "choir",
        _ => false,
    }
}

fn default_handoff_target(missing: &ProviderMissingAsset) -> (String, Vec<String>) {
    match (missing.asset_type.as_str(), missing.stem_name.as_str()) {
        ("vocal_guide", "lead_vocal_guide") => {
            ("vocal-guide://lead".to_string(), vec!["lead".to_string()])
        }
        ("vocal_guide", "backing_vocal_guide") => (
            "vocal-guide://backing".to_string(),
            vec!["choir".to_string(), "support".to_string()],
        ),
        _ => (
            format!("stem://{}", sanitize_slug(&missing.stem_name)),
            vec![missing.stem_name.clone()],
        ),
    }
}

fn dispatch_render_handoff_local(
    build_dir: &Path,
    handoff: &ProviderRenderHandoff,
) -> Result<ProviderQueueDispatchReport> {
    let spool_path = build_dir.join("audio_provider_local_requeue.ndjson");
    let mut out = String::new();
    for item in &handoff.queue_items {
        out.push_str(&serde_json::to_string(item)?);
        out.push('\n');
    }
    std::fs::write(&spool_path, out)?;
    Ok(ProviderQueueDispatchReport {
        backend: "local".to_string(),
        target: spool_path.to_string_lossy().to_string(),
        enqueued_count: handoff.queue_items.len(),
        receipt_path: Some(spool_path.to_string_lossy().to_string()),
        accepted: true,
    })
}

fn dispatch_publish_handoff_local(
    build_dir: &Path,
    handoff: &ProviderPublishHandoff,
) -> Result<ProviderPublishNotificationReport> {
    let queue_path = build_dir.join("audio_provider_publish_handoff_queue.json");
    std::fs::write(&queue_path, serde_json::to_vec_pretty(handoff)?)?;
    Ok(ProviderPublishNotificationReport {
        triggered: true,
        backend: "local".to_string(),
        target: queue_path.to_string_lossy().to_string(),
        accepted: true,
        status: "queued".to_string(),
        publish_handoff_path: None,
        receipt_path: Some(queue_path.to_string_lossy().to_string()),
        message: "publish handoff queued to local delivery handoff file".to_string(),
    })
}

async fn dispatch_render_handoff_redis(
    build_dir: &Path,
    handoff: &ProviderRenderHandoff,
) -> Result<ProviderQueueDispatchReport> {
    let redis_url =
        std::env::var("CSS_REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1/".to_string());
    let redis_key = std::env::var("CSS_AUDIO_PROVIDER_REQUEUE_REDIS_KEY")
        .unwrap_or_else(|_| "cssmv_audio_requeue".to_string());
    let client = redis::Client::open(redis_url.as_str())?;
    let mut conn = client.get_async_connection().await?;
    for item in &handoff.queue_items {
        let payload = serde_json::to_string(item)?;
        let _: () = conn.rpush(&redis_key, payload).await?;
    }
    let receipt_path = build_dir.join("audio_provider_redis_dispatch.json");
    let receipt = json!({
        "backend": "redis",
        "key": redis_key,
        "count": handoff.queue_items.len()
    });
    std::fs::write(&receipt_path, serde_json::to_vec_pretty(&receipt)?)?;
    Ok(ProviderQueueDispatchReport {
        backend: "redis".to_string(),
        target: redis_key,
        enqueued_count: handoff.queue_items.len(),
        receipt_path: Some(receipt_path.to_string_lossy().to_string()),
        accepted: true,
    })
}

async fn dispatch_publish_handoff_webhook(
    build_dir: &Path,
    handoff: &ProviderPublishHandoff,
) -> Result<ProviderPublishNotificationReport> {
    let webhook_url = std::env::var("CSS_AUDIO_PROVIDER_PUBLISH_WEBHOOK_URL").map_err(|_| {
        anyhow!("missing CSS_AUDIO_PROVIDER_PUBLISH_WEBHOOK_URL for publish webhook backend")
    })?;
    let client = reqwest::Client::new();
    let response = client.post(&webhook_url).json(handoff).send().await?;
    if !response.status().is_success() {
        return Err(anyhow!(
            "publish webhook dispatch failed: status={}",
            response.status()
        ));
    }
    let receipt_path = build_dir.join("audio_provider_publish_webhook_dispatch.json");
    let receipt = json!({
        "backend": "webhook",
        "url": webhook_url,
        "status": response.status().as_u16(),
        "ready_for_delivery": handoff.ready_for_delivery,
    });
    std::fs::write(&receipt_path, serde_json::to_vec_pretty(&receipt)?)?;
    Ok(ProviderPublishNotificationReport {
        triggered: true,
        backend: "webhook".to_string(),
        target: webhook_url,
        accepted: true,
        status: "sent".to_string(),
        publish_handoff_path: None,
        receipt_path: Some(receipt_path.to_string_lossy().to_string()),
        message: "publish handoff sent to downstream webhook".to_string(),
    })
}

async fn dispatch_publish_handoff_command(
    build_dir: &Path,
    handoff: &ProviderPublishHandoff,
) -> Result<ProviderPublishNotificationReport> {
    let command_line = std::env::var("CSS_AUDIO_PROVIDER_PUBLISH_CMD").map_err(|_| {
        anyhow!("missing CSS_AUDIO_PROVIDER_PUBLISH_CMD for publish command backend")
    })?;
    let handoff_path = build_dir.join("audio_provider_publish_handoff.json");
    std::fs::write(&handoff_path, serde_json::to_vec_pretty(handoff)?)?;
    let status = Command::new("sh")
        .arg("-lc")
        .arg(&command_line)
        .env(
            "CSS_AUDIO_PROVIDER_PUBLISH_HANDOFF_JSON",
            handoff_path.to_string_lossy().to_string(),
        )
        .env("CSS_AUDIO_PROVIDER_PUBLISH_STATE", handoff.state.clone())
        .env(
            "CSS_AUDIO_PROVIDER_PUBLISH_READY",
            if handoff.ready_for_delivery { "1" } else { "0" },
        )
        .status()
        .await?;
    let receipt_path = build_dir.join("audio_provider_publish_command_dispatch.json");
    let receipt = json!({
        "backend": "command",
        "cmdline": command_line,
        "status": status.code(),
        "success": status.success(),
    });
    std::fs::write(&receipt_path, serde_json::to_vec_pretty(&receipt)?)?;
    Ok(ProviderPublishNotificationReport {
        triggered: true,
        backend: "command".to_string(),
        target: command_line,
        accepted: status.success(),
        status: if status.success() {
            "executed".to_string()
        } else {
            "failed".to_string()
        },
        publish_handoff_path: Some(handoff_path.to_string_lossy().to_string()),
        receipt_path: Some(receipt_path.to_string_lossy().to_string()),
        message: if status.success() {
            "publish handoff command executed".to_string()
        } else {
            "publish handoff command failed".to_string()
        },
    })
}

async fn dispatch_render_handoff_webhook(
    build_dir: &Path,
    handoff: &ProviderRenderHandoff,
) -> Result<ProviderQueueDispatchReport> {
    let webhook_url = std::env::var("CSS_AUDIO_PROVIDER_WEBHOOK_URL")
        .map_err(|_| anyhow!("missing CSS_AUDIO_PROVIDER_WEBHOOK_URL for webhook backend"))?;
    let client = reqwest::Client::new();
    let response = client.post(&webhook_url).json(handoff).send().await?;
    if !response.status().is_success() {
        return Err(anyhow!(
            "webhook dispatch failed: status={}",
            response.status()
        ));
    }
    let receipt_path = build_dir.join("audio_provider_webhook_dispatch.json");
    let receipt = json!({
        "backend": "webhook",
        "url": webhook_url,
        "status": response.status().as_u16(),
        "count": handoff.queue_items.len()
    });
    std::fs::write(&receipt_path, serde_json::to_vec_pretty(&receipt)?)?;
    Ok(ProviderQueueDispatchReport {
        backend: "webhook".to_string(),
        target: webhook_url,
        enqueued_count: handoff.queue_items.len(),
        receipt_path: Some(receipt_path.to_string_lossy().to_string()),
        accepted: true,
    })
}

fn collect_handoff_jobs_local(build_dir: &Path) -> Result<Vec<ProviderRenderHandoffItem>> {
    let spool_path = build_dir.join("audio_provider_local_requeue.ndjson");
    if !spool_path.exists() {
        return Ok(Vec::new());
    }
    let file = std::fs::File::open(&spool_path)?;
    let reader = BufReader::new(file);
    let mut jobs = Vec::new();
    for line in reader.lines() {
        let line = line?;
        if line.trim().is_empty() {
            continue;
        }
        jobs.push(serde_json::from_str::<ProviderRenderHandoffItem>(&line)?);
    }
    std::fs::write(&spool_path, "")?;
    Ok(jobs)
}

async fn collect_handoff_jobs_redis(redis_key: &str) -> Result<Vec<ProviderRenderHandoffItem>> {
    let redis_url =
        std::env::var("CSS_REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1/".to_string());
    let client = redis::Client::open(redis_url.as_str())?;
    let mut conn = client.get_async_connection().await?;
    let mut jobs = Vec::new();
    loop {
        let payload: Option<String> = conn.lpop(redis_key, None).await?;
        let Some(payload) = payload else {
            break;
        };
        if payload.trim().is_empty() {
            continue;
        }
        jobs.push(serde_json::from_str::<ProviderRenderHandoffItem>(&payload)?);
    }
    Ok(jobs)
}

async fn process_worker_job(
    run_dir: &Path,
    receipts_dir: &Path,
    backend: &str,
    job: &ProviderRenderHandoffItem,
) -> Result<ProviderWorkerJobStatus> {
    let expected_output = resolve_run_relative_path(run_dir, &job.expected_output_path);
    if let Some(parent) = expected_output.parent() {
        std::fs::create_dir_all(parent)?;
    }

    let mut state = "pending_external_render".to_string();
    let mut message = "job claimed by provider worker and waiting for renderer handoff".to_string();
    let mut receipt = json!({
        "request_id": job.request_id,
        "backend": backend,
        "render_target": job.render_target,
        "expected_output_path": expected_output.to_string_lossy().to_string(),
        "source_roles": job.source_roles,
        "state": state,
        "message": message,
    });

    if let Some(bin) = std::env::var("CSS_AUDIO_PROVIDER_JOB_WORKER_BIN")
        .ok()
        .filter(|v| !v.trim().is_empty())
    {
        let args = vec![
            "--request".to_string(),
            job.request_id.clone(),
            "--asset-type".to_string(),
            job.asset_type.clone(),
            "--stem-name".to_string(),
            job.stem_name.clone(),
            "--target".to_string(),
            job.render_target.clone(),
            "--out".to_string(),
            expected_output.to_string_lossy().to_string(),
            "--profile".to_string(),
            job.profile_name.clone(),
        ];
        let output = Command::new(&bin)
            .args(&args)
            .current_dir(run_dir)
            .output()
            .await?;
        if output.status.success() {
            if expected_output.exists() {
                state = "completed".to_string();
                message = "provider worker completed render and found expected output".to_string();
            } else {
                state = "submitted".to_string();
                message =
                    "provider worker submitted render job; awaiting asset writeback".to_string();
            }
        } else {
            state = "failed".to_string();
            message = format!(
                "provider worker command failed: {}",
                String::from_utf8_lossy(&output.stderr).trim()
            );
        }
        receipt["worker_bin"] = json!(bin);
        receipt["worker_args"] = json!(args);
    }

    receipt["state"] = json!(state);
    receipt["message"] = json!(message);
    let receipt_path = receipts_dir.join(format!("{}.json", sanitize_slug(&job.request_id)));
    std::fs::write(&receipt_path, serde_json::to_vec_pretty(&receipt)?)?;

    Ok(ProviderWorkerJobStatus {
        request_id: job.request_id.clone(),
        asset_type: job.asset_type.clone(),
        stem_name: job.stem_name.clone(),
        backend: backend.to_string(),
        state,
        render_target: job.render_target.clone(),
        expected_output_path: expected_output.to_string_lossy().to_string(),
        receipt_path: Some(receipt_path.to_string_lossy().to_string()),
        message,
    })
}

fn resolve_run_relative_path(run_dir: &Path, raw_path: &str) -> PathBuf {
    if raw_path.starts_with("./") {
        run_dir.join(raw_path.trim_start_matches("./"))
    } else {
        run_dir.join(raw_path)
    }
}

fn artifact_watch_roots(run_dir: &Path, layout: &ProviderPackageLayout) -> Vec<PathBuf> {
    let mut roots = vec![
        run_dir.join("build/stems"),
        run_dir.join("build/vocals"),
        run_dir.join("build/reference"),
        run_dir.join("build/rehearsal"),
    ];
    for bundle in &layout.bundles {
        let path = run_dir.join(bundle.relative_dir.trim_start_matches("./"));
        if !roots.iter().any(|existing| existing == &path) {
            roots.push(path);
        }
    }
    roots
}

fn scan_watch_roots(roots: &[PathBuf]) -> Result<Vec<String>> {
    let mut entries = Vec::new();
    for root in roots {
        collect_watch_entries(root, &mut entries)?;
    }
    entries.sort();
    Ok(entries)
}

fn collect_watch_entries(root: &Path, entries: &mut Vec<String>) -> Result<()> {
    if !root.exists() {
        entries.push(format!("missing:{}", root.to_string_lossy()));
        return Ok(());
    }
    if root.is_file() {
        let meta = std::fs::metadata(root)?;
        let modified = meta
            .modified()
            .ok()
            .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
            .map(|dur| dur.as_millis())
            .unwrap_or(0);
        entries.push(format!(
            "file:{}:{}:{}",
            root.to_string_lossy(),
            meta.len(),
            modified
        ));
        return Ok(());
    }

    for child in std::fs::read_dir(root)? {
        let child = child?;
        let path = child.path();
        if path.is_dir() {
            collect_watch_entries(&path, entries)?;
        } else {
            let meta = child.metadata()?;
            let modified = meta
                .modified()
                .ok()
                .and_then(|time| time.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|dur| dur.as_millis())
                .unwrap_or(0);
            entries.push(format!(
                "file:{}:{}:{}",
                path.to_string_lossy(),
                meta.len(),
                modified
            ));
        }
    }
    Ok(())
}

fn readiness_category(
    summary: &ProviderDeliverySummary,
    bundle: Option<&ProviderPackageBundle>,
    category: &str,
) -> ProviderReadinessCategory {
    let Some(bundle) = bundle else {
        return ProviderReadinessCategory {
            category: category.to_string(),
            required: 0,
            present: 0,
            ready: true,
        };
    };

    let required_assets = bundle
        .include_assets
        .iter()
        .filter(|asset| !asset.optional)
        .collect::<Vec<_>>();
    let required = required_assets.len();
    let present = required_assets
        .iter()
        .filter(|asset| {
            !summary.missing_assets.iter().any(|missing| {
                missing.asset_type == asset.asset_type && missing.stem_name == asset.stem_name
            })
        })
        .count();

    ProviderReadinessCategory {
        category: category.to_string(),
        required,
        present,
        ready: present >= required,
    }
}

fn select_section_template<'a>(
    templates: &'a [SectionTemplate],
    section_name: &str,
) -> &'a SectionTemplate {
    let lower = section_name.to_ascii_lowercase();
    templates
        .iter()
        .find(|template| lower.contains(&template.section_name))
        .or_else(|| {
            if lower.contains("pre-chorus") {
                templates
                    .iter()
                    .find(|template| template.section_name == "pre-chorus")
            } else if lower.contains("bridge") {
                templates
                    .iter()
                    .find(|template| template.section_name == "bridge")
            } else if lower.contains("chorus") || lower.contains("outro") {
                templates
                    .iter()
                    .find(|template| template.section_name == "chorus")
            } else if lower.contains("verse") {
                templates
                    .iter()
                    .find(|template| template.section_name == "verse")
            } else {
                templates
                    .iter()
                    .find(|template| template.section_name == "intro")
            }
        })
        .unwrap_or_else(|| templates.first().expect("templates not empty"))
}

fn execute_internal(build_dir: &Path, plan: &ProviderPlan) -> Result<ProviderExecution> {
    let payload_path = build_dir.join("audio_provider_internal.payload.json");
    let payload = json!({
        "provider": "internal",
        "mode": "fallback_renderer",
        "pack": plan.pack,
        "preset": plan.preset,
        "articulation": plan.articulation,
        "style_hint": plan.style_hint,
        "target_duration_s": plan.target_duration_s,
        "tempo_bpm": plan.tempo_bpm,
        "voicing_register": plan.voicing_register,
        "percussion_activity": plan.percussion_activity,
        "expression_cc_bias": plan.expression_cc_bias,
        "humanization": plan.humanization
    });
    std::fs::write(&payload_path, serde_json::to_vec_pretty(&payload)?)?;
    Ok(ProviderExecution {
        vendor: ProviderVendor::Internal,
        payload_path,
        midi_draft_path: None,
        phrase_map_path: None,
        stems_plan_path: None,
        render_queue_path: None,
        deliverables_manifest_path: None,
        export_policy_path: None,
        package_layout_path: None,
        delivery_metadata_path: None,
        archive_builder_path: None,
        render_handoff_path: None,
        render_bin: None,
        render_args: Vec::new(),
        render_cmdline: None,
        payload,
    })
}

pub async fn execute_render(
    cwd: &Path,
    out_wav: &Path,
    execution: &ProviderExecution,
) -> Result<bool> {
    if execution.render_bin.is_none() || execution.render_args.is_empty() {
        return Ok(false);
    }
    if !env_truthy("CSS_AUDIO_PROVIDER_EXECUTE") {
        return Ok(false);
    }
    let render_bin = resolve_render_bin(execution)?;
    let render_args = render_args_with_output(execution, out_wav);

    let out = Command::new(&render_bin)
        .args(&render_args)
        .current_dir(cwd)
        .output()
        .await?;
    if !out.status.success() {
        return Err(anyhow!(
            "audio provider render failed: vendor={}, status={:?}, stderr={}",
            execution.vendor_name(),
            out.status.code(),
            String::from_utf8_lossy(&out.stderr)
        ));
    }
    Ok(true)
}

fn resolve_render_bin(execution: &ProviderExecution) -> Result<String> {
    let vendor_key = execution.vendor_name().to_ascii_uppercase();
    if let Ok(bin) = std::env::var(format!("CSS_AUDIO_PROVIDER_{vendor_key}_BIN")) {
        if !bin.trim().is_empty() {
            return Ok(bin);
        }
    }
    if let Ok(bin) = std::env::var("CSS_AUDIO_PROVIDER_RENDER_BIN") {
        if !bin.trim().is_empty() {
            return Ok(bin);
        }
    }
    execution
        .render_bin
        .clone()
        .ok_or_else(|| anyhow!("missing render bin for vendor {}", execution.vendor_name()))
}

fn render_args_with_output(execution: &ProviderExecution, out_wav: &Path) -> Vec<String> {
    let mut args = execution.render_args.clone();
    if let Some(path) = &execution.midi_draft_path {
        args.push("--midi-draft".to_string());
        args.push(path.to_string_lossy().to_string());
    }
    if let Some(path) = &execution.phrase_map_path {
        args.push("--phrase-map".to_string());
        args.push(path.to_string_lossy().to_string());
    }
    if let Some(path) = &execution.stems_plan_path {
        args.push("--stems-plan".to_string());
        args.push(path.to_string_lossy().to_string());
    }
    if let Some(path) = &execution.render_queue_path {
        args.push("--render-queue".to_string());
        args.push(path.to_string_lossy().to_string());
    }
    if let Some(path) = &execution.deliverables_manifest_path {
        args.push("--deliverables-manifest".to_string());
        args.push(path.to_string_lossy().to_string());
    }
    if let Some(path) = &execution.export_policy_path {
        args.push("--export-policy".to_string());
        args.push(path.to_string_lossy().to_string());
    }
    if let Some(path) = &execution.package_layout_path {
        args.push("--package-layout".to_string());
        args.push(path.to_string_lossy().to_string());
    }
    if let Some(path) = &execution.delivery_metadata_path {
        args.push("--delivery-metadata".to_string());
        args.push(path.to_string_lossy().to_string());
    }
    if let Some(path) = &execution.archive_builder_path {
        args.push("--archive-builder".to_string());
        args.push(path.to_string_lossy().to_string());
    }
    args.push("--out".to_string());
    args.push(out_wav.to_string_lossy().to_string());
    args
}

fn env_truthy(name: &str) -> bool {
    std::env::var(name)
        .ok()
        .map(|v| {
            matches!(
                v.trim().to_ascii_lowercase().as_str(),
                "1" | "true" | "yes" | "on"
            )
        })
        .unwrap_or(false)
}

pub fn format_render_cmdline(bin: &str, args: &[String]) -> String {
    std::iter::once(bin.to_string())
        .chain(args.iter().cloned())
        .map(|part| shell_escape(&part))
        .collect::<Vec<_>>()
        .join(" ")
}

fn shell_escape(input: &str) -> String {
    if input.is_empty() {
        return "''".to_string();
    }
    if input
        .chars()
        .all(|ch| ch.is_ascii_alphanumeric() || matches!(ch, '_' | '-' | '/' | '.' | ':' | '='))
    {
        return input.to_string();
    }
    format!("'{}'", input.replace('\'', r"'\''"))
}

impl ProviderExecution {
    pub fn vendor_name(&self) -> &'static str {
        match self.vendor {
            ProviderVendor::Internal => "internal",
            ProviderVendor::Kontakt => "kontakt",
            ProviderVendor::Spitfire => "spitfire",
            ProviderVendor::Eastwest => "eastwest",
            ProviderVendor::Custom => "custom",
        }
    }
}

fn extract_pack_name(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return String::new();
    }
    if let Some((_, rest)) = trimmed.split_once("://") {
        return rest.trim_matches('/').to_string();
    }
    trimmed
        .split_whitespace()
        .next()
        .unwrap_or(trimmed)
        .trim_matches('/')
        .to_string()
}

fn infer_provider_preset(
    vendor: ProviderVendor,
    instrumentation: &str,
    ensemble_style: &str,
) -> String {
    let blob = format!("{instrumentation} {ensemble_style}").to_ascii_lowercase();
    if blob.contains("choir") {
        "choir".to_string()
    } else if blob.contains("guzheng") || blob.contains("pipa") || blob.contains("dizi") {
        "world-ensemble".to_string()
    } else if blob.contains("piano") {
        "grand-piano".to_string()
    } else if blob.contains("strings") || blob.contains("orchestra") {
        if vendor == ProviderVendor::Spitfire || vendor == ProviderVendor::Eastwest {
            "symphonic-strings".to_string()
        } else {
            "string-ensemble".to_string()
        }
    } else if blob.contains("synth") || blob.contains("analog") {
        "synth-stack".to_string()
    } else {
        "core".to_string()
    }
}

fn infer_provider_articulation(ensemble_style: &str, instrumentation: &str) -> String {
    let blob = format!("{ensemble_style} {instrumentation}").to_ascii_lowercase();
    if blob.contains("staccato") || blob.contains("pulse") {
        "staccato".to_string()
    } else if blob.contains("legato") || blob.contains("lyric") {
        "legato".to_string()
    } else if blob.contains("pizz") {
        "pizzicato".to_string()
    } else if blob.contains("choir") {
        "sustain".to_string()
    } else {
        "hybrid".to_string()
    }
}

fn collect_role_channels(cue_sheet: &ProviderCueSheet) -> Vec<ProviderMidiChannel> {
    let mut roles = Vec::new();
    for segment in &cue_sheet.cue_segments {
        for role in &segment.layer_roles {
            if !roles.iter().any(|existing| existing == role) {
                roles.push(role.clone());
            }
        }
    }
    roles
        .into_iter()
        .enumerate()
        .map(|(index, role)| ProviderMidiChannel {
            role,
            channel: midi_channel_for_index(index),
        })
        .collect()
}

fn build_provider_midi_segment(
    segment: &ProviderCueSegment,
    plan: &ProviderPlan,
    channels: &[ProviderMidiChannel],
    keys: &[KeyswitchBinding],
) -> ProviderMidiSegment {
    let events = midi_events_for_segment(segment, plan, channels, keys);
    let cc_lanes = cc_lanes_for_segment(segment, plan, channels);
    let automation_lanes = automation_lanes_for_segment(segment, plan, channels);
    let phrase_map = phrase_map_for_segment(segment, &events, channels, keys);

    ProviderMidiSegment {
        section_name: segment.template_name.clone(),
        start_sec: segment.start_sec,
        duration_sec: segment.duration_sec,
        bar_start: segment.bar_start,
        bar_end: segment.bar_end,
        events,
        cc_lanes,
        automation_lanes,
        phrase_map,
    }
}

fn build_stem_track(stem_name: &str, phrase_map: &ProviderPhraseMap) -> Option<ProviderStemTrack> {
    let parts = phrase_map
        .phrase_segments
        .iter()
        .flat_map(|segment| {
            segment
                .phrase_map
                .iter()
                .filter(move |phrase| stem_for_role(&phrase.role) == stem_name)
                .map(move |phrase| ProviderStemPart {
                    section_name: segment.section_name.clone(),
                    phrase_id: phrase.phrase_id.clone(),
                    role: phrase.role.clone(),
                    patch: phrase.patch.clone(),
                    articulation: phrase.articulation.clone(),
                    channel: phrase.channel,
                    bar_start: phrase.bar_start,
                    bar_end: phrase.bar_end,
                    start_sec: phrase.start_sec,
                    end_sec: phrase.end_sec,
                    note_count: phrase.note_count,
                })
        })
        .collect::<Vec<_>>();

    if parts.is_empty() {
        return None;
    }

    let mut roles = Vec::new();
    let mut patch_set = Vec::new();
    for part in &parts {
        if !roles.iter().any(|role| role == &part.role) {
            roles.push(part.role.clone());
        }
        if !patch_set.iter().any(|patch| patch == &part.patch) {
            patch_set.push(part.patch.clone());
        }
    }

    let bar_start = parts.iter().map(|part| part.bar_start).min().unwrap_or(1);
    let bar_end = parts
        .iter()
        .map(|part| part.bar_end)
        .max()
        .unwrap_or(bar_start);
    let start_sec = parts
        .iter()
        .map(|part| part.start_sec)
        .fold(f32::INFINITY, f32::min);
    let end_sec = parts
        .iter()
        .map(|part| part.end_sec)
        .fold(0.0_f32, f32::max);

    Some(ProviderStemTrack {
        stem_name: stem_name.to_string(),
        export_name: format!("{stem_name}.wav"),
        roles,
        patch_set,
        phrase_count: parts.len(),
        bar_start,
        bar_end,
        start_sec: if start_sec.is_finite() {
            start_sec
        } else {
            0.0
        },
        end_sec,
        parts,
    })
}

fn stem_for_role(role: &str) -> &'static str {
    match role {
        "lead" => "lead",
        "support" | "strings" | "strings-high" | "strings-low" | "woods" | "winds"
        | "low-support" | "pad" => "strings",
        "brass" => "brass",
        "perc" => "perc",
        "choir" => "choir",
        "bass" => "bass",
        _ => "lead",
    }
}

fn midi_channel_for_index(index: usize) -> u8 {
    let mut channel = (index as u8 % 15) + 1;
    if channel >= 10 {
        channel += 1;
    }
    channel
}

fn midi_events_for_segment(
    segment: &ProviderCueSegment,
    plan: &ProviderPlan,
    channels: &[ProviderMidiChannel],
    keys: &[KeyswitchBinding],
) -> Vec<ProviderMidiEvent> {
    let mut events = Vec::new();
    let slot_count = segment.chord_slots.len().max(1) as f32;
    let subdivision = if plan.percussion_activity >= 0.78 || segment.note_density >= 0.8 {
        3
    } else if plan.percussion_activity >= 0.45 || segment.note_density >= 0.55 {
        2
    } else {
        1
    };
    let slot_duration = (segment.duration_sec / slot_count).max(0.35);

    for (layer_index, role) in segment.layer_roles.iter().enumerate() {
        let channel = channels
            .iter()
            .find(|entry| entry.role == *role)
            .map(|entry| entry.channel)
            .unwrap_or(1);
        let patch = segment
            .asset_patches
            .get(layer_index)
            .cloned()
            .unwrap_or_default();
        let articulation = keys
            .iter()
            .find(|binding| {
                segment
                    .keyswitches
                    .iter()
                    .any(|ks| ks == &binding.keyswitch)
            })
            .map(|binding| binding.articulation.clone())
            .unwrap_or_else(|| "adaptive".to_string());

        if let Some(binding) = keys.iter().find(|binding| {
            segment
                .keyswitches
                .iter()
                .any(|ks| ks == &binding.keyswitch)
        }) {
            events.push(ProviderMidiEvent {
                event_type: "keyswitch".to_string(),
                time_sec: segment.start_sec.max(0.0),
                channel,
                note: binding.midi_note,
                velocity: 96,
                duration_sec: Some(0.12),
                role: role.clone(),
                patch: patch.clone(),
                articulation: binding.articulation.clone(),
            });
        }

        for (slot_index, chord_slot) in segment.chord_slots.iter().enumerate() {
            let slot_start = segment.start_sec + slot_duration * slot_index as f32;
            for pulse_index in 0..subdivision {
                let pulse_duration = (slot_duration / subdivision as f32).max(0.24);
                let base_start = slot_start + pulse_duration * pulse_index as f32;
                let note_start =
                    humanized_time(base_start, pulse_duration, plan, role, pulse_index);
                let velocity = velocity_for_event(
                    &segment.velocity_curve,
                    pulse_index,
                    subdivision,
                    plan,
                    role,
                );
                let note = midi_note_for_role(
                    role,
                    chord_slot,
                    layer_index,
                    pulse_index,
                    &plan.voicing_register,
                );
                let duration =
                    note_duration_for_role(role, pulse_duration, segment.note_density, plan);
                let role_name = role.clone();
                let patch_name = patch.clone();
                let articulation_name = articulation.clone();

                events.push(ProviderMidiEvent {
                    event_type: "note_on".to_string(),
                    time_sec: note_start,
                    channel,
                    note,
                    velocity,
                    duration_sec: Some(duration),
                    role: role_name.clone(),
                    patch: patch_name.clone(),
                    articulation: articulation_name.clone(),
                });
                events.push(ProviderMidiEvent {
                    event_type: "note_off".to_string(),
                    time_sec: (note_start + duration).min(segment.start_sec + segment.duration_sec),
                    channel,
                    note,
                    velocity: 0,
                    duration_sec: None,
                    role: role_name,
                    patch: patch_name,
                    articulation: articulation_name,
                });
            }
        }
    }

    events.sort_by(|a, b| a.time_sec.total_cmp(&b.time_sec));
    events
}

fn cc_lanes_for_segment(
    segment: &ProviderCueSegment,
    plan: &ProviderPlan,
    channels: &[ProviderMidiChannel],
) -> Vec<ProviderCcLane> {
    segment
        .layer_roles
        .iter()
        .map(|role| {
            let channel = channels
                .iter()
                .find(|entry| entry.role == *role)
                .map(|entry| entry.channel)
                .unwrap_or(1);
            let points = segment
                .velocity_curve
                .iter()
                .enumerate()
                .map(|(index, value)| ProviderMidiPoint {
                    time_sec: segment.start_sec
                        + segment.duration_sec
                            * (index as f32 / segment.velocity_curve.len().max(1) as f32),
                    value: expression_point_value(*value, channel, plan, role),
                })
                .collect::<Vec<_>>();
            ProviderCcLane {
                cc: expression_cc_number(plan),
                label: format!("expression-lane:{role}:ch{channel}"),
                points,
            }
        })
        .collect()
}

fn automation_lanes_for_segment(
    segment: &ProviderCueSegment,
    plan: &ProviderPlan,
    channels: &[ProviderMidiChannel],
) -> Vec<ProviderAutomationLane> {
    segment
        .layer_roles
        .iter()
        .flat_map(|role| {
            let channel = channels
                .iter()
                .find(|entry| entry.role == *role)
                .map(|entry| entry.channel)
                .unwrap_or(1);
            let expression_points = segment
                .velocity_curve
                .iter()
                .enumerate()
                .map(|(index, value)| ProviderMidiPoint {
                    time_sec: segment.start_sec
                        + segment.duration_sec
                            * (index as f32 / segment.velocity_curve.len().max(1) as f32),
                    value: expression_point_value(*value, channel, plan, role),
                })
                .collect::<Vec<_>>();
            let dynamics_points = segment
                .velocity_curve
                .iter()
                .enumerate()
                .map(|(index, value)| ProviderMidiPoint {
                    time_sec: segment.start_sec
                        + segment.duration_sec
                            * (index as f32 / segment.velocity_curve.len().max(1) as f32),
                    value: automation_dynamic_value(*value, channel, plan, role),
                })
                .collect::<Vec<_>>();
            vec![
                ProviderAutomationLane {
                    cc: expression_cc_number(plan),
                    label: format!("expression:{role}:ch{channel}"),
                    role: role.clone(),
                    curve_kind: automation_curve_kind(plan, role, "expression"),
                    points: expression_points,
                },
                ProviderAutomationLane {
                    cc: automation_dynamic_cc(plan),
                    label: format!("dynamic-shape:{role}:ch{channel}"),
                    role: role.clone(),
                    curve_kind: automation_curve_kind(plan, role, "dynamic"),
                    points: dynamics_points,
                },
            ]
        })
        .collect()
}

fn phrase_map_for_segment(
    segment: &ProviderCueSegment,
    events: &[ProviderMidiEvent],
    channels: &[ProviderMidiChannel],
    keys: &[KeyswitchBinding],
) -> Vec<ProviderPhraseBlock> {
    let slot_count = segment.chord_slots.len().max(1) as f32;
    let slot_duration = (segment.duration_sec / slot_count).max(0.35);
    let articulation = keys
        .iter()
        .find(|binding| {
            segment
                .keyswitches
                .iter()
                .any(|ks| ks == &binding.keyswitch)
        })
        .map(|binding| binding.articulation.clone())
        .unwrap_or_else(|| "adaptive".to_string());

    segment
        .layer_roles
        .iter()
        .enumerate()
        .flat_map(|(layer_index, role)| {
            let channel = channels
                .iter()
                .find(|entry| entry.role == *role)
                .map(|entry| entry.channel)
                .unwrap_or(1);
            let patch = segment
                .asset_patches
                .get(layer_index)
                .cloned()
                .unwrap_or_default();
            segment
                .chord_slots
                .iter()
                .enumerate()
                .map(|(slot_index, chord_slot)| {
                    let start_sec = segment.start_sec + slot_duration * slot_index as f32;
                    let end_sec =
                        (start_sec + slot_duration).min(segment.start_sec + segment.duration_sec);
                    let note_count = events
                        .iter()
                        .filter(|event| {
                            event.role == *role
                                && event.event_type == "note_on"
                                && event.time_sec >= start_sec
                                && event.time_sec < end_sec
                        })
                        .count();
                    ProviderPhraseBlock {
                        phrase_id: format!(
                            "{}-{}-{}",
                            segment.template_name,
                            role.replace(' ', "_"),
                            slot_index + 1
                        ),
                        role: role.clone(),
                        patch: patch.clone(),
                        articulation: articulation.clone(),
                        channel,
                        bar_start: segment.bar_start + slot_index as u32,
                        bar_end: (segment.bar_start + slot_index as u32).min(segment.bar_end),
                        start_sec,
                        end_sec,
                        note_count,
                        note_density: segment.note_density,
                        contour: segment.contour.clone(),
                        chord_slot: chord_slot.clone(),
                    }
                })
                .collect::<Vec<_>>()
        })
        .collect()
}

fn velocity_for_event(
    curve: &[u8],
    pulse_index: usize,
    subdivision: usize,
    plan: &ProviderPlan,
    role: &str,
) -> u8 {
    let source = curve
        .get(pulse_index.min(curve.len().saturating_sub(1)))
        .copied()
        .unwrap_or(72);
    let pulse_lift = if subdivision >= 3 && pulse_index == 0 {
        8
    } else {
        0
    };
    let percussion_lift = if role == "perc" {
        (plan.percussion_activity * 18.0).round() as u8
    } else {
        0
    };
    source
        .saturating_add(pulse_lift)
        .saturating_add(percussion_lift)
        .saturating_add_signed(humanize_velocity(plan, role, pulse_index))
        .clamp(1, 127)
}

fn midi_note_for_role(
    role: &str,
    chord_slot: &str,
    layer_index: usize,
    pulse_index: usize,
    voicing_register: &str,
) -> u8 {
    let base = match role {
        "bass" | "strings-low" | "low-support" => 40_i32,
        "perc" => 36_i32,
        "brass" => 55_i32,
        "woods" | "winds" => 67_i32,
        "choir" => 60_i32,
        "strings-high" => 72_i32,
        "lead" => 69_i32,
        _ => 60_i32 + (layer_index as i32 * 3),
    };
    let degree = roman_to_semitone(chord_slot);
    let movement = if role == "perc" {
        pulse_index as i32
    } else {
        0
    };
    (base + degree + movement + register_shift(voicing_register, role)).clamp(24, 96) as u8
}

fn note_duration_for_role(
    role: &str,
    pulse_duration: f32,
    density: f32,
    plan: &ProviderPlan,
) -> f32 {
    let sustain = if role.contains("perc") || role.contains("pizz") {
        0.35 + ((1.0 - plan.percussion_activity) * 0.12)
    } else if density >= 0.75 {
        0.68 + ((1.0 - plan.humanization) * 0.06)
    } else {
        0.82 + ((1.0 - plan.humanization) * 0.08)
    };
    (pulse_duration * sustain).max(0.18)
}

fn expression_cc_number(plan: &ProviderPlan) -> u8 {
    let lower = plan.expression_cc_bias.to_ascii_lowercase();
    if lower.contains("vibrato") {
        1
    } else if lower.contains("breath") || lower.contains("air") {
        2
    } else {
        11
    }
}

fn expression_point_value(value: u8, channel: u8, plan: &ProviderPlan, role: &str) -> u8 {
    let lower = plan.expression_cc_bias.to_ascii_lowercase();
    let base_lift = if lower.contains("swell") || lower.contains("lift") {
        12
    } else if lower.contains("restrained") || lower.contains("tight") {
        0
    } else {
        6
    };
    let role_lift = if role == "lead" || role == "choir" {
        6
    } else {
        0
    };
    value
        .saturating_add(channel.min(8))
        .saturating_add(base_lift)
        .saturating_add(role_lift)
        .clamp(1, 127)
}

fn automation_dynamic_cc(plan: &ProviderPlan) -> u8 {
    let lower = plan.expression_cc_bias.to_ascii_lowercase();
    if lower.contains("vibrato") {
        21
    } else if lower.contains("breath") || lower.contains("air") {
        2
    } else {
        1
    }
}

fn automation_dynamic_value(value: u8, channel: u8, plan: &ProviderPlan, role: &str) -> u8 {
    let role_lift = if role == "brass" || role == "perc" {
        10
    } else if role == "lead" || role == "choir" {
        6
    } else {
        2
    };
    value
        .saturating_add(role_lift)
        .saturating_add(channel.min(6))
        .saturating_add((plan.humanization * 6.0).round() as u8)
        .clamp(1, 127)
}

fn automation_curve_kind(plan: &ProviderPlan, role: &str, lane_kind: &str) -> String {
    let lower = plan.expression_cc_bias.to_ascii_lowercase();
    if lane_kind == "dynamic" && role == "perc" {
        return "accent-pulses".to_string();
    }
    if lower.contains("swell") || lower.contains("lift") {
        "swell".to_string()
    } else if lower.contains("breath") || lower.contains("air") {
        "breathing".to_string()
    } else if lower.contains("restrained") || lower.contains("tight") {
        "restrained".to_string()
    } else if lane_kind == "dynamic" {
        "macro-dynamics".to_string()
    } else {
        "phrase-expression".to_string()
    }
}

fn register_shift(voicing_register: &str, role: &str) -> i32 {
    let lower = voicing_register.to_ascii_lowercase();
    let global = if lower.contains("low") || lower.contains("deep") {
        -8
    } else if lower.contains("high") || lower.contains("bright") {
        7
    } else if lower.contains("mid") || lower.contains("center") {
        0
    } else {
        2
    };
    let role_bias = if role == "bass" || role == "strings-low" || role == "low-support" {
        -3
    } else if role == "lead" || role == "strings-high" {
        3
    } else {
        0
    };
    global + role_bias
}

fn humanized_time(
    base_start: f32,
    pulse_duration: f32,
    plan: &ProviderPlan,
    role: &str,
    pulse_index: usize,
) -> f32 {
    let seed = role
        .bytes()
        .fold(0u32, |acc, byte| {
            acc.wrapping_mul(31).wrapping_add(byte as u32)
        })
        .wrapping_add((pulse_index as u32) * 17);
    let normalized = ((seed % 21) as f32 - 10.0) / 10.0;
    let max_shift = pulse_duration * 0.08 * plan.humanization;
    let percussion_push = if role == "perc" {
        -max_shift * 0.35
    } else {
        0.0
    };
    (base_start + normalized * max_shift + percussion_push).max(0.0)
}

fn humanize_velocity(plan: &ProviderPlan, role: &str, pulse_index: usize) -> i8 {
    let seed = role
        .bytes()
        .fold(0u32, |acc, byte| {
            acc.wrapping_mul(19).wrapping_add(byte as u32)
        })
        .wrapping_add((pulse_index as u32) * 11);
    let wobble = ((seed % 9) as i8) - 4;
    let scale = (plan.humanization * 2.8).round() as i8;
    wobble.saturating_mul(scale)
}

fn roman_to_semitone(slot: &str) -> i32 {
    match slot.to_ascii_uppercase().as_str() {
        "I" => 0,
        "IIB" => 1,
        "II" => 2,
        "IIIB" => 3,
        "III" => 4,
        "IV" => 5,
        "V" => 7,
        "VIB" => 8,
        "VI" => 9,
        "VIIB" => 10,
        "VII" => 11,
        _ => 0,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_provider_plan_from_unified_schema() {
        let commands = serde_json::json!({
            "creative": {
                "instrumentation": "low strings, choir, taiko",
                "ensemble_style": "cinematic orchestra legato",
                "licensed_style_pack": "spitfire/symphonic-core",
                "external_audio_adapter": "spitfire"
            }
        });

        let plan = plan_from_commands(&commands);

        assert_eq!(plan.vendor, ProviderVendor::Spitfire);
        assert_eq!(plan.pack, "spitfire/symphonic-core");
        assert_eq!(plan.preset, "choir");
        assert_eq!(plan.articulation, "legato");
        assert_eq!(plan.percussion_activity, 0.45);
    }

    #[test]
    fn executes_spitfire_stub_and_writes_payload() {
        let temp =
            std::env::temp_dir().join(format!("css_audio_provider_test_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).expect("create temp dir");
        let plan = ProviderPlan {
            vendor: ProviderVendor::Spitfire,
            pack: "spitfire/symphonic-core".to_string(),
            preset: "symphonic-strings".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "spitfire".to_string(),
            style_hint: "low strings | cinematic orchestra".to_string(),
            target_duration_s: 240,
            tempo_bpm: 92,
            voicing_register: "".to_string(),
            percussion_activity: 0.45,
            expression_cc_bias: "".to_string(),
            humanization: 0.35,
        };

        let execution = execute(&temp, &plan).expect("execute");

        assert_eq!(execution.vendor, ProviderVendor::Spitfire);
        assert!(execution.payload_path.exists());
        assert!(execution.render_cmdline.is_some());
        assert_eq!(execution.render_bin.as_deref(), Some("spitfire-render"));
        assert!(execution.render_args.iter().any(|arg| arg == "--library"));
    }

    #[test]
    fn maps_vendor_specific_preset_and_articulation() {
        let plan = ProviderPlan {
            vendor: ProviderVendor::Eastwest,
            pack: "eastwest/hollywood-orchestra".to_string(),
            preset: "symphonic-strings".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "eastwest".to_string(),
            style_hint: "cinematic orchestra legato".to_string(),
            target_duration_s: 300,
            tempo_bpm: 90,
            voicing_register: "".to_string(),
            percussion_activity: 0.45,
            expression_cc_bias: "".to_string(),
            humanization: 0.35,
        };

        assert_eq!(
            map_provider_preset(&plan),
            "Hollywood Strings::Expressive Legato"
        );
        assert_eq!(map_provider_articulation(&plan), "slur-legato");
        assert_eq!(provider_profile(&plan).profile_name, "eastwest-hollywood");
    }

    #[test]
    fn builds_library_catalog_and_section_templates() {
        let plan = ProviderPlan {
            vendor: ProviderVendor::Spitfire,
            pack: "spitfire/bbcso".to_string(),
            preset: "symphonic-strings".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "spitfire".to_string(),
            style_hint: "cinematic orchestra legato".to_string(),
            target_duration_s: 240,
            tempo_bpm: 84,
            voicing_register: "".to_string(),
            percussion_activity: 0.45,
            expression_cc_bias: "".to_string(),
            humanization: 0.35,
        };

        let catalog = library_catalog(&plan);
        let sections = section_templates(&plan);
        let keys = keyswitch_map(&plan);

        assert!(catalog.len() >= 3);
        assert!(sections
            .iter()
            .any(|section| section.section_name == "chorus"));
        assert!(keys
            .iter()
            .any(|binding| binding.articulation == "long-legato"));
    }

    #[test]
    fn builds_provider_ready_cue_sheet() {
        let plan = ProviderPlan {
            vendor: ProviderVendor::Kontakt,
            pack: "kontakt/session-strings".to_string(),
            preset: "string-ensemble".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "kontakt".to_string(),
            style_hint: "cinematic legato".to_string(),
            target_duration_s: 180,
            tempo_bpm: 92,
            voicing_register: "high lyrical lead".to_string(),
            percussion_activity: 0.25,
            expression_cc_bias: "swell".to_string(),
            humanization: 0.55,
        };
        let cue_sheet = build_provider_cue_sheet(
            &plan,
            &[
                CueSegment {
                    start_sec: 0.0,
                    duration_sec: 24.0,
                    section_name: "Verse 1".to_string(),
                    energy: "medium".to_string(),
                    contour: "flowing".to_string(),
                    articulation: "performance-legato".to_string(),
                    root_hz: 196.0,
                    bar_start: 1,
                    bar_end: 8,
                    chord_slots: vec![
                        "i".to_string(),
                        "VI".to_string(),
                        "III".to_string(),
                        "VII".to_string(),
                    ],
                    velocity_curve: vec![52, 58, 64, 70],
                    note_density: 0.42,
                },
                CueSegment {
                    start_sec: 24.0,
                    duration_sec: 20.0,
                    section_name: "Chorus 1".to_string(),
                    energy: "high".to_string(),
                    contour: "wide".to_string(),
                    articulation: "performance-legato".to_string(),
                    root_hz: 220.0,
                    bar_start: 9,
                    bar_end: 16,
                    chord_slots: vec![
                        "i".to_string(),
                        "VII".to_string(),
                        "VI".to_string(),
                        "VII".to_string(),
                    ],
                    velocity_curve: vec![72, 84, 96, 104],
                    note_density: 0.78,
                },
            ],
        );

        assert_eq!(cue_sheet.cue_segments.len(), 2);
        assert_eq!(cue_sheet.cue_segments[0].template_name, "verse");
        assert_eq!(cue_sheet.cue_segments[1].template_name, "chorus");
        assert!(!cue_sheet.cue_segments[1].asset_patches.is_empty());
        assert_eq!(cue_sheet.cue_segments[1].bar_start, 9);
        assert_eq!(cue_sheet.cue_segments[1].chord_slots.len(), 4);
    }

    #[test]
    fn builds_provider_midi_draft_from_cue_sheet() {
        let plan = ProviderPlan {
            vendor: ProviderVendor::Spitfire,
            pack: "spitfire/bbcso".to_string(),
            preset: "symphonic-strings".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "spitfire".to_string(),
            style_hint: "cinematic orchestra legato".to_string(),
            target_duration_s: 210,
            tempo_bpm: 96,
            voicing_register: "high lyrical lead".to_string(),
            percussion_activity: 0.8,
            expression_cc_bias: "swell into chorus".to_string(),
            humanization: 0.6,
        };
        let cue_sheet = build_provider_cue_sheet(
            &plan,
            &[CueSegment {
                start_sec: 0.0,
                duration_sec: 12.0,
                section_name: "Chorus 1".to_string(),
                energy: "high".to_string(),
                contour: "wide".to_string(),
                articulation: "long-legato".to_string(),
                root_hz: 220.0,
                bar_start: 1,
                bar_end: 4,
                chord_slots: vec![
                    "I".to_string(),
                    "V".to_string(),
                    "VI".to_string(),
                    "IV".to_string(),
                ],
                velocity_curve: vec![72, 88, 98, 108],
                note_density: 0.82,
            }],
        );

        let draft = build_provider_midi_draft(&plan, &cue_sheet);

        assert_eq!(draft.tempo_bpm, 96);
        assert!(!draft.channels.is_empty());
        assert_eq!(draft.segments.len(), 1);
        assert!(!draft.segments[0].phrase_map.is_empty());
        assert!(!draft.segments[0].automation_lanes.is_empty());
        assert!(draft.segments[0]
            .events
            .iter()
            .any(|event| event.event_type == "keyswitch"));
        assert!(draft.segments[0]
            .events
            .iter()
            .any(|event| event.event_type == "note_on"));
        assert!(draft.segments[0]
            .events
            .iter()
            .any(|event| event.event_type == "note_off"));
        assert!(draft.segments[0]
            .cc_lanes
            .iter()
            .any(|lane| lane.label.contains("expression-lane")));
        assert_eq!(draft.segments[0].cc_lanes[0].cc, 11);
        assert!(draft.segments[0]
            .events
            .iter()
            .any(|event| event.note >= 72));
        assert!(draft.segments[0]
            .automation_lanes
            .iter()
            .any(|lane| lane.curve_kind.contains("swell")));
    }

    #[test]
    fn builds_provider_phrase_map_from_midi_draft() {
        let plan = ProviderPlan {
            vendor: ProviderVendor::Kontakt,
            pack: "kontakt/session-strings".to_string(),
            preset: "string-ensemble".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "kontakt".to_string(),
            style_hint: "cinematic legato".to_string(),
            target_duration_s: 180,
            tempo_bpm: 90,
            voicing_register: "mid vocal pocket".to_string(),
            percussion_activity: 0.35,
            expression_cc_bias: "breathing verse".to_string(),
            humanization: 0.4,
        };
        let cue_sheet = build_provider_cue_sheet(
            &plan,
            &[CueSegment {
                start_sec: 0.0,
                duration_sec: 16.0,
                section_name: "Verse 1".to_string(),
                energy: "medium".to_string(),
                contour: "flowing".to_string(),
                articulation: "performance-legato".to_string(),
                root_hz: 196.0,
                bar_start: 1,
                bar_end: 4,
                chord_slots: vec![
                    "I".to_string(),
                    "V".to_string(),
                    "VI".to_string(),
                    "IV".to_string(),
                ],
                velocity_curve: vec![58, 66, 72, 78],
                note_density: 0.52,
            }],
        );

        let phrase_map = build_provider_phrase_map(&plan, &cue_sheet);

        assert_eq!(phrase_map.phrase_segments.len(), 1);
        assert!(phrase_map.phrase_segments[0]
            .phrase_map
            .iter()
            .any(|phrase| phrase.chord_slot == "I"));
        assert!(phrase_map.phrase_segments[0]
            .automation_lanes
            .iter()
            .any(|lane| lane.cc == 2));
    }

    #[test]
    fn builds_provider_arrangement_stems_plan() {
        let plan = ProviderPlan {
            vendor: ProviderVendor::Spitfire,
            pack: "spitfire/bbcso".to_string(),
            preset: "symphonic-strings".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "spitfire".to_string(),
            style_hint: "cinematic orchestra legato".to_string(),
            target_duration_s: 210,
            tempo_bpm: 96,
            voicing_register: "high lyrical lead".to_string(),
            percussion_activity: 0.75,
            expression_cc_bias: "swell into chorus".to_string(),
            humanization: 0.55,
        };
        let cue_sheet = build_provider_cue_sheet(
            &plan,
            &[
                CueSegment {
                    start_sec: 0.0,
                    duration_sec: 12.0,
                    section_name: "Verse 1".to_string(),
                    energy: "medium".to_string(),
                    contour: "flowing".to_string(),
                    articulation: "long-legato".to_string(),
                    root_hz: 196.0,
                    bar_start: 1,
                    bar_end: 4,
                    chord_slots: vec![
                        "I".to_string(),
                        "V".to_string(),
                        "VI".to_string(),
                        "IV".to_string(),
                    ],
                    velocity_curve: vec![62, 70, 78, 84],
                    note_density: 0.56,
                },
                CueSegment {
                    start_sec: 12.0,
                    duration_sec: 10.0,
                    section_name: "Chorus 1".to_string(),
                    energy: "high".to_string(),
                    contour: "wide".to_string(),
                    articulation: "long-legato".to_string(),
                    root_hz: 220.0,
                    bar_start: 5,
                    bar_end: 8,
                    chord_slots: vec![
                        "I".to_string(),
                        "V".to_string(),
                        "VI".to_string(),
                        "IV".to_string(),
                    ],
                    velocity_curve: vec![84, 94, 102, 110],
                    note_density: 0.82,
                },
            ],
        );

        let stems_plan = build_provider_arrangement_stems_plan(&plan, &cue_sheet);

        assert!(!stems_plan.stems.is_empty());
        assert!(stems_plan
            .stems
            .iter()
            .any(|stem| stem.stem_name == "strings"));
        assert!(stems_plan.stems.iter().any(|stem| stem.stem_name == "perc"));
        assert!(stems_plan
            .stems
            .iter()
            .find(|stem| stem.stem_name == "strings")
            .map(|stem| stem.phrase_count > 0 && !stem.patch_set.is_empty())
            .unwrap_or(false));
    }

    #[test]
    fn builds_provider_render_queue_and_deliverables_manifest() {
        let plan = ProviderPlan {
            vendor: ProviderVendor::Spitfire,
            pack: "spitfire/bbcso".to_string(),
            preset: "symphonic-strings".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "spitfire".to_string(),
            style_hint: "cinematic orchestra legato".to_string(),
            target_duration_s: 210,
            tempo_bpm: 96,
            voicing_register: "high lyrical lead".to_string(),
            percussion_activity: 0.75,
            expression_cc_bias: "swell into chorus".to_string(),
            humanization: 0.55,
        };
        let cue_sheet = build_provider_cue_sheet(
            &plan,
            &[CueSegment {
                start_sec: 0.0,
                duration_sec: 10.0,
                section_name: "Chorus 1".to_string(),
                energy: "high".to_string(),
                contour: "wide".to_string(),
                articulation: "long-legato".to_string(),
                root_hz: 220.0,
                bar_start: 1,
                bar_end: 4,
                chord_slots: vec![
                    "I".to_string(),
                    "V".to_string(),
                    "VI".to_string(),
                    "IV".to_string(),
                ],
                velocity_curve: vec![84, 94, 102, 110],
                note_density: 0.82,
            }],
        );

        let render_queue = build_provider_render_queue(&plan, &cue_sheet);
        let manifest = build_provider_deliverables_manifest(&plan, &cue_sheet);

        assert!(render_queue.preserve_stems);
        assert!(render_queue
            .queue_items
            .iter()
            .all(|item| item.preserve_isolated_stem));
        assert!(render_queue
            .queue_items
            .iter()
            .any(|item| item.stem_name == "strings"));
        assert!(manifest.preserve_stems);
        assert!(manifest.final_mix_optional);
        assert!(manifest
            .assets
            .iter()
            .any(|asset| asset.asset_type == "isolated_stem" && asset.stem_name == "perc"));
        assert!(manifest
            .assets
            .iter()
            .any(|asset| asset.asset_type == "mixdown_reference" && asset.optional));
        assert!(manifest.assets.iter().any(|asset| {
            asset.asset_type == "vocal_guide" && asset.stem_name == "lead_vocal_guide"
        }));
        assert!(manifest
            .assets
            .iter()
            .any(|asset| asset.asset_type == "lyric_sheet" && !asset.optional));
    }

    #[test]
    fn builds_export_policy_and_package_layout() {
        let plan = ProviderPlan {
            vendor: ProviderVendor::Eastwest,
            pack: "eastwest/hollywood-orchestra".to_string(),
            preset: "symphonic-strings".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "eastwest".to_string(),
            style_hint: "cinematic orchestra legato".to_string(),
            target_duration_s: 240,
            tempo_bpm: 92,
            voicing_register: "mid vocal pocket".to_string(),
            percussion_activity: 0.6,
            expression_cc_bias: "restrained verse".to_string(),
            humanization: 0.45,
        };
        let cue_sheet = build_provider_cue_sheet(
            &plan,
            &[
                CueSegment {
                    start_sec: 0.0,
                    duration_sec: 12.0,
                    section_name: "Verse 1".to_string(),
                    energy: "medium".to_string(),
                    contour: "narrative".to_string(),
                    articulation: "slur-legato".to_string(),
                    root_hz: 196.0,
                    bar_start: 1,
                    bar_end: 4,
                    chord_slots: vec![
                        "I".to_string(),
                        "V".to_string(),
                        "VI".to_string(),
                        "IV".to_string(),
                    ],
                    velocity_curve: vec![60, 68, 74, 80],
                    note_density: 0.52,
                },
                CueSegment {
                    start_sec: 12.0,
                    duration_sec: 10.0,
                    section_name: "Chorus 1".to_string(),
                    energy: "high".to_string(),
                    contour: "epic".to_string(),
                    articulation: "slur-legato".to_string(),
                    root_hz: 220.0,
                    bar_start: 5,
                    bar_end: 8,
                    chord_slots: vec![
                        "I".to_string(),
                        "V".to_string(),
                        "VI".to_string(),
                        "IV".to_string(),
                    ],
                    velocity_curve: vec![84, 94, 102, 110],
                    note_density: 0.82,
                },
            ],
        );

        let policy = build_provider_export_policy(&plan, &cue_sheet);
        let layout = build_provider_package_layout(&plan, &cue_sheet);

        assert!(policy.preserve_stems);
        assert!(policy.preserve_vocals);
        assert!(policy.final_mix_optional);
        assert!(policy.export_rules.iter().any(|rule| {
            rule.asset_type == "isolated_stem"
                && rule.package_name == "isolated_stems"
                && rule.keep_isolated
        }));
        assert!(policy.export_rules.iter().any(|rule| {
            rule.asset_type == "vocal_guide"
                && rule.package_name == "vocal_guides"
                && rule.relative_dir == "./exports/vocals"
        }));
        assert_eq!(layout.root_dir, "./exports");
        assert!(layout
            .bundles
            .iter()
            .any(|bundle| bundle.package_name == "rehearsal_pack"));
        assert!(layout
            .bundles
            .iter()
            .any(|bundle| bundle.package_name == "film_post_pack"));
        assert!(layout
            .bundles
            .iter()
            .find(|bundle| bundle.package_name == "rehearsal_pack")
            .map(|bundle| bundle.include_assets.iter().any(|asset| {
                asset.asset_type == "isolated_stem" || asset.asset_type == "vocal_guide"
            }))
            .unwrap_or(false));
        assert!(layout
            .bundles
            .iter()
            .find(|bundle| bundle.package_name == "film_post_pack")
            .map(|bundle| bundle.include_assets.iter().any(|asset| {
                asset.asset_type == "session_manifest" || asset.asset_type == "mixdown_reference"
            }))
            .unwrap_or(false));
    }

    #[test]
    fn builds_stem_naming_delivery_metadata_and_archive_builder() {
        let plan = ProviderPlan {
            vendor: ProviderVendor::Spitfire,
            pack: "spitfire/bbcso".to_string(),
            preset: "symphonic-strings".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "spitfire".to_string(),
            style_hint: "cinematic orchestra legato".to_string(),
            target_duration_s: 240,
            tempo_bpm: 90,
            voicing_register: "high lyrical lead".to_string(),
            percussion_activity: 0.7,
            expression_cc_bias: "swell".to_string(),
            humanization: 0.5,
        };
        let cue_sheet = build_provider_cue_sheet(
            &plan,
            &[CueSegment {
                start_sec: 0.0,
                duration_sec: 10.0,
                section_name: "Chorus 1".to_string(),
                energy: "high".to_string(),
                contour: "wide".to_string(),
                articulation: "long-legato".to_string(),
                root_hz: 220.0,
                bar_start: 1,
                bar_end: 4,
                chord_slots: vec![
                    "I".to_string(),
                    "V".to_string(),
                    "VI".to_string(),
                    "IV".to_string(),
                ],
                velocity_curve: vec![84, 94, 102, 110],
                note_density: 0.82,
            }],
        );

        let naming = build_provider_stem_naming_convention(&plan, &cue_sheet);
        let metadata = build_provider_delivery_metadata(&plan, &cue_sheet);
        let archive_builder = build_provider_archive_builder(&plan, &cue_sheet);

        assert!(!naming.song_slug.is_empty());
        assert!(naming.rules.iter().any(|rule| {
            rule.asset_type == "isolated_stem"
                && rule.resolved_filename.contains("__isolated_stem__")
                && rule.resolved_filename.ends_with(".wav")
        }));
        assert_eq!(metadata.sample_rate_hz, 48_000);
        assert_eq!(metadata.bit_depth, 24);
        assert_eq!(metadata.timecode_start, "01:00:00:00");
        assert!(metadata.include_bwf_timestamps);
        assert!(metadata
            .package_notes
            .iter()
            .any(|note| note.contains("Preserve isolated stems")));
        assert!(archive_builder
            .archive_items
            .iter()
            .any(|item| item.bundle_name == "rehearsal_pack"));
        assert!(archive_builder
            .archive_items
            .iter()
            .any(|item| item.bundle_name == "film_post_pack"));
        assert!(archive_builder
            .archive_items
            .iter()
            .all(|item| item.archive_path.ends_with(".zip")));
    }

    #[test]
    fn materializes_real_export_package_and_summary() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_packager_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(temp.join("build")).expect("create build dir");
        std::fs::write(temp.join("build/music.wav"), b"RIFFdemo-wave").expect("write music");
        std::fs::write(temp.join("build/vocals.wav"), b"RIFFdemo-vocal").expect("write vocals");
        std::fs::write(
            temp.join("build/lyrics.json"),
            serde_json::to_vec_pretty(&serde_json::json!({
                "title": "Packager Test",
                "lines": [
                    {"t": 0.0, "text": "First cue"},
                    {"t": 4.0, "text": "Second cue"}
                ]
            }))
            .expect("lyrics json"),
        )
        .expect("write lyrics");
        std::fs::write(
            temp.join("build/audio_provider_stems_plan.json"),
            b"{\"ok\":true}",
        )
        .expect("write stems json");
        std::fs::write(
            temp.join("build/audio_provider_render_queue.json"),
            b"{\"ok\":true}",
        )
        .expect("write render queue json");

        let plan = ProviderPlan {
            vendor: ProviderVendor::Kontakt,
            pack: "kontakt/session-strings".to_string(),
            preset: "string-ensemble".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "kontakt".to_string(),
            style_hint: "cinematic legato".to_string(),
            target_duration_s: 180,
            tempo_bpm: 90,
            voicing_register: "mid vocal pocket".to_string(),
            percussion_activity: 0.35,
            expression_cc_bias: "breathing verse".to_string(),
            humanization: 0.4,
        };
        let cue_sheet = build_provider_cue_sheet(
            &plan,
            &[CueSegment {
                start_sec: 0.0,
                duration_sec: 16.0,
                section_name: "Verse 1".to_string(),
                energy: "medium".to_string(),
                contour: "flowing".to_string(),
                articulation: "performance-legato".to_string(),
                root_hz: 196.0,
                bar_start: 1,
                bar_end: 4,
                chord_slots: vec![
                    "I".to_string(),
                    "V".to_string(),
                    "VI".to_string(),
                    "IV".to_string(),
                ],
                velocity_curve: vec![58, 66, 72, 78],
                note_density: 0.52,
            }],
        );
        let naming = build_provider_stem_naming_convention(&plan, &cue_sheet);
        let metadata = build_provider_delivery_metadata(&plan, &cue_sheet);
        let layout = build_provider_package_layout(&plan, &cue_sheet);
        let archive_builder = build_provider_archive_builder(&plan, &cue_sheet);
        let render_queue = build_provider_render_queue(&plan, &cue_sheet);

        let summary = materialize_export_package(
            &temp,
            &naming,
            &metadata,
            &layout,
            &archive_builder,
            &render_queue,
        )
        .expect("materialize export package");

        assert!(temp.join("exports/stems").exists());
        assert!(temp.join("exports/vocals").exists());
        assert!(!summary.exported_files.is_empty());
        assert!(summary
            .exported_files
            .iter()
            .any(|file| file.asset_type == "mixdown_reference"));
        assert!(summary
            .exported_files
            .iter()
            .any(|file| file.asset_type == "vocal_guide"));
        assert!(temp.join("build/rehearsal/lyrics_and_cues.txt").exists());
        assert!(summary
            .notes
            .iter()
            .any(|note| note.contains("Preserve isolated stems")));
        assert!(summary.handoff_request_path.is_some());
        assert!(temp
            .join("build/audio_provider_render_handoff.json")
            .exists());
    }

    #[test]
    fn builds_render_handoff_for_missing_assets() {
        let render_queue = ProviderRenderQueue {
            vendor: ProviderVendor::Spitfire,
            profile_name: "spitfire-film-score".to_string(),
            preserve_stems: true,
            queue_items: vec![
                ProviderRenderQueueItem {
                    item_id: "render-strings".to_string(),
                    stem_name: "strings".to_string(),
                    export_name: "strings.wav".to_string(),
                    profile_name: "spitfire-film-score".to_string(),
                    render_target: "stem://strings".to_string(),
                    source_phrases: vec!["phrase-1".to_string()],
                    source_roles: vec!["strings-high".to_string(), "strings-low".to_string()],
                    patch_set: vec!["BBCSO Strings::Long Legato".to_string()],
                    bar_start: 1,
                    bar_end: 8,
                    start_sec: 0.0,
                    end_sec: 16.0,
                    preserve_isolated_stem: true,
                },
                ProviderRenderQueueItem {
                    item_id: "render-lead".to_string(),
                    stem_name: "lead".to_string(),
                    export_name: "lead.wav".to_string(),
                    profile_name: "spitfire-film-score".to_string(),
                    render_target: "stem://lead".to_string(),
                    source_phrases: vec!["phrase-2".to_string()],
                    source_roles: vec!["lead".to_string()],
                    patch_set: vec!["BBCSO Strings::Core Ensemble".to_string()],
                    bar_start: 1,
                    bar_end: 8,
                    start_sec: 0.0,
                    end_sec: 16.0,
                    preserve_isolated_stem: true,
                },
            ],
        };
        let summary = ProviderDeliverySummary {
            vendor: ProviderVendor::Spitfire,
            profile_name: "spitfire-film-score".to_string(),
            export_root: "./exports".to_string(),
            exported_files: Vec::new(),
            missing_assets: vec![
                ProviderMissingAsset {
                    bundle_name: "isolated_stems".to_string(),
                    asset_type: "isolated_stem".to_string(),
                    stem_name: "strings".to_string(),
                    expected_path: "./build/stems/strings.wav".to_string(),
                },
                ProviderMissingAsset {
                    bundle_name: "vocal_guides".to_string(),
                    asset_type: "vocal_guide".to_string(),
                    stem_name: "lead_vocal_guide".to_string(),
                    expected_path: "./build/vocals/lead_vocal_guide.wav".to_string(),
                },
            ],
            archives: Vec::new(),
            handoff_request_path: None,
            notes: Vec::new(),
        };

        let handoff = build_provider_render_handoff(&render_queue, &summary);

        assert_eq!(handoff.queue_items.len(), 2);
        assert!(handoff.queue_items.iter().any(|item| {
            item.asset_type == "isolated_stem" && item.render_target == "stem://strings"
        }));
        assert!(handoff.queue_items.iter().any(|item| {
            item.asset_type == "vocal_guide"
                && item.stem_name == "lead_vocal_guide"
                && item.render_target == "stem://lead"
        }));
    }

    #[test]
    fn builds_requeue_execution_from_handoff() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_requeue_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).expect("create temp dir");

        let handoff = ProviderRenderHandoff {
            vendor: ProviderVendor::Kontakt,
            profile_name: "kontakt-studio-stack".to_string(),
            reason: "missing deliverable assets detected during export packaging".to_string(),
            queue_items: vec![ProviderRenderHandoffItem {
                request_id: "handoff-isolated-stem-strings".to_string(),
                bundle_name: "isolated_stems".to_string(),
                asset_type: "isolated_stem".to_string(),
                stem_name: "strings".to_string(),
                render_target: "stem://strings".to_string(),
                expected_output_path: "./build/stems/strings.wav".to_string(),
                source_roles: vec!["support".to_string()],
                profile_name: "kontakt-studio-stack".to_string(),
                priority: "high".to_string(),
            }],
        };

        std::env::set_var("CSS_AUDIO_PROVIDER_REQUEUE_BIN", "provider-requeue");
        let execution =
            build_provider_requeue_execution(&temp, &handoff).expect("build requeue execution");
        std::env::remove_var("CSS_AUDIO_PROVIDER_REQUEUE_BIN");

        assert_eq!(execution.queue_items.len(), 1);
        assert_eq!(execution.requeue_bin.as_deref(), Some("provider-requeue"));
        assert!(execution.requeue_args.iter().any(|arg| arg == "--handoff"));
        assert!(execution.requeue_cmdline.is_some());
        assert!(execution.queue_path.exists());
        assert!(execution.summary_path.exists());
    }

    #[tokio::test]
    async fn dispatches_render_handoff_to_local_queue_backend() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_dispatch_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).expect("create temp dir");

        let handoff = ProviderRenderHandoff {
            vendor: ProviderVendor::Kontakt,
            profile_name: "kontakt-studio-stack".to_string(),
            reason: "missing deliverable assets detected during export packaging".to_string(),
            queue_items: vec![ProviderRenderHandoffItem {
                request_id: "handoff-isolated-stem-strings".to_string(),
                bundle_name: "isolated_stems".to_string(),
                asset_type: "isolated_stem".to_string(),
                stem_name: "strings".to_string(),
                render_target: "stem://strings".to_string(),
                expected_output_path: "./build/stems/strings.wav".to_string(),
                source_roles: vec!["support".to_string()],
                profile_name: "kontakt-studio-stack".to_string(),
                priority: "high".to_string(),
            }],
        };

        std::env::set_var("CSS_AUDIO_PROVIDER_HANDOFF_BACKEND", "local");
        let report = dispatch_render_handoff(&temp, &handoff)
            .await
            .expect("dispatch to local");
        std::env::remove_var("CSS_AUDIO_PROVIDER_HANDOFF_BACKEND");

        assert_eq!(report.backend, "local");
        assert!(report.accepted);
        assert_eq!(report.enqueued_count, 1);
        assert!(temp.join("audio_provider_local_requeue.ndjson").exists());
    }

    #[tokio::test]
    async fn runs_job_worker_for_local_queue_and_writes_status() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_worker_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).expect("create temp dir");

        let handoff = ProviderRenderHandoff {
            vendor: ProviderVendor::Kontakt,
            profile_name: "kontakt-studio-stack".to_string(),
            reason: "missing deliverable assets detected during export packaging".to_string(),
            queue_items: vec![ProviderRenderHandoffItem {
                request_id: "handoff-isolated-stem-strings".to_string(),
                bundle_name: "isolated_stems".to_string(),
                asset_type: "isolated_stem".to_string(),
                stem_name: "strings".to_string(),
                render_target: "stem://strings".to_string(),
                expected_output_path: "./build/stems/strings.wav".to_string(),
                source_roles: vec!["support".to_string()],
                profile_name: "kontakt-studio-stack".to_string(),
                priority: "high".to_string(),
            }],
        };

        std::env::set_var("CSS_AUDIO_PROVIDER_HANDOFF_BACKEND", "local");
        let dispatch_report = dispatch_render_handoff(&temp, &handoff)
            .await
            .expect("dispatch to local");
        std::env::remove_var("CSS_AUDIO_PROVIDER_HANDOFF_BACKEND");

        let worker_report = run_job_worker(&temp, &handoff, &dispatch_report)
            .await
            .expect("run job worker");

        assert_eq!(worker_report.backend, "local");
        assert_eq!(worker_report.consumed_count, 1);
        assert_eq!(worker_report.pending_count, 1);
        assert!(temp.join("audio_provider_delivery_status.json").exists());
        let status_raw = std::fs::read_to_string(temp.join("audio_provider_delivery_status.json"))
            .expect("read delivery status");
        let status: ProviderDeliveryStatus =
            serde_json::from_str(&status_raw).expect("parse delivery status");
        assert_eq!(status.total_jobs, 1);
        assert_eq!(status.pending_jobs, 1);
        assert!(status.jobs.iter().any(|job| {
            job.request_id == "handoff-isolated-stem-strings"
                && job.state == "pending_external_render"
        }));
    }

    #[test]
    fn reconciles_delivery_after_worker_writeback() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_reconcile_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(temp.join("build")).expect("create build dir");
        std::fs::write(temp.join("build/music.wav"), b"RIFFdemo-wave").expect("write music");
        std::fs::write(temp.join("build/vocals.wav"), b"RIFFdemo-vocal").expect("write vocals");
        std::fs::write(
            temp.join("build/lyrics.json"),
            serde_json::to_vec_pretty(&serde_json::json!({
                "title": "Reconcile Test",
                "lines": [{"t": 0.0, "text": "Cue line"}]
            }))
            .expect("lyrics json"),
        )
        .expect("write lyrics");
        let plan = ProviderPlan {
            vendor: ProviderVendor::Kontakt,
            pack: "kontakt/session-strings".to_string(),
            preset: "string-ensemble".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "kontakt".to_string(),
            style_hint: "cinematic legato".to_string(),
            target_duration_s: 180,
            tempo_bpm: 90,
            voicing_register: "mid vocal pocket".to_string(),
            percussion_activity: 0.35,
            expression_cc_bias: "breathing verse".to_string(),
            humanization: 0.4,
        };
        let cue_sheet = build_provider_cue_sheet(
            &plan,
            &[CueSegment {
                start_sec: 0.0,
                duration_sec: 16.0,
                section_name: "Verse 1".to_string(),
                energy: "medium".to_string(),
                contour: "flowing".to_string(),
                articulation: "performance-legato".to_string(),
                root_hz: 196.0,
                bar_start: 1,
                bar_end: 4,
                chord_slots: vec![
                    "I".to_string(),
                    "V".to_string(),
                    "VI".to_string(),
                    "IV".to_string(),
                ],
                velocity_curve: vec![58, 66, 72, 78],
                note_density: 0.52,
            }],
        );
        let naming = build_provider_stem_naming_convention(&plan, &cue_sheet);
        let metadata = build_provider_delivery_metadata(&plan, &cue_sheet);
        let layout = build_provider_package_layout(&plan, &cue_sheet);
        let archive_builder = build_provider_archive_builder(&plan, &cue_sheet);
        let render_queue = build_provider_render_queue(&plan, &cue_sheet);
        let manifest = build_provider_deliverables_manifest(&plan, &cue_sheet);
        let isolated_asset = manifest
            .assets
            .iter()
            .find(|asset| asset.asset_type == "isolated_stem")
            .cloned()
            .expect("isolated stem asset");
        let isolated_output_path = temp.join(isolated_asset.relative_path.trim_start_matches("./"));
        if let Some(parent) = isolated_output_path.parent() {
            std::fs::create_dir_all(parent).expect("create isolated output parent");
        }
        std::fs::write(&isolated_output_path, b"RIFFdemo-isolated").expect("write isolated stem");

        let previous_summary = ProviderDeliverySummary {
            vendor: ProviderVendor::Kontakt,
            profile_name: layout.profile_name.clone(),
            export_root: temp.join("exports").to_string_lossy().to_string(),
            exported_files: Vec::new(),
            missing_assets: vec![ProviderMissingAsset {
                bundle_name: "isolated_stems".to_string(),
                asset_type: isolated_asset.asset_type.clone(),
                stem_name: isolated_asset.stem_name.clone(),
                expected_path: isolated_asset.relative_path.clone(),
            }],
            archives: Vec::new(),
            handoff_request_path: Some(
                temp.join("build/audio_provider_render_handoff.json")
                    .to_string_lossy()
                    .to_string(),
            ),
            notes: Vec::new(),
        };
        write_provider_delivery_summary(
            &temp.join("build/audio_provider_delivery_summary.json"),
            &previous_summary,
        )
        .expect("write previous summary");
        write_provider_delivery_status(
            &temp.join("build/audio_provider_delivery_status.json"),
            &ProviderDeliveryStatus {
                vendor: ProviderVendor::Kontakt,
                profile_name: layout.profile_name.clone(),
                backend: "local".to_string(),
                queue_target: temp
                    .join("build/audio_provider_local_requeue.ndjson")
                    .to_string_lossy()
                    .to_string(),
                total_jobs: 1,
                completed_jobs: 0,
                pending_jobs: 1,
                failed_jobs: 0,
                jobs: vec![ProviderWorkerJobStatus {
                    request_id: format!(
                        "handoff-{}-{}",
                        sanitize_slug(&isolated_asset.asset_type),
                        sanitize_slug(&isolated_asset.stem_name)
                    ),
                    asset_type: isolated_asset.asset_type.clone(),
                    stem_name: isolated_asset.stem_name.clone(),
                    backend: "local".to_string(),
                    state: "pending_external_render".to_string(),
                    render_target: format!("stem://{}", sanitize_slug(&isolated_asset.stem_name)),
                    expected_output_path: isolated_output_path.to_string_lossy().to_string(),
                    receipt_path: None,
                    message: "waiting".to_string(),
                }],
            },
        )
        .expect("write delivery status");

        let reconciliation = reconcile_delivery(
            &temp,
            &naming,
            &metadata,
            &layout,
            &archive_builder,
            &render_queue,
            &ProviderJobWorkerReport {
                backend: "local".to_string(),
                queue_target: temp
                    .join("build/audio_provider_local_requeue.ndjson")
                    .to_string_lossy()
                    .to_string(),
                consumed_count: 1,
                completed_count: 0,
                pending_count: 1,
                failed_count: 0,
                status_path: temp
                    .join("build/audio_provider_delivery_status.json")
                    .to_string_lossy()
                    .to_string(),
                receipt_dir: temp
                    .join("build/audio_provider_job_worker_receipts")
                    .to_string_lossy()
                    .to_string(),
            },
        )
        .expect("reconcile delivery");

        assert!(reconciliation.refreshed);
        assert_eq!(reconciliation.missing_before, 1);

        let refreshed_summary_raw =
            std::fs::read_to_string(temp.join("build/audio_provider_delivery_summary.json"))
                .expect("read refreshed summary");
        let refreshed_summary: ProviderDeliverySummary =
            serde_json::from_str(&refreshed_summary_raw).expect("parse refreshed summary");
        assert!(refreshed_summary.exported_files.iter().any(|file| {
            file.asset_type == isolated_asset.asset_type
                && file.stem_name == isolated_asset.stem_name
        }));
        assert!(!refreshed_summary.missing_assets.iter().any(|asset| {
            asset.asset_type == isolated_asset.asset_type
                && asset.stem_name == isolated_asset.stem_name
        }));

        let refreshed_status_raw =
            std::fs::read_to_string(temp.join("build/audio_provider_delivery_status.json"))
                .expect("read refreshed status");
        let refreshed_status: ProviderDeliveryStatus =
            serde_json::from_str(&refreshed_status_raw).expect("parse refreshed status");
        assert_eq!(refreshed_status.completed_jobs, 1);
        assert!(refreshed_status.jobs.iter().any(|job| {
            job.request_id
                == format!(
                    "handoff-{}-{}",
                    sanitize_slug(&isolated_asset.asset_type),
                    sanitize_slug(&isolated_asset.stem_name)
                )
                && job.state == "completed"
        }));
    }

    #[tokio::test]
    async fn watches_artifacts_and_triggers_reconciliation_on_new_file() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_watch_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(temp.join("build")).expect("create build dir");
        std::fs::write(temp.join("build/music.wav"), b"RIFFdemo-wave").expect("write music");
        std::fs::write(temp.join("build/vocals.wav"), b"RIFFdemo-vocal").expect("write vocals");
        std::fs::write(
            temp.join("build/lyrics.json"),
            serde_json::to_vec_pretty(&serde_json::json!({
                "title": "Watcher Test",
                "lines": [{"t": 0.0, "text": "Cue line"}]
            }))
            .expect("lyrics json"),
        )
        .expect("write lyrics");

        let plan = ProviderPlan {
            vendor: ProviderVendor::Kontakt,
            pack: "kontakt/session-strings".to_string(),
            preset: "string-ensemble".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "kontakt".to_string(),
            style_hint: "cinematic legato".to_string(),
            target_duration_s: 180,
            tempo_bpm: 90,
            voicing_register: "mid vocal pocket".to_string(),
            percussion_activity: 0.35,
            expression_cc_bias: "breathing verse".to_string(),
            humanization: 0.4,
        };
        let cue_sheet = build_provider_cue_sheet(
            &plan,
            &[CueSegment {
                start_sec: 0.0,
                duration_sec: 16.0,
                section_name: "Verse 1".to_string(),
                energy: "medium".to_string(),
                contour: "flowing".to_string(),
                articulation: "performance-legato".to_string(),
                root_hz: 196.0,
                bar_start: 1,
                bar_end: 4,
                chord_slots: vec![
                    "I".to_string(),
                    "V".to_string(),
                    "VI".to_string(),
                    "IV".to_string(),
                ],
                velocity_curve: vec![58, 66, 72, 78],
                note_density: 0.52,
            }],
        );
        let naming = build_provider_stem_naming_convention(&plan, &cue_sheet);
        let metadata = build_provider_delivery_metadata(&plan, &cue_sheet);
        let layout = build_provider_package_layout(&plan, &cue_sheet);
        let archive_builder = build_provider_archive_builder(&plan, &cue_sheet);
        let render_queue = build_provider_render_queue(&plan, &cue_sheet);
        let manifest = build_provider_deliverables_manifest(&plan, &cue_sheet);
        let isolated_asset = manifest
            .assets
            .iter()
            .find(|asset| asset.asset_type == "isolated_stem")
            .cloned()
            .expect("isolated stem asset");
        let isolated_output_path = temp.join(isolated_asset.relative_path.trim_start_matches("./"));

        write_provider_delivery_status(
            &temp.join("build/audio_provider_delivery_status.json"),
            &ProviderDeliveryStatus {
                vendor: ProviderVendor::Kontakt,
                profile_name: layout.profile_name.clone(),
                backend: "local".to_string(),
                queue_target: temp
                    .join("build/audio_provider_local_requeue.ndjson")
                    .to_string_lossy()
                    .to_string(),
                total_jobs: 1,
                completed_jobs: 0,
                pending_jobs: 1,
                failed_jobs: 0,
                jobs: vec![ProviderWorkerJobStatus {
                    request_id: format!(
                        "handoff-{}-{}",
                        sanitize_slug(&isolated_asset.asset_type),
                        sanitize_slug(&isolated_asset.stem_name)
                    ),
                    asset_type: isolated_asset.asset_type.clone(),
                    stem_name: isolated_asset.stem_name.clone(),
                    backend: "local".to_string(),
                    state: "pending_external_render".to_string(),
                    render_target: format!("stem://{}", sanitize_slug(&isolated_asset.stem_name)),
                    expected_output_path: isolated_output_path.to_string_lossy().to_string(),
                    receipt_path: None,
                    message: "waiting".to_string(),
                }],
            },
        )
        .expect("write delivery status");

        std::env::set_var("CSS_AUDIO_PROVIDER_ARTIFACT_WATCHER", "1");
        std::env::set_var("CSS_AUDIO_PROVIDER_ARTIFACT_WATCHER_POLL_MS", "25");
        std::env::set_var("CSS_AUDIO_PROVIDER_ARTIFACT_WATCHER_TIMEOUT_MS", "250");

        let delayed_output = isolated_output_path.clone();
        tokio::spawn(async move {
            tokio::time::sleep(tokio::time::Duration::from_millis(60)).await;
            if let Some(parent) = delayed_output.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            let _ = std::fs::write(&delayed_output, b"RIFFdemo-watch");
        });

        let report = watch_provider_artifacts(
            &temp,
            &naming,
            &metadata,
            &layout,
            &archive_builder,
            &render_queue,
            &ProviderJobWorkerReport {
                backend: "local".to_string(),
                queue_target: temp
                    .join("build/audio_provider_local_requeue.ndjson")
                    .to_string_lossy()
                    .to_string(),
                consumed_count: 1,
                completed_count: 0,
                pending_count: 1,
                failed_count: 0,
                status_path: temp
                    .join("build/audio_provider_delivery_status.json")
                    .to_string_lossy()
                    .to_string(),
                receipt_dir: temp
                    .join("build/audio_provider_job_worker_receipts")
                    .to_string_lossy()
                    .to_string(),
            },
        )
        .await
        .expect("watch artifacts");

        std::env::remove_var("CSS_AUDIO_PROVIDER_ARTIFACT_WATCHER");
        std::env::remove_var("CSS_AUDIO_PROVIDER_ARTIFACT_WATCHER_POLL_MS");
        std::env::remove_var("CSS_AUDIO_PROVIDER_ARTIFACT_WATCHER_TIMEOUT_MS");

        assert!(report.active);
        assert!(report.changes_detected >= 1);
        assert!(report.reconciliation_runs >= 1);
        assert!(report.last_reconciliation_path.is_some());
    }

    #[test]
    fn marks_delivery_ready_when_required_bundles_are_complete() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_ready_gate_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(temp.join("build")).expect("create build dir");

        let plan = ProviderPlan {
            vendor: ProviderVendor::Kontakt,
            pack: "kontakt/session-strings".to_string(),
            preset: "string-ensemble".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "kontakt".to_string(),
            style_hint: "cinematic legato".to_string(),
            target_duration_s: 180,
            tempo_bpm: 90,
            voicing_register: "mid vocal pocket".to_string(),
            percussion_activity: 0.35,
            expression_cc_bias: "breathing verse".to_string(),
            humanization: 0.4,
        };
        let cue_sheet = build_provider_cue_sheet(
            &plan,
            &[CueSegment {
                start_sec: 0.0,
                duration_sec: 16.0,
                section_name: "Verse 1".to_string(),
                energy: "medium".to_string(),
                contour: "flowing".to_string(),
                articulation: "performance-legato".to_string(),
                root_hz: 196.0,
                bar_start: 1,
                bar_end: 4,
                chord_slots: vec![
                    "I".to_string(),
                    "V".to_string(),
                    "VI".to_string(),
                    "IV".to_string(),
                ],
                velocity_curve: vec![58, 66, 72, 78],
                note_density: 0.52,
            }],
        );
        let layout = build_provider_package_layout(&plan, &cue_sheet);

        let summary = ProviderDeliverySummary {
            vendor: ProviderVendor::Kontakt,
            profile_name: layout.profile_name.clone(),
            export_root: temp.join("exports").to_string_lossy().to_string(),
            exported_files: Vec::new(),
            missing_assets: Vec::new(),
            archives: vec![
                ProviderArchiveOutput {
                    bundle_name: "rehearsal_pack".to_string(),
                    archive_path: temp
                        .join("exports/rehearsal_pack.zip")
                        .to_string_lossy()
                        .to_string(),
                    created: true,
                },
                ProviderArchiveOutput {
                    bundle_name: "film_post_pack".to_string(),
                    archive_path: temp
                        .join("exports/film_post_pack.zip")
                        .to_string_lossy()
                        .to_string(),
                    created: true,
                },
            ],
            handoff_request_path: None,
            notes: Vec::new(),
        };
        write_provider_delivery_summary(
            &temp.join("build/audio_provider_delivery_summary.json"),
            &summary,
        )
        .expect("write delivery summary");
        write_provider_delivery_status(
            &temp.join("build/audio_provider_delivery_status.json"),
            &ProviderDeliveryStatus {
                vendor: ProviderVendor::Kontakt,
                profile_name: layout.profile_name.clone(),
                backend: "local".to_string(),
                queue_target: "queue".to_string(),
                total_jobs: 1,
                completed_jobs: 1,
                pending_jobs: 0,
                failed_jobs: 0,
                jobs: vec![ProviderWorkerJobStatus {
                    request_id: "handoff-ready".to_string(),
                    asset_type: "isolated_stem".to_string(),
                    stem_name: "lead".to_string(),
                    backend: "local".to_string(),
                    state: "completed".to_string(),
                    render_target: "stem://lead".to_string(),
                    expected_output_path: "./build/stems/lead.wav".to_string(),
                    receipt_path: None,
                    message: "done".to_string(),
                }],
            },
        )
        .expect("write delivery status");

        let gate = apply_delivery_readiness_gate(&temp.join("build"), &layout)
            .expect("apply readiness gate");

        assert!(gate.ready_for_delivery);
        assert_eq!(gate.state, "ready_for_delivery");
        let refreshed_status_raw =
            std::fs::read_to_string(temp.join("build/audio_provider_delivery_status.json"))
                .expect("read refreshed status");
        let refreshed_status: ProviderDeliveryStatus =
            serde_json::from_str(&refreshed_status_raw).expect("parse refreshed status");
        assert!(refreshed_status
            .jobs
            .iter()
            .all(|job| job.state == "ready_for_delivery"));
    }

    #[test]
    fn builds_publish_handoff_from_ready_delivery_state() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_publish_handoff_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(temp.join("build")).expect("create build dir");

        let plan = ProviderPlan {
            vendor: ProviderVendor::Kontakt,
            pack: "kontakt/session-strings".to_string(),
            preset: "string-ensemble".to_string(),
            articulation: "legato".to_string(),
            adapter_uri: "kontakt".to_string(),
            style_hint: "cinematic legato".to_string(),
            target_duration_s: 180,
            tempo_bpm: 90,
            voicing_register: "mid vocal pocket".to_string(),
            percussion_activity: 0.35,
            expression_cc_bias: "breathing verse".to_string(),
            humanization: 0.4,
        };
        let cue_sheet = build_provider_cue_sheet(
            &plan,
            &[CueSegment {
                start_sec: 0.0,
                duration_sec: 16.0,
                section_name: "Verse 1".to_string(),
                energy: "medium".to_string(),
                contour: "flowing".to_string(),
                articulation: "performance-legato".to_string(),
                root_hz: 196.0,
                bar_start: 1,
                bar_end: 4,
                chord_slots: vec![
                    "I".to_string(),
                    "V".to_string(),
                    "VI".to_string(),
                    "IV".to_string(),
                ],
                velocity_curve: vec![58, 66, 72, 78],
                note_density: 0.52,
            }],
        );
        let layout = build_provider_package_layout(&plan, &cue_sheet);
        write_provider_package_layout(
            &temp.join("build/audio_provider_package_layout.json"),
            &layout,
        )
        .expect("write package layout");
        write_provider_delivery_summary(
            &temp.join("build/audio_provider_delivery_summary.json"),
            &ProviderDeliverySummary {
                vendor: ProviderVendor::Kontakt,
                profile_name: layout.profile_name.clone(),
                export_root: temp.join("exports").to_string_lossy().to_string(),
                exported_files: Vec::new(),
                missing_assets: Vec::new(),
                archives: vec![
                    ProviderArchiveOutput {
                        bundle_name: "rehearsal_pack".to_string(),
                        archive_path: temp
                            .join("exports/rehearsal_pack.zip")
                            .to_string_lossy()
                            .to_string(),
                        created: true,
                    },
                    ProviderArchiveOutput {
                        bundle_name: "film_post_pack".to_string(),
                        archive_path: temp
                            .join("exports/film_post_pack.zip")
                            .to_string_lossy()
                            .to_string(),
                        created: true,
                    },
                ],
                handoff_request_path: None,
                notes: vec!["everything exported".to_string()],
            },
        )
        .expect("write delivery summary");
        write_provider_delivery_status(
            &temp.join("build/audio_provider_delivery_status.json"),
            &ProviderDeliveryStatus {
                vendor: ProviderVendor::Kontakt,
                profile_name: layout.profile_name.clone(),
                backend: "local".to_string(),
                queue_target: "queue".to_string(),
                total_jobs: 1,
                completed_jobs: 1,
                pending_jobs: 0,
                failed_jobs: 0,
                jobs: vec![ProviderWorkerJobStatus {
                    request_id: "handoff-ready".to_string(),
                    asset_type: "isolated_stem".to_string(),
                    stem_name: "lead".to_string(),
                    backend: "local".to_string(),
                    state: "ready_for_delivery".to_string(),
                    render_target: "stem://lead".to_string(),
                    expected_output_path: "./build/stems/lead.wav".to_string(),
                    receipt_path: None,
                    message: "ready".to_string(),
                }],
            },
        )
        .expect("write delivery status");
        write_provider_delivery_readiness_gate(
            &temp.join("build/audio_provider_delivery_readiness_gate.json"),
            &ProviderDeliveryReadinessGate {
                state: "ready_for_delivery".to_string(),
                ready_for_delivery: true,
                required_ratio: 1.0,
                achieved_ratio: 1.0,
                categories: vec![
                    ProviderReadinessCategory {
                        category: "isolated_stems".to_string(),
                        required: 1,
                        present: 1,
                        ready: true,
                    },
                    ProviderReadinessCategory {
                        category: "vocal_guides".to_string(),
                        required: 1,
                        present: 1,
                        ready: true,
                    },
                    ProviderReadinessCategory {
                        category: "rehearsal_pack".to_string(),
                        required: 1,
                        present: 1,
                        ready: true,
                    },
                    ProviderReadinessCategory {
                        category: "film_post_pack".to_string(),
                        required: 1,
                        present: 1,
                        ready: true,
                    },
                ],
                notes: vec!["all bundles satisfied".to_string()],
            },
        )
        .expect("write readiness gate");

        let handoff =
            build_publish_handoff(&temp.join("build"), &layout).expect("build publish handoff");
        assert!(handoff.ready_for_delivery);
        assert_eq!(handoff.state, "ready_for_delivery");
        assert!(handoff
            .bundles
            .iter()
            .any(|bundle| bundle.package_name == "rehearsal_pack" && bundle.archive_created));
    }

    #[tokio::test]
    async fn dispatches_publish_handoff_to_local_queue() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_publish_dispatch_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).expect("create temp dir");

        let handoff = ProviderPublishHandoff {
            vendor: ProviderVendor::Kontakt,
            profile_name: "kontakt-studio-stack".to_string(),
            state: "ready_for_delivery".to_string(),
            ready_for_delivery: true,
            export_root: temp.join("exports").to_string_lossy().to_string(),
            delivery_summary_path: temp
                .join("build/audio_provider_delivery_summary.json")
                .to_string_lossy()
                .to_string(),
            delivery_status_path: temp
                .join("build/audio_provider_delivery_status.json")
                .to_string_lossy()
                .to_string(),
            package_layout_path: temp
                .join("build/audio_provider_package_layout.json")
                .to_string_lossy()
                .to_string(),
            readiness_gate_path: temp
                .join("build/audio_provider_delivery_readiness_gate.json")
                .to_string_lossy()
                .to_string(),
            bundles: vec![ProviderPublishBundle {
                package_name: "isolated_stems".to_string(),
                relative_dir: "./exports/stems".to_string(),
                package_format: "directory".to_string(),
                required_assets: 4,
                present_assets: 4,
                archive_path: None,
                archive_created: false,
            }],
            notes: vec!["delivery package is ready".to_string()],
        };

        std::env::set_var("CSS_AUDIO_PROVIDER_PUBLISH_BACKEND", "local");
        let report = dispatch_publish_handoff(&temp, &handoff)
            .await
            .expect("dispatch publish handoff");
        std::env::remove_var("CSS_AUDIO_PROVIDER_PUBLISH_BACKEND");

        assert!(report.triggered);
        assert_eq!(report.backend, "local");
        assert!(report.accepted);
        assert!(temp
            .join("audio_provider_publish_handoff_queue.json")
            .exists());
    }

    #[test]
    fn updates_publish_ledger_with_ready_delivery_entry() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_publish_ledger_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(temp.join("build")).expect("create build dir");

        let handoff = ProviderPublishHandoff {
            vendor: ProviderVendor::Kontakt,
            profile_name: "kontakt-studio-stack".to_string(),
            state: "ready_for_delivery".to_string(),
            ready_for_delivery: true,
            export_root: temp.join("exports").to_string_lossy().to_string(),
            delivery_summary_path: temp
                .join("build/audio_provider_delivery_summary.json")
                .to_string_lossy()
                .to_string(),
            delivery_status_path: temp
                .join("build/audio_provider_delivery_status.json")
                .to_string_lossy()
                .to_string(),
            package_layout_path: temp
                .join("build/audio_provider_package_layout.json")
                .to_string_lossy()
                .to_string(),
            readiness_gate_path: temp
                .join("build/audio_provider_delivery_readiness_gate.json")
                .to_string_lossy()
                .to_string(),
            bundles: vec![ProviderPublishBundle {
                package_name: "rehearsal_pack".to_string(),
                relative_dir: "./exports/rehearsal".to_string(),
                package_format: "zip".to_string(),
                required_assets: 2,
                present_assets: 2,
                archive_path: Some(
                    temp.join("exports/rehearsal_pack.zip")
                        .to_string_lossy()
                        .to_string(),
                ),
                archive_created: true,
            }],
            notes: vec!["ready snapshot".to_string()],
        };
        write_provider_delivery_summary(
            &temp.join("build/audio_provider_delivery_summary.json"),
            &ProviderDeliverySummary {
                vendor: ProviderVendor::Kontakt,
                profile_name: handoff.profile_name.clone(),
                export_root: handoff.export_root.clone(),
                exported_files: Vec::new(),
                missing_assets: Vec::new(),
                archives: vec![ProviderArchiveOutput {
                    bundle_name: "rehearsal_pack".to_string(),
                    archive_path: temp
                        .join("exports/rehearsal_pack.zip")
                        .to_string_lossy()
                        .to_string(),
                    created: true,
                }],
                handoff_request_path: None,
                notes: Vec::new(),
            },
        )
        .expect("write delivery summary");

        let report = ProviderPublishNotificationReport {
            triggered: true,
            backend: "local".to_string(),
            target: temp
                .join("build/audio_provider_publish_handoff_queue.json")
                .to_string_lossy()
                .to_string(),
            accepted: true,
            status: "queued".to_string(),
            publish_handoff_path: Some(
                temp.join("build/audio_provider_publish_handoff.json")
                    .to_string_lossy()
                    .to_string(),
            ),
            receipt_path: Some(
                temp.join("build/audio_provider_publish_handoff_queue.json")
                    .to_string_lossy()
                    .to_string(),
            ),
            message: "queued downstream".to_string(),
        };

        let ledger = update_publish_ledger(&temp.join("build"), Some(&handoff), &report)
            .expect("update publish ledger");
        assert!(ledger.ready_for_delivery);
        assert_eq!(ledger.latest_state, "ready_for_delivery");
        assert_eq!(ledger.entries.len(), 1);
        assert!(ledger.entries[0].triggered_notification);
        assert_eq!(ledger.entries[0].notification_status, "queued");
        assert!(temp
            .join("build/audio_provider_publish_ledger.json")
            .exists());
    }

    #[test]
    fn updates_publish_ledger_when_delivery_is_still_waiting() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_publish_ledger_waiting_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(temp.join("build")).expect("create build dir");

        let report = ProviderPublishNotificationReport {
            triggered: false,
            backend: "gate".to_string(),
            target: String::new(),
            accepted: false,
            status: "awaiting_assets".to_string(),
            publish_handoff_path: None,
            receipt_path: None,
            message: "publish handoff skipped because delivery is not ready yet".to_string(),
        };

        let ledger = update_publish_ledger(&temp.join("build"), None, &report)
            .expect("update publish ledger");
        assert!(!ledger.ready_for_delivery);
        assert_eq!(ledger.latest_state, "awaiting_assets");
        assert_eq!(ledger.entries.len(), 1);
        assert_eq!(ledger.entries[0].notification_backend, "gate");
    }

    #[test]
    fn enters_notification_failed_state_and_builds_retry_policy() {
        let ledger = ProviderPublishLedger {
            vendor: ProviderVendor::Kontakt,
            profile_name: "kontakt-studio-stack".to_string(),
            latest_state: "ready_for_delivery".to_string(),
            ready_for_delivery: true,
            entries: vec![ProviderPublishLedgerEntry {
                entry_id: "kontakt-ready-for-delivery-1".to_string(),
                state: "ready_for_delivery".to_string(),
                ready_for_delivery: true,
                triggered_notification: true,
                notification_backend: "webhook".to_string(),
                notification_status: "failed".to_string(),
                accepted: false,
                export_root: "./exports".to_string(),
                publish_handoff_path: Some(
                    "./build/audio_provider_publish_handoff.json".to_string(),
                ),
                notification_report_path: "./build/audio_provider_publish_notification_report.json"
                    .to_string(),
                archive_paths: vec!["./exports/rehearsal_pack.zip".to_string()],
                notes: vec!["notification failed".to_string()],
            }],
        };
        let handoff = ProviderPublishHandoff {
            vendor: ProviderVendor::Kontakt,
            profile_name: "kontakt-studio-stack".to_string(),
            state: "ready_for_delivery".to_string(),
            ready_for_delivery: true,
            export_root: "./exports".to_string(),
            delivery_summary_path: "./build/audio_provider_delivery_summary.json".to_string(),
            delivery_status_path: "./build/audio_provider_delivery_status.json".to_string(),
            package_layout_path: "./build/audio_provider_package_layout.json".to_string(),
            readiness_gate_path: "./build/audio_provider_delivery_readiness_gate.json".to_string(),
            bundles: vec![ProviderPublishBundle {
                package_name: "rehearsal_pack".to_string(),
                relative_dir: "./exports/rehearsal".to_string(),
                package_format: "zip".to_string(),
                required_assets: 2,
                present_assets: 2,
                archive_path: Some("./exports/rehearsal_pack.zip".to_string()),
                archive_created: true,
            }],
            notes: vec!["publish ready".to_string()],
        };
        let report = ProviderPublishNotificationReport {
            triggered: true,
            backend: "webhook".to_string(),
            target: "https://example.invalid/webhook".to_string(),
            accepted: false,
            status: "failed".to_string(),
            publish_handoff_path: Some("./build/audio_provider_publish_handoff.json".to_string()),
            receipt_path: Some("./build/audio_provider_publish_webhook_dispatch.json".to_string()),
            message: "downstream publish webhook failed".to_string(),
        };

        let machine = evaluate_publish_state_machine(&ledger, Some(&handoff), &report);
        let retry_policy = build_publish_retry_policy(&machine);

        assert_eq!(machine.state, "notification_failed");
        assert!(machine.can_retry);
        assert!(!machine.requires_manual_confirmation);
        assert!(retry_policy.should_retry);
        assert!(retry_policy.next_retry_delay_s > 0);
    }

    #[test]
    fn enters_manual_confirmation_state_when_policy_requires_it() {
        std::env::set_var("CSS_AUDIO_PROVIDER_PUBLISH_MANUAL_CONFIRM", "1");
        let ledger = ProviderPublishLedger {
            vendor: ProviderVendor::Kontakt,
            profile_name: "kontakt-studio-stack".to_string(),
            latest_state: "ready_for_delivery".to_string(),
            ready_for_delivery: true,
            entries: vec![ProviderPublishLedgerEntry {
                entry_id: "kontakt-ready-for-delivery-2".to_string(),
                state: "ready_for_delivery".to_string(),
                ready_for_delivery: true,
                triggered_notification: true,
                notification_backend: "local".to_string(),
                notification_status: "queued".to_string(),
                accepted: true,
                export_root: "./exports".to_string(),
                publish_handoff_path: Some(
                    "./build/audio_provider_publish_handoff.json".to_string(),
                ),
                notification_report_path: "./build/audio_provider_publish_notification_report.json"
                    .to_string(),
                archive_paths: vec![
                    "./exports/rehearsal_pack.zip".to_string(),
                    "./exports/film_post_pack.zip".to_string(),
                ],
                notes: vec!["queued".to_string()],
            }],
        };
        let handoff = ProviderPublishHandoff {
            vendor: ProviderVendor::Kontakt,
            profile_name: "kontakt-studio-stack".to_string(),
            state: "ready_for_delivery".to_string(),
            ready_for_delivery: true,
            export_root: "./exports".to_string(),
            delivery_summary_path: "./build/audio_provider_delivery_summary.json".to_string(),
            delivery_status_path: "./build/audio_provider_delivery_status.json".to_string(),
            package_layout_path: "./build/audio_provider_package_layout.json".to_string(),
            readiness_gate_path: "./build/audio_provider_delivery_readiness_gate.json".to_string(),
            bundles: vec![
                ProviderPublishBundle {
                    package_name: "rehearsal_pack".to_string(),
                    relative_dir: "./exports/rehearsal".to_string(),
                    package_format: "zip".to_string(),
                    required_assets: 2,
                    present_assets: 2,
                    archive_path: Some("./exports/rehearsal_pack.zip".to_string()),
                    archive_created: true,
                },
                ProviderPublishBundle {
                    package_name: "film_post_pack".to_string(),
                    relative_dir: "./exports/post".to_string(),
                    package_format: "zip".to_string(),
                    required_assets: 3,
                    present_assets: 3,
                    archive_path: Some("./exports/film_post_pack.zip".to_string()),
                    archive_created: true,
                },
            ],
            notes: vec!["awaiting manual signoff".to_string()],
        };
        let report = ProviderPublishNotificationReport {
            triggered: true,
            backend: "local".to_string(),
            target: "./build/audio_provider_publish_handoff_queue.json".to_string(),
            accepted: true,
            status: "queued".to_string(),
            publish_handoff_path: Some("./build/audio_provider_publish_handoff.json".to_string()),
            receipt_path: Some("./build/audio_provider_publish_handoff_queue.json".to_string()),
            message: "queued for manual review".to_string(),
        };

        let machine = evaluate_publish_state_machine(&ledger, Some(&handoff), &report);
        std::env::remove_var("CSS_AUDIO_PROVIDER_PUBLISH_MANUAL_CONFIRM");

        assert_eq!(machine.state, "awaiting_manual_confirmation");
        assert!(machine.requires_manual_confirmation);
        assert!(machine.archive_complete);
        assert!(!machine.publish_complete);
    }

    #[tokio::test]
    async fn executes_publish_retry_when_policy_allows_it() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_publish_retry_exec_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).expect("create build dir");

        let machine = ProviderPublishStateMachine {
            state: "notification_failed".to_string(),
            retry_attempt: 1,
            max_retries: 3,
            can_retry: true,
            requires_manual_confirmation: false,
            archive_complete: true,
            publish_complete: false,
            last_error: Some("network error".to_string()),
            notes: vec!["retry".to_string()],
        };
        let policy = ProviderPublishRetryPolicy {
            state: "notification_failed".to_string(),
            should_retry: true,
            next_retry_delay_s: 60,
            retry_attempt: 1,
            max_retries: 3,
            reason: "notification failed; retry is allowed".to_string(),
        };

        let report = execute_publish_state_machine(&temp, &machine, &policy)
            .await
            .expect("execute publish retry");
        assert!(report.executed);
        assert_eq!(report.action, "schedule_retry");
        assert_eq!(report.state, "pending_notification");
        assert!(temp
            .join("audio_provider_publish_retry_execution.json")
            .exists());
    }

    #[tokio::test]
    async fn ingests_manual_confirmation_ack_into_publish_state() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_publish_manual_ack_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).expect("create build dir");

        std::fs::write(
            temp.join("audio_provider_publish_ack.manual_confirmation.json"),
            serde_json::to_vec_pretty(&ProviderPublishAckEvent {
                ack_type: "manual_confirmation".to_string(),
                accepted: true,
                message: "producer approved delivery".to_string(),
            })
            .expect("ack json"),
        )
        .expect("write ack");

        let ledger = ProviderPublishLedger {
            vendor: ProviderVendor::Kontakt,
            profile_name: "kontakt-studio-stack".to_string(),
            latest_state: "awaiting_manual_confirmation".to_string(),
            ready_for_delivery: true,
            entries: Vec::new(),
        };
        let machine = ProviderPublishStateMachine {
            state: "awaiting_manual_confirmation".to_string(),
            retry_attempt: 0,
            max_retries: 3,
            can_retry: false,
            requires_manual_confirmation: true,
            archive_complete: true,
            publish_complete: false,
            last_error: None,
            notes: Vec::new(),
        };
        let policy = ProviderPublishRetryPolicy {
            state: "awaiting_manual_confirmation".to_string(),
            should_retry: false,
            next_retry_delay_s: 0,
            retry_attempt: 0,
            max_retries: 3,
            reason: "manual confirmation required".to_string(),
        };

        let executor = execute_publish_state_machine(&temp, &machine, &policy)
            .await
            .expect("execute publish state machine");
        let reconciled = apply_publish_ack_and_reconcile(&temp, &ledger, &machine, &executor)
            .expect("reconcile publish state");

        assert_eq!(executor.action, "ingest_manual_confirmation");
        assert_eq!(reconciled.state, "archived");
        assert!(!reconciled.requires_manual_confirmation);
    }

    #[tokio::test]
    async fn ingests_archive_completed_ack_into_published_state() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_publish_archive_ack_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).expect("create build dir");

        std::fs::write(
            temp.join("audio_provider_publish_ack.archive_completed.json"),
            serde_json::to_vec_pretty(&ProviderPublishAckEvent {
                ack_type: "archive_completed".to_string(),
                accepted: true,
                message: "archive delivered downstream".to_string(),
            })
            .expect("ack json"),
        )
        .expect("write ack");

        let ledger = ProviderPublishLedger {
            vendor: ProviderVendor::Kontakt,
            profile_name: "kontakt-studio-stack".to_string(),
            latest_state: "archived".to_string(),
            ready_for_delivery: true,
            entries: Vec::new(),
        };
        let machine = ProviderPublishStateMachine {
            state: "archived".to_string(),
            retry_attempt: 0,
            max_retries: 3,
            can_retry: false,
            requires_manual_confirmation: false,
            archive_complete: true,
            publish_complete: false,
            last_error: None,
            notes: Vec::new(),
        };
        let policy = ProviderPublishRetryPolicy {
            state: "archived".to_string(),
            should_retry: false,
            next_retry_delay_s: 0,
            retry_attempt: 0,
            max_retries: 3,
            reason: "archive complete".to_string(),
        };

        let executor = execute_publish_state_machine(&temp, &machine, &policy)
            .await
            .expect("execute publish state machine");
        let reconciled = apply_publish_ack_and_reconcile(&temp, &ledger, &machine, &executor)
            .expect("reconcile publish state");

        assert_eq!(executor.action, "ingest_archive_ack");
        assert_eq!(reconciled.state, "published");
        assert!(reconciled.publish_complete);
    }

    #[tokio::test]
    async fn dispatches_downstream_delivery_to_local_queue() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_downstream_dispatch_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).expect("create temp dir");

        let handoff = ProviderPublishHandoff {
            vendor: ProviderVendor::Kontakt,
            profile_name: "kontakt-studio-stack".to_string(),
            state: "ready_for_delivery".to_string(),
            ready_for_delivery: true,
            export_root: "./exports".to_string(),
            delivery_summary_path: "./build/audio_provider_delivery_summary.json".to_string(),
            delivery_status_path: "./build/audio_provider_delivery_status.json".to_string(),
            package_layout_path: "./build/audio_provider_package_layout.json".to_string(),
            readiness_gate_path: "./build/audio_provider_delivery_readiness_gate.json".to_string(),
            bundles: vec![ProviderPublishBundle {
                package_name: "rehearsal_pack".to_string(),
                relative_dir: "./exports/rehearsal".to_string(),
                package_format: "zip".to_string(),
                required_assets: 2,
                present_assets: 2,
                archive_path: Some("./exports/rehearsal_pack.zip".to_string()),
                archive_created: true,
            }],
            notes: vec!["dispatch".to_string()],
        };
        let machine = ProviderPublishStateMachine {
            state: "archived".to_string(),
            retry_attempt: 0,
            max_retries: 3,
            can_retry: false,
            requires_manual_confirmation: false,
            archive_complete: true,
            publish_complete: true,
            last_error: None,
            notes: vec!["downstream".to_string()],
        };
        let executor = ProviderPublishExecutorReport {
            executed: true,
            action: "ingest_archive_ack".to_string(),
            accepted: true,
            state: "published".to_string(),
            receipt_path: Some(
                "./build/audio_provider_publish_ack.archive_completed.json".to_string(),
            ),
            message: "archive delivered downstream".to_string(),
        };

        std::env::set_var("CSS_AUDIO_PROVIDER_DOWNSTREAM_BACKEND", "local");
        let report = dispatch_downstream_delivery(&temp, Some(&handoff), &machine, &executor)
            .await
            .expect("dispatch downstream delivery");
        std::env::remove_var("CSS_AUDIO_PROVIDER_DOWNSTREAM_BACKEND");

        assert!(report.dispatched);
        assert_eq!(report.backend, "local");
        assert!(report.accepted);
        assert!(temp
            .join("audio_provider_downstream_delivery_queue.json")
            .exists());
    }

    #[tokio::test]
    async fn skips_downstream_delivery_without_publish_handoff() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_downstream_skip_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).expect("create temp dir");

        let machine = ProviderPublishStateMachine {
            state: "awaiting_assets".to_string(),
            retry_attempt: 0,
            max_retries: 3,
            can_retry: false,
            requires_manual_confirmation: false,
            archive_complete: false,
            publish_complete: false,
            last_error: None,
            notes: Vec::new(),
        };
        let executor = ProviderPublishExecutorReport {
            executed: false,
            action: "noop".to_string(),
            accepted: false,
            state: "awaiting_assets".to_string(),
            receipt_path: None,
            message: "nothing to dispatch".to_string(),
        };

        let report = dispatch_downstream_delivery(&temp, None, &machine, &executor)
            .await
            .expect("skip downstream delivery");
        assert!(!report.dispatched);
        assert_eq!(report.backend, "gate");
    }

    #[test]
    fn syncs_provider_receipt_from_downstream_payload() {
        let temp = std::env::temp_dir().join(format!(
            "css_audio_provider_receipt_sync_test_{}",
            std::process::id()
        ));
        let _ = std::fs::remove_dir_all(&temp);
        std::fs::create_dir_all(&temp).expect("create temp dir");
        std::fs::write(
            temp.join("audio_provider_downstream_receipt.json"),
            serde_json::to_vec_pretty(&json!({
                "job_id": "publish-job-42",
                "publish_url": "https://example.invalid/releases/42"
            }))
            .expect("receipt json"),
        )
        .expect("write receipt");

        let sync = sync_provider_receipt(
            &temp,
            &ProviderDownstreamDeliveryReport {
                dispatched: true,
                backend: "webhook".to_string(),
                target: "https://example.invalid/webhook".to_string(),
                accepted: true,
                action: "ingest_archive_ack".to_string(),
                receipt_path: Some(
                    temp.join("audio_provider_downstream_receipt.json")
                        .to_string_lossy()
                        .to_string(),
                ),
                message: "sent".to_string(),
            },
        )
        .expect("sync receipt");

        assert!(sync.synced);
        assert_eq!(sync.job_id.as_deref(), Some("publish-job-42"));
        assert_eq!(
            sync.publish_url.as_deref(),
            Some("https://example.invalid/releases/42")
        );
    }

    #[test]
    fn builds_delivery_dashboard_feed_from_synced_receipt() {
        let handoff = ProviderPublishHandoff {
            vendor: ProviderVendor::Kontakt,
            profile_name: "kontakt-studio-stack".to_string(),
            state: "ready_for_delivery".to_string(),
            ready_for_delivery: true,
            export_root: "./exports".to_string(),
            delivery_summary_path: "./build/audio_provider_delivery_summary.json".to_string(),
            delivery_status_path: "./build/audio_provider_delivery_status.json".to_string(),
            package_layout_path: "./build/audio_provider_package_layout.json".to_string(),
            readiness_gate_path: "./build/audio_provider_delivery_readiness_gate.json".to_string(),
            bundles: Vec::new(),
            notes: vec!["dashboard".to_string()],
        };
        let machine = ProviderPublishStateMachine {
            state: "published".to_string(),
            retry_attempt: 0,
            max_retries: 3,
            can_retry: false,
            requires_manual_confirmation: false,
            archive_complete: true,
            publish_complete: true,
            last_error: None,
            notes: vec!["done".to_string()],
        };
        let executor = ProviderPublishExecutorReport {
            executed: true,
            action: "ingest_archive_ack".to_string(),
            accepted: true,
            state: "published".to_string(),
            receipt_path: Some(
                "./build/audio_provider_publish_ack.archive_completed.json".to_string(),
            ),
            message: "archive delivered".to_string(),
        };
        let downstream = ProviderDownstreamDeliveryReport {
            dispatched: true,
            backend: "webhook".to_string(),
            target: "https://example.invalid/webhook".to_string(),
            accepted: true,
            action: "ingest_archive_ack".to_string(),
            receipt_path: Some("./build/audio_provider_downstream_receipt.json".to_string()),
            message: "downstream synced".to_string(),
        };
        let receipt_sync = ProviderReceiptSync {
            synced: true,
            backend: "webhook".to_string(),
            job_id: Some("publish-job-42".to_string()),
            publish_url: Some("https://example.invalid/releases/42".to_string()),
            receipt_path: Some("./build/audio_provider_downstream_receipt.json".to_string()),
            message: "receipt synced".to_string(),
        };

        let feed = build_delivery_dashboard_feed(
            Some(&handoff),
            &machine,
            &executor,
            &downstream,
            &receipt_sync,
        );
        assert_eq!(feed.state, "published");
        assert!(feed.publish_complete);
        assert_eq!(feed.job_id.as_deref(), Some("publish-job-42"));
        assert_eq!(
            feed.publish_url.as_deref(),
            Some("https://example.invalid/releases/42")
        );
    }
}
