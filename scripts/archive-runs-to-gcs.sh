#!/usr/bin/env bash
set -euo pipefail

BUCKET="${BUCKET:-gs://cssstudio-gpu-cssos-assets-prod}"
RUN_ROOT="${RUN_ROOT:-/srv/cssos/shared/runs}"
MIN_AGE_DAYS="${MIN_AGE_DAYS:-14}"
MIN_SIZE_MB="${MIN_SIZE_MB:-50}"
MAX_RUNS="${MAX_RUNS:-25}"
STATUSES="${STATUSES:-SUCCEEDED,FAILED,CANCELLED}"
EXECUTE="${EXECUTE:-0}"
INVENTORY_FILE="${INVENTORY_FILE:-}"

usage() {
  cat <<'EOF'
Usage: archive-runs-to-gcs.sh [options]

Safely mirror old run directories from local run storage into GCS.
Dry-run by default.

Options:
  --bucket <gs://bucket>         Destination bucket/prefix root
  --run-root <path>              Local run root
  --min-age-days <n>             Minimum directory mtime age in days
  --min-size-mb <n>              Minimum total run size in MB
  --max-runs <n>                 Maximum candidate runs to process
  --statuses <csv>               Eligible run statuses
  --inventory-file <path>        Write TSV inventory to file
  --execute                      Actually sync candidates to GCS
  --help                         Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bucket) BUCKET="$2"; shift 2 ;;
    --run-root) RUN_ROOT="$2"; shift 2 ;;
    --min-age-days) MIN_AGE_DAYS="$2"; shift 2 ;;
    --min-size-mb) MIN_SIZE_MB="$2"; shift 2 ;;
    --max-runs) MAX_RUNS="$2"; shift 2 ;;
    --statuses) STATUSES="$2"; shift 2 ;;
    --inventory-file) INVENTORY_FILE="$2"; shift 2 ;;
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
python3 - "$RUN_ROOT" "$MIN_AGE_DAYS" "$MIN_SIZE_MB" "$MAX_RUNS" "$STATUSES" <<'PY'
import json, os, sys, time
base = sys.argv[1]
min_age_days = float(sys.argv[2])
min_size_mb = float(sys.argv[3])
max_runs = int(sys.argv[4])
statuses = {s.strip().upper() for s in sys.argv[5].split(",") if s.strip()}
cutoff = time.time() - (min_age_days * 86400.0)
rows = []
for name in os.listdir(base):
    run_dir = os.path.join(base, name)
    if not os.path.isdir(run_dir):
        continue
    try:
        st = os.stat(run_dir)
    except OSError:
        continue
    if st.st_mtime > cutoff:
        continue
    run_json = os.path.join(run_dir, "run.json")
    status = ""
    if os.path.isfile(run_json):
        try:
            with open(run_json, "r", encoding="utf-8") as fh:
                status = str(json.load(fh).get("status") or "").upper()
        except Exception:
            status = "BROKEN"
    if statuses and status not in statuses:
        continue
    total = 0
    for root, _, files in os.walk(run_dir):
        for file_name in files:
            file_path = os.path.join(root, file_name)
            try:
                total += os.path.getsize(file_path)
            except OSError:
                pass
    total_mb = total / 1024.0 / 1024.0
    if total_mb < min_size_mb:
        continue
    age_days = (time.time() - st.st_mtime) / 86400.0
    rows.append((st.st_mtime, age_days, total_mb, status or "UNKNOWN", name, run_dir))

rows.sort()
for _, age_days, total_mb, status, name, run_dir in rows[:max_runs]:
    print(f"{age_days:.1f}\t{total_mb:.1f}\t{status}\t{name}\t{run_dir}")
PY
)

if [[ -n "$INVENTORY_FILE" ]]; then
  mkdir -p "$(dirname "$INVENTORY_FILE")"
  printf '%s\n' "$inventory" > "$INVENTORY_FILE"
fi

if [[ -z "$inventory" ]]; then
  echo "No eligible run directories matched policy."
  exit 0
fi

echo "Archive candidates:"
printf '%s\n' "$inventory"

if [[ "$EXECUTE" != "1" ]]; then
  echo
  echo "Dry-run only. Re-run with --execute to sync these runs to $BUCKET."
  exit 0
fi

get_access_token() {
  if curl -sf -H "Metadata-Flavor: Google" \
    http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token >/tmp/cssos_gce_token.json 2>/dev/null; then
    python3 - <<'PY'
import json
with open("/tmp/cssos_gce_token.json", "r", encoding="utf-8") as fh:
    print(json.load(fh)["access_token"])
PY
    return 0
  fi
  gcloud auth print-access-token
}

ACCESS_TOKEN="$(get_access_token)"
export CLOUDSDK_AUTH_ACCESS_TOKEN="$ACCESS_TOKEN"

while IFS=$'\t' read -r age_days total_mb status run_id run_dir; do
  [[ -n "$run_id" ]] || continue
  destination="${BUCKET%/}/runs/${run_id}"
  echo
  echo "Syncing ${run_id} (${total_mb}MB, ${age_days}d, ${status}) -> ${destination}"
  gcloud storage rsync --recursive "$run_dir" "$destination"
done <<< "$inventory"

echo
echo "Run archive sync completed."
