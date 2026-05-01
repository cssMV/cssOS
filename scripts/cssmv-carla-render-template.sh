#!/usr/bin/env bash
set -euo pipefail

SESSION_MANIFEST="${1:-}"
OUTPUT_MANIFEST="${2:-}"
ARTIFACT_DIR="${3:-}"

if [[ -z "$SESSION_MANIFEST" || -z "$OUTPUT_MANIFEST" || -z "$ARTIFACT_DIR" ]]; then
  echo "[cssmv-carla-render-template] usage: <session_manifest> <output_manifest> <artifact_dir>" >&2
  exit 81
fi

if [[ ! -f "$SESSION_MANIFEST" ]]; then
  echo "[cssmv-carla-render-template] session manifest missing: $SESSION_MANIFEST" >&2
  exit 82
fi
if [[ ! -f "$OUTPUT_MANIFEST" ]]; then
  echo "[cssmv-carla-render-template] output manifest missing: $OUTPUT_MANIFEST" >&2
  exit 83
fi

HOST_BIN="${CSSMV_HOST_CARLA_BIN:-${CSSMV_HOST_PLUGIN_BIN:-${CSSMV_HOST_MIX_BIN:-}}}"
if [[ -z "$HOST_BIN" ]]; then
  echo "[cssmv-carla-render-template] CSSMV_HOST_CARLA_BIN / CSSMV_HOST_PLUGIN_BIN / CSSMV_HOST_MIX_BIN is not set" >&2
  exit 84
fi

json_field() {
  local file="$1"
  local expr="$2"
  python3 - "$file" "$expr" <<'PY'
import json
import sys

payload = json.load(open(sys.argv[1], "r", encoding="utf-8"))
value = payload
for part in sys.argv[2].split("."):
    if not part:
        continue
    if isinstance(value, dict):
        value = value.get(part, "")
    else:
        value = ""
        break
if isinstance(value, (list, dict)):
    print(json.dumps(value))
else:
    print("" if value is None else str(value))
PY
}

MODE="$(json_field "$SESSION_MANIFEST" "mode" | tr '[:upper:]' '[:lower:]')"
SESSION_DIR="$(dirname "$SESSION_MANIFEST")"
INPUT_STEM="$(json_field "$SESSION_MANIFEST" "inputStemPath")"

MODE_KEY="INSTRUMENT"
if [[ "$MODE" == "fx" ]]; then
  MODE_KEY="VOCAL_FX"
elif [[ "$MODE" == "mix" ]]; then
  MODE_KEY="MIX"
fi

PROJECT_VAR="CSSMV_CARLA_${MODE_KEY}_PROJECT_TEMPLATE"
PROJECT_TEMPLATE="${!PROJECT_VAR:-}"
SESSION_PROJECT="$SESSION_DIR/session.carxp"

python3 - "$OUTPUT_MANIFEST" "$ARTIFACT_DIR" "$SESSION_DIR" "$INPUT_STEM" "$PROJECT_TEMPLATE" "$SESSION_PROJECT" <<'PY'
import json
import pathlib
import sys

output_manifest = pathlib.Path(sys.argv[1])
artifact_dir = pathlib.Path(sys.argv[2])
session_dir = pathlib.Path(sys.argv[3])
input_stem = sys.argv[4]
project_template = sys.argv[5]
session_project = pathlib.Path(sys.argv[6])

outputs = json.loads(output_manifest.read_text(encoding="utf-8")).get("outputArtifacts", [])
replacements = {
    "{{OUTPUT_MANIFEST}}": str(output_manifest),
    "{{ARTIFACT_DIR}}": str(artifact_dir),
    "{{SESSION_DIR}}": str(session_dir),
    "{{INPUT_STEM}}": input_stem,
}
for index, artifact in enumerate(outputs, start=1):
    artifact_path = artifact_dir / artifact
    replacements[f"{{{{OUTPUT_{index}}}}}"] = str(artifact_path)
    replacements[f"{{{{OUTPUT_BASENAME_{index}}}}}"] = pathlib.Path(artifact).name

if project_template:
    template = pathlib.Path(project_template).read_text(encoding="utf-8")
    for key, value in replacements.items():
        template = template.replace(key, value)
    session_project.write_text(template, encoding="utf-8")
PY

expand_template() {
  local template="$1"
  python3 - "$template" "$HOST_BIN" "$SESSION_MANIFEST" "$OUTPUT_MANIFEST" "$ARTIFACT_DIR" "$SESSION_DIR" "$INPUT_STEM" "$SESSION_PROJECT" <<'PY'
import sys

template = sys.argv[1]
replacements = {
    "{{HOST_BIN}}": sys.argv[2],
    "{{SESSION_MANIFEST}}": sys.argv[3],
    "{{OUTPUT_MANIFEST}}": sys.argv[4],
    "{{ARTIFACT_DIR}}": sys.argv[5],
    "{{SESSION_DIR}}": sys.argv[6],
    "{{INPUT_STEM}}": sys.argv[7],
    "{{PROJECT_FILE}}": sys.argv[8],
}
for key, value in replacements.items():
    template = template.replace(key, value)
print(template)
PY
}

HOST_ARGS_TEMPLATE="${CSSMV_CARLA_HOST_ARGS:-}"
STAGE_CMD_VAR="CSSMV_CARLA_STAGE_RENDER_CMD_${MODE_KEY}"
STAGE_CMD_TEMPLATE="${!STAGE_CMD_VAR:-}"

if [[ -n "$PROJECT_TEMPLATE" ]]; then
  echo "[cssmv-carla-render-template] prepared $MODE project: $SESSION_PROJECT" >&2
fi

if [[ -n "$HOST_ARGS_TEMPLATE" ]]; then
  HOST_ARGS="$(expand_template "$HOST_ARGS_TEMPLATE")"
  echo "[cssmv-carla-render-template] launching host: $HOST_BIN $HOST_ARGS" >&2
  "$HOST_BIN" $HOST_ARGS >/dev/null 2>&1 || true
fi

if [[ -z "$STAGE_CMD_TEMPLATE" ]]; then
  if [[ -n "$PROJECT_TEMPLATE" ]]; then
    echo "[cssmv-carla-render-template] no ${STAGE_CMD_VAR} provided; relying on the prepared session template." >&2
    exit 0
  fi
  echo "[cssmv-carla-render-template] ${STAGE_CMD_VAR} is not set" >&2
  exit 85
fi

STAGE_COMMAND="$(expand_template "$STAGE_CMD_TEMPLATE")"
echo "[cssmv-carla-render-template] stage=$MODE command=$STAGE_COMMAND" >&2
eval "$STAGE_COMMAND"
