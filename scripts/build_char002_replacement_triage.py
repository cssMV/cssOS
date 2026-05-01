#!/usr/bin/env python3
import csv
import subprocess
from pathlib import Path


INPUT_DIR = Path("data/raw_char/char002_replacements")
OUTPUT_ROOT = Path("data/meta/day5_replacement_triage")
CSV_FIELDS = [
    "character_id",
    "sample_index",
    "status",
    "decision",
    "notes",
    "video_path",
    "thumb_path",
    "duration_sec",
    "source_name",
]


def run_capture(command: list[str]) -> str:
    result = subprocess.run(
        command,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip()


def video_duration_sec(path: Path) -> float:
    try:
        raw = run_capture(
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
    except Exception:
        return 0.0


def write_thumbnail(video_path: Path, thumb_path: Path, duration: float) -> None:
    thumb_path.parent.mkdir(parents=True, exist_ok=True)
    seek = str(max(1, int(duration / 2))) if duration > 0 else "1"
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-ss",
            seek,
            "-i",
            str(video_path),
            "-frames:v",
            "1",
            "-vf",
            "scale=320:240:force_original_aspect_ratio=decrease,pad=320:240:(ow-iw)/2:(oh-ih)/2:black",
            str(thumb_path),
        ],
        check=True,
    )


def write_contact_sheet(image_paths: list[Path], output_path: Path) -> None:
    if not image_paths:
        return
    layout = []
    for index in range(len(image_paths)):
        col = index % 5
        row = index // 5
        layout.append(f"{col * 320}_{row * 240}")
    command = ["ffmpeg", "-y", "-loglevel", "error"]
    for image_path in image_paths:
        command.extend(["-i", str(image_path)])
    command.extend(
        [
            "-filter_complex",
            f"xstack=inputs={len(image_paths)}:layout={'|'.join(layout)}",
            str(output_path),
        ]
    )
    subprocess.run(command, check=True)


def main() -> None:
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    thumbs_dir = OUTPUT_ROOT / "thumbs"
    thumbs_dir.mkdir(parents=True, exist_ok=True)

    files = sorted(path for path in INPUT_DIR.glob("*.mp4") if path.is_file())
    rows: list[dict[str, str]] = []
    thumb_paths: list[Path] = []

    for index, video_path in enumerate(files, start=1):
        duration = video_duration_sec(video_path)
        thumb_path = thumbs_dir / f"{index:03d}.jpg"
        write_thumbnail(video_path, thumb_path, duration)
        thumb_paths.append(thumb_path)
        rows.append(
            {
                "character_id": "char002_replacements",
                "sample_index": f"{index:03d}",
                "status": "pending",
                "decision": "",
                "notes": "",
                "video_path": str(video_path),
                "thumb_path": str(thumb_path),
                "duration_sec": f"{duration:.2f}",
                "source_name": video_path.name,
            }
        )

    csv_path = OUTPUT_ROOT / "char002_replacement_triage.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    write_contact_sheet(thumb_paths, OUTPUT_ROOT / "char002_replacement_contact_sheet.jpg")

    print(f"saved: {csv_path}")
    print(f"rows: {len(rows)}")


if __name__ == "__main__":
    main()
