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
STACK=""
CHAIN=""
PLAN=""
EXECUTION=""
INPUT_STEM=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="${2:-}"; shift 2 ;;
    --stack) STACK="${2:-}"; shift 2 ;;
    --chain) CHAIN="${2:-}"; shift 2 ;;
    --plan) PLAN="${2:-}"; shift 2 ;;
    --execution) EXECUTION="${2:-}"; shift 2 ;;
    --input-stem) INPUT_STEM="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done

PLAN="$(resolve_repo_path "$PLAN")"
EXECUTION="$(resolve_repo_path "$EXECUTION")"
INPUT_STEM="$(resolve_repo_path "$INPUT_STEM")"

HOST_BIN="${CSSMV_HOST_CARLA_BIN:-${CSSMV_HOST_PLUGIN_BIN:-}}"
if [[ -z "$HOST_BIN" ]]; then
  echo "[cssmv-plugin-host-adapter] CSSMV_HOST_CARLA_BIN or CSSMV_HOST_PLUGIN_BIN is not set" >&2
  exit 12
fi
if [[ ! -x "$HOST_BIN" ]]; then
  echo "[cssmv-plugin-host-adapter] host binary is not executable: $HOST_BIN" >&2
  exit 13
fi

echo "[cssmv-plugin-host-adapter] project=$PROJECT stack=$STACK chain=$CHAIN plan=$PLAN execution=$EXECUTION input_stem=$INPUT_STEM host=$HOST_BIN" >&2
"$HOST_BIN" --version >/dev/null 2>&1 || {
  echo "[cssmv-plugin-host-adapter] host binary did not answer --version: $HOST_BIN" >&2
  exit 14
}

if [[ -n "$STACK" ]]; then
  if [[ -f "$REPO_ROOT/dist/cssmv/hosts/run-carla-instrument-host.js" ]]; then
    exec node "$REPO_ROOT/dist/cssmv/hosts/run-carla-instrument-host.js" \
      --project "$PROJECT" \
      --stack "$STACK" \
      --plan "$PLAN" \
      --execution "$EXECUTION"
  fi
  exec node -r ts-node/register/transpile-only "$REPO_ROOT/src/cssmv/hosts/run-carla-instrument-host.ts" \
    --project "$PROJECT" \
    --stack "$STACK" \
    --plan "$PLAN" \
    --execution "$EXECUTION"
fi

if [[ -n "$CHAIN" ]]; then
  if [[ -f "$REPO_ROOT/dist/cssmv/hosts/run-carla-fx-host.js" ]]; then
    exec node "$REPO_ROOT/dist/cssmv/hosts/run-carla-fx-host.js" \
      --project "$PROJECT" \
      --mode fx \
      --chain "$CHAIN" \
      --input-stem "$INPUT_STEM" \
      --plan "$PLAN" \
      --execution "$EXECUTION"
  fi
  exec node -r ts-node/register/transpile-only "$REPO_ROOT/src/cssmv/hosts/run-carla-fx-host.ts" \
    --project "$PROJECT" \
    --mode fx \
    --chain "$CHAIN" \
    --input-stem "$INPUT_STEM" \
    --plan "$PLAN" \
    --execution "$EXECUTION"
fi

echo "[cssmv-plugin-host-adapter] neither --stack nor --chain was provided." >&2
exit 15
