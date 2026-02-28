use crate::scheduler::Scheduler;
use crate::video::storyboard::StoryboardV1;
use crate::video::VideoExecutor;

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
                    .map_err(|e| format!("video render_shot_stub failed shot={} err={e}", shot.id))?;
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
            let key_src = compiled
                .cloned()
                .unwrap_or_else(|| serde_json::json!({
                    "run_id": state.run_id,
                    "cssl": state.cssl,
                    "ui_lang": state.ui_lang,
                    "tier": state.tier
                }));
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
            let sb: StoryboardV1 = ve
                .load_storyboard()
                .map_err(|e| format!("video_assemble load_storyboard failed: {e}"))?;
            let a = ve
                .assemble_with_sched(&sb, scheduler)
                .await
                .map_err(|e| format!("video_assemble assemble failed: {e}"))?;
            if let Some(parent) = cached.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            let _ = std::fs::copy(&a.video_mp4, &cached);
            outputs.push(a.video_mp4);
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
