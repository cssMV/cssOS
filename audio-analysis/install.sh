#!/bin/bash
# CSSOS_WAVE_441 — One-shot install script for the Python audio analysis service.
# Run once on the server: bash /srv/cssos/audio-analysis/install.sh
set -e

DEST=/srv/cssos/audio-analysis
VENV=$DEST/venv

echo "[wave441] Creating virtualenv at $VENV"
python3 -m venv "$VENV"

echo "[wave441] Installing Python dependencies (may take 2-3 min for librosa)"
"$VENV/bin/pip" install --upgrade pip --quiet
"$VENV/bin/pip" install -r "$DEST/requirements.txt" --quiet

echo "[wave441] Installing systemd service"
sudo cp "$DEST/cssos-audio-analysis.service" /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable cssos-audio-analysis.service
sudo systemctl start cssos-audio-analysis.service

echo "[wave441] Waiting 5s for service to start..."
sleep 5

if systemctl is-active --quiet cssos-audio-analysis.service; then
  echo "[wave441] ✅ Service running on 127.0.0.1:7891"
  curl -s http://127.0.0.1:7891/health | python3 -m json.tool
else
  echo "[wave441] ❌ Service failed to start — check: sudo journalctl -u cssos-audio-analysis -n 50"
  exit 1
fi
