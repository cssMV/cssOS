#!/usr/bin/env python3
import argparse
import csv
import glob
import json
import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AUDIO_ROOT = REPO_ROOT / "data" / "music_raw"
DEFAULT_OUTPUT_JSONL = REPO_ROOT / "data" / "manifests" / "music_dataset_intake.jsonl"
DEFAULT_OUTPUT_CSV = REPO_ROOT / "data" / "manifests" / "music_dataset_intake.csv"
DEFAULT_IMPORT_MANIFEST_GLOB = str(REPO_ROOT / "data" / "manifests" / "suno_channel_import.*.json")
SUPPORTED_AUDIO_EXTS = {".mp3", ".wav", ".flac", ".m4a", ".aac", ".ogg"}


def normalize_stem(name: str) -> str:
    return re.sub(r"[\s_\-]+", " ", name.strip()).strip().lower()


def find_sidecar(base_path: Path, suffixes):
    for suffix in suffixes:
        candidate = base_path.with_suffix(suffix)
        if candidate.exists():
            return candidate
    return None


def read_text(path: Path):
    try:
        return path.read_text(encoding="utf-8").strip()
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8-sig").strip()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def discover_audio_files(audio_root: Path):
    if not audio_root.exists():
        return []
    return sorted(
        path for path in audio_root.rglob("*") if path.is_file() and path.suffix.lower() in SUPPORTED_AUDIO_EXTS
    )


def discover_suno_metadata_files(audio_root: Path):
    if not audio_root.exists():
        return []
    return sorted(path for path in audio_root.rglob("*.suno.json") if path.is_file())


def discover_import_manifests(pattern: str):
    paths = []
    for raw_path in glob.glob(pattern):
        candidate = Path(raw_path)
        if candidate.is_file():
            paths.append(candidate.resolve())
    return sorted(set(paths))


def infer_title(audio_path: Path):
    title = audio_path.stem
    title = re.sub(r"[_\-]+", " ", title).strip()
    return title or audio_path.name


def infer_section_labels(lyrics_text: str):
    labels = []
    for line in str(lyrics_text or "").splitlines():
        stripped = line.strip()
        if stripped.startswith("[") and stripped.endswith("]"):
            labels.append(stripped[1:-1])
    return labels


def build_record(audio_path: Path):
    base_path = audio_path.with_suffix("")
    lyrics_path = find_sidecar(base_path, [".lyrics.txt", ".txt", ".lrc"])
    midi_path = find_sidecar(base_path, [".mid", ".midi"])
    chords_path = find_sidecar(base_path, [".chords.json", ".chords.txt"])
    vocal_timing_path = find_sidecar(base_path, [".timing.json", ".timing.csv", ".vocal_timing.json"])
    stems_dir = audio_path.parent / f"{audio_path.stem}_stems"

    lyrics_text = read_text(lyrics_path) if lyrics_path else ""
    section_labels = infer_section_labels(lyrics_text)

    stem_files = []
    if stems_dir.exists() and stems_dir.is_dir():
        stem_files = sorted(
            str(path)
            for path in stems_dir.iterdir()
            if path.is_file() and path.suffix.lower() in SUPPORTED_AUDIO_EXTS
        )

    return {
        "schema": "css.music_dataset_intake.v1",
        "sample_id": normalize_stem(str(audio_path.relative_to(audio_path.parents[1]))),
        "source_platform": "suno" if "suno" in str(audio_path).lower() else "unknown",
        "title": infer_title(audio_path),
        "audio_path": str(audio_path),
        "audio_gcs_uri": None,
        "full_lyrics": lyrics_text or None,
        "lyrics_path": str(lyrics_path) if lyrics_path else None,
        "metadata_path": None,
        "section_labels": section_labels,
        "melody_midi": str(midi_path) if midi_path else None,
        "chord_progression_path": str(chords_path) if chords_path else None,
        "vocal_timing_path": str(vocal_timing_path) if vocal_timing_path else None,
        "stem_tracks": stem_files,
        "final_mix_reference": str(audio_path),
        "needs_annotation": {
            "lyrics": lyrics_path is None,
            "sections": not section_labels,
            "melody_midi": midi_path is None,
            "chords": chords_path is None,
            "vocal_timing": vocal_timing_path is None,
            "stems": not stem_files,
        },
    }


