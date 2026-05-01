#!/usr/bin/env python3
import argparse
import csv
import subprocess
from pathlib import Path


DEFAULT_INPUT_ROOT = "data/raw_char"
DEFAULT_OUTPUT_ROOT = "data/meta/day4_triage"
DEFAULT_CHARACTERS = ["char002", "char003"]
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build triage pack for recent Day 4 recollect files.")
    parser.add_argument("--input-root", default=DEFAULT_INPUT_ROOT)
    parser.add_argument("--output-root", default=DEFAULT_OUTPUT_ROOT)
    parser.add_argument("--characters", nargs="+", default=DEFAULT_CHARACTERS)
    parser.add_argument("--since-epoch", type=float, required=True, help="Only include files with mtime >= this epoch.")
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
    input_root = Path(args.input_root)
    output_root = Path(args.output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    all_rows: list[dict[str, str]] = []
    for character_id in args.characters:
        files = sorted(
            [
                path
                for path in (input_root / character_id).glob("*.mp4")
                if path.is_file() and path.stat().st_mtime >= args.since_epoch
            ],
            key=lambda path: path.stat().st_mtime,
        )
        character_output = output_root / character_id
        thumbs_dir = character_output / "thumbs"
        thumbs_dir.mkdir(parents=True, exist_ok=True)
        thumb_paths: list[Path] = []

        for index, video_path in enumerate(files, start=1):
            duration = video_duration_sec(video_path)
            thumb_path = thumbs_dir / f"{index:03d}.jpg"
            write_thumbnail(video_path, thumb_path, duration)
            thumb_paths.append(thumb_path)
            all_rows.append(
                {
                    "character_id": character_id,
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

        write_contact_sheet(thumb_paths, character_output / f"{character_id}_contact_sheet.jpg")
        print(f"{character_id}: sampled={len(files)}")

    csv_path = output_root / "day4_recent_triage.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"saved: {csv_path}")
    print(f"rows: {len(all_rows)}")


if __name__ == "__main__":
    main()
