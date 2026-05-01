#!/usr/bin/env python3
import argparse
import csv
import json
import math
import re
from collections import Counter
from pathlib import Path


DEFAULT_DURATION_S = 180.0
MIN_LINE_DURATION_S = 1.2
MIN_GAP_S = 0.12
MAX_GAP_S = 0.42
STRUCTURAL_HINTS = {
    "intro": "Intro",
    "verse": "Verse",
    "chorus": "Chorus",
    "hook": "Chorus",
    "refrain": "Chorus",
    "bridge": "Bridge",
    "outro": "Outro",
    "pre-chorus": "Pre-Chorus",
    "pre chorus": "Pre-Chorus",
    "post-chorus": "Post-Chorus",
    "post chorus": "Post-Chorus",
}
NON_LYRIC_BRACKET_HINTS = {
    "instrumental",
    "solo",
    "guitar",
    "piano",
    "violin",
    "strings",
    "music",
    "beat",
    "drop",
    "interlude",
    "spoken",
}
BRACKET_LINE_RE = re.compile(r"^[\[\(【（<《]\s*([^\]\)】）》>]+?)\s*[\]\)】）》>]$")


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
                "line_count",
                "duration_s",
                "timing_source",
                "vocal_timing_path",
            ],
        )
        writer.writeheader()
        for row in rows:
            timing = row.get("vocal_timing") or {}
            writer.writerow(
                {
                    "sample_id": row.get("sample_id"),
                    "title": row.get("title"),
                    "line_count": len(timing.get("lines") or []),
                    "duration_s": timing.get("duration_s"),
                    "timing_source": timing.get("source"),
                    "vocal_timing_path": row.get("vocal_timing_path"),
                }
            )


def read_text(path: Path):
    try:
        return path.read_text(encoding="utf-8").strip()
    except UnicodeDecodeError:
        return path.read_text(encoding="utf-8-sig").strip()


def canonicalize_tag(tag: str):
    lowered = re.sub(r"\s+", " ", str(tag or "").strip().lower())
    for key, value in STRUCTURAL_HINTS.items():
        if lowered.startswith(key):
            suffix = lowered[len(key):].strip()
            if suffix and suffix[0].isdigit():
                return f"{value} {suffix}"
            return value
    return None


def normalize_section_labels(labels):
    normalized = []
    seen = set()
    for label in labels or []:
        canonical = canonicalize_tag(label)
        if not canonical:
            continue
        key = canonical.lower()
        if key in seen:
            continue
        seen.add(key)
        normalized.append(canonical)
    return normalized


def resolved_section_labels(existing_labels, timing_sections):
    normalized_existing = normalize_section_labels(existing_labels)
    if normalized_existing:
        return normalized_existing
    cleaned = []
    seen = set()
    for label in timing_sections or []:
        value = str(label or "").strip()
        if not value:
            continue
        key = value.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(value)
    return cleaned


def block_gap_s(block_index: int, total_blocks: int):
    if total_blocks <= 1:
        return 0.0
    edge_factor = 0.9 if block_index in {0, total_blocks - 1} else 1.0
    return max(MIN_GAP_S, min(MAX_GAP_S, 0.28 * edge_factor))


def line_pause_after_s(text: str):
    stripped = str(text or "").strip()
    if not stripped:
        return 0.16
    if stripped.endswith(("?", "？", "!", "！")):
        return 0.34
    if stripped.endswith((".", "。", ";", "；", ":", "：")):
        return 0.30
    if stripped.endswith((",", "，", "、")):
        return 0.22
    return 0.14


def line_weight(text: str):
    stripped = str(text or "").strip()
    if not stripped:
        return 1.0
    visible = re.sub(r"\s+", "", stripped)
    wordish = re.findall(r"[\w\u4e00-\u9fff]+", visible, flags=re.UNICODE)
    token_count = max(1, len(wordish))
    char_count = max(1, len(visible))
    punctuation_bonus = len(re.findall(r"[，,。.!！？?；;：:、]", stripped)) * 0.65
    return max(1.0, token_count * 0.9 + math.sqrt(char_count) + punctuation_bonus)


