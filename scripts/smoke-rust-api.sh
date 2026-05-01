#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8081}"
CURL_OPTS="${CURL_OPTS:--fsS}"
RESOLVE_HOST="${RESOLVE_HOST:-}"
SKIP_HEALTH="${SKIP_HEALTH:-0}"

say() {
  printf '[smoke] %s\n' "$*"
}

fetch() {
  local path="$1"
  if [[ -n "${RESOLVE_HOST}" ]]; then
    curl ${CURL_OPTS} --resolve "${RESOLVE_HOST}" "${BASE_URL}${path}"
  else
    curl ${CURL_OPTS} "${BASE_URL}${path}"
  fi
}

assert_json() {
  local name="$1"
  local path="$2"
  local check="$3"
  local body
  body="$(fetch "$path")"
  JSON_INPUT="$body" python3 - "$name" "$check" <<'PY'
import json
import os
import sys

name = sys.argv[1]
check = sys.argv[2]
data = json.loads(os.environ["JSON_INPUT"])
ns = {"data": data}
safe_builtins = {"any": any, "all": all, "len": len}
ok = bool(eval(check, {"__builtins__": safe_builtins}, ns))
if not ok:
    print(f"[smoke] FAIL {name}")
    print(json.dumps(data, ensure_ascii=False, indent=2))
    sys.exit(1)
print(f"[smoke] OK   {name}")
PY
}

say "base url: ${BASE_URL}"

if [[ "${SKIP_HEALTH}" != "1" ]]; then
  assert_json \
    "health" \
    "/api/health" \
    'data.get("ok") is True and data.get("schema") == "css.health.v1"'
fi

assert_json \
  "engines" \
  "/cssapi/v1/engines" \
  'any(e.get("name") == "cssmv" and any(v.get("version") == "v3.0" for v in e.get("versions", [])) for e in data.get("engines", []))'

assert_json \
  "pricing" \
  "/cssapi/v1/pricing" \
  'any(item.get("engine") == "cssmv" and item.get("version") == "v3.0" for item in data.get("pricing", []))'

assert_json \
  "schema_mv" \
  "/cssapi/v1/schema/mv" \
  '"engine" in data.get("required_fields", []) and "input" in data.get("required_fields", [])'

# CSSOS_PHASE2_MV_SMOKE 20260417 — 3P engines registered + price rules seeded.
assert_json \
  "engines_musicgpt" \
  "/cssapi/v1/engines" \
  'any(e.get("name") == "musicgpt" for e in data.get("engines", []))'

assert_json \
  "engines_runway" \
  "/cssapi/v1/engines" \
  'any(e.get("name") == "runway" for e in data.get("engines", []))'

assert_json \
  "pricing_musicgpt" \
  "/cssapi/v1/pricing" \
  'any(item.get("engine") == "musicgpt" for item in data.get("pricing", []))'

assert_json \
  "pricing_runway_gen4_image" \
  "/cssapi/v1/pricing" \
  'any(item.get("engine") == "runway" and item.get("version") == "gen4-image" for item in data.get("pricing", []))'

# CSSOS_PHASE2_SUNO 20260419 — Suno v5 registered + priced + flagged as the
# new default music engine. These three checks confirm the three-file catalog
# plumbing (engine_registry, billing_matrix, public_api::pricing) is wired.
assert_json \
  "engines_suno_v5" \
  "/cssapi/v1/engines" \
  'any(e.get("name") == "suno" and any(v.get("version") == "v5" for v in e.get("versions", [])) for e in data.get("engines", []))'

assert_json \
  "pricing_suno_v5" \
  "/cssapi/v1/pricing" \
  'any(item.get("engine") == "suno" and item.get("version") == "v5" for item in data.get("pricing", []))'

# Suno must be the catalog default for the music stage (is_default: true in
# billing_matrix::builtin_registry). Falls back to musicgpt-default if the
# stage has no is_default entry at all, which would be a regression.
assert_json \
  "catalog_music_default_suno" \
  "/api/mv/engines" \
  'any(s.get("stage") == "music" and s.get("default_engine") == "suno" and s.get("default_version") == "v5" for s in data.get("stages", []))'

say "all checks passed"
