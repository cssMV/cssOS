#!/usr/bin/env bash
# CSSOS — api-vm 现机内存/调度护栏(在 worker 分家前先让现机不会再被自己拖垮)。
# 在【api-vm】上运行(sudo)。根治 6/7 事故: whisperX medium 在 15GB 机上把整机推入 swap 死亡螺旋。
#   思路: ① 给 ML 三件套 MemoryMax → 内存爆只 OOM 杀【该进程】, 绝不拖垮整机;
#         ② OOMScoreAdjust: 主 app/nginx 永不被杀(-900), ML 最先被杀(+800);
#         ③ CPU 限额/低权重(早前已设, 这里补齐持久化)。
set -euo pipefail
say(){ printf '\n[optimize] %s\n' "$*"; }

say "① ML 三件套: MemoryMax(爆内存只杀自己) + 最先被 OOM 杀 + 低 CPU 权重"
sudo systemctl set-property cssos-whisperx-align MemoryMax=3G MemoryHigh=2500M OOMScoreAdjust=800 CPUWeight=10 CPUQuota=200% IOWeight=10
sudo systemctl set-property cssos-demucs-sep     MemoryMax=5G MemoryHigh=4500M OOMScoreAdjust=800 CPUWeight=10 CPUQuota=200% IOWeight=10
sudo systemctl set-property cssos-audio-analysis MemoryMax=2G                  OOMScoreAdjust=800 CPUWeight=10 CPUQuota=150% IOWeight=10

say "② 主 app: 永不被 OOM 杀 + 最高 CPU 权重(线上绝对优先)"
sudo systemctl set-property cssOS.service OOMScoreAdjust=-900 CPUWeight=10000 IOWeight=1000
# nginx 也护住(若是 systemd 服务)
sudo systemctl set-property nginx.service OOMScoreAdjust=-800 2>/dev/null || true

say "③ 降低 swappiness(少往 swap 甩, 减颠簸)"
echo 'vm.swappiness=10' | sudo tee /etc/sysctl.d/99-cssos-swap.conf >/dev/null
sudo sysctl -p /etc/sysctl.d/99-cssos-swap.conf || true

say "④ 重启三件套让 MemoryMax 生效(set-property 对 MemoryMax 多数需重启进程)"
sudo systemctl restart cssos-whisperx-align cssos-demucs-sep cssos-audio-analysis 2>/dev/null || true

say "⑤ 核对"
for u in cssos-whisperx-align cssos-demucs-sep cssos-audio-analysis cssOS.service; do
  echo "[$u]"; systemctl show "$u" -p MemoryMax -p OOMScoreAdjust -p CPUWeight 2>/dev/null
done
free -h | awk 'NR<=2'
say "完成。现机已上内存护栏: 任何 ML 内存失控只会被单独 OOM 掉, 线上永不再被拖垮。"
