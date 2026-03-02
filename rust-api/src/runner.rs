use crate::dag::{cssmv_dag_v1, Dag};
use crate::dag_export;
use crate::dag_viz_html;
use crate::events;
use crate::metrics;
use crate::procutil;
use crate::ready::{compute_ready_view_with_dag_limited, stage_ready as ready_stage_ready};
use crate::run_state::{RunState, RunStatus, StageRecord, StageStatus};
use crate::run_state_io::save_state_atomic;
use crate::run_store;
use crate::scheduler::Scheduler;
use crate::video::duration::probe_media_duration_s;
use crate::video::storyboard::{ensure_storyboard_auto, AutoShotConfig};
use anyhow::Result;
use chrono::Utc;
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio::sync::{oneshot, Mutex, RwLock, Semaphore};
use tokio::task::JoinSet;
use tokio::time::sleep as tokio_sleep;

pub fn now_rfc3339() -> String {
    Utc::now().to_rfc3339()
}

fn output_exists(run_out_dir: &Path, p: &PathBuf) -> bool {
    crate::artifacts::file_ok_at(run_out_dir, p)
}

fn stage_done_by_outputs(run_out_dir: &Path, outputs: &[PathBuf]) -> bool {
    !outputs.is_empty() && outputs.iter().all(|p| output_exists(run_out_dir, p))
}

fn validate_outputs_nonempty(run_out_dir: &Path, outputs: &[PathBuf]) -> Result<()> {
    if outputs.is_empty() {
        anyhow::bail!("output invalid: no outputs");
    }
    if !crate::artifacts::outputs_ok_at(run_out_dir, outputs) {
        for p in outputs {
            if !crate::artifacts::file_ok_at(run_out_dir, p) {
                let path = if p.is_absolute() {
                    p.clone()
                } else {
                    run_out_dir.join(p)
                };
                anyhow::bail!("output invalid: {}", path.display());
            }
        }
    }
    Ok(())
}

fn persist_state(state_path: &Path, state: &RunState) -> Result<()> {
    let mut next = state.clone();
    if let Ok(prev) = crate::run_state_io::read_run_state(state_path) {
        if prev.cancel_requested {
            next.cancel_requested = true;
            if next.cancel_requested_at.is_none() {
                next.cancel_requested_at = prev.cancel_requested_at.clone();
            }
        }
    }
    save_state_atomic(state_path, &next)?;
    Ok(())
}

fn stage_plan(
    compiled: &crate::dsl::compile::CompiledCommands,
) -> BTreeMap<&'static str, (String, Vec<PathBuf>)> {
    BTreeMap::from([
        (
            "lyrics",
            (
                compiled.lyrics.clone(),
                vec![PathBuf::from("./build/lyrics.json")],
            ),
        ),
        (
            "music",
            (
                compiled.music.clone(),
                vec![PathBuf::from("./build/music.wav")],
            ),
        ),
        (
            "vocals",
            (
                compiled.vocals.clone(),
                vec![PathBuf::from("./build/vocals.wav")],
            ),
        ),
        (
            "video_plan",
            (
                "internal:video_plan".to_string(),
                vec![PathBuf::from("./video/storyboard.json")],
            ),
        ),
        (
            "video_assemble",
            (
                "echo video assemble by internal dispatch".to_string(),
                vec![PathBuf::from("./build/video/video.mp4")],
            ),
        ),
        (
            "mix",
            (
                "internal:mix".to_string(),
                vec![PathBuf::from("./build/mix.wav")],
            ),
        ),
        (
            "subtitles",
            (
                "internal:subtitles".to_string(),
                vec![PathBuf::from("./build/subtitles.ass")],
            ),
        ),
        (
            "render",
            (compiled.render.clone(), vec![PathBuf::from("./build/final_mv.mp4")]),
        ),
    ])
}

fn backoff_delay(base: u64, attempt: u32) -> u64 {
    base * (2u64.pow(attempt))
}

fn is_video_stage(stage: &str) -> bool {
    stage == "video"
        || stage == "video_plan"
        || stage == "video_assemble"
        || stage == "mix"
        || stage == "subtitles"
        || stage == "render"
        || is_video_shot_stage(stage)
}

fn is_video_shot_stage(stage: &str) -> bool {
    stage.starts_with("video_shot_") || stage.starts_with("video.shot:")
}

fn shot_stage_name_from_storyboard_id(id: &str) -> String {
    if let Some(rest) = id.strip_prefix("video_shot_") {
        return format!("video.shot:shot_{rest}");
    }
    format!("video.shot:{id}")
}

fn storyboard_id_from_shot_stage(stage: &str) -> Option<String> {
    if let Some(id) = stage.strip_prefix("video_shot_") {
        return Some(format!("video_shot_{id}"));
    }
    if let Some(id) = stage.strip_prefix("video.shot:") {
        if id.starts_with("video_shot_") {
            return Some(id.to_string());
        }
        if let Some(rest) = id.strip_prefix("shot_") {
            return Some(format!("video_shot_{rest}"));
        }
        return Some(id.to_string());
    }
    None
}

fn update_video_artifacts_from_outputs(state: &mut RunState, outputs: &[PathBuf]) {
    let mut shot_count: Option<usize> = None;
    let mut shots_dir: Option<PathBuf> = None;
    for p in outputs {
        let p_str = p.to_string_lossy();
        if p_str.ends_with("storyboard.json") {
            state.set_artifact_path(
                "video.storyboard",
                serde_json::json!(p.display().to_string()),
            );
            if let Ok(bytes) = fs::read(p) {
                if let Ok(sb) =
                    serde_json::from_slice::<crate::video::storyboard::StoryboardV1>(&bytes)
                {
                    shot_count = Some(sb.shots.len());
                }
            }
        }
        if p_str.ends_with("/video.mp4") || p_str.ends_with("\\video.mp4") {
            state.set_artifact_path(
                "video.video_mp4",
                serde_json::json!(p.display().to_string()),
            );
        }
        if p_str.contains("/video/shots/") || p_str.contains("\\video\\shots\\") {
            if let Some(parent) = p.parent() {
                shots_dir = Some(parent.to_path_buf());
            }
        }
    }
    if let Some(d) = shots_dir {
        state.set_artifact_path(
            "video.shots_dir",
            serde_json::json!(d.display().to_string()),
        );
    }
    if let Some(n) = shot_count {
        state.set_artifact_path("video.shots_count", serde_json::json!(n));
        state.video_shots_total = Some(n as u32);
    }
}

