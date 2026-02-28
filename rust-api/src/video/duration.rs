use std::path::Path;
use tokio::process::Command;

pub async fn probe_media_duration_s(path: &Path) -> anyhow::Result<Option<f64>> {
    if !path.exists() {
        return Ok(None);
    }

    let out = Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-show_entries")
        .arg("format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=1")
        .arg(path)
        .output()
        .await;

    let out = match out {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };
    if !out.status.success() {
        return Ok(None);
    }

    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if s.is_empty() {
        return Ok(None);
    }
    let v: f64 = match s.parse() {
        Ok(v) => v,
        Err(_) => return Ok(None),
    };
    if v.is_finite() && v > 0.0 {
        Ok(Some(v))
    } else {
        Ok(None)
    }
}
