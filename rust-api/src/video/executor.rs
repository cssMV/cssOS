use anyhow::{anyhow, Context, Result};
use futures::stream::{FuturesUnordered, StreamExt};
use image::{imageops, Rgba, RgbaImage};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tokio::io::AsyncReadExt;
use tokio::process::Command as TokCommand;
use tokio::sync::Semaphore;

use crate::scheduler::Scheduler;
use crate::video::error::VideoError;
use crate::video::ffmpeg::{ffmpeg_common_threads_args, ffmpeg_encoder_args, ffmpeg_hw_input_args};
use crate::video::graph::{lavfi_color_source, ShotParams};
use crate::video::hw::{detect_hw_plan, HwMode, HwPlan};
use crate::video::storyboard::{Bg, Camera, Overlay, Resolution, Shot, Storyboard, StoryboardV1};

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
        self.video_dir().join("storyboard.json")
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
                prompt: None,
                bg: Bg {
                    kind: "color".to_string(),
                    value: if i % 2 == 0 { "#101820" } else { "#0B1020" }.to_string(),
                },
                camera: Camera {
                    r#move: if i % 2 == 0 { "push_in" } else { "pan_right" }.to_string(),
                    strength: 0.4,
                    strategy: Some("legacy_plan".to_string()),
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

    pub async fn render_shot_by_id(&self, shot_id: &str) -> Result<RenderShotResult, VideoError> {
        let sb = self.load_storyboard()?;
        let shot = sb
            .shots
            .iter()
            .find(|s| s.id == shot_id)
            .ok_or_else(|| VideoError(format!("shot not found: {shot_id}")))?;
        self.render_shot_stub_with_sched(&sb, shot, &Scheduler::new())
            .await
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
        fs::create_dir_all(self.shots_dir()).map_err(|e| VideoError(e.to_string()))?;
        let _permit = scheduler
            .ffmpeg_sem
            .clone()
            .acquire_owned()
            .await
            .map_err(|e| VideoError(e.to_string()))?;
        let mp4 = self.shots_dir().join(format!("{}.mp4", shot.id));
        if !mp4.exists() {
            render_one_shot_mp4_graph(
                shot.id.clone(),
                shot.bg.value.clone(),
                shot.prompt.clone(),
                None,
                Some(shot.camera.clone()),
                sb.resolution.w,
                sb.resolution.h,
                sb.fps,
                shot.duration_s.max(0.25),
                &mp4,
            )
            .await
            .map_err(|e| VideoError(e.to_string()))?;
        }
        Ok(RenderShotResult { mp4_path: mp4 })
    }

    pub fn assemble_storyboard(&self, sb: &StoryboardV1) -> Result<AssembleResult, VideoError> {
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
        tokio::task::spawn_blocking(move || this.assemble_storyboard(&sbc))
            .await
            .map_err(|e| VideoError(e.to_string()))?
    }

    pub async fn assemble(&self, shots: &[PathBuf], out_mp4: &Path) -> Result<()> {
        tokio::fs::create_dir_all(&self.out_dir).await?;
        crate::video::ffmpeg::concat_mp4_ffmpeg(shots, out_mp4)
            .await
            .map_err(anyhow::Error::msg)?;
        Ok(())
    }

    async fn assemble_concat_copy(&self, list_path: &Path, out_mp4: &Path) -> Result<()> {
        let mut cmd = TokCommand::new("ffmpeg");
        cmd.arg("-y");
        cmd.arg("-f")
            .arg("concat")
            .arg("-safe")
            .arg("0")
            .arg("-i")
            .arg(list_path);
        cmd.arg("-c").arg("copy");
        cmd.arg(out_mp4);
        let (code, _o, e) = run_capture(&mut cmd).await?;
        if code == 0 {
            Ok(())
        } else {
            Err(anyhow!(e))
        }
    }

    async fn assemble_concat_reencode(&self, list_path: &Path, out_mp4: &Path) -> Result<()> {
        let mut cmd = TokCommand::new("ffmpeg");
        cmd.arg("-y");
        cmd.arg("-f")
            .arg("concat")
            .arg("-safe")
            .arg("0")
            .arg("-i")
            .arg(list_path);
        cmd.arg("-c:v")
            .arg("libx264")
            .arg("-pix_fmt")
            .arg("yuv420p")
            .arg("-movflags")
            .arg("+faststart");
        cmd.arg(out_mp4);
        let (code, _o, e) = run_capture(&mut cmd).await?;
        if code == 0 {
            Ok(())
        } else {
            Err(anyhow!(e))
        }
    }
}

pub async fn render_one_shot_mp4(
    color: &str,
    w: u32,
    h: u32,
    fps: u32,
    dur_s: f64,
    out_mp4: &std::path::Path,
) -> anyhow::Result<()> {
    render_one_shot_mp4_graph(
        "video_shot_000".to_string(),
        color.to_string(),
        None,
        None,
        None,
        w,
        h,
        fps,
        dur_s,
        out_mp4,
    )
    .await
}

#[derive(Debug, Clone)]
pub struct WeakReferenceStyle {
    pub sky_color: String,
    pub ground_color: String,
    pub accent_color: String,
    pub glow_color: String,
    pub subject_tint: String,
    pub horizon_ratio: f32,
    pub atmosphere: f32,
    pub silhouette_count: usize,
    pub subject_center_x: f32,
    pub left_mass: f32,
    pub right_mass: f32,
    pub profile_hint: Option<String>,
}

pub async fn render_one_shot_mp4_graph(
    shot_id: String,
    color: String,
    prompt: Option<String>,
    weak_style: Option<WeakReferenceStyle>,
    camera: Option<crate::video::storyboard::Camera>,
    w: u32,
    h: u32,
    fps: u32,
    duration_s: f64,
    out_mp4: &std::path::Path,
) -> anyhow::Result<()> {
    let plan = detect_hw_plan().await;
    let profile = scene_profile_from_prompt(&shot_id, prompt.as_deref(), weak_style.as_ref());

    if let Some(parent) = out_mp4.parent() {
        tokio::fs::create_dir_all(parent).await?;
    }

    let mut argv: Vec<String> = Vec::new();
    argv.push("-y".into());
    argv.push("-hide_banner".into());
    argv.push("-loglevel".into());
    argv.push(std::env::var("CSS_FFMPEG_LOGLEVEL").unwrap_or_else(|_| "error".into()));

    argv.extend(ffmpeg_common_threads_args());
    argv.extend(ffmpeg_hw_input_args(&plan));

    let norm_color = normalize_color(&color);
    let mut plate_path: Option<PathBuf> = None;
    if let Some(style) = weak_style.as_ref() {
        let plate = out_mp4.with_extension("plate.png");
        render_weak_reference_plate_png(&plate, w, h, profile, style, prompt.as_deref())?;
        argv.push("-loop".into());
        argv.push("1".into());
        argv.push("-i".into());
        argv.push(plate.display().to_string());
        plate_path = Some(plate);
    } else {
        argv.push("-f".into());
        argv.push("lavfi".into());
        argv.push("-i".into());
        argv.push(lavfi_color_source(&norm_color, w, h, fps, duration_s));
    }

    argv.push("-vf".into());
    let p = ShotParams {
        id: shot_id.clone(),
        color: norm_color.clone(),
        w,
        h,
        fps,
        duration_s,
        camera: camera.clone(),
    };
    argv.push(build_visible_scene_vf(
        &plan,
        &p,
        prompt.as_deref(),
        profile,
        weak_style.as_ref(),
    ));

    argv.extend(ffmpeg_encoder_args(&plan));
    argv.push("-t".into());
    argv.push(format!("{:.3}", duration_s.max(0.25)));
    argv.push("-pix_fmt".into());
    argv.push("yuv420p".into());
    argv.push("-movflags".into());
    argv.push("+faststart".into());
    argv.push(out_mp4.display().to_string());

    let out = TokCommand::new("ffmpeg").args(argv).output().await?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        anyhow::bail!(
            "ffmpeg shot failed: exit={:?} stderr={}",
            out.status.code(),
            stderr
        );
    }
    if let Some(plate) = plate_path {
        if std::env::var("CSS_VIDEO_KEEP_PLATES").ok().as_deref() != Some("1") {
            let _ = fs::remove_file(plate);
        }
    }
    Ok(())
}

