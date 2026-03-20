use crate::run_state::{RunState, StageStatus};
use crate::schema_keys::{
    is_video_assemble_stage, is_video_plan_stage, is_video_shot_stage, VIDEO_ASSEMBLE_STAGE,
    VIDEO_PLAN_STAGE,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashSet};
use std::path::Path;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadyView {
    pub topo_order: Vec<String>,
    pub ready: Vec<String>,
    pub running: Vec<String>,
    pub summary: ReadySummary,
    pub video_shots: VideoShotsSummary,
    #[serde(default)]
    pub lyrics: LyricsLangSummary,
    pub counters: ReadyCounters,
    pub running_pids: Vec<RunningPid>,
    pub mix: MixSummary,
    pub subtitles: SubtitlesSummary,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub immersion: Option<ImmersionSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub presence: Option<PresenceSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scene_semantics: Option<SceneSemanticsSummary>,
    pub blocking: Vec<BlockingItem>,
    pub stage_seq: u64,
    pub last_event: Option<ReadyEvent>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LyricsLangSummary {
    #[serde(default)]
    pub detected_lang: String,
    #[serde(default)]
    pub primary_lang: String,
    #[serde(default)]
    pub suggest_langs: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ReadyEvent {
    pub kind: crate::events::EventKind,
    pub stage: String,
    pub status: String,
    pub ts: String,
    pub meta: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct BlockingItem {
    pub stage: String,
    pub reason: Option<String>,
    pub blocked_by: Option<String>,
    pub chain: Vec<String>,
    pub bad_at: Option<String>,
    pub bad_kind: Option<BadKind>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum BadKind {
    Failed,
    Gate,
    Missing,
    Cancelled,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    StageEnd,
    GateFail,
    Cancelled,
    Timeout,
    Heartbeat,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct MixSummary {
    pub status: String,
    pub path: String,
    pub ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct SubtitlesSummary {
    pub status: String,
    pub path: String,
    pub burnin: bool,
    pub format: String,
    pub lang: String,
    pub ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct QualitySummary {
    pub ok: bool,
    pub passed: Vec<String>,
    pub failed: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub blocking_gate: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subtitles_audio_delta: Option<QualityDeltaMetrics>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subtitles_audio_delta_before_s: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subtitles_audio_delta_improved_s: Option<f64>,
    pub milestone_ready: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub versions: Option<crate::quality_versions::QualityVersionsView>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct QualityDeltaMetrics {
    pub delta_s: f64,
    pub max_delta_s: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct QualityScore {
    pub score: u32,
    pub max: u32,
    pub breakdown: BTreeMap<String, u32>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub components: BTreeMap<String, QualityComponentScore>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct QualityComponentScore {
    pub score: u32,
    pub max: u32,
    pub passed: bool,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fail_codes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct QualityTrend {
    pub latest: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub previous: Option<u32>,
    pub delta: i32,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub series: Vec<u32>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub points: Vec<QualityTrendPoint>,
    #[serde(default, skip_serializing_if = "BTreeMap::is_empty")]
    pub component_latest: BTreeMap<String, u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct QualityTrendPoint {
    pub ts: String,
    pub score: u32,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subtitles_audio_delta_before_s: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subtitles_audio_delta_s: Option<f64>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subtitles_audio_delta_improved_s: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct BillingSummary {
    pub engine: String,
    pub version: String,
    pub total_price_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct ReadySummary {
    pub total: usize,
    pub pending: usize,
    pub running: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub skipped: usize,
    pub slowest: Vec<SlowStage>,
    #[serde(default)]
    pub slow_warn_s: u64,
    #[serde(default)]
    pub slowest_warn_seconds: u64,
    #[serde(default)]
    pub slowest_stuck_seconds: u64,
    #[serde(default)]
    pub quality: QualitySummary,
    #[serde(default)]
    pub quality_score: Option<QualityScore>,
    #[serde(default)]
    pub quality_trend: Option<QualityTrend>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub billing: Option<BillingSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub timeline: Option<crate::timeline::RunTimelineView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub production_view: Option<crate::production_view::ProductionView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub immersion: Option<ImmersionSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub presence: Option<PresenceSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub scene_semantics: Option<SceneSemanticsSummary>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub film_runtime: Option<ReadyFilmRuntimeView>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub quality_director: Option<crate::quality_director::types::QualityDirectorReport>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub release_gate: Option<crate::release_gate::types::ReleaseGateReport>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub market_package: Option<crate::market_package::validator::PackageValidationResult>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub css_commerce_manifest:
        Option<crate::css_commerce_manifest::validator::CommerceValidationResult>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub css_rights: Option<crate::css_rights_engine::validator::RightsValidationResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct ImmersionSummary {
    pub mode: String,
    pub presence_role: String,
    pub constraint_level: String,
    pub inside_story_world: bool,
    pub can_move_freely: bool,
    pub can_affect_story: bool,
    pub preserve_director_focus: bool,
    pub allow_story_influence: bool,
    #[serde(default)]
    pub active_zone_ids: Vec<String>,
    pub in_focus_zone: bool,
    pub in_trigger_zone: bool,
    pub in_restricted_zone: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct PresenceSummary {
    pub kind: String,
    pub perception: String,
    pub acknowledgement: String,
    pub can_be_addressed: bool,
    pub can_change_relationships: bool,
    pub can_be_remembered: bool,
    pub is_diegetic_entity: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_scene: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub perceived_by: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct SceneSemanticsSummary {
    pub scene_id: String,
    pub semantic: String,
    pub tension: String,
    pub mood: String,
    pub camera_hint: String,
    pub dialogue_tone_hint: String,
    pub preferred_immersion_constraint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct ReadyFilmRuntimeView {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_story_node: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub current_scene: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub camera_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub immersion_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub presence_kind: Option<String>,
    #[serde(default)]
    pub event_history_len: usize,
    #[serde(default)]
    pub replayable: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub event_count: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum SlowStageStatus {
    #[default]
    Running,
    Succeeded,
    Failed,
    Skipped,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct SlowStage {
    pub stage: String,
    pub wall_s: f64,
    pub status: SlowStageStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct VideoShotsSummary {
    pub total: usize,
    pub ready: usize,
    pub running: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub pending: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct RunningPid {
    pub stage: String,
    pub pid: Option<i32>,
    pub pgid: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct ReadyCounters {
    pub pending: u32,
    pub running: u32,
    pub succeeded: u32,
    pub failed: u32,
    pub skipped: u32,
    pub killed_cancelled: u32,
    pub killed_timeout: u32,
}

fn suggest_langs_for(detected: &str) -> Vec<String> {
    match detected {
        "zh" | "zh-cn" | "zh-tw" | "zh-CN" | "zh-TW" => vec!["en", "ja", "ko", "fr"],
        "ja" => vec!["zh", "en", "ko", "fr"],
        "ko" => vec!["zh", "en", "ja", "fr"],
        "fr" => vec!["en", "zh", "ja", "ko"],
        _ => vec!["zh", "ja", "ko", "fr"],
    }
    .into_iter()
    .map(|s| s.to_string())
    .collect()
}

fn build_immersion_summary(st: &RunState) -> ImmersionSummary {
    let pos = st
        .viewer_position
        .unwrap_or(crate::physics_engine::types::Vec3::new(0.0, 0.0, 0.0));
    let engine = crate::immersion_engine::runtime::ImmersionEngine::new(
        st.immersion.clone(),
        st.immersion_zones.clone(),
    );
    let snap = engine.snapshot_at(pos);

    ImmersionSummary {
        mode: serde_json::to_string(&st.immersion.mode)
            .unwrap_or_else(|_| "\"flat_screen\"".to_string())
            .trim_matches('"')
            .to_string(),
        presence_role: serde_json::to_string(&st.immersion.presence_role)
            .unwrap_or_else(|_| "\"invisible_observer\"".to_string())
            .trim_matches('"')
            .to_string(),
        constraint_level: serde_json::to_string(&st.immersion.constraint_level)
            .unwrap_or_else(|_| "\"strict\"".to_string())
            .trim_matches('"')
            .to_string(),
        inside_story_world: st.immersion.inside_story_world,
        can_move_freely: snap.allow_free_movement,
        can_affect_story: st.immersion.can_affect_story,
        preserve_director_focus: snap.preserve_director_focus,
        allow_story_influence: snap.allow_story_influence,
        active_zone_ids: snap.active_zone_ids,
        in_focus_zone: snap.in_focus_zone,
        in_trigger_zone: snap.in_trigger_zone,
        in_restricted_zone: snap.in_restricted_zone,
    }
}

fn build_presence_summary(st: &RunState) -> PresenceSummary {
    PresenceSummary {
        kind: serde_json::to_string(&st.presence.profile.kind)
            .unwrap_or_else(|_| "\"invisible_observer\"".to_string())
            .trim_matches('"')
            .to_string(),
        perception: serde_json::to_string(&st.presence.profile.perception)
            .unwrap_or_else(|_| "\"unnoticed\"".to_string())
            .trim_matches('"')
            .to_string(),
        acknowledgement: serde_json::to_string(&st.presence.profile.acknowledgement)
            .unwrap_or_else(|_| "\"none\"".to_string())
            .trim_matches('"')
            .to_string(),
        can_be_addressed: crate::presence_engine::policy::can_characters_address_viewer(
            &st.presence,
        ),
        can_change_relationships: crate::presence_engine::policy::can_affect_relationships(
            &st.presence,
        ),
        can_be_remembered: crate::presence_engine::policy::can_be_remembered(&st.presence),
        is_diegetic_entity: crate::presence_engine::policy::is_diegetic_entity(&st.presence),
        current_scene: st.presence.current_scene.clone(),
        perceived_by: st.presence.perceived_by.clone(),
    }
}

fn build_scene_semantics_summary(st: &RunState) -> Option<SceneSemanticsSummary> {
    let scene_id = st.presence.current_scene.as_deref().unwrap_or("unknown");
    let scene = st.scene_semantics.get(scene_id)?;
    let camera_hint = crate::scene_semantics_engine::rules::preferred_camera_mode(
        &scene.semantic,
        &scene.tension,
    );
    let preferred_constraint = crate::scene_semantics_engine::rules::preferred_immersion_constraint(
        &scene.semantic,
        &scene.tension,
    );

    Some(SceneSemanticsSummary {
        scene_id: scene.scene_id.clone(),
        semantic: serde_json::to_string(&scene.semantic)
            .unwrap_or_else(|_| "\"introduction\"".to_string())
            .trim_matches('"')
            .to_string(),
        tension: serde_json::to_string(&scene.tension)
            .unwrap_or_else(|_| "\"calm\"".to_string())
            .trim_matches('"')
            .to_string(),
        mood: serde_json::to_string(&scene.mood)
            .unwrap_or_else(|_| "\"warm\"".to_string())
            .trim_matches('"')
            .to_string(),
        camera_hint: serde_json::to_string(&camera_hint)
            .unwrap_or_else(|_| "\"cinematic\"".to_string())
            .trim_matches('"')
            .to_string(),
        dialogue_tone_hint: crate::scene_semantics_engine::rules::dialogue_tone_hint(
            &scene.mood,
            &scene.tension,
        )
        .to_string(),
        preferred_immersion_constraint: serde_json::to_string(&preferred_constraint)
            .unwrap_or_else(|_| "\"guided\"".to_string())
            .trim_matches('"')
            .to_string(),
    })
}

fn build_film_runtime_summary(st: &RunState) -> Option<ReadyFilmRuntimeView> {
    let enabled = st
        .commands
        .get("film_runtime")
        .and_then(|v| v.get("enabled"))
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    if !enabled {
        return None;
    }

    let snapshot = crate::run_store::load_film_runtime_snapshot(&st.run_id).ok();
    let manifest = crate::runtime_replay::storage::load_replay_manifest(&st.run_id).ok();

    Some(ReadyFilmRuntimeView {
        enabled,
        status: snapshot
            .as_ref()
            .map(|s| format!("{:?}", s.status).to_lowercase()),
        current_story_node: snapshot.as_ref().and_then(|s| s.current_story_node.clone()),
        current_scene: snapshot.as_ref().and_then(|s| s.current_scene.clone()),
        camera_mode: snapshot.as_ref().and_then(|s| s.camera_mode.clone()),
        immersion_mode: snapshot.as_ref().and_then(|s| s.immersion_mode.clone()),
        presence_kind: snapshot.as_ref().and_then(|s| s.presence_kind.clone()),
        event_history_len: snapshot
            .as_ref()
            .map(|s| s.event_history_len)
            .unwrap_or_default(),
        replayable: manifest.as_ref().map(|m| m.replayable).unwrap_or(false),
        event_count: manifest.as_ref().map(|m| m.total_events),
    })
}

fn build_market_package_summary(
    st: &RunState,
) -> Option<crate::market_package::validator::PackageValidationResult> {
    let title = st
        .commands
        .get("title")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| {
            st.commands
                .get("creative")
                .and_then(|v| v.get("title"))
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })
        .or_else(|| {
            st.commands
                .get("meta")
                .and_then(|v| v.get("title"))
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })
        .unwrap_or_else(|| format!("Run {}", st.run_id));

    crate::market_package::runtime::validate_market_package_for_run(&st.run_id, title).ok()
}

fn build_css_commerce_manifest_summary(
    st: &RunState,
) -> Option<crate::css_commerce_manifest::validator::CommerceValidationResult> {
    let title = st
        .commands
        .get("title")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| {
            st.commands
                .get("creative")
                .and_then(|v| v.get("title"))
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })
        .or_else(|| {
            st.commands
                .get("meta")
                .and_then(|v| v.get("title"))
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })
        .unwrap_or_else(|| format!("Run {}", st.run_id));

    crate::css_commerce_manifest::runtime::validate_css_commerce_manifest_for_run(&st.run_id, title)
        .ok()
}

fn build_css_rights_summary(
    st: &RunState,
) -> Option<crate::css_rights_engine::validator::RightsValidationResult> {
    let title = st
        .commands
        .get("title")
        .and_then(|v| v.as_str())
        .map(str::to_string)
        .or_else(|| {
            st.commands
                .get("creative")
                .and_then(|v| v.get("title"))
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })
        .or_else(|| {
            st.commands
                .get("meta")
                .and_then(|v| v.get("title"))
                .and_then(|v| v.as_str())
                .map(str::to_string)
        })
        .unwrap_or_else(|| format!("Run {}", st.run_id));

    let work_structure = crate::css_rights_engine::runtime::parse_work_structure(
        st.commands
            .get("css_commerce")
            .and_then(|v| v.get("work_structure"))
            .and_then(|v| v.as_str())
            .or_else(|| {
                st.commands
                    .get("creative")
                    .and_then(|v| v.get("work_structure"))
                    .and_then(|v| v.as_str())
            })
            .or_else(|| {
                st.commands
                    .get("meta")
                    .and_then(|v| v.get("work_structure"))
                    .and_then(|v| v.as_str())
            }),
    );

    crate::css_rights_engine::runtime::validate_rights_for_run(&st.run_id, title, work_structure)
        .ok()
}

fn deps_for_stage(st: &RunState, stage: &str) -> Vec<String> {
    if is_video_plan_stage(stage) {
        return Vec::new();
    }
    if is_video_shot_stage(stage) {
        return vec![VIDEO_PLAN_STAGE.to_string()];
    }
    if is_video_assemble_stage(stage) {
        let mut shots: Vec<String> = st
            .stages
            .keys()
            .filter(|k| is_video_shot_stage(k))
            .cloned()
            .collect();
        shots.sort();
        if shots.is_empty() {
            return vec![VIDEO_PLAN_STAGE.to_string()];
        }
        return shots;
    }

    if let Some(node) = st.dag.nodes.iter().find(|n| n.name == stage) {
        return node.deps.clone();
    }
    Vec::new()
}

fn deps_of(st: &RunState, stage: &str) -> Vec<String> {
    if is_video_assemble_stage(stage) {
        return deps_for_stage(st, stage);
    }
    st.dag_edges
        .get(stage)
        .cloned()
        .unwrap_or_else(|| deps_for_stage(st, stage))
}

fn deps_satisfied(st: &RunState, stage: &str) -> bool {
    let file_ok = |p: &std::path::PathBuf| crate::artifacts::file_ok_at(&st.config.out_dir, p);
    if is_video_shot_stage(stage) {
        if let Some(rec) = st.stages.get(VIDEO_PLAN_STAGE) {
            return rec.outputs.iter().all(file_ok);
        }
        return false;
    }
    if is_video_assemble_stage(stage) {
        let shots: Vec<&String> = st
            .stages
            .keys()
            .filter(|k| is_video_shot_stage(k))
            .collect();
        if shots.is_empty() {
            return false;
        }
        for k in shots {
            let Some(rec) = st.stages.get(k) else {
                return false;
            };
            if !matches!(rec.status, StageStatus::SUCCEEDED) {
                return false;
            }
            if !rec.outputs.iter().all(file_ok) {
                return false;
            }
        }
        return true;
    }
    if stage == "render" {
        let ok = |k: &str| {
            st.stages
                .get(k)
                .map(|r| r.outputs.iter().all(file_ok))
                .unwrap_or(false)
        };
        return ok("lyrics")
            && ok("music")
            && ok("vocals")
            && ok(VIDEO_ASSEMBLE_STAGE)
            && ok("subtitles");
    }
    if stage == "subtitles" {
        let ok = |k: &str| {
            st.stages
                .get(k)
                .map(|r| r.outputs.iter().all(file_ok))
                .unwrap_or(false)
        };
        return ok("lyrics");
    }
    if stage == "mix" {
        let ok = |k: &str| {
            st.stages
                .get(k)
                .map(|r| r.outputs.iter().all(file_ok))
                .unwrap_or(false)
        };
        return ok("music") && ok("vocals");
    }

    let deps = deps_of(st, stage);
    deps.iter().all(|dep| {
        st.stages
            .get(dep)
            .map(|r| {
                matches!(r.status, StageStatus::SUCCEEDED | StageStatus::SKIPPED)
                    && r.outputs.iter().all(file_ok)
            })
            .unwrap_or(false)
    })
}

pub fn stage_ready(_dag: &crate::dag::Dag, st: &RunState, stage: &str) -> bool {
    let rec = match st.stages.get(stage) {
        Some(r) => r,
        None => return false,
    };
    if !matches!(rec.status, StageStatus::PENDING) {
        return false;
    }
    deps_satisfied(st, stage)
}

pub fn compute_ready_view(st: &RunState) -> ReadyView {
    compute_ready_view_limited(st, 64)
}

pub fn compute_ready_view_limited(st: &RunState, limit: usize) -> ReadyView {
    compute_ready_view_with_dag_limited(st, &crate::dag::cssmv_dag_active(), limit)
}

pub fn compute_ready_view_with_dag(st: &RunState, _dag: &crate::dag::Dag) -> ReadyView {
    compute_ready_view_with_dag_limited(st, &crate::dag::cssmv_dag_active(), 64)
}

pub fn compute_slowest_leader(st: &RunState) -> Option<(String, f64)> {
    let now = Utc::now();
    let mut best: Option<(String, f64)> = None;
    for (k, rec) in st.stages.iter() {
        let wall_s = stage_wall_s(rec, now);
        let Some(w) = wall_s else {
            continue;
        };
        if !w.is_finite() || w < 0.0 {
            continue;
        }
        match best.as_ref() {
            None => best = Some((k.clone(), w)),
            Some((_bk, bw)) if w > *bw => best = Some((k.clone(), w)),
            _ => {}
        }
    }
    best
}

fn stage_wall_s(rec: &crate::run_state::StageRecord, now: DateTime<Utc>) -> Option<f64> {
    let wall_done = rec
        .meta
        .get("wall_s")
        .and_then(|v| v.as_f64())
        .or(rec.duration_seconds);
    match rec.status {
        StageStatus::RUNNING => rec
            .started_at
            .as_deref()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|ts| (now - ts.with_timezone(&Utc)).num_milliseconds() as f64 / 1000.0)
            .or(wall_done),
        StageStatus::SUCCEEDED | StageStatus::FAILED | StageStatus::SKIPPED => wall_done,
        StageStatus::PENDING => None,
    }
}

pub fn compute_timeline_total_wall_s(st: &RunState) -> f64 {
    let now = Utc::now();
    let mut total = 0.0f64;
    for rec in st.stages.values() {
        if let Some(w) = stage_wall_s(rec, now) {
            if w.is_finite() && w > 0.0 {
                total += w;
            }
        }
    }
    total
}

pub fn compute_ready_view_with_dag_limited(
    st: &RunState,
    _dag: &crate::dag::Dag,
    limit: usize,
) -> ReadyView {
    fn parse_rfc3339_ts(s: &str) -> Option<DateTime<Utc>> {
        chrono::DateTime::parse_from_rfc3339(s)
            .ok()
            .map(|dt| dt.with_timezone(&Utc))
    }

    let mut running: Vec<String> = Vec::new();
    let mut ready: Vec<String> = Vec::new();
    let mut eval_order: Vec<String> = st.topo_order.clone();
    for k in st.stages.keys() {
        if !eval_order.iter().any(|x| x == k) {
            eval_order.push(k.clone());
        }
    }
    let mut summary = ReadySummary {
        total: eval_order.len(),
        ..ReadySummary::default()
    };

    for name in &eval_order {
        let rec = match st.stages.get(name) {
            Some(r) => r,
            None => continue,
        };

        match rec.status {
            StageStatus::PENDING => {
                summary.pending += 1;
                if ready.len() < limit && !st.cancel_requested && deps_satisfied(st, name) {
                    ready.push(name.clone());
                }
            }
            StageStatus::RUNNING => {
                summary.running += 1;
                running.push(name.clone());
            }
            StageStatus::SUCCEEDED => summary.succeeded += 1,
            StageStatus::FAILED => summary.failed += 1,
            StageStatus::SKIPPED => summary.skipped += 1,
        }
    }
    let now = Utc::now();
    let mut slow: Vec<SlowStage> = Vec::new();
    for (k, rec) in &st.stages {
        let wall_done = rec.meta.get("wall_s").and_then(|v| v.as_f64());
        let is_cancelled = rec.error_code.as_deref() == Some("CANCELLED")
            || rec.error_code.as_deref() == Some("CANCELLED_KILLED");
        let wall = match rec.status {
            StageStatus::RUNNING => rec
                .started_at
                .as_deref()
                .and_then(parse_rfc3339_ts)
                .map(|t0| (now - t0).num_milliseconds() as f64 / 1000.0)
                .or(wall_done),
            StageStatus::SUCCEEDED | StageStatus::FAILED | StageStatus::SKIPPED => wall_done
                .or_else(|| {
                    let a = rec.started_at.as_deref().and_then(parse_rfc3339_ts)?;
                    let b = rec.ended_at.as_deref().and_then(parse_rfc3339_ts)?;
                    Some((b - a).num_milliseconds() as f64 / 1000.0)
                }),
            StageStatus::PENDING => None,
        };
        if let Some(w) = wall {
            if w.is_finite() && w >= 0.0 {
                let status = match rec.status {
                    StageStatus::RUNNING => SlowStageStatus::Running,
                    StageStatus::SUCCEEDED => SlowStageStatus::Succeeded,
                    StageStatus::FAILED => SlowStageStatus::Failed,
                    StageStatus::SKIPPED if is_cancelled => SlowStageStatus::Cancelled,
                    StageStatus::SKIPPED => SlowStageStatus::Skipped,
                    StageStatus::PENDING => continue,
                };
                slow.push(SlowStage {
                    stage: k.clone(),
                    wall_s: w,
                    status,
                });
            }
        }
    }
    slow.sort_by(|a, b| {
        b.wall_s
            .partial_cmp(&a.wall_s)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    summary.slowest = slow.into_iter().take(3).collect();
    let warn = st.config.stuck_timeout_seconds;
    summary.slow_warn_s = warn;
    summary.slowest_warn_seconds = warn;
    summary.slowest_stuck_seconds = warn;
    summary.quality = collect_quality_summary(st);
    summary.quality_score = Some(compute_quality_score(&summary.quality));
    summary.immersion = Some(build_immersion_summary(st));
    summary.presence = Some(build_presence_summary(st));
    summary.scene_semantics = build_scene_semantics_summary(st);
    summary.film_runtime = build_film_runtime_summary(st);
    summary.quality_director =
        crate::quality_director::runtime::run_quality_director(&st.run_id).ok();
    summary.release_gate = crate::release_gate::runtime::run_release_gate(&st.run_id).ok();
    summary.market_package = build_market_package_summary(st);
    summary.css_commerce_manifest = build_css_commerce_manifest_summary(st);
    summary.css_rights = build_css_rights_summary(st);

    summary.billing = st.commands.get("billing").and_then(|b| {
        Some(BillingSummary {
            engine: b.get("engine")?.as_str()?.to_string(),
            version: b.get("version")?.as_str()?.to_string(),
            total_price_usd: b
                .get("breakdown")
                .and_then(|x| x.get("total_price_usd"))
                .and_then(|x| x.as_f64())
                .unwrap_or(0.0),
        })
    });

    let video_shots = compute_video_shots_summary(st, &ready, &running);
    let mut lyrics = LyricsLangSummary {
        detected_lang: st.ui_lang.clone(),
        primary_lang: st.ui_lang.clone(),
        suggest_langs: Vec::new(),
    };
    if st.commands.is_object() {
        if let Some(v) = st.commands.get("lyrics") {
            if let Some(s) = v.get("detected_lang").and_then(|x| x.as_str()) {
                lyrics.detected_lang = s.to_string();
            }
            if let Some(s) = v.get("primary_lang").and_then(|x| x.as_str()) {
                lyrics.primary_lang = s.to_string();
            }
            if let Some(arr) = v.get("suggest_langs").and_then(|x| x.as_array()) {
                lyrics.suggest_langs = arr
                    .iter()
                    .filter_map(|x| x.as_str().map(|s| s.to_string()))
                    .collect();
            }
        }
    }
    if lyrics.suggest_langs.is_empty() {
        lyrics.suggest_langs = suggest_langs_for(&lyrics.detected_lang);
    }
    let (counters, running_pids) = compute_counters(st);
    let mix = if let Some(rec) = st.stages.get("mix") {
        let path = rec
            .outputs
            .first()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "./build/mix.wav".to_string());
        MixSummary {
            status: format!("{:?}", rec.status),
            path,
            ok: rec.outputs.iter().all(|p| file_ok_for_run(st, p)),
        }
    } else {
        MixSummary {
            status: "MISSING".to_string(),
            path: "./build/mix.wav".to_string(),
            ok: false,
        }
    };
    let subtitles = if let Some(rec) = st.stages.get("subtitles") {
        let path = rec
            .outputs
            .first()
            .map(|p| p.display().to_string())
            .unwrap_or_else(|| "./build/subtitles.ass".to_string());
        SubtitlesSummary {
            status: format!("{:?}", rec.status),
            path,
            burnin: false,
            format: "ass".to_string(),
            lang: st.ui_lang.clone(),
            ok: rec.outputs.iter().all(|p| file_ok_for_run(st, p)),
        }
    } else {
        SubtitlesSummary {
            status: "MISSING".to_string(),
            path: "./build/subtitles.ass".to_string(),
            burnin: false,
            format: "ass".to_string(),
            lang: st.ui_lang.clone(),
            ok: false,
        }
    };
    let mut blocking = dedup_and_sort_blocking(st, compute_blocking(st, &ready), 12);
    if st.cancel_requested {
        ready.clear();
    }
    blocking = override_blocking_for_cancel(st, &running, blocking);
    let last_event = st.last_event.as_ref().map(|e| ReadyEvent {
        kind: e.kind.clone(),
        stage: e.stage.clone(),
        status: e.status.clone(),
        ts: e.ts.clone(),
        meta: e.meta.clone(),
    });

    let immersion = summary.immersion.clone();
    let presence = summary.presence.clone();
    let scene_semantics = summary.scene_semantics.clone();

    ReadyView {
        topo_order: eval_order,
        ready,
        running,
        summary,
        video_shots,
        lyrics,
        counters,
        running_pids,
        mix,
        subtitles,
        immersion,
        presence,
        scene_semantics,
        blocking,
        stage_seq: st.stage_seq,
        last_event,
    }
}

fn override_blocking_for_cancel(
    st: &RunState,
    running: &[String],
    blocking: Vec<BlockingItem>,
) -> Vec<BlockingItem> {
    if !st.cancel_requested {
        return blocking;
    }
    let mut heads: Vec<String> = running.to_vec();
    if heads.is_empty() {
        for (k, rec) in &st.stages {
            if matches!(rec.status, StageStatus::PENDING) {
                heads.push(k.clone());
            }
        }
    }
    heads.sort();
    heads.dedup();

    let mut out: Vec<BlockingItem> = Vec::new();
    for stage in heads.into_iter().take(6) {
        out.push(BlockingItem {
            stage: stage.clone(),
            blocked_by: Some("run".to_string()),
            chain: vec![stage, "run".to_string()],
            bad_at: Some("run".to_string()),
            bad_kind: Some(BadKind::Cancelled),
            reason: Some("cancel_requested".to_string()),
        });
    }

    if out.is_empty() {
        out.push(BlockingItem {
            stage: "run".to_string(),
            blocked_by: Some("run".to_string()),
            chain: vec!["run".to_string()],
            bad_at: Some("run".to_string()),
            bad_kind: Some(BadKind::Cancelled),
            reason: Some("cancel_requested".to_string()),
        });
    }

    out
}

fn file_ok(p: &Path) -> bool {
    std::fs::metadata(p).map(|m| m.len() > 0).unwrap_or(false)
}

fn file_ok_for_run(st: &RunState, p: &std::path::PathBuf) -> bool {
    let abs = if p.is_absolute() {
        p.clone()
    } else {
        st.config.out_dir.join(p)
    };
    file_ok(&abs)
}

fn compute_video_shots_summary(
    st: &RunState,
    ready: &[String],
    running: &[String],
) -> VideoShotsSummary {
    let mut out = VideoShotsSummary::default();

    for (name, rec) in &st.stages {
        if !is_video_shot_stage(name) {
            continue;
        }
        out.total += 1;
        match rec.status {
            StageStatus::SUCCEEDED => out.succeeded += 1,
            StageStatus::FAILED => out.failed += 1,
            StageStatus::RUNNING => out.running += 1,
            StageStatus::PENDING => out.pending += 1,
            _ => {}
        }
    }

    out.ready = ready.iter().filter(|s| is_video_shot_stage(s)).count();
    let running_list_n = running.iter().filter(|s| is_video_shot_stage(s)).count();
    if running_list_n > out.running {
        out.running = running_list_n;
    }

    out
}

fn compute_counters(st: &RunState) -> (ReadyCounters, Vec<RunningPid>) {
    let mut c = ReadyCounters::default();
    let mut running_pids = Vec::<RunningPid>::new();
    for (k, r) in &st.stages {
        match r.status {
            StageStatus::PENDING => c.pending += 1,
            StageStatus::RUNNING => {
                c.running += 1;
                running_pids.push(RunningPid {
                    stage: k.clone(),
                    pid: r.pid,
                    pgid: r.pgid,
                });
            }
            StageStatus::SUCCEEDED => c.succeeded += 1,
            StageStatus::FAILED => {
                c.failed += 1;
                if r.error_code.as_deref() == Some("CANCELLED_KILLED") {
                    c.killed_cancelled += 1;
                }
                if r.error_code.as_deref() == Some("TIMEOUT_KILLED") {
                    c.killed_timeout += 1;
                }
            }
            StageStatus::SKIPPED => c.skipped += 1,
        }
    }
    running_pids.sort_by(|a, b| a.stage.cmp(&b.stage));
    (c, running_pids)
}

fn bad_outputs_for_run(st: &RunState, rec: &crate::run_state::StageRecord) -> Vec<String> {
    rec.outputs
        .iter()
        .filter(|p| !file_ok_for_run(st, p))
        .map(|p| p.display().to_string())
        .collect()
}

fn fmt_f64_2(x: f64) -> String {
    let v = (x * 100.0).round() / 100.0;
    format!("{v:.2}")
}

fn gate_reason(meta: &crate::run_state::GateMeta) -> String {
    let mut parts: Vec<String> = Vec::new();
    if !meta.gate_code.is_empty() {
        parts.push(format!("gate_code={}", meta.gate_code));
    }
    if !meta.base_stage.is_empty() {
        parts.push(format!("base_stage={}", meta.base_stage));
    }
    if meta.base_s > 0.0 {
        parts.push(format!("base_s={}", fmt_f64_2(meta.base_s)));
    }
    if meta.got_s > 0.0 {
        parts.push(format!("got_s={}", fmt_f64_2(meta.got_s)));
    }
    if meta.min_duration_s > 0.0 {
        parts.push(format!("min_s={}", fmt_f64_2(meta.min_duration_s)));
    }
    if meta.min_ratio > 0.0 {
        parts.push(format!("min_ratio={}", fmt_f64_2(meta.min_ratio)));
    }
    parts.join(" ")
}

fn last_event_gate_for_stage(st: &RunState, dep: &str) -> Option<crate::run_state::GateMeta> {
    let ev = st.last_event.as_ref()?;
    if ev.stage != dep {
        return None;
    }
    let meta = ev.meta.as_ref()?;
    if let Some(v) = meta.get("gate") {
        return serde_json::from_value(v.clone()).ok();
    }
    serde_json::from_value(meta.clone()).ok()
}

fn stage_gate_meta(st: &RunState, dep: &str) -> Option<crate::run_state::GateMeta> {
    let v = st.stages.get(dep)?.meta.get("gate")?.clone();
    serde_json::from_value(v).ok()
}

fn blocking_reason_for_dep(st: &RunState, dep: &str) -> Option<String> {
    if let Some(m) = last_event_gate_for_stage(st, dep) {
        return Some(gate_reason(&m));
    }
    if let Some(m) = stage_gate_meta(st, dep) {
        return Some(gate_reason(&m));
    }
    None
}

fn stage_done(rec: &crate::run_state::StageRecord) -> bool {
    matches!(rec.status, StageStatus::SUCCEEDED | StageStatus::SKIPPED)
}

fn blocked_by_once(st: &RunState, stage: &str) -> Option<String> {
    let deps = st
        .dag_edges
        .get(stage)
        .cloned()
        .unwrap_or_else(|| deps_for_stage(st, stage));

    if deps.is_empty() {
        return None;
    }

    for dep in deps {
        let Some(rec) = st.stages.get(&dep) else {
            return Some(dep);
        };
        if !stage_done(rec) {
            return Some(dep);
        }
    }
    None
}

fn blocked_chain(st: &RunState, stage: &str, max_hops: usize) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    let mut cur = stage.to_string();
    let mut hops = 0usize;

    while hops <= max_hops {
        if out.iter().any(|x| x == &cur) {
            break;
        }
        out.push(cur.clone());
        let next = blocked_by_once(st, &cur);
        let Some(n) = next else { break };
        cur = n;
        hops += 1;
    }
    out
}

fn is_bad_stage(st: &RunState, stage: &str) -> bool {
    let Some(rec) = st.stages.get(stage) else {
        return true;
    };
    if matches!(rec.status, StageStatus::FAILED) {
        return true;
    }
    if let Some(meta) = rec.meta.as_object() {
        if meta.get("gate_code").is_some() {
            return true;
        }
        if let Some(g) = meta.get("gate") {
            if g.get("gate_code").is_some() {
                return true;
            }
        }
    }
    false
}

fn nearest_bad_index(st: &RunState, chain: &[String]) -> usize {
    for (i, s) in chain.iter().enumerate() {
        if is_bad_stage(st, s) {
            return i;
        }
    }
    chain.len()
}

fn chain_bad_at(st: &RunState, chain: &[String]) -> Option<String> {
    for s in chain {
        if is_bad_stage(st, s) {
            return Some(s.clone());
        }
    }
    None
}

fn has_gate_meta(st: &RunState, stage: &str) -> bool {
    st.stages
        .get(stage)
        .and_then(|r| r.meta.as_object())
        .map(|m| {
            m.get("gate_code").is_some()
                || m.get("gate")
                    .and_then(|g| g.as_object())
                    .map(|go| go.get("gate_code").is_some())
                    .unwrap_or(false)
        })
        .unwrap_or(false)
}

fn bad_kind_for(st: &RunState, stage: &str) -> Option<BadKind> {
    let Some(rec) = st.stages.get(stage) else {
        return Some(BadKind::Missing);
    };

    if matches!(rec.status, StageStatus::FAILED) {
        return Some(BadKind::Failed);
    }

    if has_gate_meta(st, stage) {
        return Some(BadKind::Gate);
    }

    if !rec.outputs.iter().all(|p| file_ok_for_run(st, p)) {
        return Some(BadKind::Missing);
    }

    None
}

fn chain_bad_kind(st: &RunState, bad_at: &Option<String>) -> Option<BadKind> {
    let Some(s) = bad_at.as_ref() else {
        return None;
    };
    bad_kind_for(st, s)
}

fn dedup_and_sort_blocking(
    st: &RunState,
    mut items: Vec<BlockingItem>,
    limit: usize,
) -> Vec<BlockingItem> {
    let mut seen = HashSet::<String>::new();
    items.retain(|it| {
        let sig = it.chain.join("->");
        if seen.contains(&sig) {
            false
        } else {
            seen.insert(sig);
            true
        }
    });

    items.sort_by(|a, b| {
        let ai = nearest_bad_index(st, &a.chain);
        let bi = nearest_bad_index(st, &b.chain);
        ai.cmp(&bi)
            .then_with(|| a.chain.len().cmp(&b.chain.len()))
            .then_with(|| a.stage.cmp(&b.stage))
    });

    items.truncate(limit);
    items
}

fn compute_blocking(st: &RunState, ready: &[String]) -> Vec<BlockingItem> {
    let mut out = Vec::<BlockingItem>::new();
    if st.cancel_requested {
        return out;
    }
    if !ready.is_empty() {
        return out;
    }

    for (stage, rec) in &st.stages {
        if !matches!(rec.status, StageStatus::PENDING) {
            continue;
        }
        let by = blocked_by_once(st, stage);
        let chain = blocked_chain(st, stage, 3);
        let mut reason: Option<String> = None;
        if let Some(ref dep) = by {
            if let Some(r) = blocking_reason_for_dep(st, dep) {
                reason = Some(r);
            }
        }
        if by.is_some() || !bad_outputs_for_run(st, rec).is_empty() {
            let bad_at = chain_bad_at(st, &chain);
            let bad_kind = chain_bad_kind(st, &bad_at);
            out.push(BlockingItem {
                stage: stage.clone(),
                reason,
                blocked_by: by,
                chain,
                bad_at,
                bad_kind,
            });
        }
    }

    out.sort_by(|a, b| a.stage.cmp(&b.stage));
    out
}

pub fn any_failed(st: &RunState) -> bool {
    st.stages
        .values()
        .any(|r| matches!(r.status, StageStatus::FAILED))
}

pub fn collect_failures(st: &RunState) -> Vec<(String, String)> {
    let mut out = Vec::<(String, String)>::new();
    for (stage, rec) in &st.stages {
        if matches!(rec.status, StageStatus::FAILED) {
            let msg = rec.error.clone().unwrap_or_else(|| "failed".to_string());
            out.push((stage.clone(), msg));
        }
    }
    out
}

pub fn build_summary(st: &RunState, view: &ReadyView) -> String {
    build_summary_i18n(st, view, "en")
}

fn billing_label(st: &RunState) -> Option<String> {
    let b = st.commands.get("billing")?;
    let engine = b.get("engine")?.as_str()?;
    let version = b.get("version")?.as_str()?;
    let total = b
        .get("breakdown")
        .and_then(|x| x.get("total_price_usd"))
        .and_then(|x| x.as_f64())
        .unwrap_or(0.0);
    Some(format!("{} {} · ${:.2}", engine, version, total))
}

pub fn build_summary_i18n(st: &RunState, view: &ReadyView, lang: &str) -> String {
    if st.cancel_requested && !matches!(st.status, crate::run_state::RunStatus::CANCELLED) {
        return crate::i18n::t(lang, "cancel_requested").into();
    }
    if matches!(st.status, crate::run_state::RunStatus::FAILED) {
        if let Some((k, msg)) = collect_failures(st).first() {
            return format!("{}: {}: {}", crate::i18n::t(lang, "failed"), k, msg);
        }
        let msg = crate::i18n::t(lang, "failed").to_string();
        return if let Some(b) = billing_label(st) {
            format!("{} · {}", b, msg)
        } else {
            msg
        };
    }
    if matches!(st.status, crate::run_state::RunStatus::CANCELLED) {
        let msg = crate::i18n::t(lang, "cancelled").to_string();
        return if let Some(b) = billing_label(st) {
            format!("{} · {}", b, msg)
        } else {
            msg
        };
    }
    if matches!(st.status, crate::run_state::RunStatus::SUCCEEDED) {
        let msg = crate::i18n::t(lang, "done").to_string();
        return if let Some(b) = billing_label(st) {
            format!("{} · {}", b, msg)
        } else {
            msg
        };
    }
    if !view.running.is_empty() {
        let msg = format!(
            "{}: {}",
            crate::i18n::t(lang, "running"),
            view.running.len()
        );
        return if let Some(b) = billing_label(st) {
            format!("{} · {}", b, msg)
        } else {
            msg
        };
    }
    if !view.ready.is_empty() {
        let msg = format!("{}: {}", crate::i18n::t(lang, "ready"), view.ready.len());
        return if let Some(b) = billing_label(st) {
            format!("{} · {}", b, msg)
        } else {
            msg
        };
    }
    if let Some(b) = view.blocking.first() {
        if !b.chain.is_empty() {
            let msg = format!(
                "{}: {}",
                crate::i18n::t(lang, "blocked"),
                b.chain.join(" -> ")
            );
            return if let Some(bl) = billing_label(st) {
                format!("{} · {}", bl, msg)
            } else {
                msg
            };
        }
        if let Some(reason) = &b.reason {
            let msg = format!(
                "{}: {} {}",
                crate::i18n::t(lang, "blocked"),
                b.stage,
                reason
            );
            return if let Some(bl) = billing_label(st) {
                format!("{} · {}", bl, msg)
            } else {
                msg
            };
        }
        let msg = format!("{}: {}", crate::i18n::t(lang, "blocked"), b.stage);
        return if let Some(bl) = billing_label(st) {
            format!("{} · {}", bl, msg)
        } else {
            msg
        };
    }
    {
        let msg = crate::i18n::t(lang, "idle").to_string();
        if let Some(b) = billing_label(st) {
            format!("{} · {}", b, msg)
        } else {
            msg
        }
    }
}

pub fn all_done(st: &RunState) -> bool {
    st.stages.values().all(|r| {
        matches!(
            r.status,
            StageStatus::SUCCEEDED | StageStatus::FAILED | StageStatus::SKIPPED
        )
    })
}

fn collect_quality_summary(st: &RunState) -> QualitySummary {
    let mut passed: Vec<String> = Vec::new();
    let mut failed: Vec<String> = Vec::new();
    let mut subtitles_audio_delta: Option<QualityDeltaMetrics> = None;
    let mut subtitles_audio_delta_before_s: Option<f64> = None;
    let mut subtitles_audio_delta_improved_s: Option<f64> = None;

    for rec in st.stages.values() {
        let Some(meta) = rec.meta.as_object() else {
            continue;
        };

        if let Some(gates) = meta.get("quality_gates").and_then(|x| x.as_array()) {
            for g in gates {
                let code = g
                    .get("code")
                    .and_then(|x| x.as_str())
                    .unwrap_or("")
                    .to_string();
                let ok = g.get("ok").and_then(|x| x.as_bool()).unwrap_or(false);
                if code.is_empty() {
                    continue;
                }
                if code == "SUBTITLES_AUDIO_DELTA_OK" || code == "SUBTITLES_AUDIO_DELTA_TOO_LARGE" {
                    let delta_s = g
                        .get("metrics")
                        .and_then(|m| m.get("delta_s"))
                        .and_then(|v| v.as_f64());
                    let delta_s_after = g
                        .get("metrics")
                        .and_then(|m| m.get("delta_s_after"))
                        .and_then(|v| v.as_f64())
                        .or(delta_s);
                    let delta_s_before = g
                        .get("metrics")
                        .and_then(|m| m.get("delta_s_before"))
                        .and_then(|v| v.as_f64());
                    let max_delta_s = g
                        .get("metrics")
                        .and_then(|m| m.get("max_delta_s"))
                        .and_then(|v| v.as_f64());
                    if let (Some(delta_s), Some(max_delta_s)) = (delta_s_after, max_delta_s) {
                        subtitles_audio_delta = Some(QualityDeltaMetrics {
                            delta_s,
                            max_delta_s,
                        });
                    }
                    if let Some(v) = delta_s_before {
                        subtitles_audio_delta_before_s = Some(v);
                        if let Some(after) = delta_s_after {
                            subtitles_audio_delta_improved_s = Some((v - after).max(0.0));
                        }
                    }
                }
                if ok {
                    if !passed.iter().any(|x| x == &code) {
                        passed.push(code);
                    }
                } else if !failed.iter().any(|x| x == &code) {
                    failed.push(code);
                }
            }
        }

        if let Some(code) = meta.get("gate_code").and_then(|x| x.as_str()) {
            if !failed.iter().any(|x| x == code) {
                failed.push(code.to_string());
            }
        }
    }

    passed.sort();
    failed.sort();

    let blocking_gate = failed.first().cloned();
    let ok = failed.is_empty();
    let milestone_ready = ok;

    QualitySummary {
        ok,
        passed,
        failed,
        blocking_gate,
        subtitles_audio_delta,
        subtitles_audio_delta_before_s,
        subtitles_audio_delta_improved_s,
        milestone_ready,
        versions: None,
    }
}

fn compute_quality_score(q: &QualitySummary) -> QualityScore {
    struct Rule {
        name: &'static str,
        max: u32,
        pass_codes: &'static [&'static str],
        fail_codes: &'static [&'static str],
    }

    let rules = [
        Rule {
            name: "lyrics",
            max: 20,
            pass_codes: &["LYRICS_NONEMPTY_OK"],
            fail_codes: &["LYRICS_NONEMPTY_TOO_FEW"],
        },
        Rule {
            name: "music",
            max: 20,
            pass_codes: &["AUDIO_DURATION_OK"],
            fail_codes: &["AUDIO_DURATION_TOO_SHORT"],
        },
        Rule {
            name: "vocals",
            max: 20,
            pass_codes: &["AUDIO_DURATION_OK"],
            fail_codes: &["AUDIO_DURATION_TOO_SHORT", "AUDIO_TOO_SILENT"],
        },
        Rule {
            name: "video",
            max: 20,
            pass_codes: &["VIDEO_DURATION_OK", "AV_DURATION_DELTA_OK"],
            fail_codes: &["VIDEO_DURATION_TOO_SHORT", "AV_DURATION_DELTA_TOO_LARGE"],
        },
        Rule {
            name: "subtitles",
            max: 20,
            pass_codes: &["SUBTITLES_COVERAGE_OK", "SUBTITLES_AUDIO_DELTA_OK"],
            fail_codes: &[
                "SUBTITLES_COVERAGE_TOO_LOW",
                "SUBTITLES_AUDIO_DELTA_TOO_LARGE",
            ],
        },
    ];

    let mut breakdown = BTreeMap::new();
    let mut components = BTreeMap::new();
    let mut score = 0u32;
    let mut max = 0u32;

    for rule in rules {
        max += rule.max;
        let mut fail_codes: Vec<String> = rule
            .fail_codes
            .iter()
            .filter(|code| q.failed.iter().any(|x| x == **code))
            .map(|s| (*s).to_string())
            .collect();
        fail_codes.sort();
        fail_codes.dedup();

        let has_pass = rule
            .pass_codes
            .iter()
            .any(|code| q.passed.iter().any(|x| x == *code));
        let has_any_signal = !q.passed.is_empty() || !q.failed.is_empty();
        let passed = if has_any_signal {
            fail_codes.is_empty() && has_pass
        } else {
            fail_codes.is_empty()
        };
        let comp_score = if passed { rule.max } else { 0 };
        score += comp_score;

        breakdown.insert(rule.name.to_string(), comp_score);
        components.insert(
            rule.name.to_string(),
            QualityComponentScore {
                score: comp_score,
                max: rule.max,
                passed,
                fail_codes,
            },
        );
    }

    QualityScore {
        score,
        max,
        breakdown,
        components,
    }
}

pub fn topo_order_preferred(
    st: &RunState,
    plan: Option<&crate::dag_v3::plan::DagExecutionPlan>,
) -> Vec<String> {
    if let Some(p) = plan {
        let xs: Vec<String> = p.topo_order.iter().map(|x| x.0.clone()).collect();
        if !xs.is_empty() {
            return xs;
        }
    }
    st.topo_order.clone()
}

pub fn artifacts_view_preferred(
    run_id: &str,
    st: &RunState,
    plan: Option<&crate::dag_v3::plan::DagExecutionPlan>,
) -> serde_json::Value {
    let stable = crate::run_store::load_run_artifacts_index(run_id)
        .ok()
        .or_else(|| plan.map(|p| p.artifacts.clone()));
    if let Some(stable) = stable {
        let run_dir = crate::run_store::run_dir(run_id);
        let versions = crate::artifact_versions::build_versions_view(&run_dir, &stable);
        return serde_json::json!({
            "stable": stable,
            "versions": versions
        });
    }
    serde_json::to_value(st.artifacts.clone()).unwrap_or_else(|_| serde_json::json!([]))
}
