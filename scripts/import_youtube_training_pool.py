#!/usr/bin/env python3
import argparse
import json
import re
import subprocess
import tempfile
import time
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = REPO_ROOT / "scripts"
DEFAULT_LOG_DIR = REPO_ROOT / "data" / "logs"
DEFAULT_ARCHIVE_DIR = REPO_ROOT / "data" / "meta"
DEFAULT_MANIFEST_DIR = REPO_ROOT / "data" / "manifests"


def run(cmd):
    completed = subprocess.run([str(part) for part in cmd], check=True, capture_output=True, text=True)
    return completed.stdout.strip(), completed.stderr.strip()


def sanitize_object_name(file_name: str) -> str:
    safe = re.sub(r"[^\w.\-]+", "_", str(file_name or "").strip(), flags=re.UNICODE)
    safe = re.sub(r"_+", "_", safe).strip("._")
    return safe or "asset.bin"


def upload_file(local_path: Path, target: str, retries: int = 2):
    source_uri = local_path.resolve().as_uri()
    commands = [
        ["gcloud", "storage", "cp", source_uri, target],
        ["gsutil", "-q", "cp", source_uri, target],
    ]
    errors = []
    for cmd in commands:
        for attempt in range(1, max(1, retries) + 2):
            try:
                subprocess.run(cmd, check=True, capture_output=True, text=True)
                return {"ok": True, "command": cmd, "attempt": attempt}
            except subprocess.CalledProcessError as err:
                errors.append(
                    {
                        "command": cmd,
                        "attempt": attempt,
                        "error": str(err),
                        "stderr": (err.stderr or "").strip(),
                        "stdout": (err.stdout or "").strip(),
                    }
                )
                if attempt < max(1, retries) + 1:
                    time.sleep(min(3, attempt))
            except Exception as err:
                errors.append(
                    {
                        "command": cmd,
                        "attempt": attempt,
                        "error": str(err),
                    }
                )
                if attempt < max(1, retries) + 1:
                    time.sleep(min(3, attempt))
    return {"ok": False, "errors": errors}


def upload_tree(local_dir: Path, gcs_prefix: str):
    uploaded = []
    failed = []
    for file_path in sorted(local_dir.rglob("*")):
        if not file_path.is_file():
            continue
        object_name = sanitize_object_name(file_path.name)
        target = gcs_prefix.rstrip("/") + "/" + object_name
        upload_result = upload_file(file_path, target)
        if upload_result.get("ok"):
            uploaded.append({"file_name": file_path.name, "gcs_uri": target})
            continue
        failed.append(
            {
                "file_name": file_path.name,
                "gcs_uri": target,
                "errors": upload_result.get("errors") or [],
            }
        )
    return uploaded, failed


def main():
    parser = argparse.ArgumentParser(description="Search YouTube, download filtered training videos, upload them to the asset server, then delete local copies.")
    parser.add_argument("--query", required=True)
    parser.add_argument("--pool-name", required=True)
    parser.add_argument("--gcs-prefix", required=True)
    parser.add_argument("--results", type=int, default=12)
    parser.add_argument("--search-budget", type=int, default=60)
    args = parser.parse_args()

    temp_root = Path(tempfile.mkdtemp(prefix=f"yt_pool_{args.pool_name}_"))
    output_dir = temp_root / "downloads"
    archive_file = DEFAULT_ARCHIVE_DIR / f"youtube_training_pool.{args.pool_name}.archive.txt"
    log_file = DEFAULT_LOG_DIR / f"youtube_training_pool.{args.pool_name}.log"
    cmd = [
        "python3",
        SCRIPTS_DIR / "search_and_download_filtered.py",
        "--query",
        args.query,
        "--pool-name",
        args.pool_name,
        "--output-dir",
        output_dir,
        "--archive-file",
        archive_file,
        "--log-file",
        log_file,
        "--results",
        str(args.results),
        "--search-budget",
        str(args.search_budget),
    ]
    stdout, _stderr = run(cmd)
    uploaded, failed_uploads = upload_tree(output_dir, args.gcs_prefix.rstrip("/") + f"/{args.pool_name}")
    manifest = {
        "schema": "css.youtube_training_pool_import.v1",
        "query": args.query,
        "pool_name": args.pool_name,
        "gcs_prefix": args.gcs_prefix.rstrip("/") + f"/{args.pool_name}",
        "archive_file": str(archive_file),
        "log_file": str(log_file),
        "uploaded": uploaded,
        "failed_uploads": failed_uploads,
        "search_stdout": stdout.splitlines(),
    }
    manifest_path = DEFAULT_MANIFEST_DIR / f"youtube_training_pool.{args.pool_name}.json"
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(
        json.dumps(
            {
                "ok": len(uploaded) > 0 or len(failed_uploads) == 0,
                "manifest_path": str(manifest_path),
                "uploaded": len(uploaded),
                "failed_uploads": len(failed_uploads),
            },
            ensure_ascii=False,
        )
    )


if __name__ == "__main__":
    main()
