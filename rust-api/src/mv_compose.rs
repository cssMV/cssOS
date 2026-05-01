// CSSOS_PHASE2_MV_COMPOSE 20260417 — final-mix ffmpeg wrapper for the MV
// pipeline. Takes remote audio + remote video (+ optional subtitles) and
// produces an mp4 on local disk.
//
// Public contract (used by pipeline_mv_api::compose):
//   compose_mv(&ComposeRequest) -> ComposeResult
//
// Two modes:
//
// 1. LEGACY (single clip): caller supplies a single `video_url`. We just
//    mux it with the audio + optional burned-in SRT. Used when the entire
//    MV is one AI-video stream (expensive: $0.06–$0.12/sec of Runway/SVD).
//
// 2. HYBRID (CSSOS_PHASE2_COMPOSE_HYBRID 20260419): caller supplies a
//    timeline as `segments[]`. Each segment is either:
//      * AiVideo       — a trimmed slice of an AI-generated clip
//      * KenburnsImage — a still (cover art, scene frame) animated with
//                        a zoompan ffmpeg filter (zero API cost)
//    We render each segment to a matched-parameter temp mp4, concat them
//    with the concat demuxer, then mux the audio in one final pass. This
//    lets a 5-minute MV cost ~$5–6 instead of ~$18 by only paying for AI
//    video on the high-impact sections (chorus, hook, bridges).
//
// Where:
//   * video_url  : Option<String> — legacy single-clip URL. Ignored when
//                  `segments` is present.
//   * audio_url  : Option<String> — mp3/wav URL (typically from Suno v5 /
//                  ElevenLabs / Stability Audio / MusicGPT). When None or
//                  empty we produce a video-only mp4 so an upstream music
//                  failure doesn't crash the whole pipeline.
//   * segments   : Option<Vec<ComposeSegment>> — hybrid timeline.
//   * subtitles  : Option<String> (raw SRT text; written to a sidecar .srt
//                  that ffmpeg `subtitles=` filter will burn in)
//   * output_dir : where to drop the final mp4 (we create it if missing)
//
// Output:
//   * final_path : absolute path to the produced mp4 on this machine
//   * public_url : /artifacts/mv/<id>.mp4 so the frontend can play it. The
//                  http layer is responsible for actually serving that path —
//                  we just compute the URL based on the filename.
//
// Requires `ffmpeg` on PATH (api-vm has 4.4.2 at /usr/bin/ffmpeg).

use std::path::{Path, PathBuf};
use std::process::Stdio;

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use tokio::io::AsyncWriteExt;

pub const DEFAULT_OUTPUT_DIR: &str = "/var/lib/cssos/mv";
pub const DEFAULT_PUBLIC_PREFIX: &str = "/artifacts/mv";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComposeRequest {
    pub mv_id: String,
    // CSSOS_PHASE2_COMPOSE_HYBRID 20260419 — video_url is now optional; when
    // `segments` is present we ignore it. Keeping it as Option also lets a
    // caller submit audio-only to pair with a default black canvas (rare
    // path, but now representable).
    #[serde(default, deserialize_with = "de_optional_str")]
    pub video_url: Option<String>,
    // CSSOS_PHASE2_COMPOSE_AUDIO_OPTIONAL 20260419 — audio_url is now optional
    // so compose degrades gracefully when the upstream music stage fails (e.g.
    // MusicGPT INSUFFICIENT_CREDITS or Suno rate-limit). When None/null we
    // produce a video-only mp4 instead of a 500 deserialize error. Old
    // frontends that still send a concrete string keep working unchanged.
    #[serde(default, deserialize_with = "de_optional_str")]
    pub audio_url: Option<String>,
    #[serde(default)]
    pub subtitles_srt: Option<String>,
    #[serde(default)]
    pub output_dir: Option<String>,
    #[serde(default)]
    pub public_prefix: Option<String>,
    // CSSOS_PHASE2_COMPOSE_HYBRID 20260419 — hybrid timeline. When present,
    // each segment becomes one chunk of the final video and `video_url` is
    // ignored. Segments are rendered in array order.
    #[serde(default)]
    pub segments: Option<Vec<ComposeSegment>>,
    // Output canvas. Defaults to 1920×1080 @ 25fps landscape. The frontend
    // aspect picker (Landscape 16:9 / Portrait 9:16 / Square 1:1 / etc.)
    // feeds these fields directly.
    #[serde(default)]
    pub width: Option<u32>,
    #[serde(default)]
    pub height: Option<u32>,
    #[serde(default)]
    pub fps: Option<u32>,
}

