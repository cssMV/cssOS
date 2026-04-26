// CSSOS_PHASE2_MUSIC_GEN 20260417 —
// Third-party music generation adapters. First provider is MusicGPT. The surface
// is kept intentionally small for the MVP single-shot flow: feed prompt + style
// (+ optional lyrics), block-poll for completion, and return a MusicGenResult
// with the download URL, duration, and the provider's job/conversion IDs so the
// billing layer can persist them as the `request_id` on the usage event.
//
// This module lives outside `audio_provider::` on purpose — audio_provider is
// our internal plan/export/delivery system, not an HTTP adapter layer.
//
// CSSOS_PHASE2_SUNO 20260419 — Added Suno v5 as a second provider. Pipeline
// dispatches by the user-selected `engine` field on the music request; the
// two adapters share the same `MusicGenRequest` / `MusicGenResult` contract.
//
// CSSOS_PHASE2_MUSIC_MULTIPROVIDER 20260419 — Added ElevenLabs Music and
// Stability Audio 2.0 as the third and fourth providers. Each adapter returns
// either an http(s) URL or a file:// URL pointing at a locally cached clip,
// and surfaces the same MusicGenError variants so the pipeline treats every
// provider uniformly. Keys are optional: missing env returns NotConfigured
// and the engine registry filters the engine out of the public catalog.

pub mod elevenlabs;
pub mod musicgpt;
pub mod stability_audio;
pub mod suno;

pub use elevenlabs::{ElevenMusicClient, ElevenMusicConfig, ElevenUserInfo};
pub use musicgpt::{
    MusicGenError, MusicGenRequest, MusicGenResult, MusicGptClient, MusicGptConfig,
};
pub use stability_audio::{StabilityAccountInfo, StableAudioClient, StableAudioConfig};
pub use suno::{SunoClient, SunoConfig};

// CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
// "音乐引擎渲染音乐的时候，是否正确并且同时输出带有时间戳的歌词时间轴 json？
//  不然字幕无法渲染。"
//
// Suno v5 (`clip.metadata.alignedWords` / `lyrics_alignment`) and ElevenLabs
// Music (`lyrics_with_timing`) both expose per-line / per-word timing in
// their result payloads. We were ignoring those fields and re-deriving SRT
// timing by even-dividing the total duration across lines — which made every
// caption drift relative to the actual vocal performance.
//
// `AlignedLyricLine` is the engine-neutral shape we propagate up through
// MusicGenResult → MusicResponse → /api/mv/subtitles. Each adapter parses
// its provider's specific JSON into this struct (or returns None when the
// engine does not emit alignment, e.g. MusicGPT and Stable Audio).
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct AlignedLyricLine {
    /// The lyric text for this line (post-engine, may have minor spelling
    /// differences from the input lyrics if the model improvised).
    pub text: String,
    /// Line start, milliseconds from track start.
    pub start_ms: u64,
    /// Line end, milliseconds from track start. Always >= start_ms.
    pub end_ms: u64,
    /// Optional section tag if the engine identifies it
    /// (e.g. "verse_1", "chorus", "bridge"). Frontend's section planner
    /// uses this to align video / Ken Burns segments.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub section: Option<String>,
}

