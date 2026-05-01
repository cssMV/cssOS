#!/usr/bin/env python3
import argparse
import csv
import hashlib
import json
import re
from collections import Counter
from pathlib import Path


MAJOR_KEYS = ["C", "G", "D", "F", "A", "E"]
MINOR_KEYS = ["Am", "Em", "Dm", "Bm", "Gm", "Cm"]
MAJOR_CHORDS = {
    "I": "C",
    "ii": "Dm",
    "iii": "Em",
    "IV": "F",
    "V": "G",
    "vi": "Am",
    "vii°": "Bdim",
}
MINOR_CHORDS = {
    "i": "Am",
    "ii°": "Bdim",
    "III": "C",
    "iv": "Dm",
    "v": "Em",
    "V": "E",
    "VI": "F",
    "VII": "G",
}
MODE_HINTS = {
    "major": {"uplifting", "hopeful", "bright", "anthem", "worship", "praise", "happy", "warm"},
    "minor": {"sad", "melancholy", "mellow", "emotional", "cinematic", "dark", "lonely", "dramatic"},
}
SECTION_TEMPLATES = {
    "major": {
        "intro": ["I", "V", "vi", "IV"],
        "verse": ["I", "V", "vi", "IV"],
        "pre-chorus": ["ii", "IV", "V", "V"],
        "chorus": ["I", "V", "vi", "IV"],
        "post-chorus": ["vi", "IV", "I", "V"],
        "bridge": ["vi", "IV", "I", "V"],
        "outro": ["I", "V", "vi", "IV"],
        "default": ["I", "V", "vi", "IV"],
    },
    "minor": {
        "intro": ["i", "VI", "III", "VII"],
        "verse": ["i", "VI", "III", "VII"],
        "pre-chorus": ["iv", "VI", "VII", "VII"],
        "chorus": ["VI", "III", "VII", "i"],
        "post-chorus": ["i", "VII", "VI", "VII"],
        "bridge": ["iv", "VI", "i", "V"],
        "outro": ["i", "VI", "III", "VII"],
        "default": ["i", "VI", "III", "VII"],
    },
}


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
                "mode",
                "tonic",
                "section_count",
                "chord_progression_path",
            ],
        )
        writer.writeheader()
        for row in rows:
            chords = row.get("chord_progression") or []
            summary = row.get("chord_progression_summary") or {}
            writer.writerow(
                {
                    "sample_id": row.get("sample_id"),
                    "title": row.get("title"),
                    "mode": summary.get("mode"),
                    "tonic": summary.get("tonic"),
                    "section_count": len(chords),
                    "chord_progression_path": row.get("chord_progression_path"),
                }
            )


def load_json(path: Path):
    if not path.exists() or path.is_dir():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def section_slug(label: str):
    lowered = re.sub(r"\s+", " ", str(label or "").strip().lower())
    if lowered.startswith("pre-chorus") or lowered.startswith("pre chorus"):
        return "pre-chorus"
    if lowered.startswith("post-chorus") or lowered.startswith("post chorus"):
        return "post-chorus"
    for key in ("intro", "verse", "chorus", "bridge", "outro"):
        if lowered.startswith(key):
            return key
    return "default"


def infer_mode(record):
    audio_path = Path(record.get("audio_path") or "")
    if not str(audio_path or "").strip() or audio_path.name == "":
        suno_payload = {}
    else:
        suno_payload = load_json(audio_path.with_suffix(".suno.json"))
    metadata = suno_payload.get("metadata") or {}
    text = " ".join(
        str(item or "")
        for item in [
            metadata.get("tags"),
            metadata.get("prompt"),
            record.get("title"),
            record.get("full_lyrics"),
        ]
    ).lower()
    major_score = sum(1 for token in MODE_HINTS["major"] if token in text)
    minor_score = sum(1 for token in MODE_HINTS["minor"] if token in text)
    mode = "minor" if minor_score > major_score else "major"
    source = "style_heuristic"
    return mode, source, metadata


def choose_tonic(sample_id: str, mode: str):
    digest = hashlib.md5(str(sample_id or "").encode("utf-8")).hexdigest()
    index = int(digest[:8], 16)
    keys = MINOR_KEYS if mode == "minor" else MAJOR_KEYS
    return keys[index % len(keys)]


def transpose_chord(chord_name: str, tonic: str, mode: str):
    if mode == "major":
        root = tonic
        shift = {
            "C": {"C": "C", "Dm": "Dm", "Em": "Em", "F": "F", "G": "G", "Am": "Am", "Bdim": "Bdim"},
            "G": {"C": "G", "Dm": "Am", "Em": "Bm", "F": "C", "G": "D", "Am": "Em", "Bdim": "F#dim"},
            "D": {"C": "D", "Dm": "Em", "Em": "F#m", "F": "G", "G": "A", "Am": "Bm", "Bdim": "C#dim"},
            "F": {"C": "F", "Dm": "Gm", "Em": "Am", "F": "Bb", "G": "C", "Am": "Dm", "Bdim": "Edim"},
            "A": {"C": "A", "Dm": "Bm", "Em": "C#m", "F": "D", "G": "E", "Am": "F#m", "Bdim": "G#dim"},
            "E": {"C": "E", "Dm": "F#m", "Em": "G#m", "F": "A", "G": "B", "Am": "C#m", "Bdim": "D#dim"},
        }
        return shift.get(root, shift["C"]).get(chord_name, chord_name)
    root = tonic
    shift = {
        "Am": {"Am": "Am", "Bdim": "Bdim", "C": "C", "Dm": "Dm", "Em": "Em", "E": "E", "F": "F", "G": "G"},
        "Em": {"Am": "Em", "Bdim": "F#dim", "C": "G", "Dm": "Am", "Em": "Bm", "E": "B", "F": "C", "G": "D"},
        "Dm": {"Am": "Dm", "Bdim": "Edim", "C": "F", "Dm": "Gm", "Em": "Am", "E": "A", "F": "Bb", "G": "C"},
        "Bm": {"Am": "Bm", "Bdim": "C#dim", "C": "D", "Dm": "Em", "Em": "F#m", "E": "F#", "F": "G", "G": "A"},
        "Gm": {"Am": "Gm", "Bdim": "Adim", "C": "Bb", "Dm": "Cm", "Em": "Dm", "E": "D", "F": "Eb", "G": "F"},
        "Cm": {"Am": "Cm", "Bdim": "Ddim", "C": "Eb", "Dm": "Fm", "Em": "Gm", "E": "G", "F": "Ab", "G": "Bb"},
    }
    return shift.get(root, shift["Am"]).get(chord_name, chord_name)


