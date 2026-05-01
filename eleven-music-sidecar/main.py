"""
ElevenLabs Music sidecar — composition_plan via official SDK.

Why a sidecar instead of a Rust HTTP client:
  ElevenLabs Music's `/v1/music/compose` endpoint accepts two body shapes,
  flat (`prompt + music_length_ms`) and structured (`composition_plan`).
  The composition_plan schema's internal field names drift, and our Rust
  hand-crafted bodies kept tripping 422 errors. The official Python SDK
  (`elevenlabs>=2.x`) tracks the internal schema for us, so we delegate
  composition_plan calls to a small FastAPI service, then stream the
  resulting audio bytes back to Rust over loopback.

Endpoint:
  POST /compose
    {
      "title":           "<song title (informational, not sent to API)>",
      "lyrics":          "<full lyric body, may include [Verse 1] markers>",
      "style":           "<global style/mood description>",
      "duration_ms":     180000,
      "language":        "zh",                # optional, hint only
      "make_instrumental": false,             # if true, skip lyrics
      "output_format":   "mp3_44100_192"      # optional override
    }

  Returns: 200 with binary audio body (Content-Type: audio/mpeg by default),
           or 4xx/5xx JSON {"ok": false, "error": "...", "detail": "..."}.

Health check:
  GET /healthz  -> {"ok": true, "version": "<sdk version>"}

Run locally:
  ELEVENLABS_API_KEY=sk_xxxx uvicorn main:app --host 127.0.0.1 --port 8765

Run as systemd unit:
  See eleven-music-sidecar.service alongside this file.

CSSOS_PHASE2_ELEVEN_SIDECAR 20260429 #185 — Jing
"""

import base64
import json
import logging
import os
import re
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel, Field

