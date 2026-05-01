#!/usr/bin/env bash
# CSSOS_PHASE2_SUNO 20260419 — Live smoke test for the Suno v5 music engine.
#
# Exercises:
#   1. Public catalog: /api/mv/engines reports suno/v5 as the music-stage default
#   2. Public pricing: /cssapi/v1/pricing lists an entry for suno/v5
#   3. Live generation: POST /api/mv/music { engine: "suno", version: "v5" }
#      returns ok=true + an audio_url that actually serves audio/mpeg
#
# Required env:
#   BASE_URL         e.g. https://cssstudio.app or http://127.0.0.1:8081
#   COOKIE_JAR       curl cookie jar for an authed session (skipped if
#                    SKIP_LIVE_CALL=1 since the catalog/pricing calls are public)
#
# Optional env:
#   SKIP_LIVE_CALL=1         run only the catalog+pricing public checks
#   PROMPT="..."             caller prompt  (defaults to a cinematic sample)
#   STYLE="..."              music style    (defaults to cinematic orchestral)
#   LYRICS="..."             user lyrics    (empty → instrumental path)
#   INSTRUMENTAL=true|false  (default: true when LYRICS is empty)
#   MAX_WAIT_SECS=720        curl --max-time for the live POST
#
# Server side (rust-api process env):
#   SUNO_API_KEY (required)
#   SUNO_BASE_URL       default https://api.sunoapi.org
#   SUNO_MODEL          default V4     (V4_5 / V3_5 also valid)
#   SUNO_TIMEOUT_SECS   default 600
#   SUNO_POLL_SECS      default 6
#   SUNO_RETURN_FIRST_CLIP=1  to early-return on FIRST_SUCCESS
#
# Exit codes: 0 pass, 1 assertion failed, 2 missing required env.

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8081}"
COOKIE_JAR="${COOKIE_JAR:-}"
SKIP_LIVE_CALL="${SKIP_LIVE_CALL:-0}"
PROMPT="${PROMPT:-A cinematic orchestral swell with driving percussion, building to a triumphant chorus}"
STYLE="${STYLE:-cinematic orchestral, epic trailer}"
LYRICS="${LYRICS:-}"
if [[ -z "${INSTRUMENTAL:-}" ]]; then
  [[ -z "${LYRICS}" ]] && INSTRUMENTAL=true || INSTRUMENTAL=false
fi
MAX_WAIT_SECS="${MAX_WAIT_SECS:-720}"

say()  { printf '[suno-smoke] %s\n' "$*"; }
fail() { printf '[suno-smoke] FAIL %s\n' "$*" >&2; exit 1; }

assert_json_env() {
  # Runs a small Python check against a JSON string in env var JSON_INPUT.
  # Exits non-zero (and triggers our trap) on failure.
  local name="$1"; local check="$2"
  python3 - "$name" "$check" <<'PY'
import json, os, sys
name, check = sys.argv[1], sys.argv[2]
try:
    data = json.loads(os.environ["JSON_INPUT"])
except Exception as e:
    print(f"[suno-smoke] FAIL {name}: JSON parse error: {e}", file=sys.stderr); sys.exit(1)
ns = {"data": data}
try:
    ok = bool(eval(check, {"__builtins__": {"any": any, "all": all, "len": len, "next": next, "sorted": sorted}}, ns))
except Exception as e:
    print(f"[suno-smoke] FAIL {name}: check raised {type(e).__name__}: {e}", file=sys.stderr); sys.exit(1)
if not ok:
    print(f"[suno-smoke] FAIL {name}", file=sys.stderr)
    print(json.dumps(data, ensure_ascii=False, indent=2)[:2000], file=sys.stderr); sys.exit(1)
print(f"[suno-smoke] OK   {name}")
PY
}

# ------------------------------------------------------------- 1. catalog
say "base_url=${BASE_URL}"

# /cssapi/v1/engines is the public, truly-unauthed catalog feed. Assert the
# suno v5 row is registered there before we bother with the auth-gated
# /api/mv/engines view.
say "checking /cssapi/v1/engines (public engine catalog)..."
JSON_INPUT="$(curl -fsS "${BASE_URL}/cssapi/v1/engines")" \
  || fail "public engines catalog fetch failed"
export JSON_INPUT
assert_json_env \
  "public_engines_suno_v5" \
  'any(e.get("name") == "suno" and any(v.get("version") == "v5" for v in e.get("versions", [])) for e in data.get("engines", []))'

