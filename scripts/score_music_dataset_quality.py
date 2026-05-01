#!/usr/bin/env python3
import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT_JSONL = REPO_ROOT / "data" / "manifests" / "music_dataset_intake.jsonl"
DEFAULT_OUTPUT_JSONL = REPO_ROOT / "data" / "manifests" / "music_dataset_quality.jsonl"
DEFAULT_OUTPUT_CSV = REPO_ROOT / "data" / "manifests" / "music_dataset_quality.csv"
DEFAULT_STATS_JSON = REPO_ROOT / "data" / "manifests" / "music_dataset_quality.stats.json"
DEFAULT_RULES_JSON = REPO_ROOT / "config" / "music_noise_filter_rules.json"


def load_jsonl(path: Path):
    if not path.exists():
      return []
    rows = []
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if stripped:
                rows.append(json.loads(stripped))
    return rows


def load_json(path: Path):
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def safe_text(value):
    return str(value or "").strip()


def normalize_text(value):
    text = safe_text(value).lower()
    text = re.sub(r"\s+", " ", text)
    return text


def infer_sidecar_metadata(record):
    metadata_path = safe_text(record.get("metadata_path"))
    if metadata_path and Path(metadata_path).exists():
        try:
            return load_json(Path(metadata_path))
        except Exception:
            return {}
    return {}


def collect_text_fields(record, metadata):
    prompt = safe_text((metadata.get("metadata") or {}).get("prompt"))
    tags = safe_text((metadata.get("metadata") or {}).get("tags"))
    title = safe_text(record.get("title") or metadata.get("title"))
    lyrics = safe_text(record.get("full_lyrics"))
    basename = safe_text(record.get("sample_id"))
    return {
        "title": title,
        "tags": tags,
        "prompt": prompt,
        "lyrics": lyrics,
        "sample_id": basename,
        "blob": normalize_text("\n".join([title, tags, prompt, lyrics, basename])),
    }


def count_matches(blob, patterns):
    matches = []
    for pattern in patterns:
        needle = normalize_text(pattern)
        if needle and needle in blob:
            matches.append(pattern)
    return matches


def compute_quality(record, metadata, rules):
    fields = collect_text_fields(record, metadata)
    blob = fields["blob"]
    hard_matches = count_matches(blob, rules.get("hard_reject_patterns") or [])
    soft_matches = count_matches(blob, rules.get("soft_penalty_patterns") or [])
    score = 100
    score -= len(hard_matches) * 40
    score -= len(soft_matches) * 12

    if not safe_text(record.get("melody_midi")):
        score -= 14
    if not safe_text(record.get("full_lyrics")):
        score -= 16
    if not (record.get("stem_tracks") or []):
        score -= 8
    if not safe_text(record.get("vocal_timing_path")):
        score -= 8
    if not safe_text(record.get("chord_progression_path")):
        score -= 4

    has_signal_tags = bool(fields["tags"] or fields["prompt"])
    if not has_signal_tags:
        score -= 6

    status = safe_text(metadata.get("status") or "unknown").lower()
    if status not in {"complete", "streaming"}:
        score -= 10

    score = max(0, min(100, score))
    if hard_matches:
        bucket = "reject"
    elif score >= 82:
        bucket = "gold"
    elif score >= 58:
        bucket = "silver"
    else:
        bucket = "reject"
    return {
        "score": score,
        "bucket": bucket,
        "hard_noise_matches": hard_matches,
        "soft_noise_matches": soft_matches,
        "status": status,
    }


def summarize(rows):
    bucket_counts = Counter()
    source_counts = Counter()
    hard_noise_counts = Counter()
    soft_noise_counts = Counter()
    for row in rows:
        bucket_counts[safe_text(row.get("bucket")) or "unknown"] += 1
        source_counts[safe_text(row.get("source_platform")) or "unknown"] += 1
        for item in row.get("hard_noise_matches") or []:
            hard_noise_counts[item] += 1
        for item in row.get("soft_noise_matches") or []:
            soft_noise_counts[item] += 1
    return {
        "schema": "css.music_dataset_quality.stats.v1",
        "records": len(rows),
        "bucket_counts": dict(bucket_counts),
        "source_platform_counts": dict(source_counts),
        "top_hard_noise_matches": dict(hard_noise_counts.most_common(20)),
        "top_soft_noise_matches": dict(soft_noise_counts.most_common(20)),
    }


def write_csv(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "sample_id",
                "title",
                "source_platform",
                "bucket",
                "score",
                "hard_noise_matches",
                "soft_noise_matches",
                "audio_path",
                "audio_gcs_uri",
            ],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "sample_id": row.get("sample_id"),
                    "title": row.get("title"),
                    "source_platform": row.get("source_platform"),
                    "bucket": row.get("bucket"),
                    "score": row.get("score"),
                    "hard_noise_matches": ",".join(row.get("hard_noise_matches") or []),
                    "soft_noise_matches": ",".join(row.get("soft_noise_matches") or []),
                    "audio_path": row.get("audio_path"),
                    "audio_gcs_uri": row.get("audio_gcs_uri"),
                }
            )


def main():
    parser = argparse.ArgumentParser(description="Score music-intake records into gold / silver / reject buckets before training.")
    parser.add_argument("--input-jsonl", default=str(DEFAULT_INPUT_JSONL))
    parser.add_argument("--output-jsonl", default=str(DEFAULT_OUTPUT_JSONL))
    parser.add_argument("--output-csv", default=str(DEFAULT_OUTPUT_CSV))
    parser.add_argument("--stats-json", default=str(DEFAULT_STATS_JSON))
    parser.add_argument("--rules-json", default=str(DEFAULT_RULES_JSON))
    args = parser.parse_args()

    input_jsonl = Path(args.input_jsonl).expanduser().resolve()
    output_jsonl = Path(args.output_jsonl).expanduser().resolve()
    output_csv = Path(args.output_csv).expanduser().resolve()
    stats_json = Path(args.stats_json).expanduser().resolve()
    rules_json = Path(args.rules_json).expanduser().resolve()

    records = load_jsonl(input_jsonl)
    rules = load_json(rules_json)
    scored_rows = []
    for record in records:
        metadata = infer_sidecar_metadata(record)
        quality = compute_quality(record, metadata, rules)
        scored_rows.append(
            {
                "schema": "css.music_dataset_quality.v1",
                "sample_id": safe_text(record.get("sample_id")),
                "title": safe_text(record.get("title")),
                "source_platform": safe_text(record.get("source_platform") or "unknown"),
                "audio_path": safe_text(record.get("audio_path")),
                "audio_gcs_uri": safe_text(record.get("audio_gcs_uri")),
                "metadata_path": safe_text(record.get("metadata_path")),
                "bucket": quality["bucket"],
                "score": quality["score"],
                "hard_noise_matches": quality["hard_noise_matches"],
                "soft_noise_matches": quality["soft_noise_matches"],
                "quality_status": quality["status"],
            }
        )

    output_jsonl.parent.mkdir(parents=True, exist_ok=True)
    with output_jsonl.open("w", encoding="utf-8") as handle:
        for row in scored_rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")

    write_csv(output_csv, scored_rows)
    stats = summarize(scored_rows)
    stats["inputs"] = {
        "input_jsonl": str(input_jsonl),
        "rules_json": str(rules_json),
    }
    stats["outputs"] = {
        "output_jsonl": str(output_jsonl),
        "output_csv": str(output_csv),
        "stats_json": str(stats_json),
    }
    stats_json.parent.mkdir(parents=True, exist_ok=True)
    stats_json.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
