use std::path::PathBuf;

#[path = "../video_executor.rs"]
mod video_executor;

fn main() -> anyhow::Result<()> {
    let out = video_executor::run_video_executor_v1(
        PathBuf::from("build/storyboard.json").as_path(),
        video_executor::VideoExecConfig {
            ffmpeg_path: "ffmpeg".to_string(),
            concurrency: 2,
            workdir: PathBuf::from("build/video"),
        },
    )?;
    println!("{}", out.video_mp4.display());
    Ok(())
}