fn maybe_expand_video_shots(state: &mut RunState) -> bool {
    if state.stages.keys().any(|k| is_video_shot_stage(k)) {
        return false;
    }
    let sb_path = state.config.out_dir.join("video").join("storyboard.json");
    if !sb_path.exists() {
        return false;
    }
    let Ok(bytes) = fs::read(&sb_path) else {
        return false;
    };
    let Ok(sb) = serde_json::from_slice::<crate::video::storyboard::StoryboardV1>(&bytes) else {
        return false;
    };
    let mut ids: Vec<String> = sb.shots.iter().map(|s| s.id.clone()).collect();
    let mut n = ids.len();
    if n < 8 {
        n = 8;
    }
    if n > 36 {
        n = 36;
    }
    if ids.len() > n {
        ids.truncate(n);
    } else if ids.len() < n {
        for i in ids.len()..n {
            ids.push(format!("video_shot_{:03}", i));
        }
    }

    for sid in &ids {
        let stage_name = shot_stage_name_from_storyboard_id(sid);
        state
            .stages
            .entry(stage_name.clone())
            .or_insert(StageRecord {
                status: StageStatus::PENDING,
                started_at: None,
                ended_at: None,
                exit_code: None,
                command: None,
                outputs: vec![state
                    .config
                    .out_dir
                    .join("build")
                    .join("video")
                    .join("shots")
                    .join(format!("{}.mp4", sid))],
                retries: 0,
                error: None,
                heartbeat_at: None,
                last_heartbeat_at: None,
                timeout_seconds: Some(state.config.stage_timeout_seconds),
                error_code: None,
                pid: None,
                pgid: None,
                meta: serde_json::Value::Object(Default::default()),
                duration_seconds: None,
            });
        state
            .dag_edges
            .entry(stage_name)
            .or_insert_with(|| vec!["video_plan".to_string()]);
    }

    let mut new_order: Vec<String> = Vec::new();
    let mut shot_nodes: Vec<String> = Vec::new();
    for st in &state.topo_order {
        if st == "video_assemble" {
            for sid in &ids {
                let shot = shot_stage_name_from_storyboard_id(sid);
                new_order.push(shot.clone());
                shot_nodes.push(shot);
            }
        }
        new_order.push(st.clone());
    }
    state.topo_order = new_order;
    state
        .dag_edges
        .insert("video_assemble".to_string(), shot_nodes);
    for sid in &ids {
        let shot = shot_stage_name_from_storyboard_id(sid);
        if !state.dag.nodes.iter().any(|n| n.name == shot) {
            state.dag.nodes.push(crate::run_state::DagNodeMeta {
                name: shot,
                deps: vec!["video_plan".to_string()],
            });
        }
    }
    if let Some(n) = state.dag.nodes.iter_mut().find(|n| n.name == "video_assemble") {
        n.deps = state
            .dag_edges
            .get("video_assemble")
            .cloned()
            .unwrap_or_default();
    }
    state.video_shots_total = Some(n as u32);
    state.set_artifact_path("video.shots_count", serde_json::json!(n));
    true
}

fn fill_dag_edges(state: &mut RunState, dag: &Dag) {
    let mut edges: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for node in &dag.nodes {
        edges.insert(
            node.name.to_string(),
            node.deps.iter().map(|d| (*d).to_string()).collect(),
        );
    }
    state.dag_edges = edges;
    state.dag.nodes = dag
        .nodes
        .iter()
        .map(|n| crate::run_state::DagNodeMeta {
            name: n.name.to_string(),
            deps: n.deps.iter().map(|d| (*d).to_string()).collect(),
        })
        .collect();
}

fn stage_stuck(state: &RunState, stage: &str, now: chrono::DateTime<Utc>) -> bool {
    let Some(sr) = state.stages.get(stage) else {
        return false;
    };
    if !matches!(sr.status, StageStatus::RUNNING) {
        return false;
    }
    let Some(hb) = sr
        .last_heartbeat_at
        .as_ref()
        .or(state.last_heartbeat_at.as_ref())
    else {
        return false;
    };
    let Ok(ts) = chrono::DateTime::parse_from_rfc3339(hb) else {
        return false;
    };
    (now - ts.with_timezone(&Utc)).num_seconds()
        > state
            .stuck_timeout_seconds
            .unwrap_or(state.config.stuck_timeout_seconds) as i64
}

fn backfill_last_heartbeat_from_legacy(state: &mut RunState) -> bool {
    let mut changed = false;
    if state.last_heartbeat_at.is_none() {
        if let Some(v) = state.heartbeat_at.clone() {
            state.last_heartbeat_at = Some(v);
            changed = true;
        }
    }
    for rec in state.stages.values_mut() {
        if rec.last_heartbeat_at.is_none() {
            if let Some(v) = rec.heartbeat_at.clone() {
                rec.last_heartbeat_at = Some(v);
                changed = true;
            }
        }
    }
    changed
}

fn stamp_run_heartbeat(state: &mut RunState) {
    let now = now_rfc3339();
    state.heartbeat_at = Some(now.clone());
    state.last_heartbeat_at = Some(now);
}

fn stamp_stage_heartbeat(rec: &mut StageRecord) {
    let now = now_rfc3339();
    rec.heartbeat_at = Some(now.clone());
    rec.last_heartbeat_at = Some(now);
}

fn run_id_from_state_path(state_path: &Path) -> String {
    state_path
        .parent()
        .and_then(|p| p.file_name())
        .and_then(|s| s.to_str())
        .unwrap_or("unknown")
        .to_string()
}

fn spawn_stage_heartbeat_task(
    state_path: PathBuf,
    stage: String,
    hb_ms: u64,
    flush_min_ms: u64,
    run_id: String,
) -> oneshot::Sender<()> {
    let (tx, mut rx) = oneshot::channel::<()>();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_millis(hb_ms.max(50)));
        interval.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Delay);
        loop {
            tokio::select! {
                _ = interval.tick() => {
                    let mut s = match crate::run_state_io::read_run_state_async(&state_path).await {
                        Ok(v) => v,
                        Err(_) => continue,
                    };
                    if matches!(s.status, RunStatus::CANCELLED) || s.cancel_requested {
                        let mut pgid_to_kill: Option<i32> = None;
                        let mut pid_to_kill: Option<i32> = None;
                        if let Some(rec) = s.stages.get(&stage) {
                            pgid_to_kill = rec.pgid;
                            pid_to_kill = rec.pid;
                        }
                        let kill_grace_ms: u64 = std::env::var("CSS_KILL_GRACE_MS")
                            .ok()
                            .and_then(|x| x.parse::<u64>().ok())
                            .unwrap_or(1500);
                        if let Some(g) = pgid_to_kill.or(pid_to_kill) {
                            crate::procutil::kill_pgid_term_then_kill(g);
                            tokio::time::sleep(Duration::from_millis(kill_grace_ms)).await;
                            crate::procutil::kill_pgid_kill(g);
                        }
                        if let Some(rec) = s.stages.get_mut(&stage) {
                            if matches!(rec.status, StageStatus::RUNNING) {
                                rec.status = StageStatus::FAILED;
                                rec.exit_code = Some(130);
                                rec.error = Some("cancelled".to_string());
                                rec.error_code = Some("CANCELLED".to_string());
                                rec.ended_at = Some(now_rfc3339());
                                rec.pid = None;
                                rec.pgid = None;
                                stamp_stage_heartbeat(rec);
                            }
                        }
                        stamp_run_heartbeat(&mut s);
                        s.updated_at = now_rfc3339();
                        let _ = crate::run_state_io::atomic_write_run_state_throttled(
                            &state_path,
                            &run_id,
                            &s,
                            0,
                            true,
                        )
                        .await;
                        break;
                    }
                    let mut should_stop = true;
                    if let Some(rec) = s.stages.get_mut(&stage) {
                        if matches!(rec.status, StageStatus::RUNNING) {
                            stamp_stage_heartbeat(rec);
                            should_stop = false;
                        }
                    }
                    if should_stop {
                        break;
                    }
                    stamp_run_heartbeat(&mut s);
                    s.updated_at = now_rfc3339();
                    let _ = crate::run_state_io::atomic_write_run_state_throttled(
                        &state_path,
                        &run_id,
                        &s,
                        flush_min_ms,
                        false,
                    )
                    .await;
                }
                _ = &mut rx => {
                    break;
                }
            }
        }
    });
    tx
}

