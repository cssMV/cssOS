use sha2::{Digest, Sha256};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

pub fn compute_video_cache_key(compiled: &serde_json::Value) -> String {
    let mut hasher = Sha256::new();
    let bytes = serde_json::to_vec(compiled).unwrap_or_default();
    hasher.update(bytes);
    format!("{:x}", hasher.finalize())
}

pub fn cache_path(base: &Path, key: &str) -> PathBuf {
    base.join("video_cache").join(format!("{key}.mp4"))
}

pub fn hash_bytes(b: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(b);
    format!("{:x}", h.finalize())
}

pub fn hash_json(v: &serde_json::Value) -> String {
    hash_bytes(serde_json::to_vec(v).unwrap_or_default().as_slice())
}

pub fn cache_dir(out_dir: &Path) -> PathBuf {
    if let Ok(root) = std::env::var("CSS_VIDEO_CACHE_ROOT") {
        let p = PathBuf::from(root);
        if p.is_absolute() {
            return p;
        }
    }
    PathBuf::from("/srv/cssos/shared/video-cache")
}

pub fn cache_shots_dir(out_dir: &Path) -> PathBuf {
    cache_dir(out_dir).join("shots")
}

pub fn cache_assemble_dir(out_dir: &Path) -> PathBuf {
    cache_dir(out_dir).join("assemble")
}

pub fn file_ok(p: &Path) -> bool {
    fs::metadata(p)
        .map(|m| m.is_file() && m.len() > 0)
        .unwrap_or(false)
}

pub fn ensure_parent(p: &Path) -> io::Result<()> {
    if let Some(d) = p.parent() {
        fs::create_dir_all(d)?;
    }
    Ok(())
}

pub fn atomic_copy_into(dst: &Path, src: &Path) -> io::Result<()> {
    ensure_parent(dst)?;
    let tmp = dst.with_extension("tmp");
    let _ = fs::remove_file(&tmp);
    fs::copy(src, &tmp)?;
    fs::rename(&tmp, dst)?;
    Ok(())
}

pub fn try_hardlink_or_copy(src: &Path, dst: &Path) -> io::Result<()> {
    ensure_parent(dst)?;
    let _ = fs::remove_file(dst);
    match fs::hard_link(src, dst) {
        Ok(_) => Ok(()),
        Err(_) => {
            fs::copy(src, dst)?;
            Ok(())
        }
    }
}
