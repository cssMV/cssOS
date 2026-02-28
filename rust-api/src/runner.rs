use crate::dag::{cssmv_dag_v1, Dag};
use crate::dag_export;
use crate::dag_viz_html;
use crate::ready::{compute_ready_view, stage_ready as ready_stage_ready};
use crate::run_state::{RunState, RunStatus, StageRecord, StageStatus};
use crate::run_state_io::save_state_atomic;
use crate::run_store;
use crate::video::duration::probe_media_duration_s;
use crate::video::executor::VideoExecutor;
use crate::video::storyboard::{ensure_storyboard_auto, AutoShotConfig};
use anyhow::Result;
use chrono::Utc;
use std::collections::{BTreeMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tokio::io::AsyncReadExt;
use tokio::process::Command;
use tokio::sync::{Mutex, RwLock, Semaphore};
use tokio::task::JoinSet;
use tokio::time::sleep as tokio_sleep;

pub fn now_rfc3339() -> String {
    Utc::now().to_rfc3339()
}

fn output_exists(p: &PathBuf) -> bool {
    p.exists()
}

fn stage_done_by_outputs(outputs: &[PathBuf]) -> bool {
    !outputs.is_empty() && outputs.iter().all(output_exists)
}

fn persist_state(state_path: &Path, state: &RunState) -> Result<()> {
    save_state_atomic(state_path, state)?;
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
                compiled.video.clone(),
                vec![PathBuf::from("./build/storyboard.json")],
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
            "render",
            (
                compiled.render.clone(),
                vec![PathBuf::from("./build/final_mv.mp4")],
            ),
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
        || stage.starts_with("video_shot_")
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
    if state.stages.keys().any(|k| k.starts_with("video_shot_")) {
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
    let mut n = sb.shots.len();
    if n < 8 {
        n = 8;
    }
    if n > 36 {
        n = 36;
    }

    for i in 0..n {
        let k = format!("video_shot_{:03}", i);
        state.stages.entry(k.clone()).or_insert(StageRecord {
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
                .join(format!("{}.mp4", k))],
            retries: 0,
            error: None,
            heartbeat_at: None,
            meta: None,
        });
    }

    let mut new_order: Vec<String> = Vec::new();
    for st in &state.topo_order {
        if st == "video_assemble" {
            for i in 0..n {
                new_order.push(format!("video_shot_{:03}", i));
            }
        }
        new_order.push(st.clone());
    }
    state.topo_order = new_order;
    state.set_artifact_path("video.shots_count", serde_json::json!(n));
    true
}

fn stage_stuck(state: &RunState, stage: &str, now: chrono::DateTime<Utc>) -> bool {
    let Some(sr) = state.stages.get(stage) else {
        return false;
    };
    if !matches!(sr.status, StageStatus::RUNNING) {
        return false;
    }
    let Some(hb) = sr.heartbeat_at.as_ref().or(state.heartbeat_at.as_ref()) else {
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

async fn run_cmd_async(
    stage: &str,
    command_line: &str,
    cwd: Option<&Path>,
    timeout_s: Option<u64>,
) -> Result<(i32, String, String)> {
    let mut cmd = Command::new("bash");
    cmd.arg("-lc").arg(command_line);
    if let Some(dir) = cwd {
        cmd.current_dir(dir);
    }
    cmd.stdin(Stdio::null());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn()?;

    let mut out = child
        .stdout
        .take()
        .ok_or_else(|| anyhow::anyhow!("child stdout missing for stage={stage}"))?;
    let mut err = child
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

    let status = if let Some(t) = timeout_s {
        tokio::select! {
            s = child.wait() => s?,
            _ = tokio_sleep(Duration::from_secs(t)) => {
                let _ = child.kill().await;
                anyhow::bail!("stage timeout after {}s (stage={})", t, stage);
            }
        }
    } else {
        child.wait().await?
    };

    let stdout = out_task.await.unwrap_or_default();
    let stderr = err_task.await.unwrap_or_default();
    let code = status.code().unwrap_or(-1);
    Ok((code, stdout, stderr))
}

fn truncate_err(s: &str) -> String {
    const MAX: usize = 4000;
    if s.len() <= MAX {
        return s.to_string();
    }
    format!("{}...(truncated)", &s[..MAX])
}

async fn run_stage_with_retry(
    name: &str,
    cmdline: &str,
    rec: &mut StageRecord,
    max_retries: u32,
    backoff_base: u64,
) -> Result<bool> {
    for attempt in 0..=max_retries {
        rec.status = StageStatus::RUNNING;
        rec.retries = attempt;
        rec.started_at = Some(now_rfc3339());
        rec.heartbeat_at = Some(now_rfc3339());

        match run_cmd_async(name, cmdline, None, None).await {
            Ok((code, _stdout, stderr)) if code == 0 => {
                rec.exit_code = Some(0);
                rec.ended_at = Some(now_rfc3339());
                rec.heartbeat_at = Some(now_rfc3339());
                rec.status = StageStatus::SUCCEEDED;
                rec.error = None;
                return Ok(true);
            }
            Ok((code, _stdout, stderr)) => {
                rec.exit_code = Some(code);
                rec.ended_at = Some(now_rfc3339());
                rec.heartbeat_at = Some(now_rfc3339());
                rec.status = StageStatus::FAILED;
                rec.error = Some(truncate_err(&stderr));
            }
            Err(e) => {
                rec.exit_code = Some(-1);
                rec.ended_at = Some(now_rfc3339());
                rec.heartbeat_at = Some(now_rfc3339());
                rec.status = StageStatus::FAILED;
                rec.error = Some(truncate_err(&format!("{e:#}")));
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

fn run_video_stage_with_retry(
    stage: &str,
    state: &mut RunState,
    rec: &mut StageRecord,
    max_retries: u32,
    backoff_base: u64,
) -> Result<bool> {
    for attempt in 0..=max_retries {
        rec.status = StageStatus::RUNNING;
        rec.retries = attempt;
        rec.started_at = Some(now_rfc3339());
        rec.heartbeat_at = Some(now_rfc3339());

        match crate::video_dispatch::run_one_stage_video_dispatch(stage, state) {
            Ok(outputs) => {
                rec.exit_code = Some(0);
                rec.outputs = outputs;
                rec.ended_at = Some(now_rfc3339());
                rec.heartbeat_at = Some(now_rfc3339());
                rec.status = StageStatus::SUCCEEDED;
                rec.error = None;
                return Ok(true);
            }
            Err(e) => {
                rec.exit_code = Some(1);
                rec.ended_at = Some(now_rfc3339());
                rec.heartbeat_at = Some(now_rfc3339());
                rec.status = StageStatus::FAILED;
                rec.error = Some(format!("Attempt {} failed: {}", attempt, e));

                if attempt < max_retries {
                    let delay = backoff_delay(backoff_base, attempt);
                    println!("Stage {} failed. Retrying in {} seconds...", stage, delay);
                    thread::sleep(Duration::from_secs(delay));
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
    let dag = cssmv_dag_v1();
    let order = dag.topo_order().unwrap_or_default();

    state.dag.schema = "css.pipeline.dag.v1".to_string();

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
                meta: None,
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
            stage_done_by_outputs(&rec.outputs)
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
            persist_state(state_path, &state)?;
            return Ok(state);
        }

        let max_retries = state.retry_policy.max_retries;
        let backoff_base = state.retry_policy.backoff_base_seconds;
        let success = if is_video_stage(name) {
            let mut rec = state
                .stages
                .get(&stage)
                .cloned()
                .expect("stage record must exist");
            let ok =
                run_video_stage_with_retry(name, &mut state, &mut rec, max_retries, backoff_base)?;
            let outputs = rec.outputs.clone();
            state.stages.insert(stage.clone(), rec);
            update_video_artifacts_from_outputs(&mut state, &outputs);
            ok
        } else {
            let rec = state
                .stages
                .get_mut(&stage)
                .expect("stage record must exist");
            run_stage_with_retry(name, &cmdline, rec, max_retries, backoff_base).await?
        };

        state.updated_at = now_rfc3339();
        persist_state(state_path, &state)?;

        let done_after = {
            let rec = state.stages.get(&stage).expect("stage record must exist");
            stage_done_by_outputs(&rec.outputs)
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
            persist_state(state_path, &state)?;
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
    persist_state(state_path, &state)?;
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

async fn run_one_stage_task(
    stage: String,
    state_path: PathBuf,
    shared: Arc<Mutex<RunState>>,
    compiled: Arc<crate::dsl::compile::CompiledCommands>,
) -> bool {
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
                rec.heartbeat_at = Some(now_rfc3339());
            }
            s.status = RunStatus::FAILED;
            s.updated_at = now_rfc3339();
            s.heartbeat_at = Some(now_rfc3339());
            let _ = run_store::write_run_state(&state_path, &s);
            return false;
        }
    };

    let (max_retries, backoff_base) = {
        let mut s = shared.lock().await;
        if let Some(rec) = s.stages.get_mut(&stage) {
            rec.command = Some(cmdline.clone());
            rec.outputs = outputs.clone();
            rec.status = StageStatus::RUNNING;
            rec.started_at = Some(now_rfc3339());
            rec.heartbeat_at = Some(now_rfc3339());
            rec.ended_at = None;
            rec.error = None;
            rec.exit_code = None;
        }
        s.status = RunStatus::RUNNING;
        s.updated_at = now_rfc3339();
        s.heartbeat_at = Some(now_rfc3339());
        if let Some(rec) = s.stages.get_mut(&stage) {
            rec.heartbeat_at = Some(now_rfc3339());
        }
        let _ = run_store::write_run_state(&state_path, &s);
        (
            s.retry_policy.max_retries,
            s.retry_policy.backoff_base_seconds,
        )
    };

    let mut rec = StageRecord {
        status: StageStatus::PENDING,
        started_at: Some(now_rfc3339()),
        ended_at: None,
        exit_code: None,
        command: Some(cmdline.clone()),
        outputs: outputs.clone(),
        retries: 0,
        error: None,
        heartbeat_at: None,
        meta: None,
    };

    let success = if stage == "video"
        || stage == "video_plan"
        || stage.starts_with("video_shot_")
        || stage == "video_assemble"
    {
        let (out_dir, storyboard_path, video_dir, seed, vocals_path, music_path) = {
            let s = shared.lock().await;
            let out_dir = s.config.out_dir.clone();
            let video_dir = out_dir.join("video");
            let storyboard_path = video_dir.join("storyboard.json");
            let seed = s
                .stages
                .get("video")
                .and_then(|r| r.meta.as_ref())
                .and_then(|m| m.get("seed"))
                .and_then(|v| v.as_u64())
                .unwrap_or(123);
            let vocals_path = out_dir.join("vocals.wav");
            let music_path = out_dir.join("music.wav");
            (
                out_dir,
                storyboard_path,
                video_dir,
                seed,
                vocals_path,
                music_path,
            )
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
            let hb_shared = shared.clone();
            let hb_state_path = state_path.clone();
            let stage_name = stage.clone();
            let sb_meta_clone = sb_meta.clone();
            let shots_summary_hb = shots_summary.clone();
            let heartbeat = move |meta: serde_json::Value| {
                if let Ok(mut st) = hb_shared.try_lock() {
                    if let Some(r) = st.stages.get_mut(&stage_name) {
                        r.meta = Some(serde_json::json!({
                            "storyboard": sb_meta_clone,
                            "shots_summary": shots_summary_hb,
                            "runtime": meta
                        }));
                        r.heartbeat_at = Some(now_rfc3339());
                    }
                    st.updated_at = now_rfc3339();
                    st.heartbeat_at = Some(now_rfc3339());
                    let _ = run_store::write_run_state(&hb_state_path, &st);
                }
            };

            let stub = std::env::var("CSS_VIDEO_STUB").ok().as_deref() == Some("1");
            let cancel = Arc::new(AtomicBool::new(false));
            let ve =
                VideoExecutor::with_options(out_dir.clone(), concurrency_limit(), stub, cancel);

            match ve.run(&storyboard_path, &video_dir, heartbeat).await {
                Ok(outputs) => {
                    // stage-specific visible outputs while sharing same async executor path
                    if stage == "video_plan" {
                        rec.outputs = vec![storyboard_path.clone()];
                    } else if stage.starts_with("video_shot_") {
                        let want = format!("{}.mp4", stage);
                        let shot = outputs
                            .iter()
                            .find(|p| p.to_string_lossy().ends_with(&want))
                            .cloned();
                        rec.outputs = shot.into_iter().collect();
                    } else if stage == "video_assemble" {
                        rec.outputs = outputs
                            .into_iter()
                            .filter(|p| {
                                p.to_string_lossy().ends_with("concat.txt")
                                    || p.to_string_lossy().ends_with("video.mp4")
                            })
                            .collect();
                    } else {
                        rec.outputs = outputs;
                    }

                    rec.meta = Some(serde_json::json!({
                        "storyboard": sb_meta,
                        "shots_summary": shots_summary,
                        "runtime": {
                            "video_shots": {
                                "n": rec.outputs.iter().filter(|p| p.to_string_lossy().contains("/shots/") || p.to_string_lossy().contains("\\shots\\")).count()
                            }
                        }
                    }));
                    true
                }
                Err(e) => {
                    rec.status = StageStatus::FAILED;
                    rec.error = Some(e.to_string());
                    false
                }
            }
        }
    } else {
        match run_stage_with_retry(&stage, &cmdline, &mut rec, max_retries, backoff_base).await {
            Ok(ok) => ok,
            Err(e) => {
                rec.status = StageStatus::FAILED;
                rec.error = Some(e.to_string());
                false
            }
        }
    };

    rec.ended_at.get_or_insert_with(now_rfc3339);
    rec.heartbeat_at = Some(now_rfc3339());
    if success {
        rec.status = StageStatus::SUCCEEDED;
        rec.error = None;
    } else {
        rec.status = StageStatus::FAILED;
        if rec.error.is_none() {
            rec.error = Some(format!("stage {} failed", stage));
        }
    }

    let mut s = shared.lock().await;
    s.stages.insert(stage.clone(), rec);
    if !success {
        s.status = RunStatus::FAILED;
    }
    s.updated_at = now_rfc3339();
    s.heartbeat_at = Some(now_rfc3339());
    let _ = run_store::write_run_state(&state_path, &s);
    success
}

pub async fn run_pipeline_dag_concurrent(
    state_path: &PathBuf,
    mut state: RunState,
    compiled: crate::dsl::compile::CompiledCommands,
) {
    let dag = cssmv_dag_v1();
    let order = dag
        .topo_order()
        .unwrap_or_default()
        .into_iter()
        .map(|s| s.to_string())
        .collect::<Vec<_>>();

    state.topo_order = order.clone();
    state.dag.schema = "css.pipeline.dag.v1".to_string();
    state.status = RunStatus::RUNNING;
    state.updated_at = now_rfc3339();
    state.heartbeat_at = Some(now_rfc3339());
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
        ) && !snapshot.stages.keys().any(|k| k.starts_with("video_shot_"))
        {
            let mut s_expand = shared.lock().await;
            if maybe_expand_video_shots(&mut s_expand) {
                s_expand.updated_at = now_rfc3339();
                s_expand.heartbeat_at = Some(now_rfc3339());
                let _ = run_store::write_run_state(state_path, &s_expand);
            }
            continue;
        }

        {
            let mut s2 = shared.lock().await;
            s2.updated_at = now_rfc3339();
            s2.heartbeat_at = Some(now_rfc3339());
            let now = Utc::now();
            let running_keys: Vec<String> = s2
                .stages
                .iter()
                .filter(|(_, r)| matches!(r.status, StageStatus::RUNNING))
                .map(|(k, _)| k.clone())
                .collect();
            for k in running_keys {
                if stage_stuck(&s2, &k, now) {
                    if let Some(r) = s2.stages.get_mut(&k) {
                        r.status = StageStatus::FAILED;
                        r.error = Some("stuck timeout".to_string());
                        r.ended_at = Some(now_rfc3339());
                        r.heartbeat_at = Some(now_rfc3339());
                    }
                }
            }
            if s2.cancel_requested {
                s2.status = RunStatus::CANCELLED;
            }
            let _ = run_store::write_run_state(state_path, &s2);
        }

        if snapshot
            .stages
            .values()
            .any(|r| matches!(r.status, StageStatus::FAILED))
            && !matches!(snapshot.status, RunStatus::FAILED)
        {
            let mut s2 = snapshot.clone();
            s2.status = RunStatus::FAILED;
            s2.updated_at = now_rfc3339();
            let _ = run_store::write_run_state(state_path, &s2);
            let mut g = shared.lock().await;
            *g = s2;
            fail_fast = true;
        }

        let order_now = if !snapshot.topo_order.is_empty() {
            snapshot.topo_order.clone()
        } else {
            order.clone()
        };

        if !fail_fast {
            let mut ready: Vec<String> = compute_ready_view(&snapshot, &dag)
                .ready
                .into_iter()
                .filter(|name| !running.contains(name))
                .collect();

            let free = concurrency_limit().saturating_sub(running.len());
            for stage in ready.into_iter().take(free) {
                let permit = match sem.clone().try_acquire_owned() {
                    Ok(p) => p,
                    Err(_) => break,
                };
                running.insert(stage.clone());

                let shared2 = shared.clone();
                let state_path2 = state_path.clone();
                let compiled2 = compiled.clone();
                joinset.spawn(async move {
                    let ok =
                        run_one_stage_task(stage.clone(), state_path2, shared2, compiled2).await;
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

            let order_check = if !snapshot2.topo_order.is_empty() {
                snapshot2.topo_order.clone()
            } else {
                order.clone()
            };
            let has_ready = compute_ready_view(&snapshot2, &dag)
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
    if matches!(
        final_state.status,
        RunStatus::INIT | RunStatus::RUNNING | RunStatus::CANCELLED
    ) {
        if final_state.cancel_requested {
            final_state.status = RunStatus::CANCELLED;
        } else if final_state
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
        final_state.updated_at = now_rfc3339();
        final_state.heartbeat_at = Some(now_rfc3339());
        let _ = run_store::write_run_state(state_path, &final_state);
    }
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

    let mut stages = BTreeMap::new();
    for name in [
        "lyrics",
        "music",
        "vocals",
        "video_plan",
        "video_assemble",
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
                meta: None,
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
        stuck_timeout_seconds: Some(120),
        cancel_requested: false,
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
        },
        topo_order: vec![],
        artifacts: serde_json::json!({}),
        stages,
        video_shots_total: None,
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

    ready = compute_ready_view(state, &dag).ready;

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
                meta: None,
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
    let st = crate::run_state_io::read_run_state(state_path)?;
    let compiled = crate::dsl::compile::compile_from_dsl(&st.cssl)?;
    run_pipeline_dag_concurrent(&state_path.to_path_buf(), st, compiled).await;
    Ok(())
}

pub async fn run_pipeline_async_shared(state: Arc<RwLock<RunState>>) -> anyhow::Result<()> {
    run_pipeline_default_async(state).await
}
