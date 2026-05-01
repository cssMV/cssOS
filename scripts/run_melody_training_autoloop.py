#!/usr/bin/env python3
import argparse
import json
import subprocess
from pathlib import Path


def run(cmd, log_path: Path):
    line = "$ " + " ".join(cmd)
    print(line, flush=True)
    with log_path.open("a", encoding="utf-8") as handle:
      handle.write(line + "\n")
      handle.flush()
      subprocess.run(cmd, check=True, stdout=handle, stderr=subprocess.STDOUT)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def score_metrics(train_metrics, test_metrics):
    return {
        "best_val_loss": float(train_metrics.get("best_val_loss") or 999.0),
        "test_loss": float(test_metrics.get("loss") or 999.0),
        "pitch_accuracy": float(test_metrics.get("pitch_accuracy") or 0.0),
        "duration_accuracy": float(test_metrics.get("duration_accuracy") or 0.0),
        "note_mask_f1": float(test_metrics.get("note_mask_f1") or 0.0),
    }


def is_better(candidate, champion):
    candidate_wins = 0
    champion_wins = 0
    for key in ("best_val_loss", "test_loss"):
        if candidate[key] < champion[key]:
            candidate_wins += 1
        elif candidate[key] > champion[key]:
            champion_wins += 1
    for key in ("pitch_accuracy", "duration_accuracy", "note_mask_f1"):
        if candidate[key] > champion[key]:
            candidate_wins += 1
        elif candidate[key] < champion[key]:
            champion_wins += 1
    return candidate_wins > champion_wins


def next_lr(current_lr: float, cycle_index: int):
    if cycle_index % 2 == 0:
        return max(2e-4, current_lr * 0.72)
    return max(2e-4, current_lr * 0.86)


def next_epochs(current_epochs: int, cycle_index: int):
    if cycle_index % 2 == 0:
        return min(48, current_epochs + 4)
    return min(48, current_epochs + 2)


def safe_slug(value: str):
    return "".join(ch.lower() if ch.isalnum() else "_" for ch in str(value or "")).strip("_") or "sample"


def load_sample_quality(path: Path):
    payload = load_json(path)
    notes = []
    same_pitch_streak = 1
    max_same_pitch_streak = 1
    previous_pitch = None
    lines = payload.get("predicted_lines") or []
    lines_with_notes = 0
    for line in lines:
        predicted = line.get("predicted_notes") or []
        if predicted:
            lines_with_notes += 1
        for note in predicted:
            pitch = int(note.get("pitch") or 0)
            notes.append(pitch)
            if previous_pitch is not None and pitch == previous_pitch:
                same_pitch_streak += 1
            else:
                same_pitch_streak = 1
            max_same_pitch_streak = max(max_same_pitch_streak, same_pitch_streak)
            previous_pitch = pitch
    unique_pitches = len(set(notes))
    note_count = len(notes)
    line_count = len(lines)
    coverage = (lines_with_notes / line_count) if line_count else 0.0
    unique_ratio = (unique_pitches / note_count) if note_count else 0.0
    return {
        "sample_id": payload.get("sample_id"),
        "title": payload.get("title"),
        "predicted_note_count": note_count,
        "unique_pitch_count": unique_pitches,
        "unique_pitch_ratio": unique_ratio,
        "line_coverage": coverage,
        "max_same_pitch_streak": max_same_pitch_streak,
    }


