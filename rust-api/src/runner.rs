use crate::dag::{cssmv_dag_v1, Dag};
use crate::dag_viz_html;
use crate::dag_export;
use crate::video_executor;
use crate::run_state::{RunState, RunStatus, StageRecord, StageStatus};
use anyhow::Result;
use chrono::Utc;
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::thread;
use std::time::Duration;

fn now_rfc3339() -> String {
    Utc::now().to_rfc3339()
}

fn output_exists(p: &PathBuf) -> bool {
    p.exists()
}

fn stage_done_by_outputs(outputs: &[PathBuf]) -> bool {
    !outputs.is_empty() && outputs.iter().all(output_exists)
}

fn persist_state(state_path: &Path, state: &RunState) -> Result<()> {
    let json = serde_json::to_string_pretty(state)?;
    fs::write(state_path, json)?;
    Ok(())
}

fn stage_plan(
    compiled: &crate::dsl::compile::CompiledCommands,
) -> BTreeMap<&'static str, (String, Vec<PathBuf>)> {
    BTreeMap::from([
        (
            "lyrics",
            (compiled.lyrics.clone(), vec![PathBuf::from("./build/lyrics.json")]),
        ),
        (
            "music",
            (compiled.music.clone(), vec![PathBuf::from("./build/music.wav")]),
        ),
        (
            "vocals",
            (compiled.vocals.clone(), vec![PathBuf::from("./build/vocals.wav")]),
        ),
        (
            "video",
            (compiled.video.clone(), vec![PathBuf::from("./build/video/video.mp4")]),
        ),
        (
            "render",
            (compiled.render.clone(), vec![PathBuf::from("./build/final_mv.mp4")]),
        ),
    ])
}

fn deps_satisfied(stage: &str, state: &RunState, dag: &Dag) -> bool {
    let node = dag.nodes.iter().find(|n| n.name == stage);
    let Some(node) = node else { return false; };

    node.deps.iter().all(|dep| {
        if let Some(dep_rec) = state.stages.get(*dep) {
            dep_rec.outputs.iter().all(|p| p.exists())
        } else {
            false
        }
    })
}

fn backoff_delay(base: u64, attempt: u32) -> u64 {
    base * (2u64.pow(attempt))
}

fn run_stage_with_retry(
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

        let status = Command::new("sh").arg("-lc").arg(cmdline).status()?;

        rec.exit_code = status.code();
        rec.ended_at = Some(now_rfc3339());

        if status.success() {
            rec.status = StageStatus::SUCCEEDED;
            rec.error = None;
            return Ok(true);
        }

        rec.status = StageStatus::FAILED;
        rec.error = Some(format!("Attempt {} failed", attempt));

        if attempt < max_retries {
            let delay = backoff_delay(backoff_base, attempt);
            println!("Stage {} failed. Retrying in {} seconds...", name, delay);
            thread::sleep(Duration::from_secs(delay));
        }
    }

    Ok(false)
}

fn run_video_stage_with_retry(
    rec: &mut StageRecord,
    max_retries: u32,
    backoff_base: u64,
) -> Result<(bool, Option<(std::path::PathBuf, video_executor::VideoExecResult)>)> {
    for attempt in 0..=max_retries {
        rec.status = StageStatus::RUNNING;
        rec.retries = attempt;
        rec.started_at = Some(now_rfc3339());

        match run_video_stage_v1() {
            Ok((storyboard, result)) => {
                rec.exit_code = Some(0);
                rec.outputs = vec![result.video_mp4.clone()];
                rec.ended_at = Some(now_rfc3339());
                rec.status = StageStatus::SUCCEEDED;
                rec.error = None;
                return Ok((true, Some((storyboard, result))));
            }
            Err(e) => {
                rec.exit_code = Some(1);
                rec.ended_at = Some(now_rfc3339());
                rec.status = StageStatus::FAILED;
                rec.error = Some(format!("Attempt {} failed: {}", attempt, e));

                if attempt < max_retries {
                    let delay = backoff_delay(backoff_base, attempt);
                    println!("Stage video failed. Retrying in {} seconds...", delay);
                    thread::sleep(Duration::from_secs(delay));
                }
            }
        }
    }

    Ok((false, None))
}

