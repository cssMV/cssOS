#!/usr/bin/env python3
import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AUDIO_ROOT = REPO_ROOT / "data" / "music_raw"
DEFAULT_REPORT_JSONL = REPO_ROOT / "data" / "manifests" / "suno_import_layout_report.jsonl"
DEFAULT_REPORT_CSV = REPO_ROOT / "data" / "manifests" / "suno_import_layout_report.csv"
DEFAULT_STATS_JSON = REPO_ROOT / "data" / "manifests" / "suno_import_layout_report.stats.json"
SUPPORTED_AUDIO_EXTS = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"}
SAFE_BASENAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]*$")
SAFE_STEM_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]*$")

LYRICS_SUFFIXES = [".lyrics.txt", ".txt", ".lrc"]
MIDI_SUFFIXES = [".mid", ".midi"]
CHORD_SUFFIXES = [".chords.json", ".chords.txt"]
VOCAL_TIMING_SUFFIXES = [".timing.json", ".timing.csv", ".vocal_timing.json"]


def discover_audio_files(audio_root: Path):
    if not audio_root.exists():
        return []
    return sorted(
        path for path in audio_root.rglob("*") if path.is_file() and path.suffix.lower() in SUPPORTED_AUDIO_EXTS
    )


def find_sidecar(base_path: Path, suffixes):
    for suffix in suffixes:
        candidate = base_path.with_suffix(suffix)
        if candidate.exists():
            return candidate
    return None


def infer_source_platform(audio_path: Path):
    lowered = str(audio_path).lower()
    if "suno" in lowered:
        return "suno"
    return "unknown"


def has_unsafe_basename(audio_path: Path):
    return not SAFE_BASENAME_RE.match(audio_path.stem)


def collect_naming_issues(audio_path: Path):
    issues = []
    if has_unsafe_basename(audio_path):
        issues.append("unsafe_audio_basename")
    if " " in audio_path.name:
        issues.append("audio_name_contains_space")
    if ".." in audio_path.name:
        issues.append("audio_name_contains_double_dot")
    return issues


def collect_stem_issues(stems_dir: Path):
    issues = []
    stem_files = []
    if not stems_dir.exists() or not stems_dir.is_dir():
        return issues, stem_files

    stem_files = sorted(
        path for path in stems_dir.iterdir() if path.is_file() and path.suffix.lower() in SUPPORTED_AUDIO_EXTS
    )
    if not stem_files:
        issues.append("empty_stems_dir")
        return issues, []

    for stem_file in stem_files:
        if not SAFE_STEM_NAME_RE.match(stem_file.stem):
            issues.append("unsafe_stem_filename")
            break

    return issues, [str(path) for path in stem_files]


def build_record(audio_path: Path, audio_root: Path):
    base_path = audio_path.with_suffix("")
    lyrics_path = find_sidecar(base_path, LYRICS_SUFFIXES)
    midi_path = find_sidecar(base_path, MIDI_SUFFIXES)
    chords_path = find_sidecar(base_path, CHORD_SUFFIXES)
    vocal_timing_path = find_sidecar(base_path, VOCAL_TIMING_SUFFIXES)
    stems_dir = audio_path.parent / f"{audio_path.stem}_stems"

    naming_issues = collect_naming_issues(audio_path)
    stem_issues, stem_files = collect_stem_issues(stems_dir)
    naming_issues.extend(stem_issues)

    missing_sidecars = []
    if lyrics_path is None:
        missing_sidecars.append("lyrics")
    if midi_path is None:
        missing_sidecars.append("melody_midi")
    if chords_path is None:
        missing_sidecars.append("chords")
    if vocal_timing_path is None:
        missing_sidecars.append("vocal_timing")
    if not stem_files:
        missing_sidecars.append("stems")

    if not missing_sidecars and not naming_issues:
        status = "clean"
    elif len(missing_sidecars) <= 2 and not any(issue.startswith("unsafe_") for issue in naming_issues):
        status = "needs_sidecars"
    else:
        status = "needs_cleanup"

    return {
        "schema": "css.suno_import_layout_report.v1",
        "sample_id": str(audio_path.relative_to(audio_root.parent)).lower(),
        "source_platform": infer_source_platform(audio_path),
        "audio_path": str(audio_path),
        "relative_audio_path": str(audio_path.relative_to(audio_root.parent)),
        "basename": audio_path.stem,
        "status": status,
        "naming_issues": naming_issues,
        "missing_sidecars": missing_sidecars,
        "lyrics_path": str(lyrics_path) if lyrics_path else None,
        "melody_midi": str(midi_path) if midi_path else None,
        "chord_progression_path": str(chords_path) if chords_path else None,
        "vocal_timing_path": str(vocal_timing_path) if vocal_timing_path else None,
        "stems_dir": str(stems_dir) if stems_dir.exists() else None,
        "stem_track_count": len(stem_files),
        "stem_tracks": stem_files,
    }


