#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUST_API_DIR="$ROOT_DIR/rust-api"
LOCAL_ENV_FILE="$ROOT_DIR/.env.local"
SYSTEM_ENV_FILE="/etc/cssos.env"
BIN_PATH="$RUST_API_DIR/target/debug/westworld_prelude_i_temporal"

load_env_file() {
  local file_path="$1"
  if [[ -f "$file_path" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$file_path"
    set +a
    return 0
  fi
  return 1
}

load_env_file "$LOCAL_ENV_FILE" || load_env_file "$SYSTEM_ENV_FILE" || true

if [[ -z "${OPENAI_API_KEY:-}" ]]; then
  echo "[westworld-prelude-temporal] OPENAI_API_KEY is not set after loading env files." >&2
  echo "[westworld-prelude-temporal] tried: $LOCAL_ENV_FILE and $SYSTEM_ENV_FILE" >&2
  exit 1
fi

cd "$RUST_API_DIR"

if [[ -x "$BIN_PATH" ]]; then
  exec "$BIN_PATH"
fi

exec cargo run --bin westworld_prelude_i_temporal
