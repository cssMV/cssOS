#!/usr/bin/env python3
import csv
import shutil
import subprocess
from pathlib import Path


CSV_PATH = Path("data/meta/day5_replacement_triage/char002_replacement_triage.csv")
OUTPUT_ROOT = Path("data/meta/day5_replacement_triage/pending_shortlist")


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
    rows = list(csv.DictReader(CSV_PATH.open(encoding="utf-8")))
    pending = [row for row in rows if row["status"] == "pending"]
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    thumbs_dir = OUTPUT_ROOT / "thumbs"
    thumbs_dir.mkdir(parents=True, exist_ok=True)

    csv_out = OUTPUT_ROOT / "char002_replacement_pending_shortlist.csv"
    with csv_out.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(pending)

    txt_out = OUTPUT_ROOT / "char002_replacement_pending.txt"
    txt_out.write_text(
        "".join(f"{row['sample_index']} | {row['source_name']} | {row['video_path']}\n" for row in pending),
        encoding="utf-8",
    )

    thumb_paths: list[Path] = []
    for row in pending:
        src = Path(row["thumb_path"])
        dst = thumbs_dir / f"{row['sample_index']}.jpg"
        shutil.copy2(src, dst)
        thumb_paths.append(dst)

    write_contact_sheet(thumb_paths, OUTPUT_ROOT / "char002_replacement_pending_contact_sheet.jpg")

    print(f"pending={len(pending)}")
    print(f"csv={csv_out}")
    print(f"txt={txt_out}")


if __name__ == "__main__":
    main()
