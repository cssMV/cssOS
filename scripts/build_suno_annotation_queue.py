#!/usr/bin/env python3
import argparse
import csv
import json
from collections import Counter
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INTAKE_JSONL = REPO_ROOT / "data" / "manifests" / "music_dataset_intake.jsonl"
DEFAULT_OUTPUT_JSONL = REPO_ROOT / "data" / "manifests" / "suno_annotation_queue.jsonl"
DEFAULT_OUTPUT_CSV = REPO_ROOT / "data" / "manifests" / "suno_annotation_queue.csv"
DEFAULT_STATS_JSON = REPO_ROOT / "data" / "manifests" / "suno_annotation_queue.stats.json"

FIELD_PRIORITY = {
    "lyrics": 8,
    "sections": 5,
    "melody_midi": 10,
    "chords": 7,
    "vocal_timing": 8,
    "stems": 9,
}

BUCKET_ORDER = {
    "training_ready": 0,
    "near_ready": 1,
    "annotation_priority": 2,
    "foundation_missing": 3,
}


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


def infer_source_platform(record):
    audio_path = str(record.get("audio_path") or "").lower()
    sample_id = str(record.get("sample_id") or "").lower()
    if "suno" in audio_path or "suno" in sample_id:
        return "suno"
    return "unknown"


def missing_fields(record):
    needs = record.get("needs_annotation") or {}
    return [field for field, required in needs.items() if required]


def compute_priority_score(missing):
    score = 0
    for field in missing:
        score += FIELD_PRIORITY.get(field, 1)
    return score


def choose_bucket(missing):
    missing_set = set(missing)
    if not missing:
        return "training_ready"
    if missing_set <= {"chords", "vocal_timing"}:
        return "near_ready"
    if "melody_midi" not in missing_set and "stems" not in missing_set and "lyrics" not in missing_set:
        return "annotation_priority"
    return "foundation_missing"


def build_queue_rows(records, source_filter):
    queue_rows = []
    for record in records:
        source_platform = infer_source_platform(record)
        if source_filter != "all" and source_platform != source_filter:
            continue

        missing = missing_fields(record)
        bucket = choose_bucket(missing)
        row = {
            "schema": "css.music_annotation_queue.v1",
            "sample_id": record.get("sample_id"),
            "title": record.get("title"),
            "audio_path": record.get("audio_path"),
            "source_platform": source_platform,
            "bucket": bucket,
            "missing_fields": missing,
            "missing_count": len(missing),
            "priority_score": compute_priority_score(missing),
            "has_lyrics": not (record.get("needs_annotation") or {}).get("lyrics", False),
            "has_sections": not (record.get("needs_annotation") or {}).get("sections", False),
            "has_melody_midi": not (record.get("needs_annotation") or {}).get("melody_midi", False),
            "has_chords": not (record.get("needs_annotation") or {}).get("chords", False),
            "has_vocal_timing": not (record.get("needs_annotation") or {}).get("vocal_timing", False),
            "has_stems": not (record.get("needs_annotation") or {}).get("stems", False),
            "annotation_actions": [
                f"annotate_{field}" for field in missing
            ],
        }
        queue_rows.append(row)

    queue_rows.sort(
        key=lambda row: (
            BUCKET_ORDER.get(row["bucket"], 99),
            -row["priority_score"],
            row["missing_count"],
            str(row.get("title") or "").lower(),
        )
    )
    return queue_rows


def summarize(queue_rows, source_filter):
    by_bucket = Counter()
    missing_field_counts = Counter()
    by_source_platform = Counter()

    for row in queue_rows:
        by_bucket[row["bucket"]] += 1
        by_source_platform[row["source_platform"]] += 1
        for field in row["missing_fields"]:
            missing_field_counts[field] += 1

    return {
        "schema": "css.music_annotation_queue.stats.v1",
        "source_filter": source_filter,
        "records": len(queue_rows),
        "by_bucket": dict(by_bucket),
        "by_source_platform": dict(by_source_platform),
        "missing_field_counts": dict(missing_field_counts),
    }


def write_csv(queue_rows, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "sample_id",
                "title",
                "source_platform",
                "bucket",
                "priority_score",
                "missing_count",
                "missing_fields",
                "audio_path",
            ],
        )
        writer.writeheader()
        for row in queue_rows:
            writer.writerow(
                {
                    "sample_id": row["sample_id"],
                    "title": row["title"],
                    "source_platform": row["source_platform"],
                    "bucket": row["bucket"],
                    "priority_score": row["priority_score"],
                    "missing_count": row["missing_count"],
                    "missing_fields": ",".join(row["missing_fields"]),
                    "audio_path": row["audio_path"],
                }
            )


def main():
    parser = argparse.ArgumentParser(
        description="Build an annotation queue from the music dataset intake manifest."
    )
    parser.add_argument("--intake-jsonl", default=str(DEFAULT_INTAKE_JSONL))
    parser.add_argument("--output-jsonl", default=str(DEFAULT_OUTPUT_JSONL))
    parser.add_argument("--output-csv", default=str(DEFAULT_OUTPUT_CSV))
    parser.add_argument("--stats-json", default=str(DEFAULT_STATS_JSON))
    parser.add_argument(
        "--source-filter",
        choices=["all", "suno", "unknown"],
        default="all",
        help="Filter queue rows to a specific source platform.",
    )
    args = parser.parse_args()

    intake_jsonl = Path(args.intake_jsonl).expanduser().resolve()
    output_jsonl = Path(args.output_jsonl).expanduser().resolve()
    output_csv = Path(args.output_csv).expanduser().resolve()
    stats_json = Path(args.stats_json).expanduser().resolve()

    records = load_jsonl(intake_jsonl)
    queue_rows = build_queue_rows(records, args.source_filter)

    output_jsonl.parent.mkdir(parents=True, exist_ok=True)
    with output_jsonl.open("w", encoding="utf-8") as handle:
        for row in queue_rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    write_csv(queue_rows, output_csv)

    stats = summarize(queue_rows, args.source_filter)
    stats["inputs"] = {
        "intake_jsonl": str(intake_jsonl),
    }
    stats["outputs"] = {
        "output_jsonl": str(output_jsonl),
        "output_csv": str(output_csv),
        "stats_json": str(stats_json),
    }

    stats_json.parent.mkdir(parents=True, exist_ok=True)
    with stats_json.open("w", encoding="utf-8") as handle:
        json.dump(stats, handle, ensure_ascii=False, indent=2)

    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