pub fn run_pipeline(
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

        if !deps_satisfied(name, &state, &dag) {
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

        let mut video_artifacts: Option<(std::path::PathBuf, video_executor::VideoExecResult)> = None;
        let success = {
            let rec = state
                .stages
                .get_mut(&stage)
                .expect("stage record must exist");
            if name == "video" {
                let (ok, artifacts) = run_video_stage_with_retry(
                    rec,
                    state.retry_policy.max_retries,
                    state.retry_policy.backoff_base_seconds,
                )?;
                video_artifacts = artifacts;
                ok
            } else {
                run_stage_with_retry(
                    name,
                    &cmdline,
                    rec,
                    state.retry_policy.max_retries,
                    state.retry_policy.backoff_base_seconds,
                )?
            }
        };

        if let Some((storyboard, result)) = &video_artifacts {
            state.set_artifact_path(
                "video.storyboard",
                serde_json::json!(storyboard.display().to_string()),
            );
            state.set_artifact_path(
                "video.shots_dir",
                serde_json::json!(result.shots_dir.display().to_string()),
            );
            state.set_artifact_path(
                "video.shots_count",
                serde_json::json!(result.shots_count),
            );
            state.set_artifact_path(
                "video.concat_txt",
                serde_json::json!(result.concat_txt.display().to_string()),
            );
            state.set_artifact_path(
                "video.video_mp4",
                serde_json::json!(result.video_mp4.display().to_string()),
            );
            state.set_artifact_path(
                "video.shot_metrics",
                serde_json::to_value(&result.shot_metrics).unwrap_or_else(|_| serde_json::json!([])),
            );
        }

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

pub fn run_pipeline_default(
    state: RunState,
    compiled: crate::dsl::compile::CompiledCommands,
) -> Result<RunState> {
    let out_dir = state.config.out_dir.clone();
    fs::create_dir_all(&out_dir)?;
    let state_path = out_dir.join("run.json");
    run_pipeline(&state_path, state, compiled)
}

fn run_video_stage_v1() -> anyhow::Result<(std::path::PathBuf, video_executor::VideoExecResult)> {
    let sb_path = std::path::PathBuf::from("build/storyboard.json");
    if !sb_path.exists() {
        std::fs::create_dir_all("build")?;
        let v = serde_json::json!({
            "schema":"css.video.storyboard.v1",
            "seed":123,
            "fps":30,
            "resolution":{"w":1280,"h":720},
            "shots":[
                {"id":"shot_000","duration_s":4.0,"prompt":null,"bg":{"kind":"color","value":"#101820"},"camera":{"move":"push_in","strength":0.4},"overlay":{"enabled":false,"text":null}},
                {"id":"shot_001","duration_s":4.0,"prompt":null,"bg":{"kind":"color","value":"#0B1020"},"camera":{"move":"pan_right","strength":0.4},"overlay":{"enabled":false,"text":null}},
                {"id":"shot_002","duration_s":4.0,"prompt":null,"bg":{"kind":"color","value":"#120B20"},"camera":{"move":"pan_left","strength":0.4},"overlay":{"enabled":false,"text":null}},
                {"id":"shot_003","duration_s":4.0,"prompt":null,"bg":{"kind":"color","value":"#071A12"},"camera":{"move":"pull_out","strength":0.4},"overlay":{"enabled":false,"text":null}},
                {"id":"shot_004","duration_s":4.0,"prompt":null,"bg":{"kind":"color","value":"#1A1407"},"camera":{"move":"push_in","strength":0.4},"overlay":{"enabled":false,"text":null}},
                {"id":"shot_005","duration_s":4.0,"prompt":null,"bg":{"kind":"color","value":"#0D0D0D"},"camera":{"move":"pan_right","strength":0.4},"overlay":{"enabled":false,"text":null}},
                {"id":"shot_006","duration_s":4.0,"prompt":null,"bg":{"kind":"color","value":"#0A1320"},"camera":{"move":"pan_left","strength":0.4},"overlay":{"enabled":false,"text":null}},
                {"id":"shot_007","duration_s":4.0,"prompt":null,"bg":{"kind":"color","value":"#20110A"},"camera":{"move":"static","strength":0.0},"overlay":{"enabled":false,"text":null}}
            ]
        });
        std::fs::write(&sb_path, serde_json::to_vec_pretty(&v)?)?;
    }

    let out = video_executor::run_video_executor_v1(
        sb_path.as_path(),
        video_executor::VideoExecConfig {
            ffmpeg_path: "ffmpeg".to_string(),
            concurrency: 2,
            workdir: std::path::PathBuf::from("build/video"),
        },
    )?;
    Ok((sb_path, out))
}