def is_non_lyric_bracket(line: str):
    match = BRACKET_LINE_RE.match(str(line or "").strip())
    if not match:
        return False
    token = match.group(1).strip().lower()
    if canonicalize_tag(token):
        return False
    return True


def parse_lyric_blocks(text: str, fallback_sections):
    text = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    raw_blocks = [block.strip() for block in re.split(r"\n\s*\n", text) if block.strip()]
    blocks = []
    fallback_sections = list(fallback_sections or [])
    fallback_index = 0

    def flush_block(section_name, line_buffer):
        nonlocal fallback_index
        if not line_buffer:
            return
        resolved = section_name
        if resolved is None and fallback_index < len(fallback_sections):
            resolved = fallback_sections[fallback_index]
        if resolved:
            fallback_index += 1
        blocks.append({"section": resolved or f"Section {len(blocks) + 1}", "lines": list(line_buffer)})

    for raw_block in raw_blocks:
        lines = []
        section = None
        for raw_line in raw_block.splitlines():
            line = raw_line.strip()
            if not line:
                continue
            bracket_match = BRACKET_LINE_RE.match(line)
            if bracket_match:
                maybe_section = canonicalize_tag(bracket_match.group(1))
                if maybe_section:
                    flush_block(section, lines)
                    lines = []
                    section = maybe_section
                    continue
            if is_non_lyric_bracket(line):
                continue
            lines.append(line)

        flush_block(section, lines)

    if blocks:
        return blocks

    lines = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line or is_non_lyric_bracket(line):
            continue
        lines.append(line)
    if not lines:
        return []
    section = fallback_sections[0] if fallback_sections else "Section 1"
    return [{"section": section, "lines": lines}]


def duration_from_metadata(audio_path: Path):
    if not str(audio_path or "").strip() or audio_path.name == "":
        return DEFAULT_DURATION_S, "default"
    sidecar = audio_path.with_suffix(".suno.json")
    if not sidecar.exists():
        return DEFAULT_DURATION_S, "default"
    try:
        payload = json.loads(sidecar.read_text(encoding="utf-8"))
    except Exception:
        return DEFAULT_DURATION_S, "default"
    metadata = payload.get("metadata") or {}
    duration = metadata.get("duration")
    try:
        if duration is not None:
            return max(1.0, float(duration)), "suno_metadata"
    except (TypeError, ValueError):
        pass
    return DEFAULT_DURATION_S, "default"


def allocate_lines(blocks, duration_s):
    flat_lines = []
    total_gaps = 0.0
    for index, block in enumerate(blocks):
        for line in block["lines"]:
            flat_lines.append(
                {
                    "section": block["section"],
                    "text": line,
                    "pause_after_s": line_pause_after_s(line),
                }
            )
        if index < len(blocks) - 1:
            total_gaps += block_gap_s(index, len(blocks))

    if not flat_lines:
        return []

    total_line_weight = sum(line_weight(line["text"]) for line in flat_lines)
    total_pause_weight = sum(item["pause_after_s"] for item in flat_lines[:-1])
    minimum_required = len(flat_lines) * MIN_LINE_DURATION_S + total_gaps
    available = max(duration_s, minimum_required)
    speaking_budget = max(len(flat_lines) * MIN_LINE_DURATION_S, available - total_gaps)
    stretch_budget = max(0.0, speaking_budget - len(flat_lines) * MIN_LINE_DURATION_S)
    pause_budget = min(stretch_budget * 0.26, total_pause_weight) if total_pause_weight else 0.0
    voice_budget = speaking_budget - pause_budget

    current_time = 0.0
    block_index = 0
    line_index = 0
    emitted = []
    for block in blocks:
        for block_line in block["lines"]:
            item = flat_lines[line_index]
            weight = line_weight(block_line)
            extra = 0.0 if total_line_weight <= 0 else (voice_budget - len(flat_lines) * MIN_LINE_DURATION_S) * (weight / total_line_weight)
            line_duration = MIN_LINE_DURATION_S + extra
            start_s = current_time
            end_s = min(duration_s, start_s + line_duration)
            pause_after_s = 0.0
            if line_index < len(flat_lines) - 1 and total_pause_weight > 0:
                pause_after_s = pause_budget * (item["pause_after_s"] / total_pause_weight)
            emitted.append(
                {
                    "index": line_index + 1,
                    "block_index": block_index + 1,
                    "section": item["section"],
                    "text": item["text"],
                    "start_s": round(start_s, 3),
                    "end_s": round(end_s, 3),
                    "pause_after_s": round(pause_after_s, 3),
                }
            )
            current_time = end_s + pause_after_s
            line_index += 1
        if block_index < len(blocks) - 1:
            current_time += block_gap_s(block_index, len(blocks))
        block_index += 1

    if emitted:
        overflow = emitted[-1]["end_s"] - duration_s
        if overflow > 0:
            emitted[-1]["end_s"] = round(max(emitted[-1]["start_s"], duration_s), 3)

    return emitted


