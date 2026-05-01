#!/usr/bin/env bash
set -euo pipefail

REQUEST_MANIFEST="${1:-}"
LYRICS_INPUT="${2:-}"
OUTPUT_MANIFEST="${3:-}"
ARTIFACT_DIR="${4:-}"

if [[ -z "$REQUEST_MANIFEST" || -z "$LYRICS_INPUT" || -z "$OUTPUT_MANIFEST" || -z "$ARTIFACT_DIR" ]]; then
  echo "[cssmv-diffsinger-render-template] usage: <request_manifest> <lyrics_input> <output_manifest> <artifact_dir>" >&2
  exit 91
fi

PYTHON_BIN="${CSSMV_DIFFSINGER_PYTHON:-python3}"
if ! command -v "$PYTHON_BIN" >/dev/null 2>&1; then
  echo "[cssmv-diffsinger-render-template] python executable not found: $PYTHON_BIN" >&2
  exit 92
fi

expand_template() {
  local template="$1"
  python3 - "$template" "$REQUEST_MANIFEST" "$LYRICS_INPUT" "$OUTPUT_MANIFEST" "$ARTIFACT_DIR" "$PYTHON_BIN" <<'PY'
import sys

template = sys.argv[1]
replacements = {
    "{{REQUEST_MANIFEST}}": sys.argv[2],
    "{{LYRICS_INPUT}}": sys.argv[3],
    "{{OUTPUT_MANIFEST}}": sys.argv[4],
    "{{ARTIFACT_DIR}}": sys.argv[5],
    "{{PYTHON_BIN}}": sys.argv[6],
}
for key, value in replacements.items():
    template = template.replace(key, value)
print(template)
PY
}

if [[ -n "${CSSMV_DIFFSINGER_RENDER_HTTP_URL:-}" ]]; then
  echo "[cssmv-diffsinger-render-template] posting render request to $CSSMV_DIFFSINGER_RENDER_HTTP_URL" >&2
  "$PYTHON_BIN" - "$CSSMV_DIFFSINGER_RENDER_HTTP_URL" "$REQUEST_MANIFEST" "$LYRICS_INPUT" "$OUTPUT_MANIFEST" "$ARTIFACT_DIR" <<'PY'
import json
import sys
import urllib.request

url, request_manifest, lyrics_input, output_manifest, artifact_dir = sys.argv[1:]
payload = {
    "request_manifest": request_manifest,
    "lyrics_input": lyrics_input,
    "output_manifest": output_manifest,
    "artifact_dir": artifact_dir,
}
req = urllib.request.Request(
    url,
    data=json.dumps(payload).encode("utf-8"),
    headers={"Content-Type": "application/json"},
    method="POST",
)
with urllib.request.urlopen(req, timeout=600) as response:
    sys.stdout.write(response.read().decode("utf-8", errors="replace"))
PY
  exit 0
fi

CLI_TEMPLATE="${CSSMV_DIFFSINGER_CLI_TEMPLATE:-}"
if [[ -z "$CLI_TEMPLATE" ]]; then
  echo "[cssmv-diffsinger-render-template] set CSSMV_DIFFSINGER_RENDER_HTTP_URL or CSSMV_DIFFSINGER_CLI_TEMPLATE" >&2
  exit 93
fi

COMMAND="$(expand_template "$CLI_TEMPLATE")"
echo "[cssmv-diffsinger-render-template] command=$COMMAND" >&2
eval "$COMMAND"
