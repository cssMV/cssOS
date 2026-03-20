#!/usr/bin/env python3
import json
import os
from pathlib import Path

lang = os.environ["CSS_LANG"]
title_hint = os.environ.get("CSS_TITLE_HINT", "")
lyrics_json = Path(os.environ["CSS_LYRICS_JSON"])
mix_wav = Path(os.environ["CSS_MIX_WAV"])
out_json = Path(os.environ["CSS_OUT_JSON"])

_ = (lyrics_json, mix_wav)
plan = {
    "schema": "css.video.plan.v1",
    "lang": lang,
    "title": title_hint or "Untitled",
    "shots": [
        {
            "id": "video_shot_000",
            "prompt": f"{title_hint or 'Untitled'} opening scene",
            "duration_s": 2.0,
        }
    ],
}

out_json.parent.mkdir(parents=True, exist_ok=True)
out_json.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