#[derive(Debug, Clone, Copy)]
enum SceneProfile {
    Skyline,
    Desert,
    Shrine,
    Interior,
}

fn build_visible_scene_vf(
    plan: &HwPlan,
    p: &ShotParams,
    prompt: Option<&str>,
    profile: SceneProfile,
    weak_style: Option<&WeakReferenceStyle>,
) -> String {
    if weak_style.is_some() {
        let mut parts = vec![camera_motion_vf(
            p.camera.as_ref(),
            p.w,
            p.h,
            p.fps,
            p.duration_s,
        )];
        match plan.mode {
            HwMode::Nvenc => {
                parts.push("format=rgba".to_string());
                parts.push("hwupload_cuda".to_string());
                parts.push(format!("scale_cuda=w={}:h={}", p.w, p.h));
                parts.push("format=nv12".to_string());
            }
            HwMode::Vaapi => {
                parts.push("format=nv12".to_string());
                parts.push("hwupload".to_string());
                parts.push(format!("scale_vaapi=w={}:h={}", p.w, p.h));
            }
            HwMode::Cpu => {
                parts.push(format!("scale=w={}:h={}", p.w, p.h));
                parts.push("format=yuv420p".to_string());
            }
        }
        return parts.join(",");
    }

    let mut parts: Vec<String> = Vec::new();
    let base = normalize_color(&p.color);
    let shadow = weak_style
        .map(|style| normalize_color(&style.sky_color))
        .unwrap_or_else(|| darken_hex_color(&base, 0.45));
    let accent = weak_style
        .map(|style| normalize_color(&style.ground_color))
        .unwrap_or_else(|| accent_hex_color(&base, prompt, profile));
    let glow = weak_style
        .map(|style| normalize_color(&style.glow_color))
        .unwrap_or_else(|| lighten_hex_color(&accent, 0.28));
    let highlight = weak_style
        .map(|style| normalize_color(&style.accent_color))
        .unwrap_or_else(|| accent_hex_color(&glow, prompt, profile));
    let horizon_ratio = weak_style
        .map(|style| style.horizon_ratio.clamp(0.34, 0.74))
        .unwrap_or(match profile {
            SceneProfile::Desert => 0.54,
            SceneProfile::Skyline => 0.58,
            SceneProfile::Shrine => 0.60,
            SceneProfile::Interior => 0.64,
        });
    let atmosphere = weak_style
        .map(|style| style.atmosphere.clamp(0.08, 0.58))
        .unwrap_or(0.22);
    let haze = lighten_hex_color(&shadow, atmosphere * 0.72);

    parts.push(format!("scale=w={}:h={}", p.w, p.h));
    parts.push(format!("drawbox=x=0:y=0:w=iw:h=ih:color={}:t=fill", shadow));
    parts.push("vignette=PI/10".to_string());
    parts.push(format!(
        "drawbox=x=0:y=0:w=iw:h=ih*{:.3}:color={}:t=fill",
        horizon_ratio * 0.72,
        haze
    ));
    parts.push(format!(
        "drawbox=x=0:y=ih*{:.3}:w=iw:h=ih*{:.3}:color={}:t=fill",
        horizon_ratio * 0.68,
        0.10 + atmosphere * 0.22,
        lighten_hex_color(&haze, 0.08)
    ));
    parts.push(format!(
        "drawbox=x=0:y=ih*{:.3}:w=iw:h=ih*0.12:color={}:t=fill",
        horizon_ratio * 0.84,
        lighten_hex_color(&haze, 0.12)
    ));
    parts.push(format!(
        "drawbox=x=0:y=ih*{:.3}:w=iw:h=ih*0.05:color={}:t=fill",
        horizon_ratio + 0.06,
        lighten_hex_color(&accent, atmosphere * 0.20 + 0.06)
    ));

    match profile {
        SceneProfile::Skyline => {
            parts.push(format!(
                "drawbox=x=0:y=ih*{:.3}:w=iw:h=ih*{:.3}:color={}:t=fill",
                horizon_ratio,
                1.0 - horizon_ratio,
                darken_hex_color(&shadow, 0.12)
            ));
            parts.push(format!(
                "drawbox=x=iw*0.08:y=ih*0.24:w=iw*0.10:h=ih*0.34:color={}:t=fill",
                highlight
            ));
            parts.push(format!(
                "drawbox=x=iw*0.24:y=ih*0.18:w=iw*0.08:h=ih*0.42:color={}:t=fill",
                darken_hex_color(&accent, 0.18)
            ));
            parts.push(format!(
                "drawbox=x=iw*0.74:y=ih*0.20:w=iw*0.11:h=ih*0.38:color={}:t=fill",
                glow
            ));
        }
        SceneProfile::Desert => {
            parts.push(format!(
                "drawbox=x=0:y=ih*{:.3}:w=iw:h=ih*{:.3}:color={}:t=fill",
                horizon_ratio,
                1.0 - horizon_ratio,
                accent
            ));
            parts.extend(environment_mass_layers(
                weak_style,
                horizon_ratio,
                &darken_hex_color(&accent, 0.18),
                &darken_hex_color(&accent, 0.28),
            ));
            parts.push(format!(
                "drawbox=x=iw*0.62:y=ih*0.14:w=iw*0.18:h=ih*0.18:color={}:t=fill",
                glow
            ));
            parts.push(format!(
                "drawbox=x=iw*0.68:y=ih*0.20:w=iw*0.14:h=ih*0.02:color={}:t=fill",
                lighten_hex_color(&glow, 0.12)
            ));
            parts.push(format!(
                "drawbox=x=iw*0.12:y=ih*{:.3}:w=iw*0.32:h=ih*0.05:color={}:t=fill",
                horizon_ratio + 0.06,
                darken_hex_color(&accent, 0.12)
            ));
            parts.push(format!(
                "drawbox=x=iw*0.54:y=ih*{:.3}:w=iw*0.24:h=ih*0.03:color={}:t=fill",
                horizon_ratio + 0.02,
                darken_hex_color(&highlight, 0.18)
            ));
        }
        SceneProfile::Shrine => {
            parts.push(format!(
                "drawbox=x=0:y=ih*{:.3}:w=iw:h=ih*{:.3}:color={}:t=fill",
                horizon_ratio,
                1.0 - horizon_ratio,
                darken_hex_color(&accent, 0.06)
            ));
            parts.push(format!(
                "drawbox=x=iw*0.12:y=ih*0.18:w=iw*0.04:h=ih*0.50:color={}:t=fill",
                glow
            ));
            parts.push(format!(
                "drawbox=x=iw*0.84:y=ih*0.18:w=iw*0.04:h=ih*0.50:color={}:t=fill",
                glow
            ));
            parts.push(format!(
                "drawbox=x=iw*0.18:y=ih*0.24:w=iw*0.64:h=ih*0.05:color={}:t=fill",
                accent
            ));
        }
        SceneProfile::Interior => {
            parts.push(format!(
                "drawbox=x=0:y=ih*{:.3}:w=iw:h=ih*{:.3}:color={}:t=fill",
                horizon_ratio,
                1.0 - horizon_ratio,
                darken_hex_color(&accent, 0.10)
            ));
            parts.push(format!(
                "drawbox=x=iw*0.12:y=ih*0.08:w=iw*0.16:h=ih*0.42:color={}:t=fill",
                darken_hex_color(&glow, 0.05)
            ));
            parts.push(format!(
                "drawbox=x=iw*0.72:y=ih*0.08:w=iw*0.16:h=ih*0.42:color={}:t=fill",
                darken_hex_color(&glow, 0.05)
            ));
        }
    }

    parts.extend(subject_silhouette_layers(
        profile,
        relationship_arc_from_prompt(prompt),
        weak_style
            .map(|style| style.subject_center_x)
            .unwrap_or(0.50),
        weak_style.map(|style| style.silhouette_count).unwrap_or(1),
        weak_style
            .map(|style| style.subject_tint.as_str())
            .unwrap_or(accent.as_str()),
        &glow,
    ));
    parts.push(camera_motion_vf(
        p.camera.as_ref(),
        p.w,
        p.h,
        p.fps,
        p.duration_s,
    ));

    match plan.mode {
        HwMode::Nvenc => {
            parts.push("format=rgba".to_string());
            parts.push("hwupload_cuda".to_string());
            parts.push(format!("scale_cuda=w={}:h={}", p.w, p.h));
            parts.push("format=nv12".to_string());
        }
        HwMode::Vaapi => {
            parts.push("format=nv12".to_string());
            parts.push("hwupload".to_string());
            parts.push(format!("scale_vaapi=w={}:h={}", p.w, p.h));
        }
        HwMode::Cpu => {
            parts.push(format!("scale=w={}:h={}", p.w, p.h));
            parts.push("format=yuv420p".to_string());
        }
    }
    parts.join(",")
}

