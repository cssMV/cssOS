#!/usr/bin/env bash
set -euo pipefail

BUCKET="${BUCKET:-gs://cssstudio-gpu-cssos-assets-prod}"
RUN_ROOT="${RUN_ROOT:-/srv/cssos/shared/runs}"
MIN_AGE_DAYS="${MIN_AGE_DAYS:-0.08}"
MAX_RUNS="${MAX_RUNS:-50}"
REPORT_FILE="${REPORT_FILE:-}"
EXECUTE="${EXECUTE:-0}"
FORCE_RESYNC="${FORCE_RESYNC:-0}"
WRITE_ARCHIVE_MARKER="${WRITE_ARCHIVE_MARKER:-1}"
LOCAL_PRUNE_MODE="${LOCAL_PRUNE_MODE:-none}"

usage() {
  cat <<'EOF'
Usage: archive-successful-works-to-gcs.sh [options]

Mirror succeeded work artifacts into durable asset storage.
Dry-run by default.

Options:
  --bucket <gs://bucket>      Destination bucket/prefix root
  --run-root <path>           Local run root
  --min-age-days <n>          Minimum run age in days
  --max-runs <n>              Maximum successful runs to process
  --report-file <path>        Write JSON maintenance report to this file
  --force-resync              Re-sync runs even if archive marker exists
  --local-prune-mode <mode>   none | build-media
  --execute                   Actually sync candidates
  --help                      Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bucket) BUCKET="$2"; shift 2 ;;
    --run-root) RUN_ROOT="$2"; shift 2 ;;
    --min-age-days) MIN_AGE_DAYS="$2"; shift 2 ;;
    --max-runs) MAX_RUNS="$2"; shift 2 ;;
    --report-file) REPORT_FILE="$2"; shift 2 ;;
    --force-resync) FORCE_RESYNC=1; shift ;;
    --local-prune-mode) LOCAL_PRUNE_MODE="$2"; shift 2 ;;
    --execute) EXECUTE=1; shift ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ ! -d "$RUN_ROOT" ]]; then
  echo "Run root not found: $RUN_ROOT" >&2
  exit 1
fi

inventory=$(
python3 - "$RUN_ROOT" "$MIN_AGE_DAYS" "$MAX_RUNS" <<'PY'
import json, os, sys, time
base = sys.argv[1]
min_age_days = float(sys.argv[2])
max_runs = int(sys.argv[3])
cutoff = time.time() - (min_age_days * 86400.0)
rows = []
for name in os.listdir(base):
    run_dir = os.path.join(base, name)
    if not os.path.isdir(run_dir):
        continue
    run_json = os.path.join(run_dir, "run.json")
    if not os.path.isfile(run_json):
        continue
    try:
        payload = json.load(open(run_json, "r", encoding="utf-8"))
    except Exception:
        continue
    status = str(payload.get("status") or "").upper()
    if status != "SUCCEEDED":
        continue
    try:
        st = os.stat(run_dir)
    except OSError:
        continue
    if st.st_mtime > cutoff:
        continue
    build_dir = os.path.join(run_dir, "build")
    if not os.path.isdir(build_dir):
        continue
    archive_marker = os.path.join(run_dir, ".archived-to-gcs.json")
    output_package = os.path.join(build_dir, "output.package.json")
    preview = os.path.join(build_dir, "audio.preview.wav")
    mix = os.path.join(build_dir, "mix.wav")
    total = 0
    for root, _, files in os.walk(build_dir):
        for file_name in files:
            file_path = os.path.join(root, file_name)
            try:
                total += os.path.getsize(file_path)
            except OSError:
                pass
    rows.append({
        "mtime": st.st_mtime,
        "run_id": name,
        "run_dir": run_dir,
        "build_dir": build_dir,
        "archive_marker": archive_marker,
        "already_archived": os.path.isfile(archive_marker),
        "has_output_package": os.path.isfile(output_package),
        "has_preview": os.path.isfile(preview),
        "has_mix": os.path.isfile(mix),
        "bytes": total
    })
rows.sort(key=lambda row: row["mtime"])
for row in rows[:max_runs]:
    print(json.dumps(row, ensure_ascii=False))
PY
)