async fn run_cmd_async(
    stage: &str,
    command_line: &str,
    cwd: Option<&Path>,
    timeout_s: Option<u64>,
    state_path: Option<&Path>,
) -> Result<(i32, String, String, bool, bool, i32, i32)> {
    let mut cmd = Command::new("bash");
    cmd.arg("-lc").arg(command_line);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut spawned = procutil::spawn_pgroup(cmd)?;
    let pid = spawned.pid;
    let pgid = spawned.pgid;
    let run_id = state_path.map(run_id_from_state_path);
    let flush_min_ms = std::env::var("CSS_STATE_FLUSH_MIN_MS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(500);
    let heartbeat_ms = std::env::var("CSS_HEARTBEAT_MS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(1000);
    let mut last_hb = Instant::now();

    if let (Some(p), Some(run_id)) = (state_path, run_id.as_ref()) {
        if let Ok(mut st) = crate::run_state_io::read_run_state_async(p).await {
            if let Some(rec) = st.stages.get_mut(stage) {
                rec.pid = Some(pid);
                rec.pgid = Some(pgid);
                stamp_stage_heartbeat(rec);
            }
            stamp_run_heartbeat(&mut st);
            st.updated_at = now_rfc3339();
            let _ = crate::run_state_io::atomic_write_run_state_throttled(
                p,
                run_id,
                &st,
                0,
                true,
            )
            .await;
        }
    }

    let mut out = spawned
        .child
        .stdout
        .take()
        .ok_or_else(|| anyhow::anyhow!("child stdout missing for stage={stage}"))?;
    let mut err = spawned
        .child
        .stderr
        .take()
        .ok_or_else(|| anyhow::anyhow!("child stderr missing for stage={stage}"))?;

    let out_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        let _ = out.read_to_end(&mut buf).await;
        String::from_utf8_lossy(&buf).to_string()
    });
    let err_task = tokio::spawn(async move {
        let mut buf = Vec::new();
        let _ = err.read_to_end(&mut buf).await;
        String::from_utf8_lossy(&buf).to_string()
    });

    let start = Instant::now();
    let timeout_limit = timeout_s.unwrap_or(u64::MAX / 2);
    let cancel_grace_ms = std::env::var("CSS_CANCEL_GRACE_MS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(1500);
    let mut killed_by_cancel = false;
    let mut timed_out = false;

    let status = loop {
        if let Some(s) = spawned.child.try_wait()? {
            break s;
        }
        if let (Some(p), Some(run_id)) = (state_path, run_id.as_ref()) {
            if last_hb.elapsed() >= Duration::from_millis(heartbeat_ms.max(100)) {
                if let Ok(mut st) = crate::run_state_io::read_run_state_async(p).await {
                    if let Some(rec) = st.stages.get_mut(stage) {
                        if matches!(rec.status, StageStatus::RUNNING) {
                            stamp_stage_heartbeat(rec);
                        }
                    }
                    stamp_run_heartbeat(&mut st);
                    st.updated_at = now_rfc3339();
                    let _ = crate::run_state_io::atomic_write_run_state_throttled(
                        p,
                        run_id,
                        &st,
                        flush_min_ms,
                        false,
                    )
                    .await;
                }
                last_hb = Instant::now();
            }
        }
        let cancelled = if let Some(p) = state_path {
            match crate::run_store::read_run_state(p) {
                Ok(st) => st.cancel_requested,
                Err(_) => false,
            }
        } else {
            false
        };
        if cancelled {
            procutil::terminate_then_kill(pgid, cancel_grace_ms).await;
            killed_by_cancel = true;
            break spawned.child.wait().await?;
        }
        if start.elapsed() >= Duration::from_secs(timeout_limit) {
            procutil::terminate_then_kill(pgid, cancel_grace_ms).await;
            killed_by_cancel = true;
            timed_out = true;
            break spawned.child.wait().await?;
        }
        tokio_sleep(Duration::from_millis(200)).await;
    };

    let stdout = out_task.await.unwrap_or_default();
    let stderr = err_task.await.unwrap_or_default();
    let code = status.code().unwrap_or(-1);
    Ok((code, stdout, stderr, killed_by_cancel, timed_out, pid, pgid))
}

fn truncate_err(s: &str) -> String {
    const MAX: usize = 4000;
    if s.len() <= MAX {
        return s.to_string();
    }
    format!("{}...(truncated)", &s[..MAX])
}

async fn run_stage_with_retry(
    run_out_dir: &Path,
    name: &str,
    cmdline: &str,
    rec: &mut StageRecord,
    state_path: &Path,
    max_retries: u32,
    backoff_base: u64,
    timeout_s: Option<u64>,
) -> Result<bool> {
    let stage_started = Instant::now();
    for attempt in 0..=max_retries {
        rec.status = StageStatus::RUNNING;
        rec.retries = attempt;
        rec.started_at = Some(now_rfc3339());
        stamp_stage_heartbeat(rec);
        rec.error_code = None;
        rec.pid = None;
        rec.pgid = None;

        match run_cmd_async(name, cmdline, Some(run_out_dir), timeout_s, Some(state_path)).await {
            Ok((code, _stdout, stderr, killed, timed_out, pid, pgid)) if code == 0 => {
                rec.pid = Some(pid);
                rec.pgid = Some(pgid);
                if let Err(e) = validate_outputs_nonempty(run_out_dir, &rec.outputs) {
                    rec.exit_code = Some(1);
                    rec.ended_at = Some(now_rfc3339());
                    stamp_stage_heartbeat(rec);
                    rec.status = StageStatus::FAILED;
                    rec.error = Some(truncate_err(&e.to_string()));
                    rec.error_code = Some("OUTPUT_INVALID".to_string());
                    rec.pid = None;
                    rec.pgid = None;
                    rec.duration_seconds = Some(stage_started.elapsed().as_secs_f64());
                    if attempt < max_retries {
                        let delay = backoff_delay(backoff_base, attempt);
                        println!("Stage {} failed. Retrying in {} seconds...", name, delay);
                        tokio_sleep(Duration::from_secs(delay)).await;
                        continue;
                    }
                    return Ok(false);
                }
                rec.exit_code = Some(0);
                rec.ended_at = Some(now_rfc3339());
                stamp_stage_heartbeat(rec);
                rec.status = StageStatus::SUCCEEDED;
                rec.error = None;
                rec.error_code = None;
                rec.pid = None;
                rec.pgid = None;
                rec.duration_seconds = Some(stage_started.elapsed().as_secs_f64());
                return Ok(true);
            }
            Ok((code, _stdout, stderr, killed, timed_out, pid, pgid)) => {
                rec.pid = Some(pid);
                rec.pgid = Some(pgid);
                rec.exit_code = Some(code);
                rec.ended_at = Some(now_rfc3339());
                stamp_stage_heartbeat(rec);
                rec.status = StageStatus::FAILED;
                rec.error = Some(truncate_err(&stderr));
                rec.error_code = if timed_out {
                    Some("TIMEOUT_KILLED".to_string())
                } else if killed {
                    Some("CANCELLED_KILLED".to_string())
                } else {
                    Some("FAILED".to_string())
                };
                rec.pid = None;
                rec.pgid = None;
                rec.duration_seconds = Some(stage_started.elapsed().as_secs_f64());
            }
            Err(e) => {
                rec.exit_code = Some(-1);
                rec.ended_at = Some(now_rfc3339());
                stamp_stage_heartbeat(rec);
                rec.status = StageStatus::FAILED;
                rec.error = Some(truncate_err(&format!("{e:#}")));
                rec.error_code = Some("FAILED".to_string());
                rec.pid = None;
                rec.pgid = None;
                rec.duration_seconds = Some(stage_started.elapsed().as_secs_f64());
            }
        }

        if attempt < max_retries {
            let delay = backoff_delay(backoff_base, attempt);
            println!("Stage {} failed. Retrying in {} seconds...", name, delay);
            tokio_sleep(Duration::from_secs(delay)).await;
        }
    }

    Ok(false)
}

async fn run_video_stage_with_retry(
    run_out_dir: &Path,
    stage: &str,
    state: &mut RunState,
    rec: &mut StageRecord,
    max_retries: u32,
    backoff_base: u64,
    scheduler: &Scheduler,
) -> Result<bool> {
    let stage_started = Instant::now();
    for attempt in 0..=max_retries {
        rec.status = StageStatus::RUNNING;
        rec.retries = attempt;
        rec.started_at = Some(now_rfc3339());
        stamp_stage_heartbeat(rec);

        match crate::video_dispatch::run_one_stage_video_dispatch(stage, state, None, scheduler)
            .await
        {
            Ok(outputs) => {
                if let Err(e) = validate_outputs_nonempty(run_out_dir, &outputs) {
                    rec.exit_code = Some(1);
                    rec.ended_at = Some(now_rfc3339());
                    stamp_stage_heartbeat(rec);
                    rec.status = StageStatus::FAILED;
                    rec.error = Some(format!("Attempt {} failed: {}", attempt, e));
                    rec.duration_seconds = Some(stage_started.elapsed().as_secs_f64());
                    if attempt < max_retries {
                        let delay = backoff_delay(backoff_base, attempt);
                        println!("Stage {} failed. Retrying in {} seconds...", stage, delay);
                        tokio_sleep(Duration::from_secs(delay)).await;
                        continue;
                    }
                    return Ok(false);
                }
                rec.exit_code = Some(0);
                rec.outputs = outputs;
                rec.ended_at = Some(now_rfc3339());
                stamp_stage_heartbeat(rec);
                rec.status = StageStatus::SUCCEEDED;
                rec.error = None;
                rec.duration_seconds = Some(stage_started.elapsed().as_secs_f64());
                return Ok(true);
            }
            Err(e) => {
                rec.exit_code = Some(1);
                rec.ended_at = Some(now_rfc3339());
                stamp_stage_heartbeat(rec);
                rec.status = StageStatus::FAILED;
                rec.error = Some(format!("Attempt {} failed: {}", attempt, e));
                rec.duration_seconds = Some(stage_started.elapsed().as_secs_f64());

                if attempt < max_retries {
                    let delay = backoff_delay(backoff_base, attempt);
                    println!("Stage {} failed. Retrying in {} seconds...", stage, delay);
                    tokio_sleep(Duration::from_secs(delay)).await;
                }
            }
        }
    }

    Ok(false)
}

pub async fn run_pipeline(
    state_path: &Path,
    mut state: RunState,
    compiled: crate::dsl::compile::CompiledCommands,
) -> Result<RunState> {
    let run_started = Instant::now();
    let scheduler = Scheduler::new();
    let dag = cssmv_dag_v1();
    let order = dag.topo_order().unwrap_or_default();

    state.dag.schema = "css.pipeline.dag.v1".to_string();
    fill_dag_edges(&mut state, &dag);

    {
        let v = serde_json::to_value(&state).unwrap_or_else(|_| serde_json::json!({}));
        let dag_json_path = std::path::PathBuf::from("build/dag.json");
        let _ = dag_export::write_dag_json(&dag_json_path, &dag, &v);
        if let Ok(p) = std::fs::canonicalize(&dag_json_path) {
            state.set_artifact_path("graph.dag_json", serde_json::json!(p.display().to_string()));
        } else {
            state.set_artifact_path("graph.dag_json", serde_json::json!("build/dag.json"));
        }

        let dag_export_json = std::fs::read_to_string(&dag_json_path)
            .ok()
            .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
            .unwrap_or_else(|| serde_json::json!({}));
        let dag_html_path = std::path::PathBuf::from("build/dag.html");
        let _ = dag_viz_html::write_dag_html(&dag_html_path, &dag_export_json);
        if let Ok(p) = std::fs::canonicalize(&dag_html_path) {
            state.set_artifact_path("graph.dag_html", serde_json::json!(p.display().to_string()));
        } else {
            state.set_artifact_path("graph.dag_html", serde_json::json!("build/dag.html"));
        }
    }
    state.topo_order = order.iter().map(|s| s.to_string()).collect();

    state.status = RunStatus::RUNNING;
    state.updated_at = now_rfc3339();
    persist_state(state_path, &state)?;

    let plan = stage_plan(&compiled);

    for name in order {
        let stage = name.to_string();
        let (cmdline, outputs) = plan.get(name).expect("stage in plan").clone();

        state
            .stages
            .entry(stage.clone())
            .or_insert_with(|| StageRecord {
                status: StageStatus::PENDING,
                started_at: None,
                ended_at: None,
                exit_code: None,
                command: None,
                outputs: outputs.clone(),
                retries: 0,
                error: None,
                heartbeat_at: None,
                last_heartbeat_at: None,
                timeout_seconds: Some(state.config.stage_timeout_seconds),
                error_code: None,
                pid: None,
                pgid: None,
                meta: serde_json::Value::Object(Default::default()),
                duration_seconds: None,
            });

        {
            let rec = state
                .stages
                .get_mut(&stage)
                .expect("stage record must exist");
            rec.command = Some(cmdline.clone());
            rec.outputs = outputs.clone();
        }

        let done_before = {
            let rec = state.stages.get(&stage).expect("stage record must exist");
            stage_done_by_outputs(&state.config.out_dir, &rec.outputs)
        };
        if done_before {
            let rec = state
                .stages
                .get_mut(&stage)
                .expect("stage record must exist");
            rec.status = StageStatus::SKIPPED;
            state.updated_at = now_rfc3339();
            persist_state(state_path, &state)?;
            continue;
        }

        if !ready_stage_ready(&dag, &state, name) {
            let rec = state
                .stages
                .get_mut(&stage)
                .expect("stage record must exist");
            rec.status = StageStatus::FAILED;
            rec.error = Some(format!("deps not satisfied for stage {}", name));
            state.status = RunStatus::FAILED;
            state.updated_at = now_rfc3339();
            state.total_duration_seconds = Some(run_started.elapsed().as_secs_f64());
            persist_state(state_path, &state)?;
            events::emit_snapshot(&state);
            return Ok(state);
        }

        let max_retries = state.retry_policy.max_retries;
        let backoff_base = state.retry_policy.backoff_base_seconds;
        let timeout_s = state.config.stage_timeout_seconds.into();
        let stage_exec_started = Instant::now();
        metrics::STAGE_RUNNING
            .with_label_values(&[stage.as_str()])
            .inc();
        let success = if is_video_stage(name) {
            let run_out_dir = state.config.out_dir.clone();
            let mut rec = state
                .stages
                .get(&stage)
                .cloned()
                .expect("stage record must exist");
            let ok = run_video_stage_with_retry(
                &run_out_dir,
                name,
                &mut state,
                &mut rec,
                max_retries,
                backoff_base,
                &scheduler,
            )
            .await?;
            let outputs = rec.outputs.clone();
            state.stages.insert(stage.clone(), rec);
            update_video_artifacts_from_outputs(&mut state, &outputs);
            ok
        } else {
            let rec = state
                .stages
                .get_mut(&stage)
                .expect("stage record must exist");
            run_stage_with_retry(
                &state.config.out_dir,
                name,
                &cmdline,
                rec,
                state_path,
                max_retries,
                backoff_base,
                timeout_s,
            )
            .await?
        };
        let stage_dur = stage_exec_started.elapsed().as_secs_f64();
        metrics::STAGE_DURATION
            .with_label_values(&[stage.as_str()])
            .observe(stage_dur);
        metrics::STAGE_RUNNING
            .with_label_values(&[stage.as_str()])
            .dec();
        if let Some(rec) = state.stages.get_mut(&stage) {
            if rec.duration_seconds.is_none() {
                rec.duration_seconds = Some(stage_dur);
            }
        }

        state.updated_at = now_rfc3339();
        persist_state(state_path, &state)?;

        let done_after = {
            let rec = state.stages.get(&stage).expect("stage record must exist");
            stage_done_by_outputs(&state.config.out_dir, &rec.outputs)
        };
        if !success || !done_after {
            let rec = state
                .stages
                .get_mut(&stage)
                .expect("stage record must exist");
            rec.status = StageStatus::FAILED;
            rec.error = Some(format!("stage {} failed", name));
            state.status = RunStatus::FAILED;
            state.updated_at = now_rfc3339();
            state.total_duration_seconds = Some(run_started.elapsed().as_secs_f64());
            persist_state(state_path, &state)?;
            events::emit_snapshot(&state);
            return Ok(state);
        }

        let rec = state
            .stages
            .get_mut(&stage)
            .expect("stage record must exist");
        rec.status = StageStatus::SUCCEEDED;
        state.updated_at = now_rfc3339();
        persist_state(state_path, &state)?;
    }

    state.status = RunStatus::SUCCEEDED;
    state.updated_at = now_rfc3339();
    state.total_duration_seconds = Some(run_started.elapsed().as_secs_f64());
    persist_state(state_path, &state)?;
    events::emit_snapshot(&state);
    Ok(state)
}

pub async fn run_pipeline_default(
    state: RunState,
    compiled: crate::dsl::compile::CompiledCommands,
) -> Result<RunState> {
    let out_dir = state.config.out_dir.clone();
    fs::create_dir_all(&out_dir)?;
    let state_path = out_dir.join("run.json");
    run_pipeline(&state_path, state, compiled).await
}

pub fn concurrency_limit() -> usize {
    std::env::var("CSS_DAG_CONCURRENCY")
        .ok()
        .and_then(|s| s.parse::<usize>().ok())
        .filter(|&n| n > 0)
        .unwrap_or(2)
}

pub fn stage_ready(stage: &str, state: &RunState, dag: &Dag) -> bool {
    ready_stage_ready(dag, state, stage)
}

#[tracing::instrument(skip(state_path, shared, compiled, scheduler), fields(stage = %stage))]
async fn run_one_stage_task(
    stage: String,
    state_path: PathBuf,
    shared: Arc<Mutex<RunState>>,
    compiled: Arc<crate::dsl::compile::CompiledCommands>,
    scheduler: Scheduler,
) -> bool {
    let _cpu = scheduler.cpu_sem.clone().acquire_owned().await.unwrap();
    let stage_start = Instant::now();
    metrics::STAGE_RUNNING
        .with_label_values(&[stage.as_str()])
        .inc();
    let plan = stage_plan(compiled.as_ref());
    let (cmdline, outputs) = match plan.get(stage.as_str()) {
        Some((c, o)) => (c.clone(), o.clone()),
        None if is_video_stage(stage.as_str()) => (format!("internal:{}", stage), vec![]),
        None => {
            let mut s = shared.lock().await;
            if let Some(rec) = s.stages.get_mut(&stage) {
                rec.status = StageStatus::FAILED;
                rec.error = Some("unknown stage".to_string());
                rec.ended_at = Some(now_rfc3339());
                stamp_stage_heartbeat(rec);
            }
            s.status = RunStatus::FAILED;
            s.updated_at = now_rfc3339();
            stamp_run_heartbeat(&mut s);
            let _ = run_store::write_run_state(&state_path, &s);
            events::emit_snapshot(&s);
            let dur = stage_start.elapsed().as_secs_f64();
            metrics::STAGE_DURATION
                .with_label_values(&[stage.as_str()])
                .observe(dur);
            metrics::STAGE_RUNNING
                .with_label_values(&[stage.as_str()])
                .dec();
            return false;
        }
    };

    let (max_retries, backoff_base, stage_timeout_seconds) = {
        let mut s = shared.lock().await;
        if let Some(rec) = s.stages.get_mut(&stage) {
            rec.command = if is_video_stage(stage.as_str()) {
                None
            } else {
                Some(cmdline.clone())
            };
            rec.outputs = outputs.clone();
            rec.status = StageStatus::RUNNING;
            rec.started_at = Some(now_rfc3339());
            stamp_stage_heartbeat(rec);
            rec.ended_at = None;
            rec.error = None;
            rec.exit_code = None;
        }
        s.status = RunStatus::RUNNING;
        s.updated_at = now_rfc3339();
        stamp_run_heartbeat(&mut s);
        if let Some(rec) = s.stages.get_mut(&stage) {
            stamp_stage_heartbeat(rec);
        }
        let _ = run_store::write_run_state(&state_path, &s);
        (
            s.retry_policy.max_retries,
            s.retry_policy.backoff_base_seconds,
            s.config.stage_timeout_seconds,
        )
    };
    let hb_ms: u64 = std::env::var("CSS_HEARTBEAT_MS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(1000);
    let flush_min_ms: u64 = std::env::var("CSS_STATE_FLUSH_MIN_MS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(500);
    let hb_stop = spawn_stage_heartbeat_task(
        state_path.clone(),
        stage.clone(),
        hb_ms,
        flush_min_ms,
        run_id_from_state_path(&state_path),
    );

    let mut rec = StageRecord {
        status: StageStatus::PENDING,
        started_at: Some(now_rfc3339()),
        ended_at: None,
        exit_code: None,
        command: if is_video_stage(stage.as_str()) {
            None
        } else {
            Some(cmdline.clone())
        },
        outputs: outputs.clone(),
        retries: 0,
        error: None,
        heartbeat_at: None,
        last_heartbeat_at: None,
        timeout_seconds: Some(stage_timeout_seconds),
        error_code: None,
        pid: None,
        pgid: None,
        meta: serde_json::Value::Object(Default::default()),
        duration_seconds: None,
    };

    let success = if stage == "video"
        || stage == "video_plan"
        || is_video_shot_stage(&stage)
        || stage == "video_assemble"
        || stage == "mix"
        || stage == "subtitles"
        || stage == "render"
    {
        let (storyboard_path, video_dir, seed, vocals_path, music_path) = {
            let s = shared.lock().await;
            let out_dir = s.config.out_dir.clone();
            let video_dir = out_dir.join("build").join("video");
            let storyboard_path = video_dir.join("storyboard.json");
            let seed = s
                .stages
                .get("video")
                .and_then(|r| r.meta.get("seed"))
                .and_then(|v| v.as_u64())
                .unwrap_or(123);
            let vocals_path = out_dir.join("vocals.wav");
            let music_path = out_dir.join("music.wav");
            (storyboard_path, video_dir, seed, vocals_path, music_path)
        };

        let _ = fs::create_dir_all(&video_dir);

        let duration_s = probe_media_duration_s(&vocals_path)
            .await
            .unwrap_or(None)
            .or(probe_media_duration_s(&music_path).await.unwrap_or(None));

        let cfg = AutoShotConfig::default();
        let (_sb, sb_meta) =
            match ensure_storyboard_auto(&storyboard_path, seed, duration_s, cfg.clone()) {
                Ok(v) => v,
                Err(e) => {
                    rec.status = StageStatus::FAILED;
                    rec.error = Some(e.to_string());
                    (
                        crate::video::storyboard::Storyboard {
                            schema: "css.video.storyboard.v1".to_string(),
                            seed,
                            fps: 30,
                            resolution: crate::video::storyboard::Resolution { w: 1280, h: 720 },
                            shots: vec![],
                        },
                        serde_json::json!({"error": e.to_string()}),
                    )
                }
            };
        let shots_summary = format!(
            "Video Shots: N={} (auto, {}..{}s, clamp {}..{})",
            _sb.shots.len(),
            cfg.min_len_s,
            cfg.max_len_s,
            cfg.min_shots,
            cfg.max_shots
        );
        if matches!(rec.status, StageStatus::FAILED) {
            false
        } else {
            if stage == "video_plan" {
                rec.outputs = vec![storyboard_path.clone()];
                rec.meta = serde_json::json!({
                    "storyboard": sb_meta,
                    "shots_summary": shots_summary
                });
                true
            } else {
                let mut dispatch_state = {
                    let s = shared.lock().await;
                    s.clone()
                };
                let stage_name = stage.clone();
                let compiled_value = serde_json::to_value(compiled.as_ref()).ok();
                let dispatch_fut = crate::video_dispatch::run_one_stage_video_dispatch(
                    &stage_name,
                    &mut dispatch_state,
                    compiled_value.as_ref(),
                    &scheduler,
                );
                let dispatch_result = tokio::time::timeout(
                    std::time::Duration::from_secs(stage_timeout_seconds.max(1)),
                    dispatch_fut,
                )
                .await
                .map_err(|_| anyhow::anyhow!("stage timeout after {}s", stage_timeout_seconds))
                .and_then(|r| r.map_err(anyhow::Error::msg));

                match dispatch_result {
                    Ok(outputs) => {
                        rec.outputs = outputs;
                        let dispatch_meta = dispatch_state
                            .stages
                            .get(&stage_name)
                            .map(|r| r.meta.clone())
                            .unwrap_or_else(|| serde_json::json!({}));
                        rec.meta = serde_json::json!({
                            "storyboard": sb_meta,
                            "shots_summary": shots_summary,
                            "dispatch": dispatch_meta,
                        });
                        if let Some(dm) = dispatch_meta.as_object() {
                            if let Some(m) = rec.meta.as_object_mut() {
                                for (k, v) in dm {
                                    m.insert(k.clone(), v.clone());
                                }
                            }
                        }
                        true
                    }
                    Err(e) => {
                        rec.status = StageStatus::FAILED;
                        rec.error = Some(e.to_string());
                        false
                    }
                }
            }
        }
    } else {
        let timeout_s = rec.timeout_seconds;
        let run_out_dir = {
            let s = shared.lock().await;
            s.config.out_dir.clone()
        };
        match run_stage_with_retry(
            &run_out_dir,
            &stage,
            &cmdline,
            &mut rec,
            &state_path,
            max_retries,
            backoff_base,
            timeout_s,
        )
        .await
        {
            Ok(ok) => ok,
            Err(e) => {
                rec.status = StageStatus::FAILED;
                rec.error = Some(e.to_string());
                false
            }
        }
    };

    rec.ended_at.get_or_insert_with(now_rfc3339);
    stamp_stage_heartbeat(&mut rec);
    let dur = stage_start.elapsed().as_secs_f64();
    rec.duration_seconds = Some(dur);
    if success {
        let run_out_dir = {
            let s = shared.lock().await;
            s.config.out_dir.clone()
        };
        if let Err(e) = validate_outputs_nonempty(&run_out_dir, &rec.outputs) {
            rec.status = StageStatus::FAILED;
            rec.error = Some(e.to_string());
            rec.exit_code = Some(1);
        } else {
            rec.status = StageStatus::SUCCEEDED;
            rec.error = None;
        }
    } else {
        rec.status = StageStatus::FAILED;
        if rec.error.is_none() {
            rec.error = Some(format!("stage {} failed", stage));
        }
    }

    let mut s = shared.lock().await;
    let stage_failed = matches!(rec.status, StageStatus::FAILED);
    s.stages.insert(stage.clone(), rec);
    if stage_failed {
        s.status = RunStatus::FAILED;
    }
    s.updated_at = now_rfc3339();
    stamp_run_heartbeat(&mut s);
    let _ = run_store::write_run_state(&state_path, &s);
    let _ = hb_stop.send(());
    events::emit_snapshot(&s);
    metrics::STAGE_DURATION
        .with_label_values(&[stage.as_str()])
        .observe(dur);
    metrics::STAGE_RUNNING
        .with_label_values(&[stage.as_str()])
        .dec();
    !stage_failed
}

pub async fn run_pipeline_dag_concurrent(
    state_path: &PathBuf,
    mut state: RunState,
    compiled: crate::dsl::compile::CompiledCommands,
) {
    let run_started = Instant::now();
    let scheduler = Scheduler::new();
    let dag = cssmv_dag_v1();
    let order = dag
        .topo_order()
        .unwrap_or_default()
        .into_iter()
        .map(|s| s.to_string())
        .collect::<Vec<_>>();

    state.topo_order = order.clone();
    state.dag.schema = "css.pipeline.dag.v1".to_string();
    fill_dag_edges(&mut state, &dag);
    let _ = backfill_last_heartbeat_from_legacy(&mut state);
    state.status = RunStatus::RUNNING;
    state.updated_at = now_rfc3339();
    stamp_run_heartbeat(&mut state);
    let _ = run_store::write_run_state(state_path, &state);

    let shared = Arc::new(Mutex::new(state));
    let sem = Arc::new(Semaphore::new(concurrency_limit()));
    let compiled = Arc::new(compiled);

    let mut running: HashSet<String> = HashSet::new();
    let mut joinset: JoinSet<(String, bool)> = JoinSet::new();
    let mut fail_fast = false;

    loop {
        let snapshot = { shared.lock().await.clone() };
        running.retain(|name| {
            matches!(
                snapshot.stages.get(name).map(|r| &r.status),
                Some(StageStatus::RUNNING)
            )
        });

        if matches!(
            snapshot.stages.get("video_plan").map(|r| &r.status),
            Some(StageStatus::SUCCEEDED)
        ) && !snapshot.stages.keys().any(|k| is_video_shot_stage(k))
        {
            let mut s_expand = shared.lock().await;
            if maybe_expand_video_shots(&mut s_expand) {
                s_expand.updated_at = now_rfc3339();
                stamp_run_heartbeat(&mut s_expand);
                let _ = run_store::write_run_state(state_path, &s_expand);
            }
            continue;
        }

        {
            let mut s2 = shared.lock().await;
            if let Ok(disk) = run_store::read_run_state(state_path) {
                if disk.cancel_requested {
                    s2.cancel_requested = true;
                    if s2.cancel_requested_at.is_none() {
                        s2.cancel_requested_at = disk.cancel_requested_at.clone();
                    }
                }
            }
            let migrated = backfill_last_heartbeat_from_legacy(&mut s2);
            s2.updated_at = now_rfc3339();
            stamp_run_heartbeat(&mut s2);
            let now = Utc::now();
            let running_keys: Vec<String> = s2
                .stages
                .iter()
                .filter(|(_, r)| matches!(r.status, StageStatus::RUNNING))
                .map(|(k, _)| k.clone())
                .collect();
            for k in running_keys {
                if let Some(r) = s2.stages.get_mut(&k) {
                    if let Some(pid) = r.pid {
                        if pid > 0 && !crate::procutil::pid_alive(pid) {
                            r.status = StageStatus::FAILED;
                            r.error = Some("orphaned: pid not alive".to_string());
                            r.error_code = Some("ORPHANED".to_string());
                            r.exit_code = Some(-1);
                            r.ended_at = Some(now_rfc3339());
                            stamp_stage_heartbeat(r);
                            continue;
                        }
                    }
                }
                if stage_stuck(&s2, &k, now) {
                    if let Some(r) = s2.stages.get_mut(&k) {
                        r.status = StageStatus::FAILED;
                        r.error = Some("stuck timeout".to_string());
                        r.ended_at = Some(now_rfc3339());
                        stamp_stage_heartbeat(r);
                    }
                }
            }
            if s2.cancel_requested {
                s2.status = RunStatus::CANCELLED;
            }
            if migrated {
                s2.updated_at = now_rfc3339();
            }
            let _ = run_store::write_run_state(state_path, &s2);
        }

        if snapshot
            .stages
            .values()
            .any(|r| matches!(r.status, StageStatus::FAILED))
            && !matches!(snapshot.status, RunStatus::FAILED)
            && !snapshot.cancel_requested
        {
            let mut s2 = snapshot.clone();
            s2.status = RunStatus::FAILED;
            s2.updated_at = now_rfc3339();
            let _ = run_store::write_run_state(state_path, &s2);
            let mut g = shared.lock().await;
            *g = s2;
            fail_fast = true;
        }

        if !fail_fast {
            let view = compute_ready_view_with_dag_limited(&snapshot, &dag, usize::MAX);
            let ready: Vec<String> = view
                .ready
                .into_iter()
                .filter(|name| !running.contains(name))
                .collect();
            let free = concurrency_limit().saturating_sub(running.len());
            let picked: Vec<String> = ready.into_iter().take(free).collect();

            if !picked.is_empty() {
                let mut s_mark = shared.lock().await;
                let ts = now_rfc3339();
                for stage in &picked {
                    if let Some(rec) = s_mark.stages.get_mut(stage) {
                        if matches!(rec.status, StageStatus::PENDING) {
                            rec.status = StageStatus::RUNNING;
                            rec.started_at = Some(ts.clone());
                            rec.ended_at = None;
                            rec.exit_code = None;
                            rec.error = None;
                            stamp_stage_heartbeat(rec);
                        }
                    }
                }
                s_mark.status = RunStatus::RUNNING;
                s_mark.updated_at = ts;
                stamp_run_heartbeat(&mut s_mark);
                let _ = run_store::write_run_state(state_path, &s_mark);
            }

            for stage in picked {
                let permit = match sem.clone().try_acquire_owned() {
                    Ok(p) => p,
                    Err(_) => break,
                };
                running.insert(stage.clone());

                let shared2 = shared.clone();
                let state_path2 = state_path.clone();
                let compiled2 = compiled.clone();
                let scheduler2 = scheduler.clone();
                joinset.spawn(async move {
                    let ok = run_one_stage_task(
                        stage.clone(),
                        state_path2,
                        shared2,
                        compiled2,
                        scheduler2,
                    )
                    .await;
                    drop(permit);
                    (stage, ok)
                });
            }
        }

        let snapshot2 = { shared.lock().await.clone() };
        let pending_cnt = snapshot2
            .stages
            .values()
            .filter(|r| matches!(r.status, StageStatus::PENDING))
            .count();
        let any_failed = snapshot2
            .stages
            .values()
            .any(|r| matches!(r.status, StageStatus::FAILED));

        if running.is_empty() {
            if pending_cnt == 0 && !any_failed && !fail_fast {
                let mut s2 = snapshot2.clone();
                s2.status = RunStatus::SUCCEEDED;
                s2.updated_at = now_rfc3339();
                let _ = run_store::write_run_state(state_path, &s2);
                let mut g = shared.lock().await;
                *g = s2;
                break;
            }

            if any_failed || fail_fast {
                let mut s2 = snapshot2.clone();
                s2.status = RunStatus::FAILED;
                s2.updated_at = now_rfc3339();
                let _ = run_store::write_run_state(state_path, &s2);
                let mut g = shared.lock().await;
                *g = s2;
                break;
            }

            let has_ready = compute_ready_view_with_dag_limited(&snapshot2, &dag, usize::MAX)
                .ready
                .into_iter()
                .any(|n| !running.contains(&n));
            if pending_cnt > 0 && !has_ready {
                let mut s2 = snapshot2.clone();
                s2.status = RunStatus::FAILED;
                s2.updated_at = now_rfc3339();
                let _ = run_store::write_run_state(state_path, &s2);
                let mut g = shared.lock().await;
                *g = s2;
                break;
            }
        }

        if let Some(joined) = joinset.join_next().await {
            match joined {
                Ok((stage, ok)) => {
                    running.remove(&stage);
                    if ok && stage == "video_plan" {
                        let mut s3 = shared.lock().await;
                        if maybe_expand_video_shots(&mut s3) {
                            let _ = run_store::write_run_state(state_path, &s3);
                        }
                    }
                    if !ok {
                        fail_fast = true;
                    }
                }
                Err(_) => {
                    fail_fast = true;
                }
            }
        } else {
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
    }

    while let Some(joined) = joinset.join_next().await {
        if let Ok((stage, _)) = joined {
            running.remove(&stage);
        }
    }

    let mut final_state = shared.lock().await.clone();
    if final_state.cancel_requested {
        final_state.status = RunStatus::CANCELLED;
    } else if matches!(
        final_state.status,
        RunStatus::INIT | RunStatus::RUNNING | RunStatus::CANCELLED
    ) {
        if final_state
            .stages
            .values()
            .any(|r| matches!(r.status, StageStatus::FAILED))
        {
            final_state.status = RunStatus::FAILED;
        } else if final_state
            .stages
            .values()
            .all(|r| matches!(r.status, StageStatus::SUCCEEDED | StageStatus::SKIPPED))
        {
            final_state.status = RunStatus::SUCCEEDED;
        }
    }
    final_state.updated_at = now_rfc3339();
    stamp_run_heartbeat(&mut final_state);
    final_state.total_duration_seconds = Some(run_started.elapsed().as_secs_f64());
    let _ = run_store::write_run_state(state_path, &final_state);
    events::emit_snapshot(&final_state);
}

pub fn new_run_id() -> String {
    format!(
        "run_{}_{}",
        Utc::now().format("%Y%m%d_%H%M%S"),
        uuid::Uuid::new_v4().simple()
    )
}

pub fn init_run_state(run_id: String, ui_lang: String, tier: String, cssl: String) -> RunState {
    let now = Utc::now().to_rfc3339();
    let dag = cssmv_dag_v1();
    let topo_order = dag
        .topo_order()
        .unwrap_or_default()
        .into_iter()
        .map(|s| s.to_string())
        .collect::<Vec<_>>();
    let mut dag_edges: BTreeMap<String, Vec<String>> = BTreeMap::new();
    for node in &dag.nodes {
        dag_edges.insert(
            node.name.to_string(),
            node.deps.iter().map(|d| (*d).to_string()).collect(),
        );
    }

    let mut stages = BTreeMap::new();
    for name in [
        "lyrics",
        "music",
        "vocals",
        "video_plan",
        "video_assemble",
        "subtitles",
        "render",
    ] {
        stages.insert(
            name.to_string(),
            StageRecord {
                status: StageStatus::PENDING,
                started_at: None,
                ended_at: None,
                exit_code: None,
                command: None,
                outputs: vec![],
                retries: 0,
                error: None,
                heartbeat_at: None,
                last_heartbeat_at: None,
                timeout_seconds: Some(1800),
                error_code: None,
                pid: None,
                pgid: None,
                meta: serde_json::Value::Object(Default::default()),
                duration_seconds: None,
            },
        );
    }

    RunState {
        schema: "css.pipeline.run.v1".to_string(),
        run_id,
        created_at: now.clone(),
        updated_at: now,
        status: RunStatus::INIT,
        heartbeat_at: None,
        last_heartbeat_at: None,
        stuck_timeout_seconds: Some(120),
        cancel_requested: false,
        cancel_requested_at: None,
        ui_lang,
        tier,
        cssl,
        config: crate::run_state::RunConfig {
            out_dir: PathBuf::from("./build"),
            wiki_enabled: true,
            civ_linked: true,
            heartbeat_interval_seconds: 2,
            stage_timeout_seconds: 1800,
            stuck_timeout_seconds: 120,
        },
        retry_policy: crate::run_state::RetryPolicy {
            max_retries: 3,
            backoff_base_seconds: 2,
            strategy: "exponential".to_string(),
        },
        dag: crate::run_state::DagMeta {
            schema: "css.pipeline.dag.v1".to_string(),
            nodes: dag
                .nodes
                .iter()
                .map(|n| crate::run_state::DagNodeMeta {
                    name: n.name.to_string(),
                    deps: n.deps.iter().map(|d| (*d).to_string()).collect(),
                })
                .collect(),
        },
        topo_order,
        dag_edges,
        commands: serde_json::json!({}),
        artifacts: vec![],
        stages,
        video_shots_total: None,
        total_duration_seconds: None,
    }
}

pub fn compute_ready_running_summary(
    state: &RunState,
) -> (Vec<String>, Vec<String>, u32, u32, u32) {
    let dag = cssmv_dag_v1();

    let mut ready: Vec<String> = Vec::new();
    let mut running: Vec<String> = Vec::new();

    let mut pending: u32 = 0;
    let mut succeeded: u32 = 0;
    let mut failed: u32 = 0;

    for (name, sr) in &state.stages {
        match sr.status {
            StageStatus::PENDING => pending += 1,
            StageStatus::RUNNING => running.push(name.clone()),
            StageStatus::SUCCEEDED => succeeded += 1,
            StageStatus::FAILED => failed += 1,
            StageStatus::SKIPPED => {}
        }
    }

    let order: Vec<String> = if !state.topo_order.is_empty() {
        state.topo_order.clone()
    } else {
        dag.topo_order()
            .unwrap_or_default()
            .into_iter()
            .map(|s| s.to_string())
            .collect()
    };

    ready = compute_ready_view_with_dag_limited(state, &dag, usize::MAX).ready;

    if !state.topo_order.is_empty() {
        let idx = |name: &String| {
            state
                .topo_order
                .iter()
                .position(|x| x == name)
                .unwrap_or(usize::MAX)
        };
        running.sort_by_key(idx);
    } else {
        running.sort();
    }

    (ready, running, pending, succeeded, failed)
}

pub fn init_stage_records() -> BTreeMap<String, StageRecord> {
    let mut m = BTreeMap::new();
    let order = cssmv_dag_v1().topo_order().unwrap_or_default();
    for name in order {
        m.insert(
            name.to_string(),
            StageRecord {
                status: StageStatus::PENDING,
                started_at: None,
                ended_at: None,
                exit_code: None,
                command: None,
                outputs: Vec::new(),
                retries: 0,
                error: None,
                heartbeat_at: None,
                last_heartbeat_at: None,
                timeout_seconds: Some(1800),
                error_code: None,
                pid: None,
                pgid: None,
                meta: serde_json::Value::Object(Default::default()),
                duration_seconds: None,
            },
        );
    }
    m
}

pub async fn run_pipeline_default_async(state: Arc<RwLock<RunState>>) -> anyhow::Result<()> {
    let snapshot = state.read().await.clone();
    let compiled = crate::dsl::compile::compile_from_dsl(&snapshot.cssl)?;

    {
        let mut s = state.write().await;
        s.status = RunStatus::RUNNING;
        s.updated_at = crate::timeutil::now_rfc3339();
        let p = crate::run_store::run_state_path(&s.run_id);
        crate::run_state_io::save_state_atomic(&p, &*s)?;
    }

    let state_path = crate::run_store::run_state_path(&snapshot.run_id);
    run_pipeline_dag_concurrent(&state_path, snapshot, compiled).await;

    if let Ok(persisted) = crate::run_store::read_run_state(&state_path) {
        let mut s = state.write().await;
        *s = persisted;
    }
    Ok(())
}

pub async fn run_pipeline_async(state_path: &std::path::Path) -> anyhow::Result<()> {
    let mut st = crate::run_state_io::read_run_state(state_path)?;
    let _ = backfill_last_heartbeat_from_legacy(&mut st);
    let compiled = crate::dsl::compile::compile_from_dsl(&st.cssl)?;
    run_pipeline_dag_concurrent(&state_path.to_path_buf(), st, compiled).await;
    Ok(())
}

pub async fn run_pipeline_async_shared(state: Arc<RwLock<RunState>>) -> anyhow::Result<()> {
    run_pipeline_default_async(state).await
}
