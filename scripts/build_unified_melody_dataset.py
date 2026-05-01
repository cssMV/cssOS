#!/usr/bin/env python3
import argparse
import csv
import json
from collections import Counter
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MELODY_MANIFEST = REPO_ROOT / "data" / "manifests" / "melody_training_manifest.jsonl"
DEFAULT_INTAKE_MANIFEST = REPO_ROOT / "data" / "manifests" / "music_dataset_intake.jsonl"
DEFAULT_OUTPUT_JSONL = REPO_ROOT / "data" / "manifests" / "unified_melody_dataset.jsonl"
DEFAULT_STATS_JSON = REPO_ROOT / "data" / "manifests" / "unified_melody_dataset.stats.json"
DEFAULT_STATS_CSV = REPO_ROOT / "data" / "manifests" / "unified_melody_dataset.stats.csv"


REQUIRED_FIELDS = [
    "title",
    "full_lyrics",
    "section_labels",
    "melody_midi",
    "chord_progression",
    "stem_tracks",
    "vocal_timing",
    "final_mix_references",
]


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


def has_value(value):
    if value is None:
        return False
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, (list, tuple, set, dict)):
        return len(value) > 0
    return True


def normalize_internal_record(record):
    source_artifacts = record.get("source_artifacts") or {}
    return {
        "schema": "css.unified_melody_dataset.v1",
        "sample_id": record.get("sample_id") or record.get("run_id"),
        "source_kind": "internal_run",
        "source_priority": 1,
        "title": record.get("title"),
        "language": record.get("language"),
        "work_type": record.get("work_type"),
        "duration_s": record.get("duration_s"),
        "full_lyrics": record.get("full_lyrics"),
        "section_labels": record.get("section_labels") or [],
        "sections": record.get("sections") or [],
        "melody_midi": record.get("melody_midi"),
        "melody_plan": record.get("melody_plan"),
        "phrase_map": record.get("phrase_map"),
        "chord_progression": record.get("chord_progression") or [],
        "stem_tracks": record.get("stem_tracks") or {},
        "vocal_timing": record.get("vocal_timing") or {},
        "final_mix_references": record.get("final_mix_references") or [],
        "prompt": record.get("prompt"),
        "provenance": {
            "run_id": record.get("run_id"),
            "source_artifacts": source_artifacts,
        },
    }


def normalize_intake_record(record):
    chord_progression = []
    if record.get("chord_progression_path"):
        chord_progression = [{"path": record.get("chord_progression_path")}]
    vocal_timing = {}
    if record.get("vocal_timing_path"):
        vocal_timing = {"path": record.get("vocal_timing_path")}
    stem_tracks = {
        "plan_path": None,
        "names": [],
        "files": record.get("stem_tracks") or [],
    }
    return {
        "schema": "css.unified_melody_dataset.v1",
        "sample_id": record.get("sample_id"),
        "source_kind": "external_music_intake",
        "source_priority": 2,
        "title": record.get("title"),
        "language": record.get("language"),
        "work_type": record.get("work_type"),
        "duration_s": record.get("duration_s"),
        "full_lyrics": record.get("full_lyrics"),
        "section_labels": record.get("section_labels") or [],
        "sections": [],
        "melody_midi": record.get("melody_midi"),
        "melody_plan": None,
        "phrase_map": None,
        "chord_progression": chord_progression,
        "stem_tracks": stem_tracks,
        "vocal_timing": vocal_timing,
        "final_mix_references": [record.get("final_mix_reference")] if has_value(record.get("final_mix_reference")) else [],
        "prompt": None,
        "provenance": {
            "audio_path": record.get("audio_path"),
            "lyrics_path": record.get("lyrics_path"),
            "intake_needs_annotation": record.get("needs_annotation") or {},
        },
    }


def compute_missing_fields(record):
    missing = []
    for field in REQUIRED_FIELDS:
        value = record.get(field)
        if field == "stem_tracks":
            stem_value = value or {}
            if not has_value(stem_value.get("names")) and not has_value(stem_value.get("files")) and not has_value(stem_value.get("plan_path")):
                missing.append(field)
            continue
        if field == "vocal_timing":
            timing_value = value or {}
            if not has_value(timing_value.get("lines")) and not has_value(timing_value.get("path")) and not has_value(timing_value.get("plan_path")):
                missing.append(field)
            continue
        if not has_value(value):
            missing.append(field)
    return missing


def summarize(records):
    totals = Counter()
    by_source = Counter()
    missing_field_counts = Counter()
    complete_records = 0

    for record in records:
        totals["records"] += 1
        by_source[str(record.get("source_kind") or "unknown")] += 1
        missing = record.get("missing_fields") or []
        if not missing:
            complete_records += 1
        for field in missing:
            missing_field_counts[field] += 1

    return {
        "schema": "css.unified_melody_dataset.stats.v1",
        "records": totals["records"],
        "complete_records": complete_records,
        "incomplete_records": totals["records"] - complete_records,
        "by_source": dict(by_source),
        "missing_field_counts": dict(missing_field_counts),
    }


def write_stats_csv(stats, csv_path: Path):
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=["field", "missing_count"],
        )
        writer.writeheader()
        for field, count in sorted((stats.get("missing_field_counts") or {}).items()):
            writer.writerow({"field": field, "missing_count": count})


def main():
    parser = argparse.ArgumentParser(
        description="Merge internal melody manifests with external music intake manifests."
    )
    parser.add_argument("--melody-manifest", default=str(DEFAULT_MELODY_MANIFEST))
    parser.add_argument("--intake-manifest", default=str(DEFAULT_INTAKE_MANIFEST))
    parser.add_argument("--output-jsonl", default=str(DEFAULT_OUTPUT_JSONL))
    parser.add_argument("--stats-json", default=str(DEFAULT_STATS_JSON))
    parser.add_argument("--stats-csv", default=str(DEFAULT_STATS_CSV))
    args = parser.parse_args()

    melody_manifest = Path(args.melody_manifest).expanduser().resolve()
    intake_manifest = Path(args.intake_manifest).expanduser().resolve()
    output_jsonl = Path(args.output_jsonl).expanduser().resolve()
    stats_json = Path(args.stats_json).expanduser().resolve()
    stats_csv = Path(args.stats_csv).expanduser().resolve()

    internal_records = [normalize_internal_record(row) for row in load_jsonl(melody_manifest)]
    intake_records = [normalize_intake_record(row) for row in load_jsonl(intake_manifest)]

    merged = internal_records + intake_records
    for record in merged:
        record["missing_fields"] = compute_missing_fields(record)
        record["is_training_ready"] = len(record["missing_fields"]) == 0

    output_jsonl.parent.mkdir(parents=True, exist_ok=True)
    with output_jsonl.open("w", encoding="utf-8") as handle:
        for record in merged:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    stats = summarize(merged)
    stats["inputs"] = {
        "melody_manifest": str(melody_manifest),
        "intake_manifest": str(intake_manifest),
    }
    stats["outputs"] = {
        "output_jsonl": str(output_jsonl),
        "stats_json": str(stats_json),
        "stats_csv": str(stats_csv),
    }

    stats_json.parent.mkdir(parents=True, exist_ok=True)
    with stats_json.open("w", encoding="utf-8") as handle:
        json.dump(stats, handle, ensure_ascii=False, indent=2)

    write_stats_csv(stats, stats_csv)

    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
