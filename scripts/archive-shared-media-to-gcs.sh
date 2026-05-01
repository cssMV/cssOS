#!/usr/bin/env bash
set -euo pipefail

BUCKET="${BUCKET:-gs://cssstudio-gpu-cssos-assets-prod}"
SHARED_ROOT="${SHARED_ROOT:-/srv/cssos/shared}"
SUBPATHS="${SUBPATHS:-runs,assets/examples}"
EXECUTE="${EXECUTE:-0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUN_ARCHIVER="${SCRIPT_DIR}/archive-runs-to-gcs.sh"

usage() {
  cat <<'EOF'
Usage: archive-shared-media-to-gcs.sh [options]

Mirror bulky shared media/run directories from api-vm into durable asset storage.
Dry-run by default.

Options:
  --bucket <gs://bucket>         Destination bucket/prefix root
  --shared-root <path>           Shared root directory
  --subpaths <csv>               Comma-separated shared subpaths to mirror
  --execute                      Actually sync
  --help                         Show help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --bucket) BUCKET="$2"; shift 2 ;;
    --shared-root) SHARED_ROOT="$2"; shift 2 ;;
    --subpaths) SUBPATHS="$2"; shift 2 ;;
    --execute) EXECUTE=1; shift ;;
    --help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

IFS=',' read -r -a raw_subpaths <<< "$SUBPATHS"
subpaths=()
for item in "${raw_subpaths[@]}"; do
  trimmed="$(printf '%s' "$item" | xargs)"
  [[ -n "$trimmed" ]] && subpaths+=("$trimmed")
done

if [[ ! -d "$SHARED_ROOT" ]]; then
  echo "Shared root not found: $SHARED_ROOT" >&2
  exit 1
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

run_sync() {
  local source_dir="$1"
  local destination="$2"
  echo "Syncing ${source_dir} -> ${destination}"
  CLOUDSDK_AUTH_ACCESS_TOKEN="$(get_access_token)" gcloud storage rsync --recursive "$source_dir" "$destination"
}

for subpath in "${subpaths[@]}"; do
  source_dir="${SHARED_ROOT%/}/${subpath}"
  [[ -e "$source_dir" ]] || {
    echo "Skip missing: $source_dir"
    continue
  }

  if [[ "$subpath" == "runs" ]]; then
    if [[ "$EXECUTE" == "1" ]]; then
      EXECUTE=1 "$RUN_ARCHIVER" --bucket "$BUCKET" --run-root "$source_dir"
    else
      EXECUTE=0 "$RUN_ARCHIVER" --bucket "$BUCKET" --run-root "$source_dir"
    fi
    continue
  fi

  target="${BUCKET%/}/shared/${subpath}"
  if [[ "$EXECUTE" == "1" ]]; then
    run_sync "$source_dir" "$target"
  else
    echo "DRY-RUN ${source_dir} -> ${target}"
  fi
done
