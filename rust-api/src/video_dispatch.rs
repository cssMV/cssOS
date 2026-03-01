use crate::routes::AppState;
use crate::run_state::{RunState, StageStatus};
use crate::run_state_io::{atomic_write_run_state, read_run_state_async};
use crate::run_store::run_state_path;
use crate::timeutil::now_rfc3339;
use crate::video::duration::probe_media_duration_s;
use crate::video::ffmpeg::{concat_dual_path, concat_list_path};
use crate::video::storyboard::ensure_storyboard_auto;
use crate::video::VideoExecutor;
use chrono::Utc;
use serde_json::Value;
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};

fn v_get_u64(v: &Value, path: &[&str]) -> Option<u64> {
    let mut cur = v;
    for k in path {
        cur = cur.get(*k)?;
    }
    cur.as_u64()
}

fn v_get_u32(v: &Value, path: &[&str]) -> Option<u32> {
    let mut cur = v;
    for k in path {
        cur = cur.get(*k)?;
    }
    cur.as_u64().and_then(|x| u32::try_from(x).ok())
}

fn v_get_f64(v: &Value, path: &[&str]) -> Option<f64> {
    let mut cur = v;
    for k in path {
        cur = cur.get(*k)?;
    }
    cur.as_f64()
        .or_else(|| cur.as_i64().map(|x| x as f64))
        .or_else(|| cur.as_u64().map(|x| x as f64))
}

fn v_get_str(v: &Value, path: &[&str]) -> Option<String> {
    let mut cur = v;
    for k in path {
        cur = cur.get(*k)?;
    }
    cur.as_str().map(|s| s.to_string())
}

fn stage_started(st: &mut RunState, stage: &str) {
    if let Some(rec) = st.stages.get_mut(stage) {
        rec.status = StageStatus::RUNNING;
        rec.started_at = Some(now_rfc3339());
        rec.ended_at = None;
        rec.exit_code = None;
        rec.error = None;
        rec.retries = rec.retries.max(0);
    }
}

fn stage_succeeded(st: &mut RunState, stage: &str) {
    if let Some(rec) = st.stages.get_mut(stage) {
        rec.status = StageStatus::SUCCEEDED;
        rec.ended_at = Some(now_rfc3339());
        rec.exit_code = Some(0);
        rec.error = None;
    }
}

fn stage_failed(st: &mut RunState, stage: &str, msg: String) {
    if let Some(rec) = st.stages.get_mut(stage) {
        rec.status = StageStatus::FAILED;
        rec.ended_at = Some(now_rfc3339());
        rec.exit_code = Some(1);
        rec.error = Some(msg);
    }
}

pub async fn run_video_assemble_stage(out_dir: std::path::PathBuf) -> anyhow::Result<String> {
    let list_txt = concat_list_path(&out_dir);
    let out_mp4 = out_dir.join("build").join("video").join("video.mp4");
    let shots_dir = out_dir.join("build").join("video").join("shots");

    let parent = out_mp4
        .parent()
        .ok_or_else(|| anyhow::anyhow!("bad out dir"))?;
    let _ = tokio::fs::create_dir_all(parent).await;
    let _ = tokio::fs::create_dir_all(&shots_dir).await;

    let mut entries = tokio::fs::read_dir(&shots_dir).await?;
    let mut shots = Vec::<String>::new();
    while let Some(ent) = entries.next_entry().await? {
        let p = ent.path();
        if p.extension().and_then(|e| e.to_str()) == Some("mp4") {
            shots.push(p.display().to_string());
        }
    }
    shots.sort();
    let mut list = String::new();
    for p in shots {
        list.push_str("file '");
        list.push_str(&p.replace('\'', "'\\''"));
        list.push_str("'\n");
    }
    tokio::fs::write(&list_txt, list).await?;

    let mode = concat_dual_path(&list_txt, &out_mp4).await?;
    Ok(mode.to_string())
}