/// Best-effort defensive extractor: tries every known shape Suno + ElevenLabs
/// have shipped over their last few API revisions, plus a few generic
/// fallbacks. Returns `None` rather than `Some(vec![])` so downstream callers
/// can clearly distinguish "no alignment" from "empty alignment".
///
/// Shapes tried, in order:
///   1. ElevenLabs Music: `v.lyrics_with_timing` = `[{text, start_time, end_time}]`
///      (start_time/end_time in seconds, sometimes as `start`/`end`).
///   2. Suno v5: `v.metadata.alignedWords` / `v.metadata.aligned_words` =
///      `[{word, start, end}]` (seconds), grouped into lines on `\n`.
///   3. Generic: `v.alignment.lines` = `[{text, start_ms, end_ms}]`.
///   4. Generic: `v.aligned_lyrics` = self-shaped array.
pub fn extract_aligned_lyrics(v: &serde_json::Value) -> Option<Vec<AlignedLyricLine>> {
    use serde_json::Value;

    fn ms_from(v: &Value) -> Option<u64> {
        if let Some(ms) = v.as_u64() {
            return Some(ms);
        }
        if let Some(secs) = v.as_f64() {
            return Some((secs * 1000.0).round() as u64);
        }
        None
    }

    // 1. ElevenLabs Music – `lyrics_with_timing`
    if let Some(arr) = v
        .get("lyrics_with_timing")
        .and_then(|x| x.as_array())
        .filter(|a| !a.is_empty())
    {
        let lines: Vec<AlignedLyricLine> = arr
            .iter()
            .filter_map(|item| {
                let text = item.get("text").and_then(|x| x.as_str())?.to_string();
                let start_ms = item
                    .get("start_ms")
                    .and_then(ms_from)
                    .or_else(|| item.get("start_time").and_then(ms_from))
                    .or_else(|| item.get("start").and_then(ms_from))?;
                let end_ms = item
                    .get("end_ms")
                    .and_then(ms_from)
                    .or_else(|| item.get("end_time").and_then(ms_from))
                    .or_else(|| item.get("end").and_then(ms_from))?;
                Some(AlignedLyricLine {
                    text,
                    start_ms,
                    end_ms: end_ms.max(start_ms),
                    section: item
                        .get("section")
                        .and_then(|x| x.as_str())
                        .map(|s| s.to_string()),
                })
            })
            .collect();
        if !lines.is_empty() {
            return Some(lines);
        }
    }

    // 2. Suno v5 – word-level alignment under metadata
    let suno_words = v
        .get("metadata")
        .and_then(|m| m.get("alignedWords").or_else(|| m.get("aligned_words")))
        .and_then(|x| x.as_array())
        .or_else(|| {
            v.get("alignedWords")
                .or_else(|| v.get("aligned_words"))
                .and_then(|x| x.as_array())
        });
    if let Some(words) = suno_words.filter(|a| !a.is_empty()) {
        // Group consecutive words into lines on explicit "\n" tokens or
        // every ~10 words as a coarse fallback when the engine doesn't
        // emit linebreak markers.
        let mut lines: Vec<AlignedLyricLine> = Vec::new();
        let mut buf: Vec<String> = Vec::new();
        let mut buf_start: Option<u64> = None;
        let mut buf_end: u64 = 0;
        let flush = |buf: &mut Vec<String>,
                     buf_start: &mut Option<u64>,
                     buf_end: &mut u64,
                     lines: &mut Vec<AlignedLyricLine>| {
            if buf.is_empty() {
                return;
            }
            if let Some(start) = *buf_start {
                lines.push(AlignedLyricLine {
                    text: buf.join(" "),
                    start_ms: start,
                    end_ms: (*buf_end).max(start),
                    section: None,
                });
            }
            buf.clear();
            *buf_start = None;
            *buf_end = 0;
        };
        for w in words {
            let word = w
                .get("word")
                .or_else(|| w.get("text"))
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .to_string();
            let start = w
                .get("start")
                .or_else(|| w.get("start_ms"))
                .or_else(|| w.get("start_time"))
                .and_then(ms_from);
            let end = w
                .get("end")
                .or_else(|| w.get("end_ms"))
                .or_else(|| w.get("end_time"))
                .and_then(ms_from);
            if word.contains('\n') {
                let mut buf2 = buf.clone();
                buf.clear();
                let parts: Vec<&str> = word.split('\n').collect();
                if let Some(first) = parts.first() {
                    if !first.trim().is_empty() {
                        buf2.push(first.trim().to_string());
                    }
                }
                let mut bs = buf_start;
                let mut be = buf_end;
                flush(&mut buf2, &mut bs, &mut be, &mut lines);
                buf_start = bs;
                buf_end = be;
                if let Some(last) = parts.last() {
                    if !last.trim().is_empty() {
                        buf.push(last.trim().to_string());
                        if buf_start.is_none() {
                            buf_start = start;
                        }
                        if let Some(e) = end {
                            buf_end = buf_end.max(e);
                        }
                    }
                }
                continue;
            }
            if !word.trim().is_empty() {
                buf.push(word.trim().to_string());
                if buf_start.is_none() {
                    buf_start = start;
                }
                if let Some(e) = end {
                    buf_end = buf_end.max(e);
                }
            }
            // Coarse line break every 10 words if upstream gives no \n
            if buf.len() >= 10 {
                flush(&mut buf, &mut buf_start, &mut buf_end, &mut lines);
            }
        }
        flush(&mut buf, &mut buf_start, &mut buf_end, &mut lines);
        if !lines.is_empty() {
            return Some(lines);
        }
    }

    // 3. Generic shape – v.alignment.lines = [{text, start_ms, end_ms}]
    if let Some(arr) = v
        .get("alignment")
        .and_then(|x| x.get("lines"))
        .and_then(|x| x.as_array())
        .filter(|a| !a.is_empty())
    {
        let lines: Vec<AlignedLyricLine> = arr
            .iter()
            .filter_map(|item| {
                let text = item.get("text").and_then(|x| x.as_str())?.to_string();
                let start_ms = item.get("start_ms").and_then(ms_from)?;
                let end_ms = item.get("end_ms").and_then(ms_from)?;
                Some(AlignedLyricLine {
                    text,
                    start_ms,
                    end_ms: end_ms.max(start_ms),
                    section: item
                        .get("section")
                        .and_then(|x| x.as_str())
                        .map(|s| s.to_string()),
                })
            })
            .collect();
        if !lines.is_empty() {
            return Some(lines);
        }
    }

    // 4. Direct top-level `aligned_lyrics` array (already in our shape)
    if let Some(arr) = v
        .get("aligned_lyrics")
        .and_then(|x| x.as_array())
        .filter(|a| !a.is_empty())
    {
        let lines: Vec<AlignedLyricLine> = arr
            .iter()
            .filter_map(|item| {
                serde_json::from_value::<AlignedLyricLine>(item.clone()).ok()
            })
            .collect();
        if !lines.is_empty() {
            return Some(lines);
        }
    }

    None
}