fn render_weak_reference_plate_png(
    out_path: &Path,
    w: u32,
    h: u32,
    profile: SceneProfile,
    style: &WeakReferenceStyle,
    prompt: Option<&str>,
) -> Result<()> {
    let mut img = RgbaImage::new(w.max(64), h.max(64));
    let sky = parse_hex_rgba(&style.sky_color, 255);
    let ground = parse_hex_rgba(&style.ground_color, 255);
    let accent = parse_hex_rgba(&style.accent_color, 255);
    let glow = parse_hex_rgba(&style.glow_color, 210);
    let subject = parse_hex_rgba(&style.subject_tint, 255);
    let horizon_y = ((h as f32) * style.horizon_ratio.clamp(0.34, 0.74)) as i32;

    paint_vertical_gradient(&mut img, 0, horizon_y.max(1), lighten_rgba(sky, 0.10), sky);
    paint_vertical_gradient(
        &mut img,
        horizon_y.max(0),
        h as i32,
        lighten_rgba(ground, 0.08),
        darken_rgba(ground, 0.18),
    );
    paint_haze_band(
        &mut img,
        horizon_y - ((h as f32 * 0.08) as i32),
        ((h as f32 * 0.18) as i32).max(12),
        lighten_rgba(glow, 0.05),
        0.22 + style.atmosphere * 0.35,
    );
    paint_sky_detail(&mut img, horizon_y, profile, style, accent, glow);
    paint_sun_glow(
        &mut img,
        ((w as f32) * 0.72) as i32,
        ((h as f32) * 0.18) as i32,
        ((w.min(h) as f32) * 0.08) as i32,
        glow,
    );

    paint_ground_texture(&mut img, horizon_y, accent, prompt);
    paint_perspective_ground(&mut img, profile, horizon_y, style, accent, glow, prompt);
    paint_environment_masses(&mut img, profile, horizon_y, style, accent, glow);
    paint_subject_group(&mut img, profile, horizon_y, style, subject, glow);
    paint_atmosphere_noise(&mut img, style.atmosphere);

    let blurred = imageops::blur(&img, 0.6);
    blurred
        .save(out_path)
        .with_context(|| format!("save weak reference plate {}", out_path.display()))?;
    Ok(())
}

fn paint_vertical_gradient(img: &mut RgbaImage, y0: i32, y1: i32, top: Rgba<u8>, bottom: Rgba<u8>) {
    let start = y0.max(0) as u32;
    let end = (y1.max(y0 + 1) as u32).min(img.height());
    let span = (end.saturating_sub(start)).max(1) as f32;
    for y in start..end {
        let t = (y - start) as f32 / span;
        let color = lerp_rgba(top, bottom, t);
        for x in 0..img.width() {
            img.put_pixel(x, y, color);
        }
    }
}

fn paint_haze_band(
    img: &mut RgbaImage,
    center_y: i32,
    band_h: i32,
    color: Rgba<u8>,
    strength: f32,
) {
    let start = (center_y - band_h / 2).max(0) as u32;
    let end = (center_y + band_h / 2)
        .max(start as i32 + 1)
        .min(img.height() as i32) as u32;
    let mid = (start + end) as f32 * 0.5;
    let half = ((end - start).max(1) as f32) * 0.5;
    for y in start..end {
        let falloff = 1.0 - (((y as f32 - mid).abs()) / half).clamp(0.0, 1.0);
        let alpha = strength * falloff * 0.5;
        for x in 0..img.width() {
            blend_pixel(img, x, y, color, alpha);
        }
    }
}

fn paint_sun_glow(img: &mut RgbaImage, cx: i32, cy: i32, radius: i32, color: Rgba<u8>) {
    let r2 = (radius * radius).max(1) as f32;
    let min_x = (cx - radius * 3).max(0) as u32;
    let max_x = (cx + radius * 3).min(img.width() as i32 - 1).max(0) as u32;
    let min_y = (cy - radius * 3).max(0) as u32;
    let max_y = (cy + radius * 3).min(img.height() as i32 - 1).max(0) as u32;
    for y in min_y..=max_y {
        for x in min_x..=max_x {
            let dx = x as f32 - cx as f32;
            let dy = y as f32 - cy as f32;
            let d2 = dx * dx + dy * dy;
            let glow_strength = (-d2 / (r2 * 2.4)).exp() * 0.65;
            if glow_strength > 0.01 {
                blend_pixel(img, x, y, color, glow_strength);
            }
        }
    }
}