pub async fn run_video_plan_stage(
    run_dir: PathBuf,
    commands: serde_json::Value,
) -> anyhow::Result<()> {
    let v = commands
        .get("video")
        .cloned()
        .unwrap_or_else(|| serde_json::json!({}));

    let shots_n = v.get("shots_n").and_then(|x| x.as_u64()).unwrap_or(8) as usize;
    let w = v.get("w").and_then(|x| x.as_u64()).unwrap_or(1280) as u32;
    let h = v.get("h").and_then(|x| x.as_u64()).unwrap_or(720) as u32;
    let fps = v.get("fps").and_then(|x| x.as_u64()).unwrap_or(30) as u32;
    let seed = v.get("seed").and_then(|x| x.as_u64()).unwrap_or(123);
    let dur_s_env = v.get("duration_s").and_then(|x| x.as_f64());

    let vocals_wav = run_dir.join("build").join("vocals.wav");
    let probed = probe_media_duration_s(&vocals_wav).await.ok().flatten();
    let duration_s = dur_s_env.or(probed).unwrap_or((shots_n as f64) * 4.0);

    let out_dir = run_dir.join("build").join("video");
    let shots_dir = out_dir.join("shots");
    let _ = tokio::fs::create_dir_all(&shots_dir).await;

    let storyboard_path = out_dir.join("storyboard.json");
    let _ = ensure_storyboard_auto(&storyboard_path, seed, duration_s, shots_n, fps, w, h)?;

    write_shots_txt(&out_dir, shots_n).await?;
    Ok(())
}

async fn write_shots_txt(out_dir: &Path, shots_n: usize) -> anyhow::Result<()> {
    let mut s = String::new();
    for i in 0..shots_n {
        s.push_str(&format!("file 'shots/video_shot_{:03}.mp4'\n", i));
    }
    let p = out_dir.join("shots.txt");
    tokio::fs::write(p, s).await?;
    Ok(())
}