#[cfg(test)]
mod aligned_lyrics_tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn elevenlabs_lyrics_with_timing_seconds() {
        let v = json!({
            "lyrics_with_timing": [
                {"text": "First line", "start_time": 0.5, "end_time": 3.2},
                {"text": "Second line", "start_time": 3.5, "end_time": 6.8}
            ]
        });
        let out = extract_aligned_lyrics(&v).expect("should extract");
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].text, "First line");
        assert_eq!(out[0].start_ms, 500);
        assert_eq!(out[0].end_ms, 3200);
        assert_eq!(out[1].start_ms, 3500);
    }

    #[test]
    fn suno_metadata_aligned_words() {
        let v = json!({
            "metadata": {
                "alignedWords": [
                    {"word": "Hello", "start": 0.0, "end": 0.4},
                    {"word": "world", "start": 0.5, "end": 0.9},
                    {"word": "\n", "start": 0.9, "end": 1.0},
                    {"word": "Second", "start": 1.2, "end": 1.6},
                    {"word": "line", "start": 1.7, "end": 2.0}
                ]
            }
        });
        let out = extract_aligned_lyrics(&v).expect("should extract");
        assert_eq!(out.len(), 2);
        assert_eq!(out[0].text, "Hello world");
        assert_eq!(out[0].start_ms, 0);
        assert_eq!(out[1].text, "Second line");
        assert_eq!(out[1].start_ms, 1200);
    }

    #[test]
    fn no_alignment_returns_none() {
        let v = json!({"audio_url": "https://example.com/x.mp3"});
        assert!(extract_aligned_lyrics(&v).is_none());
    }

    #[test]
    fn empty_array_returns_none() {
        let v = json!({"lyrics_with_timing": []});
        assert!(extract_aligned_lyrics(&v).is_none());
    }
}
