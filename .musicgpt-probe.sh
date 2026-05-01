#!/usr/bin/env bash
# MusicGPT 422 — restart rust-api + verify new binary loads
# Run via: ssh api-vm 'bash -s' < ~/cssOS/.musicgpt-probe.sh
set +e

echo "=== BEFORE: current rust-api process ==="
sudo systemctl show cssos-rust-api -p MainPID,ActiveEnterTimestamp --no-pager
BINPATH=$(sudo systemctl show cssos-rust-api -p ExecStart --value | sed -E 's/.*path=([^ ;]+).*/\1/')
echo "binary on disk: $BINPATH"
stat -c '  mtime: %y' "$BINPATH"
echo "  strings grep conversionType count:"
sudo strings "$BINPATH" | grep -c conversionType
echo

echo "=== restart cssos-rust-api ==="
sudo systemctl restart cssos-rust-api
sleep 4

echo "=== AFTER: new process info ==="
sudo systemctl show cssos-rust-api -p MainPID,ActiveEnterTimestamp,SubState --no-pager
echo

echo "=== health check ==="
curl -sS -o /dev/null -w 'rust /api/health: HTTP %{http_code}\n' \
  --max-time 5 http://127.0.0.1:8081/api/health
echo

echo "=== hit /api/mv/music anonymous (expect 401 or 503, NOT 422) ==="
curl -sS -X POST -H 'Content-Type: application/json' \
  -d '{"prompt":"pop rock","music_style":"pop rock"}' \
  http://127.0.0.1:8081/api/mv/music \
  -w '\nHTTP %{http_code}\n' --max-time 10
echo

echo "=== journal last 90s — grep music / MusicAI / 422 / conversionType ==="
sudo journalctl -u cssos-rust-api --since '90 seconds ago' --no-pager \
  | grep -iE 'musicai|conversiontype|music_gen|/api/mv/music|status 422|MusicGPT' \
  | tail -60

echo
echo "=== done ==="
