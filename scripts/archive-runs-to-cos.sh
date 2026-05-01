#!/usr/bin/env bash
set -euo pipefail

RUN_ROOT="${RUN_ROOT:-/srv/cssos/shared/runs}"
BUCKET="${BUCKET:-css-1408082613}"
REGION="${REGION:-ap-guangzhou}"
PREFIX="${PREFIX:-runs}"
MIN_AGE_DAYS="${MIN_AGE_DAYS:-14}"
MIN_SIZE_MB="${MIN_SIZE_MB:-50}"
MAX_RUNS="${MAX_RUNS:-25}"
STATUSES="${STATUSES:-SUCCEEDED,FAILED,CANCELLED}"
EXECUTE="${EXECUTE:-0}"

usage() {
  cat <<'EOF'
Usage: archive-runs-to-cos.sh [options]

Dry-run by default. Requires `coscmd` plus COS credentials in the environment.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --run-root) RUN_ROOT="$2"; shift 2 ;;
    --bucket) BUCKET="$2"; shift 2 ;;
    --region) REGION="$2"; shift 2 ;;
    --prefix) PREFIX="$2"; shift 2 ;;
    --min-age-days) MIN_AGE_DAYS="$2"; shift 2 ;;
    --min-size-mb) MIN_SIZE_MB="$2"; shift 2 ;;
    --max-runs) MAX_RUNS="$2"; shift 2 ;;
    --statuses) STATUSES="$2"; shift 2 ;;
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

if [[ -z "$inventory" ]]; then
  echo "No eligible run directories matched policy."
  exit 0
fi

echo "Archive candidates:"
printf '%s\n' "$inventory"

if [[ "$EXECUTE" != "1" ]]; then
  echo
  echo "Dry-run only. Re-run with --execute to upload these runs into COS."
  exit 0
fi

if ! command -v coscmd >/dev/null 2>&1; then
  echo "coscmd not found. Install it first, for example: python3 -m pip install --user coscmd" >&2
  exit 2
fi
if [[ -z "${COS_SECRET_ID:-}" || -z "${COS_SECRET_KEY:-}" ]]; then
  echo "COS_SECRET_ID / COS_SECRET_KEY must be set." >&2
  exit 3
fi

while IFS=$'\t' read -r age_days total_mb status run_id run_dir; do
  [[ -n "$run_id" ]] || continue
  destination="/${PREFIX%/}/${run_id}/"
  echo
  echo "Uploading ${run_id} (${total_mb}MB, ${age_days}d, ${status}) -> cos://${BUCKET}${destination}"
  COSCMD_CONF="$(mktemp)"
  cat > "$COSCMD_CONF" <<EOF
[common]
secret_id = ${COS_SECRET_ID}
secret_key = ${COS_SECRET_KEY}
bucket = ${BUCKET}
region = ${REGION}
scheme = https
EOF
  coscmd -c "$COSCMD_CONF" upload -rfs "$run_dir" "$destination"
  rm -f "$COSCMD_CONF"
done <<< "$inventory"

echo
echo "Run archive sync to COS completed."
