#!/bin/bash
# CSSOS_WAVE_650 — One-shot install for the whisperX forced-alignment service.
# Run once on the server:  bash /srv/cssos/whisperx-align/install.sh
# NOTE: first run downloads the whisper model + per-language wav2vec2 align models
# (hundreds of MB). CPU works (int8); for GPU set WHISPERX_DEVICE=cuda in the unit
# and install the CUDA torch wheel instead of the CPU one.
set -e

DEST=/srv/cssos/whisperx-align
VENV=$DEST/venv

echo "[wave650] Creating virtualenv at $VENV"
python3 -m venv "$VENV"

echo "[wave650] Installing deps (whisperX + torch — may take 5-10 min)"
"$VENV/bin/pip" install --upgrade pip --quiet
"$VENV/bin/pip" install -r "$DEST/requirements.txt"

echo "[wave650] Installing systemd service"
sudo cp "$DEST/cssos-whisperx-align.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cssos-whisperx-align.service
sudo systemctl start cssos-whisperx-align.service

echo "[wave650] Waiting 12s for first-boot model load..."
sleep 12

if systemctl is-active --quiet cssos-whisperx-align.service; then
  echo "[wave650] ✅ Service running on 127.0.0.1:7892"
  curl -s http://127.0.0.1:7892/health | python3 -m json.tool || true
  echo
  echo "[wave650] Next: add to the Node backend env (/etc/cssos.env):"
  echo "          WHISPERX_ALIGN_URL=http://127.0.0.1:7892"
  echo "        then: sudo systemctl restart cssOS"
  echo "        then re-run the backfill:  POST /api/admin/resubtitle/<workId>"
else
  echo "[wave650] ❌ Failed to start — check: sudo journalctl -u cssos-whisperx-align -n 80"
  exit 1
fi