// CSSOS_PHASE2_COMPOSE_HYBRID 20260419 — one chunk of the hybrid timeline.
// Tagged `kind` so JSON payloads look like:
//     {"kind":"ai_video","source_url":"...","duration_secs":8.0}
//     {"kind":"kenburns_image","source_url":"...","duration_secs":22.0,
//      "effect":"zoom_in"}
// CSSOS_PHASE2_LITE_XFADE 20260426 #126 — Jing
// Both segment kinds carry optional `transition` + `transition_duration_secs`
// fields. They control how this segment is BLENDED INTO from the previous
// segment in the timeline (i.e. the xfade applied at this segment's start).
// Defaults: transition="fade", duration=1.2s. The first segment ignores them
// because it has no predecessor. ffmpeg's xfade transition vocabulary:
//   fade | dissolve | wipeleft | wiperight | wipeup | wipedown
//   slideleft | slideright | slideup | slidedown
//   smoothleft | smoothright | smoothup | smoothdown
//   circleopen | circleclose | radial | rectcrop
//   distance | hblur | hlslice | hrslice | vuslice | vdslice
//   pixelize | dissolve | diagbl | diagbr | diagtl | diagtr | hlwind | hrwind
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ComposeSegment {
    /// A slice of an AI-generated clip (Runway / SVD / etc). Real AI video
    /// cost — use sparingly on high-impact sections only.
    AiVideo {
        source_url: String,
        duration_secs: f64,
        /// Optional trim offset into the source clip. Default 0.
        #[serde(default)]
        source_start_secs: Option<f64>,
        /// xfade transition style applied entering this segment. Default "fade".
        #[serde(default)]
        transition: Option<String>,
        /// xfade duration in seconds. Default 1.2s.
        #[serde(default)]
        transition_duration_secs: Option<f64>,
    },
    /// A still image (cover art, scene frame) animated via ffmpeg zoompan.
    /// Zero API cost — rendered locally by cssos-ffmpeg.
    KenburnsImage {
        source_url: String,
        duration_secs: f64,
        /// One of: "zoom_in" | "zoom_out" | "pan_left" | "pan_right"
        /// | "pan_up" | "pan_down". Anything else => "zoom_in".
        #[serde(default)]
        effect: Option<String>,
        /// xfade transition style applied entering this segment. Default "fade".
        #[serde(default)]
        transition: Option<String>,
        /// xfade duration in seconds. Default 1.2s.
        #[serde(default)]
        transition_duration_secs: Option<f64>,
        /// CSSOS_PHASE2_FACE_BIAS_KENBURNS 20260430 #224 — Jing
        /// "slideshow planner + ffmpeg 是否可以尽量让 Lite 封面图露出
        ///  人物的脸部？" Optional normalised focus point (0.0..=1.0)
        /// the Ken Burns zoompan should orbit around. Frontend can pass
        /// the centroid of a detected face (Browser FaceDetector API)
        /// or a hand-picked rule-of-thirds bias. Default = (0.5, 0.4)
        /// — upper-center, where most album-cover faces land.
        #[serde(default)]
        focus_x: Option<f64>,
        #[serde(default)]
        focus_y: Option<f64>,
    },
}

// CSSOS_PHASE2_LITE_XFADE 20260426 #126 — defaults for cross-fade transitions
// between adjacent segments. "fade" is xfade's plain crossfade (== dissolve in
// most NLE vocab). 1.2s gives an iMovie-feel without dragging the slideshow.
const DEFAULT_XFADE_TRANSITION: &str = "fade";
const DEFAULT_XFADE_DURATION_SECS: f64 = 1.2;

fn segment_duration(seg: &ComposeSegment) -> f64 {
    match seg {
        ComposeSegment::AiVideo { duration_secs, .. } => *duration_secs,
        ComposeSegment::KenburnsImage { duration_secs, .. } => *duration_secs,
    }
}

fn segment_transition(seg: &ComposeSegment) -> (String, f64) {
    let (t, d) = match seg {
        ComposeSegment::AiVideo {
            transition,
            transition_duration_secs,
            ..
        } => (transition.as_deref(), transition_duration_secs.as_ref().copied()),
        ComposeSegment::KenburnsImage {
            transition,
            transition_duration_secs,
            ..
        } => (transition.as_deref(), transition_duration_secs.as_ref().copied()),
    };
    let trans = t.unwrap_or(DEFAULT_XFADE_TRANSITION).to_string();
    let dur = d.unwrap_or(DEFAULT_XFADE_DURATION_SECS).clamp(0.2, 4.0);
    (trans, dur)
}

// CSSOS_PHASE2_COMPOSE_AUDIO_OPTIONAL 20260419 — accept both `null` and an
// empty string as "no audio". The frontend currently sends `""` when a stage
// is skipped and `null` when a stage errored; both should mean the same thing.
fn de_optional_str<'de, D>(de: D) -> std::result::Result<Option<String>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::Deserialize;
    let raw = Option::<String>::deserialize(de)?;
    Ok(raw.and_then(|s| if s.trim().is_empty() { None } else { Some(s) }))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComposeResult {
    pub mv_id: String,
    pub final_path: String,
    pub public_url: String,
    pub width: u32,
    pub height: u32,
    pub duration_secs: Option<f64>,
}

