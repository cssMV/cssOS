#!/usr/bin/env python3
import argparse
import json
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_BASE_MANIFEST = REPO_ROOT / "data" / "manifests" / "melody_training_manifest.enriched.jsonl"
DEFAULT_REAL_MANIFEST = REPO_ROOT / "data" / "manifests" / "melody_training_manifest.real.jsonl"
DEFAULT_COMBINED_MANIFEST = REPO_ROOT / "data" / "manifests" / "melody_training_manifest.auto.jsonl"
DEFAULT_REAL_OUTPUT_ROOT = REPO_ROOT / "data" / "autofill" / "real_project_melody_assets"
DEFAULT_REAL_STATS = REPO_ROOT / "data" / "manifests" / "melody_training_manifest.real.stats.json"
DEFAULT_UNIFIED_JSONL = REPO_ROOT / "data" / "manifests" / "unified_melody_dataset.auto.jsonl"
DEFAULT_UNIFIED_STATS_JSON = REPO_ROOT / "data" / "manifests" / "unified_melody_dataset.auto.stats.json"
DEFAULT_UNIFIED_STATS_CSV = REPO_ROOT / "data" / "manifests" / "unified_melody_dataset.auto.stats.csv"
DEFAULT_TRAINING_READY_JSONL = REPO_ROOT / "data" / "manifests" / "training_ready_melody_dataset.auto.jsonl"
DEFAULT_TRAINING_READY_STATS = REPO_ROOT / "data" / "manifests" / "training_ready_melody_dataset.auto.stats.json"
DEFAULT_QUALITY_JSONL = REPO_ROOT / "data" / "manifests" / "music_dataset_quality.jsonl"
DEFAULT_SPLIT_PREFIX = REPO_ROOT / "data" / "manifests" / "melody_training_auto"
DEFAULT_OUTPUT_DIR = REPO_ROOT / "data" / "models" / "auto"
DEFAULT_BASELINE_TRAIN = REPO_ROOT / "data" / "models" / "melody_phrase_model.internal_v2_realboost.metrics.json"
DEFAULT_BASELINE_TEST = REPO_ROOT / "data" / "models" / "melody_phrase_model.internal_v2_realboost.test_metrics.json"
DEFAULT_MODEL_REGISTRY_JSON = REPO_ROOT / "data" / "models" / "current_model_registry.json"
DEFAULT_MODEL_PROMOTION_JSON = REPO_ROOT / "data" / "models" / "latest_melody_model_promotion.json"


def run(cmd):
    print("$", " ".join(str(part) for part in cmd), flush=True)
    subprocess.run([str(part) for part in cmd], check=True)


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


def merge_manifests(base_rows, real_rows):
    merged = {}
    for row in base_rows + real_rows:
        sample_id = str(row.get("sample_id") or row.get("run_id") or "").strip()
        key = sample_id or f"row_{len(merged)}"
        merged[key] = row
    return list(merged.values())


def choose_sample_ids(training_ready_rows, limit: int):
    if limit <= 0:
        return []
    ranked = sorted(
        training_ready_rows,
        key=lambda row: (
            0 if str(row.get("source_kind") or "") == "internal_run" else 1,
            0 if "real_" in str(row.get("sample_id") or "") else 1,
            str(row.get("sample_id") or ""),
        ),
    )
    sample_ids = []
    for row in ranked:
        sample_id = str(row.get("sample_id") or "").strip()
        if not sample_id or sample_id in sample_ids:
            continue
        sample_ids.append(sample_id)
        if len(sample_ids) >= limit:
            break
    return sample_ids


