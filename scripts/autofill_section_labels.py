#!/usr/bin/env python3
import argparse
import csv
import json
import re
from collections import Counter
from pathlib import Path


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
NON_STRUCTURAL_BRACKET_RE = re.compile(r"^\[[^\]]+\]$")
BRACKET_TOKEN_RE = re.compile(r"\[([^\]]+)\]")


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
            fieldnames=["sample_id", "title", "section_labels", "source"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "sample_id": row.get("sample_id"),
                    "title": row.get("title"),
                    "section_labels": "|".join(row.get("section_labels") or []),
                    "source": row.get("section_label_source") or "",
                }
            )


def canonicalize_tag(tag: str):
    lowered = re.sub(r"\s+", " ", str(tag or "").strip().lower())
    for key, value in STRUCTURAL_HINTS.items():
        if lowered.startswith(key):
            suffix = lowered[len(key):].strip()
            if suffix and suffix[0].isdigit():
                return f"{value} {suffix}"
            return value
    return None


def explicit_labels_from_text(text: str):
    labels = []
    for line in str(text or "").splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        for token in BRACKET_TOKEN_RE.findall(stripped):
            canonical = canonicalize_tag(token)
            if canonical:
                labels.append(canonical)
    return labels


def split_blocks(text: str):
    text = str(text or "").replace("\r\n", "\n").replace("\r", "\n")
    return [block.strip() for block in re.split(r"\n\s*\n", text) if block.strip()]


def lyrical_lines(block: str):
    lines = []
    for line in block.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if NON_STRUCTURAL_BRACKET_RE.match(stripped):
            continue
        lines.append(stripped)
    return lines


def normalized_signature(block: str):
    lines = lyrical_lines(block)
    if not lines:
        return ""
    joined = " ".join(lines[:4]).lower()
    joined = re.sub(r"\s+", " ", joined)
    joined = re.sub(r"[^\w\u4e00-\u9fff]+", "", joined)
    return joined


def infer_labels_from_blocks(text: str):
    blocks = split_blocks(text)
    if not blocks:
        return [], "none"

    explicit = []
    for block in blocks:
        labels = explicit_labels_from_text(block)
        if labels:
            explicit.extend(labels)
    if explicit:
        return explicit, "explicit_brackets"

    lyrical_blocks = [block for block in blocks if lyrical_lines(block)]
    if not lyrical_blocks:
        return [], "none"

    signatures = [normalized_signature(block) for block in lyrical_blocks]
    signature_counts = Counter(sig for sig in signatures if sig)
    repeated = {
        sig for sig, count in signature_counts.items()
        if sig and count >= 2
    }

    labels = []
    verse_index = 1
    chorus_index = 1
    for idx, block in enumerate(lyrical_blocks):
        sig = signatures[idx]
        lines = lyrical_lines(block)
        line_count = len(lines)
        if idx == 0 and line_count <= 2:
            labels.append("Intro")
            continue
        if idx == len(lyrical_blocks) - 1 and line_count <= 3:
            labels.append("Outro")
            continue
        if sig in repeated:
            labels.append(f"Chorus {chorus_index}")
            chorus_index += 1
            continue
        if idx == len(lyrical_blocks) - 2 and chorus_index >= 2:
            labels.append("Bridge")
            continue
        labels.append(f"Verse {verse_index}")
        verse_index += 1

    return labels, "heuristic_blocks"


def main():
    parser = argparse.ArgumentParser(description="Autofill missing section labels in the music dataset intake manifest.")
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
    autofilled = 0
    source_counts = Counter()
    for row in rows:
        labels = row.get("section_labels") or []
        if labels:
            row["section_label_source"] = row.get("section_label_source") or "existing"
            source_counts[row["section_label_source"]] += 1
            continue
        inferred, source = infer_labels_from_blocks(row.get("full_lyrics") or "")
        row["section_labels"] = inferred
        row["section_label_source"] = source
        if inferred:
            autofilled += 1
        source_counts[source] += 1
        needs = row.get("needs_annotation") or {}
        needs["sections"] = not bool(inferred)
        row["needs_annotation"] = needs

    write_jsonl(output_jsonl, rows)
    write_csv(output_csv, rows)

    stats = {
        "schema": "css.section_autofill.stats.v1",
        "records": len(rows),
        "autofilled_records": autofilled,
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
