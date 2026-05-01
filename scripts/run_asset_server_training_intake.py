#!/usr/bin/env python3
import argparse
import json
import os
import socket
import subprocess
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[1]
SCRIPTS_DIR = REPO_ROOT / "scripts"
DEFAULT_ASSET_GCS_PREFIX = (
    os.environ.get("CSSOS_TRAINING_ASSET_GCS_PREFIX", "").strip()
    or "gs://cssstudio-gpu-cssos-assets-prod/training-assets"
)
DEFAULT_SUNO_COOKIE = os.environ.get("SUNO_COOKIE", "").strip()
DEFAULT_SUNO_COOKIE_FILE = os.environ.get("SUNO_COOKIE_FILE", "").strip()
DEFAULT_YOUTUBE_QUERY_CONFIG = REPO_ROOT / "config" / "youtube_training_query_whitelist.json"
DEFAULT_SUNO_CHANNELS = ["https://suno.com/@jingdu"]


def truthy_env(name: str) -> bool:
    value = os.environ.get(name, "").strip().lower()
    return value in {"1", "true", "yes", "y", "on"}


def detect_offline_mode() -> bool:
    if truthy_env("CSSOS_FORCE_ONLINE"):
        return False
    if truthy_env("CSSOS_OFFLINE"):
        return True
    try:
        socket.getaddrinfo("suno.com", 443)
        socket.getaddrinfo("www.youtube.com", 443)
        return False
    except Exception:
        return True


def run_step(name: str, cmd, *, allow_failure: bool = False):
    completed = subprocess.run([str(part) for part in cmd], capture_output=True, text=True)
    result = {
        "name": name,
        "ok": completed.returncode == 0,
        "command": [str(part) for part in cmd],
    }
    if completed.stdout.strip():
        stdout_lines = completed.stdout.strip().splitlines()
        result["stdout"] = stdout_lines[-1]
        if stdout_lines:
            try:
                result["stdout_json"] = json.loads(stdout_lines[-1])
            except Exception:
                pass
    if completed.stderr.strip():
        result["stderr"] = completed.stderr.strip()
    if completed.returncode != 0:
        if allow_failure:
            result["allowed_failure"] = True
            return result
        raise RuntimeError(json.dumps(result, ensure_ascii=False))
    return result


def load_youtube_query_config(path: Path):
    if not path.exists():
        return []
    payload = json.loads(path.read_text(encoding="utf-8"))
    queries = []
    for item in payload.get("queries") or []:
        if not isinstance(item, dict):
            continue
        query = str(item.get("query") or "").strip()
        if not query:
            continue
        queries.append(
            {
                "query": query,
                "pool_name": str(item.get("pool_name") or "").strip(),
                "results": max(1, int(item.get("results") or 12)),
            }
        )
    return queries