fn paint_ground_texture(
    img: &mut RgbaImage,
    horizon_y: i32,
    accent: Rgba<u8>,
    prompt: Option<&str>,
) {
    let lower = prompt.unwrap_or("").to_ascii_lowercase();
    let desert_like = ["desert", "west", "dust", "sand"]
        .iter()
        .any(|t| lower.contains(t));
    let stripe_color = if desert_like {
        lighten_rgba(accent, 0.10)
    } else {
        darken_rgba(accent, 0.08)
    };
    let start = horizon_y.max(0) as u32;
    for band in 0..7u32 {
        let y = start + band * ((img.height().saturating_sub(start)) / 8).max(6);
        let h = ((img.height() as f32) * 0.012).max(3.0) as u32;
        paint_rect_alpha(img, 0, y, img.width(), h, stripe_color, 0.10);
    }
}

fn paint_sky_detail(
    img: &mut RgbaImage,
    horizon_y: i32,
    profile: SceneProfile,
    style: &WeakReferenceStyle,
    accent: Rgba<u8>,
    glow: Rgba<u8>,
) {
    let cloud_alpha = (0.08 + style.atmosphere * 0.16).clamp(0.06, 0.18);
    let cloud_y = (horizon_y as f32 * 0.24).max(12.0) as i32;
    let bias = (style.subject_center_x - 0.5) * 0.22;
    for idx in 0..3 {
        let cx = ((img.width() as f32) * (0.24 + idx as f32 * 0.22 + bias)).round() as i32;
        let cy = cloud_y + idx as i32 * 6;
        let rx = ((img.width() as f32) * (0.08 + idx as f32 * 0.015)) as i32;
        let ry = ((img.height() as f32) * 0.035) as i32;
        paint_ellipse_alpha(
            img,
            cx,
            cy,
            rx.max(20),
            ry.max(8),
            lighten_rgba(glow, 0.12),
            cloud_alpha,
        );
        paint_ellipse_alpha(
            img,
            cx + rx / 3,
            cy + ry / 5,
            (rx as f32 * 0.7) as i32,
            (ry as f32 * 0.85) as i32,
            lighten_rgba(accent, 0.18),
            cloud_alpha * 0.55,
        );
    }
    if matches!(profile, SceneProfile::Desert | SceneProfile::Skyline) {
        let ridge_y = horizon_y - ((img.height() as f32) * 0.04) as i32;
        paint_ridge_band(
            img,
            ridge_y,
            ((img.height() as f32) * 0.05) as i32,
            darken_rgba(accent, 0.30),
            0.28,
            13,
        );
    }
}

fn paint_perspective_ground(
    img: &mut RgbaImage,
    profile: SceneProfile,
    horizon_y: i32,
    style: &WeakReferenceStyle,
    accent: Rgba<u8>,
    glow: Rgba<u8>,
    prompt: Option<&str>,
) {
    let lower = prompt.unwrap_or("").to_ascii_lowercase();
    let road_like = matches!(profile, SceneProfile::Desert | SceneProfile::Skyline)
        || ["road", "street", "avenue", "dust", "town", "west"]
            .iter()
            .any(|token| lower.contains(token));
    if road_like {
        let vanish_x = ((img.width() as f32) * style.subject_center_x.clamp(0.34, 0.66)) as i32;
        let bottom_y = img.height() as i32 - 1;
        paint_quad_alpha(
            img,
            (((img.width() as f32) * 0.14) as i32, bottom_y),
            (((img.width() as f32) * 0.86) as i32, bottom_y),
            (
                vanish_x + ((img.width() as f32) * 0.07) as i32,
                horizon_y + 4,
            ),
            (
                vanish_x - ((img.width() as f32) * 0.07) as i32,
                horizon_y + 4,
            ),
            darken_rgba(accent, 0.10),
            0.34,
        );
        paint_quad_alpha(
            img,
            (((img.width() as f32) * 0.42) as i32, bottom_y),
            (((img.width() as f32) * 0.58) as i32, bottom_y),
            (
                vanish_x + ((img.width() as f32) * 0.01) as i32,
                horizon_y + 10,
            ),
            (
                vanish_x - ((img.width() as f32) * 0.01) as i32,
                horizon_y + 10,
            ),
            lighten_rgba(glow, 0.05),
            0.18,
        );
        for idx in 0..10 {
            let t = idx as f32 / 9.0;
            let y = horizon_y as f32 + t * ((img.height() as f32) - horizon_y as f32);
            let width = (img.width() as f32) * (0.02 + t * 0.20);
            paint_rect_alpha(
                img,
                (vanish_x as f32 - width * 0.5).max(0.0) as u32,
                y as u32,
                width.max(2.0) as u32,
                ((img.height() as f32) * 0.0035).max(1.0) as u32,
                lighten_rgba(accent, 0.16),
                0.10 * (1.0 - t * 0.5),
            );
        }
    }
}

fn paint_environment_masses(
    img: &mut RgbaImage,
    profile: SceneProfile,
    horizon_y: i32,
    style: &WeakReferenceStyle,
    accent: Rgba<u8>,
    glow: Rgba<u8>,
) {
    let left_w = ((img.width() as f32) * style.left_mass.clamp(0.10, 0.38)) as u32;
    let right_w = ((img.width() as f32) * style.right_mass.clamp(0.10, 0.38)) as u32;
    match profile {
        SceneProfile::Desert | SceneProfile::Skyline => {
            let left_x = ((img.width() as f32) * 0.07) as u32;
            let left_y = (horizon_y as f32 * 0.58).max(0.0) as u32;
            let right_x = img
                .width()
                .saturating_sub(((img.width() as f32) * 0.10) as u32 + right_w.max(36));
            let right_y = (horizon_y as f32 * 0.60).max(0.0) as u32;
            let building_h = ((img.height() as f32) * 0.34) as u32;
            paint_town_mass(
                img,
                left_x,
                left_y,
                left_w.max(54),
                building_h.max(48),
                darken_rgba(accent, 0.10),
                0.48,
                true,
            );
            paint_town_mass(
                img,
                right_x,
                right_y,
                right_w.max(54),
                (((img.height() as f32) * 0.32) as u32).max(44),
                darken_rgba(glow, 0.18),
                0.44,
                false,
            );
            paint_fence_posts(
                img,
                horizon_y + ((img.height() as f32) * 0.02) as i32,
                darken_rgba(accent, 0.22),
                0.22,
            );
        }
        SceneProfile::Shrine | SceneProfile::Interior => {
            paint_rect_alpha(
                img,
                ((img.width() as f32) * 0.10) as u32,
                ((img.height() as f32) * 0.16) as u32,
                left_w.max(28),
                ((img.height() as f32) * 0.48) as u32,
                darken_rgba(glow, 0.20),
                0.35,
            );
            paint_rect_alpha(
                img,
                img.width()
                    .saturating_sub(((img.width() as f32) * 0.10) as u32 + right_w.max(28)),
                ((img.height() as f32) * 0.15) as u32,
                right_w.max(28),
                ((img.height() as f32) * 0.50) as u32,
                darken_rgba(glow, 0.20),
                0.35,
            );
        }
    }
}