def load_json(path: Path):
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def build_drift_risks(unified_stats, training_ready_stats, split_stats):
    drift_risks = []
    incomplete_records = int(unified_stats.get("incomplete_records") or 0)
    total_records = int(unified_stats.get("records") or 0)
    ready_records = int(training_ready_stats.get("training_ready_records") or 0)
    missing_field_counts = training_ready_stats.get("top_missing_field_counts") or {}
    split_counts = split_stats.get("by_split") or {}

    if total_records > 0 and incomplete_records == total_records:
        drift_risks.append("all_unified_records_incomplete")
    if total_records > 0 and ready_records == 0:
        drift_risks.append("no_training_ready_records")
    if int(missing_field_counts.get("melody_midi") or 0) >= max(1, total_records // 2):
        drift_risks.append("melody_midi_coverage_low")
    if int(missing_field_counts.get("vocal_timing") or 0) >= max(1, total_records // 2):
        drift_risks.append("vocal_timing_coverage_low")
    if split_counts and int(split_counts.get("train") or 0) == 0:
        drift_risks.append("train_split_empty")
    if split_counts and int(split_counts.get("val") or 0) == 0:
        drift_risks.append("val_split_empty")
    return drift_risks


def main():
    parser = argparse.ArgumentParser(
        description="Refresh real vocal samples, rebuild the existing melody dataset chain, then run training autoloop."
    )
    parser.add_argument("--artifacts-root", default=str(REPO_ROOT / "artifacts" / "cssmv"))
    parser.add_argument("--base-manifest", default=str(DEFAULT_BASE_MANIFEST))
    parser.add_argument("--real-manifest", default=str(DEFAULT_REAL_MANIFEST))
    parser.add_argument("--combined-manifest", default=str(DEFAULT_COMBINED_MANIFEST))
    parser.add_argument("--real-output-root", default=str(DEFAULT_REAL_OUTPUT_ROOT))
    parser.add_argument("--real-stats-json", default=str(DEFAULT_REAL_STATS))
    parser.add_argument("--remote-host", default="api-vm")
    parser.add_argument("--remote-workdir", default="/srv/cssos/tmp/cssos_real_extract")
    parser.add_argument("--skip-real-extract", action="store_true")
    parser.add_argument("--unified-jsonl", default=str(DEFAULT_UNIFIED_JSONL))
    parser.add_argument("--unified-stats-json", default=str(DEFAULT_UNIFIED_STATS_JSON))
    parser.add_argument("--unified-stats-csv", default=str(DEFAULT_UNIFIED_STATS_CSV))
    parser.add_argument("--training-ready-jsonl", default=str(DEFAULT_TRAINING_READY_JSONL))
    parser.add_argument("--training-ready-stats-json", default=str(DEFAULT_TRAINING_READY_STATS))
    parser.add_argument("--quality-jsonl", default=str(DEFAULT_QUALITY_JSONL))
    parser.add_argument("--split-prefix", default=str(DEFAULT_SPLIT_PREFIX))
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR))
    parser.add_argument("--baseline-train-metrics", default=str(DEFAULT_BASELINE_TRAIN))
    parser.add_argument("--baseline-test-metrics", default=str(DEFAULT_BASELINE_TEST))
    parser.add_argument("--baseline-label", default="internal_v2_realboost")
    parser.add_argument("--run-prefix", default="internal_v2_auto")
    parser.add_argument("--epochs", type=int, default=8)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--max-cycles", type=int, default=2)
    parser.add_argument("--target-pitch-accuracy", type=float, default=0.4)
    parser.add_argument("--target-duration-accuracy", type=float, default=0.95)
    parser.add_argument("--target-note-mask-f1", type=float, default=0.999)
    parser.add_argument("--sample-id-limit", type=int, default=3)
    parser.add_argument("--promote-on-success", action="store_true")
    parser.add_argument("--model-registry-json", default=str(DEFAULT_MODEL_REGISTRY_JSON))
    parser.add_argument("--model-promotion-json", default=str(DEFAULT_MODEL_PROMOTION_JSON))
    parser.add_argument("--summary-json", default="")
    args = parser.parse_args()

    artifacts_root = Path(args.artifacts_root).expanduser().resolve()
    base_manifest = Path(args.base_manifest).expanduser().resolve()
    real_manifest = Path(args.real_manifest).expanduser().resolve()
    combined_manifest = Path(args.combined_manifest).expanduser().resolve()
    real_output_root = Path(args.real_output_root).expanduser().resolve()
    real_stats_json = Path(args.real_stats_json).expanduser().resolve()
    unified_jsonl = Path(args.unified_jsonl).expanduser().resolve()
    unified_stats_json = Path(args.unified_stats_json).expanduser().resolve()
    unified_stats_csv = Path(args.unified_stats_csv).expanduser().resolve()
    training_ready_jsonl = Path(args.training_ready_jsonl).expanduser().resolve()
    training_ready_stats_json = Path(args.training_ready_stats_json).expanduser().resolve()
    quality_jsonl = Path(args.quality_jsonl).expanduser().resolve()
    split_prefix = Path(args.split_prefix).expanduser().resolve()
    output_dir = Path(args.output_dir).expanduser().resolve()
    baseline_train_metrics = Path(args.baseline_train_metrics).expanduser().resolve()
    baseline_test_metrics = Path(args.baseline_test_metrics).expanduser().resolve()
    model_registry_json = Path(args.model_registry_json).expanduser().resolve()
    model_promotion_json = Path(args.model_promotion_json).expanduser().resolve()

    target_path = (
        Path(args.summary_json).expanduser().resolve()
        if args.summary_json
        else (output_dir / f"{args.run_prefix}.pipeline.summary.json")
    )

    def finalize(summary: dict):
        target_path.parent.mkdir(parents=True, exist_ok=True)
        target_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
        print(json.dumps(summary, ensure_ascii=False))

    if not args.skip_real_extract:
        real_extract_cmd = [
            "python3",
            REPO_ROOT / "scripts" / "extract_real_project_melody_dataset.py",
            "--artifacts-root",
            artifacts_root,
            "--output-jsonl",
            real_manifest,
            "--output-root",
            real_output_root,
            "--stats-json",
            real_stats_json,
            "--remote-host",
            args.remote_host,
            "--remote-workdir",
            args.remote_workdir,
        ]
        try:
            run(real_extract_cmd)
        except subprocess.CalledProcessError as exc:
            finalize(
                {
                    "schema": "css.melody_training_auto_pipeline.summary.v1",
                    "ok": False,
                    "reason": "real_extract_failed",
                    "error": {
                        "returncode": exc.returncode,
                        "command": [str(part) for part in (exc.cmd or real_extract_cmd)],
                    },
                    "inputs": {
                        "combined_manifest": str(combined_manifest),
                        "quality_jsonl": str(quality_jsonl),
                    },
                    "stats": {
                        "unified_stats_json": str(unified_stats_json),
                        "training_ready_stats_json": str(training_ready_stats_json),
                        "real_stats_json": str(real_stats_json),
                    },
                }
            )
            return

    merged_rows = merge_manifests(load_jsonl(base_manifest), load_jsonl(real_manifest))
    write_jsonl(combined_manifest, merged_rows)

    run(
        [
            "python3",
            REPO_ROOT / "scripts" / "build_unified_melody_dataset.py",
            "--melody-manifest",
            combined_manifest,
            "--output-jsonl",
            unified_jsonl,
            "--stats-json",
            unified_stats_json,
            "--stats-csv",
            unified_stats_csv,
        ]
    )
    run(
        [
            "python3",
            REPO_ROOT / "scripts" / "build_training_ready_melody_dataset.py",
            "--input-jsonl",
            unified_jsonl,
            "--output-jsonl",
            training_ready_jsonl,
            "--stats-json",
            training_ready_stats_json,
            "--quality-jsonl",
            quality_jsonl,
        ]
    )

    train_jsonl = split_prefix.with_suffix(".train.jsonl")
    val_jsonl = split_prefix.with_suffix(".val.jsonl")
    test_jsonl = split_prefix.with_suffix(".test.jsonl")
    index_csv = split_prefix.with_suffix(".splits.index.csv")
    split_stats_json = split_prefix.with_suffix(".splits.stats.json")
    run(
        [
            "python3",
            REPO_ROOT / "scripts" / "build_melody_dataset_splits.py",
            "--input-jsonl",
            training_ready_jsonl,
            "--train-jsonl",
            train_jsonl,
            "--val-jsonl",
            val_jsonl,
            "--test-jsonl",
            test_jsonl,
            "--index-csv",
            index_csv,
            "--stats-json",
            split_stats_json,
        ]
    )

    unified_stats = load_json(unified_stats_json)
    training_ready_stats = load_json(training_ready_stats_json)
    split_stats = load_json(split_stats_json)
    training_ready_records = int(training_ready_stats.get("training_ready_records") or 0)
    split_counts = split_stats.get("by_split") or {}
    train_count = int(split_counts.get("train") or 0)
    val_count = int(split_counts.get("val") or 0)
    drift_risks = build_drift_risks(unified_stats, training_ready_stats, split_stats)

    if training_ready_records == 0 or train_count == 0 or val_count == 0:
        summary = {
            "schema": "css.melody_training_auto_pipeline.summary.v1",
            "ok": False,
            "reason": "insufficient_training_ready_data",
            "training_ready_records": training_ready_records,
            "split_counts": split_counts,
            "drift_risks": drift_risks,
            "inputs": {
                "combined_manifest": str(combined_manifest),
                "quality_jsonl": str(quality_jsonl),
            },
            "stats": {
                "unified_stats_json": str(unified_stats_json),
                "training_ready_stats_json": str(training_ready_stats_json),
                "split_stats_json": str(split_stats_json),
            },
        }
        finalize(summary)
        return

    sample_ids = choose_sample_ids(load_jsonl(test_jsonl), args.sample_id_limit)
    try:
        import torch  # noqa: F401
    except Exception as exc:
        finalize(
            {
                "schema": "css.melody_training_auto_pipeline.summary.v1",
                "ok": False,
                "reason": "torch_unavailable",
                "training_ready_records": training_ready_records,
                "split_counts": split_counts,
                "sample_ids": sample_ids,
                "drift_risks": sorted(set([*drift_risks, "torch_missing"])),
                "error": {
                    "message": str(exc),
                },
                "inputs": {
                    "combined_manifest": str(combined_manifest),
                    "quality_jsonl": str(quality_jsonl),
                },
                "stats": {
                    "unified_stats_json": str(unified_stats_json),
                    "training_ready_stats_json": str(training_ready_stats_json),
                    "split_stats_json": str(split_stats_json),
                },
            }
        )
        return

    autoloop_cmd = [
        "python3",
        REPO_ROOT / "scripts" / "run_melody_training_autoloop.py",
        "--train-jsonl",
        train_jsonl,
        "--val-jsonl",
        val_jsonl,
        "--test-jsonl",
        test_jsonl,
        "--output-dir",
        output_dir,
        "--baseline-train-metrics",
        baseline_train_metrics,
        "--baseline-test-metrics",
        baseline_test_metrics,
        "--baseline-label",
        args.baseline_label,
        "--run-prefix",
        args.run_prefix,
        "--epochs",
        str(args.epochs),
        "--batch-size",
        str(args.batch_size),
        "--lr",
        str(args.lr),
        "--max-cycles",
        str(args.max_cycles),
        "--target-pitch-accuracy",
        str(args.target_pitch_accuracy),
        "--target-duration-accuracy",
        str(args.target_duration_accuracy),
        "--target-note-mask-f1",
        str(args.target_note_mask_f1),
    ]
    if sample_ids:
        autoloop_cmd.extend(["--sample-ids", *sample_ids])
    try:
        run(autoloop_cmd)
    except subprocess.CalledProcessError as exc:
        finalize(
            {
                "schema": "css.melody_training_auto_pipeline.summary.v1",
                "ok": False,
                "reason": "autoloop_failed",
                "training_ready_records": training_ready_records,
                "split_counts": split_counts,
                "sample_ids": sample_ids,
                "drift_risks": drift_risks,
                "error": {
                    "returncode": exc.returncode,
                    "command": [str(part) for part in (exc.cmd or autoloop_cmd)],
                },
                "inputs": {
                    "combined_manifest": str(combined_manifest),
                    "quality_jsonl": str(quality_jsonl),
                },
                "stats": {
                    "unified_stats_json": str(unified_stats_json),
                    "training_ready_stats_json": str(training_ready_stats_json),
                    "split_stats_json": str(split_stats_json),
                    "autoloop_summary": str(output_dir / f"{args.run_prefix}.autoloop.summary.json"),
                    "autoloop_log": str(output_dir / f"{args.run_prefix}.autoloop.log"),
                },
            }
        )
        return

    autoloop_summary = output_dir / f"{args.run_prefix}.autoloop.summary.json"
    pipeline_summary = {
        "schema": "css.melody_training_auto_pipeline.summary.v1",
        "ok": True,
        "reason": "autoloop_completed",
        "training_ready_records": training_ready_records,
        "split_counts": split_counts,
        "sample_ids": sample_ids,
        "drift_risks": drift_risks,
        "stats": {
            "unified_stats_json": str(unified_stats_json),
            "training_ready_stats_json": str(training_ready_stats_json),
            "split_stats_json": str(split_stats_json),
            "autoloop_summary": str(autoloop_summary),
        },
    }

    if args.promote_on_success:
        run(
            [
                "python3",
                REPO_ROOT / "scripts" / "promote_melody_training_champion.py",
                "--autoloop-summary",
                autoloop_summary,
                "--registry-json",
                model_registry_json,
                "--promotion-json",
                model_promotion_json,
            ]
        )
        pipeline_summary["promotion_attempted"] = True

    finalize(pipeline_summary)


if __name__ == "__main__":
    main()
