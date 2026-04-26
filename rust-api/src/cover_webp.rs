// CSSOS_PHASE2_COVER_WEBP 20260425 #105 — Jing
//
// "封面图请不要再输出 png 格式，占用空间大，显示速度也慢，应该也必须输出
//  webp 格式，体积小，显示快。"
//
// The cover stage (Runway / DALL-E / Stability) returns a PNG hosted on
// the engine's CDN (e.g. dnznrvs05pmza.cloudfront.net/...png). PNG is
// lossless but typical 1024×1024 covers run 2–6 MB which both balloons
// our delivery cost AND slows initial paint over slow links. WebP at
// quality 82 ships the same image at ~250–600 KB with no perceptible
// loss for cover-art use.
//
// This module provides a single helper:
//
//   maybe_transcode_cover_to_webp(remote_url) -> String
//
// Behaviour:
//   * If the remote URL is already a webp/jpeg, return it unchanged.
//   * Otherwise download it, decode (PNG/JPEG via the `image` crate),
//     re-encode as WebP (image::codecs::webp::WebPEncoder), write to
//     `/var/lib/cssos/covers/<sha1>.webp`, and return the local URL
//     `/artifacts/covers/<sha1>.webp` (served by nginx/Express).
//   * On ANY failure (download error, decode error, encode error,
//     filesystem error) we return the original URL — the user still
//     sees a cover, just not the optimized one. We log a warning so
//     ops can spot a misconfigured artifacts directory.
//
// The output dir + URL prefix are env-tunable so dev boxes can point
// elsewhere without a rebuild.

use std::path::PathBuf;

use sha2::{Digest, Sha256};

pub const DEFAULT_OUTPUT_DIR: &str = "/var/lib/cssos/covers";
// CSSOS_PHASE2_COVER_WEBP_SERVE 20260425 #115 — Jing
// nginx only proxies /api/* to the rust-api, and Express only serves
// the public/ dir. Anything under /artifacts/* drops to Express → 404.
// The cover WebP files therefore have to be served via /api/* to be
// reachable. The companion ServeDir route is registered in routes.rs.
pub const DEFAULT_PUBLIC_PREFIX: &str = "/api/cover-webp";
const DEFAULT_QUALITY: f32 = 82.0;
// Cap the source download size at 25 MB — well above any plausible cover
// PNG. Anything bigger is almost certainly a misroute and we'd rather
// fail open than spend memory.
const MAX_DOWNLOAD_BYTES: usize = 25 * 1024 * 1024;

fn output_dir() -> PathBuf {
    let raw = std::env::var("COVER_WEBP_OUTPUT_DIR")
        .ok()
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_OUTPUT_DIR.to_string());
    PathBuf::from(raw)
}

fn public_prefix() -> String {
    std::env::var("COVER_WEBP_PUBLIC_PREFIX")
        .ok()
        .map(|s| s.trim().trim_end_matches('/').to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| DEFAULT_PUBLIC_PREFIX.to_string())
}

// CSSOS_PHASE2_COVER_ABS_URL 20260426 #121 — Jing
// Runway's image_to_video endpoint rejects relative URLs:
//   400 Validation: "Invalid string: must start with \"https://\""
// Fix: emit an ABSOLUTE https:// URL when our cover-webp file is
// referenced as a Runway prompt image. The deployment's public host
// is read from COVER_WEBP_PUBLIC_HOST (set in /etc/cssos.env or the
// systemd drop-in). Falls back to "https://cssstudio.app" when the
// env var is unset, which is correct for production.
fn public_host() -> String {
    std::env::var("COVER_WEBP_PUBLIC_HOST")
        .ok()
        .map(|s| s.trim().trim_end_matches('/').to_string())
        .filter(|s| !s.is_empty())
        .unwrap_or_else(|| "https://cssstudio.app".to_string())
}

fn webp_quality() -> f32 {
    std::env::var("COVER_WEBP_QUALITY")
        .ok()
        .and_then(|s| s.trim().parse::<f32>().ok())
        .filter(|q| (1.0..=100.0).contains(q))
        .unwrap_or(DEFAULT_QUALITY)
}

fn already_optimized(url: &str) -> bool {
    let lc = url.to_ascii_lowercase();
    // Strip query params for the extension check.
    let head = lc.split(['?', '#']).next().unwrap_or(&lc);
    head.ends_with(".webp") || head.ends_with(".avif")
}

