use anyhow::{anyhow, Context, Result};
use futures::stream::{FuturesUnordered, StreamExt};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::io::AsyncReadExt;
use tokio::process::Command as TokCommand;
use tokio::sync::Semaphore;

use crate::video::error::VideoError;
use crate::video::storyboard::{Bg, Camera, Overlay, Resolution, Shot, Storyboard, StoryboardV1};
use crate::scheduler::Scheduler;

#[derive(Clone)]
pub struct VideoExecutor {
    pub out_dir: PathBuf,
    pub concurrency: usize,
    pub stub: bool,
    pub cancel: Arc<AtomicBool>,
}

pub struct PlanResult {
    pub storyboard_path: PathBuf,
}

pub struct RenderShotResult {
    pub mp4_path: PathBuf,
}

pub struct AssembleResult {
    pub video_mp4: PathBuf,
}

impl VideoExecutor {
    pub fn new(out_dir: PathBuf) -> Self {
        Self {
            out_dir,
            concurrency: std::env::var("CSS_VIDEO_CONCURRENCY")
                .ok()
                .and_then(|v| v.parse::<usize>().ok())
                .filter(|n| *n > 0)
                .unwrap_or(2),
            stub: std::env::var("CSS_VIDEO_STUB").ok().as_deref() == Some("1"),
            cancel: Arc::new(AtomicBool::new(false)),
        }
    }

    pub fn with_options(
        out_dir: PathBuf,
        concurrency: usize,
        stub: bool,
        cancel: Arc<AtomicBool>,
    ) -> Self {
        Self {
            out_dir,
            concurrency: concurrency.max(1),
            stub,
            cancel,
        }
    }

    pub fn build_dir(&self) -> PathBuf {
        self.out_dir.join("build")
    }

    pub fn storyboard_path(&self) -> PathBuf {
        self.build_dir().join("storyboard.json")
    }

    pub fn video_dir(&self) -> PathBuf {
        self.build_dir().join("video")
    }

    pub fn shots_dir(&self) -> PathBuf {
        self.video_dir().join("shots")
    }

    pub fn assembled_video_path(&self) -> PathBuf {
        self.video_dir().join("video.mp4")
    }

    pub async fn run(
        &self,
        storyboard_path: &Path,
        out_dir: &Path,
        heartbeat: impl Fn(serde_json::Value) + Send + Sync,
    ) -> Result<Vec<PathBuf>> {
        if self.cancel.load(Ordering::Relaxed) {
            return Err(anyhow!("cancelled"));
        }

        let sb = load_storyboard(storyboard_path)?;
        heartbeat(serde_json::json!({
            "event": "video_executor_start",
            "shots": sb.shots.len()
        }));
        let shots_dir = out_dir.join("shots");
        fs::create_dir_all(&shots_dir).ok();

        heartbeat(serde_json::json!({
            "video_shots": {
                "n": sb.shots.len(),
                "fps": sb.fps,
                "resolution": { "w": sb.resolution.w, "h": sb.resolution.h }
            }
        }));

        let sem = Arc::new(Semaphore::new(self.concurrency));
        let mut tasks: FuturesUnordered<_> = FuturesUnordered::new();

        for sh in &sb.shots {
            if self.cancel.load(Ordering::Relaxed) {
                return Err(anyhow!("cancelled"));
            }
            let permit = sem.clone().acquire_owned().await?;
            let stub = self.stub;
            let cancel = self.cancel.clone();
            let shots_dir2 = shots_dir.clone();
            let fps = sb.fps;
            let w = sb.resolution.w;
            let h = sb.resolution.h;
            let id = sh.id.clone();
            let dur = sh.duration_s;
            let color = sh.bg.value.clone();

            tasks.push(tokio::spawn(async move {
                let _permit = permit;
                if cancel.load(Ordering::Relaxed) {
                    return Err(anyhow!("cancelled"));
                }
                let out = shots_dir2.join(format!("{id}.mp4"));
                if out.exists() {
                    return Ok(out);
                }
                if stub {
                    make_stub_mp4(&out, fps, w, h, 0.8, "#000000").await?;
                } else {
                    make_color_mp4(&out, fps, w, h, dur, &color).await?;
                }
                Ok(out)
            }));
        }

        let mut shot_files: Vec<PathBuf> = Vec::new();
        while let Some(res) = tasks.next().await {
            let p = res.map_err(|e| anyhow!(e.to_string()))??;
            shot_files.push(p);
            if self.cancel.load(Ordering::Relaxed) {
                return Err(anyhow!("cancelled"));
            }
        }

        shot_files.sort();
        let list_path = out_dir.join("concat.txt");
        write_concat_list(&list_path, &shot_files)?;

        let final_mp4 = out_dir.join("video.mp4");
        if self.stub {
            make_stub_mp4(
                &final_mp4,
                sb.fps,
                sb.resolution.w,
                sb.resolution.h,
                1.0,
                "#000000",
            )
            .await?;
        } else {
            stitch_concat(&final_mp4, &list_path).await?;
        }

        let mut outputs = shot_files;
        outputs.push(list_path);
        outputs.push(final_mp4);
        Ok(outputs)
    }

