#![allow(dead_code)]

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

fn inferred_video_shots_n(video_obj: &Value) -> usize {
    video_obj
        .get("shots_n")
        .and_then(|value| value.as_u64())
        .map(|value| value.clamp(1, 256) as usize)
        .or_else(|| {
            video_obj
                .get("segments")
                .and_then(|value| value.as_array())
                .map(|items| items.len().clamp(1, 256))
        })
        .unwrap_or(1)
}

fn preferred_audio_candidates(stage_name: &str) -> Vec<PathBuf> {
    match stage_name {
        "music" => vec![
            PathBuf::from("./build/music.mp3"),
            PathBuf::from("./build/music.wav"),
            PathBuf::from("./build/audio/music.primary.wav"),
        ],
        "vocals" => vec![
            PathBuf::from("./build/vocals.mp3"),
            PathBuf::from("./build/vocals.wav"),
            PathBuf::from("./build/vocals/vocal_master.mp3"),
            PathBuf::from("./build/vocals/vocal_master.wav"),
        ],
        "mix" => vec![
            PathBuf::from("./build/mix.mp3"),
            PathBuf::from("./build/master.mp3"),
            PathBuf::from("./build/mix.wav"),
            PathBuf::from("./build/master.wav"),
            PathBuf::from("./build/audio/mix.primary.wav"),
        ],
        _ => Vec::new(),
    }
}

fn resolve_stage_audio_path(
    state: &RunState,
    stage_name: &str,
    out_dir: &Path,
) -> Option<(PathBuf, PathBuf)> {
    let mut candidates = Vec::new();
    if let Some(rec) = state.stages.get(stage_name) {
        candidates.extend(rec.outputs.iter().cloned());
    }
    candidates.extend(preferred_audio_candidates(stage_name));
    for rel in candidates {
        let abs = if rel.is_absolute() {
            rel.clone()
        } else {
            out_dir.join(&rel)
        };
        if crate::video::cache::file_ok(&abs) {
            return Some((rel, abs));
        }
    }
    None
}

async fn probe_audio_duration_secs(path: &Path) -> Option<f64> {
    let output = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(path)
        .output()
        .await
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8(output.stdout).ok()?;
    let value = text.trim().parse::<f64>().ok()?;
    if value.is_finite() && value > 0.0 {
        Some(value)
    } else {
        None
    }
}

