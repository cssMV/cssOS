#!/usr/bin/env python3
import argparse
import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = REPO_ROOT / "scripts"
DEFAULT_INPUT_JSONL = REPO_ROOT / "data" / "manifests" / "music_dataset_intake.jsonl"
DEFAULT_OUTPUT_ROOT = REPO_ROOT / "data" / "manifests" / "autofill_roundtrip"


def run_step(name, cmd):
    completed = subprocess.run([str(part) for part in cmd], capture_output=True, text=True)
    payload = {
      "name": name,
      "ok": completed.returncode == 0,
      "command": [str(part) for part in cmd],
    }
    if completed.stdout.strip():
      payload["stdout"] = completed.stdout.strip().splitlines()[-1]
    if completed.stderr.strip():
      payload["stderr"] = completed.stderr.strip().splitlines()[-1]
    if completed.returncode != 0:
      raise RuntimeError(json.dumps(payload, ensure_ascii=False))
    return payload


def main():
    parser = argparse.ArgumentParser(description="Autofill the four training-ready sidecars needed by melody training: vocal timing, chord progression, melody MIDI, and stems.")
    parser.add_argument("--input-jsonl", default=str(DEFAULT_INPUT_JSONL))
    parser.add_argument("--output-root", default=str(DEFAULT_OUTPUT_ROOT))
    parser.add_argument("--stats-json", default="")
    args = parser.parse_args()

    input_jsonl = Path(args.input_jsonl).expanduser().resolve()
    output_root = Path(args.output_root).expanduser().resolve()
    output_root.mkdir(parents=True, exist_ok=True)

    timing_jsonl = output_root / "music_dataset_with_vocal_timing.jsonl"
    timing_csv = output_root / "music_dataset_with_vocal_timing.csv"
    timing_stats = output_root / "music_dataset_with_vocal_timing.stats.json"
    chords_jsonl = output_root / "music_dataset_with_chords.jsonl"
    chords_csv = output_root / "music_dataset_with_chords.csv"
    chords_stats = output_root / "music_dataset_with_chords.stats.json"
    midi_jsonl = output_root / "music_dataset_with_midi.jsonl"
    midi_csv = output_root / "music_dataset_with_midi.csv"
    midi_stats = output_root / "music_dataset_with_midi.stats.json"
    stems_jsonl = output_root / "music_dataset_training_ready_sidecars.jsonl"
    stems_csv = output_root / "music_dataset_training_ready_sidecars.csv"
    stems_stats = output_root / "music_dataset_training_ready_sidecars.stats.json"

    steps = []
    steps.append(run_step("vocal_timing", [
      "python3", SCRIPTS_DIR / "autofill_vocal_timing.py",
      "--input-jsonl", input_jsonl,
      "--output-jsonl", timing_jsonl,
      "--output-csv", timing_csv,
      "--stats-json", timing_stats,
    ]))
    steps.append(run_step("chord_progression", [
      "python3", SCRIPTS_DIR / "autofill_chord_progression.py",
      "--input-jsonl", timing_jsonl,
      "--output-jsonl", chords_jsonl,
      "--output-csv", chords_csv,
      "--stats-json", chords_stats,
    ]))
    steps.append(run_step("melody_midi", [
      "python3", SCRIPTS_DIR / "autofill_melody_midi.py",
      "--input-jsonl", chords_jsonl,
      "--output-jsonl", midi_jsonl,
      "--output-csv", midi_csv,
      "--stats-json", midi_stats,
    ]))
    steps.append(run_step("stem_tracks", [
      "python3", SCRIPTS_DIR / "autofill_stem_tracks.py",
      "--input-jsonl", midi_jsonl,
      "--output-jsonl", stems_jsonl,
      "--output-csv", stems_csv,
      "--stats-json", stems_stats,
    ]))

    summary = {
      "schema": "css.training_ready_assets_autofill.summary.v1",
      "ok": True,
      "input_jsonl": str(input_jsonl),
      "output_root": str(output_root),
      "final_output_jsonl": str(stems_jsonl),
      "steps": steps,
    }
    stats_json = Path(args.stats_json).expanduser().resolve() if args.stats_json else output_root / "training_ready_assets_autofill.summary.json"
    stats_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
