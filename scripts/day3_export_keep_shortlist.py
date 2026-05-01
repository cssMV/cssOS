#!/usr/bin/env python3
import csv
import subprocess
from collections import defaultdict
from pathlib import Path


INPUT = Path("data/meta/day3_triage/day3_character_triage.csv")
OUTPUT_DIR = Path("data/meta/day3_triage/keep_shortlist")
OUTPUT_CSV = OUTPUT_DIR / "day3_keep_shortlist.csv"


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
    if not INPUT.is_file():
        raise FileNotFoundError(f"missing triage file: {INPUT}")

    with INPUT.open("r", encoding="utf-8", newline="") as handle:
        rows = [row for row in csv.DictReader(handle) if (row.get("status") or "").strip().lower() == "keep"]

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    fieldnames = [
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
    with OUTPUT_CSV.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    grouped: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        grouped[(row.get("character_id") or "").strip()].append(row)

    print(f"saved: {OUTPUT_CSV}")
    print(f"rows: {len(rows)}")

    for character_id in sorted(grouped):
        items = sorted(grouped[character_id], key=lambda item: item.get("sample_index", ""))
        image_paths = [Path(item["thumb_path"]) for item in items if item.get("thumb_path")]
        sheet_path = OUTPUT_DIR / f"{character_id}_keep_contact_sheet.jpg"
        if image_paths:
            write_contact_sheet(image_paths, sheet_path)

        list_path = OUTPUT_DIR / f"{character_id}_keep.txt"
        with list_path.open("w", encoding="utf-8") as handle:
            for item in items:
                handle.write(f"{item['sample_index']}\t{item['source_name']}\t{item['video_path']}\n")

        print(
            character_id,
            f"keep={len(items)}",
            f"sheet={sheet_path}",
            f"list={list_path}",
        )


if __name__ == "__main__":
    main()