pub async fn compose_mv(req: &ComposeRequest) -> Result<ComposeResult> {
    let output_dir = req
        .output_dir
        .clone()
        .unwrap_or_else(|| DEFAULT_OUTPUT_DIR.to_string());
    let public_prefix = req
        .public_prefix
        .clone()
        .unwrap_or_else(|| DEFAULT_PUBLIC_PREFIX.to_string());

    let out_root = PathBuf::from(&output_dir);
    tokio::fs::create_dir_all(&out_root)
        .await
        .with_context(|| format!("create mv output dir {:?}", out_root))?;

    let staging = out_root.join(format!(".staging-{}", req.mv_id));
    tokio::fs::create_dir_all(&staging).await.ok();

    // CSSOS_PHASE2_COMPOSE_AUDIO_OPTIONAL 20260419 — only stage an audio file
    // if the caller supplied a non-empty URL.
    let audio_path_opt: Option<PathBuf> = match req.audio_url.as_deref() {
        Some(url) if !url.trim().is_empty() => {
            let p = staging.join("audio.mp3");
            download_to(url, &p).await?;
            Some(p)
        }
        _ => None,
    };

    // Subtitles file (only burned in during the final mux pass).
    let srt_path = if let Some(srt) = &req.subtitles_srt {
        let p = staging.join("captions.srt");
        let mut f = tokio::fs::File::create(&p)
            .await
            .with_context(|| format!("open srt {:?} for write", p))?;
        f.write_all(srt.as_bytes()).await?;
        f.flush().await?;
        Some(p)
    } else {
        None
    };

    let final_path = out_root.join(format!("{}.mp4", sanitize_id(&req.mv_id)));

    // CSSOS_PHASE2_COMPOSE_HYBRID 20260419 — dispatch.
    let has_segments = req
        .segments
        .as_ref()
        .map(|v| !v.is_empty())
        .unwrap_or(false);

    if has_segments {
        compose_hybrid(req, &staging, audio_path_opt.as_deref(), srt_path.as_deref(), &final_path)
            .await?;
    } else {
        // Legacy single-clip path. Require video_url since there are no
        // segments to fall back on.
        let video_url = req
            .video_url
            .as_deref()
            .filter(|s| !s.trim().is_empty())
            .ok_or_else(|| anyhow!("compose: either `video_url` or non-empty `segments` required"))?;
        let video_path = staging.join("video.mp4");
        download_to(video_url, &video_path).await?;
        compose_legacy(&video_path, audio_path_opt.as_deref(), srt_path.as_deref(), &final_path)
            .await?;
    }

    // Best-effort cleanup of staging dir (ignore errors — the build succeeded)
    let _ = tokio::fs::remove_dir_all(&staging).await;

    let public_url = format!(
        "{}/{}.mp4",
        public_prefix.trim_end_matches('/'),
        sanitize_id(&req.mv_id)
    );
    let (width, height, duration_secs) = probe_dimensions(&final_path).await;
    Ok(ComposeResult {
        mv_id: req.mv_id.clone(),
        final_path: final_path.to_string_lossy().into_owned(),
        public_url,
        width,
        height,
        duration_secs,
    })
}

// ---------------------------------------------------- legacy single-clip path

async fn compose_legacy(
    video_path: &Path,
    audio_path_opt: Option<&Path>,
    _srt_path: Option<&Path>,
    final_path: &Path,
) -> Result<()> {
    // CSSOS_PHASE2_AUDIO_BACK_IN_MP4 20260427 #164 — Jing clarification
    // "我是叫你剥开音频，不要和视频'烧录'，而不是禁止音频/扔掉音频。"
    //
    // Reverts the audio strip from #151. Audio IS muxed back into the
    // final mp4 so the <video> element plays sound out of the box (no
    // dependence on a separate <audio> element being primed first). The
    // SAME audio file is ALSO delivered as a standalone work_asset so
    // the frontend can later swap voice tracks at runtime.
    //
    // Subtitle burn-in stays disabled (kept independent for runtime
    // language switch) — that part of #151 is correct.
    let mut cmd = tokio::process::Command::new("ffmpeg");
    cmd.arg("-y").arg("-i").arg(video_path);
    if let Some(ap) = audio_path_opt {
        cmd.arg("-i").arg(ap);
        cmd.arg("-c:v").arg("copy");
        cmd.arg("-c:a").arg("aac").arg("-b:a").arg("192k");
        cmd.arg("-map").arg("0:v:0").arg("-map").arg("1:a:0");
        // CSSOS_PHASE2_AUDIO_DRIVES_VIDEO 20260430 #210 — Jing
        // No `-shortest` here either: with `-c:v copy` we keep the video
        // stream's native length; if audio is longer ffmpeg emits the
        // remaining audio after video EOF (player shows nothing for the
        // tail) — that's still better than chopping the song.
    } else {
        cmd.arg("-c:v").arg("copy");
        cmd.arg("-an");
    }
    cmd.arg("-movflags")
        .arg("+faststart")
        .arg(final_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let out = cmd
        .output()
        .await
        .with_context(|| "spawn ffmpeg (is it on PATH?)")?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(anyhow!("ffmpeg exited {}: {}", out.status, err));
    }
    Ok(())
}

// -------------------------------------------------- hybrid (segments) path

