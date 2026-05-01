#!/usr/bin/env python3
from __future__ import annotations

import json
import subprocess
from pathlib import Path


ASSEMBLE_JSON = Path("data/validation/char002_westworld_prelude_i_v1/storyboard_v1/video.assemble.json")
OUTPUT_ROOT = Path("data/validation/char002_westworld_prelude_i_probe_v3")
PUBLIC_ROOT = Path("/srv/cssos/current/public/probes/char002-westworld-prelude-i-probe-v3")
WIDTH = 720
HEIGHT = 406
FPS = 24
SHOT_DURATION = 6.0

REPLACEMENTS = {
    "video_shot_003": {
        "source": "data/raw_char/char002_replacements/morning ｜ cinematic video__[Byo-lcR6Bmw].mp4",
        "decision": "blue_side_profile",
        "why": "Cleaner side-profile mood for interior doubt.",
    },
    "video_shot_004": {
        "source": "data/raw_char/char002_replacements/Closeup Thoughtful Man Face Looking In Dark Hotel Room Portrait Of Rich Guy Adjusting 4k__[FRmSn2HOqVU].mp4",
        "decision": "dark_hotel_closeup",
        "why": "Best replacement for audit close-up and monitored tension.",
    },
    "video_shot_005": {
        "source": "data/raw_char/char002_replacements/man looks on a dark background__[qyrsdBtuDMM].mp4",
        "decision": "half_lit_dark_closeup",
        "why": "Stronger Westworld-like half-lit mask than the pop-styled original.",
    },
    "video_shot_007": {
        "source": "data/raw_char/char002_replacements/Prodigal Son： Someone Saw Me__[iMPWx1v7ioM].mp4",
        "decision": "black_stage_monologue",
        "why": "Abstract black-stage identity beat replaces wrong-person shot.",
    },
}


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def capture(command: list[str]) -> str:
    return subprocess.run(
        command,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    ).stdout.strip()


def duration_seconds(path: Path) -> float:
    raw = capture(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=nk=1:nw=1",
            str(path),
        ]
    )
    return float(raw)


def extract_start(path: Path, clip_duration: float) -> float:
    total = duration_seconds(path)
    if total <= clip_duration:
        return 0.0
    center = total / 2.0
    start = center - (clip_duration / 2.0)
    return max(0.0, min(start, total - clip_duration))


def normalize_clip(source: Path, output: Path, clip_duration: float, start_s: float | None = None) -> None:
    command = ["ffmpeg", "-y", "-loglevel", "error"]
    if start_s is not None:
        command.extend(["-ss", f"{start_s:.2f}"])
    command.extend(
        [
            "-i",
            str(source),
            "-t",
            f"{clip_duration:.2f}",
            "-vf",
            f"fps={FPS},scale={WIDTH}:{HEIGHT}:force_original_aspect_ratio=decrease,pad={WIDTH}:{HEIGHT}:(ow-iw)/2:(oh-ih)/2:black",
            "-an",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "medium",
            "-crf",
            "18",
            str(output),
        ]
    )
    run(command)