pub async fn run_one_stage_video_dispatch(
    app: AppState,
    run_id: String,
    stage: String,
) -> anyhow::Result<bool> {
    let is_video_stage = stage == "video_plan"
        || stage == "video_assemble"
        || stage == "render"
        || stage.starts_with("video_shot_");
    if !is_video_stage {
        return Ok(false);
    }

    let state_path = run_state_path(&app.config.runs_dir, &run_id);
    let mut st = read_run_state_async(&state_path).await?;

    stage_started(&mut st, &stage);
    st.updated_at = chrono::Utc::now().to_rfc3339();
    atomic_write_run_state(&state_path, &st).await?;

    let commands = st.commands.clone();
    let out_dir = st.config.out_dir.clone();

    let fps = v_get_u32(&commands, &["video", "fps"]).unwrap_or(30);
    let seed = v_get_u64(&commands, &["video", "seed"]).unwrap_or(0);
    let duration_s = v_get_f64(&commands, &["video", "duration_s"]).unwrap_or(8.0);
    let w = v_get_u32(&commands, &["video", "resolution", "w"]).unwrap_or(1280);
    let h = v_get_u32(&commands, &["video", "resolution", "h"]).unwrap_or(720);
    let shots_n = v_get_u64(&commands, &["video", "shots_n"]).unwrap_or(8) as usize;

    let sb_path = out_dir.join("build/video/storyboard.json");
    let subs_path = out_dir.join("build/subtitles.ass");

    let ve = VideoExecutor::new(out_dir.clone());

    let mut shot_meta: Option<BTreeMap<String, serde_json::Value>> = None;
    let mut assemble_mode: Option<String> = None;
    let r: anyhow::Result<()> = if stage == "video_plan" {
        run_video_plan_stage(out_dir.clone(), commands.clone()).await?;
        let title = v_get_str(&commands, &["video", "subtitles", "title"])
            .unwrap_or_else(|| "cssMV".into());
        crate::video::subtitles::write_ass_stub(&subs_path, &title, duration_s)
            .map_err(|e| anyhow::anyhow!("{e}"))?;
        Ok(())
    } else if stage.starts_with("video_shot_") {
        let idx = stage
            .strip_prefix("video_shot_")
            .and_then(|s| s.parse::<usize>().ok())
            .ok_or_else(|| anyhow::anyhow!("bad shot stage"))?;
        let meta = ve
            .render_shot_from_storyboard(&sb_path, idx, fps)
            .await
            .map_err(|e| anyhow::anyhow!("{e}"))?;
        let mut m = BTreeMap::new();
        m.insert(
            "encode_mode".to_string(),
            serde_json::json!(meta.encode_mode),
        );
        m.insert(
            "ffmpeg_args_hash".to_string(),
            serde_json::json!(meta.ffmpeg_args_hash),
        );
        m.insert("duration_s".to_string(), serde_json::json!(meta.duration_s));
        shot_meta = Some(m);
        Ok(())
    } else if stage == "video_assemble" {
        let mode = run_video_assemble_stage(out_dir.clone()).await?;
        assemble_mode = Some(mode);
        Ok(())
    } else if stage == "render" {
        if let Ok(p) = crate::subtitles::ensure_ass_from_state(&out_dir, &st.cssl) {
            let rel = p
                .strip_prefix(&out_dir)
                .map(|x| x.to_path_buf())
                .unwrap_or(p.clone());
            if let Some(rec) = st.stages.get_mut("render") {
                if !rec.outputs.iter().any(|x| x == &rel) {
                    rec.outputs.push(rel);
                }
            }
            atomic_write_run_state(&state_path, &st).await?;
        }
        let video_mp4 = out_dir.join("build/video/video.mp4");
        let music_wav = out_dir.join("build/music.wav");
        let vocals_wav = out_dir.join("build/vocals.wav");
        let out_mp4 = out_dir.join("build/final_mv.mp4");
        crate::video::render::render_final_copy_video(
            &video_mp4,
            &music_wav,
            &vocals_wav,
            &out_mp4,
        )
        .await
        .map_err(anyhow::Error::msg)?;
        Ok(())
    } else {
        unreachable!("non-video stage should return before state mutation");
    };

    let mut st2 = read_run_state_async(&state_path).await?;
    match r {
        Ok(_) => {
            stage_succeeded(&mut st2, &stage);
            if let Some(meta) = shot_meta {
                if let Some(rec) = st2.stages.get_mut(&stage) {
                    rec.meta.extend(meta);
                }
            }
            if let Some(mode) = assemble_mode {
                if let Some(rec) = st2.stages.get_mut("video_assemble") {
                    rec.meta
                        .insert("assemble_mode".to_string(), serde_json::json!(mode));
                }
            }
        }
        Err(e) => {
            stage_failed(&mut st2, &stage, format!("{e}"));
        }
    }
    st2.updated_at = chrono::Utc::now().to_rfc3339();
    atomic_write_run_state(&state_path, &st2).await?;
    Ok(true)
}

pub async fn video_assemble_and_record_mode(
    runs_dir: PathBuf,
    run_id: String,
    out_dir: PathBuf,
) -> anyhow::Result<()> {
    let state_path = run_state_path(&runs_dir, &run_id);
    let mut st = read_run_state_async(&state_path).await?;
    let sb_path = out_dir.join("build/video/storyboard.json");
    let sb = crate::video::storyboard::load_storyboard_v1(&sb_path)?;
    let ve = VideoExecutor::new(out_dir.clone());
    let (_res, mode) = ve
        .assemble_v2(&sb)
        .await
        .map_err(|e| anyhow::anyhow!(e.0))?;
    if let Some(rec) = st.stages.get_mut("video_assemble") {
        rec.meta
            .insert("assemble_mode".to_string(), serde_json::json!(mode.mode));
    }
    st.updated_at = Utc::now().to_rfc3339();
    atomic_write_run_state(&state_path, &st).await?;
    Ok(())
}
