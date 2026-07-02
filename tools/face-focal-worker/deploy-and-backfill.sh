#!/usr/bin/env bash
# CSSOS 20260701 — Layer 2 封面人脸焦点: ①部署 worker 到 atelier(:7898) ②回填现有封面焦点。
#
# 前提: atelier VM 必须在线(publickey denied / curl 不通 = VM 被停, 先云控制台开机;
#       见 [[whisperx_worker_on_dedicated_vm]] 同样的坑)。
#
# 用法:
#   bash tools/face-focal-worker/deploy-and-backfill.sh deploy    # 只部署+起服务
#   bash tools/face-focal-worker/deploy-and-backfill.sh backfill  # 只回填(worker 需已在跑)
#   bash tools/face-focal-worker/deploy-and-backfill.sh all       # 两步都做
set -euo pipefail
ATELIER=atelier
WORKER_DIR=/opt/cssos/face-focal
STEP="${1:-all}"

deploy() {
  echo "[face-focal] 部署 worker 到 ${ATELIER}:${WORKER_DIR}"
  ssh "$ATELIER" "mkdir -p $WORKER_DIR"
  rsync -az "$(dirname "$0")/face_focal_worker.py" "$ATELIER:$WORKER_DIR/"
  ssh "$ATELIER" bash -s <<'REMOTE'
set -e
cd /opt/cssos/face-focal
python3 -m venv .venv 2>/dev/null || true
. .venv/bin/activate
pip -q install --upgrade pip >/dev/null
pip -q install fastapi uvicorn mediapipe opencv-python-headless requests numpy >/dev/null
# systemd 用户级常驻(重启自愈)
sudo tee /etc/systemd/system/cssos-face-focal.service >/dev/null <<UNIT
[Unit]
Description=cssOS face-focal detection worker (:7898)
After=network.target
[Service]
WorkingDirectory=/opt/cssos/face-focal
ExecStart=/opt/cssos/face-focal/.venv/bin/uvicorn face_focal_worker:app --host 0.0.0.0 --port 7898
Restart=always
RestartSec=3
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload
sudo systemctl enable --now cssos-face-focal
sleep 2
curl -s -m5 http://127.0.0.1:7898/health && echo " <- worker up"
REMOTE
}

backfill() {
  echo "[face-focal] 回填现有封面焦点(经 api-vm 上的 node 脚本, 内网直连 worker)"
  # worker 只在 atelier 内网; 用 ssh 隧道让 api-vm 可达, 或直接在本机跑脚本走 atelier 公网。
  # 这里在本机跑, worker URL 由 FACE_FOCAL_URL 指定(默认 atelier 公网 :7898)。
  FACE_FOCAL_URL="${FACE_FOCAL_URL:-http://34.171.124.42:7898}" \
    node "$(dirname "$0")/backfill_cover_focal.mjs"
}

case "$STEP" in
  deploy) deploy ;;
  backfill) backfill ;;
  all) deploy; backfill ;;
  *) echo "usage: $0 {deploy|backfill|all}"; exit 1 ;;
esac
