#!/usr/bin/env python3
import argparse
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path


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
            fieldnames=["sample_id", "split", "title", "source_kind"],
        )
        writer.writeheader()
        for row in rows:
            writer.writerow(
                {
                    "sample_id": row.get("sample_id"),
                    "split": row.get("split"),
                    "title": row.get("title"),
                    "source_kind": row.get("source_kind"),
                }
            )


def choose_split(sample_id: str, train_ratio: float, val_ratio: float):
    digest = hashlib.md5(sample_id.encode("utf-8")).hexdigest()
    bucket = int(digest[:8], 16) / 0xFFFFFFFF
    if bucket < train_ratio:
        return "train"
    if bucket < train_ratio + val_ratio:
        return "val"
    return "test"


def rebalance_small_splits(split_rows):
    if len(split_rows) < 3:
        return split_rows
    by_split = Counter(row.get("split") for row in split_rows)
    if by_split.get("train", 0) and by_split.get("val", 0) and by_split.get("test", 0):
        return split_rows

    ordered = sorted(
        split_rows,
        key=lambda row: str(row.get("sample_id") or ""),
    )
    target_cycle = ["train", "val", "test"]
    for index, row in enumerate(ordered):
        row["split"] = target_cycle[index % len(target_cycle)]
    return ordered


def main():
    parser = argparse.ArgumentParser(description="Split training-ready melody dataset into train/val/test manifests.")
    parser.add_argument("--input-jsonl", required=True)
    parser.add_argument("--train-jsonl", required=True)
    parser.add_argument("--val-jsonl", required=True)
    parser.add_argument("--test-jsonl", required=True)
    parser.add_argument("--index-csv", required=True)
    parser.add_argument("--stats-json", required=True)
    parser.add_argument("--train-ratio", type=float, default=0.8)
    parser.add_argument("--val-ratio", type=float, default=0.1)
    args = parser.parse_args()

    rows = load_jsonl(Path(args.input_jsonl).expanduser().resolve())
    split_rows = []
    by_split = Counter()
    by_source = Counter()

    for row in rows:
        row = dict(row)
        split = choose_split(str(row.get("sample_id") or ""), args.train_ratio, args.val_ratio)
        row["split"] = split
        split_rows.append(row)

    split_rows = rebalance_small_splits(split_rows)
    by_split = Counter()
    by_source = Counter()
    for row in split_rows:
        by_split[row["split"]] += 1
        by_source[f"{row['split']}:{row.get('source_kind') or 'unknown'}"] += 1

    train_rows = [row for row in split_rows if row["split"] == "train"]
    val_rows = [row for row in split_rows if row["split"] == "val"]
    test_rows = [row for row in split_rows if row["split"] == "test"]

    write_jsonl(Path(args.train_jsonl).expanduser().resolve(), train_rows)
    write_jsonl(Path(args.val_jsonl).expanduser().resolve(), val_rows)
    write_jsonl(Path(args.test_jsonl).expanduser().resolve(), test_rows)
    write_csv(Path(args.index_csv).expanduser().resolve(), split_rows)

    stats = {
        "schema": "css.melody_dataset_splits.stats.v1",
        "records": len(rows),
        "by_split": dict(by_split),
        "by_split_source": dict(by_source),
        "inputs": {"input_jsonl": str(Path(args.input_jsonl).expanduser().resolve())},
        "outputs": {
            "train_jsonl": str(Path(args.train_jsonl).expanduser().resolve()),
            "val_jsonl": str(Path(args.val_jsonl).expanduser().resolve()),
            "test_jsonl": str(Path(args.test_jsonl).expanduser().resolve()),
            "index_csv": str(Path(args.index_csv).expanduser().resolve()),
        },
    }
    stats_path = Path(args.stats_json).expanduser().resolve()
    stats_path.parent.mkdir(parents=True, exist_ok=True)
    stats_path.write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(stats, ensure_ascii=False))


if __name__ == "__main__":
    main()
