#!/usr/bin/env python3
import argparse
import csv
import json
from collections import Counter, defaultdict
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INTAKE_JSONL = REPO_ROOT / "data" / "manifests" / "music_dataset_intake.jsonl"
DEFAULT_LAYOUT_JSONL = REPO_ROOT / "data" / "manifests" / "suno_import_layout_report.jsonl"
DEFAULT_QUEUE_JSONL = REPO_ROOT / "data" / "manifests" / "suno_annotation_queue.jsonl"
DEFAULT_OUTPUT_JSON = REPO_ROOT / "data" / "manifests" / "suno_field_repair_plan.json"
DEFAULT_OUTPUT_CSV = REPO_ROOT / "data" / "manifests" / "suno_field_repair_plan.csv"

FIELD_ORDER = ["lyrics", "melody_midi", "stems", "vocal_timing", "chords", "sections"]
FIELD_BATCH_SIZE = {
    "lyrics": 200,
    "melody_midi": 100,
    "stems": 50,
    "vocal_timing": 150,
    "chords": 150,
    "sections": 200,
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


def normalize_key(record):
    return str(record.get("sample_id") or record.get("audio_path") or "").strip().lower()


def load_index(path: Path):
    rows = load_jsonl(path)
    return {normalize_key(row): row for row in rows if normalize_key(row)}


def source_platform_for(record, layout_row, queue_row):
    for candidate in (queue_row, layout_row, record):
        if candidate and candidate.get("source_platform"):
            return candidate.get("source_platform")
    audio_path = str(record.get("audio_path") or "").lower()
    if "suno" in audio_path:
        return "suno"
    return "unknown"


def build_sample(record, layout_row, queue_row):
    needs = record.get("needs_annotation") or {}
    missing_fields = [field for field in FIELD_ORDER if needs.get(field, False)]
    batch_name = "unassigned"
    audio_path = str(record.get("audio_path") or "")
    parts = Path(audio_path).parts
    if len(parts) >= 2:
        batch_name = parts[-2]

    return {
        "sample_id": record.get("sample_id"),
        "title": record.get("title"),
        "audio_path": audio_path,
        "batch_name": batch_name,
        "source_platform": source_platform_for(record, layout_row, queue_row),
        "missing_fields": missing_fields,
        "naming_issues": (layout_row or {}).get("naming_issues") or [],
        "layout_status": (layout_row or {}).get("status"),
        "queue_bucket": (queue_row or {}).get("bucket"),
        "priority_score": int((queue_row or {}).get("priority_score") or 0),
    }


def sort_samples(samples):
    return sorted(
        samples,
        key=lambda sample: (
            len(sample["naming_issues"]) > 0,
            -(sample["priority_score"]),
            sample["batch_name"],
            str(sample.get("title") or "").lower(),
        ),
    )


def chunk_samples(samples, batch_size):
    batches = []
    for start in range(0, len(samples), batch_size):
        chunk = samples[start:start + batch_size]
        batches.append(
            {
                "batch_index": len(batches) + 1,
                "batch_size": len(chunk),
                "sample_ids": [sample["sample_id"] for sample in chunk],
                "audio_paths": [sample["audio_path"] for sample in chunk],
                "titles": [sample["title"] for sample in chunk],
            }
        )
    return batches


def build_plan(intake_rows, layout_index, queue_index, source_filter):
    samples = []
    skipped = 0

    for row in intake_rows:
        key = normalize_key(row)
        layout_row = layout_index.get(key)
        queue_row = queue_index.get(key)
        source_platform = source_platform_for(row, layout_row, queue_row)
        if source_filter != "all" and source_platform != source_filter:
            skipped += 1
            continue
        samples.append(build_sample(row, layout_row, queue_row))

    field_to_samples = defaultdict(list)
    batch_to_samples = defaultdict(list)
    missing_field_counts = Counter()
    naming_issue_counts = Counter()

    for sample in samples:
        batch_to_samples[sample["batch_name"]].append(sample)
        for issue in sample["naming_issues"]:
            naming_issue_counts[issue] += 1
        for field in sample["missing_fields"]:
            field_to_samples[field].append(sample)
            missing_field_counts[field] += 1

    field_plans = []
    for field in FIELD_ORDER:
        field_samples = sort_samples(field_to_samples.get(field, []))
        field_plans.append(
            {
                "field": field,
                "sample_count": len(field_samples),
                "batch_size": FIELD_BATCH_SIZE[field],
                "batches": chunk_samples(field_samples, FIELD_BATCH_SIZE[field]),
            }
        )

    batch_summaries = []
    for batch_name, batch_samples in sorted(batch_to_samples.items()):
        counts = Counter()
        for sample in batch_samples:
            for field in sample["missing_fields"]:
                counts[field] += 1
        batch_summaries.append(
            {
                "batch_name": batch_name,
                "sample_count": len(batch_samples),
                "missing_field_counts": {field: counts.get(field, 0) for field in FIELD_ORDER if counts.get(field, 0) > 0},
                "samples_with_naming_issues": sum(1 for sample in batch_samples if sample["naming_issues"]),
            }
        )

    return {
        "schema": "css.suno_field_repair_plan.v1",
        "source_filter": source_filter,
        "records_seen": len(intake_rows),
        "records_planned": len(samples),
        "records_skipped": skipped,
        "missing_field_counts": dict(missing_field_counts),
        "naming_issue_counts": dict(naming_issue_counts),
        "field_plans": field_plans,
        "batch_summaries": batch_summaries,
    }


def write_csv(plan, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["field", "sample_count", "batch_size", "batch_count"],
        )
        writer.writeheader()
        for field_plan in plan.get("field_plans") or []:
            writer.writerow(
                {
                    "field": field_plan["field"],
                    "sample_count": field_plan["sample_count"],
                    "batch_size": field_plan["batch_size"],
                    "batch_count": len(field_plan["batches"]),
                }
            )


def main():
    parser = argparse.ArgumentParser(
        description="Build a field-repair execution plan for Suno bulk imports."
    )
    parser.add_argument("--intake-jsonl", default=str(DEFAULT_INTAKE_JSONL))
    parser.add_argument("--layout-jsonl", default=str(DEFAULT_LAYOUT_JSONL))
    parser.add_argument("--queue-jsonl", default=str(DEFAULT_QUEUE_JSONL))
    parser.add_argument("--output-json", default=str(DEFAULT_OUTPUT_JSON))
    parser.add_argument("--output-csv", default=str(DEFAULT_OUTPUT_CSV))
    parser.add_argument(
        "--source-filter",
        choices=["all", "suno", "unknown"],
        default="all",
        help="Restrict plan rows to a specific source platform.",
    )
    args = parser.parse_args()

    intake_jsonl = Path(args.intake_jsonl).expanduser().resolve()
    layout_jsonl = Path(args.layout_jsonl).expanduser().resolve()
    queue_jsonl = Path(args.queue_jsonl).expanduser().resolve()
    output_json = Path(args.output_json).expanduser().resolve()
    output_csv = Path(args.output_csv).expanduser().resolve()

    intake_rows = load_jsonl(intake_jsonl)
    layout_index = load_index(layout_jsonl)
    queue_index = load_index(queue_jsonl)
    plan = build_plan(intake_rows, layout_index, queue_index, args.source_filter)
    plan["inputs"] = {
        "intake_jsonl": str(intake_jsonl),
        "layout_jsonl": str(layout_jsonl),
        "queue_jsonl": str(queue_jsonl),
    }
    plan["outputs"] = {
        "output_json": str(output_json),
        "output_csv": str(output_csv),
    }

    output_json.parent.mkdir(parents=True, exist_ok=True)
    with output_json.open("w", encoding="utf-8") as handle:
        json.dump(plan, handle, ensure_ascii=False, indent=2)

    write_csv(plan, output_csv)

    print(
        json.dumps(
            {
                "schema": plan["schema"],
                "source_filter": plan["source_filter"],
                "records_planned": plan["records_planned"],
                "missing_field_counts": plan["missing_field_counts"],
                "output_json": str(output_json),
                "output_csv": str(output_csv),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
