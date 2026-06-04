# CSSOS_WAVE_441 20260525 — Jing「Python音频分析服务·情绪字幕Phase2」
#
# Core audio analysis: given an audio URL + Whisper word timeline,
# enrich each token with:
#   beat          — beat position within measure (0.0–3.0 for 4/4)
#   beat_strength — "strong" | "weak" | "off-beat" | "syncopated"
#   rhythm        — "on-beat" | "off-beat" | "syncopated"
#   volume        — 0.0–1.0 normalized RMS for this word's time window
#   pitch_hz      — median fundamental frequency (pyin) for this window
#
# All values are null-safe: any step that fails returns null for that field
# rather than crashing the whole response.

import io
import tempfile
import os
import math
import logging
from typing import Optional
import numpy as np
import requests
import librosa
import soundfile as sf

logger = logging.getLogger("cssos.analyze")

SAMPLE_RATE = 22050       # librosa default; sufficient for beat/pitch analysis
MAX_AUDIO_BYTES = 60 * 1024 * 1024  # 60 MB hard cap


def _download_audio(url: str) -> Optional[str]:
    """Download audio URL to a temp file. Returns temp file path or None."""
    try:
        resp = requests.get(url, timeout=30, stream=True)
        resp.raise_for_status()
        suffix = ".mp3"
        if "audio/wav" in resp.headers.get("Content-Type", ""):
            suffix = ".wav"
        elif "audio/ogg" in resp.headers.get("Content-Type", ""):
            suffix = ".ogg"
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        size = 0
        for chunk in resp.iter_content(chunk_size=65536):
            size += len(chunk)
            if size > MAX_AUDIO_BYTES:
                tmp.close()
                os.unlink(tmp.name)
                logger.warning("Audio too large: %s", url)
                return None
            tmp.write(chunk)
        tmp.close()
        return tmp.name
    except Exception as e:
        logger.warning("Download failed %s: %s", url, e)
        return None


def _load_audio(path: str):
    """Load audio as mono float32 at SAMPLE_RATE. Returns (y, sr)."""
    try:
        y, sr = librosa.load(path, sr=SAMPLE_RATE, mono=True)
        return y, sr
    except Exception as e:
        logger.warning("librosa.load failed: %s", e)
        return None, None


def _extract_beats(y, sr):
    """
    Returns (beat_times_sec, tempo_bpm).
    beat_times_sec: sorted array of beat timestamps in seconds.
    """
    try:
        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
        beat_times = librosa.frames_to_time(beat_frames, sr=sr)
        return beat_times, float(tempo)
    except Exception:
        return np.array([]), 0.0


def _rms_for_window(y, sr, t_start_s: float, t_end_s: float) -> Optional[float]:
    """Mean RMS amplitude in [t_start_s, t_end_s], normalized 0–1."""
    try:
        s = max(0, int(t_start_s * sr))
        e = min(len(y), int(t_end_s * sr))
        if e <= s:
            return None
        segment = y[s:e]
        rms_val = float(np.sqrt(np.mean(segment ** 2)))
        # Normalize against whole-track RMS
        track_rms = float(np.sqrt(np.mean(y ** 2))) or 1e-6
        normalized = min(1.0, rms_val / (track_rms * 2.0))
        return round(normalized, 4)
    except Exception:
        return None


def _pitch_for_window(y, sr, t_start_s: float, t_end_s: float) -> Optional[float]:
    """
    Median fundamental frequency in [t_start_s, t_end_s] via pyin.
    Returns Hz or null if unvoiced/silent.
    pyin is accurate but slow on long segments — we limit to 2s max.
    """
    try:
        s = max(0, int(t_start_s * sr))
        e = min(len(y), int(t_end_s * sr))
        # Cap at 2 seconds to keep latency reasonable
        e = min(e, s + int(2.0 * sr))
        if e - s < int(0.05 * sr):  # < 50ms → skip
            return None
        segment = y[s:e]
        f0, voiced_flag, _ = librosa.pyin(
            segment,
            fmin=librosa.note_to_hz("C2"),   # ~65 Hz
            fmax=librosa.note_to_hz("C7"),   # ~2093 Hz
            sr=sr,
        )
        voiced_f0 = f0[voiced_flag]
        if len(voiced_f0) == 0:
            return None
        median_f0 = float(np.median(voiced_f0))
        return round(median_f0, 2) if median_f0 > 0 else None
    except Exception:
        return None


