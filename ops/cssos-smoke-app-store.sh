#!/usr/bin/env bash
# CSSOS_WAVE_204 20260516 — App Store pre-submission smoke
# Plain bash (no eval), each check is a self-contained function.

set -uo pipefail
BASE="${CSSOS_BASE:-https://cssstudio.app}"
RESULTS=()
FAILS=0

pass() { RESULTS+=("PASS  $1  →  $2"); }
fail() { RESULTS+=("FAIL  $1  →  $2"); FAILS=$((FAILS+1)); }

code() { curl -sk -o /dev/null -w "%{http_code}" --max-time 8 "$@"; }
body() { curl -sk --max-time 8 "$@"; }

# 1. Apple-required public pages
c=$(code "$BASE/privacy.html"); [ "$c" = "200" ] && pass "Privacy page reachable" "$c" || fail "Privacy page reachable" "$c"
c=$(code "$BASE/terms.html");   [ "$c" = "200" ] && pass "Terms page reachable" "$c" || fail "Terms page reachable" "$c"
body "$BASE/privacy.html" | grep -qi "data\|privacy" && pass "Privacy mentions data/privacy" "found" || fail "Privacy mentions data/privacy" "missing"
body "$BASE/terms.html"   | grep -qi "subscription\|service\|terms" && pass "Terms mentions service/subscription" "found" || fail "Terms mentions service/subscription" "missing"

# 2. App shell + manifest
c=$(code "$BASE/"); [ "$c" = "200" ] && pass "/ returns 200" "$c" || fail "/ returns 200" "$c"
body "$BASE/index.html" | grep -q "viewport-fit=cover" && pass "index.html viewport-fit=cover" "found" || fail "index.html viewport-fit=cover" "missing"
body "$BASE/index.html" | grep -q "apple-mobile-web-app-capable" && pass "iOS web-app meta present" "found" || fail "iOS web-app meta present" "missing"
c=$(code "$BASE/manifest.webmanifest"); [ "$c" = "200" ] && pass "manifest reachable" "$c" || fail "manifest reachable" "$c"
body "$BASE/manifest.webmanifest" | grep -q '"orientation":[[:space:]]*"portrait"' && pass "manifest orientation=portrait" "found" || fail "manifest orientation=portrait" "missing"
v=$(body "$BASE/version.json"); echo "$v" | grep -q '"version"' && pass "/version.json responds" "$(echo "$v" | tr -d '"{}' )" || fail "/version.json responds" "$v"

# 3. Core API endpoints (guests get correct codes)
c=$(code "$BASE/api/me"); [ "$c" = "200" ] && pass "/api/me 200 (guest ok)" "$c" || fail "/api/me 200 (guest ok)" "$c"
body "$BASE/api/me" | grep -q '"ok":true' && pass "/api/me ok:true" "found" || fail "/api/me ok:true" "missing"
c=$(code "$BASE/api/works/mine"); [ "$c" = "401" ] && pass "/api/works/mine 401 unauth" "$c" || fail "/api/works/mine 401 unauth" "$c"
c=$(code "$BASE/api/works/market?limit=3"); [ "$c" = "200" ] && pass "/api/works/market 200 public" "$c" || fail "/api/works/market 200 public" "$c"
c=$(code -X POST -H 'content-type: application/json' --data '{}' "$BASE/api/agent/chat"); [ "$c" = "401" ] && pass "/api/agent/chat 401 unauth" "$c" || fail "/api/agent/chat 401 unauth" "$c"

# 4. Account deletion (Apple 5.1.1(v))
c=$(code -X POST "$BASE/api/account/delete");
if [ "$c" = "401" ] || [ "$c" = "404" ]; then
  [ "$c" = "401" ] && pass "/api/account/delete 401 unauth" "$c" || fail "/api/account/delete endpoint missing" "404"
else
  pass "/api/account/delete exists" "$c"
fi

# 5. Sign in with Apple
c=$(code "$BASE/api/auth/apple/start")
if [ "$c" = "302" ] || [ "$c" = "303" ] || [ "$c" = "307" ] || [ "$c" = "200" ]; then
  pass "Sign in with Apple /start" "$c"
else
  fail "Sign in with Apple /start" "$c"
fi

# 6. Static JS bundles
for f in app.boot.js app.market-commerce.js app.mv-pipeline-panel.js app.agent-chat.js app.crash-guard.js app.orientation-lock.js app.app-fullscreen-immersive.js app.wake-lock.js; do
  c=$(code "$BASE/$f"); [ "$c" = "200" ] && pass "$f" "$c" || fail "$f" "$c"
done

# 7. Person-MV
c=$(code "$BASE/api/person-mv/people")
if [ "$c" = "200" ] || [ "$c" = "401" ] || [ "$c" = "304" ]; then
  pass "person-mv people list" "$c"
else
  fail "person-mv people list" "$c"
fi

# 8. Host health
sshok=$(ssh -o ConnectTimeout=6 api-vm 'echo ok' 2>/dev/null || echo "no")
if [ "$sshok" = "ok" ]; then
  for unit in cssOS nginx cssos-oom-detect.timer; do
    s=$(ssh -o ConnectTimeout=4 api-vm "systemctl is-active $unit" 2>/dev/null)
    [ "$s" = "active" ] && pass "$unit active" "$s" || fail "$unit active" "$s"
  done
  rss_mb=$(ssh -o ConnectTimeout=4 api-vm 'rss=$(ps -o rss= -p $(systemctl show -p MainPID --value cssOS)); echo $((rss/1024))' 2>/dev/null)
  if [ -n "$rss_mb" ] && [ "$rss_mb" -lt 4096 ]; then
    pass "cssOS RSS < 4 GB" "${rss_mb}MB"
  else
    fail "cssOS RSS < 4 GB" "${rss_mb}MB"
  fi
  errs=$(ssh -o ConnectTimeout=6 api-vm 'sudo journalctl -u cssOS --since "1 hour ago" --no-pager 2>/dev/null | grep -c "crash-guard.*window.error\|crash-guard.*unhandledrejection" || echo 0' 2>/dev/null)
  errs="${errs:-0}"
  if [ "$errs" -lt 5 ]; then
    pass "crash-guard fatals (1h)" "$errs"
  else
    fail "crash-guard fatals (1h)" "$errs"
  fi
  ooms=$(ssh -o ConnectTimeout=6 api-vm 'sudo wc -l < /srv/cssos/shared/oom-events.jsonl 2>/dev/null || echo 0' 2>/dev/null)
  pass "Total OOM events recorded" "${ooms:-0}"
else
  fail "SSH to api-vm" "$sshok"
fi

echo
echo "=== cssOS App Store pre-submission smoke @ $BASE ==="
printf '%s\n' "${RESULTS[@]}"
echo
echo "=== summary: $((${#RESULTS[@]} - FAILS)) PASS / $FAILS FAIL ==="
exit $FAILS
