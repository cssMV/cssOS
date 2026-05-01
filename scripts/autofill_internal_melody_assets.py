#!/usr/bin/env python3
import argparse
import hashlib
import json
import math
import wave
from collections import Counter
from pathlib import Path


TPQ = 480
TEMPO_BPM = 92
TEMPO_US_PER_QUARTER = int(60_000_000 / TEMPO_BPM)
CHORD_PITCHES = {
    "C": [60, 64, 67],
    "Dm": [62, 65, 69],
    "Em": [64, 67, 71],
    "F": [65, 69, 72],
    "G": [67, 71, 74],
    "Am": [69, 72, 76],
    "Bdim": [71, 74, 77],
    "Bb": [70, 74, 77],
    "Bm": [71, 74, 78],
    "C#m": [61, 64, 68],
    "D": [62, 66, 69],
    "D#dim": [63, 66, 69],
    "Eb": [63, 67, 70],
    "Edim": [64, 67, 70],
    "E": [64, 68, 71],
    "F#": [66, 70, 73],
    "F#dim": [66, 69, 72],
    "F#m": [66, 69, 73],
    "G#dim": [68, 71, 74],
    "G#m": [68, 71, 75],
    "Gm": [67, 70, 74],
    "Ab": [68, 72, 75],
    "A": [69, 73, 76],
    "Adim": [69, 72, 75],
    "B": [71, 75, 78],
    "Cm": [60, 63, 67],
}
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
SECTION_REGISTER = {
    "intro": -3,
    "verse": 0,
    "pre-chorus": 2,
    "chorus": 4,
    "post-chorus": 3,
    "bridge": 1,
    "outro": -2,
    "default": 0,
}
STEM_NAMES = ["vocals_proxy.wav", "bass_proxy.wav", "accompaniment_proxy.wav"]
MODE_HINTS = {
    "major": {"uplifting", "hopeful", "bright", "warm", "victory"},
    "minor": {"dark", "cinematic", "dramatic", "lonely", "storm", "rain", "night", "fire"},
}


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


def load_json(path: Path):
    if not path.exists():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def section_slug(label: str):
    lowered = str(label or "").strip().lower().replace("_", " ")
    if lowered.startswith("pre-chorus") or lowered.startswith("pre chorus"):
        return "pre-chorus"
    if lowered.startswith("post-chorus") or lowered.startswith("post chorus"):
        return "post-chorus"
    for key in ("intro", "verse", "chorus", "bridge", "outro"):
        if lowered.startswith(key):
            return key
    return "default"


def sidecar_dir(output_root: Path, sample_id: str):
    return output_root / str(sample_id or "sample")


def coerce_lines(record):
    lines = []
    vocal_timing = record.get("vocal_timing") or {}
    if isinstance(vocal_timing.get("lines"), list) and vocal_timing["lines"]:
        for item in vocal_timing["lines"]:
            if not isinstance(item, dict):
                continue
            text = str(item.get("text") or "").strip()
            if not text:
                continue
            start_s = float(item.get("start_s", item.get("t", 0.0)) or 0.0)
            end_s = float(item.get("end_s", start_s + 1.2) or start_s + 1.2)
            lines.append(
                {
                    "section": str(item.get("section") or "Section").strip() or "Section",
                    "text": text,
                    "start_s": round(start_s, 3),
                    "end_s": round(max(end_s, start_s + 0.8), 3),
                    "pause_after_s": round(float(item.get("pause_after_s") or 0.18), 3),
                }
            )
    if lines:
        return lines

    current = 0.0
    for section in record.get("sections") or []:
        section_name = str(section.get("section") or "Section").strip() or "Section"
        source_lines = section.get("lines") or []
        for item in source_lines:
            text = str(item.get("text") or "").strip()
            if not text:
                continue
            start_s = float(item.get("t") or current)
            end_s = start_s + 4.8
            current = end_s + 0.18
            lines.append(
                {
                    "section": section_name,
                    "text": text,
                    "start_s": round(start_s, 3),
                    "end_s": round(end_s, 3),
                    "pause_after_s": 0.18,
                }
            )
    return lines


def write_vocal_timing(record, output_root: Path):
    existing = record.get("vocal_timing") or {}
    existing_path = Path(existing.get("path") or existing.get("plan_path") or "")
    lines = coerce_lines(record)
    duration_s = max([float(item["end_s"]) for item in lines], default=0.0)
    payload = {
        "schema": "css.vocal_timing.v1",
        "source": "internal_manifest_autofill_v1",
        "sample_id": record.get("sample_id"),
        "duration_s": round(duration_s, 3),
        "lines": lines,
    }
    target = sidecar_dir(output_root, str(record.get("sample_id"))) / "vocal_timing.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "path": str(target),
        "plan_path": str(existing_path) if existing_path.exists() else (str(existing.get("plan_path")) if existing.get("plan_path") else None),
        "lines": lines,
        "duration_s": payload["duration_s"],
        "source": "internal_manifest_autofill_v1",
    }


