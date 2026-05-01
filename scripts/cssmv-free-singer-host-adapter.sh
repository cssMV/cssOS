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
LYRICS=""
PLAN=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --project) PROJECT="${2:-}"; shift 2 ;;
    --stack) STACK="${2:-}"; shift 2 ;;
    --lyrics) LYRICS="${2:-}"; shift 2 ;;
    --plan) PLAN="${2:-}"; shift 2 ;;
    *) shift ;;
  esac
done

LYRICS="$(resolve_repo_path "$LYRICS")"
PLAN="$(resolve_repo_path "$PLAN")"

STACK_KEY="$(printf '%s' "$STACK" | tr '[:upper:]' '[:lower:]')"
SINGER_BACKEND="${CSSMV_SINGER_BACKEND:-}"
if [[ -z "$SINGER_BACKEND" ]]; then
  case "$STACK_KEY" in
    *openutau*)
      SINGER_BACKEND="openutau"
      ;;
    *enunu*)
      SINGER_BACKEND="enunu"
      ;;
    *nnsvs*)
      SINGER_BACKEND="nnsvs"
      ;;
    *world*)
      SINGER_BACKEND="world"
      ;;
    *generic*|*world*|*hifigan*)
      SINGER_BACKEND="generic"
      ;;
    *)
      SINGER_BACKEND="diffsinger"
      ;;
  esac
fi

RENDER_TEMPLATE="${CSSMV_DIFFSINGER_RENDER_CMD:-${CSSMV_DIFFSINGER_GENERIC_RENDER_CMD:-}}"
case "$SINGER_BACKEND" in
  openutau)
    RENDER_TEMPLATE="${CSSMV_OPENUTAU_RENDER_CMD:-${CSSMV_SINGER_GENERIC_RENDER_CMD:-$RENDER_TEMPLATE}}"
    ;;
  enunu)
    RENDER_TEMPLATE="${CSSMV_ENUNU_RENDER_CMD:-${CSSMV_NNSVS_RENDER_CMD:-${CSSMV_SINGER_GENERIC_RENDER_CMD:-$RENDER_TEMPLATE}}}"
    ;;
  nnsvs)
    RENDER_TEMPLATE="${CSSMV_NNSVS_RENDER_CMD:-${CSSMV_ENUNU_RENDER_CMD:-${CSSMV_SINGER_GENERIC_RENDER_CMD:-$RENDER_TEMPLATE}}}"
    ;;
  world)
    RENDER_TEMPLATE="${CSSMV_WORLD_RENDER_CMD:-${CSSMV_SINGER_GENERIC_RENDER_CMD:-$RENDER_TEMPLATE}}"
    ;;
  generic)
    RENDER_TEMPLATE="${CSSMV_SINGER_GENERIC_RENDER_CMD:-$RENDER_TEMPLATE}"
    ;;
esac

if [[ -z "$RENDER_TEMPLATE" ]]; then
  echo "[cssmv-singer-host-adapter] no render template configured for backend=$SINGER_BACKEND stack=$STACK" >&2
  exit 21
fi

if [[ "$SINGER_BACKEND" == "diffsinger" ]]; then
  ENGINE_ROOT="${CSSMV_DIFFSINGER_MINI_ROOT:-}"
  PYTHON_BIN="${CSSMV_DIFFSINGER_PYTHON:-python3}"
  SKIP_ONNXRUNTIME_CHECK="${CSSMV_DIFFSINGER_SKIP_ONNXRUNTIME_CHECK:-}"

  if [[ -z "$ENGINE_ROOT" ]]; then
    echo "[cssmv-singer-host-adapter] CSSMV_DIFFSINGER_MINI_ROOT is not set" >&2
    exit 22
  fi
  if [[ ! -f "$ENGINE_ROOT/server.py" ]]; then
    echo "[cssmv-singer-host-adapter] server.py not found under: $ENGINE_ROOT" >&2
    exit 23
  fi
  if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
    echo "[cssmv-singer-host-adapter] python executable not found: $PYTHON_BIN" >&2
    exit 24
  fi

  echo "[cssmv-singer-host-adapter] project=$PROJECT stack=$STACK backend=$SINGER_BACKEND lyrics=$LYRICS plan=$PLAN engine_root=$ENGINE_ROOT python=$PYTHON_BIN" >&2

  if [[ "$SKIP_ONNXRUNTIME_CHECK" != "1" ]]; then
    "$PYTHON_BIN" - <<'PY' >/dev/null 2>&1
import onnxruntime  # noqa: F401
PY
  fi
else
  echo "[cssmv-singer-host-adapter] project=$PROJECT stack=$STACK backend=$SINGER_BACKEND lyrics=$LYRICS plan=$PLAN" >&2
fi

if [[ -f "$REPO_ROOT/dist/cssmv/hosts/run-diffsinger-vocal-host.js" ]]; then
  exec env CSSMV_DIFFSINGER_RENDER_CMD="$RENDER_TEMPLATE" node "$REPO_ROOT/dist/cssmv/hosts/run-diffsinger-vocal-host.js" \
    --project "$PROJECT" \
    --stack "$STACK" \
    --lyrics "$LYRICS" \
    --plan "$PLAN"
fi

exec env CSSMV_DIFFSINGER_RENDER_CMD="$RENDER_TEMPLATE" node -r ts-node/register/transpile-only "$REPO_ROOT/src/cssmv/hosts/run-diffsinger-vocal-host.ts" \
  --project "$PROJECT" \
  --stack "$STACK" \
  --lyrics "$LYRICS" \
  --plan "$PLAN"
