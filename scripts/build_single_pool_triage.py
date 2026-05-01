#!/usr/bin/env python3
import argparse
import csv
import subprocess
from pathlib import Path


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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a triage pack for a single replacement pool.")
    parser.add_argument("--input-dir", required=True)
    parser.add_argument("--target-shot", required=True)
    parser.add_argument("--output-root", required=True)
    return parser.parse_args()


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
    args = parse_args()
    input_dir = Path(args.input_dir)
    output_root = Path(args.output_root)
    target_root = output_root / args.target_shot
    thumbs_dir = target_root / "thumbs"
    target_root.mkdir(parents=True, exist_ok=True)
    thumbs_dir.mkdir(parents=True, exist_ok=True)

    files = sorted(path for path in input_dir.glob("*.mp4") if path.is_file())
    rows: list[dict[str, str]] = []
    thumb_paths: list[Path] = []

    for index, video_path in enumerate(files, start=1):
        duration = video_duration_sec(video_path)
        thumb_path = thumbs_dir / f"{index:03d}.jpg"
        write_thumbnail(video_path, thumb_path, duration)
        thumb_paths.append(thumb_path)
        rows.append(
            {
                "target_shot": args.target_shot,
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

    csv_path = output_root / f"{args.target_shot}_triage.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(rows)

    write_contact_sheet(thumb_paths, target_root / f"{args.target_shot}_contact_sheet.jpg")
    print(f"target={args.target_shot}")
    print(f"rows={len(rows)}")
    print(f"csv={csv_path}")


if __name__ == "__main__":
    main()