    // Legacy APIs retained for existing dispatch
    pub fn plan_or_load(
        &self,
        seed: u64,
        fps: u32,
        w: u32,
        h: u32,
        shots_n: usize,
    ) -> Result<PlanResult, VideoError> {
        fs::create_dir_all(self.shots_dir())?;
        let p = self.storyboard_path();
        if p.exists() {
            return Ok(PlanResult { storyboard_path: p });
        }

        let mut shots: Vec<Shot> = Vec::new();
        for i in 0..shots_n.max(1) {
            shots.push(Shot {
                id: format!("video_shot_{:03}", i),
                duration_s: 4.0,
                bg: Bg {
                    kind: "color".to_string(),
                    value: if i % 2 == 0 { "#101820" } else { "#0B1020" }.to_string(),
                },
                camera: Camera {
                    r#move: if i % 2 == 0 { "push_in" } else { "pan_right" }.to_string(),
                    strength: 0.4,
                },
                overlay: Overlay { enabled: false },
            });
        }
        let sb = Storyboard {
            schema: "css.video.storyboard.v1".to_string(),
            seed,
            fps,
            resolution: Resolution { w, h },
            shots,
        };
        let json = serde_json::to_vec_pretty(&sb)?;
        fs::write(&p, json)?;
        Ok(PlanResult { storyboard_path: p })
    }

    pub fn load_storyboard(&self) -> Result<StoryboardV1, VideoError> {
        let p = self.storyboard_path();
        let bytes = fs::read(&p)?;
        let sb: StoryboardV1 = serde_json::from_slice(&bytes)?;
        Ok(sb)
    }

    pub fn render_shot_stub(
        &self,
        sb: &StoryboardV1,
        shot: &Shot,
    ) -> Result<RenderShotResult, VideoError> {
        fs::create_dir_all(self.shots_dir())?;
        let mp4 = self.shots_dir().join(format!("{}.mp4", shot.id));
        if mp4.exists() {
            return Ok(RenderShotResult { mp4_path: mp4 });
        }
        let size = format!("{}x{}", sb.resolution.w, sb.resolution.h);
        let dur = format!("{}", shot.duration_s.max(0.25));
        let status = Command::new("ffmpeg")
            .arg("-y")
            .args(["-f", "lavfi"])
            .arg("-i")
            .arg(format!("color=c={}:s={}:r={}", shot.bg.value, size, sb.fps))
            .args(["-t", &dur])
            .args(["-pix_fmt", "yuv420p"])
            .args(["-movflags", "+faststart"])
            .arg(&mp4)
            .status();
        match status {
            Ok(s) if s.success() => Ok(RenderShotResult { mp4_path: mp4 }),
            Ok(s) => Err(VideoError(format!(
                "ffmpeg render_shot_stub failed: exit={}",
                s.code().unwrap_or(-1)
            ))),
            Err(e) => Err(VideoError(format!(
                "ffmpeg render_shot_stub spawn failed: {e}"
            ))),
        }
    }

    pub async fn render_shot_stub_with_sched(
        &self,
        sb: &StoryboardV1,
        shot: &Shot,
        scheduler: &Scheduler,
    ) -> Result<RenderShotResult, VideoError> {
        let _permit = scheduler
            .ffmpeg_sem
            .clone()
            .acquire_owned()
            .await
            .map_err(|e| VideoError(e.to_string()))?;
        let this = self.clone();
        let sbc = sb.clone();
        let shotc = shot.clone();
        tokio::task::spawn_blocking(move || this.render_shot_stub(&sbc, &shotc))
            .await
            .map_err(|e| VideoError(e.to_string()))?
    }

