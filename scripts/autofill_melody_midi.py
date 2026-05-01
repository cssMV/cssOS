#!/usr/bin/env python3
import argparse
import csv
import hashlib
import json
import math
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
    "Em": [64, 67, 71],
    "F#": [66, 70, 73],
    "F#dim": [66, 69, 72],
    "F#m": [66, 69, 73],
    "G#dim": [68, 71, 74],
    "G#m": [68, 71, 75],
    "Gm": [67, 70, 74],
    "Ab": [68, 72, 75],
    "A": [69, 73, 76],
    "Adim": [69, 72, 75],
    "Bb": [70, 74, 77],
    "B": [71, 75, 78],
    "Bm": [71, 74, 78],
    "Cm": [60, 63, 67],
    "Ddim": [62, 65, 68],
    "Fm": [65, 68, 72],
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
                "note_count",
                "duration_s",
                "melody_midi",
                "melody_midi_source",
            ],
        )
        writer.writeheader()
        for row in rows:
            summary = row.get("melody_midi_summary") or {}
            writer.writerow(
                {
                    "sample_id": row.get("sample_id"),
                    "title": row.get("title"),
                    "note_count": summary.get("note_count"),
                    "duration_s": summary.get("duration_s"),
                    "melody_midi": row.get("melody_midi"),
                    "melody_midi_source": row.get("melody_midi_source"),
                }
            )


def load_json(path: Path):
    if not path.exists() or path.is_dir():
        return {}
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def section_slug(label: str):
    lowered = str(label or "").strip().lower()
    if lowered.startswith("pre-chorus") or lowered.startswith("pre chorus"):
        return "pre-chorus"
    if lowered.startswith("post-chorus") or lowered.startswith("post chorus"):
        return "post-chorus"
    for key in ("intro", "verse", "chorus", "bridge", "outro"):
        if lowered.startswith(key):
            return key
    return "default"


def midi_path_for(record):
    audio_path = Path(record.get("audio_path") or "")
    if not str(audio_path or "").strip() or audio_path.name == "":
        return None
    return audio_path.with_suffix(".mid")


def load_timing_lines(record):
    timing_path = Path(record.get("vocal_timing_path") or "")
    if not timing_path.exists() or timing_path.is_dir():
        return [], 0.0
    payload = load_json(timing_path)
    return payload.get("lines") or [], float(payload.get("duration_s") or 0.0)


def load_chord_sections(record):
    chord_path = Path(record.get("chord_progression_path") or "")
    if not chord_path.exists() or chord_path.is_dir():
        return {}
    payload = load_json(chord_path)
    sections = {}
    for item in payload.get("sections") or []:
        key = str(item.get("section_match") or "").strip()
        if key:
            sections[key] = item
    return sections


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


def subdivide_line(line, section_chords, previous_pitch, sample_id):
    start_s = float(line.get("start_s") or 0.0)
    end_s = float(line.get("end_s") or start_s + 1.0)
    duration_s = max(0.35, end_s - start_s)
    text = str(line.get("text") or "").strip()
    section = str(line.get("section") or "Section").strip() or "Section"
    token_count = max(1, min(4, len([part for part in text.replace("，", " ").replace(",", " ").split() if part]) or math.ceil(len(text) / 8)))
    note_count = 1 if duration_s < 1.5 else min(4, token_count)
    per_note = duration_s / note_count
    notes = []
    current_pitch = previous_pitch
    for idx in range(note_count):
        chord_targets = (section_chords or {}).get("chord_targets") or ["C", "G", "Am", "F"]
        choices = pitch_choices_for_section(section, chord_targets, idx, sample_id)
        pitch = nearest_pitch(current_pitch, choices) if current_pitch is not None else choices[0]
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
                "section": section,
                "source_text": text,
            }
        )
        current_pitch = pitch
    return notes, current_pitch


def build_note_plan(record):
    lines, total_duration_s = load_timing_lines(record)
    chord_sections = load_chord_sections(record)
    notes = []
    previous_pitch = None
    for line in lines:
        section = str(line.get("section") or "Section").strip() or "Section"
        line_notes, previous_pitch = subdivide_line(
            line,
            chord_sections.get(section) or {},
            previous_pitch,
            str(record.get("sample_id") or ""),
        )
        notes.extend(line_notes)
    return notes, total_duration_s


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
        delta = tick - previous_tick
        track.extend(encode_varlen(delta))
        track.extend(payload)
        previous_tick = tick

    track.extend(b"\x00\xFF\x2F\x00")
    header = b"MThd" + (6).to_bytes(4, "big") + (0).to_bytes(2, "big") + (1).to_bytes(2, "big") + TPQ.to_bytes(2, "big")
    chunk = b"MTrk" + len(track).to_bytes(4, "big") + bytes(track)
    return header + chunk


def main():
    parser = argparse.ArgumentParser(description="Autofill coarse melody MIDI files and update intake manifest rows.")
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
    melodic_rows = []
    melodic_count = 0
    note_total = 0

    for row in rows:
        row = dict(row)
        existing_path = Path(row.get("melody_midi") or "")
        if row.get("melody_midi") and existing_path.exists():
            source_counts["existing"] += 1
            melodic_rows.append(row)
            continue

        notes, duration_s = build_note_plan(row)
        midi_path = midi_path_for(row)
        if midi_path is None:
            needs = dict(row.get("needs_annotation") or {})
            needs["melody_midi"] = True
            row["needs_annotation"] = needs
            source_counts["missing_audio_path"] += 1
            melodic_rows.append(row)
            continue
        midi_path.write_bytes(build_midi_bytes(notes))
        row["melody_midi"] = str(midi_path)
        row["melody_midi_source"] = "heuristic_vocal_chord_midi_v1"
        row["melody_midi_summary"] = {
            "note_count": len(notes),
            "duration_s": round(duration_s, 3),
            "source": row["melody_midi_source"],
        }
        needs = dict(row.get("needs_annotation") or {})
        needs["melody_midi"] = False
        row["needs_annotation"] = needs
        source_counts[row["melody_midi_source"]] += 1
        melodic_count += 1
        note_total += len(notes)
        melodic_rows.append(row)

    write_jsonl(output_jsonl, melodic_rows)
    write_csv(output_csv, melodic_rows)

    stats = {
        "schema": "css.melody_midi_autofill.stats.v1",
        "records": len(rows),
        "melodic_records": melodic_count,
        "note_total": note_total,
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
