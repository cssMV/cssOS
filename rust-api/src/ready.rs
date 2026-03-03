use crate::run_state::{RunState, StageStatus};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
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
    pub stage_seq: u64,
    pub last_event: Option<ReadyEvent>,
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
                || m
                    .get("gate")
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

fn dedup_and_sort_blocking(st: &RunState, mut items: Vec<BlockingItem>, limit: usize) -> Vec<BlockingItem> {
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

pub fn build_summary_i18n(st: &RunState, view: &ReadyView, lang: &str) -> String {
    if st.cancel_requested && !matches!(st.status, crate::run_state::RunStatus::CANCELLED) {
        return crate::i18n::t(lang, "cancel_requested").into();
    }
    if matches!(st.status, crate::run_state::RunStatus::FAILED) {
        if let Some((k, msg)) = collect_failures(st).first() {
            return format!("{}: {}: {}", crate::i18n::t(lang, "failed"), k, msg);
        }
        return crate::i18n::t(lang, "failed").into();
    }
    if matches!(st.status, crate::run_state::RunStatus::CANCELLED) {
        return crate::i18n::t(lang, "cancelled").into();
    }
    if matches!(st.status, crate::run_state::RunStatus::SUCCEEDED) {
        return crate::i18n::t(lang, "done").into();
    }
    if !view.running.is_empty() {
        return format!("{}: {}", crate::i18n::t(lang, "running"), view.running.len());
    }
    if !view.ready.is_empty() {
        return format!("{}: {}", crate::i18n::t(lang, "ready"), view.ready.len());
    }
    if let Some(b) = view.blocking.first() {
        if !b.chain.is_empty() {
            return format!("{}: {}", crate::i18n::t(lang, "blocked"), b.chain.join(" -> "));
        }
        if let Some(reason) = &b.reason {
            return format!(
                "{}: {} {}",
                crate::i18n::t(lang, "blocked"),
                b.stage,
                reason
            );
        }
        return format!("{}: {}", crate::i18n::t(lang, "blocked"), b.stage);
    }
    crate::i18n::t(lang, "idle").into()
}

pub fn all_done(st: &RunState) -> bool {
    st.stages.values().all(|r| {
        matches!(
            r.status,
            StageStatus::SUCCEEDED | StageStatus::FAILED | StageStatus::SKIPPED
        )
    })
}
