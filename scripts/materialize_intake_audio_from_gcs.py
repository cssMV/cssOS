#!/usr/bin/env python3
import argparse
import json
import subprocess
from pathlib import Path


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


def safe_sample_name(record: dict, fallback_index: int) -> str:
    raw = str(record.get("sample_id") or record.get("title") or f"sample_{fallback_index}").strip()
    safe = "".join(ch if ch.isalnum() or ch in ("-", "_", ".") else "_" for ch in raw)
    return safe.strip("._") or f"sample_{fallback_index}"


def download_gcs(gcs_uri: str, target_path: Path):
    target_path.parent.mkdir(parents=True, exist_ok=True)
    commands = [
        ["gcloud", "storage", "cp", gcs_uri, str(target_path)],
        ["gsutil", "-q", "cp", gcs_uri, str(target_path)],
    ]
    last_error = None
    for cmd in commands:
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True)
            return True
        except Exception as err:
            last_error = err
    if last_error:
        raise last_error
    return False


def main():
    parser = argparse.ArgumentParser(description="Materialize intake audio files locally from audio_gcs_uri so downstream training-sidecar scripts can operate on real audio paths.")
    parser.add_argument("--input-jsonl", required=True)
    parser.add_argument("--output-jsonl", required=True)
    parser.add_argument("--cache-root", required=True)
    args = parser.parse_args()

    input_jsonl = Path(args.input_jsonl).expanduser().resolve()
    output_jsonl = Path(args.output_jsonl).expanduser().resolve()
    cache_root = Path(args.cache_root).expanduser().resolve()

    rows = load_jsonl(input_jsonl)
    downloaded = 0
    reused = 0
    missing = 0
    output_rows = []

    for index, row in enumerate(rows, start=1):
        next_row = dict(row)
        existing_audio_path = Path(str(next_row.get("audio_path") or "").strip()) if str(next_row.get("audio_path") or "").strip() else None
        if existing_audio_path and existing_audio_path.exists():
            reused += 1
            output_rows.append(next_row)
            continue
        gcs_uri = str(next_row.get("audio_gcs_uri") or "").strip()
        if not gcs_uri:
            missing += 1
            output_rows.append(next_row)
            continue
        suffix = Path(gcs_uri).suffix or ".mp3"
        local_path = cache_root / f"{safe_sample_name(next_row, index)}{suffix}"
        if local_path.exists():
            reused += 1
        else:
            download_gcs(gcs_uri, local_path)
            downloaded += 1
        next_row["audio_path"] = str(local_path)
        output_rows.append(next_row)

    write_jsonl(output_jsonl, output_rows)
    print(json.dumps({
        "schema": "css.materialize_intake_audio_from_gcs.stats.v1",
        "records": len(rows),
        "downloaded": downloaded,
        "reused": reused,
        "missing_audio_gcs_uri": missing,
        "output_jsonl": str(output_jsonl),
        "cache_root": str(cache_root),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