if [[ -z "$inventory" ]]; then
  if [[ -n "$REPORT_FILE" ]]; then
    python3 - "$REPORT_FILE" "$RUN_ROOT" <<'PY'
import json, os, sys, datetime as dt
report_file, run_root = sys.argv[1:]
os.makedirs(os.path.dirname(report_file), exist_ok=True)
json.dump({
  "kind": "work_archive",
  "generated_at": dt.datetime.utcnow().isoformat() + "Z",
  "run_root": run_root,
  "archived_count": 0,
  "candidates": []
}, open(report_file, "w", encoding="utf-8"), indent=2)
PY
  fi
  echo "No eligible successful runs matched policy."
  exit 0
fi

echo "Archive candidates:"
printf '%s\n' "$inventory"

archived_json="[]"
if [[ "$EXECUTE" == "1" ]]; then
  while IFS= read -r row; do
    [[ -n "$row" ]] || continue
    run_id="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["run_id"])' <<<"$row")"
    build_dir="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["build_dir"])' <<<"$row")"
    run_dir="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["run_dir"])' <<<"$row")"
    archive_marker="$(python3 -c 'import json,sys; print(json.loads(sys.stdin.read())["archive_marker"])' <<<"$row")"
    already_archived="$(python3 -c 'import json,sys; print("1" if json.loads(sys.stdin.read())["already_archived"] else "0")' <<<"$row")"
    if [[ "$already_archived" == "1" && "$FORCE_RESYNC" != "1" ]]; then
      echo "Skip ${run_id}: archive marker already present"
      continue
    fi
    destination="${BUCKET%/}/works/${run_id}"
    echo "Syncing ${run_id} -> ${destination}"
    gcloud storage rsync --recursive "$build_dir" "$destination"
    if [[ "$WRITE_ARCHIVE_MARKER" == "1" ]]; then
      python3 - "$archive_marker" "$run_id" "$destination" "$LOCAL_PRUNE_MODE" <<'PY'
import datetime as dt
import json
import os
import sys
marker, run_id, destination, prune_mode = sys.argv[1:]
payload = {
  "kind": "work_archive_marker",
  "run_id": run_id,
  "destination": destination,
  "archived_at": dt.datetime.utcnow().isoformat() + "Z",
  "local_prune_mode": prune_mode,
}
with open(marker, "w", encoding="utf-8") as fh:
  json.dump(payload, fh, indent=2)
PY
    fi
    if [[ "$LOCAL_PRUNE_MODE" == "build-media" ]]; then
      find "$run_dir/build" -type f \
        \( -name 'final_mv.mp4' -o -name 'karaoke_mv.mp4' -o -name 'mix.wav' -o -name 'audio.preview.wav' -o -name 'video.mp4' \) \
        -delete || true
    fi
  done <<< "$inventory"
fi

if [[ -n "$REPORT_FILE" ]]; then
  printf '%s\n' "$inventory" | python3 - "$REPORT_FILE" "$RUN_ROOT" "$EXECUTE" <<'PY'
import json, os, sys, datetime as dt
report_file, run_root, execute = sys.argv[1:]
rows = [json.loads(line) for line in sys.stdin.read().splitlines() if line.strip()]
os.makedirs(os.path.dirname(report_file), exist_ok=True)
json.dump({
  "kind": "work_archive",
  "generated_at": dt.datetime.utcnow().isoformat() + "Z",
  "run_root": run_root,
  "executed": execute == "1",
  "archived_count": len(rows) if execute == "1" else 0,
  "candidate_count": len(rows),
  "candidates": rows[:20]
}, open(report_file, "w", encoding="utf-8"), indent=2)
PY
fi

if [[ "$EXECUTE" != "1" ]]; then
  echo
  echo "Dry-run only. Re-run with --execute to sync successful work artifacts to $BUCKET."
fi
