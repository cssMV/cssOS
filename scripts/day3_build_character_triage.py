#!/usr/bin/env python3
import argparse
import csv
import math
import os
import random
import subprocess
from pathlib import Path


DEFAULT_INPUT_ROOT = "data/raw_char"
DEFAULT_OUTPUT_ROOT = "data/meta/day3_triage"
DEFAULT_CHARACTERS = ["char001", "char002", "char003"]
DEFAULT_SAMPLE_COUNT = 30
DEFAULT_SEED = 20260401
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
    parser = argparse.ArgumentParser(
        description="Build a Day 3 triage pack for raw character video pools."
    )
    parser.add_argument(
        "--input-root",
        default=DEFAULT_INPUT_ROOT,
        help="Root directory containing raw character pools.",
    )
    parser.add_argument(
        "--output-root",
        default=DEFAULT_OUTPUT_ROOT,
        help="Root directory where triage CSV and thumbnails will be written.",
    )
    parser.add_argument(
        "--characters",
        nargs="+",
        default=DEFAULT_CHARACTERS,
        help="Character ids to sample from.",
    )
    parser.add_argument(
        "--sample-count",
        type=int,
        default=DEFAULT_SAMPLE_COUNT,
        help="How many videos to sample per character.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=DEFAULT_SEED,
        help="Random seed for reproducible sampling.",
    )
    return parser.parse_args()


def find_media_files(root: Path) -> list[Path]:
    exts = {".mp4", ".mov", ".mkv", ".webm", ".avi", ".m4v"}
    files = [path for path in root.rglob("*") if path.is_file() and path.suffix.lower() in exts]
    return sorted(files)


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


def midpoint_seek(duration: float) -> str:
    if duration <= 0:
        return "1"
    return str(max(1, int(duration / 2)))


def write_thumbnail(video_path: Path, thumb_path: Path, duration: float) -> None:
    thumb_path.parent.mkdir(parents=True, exist_ok=True)
    seek = midpoint_seek(duration)
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
    cols = 5
    rows = math.ceil(len(image_paths) / cols)
    layout = []
    for index in range(len(image_paths)):
        col = index % cols
        row = index // cols
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


def build_rows_for_character(
    character_id: str,
    input_root: Path,
    output_root: Path,
    sample_count: int,
    rng: random.Random,
) -> list[dict[str, str]]:
    character_root = input_root / character_id
    files = find_media_files(character_root)
    if not files:
        raise FileNotFoundError(f"no media files found in {character_root}")

    picks = files if len(files) <= sample_count else rng.sample(files, sample_count)
    picks = sorted(picks)

    character_output = output_root / character_id
    thumbs_dir = character_output / "thumbs"
    thumbs_dir.mkdir(parents=True, exist_ok=True)

    rows: list[dict[str, str]] = []
    thumb_paths: list[Path] = []
    for index, video_path in enumerate(picks, start=1):
        duration = video_duration_sec(video_path)
        thumb_path = thumbs_dir / f"{index:03d}.jpg"
        write_thumbnail(video_path, thumb_path, duration)
        thumb_paths.append(thumb_path)
        rows.append(
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
    return rows


def main() -> None:
    args = parse_args()
    input_root = Path(args.input_root)
    output_root = Path(args.output_root)
    output_root.mkdir(parents=True, exist_ok=True)

    rng = random.Random(args.seed)
    all_rows: list[dict[str, str]] = []

    for character_id in args.characters:
        rows = build_rows_for_character(
            character_id=character_id,
            input_root=input_root,
            output_root=output_root,
            sample_count=args.sample_count,
            rng=rng,
        )
        all_rows.extend(rows)
        print(f"{character_id}: sampled={len(rows)}")

    csv_path = output_root / "day3_character_triage.csv"
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(all_rows)

    print(f"saved: {csv_path}")
    print(f"rows: {len(all_rows)}")
    print("status values: keep | drop | pending")


if __name__ == "__main__":
    main()