def build_record_from_suno_metadata(metadata_path: Path):
    payload = json.loads(metadata_path.read_text(encoding="utf-8"))
    base_name = metadata_path.name.replace(".suno.json", "")
    base_path = metadata_path.with_name(base_name)
    lyrics_path = find_sidecar(base_path, [".lyrics.txt", ".txt", ".lrc"])
    midi_path = find_sidecar(base_path, [".mid", ".midi"])
    chords_path = find_sidecar(base_path, [".chords.json", ".chords.txt"])
    vocal_timing_path = find_sidecar(base_path, [".timing.json", ".timing.csv", ".vocal_timing.json"])
    stems_dir = metadata_path.parent / f"{base_name}_stems"
    lyrics_text = read_text(lyrics_path) if lyrics_path and lyrics_path.exists() else str((payload.get("metadata") or {}).get("prompt") or "").strip()
    section_labels = infer_section_labels(lyrics_text)
    stem_files = []
    if stems_dir.exists() and stems_dir.is_dir():
        stem_files = sorted(
            str(path)
            for path in stems_dir.iterdir()
            if path.is_file() and path.suffix.lower() in SUPPORTED_AUDIO_EXTS
        )
    local_audio_path = str(payload.get("local_audio_path") or "").strip()
    title = str(payload.get("title") or infer_title(metadata_path.with_suffix(""))).strip()
    sample_id = normalize_stem(str(metadata_path.relative_to(metadata_path.parents[2])).replace(".suno.json", ""))
    return {
        "schema": "css.music_dataset_intake.v1",
        "sample_id": sample_id,
        "source_platform": "suno",
        "title": title,
        "audio_path": local_audio_path or None,
        "audio_gcs_uri": str(payload.get("gcs_audio_uri") or "").strip() or None,
        "full_lyrics": lyrics_text or None,
        "lyrics_path": str(lyrics_path) if lyrics_path and lyrics_path.exists() else None,
        "metadata_path": str(metadata_path),
        "section_labels": section_labels,
        "melody_midi": str(midi_path) if midi_path else None,
        "chord_progression_path": str(chords_path) if chords_path else None,
        "vocal_timing_path": str(vocal_timing_path) if vocal_timing_path else None,
        "stem_tracks": stem_files,
        "final_mix_reference": local_audio_path or str(payload.get("gcs_audio_uri") or payload.get("audio_url") or "").strip() or None,
        "needs_annotation": {
            "lyrics": not bool(lyrics_text),
            "sections": not section_labels,
            "melody_midi": midi_path is None,
            "chords": chords_path is None,
            "vocal_timing": vocal_timing_path is None,
            "stems": not stem_files,
        },
    }


def build_record_from_import_manifest(manifest_path: Path, imported: dict):
    title = str(imported.get("title") or "").strip() or "Untitled"
    prompt = str(imported.get("prompt") or "").strip()
    section_labels = infer_section_labels(prompt)
    sample_bits = [
        safe for safe in [
            manifest_path.stem.replace("suno_channel_import.", ""),
            str(imported.get("clip_id") or "").strip()[:8],
            title,
        ] if safe
    ]
    sample_id = normalize_stem("__".join(sample_bits))
    return {
        "schema": "css.music_dataset_intake.v1",
        "sample_id": sample_id,
        "source_platform": "suno",
        "title": title,
        "audio_path": None,
        "audio_gcs_uri": str(imported.get("gcs_audio_uri") or "").strip() or None,
        "full_lyrics": prompt or None,
        "lyrics_path": None,
        "metadata_path": None,
        "metadata_gcs_uri": str(imported.get("gcs_metadata_uri") or "").strip() or None,
        "lyrics_gcs_uri": str(imported.get("gcs_lyrics_uri") or "").strip() or None,
        "section_labels": section_labels,
        "melody_midi": None,
        "chord_progression_path": None,
        "vocal_timing_path": None,
        "stem_tracks": [],
        "final_mix_reference": str(imported.get("gcs_audio_uri") or imported.get("audio_url") or "").strip() or None,
        "needs_annotation": {
            "lyrics": not bool(prompt),
            "sections": not section_labels,
            "melody_midi": True,
            "chords": True,
            "vocal_timing": True,
            "stems": True,
        },
    }


