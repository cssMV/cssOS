#!/usr/bin/env python3
import json
import os
import subprocess
from pathlib import Path

lang = os.environ["CSS_LANG"]
shot_id = os.environ["CSS_SHOT_ID"]
shot_json = Path(os.environ["CSS_SHOT_JSON"])
out_mp4 = Path(os.environ["CSS_OUT_MP4"])

_ = (lang, shot_id)
shot = json.loads(shot_json.read_text(encoding="utf-8"))
duration = max(float(shot.get("duration_s", 2.0)), 1.0)

out_mp4.parent.mkdir(parents=True, exist_ok=True)

subprocess.run(
    [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        "color=c=black:s=1280x720:r=24",
        "-t",
        str(duration),
        "-pix_fmt",
        "yuv420p",
        str(out_mp4),
    ],
    check=True,
)