def evaluate_sample_gate(qualities, min_unique_pitch_ratio, min_line_coverage, max_same_pitch_streak):
    if not qualities:
        return {"passed": True, "summary": {}, "failures": []}
    failures = []
    avg_unique_pitch_ratio = sum(item["unique_pitch_ratio"] for item in qualities) / len(qualities)
    avg_line_coverage = sum(item["line_coverage"] for item in qualities) / len(qualities)
    worst_same_pitch_streak = max(item["max_same_pitch_streak"] for item in qualities)
    if avg_unique_pitch_ratio < min_unique_pitch_ratio:
        failures.append(f"avg_unique_pitch_ratio<{min_unique_pitch_ratio}")
    if avg_line_coverage < min_line_coverage:
        failures.append(f"avg_line_coverage<{min_line_coverage}")
    if worst_same_pitch_streak > max_same_pitch_streak:
        failures.append(f"max_same_pitch_streak>{max_same_pitch_streak}")
    return {
        "passed": not failures,
        "summary": {
            "avg_unique_pitch_ratio": avg_unique_pitch_ratio,
            "avg_line_coverage": avg_line_coverage,
            "worst_same_pitch_streak": worst_same_pitch_streak,
        },
        "failures": failures,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Automatically iterate melody phrase training cycles until a target metric or cycle cap is reached."
    )
    parser.add_argument("--train-jsonl", required=True)
    parser.add_argument("--val-jsonl", required=True)
    parser.add_argument("--test-jsonl", required=True)
    parser.add_argument("--output-dir", required=True)
    parser.add_argument("--baseline-train-metrics", required=True)
    parser.add_argument("--baseline-test-metrics", required=True)
    parser.add_argument("--baseline-label", default="v2_24e")
    parser.add_argument("--run-prefix", default="v2_auto")
    parser.add_argument("--epochs", type=int, default=24)
    parser.add_argument("--batch-size", type=int, default=64)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--max-cycles", type=int, default=6)
    parser.add_argument("--target-pitch-accuracy", type=float, default=0.25)
    parser.add_argument("--target-duration-accuracy", type=float, default=0.82)
    parser.add_argument("--target-note-mask-f1", type=float, default=0.995)
    parser.add_argument("--sample-ids", nargs="*", default=[])
    parser.add_argument("--sample-script", default="")
    parser.add_argument("--sample-dir", default="")
    parser.add_argument("--sample-mask-threshold", type=float, default=0.55)
    parser.add_argument("--sample-temperature", type=float, default=0.9)
    parser.add_argument("--sample-top-k", type=int, default=5)
    parser.add_argument("--sample-repetition-penalty", type=float, default=0.45)
    parser.add_argument("--sample-seed", type=int, default=7)
    parser.add_argument("--min-unique-pitch-ratio", type=float, default=0.18)
    parser.add_argument("--min-line-coverage", type=float, default=0.88)
    parser.add_argument("--max-same-pitch-streak", type=int, default=3)
    args = parser.parse_args()

    root = Path(__file__).resolve().parent
    output_dir = Path(args.output_dir).expanduser().resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    log_path = output_dir / f"{args.run_prefix}.autoloop.log"
    summary_path = output_dir / f"{args.run_prefix}.autoloop.summary.json"

    champion_label = args.baseline_label
    champion_train = Path(args.baseline_train_metrics).expanduser().resolve()
    champion_test = Path(args.baseline_test_metrics).expanduser().resolve()
    champion_score = score_metrics(load_json(champion_train), load_json(champion_test))

    history = []
    current_lr = args.lr
    current_epochs = args.epochs
    sample_script = (
        Path(args.sample_script).expanduser().resolve()
        if args.sample_script
        else (root / "sample_melody_phrase_model_v2.py").resolve()
    )
    sample_dir = (
        Path(args.sample_dir).expanduser().resolve()
        if args.sample_dir
        else output_dir / "samples"
    )
    sample_dir.mkdir(parents=True, exist_ok=True)

    for cycle_index in range(1, args.max_cycles + 1):
        run_label = f"{args.run_prefix}_c{cycle_index:02d}"
        run(
            [
                "python3",
                str(root / "run_melody_training_cycle.py"),
                "--train-jsonl",
                str(Path(args.train_jsonl).expanduser().resolve()),
                "--val-jsonl",
                str(Path(args.val_jsonl).expanduser().resolve()),
                "--test-jsonl",
                str(Path(args.test_jsonl).expanduser().resolve()),
                "--output-dir",
                str(output_dir),
                "--baseline-train-metrics",
                str(champion_train),
                "--baseline-test-metrics",
                str(champion_test),
                "--baseline-label",
                champion_label,
                "--run-label",
                run_label,
                "--epochs",
                str(current_epochs),
                "--batch-size",
                str(args.batch_size),
                "--lr",
                str(current_lr),
            ],
            log_path,
        )

        train_metrics = output_dir / f"melody_phrase_model.{run_label}.metrics.json"
        test_metrics = output_dir / f"melody_phrase_model.{run_label}.test_metrics.json"
        model_path = output_dir / f"melody_phrase_model.{run_label}.pt"
        candidate_score = score_metrics(load_json(train_metrics), load_json(test_metrics))
        sample_qualities = []
        sample_gate = {"passed": True, "summary": {}, "failures": []}
        if args.sample_ids:
            for sample_id in args.sample_ids:
                slug = safe_slug(sample_id)
                sample_json = sample_dir / f"{run_label}.{slug}.sample.json"
                sample_midi = sample_dir / f"{run_label}.{slug}.sample.mid"
                run(
                    [
                        "python3",
                        str(sample_script),
                        "--input-jsonl",
                        str(Path(args.test_jsonl).expanduser().resolve()),
                        "--sample-id",
                        str(sample_id),
                        "--model-path",
                        str(model_path),
                        "--output-json",
                        str(sample_json),
                        "--output-midi",
                        str(sample_midi),
                        "--mask-threshold",
                        str(args.sample_mask_threshold),
                        "--temperature",
                        str(args.sample_temperature),
                        "--top-k",
                        str(args.sample_top_k),
                        "--repetition-penalty",
                        str(args.sample_repetition_penalty),
                        "--seed",
                        str(args.sample_seed),
                    ],
                    log_path,
                )
                sample_qualities.append(load_sample_quality(sample_json))
            sample_gate = evaluate_sample_gate(
                sample_qualities,
                args.min_unique_pitch_ratio,
                args.min_line_coverage,
                args.max_same_pitch_streak,
            )
        improved = is_better(candidate_score, champion_score) and sample_gate["passed"]

        history.append(
            {
                "cycle": cycle_index,
                "run_label": run_label,
                "epochs": current_epochs,
                "lr": current_lr,
                "score": candidate_score,
                "sample_gate": sample_gate,
                "sample_qualities": sample_qualities,
                "improved": improved,
            }
        )

        if improved:
            champion_label = run_label
            champion_train = train_metrics
            champion_test = test_metrics
            champion_score = candidate_score

        reached_target = (
            champion_score["pitch_accuracy"] >= args.target_pitch_accuracy
            and champion_score["duration_accuracy"] >= args.target_duration_accuracy
            and champion_score["note_mask_f1"] >= args.target_note_mask_f1
        )
        if reached_target:
            break

        current_lr = next_lr(current_lr, cycle_index)
        current_epochs = next_epochs(current_epochs, cycle_index)

    summary = {
        "schema": "css.melody_training_autoloop.summary.v1",
        "run_prefix": args.run_prefix,
        "champion_label": champion_label,
        "champion_train_metrics": str(champion_train),
        "champion_test_metrics": str(champion_test),
        "champion_score": champion_score,
        "history": history,
        "targets": {
            "pitch_accuracy": args.target_pitch_accuracy,
            "duration_accuracy": args.target_duration_accuracy,
            "note_mask_f1": args.target_note_mask_f1,
        },
        "sample_gate": {
            "sample_ids": args.sample_ids,
            "min_unique_pitch_ratio": args.min_unique_pitch_ratio,
            "min_line_coverage": args.min_line_coverage,
            "max_same_pitch_streak": args.max_same_pitch_streak,
        },
        "stopped_because": "target_reached"
        if (
            champion_score["pitch_accuracy"] >= args.target_pitch_accuracy
            and champion_score["duration_accuracy"] >= args.target_duration_accuracy
            and champion_score["note_mask_f1"] >= args.target_note_mask_f1
        )
        else "max_cycles_reached",
    }
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
