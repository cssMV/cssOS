#!/usr/bin/env python3
import csv
import subprocess
from pathlib import Path


POOLS = [
    ("shot002", Path("data/raw_char/char002_shot002_replacements")),
    ("shot008", Path("data/raw_char/char002_shot008_replacements")),
]
OUTPUT_ROOT = Path("data/meta/day6_targeted_triage")
CSV_FIELDS = [
    "target_shot",
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
    all_rows: list[dict[str, str]] = []

    for target_shot, input_dir in POOLS:
        files = sorted(path for path in input_dir.glob("*.mp4") if path.is_file())
        target_root = OUTPUT_ROOT / target_shot
        thumbs_dir = target_root / "thumbs"
        thumbs_dir.mkdir(parents=True, exist_ok=True)
        thumb_paths: list[Path] = []

        for index, video_path in enumerate(files, start=1):
            duration = video_duration_sec(video_path)
            thumb_path = thumbs_dir / f"{index:03d}.jpg"
            write_thumbnail(video_path, thumb_path, duration)
            thumb_paths.append(thumb_path)
            all_rows.append(
                {
                    "target_shot": target_shot,
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

        write_contact_sheet(thumb_paths, target_root / f"{target_shot}_contact_sheet.jpg")
        print(f"{target_shot}: rows={len(files)}")

    csv_path = OUTPUT_ROOT / "day6_targeted_triage.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"saved: {csv_path}")
    print(f"rows: {len(all_rows)}")


if __name__ == "__main__":
    main()
