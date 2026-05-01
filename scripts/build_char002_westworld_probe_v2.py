#!/usr/bin/env python3
import json
import subprocess
from pathlib import Path


ASSEMBLE_JSON = Path("data/validation/char002_westworld_prelude_i_v1/storyboard_v1/video.assemble.json")
OUTPUT_ROOT = Path("data/validation/char002_westworld_prelude_i_probe_v2")
WIDTH = 720
HEIGHT = 406
FPS = 24


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
    out_mp4 = OUTPUT_ROOT / "probe_v2.mp4"
    poster_path = OUTPUT_ROOT / "poster.jpg"
    storyboard_txt = OUTPUT_ROOT / "probe.storyboard.txt"
    normalized_dir = OUTPUT_ROOT / "normalized_shots"
    normalized_dir.mkdir(parents=True, exist_ok=True)

    concat_lines = []
    storyboard_lines = []
    for shot, segment in zip(shots, segments):
        shot_path = Path(shot["path"])
        if not shot_path.is_file():
            raise FileNotFoundError(f"missing shot video: {shot_path}")

        normalized = normalized_dir / f"{shot['id']}.mp4"
        run(
            [
                "ffmpeg",
                "-y",
                "-loglevel",
                "error",
                "-i",
                str(shot_path),
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
                str(normalized),
            ]
        )

        concat_lines.append(f"file '{normalized.resolve().as_posix()}'")
        storyboard_lines.append(
            f"{shot['id']} | {segment.get('label','')} | {segment.get('subtitle_text','')} | {shot_path.resolve()}"
        )

    concat_path.write_text("\n".join(concat_lines) + "\n", encoding="utf-8")
    storyboard_txt.write_text("\n".join(storyboard_lines) + "\n", encoding="utf-8")

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

    print(f"saved: {OUTPUT_ROOT}")
    print(f"video: {out_mp4}")
    print(f"poster: {poster_path}")
    print(f"shots: {len(shots)}")


if __name__ == "__main__":
    main()