def main():
    parser = argparse.ArgumentParser(description="Import Suno and YouTube training assets to the asset server, score quality, split buckets, then refresh the melody training pipeline inputs.")
    parser.add_argument("--asset-gcs-prefix", default=DEFAULT_ASSET_GCS_PREFIX, required=not bool(DEFAULT_ASSET_GCS_PREFIX))
    parser.add_argument("--suno-channel-url", action="append", default=[])
    parser.add_argument("--youtube-query", action="append", default=[])
    parser.add_argument("--youtube-results", type=int, default=12)
    parser.add_argument("--youtube-query-config", default=str(DEFAULT_YOUTUBE_QUERY_CONFIG))
    parser.add_argument("--suno-cookie", default=DEFAULT_SUNO_COOKIE)
    parser.add_argument("--suno-cookie-file", default=DEFAULT_SUNO_COOKIE_FILE)
    parser.add_argument("--offline", action="store_true", help="Skip remote Suno/YouTube imports and only rebuild local manifests/quality/training.")
    parser.add_argument("--skip-melody-pipeline", action="store_true")
    parser.add_argument("--summary-json", default="")
    args = parser.parse_args()

    steps = []
    failures = []
    offline_mode = bool(args.offline) or detect_offline_mode()

    suno_channels = [String for String in args.suno_channel_url if str(String).strip()]
    if not suno_channels:
        suno_channels = DEFAULT_SUNO_CHANNELS[:]

    if offline_mode:
        for channel_url in suno_channels:
            handle = channel_url.rstrip("/").split("/")[-1].lstrip("@") or "suno_channel"
            steps.append(
                {
                    "name": f"suno_import:{handle}",
                    "ok": True,
                    "skipped": True,
                    "reason": "offline_mode",
                    "command": [
                        "python3",
                        str(SCRIPTS_DIR / "import_suno_channel.py"),
                        "--channel-url",
                        channel_url,
                        "--gcs-prefix",
                        args.asset_gcs_prefix.rstrip("/") + "/music_raw/suno",
                        "--skip-pipeline",
                    ],
                }
            )
    else:
        for channel_url in suno_channels:
            handle = channel_url.rstrip("/").split("/")[-1].lstrip("@") or "suno_channel"
            steps.append(
                run_step(
                    f"suno_import:{handle}",
                    [
                        "python3",
                        SCRIPTS_DIR / "import_suno_channel.py",
                        "--channel-url",
                        channel_url,
                        "--gcs-prefix",
                        args.asset_gcs_prefix.rstrip("/") + "/music_raw/suno",
                        "--skip-pipeline",
                    ]
                    + (["--cookie", args.suno_cookie] if str(args.suno_cookie or "").strip() else [])
                    + (
                        ["--cookie-file", args.suno_cookie_file]
                        if str(args.suno_cookie_file or "").strip()
                        else []
                    ),
                    allow_failure=True,
                )
            )
            if not steps[-1].get("ok"):
                failures.append(
                    {
                        "step": steps[-1]["name"],
                        "reason": "asset_import_failed",
                        "stderr": steps[-1].get("stderr", ""),
                    }
                )
    youtube_queries = []
    for index, query in enumerate(args.youtube_query, start=1):
        youtube_queries.append(
            {
                "query": query,
                "pool_name": f"adhoc_{index}",
                "results": args.youtube_results,
            }
        )
    if not youtube_queries:
        youtube_queries = load_youtube_query_config(Path(args.youtube_query_config).expanduser().resolve())

    if offline_mode:
        for index, query_item in enumerate(youtube_queries, start=1):
            pool_name = str(query_item.get("pool_name") or f"pool_{index}").strip() or f"pool_{index}"
            query = str(query_item.get("query") or "").strip()
            if not query:
                continue
            query_results = max(1, int(query_item.get("results") or args.youtube_results))
            steps.append(
                {
                    "name": f"youtube_import:{pool_name}",
                    "ok": True,
                    "skipped": True,
                    "reason": "offline_mode",
                    "command": [
                        "python3",
                        str(SCRIPTS_DIR / "import_youtube_training_pool.py"),
                        "--query",
                        query,
                        "--pool-name",
                        pool_name,
                        "--gcs-prefix",
                        args.asset_gcs_prefix.rstrip("/") + "/video_raw/youtube",
                        "--results",
                        str(query_results),
                    ],
                }
            )
    else:
        for index, query_item in enumerate(youtube_queries, start=1):
            pool_name = str(query_item.get("pool_name") or f"pool_{index}").strip() or f"pool_{index}"
            query = str(query_item.get("query") or "").strip()
            if not query:
                continue
            query_results = max(1, int(query_item.get("results") or args.youtube_results))
            steps.append(
                run_step(
                    f"youtube_import:{pool_name}",
                    [
                        "python3",
                        SCRIPTS_DIR / "import_youtube_training_pool.py",
                        "--query",
                        query,
                        "--pool-name",
                        pool_name,
                        "--gcs-prefix",
                        args.asset_gcs_prefix.rstrip("/") + "/video_raw/youtube",
                        "--results",
                        str(query_results),
                    ],
                    allow_failure=True,
                )
            )
            if not steps[-1].get("ok"):
                failures.append(
                    {
                        "step": steps[-1]["name"],
                        "reason": "asset_import_failed",
                        "stderr": steps[-1].get("stderr", ""),
                    }
                )

    steps.append(
        run_step(
            "intake_manifest",
            [
                "python3",
                SCRIPTS_DIR / "build_music_dataset_intake.py",
            ],
        )
    )
    steps.append(
        run_step(
            "quality_scoring",
            [
                "python3",
                SCRIPTS_DIR / "score_music_dataset_quality.py",
            ],
        )
    )
    steps.append(
        run_step(
            "quality_buckets",
            [
                "python3",
                SCRIPTS_DIR / "split_music_dataset_quality_buckets.py",
            ],
        )
    )
    if not args.skip_melody_pipeline:
        melody_step = run_step(
            "melody_training_pipeline",
            [
                "python3",
                SCRIPTS_DIR / "run_melody_training_auto_pipeline.py",
                *(["--skip-real-extract"] if offline_mode else []),
            ],
            allow_failure=True,
        )
        steps.append(melody_step)
        if not melody_step.get("ok"):
            failures.append(
                {
                    "step": melody_step["name"],
                    "reason": "melody_pipeline_failed",
                    "stderr": melody_step.get("stderr", ""),
                }
            )
        elif isinstance(melody_step.get("stdout_json"), dict):
            payload = melody_step["stdout_json"]
            if not payload.get("ok", True):
                failures.append(
                    {
                        "step": melody_step["name"],
                        "reason": payload.get("reason", "melody_pipeline_reported_failure"),
                    }
                )

    drift_risks = []
    if offline_mode:
        drift_risks.append("remote_intake_skipped_offline")

    quality_step = next((step for step in steps if step.get("name") == "quality_scoring"), None)
    if isinstance(quality_step, dict) and isinstance(quality_step.get("stdout_json"), dict):
        quality_stats = quality_step["stdout_json"]
        bucket_counts = quality_stats.get("bucket_counts") or {}
        records = int(quality_stats.get("records") or 0)
        reject_count = int(bucket_counts.get("reject") or 0)
        if records > 0 and reject_count == records:
            drift_risks.append("all_quality_records_rejected")

    buckets_step = next((step for step in steps if step.get("name") == "quality_buckets"), None)
    if isinstance(buckets_step, dict) and isinstance(buckets_step.get("stdout_json"), dict):
        bucket_stats = buckets_step["stdout_json"]
        bucket_counts = bucket_stats.get("bucket_counts") or {}
        gold_count = int(bucket_counts.get("gold") or 0)
        if gold_count == 0:
            drift_risks.append("no_gold_quality_records")

    pipeline_step = next((step for step in steps if step.get("name") == "melody_training_pipeline"), None)
    if isinstance(pipeline_step, dict) and isinstance(pipeline_step.get("stdout_json"), dict):
        pipeline_payload = pipeline_step["stdout_json"]
        for risk in pipeline_payload.get("drift_risks") or []:
            drift_risks.append(str(risk))

    summary = {
        "schema": "css.asset_server_training_intake.summary.v1",
        "ok": len(failures) == 0,
        "offline_mode": offline_mode,
        "asset_gcs_prefix": args.asset_gcs_prefix,
        "suno_channels": suno_channels,
        "suno_account_authenticated": bool(str(args.suno_cookie or "").strip() or str(args.suno_cookie_file or "").strip()),
        "youtube_query_config": str(Path(args.youtube_query_config).expanduser().resolve()),
        "failures": failures,
        "drift_risks": sorted(set(drift_risks)),
        "steps": steps,
    }
    if args.summary_json:
        summary_json = Path(args.summary_json).expanduser().resolve()
        summary_json.parent.mkdir(parents=True, exist_ok=True)
        summary_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == "__main__":
    main()
