use crate::routes::AppState;
use crate::run_state::{RunState, StageRecord, StageStatus};
use crate::run_state_io::{atomic_write_run_state, read_run_state_async};
use crate::run_store::run_state_path;
use crate::scheduler::Scheduler;
use crate::video::storyboard::StoryboardV1;
use crate::video::storyboard::{ensure_storyboard_auto, AutoShotConfig};
use crate::video::subtitles::{default_ass_path, write_ass_from_lyrics_json};
use crate::video::VideoExecutor;
use chrono::Utc;
use serde_json::Value;
use std::os::unix::process::CommandExt;
use std::path::{Path, PathBuf};
use tokio::process::Command;

fn ensure_meta_obj(v: &mut Value) -> &mut serde_json::Map<String, Value> {
    if !v.is_object() {
        *v = Value::Object(Default::default());
    }
    v.as_object_mut().expect("meta object")
}

fn v_u64(v: &Value, path: &[&str], d: u64) -> u64 {
    let mut cur = v;
    for k in path {
        cur = match cur.get(*k) {
            Some(x) => x,
            None => return d,
        };
    }
    cur.as_u64().unwrap_or(d)
}

fn v_u32(v: &Value, path: &[&str], d: u32) -> u32 {
    let mut cur = v;
    for k in path {
        cur = match cur.get(*k) {
            Some(x) => x,
            None => return d,
        };
    }
    cur.as_u64().map(|x| x as u32).unwrap_or(d)
}

fn v_f64(v: &Value, path: &[&str], d: f64) -> f64 {
    let mut cur = v;
    for k in path {
        cur = match cur.get(*k) {
            Some(x) => x,
            None => return d,
        };
    }
    cur.as_f64().unwrap_or(d)
}

fn video_cfg_from_state(state: &RunState) -> Value {
    state
        .commands
        .get("video")
        .cloned()
        .unwrap_or_else(|| Value::Object(Default::default()))
}

pub async fn spawn_wait_with_pgid_timeout(
    mut cmd: Command,
    timeout_s: u64,
    kill_grace_ms: u64,
) -> (
    Option<i32>,
    Option<i32>,
    anyhow::Result<i32>,
    Option<String>,
) {
    unsafe {
        cmd.pre_exec(|| {
            libc::setpgid(0, 0);
            Ok(())
        });
    }

    let mut child = match cmd.spawn() {
        Ok(c) => c,
        Err(e) => {
            return (
                None,
                None,
                Err(anyhow::anyhow!(e)),
                Some("SPAWN_FAILED".into()),
            )
        }
    };

    let pid = child.id().map(|x| x as i32);
    let pgid = pid;

    let wait_fut = async {
        match child.wait().await {
            Ok(s) => Ok(s.code().unwrap_or(-1)),
            Err(e) => Err(anyhow::anyhow!(e)),
        }
    };

    if timeout_s == 0 {
        let r = wait_fut.await;
        return (pid, pgid, r, None);
    }

    match tokio::time::timeout(std::time::Duration::from_secs(timeout_s), wait_fut).await {
        Ok(r) => (pid, pgid, r, None),
        Err(_) => {
            if let Some(g) = pgid {
                crate::procutil::kill_pgid_term_then_kill(g);
                tokio::time::sleep(std::time::Duration::from_millis(kill_grace_ms)).await;
                crate::procutil::kill_pgid_kill(g);
            }
            (pid, pgid, Ok(124), Some("TIMEOUT".into()))
        }
    }
}

pub fn build_video_plan_cmd(video_obj: &Value) -> String {
    let shots_n = v_u64(video_obj, &["shots_n"], 8);
    let fps = v_u32(video_obj, &["fps"], 30);
    let w = v_u32(video_obj, &["resolution", "w"], 1280);
    let h = v_u32(video_obj, &["resolution", "h"], 720);
    let seed = v_u64(video_obj, &["seed"], 0);
    let dur = v_f64(video_obj, &["duration_s"], 8.0);
    format!(
        "mkdir -p ./build/video && cssos-video plan --shots {} --fps {} --w {} --h {} --seed {} --duration {} --out ./build/video/storyboard.json",
        shots_n, fps, w, h, seed, dur
    )
}

