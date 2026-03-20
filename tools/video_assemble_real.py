#!/usr/bin/env python3
import os
import subprocess
from pathlib import Path

shots_txt = Path(os.environ["CSS_SHOTS_TXT"])
out_mp4 = Path(os.environ["CSS_OUT_MP4"])

out_mp4.parent.mkdir(parents=True, exist_ok=True)

cmd = [
    "ffmpeg",
    "-y",
    "-loglevel",
    "error",
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    str(shots_txt),
    "-c",
    "copy",
    str(out_mp4),
]

r = subprocess.run(cmd)
if r.returncode != 0:
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(shots_txt),
            "-c:v",
            "libx264",
            "-preset",
            "veryfast",
            "-crf",
            "18",
            "-pix_fmt",
            "yuv420p",
            str(out_mp4),
        ],
        check=True,
    )