def summarize(records, audio_root: Path):
    by_status = Counter()
    by_source_platform = Counter()
    naming_issue_counts = Counter()
    missing_sidecar_counts = Counter()

    for record in records:
        by_status[record["status"]] += 1
        by_source_platform[record["source_platform"]] += 1
        for issue in record["naming_issues"]:
            naming_issue_counts[issue] += 1
        for item in record["missing_sidecars"]:
            missing_sidecar_counts[item] += 1

    return {
        "schema": "css.suno_import_layout_report.stats.v1",
        "audio_root": str(audio_root),
        "records": len(records),
        "by_status": dict(by_status),
        "by_source_platform": dict(by_source_platform),
        "naming_issue_counts": dict(naming_issue_counts),
        "missing_sidecar_counts": dict(missing_sidecar_counts),
    }


def write_csv(records, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "sample_id",
                "source_platform",
                "status",
                "basename",
                "missing_sidecars",
                "naming_issues",
                "stem_track_count",
                "relative_audio_path",
            ],
        )
        writer.writeheader()
        for record in records:
            writer.writerow(
                {
                    "sample_id": record["sample_id"],
                    "source_platform": record["source_platform"],
                    "status": record["status"],
                    "basename": record["basename"],
                    "missing_sidecars": ",".join(record["missing_sidecars"]),
                    "naming_issues": ",".join(record["naming_issues"]),
                    "stem_track_count": record["stem_track_count"],
                    "relative_audio_path": record["relative_audio_path"],
                }
            )


def main():
    parser = argparse.ArgumentParser(
        description="Check Suno bulk-import layout and sidecar completeness under data/music_raw."
    )
    parser.add_argument("--audio-root", default=str(DEFAULT_AUDIO_ROOT))
    parser.add_argument("--report-jsonl", default=str(DEFAULT_REPORT_JSONL))
    parser.add_argument("--report-csv", default=str(DEFAULT_REPORT_CSV))
    parser.add_argument("--stats-json", default=str(DEFAULT_STATS_JSON))
    parser.add_argument(
        "--source-filter",
        choices=["all", "suno", "unknown"],
        default="all",
        help="Restrict report rows to a specific inferred source platform.",
    )
    args = parser.parse_args()

    audio_root = Path(args.audio_root).expanduser().resolve()
    report_jsonl = Path(args.report_jsonl).expanduser().resolve()
    report_csv = Path(args.report_csv).expanduser().resolve()
    stats_json = Path(args.stats_json).expanduser().resolve()

    records = []
    for audio_path in discover_audio_files(audio_root):
        record = build_record(audio_path, audio_root)
        if args.source_filter != "all" and record["source_platform"] != args.source_filter:
            continue
        records.append(record)

    report_jsonl.parent.mkdir(parents=True, exist_ok=True)
    with report_jsonl.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    write_csv(records, report_csv)

    stats = summarize(records, audio_root)
    stats["inputs"] = {"audio_root": str(audio_root)}
    stats["outputs"] = {
        "report_jsonl": str(report_jsonl),
        "report_csv": str(report_csv),
        "stats_json": str(stats_json),
    }

    stats_json.parent.mkdir(parents=True, exist_ok=True)
    with stats_json.open("w", encoding="utf-8") as handle:
        json.dump(stats, handle, ensure_ascii=False, indent=2)

    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
