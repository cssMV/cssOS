#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def pick_summary(train_metrics, test_metrics):
    history = train_metrics.get("history") or []
    last = history[-1] if history else {}
    return {
        "schema": train_metrics.get("schema"),
        "device": train_metrics.get("device"),
        "epochs": train_metrics.get("epochs"),
        "train_examples": train_metrics.get("train_examples"),
        "val_examples": train_metrics.get("val_examples"),
        "best_val_loss": train_metrics.get("best_val_loss"),
        "last_train_loss": last.get("train_loss"),
        "last_val_loss": last.get("val_loss"),
        "test_loss": test_metrics.get("loss"),
        "pitch_accuracy": test_metrics.get("pitch_accuracy"),
        "duration_accuracy": test_metrics.get("duration_accuracy"),
        "note_mask_f1": test_metrics.get("note_mask_f1"),
        "note_mask_precision": test_metrics.get("note_mask_precision"),
        "note_mask_recall": test_metrics.get("note_mask_recall"),
    }


def main():
    parser = argparse.ArgumentParser(description="Compare melody phrase model runs and produce a single report.")
    parser.add_argument("--label-a", required=True)
    parser.add_argument("--train-metrics-a", required=True)
    parser.add_argument("--test-metrics-a", required=True)
    parser.add_argument("--label-b", required=True)
    parser.add_argument("--train-metrics-b", required=True)
    parser.add_argument("--test-metrics-b", required=True)
    parser.add_argument("--output-json", required=True)
    args = parser.parse_args()

    a_train = load_json(Path(args.train_metrics_a).expanduser().resolve())
    a_test = load_json(Path(args.test_metrics_a).expanduser().resolve())
    b_train = load_json(Path(args.train_metrics_b).expanduser().resolve())
    b_test = load_json(Path(args.test_metrics_b).expanduser().resolve())

    a = pick_summary(a_train, a_test)
    b = pick_summary(b_train, b_test)

    better = {
        "best_val_loss": args.label_a if (a["best_val_loss"] or 1e9) <= (b["best_val_loss"] or 1e9) else args.label_b,
        "test_loss": args.label_a if (a["test_loss"] or 1e9) <= (b["test_loss"] or 1e9) else args.label_b,
        "pitch_accuracy": args.label_a if (a["pitch_accuracy"] or 0) >= (b["pitch_accuracy"] or 0) else args.label_b,
        "duration_accuracy": args.label_a if (a["duration_accuracy"] or 0) >= (b["duration_accuracy"] or 0) else args.label_b,
        "note_mask_f1": args.label_a if (a["note_mask_f1"] or 0) >= (b["note_mask_f1"] or 0) else args.label_b,
    }

    report = {
        "schema": "css.melody_model_comparison.v1",
        "models": {
            args.label_a: a,
            args.label_b: b,
        },
        "better_by_metric": better,
        "recommendation": {
            "keep_for_stability": better["best_val_loss"],
            "keep_for_pitch": better["pitch_accuracy"],
            "keep_for_masking": better["note_mask_f1"],
        },
    }
    output = Path(args.output_json).expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(report, ensure_ascii=False))


if __name__ == "__main__":
    main()