// CSSOS_PHASE2_LITE_XFADE 20260426 #126 — Jing
//
// "请把每张封面图变成 Ken Burns + 1.2s xfade 过渡，不要硬切了"
//
// Replaces the original concat-demuxer hard-cut path (#CSSOS_PHASE2_COMPOSE_HYBRID
// 20260419) with a single-pass `filter_complex` xfade chain. Each adjacent pair
// of segments cross-dissolves over its `transition_duration_secs` (default 1.2s).
// Lite tier (all KenburnsImage) gets a buttery slideshow; Hybrid (mixed AI +
// Ken Burns) gets the same silky transitions stitching real video into the
// stills with no jarring cuts.
//
// Pipeline:
//   1. render_segment() each entry to staging/seg-NNNN.mp4 with identical
//      codec / resolution / fps so xfade can mix them at the filter graph
//      level without reframe artifacts.
//   2. ONE ffmpeg call: -i seg-0000.mp4 -i seg-0001.mp4 ... [-i audio.mp3]
//      with -filter_complex chaining xfades:
//        [0:v][1:v]xfade=...:offset=O1[v01];
//        [v01][2:v]xfade=...:offset=O2[v02]; ...
//        [v0{N-1}]subtitles='captions.srt'[vout]
//      then -map [vout] [-map K:a] -c:v libx264 -c:a aac.
//
// xfade timeline math (with constant transition duration t):
//   offset[i] = sum(d[0..=i-1]) - i*t      (i in 1..N)
// Each xfade overlaps by t, so total runtime = sum(d) - (N-1)*t. The frontend
// segment planner is responsible for accounting for the t*N-1 shrink when
// matching the audio length; otherwise -shortest trims to whichever is shorter.
//
// Single-segment fallback (compose_mv -> compose_hybrid with a 1-element list)
// goes through `mux_single_segment` to avoid an empty filter_complex, since
// xfade requires at least 2 inputs.
async fn compose_hybrid(
    req: &ComposeRequest,
    staging: &Path,
    audio_path_opt: Option<&Path>,
    srt_path: Option<&Path>,
    final_path: &Path,
) -> Result<()> {
    let segments = req
        .segments
        .as_ref()
        .ok_or_else(|| anyhow!("compose_hybrid called without segments"))?;
    if segments.is_empty() {
        return Err(anyhow!("compose_hybrid: segments array is empty"));
    }

    let width = req.width.unwrap_or(1920);
    let height = req.height.unwrap_or(1080);
    let fps = req.fps.unwrap_or(25);

    // 1. Render each segment to staging/seg-NNNN.mp4 with matched params.
    let mut seg_paths: Vec<PathBuf> = Vec::with_capacity(segments.len());
    for (i, seg) in segments.iter().enumerate() {
        let seg_path = staging.join(format!("seg-{:04}.mp4", i));
        render_segment(seg, i, staging, &seg_path, width, height, fps).await?;
        seg_paths.push(seg_path);
    }

    // 2. One-segment fast path (xfade requires >=2 inputs).
    if segments.len() == 1 {
        return mux_single_segment(&seg_paths[0], audio_path_opt, srt_path, final_path).await;
    }

    // 3. Multi-segment xfade chain.
    compose_xfade_chain(segments, &seg_paths, audio_path_opt, srt_path, final_path).await
}

