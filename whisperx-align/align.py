# CSSOS_WAVE_650 20260605 — Jing 情绪字幕 B·whisperX 强制对齐服务(核心).
#
# 给定 音频 URL (+ 可选参考歌词 ref_text + language), 返回【逐字】真实 onset/offset:
#   {"words": [{"word": "晨", "start": 3.30, "end": 3.56}, ...]}  (秒)
#
# 两种模式:
#   1. ref_text 提供(推荐) → 【强制对齐到已知歌词】: 不靠 ASR 猜唱了什么, 直接拿真歌词
#      去音频里定位每字。歌声里 ASR 常听错字, 强制对齐不受影响 → 比 OpenAI 更稳。
#   2. ref_text 缺省 → 退回 ASR 转写 + 对齐(faster-whisper 转写, 再 wav2vec2 对齐)。
#
# 全程 null-safe: 任何子步失败都退化, 绝不让整请求崩。重型模型【全局懒加载一次】常驻。

import os
import re
import tempfile
import logging
from typing import Optional, List, Dict, Any

import requests

logger = logging.getLogger("cssos.whisperx")

# ── 配置(env 可调)─────────────────────────────────────────────────────────
WHISPER_MODEL = os.environ.get("WHISPERX_MODEL", "medium")   # tiny/base/small/medium/large-v3
DEVICE = os.environ.get("WHISPERX_DEVICE", "cpu")            # "cuda" 若有 GPU
COMPUTE_TYPE = os.environ.get("WHISPERX_COMPUTE", "int8")    # GPU: "float16"; CPU: "int8"
MAX_AUDIO_BYTES = 80 * 1024 * 1024  # 80 MB 硬上限

# ── 懒加载的全局单例 ─────────────────────────────────────────────────────────
_asr_model = None
_align_cache: Dict[str, Any] = {}   # language → (align_model, metadata)
_whisperx = None


def _lazy_whisperx():
    global _whisperx
    if _whisperx is None:
        import whisperx  # 重依赖, 首次调用才导入
        _whisperx = whisperx
    return _whisperx


def _get_asr():
    global _asr_model
    if _asr_model is None:
        wx = _lazy_whisperx()
        logger.info("loading ASR model=%s device=%s compute=%s", WHISPER_MODEL, DEVICE, COMPUTE_TYPE)
        _asr_model = wx.load_model(WHISPER_MODEL, DEVICE, compute_type=COMPUTE_TYPE)
    return _asr_model


def _get_aligner(language: str):
    """每语言一个 wav2vec2 对齐模型, 缓存常驻。"""
    if language in _align_cache:
        return _align_cache[language]
    wx = _lazy_whisperx()
    logger.info("loading align model for language=%s", language)
    model_a, metadata = wx.load_align_model(language_code=language, device=DEVICE)
    _align_cache[language] = (model_a, metadata)
    return _align_cache[language]


def _download_audio(url: str) -> Optional[str]:
    try:
        resp = requests.get(url, timeout=40, stream=True)
        resp.raise_for_status()
        ctype = resp.headers.get("Content-Type", "")
        suffix = ".wav" if "wav" in ctype else (".ogg" if "ogg" in ctype else (".m4a" if "mp4" in ctype or "m4a" in ctype else ".mp3"))
        tmp = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
        size = 0
        for chunk in resp.iter_content(chunk_size=65536):
            size += len(chunk)
            if size > MAX_AUDIO_BYTES:
                tmp.close(); os.unlink(tmp.name)
                logger.warning("audio too large: %s", url)
                return None
            tmp.write(chunk)
        tmp.close()
        return tmp.name
    except Exception as e:
        logger.warning("download failed: %s", e)
        return None


