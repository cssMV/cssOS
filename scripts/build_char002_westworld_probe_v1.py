#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path


ASSEMBLE_JSON = Path("data/validation/char002_westworld_prelude_i_v1/storyboard_v1/video.assemble.json")
OUTPUT_ROOT = Path("data/validation/char002_westworld_prelude_i_probe_v1")


def run(command: list[str]) -> None:
    subprocess.run(command, check=True)


def main() -> None:
    if not ASSEMBLE_JSON.is_file():
        raise FileNotFoundError(f"missing assemble file: {ASSEMBLE_JSON}")

    data = json.loads(ASSEMBLE_JSON.read_text(encoding="utf-8"))
    shots = data.get("shots") or []
    segments = data.get("segments") or []
    if not shots:
        raise RuntimeError("assemble file has no shots")

    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    concat_path = OUTPUT_ROOT / "concat.txt"
    out_mp4 = OUTPUT_ROOT / "probe.mp4"
    poster_path = OUTPUT_ROOT / "poster.jpg"
    storyboard_txt = OUTPUT_ROOT / "probe.storyboard.txt"

    concat_lines = []
    storyboard_lines = []
    for shot, segment in zip(shots, segments):
        shot_path = Path(shot["path"])
        if not shot_path.is_file():
            raise FileNotFoundError(f"missing shot video: {shot_path}")
        concat_lines.append(f"file '{shot_path.resolve().as_posix()}'")
        storyboard_lines.append(
            f"{shot['id']} | {segment.get('label','')} | {segment.get('subtitle_text','')} | {shot_path.resolve()}"
        )

    concat_path.write_text("\n".join(concat_lines) + "\n", encoding="utf-8")
    storyboard_txt.write_text("\n".join(storyboard_lines) + "\n", encoding="utf-8")

    run(
        [
            "ffmpeg",
            "-y",
            "-f",
            "concat",
            "-safe",
            "0",
            "-i",
            str(concat_path),
            "-c",
            "copy",
            str(out_mp4),
        ]
    )
    run(
        [
            "ffmpeg",
            "-y",
            "-i",
            str(out_mp4),
            "-ss",
            "00:00:02",
            "-frames:v",
            "1",
            str(poster_path),
        ]
    )

    print(f"saved: {OUTPUT_ROOT}")
    print(f"video: {out_mp4}")
    print(f"poster: {poster_path}")
    print(f"shots: {len(shots)}")


if __name__ == "__main__":
    main()