fn paint_subject_group(
    img: &mut RgbaImage,
    profile: SceneProfile,
    horizon_y: i32,
    style: &WeakReferenceStyle,
    subject: Rgba<u8>,
    glow: Rgba<u8>,
) {
    let center_x = ((img.width() as f32) * style.subject_center_x.clamp(0.24, 0.76)) as i32;
    let base_y = horizon_y + ((img.height() as f32) * 0.04) as i32;
    paint_character(
        img,
        center_x,
        base_y,
        ((img.height() as f32) * 0.22) as i32,
        profile,
        subject,
        glow,
        1.0,
    );
    if style.silhouette_count >= 2 {
        paint_character(
            img,
            center_x - ((img.width() as f32) * 0.18) as i32,
            base_y + ((img.height() as f32) * 0.01) as i32,
            ((img.height() as f32) * 0.18) as i32,
            profile,
            darken_rgba(subject, 0.10),
            darken_rgba(glow, 0.22),
            0.72,
        );
    }
    if style.silhouette_count >= 3 {
        paint_character(
            img,
            center_x + ((img.width() as f32) * 0.17) as i32,
            base_y + ((img.height() as f32) * 0.015) as i32,
            ((img.height() as f32) * 0.17) as i32,
            profile,
            darken_rgba(subject, 0.12),
            darken_rgba(glow, 0.26),
            0.62,
        );
    }
}

fn paint_character(
    img: &mut RgbaImage,
    center_x: i32,
    ground_y: i32,
    height: i32,
    profile: SceneProfile,
    body: Rgba<u8>,
    glow: Rgba<u8>,
    alpha: f32,
) {
    let head_r = (height as f32 * 0.12) as i32;
    let torso_w = (height as f32 * 0.20) as i32;
    let torso_h = (height as f32 * 0.38) as i32;
    let hip_y = ground_y - (height as f32 * 0.24) as i32;
    let shoulder_y = hip_y - torso_h;
    let coat = darken_rgba(body, 0.12);
    paint_ellipse_alpha(
        img,
        center_x,
        shoulder_y - head_r / 2,
        head_r.max(4),
        head_r.max(4),
        glow,
        alpha * 0.92,
    );
    paint_ellipse_alpha(
        img,
        center_x,
        shoulder_y - head_r / 2,
        (head_r as f32 * 0.78) as i32,
        (head_r as f32 * 0.84) as i32,
        body,
        alpha * 0.72,
    );
    paint_rounded_rect_alpha(
        img,
        center_x - torso_w / 2,
        shoulder_y,
        torso_w.max(6),
        torso_h.max(12),
        body,
        alpha,
    );
    paint_triangle_alpha(
        img,
        (center_x - torso_w / 2, shoulder_y + torso_h / 5),
        (center_x + torso_w / 2, shoulder_y + torso_h / 5),
        (center_x, ground_y - head_r / 2),
        coat,
        alpha * 0.42,
    );
    paint_limb_alpha(
        img,
        center_x - torso_w / 5,
        hip_y,
        center_x - torso_w / 5,
        ground_y,
        body,
        alpha * 0.95,
    );
    paint_limb_alpha(
        img,
        center_x + torso_w / 5,
        hip_y,
        center_x + torso_w / 5,
        ground_y,
        body,
        alpha * 0.95,
    );
    paint_limb_alpha(
        img,
        center_x - torso_w / 2,
        shoulder_y + torso_h / 4,
        center_x - torso_w,
        shoulder_y + torso_h / 2,
        glow,
        alpha * 0.68,
    );
    paint_limb_alpha(
        img,
        center_x + torso_w / 2,
        shoulder_y + torso_h / 4,
        center_x + torso_w,
        shoulder_y + torso_h / 2,
        glow,
        alpha * 0.68,
    );
    if matches!(profile, SceneProfile::Desert) {
        paint_triangle_alpha(
            img,
            (center_x - torso_w / 2, shoulder_y - head_r / 2),
            (center_x, shoulder_y - head_r),
            (center_x + torso_w / 2, shoulder_y - head_r / 2),
            darken_rgba(body, 0.22),
            alpha * 0.8,
        );
        paint_limb_alpha(
            img,
            center_x,
            shoulder_y - head_r / 4,
            center_x + torso_w,
            shoulder_y + torso_h / 6,
            darken_rgba(glow, 0.18),
            alpha * 0.55,
        );
    }
    paint_shadow_alpha(
        img,
        center_x + torso_w / 3,
        ground_y + head_r / 3,
        (height as f32 * 0.28) as i32,
        (head_r as f32 * 0.9) as i32,
        darken_rgba(body, 0.30),
        alpha * 0.45,
    );
}

fn paint_atmosphere_noise(img: &mut RgbaImage, amount: f32) {
    let strength = amount.clamp(0.06, 0.40);
    for y in 0..img.height() {
        for x in 0..img.width() {
            let grain = pseudo_noise(x, y);
            if grain > 0.78 {
                let alpha = ((grain - 0.78) * strength).clamp(0.0, 0.08);
                blend_pixel(img, x, y, Rgba([255, 255, 255, 255]), alpha);
            } else if grain < 0.18 {
                let alpha = ((0.18 - grain) * strength * 0.8).clamp(0.0, 0.05);
                blend_pixel(img, x, y, Rgba([0, 0, 0, 255]), alpha);
            }
        }
    }
}

fn paint_rect_alpha(
    img: &mut RgbaImage,
    x: u32,
    y: u32,
    w: u32,
    h: u32,
    color: Rgba<u8>,
    alpha: f32,
) {
    let max_x = x.saturating_add(w).min(img.width());
    let max_y = y.saturating_add(h).min(img.height());
    for yy in y..max_y {
        for xx in x..max_x {
            blend_pixel(img, xx, yy, color, alpha);
        }
    }
}

fn paint_rounded_rect_alpha(
    img: &mut RgbaImage,
    x: i32,
    y: i32,
    w: i32,
    h: i32,
    color: Rgba<u8>,
    alpha: f32,
) {
    let radius = (w.min(h) as f32 * 0.16) as i32;
    for yy in 0..h.max(0) {
        for xx in 0..w.max(0) {
            let px = x + xx;
            let py = y + yy;
            if px < 0 || py < 0 || px >= img.width() as i32 || py >= img.height() as i32 {
                continue;
            }
            let dx = (xx - radius).min(w - radius - 1 - xx).max(0);
            let dy = (yy - radius).min(h - radius - 1 - yy).max(0);
            if dx * dx + dy * dy >= radius * radius
                && (xx < radius || yy < radius || xx >= w - radius || yy >= h - radius)
            {
                continue;
            }
            blend_pixel(img, px as u32, py as u32, color, alpha);
        }
    }
}

fn paint_ellipse_alpha(
    img: &mut RgbaImage,
    cx: i32,
    cy: i32,
    rx: i32,
    ry: i32,
    color: Rgba<u8>,
    alpha: f32,
) {
    let rx2 = (rx * rx).max(1) as f32;
    let ry2 = (ry * ry).max(1) as f32;
    let min_x = (cx - rx).max(0) as u32;
    let max_x = (cx + rx).min(img.width() as i32 - 1).max(0) as u32;
    let min_y = (cy - ry).max(0) as u32;
    let max_y = (cy + ry).min(img.height() as i32 - 1).max(0) as u32;
    for y in min_y..=max_y {
        for x in min_x..=max_x {
            let dx = x as f32 - cx as f32;
            let dy = y as f32 - cy as f32;
            if (dx * dx) / rx2 + (dy * dy) / ry2 <= 1.0 {
                blend_pixel(img, x, y, color, alpha);
            }
        }
    }
}

fn paint_shadow_alpha(
    img: &mut RgbaImage,
    cx: i32,
    cy: i32,
    rx: i32,
    ry: i32,
    color: Rgba<u8>,
    alpha: f32,
) {
    paint_ellipse_alpha(img, cx, cy, rx, ry.max(2), color, alpha * 0.35);
}