def write_csv(records, csv_path: Path):
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with csv_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "sample_id",
                "title",
                "source_platform",
                "audio_path",
                "audio_gcs_uri",
                "lyrics_path",
                "metadata_path",
                "melody_midi",
                "chord_progression_path",
                "vocal_timing_path",
                "stem_track_count",
                "needs_lyrics",
                "needs_sections",
                "needs_melody_midi",
                "needs_chords",
                "needs_vocal_timing",
                "needs_stems",
            ],
        )
        writer.writeheader()
        for record in records:
            writer.writerow(
                {
                    "sample_id": record["sample_id"],
                    "title": record["title"],
                    "source_platform": record.get("source_platform"),
                    "audio_path": record["audio_path"],
                    "audio_gcs_uri": record.get("audio_gcs_uri"),
                    "lyrics_path": record["lyrics_path"],
                    "metadata_path": record.get("metadata_path"),
                    "melody_midi": record["melody_midi"],
                    "chord_progression_path": record["chord_progression_path"],
                    "vocal_timing_path": record["vocal_timing_path"],
                    "stem_track_count": len(record["stem_tracks"]),
                    "needs_lyrics": record["needs_annotation"]["lyrics"],
                    "needs_sections": record["needs_annotation"]["sections"],
                    "needs_melody_midi": record["needs_annotation"]["melody_midi"],
                    "needs_chords": record["needs_annotation"]["chords"],
                    "needs_vocal_timing": record["needs_annotation"]["vocal_timing"],
                    "needs_stems": record["needs_annotation"]["stems"],
                }
            )


def main():
    parser = argparse.ArgumentParser(
        description="Create a music-dataset intake manifest from local audio files and sidecars."
    )
    parser.add_argument("--audio-root", default=str(DEFAULT_AUDIO_ROOT))
    parser.add_argument("--output-jsonl", default=str(DEFAULT_OUTPUT_JSONL))
    parser.add_argument("--output-csv", default=str(DEFAULT_OUTPUT_CSV))
    parser.add_argument("--import-manifest-glob", default=DEFAULT_IMPORT_MANIFEST_GLOB)
    args = parser.parse_args()

    audio_root = Path(args.audio_root).expanduser().resolve()
    output_jsonl = Path(args.output_jsonl).expanduser().resolve()
    output_csv = Path(args.output_csv).expanduser().resolve()

    records_by_id = {}
    for path in discover_audio_files(audio_root):
        record = build_record(path)
        records_by_id[str(record["sample_id"])] = record
    for metadata_path in discover_suno_metadata_files(audio_root):
        record = build_record_from_suno_metadata(metadata_path)
        sample_id = str(record["sample_id"])
        existing = records_by_id.get(sample_id)
        if existing and existing.get("audio_path"):
            existing["audio_gcs_uri"] = existing.get("audio_gcs_uri") or record.get("audio_gcs_uri")
            existing["metadata_path"] = record.get("metadata_path") or existing.get("metadata_path")
            existing["source_platform"] = record.get("source_platform") or existing.get("source_platform")
            continue
        records_by_id[sample_id] = record
    for manifest_path in discover_import_manifests(args.import_manifest_glob):
        try:
            payload = load_json(manifest_path)
        except Exception:
            continue
        for imported in payload.get("imported") or []:
            record = build_record_from_import_manifest(manifest_path, imported)
            sample_id = str(record["sample_id"])
            existing = records_by_id.get(sample_id)
            if existing and (existing.get("audio_path") or existing.get("audio_gcs_uri")):
                if not existing.get("audio_gcs_uri"):
                    existing["audio_gcs_uri"] = record.get("audio_gcs_uri")
                if not existing.get("full_lyrics"):
                    existing["full_lyrics"] = record.get("full_lyrics")
                if not existing.get("section_labels"):
                    existing["section_labels"] = record.get("section_labels")
                continue
            records_by_id[sample_id] = record
    records = list(records_by_id.values())

    output_jsonl.parent.mkdir(parents=True, exist_ok=True)
    with output_jsonl.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    write_csv(records, output_csv)

    print(
      json.dumps(
          {
              "ok": True,
              "records": len(records),
              "audio_root": str(audio_root),
              "output_jsonl": str(output_jsonl),
              "output_csv": str(output_csv),
          },
          ensure_ascii=False,
      )
    )


if __name__ == "__main__":
    main()
