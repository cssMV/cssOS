use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    sync::{Arc, Mutex},
    thread,
    time::Instant,
};
use time::OffsetDateTime;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoryboardV1 {
    pub schema: String,
    pub seed: u64,
    pub fps: u32,
    pub resolution: Resolution,
    pub shots: Vec<ShotV1>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resolution {
    pub w: u32,
    pub h: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShotV1 {
    pub id: String,
    pub duration_s: f32,
    pub prompt: Option<String>,
    pub bg: BgSpec,
    pub camera: CameraSpec,
    pub overlay: Option<OverlaySpec>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum BgSpec {
    #[serde(rename = "color")]
    Color { value: String },
    #[serde(rename = "image")]
    Image { path: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraSpec {
    pub r#move: String,
    pub strength: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OverlaySpec {
    pub enabled: bool,
    pub text: Option<String>,
}

#[derive(Debug, Clone)]
pub struct VideoExecConfig {
    pub ffmpeg_path: String,
    pub concurrency: usize,
    pub workdir: PathBuf,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShotMetric {
    pub id: String,
    pub started_at: OffsetDateTime,
    pub ended_at: OffsetDateTime,
    pub duration_ms: i64,
    pub output_mp4: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoExecResult {
    pub shots_count: usize,
    pub shots_dir: PathBuf,
    pub concat_txt: PathBuf,
    pub video_mp4: PathBuf,
    pub shot_metrics: Vec<ShotMetric>,
}

pub fn run_video_executor_v1(
    storyboard_path: &Path,
    cfg: VideoExecConfig,
) -> Result<VideoExecResult> {
    let sb: StoryboardV1 = read_json(storyboard_path)
        .with_context(|| format!("read storyboard: {}", storyboard_path.display()))?;

    if sb.schema != "css.video.storyboard.v1" {
        bail!("unsupported storyboard schema: {}", sb.schema);
    }

    let shots_dir = cfg.workdir.join("shots");
    fs::create_dir_all(&shots_dir).context("create shots dir")?;

    let jobs = sb.shots.clone();

    let errs: Arc<Mutex<Vec<anyhow::Error>>> = Arc::new(Mutex::new(Vec::new()));
    let metrics: Arc<Mutex<Vec<ShotMetric>>> = Arc::new(Mutex::new(Vec::new()));

    let (tx, rx) = std::sync::mpsc::channel::<ShotV1>();
    let rx = Arc::new(Mutex::new(rx));

    let mut workers = Vec::new();
    for _ in 0..cfg.concurrency.max(1) {
        let rx = Arc::clone(&rx);
        let errs = Arc::clone(&errs);
        let metrics = Arc::clone(&metrics);
        let cfg2 = cfg.clone();
        let res = sb.resolution.clone();
        let fps = sb.fps;

        workers.push(thread::spawn(move || loop {
            let shot = {
                let guard = rx.lock().unwrap();
                guard.recv()
            };
            let shot = match shot {
                Ok(s) => s,
                Err(_) => break,
            };

            let started_at = OffsetDateTime::now_utc();
            let t0 = Instant::now();

            let out_mp4 = cfg2.workdir.join("shots").join(format!("{}.mp4", shot.id));
            let r = render_shot_ffmpeg(&shot, &res, fps, &cfg2, &cfg2.workdir.join("shots"));

            let ended_at = OffsetDateTime::now_utc();
            let dur_ms = t0.elapsed().as_millis() as i64;

            match r {
                Ok(_) => {
                    let mut g = metrics.lock().unwrap();
                    g.push(ShotMetric {
                        id: shot.id.clone(),
                        started_at,
                        ended_at,
                        duration_ms: dur_ms,
                        output_mp4: out_mp4.display().to_string(),
                    });
                }
                Err(e) => {
                    let mut g = errs.lock().unwrap();
                    g.push(e);
                }
            }
        }));
    }

    for s in jobs {
        tx.send(s).unwrap();
    }
    drop(tx);

    for w in workers {
        let _ = w.join();
    }

    let g = errs.lock().unwrap();
    if !g.is_empty() {
        bail!("video executor failed: {} shot error(s): {}", g.len(), g[0]);
    }

    let concat_path = cfg.workdir.join("concat.txt");
    write_concat_list(&concat_path, &sb.shots, &shots_dir)?;

    let out_video = cfg.workdir.join("video.mp4");
    ffmpeg_concat(&cfg.ffmpeg_path, &concat_path, &out_video).context("ffmpeg concat")?;

    let mut m = metrics.lock().unwrap().clone();
    m.sort_by(|a, b| a.id.cmp(&b.id));

    Ok(VideoExecResult {
        shots_count: sb.shots.len(),
        shots_dir,
        concat_txt: concat_path,
        video_mp4: out_video,
        shot_metrics: m,
    })
}

fn read_json<T: for<'de> Deserialize<'de>>(p: &Path) -> Result<T> {
    let s = fs::read_to_string(p)?;
    Ok(serde_json::from_str(&s)?)
}

fn write_concat_list(concat_path: &Path, shots: &[ShotV1], shots_dir: &Path) -> Result<()> {
    let mut buf = String::new();
    for shot in shots {
        let shot_file = shots_dir.join(format!("{}.mp4", shot.id));
        buf.push_str(&format!("file '{}'\n", shot_file.display()));
    }
    fs::write(concat_path, buf)?;
    Ok(())
}

fn ffmpeg_concat(ffmpeg: &str, concat_txt: &Path, out_mp4: &Path) -> Result<()> {
    let status = Command::new(ffmpeg)
        .args([
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            concat_txt.to_str().unwrap(),
            "-c",
            "copy",
            out_mp4.to_str().unwrap(),
        ])
        .status()
        .context("spawn ffmpeg concat")?;

    if !status.success() {
        bail!("ffmpeg concat failed: exit={:?}", status.code());
    }
    Ok(())
}

fn render_shot_ffmpeg(
    shot: &ShotV1,
    res: &Resolution,
    fps: u32,
    cfg: &VideoExecConfig,
    shots_dir: &Path,
) -> Result<()> {
    let out = shots_dir.join(format!("{}.mp4", shot.id));
    let dur = shot.duration_s.max(0.2);

    let mut cmd = Command::new(&cfg.ffmpeg_path);
    cmd.arg("-y");

    match &shot.bg {
        BgSpec::Color { value } => {
            cmd.args(["-f", "lavfi"]);
            cmd.arg("-i");
            cmd.arg(format!(
                "color=c={}:s={}x{}:r={}:d={}",
                value, res.w, res.h, fps, dur
            ));
        }
        BgSpec::Image { path } => {
            cmd.args(["-loop", "1", "-t"]);
            cmd.arg(format!("{dur}"));
            cmd.arg("-i");
            cmd.arg(path);
        }
    }

    let vf = build_vf(shot, res, fps)?;
    cmd.args(["-vf", &vf]);
    cmd.args(["-r", &fps.to_string()]);
    cmd.args(["-pix_fmt", "yuv420p"]);
    cmd.args(["-c:v", "libx264", "-preset", "veryfast", "-crf", "18"]);
    cmd.arg(out.to_str().unwrap());

    let status = cmd
        .status()
        .with_context(|| format!("spawn ffmpeg for {}", shot.id))?;
    if !status.success() {
        bail!("ffmpeg shot {} failed: exit={:?}", shot.id, status.code());
    }
    Ok(())
}

fn build_vf(shot: &ShotV1, res: &Resolution, fps: u32) -> Result<String> {
    let mv = shot.camera.r#move.as_str();
    let strength = shot.camera.strength.clamp(0.0, 1.0);
    let zoom = 1.0 + 0.10 * strength as f64;
    let frames = (shot.duration_s.max(0.2) * fps as f32).round() as i32;

    let vf = match mv {
        "static" => format!("scale={}x{}", res.w, res.h),
        "push_in" => format!(
            "zoompan=z='min(zoom+{dz},{zmax})':d={frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',scale={w}x{h}",
            dz=(zoom-1.0)/frames.max(1) as f64, zmax=zoom, frames=frames, w=res.w, h=res.h
        ),
        "pull_out" => format!(
            "zoompan=z='max(zoom-{dz},1.0)':d={frames}:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',scale={w}x{h}",
            dz=(zoom-1.0)/frames.max(1) as f64, frames=frames, w=res.w, h=res.h
        ),
        "pan_left" => format!(
            "zoompan=z=1.0:d={frames}:x='max(iw-{w}, (iw-{w})*(1-on/{frames}))':y='ih/2-{h}/2',scale={w}x{h}",
            frames=frames, w=res.w, h=res.h
        ),
        "pan_right" => format!(
            "zoompan=z=1.0:d={frames}:x='(iw-{w})*(on/{frames})':y='ih/2-{h}/2',scale={w}x{h}",
            frames=frames, w=res.w, h=res.h
        ),
        _ => format!("scale={}x{}", res.w, res.h),
    };

    Ok(vf)
}
