#!/usr/bin/env python3
import argparse
import json
from collections import Counter
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_JSONL = REPO_ROOT / "data" / "manifests" / "music_dataset_quality.jsonl"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "data" / "manifests" / "quality_buckets"
DEFAULT_STATS_JSON = REPO_ROOT / "data" / "manifests" / "quality_buckets.stats.json"


def load_jsonl(path: Path):
    rows = []
    if not path.exists():
      return rows
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if stripped:
                rows.append(json.loads(stripped))
    return rows


def write_jsonl(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Split music quality rows into gold / silver / reject manifests.")
    parser.add_argument("--input-jsonl", default=str(DEFAULT_INPUT_JSONL))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--stats-json", default=str(DEFAULT_STATS_JSON))
    args = parser.parse_args()

    input_jsonl = Path(args.input_jsonl).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    stats_json = Path(args.stats_json).expanduser().resolve()
    rows = load_jsonl(input_jsonl)
    buckets = {"gold": [], "silver": [], "reject": []}
    for row in rows:
        bucket = str(row.get("bucket") or "reject").strip().lower()
        buckets[bucket if bucket in buckets else "reject"].append(row)

    for bucket, bucket_rows in buckets.items():
        write_jsonl(output_dir / f"music_dataset_quality.{bucket}.jsonl", bucket_rows)

    stats = {
        "schema": "css.music_dataset_quality_buckets.stats.v1",
        "input_jsonl": str(input_jsonl),
        "output_dir": str(output_dir),
        "bucket_counts": {key: len(value) for key, value in buckets.items()},
    }
    stats_json.parent.mkdir(parents=True, exist_ok=True)
    stats_json.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
