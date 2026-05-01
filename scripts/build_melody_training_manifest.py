#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_RUNS_ROOT = REPO_ROOT / "tmp_scene_runs"
DEFAULT_PROBES_ROOT = REPO_ROOT / "public" / "probes" / "westworld-prelude-i-live"
DEFAULT_OUTPUT = REPO_ROOT / "data" / "manifests" / "melody_training_manifest.jsonl"


def load_json(path: Path):
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def read_first_existing(paths):
    for path in paths:
        if path.exists():
            return path
    return None


def extract_scene_number(run_id: str, title: str):
    raw = f"{run_id} {title}"
    match = re.search(r"scene[_\- ]?0*([0-9]+)", raw, re.IGNORECASE)
    if match:
        return int(match.group(1))
    return None


def parse_section_blocks(full_lyrics: str):
    lines = [line.rstrip() for line in str(full_lyrics or "").splitlines()]
    blocks = []
    current = None
    for line in lines:
      stripped = line.strip()
      if not stripped:
          continue
      if stripped.startswith("[") and stripped.endswith("]"):
          if current and current["lines"]:
              blocks.append(current)
          current = {"label": stripped[1:-1], "lines": []}
          continue
      if current is None:
          current = {"label": "Untitled", "lines": []}
      current["lines"].append(stripped)
    if current and current["lines"]:
        blocks.append(current)
    return blocks


def build_timed_sections(lines):
    grouped = []
    current = None
    for item in lines:
        section = str(item.get("section") or "Unknown").strip() or "Unknown"
        text = str(item.get("text") or "").strip()
        start_s = float(item.get("t") or 0.0)
        if not text:
            continue
        if current is None or current["section"] != section:
            if current is not None:
                grouped.append(current)
            current = {
                "section": section,
                "start_s": start_s,
                "end_s": start_s,
                "line_count": 0,
                "lines": [],
            }
        current["lines"].append({"t": start_s, "text": text})
        current["line_count"] += 1
        current["end_s"] = start_s
    if current is not None:
        grouped.append(current)
    return grouped


def extract_stem_names(stems_payload):
    if isinstance(stems_payload, dict):
        if isinstance(stems_payload.get("stems"), list):
            return [str(item.get("stem") or item.get("name") or "").strip() for item in stems_payload["stems"] if str(item.get("stem") or item.get("name") or "").strip()]
        if isinstance(stems_payload.get("stem_lanes"), list):
            return [str(item.get("stem") or item.get("name") or "").strip() for item in stems_payload["stem_lanes"] if str(item.get("stem") or item.get("name") or "").strip()]
    if isinstance(stems_payload, list):
        return [str(item.get("stem") or item.get("name") or "").strip() for item in stems_payload if isinstance(item, dict) and str(item.get("stem") or item.get("name") or "").strip()]
    return []


def extract_chord_progression(music_plan):
    if not isinstance(music_plan, dict):
        return []
    harmony = music_plan.get("harmony")
    if isinstance(harmony, dict) and isinstance(harmony.get("progression_templates"), list):
        out = []
        for item in harmony["progression_templates"]:
            if not isinstance(item, dict):
                continue
            out.append(
                {
                    "section_match": item.get("section_match"),
                    "numeral_path": item.get("numeral_path") or [],
                    "cadence": item.get("cadence"),
                    "chord_targets": item.get("chord_targets") or [],
                }
            )
        return out
    sections = music_plan.get("sections")
    if isinstance(sections, list):
        out = []
        for item in sections:
            if not isinstance(item, dict):
                continue
            frames = item.get("progression_frames") or []
            numeral_path = [frame.get("numeral") for frame in frames if isinstance(frame, dict) and frame.get("numeral")]
            chord_targets = [frame.get("chord_target") for frame in frames if isinstance(frame, dict) and frame.get("chord_target")]
            if numeral_path or chord_targets:
                out.append(
                    {
                        "section_match": item.get("section"),
                        "numeral_path": numeral_path,
                        "cadence": None,
                        "chord_targets": chord_targets,
                    }
                )
        return out
    return []


def find_final_mix_references(run_dir: Path, probes_root: Path, scene_number):
    refs = []
    for candidate in [
        run_dir / "build" / "master.mp3",
        run_dir / "build" / "mix_master.mp3",
        run_dir / "build" / "final_master.mp3",
        run_dir / "build" / "finalize_master.mp3",
    ]:
        if candidate.exists():
            refs.append(str(candidate))
    if scene_number is not None and probes_root.exists():
        pattern = f"scene{scene_number:02d}*"
        refs.extend(str(path) for path in sorted(probes_root.glob(pattern)) if path.is_file())
    deduped = []
    seen = set()
    for item in refs:
        if item in seen:
            continue
        seen.add(item)
        deduped.append(item)
    return deduped


