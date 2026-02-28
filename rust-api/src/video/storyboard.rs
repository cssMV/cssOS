use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Storyboard {
    pub schema: String,
    pub seed: u64,
    pub fps: u32,
    pub resolution: Resolution,
    pub shots: Vec<Shot>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Resolution {
    pub w: u32,
    pub h: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Shot {
    pub id: String,
    pub duration_s: f64,
    pub bg: Bg,
    pub camera: Camera,
    pub overlay: Overlay,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Bg {
    pub kind: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Camera {
    pub r#move: String,
    pub strength: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Overlay {
    pub enabled: bool,
}

#[derive(Debug, Clone)]
pub struct AutoShotConfig {
    pub min_shots: usize,
    pub max_shots: usize,
    pub min_len_s: f64,
    pub max_len_s: f64,
    pub fps: u32,
    pub w: u32,
    pub h: u32,
}

impl Default for AutoShotConfig {
    fn default() -> Self {
        Self {
            min_shots: 8,
            max_shots: 36,
            min_len_s: 4.0,
            max_len_s: 6.0,
            fps: 30,
            w: 1280,
            h: 720,
        }
    }
}

pub fn ensure_storyboard_auto(
    storyboard_path: &Path,
    seed: u64,
    duration_s: Option<f64>,
    cfg: AutoShotConfig,
) -> anyhow::Result<(Storyboard, serde_json::Value)> {
    if storyboard_path.exists() {
        let sb = load_storyboard(storyboard_path)?;
        let meta = serde_json::json!({
            "mode": "existing",
            "path": storyboard_path.to_string_lossy(),
            "n": sb.shots.len(),
            "fps": sb.fps,
            "resolution": { "w": sb.resolution.w, "h": sb.resolution.h }
        });
        return Ok((sb, meta));
    }

    let dur = duration_s.unwrap_or(60.0);
    let shots = generate_auto_shots(seed, dur, &cfg);
    let sb = Storyboard {
        schema: "css.video.storyboard.v1".to_string(),
        seed,
        fps: cfg.fps,
        resolution: Resolution { w: cfg.w, h: cfg.h },
        shots,
    };
    save_storyboard_atomic(storyboard_path, &sb)?;

    let meta = serde_json::json!({
        "mode": "auto",
        "duration_s": dur,
        "range_s": [cfg.min_len_s, cfg.max_len_s],
        "clamp": [cfg.min_shots, cfg.max_shots],
        "n": sb.shots.len(),
        "fps": sb.fps,
        "resolution": { "w": sb.resolution.w, "h": sb.resolution.h },
        "path": storyboard_path.to_string_lossy(),
    });
    Ok((sb, meta))
}

fn load_storyboard(path: &Path) -> anyhow::Result<Storyboard> {
    let s = fs::read_to_string(path)?;
    let sb: Storyboard = serde_json::from_str(&s)?;
    Ok(sb)
}

fn save_storyboard_atomic(path: &Path, sb: &Storyboard) -> anyhow::Result<()> {
    let dir = path.parent().unwrap_or(Path::new("."));
    fs::create_dir_all(dir).ok();
    let tmp: PathBuf = dir.join(format!(
        ".storyboard.tmp.{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    ));
    let data = serde_json::to_vec_pretty(sb)?;
    fs::write(&tmp, data)?;
    fs::rename(&tmp, path)?;
    Ok(())
}

fn generate_auto_shots(seed: u64, duration_s: f64, cfg: &AutoShotConfig) -> Vec<Shot> {
    let mut rng = Lcg::new(seed ^ 0xC55A_5A5A_A11C_EE11);
    let avg = (cfg.min_len_s + cfg.max_len_s) * 0.5;
    let mut n = ((duration_s / avg).round() as i64).max(1) as usize;
    n = n.clamp(cfg.min_shots, cfg.max_shots);

    let mut remain = duration_s.max(1.0);
    let mut out = Vec::with_capacity(n);
    for i in 0..n {
        let left = n - i;
        let min_total = cfg.min_len_s * left as f64;
        let max_total = cfg.max_len_s * left as f64;

        let mut d = cfg.min_len_s + rng.f64() * (cfg.max_len_s - cfg.min_len_s);
        if remain < min_total {
            d = (remain / left as f64).max(0.8);
        } else if remain > max_total {
            d = cfg.max_len_s;
        } else {
            let max_for_this = (remain - cfg.min_len_s * (left as f64 - 1.0)).min(cfg.max_len_s);
            let min_for_this = (remain - cfg.max_len_s * (left as f64 - 1.0)).max(cfg.min_len_s);
            d = min_for_this + rng.f64() * (max_for_this - min_for_this).max(0.0);
        }

        remain = (remain - d).max(0.0);

        let color = pick_color(&mut rng);
        let cam = pick_camera(&mut rng);

        out.push(Shot {
            id: format!("video_shot_{:03}", i),
            duration_s: round_2(d.max(0.8)),
            bg: Bg {
                kind: "color".to_string(),
                value: color,
            },
            camera: cam,
            overlay: Overlay { enabled: false },
        });
    }
    out
}

fn pick_color(rng: &mut Lcg) -> String {
    const COLORS: [&str; 8] = [
        "#0B1020", "#101820", "#0A0A0A", "#111827", "#0F172A", "#1F2937", "#0B1320", "#0C1222",
    ];
    let idx = (rng.u32() as usize) % COLORS.len();
    COLORS[idx].to_string()
}

fn pick_camera(rng: &mut Lcg) -> Camera {
    const MOVES: [&str; 6] = [
        "push_in",
        "pull_out",
        "pan_left",
        "pan_right",
        "tilt_up",
        "tilt_down",
    ];
    let mv = MOVES[(rng.u32() as usize) % MOVES.len()].to_string();
    let strength = 0.25 + rng.f64() * 0.45;
    Camera {
        r#move: mv,
        strength: round_2(strength),
    }
}

fn round_2(x: f64) -> f64 {
    (x * 100.0).round() / 100.0
}

struct Lcg {
    state: u64,
}
impl Lcg {
    fn new(seed: u64) -> Self {
        Self { state: seed | 1 }
    }
    fn next(&mut self) -> u64 {
        self.state = self
            .state
            .wrapping_mul(6364136223846793005u64)
            .wrapping_add(1442695040888963407u64);
        self.state
    }
    fn u32(&mut self) -> u32 {
        (self.next() >> 32) as u32
    }
    fn f64(&mut self) -> f64 {
        let v = self.u32() as f64;
        v / (u32::MAX as f64)
    }
}

pub type StoryboardV1 = Storyboard;