def infer_mode(record):
    text = " ".join(
        [
            str(record.get("title") or ""),
            str(record.get("full_lyrics") or ""),
            str(record.get("prompt") or ""),
        ]
    ).lower()
    major_score = sum(1 for token in MODE_HINTS["major"] if token in text)
    minor_score = sum(1 for token in MODE_HINTS["minor"] if token in text)
    return "minor" if minor_score > major_score else "major"


def choose_tonic(sample_id: str, mode: str):
    digest = hashlib.md5(str(sample_id or "").encode("utf-8")).hexdigest()
    keys = MINOR_KEYS if mode == "minor" else MAJOR_KEYS
    return keys[int(digest[:8], 16) % len(keys)]


def transpose_chord(chord_name: str, tonic: str, mode: str):
    if mode == "major":
        shift = {
            "C": {"C": "C", "Dm": "Dm", "Em": "Em", "F": "F", "G": "G", "Am": "Am", "Bdim": "Bdim"},
            "G": {"C": "G", "Dm": "Am", "Em": "Bm", "F": "C", "G": "D", "Am": "Em", "Bdim": "F#dim"},
            "D": {"C": "D", "Dm": "Em", "Em": "F#m", "F": "G", "G": "A", "Am": "Bm", "Bdim": "C#dim"},
            "F": {"C": "F", "Dm": "Gm", "Em": "Am", "F": "Bb", "G": "C", "Am": "Dm", "Bdim": "Edim"},
            "A": {"C": "A", "Dm": "Bm", "Em": "C#m", "F": "D", "G": "E", "Am": "F#m", "Bdim": "G#dim"},
            "E": {"C": "E", "Dm": "F#m", "Em": "G#m", "F": "A", "G": "B", "Am": "C#m", "Bdim": "D#dim"},
        }
        return shift.get(tonic, shift["C"]).get(chord_name, chord_name)
    shift = {
        "Am": {"Am": "Am", "Bdim": "Bdim", "C": "C", "Dm": "Dm", "Em": "Em", "E": "E", "F": "F", "G": "G"},
        "Em": {"Am": "Em", "Bdim": "F#dim", "C": "G", "Dm": "Am", "Em": "Bm", "E": "B", "F": "C", "G": "D"},
        "Dm": {"Am": "Dm", "Bdim": "Edim", "C": "F", "Dm": "Gm", "Em": "Am", "E": "A", "F": "Bb", "G": "C"},
        "Bm": {"Am": "Bm", "Bdim": "C#dim", "C": "D", "Dm": "Em", "Em": "F#m", "E": "F#", "F": "G", "G": "A"},
        "Gm": {"Am": "Gm", "Bdim": "Adim", "C": "Bb", "Dm": "Cm", "Em": "Dm", "E": "D", "F": "Eb", "G": "F"},
        "Cm": {"Am": "Cm", "Bdim": "Ddim", "C": "Eb", "Dm": "Fm", "Em": "Gm", "E": "G", "F": "Ab", "G": "Bb"},
    }
    return shift.get(tonic, shift["Am"]).get(chord_name, chord_name)


def bars_for_section(section_name: str, line_count: int):
    slug = section_slug(section_name)
    if slug in {"intro", "outro"}:
        return max(4, line_count * 2)
    if slug == "bridge":
        return max(8, line_count * 2)
    return max(8, line_count * 2)


def build_chords(record, timing_lines):
    existing = record.get("chord_progression") or []
    if existing:
        return existing, "existing"
    mode = infer_mode(record)
    tonic = choose_tonic(str(record.get("sample_id") or ""), mode)
    chord_map = MINOR_CHORDS if mode == "minor" else MAJOR_CHORDS
    templates = SECTION_TEMPLATES[mode]
    grouped = {}
    for line in timing_lines:
        section_name = str(line.get("section") or "Section").strip() or "Section"
        info = grouped.setdefault(section_name, {"line_count": 0, "start_s": float(line["start_s"]), "end_s": float(line["end_s"])})
        info["line_count"] += 1
        info["start_s"] = min(info["start_s"], float(line["start_s"]))
        info["end_s"] = max(info["end_s"], float(line["end_s"]))
    labels = [str(item) for item in (record.get("section_labels") or grouped.keys()) if str(item).strip()]
    out = []
    for label in labels:
        numerals = templates.get(section_slug(label), templates["default"])
        chord_targets = [transpose_chord(chord_map[n], tonic, mode) for n in numerals if n in chord_map]
        info = grouped.get(label) or {"line_count": 0, "start_s": 0.0, "end_s": 0.0}
        out.append(
            {
                "section_match": label,
                "numeral_path": numerals,
                "cadence": numerals[-1] if numerals else None,
                "chord_targets": chord_targets,
                "tonic": tonic,
                "mode": mode,
                "bars_per_cycle": bars_for_section(label, int(info["line_count"])),
                "start_s": round(float(info["start_s"]), 3),
                "end_s": round(float(info["end_s"]), 3),
                "line_count": int(info["line_count"]),
            }
        )
    return out, "heuristic_section_harmony_v1"