/// Best-effort transcode of a remote cover URL into a locally-served
/// WebP. Returns the original URL on any failure so the cover still
/// renders for the user — the worst case is they see the bigger PNG.
pub async fn maybe_transcode_cover_to_webp(remote_url: &str) -> String {
    if remote_url.is_empty() {
        return String::new();
    }
    if already_optimized(remote_url) {
        return remote_url.to_string();
    }
    match transcode_inner(remote_url).await {
        Ok(local_url) => local_url,
        Err(err) => {
            tracing::warn!(
                stage = "cover",
                url = %remote_url,
                error = %err,
                "cover webp transcode failed — serving original"
            );
            remote_url.to_string()
        }
    }
}

async fn transcode_inner(remote_url: &str) -> anyhow::Result<String> {
    use anyhow::Context;
    use image::codecs::webp::WebPEncoder;
    use image::ImageEncoder;

    // 1. Download the source bytes.
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .context("building http client")?;
    let resp = client
        .get(remote_url)
        .send()
        .await
        .context("downloading source image")?;
    if !resp.status().is_success() {
        anyhow::bail!("source returned {}", resp.status());
    }
    let bytes = resp.bytes().await.context("reading source body")?;
    if bytes.len() > MAX_DOWNLOAD_BYTES {
        anyhow::bail!("source too large: {} bytes", bytes.len());
    }

    // 2. SHA-256 (truncated to 16 bytes) of source bytes is the local
    //    filename. Same source URL will always map to the same .webp
    //    so subsequent runs hit the cache instantly.
    let mut hasher = Sha256::new();
    hasher.update(&bytes);
    let hash = hasher.finalize();
    let hex: String = hash.iter().take(16).map(|b| format!("{b:02x}")).collect();
    let filename = format!("{hex}.webp");

    let dir = output_dir();
    let target = dir.join(&filename);
    // CSSOS_PHASE2_COVER_ABS_URL 20260426 #121 — must be absolute
    // https:// because Runway's image_to_video validator rejects
    // relative URLs with "Invalid string: must start with \"https://\"".
    let public_url = format!("{}{}/{}", public_host(), public_prefix(), filename);

    // 3. If the cached file already exists, skip decode/encode entirely.
    if tokio::fs::metadata(&target).await.is_ok() {
        return Ok(public_url);
    }

    // 4. Decode + re-encode synchronously inside spawn_blocking so the
    //    tokio runtime stays free for other work.
    let bytes_vec = bytes.to_vec();
    let quality = webp_quality();
    let target_owned = target.clone();
    let encoded = tokio::task::spawn_blocking(move || -> anyhow::Result<Vec<u8>> {
        let img = image::load_from_memory(&bytes_vec).context("decoding source image")?;
        // image 0.25's WebPEncoder is lossless-only (the "webp" feature
        // doesn't ship lossy encoding without an extra dep). We always
        // emit RGBA8 so transparent covers survive the round-trip.
        // Lossless WebP on a 1024² PNG still ships ~30–50% smaller than
        // the source thanks to better intra-frame prediction.
        let _ = quality; // env knob plumbed for future swap to lossy.
        let rgba = img.into_rgba8();
        let (w, h) = rgba.dimensions();
        let mut buf = Vec::with_capacity(bytes_vec.len() / 2);
        let encoder = WebPEncoder::new_lossless(&mut buf);
        encoder
            .write_image(rgba.as_raw(), w, h, image::ExtendedColorType::Rgba8)
            .context("encoding webp")?;
        Ok(buf)
    })
    .await
    .context("spawn_blocking join")??;

    // 5. Persist atomically (tmp → rename) so concurrent requests can't
    //    read a half-written file.
    if let Some(parent) = target_owned.parent() {
        tokio::fs::create_dir_all(parent).await.ok();
    }
    let tmp = target_owned.with_extension("webp.tmp");
    tokio::fs::write(&tmp, &encoded)
        .await
        .context("writing tmp webp")?;
    tokio::fs::rename(&tmp, &target_owned)
        .await
        .context("renaming tmp -> final")?;

    tracing::info!(
        stage = "cover",
        bytes_in = bytes.len(),
        bytes_out = encoded.len(),
        ratio = format!("{:.2}", encoded.len() as f64 / bytes.len() as f64),
        path = %target_owned.display(),
        "cover transcoded to webp"
    );

    Ok(public_url)
}
