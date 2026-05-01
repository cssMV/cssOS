#!/usr/bin/env bash
# Force-rebuild rust-api from fresh source + redeploy binary.
# Run via: ssh api-vm 'bash -s' < ~/cssOS/.musicgpt-rebuild.sh
set -e

REMOTE_REPO=/srv/cssos/repo
cd "$REMOTE_REPO/rust-api"

echo "=== 1) remote source has fix? ==="
grep -n 'conversionType' src/music_gen/musicgpt.rs || true
echo

echo "=== 2) currently deployed binary ==="
stat -c '  /usr/local/bin: mtime=%y  size=%s' /usr/local/bin/cssos-rust-api
echo "  conversionType count:"
sudo strings /usr/local/bin/cssos-rust-api | grep -c conversionType || true
echo

echo "=== 3) any old target/release binary? ==="
if [ -f target/release/cssos-rust-api ]; then
  stat -c '  target/release: mtime=%y  size=%s' target/release/cssos-rust-api
  md5sum /usr/local/bin/cssos-rust-api target/release/cssos-rust-api | sed 's/^/  /'
else
  echo "  (none)"
fi
echo

echo "=== 4) force rebuild ==="
# bump mtime on the key files so cargo MUST recompile them
touch src/music_gen/musicgpt.rs src/music_gen/mod.rs src/pipeline_mv_api.rs
# full release build
cargo build --release 2>&1 | tail -25
echo

echo "=== 5) freshly built binary info ==="
NEW_BIN=target/release/cssos-rust-api
stat -c '  new binary: mtime=%y  size=%s' "$NEW_BIN"
echo "  conversionType count:"
strings "$NEW_BIN" | grep -c conversionType || true
echo "  preview of literal:"
strings "$NEW_BIN" | grep -A0 -B0 conversionType | head -5
echo

echo "=== 6) deploy new binary ==="
sudo install -m 0755 "$NEW_BIN" /usr/local/bin/cssos-rust-api
stat -c '  deployed: mtime=%y  size=%s' /usr/local/bin/cssos-rust-api
echo

echo "=== 7) restart cssos-rust-api ==="
sudo systemctl restart cssos-rust-api
sleep 4
sudo systemctl show cssos-rust-api -p MainPID,ActiveEnterTimestamp,SubState --no-pager
echo

echo "=== 8) health + route live ==="
curl -sS -o /dev/null -w '  /api/health: HTTP %{http_code}\n' http://127.0.0.1:8081/api/health
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{"prompt":"test","music_style":"test"}' \
  http://127.0.0.1:8081/api/mv/music \
  -o /dev/null -w '  /api/mv/music anon: HTTP %{http_code} (expect 401)\n'
echo
echo "=== done — now retry music stage in browser ==="