def build_vocal_timing(record):
    lyrics_path = Path(record.get("lyrics_path") or "")
    audio_path = Path(record.get("audio_path") or "")
    if not lyrics_path.exists() or not audio_path.exists():
        return None

    lyrics_text = record.get("full_lyrics")
    if not lyrics_text:
        lyrics_text = read_text(lyrics_path)
    cleaned_sections = normalize_section_labels(record.get("section_labels") or [])
    blocks = parse_lyric_blocks(lyrics_text, cleaned_sections)
    if not blocks:
        return None

    duration_s, duration_source = duration_from_metadata(audio_path)
    lines = allocate_lines(blocks, duration_s)
    if not lines:
        return None

    return {
        "schema": "css.vocal_timing.v1",
        "source": "heuristic_duration_text_v1",
        "duration_source": duration_source,
        "duration_s": round(duration_s, 3),
        "line_count": len(lines),
        "sections": [block["section"] for block in blocks],
        "lines": lines,
    }


def sidecar_path_for(record):
    audio_path = Path(record.get("audio_path") or "")
    if not str(audio_path or "").strip() or audio_path.name == "":
        return None
    return audio_path.with_suffix(".vocal_timing.json")


def main():
    parser = argparse.ArgumentParser(description="Autofill coarse vocal timing sidecars and update intake manifest rows.")
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
    timed_rows = []
    timed_count = 0
    source_counts = Counter()

    for row in rows:
        row = dict(row)
        if row.get("vocal_timing_path") and Path(row["vocal_timing_path"]).exists():
            source_counts["existing"] += 1
            timed_rows.append(row)
            continue

        timing = build_vocal_timing(row)
        if timing:
            sidecar_path = sidecar_path_for(row)
            if sidecar_path is None:
                needs = dict(row.get("needs_annotation") or {})
                needs["vocal_timing"] = True
                row["needs_annotation"] = needs
                source_counts["missing_audio_path"] += 1
                timed_rows.append(row)
                continue
            sidecar_path.write_text(json.dumps(timing, ensure_ascii=False, indent=2), encoding="utf-8")
            row["vocal_timing_path"] = str(sidecar_path)
            row["vocal_timing"] = timing
            row["section_labels"] = resolved_section_labels(row.get("section_labels"), timing.get("sections") or [])
            needs = dict(row.get("needs_annotation") or {})
            needs["sections"] = not bool(row.get("section_labels"))
            needs["vocal_timing"] = False
            row["needs_annotation"] = needs
            row["vocal_timing_source"] = timing["source"]
            source_counts[timing["source"]] += 1
            timed_count += 1
        else:
            needs = dict(row.get("needs_annotation") or {})
            needs["vocal_timing"] = True
            row["needs_annotation"] = needs
            source_counts["missing"] += 1

        timed_rows.append(row)

    write_jsonl(output_jsonl, timed_rows)
    write_csv(output_csv, timed_rows)

    stats = {
        "schema": "css.vocal_timing_autofill.stats.v1",
        "records": len(rows),
        "timed_records": timed_count,
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