// CSSOS_PHASE2_HYBRID_AI_VIDEO_FIX 20260426 #137 — Jing
// Single-pass xfade chain + audio mux + PTS normalization.
//
// ROOT CAUSE of the dropped Hybrid AI clip: xfade is wildly sensitive to
// input PTS. The Ken Burns segments come straight from a still image so
// they start at PTS=0; the AI-video segments come from Runway via download
// + scale + pad and inherit a small but nonzero starting PTS from the
// source mp4. xfade computes its `offset` against the input's actual PTS,
// not against "time since this stream's first frame," so the AI clip
// boundary slid out of sync with the chain timeline and the AI segment
// got chopped down to almost nothing — exactly matching the user report
// "MV 始终没有显示出来 / fallback 到旧的视频媒体".
//
// FIX: prepend `[i:v]setpts=PTS-STARTPTS,fps={fps},format=yuv420p[normN]`
// to the filter graph for EVERY input, then chain xfades on the [normN]
// labels instead of raw [i:v]. This forces every input to start at PTS=0
// and run at exactly `fps`, so xfade's offset math now matches the
// segment durations exactly.
//
// Bonus: also `ffprobe` the actual duration of each rendered seg-NNNN.mp4
// and use the REAL duration in offset calc. If render_kenburns or
// render_ai_video produces a slightly off-by-frame seg, the xfade chain
// stays in sync.
async fn compose_xfade_chain(
    segments: &[ComposeSegment],
    seg_paths: &[PathBuf],
    audio_path_opt: Option<&Path>,
    srt_path: Option<&Path>,
    final_path: &Path,
) -> Result<()> {
    let n = segments.len();
    debug_assert!(n >= 2);

    // Probe the actual duration of every rendered seg. If probe fails,
    // fall back to the planned segment_duration so we don't crash the run.
    let mut actual_durs: Vec<f64> = Vec::with_capacity(n);
    for (i, p) in seg_paths.iter().enumerate() {
        let (_w, _h, d_opt) = probe_dimensions(p).await;
        let planned = segment_duration(&segments[i]);
        let actual = d_opt.filter(|d| *d > 0.05).unwrap_or(planned);
        tracing::info!(
            stage = "compose",
            seg_idx = i,
            kind = match &segments[i] {
                ComposeSegment::AiVideo { .. } => "ai_video",
                ComposeSegment::KenburnsImage { .. } => "kenburns",
            },
            planned_secs = planned,
            actual_secs = actual,
            "xfade input probe"
        );
        actual_durs.push(actual);
    }

    // Choose a reference fps for normalization. Default 25 — must match
    // what render_ai_video / render_kenburns emitted via `-r {fps}`.
    let ref_fps: u32 = 25;

    // ---- build filter_complex -----------------------------------------------
    // Step 1: per-input normalization filters that anchor PTS at zero, lock
    // the framerate to ref_fps, and force pix_fmt to yuv420p so all inputs
    // are byte-identical at the xfade boundary.
    let mut filter = String::new();
    for i in 0..n {
        if !filter.is_empty() {
            filter.push(';');
        }
        filter.push_str(&format!(
            "[{idx}:v]setpts=PTS-STARTPTS,fps={fps},format=yuv420p[norm{idx:03}]",
            idx = i,
            fps = ref_fps,
        ));
    }
    // Step 2: xfade chain across the normalized inputs.
    let mut prev_label = format!("norm{:03}", 0);
    let mut cum_prev_dur = 0.0_f64;
    for i in 1..n {
        let (trans, t_dur_raw) = segment_transition(&segments[i]);
        let prev_dur = actual_durs[i - 1];
        let this_dur = actual_durs[i];
        cum_prev_dur += prev_dur;

        // xfade requires duration < min(prev_chain_len, this_seg_len).
        let max_t = (prev_dur.min(this_dur) * 0.5).max(0.2);
        let t_dur = t_dur_raw.min(max_t);
        // offset = chain length so far - t_dur. The chain length grows as
        // sum(d[0..=i-1]) - (i-1)*t_dur (each xfade overlaps t).
        // For simplicity use the constant-t form; with our default 1.2s
        // fade everywhere it's exact.
        let offset = (cum_prev_dur - (i as f64) * t_dur).max(0.05);

        let next_label = if i == n - 1 {
            "vmix".to_string()
        } else {
            format!("xf{i:03}")
        };
        filter.push(';');
        filter.push_str(&format!(
            "[{prev}][norm{idx:03}]xfade=transition={trans}:duration={dur:.3}:offset={off:.3}[{next}]",
            prev = prev_label,
            idx = i,
            trans = trans,
            dur = t_dur,
            off = offset,
            next = next_label,
        ));
        prev_label = next_label;
    }

    // CSSOS_PHASE2_SEPARATE_STREAMS 20260427 #151 — Jing
    // No subtitle burn-in. The Watch panel renders SRT via HTML overlay
    // for runtime language switching. srt_path is intentionally ignored
    // here (kept in the signature for API stability).
    let _ = srt_path;
    let final_video_label = "vmix";

    // ---- build ffmpeg command -----------------------------------------------
    let mut cmd = tokio::process::Command::new("ffmpeg");
    cmd.arg("-y");
    for p in seg_paths {
        cmd.arg("-i").arg(p);
    }
    // CSSOS_PHASE2_AUDIO_BACK_IN_MP4 20260427 #164 — Jing clarified.
    // Mux audio back into the final mp4. Subtitle remains independent
    // (HTML overlay) so language switch still works.
    let audio_input_index = if let Some(ap) = audio_path_opt {
        let idx = seg_paths.len();
        cmd.arg("-i").arg(ap);
        Some(idx)
    } else {
        None
    };

    cmd.arg("-filter_complex").arg(&filter);
    cmd.arg("-map").arg(format!("[{}]", final_video_label));
    if let Some(ai) = audio_input_index {
        cmd.arg("-map").arg(format!("{}:a:0", ai));
        cmd.arg("-c:a").arg("aac").arg("-b:a").arg("192k");
        // CSSOS_PHASE2_AUDIO_DRIVES_VIDEO 20260430 #210 — Jing
        // "音乐有多长，视频就要多长，MV 就要多长."
        // We used to pass `-shortest` so ffmpeg trimmed whichever stream
        // was shorter — which meant a 3-minute Suno song got chopped to
        // a 40-second slideshow. Now we INTENTIONALLY drop `-shortest`
        // and set `-t` to MAX(audio, video) below. If audio is longer the
        // last frame freezes for the excess (better than truncation;
        // proper extend-with-tpad is a frontend planner concern that
        // happens before we get here).
    } else {
        cmd.arg("-an");
    }
    // CSSOS_PHASE2_AUDIO_DRIVES_VIDEO 20260430 #210 — Jing
    // Output cap = MAX(audio_duration, video_segment_total). When audio
    // is longer, ffmpeg holds the final video frame for the trailing
    // tail rather than `-shortest`-truncating the song.
    {
        let mut video_total = actual_durs[0];
        for i in 1..n {
            let (_t_name, t_d) = segment_transition(&segments[i]);
            let max_t = (actual_durs[i - 1].min(actual_durs[i]) * 0.5).max(0.2);
            let t_clamped = t_d.min(max_t);
            video_total += actual_durs[i] - t_clamped;
        }
        video_total += 0.05; // tail epsilon

        let audio_dur = if let Some(ap) = audio_path_opt {
            let (_w, _h, d) = probe_dimensions(ap).await;
            d.unwrap_or(0.0)
        } else {
            0.0
        };

        let total_dur = if audio_dur > video_total {
            tracing::info!(
                stage = "compose",
                video_total = video_total,
                audio_dur = audio_dur,
                "audio longer than video — extending output to match audio (frame freeze tail)"
            );
            audio_dur
        } else {
            video_total
        };
        cmd.arg("-t").arg(format!("{total_dur:.3}"));
    }
    cmd.arg("-c:v").arg("libx264")
        .arg("-preset").arg("veryfast")
        .arg("-pix_fmt").arg("yuv420p");
    cmd.arg("-movflags").arg("+faststart")
        .arg(final_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    tracing::info!(
        stage = "compose",
        segments = n,
        "running xfade chain ffmpeg (separate streams: video-only output)"
    );
    tracing::debug!(filter = %filter, "xfade filter_complex");

    let out = cmd
        .output()
        .await
        .with_context(|| "spawn ffmpeg (xfade chain)")?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(anyhow!(
            "ffmpeg xfade chain exited {}: {}",
            out.status,
            err
        ));
    }
    Ok(())
}