# /api/mv/engines is the authed UI catalog. If we have a cookie jar, use it
# here so we also confirm suno v5 is the music-stage default under auth.
if [[ -n "${COOKIE_JAR}" && -f "${COOKIE_JAR}" ]]; then
  say "checking /api/mv/engines (authed catalog)..."
  JSON_INPUT="$(curl -fsS -b "${COOKIE_JAR}" "${BASE_URL}/api/mv/engines")" \
    || fail "authed engines catalog fetch failed"
  export JSON_INPUT
  assert_json_env \
    "catalog_music_default_suno_v5" \
    'any(s.get("stage") == "music" and s.get("default_engine") == "suno" and s.get("default_version") == "v5" for s in data.get("stages", []))'
  assert_json_env \
    "catalog_suno_v5_enabled" \
    'any(e.get("engine") == "suno" and e.get("version") == "v5" for s in data.get("stages", []) if s.get("stage") == "music" for e in s.get("engines", []))'
else
  say "skip /api/mv/engines check — no COOKIE_JAR provided"
fi

# ------------------------------------------------------------- 2. pricing
say "checking /cssapi/v1/pricing (public pricing feed)..."
JSON_INPUT="$(curl -fsS "${BASE_URL}/cssapi/v1/pricing")" \
  || fail "pricing fetch failed"
export JSON_INPUT
assert_json_env \
  "pricing_suno_v5" \
  'any(p.get("engine") == "suno" and p.get("version") == "v5" and p.get("base_price_usd", 0) > 0 for p in data.get("pricing", []))'

# ------------------------------------------------------------- 3. live call
if [[ "${SKIP_LIVE_CALL}" == "1" ]]; then
  say "SKIP_LIVE_CALL=1 — catalog + pricing only"
  say "all checks passed"
  exit 0
fi

[[ -n "${COOKIE_JAR}" ]]   || { say "COOKIE_JAR is required for live call (or set SKIP_LIVE_CALL=1)"; exit 2; }
[[ -f "${COOKIE_JAR}"  ]]  || { say "COOKIE_JAR file not found: ${COOKIE_JAR}"; exit 2; }

# Build the request body with Python (handles all quoting edge cases).
REQ_BODY="$(
  PROMPT="${PROMPT}" \
  STYLE="${STYLE}" \
  LYRICS="${LYRICS}" \
  INSTRUMENTAL="${INSTRUMENTAL}" \
  python3 - <<'PY'
import json, os
b = {
    "prompt": os.environ["PROMPT"],
    "music_style": os.environ["STYLE"],
    "make_instrumental": os.environ["INSTRUMENTAL"].lower() in ("1", "true", "yes"),
    "engine": "suno",
    "version": "v5",
    "language": "en",
}
if os.environ.get("LYRICS", ""):
    b["lyrics"] = os.environ["LYRICS"]
print(json.dumps(b, ensure_ascii=False))
PY
)"
export REQ_BODY

say "POST /api/mv/music (engine=suno v5, may take several minutes)..."
JSON_INPUT="$(curl -fsS --max-time "${MAX_WAIT_SECS}" \
  -b "${COOKIE_JAR}" \
  -H 'Content-Type: application/json' \
  -X POST "${BASE_URL}/api/mv/music" \
  --data "${REQ_BODY}")" \
  || fail "live POST /api/mv/music failed"
export JSON_INPUT

assert_json_env \
  "live_music_ok" \
  'data.get("ok") is True'
assert_json_env \
  "live_music_engine_suno_v5" \
  'data.get("engine") == "suno" and data.get("version") == "v5"'
assert_json_env \
  "live_music_audio_url_http" \
  '(data.get("audio_url") or "").startswith("http")'
assert_json_env \
  "live_music_has_task_id" \
  'isinstance(data.get("task_id"), str) and len(data.get("task_id")) > 0'

# Print the full live-call summary so ops can eyeball it.
python3 - <<'PY'
import json, os
d = json.loads(os.environ["JSON_INPUT"])
keys = ("task_id","conversion_id","engine","version","format",
        "duration_secs","title","cost_cents","audio_url")
for k in keys:
    print(f"[suno-smoke]    {k}={d.get(k)}")
PY

# Pull the audio URL for a HEAD-probe using jq-free Python.
AUDIO_URL="$(python3 -c 'import json, os; print(json.loads(os.environ["JSON_INPUT"]).get("audio_url",""))')"
[[ -n "${AUDIO_URL}" ]] || fail "audio_url empty after live call"

say "HEAD probing audio_url to confirm it serves audio..."
CT="$(curl -fsSI --max-time 30 "${AUDIO_URL}" \
        | awk -F': ' 'tolower($1)=="content-type"{print tolower($2)}' \
        | tr -d '\r\n' || true)"
if [[ -z "${CT}" ]]; then
  say "WARN: no Content-Type on audio_url HEAD (CDN may not allow HEAD); skipping strict check"
else
  case "${CT}" in
    audio/*|application/octet-stream*|binary/octet-stream*)
      say "OK   audio_url Content-Type=${CT}" ;;
    *)
      fail "audio_url Content-Type=${CT}, expected audio/*" ;;
  esac
fi

say "all checks passed (catalog + pricing + live Suno generation)"
