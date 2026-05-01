#!/usr/bin/env python3
import csv
import subprocess
from pathlib import Path


INPUT_MANIFEST = Path("data/clean_sets/char002_v1/manifest.csv")
OUTPUT_ROOT = Path("data/validation/char002_westworld_prelude_i_v1")
SELECT_COUNT = 12
CLIP_DURATION = 6
FRAME_FPS = 2
FRAME_SIZE = 512


def run_capture(command: list[str]) -> str:
    result = subprocess.run(
        command,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return result.stdout.strip()


def duration_seconds(path: Path) -> float:
    try:
        return float(
            run_capture(
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
        )
    except Exception:
        return 0.0


def select_rows(rows: list[dict[str, str]]) -> list[dict[str, str]]:
    day3 = [row for row in rows if row.get("source_batch") == "day3"]
    day4 = [row for row in rows if row.get("source_batch") == "day4"]

    picked: list[dict[str, str]] = []
    picked.extend(day3[: min(6, len(day3))])
    remaining = SELECT_COUNT - len(picked)
    picked.extend(day4[: max(0, remaining)])

    if len(picked) < SELECT_COUNT:
        seen = {row["clean_path"] for row in picked}
        for row in rows:
            if row["clean_path"] in seen:
                continue
            picked.append(row)
            if len(picked) >= SELECT_COUNT:
                break
    return picked[:SELECT_COUNT]


def build_clip(src: Path, dst: Path) -> tuple[float, float]:
    total = duration_seconds(src)
    if total <= 0:
        start = 0.0
    elif total <= CLIP_DURATION + 1:
        start = 0.0
    else:
        start = max(0.0, (total - CLIP_DURATION) / 2.0)

    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-ss",
            f"{start:.3f}",
            "-i",
            str(src),
            "-t",
            str(CLIP_DURATION),
            "-an",
            "-vf",
            "scale='min(720,iw)':-2",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(dst),
        ],
        check=True,
    )
    return total, start


def extract_frames(clip_path: Path, frame_dir: Path) -> int:
    frame_dir.mkdir(parents=True, exist_ok=True)
    for old in frame_dir.glob("*.png"):
        old.unlink()
    subprocess.run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(clip_path),
            "-vf",
            f"fps={FRAME_FPS},scale={FRAME_SIZE}:{FRAME_SIZE}:force_original_aspect_ratio=decrease,pad={FRAME_SIZE}:{FRAME_SIZE}:(ow-iw)/2:(oh-ih)/2:black",
            str(frame_dir / "frame_%03d.png"),
        ],
        check=True,
    )
    return sum(1 for _ in frame_dir.glob("frame_*.png"))


def main() -> None:
    if not INPUT_MANIFEST.is_file():
        raise FileNotFoundError(f"missing clean manifest: {INPUT_MANIFEST}")

    with INPUT_MANIFEST.open("r", encoding="utf-8", newline="") as handle:
        rows = list(csv.DictReader(handle))

    selected = select_rows(rows)
    clips_dir = OUTPUT_ROOT / "clips"
    frames_root = OUTPUT_ROOT / "frames"
    source_root = OUTPUT_ROOT / "source_links"
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    clips_dir.mkdir(parents=True, exist_ok=True)
    frames_root.mkdir(parents=True, exist_ok=True)
    source_root.mkdir(parents=True, exist_ok=True)

    manifest_rows = []
    for index, row in enumerate(selected, start=1):
        src = Path(row["clean_path"])
        if not src.is_file():
            continue

        source_link = source_root / f"{index:03d}__{src.name}"
        if not source_link.exists():
            source_link.hardlink_to(src)

        clip_path = clips_dir / f"{index:03d}.mp4"
        total_duration, start_offset = build_clip(src, clip_path)
        frame_dir = frames_root / f"{index:03d}"
        frame_count = extract_frames(clip_path, frame_dir)

        manifest_rows.append(
            {
                "character_id": "char002",
                "validation_index": f"{index:03d}",
                "source_batch": row.get("source_batch", ""),
                "source_name": row.get("source_name", ""),
                "source_clean_path": str(src),
                "source_link_path": str(source_link),
                "validation_clip_path": str(clip_path),
                "validation_frame_dir": str(frame_dir),
                "source_total_duration_sec": f"{total_duration:.2f}",
                "clip_start_sec": f"{start_offset:.2f}",
                "clip_duration_sec": str(CLIP_DURATION),
                "frame_count": str(frame_count),
            }
        )

    manifest_path = OUTPUT_ROOT / "manifest.csv"
    with manifest_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "character_id",
                "validation_index",
                "source_batch",
                "source_name",
                "source_clean_path",
                "source_link_path",
                "validation_clip_path",
                "validation_frame_dir",
                "source_total_duration_sec",
                "clip_start_sec",
                "clip_duration_sec",
                "frame_count",
            ],
        )
        writer.writeheader()
        writer.writerows(manifest_rows)

    summary_path = OUTPUT_ROOT / "README.txt"
    summary_path.write_text(
        "\n".join(
            [
                "char002 Westworld Prelude I validation set v1",
                f"selected_clips={len(manifest_rows)}",
                f"clip_duration_sec={CLIP_DURATION}",
                f"frame_fps={FRAME_FPS}",
                f"frame_size={FRAME_SIZE}",
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    print(f"saved: {OUTPUT_ROOT}")
    print(f"manifest: {manifest_path}")
    print(f"clips: {len(manifest_rows)}")


if __name__ == "__main__":
    main()
