use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum HwMode {
    Nvenc,
    Vaapi,
    Cpu,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HwPlan {
    pub mode: HwMode,
    pub vaapi_device: Option<String>,
}

fn env_str(k: &str, d: &str) -> String {
    std::env::var(k).unwrap_or_else(|_| d.to_string())
}

async fn has_ffmpeg_encoder(name: &str) -> bool {
    let out = Command::new("ffmpeg")
        .arg("-hide_banner")
        .arg("-encoders")
        .output()
        .await;
    let Ok(out) = out else {
        return false;
    };
    if !out.status.success() {
        return false;
    }
    let s = String::from_utf8_lossy(&out.stdout);
    s.contains(name)
}

pub async fn detect_hw_plan() -> HwPlan {
    let want = env_str("CSS_VIDEO_HW", "auto").to_lowercase();

    if want == "cpu" {
        return HwPlan {
            mode: HwMode::Cpu,
            vaapi_device: None,
        };
    }

    if want == "nvenc" {
        let ok = has_ffmpeg_encoder("h264_nvenc").await;
        return if ok {
            HwPlan {
                mode: HwMode::Nvenc,
                vaapi_device: None,
            }
        } else {
            HwPlan {
                mode: HwMode::Cpu,
                vaapi_device: None,
            }
        };
    }

    if want == "vaapi" {
        let dev = env_str("CSS_VAAPI_DEVICE", "/dev/dri/renderD128");
        let ok = Path::new(&dev).exists() && has_ffmpeg_encoder("h264_vaapi").await;
        return if ok {
            HwPlan {
                mode: HwMode::Vaapi,
                vaapi_device: Some(dev),
            }
        } else {
            HwPlan {
                mode: HwMode::Cpu,
                vaapi_device: None,
            }
        };
    }

    let nv_ok = has_ffmpeg_encoder("h264_nvenc").await;
    if nv_ok {
        return HwPlan {
            mode: HwMode::Nvenc,
            vaapi_device: None,
        };
    }

    let dev = env_str("CSS_VAAPI_DEVICE", "/dev/dri/renderD128");
    let va_ok = Path::new(&dev).exists() && has_ffmpeg_encoder("h264_vaapi").await;
    if va_ok {
        return HwPlan {
            mode: HwMode::Vaapi,
            vaapi_device: Some(dev),
        };
    }

    HwPlan {
        mode: HwMode::Cpu,
        vaapi_device: None,
    }
}
