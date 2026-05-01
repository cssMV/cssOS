#!/usr/bin/env python3
import argparse
import json
import subprocess
from pathlib import Path


def run(cmd):
    print("$", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def main():
    parser = argparse.ArgumentParser(
        description="Run one automated melody training cycle: train v2, eval v2, compare with champion."
    )
    parser.add_argument("--train-jsonl", required=True)
    parser.add_argument("--val-jsonl", required=True)
    parser.add_argument("--test-jsonl", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--baseline-train-metrics", required=True)
    parser.add_argument("--baseline-test-metrics", required=True)
    parser.add_argument("--baseline-label", default="v2_24e")
    parser.add_argument("--run-label", default="v2_cycle")
    parser.add_argument("--epochs", type=int, default=28)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    model_out = output_dir / f"melody_phrase_model.{args.run_label}.pt"
    train_metrics_out = output_dir / f"melody_phrase_model.{args.run_label}.metrics.json"
    test_metrics_out = output_dir / f"melody_phrase_model.{args.run_label}.test_metrics.json"
    comparison_out = output_dir / f"melody_phrase_model.{args.run_label}.comparison.json"
    summary_out = output_dir / f"melody_phrase_model.{args.run_label}.summary.json"

    run(
        [
            "python3",
            str(root / "train_melody_phrase_model_v2.py"),
            "--train-jsonl",
            str(Path(args.train_jsonl).expanduser().resolve()),
            "--val-jsonl",
            str(Path(args.val_jsonl).expanduser().resolve()),
            "--model-out",
            str(model_out),
            "--metrics-out",
            str(train_metrics_out),
            "--epochs",
            str(args.epochs),
            "--batch-size",
            str(args.batch_size),
            "--lr",
            str(args.lr),
        ]
    )
    run(
        [
            "python3",
            str(root / "eval_melody_phrase_model_v2.py"),
            "--test-jsonl",
            str(Path(args.test_jsonl).expanduser().resolve()),
            "--model-path",
            str(model_out),
            "--metrics-out",
            str(test_metrics_out),
            "--batch-size",
            str(args.batch_size),
        ]
    )
    run(
        [
            "python3",
            str(root / "build_melody_model_comparison.py"),
            "--label-a",
            args.baseline_label,
            "--train-metrics-a",
            str(Path(args.baseline_train_metrics).expanduser().resolve()),
            "--test-metrics-a",
            str(Path(args.baseline_test_metrics).expanduser().resolve()),
            "--label-b",
            args.run_label,
            "--train-metrics-b",
            str(train_metrics_out),
            "--test-metrics-b",
            str(test_metrics_out),
            "--output-json",
            str(comparison_out),
        ]
    )

    train_metrics = load_json(train_metrics_out)
    test_metrics = load_json(test_metrics_out)
    comparison = load_json(comparison_out)
    summary = {
        "schema": "css.melody_training_cycle.summary.v1",
        "run_label": args.run_label,
        "epochs": args.epochs,
        "batch_size": args.batch_size,
        "lr": args.lr,
        "outputs": {
            "model": str(model_out),
            "train_metrics": str(train_metrics_out),
            "test_metrics": str(test_metrics_out),
            "comparison": str(comparison_out),
        },
        "highlights": {
            "best_val_loss": train_metrics.get("best_val_loss"),
            "test_loss": test_metrics.get("loss"),
            "pitch_accuracy": test_metrics.get("pitch_accuracy"),
            "duration_accuracy": test_metrics.get("duration_accuracy"),
            "note_mask_f1": test_metrics.get("note_mask_f1"),
        },
        "better_by_metric": comparison.get("better_by_metric") or {},
    }
    summary_out.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
