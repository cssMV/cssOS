#!/usr/bin/env python3
import argparse
import csv
import json
import shutil
from collections import Counter
from pathlib import Path


STEM_NAMES = [
    "vocals_proxy.mp3",
    "bass_proxy.mp3",
    "accompaniment_proxy.mp3",
]


def load_jsonl(path: Path):
    rows = []
    if not path.exists():
        return rows
    with path.open("r", encoding="utf-8") as handle:
        for line in handle:
            stripped = line.strip()
            if not stripped:
                continue
            rows.append(json.loads(stripped))
    return rows


def write_jsonl(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False) + "\n")


def write_csv(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "sample_id",
                "title",
                "stem_track_count",
                "stems_dir",
                "stem_source",
            ],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "sample_id": row.get("sample_id"),
                    "title": row.get("title"),
                    "stem_track_count": len(row.get("stem_tracks") or []),
                    "stems_dir": row.get("stem_tracks_dir"),
                    "stem_source": row.get("stem_tracks_source"),
                }
            )


def stems_dir_for(audio_path: Path):
    return audio_path.parent / f"{audio_path.stem}_stems"


def generate_placeholder_stems(audio_path: Path, stems_dir: Path):
    stems_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = stems_dir / "stems_manifest.json"
    stem_paths = [stems_dir / name for name in STEM_NAMES]
    audio_bytes = audio_path.read_bytes()
    for stem_path in stem_paths:
        stem_path.write_bytes(audio_bytes)

    manifest = {
        "schema": "css.stem_tracks_manifest.v1",
        "source": "placeholder_audio_clone_v1",
        "audio_path": str(audio_path),
        "stems_dir": str(stems_dir),
        "stems": [
            {
                "name": name.replace(".mp3", ""),
                "path": str(path),
                "kind": "placeholder",
            }
            for name, path in zip(STEM_NAMES, stem_paths)
        ],
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return [str(path) for path in stem_paths], str(manifest_path)


def main():
    parser = argparse.ArgumentParser(description="Autofill placeholder stem tracks and update intake manifest rows.")
    parser.add_argument("--input-jsonl", required=True)
    parser.add_argument("--output-jsonl", required=True)
    parser.add_argument("--output-csv", required=True)
    parser.add_argument("--stats-json", required=True)
    args = parser.parse_args()

    input_jsonl = Path(args.input_jsonl).expanduser().resolve()
    output_jsonl = Path(args.output_jsonl).expanduser().resolve()
    output_csv = Path(args.output_csv).expanduser().resolve()
    stats_json = Path(args.stats_json).expanduser().resolve()

    rows = load_jsonl(input_jsonl)
    source_counts = Counter()
    stemmed_rows = []
    stemmed_count = 0

    for row in rows:
        row = dict(row)
        existing_tracks = [path for path in (row.get("stem_tracks") or []) if Path(path).exists()]
        if existing_tracks:
            source_counts["existing"] += 1
            row["stem_tracks"] = existing_tracks
            stemmed_rows.append(row)
            continue

        audio_path = Path(row.get("audio_path") or "")
        if not str(audio_path or "").strip() or audio_path.name == "" or not audio_path.exists():
            needs = dict(row.get("needs_annotation") or {})
            needs["stems"] = True
            row["needs_annotation"] = needs
            source_counts["missing_audio_path"] += 1
            stemmed_rows.append(row)
            continue
        stems_dir = stems_dir_for(audio_path)
        tracks, manifest_path = generate_placeholder_stems(audio_path, stems_dir)
        row["stem_tracks"] = tracks
        row["stem_tracks_dir"] = str(stems_dir)
        row["stem_tracks_manifest"] = manifest_path
        row["stem_tracks_source"] = "placeholder_audio_clone_v1"
        needs = dict(row.get("needs_annotation") or {})
        needs["stems"] = False
        row["needs_annotation"] = needs
        source_counts[row["stem_tracks_source"]] += 1
        stemmed_count += 1
        stemmed_rows.append(row)

    write_jsonl(output_jsonl, stemmed_rows)
    write_csv(output_csv, stemmed_rows)

    stats = {
        "schema": "css.stem_tracks_autofill.stats.v1",
        "records": len(rows),
        "stemmed_records": stemmed_count,
        "source_counts": dict(source_counts),
        "input_jsonl": str(input_jsonl),
        "output_jsonl": str(output_jsonl),
        "output_csv": str(output_csv),
    }
    stats_json.parent.mkdir(parents=True, exist_ok=True)
    stats_json.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