fn estimate_subtitles_duration_secs(state: &RunState, out_dir: &Path) -> Option<f64> {
    let command_duration = state
        .commands
        .get("video")
        .and_then(|v| v.get("duration_s"))
        .and_then(|v| v.as_f64())
        .filter(|v| v.is_finite() && *v > 0.0)
        .or_else(|| {
            state
                .commands
                .get("creative")
                .and_then(|v| v.get("duration_s"))
                .and_then(|v| v.as_f64())
                .filter(|v| v.is_finite() && *v > 0.0)
        });
    if command_duration.is_some() {
        return command_duration;
    }

    for path in [out_dir.join("build/lyrics.json"), out_dir.join("lyrics.json")] {
        let Ok(text) = std::fs::read_to_string(&path) else {
            continue;
        };
        let Ok(value) = serde_json::from_str::<Value>(&text) else {
            continue;
        };
        if let Some(lines) = value.get("lines").and_then(|v| v.as_array()) {
            let mut max_t = 0.0_f64;
            let mut line_count = 0_usize;
            for item in lines {
                let has_text = item
                    .get("text")
                    .and_then(|v| v.as_str())
                    .map(|v| !v.trim().is_empty())
                    .unwrap_or_else(|| item.as_str().map(|v| !v.trim().is_empty()).unwrap_or(false));
                if !has_text {
                    continue;
                }
                line_count += 1;
                if let Some(t) = item.get("t").and_then(|v| v.as_f64()) {
                    if t.is_finite() && t >= 0.0 {
                        max_t = max_t.max(t);
                    }
                }
            }
            if line_count > 0 {
                let estimated = if max_t > 0.0 {
                    max_t + 3.2
                } else {
                    (line_count as f64 * 3.2).max(12.0)
                };
                if estimated.is_finite() && estimated > 0.0 {
                    return Some(estimated);
                }
            }
        }
        if let Some(text_block) = value.get("text").and_then(|v| v.as_str()) {
            let line_count = text_block.lines().filter(|line| !line.trim().is_empty()).count();
            if line_count > 0 {
                return Some((line_count as f64 * 3.2).max(12.0));
            }
        }
    }
    None
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
    let shots_n = inferred_video_shots_n(video_obj) as u64;
    let fps = v_u32(video_obj, &["fps"], 30);
    let w = v_u32(video_obj, &["resolution", "w"], 1280);
    let h = v_u32(video_obj, &["resolution", "h"], 720);
    let seed = v_u64(video_obj, &["seed"], 0);
    if let Some(dur) = video_obj
        .get("duration_s")
        .and_then(|x| x.as_f64())
        .filter(|value| *value > 0.0)
    {
        return format!(
            "mkdir -p ./build/video && cssos-video plan --shots {} --fps {} --w {} --h {} --seed {} --duration {} --out ./build/video/storyboard.json",
            shots_n, fps, w, h, seed, dur
        );
    }
    format!(
        "mkdir -p ./build/video && DUR=$(python3 - <<'PY'\n\
import pathlib, subprocess, sys\n\
def probe_mix():\n\
    for candidate in ('./build/mix.mp3', './build/master.mp3', './build/mix.wav', './build/master.wav'):\n\
        mix = pathlib.Path(candidate)\n\
        if not mix.exists():\n\
            continue\n\
        try:\n\
            out = subprocess.check_output([\n\
                'ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(mix)\n\
            ], stderr=subprocess.DEVNULL).decode().strip()\n\
            value = float(out)\n\
            if value > 0:\n\
                return value\n\
        except Exception:\n\
            continue\n\
    return None\n\
dur = probe_mix()\n\
if not dur or dur <= 0:\n\
    print('missing real audio duration', file=sys.stderr)\n\
    sys.exit(1)\n\
print('{{:.3f}}'.format(dur))\n\
PY\n\
) && cssos-video plan --shots {} --fps {} --w {} --h {} --seed {} --duration \"$DUR\" --out ./build/video/storyboard.json",
        shots_n, fps, w, h, seed
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
    let shots_n = inferred_video_shots_n(_video_obj);
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
    _compiled: Option<&serde_json::Value>,
    scheduler: &Scheduler,
) -> Result<Vec<std::path::PathBuf>, String> {
    let out_dir = state.config.out_dir.clone();
    let ve = VideoExecutor::new(out_dir.clone());
    let video_cfg = video_cfg_from_state(state);
    let shots_n = inferred_video_shots_n(&video_cfg);
    let fps = v_u32(&video_cfg, &["fps"], 30).clamp(1, 120);
    let w = v_u32(&video_cfg, &["resolution", "w"], 1280).clamp(160, 7680);
    let h = v_u32(&video_cfg, &["resolution", "h"], 720).clamp(90, 4320);
    let seed = v_u64(&video_cfg, &["seed"], 123);
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

            let (music_rel, music_abs) = resolve_stage_audio_path(state, "music", &out_dir)
                .ok_or_else(|| "missing music audio".to_string())?;
            let (vocals_rel, vocals_abs) = resolve_stage_audio_path(state, "vocals", &out_dir)
                .ok_or_else(|| "missing vocals audio".to_string())?;
            let mix_rel = state
                .stages
                .get(stage)
                .and_then(|r| r.outputs.first().cloned())
                .unwrap_or_else(|| std::path::PathBuf::from("./build/mix.mp3"));
            let mix_abs = resolve(&mix_rel);

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
                .arg("libmp3lame")
                .arg("-b:a")
                .arg("192k")
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
                return Err("mix audio empty".to_string());
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
            let has_mix_audio = resolve_stage_audio_path(state, "mix", &out_dir).is_some();
            let dur = if let Some((_, mix_audio)) = resolve_stage_audio_path(state, "mix", &out_dir) {
                probe_audio_duration_secs(&mix_audio)
                    .await
                    .filter(|value| value.is_finite() && *value > 0.0)
                    .or_else(|| estimate_subtitles_duration_secs(state, &out_dir))
                    .ok_or_else(|| "missing real audio duration".to_string())?
            } else {
                estimate_subtitles_duration_secs(state, &out_dir)
                    .ok_or_else(|| "missing real audio duration".to_string())?
            };
            let ass_rel = state
                .stages
                .get(stage)
                .and_then(|r| r.outputs.first().cloned())
                .unwrap_or_else(|| std::path::PathBuf::from("./build/subtitles.ass"));
            let ass_path = resolve(&ass_rel);
            let _ = crate::subtitles::ass::write_ass_from_run(
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
                rec.outputs = vec![ass_rel.clone()];
                let meta = ensure_meta_obj(&mut rec.meta);
                meta.insert(
                    "subtitles".into(),
                    serde_json::json!({
                        "burnin": false,
                        "format": "ass",
                        "path": ass_rel.display().to_string(),
                        "lang": state.ui_lang.clone(),
                        "duration_s": dur,
                        "duration_source": if has_mix_audio { "mix_or_estimated" } else { "estimated_from_lyrics" }
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
            let (_music_rel, music_audio) = resolve_stage_audio_path(state, "music", &out_dir)
                .ok_or_else(|| "missing music audio".to_string())?;
            let (_vocals_rel, vocals_audio) = resolve_stage_audio_path(state, "vocals", &out_dir)
                .ok_or_else(|| "missing vocals audio".to_string())?;

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
            if !vcache::file_ok(&music_audio) {
                return Err("missing music audio".to_string());
            }
            if !vcache::file_ok(&vocals_audio) {
                return Err("missing vocals audio".to_string());
            }

            let tmp = final_mp4_abs.with_extension("tmp.mp4");
            let _ = std::fs::remove_file(&tmp);
            crate::video::render::render_mv(&video_mp4, &music_audio, &vocals_audio, &tmp)
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
                        "music": music_audio.display().to_string(),
                        "vocals": vocals_audio.display().to_string(),
                        "out": final_mp4_abs.display().to_string()
                    }),
                );
                rec.outputs = vec![final_mp4_rel.clone()];
                rec.status = crate::run_state::StageStatus::SUCCEEDED;
                rec.exit_code = Some(0);
                rec.error = None;
            }

            crate::artifacts::build_artifacts_index(state);
            crate::artifacts::purge_lossless_artifacts(&out_dir);
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
            let ctx = crate::engines::EngineCtx::new(out_dir.clone());
            crate::engines::video::run_plan(&ctx, &state.commands, &state.ui_lang)
                .await
                .map_err(|e| format!("video_plan failed: {e}"))?;
            outputs.push(std::path::PathBuf::from("./build/video/storyboard.json"));
            Ok(outputs)
        }
        "video_assemble" => {
            let mut shot_files: Vec<std::path::PathBuf> = state
                .stages
                .iter()
                .filter(|(name, rec)| {
                    (name.starts_with("video_shot_") || name.starts_with("video.shot:"))
                        && matches!(rec.status, crate::run_state::StageStatus::SUCCEEDED)
                })
                .flat_map(|(_, rec)| rec.outputs.clone())
                .map(|p| resolve(&p))
                .collect();
            shot_files.sort();

            let ctx = crate::engines::EngineCtx::new(out_dir.clone());
            crate::engines::video_assemble::run(&ctx, &shot_files)
                .await
                .map_err(|e| format!("video_assemble failed: {e}"))?;

            let out_rel = std::path::PathBuf::from("./build/video/video.mp4");
            outputs.push(out_rel.clone());
            if let Some(rec) = state.stages.get_mut(stage) {
                rec.outputs = vec![out_rel];
                rec.meta = serde_json::json!({
                    "assemble": {
                        "engine": crate::engines::env_cmd("CSS_VIDEO_ASSEMBLE_CMD").is_some(),
                        "shots_count": shot_files.len()
                    }
                });
                rec.status = crate::run_state::StageStatus::SUCCEEDED;
                rec.exit_code = Some(0);
                rec.error = None;
            }
            crate::artifacts::build_artifacts_index(state);
            Ok(outputs)
        }
        _ if stage.starts_with("video_shot_") || stage.starts_with("video.shot:") => {
            let storyboard_path = crate::engines::video::storyboard_json_path(&out_dir);
            let raw = tokio::fs::read(&storyboard_path)
                .await
                .map_err(|e| format!("{} read storyboard failed: {e}", stage))?;
            let plan: serde_json::Value = serde_json::from_slice(&raw)
                .map_err(|e| format!("{} parse storyboard failed: {e}", stage))?;

            let shot_id = storyboard_id_from_stage(stage);
            let shots = plan
                .get("shots")
                .and_then(|x| x.as_array())
                .ok_or_else(|| format!("{} storyboard missing shots", stage))?;
            let shot = shots
                .iter()
                .find(|s| s.get("id").and_then(|x| x.as_str()) == Some(shot_id.as_str()))
                .ok_or_else(|| format!("{} not found in storyboard shots", stage))?
                .clone();

            let lang = crate::engines::primary_lang(&state.commands, &state.ui_lang);
            let ctx = crate::engines::EngineCtx::new(out_dir.clone());
            crate::engines::video::run_shot(&ctx, &shot_id, &shot, &lang)
                .await
                .map_err(|e| format!("{} failed: {e}", stage))?;
            outputs.push(std::path::PathBuf::from(format!(
                "./build/video/shots/{}.mp4",
                shot_id
            )));
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
    let shots_n = inferred_video_shots_n(&video_cfg);
    let fps = v_u32(&video_cfg, &["fps"], 30).clamp(1, 120);
    let w = v_u32(&video_cfg, &["resolution", "w"], 1280).clamp(160, 7680);
    let h = v_u32(&video_cfg, &["resolution", "h"], 720).clamp(90, 4320);
    let seed = v_u64(&video_cfg, &["seed"], 123);
    let duration_s = v_f64(&video_cfg, &["duration_s"], 0.0)
        .max(0.0)
        .clamp(0.0, 31_536_000.0);

    let r: anyhow::Result<()> = if stage == "video_plan" {
        let ctx = crate::engines::EngineCtx::new(out_dir.clone());
        crate::engines::video::run_plan(&ctx, &commands, &st.ui_lang).await
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
