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
prompt = str(shot.get("prompt") or shot.get("label") or "cssMV shot").strip()
thumbnail_path = str(shot.get("thumbnail_path") or "").strip()

out_mp4.parent.mkdir(parents=True, exist_ok=True)

def tone_from_prompt(text: str) -> str:
    lowered = text.lower()
    if any(token in lowered for token in ("city", "neon", "street", "skyline", "cyber")):
        return "#18263a"
    if any(token in lowered for token in ("palace", "temple", "shrine", "court", "altar")):
        return "#324355"
    if any(token in lowered for token in ("sunset", "desert", "dust", "ember", "dawn")):
        return "#6f5544"
    if any(token in lowered for token in ("forest", "garden", "field", "flower", "ocean")):
        return "#284236"
    return "#243246"


def render_from_reference(reference: Path) -> bool:
    suffix = reference.suffix.lower()
    if suffix in {".jpg", ".jpeg", ".png", ".webp"}:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-loop",
                "1",
                "-i",
                str(reference),
                "-vf",
                "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720,zoompan=z='min(zoom+0.0008,1.08)':d=1:s=1280x720:fps=24",
                "-t",
                str(duration),
                "-pix_fmt",
                "yuv420p",
                str(out_mp4),
            ],
            check=True,
        )
        return True
    if suffix in {".mp4", ".mov", ".m4v"}:
        subprocess.run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-stream_loop",
                "-1",
                "-i",
                str(reference),
                "-vf",
                "scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720",
                "-t",
                str(duration),
                "-pix_fmt",
                "yuv420p",
                str(out_mp4),
            ],
            check=True,
        )
        return True
    return False


reference = Path(thumbnail_path).expanduser() if thumbnail_path else None
if reference and reference.exists() and render_from_reference(reference):
    raise SystemExit(0)

subprocess.run(
    [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-f",
        "lavfi",
        "-i",
        f"color=c={tone_from_prompt(prompt)}:s=1280x720:r=24",
        "-vf",
        "noise=alls=6:allf=t+u,eq=contrast=1.08:saturation=1.06:brightness=-0.02",
        "-t",
        str(duration),
        "-pix_fmt",
        "yuv420p",
        str(out_mp4),
    ],
    check=True,
)