// CSSOS_PHASE2_LITE_XFADE 20260426 #126 — when there's exactly one segment
// (legacy single-clip-via-segments path or a 1-image Lite test) we can't run
// xfade. Mux the segment's video with optional audio + burned SRT in one pass.
async fn mux_single_segment(
    seg_path: &Path,
    audio_path_opt: Option<&Path>,
    _srt_path: Option<&Path>,
    final_path: &Path,
) -> Result<()> {
    // CSSOS_PHASE2_AUDIO_BACK_IN_MP4 20260427 #164 — Jing clarified.
    // Mux audio back into the final mp4 (video element plays sound out
    // of the box). Subtitle stays independent.
    let mut cmd = tokio::process::Command::new("ffmpeg");
    cmd.arg("-y").arg("-i").arg(seg_path);
    if let Some(ap) = audio_path_opt {
        cmd.arg("-i").arg(ap);
        cmd.arg("-c:v").arg("copy");
        cmd.arg("-c:a").arg("aac").arg("-b:a").arg("192k");
        cmd.arg("-map").arg("0:v:0").arg("-map").arg("1:a:0");
        // CSSOS_PHASE2_AUDIO_DRIVES_VIDEO 20260430 #210 — Jing
        // Same rationale as compose_legacy: drop -shortest. Single-seg
        // path is mostly the Lite tier 1-image case; if audio is longer
        // we keep the audio playing past video EOF (frontend overlays
        // a still cover for the audio tail).
    } else {
        cmd.arg("-c:v").arg("copy");
        cmd.arg("-an");
    }
    cmd.arg("-movflags").arg("+faststart")
        .arg(final_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    let out = cmd
        .output()
        .await
        .with_context(|| "spawn ffmpeg (single-seg mux)")?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(anyhow!("ffmpeg single-seg mux exited {}: {}", out.status, err));
    }
    Ok(())
}

// Render a single ComposeSegment to a matched-params mp4.
async fn render_segment(
    seg: &ComposeSegment,
    idx: usize,
    staging: &Path,
    out_path: &Path,
    width: u32,
    height: u32,
    fps: u32,
) -> Result<()> {
    match seg {
        ComposeSegment::AiVideo {
            source_url,
            duration_secs,
            source_start_secs,
            ..
        } => {
            let src = staging.join(format!("src-{:04}.mp4", idx));
            download_to(source_url, &src).await?;
            render_ai_video(
                &src,
                out_path,
                *duration_secs,
                source_start_secs.unwrap_or(0.0),
                width,
                height,
                fps,
            )
            .await
        }
        ComposeSegment::KenburnsImage {
            source_url,
            duration_secs,
            effect,
            focus_x,
            focus_y,
            ..
        } => {
            // Images may be png/jpg/webp; we keep the extension for ffmpeg's
            // demuxer hint but ffmpeg will sniff content type anyway.
            let ext = guess_image_ext(source_url).unwrap_or("img");
            let src = staging.join(format!("src-{:04}.{}", idx, ext));
            download_to(source_url, &src).await?;
            let eff = effect.as_deref().unwrap_or("zoom_in");
            // CSSOS_PHASE2_FACE_BIAS_KENBURNS 20260430 #224 — Jing
            // Default focus = (0.5, 0.4) — rule-of-thirds upper-center.
            // Album covers typically place the subject's face here. When
            // the frontend has detected a face via Browser FaceDetector
            // API (or any other source), it overrides with the centroid.
            let fx = focus_x.unwrap_or(0.5).clamp(0.0, 1.0);
            let fy = focus_y.unwrap_or(0.4).clamp(0.0, 1.0);
            render_kenburns(&src, out_path, *duration_secs, width, height, fps, eff, fx, fy).await
        }
    }
}

// Trim + scale an AI video clip to exactly `duration_secs` and the target
// canvas. Re-encodes so all segments share identical codec params for the
// concat demuxer.
async fn render_ai_video(
    src: &Path,
    out_path: &Path,
    duration_secs: f64,
    start_secs: f64,
    width: u32,
    height: u32,
    fps: u32,
) -> Result<()> {
    // scale with force_original_aspect_ratio=decrease + pad to letterbox
    // into the target canvas. This handles a 16:9 AI clip into a 9:16
    // portrait canvas cleanly instead of squashing.
    // CSSOS_PHASE2_HYBRID_AI_VIDEO_FIX 20260426 #137 — Jing
    // Add `setpts=PTS-STARTPTS` to anchor the rendered AI seg at PTS=0
    // (Runway clips inherit nonzero starting PTS that would slide xfade
    // out of sync). Add `format=yuv420p` so the seg matches Ken Burns
    // pixel format byte-for-byte at the xfade boundary.
    let vf = format!(
        "scale={w}:{h}:force_original_aspect_ratio=decrease,pad={w}:{h}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps={fps},setpts=PTS-STARTPTS,format=yuv420p",
        w = width,
        h = height,
        fps = fps
    );
    let out = tokio::process::Command::new("ffmpeg")
        .arg("-y")
        .arg("-ss")
        .arg(format!("{:.3}", start_secs))
        .arg("-i")
        .arg(src)
        .arg("-t")
        .arg(format!("{:.3}", duration_secs))
        .arg("-vf")
        .arg(&vf)
        .arg("-fflags").arg("+genpts")
        .arg("-avoid_negative_ts").arg("make_zero")
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("veryfast")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-r")
        .arg(fps.to_string())
        .arg("-an")
        .arg(out_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .with_context(|| "spawn ffmpeg (ai_video segment)")?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(anyhow!("ffmpeg ai_video segment exited {}: {}", out.status, err));
    }
    Ok(())
}

