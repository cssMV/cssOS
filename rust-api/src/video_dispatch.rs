use crate::video::storyboard::StoryboardV1;
use crate::video::VideoExecutor;

pub fn run_one_stage_video_dispatch(
    stage: &str,
    state: &mut crate::run_state::RunState,
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
                    .render_shot_stub(&sb, shot)
                    .map_err(|e| format!("video render_shot_stub failed shot={} err={e}", shot.id))?;
                outputs.push(r.mp4_path);
            }

            let a = ve
                .assemble(&sb)
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
            let sb: StoryboardV1 = ve
                .load_storyboard()
                .map_err(|e| format!("video_assemble load_storyboard failed: {e}"))?;
            let a = ve
                .assemble(&sb)
                .map_err(|e| format!("video_assemble assemble failed: {e}"))?;
            outputs.push(a.video_mp4);
            Ok(outputs)
        }
        _ if stage.starts_with("video_shot_") => {
            let sb: StoryboardV1 = ve
                .load_storyboard()
                .map_err(|e| format!("{} load_storyboard failed: {e}", stage))?;

            let shot = sb
                .shots
                .iter()
                .find(|s| s.id == stage)
                .ok_or_else(|| format!("{} not found in storyboard shots", stage))?;

            let r = ve
                .render_shot_stub(&sb, shot)
                .map_err(|e| format!("{} render_shot_stub failed: {e}", stage))?;
            outputs.push(r.mp4_path);
            Ok(outputs)
        }
        _ => Err(format!("unknown stage: {}", stage)),
    }
}