LOG = logging.getLogger("eleven-music-sidecar")
logging.basicConfig(
    level=os.environ.get("ELEVEN_SIDECAR_LOG_LEVEL", "INFO").upper(),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

app = FastAPI(title="cssOS ElevenLabs Music sidecar", version="1.0")


# ---------------------------------------------------------------- SDK lazy import

_SDK_CLIENT = None
_SDK_VERSION = "unknown"


def _get_sdk_client():
    """Lazy-import + memoize the ElevenLabs SDK client."""
    global _SDK_CLIENT, _SDK_VERSION
    if _SDK_CLIENT is not None:
        return _SDK_CLIENT
    try:
        import elevenlabs as _el  # type: ignore
        _SDK_VERSION = getattr(_el, "__version__", "unknown")
        from elevenlabs.client import ElevenLabs  # type: ignore
    except Exception as exc:  # pragma: no cover
        raise RuntimeError(
            f"elevenlabs SDK not importable: {exc!r}. "
            f"Run `pip install --upgrade 'elevenlabs>=2.0'`"
        ) from exc
    api_key = (
        os.environ.get("ELEVENLABS_API_KEY")
        or os.environ.get("ELEVEN_API_KEY")
        or os.environ.get("ELEVEN_LABS_API_KEY")
    )
    if not api_key:
        raise RuntimeError(
            "ELEVENLABS_API_KEY is not set in the sidecar environment. "
            "Set it in the systemd unit's Environment= line."
        )
    _SDK_CLIENT = ElevenLabs(api_key=api_key)
    LOG.info("elevenlabs SDK %s ready", _SDK_VERSION)
    return _SDK_CLIENT


# ---------------------------------------------------------------- composition plan builder

# Section header keywords that map to real song structure. Anything else in
# brackets (e.g. [Scene I], [Act II]) is treated as visual/director-only
# metadata and stripped before being sent to the engine.
_REAL_SECTION_KEYWORDS = (
    "intro", "verse", "pre-chorus", "prechorus", "chorus", "hook",
    "bridge", "outro", "interlude", "refrain", "drop", "solo",
    "前奏", "主歌", "副歌", "桥段", "尾奏", "间奏",
)


def _normalize_section_label(label: str) -> str:
    """Map a bracket label to a canonical section_name the SDK accepts."""
    raw = label.strip().lower()
    if any(kw in raw for kw in ("verse", "主歌")):
        return "Verse"
    if any(kw in raw for kw in ("chorus", "hook", "副歌", "refrain")):
        return "Chorus"
    if any(kw in raw for kw in ("pre-chorus", "prechorus")):
        return "Pre-Chorus"
    if any(kw in raw for kw in ("bridge", "桥段")):
        return "Bridge"
    if any(kw in raw for kw in ("intro", "前奏")):
        return "Intro"
    if any(kw in raw for kw in ("outro", "尾奏")):
        return "Outro"
    if any(kw in raw for kw in ("interlude", "间奏")):
        return "Interlude"
    if "drop" in raw:
        return "Drop"
    if "solo" in raw:
        return "Solo"
    return "Verse"


def _is_real_section_header(line: str) -> bool:
    """Return True if a `[...]` bracket line is a song section, not a scene marker."""
    m = re.match(r"^\s*\[([^\]]+)\]\s*$", line)
    if not m:
        return False
    inside = m.group(1).strip().lower()
    return any(kw in inside for kw in _REAL_SECTION_KEYWORDS)


def _split_lyrics_into_sections(
    lyrics: str,
    total_ms: int,
) -> List[Dict[str, Any]]:
    """Parse a lyric body into [{section_name, lines:[str, ...]}] groups.

    Bracketed lines that don't match a real section keyword (e.g. [Scene I],
    [Act II — the cleaving]) are dropped — they're visual metadata, not
    text the engine should sing or recite.

    If no section markers exist at all, we wrap the whole body as one Verse
    so composition_plan still gets a valid sections[] array.
    """
    raw_lines = [ln.rstrip() for ln in (lyrics or "").splitlines()]
    sections: List[Dict[str, Any]] = []
    current: Optional[Dict[str, Any]] = None
    for ln in raw_lines:
        bare = ln.strip()
        if not bare:
            # Blank line — keep it inside the current section as soft break.
            if current is not None and current["lines"]:
                current["lines"].append("")
            continue
        if bare.startswith("[") and bare.endswith("]"):
            if not _is_real_section_header(ln):
                continue  # scene/director metadata — drop
            label = _normalize_section_label(bare[1:-1])
            current = {"section_name": label, "lines": []}
            sections.append(current)
            continue
        if current is None:
            current = {"section_name": "Verse", "lines": []}
            sections.append(current)
        current["lines"].append(bare)
    # Drop blank-only sections.
    sections = [s for s in sections if any(line.strip() for line in s["lines"])]
    if not sections:
        sections = [{"section_name": "Verse", "lines": [
            ln.strip() for ln in raw_lines if ln.strip() and not (
                ln.strip().startswith("[") and ln.strip().endswith("]")
            )
        ]}]
    # Distribute total_ms across sections proportional to line count, with
    # a small floor so very short sections still get audible airtime.
    total_lines = sum(max(1, len(s["lines"])) for s in sections)
    floor_ms = 8_000  # min 8 s per section
    remaining_ms = max(total_ms, len(sections) * floor_ms)
    for s in sections:
        weight = max(1, len(s["lines"]))
        s["duration_ms"] = max(
            floor_ms,
            int(round(remaining_ms * (weight / total_lines))),
        )
    # Renormalise so durations sum to total_ms (within ±100 ms).
    actual = sum(s["duration_ms"] for s in sections)
    if actual > 0 and abs(actual - total_ms) > 100:
        scale = total_ms / actual
        for s in sections:
            s["duration_ms"] = max(floor_ms, int(round(s["duration_ms"] * scale)))
    return sections


_DRAMATIC_KEYWORDS = (
    "epic", "cinematic", "dramatic", "anthemic", "soaring", "powerful",
    "majestic", "transcendent", "explosive", "sweeping", "operatic",
    "震撼", "史诗", "宏大", "气势磅礴", "壮丽", "激昂", "澎湃", "波澜",
    "戏剧", "恢弘", "辉煌",
)
_INTIMATE_KEYWORDS = (
    "intimate", "quiet", "soft", "tender", "minimal", "ambient",
    "lullaby", "whispered", "lo-fi", "lofi",
    "宁静", "温柔", "细腻", "私语", "梦幻",
)
# CSSOS_PHASE2_MOOD_FROM_LYRICS 20260429 #197 — Jing
# "音乐风格很显然没有吃进去，因为这首歌词，音乐风格，不应该是欢快的节奏".
# When the lyrics carry oath / death / destiny / sacred / ruin / mourning
# imagery, the model should NOT pick a happy/upbeat tempo. Detect these
# semantic cues directly in the lyric body and inject explicit mood tags.
_SOMBER_KEYWORDS = (
    "oath", "vow", "sworn", "bound", "fallen", "death", "grave", "blood",
    "exile", "ruin", "ruined", "tomb", "ash", "ashes", "mourn", "grief",
    "grieve", "lament", "weep", "tear", "cold", "dark", "shadow", "wound",
    "broken", "scar", "burn", "sacred", "altar", "prayer", "destiny",
    "doom", "lost", "rise from", "kingdom of", "echo", "silent",
    # Chinese
    "誓", "亡", "死", "血", "破", "残", "废墟", "灰", "哀", "悲", "痛",
    "暗", "影", "伤", "破碎", "祭", "魂", "命运", "孤", "寂", "诀别",
    "送别", "归途", "迷失", "诺言", "永别",
)
_TRIUMPHANT_KEYWORDS = (
    "rise", "victory", "triumph", "celebrate", "joy", "dance", "love",
    "summer", "shine", "bright", "smile", "happy", "free",
    "胜", "庆", "欢", "笑", "爱", "光", "明", "自由", "希望",
)


def _detect_mood(text: str) -> str:
    """Return 'somber' | 'triumphant' | 'neutral' based on lyric content.

    Counts keyword hits on each side; majority wins. The sidecar uses the
    result to emit explicit tempo + mood tags to the composer.
    """
    if not text:
        return "neutral"
    lowered = text.lower()
    somber_hits = sum(1 for k in _SOMBER_KEYWORDS if k.lower() in lowered)
    triumph_hits = sum(1 for k in _TRIUMPHANT_KEYWORDS if k.lower() in lowered)
    if somber_hits > triumph_hits and somber_hits >= 2:
        return "somber"
    if triumph_hits > somber_hits and triumph_hits >= 2:
        return "triumphant"
    return "neutral"


def _has_keyword(text: str, keywords) -> bool:
    if not text:
        return False
    lowered = text.lower()
    return any(kw.lower() in lowered for kw in keywords)


def _split_into_tags(text: str) -> List[str]:
    """Split a free-form style description into atomic tags.

    ElevenLabs' composer reads `positive_global_styles` as a list of distinct
    style cues — one giant comma-joined string in a single entry is much
    weaker signal than the same content as N separate tags. So we split on
    commas / Chinese commas / semicolons / pipes and clean each piece.
    """
    if not text:
        return []
    raw = re.split(r"[,，；;|\n]+", text)
    seen = set()
    out = []
    for piece in raw:
        p = piece.strip(" .，。、")
        if not p:
            continue
        key = p.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
    return out


def _build_composition_plan(
    lyrics: str,
    style: str,
    duration_ms: int,
    language: Optional[str],
    make_instrumental: bool,
) -> Dict[str, Any]:
    """Build the composition_plan dict that the SDK's `compose` accepts.

    CSSOS_PHASE2_DRAMATIC_PLAN 20260429 #191 — Jing
    "配器很平淡，旋律很平和". Multi-tag positive_global_styles + per-section
    contrast directives + dramatic intensifiers when the style text asks
    for it. The ElevenLabs composer reacts much more strongly to a flat
    list of focused style cues than to one comma-joined kitchen-sink line.
    """
    style_text = (style or "").strip()

    # CSSOS_PHASE2_FORCE_SUNG_VOCAL 20260429 #193 — Jing
    # "英文歌词，只朗诵，不歌唱". ElevenLabs Music v1 sometimes drops into
    # spoken-word / narrator mode when the lyrics read like prose or when
    # global style hints contain words like "cinematic" or "operatic" that
    # the model has learned to associate with narration. The model weighs
    # the FIRST entries in positive_global_styles much more heavily than
    # later ones — so when not instrumental, we lead with explicit
    # "must be SUNG, not recited" directives before the user's style text.
    positive_global: List[str] = []
    if not make_instrumental:
        positive_global.extend([
            "fully sung pop song with melodic vocal performance",
            "every lyric line is sung melodically on pitch with a clear melody",
            "no spoken word, no rap, no narration, no recitation",
            "lead vocal carries a memorable singable hook melody",
            "verse → chorus pop song structure with sung chorus hooks",
        ])
    # Then the user's style text (split per-tag).
    positive_global.extend(_split_into_tags(style_text))

    # Language voice cue — vivid + region-specific so the model picks up
    # phonetics and timbre, not just "vocals".
    if language and language.lower().startswith("zh"):
        positive_global.extend([
            "Mandarin Chinese sung lead vocal",
            "modern Chinese pop production",
            "emotive sung lyrical phrasing",
        ])
    elif language and language.lower().startswith("ja"):
        positive_global.extend([
            "Japanese sung lead vocal",
            "J-pop production with bright top end",
            "sung lyrical melodic phrasing",
        ])
    elif language and language.lower().startswith("ko"):
        positive_global.extend([
            "Korean sung lead vocal",
            "modern K-pop production",
            "polished glossy mix",
        ])
    elif language and language.lower().startswith("en"):
        positive_global.extend([
            "English sung lead vocal in a modern pop ballad style",
            "belted melodic delivery with pitched notes",
        ])

    # Reinforce after language cue.
    if not make_instrumental:
        positive_global.extend([
            "professional studio mix with dynamic range",
            "double-tracked harmonized chorus vocals",
        ])
    else:
        positive_global.append("instrumental only, no vocals, no narration")

    # Auto-intensify when the user's style text or lyrics imply something
    # epic / dramatic. This pushes the composer away from "flat ballad" mode.
    combined_signal = " ".join([style_text, lyrics or ""])
    is_dramatic = _has_keyword(combined_signal, _DRAMATIC_KEYWORDS)
    is_intimate = _has_keyword(combined_signal, _INTIMATE_KEYWORDS)
    # CSSOS_PHASE2_MOOD_FROM_LYRICS 20260429 #197 — pull mood from lyric
    # body so a Mount-Hermon-Oath-style somber poem doesn't end up as a
    # bouncy upbeat tune just because the model defaulted that way.
    mood = _detect_mood(lyrics or "")
    if mood == "somber":
        # Front-load mood tags with high specificity. Tempo + key signal
        # tells the composer "this is NOT a bright pop song".
        positive_global.extend([
            "somber and reverent mood",
            "minor key, slow to mid tempo (60-90 BPM)",
            "dark cinematic emotional weight",
            "no upbeat pop rhythm",
            "elegiac harmonic palette",
        ])
        # Also push back hard against happy/bouncy default.
        # (negative_global is built next; we'll inject below.)
    elif mood == "triumphant":
        positive_global.extend([
            "triumphant uplifting mood",
            "bright major key, energetic mid-up tempo (110-140 BPM)",
            "celebratory anthemic feel",
        ])
    if is_dramatic and not is_intimate:
        # CSSOS_PHASE2_FORCE_SUNG_VOCAL 20260429 #193 — drop "cinematic" /
        # "operatic" / "epic" words from auto-injection. Those keywords
        # cue ElevenLabs into narrator/recitation mode for vocal songs.
        # Keep only the *production* intensifiers.
        positive_global.extend([
            "wide stereo arrangement with full band",
            "powerful belted chorus vocals",
            "rich harmonic stacks and double-tracked vocals",
            "deep sub bass with bass drum impacts",
            "dramatic dynamic swells with sung climax",
            "anthemic high-energy chorus",
        ])
    elif is_intimate:
        positive_global.extend([
            "intimate close-mic sung vocal",
            "minimal restrained arrangement supporting the sung melody",
            "natural warm room reverb",
        ])

    # CSSOS_PHASE2_FORCE_SUNG_VOCAL 20260429 #193 — comprehensive negatives
    # against any non-sung vocal mode. The model needs the "do NOT do X"
    # signal in multiple wordings because it has seen narrator/spoken cues
    # in many of its training examples.
    negative_global = [
        "spoken-word recitation",
        "spoken word performance",
        "narrator voice-over",
        "narration",
        "audiobook reading",
        "rap verse",
        "talking",
        "whispered dialogue",
        "monologue",
        "poetry reading",
        "ambient drone with no melody",
        "harsh distortion",
        "off-key vocals",
        "flat unchanging dynamic",
        "monotone delivery",
        "muddy mix",
        "thin arrangement with only one instrument",
        "background music that fades into nothing",
        "stock library cue",
    ]
    if not make_instrumental:
        negative_global.extend([
            "instrumental only with no vocals",
            "humming with no words",
            "wordless vocalisation",
            "vocal performance that does not follow a melody",
        ])
    # CSSOS_PHASE2_MOOD_FROM_LYRICS 20260429 #197 — push back against the
    # model's default happy/upbeat prior when lyrics are clearly somber.
    if mood == "somber":
        negative_global.extend([
            "happy upbeat pop song",
            "bright major key dance music",
            "fast tempo dance rhythm",
            "celebratory tone",
            "carnival drums",
            "tropical beats",
            "festival vibe",
        ])
    elif mood == "triumphant":
        negative_global.extend([
            "sad slow lament",
            "minor-key dirge",
        ])

    # Per-section directives. Verse=intimate, Chorus=huge, Bridge=contrast.
    if make_instrumental:
        section_count = max(2, min(6, duration_ms // 30_000))
        per_ms = duration_ms // section_count
        sections = [
            {
                "section_name": "Section " + str(i + 1),
                "positive_local_styles": [
                    "instrumental only",
                    "build energy across the section",
                ],
                "negative_local_styles": ["vocals", "lyrics", "spoken word"],
                "duration_ms": per_ms,
                "lines": [],
            }
            for i in range(section_count)
        ]
    else:
        raw_sections = _split_lyrics_into_sections(lyrics, duration_ms)
        sections = []
        for s in raw_sections:
            local_pos: List[str] = []
            local_neg: List[str] = []
            name = s["section_name"]
            if name in ("Chorus", "Hook"):
                local_pos.extend([
                    "sung anthemic chorus with lifted vocal energy",
                    "full instrumentation drop",
                    "double-tracked harmonized sung vocals",
                    "wide reverb tail",
                    "memorable sung singalong melody",
                ])
                if is_dramatic:
                    local_pos.append("explosive peak with full ensemble and belted sung vocals")
                local_neg.extend(["quiet whispered delivery", "spoken word", "narration"])
            elif name == "Pre-Chorus":
                local_pos.extend([
                    "rising tension and build-up under a sung melody",
                    "drum fill leading into the sung chorus",
                    "increasing sung vocal intensity",
                ])
                local_neg.extend(["spoken word", "rap"])
            elif name == "Bridge":
                local_pos.extend([
                    "key change or modulation under a sung lead",
                    "stripped-back arrangement that returns to full sung climax",
                    "unexpected harmonic shift, vocals stay sung",
                    "emotional sung climax",
                ])
                local_neg.extend(["spoken word", "narration", "monologue"])
            elif name == "Verse":
                # CSSOS_PHASE2_FORCE_SUNG_VOCAL 20260429 #193 — Verse is
                # the most narration-prone section. Be explicit about
                # singing every line with melodic contour.
                local_pos.extend([
                    "verse with a clearly sung melody on each line",
                    "intimate but still pitched and sung sung delivery",
                    "supporting instrumentation, not overwhelming the sung vocal",
                ])
                local_neg.extend([
                    "blasting full ensemble",
                    "spoken word delivery",
                    "narration of the lyrics",
                    "monotone reading",
                    "rap verse",
                ])
            elif name in ("Intro",):
                local_pos.extend([
                    "atmospheric instrumental motif",
                    "set the mood and key",
                ])
                local_neg.append("vocals on the very first beat")
            elif name in ("Outro",):
                local_pos.extend([
                    "satisfying resolution",
                    "instrumental fade or final hit",
                ])
            elif name == "Drop":
                local_pos.extend([
                    "explosive instrumental drop",
                    "synth lead or orchestra hit",
                ])
            elif name == "Solo":
                local_pos.extend([
                    "instrumental solo",
                    "expressive lead instrument",
                ])
                local_neg.append("vocals during solo")
            sections.append({
                "section_name": name,
                "positive_local_styles": local_pos,
                "negative_local_styles": local_neg,
                "duration_ms": s["duration_ms"],
                "lines": s["lines"],
            })

    return {
        "positive_global_styles": positive_global,
        "negative_global_styles": negative_global,
        "sections": sections,
    }


# ---------------------------------------------------------------- request/response models

class ComposeRequest(BaseModel):
    title: Optional[str] = None
    lyrics: Optional[str] = ""
    style: Optional[str] = ""
    duration_ms: int = Field(default=180_000, ge=10_000, le=600_000)
    language: Optional[str] = None
    make_instrumental: bool = False
    output_format: Optional[str] = "mp3_44100_192"


# ---------------------------------------------------------------- routes

@app.get("/healthz")
def healthz() -> Dict[str, Any]:
    """Lightweight readiness probe — does NOT call the upstream API."""
    sdk_present = False
    err: Optional[str] = None
    try:
        import elevenlabs as _el  # type: ignore
        sdk_present = True
        version = getattr(_el, "__version__", "unknown")
    except Exception as exc:  # pragma: no cover
        version = "missing"
        err = repr(exc)
    return {
        "ok": sdk_present,
        "sdk_version": version,
        "api_key_set": bool(
            os.environ.get("ELEVENLABS_API_KEY")
            or os.environ.get("ELEVEN_API_KEY")
        ),
        "error": err,
    }


def _stream_to_bytes(stream_or_bytes: Any) -> bytes:
    """The SDK may return raw bytes, a generator, or a streaming wrapper.
    Collapse all three into a single bytes blob the caller can hand back.
    """
    if isinstance(stream_or_bytes, (bytes, bytearray)):
        return bytes(stream_or_bytes)
    chunks: List[bytes] = []
    try:
        for chunk in stream_or_bytes:
            if isinstance(chunk, (bytes, bytearray)):
                chunks.append(bytes(chunk))
            else:
                chunks.append(str(chunk).encode("utf-8"))
    except TypeError:
        # Not iterable — last-resort coerce.
        return bytes(stream_or_bytes) if stream_or_bytes else b""
    return b"".join(chunks)


@app.post("/compose")
def compose(req: ComposeRequest) -> Response:
    """Generate a song via the official SDK's composition_plan path."""
    try:
        client = _get_sdk_client()
    except RuntimeError as exc:
        return JSONResponse(
            {"ok": False, "error": "sdk_unavailable", "detail": str(exc)},
            status_code=503,
        )

    plan = _build_composition_plan(
        lyrics=req.lyrics or "",
        style=req.style or "",
        duration_ms=req.duration_ms,
        language=req.language,
        make_instrumental=req.make_instrumental,
    )

    LOG.info(
        "compose start | duration_ms=%d sections=%d instrumental=%s",
        req.duration_ms,
        len(plan["sections"]),
        req.make_instrumental,
    )

    # SDK call. The introspected signature (elevenlabs 2.45) is:
    #   client.music.compose(*, output_format, prompt, composition_plan,
    #                        music_length_ms, model_id, seed,
    #                        force_instrumental, ...)
    # Returns Iterator[bytes]. We construct MusicPrompt explicitly so the
    # request fails fast with a clear error here rather than mid-network.
    try:
        from elevenlabs.types.music_prompt import MusicPrompt
        from elevenlabs.types.song_section import SongSection
        sections_obj = [
            SongSection(
                section_name=s["section_name"],
                positive_local_styles=s.get("positive_local_styles", []),
                negative_local_styles=s.get("negative_local_styles", []),
                duration_ms=s["duration_ms"],
                lines=s.get("lines", []),
            )
            for s in plan["sections"]
        ]
        plan_obj = MusicPrompt(
            positive_global_styles=plan.get("positive_global_styles", []),
            negative_global_styles=plan.get("negative_global_styles", []),
            sections=sections_obj,
        )
    except Exception as exc:
        LOG.exception("composition_plan model construction failed")
        return JSONResponse(
            {"ok": False, "error": "plan_build_failed", "detail": repr(exc)},
            status_code=500,
        )

    # NOTE: ElevenLabs rejects (composition_plan + music_length_ms) together
    # with a 422 — the duration is already encoded in `sections[].duration_ms`,
    # so passing music_length_ms is redundant from the API's perspective.
    # Keep our internal duration_ms only for logging/billing accounting.
    try:
        result = client.music.compose(
            composition_plan=plan_obj,
            output_format=req.output_format or "mp3_44100_192",
            model_id="music_v1",
            force_instrumental=req.make_instrumental,
        )
    except Exception as exc:
        LOG.exception("compose call failed")
        # Surface the underlying error message verbatim so callers can see
        # exactly what the API rejected. Most failures so far have been
        # quota exhaustion ("not enough character credits") or schema drift,
        # both of which the user fixes themselves once they can read it.
        detail = repr(exc)
        try:
            body = getattr(exc, "body", None)
            if body:
                detail = f"{detail} | body={body!r}"
        except Exception:
            pass
        return JSONResponse(
            {"ok": False, "error": "sdk_compose_failed", "detail": detail},
            status_code=502,
        )

    audio_bytes = _stream_to_bytes(result)
    if not audio_bytes:
        return JSONResponse(
            {"ok": False, "error": "empty_audio", "detail": "SDK returned 0 bytes"},
            status_code=502,
        )
    LOG.info("compose ok | bytes=%d", len(audio_bytes))
    media_type = (
        "audio/mpeg"
        if (req.output_format or "").startswith("mp3")
        else "application/octet-stream"
    )
    # CSSOS_PHASE2_ALIGNED_LYRICS_FROM_PLAN 20260429 #190 — Jing
    # "字幕引擎没有拿到带时间戳的歌词时间轴，所以无法渲染情绪字幕".
    # ElevenLabs Music doesn't ship per-line word timing in the response
    # the way Suno does. We synthesize a useful approximation from the
    # composition_plan: each section's lines split its duration_ms evenly,
    # carrying forward the cumulative offset as we walk through sections.
    # Better than nothing — and it matches what the user sees because the
    # plan is the same plan the model rendered against.
    aligned_lyrics = []
    cursor_ms = 0
    for sec in plan["sections"]:
        sec_ms = int(sec.get("duration_ms") or 0)
        sec_lines = [ln for ln in (sec.get("lines") or []) if isinstance(ln, str) and ln.strip()]
        if sec_ms <= 0 or not sec_lines:
            cursor_ms += max(0, sec_ms)
            continue
        per_line = max(1000, sec_ms // len(sec_lines))
        for ln in sec_lines:
            start = cursor_ms
            end = min(cursor_ms + per_line, cursor_ms + sec_ms)
            aligned_lyrics.append({
                "text": ln,
                "start_ms": start,
                "end_ms": end,
                "section": sec.get("section_name") or None,
            })
            cursor_ms = end
        # Snap cursor to end of section so any rounding drift doesn't
        # leak into the next section.
        cursor_ms = max(cursor_ms, sum(int(s.get("duration_ms") or 0) for s in plan["sections"][:plan["sections"].index(sec) + 1]))

    aligned_json = json.dumps(aligned_lyrics, ensure_ascii=False)
    return Response(
        content=audio_bytes,
        media_type=media_type,
        headers={
            "X-Eleven-Section-Count": str(len(plan["sections"])),
            "X-Eleven-Duration-Ms": str(req.duration_ms),
            # base64 to keep the JSON safe through HTTP header transit
            # (newlines + Chinese punctuation in headers are illegal).
            "X-Eleven-Aligned-Lyrics-B64": base64.b64encode(
                aligned_json.encode("utf-8")
            ).decode("ascii"),
        },
    )


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(
        "main:app",
        host=os.environ.get("ELEVEN_SIDECAR_HOST", "127.0.0.1"),
        port=int(os.environ.get("ELEVEN_SIDECAR_PORT", "8765")),
        log_level=os.environ.get("ELEVEN_SIDECAR_LOG_LEVEL", "info").lower(),
    )
