use crate::dag::topo_order_v1;
use crate::dsl::compile::CompiledCommands;
use crate::run_state::{DagMeta, RetryPolicy, RunConfig, RunState, RunStatus};
use crate::runner::run_pipeline_default;
use chrono::Utc;
use serde_json::Value;
use std::{
    collections::BTreeMap,
    fs,
    path::PathBuf,
    sync::{
        atomic::{AtomicUsize, Ordering},
        Arc, OnceLock,
    },
};
use tokio::sync::Semaphore;

static RUN_SEM: OnceLock<Arc<Semaphore>> = OnceLock::new();
static RUN_CONCURRENCY: OnceLock<usize> = OnceLock::new();
static RUNNING: AtomicUsize = AtomicUsize::new(0);
static QUEUED: AtomicUsize = AtomicUsize::new(0);

fn parse_concurrency() -> usize {
    std::env::var("RUN_CONCURRENCY")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .filter(|&n| (1..=64).contains(&n))
        .unwrap_or(2)
}

pub fn concurrency() -> usize {
    *RUN_CONCURRENCY.get_or_init(parse_concurrency)
}

fn run_semaphore() -> Arc<Semaphore> {
    RUN_SEM
        .get_or_init(|| Arc::new(Semaphore::new(concurrency())))
        .clone()
}

pub fn running_count() -> usize {
    RUNNING.load(Ordering::Relaxed)
}

pub fn queued_count() -> usize {
    QUEUED.load(Ordering::Relaxed)
}

fn write_failed_state(state_path: &PathBuf, msg: String) {
    let mut v: Value = fs::read_to_string(state_path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| serde_json::json!({}));
    if !v.is_object() {
        v = serde_json::json!({});
    }
    v["status"] = serde_json::json!("FAILED");
    v["error"] = serde_json::json!(msg);
    let _ = fs::write(
        state_path,
        serde_json::to_vec_pretty(&v).unwrap_or_default(),
    );
}

pub fn spawn_run_worker(run_dir: PathBuf, commands: Value) {
    tokio::spawn(async move {
        QUEUED.fetch_add(1, Ordering::Relaxed);
        let _permit = match run_semaphore().acquire_owned().await {
            Ok(p) => p,
            Err(_) => {
                QUEUED.fetch_sub(1, Ordering::Relaxed);
                return;
            }
        };
        QUEUED.fetch_sub(1, Ordering::Relaxed);
        RUNNING.fetch_add(1, Ordering::Relaxed);

        let run_id = run_dir
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let state_path = run_dir.join("run.json");

        let compiled: CompiledCommands = match serde_json::from_value(commands.clone()) {
            Ok(c) => c,
            Err(_) => match commands.get("dsl").and_then(|v| v.as_str()) {
                Some(dsl) => match crate::dsl::compile::compile_from_dsl(dsl) {
                    Ok(c) => c,
                    Err(e) => {
                        write_failed_state(&state_path, format!("dsl compile failed: {e}"));
                        RUNNING.fetch_sub(1, Ordering::Relaxed);
                        return;
                    }
                },
                None => {
                    write_failed_state(
                        &state_path,
                        "invalid commands payload: expected CompiledCommands or {\"dsl\": \"...\"}"
                            .to_string(),
                    );
                    RUNNING.fetch_sub(1, Ordering::Relaxed);
                    return;
                }
            },
        };

        let now = Utc::now().to_rfc3339();
        let dag = crate::dag::cssmv_dag_v1();
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

        let mut state = RunState {
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
            ui_lang: "auto".to_string(),
            tier: "local".to_string(),
            cssl: "async-run-worker".to_string(),
            config: RunConfig {
                out_dir: run_dir.clone(),
                wiki_enabled: true,
                civ_linked: true,
                heartbeat_interval_seconds: 2,
                stage_timeout_seconds: 1800,
                stuck_timeout_seconds: 120,
            },
            retry_policy: RetryPolicy {
                max_retries: 3,
                backoff_base_seconds: 2,
                strategy: "exponential".to_string(),
            },
            dag: DagMeta {
                schema: "css.pipeline.dag.v1".to_string(),
            },
            topo_order,
            dag_edges,
            commands: serde_json::json!({}),
            artifacts: serde_json::json!({}),
            stages: Default::default(),
            video_shots_total: None,
            total_duration_seconds: None,
        };

        state.set_artifact_path("run.input.commands", commands);
        state.set_artifact_path(
            "worker.concurrency",
            serde_json::json!(concurrency() as i64),
        );
        let _ = fs::write(
            &state_path,
            serde_json::to_vec_pretty(&state).unwrap_or_default(),
        );

        state.topo_order = topo_order_v1(&state);
        let _ = fs::write(
            &state_path,
            serde_json::to_vec_pretty(&state).unwrap_or_default(),
        );

        match run_pipeline_default(state, compiled).await {
            Ok(_) => {}
            Err(e) => write_failed_state(&state_path, e.to_string()),
        }
        RUNNING.fetch_sub(1, Ordering::Relaxed);
    });
}