def _split_units(text: str) -> List[str]:
    """把歌词切成对齐单元: CJK 按字, 拉丁按词。过滤段落标签 [Verse]/【…】。"""
    units: List[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if re.match(r"^[\[【][^\]】]*[\]】]$", line):  # 段落标签行 → 跳过
            continue
        if re.search(r"[㐀-鿿぀-ヿ가-힯]", line):
            units.extend([c for c in line if c.strip()])
        else:
            units.extend([w for w in line.split() if w.strip()])
    return units


def _vocal_windows(audio, lines: List[str]) -> Optional[List[tuple]]:
    """CSSOS_WAVE_651/#45 — 用 silero VAD(faster-whisper 自带, 轻量)找【真实有人声的时间段】,
    把歌词行按字数比例铺到【人声时间轴】(跳过前奏/间奏/尾奏的器乐空白)→ 每行得到一个【贴合真实
    演唱位置】的窗, 替代"整曲均匀粗窗"(后者会把行错放进无人声段 → 中段漂移)。
    返回 [(start_s, end_s), ...] 每行一个; VAD 不可用 → None(调用方退回均匀窗)。"""
    try:
        from faster_whisper.vad import get_speech_timestamps, VadOptions
    except Exception:
        return None
    try:
        # audio = 16k float32 (whisperx.load_audio)
        ts = get_speech_timestamps(audio, vad_options=VadOptions(min_silence_duration_ms=500))
        segs = [(t["start"] / 16000.0, t["end"] / 16000.0) for t in ts if t.get("end", 0) > t.get("start", 0)]
    except Exception:
        return None
    if not segs:
        return None
    segs.sort()
    total_voc = sum(e - s for s, e in segs)
    if total_voc <= 0.5:
        return None
    char_counts = [max(1, len(ln)) for ln in lines]
    total_chars = sum(char_counts)

    def voc_time(frac: float) -> float:
        target = max(0.0, min(1.0, frac)) * total_voc
        acc = 0.0
        for s, e in segs:
            span = e - s
            if acc + span >= target:
                return s + (target - acc)
            acc += span
        return segs[-1][1]

    windows, cum = [], 0
    for cc in char_counts:
        windows.append((voc_time(cum / total_chars), voc_time((cum + cc) / total_chars)))
        cum += cc
    return windows


def _flatten_words(aligned: Dict[str, Any]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for seg in (aligned.get("segments") or []):
        for w in (seg.get("words") or []):
            txt = str(w.get("word", "")).strip()
            s = w.get("start"); e = w.get("end")
            if txt and s is not None and e is not None and float(e) > float(s):
                out.append({"word": txt, "start": round(float(s), 3), "end": round(float(e), 3)})
    return out


def align_audio(audio_url: str, language: Optional[str] = None, ref_text: Optional[str] = None) -> Dict[str, Any]:
    """主入口。返回 {"words": [...], "mode": "...", "language": "..."} 或 {"words": [], "error": "..."}。"""
    path = _download_audio(audio_url)
    if not path:
        return {"words": [], "error": "download_failed"}
    try:
        wx = _lazy_whisperx()
        audio = wx.load_audio(path)
        lang = (language or "").strip().lower() or None
        mode = "ref_forced" if (ref_text and ref_text.strip()) else "asr"

        if mode == "ref_forced":
            # 强制对齐到已知歌词: 【每行一个 segment】, 按行数均匀分配粗略时间窗。whisperX 在各窗内
            # 用 wav2vec2 精对齐 → 真实字级 onset/offset, 且每次只对一小段音频做前向(避免整首
            # 247s 一次性前向 → OOM)。粗窗只用于定位, 输出时间来自音频对齐。
            if not lang:
                lang = "zh"  # ref 模式必须指定语言对齐模型; 默认中文
            lines = [
                ln.strip() for ln in ref_text.splitlines()
                if ln.strip() and not re.match(r"^[\[【][^\]】]*[\]】]$", ln.strip())
            ]
            if not lines:
                return {"words": [], "error": "empty_ref"}
            dur = float(len(audio)) / 16000.0  # whisperx load_audio = 16k
            n = len(lines)
            is_latin = bool(re.search(r"[A-Za-z]", ref_text or ""))
            # #45 — 人声段定位(默认): 用【本地 silero VAD】(faster-whisper 自带, 1.8MB, 零下载)
            # 找出【真实有人声的时间段】(跳过前奏/间奏/尾奏的器乐空白), 把已知歌词行按比例【桶装】进
            # 这些真实段, 每段【整段】强制对齐。段边界是真的→ 不会有字被撑过间奏; 桶装(多行/段)而非
            # 每行一窗→ 不切碎乐句。VAD 不可用 → 退回整曲均匀窗。(不走 ASR: whisperX 的 VAD 模型 URL
            # 已搬家撞 301, 而 silero 本地无此问题。)
            # 实测(Jerusalem): silero 仅分出 9 段, 52 行桶装进去 → 段内 wav2vec2 把前几行挤到 0.02s,
            # 比均匀窗(晨 1.81s/最长 2.97s)更糟。故【默认关】, 均匀窗为默认(当前最优)。env
            # WHISPERX_USE_VAD=1 才启用桶装。真正提升 onset 精度需换更强的 CJK 对齐器(MFA 等), 见 #45。
            voc_segs = None
            try:
                if os.environ.get("WHISPERX_USE_VAD") != "1":
                    raise RuntimeError("vad disabled")
                from faster_whisper.vad import get_speech_timestamps, VadOptions
                ts = get_speech_timestamps(audio, vad_options=VadOptions(min_silence_duration_ms=700))
                raw = sorted((t["start"] / 16000.0, t["end"] / 16000.0) for t in ts if t.get("end", 0) > t.get("start", 0))
                # 合并间隔 <1.2s 的相邻段, 减少碎片(每段成一个乐句尺度)
                merged = []
                for s, e in raw:
                    if merged and s - merged[-1][1] < 1.2:
                        merged[-1] = (merged[-1][0], e)
                    else:
                        merged.append((s, e))
                voc_segs = merged or None
            except Exception as e:
                logger.warning("VAD seg failed (fallback even-window): %s", e)
                voc_segs = None

            segments = []
            if voc_segs:
                N = len(voc_segs)
                bucket = [[] for _ in range(N)]
                for i, ln in enumerate(lines):
                    bucket[min(N - 1, int(i * N / n))].append(ln)
                for (s, e), lns in zip(voc_segs, bucket):
                    if not lns:
                        continue
                    joined = (" ".join(lns)) if is_latin else ("".join(lns))
                    segments.append({"text": joined, "start": round(s, 3), "end": round(max(s + 0.3, e), 3)})
                logger.info("ref_forced VAD-bucketed: %d voc-segs ← %d lines", N, n)
            if not segments:
                for i, ln in enumerate(lines):
                    s = dur * i / n
                    e = dur * (i + 1) / n
                    segments.append({"text": ln, "start": round(s, 3), "end": round(max(s + 0.2, e), 3)})
                logger.info("ref_forced even-window: %d lines", n)
            model_a, metadata = _get_aligner(lang)
            aligned = wx.align(segments, model_a, metadata, audio, DEVICE, return_char_alignments=False)
            words = _flatten_words(aligned)
            return {"words": words, "mode": mode, "language": lang}

        # ASR 模式: 转写 → 对齐
        asr = _get_asr()
        result = asr.transcribe(audio, batch_size=8, language=lang)
        lang = result.get("language") or lang or "en"
        model_a, metadata = _get_aligner(lang)
        aligned = wx.align(result["segments"], model_a, metadata, audio, DEVICE, return_char_alignments=False)
        words = _flatten_words(aligned)
        return {"words": words, "mode": mode, "language": lang}
    except Exception as e:
        logger.exception("align failed")
        return {"words": [], "error": str(e)[:200]}
    finally:
        try:
            os.unlink(path)
        except Exception:
            pass
