#!/usr/bin/env bash
set -euo pipefail

RUN_ROOT="${RUN_ROOT:-/srv/cssos/shared/runs}"
BEFORE_DATE="${BEFORE_DATE:-}"
OLDER_THAN_DAYS="${OLDER_THAN_DAYS:-}"
KEEP_STATUSES="${KEEP_STATUSES:-RUNNING,INIT}"
DELETE_STATUSES="${DELETE_STATUSES:-FAILED,CANCELLED,UNKNOWN,BROKEN}"
REPORT_FILE="${REPORT_FILE:-}"
EXECUTE="${EXECUTE:-0}"

usage() {
  cat <<'EOF'
Usage: prune-test-runs-before-date.sh [options]

Delete historical run directories before a cutoff date while preserving active statuses.
Dry-run by default.

Options:
  --run-root <path>          Run root directory
  --before-date <YYYY-MM-DD> Delete runs older than this date (required)
  --older-than-days <n>      Delete runs older than n days from today
  --keep-statuses <csv>      Statuses to preserve, defaults to RUNNING,INIT
  --delete-statuses <csv>    Only delete these statuses, defaults to FAILED,CANCELLED,UNKNOWN,BROKEN
  --report-file <path>       Write JSON maintenance report to this file
  --execute                  Actually delete
  --help                     Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-root) RUN_ROOT="$2"; shift 2 ;;
    --before-date) BEFORE_DATE="$2"; shift 2 ;;
    --older-than-days) OLDER_THAN_DAYS="$2"; shift 2 ;;
    --keep-statuses) KEEP_STATUSES="$2"; shift 2 ;;
    --delete-statuses) DELETE_STATUSES="$2"; shift 2 ;;
    --report-file) REPORT_FILE="$2"; shift 2 ;;
    --execute) EXECUTE=1; shift ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [[ -n "$OLDER_THAN_DAYS" ]]; then
  if ! [[ "$OLDER_THAN_DAYS" =~ ^[0-9]+$ ]]; then
    echo "--older-than-days must be a non-negative integer" >&2
    exit 1
  fi
  BEFORE_DATE="$(python3 - "$OLDER_THAN_DAYS" <<'PY'
import datetime as dt
import sys
days = int(sys.argv[1])
cutoff = dt.date.today() - dt.timedelta(days=days)
print(cutoff.isoformat())
PY
)"
fi

if [[ -z "$BEFORE_DATE" ]]; then
  echo "Either --before-date or --older-than-days is required" >&2
  exit 1
fi

if [[ ! -d "$RUN_ROOT" ]]; then
  echo "Run root not found: $RUN_ROOT" >&2
  exit 1
fi

python3 - "$RUN_ROOT" "$BEFORE_DATE" "$KEEP_STATUSES" "$DELETE_STATUSES" "$EXECUTE" "$REPORT_FILE" <<'PY'
import datetime as dt
import glob
import json
import os
import shutil
import sys

run_root, before_date, keep_statuses_csv, delete_statuses_csv, execute, report_file = sys.argv[1:]
execute = execute == "1"
cutoff = dt.datetime.strptime(before_date, "%Y-%m-%d").date()
keep_statuses = {s.strip().upper() for s in keep_statuses_csv.split(",") if s.strip()}
delete_statuses = {s.strip().upper() for s in delete_statuses_csv.split(",") if s.strip()}

removed = []
kept = []
bytes_removed = 0

for path in glob.glob(os.path.join(run_root, "*")):
    if not os.path.isdir(path):
        continue
    name = os.path.basename(path)
    run_date = None
    if name.startswith("run_") and len(name) >= 12:
        try:
            run_date = dt.datetime.strptime(name[4:12], "%Y%m%d").date()
        except ValueError:
            run_date = None
    if run_date is None or run_date >= cutoff:
        kept.append(("DATE", name))
        continue
    run_json = os.path.join(path, "run.json")
    status = "UNKNOWN"
    if os.path.isfile(run_json):
        try:
            with open(run_json, "r", encoding="utf-8") as fh:
                status = str(json.load(fh).get("status") or "UNKNOWN").upper()
        except Exception:
            status = "BROKEN"
    if status in keep_statuses:
        kept.append((status, name))
        continue
    if delete_statuses and status not in delete_statuses:
        kept.append((status, name))
        continue
    total = 0
    for root, _, files in os.walk(path):
        for file_name in files:
            file_path = os.path.join(root, file_name)
            try:
                total += os.path.getsize(file_path)
            except OSError:
                pass
    if execute:
        shutil.rmtree(path, ignore_errors=True)
    removed.append((status, name, total))
    bytes_removed += total

print(f"run_root={run_root}")
print(f"before_date={before_date}")
print(f"delete_statuses={','.join(sorted(delete_statuses))}")
print(f"removed_count={len(removed)}")
print(f"kept_count={len(kept)}")
print(f"removed_gb={bytes_removed / 1024 / 1024 / 1024:.2f}")
for status, name, *_ in removed[:20]:
    print("REMOVED", status, name)
for status, name in kept[:20]:
    print("KEPT", status, name)

if report_file:
    os.makedirs(os.path.dirname(report_file), exist_ok=True)
    payload = {
        "kind": "run_prune",
        "generated_at": dt.datetime.utcnow().isoformat() + "Z",
        "run_root": run_root,
        "before_date": before_date,
        "keep_statuses": sorted(keep_statuses),
        "delete_statuses": sorted(delete_statuses),
        "execute": execute,
        "removed_count": len(removed),
        "kept_count": len(kept),
        "removed_bytes": bytes_removed,
        "removed_gb": round(bytes_removed / 1024 / 1024 / 1024, 4),
        "removed_sample": [
            {"status": status, "name": name, "bytes": total}
            for status, name, total in removed[:20]
        ],
        "kept_sample": [
            {"status": status, "name": name}
            for status, name in kept[:20]
        ]
    }
    with open(report_file, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2)
PY
