#!/usr/bin/env bash
# CSSOS ML Worker 安装脚本 — 在【新 worker】上运行(以 sudo/root 或有 sudo 的用户)。
# 作用: 装系统依赖 → 从 api-vm 拉三件套服务代码 → 各自建 venv → 装带 MemoryMax 的 systemd 单元。
# 三件套: whisperX(:7892) / Demucs+SER(:7893) / audio-analysis librosa(:7891)。
#
# 用法:  API_VM=<api-vm内网IP或主机别名> bash setup-worker.sh
#   (从 api-vm 拉代码用 rsync over ssh; 需 worker 能 ssh 到 api-vm, 或先手工 scp 三个目录过来)
set -euo pipefail

API_VM="${API_VM:-api-vm}"          # api-vm 的内网 IP 或 ssh 别名
SRV=/srv/cssos
say(){ printf '\n[ml-worker] %s\n' "$*"; }

say "① 系统依赖(ffmpeg/python venv/构建工具)"
sudo apt-get update -y
sudo apt-get install -y python3 python3-venv python3-dev build-essential ffmpeg git rsync curl libsndfile1

say "② 从 api-vm 拉三件套服务代码(不含 venv, venv 本机重建)"
sudo mkdir -p "$SRV"
sudo chown -R "$USER":"$USER" "$SRV"
for d in whisperx-align demucs-sep audio-analysis; do
  rsync -az --exclude 'venv' --exclude '__pycache__' --exclude '.hf-cache' \
    "${API_VM}:${SRV}/${d}/" "${SRV}/${d}/" || { echo "rsync $d 失败 — 也可手工 scp"; }
done

say "③ 各服务建独立 venv + 装依赖(requirements.txt)"
for d in whisperx-align demucs-sep audio-analysis; do
  if [ -d "${SRV}/${d}" ]; then
    python3 -m venv "${SRV}/${d}/venv"
    "${SRV}/${d}/venv/bin/pip" install --upgrade pip wheel
    if [ -f "${SRV}/${d}/requirements.txt" ]; then
      "${SRV}/${d}/venv/bin/pip" install -r "${SRV}/${d}/requirements.txt"
    fi
    # SER 在 demucs 服务里, transformers 必须 4.49(5.x 报 all_tied_weights_keys)
    if [ "$d" = "demucs-sep" ]; then
      "${SRV}/${d}/venv/bin/pip" install "transformers==4.49.0"
    fi
  fi
done

say "④ 装 systemd 单元(带 MemoryMax — 内存爆只杀该进程, 永不拖垮整机)"
# whisperX :7892  (MemoryMax 3G: medium 模型 ~1.5G + 对齐缓冲)
sudo tee /etc/systemd/system/cssos-whisperx-align.service >/dev/null <<EOF
[Unit]
Description=cssOS whisperX Forced-Alignment + ASR (ML worker)
After=network-online.target
[Service]
WorkingDirectory=${SRV}/whisperx-align
ExecStart=${SRV}/whisperx-align/venv/bin/python main.py
Environment=WHISPERX_PORT=7892
Environment=WHISPERX_MODEL=medium
Environment=WHISPERX_DEVICE=cpu
Environment=WHISPERX_COMPUTE=int8
Environment=HF_HOME=${SRV}/whisperx-align/.hf-cache
Restart=always
RestartSec=5
MemoryMax=3G
MemoryHigh=2500M
[Install]
WantedBy=multi-user.target
EOF

# Demucs + SER :7893  (MemoryMax 5G: demucs ~3G + SER audeering ~1.5G)
sudo tee /etc/systemd/system/cssos-demucs-sep.service >/dev/null <<EOF
[Unit]
Description=cssOS Demucs Vocal-Separation + SER (ML worker)
After=network-online.target
[Service]
WorkingDirectory=${SRV}/demucs-sep
ExecStart=${SRV}/demucs-sep/venv/bin/python main.py
Environment=DEMUCS_PORT=7893
Restart=always
RestartSec=5
MemoryMax=5G
MemoryHigh=4500M
[Install]
WantedBy=multi-user.target
EOF

# audio-analysis (librosa) :7891  (MemoryMax 2G)
sudo tee /etc/systemd/system/cssos-audio-analysis.service >/dev/null <<EOF
[Unit]
Description=cssOS Audio Analysis librosa (ML worker)
After=network-online.target
[Service]
WorkingDirectory=${SRV}/audio-analysis
ExecStart=${SRV}/audio-analysis/venv/bin/python main.py
Environment=AUDIO_ANALYSIS_PORT=7891
Restart=always
RestartSec=5
MemoryMax=2G
[Install]
WantedBy=multi-user.target
EOF

say "⑤ 启动 + 自启"
sudo systemctl daemon-reload
sudo systemctl enable --now cssos-whisperx-align cssos-demucs-sep cssos-audio-analysis

say "⑥ 健康自检"
sleep 5
for p in 7891 7892 7893; do
  curl -s -o /dev/null -w "  :$p http=%{http_code}\n" --max-time 8 "http://127.0.0.1:$p/health" || echo "  :$p 未起(看 journalctl)"
done
say "完成。回 api-vm 跑 rewire-api-vm.sh <本worker内网IP> 接线。"
