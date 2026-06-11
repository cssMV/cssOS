#!/usr/bin/env bash
# CSSOS — 把 api-vm 的三件套调用指向【新 ML worker】, 并停掉本机的 ML 服务(腾内存)。
# 在【api-vm】上运行(sudo)。用法:  sudo bash rewire-api-vm.sh <WORKER_内网IP>
#
# 三件套 env(代码已支持, 见 src/index.ts):
#   WHISPERX_ALIGN_URL   → :7892   (强制对齐 + 自由ASR)
#   DEMUCS_SEP_URL       → :7893   (人声分离 + SER, 同一服务)
#   AUDIO_ANALYSIS_URL   → :7891   (librosa 富集; WAVE_680 起支持完整URL)
set -euo pipefail
W="${1:?用法: sudo bash rewire-api-vm.sh <WORKER_内网IP>}"
ENV=/etc/cssos.env
say(){ printf '\n[rewire] %s\n' "$*"; }

say "① 备份 env"
sudo cp "$ENV" "${ENV}.bak.$(date +%Y%m%d%H%M%S)"

say "② 写入/更新三件套 URL 指向 worker $W"
set_env(){ # key value
  if grep -q "^$1=" "$ENV"; then sudo sed -i "s#^$1=.*#$1=$2#" "$ENV";
  else echo "$1=$2" | sudo tee -a "$ENV" >/dev/null; fi
}
set_env WHISPERX_ALIGN_URL "http://${W}:7892"
set_env DEMUCS_SEP_URL     "http://${W}:7893"
set_env AUDIO_ANALYSIS_URL "http://${W}:7891"

say "③ 连通性自检(从 api-vm 走内网到 worker)"
ok=1
for p in 7891 7892 7893; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 8 "http://${W}:${p}/health" || echo 000)
  echo "  worker :$p → http=$code"; [ "$code" = "200" ] || ok=0
done
[ "$ok" = "1" ] || { echo "⚠️ 有端口不通 — 先查 worker 服务 + 防火墙(源应为 api-vm 内网IP), 通了再继续"; exit 1; }

say "④ 停掉 api-vm 本机的三件套(腾内存; 不删, 留作回退)"
sudo systemctl disable --now cssos-whisperx-align cssos-demucs-sep cssos-audio-analysis 2>/dev/null || true

say "⑤ 重启 node 主 app 让新 env 生效"
sudo systemctl restart cssOS.service
sleep 4
curl -s -o /dev/null -w "  本机 health http=%{http_code}\n" --max-time 10 http://127.0.0.1:3000/api/health

say "完成。建议跑一首 resubtitle 验证端到端(现在重活在 worker 上, 不碰线上):"
echo '  T=$(grep -oP "CSSOS_ADMIN_TOKEN=\\K.*" /etc/cssos.env|tr -d "\"")'
echo '  curl -s -X POST -H "x-admin-token: $T" http://127.0.0.1:3000/api/admin/resubtitle/<workId>'
echo
echo "回退: 把 ${ENV}.bak.* 覆盖回 ${ENV}, 重新 enable --now 三件套, 重启 cssOS。"