fn paint_limb_alpha(
    img: &mut RgbaImage,
    x0: i32,
    y0: i32,
    x1: i32,
    y1: i32,
    color: Rgba<u8>,
    alpha: f32,
) {
    let steps = ((x1 - x0).abs().max((y1 - y0).abs())).max(1) as usize;
    for step in 0..=steps {
        let t = step as f32 / steps as f32;
        let x = x0 as f32 + (x1 - x0) as f32 * t;
        let y = y0 as f32 + (y1 - y0) as f32 * t;
        paint_ellipse_alpha(img, x.round() as i32, y.round() as i32, 3, 3, color, alpha);
    }
}

fn paint_triangle_alpha(
    img: &mut RgbaImage,
    a: (i32, i32),
    b: (i32, i32),
    c: (i32, i32),
    color: Rgba<u8>,
    alpha: f32,
) {
    let min_x = a.0.min(b.0).min(c.0).max(0) as u32;
    let max_x = a.0.max(b.0).max(c.0).min(img.width() as i32 - 1).max(0) as u32;
    let min_y = a.1.min(b.1).min(c.1).max(0) as u32;
    let max_y = a.1.max(b.1).max(c.1).min(img.height() as i32 - 1).max(0) as u32;
    for y in min_y..=max_y {
        for x in min_x..=max_x {
            if point_in_triangle((x as f32, y as f32), a, b, c) {
                blend_pixel(img, x, y, color, alpha);
            }
        }
    }
}

fn paint_quad_alpha(
    img: &mut RgbaImage,
    a: (i32, i32),
    b: (i32, i32),
    c: (i32, i32),
    d: (i32, i32),
    color: Rgba<u8>,
    alpha: f32,
) {
    paint_triangle_alpha(img, a, b, c, color, alpha);
    paint_triangle_alpha(img, a, c, d, color, alpha);
}

fn paint_town_mass(
    img: &mut RgbaImage,
    x: u32,
    y: u32,
    w: u32,
    h: u32,
    color: Rgba<u8>,
    alpha: f32,
    left_cluster: bool,
) {
    let roof_h = (h as f32 * 0.12).max(6.0) as u32;
    paint_rect_alpha(
        img,
        x,
        y + roof_h / 2,
        w,
        h.saturating_sub(roof_h / 2),
        color,
        alpha,
    );
    paint_quad_alpha(
        img,
        (x as i32, (y + roof_h) as i32),
        ((x + w) as i32, (y + roof_h) as i32),
        ((x + w.saturating_sub(w / 10)) as i32, y as i32),
        ((x + w / 10) as i32, y as i32),
        darken_rgba(color, 0.18),
        alpha * 0.9,
    );
    let porch_w = (w as f32 * 0.72).max(14.0) as u32;
    let porch_h = (h as f32 * 0.08).max(4.0) as u32;
    let porch_x = if left_cluster { x + w / 10 } else { x + w / 6 };
    let porch_y = y + h.saturating_sub((h as f32 * 0.24) as u32);
    paint_rect_alpha(
        img,
        porch_x,
        porch_y,
        porch_w.min(img.width().saturating_sub(porch_x)),
        porch_h,
        darken_rgba(color, 0.26),
        alpha * 0.75,
    );
    let window_color = lighten_rgba(color, 0.34);
    for row in 0..2u32 {
        for col in 0..3u32 {
            let wx = x + w / 8 + col * (w / 4).max(10);
            let wy = y + roof_h + row * ((h / 4).max(10));
            paint_rect_alpha(
                img,
                wx.min(img.width().saturating_sub(1)),
                wy.min(img.height().saturating_sub(1)),
                (w / 10).max(4),
                (h / 12).max(4),
                window_color,
                alpha * 0.45,
            );
        }
    }
}

fn paint_fence_posts(img: &mut RgbaImage, base_y: i32, color: Rgba<u8>, alpha: f32) {
    for idx in 0..9u32 {
        let x = ((img.width() as f32) * (0.10 + idx as f32 * 0.09)) as u32;
        let h = ((img.height() as f32) * (0.02 + idx as f32 * 0.005)) as u32;
        paint_rect_alpha(
            img,
            x.min(img.width().saturating_sub(1)),
            base_y.max(0) as u32,
            2,
            h.max(3),
            color,
            alpha,
        );
    }
}

fn paint_ridge_band(
    img: &mut RgbaImage,
    y: i32,
    h: i32,
    color: Rgba<u8>,
    alpha: f32,
    peak_step: i32,
) {
    let width = img.width() as i32;
    for x in 0..width {
        let wave = ((x % peak_step.max(3)) as f32 / peak_step.max(3) as f32 - 0.5).abs();
        let ridge_h = (h as f32 * (0.45 + wave * 1.4)) as i32;
        paint_rect_alpha(
            img,
            x as u32,
            (y - ridge_h).max(0) as u32,
            1,
            ridge_h.max(1) as u32,
            color,
            alpha,
        );
    }
}

fn point_in_triangle(p: (f32, f32), a: (i32, i32), b: (i32, i32), c: (i32, i32)) -> bool {
    let (px, py) = p;
    let sign = |p1: (f32, f32), p2: (i32, i32), p3: (i32, i32)| -> f32 {
        (p1.0 - p3.0 as f32) * (p2.1 as f32 - p3.1 as f32)
            - (p2.0 as f32 - p3.0 as f32) * (p1.1 - p3.1 as f32)
    };
    let d1 = sign((px, py), a, b);
    let d2 = sign((px, py), b, c);
    let d3 = sign((px, py), c, a);
    let has_neg = d1 < 0.0 || d2 < 0.0 || d3 < 0.0;
    let has_pos = d1 > 0.0 || d2 > 0.0 || d3 > 0.0;
    !(has_neg && has_pos)
}

fn blend_pixel(img: &mut RgbaImage, x: u32, y: u32, src: Rgba<u8>, alpha: f32) {
    if x >= img.width() || y >= img.height() {
        return;
    }
    let dst = *img.get_pixel(x, y);
    let a = alpha.clamp(0.0, 1.0) * (src.0[3] as f32 / 255.0);
    let inv = 1.0 - a;
    let mixed = Rgba([
        (dst.0[0] as f32 * inv + src.0[0] as f32 * a).round() as u8,
        (dst.0[1] as f32 * inv + src.0[1] as f32 * a).round() as u8,
        (dst.0[2] as f32 * inv + src.0[2] as f32 * a).round() as u8,
        255,
    ]);
    img.put_pixel(x, y, mixed);
}

fn parse_hex_rgba(input: &str, alpha: u8) -> Rgba<u8> {
    let (r, g, b) = parse_hex_color(input).unwrap_or((32, 48, 68));
    Rgba([r, g, b, alpha])
}

fn lerp_rgba(a: Rgba<u8>, b: Rgba<u8>, t: f32) -> Rgba<u8> {
    let mix = |x: u8, y: u8| -> u8 { (x as f32 + (y as f32 - x as f32) * t).round() as u8 };
    Rgba([
        mix(a.0[0], b.0[0]),
        mix(a.0[1], b.0[1]),
        mix(a.0[2], b.0[2]),
        255,
    ])
}

