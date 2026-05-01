#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

resolve_repo_path() {
  local raw="${1:-}"
  if [[ -z "$raw" ]]; then
    printf '%s' ""
    return
  fi
  if [[ "$raw" = /* ]]; then
    printf '%s' "$raw"
    return
  fi
  if [[ -e "$raw" ]]; then
    printf '%s' "$(cd "$(dirname "$raw")" && pwd)/$(basename "$raw")"
    return
  fi
  printf '%s' "$REPO_ROOT/$raw"
}

PROJECT=""
CHAIN=""
INPUT_STEM=""
PLAN=""
EXECUTION=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="${2:-}"; shift 2 ;;
    --chain) CHAIN="${2:-}"; shift 2 ;;
    --input-stem) INPUT_STEM="${2:-}"; shift 2 ;;
    --plan) PLAN="${2:-}"; shift 2 ;;
    --execution) EXECUTION="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done

INPUT_STEM="$(resolve_repo_path "$INPUT_STEM")"
PLAN="$(resolve_repo_path "$PLAN")"
EXECUTION="$(resolve_repo_path "$EXECUTION")"

HOST_BIN="${CSSMV_HOST_MIX_BIN:-${CSSMV_HOST_CARLA_BIN:-${CSSMV_HOST_PLUGIN_BIN:-}}}"
if [[ -z "$HOST_BIN" ]]; then
  echo "[cssmv-mix-host-adapter] CSSMV_HOST_MIX_BIN / CSSMV_HOST_CARLA_BIN / CSSMV_HOST_PLUGIN_BIN is not set" >&2
  exit 32
fi
if [[ ! -x "$HOST_BIN" ]]; then
  echo "[cssmv-mix-host-adapter] host binary is not executable: $HOST_BIN" >&2
  exit 33
fi

echo "[cssmv-mix-host-adapter] project=$PROJECT chain=$CHAIN input_stem=$INPUT_STEM plan=$PLAN execution=$EXECUTION host=$HOST_BIN" >&2
"$HOST_BIN" --version >/dev/null 2>&1 || {
  echo "[cssmv-mix-host-adapter] host binary did not answer --version: $HOST_BIN" >&2
  exit 34
}

if [[ -f "$REPO_ROOT/dist/cssmv/hosts/run-carla-mix-host.js" ]]; then
  exec node "$REPO_ROOT/dist/cssmv/hosts/run-carla-mix-host.js" \
    --project "$PROJECT" \
    --mode mix \
    --chain "$CHAIN" \
    --input-stem "$INPUT_STEM" \
    --plan "$PLAN" \
    --execution "$EXECUTION"
fi

exec node -r ts-node/register/transpile-only "$REPO_ROOT/src/cssmv/hosts/run-carla-mix-host.ts" \
  --project "$PROJECT" \
  --mode mix \
  --chain "$CHAIN" \
  --input-stem "$INPUT_STEM" \
  --plan "$PLAN" \
  --execution "$EXECUTION"