pub fn build_video_shot_cmd(video_obj: &Value, stage: &str, out_mp4: &Path) -> String {
    let fps = v_u32(video_obj, &["fps"], 30);
    let w = v_u32(video_obj, &["resolution", "w"], 1280);
    let h = v_u32(video_obj, &["resolution", "h"], 720);
    format!(
        "mkdir -p ./build/video/shots && cssos-video shot --id {} --fps {} --w {} --h {} --storyboard ./build/video/storyboard.json --out {}",
        stage,
        fps,
        w,
        h,
        out_mp4.display()
    )
}

pub fn build_video_assemble_cmd(_video_obj: &Value) -> String {
    let shots_n = v_u64(_video_obj, &["shots_n"], 8) as usize;
    let mut concat_list = String::new();
    for i in 0..shots_n {
        concat_list.push_str(&format!("file 'shots/video_shot_{:03}.mp4'\\n", i));
    }
    format!(
        "mkdir -p ./build/video && printf '{}' > ./build/video/shots.txt && (ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i ./build/video/shots.txt -c copy ./build/video/video.mp4 > ./build/video/assemble.log 2>&1 || (rm -f ./build/video/video.mp4 && ffmpeg -y -hide_banner -loglevel error -f concat -safe 0 -i ./build/video/shots.txt -c:v libx264 -preset veryfast -crf 18 -pix_fmt yuv420p -c:a aac -b:a 192k ./build/video/video.mp4 >> ./build/video/assemble.log 2>&1))",
        concat_list.replace('\'', "'\\''")
    )
}

