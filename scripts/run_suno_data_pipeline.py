#!/usr/bin/env python3
import argparse
import json
import subprocess
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_AUDIO_ROOT = REPO_ROOT / "data" / "music_raw"
SCRIPTS_DIR = REPO_ROOT / "scripts"


def run_step(name: str, cmd):
    completed = subprocess.run(cmd, capture_output=True, text=True)
    stdout = completed.stdout.strip()
    stderr = completed.stderr.strip()
    result = {
        "name": name,
        "ok": completed.returncode == 0,
        "returncode": completed.returncode,
        "command": cmd,
    }

    if stdout:
        try:
            result["stdout_json"] = json.loads(stdout.splitlines()[-1])
        except json.JSONDecodeError:
            result["stdout"] = stdout
    if stderr:
        result["stderr"] = stderr

    if completed.returncode != 0:
        raise RuntimeError(json.dumps(result, ensure_ascii=False))

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Run the full Suno data-preparation pipeline in one command."
    )
    parser.add_argument("--audio-root", default=str(DEFAULT_AUDIO_ROOT))
    parser.add_argument(
        "--source-filter",
        choices=["all", "suno", "unknown"],
        default="all",
        help="Restrict queue and repair-plan outputs to a specific source platform.",
    )
    args = parser.parse_args()

    audio_root = Path(args.audio_root).expanduser().resolve()
    python_bin = sys.executable

    steps = [
        (
            "layout_check",
            [
                python_bin,
                str(SCRIPTS_DIR / "check_suno_import_layout.py"),
                "--audio-root",
                str(audio_root),
                "--source-filter",
                args.source_filter,
            ],
        ),
        (
            "intake_manifest",
            [
                python_bin,
                str(SCRIPTS_DIR / "build_music_dataset_intake.py"),
                "--audio-root",
                str(audio_root),
            ],
        ),
        (
            "annotation_queue",
            [
                python_bin,
                str(SCRIPTS_DIR / "build_suno_annotation_queue.py"),
                "--source-filter",
                args.source_filter,
            ],
        ),
        (
            "field_repair_plan",
            [
                python_bin,
                str(SCRIPTS_DIR / "build_suno_field_repair_plan.py"),
                "--source-filter",
                args.source_filter,
            ],
        ),
        (
            "quality_scoring",
            [
                python_bin,
                str(SCRIPTS_DIR / "score_music_dataset_quality.py"),
            ],
        ),
    ]

    results = []
    for name, cmd in steps:
        results.append(run_step(name, cmd))

    summary = {
        "schema": "css.suno_data_pipeline_run.v1",
        "ok": True,
        "audio_root": str(audio_root),
        "source_filter": args.source_filter,
        "steps": results,
        "outputs": {
            "layout_report_jsonl": str(REPO_ROOT / "data" / "manifests" / "suno_import_layout_report.jsonl"),
            "layout_report_csv": str(REPO_ROOT / "data" / "manifests" / "suno_import_layout_report.csv"),
            "layout_report_stats_json": str(REPO_ROOT / "data" / "manifests" / "suno_import_layout_report.stats.json"),
            "intake_jsonl": str(REPO_ROOT / "data" / "manifests" / "music_dataset_intake.jsonl"),
            "intake_csv": str(REPO_ROOT / "data" / "manifests" / "music_dataset_intake.csv"),
            "annotation_queue_jsonl": str(REPO_ROOT / "data" / "manifests" / "suno_annotation_queue.jsonl"),
            "annotation_queue_csv": str(REPO_ROOT / "data" / "manifests" / "suno_annotation_queue.csv"),
            "annotation_queue_stats_json": str(REPO_ROOT / "data" / "manifests" / "suno_annotation_queue.stats.json"),
            "field_repair_plan_json": str(REPO_ROOT / "data" / "manifests" / "suno_field_repair_plan.json"),
            "field_repair_plan_csv": str(REPO_ROOT / "data" / "manifests" / "suno_field_repair_plan.csv"),
            "quality_jsonl": str(REPO_ROOT / "data" / "manifests" / "music_dataset_quality.jsonl"),
            "quality_csv": str(REPO_ROOT / "data" / "manifests" / "music_dataset_quality.csv"),
            "quality_stats_json": str(REPO_ROOT / "data" / "manifests" / "music_dataset_quality.stats.json"),
        },
    }

    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