    pub fn assemble(&self, sb: &StoryboardV1) -> Result<AssembleResult, VideoError> {
        fs::create_dir_all(self.video_dir())?;
        let list_path = self.video_dir().join("concat.txt");
        let mut list = String::new();
        for shot in &sb.shots {
            let mp4 = self.shots_dir().join(format!("{}.mp4", shot.id));
            if !mp4.exists() {
                return Err(VideoError(format!("missing shot mp4: {}", mp4.display())));
            }
            let abs = fs::canonicalize(&mp4)
                .map_err(|e| VideoError(format!("canonicalize failed {}: {e}", mp4.display())))?;
            list.push_str("file '");
            list.push_str(&abs.to_string_lossy().replace('\'', "\\\\'"));
            list.push_str("'\n");
        }
        fs::write(&list_path, list)?;

        let out = self.assembled_video_path();
        let status = Command::new("ffmpeg")
            .arg("-y")
            .args(["-f", "concat"])
            .args(["-safe", "0"])
            .arg("-i")
            .arg(&list_path)
            .args(["-c", "copy"])
            .args(["-movflags", "+faststart"])
            .arg(&out)
            .status();

        match status {
            Ok(s) if s.success() => Ok(AssembleResult { video_mp4: out }),
            Ok(s) => Err(VideoError(format!(
                "ffmpeg assemble failed: exit={}",
                s.code().unwrap_or(-1)
            ))),
            Err(e) => Err(VideoError(format!("ffmpeg assemble spawn failed: {e}"))),
        }
    }

    pub async fn assemble_with_sched(
        &self,
        sb: &StoryboardV1,
        scheduler: &Scheduler,
    ) -> Result<AssembleResult, VideoError> {
        let _permit = scheduler
            .ffmpeg_sem
            .clone()
            .acquire_owned()
            .await
            .map_err(|e| VideoError(e.to_string()))?;
        let this = self.clone();
        let sbc = sb.clone();
        tokio::task::spawn_blocking(move || this.assemble(&sbc))
            .await
            .map_err(|e| VideoError(e.to_string()))?
    }
}

fn load_storyboard(path: &Path) -> Result<Storyboard> {
    let s =
        fs::read_to_string(path).with_context(|| format!("read storyboard {}", path.display()))?;
    let sb: Storyboard = serde_json::from_str(&s).context("parse storyboard")?;
    Ok(sb)
}

fn write_concat_list(path: &Path, shots: &[PathBuf]) -> Result<()> {
    let mut out = String::new();
    for p in shots {
        let abs = fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
        let escaped = abs.to_string_lossy().replace("'", "'\\''");
        out.push_str("file '");
        out.push_str(&escaped);
        out.push_str("'\n");
    }
    fs::write(path, out).with_context(|| format!("write {}", path.display()))?;
    Ok(())
}

async fn stitch_concat(out_mp4: &Path, list_path: &Path) -> Result<()> {
    let mut cmd = TokCommand::new("ffmpeg");
    cmd.arg("-y")
        .arg("-f")
        .arg("concat")
        .arg("-safe")
        .arg("0")
        .arg("-i")
        .arg(list_path)
        .arg("-c")
        .arg("copy")
        .arg(out_mp4)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let (code, _o, e) = run_capture(&mut cmd).await?;
    if code != 0 {
        return Err(anyhow!("ffmpeg stitch failed: {}", e));
    }
    Ok(())
}

async fn make_color_mp4(
    out_mp4: &Path,
    fps: u32,
    w: u32,
    h: u32,
    dur: f64,
    color: &str,
) -> Result<()> {
    let filter = format!(
        "color=c={}:s={}x{}:r={}:d={}",
        normalize_color(color),
        w,
        h,
        fps,
        dur
    );
    let mut cmd = TokCommand::new("ffmpeg");
    cmd.arg("-y")
        .arg("-f")
        .arg("lavfi")
        .arg("-i")
        .arg(filter)
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg(out_mp4)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let (code, _o, e) = run_capture(&mut cmd).await?;
    if code != 0 {
        return Err(anyhow!("ffmpeg shot failed: {}", e));
    }
    Ok(())
}

async fn make_stub_mp4(
    out_mp4: &Path,
    fps: u32,
    w: u32,
    h: u32,
    dur: f64,
    color: &str,
) -> Result<()> {
    make_color_mp4(out_mp4, fps, w, h, dur, color).await
}

async fn run_capture(cmd: &mut TokCommand) -> Result<(i32, String, String)> {
    let mut child = cmd.spawn().context("spawn")?;
    let mut out = child.stdout.take().context("stdout missing")?;
    let mut err = child.stderr.take().context("stderr missing")?;

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

    let status = child.wait().await?;
    let stdout = out_task.await.unwrap_or_default();
    let stderr = err_task.await.unwrap_or_default();
    Ok((status.code().unwrap_or(-1), stdout, stderr))
}

fn normalize_color(c: &str) -> String {
    let s = c.trim();
    if s.starts_with('#') {
        s.to_string()
    } else {
        format!("#{s}")
    }
}
