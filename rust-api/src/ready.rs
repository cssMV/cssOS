use crate::invariant::check_invariants;
use crate::run_state::{RunEvent, RunState, StageStatus};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::path::Path;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum VideoProgressReason {
    Failed,
    Timeout,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum VideoReasonStage {
    VideoPlan,
    VideoAssemble,
}

impl VideoReasonStage {
    pub fn short(&self) -> &'static str {
        match self {
            VideoReasonStage::VideoPlan => "plan",
            VideoReasonStage::VideoAssemble => "assemble",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadyView {
    pub cursor: String,
    pub last_event: Option<RunEvent>,
    pub stage_seq: u64,
    pub topo_order: Vec<String>,
    pub ready: Vec<String>,
    pub running: Vec<String>,
    pub summary: ReadySummary,
    pub video_shots: VideoShotsSummary,
    pub video: VideoSummary,
    pub lyrics_variants: LyricsVariantsSummary,
    pub vocals_variants: VocalsVariantsSummary,
    pub mix: MixSummary,
    pub subtitles: SubtitlesSummary,
    pub blocking: Vec<BlockingItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct BlockingItem {
    pub stage: String,
    pub deps: Vec<String>,
    pub reason: String,
    pub missing_deps: Vec<String>,
    pub bad_outputs: Vec<String>,
    pub blocked_by: Option<String>,
    pub bad_at: Option<String>,
    pub bad_kind: Option<BadKind>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum BadKind {
    Failed,
    Gate,
    Missing,
    Cancelled,
    Timeout,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct MixSummary {
    pub status: String,
    pub path: String,
    pub ok: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct SubtitlesSummary {
    pub schema: String,
    pub version: u32,
    pub stage: String,
    pub status: String,
    pub path: String,
    pub ass_path: String,
    pub burnin: bool,
    pub format: String,
    pub mime: String,
    pub ok: bool,
    pub bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct SlowStage {
    pub stage: String,
    pub wall_s: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct ReadySummary {
    pub total: usize,
    pub pending: usize,
    pub running: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub skipped: usize,
    #[serde(default)]
    pub slowest: Vec<SlowStage>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct VideoShotsSummary {
    pub total: usize,
    pub ready: usize,
    pub running: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub pending: usize,
    pub cancelled: usize,
    pub timed_out: usize,
    pub skipped: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct VideoSummary {
    pub plan: Option<StageStatus>,
    pub assemble: Option<StageStatus>,
    pub progress: u8,
    pub progress_reason: Option<VideoProgressReason>,
    pub reason_stage: Option<VideoReasonStage>,
    pub pending: usize,
    pub running: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub skipped: usize,
    pub cancelled: usize,
    pub timed_out: usize,
}

fn err_has_timeout(s: &Option<String>) -> bool {
    s.as_deref()
        .map(|v| v.to_ascii_lowercase().contains("timeout"))
        .unwrap_or(false)
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct LyricsVariantsSummary {
    pub total: usize,
    pub ready: usize,
    pub running: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub pending: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct VocalsVariantsSummary {
    pub total: usize,
    pub ready: usize,
    pub running: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub skipped: usize,
    pub pending: usize,
}

fn deps_for_stage(st: &RunState, stage: &str) -> Vec<String> {
    if stage == "video_plan" {
        return Vec::new();
    }
    if stage.starts_with("video_shot_") || stage.starts_with("video.shot:") {
        return vec!["video_plan".to_string()];
    }
    if stage == "video_assemble" {
        let mut shots: Vec<String> = st
            .stages
            .keys()
            .filter(|k| k.starts_with("video_shot_") || k.starts_with("video.shot:"))
            .cloned()
            .collect();
        shots.sort();
        if shots.is_empty() {
            return vec!["video_plan".to_string()];
        }
        return shots;
    }

    if let Some(node) = st.dag.nodes.iter().find(|n| n.name == stage) {
        return node.deps.clone();
    }
    Vec::new()
}

fn deps_of(st: &RunState, stage: &str) -> Vec<String> {
    if stage == "video_assemble" {
        return deps_for_stage(st, stage);
    }
    st.dag_edges
        .get(stage)
        .cloned()
        .unwrap_or_else(|| deps_for_stage(st, stage))
}

fn deps_satisfied(st: &RunState, stage: &str) -> bool {
    let file_ok = |p: &std::path::PathBuf| file_ok_for_run(st, p);
    let is_vocals_variant = |name: &str| name.starts_with("vocals:") && name.ends_with(":main");
    let is_lyrics_variant = |name: &str| name.starts_with("lyrics:") && name.ends_with(":main");
    if is_lyrics_variant(stage) {
        return true;
    }
    if stage == "lyrics" {
        let ref_stage = st
            .commands
            .get("lyrics")
            .and_then(|m| m.get("ref"))
            .and_then(|v| v.as_str());
        let Some(ref_stage) = ref_stage else {
            return true;
        };
        if ref_stage == "lyrics" {
            return true;
        }
        return st
            .stages
            .get(ref_stage)
            .map(|r| {
                matches!(r.status, StageStatus::SUCCEEDED | StageStatus::SKIPPED)
                    && r.outputs.iter().all(file_ok)
            })
            .unwrap_or(false);
    }
    if stage.starts_with("subtitles:") {
        let Some(base) = st.stages.get("lyrics") else {
            return false;
        };
        if !matches!(base.status, StageStatus::SUCCEEDED | StageStatus::SKIPPED)
            || !base.outputs.iter().all(file_ok)
        {
            return false;
        }
        let lang = stage.strip_prefix("subtitles:").unwrap_or_default();
        let lyric_variant = format!("lyrics:{lang}:main");
        let Some(variant) = st.stages.get(&lyric_variant) else {
            return false;
        };
        return matches!(variant.status, StageStatus::SUCCEEDED)
            && variant.outputs.iter().all(file_ok);
    }
    if stage == "mix" {
        let ok = |k: &str| {
            st.stages
                .get(k)
                .map(|r| {
                    matches!(r.status, StageStatus::SUCCEEDED | StageStatus::SKIPPED)
                        && r.outputs.iter().all(file_ok)
                })
                .unwrap_or(false)
        };
        let voice_ref = st
            .commands
            .get("mix")
            .and_then(|m| m.get("voice_ref"))
            .and_then(|v| v.as_str())
            .unwrap_or("vocals");
        return ok("music") && ok(voice_ref);
    }
    if is_vocals_variant(stage) {
        let ok = |k: &str| {
            st.stages
                .get(k)
                .map(|r| {
                    matches!(r.status, StageStatus::SUCCEEDED | StageStatus::SKIPPED)
                        && r.outputs.iter().all(file_ok)
                })
                .unwrap_or(false)
        };
        return ok("lyrics") && ok("music");
    }
    if stage == "vocals" {
        let voice_ref = st
            .commands
            .get("mix")
            .and_then(|m| m.get("voice_ref"))
            .and_then(|v| v.as_str())
            .unwrap_or("vocals");
        if voice_ref == "vocals" {
            let ok = |k: &str| {
                st.stages
                    .get(k)
                    .map(|r| {
                        matches!(r.status, StageStatus::SUCCEEDED | StageStatus::SKIPPED)
                            && r.outputs.iter().all(file_ok)
                    })
                    .unwrap_or(false)
            };
            return ok("lyrics") && ok("music");
        }
        return st
            .stages
            .get(voice_ref)
            .map(|r| {
                matches!(r.status, StageStatus::SUCCEEDED | StageStatus::SKIPPED)
                    && r.outputs.iter().all(file_ok)
            })
            .unwrap_or(false);
    }
    if stage.starts_with("video_shot_") || stage.starts_with("video.shot:") {
        if let Some(rec) = st.stages.get("video_plan") {
            return rec.outputs.iter().all(file_ok);
        }
        return false;
    }
    if stage == "video_assemble" {
        let shots: Vec<&String> = st
            .stages
            .keys()
            .filter(|k| k.starts_with("video_shot_") || k.starts_with("video.shot:"))
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
        return ok("lyrics") && ok("music") && ok("mix") && ok("video_assemble") && ok("subtitles");
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

fn blockers_for_stage(st: &RunState, stage: &str, max_deps: usize) -> Vec<String> {
    let deps = st
        .dag_edges
        .get(stage)
        .cloned()
        .unwrap_or_else(|| deps_for_stage(st, stage));
    let file_ok = |p: &std::path::PathBuf| file_ok_for_run(st, p);
    let mut out: Vec<String> = Vec::new();
    for dep in deps {
        let ok = st
            .stages
            .get(&dep)
            .map(|r| {
                matches!(r.status, StageStatus::SUCCEEDED | StageStatus::SKIPPED)
                    && r.outputs.iter().all(file_ok)
            })
            .unwrap_or(false);
        if !ok {
            out.push(dep);
            if out.len() >= max_deps {
                break;
            }
        }
    }
    out
}

fn push_blocking_limited(
    blocking: &mut Vec<BlockingItem>,
    stage: &str,
    deps: Vec<String>,
    max_items: usize,
) {
    if blocking.len() >= max_items || deps.is_empty() {
        return;
    }
    blocking.push(BlockingItem {
        stage: stage.to_string(),
        deps: deps.clone(),
        reason: String::new(),
        missing_deps: deps,
        bad_outputs: Vec::new(),
        blocked_by: None,
        bad_at: None,
        bad_kind: None,
    });
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
    compute_ready_view_with_dag_limited(st, &crate::dag::cssmv_dag_v1(), limit)
}

pub fn compute_ready_view_with_dag(st: &RunState, _dag: &crate::dag::Dag) -> ReadyView {
    compute_ready_view_with_dag_limited(st, &crate::dag::cssmv_dag_v1(), 64)
}

pub fn compute_ready_view_with_dag_limited(
    st: &RunState,
    _dag: &crate::dag::Dag,
    limit: usize,
) -> ReadyView {
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
                let retry_ok = match &rec.retry_at {
                    None => true,
                    Some(ts) => chrono::DateTime::parse_from_rfc3339(ts)
                        .map(|t| t.with_timezone(&chrono::Utc) <= chrono::Utc::now())
                        .unwrap_or(true),
                };
                if ready.len() < limit
                    && !st.cancel_requested
                    && retry_ok
                    && deps_satisfied(st, name)
                {
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
            StageStatus::CANCELLED => summary.skipped += 1,
        }
    }
    fn parse_rfc3339_ts(s: &str) -> Option<DateTime<Utc>> {
        chrono::DateTime::parse_from_rfc3339(s)
            .ok()
            .map(|dt| dt.with_timezone(&Utc))
    }

    let now = Utc::now();

    let mut slow: Vec<SlowStage> = Vec::new();
    for (k, rec) in &st.stages {
        let wall_done = rec.meta.get("wall_s").and_then(|v| v.as_f64());

        let wall = match rec.status {
            StageStatus::RUNNING => rec
                .started_at
                .as_deref()
                .and_then(parse_rfc3339_ts)
                .map(|t0| (now - t0).num_milliseconds() as f64 / 1000.0)
                .or(wall_done),
            StageStatus::SUCCEEDED
            | StageStatus::FAILED
            | StageStatus::SKIPPED
            | StageStatus::CANCELLED => wall_done.or_else(|| {
                let a = rec.started_at.as_deref().and_then(parse_rfc3339_ts)?;
                let b = rec.ended_at.as_deref().and_then(parse_rfc3339_ts)?;
                Some((b - a).num_milliseconds() as f64 / 1000.0)
            }),
            StageStatus::PENDING => None,
        };

        if let Some(w) = wall {
            if w.is_finite() && w >= 0.0 {
                slow.push(SlowStage {
                    stage: k.clone(),
                    wall_s: w,
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

    let inv = check_invariants(st);
    if !inv.is_empty() {
        eprintln!("INVARIANT_VIOLATION count={}", inv.len());
    }

    let video_shots = compute_video_shots_summary(st, &ready, &running);
    let video = compute_video_summary(st);
    let lyrics_variants = compute_lyrics_variants_summary(st, &ready, &running);
    let vocals_variants = compute_vocals_variants_summary(st, &ready, &running);
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
    let subtitles_path = subtitles_rel_path(st);
    let subtitles_bytes = subtitles_bytes_for_run(st);
    let subtitles = if let Some(rec) = st.stages.get("subtitles") {
        SubtitlesSummary {
            schema: "css.subtitles.ready.v1".to_string(),
            version: 1,
            stage: "subtitles".to_string(),
            status: format!("{:?}", rec.status),
            path: subtitles_path.clone(),
            ass_path: subtitles_path.clone(),
            burnin: false,
            format: "ass".to_string(),
            mime: "text/x-ssa".to_string(),
            ok: rec.outputs.iter().all(|p| file_ok_for_run(st, p)) && subtitles_bytes > 0,
            bytes: subtitles_bytes,
        }
    } else {
        SubtitlesSummary {
            schema: "css.subtitles.ready.v1".to_string(),
            version: 1,
            stage: "subtitles".to_string(),
            status: "MISSING".to_string(),
            path: subtitles_path.clone(),
            ass_path: subtitles_path,
            burnin: false,
            format: "ass".to_string(),
            mime: "text/x-ssa".to_string(),
            ok: false,
            bytes: subtitles_bytes,
        }
    };
    let blocking = compute_blocking_v17(st, &eval_order);
    let blocking = explain_blocking_timeout(st, explain_blocking_cancel(st, blocking));
    ReadyView {
        cursor: st.updated_at.clone(),
        last_event: st.last_event.clone(),
        stage_seq: st.stage_seq,
        topo_order: eval_order,
        ready,
        running,
        summary,
        video_shots: explain_video_shots_cancel(st, video_shots),
        video,
        lyrics_variants,
        vocals_variants,
        mix,
        subtitles,
        blocking,
    }
}

fn explain_blocking_timeout(st: &RunState, mut items: Vec<BlockingItem>) -> Vec<BlockingItem> {
    let (bad_at, reason) = if let Some(ev) = st.last_event.as_ref() {
        if ev.kind == "timeout" {
            let reason = if ev
                .meta
                .as_ref()
                .and_then(|m| m.get("stuck_timeout_s"))
                .is_some()
            {
                "stuck"
            } else {
                "timeout"
            };
            (Some(ev.stage.clone()), reason)
        } else {
            let fallback = st.stages.iter().find_map(|(name, rec)| {
                if matches!(rec.status, StageStatus::FAILED) && is_timeout_record(rec) {
                    let reason = if rec.meta.get("stuck_timeout_s").is_some() {
                        "stuck"
                    } else {
                        "timeout"
                    };
                    Some((name.clone(), reason))
                } else {
                    None
                }
            });
            if let Some((name, reason)) = fallback {
                (Some(name), reason)
            } else {
                (None, "timeout")
            }
        }
    } else {
        let fallback = st.stages.iter().find_map(|(name, rec)| {
            if matches!(rec.status, StageStatus::FAILED) && is_timeout_record(rec) {
                let reason = if rec.meta.get("stuck_timeout_s").is_some() {
                    "stuck"
                } else {
                    "timeout"
                };
                Some((name.clone(), reason))
            } else {
                None
            }
        });
        if let Some((name, reason)) = fallback {
            (Some(name), reason)
        } else {
            (None, "timeout")
        }
    };
    let Some(bad_at) = bad_at else {
        return items;
    };
    if items.is_empty() {
        items.push(BlockingItem {
            stage: "*".to_string(),
            deps: Vec::new(),
            reason: reason.to_string(),
            missing_deps: Vec::new(),
            bad_outputs: Vec::new(),
            blocked_by: Some(bad_at.clone()),
            bad_at: Some(bad_at),
            bad_kind: Some(BadKind::Timeout),
        });
        return items;
    }
    for it in &mut items {
        it.bad_kind = Some(BadKind::Timeout);
        it.bad_at = Some(bad_at.clone());
        it.blocked_by = Some(bad_at.clone());
        it.reason = reason.to_string();
    }
    items
}

fn explain_blocking_cancel(st: &RunState, items: Vec<BlockingItem>) -> Vec<BlockingItem> {
    if !st.cancel_requested {
        return items;
    }
    let bad_at = st
        .stages
        .iter()
        .find(|(_, r)| matches!(r.status, StageStatus::RUNNING))
        .map(|(k, _)| k.clone())
        .unwrap_or_else(|| "*".to_string());

    vec![BlockingItem {
        stage: "*".to_string(),
        deps: Vec::new(),
        reason: "cancel_requested".to_string(),
        missing_deps: Vec::new(),
        bad_outputs: Vec::new(),
        blocked_by: Some(bad_at.clone()),
        bad_at: Some(bad_at),
        bad_kind: Some(BadKind::Cancelled),
    }]
}

fn explain_video_shots_cancel(st: &RunState, mut vs: VideoShotsSummary) -> VideoShotsSummary {
    if !st.cancel_requested {
        return vs;
    }
    let cancel_at = st
        .cancel_requested_at
        .as_deref()
        .and_then(|v| chrono::DateTime::parse_from_rfc3339(v).ok())
        .map(|t| t.with_timezone(&chrono::Utc));
    let mut interpreted_cancelled = 0usize;
    let mut interpreted_from_running = 0usize;
    let mut interpreted_from_succeeded = 0usize;
    for (k, r) in &st.stages {
        if !is_video_shot_stage(k) {
            continue;
        }
        if matches!(r.status, StageStatus::RUNNING) {
            interpreted_cancelled += 1;
            interpreted_from_running += 1;
            continue;
        }
        if matches!(r.status, StageStatus::SUCCEEDED) {
            let started_at = r
                .started_at
                .as_deref()
                .and_then(|v| chrono::DateTime::parse_from_rfc3339(v).ok())
                .map(|t| t.with_timezone(&chrono::Utc));
            let ended_at = r
                .ended_at
                .as_deref()
                .and_then(|v| chrono::DateTime::parse_from_rfc3339(v).ok())
                .map(|t| t.with_timezone(&chrono::Utc));
            if let (Some(ca), Some(sa), Some(ea)) = (cancel_at, started_at, ended_at) {
                if sa <= ca && ea >= ca {
                    interpreted_cancelled += 1;
                    interpreted_from_succeeded += 1;
                }
            }
        }
    }
    if interpreted_cancelled > 0 {
        vs.cancelled = vs.cancelled.saturating_add(interpreted_cancelled);
        vs.running = vs.running.saturating_sub(interpreted_from_running);
        vs.succeeded = vs.succeeded.saturating_sub(interpreted_from_succeeded);
    }
    vs.ready = 0;
    vs
}

fn is_timeout_record(rec: &crate::run_state::StageRecord) -> bool {
    if rec.error.as_deref() == Some("timeout") {
        return true;
    }
    rec.meta
        .get("kind")
        .and_then(|v| v.as_str())
        .map(|s| s == "timeout")
        .unwrap_or(false)
}

fn timeout_reason(rec: &crate::run_state::StageRecord) -> String {
    let timeout_s = rec
        .meta
        .get("timeout_s")
        .and_then(|v| v.as_u64())
        .or(rec.timeout_seconds);
    match timeout_s {
        Some(v) => format!("timeout timeout_s={v}"),
        None => "timeout".to_string(),
    }
}

fn compute_blocking_v17(st: &RunState, eval_order: &[String]) -> Vec<BlockingItem> {
    let mut out = Vec::<BlockingItem>::new();
    for stage in eval_order {
        let Some(rec) = st.stages.get(stage) else {
            continue;
        };
        if !matches!(rec.status, StageStatus::PENDING) {
            continue;
        }

        let deps = deps_of(st, stage);
        let mut blocked_by: Option<String> = None;
        let mut bad_kind: Option<BadKind> = None;
        let mut reason = String::new();
        let mut missing_deps = Vec::<String>::new();
        let mut bad_outputs = Vec::<String>::new();

        for dep_name in deps.iter() {
            let Some(dep) = st.stages.get(dep_name) else {
                blocked_by = Some(dep_name.clone());
                bad_kind = Some(BadKind::Missing);
                reason = "missing".to_string();
                missing_deps.push(dep_name.clone());
                break;
            };

            if matches!(dep.status, StageStatus::FAILED) {
                blocked_by = Some(dep_name.clone());
                if is_timeout_record(dep) {
                    bad_kind = Some(BadKind::Timeout);
                    reason = timeout_reason(dep);
                } else {
                    bad_kind = Some(BadKind::Failed);
                    reason = dep.error.clone().unwrap_or_else(|| "failed".to_string());
                }
                break;
            }

            if !matches!(dep.status, StageStatus::SUCCEEDED | StageStatus::SKIPPED) {
                blocked_by = Some(dep_name.clone());
                bad_kind = Some(BadKind::Gate);
                reason = format!("waiting {:?}", dep.status);
                missing_deps.push(dep_name.clone());
                break;
            }

            let dep_bad_outputs = bad_outputs_for_run(st, dep);
            if !dep_bad_outputs.is_empty() {
                blocked_by = Some(dep_name.clone());
                bad_kind = Some(BadKind::Missing);
                reason = "bad_outputs".to_string();
                bad_outputs = dep_bad_outputs;
                break;
            }
        }

        if let Some(bb) = blocked_by {
            out.push(BlockingItem {
                stage: stage.clone(),
                deps: deps.clone(),
                reason,
                missing_deps,
                bad_outputs,
                blocked_by: Some(bb.clone()),
                bad_at: Some(bb),
                bad_kind,
            });
        }
    }
    out
}

fn file_ok(p: &Path) -> bool {
    std::fs::metadata(p)
        .map(|m| m.is_file() && m.len() > 0)
        .unwrap_or(false)
}

fn file_ok_for_run(st: &RunState, p: &std::path::PathBuf) -> bool {
    let abs = if p.is_absolute() {
        p.clone()
    } else {
        st.config.out_dir.join(p)
    };
    file_ok(&abs)
}

fn subtitles_rel_path(st: &RunState) -> String {
    st.commands
        .get("subtitles")
        .and_then(|s| s.get("path"))
        .and_then(|v| v.as_str())
        .unwrap_or("./build/subtitles.ass")
        .to_string()
}

fn subtitles_bytes_for_run(st: &RunState) -> u64 {
    let rel = subtitles_rel_path(st);
    let p = std::path::PathBuf::from(rel);
    let abs = if p.is_absolute() {
        p
    } else {
        st.config.out_dir.join(p)
    };
    std::fs::metadata(abs).map(|m| m.len()).unwrap_or(0)
}

fn is_video_shot_stage(name: &str) -> bool {
    name.starts_with("video_shot_") || name.starts_with("video.shot:")
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
            StageStatus::FAILED => {
                out.failed += 1;
                if rec.error.as_deref().unwrap_or("").contains("timeout")
                    || rec
                        .meta
                        .get("kind")
                        .and_then(|v| v.as_str())
                        .map(|s| s == "timeout")
                        .unwrap_or(false)
                {
                    out.timed_out += 1;
                }
            }
            StageStatus::RUNNING => out.running += 1,
            StageStatus::PENDING => out.pending += 1,
            StageStatus::SKIPPED | StageStatus::CANCELLED => out.skipped += 1,
        }
    }

    out.ready = ready.iter().filter(|s| is_video_shot_stage(s)).count();
    let running_list_n = running.iter().filter(|s| is_video_shot_stage(s)).count();
    if running_list_n > out.running {
        out.running = running_list_n;
    }
    if st.cancel_requested {
        out.cancelled = running.iter().filter(|s| is_video_shot_stage(s)).count();
        out.running = 0;
        out.ready = 0;
    }

    out
}

fn compute_video_summary(st: &RunState) -> VideoSummary {
    let mut out = VideoSummary::default();
    for key in ["video_plan", "video_assemble"] {
        let Some(rec) = st.stages.get(key) else {
            continue;
        };
        if key == "video_plan" {
            out.plan = Some(rec.status.clone());
        } else {
            out.assemble = Some(rec.status.clone());
        }
        match rec.status {
            StageStatus::PENDING => out.pending += 1,
            StageStatus::RUNNING => {
                if st.cancel_requested {
                    out.cancelled += 1;
                } else {
                    out.running += 1;
                }
            }
            StageStatus::SUCCEEDED => out.succeeded += 1,
            StageStatus::FAILED => {
                out.failed += 1;
                if rec.error.as_deref().unwrap_or("").contains("timeout")
                    || rec
                        .meta
                        .get("kind")
                        .and_then(|v| v.as_str())
                        .map(|s| s == "timeout")
                        .unwrap_or(false)
                {
                    out.timed_out += 1;
                }
            }
            StageStatus::SKIPPED | StageStatus::CANCELLED => out.skipped += 1,
        }
    }
    let plan_done = matches!(
        out.plan,
        Some(StageStatus::SUCCEEDED) | Some(StageStatus::SKIPPED)
    );
    let assemble_done = matches!(
        out.assemble,
        Some(StageStatus::SUCCEEDED) | Some(StageStatus::SKIPPED)
    );
    out.progress = (plan_done as u8) + (assemble_done as u8);

    let plan_failed = matches!(out.plan, Some(StageStatus::FAILED));
    let assemble_failed = matches!(out.assemble, Some(StageStatus::FAILED));
    if plan_failed || assemble_failed {
        out.progress_reason = Some(VideoProgressReason::Failed);
        out.reason_stage = Some(if plan_failed {
            VideoReasonStage::VideoPlan
        } else {
            VideoReasonStage::VideoAssemble
        });
        return out;
    }

    let plan_timeout = st
        .stages
        .get("video_plan")
        .map(|r| err_has_timeout(&r.error))
        .unwrap_or(false);
    let assemble_timeout = st
        .stages
        .get("video_assemble")
        .map(|r| err_has_timeout(&r.error))
        .unwrap_or(false);
    if plan_timeout || assemble_timeout {
        out.progress_reason = Some(VideoProgressReason::Timeout);
        out.reason_stage = Some(if plan_timeout {
            VideoReasonStage::VideoPlan
        } else {
            VideoReasonStage::VideoAssemble
        });
        return out;
    }

    if st.cancel_requested {
        let plan_open = matches!(
            out.plan,
            Some(StageStatus::PENDING) | Some(StageStatus::RUNNING)
        );
        let assemble_open = matches!(
            out.assemble,
            Some(StageStatus::PENDING) | Some(StageStatus::RUNNING)
        );
        if plan_open || assemble_open {
            out.progress_reason = Some(VideoProgressReason::Cancelled);
            out.reason_stage = Some(if plan_open {
                VideoReasonStage::VideoPlan
            } else {
                VideoReasonStage::VideoAssemble
            });
        }
    }
    out
}

fn compute_lyrics_variants_summary(
    st: &RunState,
    ready: &[String],
    running: &[String],
) -> LyricsVariantsSummary {
    let mut out = LyricsVariantsSummary::default();

    for (name, rec) in &st.stages {
        if !name.starts_with("lyrics:") {
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

    out.ready = ready.iter().filter(|s| s.starts_with("lyrics:")).count();
    let running_list_n = running.iter().filter(|s| s.starts_with("lyrics:")).count();
    if running_list_n > out.running {
        out.running = running_list_n;
    }
    out
}

fn compute_vocals_variants_summary(
    st: &RunState,
    ready: &[String],
    running: &[String],
) -> VocalsVariantsSummary {
    let mut out = VocalsVariantsSummary::default();
    let is_variant = |name: &str| name.starts_with("vocals:") && name.ends_with(":main");

    for (name, rec) in &st.stages {
        if !is_variant(name) {
            continue;
        }
        out.total += 1;
        match rec.status {
            StageStatus::SUCCEEDED => out.succeeded += 1,
            StageStatus::FAILED => out.failed += 1,
            StageStatus::RUNNING => out.running += 1,
            StageStatus::PENDING => out.pending += 1,
            StageStatus::SKIPPED => out.skipped += 1,
            StageStatus::CANCELLED => out.skipped += 1,
        }
    }

    out.ready = ready.iter().filter(|s| is_variant(s)).count();
    let running_list_n = running.iter().filter(|s| is_variant(s)).count();
    if running_list_n > out.running {
        out.running = running_list_n;
    }
    out
}

fn bad_outputs_for_run(st: &RunState, rec: &crate::run_state::StageRecord) -> Vec<String> {
    rec.outputs
        .iter()
        .filter(|p| !file_ok_for_run(st, p))
        .map(|p| p.display().to_string())
        .collect()
}

fn compute_blocking(st: &RunState) -> Vec<BlockingItem> {
    let mut out = Vec::<BlockingItem>::new();
        if st.cancel_requested {
            out.push(BlockingItem {
                stage: "_run".into(),
                deps: Vec::new(),
                reason: "cancel_requested".into(),
                missing_deps: Vec::new(),
                bad_outputs: Vec::new(),
                blocked_by: None,
                bad_at: Some("run".to_string()),
                bad_kind: Some(BadKind::Cancelled),
            });
        return out;
    }

    for (stage, rec) in &st.stages {
        if !matches!(rec.status, StageStatus::PENDING) {
            continue;
        }

        if stage.starts_with("video_shot_") || stage.starts_with("video.shot:") {
            let mut missing = Vec::<String>::new();
            if let Some(plan) = st.stages.get("video_plan") {
                if !plan.outputs.iter().all(|p| file_ok_for_run(st, p)) {
                    missing.push("video_plan".into());
                }
            } else {
                missing.push("video_plan".into());
            }
            if !missing.is_empty() {
                out.push(BlockingItem {
                    stage: stage.clone(),
                    deps: missing.clone(),
                    reason: "waiting_deps".into(),
                    missing_deps: missing,
                    bad_outputs: Vec::new(),
                    blocked_by: None,
                    bad_at: None,
                    bad_kind: Some(BadKind::Gate),
                });
                continue;
            }
        }

        if stage == "video_assemble" {
            let mut shots: Vec<String> = st
                .stages
                .keys()
                .filter(|k| k.starts_with("video_shot_") || k.starts_with("video.shot:"))
                .cloned()
                .collect();
            shots.sort();
            if shots.is_empty() {
                out.push(BlockingItem {
                    stage: stage.clone(),
                    deps: Vec::new(),
                    reason: "no_shots".into(),
                    missing_deps: Vec::new(),
                    bad_outputs: Vec::new(),
                    blocked_by: None,
                    bad_at: None,
                    bad_kind: Some(BadKind::Missing),
                });
                continue;
            }
            let mut missing = Vec::<String>::new();
            for shot in shots {
                let Some(r) = st.stages.get(&shot) else {
                    missing.push(shot);
                    continue;
                };
                if !matches!(r.status, StageStatus::SUCCEEDED) {
                    missing.push(shot);
                    continue;
                }
                if !r.outputs.iter().all(|p| file_ok_for_run(st, p)) {
                    missing.push(shot);
                }
            }
            if !missing.is_empty() {
                out.push(BlockingItem {
                    stage: stage.clone(),
                    deps: missing.clone(),
                    reason: "waiting_shots".into(),
                    missing_deps: missing,
                    bad_outputs: Vec::new(),
                    blocked_by: None,
                    bad_at: None,
                    bad_kind: Some(BadKind::Gate),
                });
                continue;
            }
        }

        let deps = deps_of(st, stage);
        let mut missing = Vec::<String>::new();
        for dep_name in deps {
            let Some(dep) = st.stages.get(&dep_name) else {
                missing.push(dep_name);
                continue;
            };
            if !matches!(dep.status, StageStatus::SUCCEEDED | StageStatus::SKIPPED) {
                missing.push(dep_name);
                continue;
            }
            if !dep.outputs.iter().all(|p| file_ok_for_run(st, p)) {
                missing.push(dep_name);
            }
        }

        if !missing.is_empty() {
            out.push(BlockingItem {
                stage: stage.clone(),
                deps: missing.clone(),
                reason: "waiting_deps".into(),
                missing_deps: missing,
                bad_outputs: Vec::new(),
                blocked_by: None,
                bad_at: None,
                bad_kind: Some(BadKind::Gate),
            });
            continue;
        }

        let bo = bad_outputs_for_run(st, rec);
        if !bo.is_empty() {
            out.push(BlockingItem {
                stage: stage.clone(),
                deps: Vec::new(),
                reason: "bad_outputs".into(),
                missing_deps: Vec::new(),
                bad_outputs: bo,
                blocked_by: None,
                bad_at: None,
                bad_kind: Some(BadKind::Missing),
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
    if st.cancel_requested && !matches!(st.status, crate::run_state::RunStatus::CANCELLED) {
        return "cancel requested".into();
    }
    if matches!(st.status, crate::run_state::RunStatus::FAILED) {
        if let Some((k, msg)) = collect_failures(st).first() {
            return format!("failed: {}: {}", k, msg);
        }
        return "failed".into();
    }
    if matches!(st.status, crate::run_state::RunStatus::CANCELLED) {
        return "cancelled".into();
    }
    if matches!(st.status, crate::run_state::RunStatus::SUCCEEDED) {
        return "done".into();
    }
    if !view.running.is_empty() {
        return format!("running: {}", view.running.len());
    }
    if !view.ready.is_empty() {
        return format!("ready: {}", view.ready.len());
    }
    if let Some(b) = view.blocking.first() {
        if !b.deps.is_empty() {
            return format!("blocked: {} waiting: {}", b.stage, b.deps.join(","));
        }
        if !b.missing_deps.is_empty() {
            return format!("blocked: {} waiting: {}", b.stage, b.missing_deps.join(","));
        }
        if !b.bad_outputs.is_empty() {
            return format!("blocked: {} bad_outputs", b.stage);
        }
        return format!("blocked: {}", b.stage);
    }
    "idle".into()
}

pub fn all_done(st: &RunState) -> bool {
    st.stages.values().all(|r| {
        matches!(
            r.status,
            StageStatus::SUCCEEDED | StageStatus::FAILED | StageStatus::SKIPPED
        )
    })
}