pub async fn run_one_stage_video_dispatch(
    stage: &str,
    state: &mut crate::run_state::RunState,
    compiled: Option<&serde_json::Value>,
    scheduler: &Scheduler,
) -> Result<Vec<std::path::PathBuf>, String> {
    let out_dir = state.config.out_dir.clone();
    let ve = VideoExecutor::new(out_dir.clone());
    let video_cfg = video_cfg_from_state(state);
    let shots_n = v_u64(&video_cfg, &["shots_n"], 8).clamp(1, 256) as usize;
    let fps = v_u32(&video_cfg, &["fps"], 30).clamp(1, 120);
    let w = v_u32(&video_cfg, &["resolution", "w"], 1280).clamp(160, 7680);
    let h = v_u32(&video_cfg, &["resolution", "h"], 720).clamp(90, 4320);
    let seed = v_u64(&video_cfg, &["seed"], 123);
    let duration_s = v_f64(&video_cfg, &["duration_s"], 8.0).clamp(1.0, 600.0);

    let mut outputs: Vec<std::path::PathBuf> = Vec::new();
    let resolve = |p: &std::path::PathBuf| -> std::path::PathBuf {
        if p.is_absolute() {
            p.clone()
        } else {
            out_dir.join(p)
        }
    };

    match stage {
        "mix" => {
            use crate::video::cache as vcache;

            let music_rel = state
                .stages
                .get("music")
                .and_then(|r| r.outputs.first().cloned())
                .unwrap_or_else(|| std::path::PathBuf::from("./build/music.wav"));
            let vocals_rel = state
                .stages
                .get("vocals")
                .and_then(|r| r.outputs.first().cloned())
                .unwrap_or_else(|| std::path::PathBuf::from("./build/vocals.wav"));
            let mix_rel = state
                .stages
                .get(stage)
                .and_then(|r| r.outputs.first().cloned())
                .unwrap_or_else(|| std::path::PathBuf::from("./build/mix.wav"));
            let music_abs = resolve(&music_rel);
            let vocals_abs = resolve(&vocals_rel);
            let mix_abs = resolve(&mix_rel);

            if !vcache::file_ok(&music_abs) {
                return Err("missing music.wav".to_string());
            }
            if !vcache::file_ok(&vocals_abs) {
                return Err("missing vocals.wav".to_string());
            }
            if let Some(p) = mix_abs.parent() {
                let _ = tokio::fs::create_dir_all(p).await;
            }

            let timeout_s = state
                .stages
                .get(stage)
                .and_then(|r| r.timeout_seconds)
                .unwrap_or(900);
            let kill_grace_ms: u64 = std::env::var("CSS_KILL_GRACE_MS")
                .ok()
                .and_then(|s| s.parse().ok())
                .unwrap_or(1500);
            let mut cmd = Command::new("ffmpeg");
            cmd.arg("-y")
                .arg("-hide_banner")
                .arg("-loglevel")
                .arg("error")
                .arg("-i")
                .arg(music_abs.as_os_str())
                .arg("-i")
                .arg(vocals_abs.as_os_str())
                .arg("-filter_complex")
                .arg("[0:a][1:a]amix=inputs=2:duration=longest:dropout_transition=2")
                .arg("-c:a")
                .arg("pcm_s16le")
                .arg(mix_abs.as_os_str());
            let (pid, pgid, r, err_code) =
                spawn_wait_with_pgid_timeout(cmd, timeout_s, kill_grace_ms).await;
            if let Some(rec) = state.stages.get_mut(stage) {
                rec.pid = pid;
                rec.pgid = pgid;
            }
            let code = match r {
                Ok(c) => c,
                Err(e) => {
                    if let Some(rec) = state.stages.get_mut(stage) {
                        rec.error_code = err_code.or(Some("SPAWN_FAILED".into()));
                    }
                    return Err(format!("ffmpeg mix spawn failed: {e}"));
                }
            };
            if code != 0 {
                if let Some(rec) = state.stages.get_mut(stage) {
                    rec.error_code = err_code.or(Some("FAILED".into()));
                }
                return Err(format!("ffmpeg mix failed: exit={code}"));
            }
            if !vcache::file_ok(&mix_abs) {
                return Err("mix.wav empty".to_string());
            }
            if let Some(rec) = state.stages.get_mut(stage) {
                rec.outputs = vec![mix_rel.clone()];
                let meta = ensure_meta_obj(&mut rec.meta);
                meta.insert(
                    "mix".into(),
                    serde_json::json!({"path": mix_rel.display().to_string()}),
                );
                rec.status = crate::run_state::StageStatus::SUCCEEDED;
                rec.exit_code = Some(0);
                rec.error = None;
            }
            crate::artifacts::build_artifacts_index(state);
            outputs.push(mix_rel);
            Ok(outputs)
        }
        "subtitles" => {
            use crate::video::cache as vcache;
            let dur = state
                .commands
                .get("video")
                .and_then(|v| v.get("duration_s"))
                .and_then(|v| v.as_f64())
                .unwrap_or(8.0);
            let ass_rel = state
                .stages
                .get(stage)
                .and_then(|r| r.outputs.first().cloned())
                .unwrap_or_else(|| std::path::PathBuf::from("./build/subtitles.ass"));
            let ass_path = resolve(&ass_rel);
            let p = crate::subtitles::ass::write_ass_from_run(
                &out_dir,
                &state.ui_lang,
                dur,
                Path::new("build/subtitles.ass"),
            )
            .await
            .map_err(|e| format!("write subtitles ass failed: {e}"))?;
            if !vcache::file_ok(&ass_path) {
                return Err("subtitles ass invalid".to_string());
            }
            if let Some(rec) = state.stages.get_mut(stage) {
                rec.outputs = vec![p];
                let meta = ensure_meta_obj(&mut rec.meta);
                meta.insert(
                    "subtitles".into(),
                    serde_json::json!({
                        "burnin": false,
                        "format": "ass",
                        "path": ass_rel.display().to_string(),
                        "lang": state.ui_lang.clone()
                    }),
                );
                rec.status = crate::run_state::StageStatus::SUCCEEDED;
                rec.exit_code = Some(0);
                rec.error = None;
            }
            crate::artifacts::build_artifacts_index(state);
            outputs.push(ass_rel);
            Ok(outputs)
        }
        "render" => {
            use crate::video::cache as vcache;

            let video_mp4 = state
                .stages
                .get("video_assemble")
                .and_then(|r| r.outputs.first().cloned())
                .map(|p| resolve(&p))
                .unwrap_or_else(|| out_dir.join("build").join("video").join("video.mp4"));
            let music_wav = state
                .stages
                .get("music")
                .and_then(|r| r.outputs.first().cloned())
                .map(|p| resolve(&p))
                .unwrap_or_else(|| out_dir.join("build").join("music.wav"));
            let vocals_wav = state
                .stages
                .get("vocals")
                .and_then(|r| r.outputs.first().cloned())
                .map(|p| resolve(&p))
                .unwrap_or_else(|| out_dir.join("build").join("vocals.wav"));

            let final_mp4_rel = state
                .stages
                .get(stage)
                .and_then(|r| r.outputs.first().cloned())
                .unwrap_or_else(|| std::path::PathBuf::from("./build/final_mv.mp4"));
            let final_mp4_abs = resolve(&final_mp4_rel);

            let subtitles_meta = state
                .stages
                .get("subtitles")
                .and_then(|r| r.meta.get("subtitles").cloned());

            if !vcache::file_ok(&video_mp4) {
                return Err("missing video.mp4".to_string());
            }
            if !vcache::file_ok(&music_wav) {
                return Err("missing music.wav".to_string());
            }
            if !vcache::file_ok(&vocals_wav) {
                return Err("missing vocals.wav".to_string());
            }

            let tmp = final_mp4_abs.with_extension("tmp.mp4");
            let _ = std::fs::remove_file(&tmp);
            crate::video::render::render_mv(&video_mp4, &music_wav, &vocals_wav, &tmp)
                .await
                .map_err(|e| format!("render failed: {e}"))?;
            if !vcache::file_ok(&tmp) {
                return Err("final_mv.mp4 empty".to_string());
            }

            if let Some(p) = final_mp4_abs.parent() {
                std::fs::create_dir_all(p)
                    .map_err(|e| format!("render create final dir failed: {e}"))?;
            }
            std::fs::rename(&tmp, &final_mp4_abs)
                .map_err(|e| format!("render move final failed: {e}"))?;

            if let Some(rec) = state.stages.get_mut(stage) {
                if let Some(v) = subtitles_meta {
                    let meta = ensure_meta_obj(&mut rec.meta);
                    meta.insert("subtitles".into(), v);
                }
                let meta = ensure_meta_obj(&mut rec.meta);
                meta.insert(
                    "render".into(),
                    serde_json::json!({
                        "mode": "copy_first_then_reencode",
                        "video": video_mp4.display().to_string(),
                        "music": music_wav.display().to_string(),
                        "vocals": vocals_wav.display().to_string(),
                        "out": final_mp4_abs.display().to_string()
                    }),
                );
                rec.outputs = vec![final_mp4_rel.clone()];
                rec.status = crate::run_state::StageStatus::SUCCEEDED;
                rec.exit_code = Some(0);
                rec.error = None;
            }

            crate::artifacts::build_artifacts_index(state);
            outputs.push(final_mp4_rel);
            Ok(outputs)
        }
        "video" => {
            let plan = ve
                .plan_or_load(seed, fps, w, h, shots_n)
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
                .plan_or_load(seed, fps, w, h, shots_n)
                .map_err(|e| format!("video_plan plan_or_load failed: {e}"))?;
            outputs.push(plan.storyboard_path);
            Ok(outputs)
        }
        "video_assemble" => {
            use crate::video::cache as vcache;

            let final_out = ve.assembled_video_path();
            let mut shot_keys: Vec<String> = state
                .stages
                .iter()
                .filter(|(k, _)| k.starts_with("video_shot_") || k.starts_with("video.shot:"))
                .map(|(_, r)| {
                    r.meta
                        .get("cache_key")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string())
                        .unwrap_or_else(|| {
                            r.outputs
                                .first()
                                .map(|p| format!("out:{}", p.display()))
                                .unwrap_or_else(|| "out:missing".to_string())
                        })
                })
                .collect();
            shot_keys.sort();
            let key_src = serde_json::json!({
                "shot_keys": shot_keys,
                "hw": std::env::var("CSS_VIDEO_HW").unwrap_or_else(|_| "auto".into()),
                "threads": std::env::var("CSS_FFMPEG_THREADS").ok(),
                "filter_threads": std::env::var("CSS_FFMPEG_FILTER_THREADS").ok(),
                "mode": "concat_demuxer_then_fallback"
            });
            let key = vcache::hash_json(&key_src);
            let cached = vcache::cache_assemble_dir(&out_dir).join(format!("{key}.mp4"));
            if vcache::file_ok(&cached) {
                vcache::try_hardlink_or_copy(&cached, &final_out)
                    .map_err(|e| format!("video_assemble cache copy failed: {e}"))?;
                if let Some(rec) = state.stages.get_mut(stage) {
                    let meta = ensure_meta_obj(&mut rec.meta);
                    meta.insert("cache_hit".into(), serde_json::json!(true));
                    meta.insert("cache_key".into(), serde_json::json!(key));
                    meta.insert(
                        "cache_path".into(),
                        serde_json::json!(cached.display().to_string()),
                    );
                }
                outputs.push(final_out);
                return Ok(outputs);
            }
            if let Some(rec) = state.stages.get_mut(stage) {
                let meta = ensure_meta_obj(&mut rec.meta);
                meta.insert("cache_hit".into(), serde_json::json!(false));
                meta.insert("cache_key".into(), serde_json::json!(key.clone()));
                meta.insert(
                    "cache_path".into(),
                    serde_json::json!(cached.display().to_string()),
                );
            }
            let shots_n = state.commands["video"]["shots_n"].as_u64().unwrap_or(0) as usize;
            let shots_dir = state.commands["video"]["shots_dir"]
                .as_str()
                .unwrap_or("./video/shots");
            let out_mp4 = state.commands["video"]["out_mp4"]
                .as_str()
                .unwrap_or("./video/video.mp4");
            let shots_dir_path = {
                let p = std::path::PathBuf::from(shots_dir);
                if p.is_absolute() {
                    p
                } else {
                    out_dir.join(p)
                }
            };
            let out_mp4_path = {
                let p = std::path::PathBuf::from(out_mp4);
                if p.is_absolute() {
                    p
                } else {
                    out_dir.join(p)
                }
            };
            let mut shots: Vec<std::path::PathBuf> = Vec::new();
            if shots_n > 0 {
                for i in 0..shots_n {
                    shots.push(shots_dir_path.join(format!("video_shot_{:03}.mp4", i)));
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
                let out = out_mp4_path;
                ve.assemble(&shots, &out)
                    .await
                    .map_err(|e| format!("video_assemble assemble failed: {e}"))?;
                out
            };
            let _ = vcache::atomic_copy_into(&cached, &a);
            outputs.push(a);
            crate::artifacts::build_artifacts_index(state);
            Ok(outputs)
        }
        _ if stage.starts_with("video_shot_") || stage.starts_with("video.shot:") => {
            use crate::video::cache as vcache;
            let sb: StoryboardV1 = ve
                .load_storyboard()
                .map_err(|e| format!("{} load_storyboard failed: {e}", stage))?;

            let sid = storyboard_id_from_stage(stage);
            let shot = sb
                .shots
                .iter()
                .find(|s| s.id == sid)
                .ok_or_else(|| format!("{} not found in storyboard shots", stage))?;

            let shot_params = serde_json::json!({
                "id": shot.id.clone(),
                "bg": shot.bg.value.clone(),
                "camera": shot.camera.clone(),
                "resolution": { "w": sb.resolution.w, "h": sb.resolution.h },
                "fps": sb.fps,
                "duration_s": shot.duration_s,
                "hw": std::env::var("CSS_VIDEO_HW").unwrap_or_else(|_| "auto".into()),
                "ffmpeg_threads": std::env::var("CSS_FFMPEG_THREADS").ok(),
                "ffmpeg_filter_threads": std::env::var("CSS_FFMPEG_FILTER_THREADS").ok()
            });
            let key = vcache::hash_json(&shot_params);
            let cached = vcache::cache_shots_dir(&out_dir).join(format!("{key}.mp4"));
            let out_mp4 = ve.shots_dir().join(format!("{}.mp4", shot.id));

            if vcache::file_ok(&cached) {
                vcache::try_hardlink_or_copy(&cached, &out_mp4)
                    .map_err(|e| format!("{} cache copy failed: {e}", stage))?;
                if let Some(rec) = state.stages.get_mut(stage) {
                    let meta = ensure_meta_obj(&mut rec.meta);
                    meta.insert("cache_hit".into(), serde_json::json!(true));
                    meta.insert("cache_key".into(), serde_json::json!(key));
                    meta.insert(
                        "cache_path".into(),
                        serde_json::json!(cached.display().to_string()),
                    );
                }
                outputs.push(out_mp4);
                return Ok(outputs);
            }
            if let Some(rec) = state.stages.get_mut(stage) {
                let meta = ensure_meta_obj(&mut rec.meta);
                meta.insert("cache_hit".into(), serde_json::json!(false));
                meta.insert("cache_key".into(), serde_json::json!(key.clone()));
                meta.insert(
                    "cache_path".into(),
                    serde_json::json!(cached.display().to_string()),
                );
            }

            let r = ve
                .render_shot_stub_with_sched(&sb, shot, scheduler)
                .await
                .map_err(|e| format!("{} render_shot_stub failed: {e}", stage))?;
            let _ = vcache::atomic_copy_into(&cached, &r.mp4_path);
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

    let video_cfg = commands
        .get("video")
        .cloned()
        .unwrap_or_else(|| Value::Object(Default::default()));
    let shots_n = v_u64(&video_cfg, &["shots_n"], 8).clamp(1, 256) as usize;
    let fps = v_u32(&video_cfg, &["fps"], 30).clamp(1, 120);
    let w = v_u32(&video_cfg, &["resolution", "w"], 1280).clamp(160, 7680);
    let h = v_u32(&video_cfg, &["resolution", "h"], 720).clamp(90, 4320);
    let seed = v_u64(&video_cfg, &["seed"], 123);
    let duration_s = v_f64(&video_cfg, &["duration_s"], 8.0).clamp(1.0, 600.0);

    let r: anyhow::Result<()> = if stage == "video_plan" {
        let sb_path = out_dir.join("video/storyboard.json");
        let cfg = AutoShotConfig {
            min_len_s: 2.0,
            max_len_s: 4.0,
            min_shots: 2,
            max_shots: 12,
            fps,
            w,
            h,
        };
        let creative_hint = commands
            .get("creative")
            .and_then(|c| c.get("prompt"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .or_else(|| {
                commands
                    .get("creative")
                    .and_then(|c| c.get("genre"))
                    .and_then(|v| v.as_str())
                    .map(|s| format!("genre: {s}"))
            });
        ensure_storyboard_auto(&sb_path, seed, Some(duration_s), cfg, creative_hint)
            .map(|_| ())
            .map_err(anyhow::Error::from)
    } else if stage.starts_with("video_shot_") {
        ve.render_shot_by_id(&stage)
            .await
            .map(|_| ())
            .map_err(|e| anyhow::anyhow!(e.0))
    } else if stage == "video_assemble" || stage == "video" {
        let shots_dir = video_cfg
            .get("shots_dir")
            .and_then(|x| x.as_str())
            .unwrap_or("./build/video/shots");
        let out_mp4 = video_cfg
            .get("out_mp4")
            .and_then(|x| x.as_str())
            .unwrap_or("./build/video/video.mp4");
        let mut shots = Vec::<PathBuf>::new();
        for i in 0..shots_n {
            shots.push(PathBuf::from(format!(
                "{}/video_shot_{:03}.mp4",
                shots_dir, i
            )));
        }
        ve.assemble(&shots, &PathBuf::from(out_mp4))
            .await
            .map_err(|e| anyhow::anyhow!(e.to_string()))
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