def encode_varlen(value: int):
    buffer = value & 0x7F
    out = bytearray()
    while True:
        value >>= 7
        if value:
            buffer <<= 8
            buffer |= ((value & 0x7F) | 0x80)
        else:
            break
    while True:
        out.append(buffer & 0xFF)
        if buffer & 0x80:
            buffer >>= 8
        else:
            break
    return bytes(out)


def sec_to_ticks(seconds: float):
    quarter_per_second = TEMPO_BPM / 60.0
    return max(1, int(round(seconds * TPQ * quarter_per_second)))


def nearest_pitch(previous_pitch: int, choices):
    best = None
    best_dist = None
    for pitch in choices:
        for shift in (-12, 0, 12):
            candidate = pitch + shift
            dist = abs(candidate - previous_pitch)
            if best is None or dist < best_dist:
                best = candidate
                best_dist = dist
    return best


def pitch_choices_for_section(section_name: str, chord_targets, line_index: int, sample_id: str):
    slug = section_slug(section_name)
    register_bias = SECTION_REGISTER.get(slug, SECTION_REGISTER["default"])
    chord_name = chord_targets[line_index % len(chord_targets)] if chord_targets else "C"
    triad = CHORD_PITCHES.get(chord_name, [60, 64, 67])
    digest = int(hashlib.md5(f"{sample_id}:{section_name}:{line_index}".encode("utf-8")).hexdigest()[:8], 16)
    inversion = digest % len(triad)
    rotated = triad[inversion:] + triad[:inversion]
    return [pitch + register_bias for pitch in rotated]


def build_note_plan(sample_id: str, timing_lines, chord_sections):
    notes = []
    previous_pitch = None
    for line in timing_lines:
        start_s = float(line.get("start_s") or 0.0)
        end_s = float(line.get("end_s") or start_s + 1.0)
        duration_s = max(0.35, end_s - start_s)
        text = str(line.get("text") or "").strip()
        section = str(line.get("section") or "Section").strip() or "Section"
        token_count = max(1, min(4, math.ceil(max(1, len(text.replace(" ", ""))) / 8)))
        note_count = 1 if duration_s < 1.5 else min(4, token_count)
        per_note = duration_s / note_count
        section_chords = chord_sections.get(section) or {}
        chord_targets = section_chords.get("chord_targets") or ["C", "G", "Am", "F"]
        for idx in range(note_count):
            choices = pitch_choices_for_section(section, chord_targets, idx, sample_id)
            pitch = nearest_pitch(previous_pitch, choices) if previous_pitch is not None else choices[0]
            if section_slug(section) == "chorus" and idx == note_count - 1:
                pitch += 2
            pitch = max(48, min(84, pitch))
            note_start_s = start_s + per_note * idx
            note_dur_s = per_note * (0.82 if note_count > 1 else 0.88)
            notes.append(
                {
                    "pitch": int(pitch),
                    "velocity": 88 if section_slug(section) == "chorus" else 78,
                    "start_s": round(note_start_s, 3),
                    "duration_s": round(max(0.18, note_dur_s), 3),
                }
            )
            previous_pitch = pitch
    return notes


def build_midi_bytes(notes):
    track = bytearray()
    track.extend(b"\x00\xFF\x51\x03" + TEMPO_US_PER_QUARTER.to_bytes(3, "big"))
    track.extend(b"\x00\xC0\x00")
    events = []
    for note in notes:
        start_tick = sec_to_ticks(note["start_s"])
        end_tick = start_tick + sec_to_ticks(note["duration_s"])
        events.append((start_tick, 1, bytes([0x90, note["pitch"], note["velocity"]])))
        events.append((end_tick, 0, bytes([0x80, note["pitch"], 0x40])))
    events.sort(key=lambda item: (item[0], item[1]))
    previous_tick = 0
    for tick, _, payload in events:
        track.extend(encode_varlen(max(0, tick - previous_tick)))
        track.extend(payload)
        previous_tick = tick
    track.extend(b"\x00\xFF\x2F\x00")
    header = b"MThd" + (6).to_bytes(4, "big") + (0).to_bytes(2, "big") + (1).to_bytes(2, "big") + TPQ.to_bytes(2, "big")
    return header + b"MTrk" + len(track).to_bytes(4, "big") + bytes(track)