def _beat_info_for_token(t_start_s: float, beat_times: np.ndarray, tempo_bpm: float):
    """
    Given a token's start time and the global beat grid, return:
      beat_pos       — beat number within measure (0.0–3.9 for 4/4)
      beat_strength  — "strong" | "weak" | "off-beat" | "syncopated"
      rhythm         — "on-beat" | "off-beat" | "syncopated"
    """
    if len(beat_times) == 0 or tempo_bpm <= 0:
        return None, None, None

    try:
        # Find nearest beat
        diffs = np.abs(beat_times - t_start_s)
        nearest_idx = int(np.argmin(diffs))
        nearest_beat_t = float(beat_times[nearest_idx])
        beat_interval = 60.0 / tempo_bpm  # seconds per beat

        dist = abs(t_start_s - nearest_beat_t)
        on_beat = dist < (beat_interval * 0.15)   # within 15% of beat = on-beat
        syncopated = (beat_interval * 0.35) < dist < (beat_interval * 0.65)  # near mid-beat

        beat_in_measure = nearest_idx % 4  # 4/4 assumed
        if on_beat:
            strength = "strong" if beat_in_measure in (0, 2) else "weak"
            rhythm = "on-beat"
        elif syncopated:
            strength = "off-beat"
            rhythm = "syncopated"
        else:
            strength = "off-beat"
            rhythm = "off-beat"

        beat_pos = round(beat_in_measure + dist / beat_interval, 3)
        return beat_pos, strength, rhythm
    except Exception:
        return None, None, None


def analyze_audio(audio_url: str, timeline: list[dict]) -> dict:
    """
    Main entry point.

    timeline: list of {word, start, end} dicts (seconds as floats).

    Returns:
      {
        "ok": true,
        "tempo_bpm": 120.0,
        "tokens": [
          {
            "word": "hello",
            "t_start": 500,   # ms
            "t_end": 800,
            "beat": 0.0,
            "beat_strength": "strong",
            "rhythm": "on-beat",
            "volume": 0.76,
            "pitch_hz": 330.0
          }, ...
        ]
      }
    """
    tmp_path = _download_audio(audio_url)
    if not tmp_path:
        return {"ok": False, "error": "download_failed"}

    try:
        y, sr = _load_audio(tmp_path)
        if y is None:
            return {"ok": False, "error": "load_failed"}

        beat_times, tempo_bpm = _extract_beats(y, sr)
        logger.info("Loaded %s | %.1f BPM | %d beats | %d tokens",
                    audio_url, tempo_bpm, len(beat_times), len(timeline))

        tokens = []
        for item in timeline:
            word = str(item.get("word") or "").strip()
            t0 = float(item.get("start") or 0)
            t1 = float(item.get("end") or t0 + 0.3)

            volume = _rms_for_window(y, sr, t0, t1)
            pitch_hz = _pitch_for_window(y, sr, t0, t1)
            beat_pos, beat_strength, rhythm = _beat_info_for_token(t0, beat_times, tempo_bpm)

            tokens.append({
                "word": word,
                "t_start": round(t0 * 1000),   # → ms
                "t_end": round(t1 * 1000),
                "beat": beat_pos,
                "beat_strength": beat_strength,
                "rhythm": rhythm,
                "volume": volume,
                "pitch_hz": pitch_hz,
            })

        return {"ok": True, "tempo_bpm": round(tempo_bpm, 2), "tokens": tokens}

    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
