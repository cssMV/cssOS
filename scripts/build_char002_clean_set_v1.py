#!/usr/bin/env python3
import csv
import os
from pathlib import Path


DAY3_INPUT = Path("data/meta/day3_triage/keep_shortlist/day3_keep_shortlist.csv")
DAY4_INPUT = Path("data/meta/day4_triage/keep_shortlist/day4_keep_shortlist.csv")
OUTPUT_DIR = Path("data/clean_sets/char002_v1")
MANIFEST = OUTPUT_DIR / "manifest.csv"


def load_rows(path: Path) -> list[dict[str, str]]:
    if not path.is_file():
        return []
    with path.open("r", encoding="utf-8", newline="") as handle:
        return list(csv.DictReader(handle))


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    rows = []
    for source_name, path in [("day3", DAY3_INPUT), ("day4", DAY4_INPUT)]:
        for row in load_rows(path):
            if (row.get("character_id") or "").strip() != "char002":
                continue
            item = dict(row)
            item["source_batch"] = source_name
            rows.append(item)

    seen = set()
    manifest_rows = []
    for index, row in enumerate(sorted(rows, key=lambda item: (item["source_batch"], item.get("sample_index", ""), item.get("source_name", ""))), start=1):
        src = Path(row["video_path"])
        if not src.is_file():
            continue
        if str(src) in seen:
            continue
        seen.add(str(src))

        dst_name = f"{index:03d}__{src.name}"
        dst = OUTPUT_DIR / dst_name
        if not dst.exists():
            os.link(src, dst)

        manifest_rows.append(
            {
                "character_id": "char002",
                "clip_index": f"{index:03d}",
                "source_batch": row["source_batch"],
                "sample_index": row.get("sample_index", ""),
                "decision": row.get("decision", ""),
                "notes": row.get("notes", ""),
                "source_name": row.get("source_name", ""),
                "source_video_path": str(src),
                "clean_path": str(dst),
            }
        )

    with MANIFEST.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "character_id",
                "clip_index",
                "source_batch",
                "sample_index",
                "decision",
                "notes",
                "source_name",
                "source_video_path",
                "clean_path",
            ],
        )
        writer.writeheader()
        writer.writerows(manifest_rows)

    print(f"saved: {OUTPUT_DIR}")
    print(f"manifest: {MANIFEST}")
    print(f"clips: {len(manifest_rows)}")


if __name__ == "__main__":
    main()