def write_midi(record, output_root: Path, timing_lines, chords):
    existing_raw = str(record.get("melody_midi") or "").strip()
    existing_path = Path(existing_raw) if existing_raw else None
    if existing_path and existing_path.is_file():
        return str(existing_path), "existing"
    chord_sections = {item.get("section_match"): item for item in chords}
    notes = build_note_plan(str(record.get("sample_id") or ""), timing_lines, chord_sections)
    target = sidecar_dir(output_root, str(record.get("sample_id"))) / "melody_proxy.mid"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(build_midi_bytes(notes))
    return str(target), "proxy_melody_from_timing_v1"


def write_silence_wav(path: Path, duration_s: float = 1.0):
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as handle:
        handle.setnchannels(1)
        handle.setsampwidth(2)
        handle.setframerate(16000)
        frames = int(16000 * max(0.5, duration_s))
        handle.writeframes(b"\x00\x00" * frames)


def write_stems(record, output_root: Path):
    stem_tracks = record.get("stem_tracks") or {}
    existing_files = [
        str(path) for path in (stem_tracks.get("files") or []) if Path(path).exists()
    ]
    if existing_files:
        merged_names = stem_tracks.get("names") or [Path(path).stem for path in existing_files]
        return {
            "plan_path": stem_tracks.get("plan_path"),
            "names": merged_names,
            "files": existing_files,
            "source": "existing",
        }

    refs = [Path(path) for path in (record.get("final_mix_references") or []) if Path(path).exists()]
    stems_root = sidecar_dir(output_root, str(record.get("sample_id"))) / "stems"
    stems_root.mkdir(parents=True, exist_ok=True)
    file_paths = []
    for idx, stem_name in enumerate(STEM_NAMES):
        target = stems_root / stem_name
        if refs and refs[0].suffix.lower() == ".wav":
            target.write_bytes(refs[0].read_bytes())
        else:
            write_silence_wav(target, 1.0 + idx * 0.1)
        file_paths.append(str(target))
    manifest = {
        "schema": "css.stem_tracks_manifest.v1",
        "source": "internal_manifest_proxy_stems_v1",
        "sample_id": record.get("sample_id"),
        "stems": [
            {"name": Path(path).stem, "path": path, "kind": "proxy"}
            for path in file_paths
        ],
    }
    manifest_path = stems_root / "stems_manifest.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    return {
        "plan_path": str(manifest_path),
        "names": [item["name"] for item in manifest["stems"]],
        "files": file_paths,
        "source": "internal_manifest_proxy_stems_v1",
    }


def main():
    parser = argparse.ArgumentParser(description="Autofill internal melody manifest assets required by training.")
    parser.add_argument("--input-jsonl", required=True)
    parser.add_argument("--output-jsonl", required=True)
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--stats-json", required=True)
    args = parser.parse_args()

    input_jsonl = Path(args.input_jsonl).expanduser().resolve()
    output_jsonl = Path(args.output_jsonl).expanduser().resolve()
    output_root = Path(args.output_root).expanduser().resolve()
    stats_json = Path(args.stats_json).expanduser().resolve()

    rows = load_jsonl(input_jsonl)
    output_rows = []
    counts = Counter()

    for row in rows:
        row = dict(row)
        vocal_timing = write_vocal_timing(row, output_root)
        row["vocal_timing"] = vocal_timing
        chords, chord_source = build_chords(row, vocal_timing["lines"])
        row["chord_progression"] = chords
        row["chord_progression_source"] = chord_source
        melody_midi, melody_source = write_midi(row, output_root, vocal_timing["lines"], chords)
        row["melody_midi"] = melody_midi
        row["melody_midi_source"] = melody_source
        stems = write_stems(row, output_root)
        row["stem_tracks"] = {
            "plan_path": stems["plan_path"],
            "names": stems["names"],
            "files": stems["files"],
        }
        row["stem_tracks_source"] = stems["source"]
        counts[f"chords:{chord_source}"] += 1
        counts[f"midi:{melody_source}"] += 1
        counts[f"stems:{stems['source']}"] += 1
        counts["records"] += 1
        output_rows.append(row)

    write_jsonl(output_jsonl, output_rows)
    stats = {
        "schema": "css.internal_melody_assets_autofill.stats.v1",
        "records": len(output_rows),
        "counts": dict(counts),
        "input_jsonl": str(input_jsonl),
        "output_jsonl": str(output_jsonl),
        "output_root": str(output_root),
    }
    stats_json.parent.mkdir(parents=True, exist_ok=True)
    stats_json.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
