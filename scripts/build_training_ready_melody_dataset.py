#!/usr/bin/env python3
import argparse
import json
from collections import Counter
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_JSONL = REPO_ROOT / "data" / "manifests" / "unified_melody_dataset.jsonl"
DEFAULT_OUTPUT_JSONL = REPO_ROOT / "data" / "manifests" / "training_ready_melody_dataset.jsonl"
DEFAULT_STATS_JSON = REPO_ROOT / "data" / "manifests" / "training_ready_melody_dataset.stats.json"
DEFAULT_QUALITY_JSONL = REPO_ROOT / "data" / "manifests" / "music_dataset_quality.jsonl"


def load_jsonl(path: Path):
    if not path.exists():
        return []

    rows = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            rows.append(json.loads(stripped))
    return rows


def load_quality_index(path: Path):
    rows = load_jsonl(path)
    return {
        str(row.get("sample_id") or "").strip(): row
        for row in rows
        if str(row.get("sample_id") or "").strip()
    }


def is_training_ready(record, quality_index=None):
    ready_flag = record.get("is_training_ready")
    sample_id = str(record.get("sample_id") or "").strip()
    quality_row = (quality_index or {}).get(sample_id) if sample_id else None
    if quality_row and str(quality_row.get("bucket") or "").strip().lower() == "reject":
        return False
    if ready_flag is not None:
        return bool(ready_flag)
    missing_fields = record.get("missing_fields") or []
    return len(missing_fields) == 0


def summarize(all_records, ready_records):
    missing_field_counts = Counter()
    by_source_all = Counter()
    by_source_ready = Counter()

    for record in all_records:
        by_source_all[str(record.get("source_kind") or "unknown")] += 1
        for field in record.get("missing_fields") or []:
            missing_field_counts[field] += 1

    for record in ready_records:
        by_source_ready[str(record.get("source_kind") or "unknown")] += 1

    return {
        "schema": "css.training_ready_melody_dataset.stats.v1",
        "records_seen": len(all_records),
        "training_ready_records": len(ready_records),
        "filtered_out_records": len(all_records) - len(ready_records),
        "by_source_all": dict(by_source_all),
        "by_source_training_ready": dict(by_source_ready),
        "top_missing_field_counts": dict(missing_field_counts),
    }


def main():
    parser = argparse.ArgumentParser(
        description="Filter unified melody dataset records down to fully training-ready samples."
    )
    parser.add_argument("--input-jsonl", default=str(DEFAULT_INPUT_JSONL))
    parser.add_argument("--output-jsonl", default=str(DEFAULT_OUTPUT_JSONL))
    parser.add_argument("--stats-json", default=str(DEFAULT_STATS_JSON))
    parser.add_argument("--quality-jsonl", default=str(DEFAULT_QUALITY_JSONL))
    args = parser.parse_args()

    input_jsonl = Path(args.input_jsonl).expanduser().resolve()
    output_jsonl = Path(args.output_jsonl).expanduser().resolve()
    stats_json = Path(args.stats_json).expanduser().resolve()
    quality_jsonl = Path(args.quality_jsonl).expanduser().resolve()

    all_records = load_jsonl(input_jsonl)
    quality_index = load_quality_index(quality_jsonl)
    ready_records = [record for record in all_records if is_training_ready(record, quality_index)]

    output_jsonl.parent.mkdir(parents=True, exist_ok=True)
    with output_jsonl.open("w", encoding="utf-8") as handle:
        for record in ready_records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    stats = summarize(all_records, ready_records)
    stats["inputs"] = {
        "input_jsonl": str(input_jsonl),
        "quality_jsonl": str(quality_jsonl),
    }
    stats["outputs"] = {
        "output_jsonl": str(output_jsonl),
        "stats_json": str(stats_json),
    }

    stats_json.parent.mkdir(parents=True, exist_ok=True)
    with stats_json.open("w", encoding="utf-8") as handle:
        json.dump(stats, handle, ensure_ascii=False, indent=2)

    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