def main() -> None:
    if not ASSEMBLE_JSON.is_file():
        raise FileNotFoundError(f"missing assemble file: {ASSEMBLE_JSON}")

    data = json.loads(ASSEMBLE_JSON.read_text(encoding="utf-8"))
    shots = data.get("shots") or []
    segments = data.get("segments") or []
    if not shots:
        raise RuntimeError("assemble file has no shots")

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    PUBLIC_ROOT.mkdir(parents=True, exist_ok=True)
    normalized_dir = OUTPUT_ROOT / "normalized_shots"
    normalized_dir.mkdir(parents=True, exist_ok=True)
    concat_path = OUTPUT_ROOT / "concat.txt"
    out_mp4 = OUTPUT_ROOT / "probe_v3.mp4"
    poster_path = OUTPUT_ROOT / "poster.jpg"
    storyboard_txt = OUTPUT_ROOT / "probe.storyboard.txt"
    replacement_txt = OUTPUT_ROOT / "replacement_map.txt"
    public_html = PUBLIC_ROOT / "index.html"

    concat_lines: list[str] = []
    storyboard_lines: list[str] = []
    replacement_lines: list[str] = []

    segment_map = {segment["shot_id"]: segment for segment in segments}

    for shot in shots:
        shot_id = shot["id"]
        original_path = Path(shot["path"])
        segment = segment_map.get(shot_id, {})
        normalized = normalized_dir / f"{shot_id}.mp4"

        if shot_id in REPLACEMENTS:
            replacement = REPLACEMENTS[shot_id]
            replacement_source = Path(replacement["source"])
            if not replacement_source.is_file():
                raise FileNotFoundError(f"missing replacement source: {replacement_source}")
            start_s = extract_start(replacement_source, SHOT_DURATION)
            normalize_clip(replacement_source, normalized, SHOT_DURATION, start_s)
            storyboard_lines.append(
                f"{shot_id} | REPLACED | {segment.get('label','')} | {replacement['decision']} | {replacement_source}"
            )
            replacement_lines.append(
                f"{shot_id} <= {replacement['decision']} | {replacement_source} | start={start_s:.2f}s | {replacement['why']}"
            )
        else:
            if not original_path.is_file():
                raise FileNotFoundError(f"missing original shot video: {original_path}")
            normalize_clip(original_path, normalized, SHOT_DURATION, 0.0)
            storyboard_lines.append(
                f"{shot_id} | ORIGINAL | {segment.get('label','')} | {segment.get('subtitle_text','')} | {original_path}"
            )

        concat_lines.append(f"file '{normalized.resolve().as_posix()}'")

    concat_path.write_text("\n".join(concat_lines) + "\n", encoding="utf-8")
    storyboard_txt.write_text("\n".join(storyboard_lines) + "\n", encoding="utf-8")
    replacement_txt.write_text("\n".join(replacement_lines) + "\n", encoding="utf-8")

    run(
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
            str(concat_path),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            "-preset",
            "medium",
            "-crf",
            "18",
            str(out_mp4),
        ]
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(out_mp4),
            "-ss",
            "00:00:02",
            "-frames:v",
            "1",
            str(poster_path),
        ]
    )

    run(["cp", str(out_mp4), str(PUBLIC_ROOT / "video.mp4")])
    run(["cp", str(poster_path), str(PUBLIC_ROOT / "poster.jpg")])

    public_html.write_text(
        """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<title>char002 Westworld Prelude I Probe V3</title>
<style>body{margin:0;font-family:Georgia,serif;background:#06080d;color:#f5efe3}main{max-width:1100px;margin:0 auto;padding:32px 20px 60px}h1{font-size:32px;margin:0 0 16px}p{color:#c8c1b4;line-height:1.6}video{width:100%;border-radius:18px;background:#000;box-shadow:0 20px 50px rgba(0,0,0,.35)}pre{white-space:pre-wrap;background:rgba(255,255,255,.04);padding:16px;border-radius:14px;border:1px solid rgba(255,255,255,.08)}</style></head>
<body><main><h1>char002 · 西部世界歌剧MV·前奏曲 I · Probe V3</h1>
<p>Probe V3 keeps the strongest existing shots and swaps four weak positions with darker single-subject replacements from the Day 5 replacement pool.</p>
<video controls playsinline poster="/probes/char002-westworld-prelude-i-probe-v3/poster.jpg"><source src="/probes/char002-westworld-prelude-i-probe-v3/video.mp4" type="video/mp4" /></video>
<pre>Replaced shots: 003, 004, 005, 007</pre></main></body></html>
""",
        encoding="utf-8",
    )

    print(f"saved: {OUTPUT_ROOT}")
    print(f"video: {out_mp4}")
    print(f"public: https://cssstudio.app/probes/char002-westworld-prelude-i-probe-v3/")


if __name__ == "__main__":
    main()
