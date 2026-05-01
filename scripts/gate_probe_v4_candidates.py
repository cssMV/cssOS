#!/usr/bin/env python3
from __future__ import annotations

import argparse
import csv
import json
import os
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Gate probe_v4 candidate construction on collection effectiveness.")
    parser.add_argument("--effectiveness-json", required=True)
    parser.add_argument("--triage-csv", required=True)
    parser.add_argument("--threshold-percent", type=float, required=True)
    parser.add_argument("--target-shot", required=True)
    parser.add_argument("--output-root", required=True)
    return parser.parse_args()


def hardlink_or_copy(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    if dst.exists():
        dst.unlink()
    try:
        os.link(src, dst)
    except OSError:
        dst.write_bytes(src.read_bytes())


def main() -> None:
    args = parse_args()
    effectiveness = json.loads(Path(args.effectiveness_json).read_text(encoding="utf-8"))
    triage_rows = list(csv.DictReader(Path(args.triage_csv).open(encoding="utf-8")))

    threshold = float(args.threshold_percent)
    ratio = float(effectiveness.get("used_ratio_percent", 0.0))
    keep_rows = [row for row in triage_rows if row.get("status") == "keep"]

    output_root = Path(args.output_root)
    output_root.mkdir(parents=True, exist_ok=True)
    gate_status_path = output_root / f"{args.target_shot}_gate_status.json"

    gate_payload = {
        "target_shot": args.target_shot,
        "threshold_percent": threshold,
        "used_ratio_percent": ratio,
        "keep_count": len(keep_rows),
        "passed": ratio >= threshold and len(keep_rows) > 0,
    }

    if gate_payload["passed"]:
        candidate_root = output_root / args.target_shot
        candidate_clips = candidate_root / "clips"
        candidate_root.mkdir(parents=True, exist_ok=True)
        candidate_clips.mkdir(parents=True, exist_ok=True)

        manifest_rows = []
        for row in keep_rows:
            src = Path(row["video_path"])
            if not src.is_file():
                continue
            dst = candidate_clips / src.name
            hardlink_or_copy(src, dst)
            manifest_rows.append(
                {
                    "target_shot": args.target_shot,
                    "sample_index": row["sample_index"],
                    "decision": row["decision"],
                    "notes": row["notes"],
                    "source_name": row["source_name"],
                    "candidate_path": str(dst),
                    "source_path": str(src),
                }
            )

        manifest_path = candidate_root / "manifest.csv"
        with manifest_path.open("w", encoding="utf-8", newline="") as handle:
            writer = csv.DictWriter(handle, fieldnames=list(manifest_rows[0].keys()) if manifest_rows else [
                "target_shot", "sample_index", "decision", "notes", "source_name", "candidate_path", "source_path"
            ])
            writer.writeheader()
            writer.writerows(manifest_rows)

        gate_payload["candidate_root"] = str(candidate_root)
        gate_payload["manifest_path"] = str(manifest_path)
        gate_payload["candidate_count"] = len(manifest_rows)

    gate_status_path.write_text(json.dumps(gate_payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(gate_payload, ensure_ascii=False))


if __name__ == "__main__":
    main()
