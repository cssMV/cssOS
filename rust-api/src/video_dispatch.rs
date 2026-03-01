use crate::routes::AppState;
use crate::run_state::{RunState, StageRecord, StageStatus};
use crate::run_state_io::{atomic_write_run_state, read_run_state_async};
use crate::run_store::run_state_path;
use crate::scheduler::Scheduler;
use crate::video::storyboard::StoryboardV1;
use crate::video::storyboard::{ensure_storyboard_auto, AutoShotConfig};
use crate::video::VideoExecutor;
use chrono::Utc;
use serde_json::Value;
use std::path::{Path, PathBuf};

pub async fn run_one_stage_video_dispatch(
    stage: &str,
    state: &mut crate::run_state::RunState,
    compiled: Option<&serde_json::Value>,
    scheduler: &Scheduler,
) -> Result<Vec<std::path::PathBuf>, String> {
    let out_dir = state.config.out_dir.clone();
    let ve = VideoExecutor::new(out_dir.clone());

    let mut outputs: Vec<std::path::PathBuf> = Vec::new();

    match stage {
        "video" => {
            let plan = ve
                .plan_or_load(123, 30, 1280, 720, 8)
                .map_err(|e| format!("video plan_or_load failed: {e}"))?;
            outputs.push(plan.storyboard_path.clone());

            let sb: StoryboardV1 = ve
                .load_storyboard()
                .map_err(|e| format!("video load_storyboard failed: {e}"))?;

            for shot in &sb.shots {
                let r = ve
                    .render_shot_stub_with_sched(&sb, shot, scheduler)
                    .await
                    .map_err(|e| {
                        format!("video render_shot_stub failed shot={} err={e}", shot.id)
                    })?;
                outputs.push(r.mp4_path);
            }

            let a = ve
                .assemble_with_sched(&sb, scheduler)
                .await
                .map_err(|e| format!("video assemble failed: {e}"))?;
            outputs.push(a.video_mp4);

            Ok(outputs)
        }
        "video_plan" => {
            let plan = ve
                .plan_or_load(123, 30, 1280, 720, 8)
                .map_err(|e| format!("video_plan plan_or_load failed: {e}"))?;
            outputs.push(plan.storyboard_path);
            Ok(outputs)
        }
        "video_assemble" => {
            let cache_base = ve.build_dir();
            let key_src = compiled.cloned().unwrap_or_else(|| {
                serde_json::json!({
                    "run_id": state.run_id,
                    "cssl": state.cssl,
                    "ui_lang": state.ui_lang,
                    "tier": state.tier
                })
            });
            let key = crate::video::cache::compute_video_cache_key(&key_src);
            let cached = crate::video::cache::cache_path(&cache_base, &key);
            let final_out = ve.assembled_video_path();
            if cached.exists() {
                std::fs::create_dir_all(
                    final_out
                        .parent()
                        .unwrap_or_else(|| std::path::Path::new(".")),
                )
                .ok();
                std::fs::copy(&cached, &final_out)
                    .map_err(|e| format!("video_assemble cache copy failed: {e}"))?;
                outputs.push(final_out);
                return Ok(outputs);
            }
            let shots_n = state.commands["video"]["shots_n"].as_u64().unwrap_or(0) as usize;
            let shots_dir = state.commands["video"]["shots_dir"]
                .as_str()
                .unwrap_or("./build/video/shots");
            let out_mp4 = state.commands["video"]["out_mp4"]
                .as_str()
                .unwrap_or("./build/video/video.mp4");
            let mut shots: Vec<std::path::PathBuf> = Vec::new();
            if shots_n > 0 {
                for i in 0..shots_n {
                    shots.push(std::path::PathBuf::from(format!(
                        "{}/video_shot_{:03}.mp4",
                        shots_dir, i
                    )));
                }
            }
            let a = if shots.is_empty() {
                let sb: StoryboardV1 = ve
                    .load_storyboard()
                    .map_err(|e| format!("video_assemble load_storyboard failed: {e}"))?;
                ve.assemble_with_sched(&sb, scheduler)
                    .await
                    .map_err(|e| format!("video_assemble assemble failed: {e}"))?
                    .video_mp4
            } else {
                let out = std::path::PathBuf::from(out_mp4);
                ve.assemble(&shots, &out)
                    .await
                    .map_err(|e| format!("video_assemble assemble failed: {e}"))?;
                out
            };
            if let Some(parent) = cached.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            let _ = std::fs::copy(&a, &cached);
            outputs.push(a);
            Ok(outputs)
        }
        _ if stage.starts_with("video_shot_") || stage.starts_with("video.shot:") => {
            let sb: StoryboardV1 = ve
                .load_storyboard()
                .map_err(|e| format!("{} load_storyboard failed: {e}", stage))?;

            let sid = storyboard_id_from_stage(stage);
            let shot = sb
                .shots
                .iter()
                .find(|s| s.id == sid)
                .ok_or_else(|| format!("{} not found in storyboard shots", stage))?;

            let r = ve
                .render_shot_stub_with_sched(&sb, shot, scheduler)
                .await
                .map_err(|e| format!("{} render_shot_stub failed: {e}", stage))?;
            outputs.push(r.mp4_path);
            Ok(outputs)
        }
        _ => Err(format!("unknown stage: {}", stage)),
    }
}