def build_record(run_dir: Path, probes_root: Path):
    run_json_path = run_dir / "run.json"
    lyrics_path = run_dir / "build" / "lyrics.json"
    if not run_json_path.exists() or not lyrics_path.exists():
        return None

    run_payload = load_json(run_json_path)
    lyrics_payload = load_json(lyrics_path)
    creative = lyrics_payload.get("creative") or {}
    full_lyrics_map = creative.get("lyric_versions") or {}
    primary_lang = str(lyrics_payload.get("lang") or "zh").strip() or "zh"
    full_lyrics = (
        full_lyrics_map.get(primary_lang)
        or next(iter(full_lyrics_map.values()), "")
        or ""
    )
    timed_lines = lyrics_payload.get("lines") if isinstance(lyrics_payload.get("lines"), list) else []
    title = (
        str(creative.get("title") or "").strip()
        or str(run_payload.get("creative_title") or "").strip()
        or str(run_payload.get("title") or "").strip()
    )
    run_id = str(run_payload.get("id") or run_dir.name).strip()
    scene_number = extract_scene_number(run_id, title)

    music_plan_path = read_first_existing(
        [
            run_dir / "build" / "music.plan.json",
            run_dir / "build" / "music_plan.json",
        ]
    )
    midi_draft_path = run_dir / "build" / "audio_provider_midi_draft.json"
    phrase_map_path = run_dir / "build" / "audio_provider_phrase_map.json"
    stems_plan_path = run_dir / "build" / "audio_provider_stems_plan.json"
    vocals_plan_path = run_dir / "build" / "vocals.plan.json"

    music_plan = load_json(music_plan_path) if music_plan_path and music_plan_path.exists() else {}
    stems_plan = load_json(stems_plan_path) if stems_plan_path.exists() else {}

    return {
        "schema": "css.melody_training_manifest.v1",
        "sample_id": run_id,
        "run_id": run_id,
        "title": title,
        "language": primary_lang,
        "work_type": creative.get("work_type"),
        "duration_s": creative.get("duration_s"),
        "full_lyrics": full_lyrics,
        "section_labels": [block["label"] for block in parse_section_blocks(full_lyrics)],
        "sections": build_timed_sections(timed_lines),
        "melody_midi": str(midi_draft_path) if midi_draft_path.exists() else None,
        "melody_plan": str(music_plan_path) if music_plan_path else None,
        "phrase_map": str(phrase_map_path) if phrase_map_path.exists() else None,
        "chord_progression": extract_chord_progression(music_plan),
        "stem_tracks": {
            "plan_path": str(stems_plan_path) if stems_plan_path.exists() else None,
            "names": extract_stem_names(stems_plan),
        },
        "vocal_timing": {
            "plan_path": str(vocals_plan_path) if vocals_plan_path.exists() else None,
            "lines": timed_lines,
        },
        "final_mix_references": find_final_mix_references(run_dir, probes_root, scene_number),
        "prompt": creative.get("prompt"),
        "source_artifacts": {
            "run_json": str(run_json_path),
            "lyrics_json": str(lyrics_path),
            "music_plan_json": str(music_plan_path) if music_plan_path else None,
            "midi_draft_json": str(midi_draft_path) if midi_draft_path.exists() else None,
            "phrase_map_json": str(phrase_map_path) if phrase_map_path.exists() else None,
            "stems_plan_json": str(stems_plan_path) if stems_plan_path.exists() else None,
            "vocals_plan_json": str(vocals_plan_path) if vocals_plan_path.exists() else None,
        },
    }


def discover_run_dirs(runs_root: Path):
    if not runs_root.exists():
        return []
    return sorted(
        path for path in runs_root.iterdir() if path.is_dir() and (path / "run.json").exists()
    )


def main():
    parser = argparse.ArgumentParser(
        description="Build a first-pass melody training manifest from run artifacts."
    )
    parser.add_argument("--runs-root", default=str(DEFAULT_RUNS_ROOT))
    parser.add_argument("--probes-root", default=str(DEFAULT_PROBES_ROOT))
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT))
    args = parser.parse_args()

    runs_root = Path(args.runs_root).expanduser().resolve()
    probes_root = Path(args.probes_root).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    output_path.parent.mkdir(parents=True, exist_ok=True)

    records = []
    for run_dir in discover_run_dirs(runs_root):
        record = build_record(run_dir, probes_root)
        if record is not None:
            records.append(record)

    with output_path.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False) + "\n")

    print(
        json.dumps(
            {
                "ok": True,
                "records": len(records),
                "output": str(output_path),
                "runs_root": str(runs_root),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
