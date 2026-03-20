use crate::immersion_engine::runtime::ImmersionSnapshot;
use crate::scene_semantics_engine::state::SceneSemanticState;
use crate::scene_semantics_engine::types::{SceneCameraHint, SceneSemanticKind, SceneTensionLevel};
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
    #[serde(default)]
    pub prompt: Option<String>,
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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub strategy: Option<String>,
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
            min_shots: 2,
            max_shots: 12,
            min_len_s: 2.0,
            max_len_s: 4.0,
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
    creative_hint: Option<String>,
    immersion: Option<&ImmersionSnapshot>,
    scene_semantics: Option<&SceneSemanticState>,
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
    let shots = generate_auto_shots(
        seed,
        dur,
        &cfg,
        creative_hint.clone(),
        immersion,
        scene_semantics,
    );
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
        "creative_hint": creative_hint,
        "immersion": immersion,
        "scene_semantics": scene_semantics
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

fn generate_auto_shots(
    seed: u64,
    duration_s: f64,
    cfg: &AutoShotConfig,
    creative_hint: Option<String>,
    immersion: Option<&ImmersionSnapshot>,
    scene_semantics: Option<&SceneSemanticState>,
) -> Vec<Shot> {
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

        let d;
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
        let cam = pick_camera(&mut rng, immersion, scene_semantics, i, n);

        out.push(Shot {
            id: format!("video_shot_{:03}", i),
            duration_s: round_2(d.max(0.8)),
            prompt: creative_hint
                .as_ref()
                .map(|h| format!("{h} | shot {}", i + 1)),
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

fn pick_camera(
    rng: &mut Lcg,
    immersion: Option<&ImmersionSnapshot>,
    scene_semantics: Option<&SceneSemanticState>,
    index: usize,
    total: usize,
) -> Camera {
    const MOVES: [&str; 6] = [
        "push_in",
        "pull_out",
        "pan_left",
        "pan_right",
        "tilt_up",
        "tilt_down",
    ];

    let semantic_camera_hint = scene_semantics.map(|scene| {
        crate::scene_semantics_engine::rules::preferred_camera_mode(&scene.semantic, &scene.tension)
    });

    let (mv, strength, strategy) =
        if let Some(SceneCameraHint::DialogueTwoShot) = semantic_camera_hint {
            let mv = if index % 2 == 0 {
                "pan_left"
            } else {
                "pan_right"
            }
            .to_string();
            (
                mv,
                0.14 + rng.f64() * 0.08,
                "scene_dialogue_two_shot".to_string(),
            )
        } else if let Some(SceneCameraHint::WideScene) = semantic_camera_hint {
            (
                "pull_out".to_string(),
                0.42 + rng.f64() * 0.18,
                "scene_wide_exploration".to_string(),
            )
        } else if let Some(SceneCameraHint::FollowCharacter) = semantic_camera_hint {
            let mv = if matches!(
                scene_semantics.map(|scene| &scene.semantic),
                Some(SceneSemanticKind::Chase | SceneSemanticKind::Escape)
            ) {
                "pan_right".to_string()
            } else {
                "push_in".to_string()
            };
            (
                mv,
                0.46 + rng.f64() * 0.2,
                "scene_follow_character".to_string(),
            )
        } else if let Some(SceneCameraHint::OverShoulder) = semantic_camera_hint {
            (
                "push_in".to_string(),
                0.18 + rng.f64() * 0.1,
                "scene_over_shoulder".to_string(),
            )
        } else if let Some(immersion) = immersion {
            if immersion.preserve_director_focus || immersion.in_focus_zone {
                let focus_moves = ["push_in", "tilt_down", "pan_left", "pan_right"];
                let mv = focus_moves[(rng.u32() as usize) % focus_moves.len()].to_string();
                let strength = 0.16 + rng.f64() * 0.18;
                (mv, strength, "director_focus".to_string())
            } else if immersion.allow_free_movement {
                let roam_moves = ["pan_left", "pan_right", "pull_out", "tilt_up"];
                let mv = if index + 1 == total {
                    "pull_out".to_string()
                } else {
                    roam_moves[(rng.u32() as usize) % roam_moves.len()].to_string()
                };
                let strength = 0.38 + rng.f64() * 0.32;
                (mv, strength, "free_immersion".to_string())
            } else if immersion.in_trigger_zone {
                (
                    "push_in".to_string(),
                    0.28 + rng.f64() * 0.12,
                    "trigger_focus".to_string(),
                )
            } else {
                let mv = MOVES[(rng.u32() as usize) % MOVES.len()].to_string();
                let strength = 0.25 + rng.f64() * 0.45;
                (mv, strength, "neutral".to_string())
            }
        } else {
            let mv = MOVES[(rng.u32() as usize) % MOVES.len()].to_string();
            let strength = if matches!(
                scene_semantics.map(|scene| &scene.tension),
                Some(SceneTensionLevel::Critical | SceneTensionLevel::Tense)
            ) {
                0.4 + rng.f64() * 0.22
            } else {
                0.25 + rng.f64() * 0.45
            };
            (mv, strength, "neutral".to_string())
        };

    Camera {
        r#move: mv,
        strength: round_2(strength),
        strategy: Some(strategy),
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
