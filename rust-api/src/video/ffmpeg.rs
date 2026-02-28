use std::path::{Path, PathBuf};
use tokio::process::Command;

pub async fn concat_mp4_ffmpeg(shots: &[PathBuf], out_mp4: &Path) -> Result<(), String> {
    let out_dir = out_mp4
        .parent()
        .ok_or_else(|| "no out dir".to_string())?;
    let list_path = out_dir.join("concat_list.txt");

    let mut body = String::new();
    for p in shots {
        let s = p.to_string_lossy().replace('\'', "\\'");
        body.push_str(&format!("file '{}'\n", s));
    }
    tokio::fs::write(&list_path, body)
        .await
        .map_err(|e| e.to_string())?;

    let status = Command::new("ffmpeg")
        .arg("-y")
        .arg("-f")
        .arg("concat")
        .arg("-safe")
        .arg("0")
        .arg("-i")
        .arg(&list_path)
        .arg("-c")
        .arg("copy")
        .arg(out_mp4)
        .status()
        .await
        .map_err(|e| e.to_string())?;

    if !status.success() {
        return Err(format!("ffmpeg concat failed: {status}"));
    }
    Ok(())
}
