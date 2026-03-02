use crate::run_state::{RunState, StageStatus};
use serde::{Deserialize, Serialize};
use std::path::Path;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReadyView {
    pub topo_order: Vec<String>,
    pub ready: Vec<String>,
    pub running: Vec<String>,
    pub summary: ReadySummary,
    pub video_shots: VideoShotsSummary,
    pub counters: ReadyCounters,
    pub running_pids: Vec<RunningPid>,
    pub mix: MixSummary,
    pub subtitles: SubtitlesSummary,
    pub blocking: Vec<BlockingItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, ToSchema)]
pub struct BlockingItem {
    pub stage: String,
    pub reason: String,
    pub missing_deps: Vec<String>,
    pub bad_outputs: Vec<String>,
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
pub struct ReadySummary {
    pub total: usize,
    pub pending: usize,
    pub running: usize,
    pub succeeded: usize,
    pub failed: usize,
    pub skipped: usize,
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
    let file_ok = |p: &std::path::PathBuf| {
        crate::artifacts::file_ok_at(&st.config.out_dir, p)
    };
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
        return ok("lyrics")
            && ok("music")
            && ok("vocals")
            && ok("video_assemble")
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

    let video_shots = compute_video_shots_summary(st, &ready, &running);
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
    let blocking = compute_blocking(st, &ready);

    ReadyView {
        topo_order: eval_order,
        ready,
        running,
        summary,
        video_shots,
        counters,
        running_pids,
        mix,
        subtitles,
        blocking,
    }
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

fn compute_blocking(st: &RunState, ready: &[String]) -> Vec<BlockingItem> {
    let mut out = Vec::<BlockingItem>::new();
    if st.cancel_requested {
        out.push(BlockingItem {
            stage: "_run".into(),
            reason: "cancel_requested".into(),
            missing_deps: Vec::new(),
            bad_outputs: Vec::new(),
        });
        return out;
    }
    if !ready.is_empty() {
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
                    reason: "waiting_deps".into(),
                    missing_deps: missing,
                    bad_outputs: Vec::new(),
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
                    reason: "no_shots".into(),
                    missing_deps: Vec::new(),
                    bad_outputs: Vec::new(),
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
                    reason: "waiting_shots".into(),
                    missing_deps: missing,
                    bad_outputs: Vec::new(),
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
                reason: "waiting_deps".into(),
                missing_deps: missing,
                bad_outputs: Vec::new(),
            });
            continue;
        }

        let bo = bad_outputs_for_run(st, rec);
        if !bo.is_empty() {
            out.push(BlockingItem {
                stage: stage.clone(),
                reason: "bad_outputs".into(),
                missing_deps: Vec::new(),
                bad_outputs: bo,
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