fn lighten_rgba(input: Rgba<u8>, ratio: f32) -> Rgba<u8> {
    adjust_rgba(input, ratio.abs())
}

fn darken_rgba(input: Rgba<u8>, ratio: f32) -> Rgba<u8> {
    adjust_rgba(input, -ratio.abs())
}

fn adjust_rgba(input: Rgba<u8>, delta: f32) -> Rgba<u8> {
    let apply = |value: u8| -> u8 {
        let v = value as f32;
        let next = if delta >= 0.0 {
            v + (255.0 - v) * delta.clamp(0.0, 1.0)
        } else {
            v * (1.0 + delta.clamp(-1.0, 0.0))
        };
        next.round().clamp(0.0, 255.0) as u8
    };
    Rgba([
        apply(input.0[0]),
        apply(input.0[1]),
        apply(input.0[2]),
        input.0[3],
    ])
}

fn pseudo_noise(x: u32, y: u32) -> f32 {
    let mut n = x
        .wrapping_mul(374761393)
        .wrapping_add(y.wrapping_mul(668265263));
    n = (n ^ (n >> 13)).wrapping_mul(1274126177);
    ((n ^ (n >> 16)) & 1023) as f32 / 1023.0
}

fn subject_silhouette_layers(
    profile: SceneProfile,
    relationship_arc: Option<&str>,
    subject_center_x: f32,
    silhouette_count: usize,
    accent: &str,
    glow: &str,
) -> Vec<String> {
    let (base_y, body_w, body_h) = match (profile, relationship_arc.unwrap_or("")) {
        (_, "equals_to_lead") => (0.17, 0.13, 0.58),
        (_, "scatter_to_center") => (0.19, 0.12, 0.56),
        (_, "center_release") => (0.19, 0.12, 0.56),
        (_, "solo_release") => (0.15, 0.13, 0.60),
        (SceneProfile::Skyline, _) => (0.18, 0.12, 0.56),
        (SceneProfile::Desert, _) => (0.22, 0.13, 0.52),
        (SceneProfile::Shrine, _) => (0.20, 0.12, 0.54),
        (SceneProfile::Interior, _) => (0.18, 0.13, 0.57),
    };
    let center_x = subject_center_x.clamp(0.26, 0.74);
    let torso_x = (center_x - body_w * 0.40).clamp(0.10, 0.82);
    let head_x = (center_x - body_w * 0.18).clamp(0.12, 0.86);
    let arm_y = base_y + body_h * 0.26;
    let leg_y = base_y + body_h * 0.56;
    let mut layers = vec![
        format!(
            "drawbox=x=iw*{:.3}:y=ih*{:.3}:w=iw*{:.3}:h=ih*{:.3}:color={}:t=fill",
            torso_x,
            base_y + body_h * 0.12,
            body_w * 0.72,
            body_h * 0.52,
            darken_hex_color(accent, 0.28)
        ),
        format!(
            "drawbox=x=iw*{:.3}:y=ih*{:.3}:w=iw*{:.3}:h=ih*{:.3}:color={}:t=fill",
            head_x,
            base_y,
            body_w * 0.36,
            body_h * 0.18,
            glow
        ),
        format!(
            "drawbox=x=iw*{:.3}:y=ih*{:.3}:w=iw*{:.3}:h=ih*0.032:color={}:t=fill",
            torso_x - body_w * 0.34,
            arm_y,
            body_w * 0.38,
            glow
        ),
        format!(
            "drawbox=x=iw*{:.3}:y=ih*{:.3}:w=iw*{:.3}:h=ih*0.032:color={}:t=fill",
            torso_x + body_w * 0.68,
            arm_y,
            body_w * 0.38,
            glow
        ),
        format!(
            "drawbox=x=iw*{:.3}:y=ih*{:.3}:w=iw*{:.3}:h=ih*{:.3}:color={}:t=fill",
            torso_x + body_w * 0.12,
            leg_y,
            body_w * 0.18,
            body_h * 0.34,
            darken_hex_color(accent, 0.22)
        ),
        format!(
            "drawbox=x=iw*{:.3}:y=ih*{:.3}:w=iw*{:.3}:h=ih*{:.3}:color={}:t=fill",
            torso_x + body_w * 0.42,
            leg_y,
            body_w * 0.18,
            body_h * 0.34,
            darken_hex_color(accent, 0.22)
        ),
    ];

    match relationship_arc.unwrap_or("") {
        "equals_to_lead" => {
            layers.push(format!(
                "drawbox=x=iw*0.30:y=ih*0.26:w=iw*0.09:h=ih*0.40:color={}:t=fill",
                darken_hex_color(glow, 0.28)
            ));
        }
        "scatter_to_center" => {
            layers.push(format!(
                "drawbox=x=iw*0.24:y=ih*0.34:w=iw*0.07:h=ih*0.28:color={}:t=fill",
                darken_hex_color(glow, 0.18)
            ));
            layers.push(format!(
                "drawbox=x=iw*0.69:y=ih*0.34:w=iw*0.07:h=ih*0.28:color={}:t=fill",
                darken_hex_color(glow, 0.18)
            ));
        }
        "center_release" => {
            layers.push(format!(
                "drawbox=x=iw*0.18:y=ih*0.36:w=iw*0.06:h=ih*0.22:color={}:t=fill",
                darken_hex_color(glow, 0.22)
            ));
            layers.push(format!(
                "drawbox=x=iw*0.77:y=ih*0.36:w=iw*0.06:h=ih*0.22:color={}:t=fill",
                darken_hex_color(glow, 0.22)
            ));
        }
        _ => {}
    }

    if silhouette_count >= 2 {
        let x = (center_x - 0.22).clamp(0.08, 0.72);
        layers.push(format!(
            "drawbox=x=iw*{:.3}:y=ih*0.30:w=iw*0.08:h=ih*0.34:color={}:t=fill",
            x,
            darken_hex_color(accent, 0.18)
        ));
    }
    if silhouette_count >= 3 {
        let x = (center_x + 0.20).clamp(0.18, 0.84);
        layers.push(format!(
            "drawbox=x=iw*{:.3}:y=ih*0.28:w=iw*0.07:h=ih*0.38:color={}:t=fill",
            x,
            darken_hex_color(glow, 0.30)
        ));
    }

    layers
}

fn environment_mass_layers(
    weak_style: Option<&WeakReferenceStyle>,
    horizon_ratio: f32,
    left_color: &str,
    right_color: &str,
) -> Vec<String> {
    let left_mass = weak_style
        .map(|style| style.left_mass)
        .unwrap_or(0.24)
        .clamp(0.08, 0.44);
    let right_mass = weak_style
        .map(|style| style.right_mass)
        .unwrap_or(0.24)
        .clamp(0.08, 0.44);
    vec![
        format!(
            "drawbox=x=iw*0.08:y=ih*{:.3}:w=iw*{:.3}:h=ih*0.22:color={}:t=fill",
            horizon_ratio - 0.10,
            left_mass,
            left_color
        ),
        format!(
            "drawbox=x=iw*{:.3}:y=ih*{:.3}:w=iw*{:.3}:h=ih*0.24:color={}:t=fill",
            0.92 - right_mass,
            horizon_ratio - 0.08,
            right_mass,
            right_color
        ),
    ]
}

