#!/usr/bin/env python3
import json
import os
from pathlib import Path

lang = os.environ["CSS_LANG"]
title_hint = os.environ.get("CSS_TITLE_HINT", "")
lyrics_json = Path(os.environ["CSS_LYRICS_JSON"])
mix_wav = Path(os.environ["CSS_MIX_WAV"])
out_json = Path(os.environ["CSS_OUT_JSON"])
segment_timeline_json = os.environ.get("CSS_SEGMENT_TIMELINE_JSON")

_ = (lyrics_json, mix_wav)
segments = []
shots = []

if segment_timeline_json and Path(segment_timeline_json).exists():
    raw_segments = json.loads(Path(segment_timeline_json).read_text(encoding="utf-8"))
    for index, segment in enumerate(raw_segments):
        shot_id = f"video_shot_{index:03d}"
        shot_prompt = (
            segment.get("prompt")
            or segment.get("shot_prompt")
            or segment.get("shotPrompt")
            or segment.get("subtitleText")
            or segment.get("label")
            or "cssMV timeline shot"
        )
        duration_s = float(segment.get("durationSec") or 2.0)
        shots.append(
            {
                "id": shot_id,
                "prompt": shot_prompt,
                "duration_s": duration_s,
                "thumbnail_path": segment.get("thumbnailPath") or segment.get("thumbnail_path"),
            }
        )
        segments.append(
            {
                "scene_id": segment.get("sceneId") or f"scene_{index + 1:03d}",
                "shot_id": shot_id,
                "label": segment.get("label") or f"Segment {index + 1}",
                "start_s": float(segment.get("startSec") or 0.0),
                "end_s": float(segment.get("endSec") or duration_s),
                "duration_s": duration_s,
                "transition_to_next": segment.get("transitionToNext"),
                "subtitle_text": segment.get("subtitleText"),
                "thumbnail_path": segment.get("thumbnailPath"),
                "prompt": shot_prompt,
            }
        )

if not shots:
    shots = [
        {
            "id": "video_shot_000",
            "prompt": f"{title_hint or 'Untitled'} opening scene",
            "duration_s": 2.0,
        }
    ]

plan = {
    "schema": "css.video.plan.v1",
    "lang": lang,
    "title": title_hint or "Untitled",
    "shots": shots,
    "segments": segments,
}

out_json.parent.mkdir(parents=True, exist_ok=True)
out_json.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