// Render a still into a Ken-Burns-style animated clip. Uses ffmpeg's zoompan
// filter. `effect` picks the motion:
//   "zoom_in"    — slow zoom toward the center
//   "zoom_out"   — slow zoom away from center
//   "pan_left"   — hold slight zoom, pan from right to left
//   "pan_right"  — hold slight zoom, pan from left to right
//   "pan_up"     — hold slight zoom, pan from bottom to top
//   "pan_down"   — hold slight zoom, pan from top to bottom
async fn render_kenburns(
    src: &Path,
    out_path: &Path,
    duration_secs: f64,
    width: u32,
    height: u32,
    fps: u32,
    effect: &str,
    focus_x: f64,
    focus_y: f64,
) -> Result<()> {
    let total_frames = ((duration_secs * fps as f64).round() as u64).max(fps as u64);

    // zoompan operates on the input frame at its native resolution and
    // outputs `s=WxH`. We pre-scale so zoompan sees a canvas big enough to
    // zoom into without jaggies — scale input to 2× the target, then let
    // zoompan render at target size.
    let prescale = format!("scale={}:{}:force_original_aspect_ratio=increase,crop={}:{}", width * 2, height * 2, width * 2, height * 2);

    // CSSOS_PHASE2_FACE_BIAS_KENBURNS 20260430 #224 — Jing
    // "slideshow planner + ffmpeg 是否可以尽量让 Lite 封面图露出
    //  人物的脸部？" The center of zoompan's viewport is what stays in
    // the final frame as the zoom intensifies. By biasing center_x/y
    // toward the detected face (or rule-of-thirds upper-center for the
    // common album-cover layout), zoom_in pulls TOWARD the face instead
    // of into a random middle-of-cover point. focus_x/focus_y are 0..=1
    // normalised; (0.5, 0.4) is the default upper-center used when no
    // face was detected.
    //
    // Math: zoompan's x/y is the TOP-LEFT of the viewport in input coords.
    // Viewport size at zoom Z is (iw/Z, ih/Z). To CENTER the viewport
    // at (focus_x*iw, focus_y*ih), top-left becomes:
    //   x = focus_x*iw - (iw/zoom)/2
    //   y = focus_y*ih - (ih/zoom)/2
    // Clamped to keep the viewport inside the input rect.
    let cx = focus_x;
    let cy = focus_y;
    let center_x_expr = format!(
        "max(0,min(iw-iw/zoom,{cx:.4}*iw-(iw/zoom)/2))",
        cx = cx
    );
    let center_y_expr = format!(
        "max(0,min(ih-ih/zoom,{cy:.4}*ih-(ih/zoom)/2))",
        cy = cy
    );
    // For pans the start/end clamp is the input rect (full pan, edge to edge);
    // we override the orthogonal axis with the focus center.
    let h_pan_y_expr = format!(
        "max(0,min(ih-ih/zoom,{cy:.4}*ih-(ih/zoom)/2))",
        cy = cy
    );
    let v_pan_x_expr = format!(
        "max(0,min(iw-iw/zoom,{cx:.4}*iw-(iw/zoom)/2))",
        cx = cx
    );

    // Pick the zoompan expressions. `zoom` starts at 1 and steps per frame.
    // Over `total_frames` we want to go from 1.0 -> ~1.3 for zoom_in, or
    // 1.3 -> 1.0 for zoom_out (inverse). For pans we hold zoom at ~1.15
    // and slide x/y across the canvas.
    // NB: zoompan's `d` is frames-per-input-frame; with one still input we
    // want d=total_frames. We also need :fps={fps} so output timebase matches.
    let step = 0.3 / total_frames as f64;
    let (z_expr, x_expr, y_expr) = match effect {
        "zoom_out" => (
            format!("if(eq(on,0),1.3,zoom-{step:.6})"),
            center_x_expr.clone(),
            center_y_expr.clone(),
        ),
        "pan_left" => (
            "1.15".to_string(),
            format!("(iw-iw/zoom)*(1-on/{n})", n = total_frames),
            h_pan_y_expr.clone(),
        ),
        "pan_right" => (
            "1.15".to_string(),
            format!("(iw-iw/zoom)*(on/{n})", n = total_frames),
            h_pan_y_expr.clone(),
        ),
        "pan_up" => (
            "1.15".to_string(),
            v_pan_x_expr.clone(),
            format!("(ih-ih/zoom)*(1-on/{n})", n = total_frames),
        ),
        "pan_down" => (
            "1.15".to_string(),
            v_pan_x_expr.clone(),
            format!("(ih-ih/zoom)*(on/{n})", n = total_frames),
        ),
        // Default: zoom_in (gentle push toward focus center)
        _ => (
            format!("min(zoom+{step:.6},1.3)"),
            center_x_expr.clone(),
            center_y_expr.clone(),
        ),
    };

    // CSSOS_PHASE2_HYBRID_AI_VIDEO_FIX 20260426 #137 — match the AI-video
    // path's `setpts=PTS-STARTPTS,format=yuv420p` tail so all segments are
    // byte-for-byte compatible at the xfade boundary.
    let vf = format!(
        "{pre},zoompan=z='{z}':x='{x}':y='{y}':d={d}:s={w}x{h}:fps={fps},setsar=1,setpts=PTS-STARTPTS,format=yuv420p",
        pre = prescale,
        z = z_expr,
        x = x_expr,
        y = y_expr,
        d = total_frames,
        w = width,
        h = height,
        fps = fps
    );

    // CSSOS_PHASE2_LITE_XFADE 20260426 #126 — Jing
    //
    // Pre-existing render_kenburns bloat fix.
    //
    // The original `-loop 1 -t {dur} -i img` (input-side -t) combined with
    // zoompan's `d=total_frames` was multiplicative: with default 25fps
    // input feed, a 4s -t supplied 100 input frames, and zoompan emitted
    // d=100 output frames per input frame → 10000 frames at 25fps = 400s
    // segment file. That made the compose step 100× slower than necessary
    // and produced 36 MB junk segments for a 4s slide.
    //
    // Fix: feed the still at `-framerate 1 -loop 1` so it ticks at 1 Hz
    // (one input frame per second). Combined with `-frames:v total_frames`
    // on output, zoompan emits exactly `total_frames` frames at the target
    // fps, regardless of how long ffmpeg keeps the input alive. Belt and
    // braces: ALSO add `-t {duration_secs}` on output as a hard cap.
    let out = tokio::process::Command::new("ffmpeg")
        .arg("-y")
        .arg("-framerate")
        .arg("1")
        .arg("-loop")
        .arg("1")
        .arg("-i")
        .arg(src)
        .arg("-vf")
        .arg(&vf)
        .arg("-c:v")
        .arg("libx264")
        .arg("-preset")
        .arg("veryfast")
        .arg("-pix_fmt")
        .arg("yuv420p")
        .arg("-r")
        .arg(fps.to_string())
        .arg("-frames:v")
        .arg(total_frames.to_string())
        .arg("-t")
        .arg(format!("{:.3}", duration_secs))
        .arg("-an")
        .arg(out_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .with_context(|| "spawn ffmpeg (kenburns segment)")?;
    if !out.status.success() {
        let err = String::from_utf8_lossy(&out.stderr);
        return Err(anyhow!("ffmpeg kenburns segment exited {}: {}", out.status, err));
    }
    Ok(())
}

fn guess_image_ext(url: &str) -> Option<&'static str> {
    let lower = url.to_lowercase();
    for (needle, ext) in [
        (".png", "png"),
        (".jpg", "jpg"),
        (".jpeg", "jpg"),
        (".webp", "webp"),
        (".gif", "gif"),
    ] {
        // Match either "?foo.png" query params or raw ".png" path suffix.
        if lower.contains(needle) {
            return Some(ext);
        }
    }
    None
}