fn camera_motion_vf(
    camera: Option<&crate::video::storyboard::Camera>,
    w: u32,
    h: u32,
    fps: u32,
    duration_s: f64,
) -> String {
    let move_name = camera.map(|c| c.r#move.as_str()).unwrap_or("push_in");
    let strength = camera.map(|c| c.strength).unwrap_or(0.18).clamp(0.05, 0.6);
    let frame_count = ((fps as f64) * duration_s.max(0.5)).round().max(1.0);
    let zoom_end = 1.0 + strength * 0.22;
    let x_expr = match move_name {
        "pan_left" => format!("(iw-iw/zoom)*(1-on/{frame_count:.0})"),
        "pan_right" => format!("(iw-iw/zoom)*(on/{frame_count:.0})"),
        _ => "(iw-iw/zoom)/2".to_string(),
    };
    let y_expr = match move_name {
        "tilt_up" => format!("(ih-ih/zoom)*(1-on/{frame_count:.0})"),
        "tilt_down" => format!("(ih-ih/zoom)*(on/{frame_count:.0})"),
        _ => "(ih-ih/zoom)/2".to_string(),
    };
    let zoom_expr = match move_name {
        "pull_out" => format!("{zoom_end:.4}-{:.4}*(on/{frame_count:.0})", zoom_end - 1.0),
        _ => format!("1+{:.4}*(on/{frame_count:.0})", zoom_end - 1.0),
    };
    format!(
        "zoompan=z='{}':x='{}':y='{}':d=1:s={}x{}:fps={}",
        zoom_expr, x_expr, y_expr, w, h, fps
    )
}

fn scene_profile_from_prompt(
    shot_id: &str,
    prompt: Option<&str>,
    weak_style: Option<&WeakReferenceStyle>,
) -> SceneProfile {
    if let Some(style) = weak_style {
        if let Some(profile_hint) = style.profile_hint.as_deref() {
            match profile_hint {
                "desert" => return SceneProfile::Desert,
                "shrine" => return SceneProfile::Shrine,
                "interior" => return SceneProfile::Interior,
                "skyline" => return SceneProfile::Skyline,
                _ => {}
            }
        }
    }
    let text = format!("{} {}", shot_id, prompt.unwrap_or("")).to_lowercase();
    if ["desert", "sand", "horizon", "dawn", "dust", "ember", "ash"]
        .iter()
        .any(|token| text.contains(token))
    {
        SceneProfile::Desert
    } else if [
        "temple", "shrine", "garden", "palace", "opera", "court", "altar",
    ]
    .iter()
    .any(|token| text.contains(token))
    {
        SceneProfile::Shrine
    } else if [
        "interior", "hall", "corridor", "mirror", "chamber", "throne",
    ]
    .iter()
    .any(|token| text.contains(token))
    {
        SceneProfile::Interior
    } else {
        SceneProfile::Skyline
    }
}

fn relationship_arc_from_prompt(prompt: Option<&str>) -> Option<&'static str> {
    let text = prompt.unwrap_or("").to_lowercase();
    [
        "equals_to_lead",
        "scatter_to_center",
        "center_release",
        "solo_release",
        "lead_to_release",
        "balanced_to_turn",
    ]
    .into_iter()
    .find(|token| text.contains(token))
}

fn accent_hex_color(base: &str, prompt: Option<&str>, profile: SceneProfile) -> String {
    let text = prompt.unwrap_or("").to_lowercase();
    if ["ember", "fire", "crimson", "scarlet", "ash", "crown"]
        .iter()
        .any(|token| text.contains(token))
    {
        "#d86b43".to_string()
    } else if ["snow", "ice", "silver", "glass", "mirror"]
        .iter()
        .any(|token| text.contains(token))
    {
        "#9ab6d8".to_string()
    } else {
        match profile {
            SceneProfile::Skyline => lighten_hex_color(base, 0.18),
            SceneProfile::Desert => "#b78a57".to_string(),
            SceneProfile::Shrine => "#6f8ea8".to_string(),
            SceneProfile::Interior => "#8f6f96".to_string(),
        }
    }
}

fn lighten_hex_color(input: &str, ratio: f32) -> String {
    adjust_hex_color(input, ratio.abs())
}

fn darken_hex_color(input: &str, ratio: f32) -> String {
    adjust_hex_color(input, -ratio.abs())
}

fn adjust_hex_color(input: &str, delta: f32) -> String {
    let (r, g, b) = parse_hex_color(input).unwrap_or((12, 18, 34));
    let apply = |value: u8| -> u8 {
        let v = value as f32;
        let next = if delta >= 0.0 {
            v + (255.0 - v) * delta.clamp(0.0, 1.0)
        } else {
            v * (1.0 + delta.clamp(-1.0, 0.0))
        };
        next.round().clamp(0.0, 255.0) as u8
    };
    format!("#{:02X}{:02X}{:02X}", apply(r), apply(g), apply(b))
}

fn parse_hex_color(input: &str) -> Option<(u8, u8, u8)> {
    let hex = input.trim().trim_start_matches('#');
    if hex.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
    let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
    let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
    Some((r, g, b))
}

fn load_storyboard(path: &Path) -> Result<Storyboard> {
    let s =
        fs::read_to_string(path).with_context(|| format!("read storyboard {}", path.display()))?;
    if let Ok(sb) = serde_json::from_str::<Storyboard>(&s) {
        return Ok(sb);
    }
    let value: serde_json::Value = serde_json::from_str(&s).context("parse storyboard")?;
    let schema = value
        .get("schema")
        .and_then(|v| v.as_str())
        .unwrap_or_default();
    if schema == "css.video.plan.v1" {
        let seed = value.get("seed").and_then(|v| v.as_u64()).unwrap_or(123);
        let fps = value.get("fps").and_then(|v| v.as_u64()).unwrap_or(30) as u32;
        let shots = value
            .get("shots")
            .and_then(|v| v.as_array())
            .cloned()
            .unwrap_or_default()
            .into_iter()
            .enumerate()
            .map(|(index, shot)| Shot {
                id: shot
                    .get("id")
                    .and_then(|v| v.as_str())
                    .map(|v| v.to_string())
                    .unwrap_or_else(|| format!("video_shot_{index:03}")),
                duration_s: shot
                    .get("duration_s")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(4.0),
                prompt: shot
                    .get("prompt")
                    .and_then(|v| v.as_str())
                    .map(|v| v.to_string()),
                bg: Bg {
                    kind: "color".to_string(),
                    value: "#08110d".to_string(),
                },
                camera: Camera {
                    r#move: "push_in".to_string(),
                    strength: 0.18,
                    strategy: Some("legacy_plan_upgrade".to_string()),
                },
                overlay: Overlay { enabled: false },
            })
            .collect();
        return Ok(Storyboard {
            schema: "css.video.storyboard.v1".to_string(),
            seed,
            fps,
            resolution: Resolution { w: 1280, h: 720 },
            shots,
        });
    }
    let sb: Storyboard = serde_json::from_value(value).context("parse storyboard")?;
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

async fn write_concat_list_async(path: &Path, shots: &[PathBuf]) -> Result<()> {
    let mut out = String::new();
    for p in shots {
        let rel = p.to_string_lossy();
        out.push_str("file '");
        out.push_str(&rel.replace('\'', "'\\''"));
        out.push_str("'\n");
    }
    tokio::fs::write(path, out).await?;
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