def load_timing_sections(record):
    timing_path = Path(record.get("vocal_timing_path") or "")
    if not timing_path.exists() or timing_path.is_dir():
        return {}
    payload = load_json(timing_path)
    grouped = {}
    for line in payload.get("lines") or []:
        section = str(line.get("section") or "Section").strip() or "Section"
        start_s = float(line.get("start_s") or 0.0)
        end_s = float(line.get("end_s") or start_s)
        item = grouped.setdefault(
            section,
            {"start_s": start_s, "end_s": end_s, "line_count": 0},
        )
        item["start_s"] = min(item["start_s"], start_s)
        item["end_s"] = max(item["end_s"], end_s)
        item["line_count"] += 1
    return grouped


def bars_for_section(section_name: str, line_count: int):
    slug = section_slug(section_name)
    if slug in {"intro", "outro"}:
        return max(4, line_count * 2)
    if slug == "bridge":
        return max(8, line_count * 2)
    return max(8, line_count * 2)


def build_progression(record):
    mode, mode_source, metadata = infer_mode(record)
    tonic = choose_tonic(record.get("sample_id"), mode)
    timing_sections = load_timing_sections(record)
    section_labels = list(record.get("section_labels") or timing_sections.keys() or ["Section 1"])
    chord_map = MINOR_CHORDS if mode == "minor" else MAJOR_CHORDS
    templates = SECTION_TEMPLATES[mode]
    entries = []

    for label in section_labels:
        section_info = timing_sections.get(label) or {}
        numerals = templates.get(section_slug(label), templates["default"])
        chord_targets = [transpose_chord(chord_map[n], tonic, mode) for n in numerals if n in chord_map]
        entries.append(
            {
                "section_match": label,
                "numeral_path": numerals,
                "cadence": numerals[-1] if numerals else None,
                "chord_targets": chord_targets,
                "tonic": tonic,
                "mode": mode,
                "bars_per_cycle": bars_for_section(label, int(section_info.get("line_count") or 0)),
                "start_s": round(float(section_info.get("start_s") or 0.0), 3) if section_info else None,
                "end_s": round(float(section_info.get("end_s") or 0.0), 3) if section_info else None,
                "line_count": int(section_info.get("line_count") or 0),
            }
        )

    return {
        "schema": "css.chord_progression.v1",
        "source": "heuristic_section_harmony_v1",
        "mode": mode,
        "mode_source": mode_source,
        "tonic": tonic,
        "style_tags": str((metadata or {}).get("tags") or ""),
        "sections": entries,
    }


def sidecar_path_for(record):
    audio_path = Path(record.get("audio_path") or "")
    if not str(audio_path or "").strip() or audio_path.name == "":
        return None
    return audio_path.with_suffix(".chords.json")


def main():
    parser = argparse.ArgumentParser(description="Autofill coarse chord progression sidecars and update intake manifest rows.")
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
    mode_counts = Counter()
    chorded_rows = []
    chorded_count = 0

    for row in rows:
        row = dict(row)
        existing_path = Path(row.get("chord_progression_path") or "")
        if row.get("chord_progression_path") and existing_path.exists():
            source_counts["existing"] += 1
            chorded_rows.append(row)
            continue

        progression = build_progression(row)
        sidecar_path = sidecar_path_for(row)
        if sidecar_path is None:
            needs = dict(row.get("needs_annotation") or {})
            needs["chords"] = True
            row["needs_annotation"] = needs
            source_counts["missing_audio_path"] += 1
            chorded_rows.append(row)
            continue
        sidecar_path.write_text(json.dumps(progression, ensure_ascii=False, indent=2), encoding="utf-8")
        row["chord_progression_path"] = str(sidecar_path)
        row["chord_progression"] = progression.get("sections") or []
        row["chord_progression_summary"] = {
            "tonic": progression.get("tonic"),
            "mode": progression.get("mode"),
            "source": progression.get("source"),
        }
        needs = dict(row.get("needs_annotation") or {})
        needs["chords"] = False
        row["needs_annotation"] = needs
        row["chord_progression_source"] = progression.get("source")
        source_counts[progression.get("source") or "generated"] += 1
        mode_counts[progression.get("mode") or "unknown"] += 1
        chorded_count += 1
        chorded_rows.append(row)

    write_jsonl(output_jsonl, chorded_rows)
    write_csv(output_csv, chorded_rows)

    stats = {
        "schema": "css.chord_progression_autofill.stats.v1",
        "records": len(rows),
        "chorded_records": chorded_count,
        "source_counts": dict(source_counts),
        "mode_counts": dict(mode_counts),
        "input_jsonl": str(input_jsonl),
        "output_jsonl": str(output_jsonl),
        "output_csv": str(output_csv),
    }
    stats_json.parent.mkdir(parents=True, exist_ok=True)
    stats_json.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
