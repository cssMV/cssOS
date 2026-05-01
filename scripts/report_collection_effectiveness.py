#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
from collections import Counter
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Report raw/used/ratio for a triaged collection batch.")
    parser.add_argument("--label", required=True)
    parser.add_argument("--triage-csv", required=True)
    parser.add_argument("--raw-dirs", nargs="+", required=True)
    parser.add_argument("--output-json", required=True)
    parser.add_argument("--output-csv", required=True)
    return parser.parse_args()


def count_raw_files(paths: list[Path]) -> int:
    total = 0
    for path in paths:
        if not path.exists():
            continue
        total += sum(1 for p in path.iterdir() if p.is_file() and p.suffix.lower() == ".mp4")
    return total


def main() -> None:
    args = parse_args()
    triage_path = Path(args.triage_csv)
    rows = list(csv.DictReader(triage_path.open(encoding="utf-8")))
    status_counts = Counter(row.get("status", "unknown") for row in rows)
    historical_raw = len(rows)
    current_raw_retained = count_raw_files([Path(p) for p in args.raw_dirs])
    used_keep = status_counts.get("keep", 0)
    used_pending = status_counts.get("pending", 0)
    used_ratio = (used_keep / historical_raw) if historical_raw else 0.0

    payload = {
        "label": args.label,
        "historical_raw_downloaded": historical_raw,
        "current_raw_retained": current_raw_retained,
        "used_keep": used_keep,
        "pending": used_pending,
        "drop": status_counts.get("drop", 0),
        "used_ratio_vs_downloaded": round(used_ratio, 4),
        "used_ratio_percent": round(used_ratio * 100.0, 1),
    }

    out_json = Path(args.output_json)
    out_json.parent.mkdir(parents=True, exist_ok=True)
    out_json.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    out_csv = Path(args.output_csv)
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    with out_csv.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=list(payload.keys()))
        writer.writeheader()
        writer.writerow(payload)

    print(json.dumps(payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
