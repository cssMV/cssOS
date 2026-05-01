#!/usr/bin/env python3
import argparse
import json
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_POLICY_JSON = REPO_ROOT / "config" / "training_model_promotion_policy.json"
DEFAULT_REGISTRY_JSON = REPO_ROOT / "data" / "models" / "current_model_registry.json"
DEFAULT_PROMOTION_JSON = REPO_ROOT / "data" / "models" / "latest_melody_model_promotion.json"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def metric_ok(summary: dict, policy: dict):
    targets = ((policy or {}).get("melody_model") or {}).get("targets") or {}
    champion = summary.get("champion_score") or {}
    return (
        float(champion.get("pitch_accuracy") or 0.0) >= float(targets.get("pitch_accuracy") or 0.0)
        and float(champion.get("duration_accuracy") or 0.0) >= float(targets.get("duration_accuracy") or 0.0)
        and float(champion.get("note_mask_f1") or 0.0) >= float(targets.get("note_mask_f1") or 0.0)
    )


def sample_gate_ok(summary: dict, policy: dict):
    required = ((policy or {}).get("melody_model") or {}).get("sample_gate") or {}
    gate = summary.get("history") or []
    promoted_label = str(summary.get("champion_label") or "").strip()
    matching = None
    for row in gate:
        if str(row.get("run_label") or "").strip() == promoted_label:
            matching = row
            break
    if not matching:
        return summary.get("stopped_because") == "target_reached"
    sample_gate = matching.get("sample_gate") or {}
    gate_summary = sample_gate.get("summary") or {}
    failures = sample_gate.get("failures") or []
    return (
        not failures
        and float(gate_summary.get("avg_unique_pitch_ratio") or 0.0) >= float(required.get("min_unique_pitch_ratio") or 0.0)
        and float(gate_summary.get("avg_line_coverage") or 0.0) >= float(required.get("min_line_coverage") or 0.0)
        and int(gate_summary.get("worst_same_pitch_streak") or 999) <= int(required.get("max_same_pitch_streak") or 999)
    )


def infer_model_path(train_metrics_path: str, champion_label: str):
    metrics_path = Path(train_metrics_path).expanduser().resolve()
    candidate = metrics_path.parent / f"melody_phrase_model.{champion_label}.pt"
    return str(candidate) if candidate.exists() else ""


def main():
    parser = argparse.ArgumentParser(description="Promote the latest successful melody training champion into the default creative model registry.")
    parser.add_argument("--autoloop-summary", required=True)
    parser.add_argument("--policy-json", default=str(DEFAULT_POLICY_JSON))
    parser.add_argument("--registry-json", default=str(DEFAULT_REGISTRY_JSON))
    parser.add_argument("--promotion-json", default=str(DEFAULT_PROMOTION_JSON))
    args = parser.parse_args()

    summary_path = Path(args.autoloop_summary).expanduser().resolve()
    policy_path = Path(args.policy_json).expanduser().resolve()
    registry_path = Path(args.registry_json).expanduser().resolve()
    promotion_path = Path(args.promotion_json).expanduser().resolve()

    summary = load_json(summary_path)
    policy = load_json(policy_path)
    stop_reason = str(summary.get("stopped_because") or "").strip()
    required_stop = str(((policy.get("melody_model") or {}).get("required_stop_reason") or "target_reached")).strip()

    if stop_reason != required_stop:
        result = {
            "ok": False,
            "reason": "target_not_reached",
            "autoloop_summary": str(summary_path),
            "stopped_because": stop_reason,
        }
        print(json.dumps(result, ensure_ascii=False))
        return
    if not metric_ok(summary, policy):
        result = {
            "ok": False,
            "reason": "metric_gate_failed",
            "autoloop_summary": str(summary_path),
            "champion_score": summary.get("champion_score") or {},
        }
        print(json.dumps(result, ensure_ascii=False))
        return
    if not sample_gate_ok(summary, policy):
        result = {
            "ok": False,
            "reason": "sample_gate_failed",
            "autoloop_summary": str(summary_path),
        }
        print(json.dumps(result, ensure_ascii=False))
        return

    champion_label = str(summary.get("champion_label") or "").strip()
    train_metrics = str(summary.get("champion_train_metrics") or "").strip()
    test_metrics = str(summary.get("champion_test_metrics") or "").strip()
    model_path = infer_model_path(train_metrics, champion_label)

    registry = {}
    if registry_path.exists():
        try:
            registry = load_json(registry_path)
        except Exception:
            registry = {}

    promotion = {
        "schema": "css.melody_model_promotion.v1",
        "family": "melody_model",
        "promoted_label": champion_label,
        "model_path": model_path,
        "train_metrics_path": train_metrics,
        "test_metrics_path": test_metrics,
        "score": summary.get("champion_score") or {},
        "source_autoloop_summary": str(summary_path),
    }

    registry["schema"] = "css.current_model_registry.v1"
    registry["melody_model"] = promotion
    registry_path.parent.mkdir(parents=True, exist_ok=True)
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2), encoding="utf-8")
    promotion_path.parent.mkdir(parents=True, exist_ok=True)
    promotion_path.write_text(json.dumps(promotion, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"ok": True, "registry_json": str(registry_path), "promotion_json": str(promotion_path), "promoted_label": champion_label}, ensure_ascii=False))


if __name__ == "__main__":
    main()