fn sanitize_id(id: &str) -> String {
    id.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '_'
            }
        })
        .collect()
}

async fn download_to(url: &str, path: &Path) -> Result<()> {
    // CSSOS_PHASE2_COMPOSE_LOCAL_AUDIO 20260426 #124 — Jing
    // ElevenLabs music adapter writes the rendered audio to
    // /tmp/cssos-music/eleven-sync-<id>.mp3 and returns a `file://`
    // URL. reqwest::get() treats it as HTTP and 404s. Detect file://
    // and bare-path URLs and copy locally instead.
    let trimmed = url.trim();
    if let Some(local) = trimmed.strip_prefix("file://") {
        let src = std::path::Path::new(local);
        tokio::fs::copy(src, path)
            .await
            .with_context(|| format!("copy file:// source {:?} -> {:?}", src, path))?;
        return Ok(());
    }
    if trimmed.starts_with('/') && tokio::fs::metadata(trimmed).await.is_ok() {
        // Bare absolute path that exists on disk — same treatment as file://.
        tokio::fs::copy(trimmed, path)
            .await
            .with_context(|| format!("copy local path {} -> {:?}", trimmed, path))?;
        return Ok(());
    }
    let resp = reqwest::get(url)
        .await
        .with_context(|| format!("GET {}", url))?;
    if !resp.status().is_success() {
        return Err(anyhow!("{} returned {}", url, resp.status()));
    }
    let bytes = resp.bytes().await?;
    let mut f = tokio::fs::File::create(path)
        .await
        .with_context(|| format!("create {:?}", path))?;
    f.write_all(&bytes).await?;
    f.flush().await?;
    Ok(())
}

async fn probe_dimensions(path: &Path) -> (u32, u32, Option<f64>) {
    // Best-effort ffprobe. If it isn't installed or fails, return zeros and
    // let the frontend infer from the <video> element.
    let out = match tokio::process::Command::new("ffprobe")
        .arg("-v")
        .arg("error")
        .arg("-select_streams")
        .arg("v:0")
        .arg("-show_entries")
        .arg("stream=width,height:format=duration")
        .arg("-of")
        .arg("default=noprint_wrappers=1:nokey=0")
        .arg(path)
        .output()
        .await
    {
        Ok(o) if o.status.success() => o,
        _ => return (0, 0, None),
    };
    let text = String::from_utf8_lossy(&out.stdout);
    let mut w = 0u32;
    let mut h = 0u32;
    let mut dur: Option<f64> = None;
    for line in text.lines() {
        if let Some(v) = line.strip_prefix("width=") {
            w = v.trim().parse().unwrap_or(0);
        } else if let Some(v) = line.strip_prefix("height=") {
            h = v.trim().parse().unwrap_or(0);
        } else if let Some(v) = line.strip_prefix("duration=") {
            dur = v.trim().parse().ok();
        }
    }
    (w, h, dur)
}
