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

say "all checks passed"