fn storyboard_id_from_stage(stage: &str) -> String {
    if let Some(v) = stage.strip_prefix("video.shot:") {
        if v.starts_with("video_shot_") {
            return v.to_string();
        }
        if let Some(rest) = v.strip_prefix("shot_") {
            return format!("video_shot_{rest}");
        }
        return v.to_string();
    }
    stage.to_string()
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn stage_record_mut<'a>(st: &'a mut RunState, stage: &str) -> Option<&'a mut StageRecord> {
    st.stages.get_mut(stage)
}

fn mark_running(rec: &mut StageRecord) {
    rec.status = StageStatus::RUNNING;
    rec.started_at = Some(now());
    rec.ended_at = None;
    rec.exit_code = None;
    rec.error = None;
}

fn mark_succeeded(rec: &mut StageRecord) {
    rec.status = StageStatus::SUCCEEDED;
    rec.ended_at = Some(now());
    rec.exit_code = Some(0);
    rec.error = None;
}

fn mark_failed(rec: &mut StageRecord, msg: String) {
    rec.status = StageStatus::FAILED;
    rec.ended_at = Some(now());
    rec.exit_code = Some(1);
    rec.error = Some(msg);
}

fn run_root(_app: &AppState) -> PathBuf {
    crate::run_store::runs_root()
}

fn run_dir_from_state_path(state_path: &Path) -> PathBuf {
    state_path
        .parent()
        .map(|p| p.to_path_buf())
        .unwrap_or_else(|| PathBuf::from("."))
}

pub async fn maybe_run_video_stage(
    app: AppState,
    run_id: String,
    stage: String,
    commands: Value,
) -> anyhow::Result<Option<()>> {
    if stage != "video_plan"
        && stage != "video_assemble"
        && stage != "video"
        && !stage.starts_with("video_shot_")
    {
        return Ok(None);
    }

    let state_path = run_state_path(&run_id);
    let mut st = read_run_state_async(&state_path).await?;
    let run_dir = run_dir_from_state_path(&state_path);
    let _ = run_root(&app);

    if let Some(rec) = stage_record_mut(&mut st, &stage) {
        if !matches!(rec.status, StageStatus::PENDING) {
            return Ok(Some(()));
        }
        mark_running(rec);
        st.updated_at = now();
        atomic_write_run_state(&state_path, &st).await?;
    } else {
        return Ok(Some(()));
    }

    let out_dir = run_dir.clone();
    let ve = VideoExecutor::new(out_dir.clone());

    let r: anyhow::Result<()> = if stage == "video_plan" {
        let sb_path = out_dir.join("build/video/storyboard.json");
        let duration_s = {
            let v = commands
                .get("video")
                .and_then(|x| x.get("duration_s"))
                .and_then(|x| x.as_f64())
                .unwrap_or(8.0);
            if v.is_finite() && v > 0.5 {
                v
            } else {
                8.0
            }
        };
        let seed = commands
            .get("video")
            .and_then(|x| x.get("seed"))
            .and_then(|x| x.as_u64())
            .unwrap_or(123);
        let cfg = AutoShotConfig {
            min_len_s: 2.0,
            max_len_s: 4.0,
            min_shots: 2,
            max_shots: 12,
            fps: commands
                .get("video")
                .and_then(|x| x.get("fps"))
                .and_then(|x| x.as_u64())
                .map(|v| v as u32)
                .unwrap_or(30),
            w: commands
                .get("video")
                .and_then(|x| x.get("w"))
                .and_then(|x| x.as_u64())
                .map(|v| v as u32)
                .unwrap_or(1280),
            h: commands
                .get("video")
                .and_then(|x| x.get("h"))
                .and_then(|x| x.as_u64())
                .map(|v| v as u32)
                .unwrap_or(720),
        };
        ensure_storyboard_auto(&sb_path, seed, Some(duration_s), cfg)
            .map(|_| ())
            .map_err(anyhow::Error::from)
    } else if stage.starts_with("video_shot_") {
        ve.render_shot_by_id(&stage)
            .await
            .map(|_| ())
            .map_err(|e| anyhow::anyhow!(e.0))
    } else if stage == "video_assemble" || stage == "video" {
        let sb: StoryboardV1 = ve.load_storyboard().map_err(|e| anyhow::anyhow!(e.0))?;
        ve.assemble_with_sched(&sb, &Scheduler::new())
            .await
            .map(|_| ())
            .map_err(|e| anyhow::anyhow!(e.0))
    } else {
        Ok(())
    };

    let mut st2 = read_run_state_async(&state_path).await?;
    if let Some(rec) = stage_record_mut(&mut st2, &stage) {
        match r {
            Ok(()) => mark_succeeded(rec),
            Err(e) => mark_failed(rec, format!("{e}")),
        }
        st2.updated_at = now();
        atomic_write_run_state(&state_path, &st2).await?;
    }

    Ok(Some(()))
}
