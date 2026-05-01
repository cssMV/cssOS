#!/usr/bin/env bash
# CSSOS_PHASE2_KIE_PIVOT 20260429 #204 — Deploy + smoke the kie.ai-backed
# Suno music engine. Run this from your Mac (it SSHes into api-vm via your
# ~/.ssh/config). It:
#   1. rsyncs rust-api/ → api-vm:/srv/cssos/repo/rust-api/
#   2. cargo build --release on api-vm + restart cssos-rust-api.service
#   3. dumps the engine catalog + tries one short Suno generation request
#      end-to-end so you can compare it to the ElevenLabs output.
#
# Notes:
#   • /etc/cssos.env already has KIE_API_KEY=…; SunoClient::from_env reads
#     SUNO_API_KEY OR KIE_API_KEY. No env edits required.
#   • If V5 isn't on your kie.ai plan, override per-deploy with:
#       SUNO_MODEL=V4_5 ./scripts/deploy-kie-204.sh
#     and the script will edit /etc/cssos.env on api-vm.
set -euo pipefail

TARGET="${TARGET:-api-vm}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SUNO_MODEL_OVERRIDE="${SUNO_MODEL:-}"

say() { printf '[kie-204] %s\n' "$*"; }

say "1a/4 rsync rust-api → ${TARGET}"
rsync -az --delete \
  --exclude target --exclude build \
  --exclude '.DS_Store' --exclude '._*' --exclude '.AppleDouble' \
  "${REPO_ROOT}/rust-api/" \
  "${TARGET}:/srv/cssos/repo/rust-api/"

say "1b/4 rsync public/ → ${TARGET}:/srv/cssos/current/public/"
rsync -az \
  --exclude '.DS_Store' --exclude '._*' --exclude '.AppleDouble' \
  "${REPO_ROOT}/public/" \
  "${TARGET}:/tmp/cssos-public-stage/"
ssh "${TARGET}" 'sudo rsync -a --delete /tmp/cssos-public-stage/ /srv/cssos/current/public/ \
  && sudo chown -R www-data:www-data /srv/cssos/current/public/'

if [[ -n "${SUNO_MODEL_OVERRIDE}" ]]; then
  say "2a/4 setting SUNO_MODEL=${SUNO_MODEL_OVERRIDE} in /etc/cssos.env"
  ssh "${TARGET}" "sudo sed -i '/^SUNO_MODEL=/d' /etc/cssos.env && \
    echo 'SUNO_MODEL=${SUNO_MODEL_OVERRIDE}' | sudo tee -a /etc/cssos.env >/dev/null"
fi

say "2/4 cargo build --release + restart on ${TARGET}"
# Mirror deploy-phase2-mv.sh: tch-rs needs LIBTORCH, cargo lives under jing's home,
# the binary is `cssos-rust-api` and lands in /usr/local/bin.
ssh "${TARGET}" 'set -euo pipefail
  export PATH=/home/jing/.cargo/bin:$PATH
  export LIBTORCH_USE_PYTORCH=1
  cd /srv/cssos/repo/rust-api
  cargo build --release 2>&1 | tail -25
  sudo install -m 755 target/release/cssos-rust-api /usr/local/bin/cssos-rust-api
  sudo systemctl restart cssos-rust-api
  sleep 3
  sudo systemctl is-active --quiet cssos-rust-api && echo active || (echo NOT_ACTIVE; exit 1)
'

say "3/4 verify engine catalog includes Suno (default)"
ssh "${TARGET}" 'curl -sS http://127.0.0.1:8080/api/mv/engines 2>&1 \
  | python3 -c "
import sys, json
d = json.load(sys.stdin)
for e in d.get(\"engines\", []):
    if e.get(\"domain\") == \"music\":
        print(f\"  {e[\"id\"][\"name\"]:12s} v={e[\"id\"][\"version\"]:6s} enabled={e.get(\"default_enabled\")} default={e.get(\"is_default\", False)}\")
"'

say "4/4 fire one short Suno generation (instrumental, 30s budget)"
ssh "${TARGET}" 'curl -sS -X POST http://127.0.0.1:8080/api/mv/music \
  -H "Content-Type: application/json" \
  -d "{\"engine\":\"suno\",\"version\":\"v4\",\"prompt\":\"a soft warm piano melody with strings\",\"make_instrumental\":true,\"target_duration_secs\":60}" \
  --max-time 240 2>&1 | head -c 1500
echo'

say "done. Watch logs: ssh ${TARGET} sudo journalctl -u cssos-rust-api -f"
